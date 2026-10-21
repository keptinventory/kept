import { randomUUID } from 'node:crypto';
import type { LightMyRequestResponse } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jar, type TestApp, type TestAppOptions, testApp } from '../../test/app.js';
import { cookieHeader, nextTotp, requestHeaders, signUp, totp } from '../../test/auth.js';
import { type TestDb, testDb } from '../../test/db.js';
import { freshIp } from '../../test/people.js';
import { addMember, ownerTx, seedTenant, userEmail } from '../../test/tenancy.js';
import { registerSoftPasskey, softRegistration } from '../../test/webauthn.js';
import { ensureAccount } from '../accounts/ensure-account.js';
import { tokenAccessOf } from '../tokens/access.js';
import { AUTH_BASE_PATH, SIGN_IN_MANAGEMENT_PATHS } from './auth.js';
import { lockAccount } from './security.js';
import { FREE_FAILURES } from './sign-in-limiter.js';
import { claimTotpStep } from './totp.js';

// Settings → Sign-in and security: passkeys and the authenticator app, through Kept's own routes
// (auth/sign-in-security.ts) and Better Auth's mount, the way the browser calls them.

const PASSWORD = 'correct horse battery';

let db: TestDb;
let t: TestApp;

async function app(opts: TestAppOptions = {}) {
  t = await testApp(db, { rateLimitEnabled: false, ...opts });
}

beforeEach(async () => {
  db = await testDb();
  await db.reset();
  await app();
});

type User = { userId: string; email: string; cookie: string };
type Send = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  cookie?: string;
  body?: unknown;
  ip?: string;
};

function send(url: string, opts: Send = {}): Promise<LightMyRequestResponse> {
  const headers: Record<string, string> = { origin: t.publicUrl };
  if (opts.cookie) headers.cookie = opts.cookie;
  return t.app.inject({
    method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'),
    url,
    headers,
    remoteAddress: opts.ip ?? freshIp(),
    ...(opts.body !== undefined ? { payload: opts.body as object } : {}),
  });
}
const auth = (path: string, opts: Send = {}) => send(`${AUTH_BASE_PATH}${path}`, opts);
const kept = (path: string, opts: Send = {}) => send(`/api/v1${path}`, opts);

/** A signed-in person with an owner account; `password: false` makes the account passwordless
 * (passkey, email link or Google only), as a magic-link claim or an outside sign-in leaves it. */
async function newUser(label: string, opts: { password?: boolean } = {}): Promise<User> {
  const email = `${label}-${randomUUID()}@example.com`;
  const signed = await signUp(t.auth, email, PASSWORD);
  await ensureAccount(db.pools, signed.userId);
  if (opts.password === false) {
    await db.pools.auth.query(
      `DELETE FROM auth.account WHERE user_id = $1 AND provider_id = 'credential'`,
      [signed.userId],
    );
  }
  return { ...signed, email };
}

/** Every session of the user was signed in over ten minutes ago. */
async function stale(user: User) {
  await db.pools.auth.query(
    `UPDATE auth.session SET created_at = now() - interval '11 minutes' WHERE user_id = $1`,
    [user.userId],
  );
}

/** A second device's session: a sign-in by email link (the address is verified, so the link
 * signs in rather than claiming the account). */
async function otherDevice(user: User): Promise<string> {
  await userEmail(db, user.userId, true);
  await t.auth.api.signInMagicLink({ body: { email: user.email }, headers: requestHeaders() });
  const token = t.auth.mails.at(-1)?.token ?? '';
  const { headers } = await t.auth.api.magicLinkVerify({
    query: { token },
    headers: requestHeaders(),
    returnHeaders: true,
  });
  return cookieHeader(headers);
}

/** Whether the session behind `cookie` still exists. */
async function alive(cookie: string): Promise<boolean> {
  const res = await auth('/get-session', { cookie });
  return res.statusCode === 200 && res.json() !== null;
}

/** Confirms it's you for adding a passkey (the password; an account without one passes on a
 * recent sign-in), as the app's sheet does before the browser's ceremony. */
function confirmPasskeyAdd(cookie: string, password: string | undefined = PASSWORD) {
  return kept('/me/passkeys/confirm', { cookie, body: password === undefined ? {} : { password } });
}

async function addPasskey(
  cookie: string,
  body: { name?: string; createSession?: boolean } = {},
  opts: { userVerified?: boolean; confirm?: boolean } = {},
): Promise<LightMyRequestResponse> {
  if (opts.confirm !== false) await confirmPasskeyAdd(cookie);
  return ceremony(cookie, body, opts);
}

/** The browser's registration ceremony against Better Auth, without confirming first. */
async function ceremony(
  cookie: string,
  body: { name?: string; createSession?: boolean } = {},
  opts: { userVerified?: boolean } = {},
): Promise<LightMyRequestResponse> {
  const options = await auth('/passkey/generate-register-options', { cookie });
  if (options.statusCode !== 200) return options;
  const { challenge } = options.json() as { challenge: string };
  const origin = new URL(t.publicUrl);
  return auth('/passkey/verify-registration', {
    cookie: jar(options, cookie),
    body: {
      response: softRegistration(challenge, { id: origin.hostname, origin: origin.origin }, opts),
      ...body,
    },
  });
}

async function passkeyRows(userId: string) {
  const { rows } = await db.pools.auth.query<{ id: string; name: string | null }>(
    'SELECT id, name FROM auth.passkey WHERE user_id = $1 ORDER BY created_at, id',
    [userId],
  );
  return rows;
}

async function signInView(cookie: string) {
  const res = await kept('/me/sign-in', { cookie });
  expect(res.statusCode).toBe(200);
  return res.json() as {
    password: boolean;
    passkeys: { id: string; name: string | null; createdAt: string | null; backedUp: boolean }[];
    twoFactor: { enabled: boolean; backupCodesLeft: number | null };
    linked: { providerId: string }[];
    emailLink: boolean;
  };
}

/** Turns the authenticator app on through Kept's route and a first code. Returns the secret, the
 * backup codes and the cookie of the session Better Auth swapped in. */
async function turnOn(
  user: User,
  body: { password?: string } = { password: PASSWORD },
): Promise<{ secret: string; backupCodes: string[]; cookie: string }> {
  const started = await kept('/me/two-factor/enable', { cookie: user.cookie, body });
  expect(started.statusCode, started.body).toBe(200);
  const { totpURI, backupCodes } = started.json() as { totpURI: string; backupCodes: string[] };
  const secret = new URL(totpURI).searchParams.get('secret') ?? '';
  const verified = await auth('/two-factor/verify-totp', {
    cookie: user.cookie,
    body: { code: await nextTotp(secret, user.userId) },
  });
  expect(verified.statusCode, verified.body).toBe(200);
  return { secret, backupCodes, cookie: jar(verified, user.cookie) };
}

/** A password sign-in that answers the two-factor challenge with `code`: the second step's
 * status (200 signed in). */
async function signInWith(
  email: string,
  second: { code: string } | { backupCode: string },
): Promise<number> {
  const first = await auth('/sign-in/email', { body: { email, password: PASSWORD } });
  expect(first.json()).toMatchObject({ twoFactorRedirect: true });
  const res =
    'code' in second
      ? await auth('/two-factor/verify-totp', {
          cookie: jar(first),
          body: { code: second.code },
        })
      : await auth('/two-factor/verify-backup-code', {
          cookie: jar(first),
          body: { code: second.backupCode },
        });
  return res.statusCode;
}

const wrongCode = (secret: string) => (totp(secret) === '000000' ? '111111' : '000000');

function noticesFor(email: string) {
  return t.auth.notices.filter((n) => n.email === email);
}

async function accountAudit(userId: string) {
  return ownerTx(db, async (c) => {
    const { rows } = await c.query<{ action: string; entity_type: string; entity_id: string }>(
      `SELECT e.action, e.entity_type, e.entity_id::text FROM public.audit_events e
         JOIN public.owner_accounts a ON a.id = e.owner_account_id
        WHERE a.user_id = $1 AND e.location_id IS NULL ORDER BY e.at, e.id`,
      [userId],
    );
    return rows;
  });
}

const GOOGLE = { clientId: 'google-client-id', clientSecret: 'google-secret' };

/** An app with Google sign-in configured. */
async function withGoogle(opts: TestAppOptions = {}) {
  await app({ ...opts, google: { ...GOOGLE, invites: { find: async () => null } } as never });
}

async function linkGoogle(userId: string): Promise<string> {
  const { rows } = await db.pools.auth.query<{ id: string }>(
    `INSERT INTO auth.account (account_id, provider_id, user_id, created_at, updated_at)
     VALUES ($1, 'google', $2, now(), now()) RETURNING id`,
    [randomUUID(), userId],
  );
  return rows[0]?.id ?? '';
}

/** Kept's unlink of an outside sign-in (Better Auth's /unlink-account is off over HTTP). */
function unlink(cookie: string, accountId: string, password?: string) {
  return kept(`/me/linked/${accountId}`, {
    method: 'DELETE',
    cookie,
    body: password === undefined ? {} : { password },
  });
}

/** Every session of the user, moved `minutes` further into the past. */
async function age(user: User, minutes: number) {
  await db.pools.auth.query(
    `UPDATE auth.session SET created_at = created_at - make_interval(mins => $2) WHERE user_id = $1`,
    [user.userId, minutes],
  );
}

