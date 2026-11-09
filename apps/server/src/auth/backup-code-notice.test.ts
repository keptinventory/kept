import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cookieHeader,
  enrolTotp,
  requestHeaders,
  signUp,
  type TestAuth,
  testAuth,
} from '../../test/auth.js';
import { type TestDb, testDb } from '../../test/db.js';
import { userEmail } from '../../test/tenancy.js';

// #419: a backup code accepted at sign-in is mailed to the account's owner, like the other
// second-factor changes (auth/security.ts). The mail says when, on what, and how many codes are
// left; a wrong code, a managed account and a failing mail change nothing about the sign-in.

const PASSWORD = 'correct horse battery';
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

let db: TestDb;

beforeEach(async () => {
  db = await testDb();
  await db.reset();
});

/** An account with the authenticator app on, and its ten backup codes. */
async function enrolled(auth: TestAuth, label: string) {
  const email = `${label}-${randomUUID()}@example.com`;
  const signedIn = await signUp(auth, email, PASSWORD);
  await userEmail(db, signedIn.userId, true);
  await enrolTotp(auth, signedIn, PASSWORD);
  const viewed = await auth.api.viewBackupCodes({ body: { userId: signedIn.userId } });
  return { ...signedIn, email, codes: viewed.backupCodes };
}

/** A password sign-in that answers the two-factor challenge with a backup code, from an iPhone. */
async function signInWithBackupCode(auth: TestAuth, email: string, code: string) {
  const challenge = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    headers: requestHeaders(),
    returnHeaders: true,
  });
  const headers = requestHeaders(cookieHeader(challenge.headers));
  headers.set('user-agent', IPHONE_SAFARI);
  return auth.api.verifyBackupCode({ body: { code }, headers, returnHeaders: true });
}

async function sessionsOf(userId: string): Promise<number> {
  const { rows } = await db.pools.auth.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM auth.session WHERE user_id = $1',
    [userId],
  );
  return rows[0]?.n ?? 0;
}

/** Long enough for a background send to have landed, had one been started. */
const settle = () => new Promise((r) => setTimeout(r, 200));