/** Makes the user a member of a location that asks everyone for two-factor. */
async function joinTwoFactorLocation(user: User) {
  const owner = await seedTenant(db, `owner-${randomUUID().slice(0, 8)}`, { require2fa: true });
  await addMember(db, owner.locationId, user.userId, 'member');
}

describe('GET /api/v1/me/sign-in', () => {
  it("lists only the signed-in person's passkeys: name, date, synced or this device only", async () => {
    const ann = await newUser('ann');
    const ben = await newUser('ben');
    expect((await addPasskey(ann.cookie, { name: 'Laptop' })).statusCode).toBe(200);
    expect((await addPasskey(ann.cookie, { name: 'Phone' })).statusCode).toBe(200);
    expect((await addPasskey(ben.cookie, { name: 'Tablet' })).statusCode).toBe(200);
    await db.pools.auth.query(
      `UPDATE auth.passkey SET backed_up = true, device_type = 'multiDevice'
        WHERE user_id = $1 AND name = 'Phone'`,
      [ann.userId],
    );

    const view = await signInView(ann.cookie);
    expect(view.passkeys.map((p) => p.name)).toEqual(['Laptop', 'Phone']);
    expect(view.passkeys[0]).toEqual({
      id: expect.any(String),
      name: 'Laptop',
      createdAt: expect.any(String),
      backedUp: false,
      deviceType: 'singleDevice',
    });
    expect(view.passkeys[1]).toMatchObject({ backedUp: true, deviceType: 'multiDevice' });
    expect((await signInView(ben.cookie)).passkeys.map((p) => p.name)).toEqual(['Tablet']);
  });

  it('says whether there is a password, which outside sign-ins are linked, and whether an email link signs in', async () => {
    const pat = await newUser('pat');
    expect(await signInView(pat.cookie)).toEqual({
      password: true,
      passkeys: [],
      twoFactor: { enabled: false, backupCodesLeft: null },
      linked: [],
      emailLink: false,
    });

    const sam = await newUser('sam', { password: false });
    await linkGoogle(sam.userId);
    // Google isn't configured on this server: its row signs nobody in.
    expect((await signInView(sam.cookie)).linked).toEqual([]);
    await withGoogle();
    expect(await signInView(sam.cookie)).toMatchObject({
      password: false,
      linked: [{ providerId: 'google' }],
      emailLink: false,
    });

    // With mail delivered and the address verified, a link mailed to it signs in.
    await withGoogle({ mailConfigured: true });
    await userEmail(db, sam.userId, true);
    expect(await signInView(sam.cookie)).toMatchObject({ emailLink: true });
    await userEmail(db, sam.userId, false);
    expect(await signInView(sam.cookie)).toMatchObject({ emailLink: false });
  });

  it('counts backup codes left, 10 then 9 after one signs in, and never shows a code', async () => {
    const user = await newUser('codes');
    const { backupCodes, cookie } = await turnOn(user);
    const before = await kept('/me/sign-in', { cookie });
    expect(before.json().twoFactor).toEqual({ enabled: true, backupCodesLeft: 10 });
    for (const code of backupCodes) expect(before.body).not.toContain(code);

    expect(await signInWith(user.email, { backupCode: backupCodes[0] ?? '' })).toBe(200);
    expect((await signInView(cookie)).twoFactor).toEqual({ enabled: true, backupCodesLeft: 9 });
  });

  it('needs a session that proved its second factor', async () => {
    expect((await kept('/me/sign-in')).statusCode).toBe(401);
    const user = await newUser('pending');
    await turnOn(user);
    const pending = await otherDevice(user);
    expect((await kept('/me/sign-in', { cookie: pending })).statusCode).toBe(403);
  });
});

describe('adding a passkey', () => {
  it('a password account confirms with its password first, once per passkey, on this session only', async () => {
    const user = await newUser('confirm');
    // A fresh session alone is not enough on an account with a password.
    const bare = await ceremony(user.cookie, { name: 'Laptop' });
    expect(bare.statusCode).toBe(403);
    expect(bare.json()).toMatchObject({ code: 'PASSKEY_CONFIRM_REQUIRED' });
    const wrong = await confirmPasskeyAdd(user.cookie, 'not the password');
    expect(wrong.statusCode).toBe(403);
    expect(wrong.json()).toMatchObject({ code: 'reauth_required', reauth: 'password' });
    expect((await ceremony(user.cookie, { name: 'Laptop' })).statusCode).toBe(403);

    expect((await confirmPasskeyAdd(user.cookie)).statusCode).toBe(204);
    expect((await ceremony(user.cookie, { name: 'Laptop' })).statusCode).toBe(200);
    // Used up by that passkey.
    expect((await ceremony(user.cookie, { name: 'Phone' })).statusCode).toBe(403);

    // Another session of the same account can't use this session's confirmation.
    expect((await confirmPasskeyAdd(user.cookie)).statusCode).toBe(204);
    const first = await auth('/sign-in/email', {
      body: { email: user.email, password: PASSWORD },
    });
    const elsewhere = jar(first);
    expect((await ceremony(elsewhere, { name: 'Tablet' })).statusCode).toBe(403);
    expect(await passkeyRows(user.userId)).toHaveLength(1);
  });

  it('a passwordless account needs no password, only its recent sign-in', async () => {
    const user = await newUser('no-password', { password: false });
    expect((await ceremony(user.cookie, { name: 'Laptop' })).statusCode).toBe(200);
  });

  it('is audited, and the browser gets back no public key or credential id', async () => {
    const user = await newUser('audited');
    const added = await addPasskey(user.cookie, { name: 'Laptop' });
    expect(added.statusCode).toBe(200);
    const body = added.json() as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(
      ['backedUp', 'createdAt', 'deviceType', 'id', 'name'].sort(),
    );
    const [key] = await passkeyRows(user.userId);
    expect(body.id).toBe(key?.id);
    expect(await accountAudit(user.userId)).toContainEqual({
      action: 'passkey.add',
      entity_type: 'passkey',
      entity_id: key?.id,
    });
  });

  it('needs a sign-in in the last ten minutes, whatever the account', async () => {
    const user = await newUser('fresh');
    await stale(user);
    const refused = await addPasskey(user.cookie, { name: 'Laptop' });
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({ code: 'SESSION_NOT_FRESH' });
    expect(await passkeyRows(user.userId)).toEqual([]);
  });

  it('stores the name given and lists it', async () => {
    const user = await newUser('named');
    const added = await addPasskey(user.cookie, { name: '  Laptop  ' });
    expect(added.statusCode).toBe(200);
    expect(await passkeyRows(user.userId)).toEqual([{ id: expect.any(String), name: 'Laptop' }]);
    expect((await signInView(user.cookie)).passkeys.map((p) => p.name)).toEqual(['Laptop']);
  });

  it('refuses a passkey that did not verify its user', async () => {
    const user = await newUser('no-uv');
    const refused = await addPasskey(user.cookie, { name: 'Key' }, { userVerified: false });
    expect(refused.statusCode).toBe(400);
    expect(refused.json()).toMatchObject({ code: 'USER_VERIFICATION_REQUIRED' });
    expect(await passkeyRows(user.userId)).toEqual([]);
  });

  it('refuses a name over 64 characters, and a request for a second session', async () => {
    const user = await newUser('limits');
    const long = await addPasskey(user.cookie, { name: 'x'.repeat(65) });
    expect(long.statusCode).toBe(400);
    expect(long.json()).toMatchObject({ code: 'PASSKEY_NAME_TOO_LONG' });
    const minted = await addPasskey(user.cookie, { name: 'Laptop', createSession: true });
    expect(minted.statusCode).toBe(400);
    expect(minted.json()).toMatchObject({ code: 'CREATE_SESSION_UNSUPPORTED' });
    expect(await passkeyRows(user.userId)).toEqual([]);
  });

  it('signs out every other session and mails the owner', async () => {
    const user = await newUser('added');
    const other = await otherDevice(user);
    expect((await addPasskey(user.cookie, { name: 'Laptop' })).statusCode).toBe(200);
    expect(await alive(other)).toBe(false);
    expect(await alive(user.cookie)).toBe(true);
    await vi.waitFor(() =>
      expect(noticesFor(user.email)).toEqual([{ email: user.email, event: 'passkey-added' }]),
    );
  });

  it('with mail on, waits for a verified address, except on a managed account', async () => {
    await app({ mailConfigured: true });
    const user = await newUser('unverified');
    const refused = await addPasskey(user.cookie, { name: 'Laptop' });
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({ code: 'EMAIL_UNVERIFIED' });

    const managed = await newUser('managed');
    await db.pools.auth.query(`UPDATE auth."user" SET email = $1 WHERE id = $2`, [
      `${randomUUID()}@managed.invalid`,
      managed.userId,
    ]);
    expect((await addPasskey(managed.cookie, { name: 'Laptop' })).statusCode).toBe(200);
  });
});