describe('a backup code used to sign in is mailed to the owner (#419)', () => {
  it('mails the owner on a good code: the time, the device, and how many codes are left', async () => {
    const auth = testAuth(db, {
      rateLimitEnabled: false,
      timeZoneOf: async () => 'Africa/Cairo',
    });
    const user = await enrolled(auth, 'good');
    const before = Date.now();
    const signedIn = await signInWithBackupCode(auth, user.email, user.codes[0] ?? '');
    expect(signedIn.response.user.id).toBe(user.userId);
    await vi.waitFor(() => expect(auth.backupCodeNotices).toHaveLength(1), { timeout: 10_000 });
    const [mail] = auth.backupCodeNotices;
    expect(mail).toMatchObject({
      email: user.email,
      browser: 'Safari',
      os: 'iPhone',
      left: 9,
      timeZone: 'Africa/Cairo',
    });
    const at = Date.parse(mail?.at ?? '');
    expect(at).toBeGreaterThanOrEqual(before - 1_000);
    expect(at).toBeLessThanOrEqual(Date.now() + 1_000);
    // Never the code, and none of the other notices.
    expect(JSON.stringify(mail)).not.toContain(user.codes[0]);
    expect(auth.notices.filter((n) => n.email === user.email).map((n) => n.event)).toEqual([
      'two-factor-enabled',
    ]);
  });

  it('counts down the codes left with each one used', async () => {
    const auth = testAuth(db, { rateLimitEnabled: false });
    const user = await enrolled(auth, 'count');
    await signInWithBackupCode(auth, user.email, user.codes[0] ?? '');
    await vi.waitFor(() => expect(auth.backupCodeNotices).toHaveLength(1), { timeout: 10_000 });
    await signInWithBackupCode(auth, user.email, user.codes[1] ?? '');
    await vi.waitFor(() => expect(auth.backupCodeNotices).toHaveLength(2), { timeout: 10_000 });
    expect(auth.backupCodeNotices.map((m) => m.left)).toEqual([9, 8]);
    // No profile time zone known: the mail says UTC.
    expect(auth.backupCodeNotices[0]?.timeZone).toBe('UTC');
  });

  it('mails nothing for a wrong code, or a code already used', async () => {
    const auth = testAuth(db, { rateLimitEnabled: false });
    const user = await enrolled(auth, 'bad');
    await expect(signInWithBackupCode(auth, user.email, 'AAAAA-BBBBB')).rejects.toMatchObject({
      statusCode: 401,
    });
    await signInWithBackupCode(auth, user.email, user.codes[0] ?? '');
    await vi.waitFor(() => expect(auth.backupCodeNotices).toHaveLength(1), { timeout: 10_000 });
    await expect(signInWithBackupCode(auth, user.email, user.codes[0] ?? '')).rejects.toMatchObject(
      { statusCode: 401 },
    );
    await settle();
    expect(auth.backupCodeNotices).toHaveLength(1);
  });

  it('mails the owner when a code finishes a pending sign-in, or is used without a session', async () => {
    const auth = testAuth(db, { rateLimitEnabled: false });
    const user = await enrolled(auth, 'pending');
    // A magic link signs in pending; the backup code completes it in that session.
    await auth.api.signInMagicLink({ body: { email: user.email }, headers: requestHeaders() });
    const linked = await auth.api.magicLinkVerify({
      query: { token: auth.mails.at(-1)?.token ?? '' },
      headers: requestHeaders(),
      returnHeaders: true,
    });
    await auth.api.verifyBackupCode({
      body: { code: user.codes[0] ?? '' },
      headers: requestHeaders(cookieHeader(linked.headers)),
    });
    await vi.waitFor(() => expect(auth.backupCodeNotices).toHaveLength(1), { timeout: 10_000 });
    // No user agent sent: no device named.
    expect(auth.backupCodeNotices[0]).toMatchObject({ browser: null, os: null, left: 9 });

    // `disableSession` at the sign-in challenge uses the code up without signing in.
    const challenge = await auth.api.signInEmail({
      body: { email: user.email, password: PASSWORD },
      headers: requestHeaders(),
      returnHeaders: true,
    });
    await auth.api.verifyBackupCode({
      body: { code: user.codes[1] ?? '', disableSession: true },
      headers: requestHeaders(cookieHeader(challenge.headers)),
    });
    await vi.waitFor(() => expect(auth.backupCodeNotices).toHaveLength(2), { timeout: 10_000 });
    expect(auth.backupCodeNotices[1]).toMatchObject({ email: user.email, left: 8 });
  });

  it('never mails a managed account (no real address)', async () => {
    const auth = testAuth(db, { rateLimitEnabled: false });
    const user = await enrolled(auth, 'managed');
    const managed = `${randomUUID()}@managed.invalid`;
    await db.pools.auth.query('UPDATE auth."user" SET email = $1 WHERE id = $2', [
      managed,
      user.userId,
    ]);
    const signedIn = await signInWithBackupCode(auth, managed, user.codes[0] ?? '');
    expect(signedIn.response.user.id).toBe(user.userId);
    await settle();
    expect(auth.backupCodeNotices).toEqual([]);
  });

  it('signs in all the same when the mail fails, and mails in UTC when the zone lookup fails', async () => {
    const failures: string[] = [];
    const failing = testAuth(db, {
      rateLimitEnabled: false,
      timeZoneOf: async () => {
        throw new Error('profile lookup failed');
      },
      onBackgroundError: (_err, what) => {
        failures.push(what);
      },
    });
    const user = await enrolled(failing, 'fails');
    const sessions = await sessionsOf(user.userId);
    const first = await signInWithBackupCode(failing, user.email, user.codes[0] ?? '');
    expect(first.response.user.id).toBe(user.userId);
    expect(await sessionsOf(user.userId)).toBe(sessions + 1);
    // A notice without the profile's zone still goes out, in UTC.
    await vi.waitFor(() => expect(failing.backupCodeNotices).toHaveLength(1), { timeout: 10_000 });
    expect(failing.backupCodeNotices[0]).toMatchObject({ timeZone: 'UTC', left: 9 });

    // The send itself throws, synchronously and as a rejection.
    for (const [i, sendBackupCodeUsed] of [
      (): Promise<void> => {
        throw new Error('smtp down');
      },
      () => Promise.reject(new Error('smtp down')),
    ].entries()) {
      const broken = testAuth(db, {
        rateLimitEnabled: false,
        mail: {
          sendMagicLink: async () => {},
          sendPasswordReset: async () => {},
          sendSecurityNotice: async () => {},
          sendBackupCodeUsed,
        },
        onBackgroundError: (_err, what) => {
          failures.push(what);
        },
      });
      const code = user.codes[i + 1] ?? '';
      const res = await signInWithBackupCode(broken, user.email, code);
      expect(res.response.user.id).toBe(user.userId);
    }
    await vi.waitFor(() => expect(failures).toEqual(['mail', 'mail']), {
      timeout: 10_000,
    });
  });
});