describe('renaming and removing a passkey', () => {
  // catalogue: PATCH /api/v1/me/passkeys/:id
  it('renames after the password, changes nothing else and signs nobody out', async () => {
    const user = await newUser('rename');
    await addPasskey(user.cookie, { name: 'Laptop' });
    const [key] = await passkeyRows(user.userId);
    const other = await otherDevice(user);
    const url = `/me/passkeys/${key?.id}`;

    const missing = await kept(url, {
      method: 'PATCH',
      cookie: user.cookie,
      body: { name: 'Mac' },
    });
    expect(missing.statusCode).toBe(403);
    expect(missing.json()).toMatchObject({ code: 'reauth_required', reauth: 'password' });
    const wrong = await kept(url, {
      method: 'PATCH',
      cookie: user.cookie,
      body: { name: 'Mac', password: 'not the password' },
    });
    expect(wrong.statusCode).toBe(403);

    const renamed = await kept(url, {
      method: 'PATCH',
      cookie: user.cookie,
      body: { name: '  Work laptop ', password: PASSWORD },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json()).toMatchObject({ id: key?.id, name: 'Work laptop' });
    expect(await passkeyRows(user.userId)).toEqual([{ id: key?.id, name: 'Work laptop' }]);
    expect(await alive(other)).toBe(true);
    expect(await accountAudit(user.userId)).toContainEqual({
      action: 'passkey.rename',
      entity_type: 'passkey',
      entity_id: key?.id,
    });
    // A name is 1 to 64 characters.
    for (const name of ['   ', 'x'.repeat(65)]) {
      const bad = await kept(url, {
        method: 'PATCH',
        cookie: user.cookie,
        body: { name, password: PASSWORD },
      });
      expect(bad.statusCode).toBe(400);
    }
  });

  // catalogue: DELETE /api/v1/me/passkeys/:id
  it('removes after the password, signs out every other session and mails the owner', async () => {
    const user = await newUser('remove');
    await addPasskey(user.cookie, { name: 'Laptop' });
    await addPasskey(user.cookie, { name: 'Phone' });
    const [laptop, phone] = await passkeyRows(user.userId);
    const other = await otherDevice(user);
    t.auth.notices.length = 0;

    const missing = await kept(`/me/passkeys/${laptop?.id}`, {
      method: 'DELETE',
      cookie: user.cookie,
      body: {},
    });
    expect(missing.statusCode).toBe(403);
    expect(missing.json()).toMatchObject({ code: 'reauth_required', reauth: 'password' });
    expect(await alive(other)).toBe(true);

    const removed = await kept(`/me/passkeys/${laptop?.id}`, {
      method: 'DELETE',
      cookie: user.cookie,
      body: { password: PASSWORD },
    });
    expect(removed.statusCode).toBe(204);
    expect(await passkeyRows(user.userId)).toEqual([{ id: phone?.id, name: 'Phone' }]);
    expect(await alive(other)).toBe(false);
    expect(await alive(user.cookie)).toBe(true);
    await vi.waitFor(() =>
      expect(noticesFor(user.email)).toEqual([{ email: user.email, event: 'passkey-removed' }]),
    );
    expect(await accountAudit(user.userId)).toContainEqual({
      action: 'passkey.remove',
      entity_type: 'passkey',
      entity_id: laptop?.id,
    });
  });

  it("answers 404 for someone else's passkey, as for one that doesn't exist, and leaves it alone", async () => {
    const ann = await newUser('ann');
    const ben = await newUser('ben');
    await addPasskey(ben.cookie, { name: 'Tablet' });
    const [bens] = await passkeyRows(ben.userId);
    for (const id of [bens?.id, randomUUID()]) {
      const renamed = await kept(`/me/passkeys/${id}`, {
        method: 'PATCH',
        cookie: ann.cookie,
        body: { name: 'Mine now', password: PASSWORD },
      });
      expect(renamed.statusCode).toBe(404);
      const removed = await kept(`/me/passkeys/${id}`, {
        method: 'DELETE',
        cookie: ann.cookie,
        body: { password: PASSWORD },
      });
      expect(removed.statusCode).toBe(404);
      expect(removed.json()).toEqual(renamed.json());
    }
    expect(await passkeyRows(ben.userId)).toEqual([{ id: bens?.id, name: 'Tablet' }]);
  });

  it('a passwordless account confirms with a sign-in in the last ten minutes', async () => {
    const user = await newUser('passwordless', { password: false });
    await addPasskey(user.cookie, { name: 'Laptop' });
    await addPasskey(user.cookie, { name: 'Phone' });
    const [laptop] = await passkeyRows(user.userId);
    await stale(user);
    for (const [method, body] of [
      ['PATCH', { name: 'Mac' }],
      ['DELETE', {}],
    ] as const) {
      const refused = await kept(`/me/passkeys/${laptop?.id}`, {
        method,
        cookie: user.cookie,
        body,
      });
      expect(refused.statusCode).toBe(403);
      expect(refused.json()).toMatchObject({ code: 'reauth_required', reauth: 'sign_in' });
    }
    await db.pools.auth.query('UPDATE auth.session SET created_at = now() WHERE user_id = $1', [
      user.userId,
    ]);
    const removed = await kept(`/me/passkeys/${laptop?.id}`, {
      method: 'DELETE',
      cookie: user.cookie,
      body: {},
    });
    expect(removed.statusCode).toBe(204);
  });
});

describe('the last way in', () => {
  async function remove(user: User, id: string | undefined) {
    return kept(`/me/passkeys/${id}`, {
      method: 'DELETE',
      cookie: user.cookie,
      body: { password: PASSWORD },
    });
  }

  it('a password and one passkey: the passkey can go', async () => {
    const user = await newUser('pw');
    await addPasskey(user.cookie, { name: 'Laptop' });
    const [key] = await passkeyRows(user.userId);
    expect((await remove(user, key?.id)).statusCode).toBe(204);
  });

  it('no password and one passkey: refused with last_sign_in_method', async () => {
    const user = await newUser('one', { password: false });
    await addPasskey(user.cookie, { name: 'Laptop' });
    const [key] = await passkeyRows(user.userId);
    const refused = await remove(user, key?.id);
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ code: 'last_sign_in_method' });
    expect(await passkeyRows(user.userId)).toHaveLength(1);
    expect(noticesFor(user.email).map((n) => n.event)).not.toContain('passkey-removed');
  });

  it('no password and two passkeys: the first can go, the last cannot', async () => {
    const user = await newUser('two', { password: false });
    await addPasskey(user.cookie, { name: 'Laptop' });
    await addPasskey(user.cookie, { name: 'Phone' });
    const [laptop, phone] = await passkeyRows(user.userId);
    expect((await remove(user, laptop?.id)).statusCode).toBe(204);
    const refused = await remove(user, phone?.id);
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ code: 'last_sign_in_method' });
  });

  it('no password, one passkey and Google linked: the passkey can go', async () => {
    await withGoogle();
    const user = await newUser('google', { password: false });
    await addPasskey(user.cookie, { name: 'Laptop' });
    await linkGoogle(user.userId);
    const [key] = await passkeyRows(user.userId);
    expect((await remove(user, key?.id)).statusCode).toBe(204);
  });

  it('a linked sign-in whose provider this server no longer offers is not a way in', async () => {
    const user = await newUser('stale-google', { password: false });
    await addPasskey(user.cookie, { name: 'Laptop' });
    await linkGoogle(user.userId);
    const [key] = await passkeyRows(user.userId);
    const refused = await remove(user, key?.id);
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ code: 'last_sign_in_method' });
  });

  it('unlinking the last way in is refused too, not only removing a passkey', async () => {
    await withGoogle();
    // A credential row without a password (left by a mailbox claim) plus Google: Better Auth
    // sees two accounts and would unlink Google, leaving nothing that signs in.
    const user = await newUser('unlink', { password: false });
    await db.pools.auth.query(
      `INSERT INTO auth.account (account_id, provider_id, user_id, password, created_at, updated_at)
       VALUES ($1::text, 'credential', $1::uuid, NULL, now(), now())`,
      [user.userId],
    );
    const google = await linkGoogle(user.userId);
    const refused = await unlink(user.cookie, google);
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ code: 'last_sign_in_method' });
    // With a passkey it is no longer the last way in.
    await addPasskey(user.cookie, { name: 'Laptop' });
    const other = await otherDevice(user);
    t.auth.notices.length = 0;
    const unlinked = await unlink(user.cookie, google);
    expect(unlinked.statusCode).toBe(204);
    // As removing a passkey: the other sessions are signed out, the owner is told, it's audited.
    expect(await alive(other)).toBe(false);
    expect(await alive(user.cookie)).toBe(true);
    await vi.waitFor(() =>
      expect(noticesFor(user.email)).toEqual([{ email: user.email, event: 'sign-in-unlinked' }]),
    );
  });

  // catalogue: DELETE /api/v1/me/linked/:id
  it('unlinks after confirm-it-s-you, and an account with a password gives it', async () => {
    await withGoogle();
    const user = await newUser('unlink-pw');
    const google = await linkGoogle(user.userId);
    const missing = await unlink(user.cookie, google);
    expect(missing.statusCode).toBe(403);
    expect(missing.json()).toMatchObject({ code: 'reauth_required', reauth: 'password' });
    const done = await unlink(user.cookie, google, PASSWORD);
    expect(done.statusCode).toBe(204);
    expect(await accountAudit(user.userId)).toContainEqual({
      action: 'sign_in.unlink',
      entity_type: 'account',
      entity_id: google,
    });
    const passwordless = await newUser('unlink-stale', { password: false });
    await addPasskey(passwordless.cookie, { name: 'Laptop' });
    const theirs = await linkGoogle(passwordless.userId);
    await stale(passwordless);
    const refused = await unlink(passwordless.cookie, theirs);
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({ code: 'reauth_required', reauth: 'sign_in' });
  });

  it("another person's linked sign-in, or an unknown or password row, answers 404 before any lock", async () => {
    await withGoogle();
    const ann = await newUser('ann');
    const ben = await newUser('ben');
    const bens = await linkGoogle(ben.userId);
    const { rows } = await db.pools.auth.query<{ id: string }>(
      `SELECT id FROM auth.account WHERE user_id = $1 AND provider_id = 'credential'`,
      [ann.userId],
    );
    // Ann's own row lock is held: a 404 must not wait for it.
    const holder = await db.pools.auth.connect();
    try {
      await holder.query('BEGIN');
      await lockAccount(holder, ann.userId);
      for (const id of [bens, randomUUID(), rows[0]?.id ?? '']) {
        const started = Date.now();
        const res = await unlink(ann.cookie, id, PASSWORD);
        expect(res.statusCode).toBe(404);
        expect(Date.now() - started).toBeLessThan(1000);
      }
    } finally {
      await holder.query('ROLLBACK');
      holder.release();
    }
    const left = await db.pools.auth.query(
      'SELECT count(*)::int AS n FROM auth.account WHERE id = $1',
      [bens],
    );
    expect(left.rows[0].n).toBe(1);
  });

  it('a lock held too long answers 409 conflict, never 500, for removing and for unlinking', async () => {
    await withGoogle();
    const user = await newUser('locked');
    await addPasskey(user.cookie, { name: 'Laptop' });
    const [key] = await passkeyRows(user.userId);
    const google = await linkGoogle(user.userId);
    const holder = await db.pools.auth.connect();
    try {
      await holder.query('BEGIN');
      await lockAccount(holder, user.userId);
      const [removed, unlinked] = await Promise.all([
        remove(user, key?.id),
        unlink(user.cookie, google, PASSWORD),
      ]);
      for (const res of [removed, unlinked]) {
        expect(res.statusCode).toBe(409);
        expect(res.json()).toMatchObject({ code: 'conflict' });
      }
    } finally {
      await holder.query('ROLLBACK');
      holder.release();
    }
    expect(await passkeyRows(user.userId)).toHaveLength(1);
  });

  it("a burst of removals and unlinks from one session never stalls another person's sign-in", async () => {
    await withGoogle();
    const bystander = await newUser('bystander');
    // A stale passwordless session, as the probe had: refused before it takes any connection.
    const stale1 = await newUser('burst-stale', { password: false });
    await addPasskey(stale1.cookie, { name: 'Laptop' });
    const [staleKey] = await passkeyRows(stale1.userId);
    await stale(stale1);
    // A password account confirming each time: the requests really queue on the row lock.
    const busy = await newUser('burst-busy');
    await addPasskey(busy.cookie, { name: 'Laptop' });
    const [busyKey] = await passkeyRows(busy.userId);
    const google = await linkGoogle(busy.userId);
    const started = Date.now();
    const burst = Promise.all([
      ...Array.from({ length: 12 }, () => unlink(stale1.cookie, randomUUID())),
      ...Array.from({ length: 6 }, () => remove(stale1, staleKey?.id)),
      ...Array.from({ length: 6 }, () => remove(busy, busyKey?.id)),
      ...Array.from({ length: 6 }, () => unlink(busy.cookie, google, PASSWORD)),
    ]);
    await new Promise((r) => setTimeout(r, 50));
    const lookup = Date.now();
    expect(await alive(bystander.cookie)).toBe(true);
    expect(Date.now() - lookup).toBeLessThan(2000);
    const statuses = (await burst).map((r) => r.statusCode);
    expect(statuses.filter((code) => code >= 500)).toEqual([]);
    expect(Date.now() - started).toBeLessThan(15_000);
    const idle = await db.pools.auth.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_stat_activity
        WHERE datname = current_database() AND state LIKE 'idle in transaction%'`,
    );
    expect(idle.rows[0]?.n).toBe(0);
  }, 30_000);

  it("Better Auth's /unlink-account answers 404 in every spelling, and unlinks nothing", async () => {
    await withGoogle();
    const user = await newUser('door-unlink');
    const google = await linkGoogle(user.userId);
    for (const path of [
      '/unlink-account',
      '/unlink-account/',
      '/unlink-account?x=1',
      '//unlink-account',
      '/./unlink-account',
      '/Unlink-Account',
      '/%75nlink-account',
    ]) {
      const res = await auth(path, { cookie: user.cookie, body: { accountId: google } });
      expect(res.statusCode, path).toBe(404);
    }
    const left = await db.pools.auth.query(
      'SELECT count(*)::int AS n FROM auth.account WHERE id = $1',
      [google],
    );
    expect(left.rows[0].n).toBe(1);
  });

  it('removing the passkey and unlinking Google at the same moment never leaves no way in', async () => {
    await withGoogle();
    for (let round = 0; round < 8; round++) {
      const user = await newUser(`race-${round}`, { password: false });
      await db.pools.auth.query(
        `INSERT INTO auth.account (account_id, provider_id, user_id, password, created_at, updated_at)
         VALUES ($1::text, 'credential', $1::uuid, NULL, now(), now())`,
        [user.userId],
      );
      const google = await linkGoogle(user.userId);
      await addPasskey(user.cookie, { name: 'Laptop' });
      const [key] = await passkeyRows(user.userId);
      const unlinkIt = () => unlink(user.cookie, google);
      // Each request first in turn: the passkey removal's lock, or the unlink's.
      const [removed, unlinked] =
        round % 2 === 0
          ? await Promise.all([remove(user, key?.id), unlinkIt()])
          : await Promise.all([unlinkIt(), remove(user, key?.id)]).then(
              ([u, r]) => [r, u] as const,
            );
      // One of them goes through, the other is refused: something always signs in.
      expect([removed.statusCode, unlinked.statusCode].filter((c) => c === 204)).toHaveLength(1);
      expect([removed.statusCode, unlinked.statusCode].filter((c) => c >= 500)).toEqual([]);
      const { rows } = await db.pools.auth.query<{ ways: number }>(
        `SELECT (SELECT count(*) FROM auth.passkey WHERE user_id = $1)::int
              + (SELECT count(*) FROM auth.account
                  WHERE user_id = $1 AND provider_id = 'google')::int AS ways`,
        [user.userId],
      );
      expect(rows[0]?.ways).toBe(1);
    }
  });

  it('removing a passkey counts the ways in under the lock, after an unlink that got there first', async () => {
    await withGoogle();
    const user = await newUser('queued', { password: false });
    await db.pools.auth.query(
      `INSERT INTO auth.account (account_id, provider_id, user_id, password, created_at, updated_at)
       VALUES ($1::text, 'credential', $1::uuid, NULL, now(), now())`,
      [user.userId],
    );
    const google = await linkGoogle(user.userId);
    await addPasskey(user.cookie, { name: 'Laptop' });
    const [key] = await passkeyRows(user.userId);
    // An unlink holds the account's lock; the removal queues behind it.
    const holder = await db.pools.auth.connect();
    try {
      await holder.query('BEGIN');
      await lockAccount(holder, user.userId);
      const pending = remove(user, key?.id);
      await vi.waitFor(
        async () => {
          const { rows } = await db.pools.auth.query<{ n: number }>(
            `SELECT count(*)::int AS n FROM pg_stat_activity
              WHERE datname = current_database() AND wait_event_type = 'Lock'
                AND query LIKE '%FOR NO KEY UPDATE%'`,
          );
          expect(rows[0]?.n).toBeGreaterThan(0);
        },
        { timeout: 10_000 },
      );
      // The unlink finishes: Google is gone.
      await holder.query('DELETE FROM auth.account WHERE id = $1', [google]);
      await holder.query('COMMIT');
      const refused = await pending;
      expect(refused.statusCode).toBe(409);
      expect(refused.json()).toMatchObject({ code: 'last_sign_in_method' });
      expect(await passkeyRows(user.userId)).toHaveLength(1);
    } finally {
      holder.release();
    }
  });

  it('unlinking waits for the lock too, and refuses once the passkey it counted on is gone', async () => {
    await withGoogle();
    const user = await newUser('queued-unlink', { password: false });
    await db.pools.auth.query(
      `INSERT INTO auth.account (account_id, provider_id, user_id, password, created_at, updated_at)
       VALUES ($1::text, 'credential', $1::uuid, NULL, now(), now())`,
      [user.userId],
    );
    const google = await linkGoogle(user.userId);
    await addPasskey(user.cookie, { name: 'Laptop' });
    const holder = await db.pools.auth.connect();
    try {
      await holder.query('BEGIN');
      await lockAccount(holder, user.userId);
      const pending = unlink(user.cookie, google);
      await vi.waitFor(
        async () => {
          const { rows } = await db.pools.auth.query<{ n: number }>(
            `SELECT count(*)::int AS n FROM pg_stat_activity
              WHERE datname = current_database() AND wait_event_type = 'Lock'
                AND query LIKE '%FOR NO KEY UPDATE%'`,
          );
          expect(rows[0]?.n).toBeGreaterThan(0);
        },
        { timeout: 10_000 },
      );
      // The passkey removal finishes first: the passkey is gone.
      await holder.query('DELETE FROM auth.passkey WHERE user_id = $1', [user.userId]);
      await holder.query('COMMIT');
      const refused = await pending;
      expect(refused.statusCode).toBe(409);
      expect(refused.json()).toMatchObject({ code: 'last_sign_in_method' });
    } finally {
      holder.release();
    }
    const { rows } = await db.pools.auth.query(
      `SELECT count(*)::int AS n FROM auth.account WHERE id = $1`,
      [google],
    );
    expect(rows[0].n).toBe(1);
  });

  it('the last passkey stays while a location asks for two-factor and the app is off', async () => {
    const user = await newUser('needs-2fa');
    await addPasskey(user.cookie, { name: 'Laptop' });
    await joinTwoFactorLocation(user);
    const [key] = await passkeyRows(user.userId);
    const refused = await remove(user, key?.id);
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ code: 'two_factor_required' });
    expect(await passkeyRows(user.userId)).toHaveLength(1);
    // With the authenticator app on, the passkey isn't needed for it.
    const on = await turnOn(user);
    const removed = await kept(`/me/passkeys/${key?.id}`, {
      method: 'DELETE',
      cookie: on.cookie,
      body: { password: PASSWORD },
    });
    expect(removed.statusCode).toBe(204);
  });

  it('an email link counts only with mail on and the address verified', async () => {
    const user = await newUser('link', { password: false });
    await addPasskey(user.cookie, { name: 'Laptop' });
    const [key] = await passkeyRows(user.userId);
    // Mail off (the default here), address verified: no link can arrive.
    await userEmail(db, user.userId, true);
    expect((await remove(user, key?.id)).statusCode).toBe(409);
    // Mail on, address not verified.
    await app({ mailConfigured: true });
    await userEmail(db, user.userId, false);
    expect((await remove(user, key?.id)).statusCode).toBe(409);
    // Mail on, address verified.
    await userEmail(db, user.userId, true);
    expect((await remove(user, key?.id)).statusCode).toBe(204);
  });

  it('a managed account keeps its last passkey unless it has a password', async () => {
    await app({ mailConfigured: true });
    const user = await newUser('managed', { password: false });
    await db.pools.auth.query(
      `UPDATE auth."user" SET email = $1, email_verified = true WHERE id = $2`,
      [`${randomUUID()}@managed.invalid`, user.userId],
    );
    await addPasskey(user.cookie, { name: 'Laptop' });
    const [key] = await passkeyRows(user.userId);
    expect((await remove(user, key?.id)).statusCode).toBe(409);

    const withPassword = await newUser('managed-pw');
    await db.pools.auth.query(`UPDATE auth."user" SET email = $1 WHERE id = $2`, [
      `${randomUUID()}@managed.invalid`,
      withPassword.userId,
    ]);
    await addPasskey(withPassword.cookie, { name: 'Laptop' });
    const [own] = await passkeyRows(withPassword.userId);
    expect((await remove(withPassword, own?.id)).statusCode).toBe(204);
  });
});

describe('turning the authenticator app on', () => {
  // catalogue: POST /api/v1/me/two-factor/enable
  it('needs the password on a password account, then mails the owner and signs out other sessions once on', async () => {
    const user = await newUser('on');
    const missing = await kept('/me/two-factor/enable', { cookie: user.cookie, body: {} });
    expect(missing.statusCode).toBe(403);
    expect(missing.json()).toMatchObject({ code: 'reauth_required', reauth: 'password' });
    const wrong = await kept('/me/two-factor/enable', {
      cookie: user.cookie,
      body: { password: 'not it' },
    });
    expect(wrong.statusCode).toBe(403);
    expect(wrong.json()).toMatchObject({ code: 'reauth_required' });

    const other = await otherDevice(user);
    const { secret, backupCodes, cookie } = await turnOn(user);
    expect(secret).not.toBe('');
    expect(backupCodes).toHaveLength(10);
    expect(await alive(other)).toBe(false);
    expect(await alive(cookie)).toBe(true);
    expect((await signInView(cookie)).twoFactor.enabled).toBe(true);
    await vi.waitFor(() =>
      expect(noticesFor(user.email)).toContainEqual({
        email: user.email,
        event: 'two-factor-enabled',
      }),
    );
    // Starting is one event; the first proven code, which turns it on, is another.
    expect((await accountAudit(user.userId)).map((e) => e.action)).toEqual(
      expect.arrayContaining(['two_factor.setup', 'two_factor.enable']),
    );
    expect(await signInWith(user.email, { code: await nextTotp(secret, user.userId) })).toBe(200);
  });

  it('a passwordless account turns it on after a fresh sign-in; a stale one is refused', async () => {
    const user = await newUser('passwordless', { password: false });
    await stale(user);
    const refused = await kept('/me/two-factor/enable', { cookie: user.cookie, body: {} });
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({ code: 'reauth_required', reauth: 'sign_in' });
    expect((await signInView(user.cookie)).twoFactor.enabled).toBe(false);

    await db.pools.auth.query('UPDATE auth.session SET created_at = now() WHERE user_id = $1', [
      user.userId,
    ]);
    const { cookie } = await turnOn(user, {});
    expect((await signInView(cookie)).twoFactor).toEqual({ enabled: true, backupCodesLeft: 10 });
  });

  it('with mail on, waits for a verified address (EMAIL_UNVERIFIED), except on a managed account', async () => {
    await app({ mailConfigured: true });
    const user = await newUser('gate');
    const refused = await kept('/me/two-factor/enable', {
      cookie: user.cookie,
      body: { password: PASSWORD },
    });
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({ code: 'EMAIL_UNVERIFIED' });

    const managed = await newUser('managed');
    await db.pools.auth.query(`UPDATE auth."user" SET email = $1 WHERE id = $2`, [
      `${randomUUID()}@managed.invalid`,
      managed.userId,
    ]);
    const allowed = await kept('/me/two-factor/enable', {
      cookie: managed.cookie,
      body: { password: PASSWORD },
    });
    expect(allowed.statusCode).toBe(200);
  });

  it('only a proven code logs it as on: starting alone logs the start', async () => {
    const user = await newUser('started');
    const started = await kept('/me/two-factor/enable', {
      cookie: user.cookie,
      body: { password: PASSWORD },
    });
    expect(started.statusCode).toBe(200);
    const actions = (await accountAudit(user.userId)).map((e) => e.action);
    expect(actions).toContain('two_factor.setup');
    expect(actions).not.toContain('two_factor.enable');
  });

  it('is refused while it is already on', async () => {
    const user = await newUser('twice');
    const { cookie, secret } = await turnOn(user);
    const again = await kept('/me/two-factor/enable', { cookie, body: { password: PASSWORD } });
    expect(again.statusCode).toBe(400);
    expect(again.json()).toMatchObject({ code: 'TOTP_ALREADY_ENABLED' });
    // Better Auth refuses rather than replacing the secret: the app still signs in.
    expect(await signInWith(user.email, { code: await nextTotp(secret, user.userId) })).toBe(200);
  });
});

describe('setting the authenticator app up again', () => {
  // catalogue: POST /api/v1/me/two-factor/set-up-again/verify
  it('keeps the old app working until the new one proves a code, then only the new one works', async () => {
    const user = await newUser('again');
    const on = await turnOn(user);
    const cookie = on.cookie;

    // Started and abandoned: the old app still signs in, mid-way and after.
    const missing = await kept('/me/two-factor/set-up-again', { cookie, body: {} });
    expect(missing.statusCode).toBe(403);
    expect(missing.json()).toMatchObject({ code: 'reauth_required', reauth: 'password' });
    const first = await kept('/me/two-factor/set-up-again', {
      cookie,
      body: { password: PASSWORD },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ totpURI: expect.stringMatching(/^otpauth:\/\/totp\//) });
    const abandoned = new URL(first.json().totpURI).searchParams.get('secret') ?? '';
    expect(abandoned).not.toBe(on.secret);
    expect(await signInWith(user.email, { code: await nextTotp(on.secret, user.userId) })).toBe(
      200,
    );
    expect(await signInWith(user.email, { code: totp(abandoned) })).toBe(401);
    expect(await signInWith(user.email, { backupCode: on.backupCodes[0] ?? '' })).toBe(200);

    // Started again and finished: the new app signs in, the old one and its codes don't.
    const other = await otherDevice(user);
    const second = await kept('/me/two-factor/set-up-again', {
      cookie,
      body: { password: PASSWORD },
    });
    const fresh = new URL(second.json().totpURI).searchParams.get('secret') ?? '';
    const wrong = await kept('/me/two-factor/set-up-again/verify', {
      cookie,
      body: { code: wrongCode(fresh) },
    });
    expect(wrong.statusCode).toBe(400);
    expect(wrong.json()).toMatchObject({ code: 'validation' });
    expect(await signInWith(user.email, { code: await nextTotp(on.secret, user.userId) })).toBe(
      200,
    );
    // The abandoned secret was replaced by the second start.
    const stale = await kept('/me/two-factor/set-up-again/verify', {
      cookie,
      body: { code: totp(abandoned) },
    });
    expect(stale.statusCode).toBe(400);

    const done = await kept('/me/two-factor/set-up-again/verify', {
      cookie,
      body: { code: await nextTotp(fresh, user.userId) },
    });
    expect(done.statusCode).toBe(200);
    const { backupCodes } = done.json() as { backupCodes: string[] };
    expect(backupCodes).toHaveLength(10);
    expect(backupCodes.some((c) => on.backupCodes.includes(c))).toBe(false);
    expect(await alive(other)).toBe(false);
    expect(await alive(cookie)).toBe(true);
    expect(await signInWith(user.email, { code: await nextTotp(fresh, user.userId) })).toBe(200);
    expect(await signInWith(user.email, { code: totp(on.secret) })).toBe(401);
    expect(await signInWith(user.email, { backupCode: on.backupCodes[1] ?? '' })).toBe(401);
    expect(await signInWith(user.email, { backupCode: backupCodes[0] ?? '' })).toBe(200);
    expect((await signInView(cookie)).twoFactor).toEqual({ enabled: true, backupCodesLeft: 9 });
    await vi.waitFor(() =>
      expect(noticesFor(user.email)).toContainEqual({
        email: user.email,
        event: 'two-factor-replaced',
      }),
    );
    expect(await accountAudit(user.userId)).toContainEqual({
      action: 'two_factor.replace',
      entity_type: 'user',
      entity_id: user.userId,
    });
    // Used up: the staged secret is gone.
    const replay = await kept('/me/two-factor/set-up-again/verify', {
      cookie,
      body: { code: totp(fresh) },
    });
    expect(replay.statusCode).toBe(400);
  }, 150000);

  it('belongs to the session that started it', async () => {
    const user = await newUser('session');
    const on = await turnOn(user);
    const started = await kept('/me/two-factor/set-up-again', {
      cookie: on.cookie,
      body: { password: PASSWORD },
    });
    const fresh = new URL(started.json().totpURI).searchParams.get('secret') ?? '';
    const first = await auth('/sign-in/email', { body: { email: user.email, password: PASSWORD } });
    const verified = await auth('/two-factor/verify-totp', {
      cookie: jar(first),
      body: { code: await nextTotp(on.secret, user.userId) },
    });
    const elsewhere = jar(verified, jar(first));
    const refused = await kept('/me/two-factor/set-up-again/verify', {
      cookie: elsewhere,
      body: { code: totp(fresh) },
    });
    expect(refused.statusCode).toBe(400);
    expect(await signInWith(user.email, { code: await nextTotp(on.secret, user.userId) })).toBe(
      200,
    );
  }, 90000);

  it('wrong codes are delayed after the free attempts', async () => {
    const user = await newUser('delays');
    const on = await turnOn(user);
    const started = await kept('/me/two-factor/set-up-again', {
      cookie: on.cookie,
      body: { password: PASSWORD },
    });
    const fresh = new URL(started.json().totpURI).searchParams.get('secret') ?? '';
    for (let i = 0; i < FREE_FAILURES + 1; i++) {
      const res = await kept('/me/two-factor/set-up-again/verify', {
        cookie: on.cookie,
        body: { code: wrongCode(fresh) },
      });
      expect(res.statusCode).toBe(400);
    }
    const delayed = await kept('/me/two-factor/set-up-again/verify', {
      cookie: on.cookie,
      body: { code: totp(fresh) },
    });
    expect(delayed.statusCode).toBe(429);
    expect(delayed.json()).toMatchObject({ code: 'rate_limited' });
  });

  it('starting it is limited per person', async () => {
    const user = await newUser('starts');
    const on = await turnOn(user);
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await kept('/me/two-factor/set-up-again', {
        cookie: on.cookie,
        body: { password: PASSWORD },
      });
      statuses.push(res.statusCode);
    }
    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(200));
    expect(statuses[10]).toBe(429);
  });

  it('is refused when two-factor is off', async () => {
    const user = await newUser('off');
    const refused = await kept('/me/two-factor/set-up-again', {
      cookie: user.cookie,
      body: { password: PASSWORD },
    });
    expect(refused.statusCode).toBe(409);
  });

  it('a passwordless account starts it after a fresh sign-in only', async () => {
    const user = await newUser('passwordless', { password: false });
    const on = await turnOn(user, {});
    await stale(user);
    const refused = await kept('/me/two-factor/set-up-again', { cookie: on.cookie, body: {} });
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({ code: 'reauth_required', reauth: 'sign_in' });
  });
});

describe('new backup codes', () => {
  // catalogue: POST /api/v1/me/two-factor/backup-codes
  it('the old codes stop working, the new ten do, and other sessions are signed out', async () => {
    const user = await newUser('codes');
    const on = await turnOn(user);
    const other = await otherDevice(user);
    const missing = await kept('/me/two-factor/backup-codes', { cookie: on.cookie, body: {} });
    expect(missing.statusCode).toBe(403);
    expect(missing.json()).toMatchObject({ code: 'reauth_required', reauth: 'password' });

    const made = await kept('/me/two-factor/backup-codes', {
      cookie: on.cookie,
      body: { password: PASSWORD },
    });
    expect(made.statusCode).toBe(200);
    const { backupCodes } = made.json() as { backupCodes: string[] };
    expect(backupCodes).toHaveLength(10);
    expect(await alive(other)).toBe(false);
    expect(await signInWith(user.email, { backupCode: on.backupCodes[0] ?? '' })).toBe(401);
    expect(await signInWith(user.email, { backupCode: backupCodes[0] ?? '' })).toBe(200);
    expect((await signInView(on.cookie)).twoFactor.backupCodesLeft).toBe(9);
    await vi.waitFor(() =>
      expect(noticesFor(user.email)).toContainEqual({
        email: user.email,
        event: 'backup-codes-new',
      }),
    );
    expect(await accountAudit(user.userId)).toContainEqual({
      action: 'two_factor.backup_codes',
      entity_type: 'user',
      entity_id: user.userId,
    });
  });

  it('a passwordless account makes them after a fresh sign-in only', async () => {
    const user = await newUser('passwordless', { password: false });
    const on = await turnOn(user, {});
    await stale(user);
    const refused = await kept('/me/two-factor/backup-codes', { cookie: on.cookie, body: {} });
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({ code: 'reauth_required', reauth: 'sign_in' });
    await db.pools.auth.query('UPDATE auth.session SET created_at = now() WHERE user_id = $1', [
      user.userId,
    ]);
    const made = await kept('/me/two-factor/backup-codes', { cookie: on.cookie, body: {} });
    expect(made.statusCode).toBe(200);
  });
});

describe('turning the authenticator app off', () => {
  // catalogue: POST /api/v1/me/two-factor/disable
  it('needs the password, then mails the owner and signs out other sessions', async () => {
    const user = await newUser('off');
    const on = await turnOn(user);
    const other = await otherDevice(user);
    const missing = await kept('/me/two-factor/disable', { cookie: on.cookie, body: {} });
    expect(missing.statusCode).toBe(403);
    expect(missing.json()).toMatchObject({ code: 'reauth_required', reauth: 'password' });

    const off = await kept('/me/two-factor/disable', {
      cookie: on.cookie,
      body: { password: PASSWORD },
    });
    expect(off.statusCode).toBe(204);
    const cookie = jar(off, on.cookie);
    expect(await alive(cookie)).toBe(true);
    expect(await alive(other)).toBe(false);
    expect((await signInView(cookie)).twoFactor).toEqual({ enabled: false, backupCodesLeft: null });
    const signedIn = await auth('/sign-in/email', {
      body: { email: user.email, password: PASSWORD },
    });
    expect(signedIn.json()).not.toHaveProperty('twoFactorRedirect');
    await vi.waitFor(() =>
      expect(noticesFor(user.email)).toContainEqual({
        email: user.email,
        event: 'two-factor-disabled',
      }),
    );
    expect(await accountAudit(user.userId)).toContainEqual({
      action: 'two_factor.disable',
      entity_type: 'user',
      entity_id: user.userId,
    });
  });

  it('a passwordless account turns it off after a fresh sign-in only', async () => {
    const user = await newUser('passwordless', { password: false });
    const on = await turnOn(user, {});
    await stale(user);
    const refused = await kept('/me/two-factor/disable', { cookie: on.cookie, body: {} });
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({ code: 'reauth_required', reauth: 'sign_in' });
    await db.pools.auth.query('UPDATE auth.session SET created_at = now() WHERE user_id = $1', [
      user.userId,
    ]);
    expect((await kept('/me/two-factor/disable', { cookie: on.cookie, body: {} })).statusCode).toBe(
      204,
    );
  });

  it('is refused with two_factor_required while a location asks for it and no passkey can stand in', async () => {
    const user = await newUser('required');
    const on = await turnOn(user);
    await joinTwoFactorLocation(user);
    const refused = await kept('/me/two-factor/disable', {
      cookie: on.cookie,
      body: { password: PASSWORD },
    });
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ code: 'two_factor_required' });
    expect((await signInView(on.cookie)).twoFactor.enabled).toBe(true);
    expect(noticesFor(user.email).map((n) => n.event)).not.toContain('two-factor-disabled');

    // A passkey (every one Kept adds verifies its user) stands in for it.
    await registerSoftPasskey(db.pools.auth, user.userId, {
      id: new URL(t.publicUrl).hostname,
      origin: new URL(t.publicUrl).origin,
    });
    const off = await kept('/me/two-factor/disable', {
      cookie: on.cookie,
      body: { password: PASSWORD },
    });
    expect(off.statusCode).toBe(204);
  });

  it('a location that no longer counts (membership expired) does not hold it on', async () => {
    const user = await newUser('expired');
    const on = await turnOn(user);
    const owner = await seedTenant(db, `owner-${randomUUID().slice(0, 8)}`, { require2fa: true });
    await addMember(db, owner.locationId, user.userId, 'member', new Date(Date.now() - 60_000));
    const off = await kept('/me/two-factor/disable', {
      cookie: on.cookie,
      body: { password: PASSWORD },
    });
    expect(off.statusCode).toBe(204);
  });

  it('removes a set-up-again that was in progress', async () => {
    const user = await newUser('staged');
    const on = await turnOn(user);
    await kept('/me/two-factor/set-up-again', { cookie: on.cookie, body: { password: PASSWORD } });
    const off = await kept('/me/two-factor/disable', {
      cookie: on.cookie,
      body: { password: PASSWORD },
    });
    expect(off.statusCode).toBe(204);
    const { rows } = await db.pools.auth.query(
      `SELECT count(*)::int AS n FROM auth.verification WHERE identifier LIKE 'two-factor-setup:%'`,
    );
    expect(rows[0].n).toBe(0);
  });
});

describe("Better Auth's own management routes are closed over HTTP", () => {
  it.each(SIGN_IN_MANAGEMENT_PATHS)(
    '%s answers 404, for a password account and a passwordless one',
    async (path) => {
      for (const password of [true, false]) {
        const user = await newUser(`direct-${password}`, { password });
        // A passkey and the app on (through Kept), so each route would have something to do.
        await addPasskey(user.cookie, { name: 'Laptop' });
        const on = await turnOn(user, password ? { password: PASSWORD } : {});
        const [key] = await passkeyRows(user.userId);
        const method = path.startsWith('/passkey/list') ? 'GET' : 'POST';
        const res = await auth(path, {
          method,
          cookie: on.cookie,
          ...(method === 'POST'
            ? { body: { password: PASSWORD, id: key?.id, name: 'Renamed', method: 'totp' } }
            : {}),
        });
        expect(res.statusCode).toBe(404);
        expect(res.body).not.toContain(on.secret);
        const view = await signInView(on.cookie);
        expect(view.twoFactor).toEqual({ enabled: true, backupCodesLeft: 10 });
        expect(view.passkeys.map((p) => p.name)).toEqual(['Laptop']);
      }
    },
  );

  it('the server still refuses removing the last way in when Better Auth is called directly', async () => {
    // auth.api is reachable from Kept's own code only; even there the delete is the plain one,
    // so the guard lives in Kept's route. This pins that the HTTP door is closed.
    const user = await newUser('door', { password: false });
    await addPasskey(user.cookie, { name: 'Laptop' });
    const [key] = await passkeyRows(user.userId);
    const res = await auth('/passkey/delete-passkey', {
      cookie: user.cookie,
      body: { id: key?.id },
    });
    expect(res.statusCode).toBe(404);
    expect(await passkeyRows(user.userId)).toHaveLength(1);
  });

  it('turning two-factor off directly over HTTP is refused, even where a location asks for it', async () => {
    const user = await newUser('door-off');
    const on = await turnOn(user);
    await joinTwoFactorLocation(user);
    const res = await auth('/two-factor/disable', {
      cookie: on.cookie,
      body: { password: PASSWORD },
    });
    expect(res.statusCode).toBe(404);
    expect((await signInView(on.cookie)).twoFactor.enabled).toBe(true);
  });
});

describe('confirm it is you', () => {
  it('every change refuses a session older than ten minutes on a passwordless account', async () => {
    const user = await newUser('stale', { password: false });
    await addPasskey(user.cookie, { name: 'Laptop' });
    await addPasskey(user.cookie, { name: 'Phone' });
    const on = await turnOn(user, {});
    const [key] = await passkeyRows(user.userId);
    await stale(user);
    const changes: [string, 'POST' | 'PATCH' | 'DELETE', object][] = [
      [`/me/passkeys/${key?.id}`, 'PATCH', { name: 'Mac' }],
      [`/me/passkeys/${key?.id}`, 'DELETE', {}],
      ['/me/two-factor/set-up-again', 'POST', {}],
      ['/me/two-factor/backup-codes', 'POST', {}],
      ['/me/two-factor/disable', 'POST', {}],
      ['/me/passkeys/confirm', 'POST', {}],
    ];
    for (const [path, method, body] of changes) {
      const res = await kept(path, { method, cookie: on.cookie, body });
      expect(res.statusCode, `${method} ${path}`).toBe(403);
      expect(res.json()).toMatchObject({ code: 'reauth_required', reauth: 'sign_in' });
    }
    expect((await addPasskey(on.cookie, { name: 'Tablet' })).statusCode).toBe(403);
    const view = await signInView(on.cookie);
    expect(view.passkeys.map((p) => p.name)).toEqual(['Laptop', 'Phone']);
    expect(view.twoFactor).toEqual({ enabled: true, backupCodesLeft: 10 });
  });

  it('turning two-factor on or off keeps the time of the real sign-in, so ten minutes never renew', async () => {
    const user = await newUser('renew', { password: false });
    // Signed in 9 minutes ago: still recent, so the app can be turned on.
    await age(user, 9);
    const on = await turnOn(user, {});
    // Better Auth swapped the session; the new one carries the old sign-in time.
    await age(user, 9);
    const refused = await kept('/me/two-factor/backup-codes', { cookie: on.cookie, body: {} });
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({ code: 'reauth_required', reauth: 'sign_in' });
    expect((await addPasskey(on.cookie, { name: 'Laptop' })).statusCode).toBe(403);

    // And turning it off, from a session signed in 9 minutes ago.
    const again = await newUser('renew-off', { password: false });
    const on2 = await turnOn(again, {});
    await age(again, 9);
    const off = await kept('/me/two-factor/disable', { cookie: on2.cookie, body: {} });
    expect(off.statusCode).toBe(204);
    const cookie = jar(off, on2.cookie);
    await age(again, 9);
    expect((await kept('/me/two-factor/enable', { cookie, body: {} })).statusCode).toBe(403);
  });

  it('wrong passwords count against the sign-in limiter, and are delayed after the free tries', async () => {
    const user = await newUser('limiter');
    const ip = freshIp();
    for (let i = 0; i < FREE_FAILURES + 1; i++) {
      const res = await kept('/me/two-factor/enable', {
        cookie: user.cookie,
        body: { password: 'not the password' },
        ip,
      });
      expect(res.statusCode).toBe(403);
    }
    const delayed = await kept('/me/two-factor/enable', {
      cookie: user.cookie,
      body: { password: PASSWORD },
      ip,
    });
    expect(delayed.statusCode).toBe(429);
    expect(delayed.json()).toMatchObject({ code: 'rate_limited' });
    // The same counter as signing in with the password from that address.
    const signIn = await auth('/sign-in/email', {
      body: { email: user.email, password: PASSWORD },
      ip,
    });
    expect(signIn.statusCode).toBe(429);
  });

  it('a personal token reaches none of these routes', () => {
    for (const [method, url] of [
      ['GET', '/api/v1/me/sign-in'],
      ['PATCH', '/api/v1/me/passkeys/:id'],
      ['DELETE', '/api/v1/me/passkeys/:id'],
      ['POST', '/api/v1/me/two-factor/enable'],
      ['POST', '/api/v1/me/two-factor/disable'],
      ['POST', '/api/v1/me/two-factor/backup-codes'],
      ['POST', '/api/v1/me/two-factor/set-up-again'],
      ['POST', '/api/v1/me/two-factor/set-up-again/verify'],
      ['POST', '/api/v1/me/passkeys/confirm'],
    ] as const) {
      expect(tokenAccessOf(method, url), `${method} ${url}`).toBe('none');
    }
  });
});

describe('rate limits on the Kept routes', () => {
  it("Better Auth's per-IP limit on two-factor endpoints still applies with limits on", async () => {
    await app({ rateLimitEnabled: true });
    const user = await newUser('limits');
    const on = await turnOn(user);
    const ip = freshIp();
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await auth('/two-factor/verify-totp', {
        cookie: on.cookie,
        body: { code: wrongCode(on.secret) },
        ip,
      });
      statuses.push(res.statusCode);
    }
    expect(statuses).toContain(429);
  });
});

describe('a code is accepted once', () => {
  /** The 30-second step now, waiting first when less than 4 s of it are left. */
  async function stepNow(): Promise<number> {
    const left = 30_000 - (Date.now() % 30_000);
    if (left < 4_000) await new Promise((r) => setTimeout(r, left + 100));
    return Math.floor(Date.now() / 30_000);
  }
  const at = (step: number) => step * 30_000 + 1_000;

  it('at sign-in: the same code twice is refused; the next step works; an older one stays refused', async () => {
    const user = await newUser('replay');
    const on = await turnOn(user);
    const step = await stepNow();
    // The code that turned it on was this step's (or the one before): the next one signs in.
    const next = totp(on.secret, at(step + 1));
    expect(await signInWith(user.email, { code: next })).toBe(200);
    expect(await signInWith(user.email, { code: next })).toBe(401);
    expect(await signInWith(user.email, { code: totp(on.secret, at(step)) })).toBe(401);
  });

  it('the code that turned the app on cannot sign in again', async () => {
    const user = await newUser('replay-on');
    const started = await kept('/me/two-factor/enable', {
      cookie: user.cookie,
      body: { password: PASSWORD },
    });
    const secret = new URL(started.json().totpURI).searchParams.get('secret') ?? '';
    const step = await stepNow();
    const code = totp(secret, at(step));
    const verified = await auth('/two-factor/verify-totp', { cookie: user.cookie, body: { code } });
    expect(verified.statusCode).toBe(200);
    expect(await signInWith(user.email, { code })).toBe(401);
    expect(await signInWith(user.email, { code: totp(secret, at(step + 1)) })).toBe(200);
  });

  it('the code that finished setting the app up again cannot sign in again', async () => {
    const user = await newUser('replay-again');
    const on = await turnOn(user);
    const started = await kept('/me/two-factor/set-up-again', {
      cookie: on.cookie,
      body: { password: PASSWORD },
    });
    const fresh = new URL(started.json().totpURI).searchParams.get('secret') ?? '';
    const step = await stepNow();
    // A step after the one that turned the app on.
    const code = totp(fresh, at(step + 1));
    const done = await kept('/me/two-factor/set-up-again/verify', {
      cookie: on.cookie,
      body: { code },
    });
    expect(done.statusCode).toBe(200);
    expect(await signInWith(user.email, { code })).toBe(401);
  });

  it('set up again refuses a code from a step already used, and keeps what was staged', async () => {
    const user = await newUser('replay-staged');
    const on = await turnOn(user);
    const step = await stepNow();
    expect(await signInWith(user.email, { code: totp(on.secret, at(step + 1)) })).toBe(200);
    const started = await kept('/me/two-factor/set-up-again', {
      cookie: on.cookie,
      body: { password: PASSWORD },
    });
    const fresh = new URL(started.json().totpURI).searchParams.get('secret') ?? '';
    const used = await kept('/me/two-factor/set-up-again/verify', {
      cookie: on.cookie,
      body: { code: totp(fresh, at(step)) },
    });
    expect(used.statusCode).toBe(400);
    // Still staged: the old app signs in, and a later step's code would finish it.
    const stillThere = await db.pools.auth.query(
      `SELECT count(*)::int AS n FROM auth.verification WHERE identifier LIKE 'two-factor-setup:%'`,
    );
    expect(stillThere.rows[0].n).toBe(1);
  });

  /** A password sign-in's two-factor challenge cookie. */
  async function challenge(email: string): Promise<string> {
    const first = await auth('/sign-in/email', { body: { email, password: PASSWORD } });
    expect(first.json()).toMatchObject({ twoFactorRedirect: true });
    return jar(first);
  }
  const verify = (cookie: string, code: string) =>
    auth('/two-factor/verify-totp', { cookie, body: { code } });

  it('a right code sent with a space is refused without using up its step', async () => {
    const user = await newUser('spaced');
    const on = await turnOn(user);
    const step = await stepNow();
    const code = totp(on.secret, at(step + 1));
    const cookie = await challenge(user.email);
    expect((await verify(cookie, `${code.slice(0, 3)} ${code.slice(3)}`)).statusCode).toBe(401);
    expect((await verify(cookie, code)).statusCode).toBe(200);
  });

  it('too many tries on one sign-in, a locked account or an expired challenge give the step back', async () => {
    const user = await newUser('given-back');
    const on = await turnOn(user);
    const step = await stepNow();
    const code = totp(on.secret, at(step + 1));
    const wrong = code === '000000' ? '111111' : '000000';

    // Too many tries on this sign-in: Better Auth refuses even the right code.
    let cookie = await challenge(user.email);
    for (let i = 0; i < 5; i++) await verify(cookie, wrong);
    expect((await verify(cookie, code)).statusCode).not.toBe(200);

    // A locked account.
    await db.pools.auth.query(
      `UPDATE auth.two_factor SET locked_until = now() + interval '1 hour' WHERE user_id = $1`,
      [user.userId],
    );
    cookie = await challenge(user.email);
    expect((await verify(cookie, code)).statusCode).not.toBe(200);
    await db.pools.auth.query(
      `UPDATE auth.two_factor SET locked_until = NULL, failed_verification_count = 0
        WHERE user_id = $1`,
      [user.userId],
    );

    // An expired challenge.
    cookie = await challenge(user.email);
    await db.pools.auth.query(
      `UPDATE auth.verification SET expires_at = now() - interval '1 second'
        WHERE value = $1 AND identifier NOT LIKE 'totp-step:%'`,
      [user.userId],
    );
    expect((await verify(cookie, code)).statusCode).not.toBe(200);

    // None of them used the step: the same code signs in now, once.
    expect(await signInWith(user.email, { code })).toBe(200);
    expect(await signInWith(user.email, { code })).toBe(401);
  });

  it('a held lock on the account answers 429, never 500, and uses up nothing', async () => {
    const user = await newUser('busy');
    const on = await turnOn(user);
    const step = await stepNow();
    const code = totp(on.secret, at(step + 1));
    const started = await kept('/me/two-factor/set-up-again', {
      cookie: on.cookie,
      body: { password: PASSWORD },
    });
    const fresh = new URL(started.json().totpURI).searchParams.get('secret') ?? '';
    const cookie = await challenge(user.email);
    const holder = await db.pools.auth.connect();
    try {
      await holder.query('BEGIN');
      await holder.query('SELECT 1 FROM auth.two_factor WHERE user_id = $1 FOR UPDATE', [
        user.userId,
      ]);
      const [signIn, again] = await Promise.all([
        verify(cookie, code),
        kept('/me/two-factor/set-up-again/verify', {
          cookie: on.cookie,
          body: { code: totp(fresh, at(step + 1)) },
        }),
      ]);
      expect(signIn.statusCode).toBe(429);
      expect(again.statusCode).toBe(429);
    } finally {
      await holder.query('ROLLBACK');
      holder.release();
    }
    expect(await signInWith(user.email, { code })).toBe(200);
  });

  it('an expired record of a used step blocks nothing', async () => {
    const user = await newUser('stale-step');
    await turnOn(user);
    const step = await stepNow();
    // A record of a much later step, expired (a clock that jumped and came back). The claim
    // reads it itself, before anything else has cleared expired rows.
    await db.pools.auth.query(
      `UPDATE auth.verification SET value = $2, expires_at = now() - interval '1 second'
        WHERE identifier = $1`,
      [`totp-step:${user.userId}`, String(step + 100)],
    );
    expect(await claimTotpStep(db.pools.auth, user.userId, step + 1)).toEqual({
      claimed: true,
      previous: null,
    });
  });

  it('is per account: another account uses the same step freely', async () => {
    const ann = await newUser('replay-ann');
    const ben = await newUser('replay-ben');
    const annOn = await turnOn(ann);
    const benOn = await turnOn(ben);
    const step = await stepNow();
    expect(await signInWith(ann.email, { code: totp(annOn.secret, at(step + 1)) })).toBe(200);
    expect(await signInWith(ben.email, { code: totp(benOn.secret, at(step + 1)) })).toBe(200);
  });

  it('a pending session cannot finish with a code already used at sign-in', async () => {
    const user = await newUser('replay-pending');
    const on = await turnOn(user);
    const step = await stepNow();
    const code = totp(on.secret, at(step + 1));
    expect(await signInWith(user.email, { code })).toBe(200);
    const pending = await otherDevice(user);
    const res = await auth('/two-factor/verify-totp', { cookie: pending, body: { code } });
    expect(res.statusCode).toBe(401);
  });
});

describe('notices', () => {
  it('a managed account (no real address) is never mailed, whatever changes', async () => {
    const user = await newUser('managed');
    await db.pools.auth.query(`UPDATE auth."user" SET email = $1 WHERE id = $2`, [
      `${randomUUID()}@managed.invalid`,
      user.userId,
    ]);
    expect((await addPasskey(user.cookie, { name: 'Laptop' })).statusCode).toBe(200);
    const [laptop] = await passkeyRows(user.userId);
    const removed = await kept(`/me/passkeys/${laptop?.id}`, {
      method: 'DELETE',
      cookie: user.cookie,
      body: { password: PASSWORD },
    });
    expect(removed.statusCode).toBe(204);
    const on = await turnOn(user);
    const codes = await kept('/me/two-factor/backup-codes', {
      cookie: on.cookie,
      body: { password: PASSWORD },
    });
    expect(codes.statusCode).toBe(200);
    const started = await kept('/me/two-factor/set-up-again', {
      cookie: on.cookie,
      body: { password: PASSWORD },
    });
    const fresh = new URL(started.json().totpURI).searchParams.get('secret') ?? '';
    const swapped = await kept('/me/two-factor/set-up-again/verify', {
      cookie: on.cookie,
      body: { code: await nextTotp(fresh, user.userId) },
    });
    expect(swapped.statusCode).toBe(200);
    const off = await kept('/me/two-factor/disable', {
      cookie: on.cookie,
      body: { password: PASSWORD },
    });
    expect(off.statusCode).toBe(204);
    // Give any background mail a moment to have been attempted.
    await new Promise((r) => setTimeout(r, 200));
    expect(t.auth.notices.filter((n) => n.email.endsWith('.invalid'))).toEqual([]);
  });
});

describe('an account claimed by its mailbox', () => {
  it('loses a set-up-again in progress with its passkeys, secret and codes', async () => {
    const user = await newUser('claimed');
    const on = await turnOn(user);
    await addPasskey(on.cookie, { name: 'Laptop' });
    await kept('/me/two-factor/set-up-again', { cookie: on.cookie, body: { password: PASSWORD } });
    await userEmail(db, user.userId, false);
    await auth('/request-password-reset', { body: { email: user.email } });
    const url = t.auth.resets.at(-1)?.url ?? '';
    const token = new URLSearchParams(new URL(url).hash.slice(1)).get('token') ?? '';
    const reset = await auth('/reset-password', {
      body: { token, newPassword: 'another good password' },
    });
    expect(reset.statusCode).toBe(200);
    const { rows } = await db.pools.auth.query(
      `SELECT (SELECT count(*)::int FROM auth.passkey WHERE user_id = $1) AS passkeys,
              (SELECT count(*)::int FROM auth.two_factor WHERE user_id = $1) AS totp,
              (SELECT count(*)::int FROM auth.verification
                WHERE identifier LIKE 'two-factor-setup:%') AS staged`,
      [user.userId],
    );
    expect(rows[0]).toEqual({ passkeys: 0, totp: 0, staged: 0 });
  });
});
