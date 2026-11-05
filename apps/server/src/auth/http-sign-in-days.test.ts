import { randomUUID } from 'node:crypto';
import type { LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { jar, setCookies, type TestApp, testApp } from '../../test/app.js';
import { enrolTotp, nextTotp, PUBLIC_URL, signUp } from '../../test/auth.js';
import { type TestDb, testDb } from '../../test/db.js';
import { ownerTx, userEmail } from '../../test/tenancy.js';
import { registerSoftPasskey } from '../../test/webauthn.js';
import { AUTH_BASE_PATH } from './auth.js';
import { createManagedUser, issueResetCode } from './managed.js';
import { oidcInvites } from './oidc.js';

// KEPT_HTTP_SIGN_IN_DAYS (#404, D274), the whole table: each address and setting, with each way to
// sign in, through the Fastify app the way a browser reaches it. Time is moved by editing the
// session row. Every number is written out here, not read from auth.ts, so a change to a lifetime
// has to change this table too. The table runs twice: on the main address, and (#405, D275) on an
// extra one in KEPT_EXTRA_ADDRESSES, with Better Auth's own Origin check on, where a sign-in lasts
// exactly as long. No passkey on the second: they belong to the main address.

vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

const HOUR = 3600;
const DAY = 86_400;
const HTTPS_URL = 'https://kept.example.test';
/** Where the browser is, by app, when that isn't the public URL (#405). */
const browserAt = new WeakMap<TestApp, string>();
const extraAddressOf = (publicUrl: string) =>
  publicUrl === HTTPS_URL ? 'https://kept-ts.example.test' : 'http://kept-ts.lan:5173';
const PASSWORD = 'correct horse battery';

type Row = {
  name: string;
  publicUrl: string;
  setting?: number;
  /** Seconds a sign-in lasts. */
  lifetime: number;
  /** Seconds after the last renewal a request renews it; null: never. */
  renewsAfter: number | null;
};

const ROWS: Row[] = [
  { name: 'http, unset', publicUrl: PUBLIC_URL, lifetime: 12 * HOUR, renewsAfter: null },
  // One day can't renew once a day: the renewal would fall due as the sign-in ends.
  { name: 'http, 1 day', publicUrl: PUBLIC_URL, setting: 1, lifetime: DAY, renewsAfter: 12 * HOUR },
  { name: 'http, 7 days', publicUrl: PUBLIC_URL, setting: 7, lifetime: 7 * DAY, renewsAfter: DAY },
  {
    name: 'http, 30 days',
    publicUrl: PUBLIC_URL,
    setting: 30,
    lifetime: 30 * DAY,
    renewsAfter: DAY,
  },
  { name: 'https, unset', publicUrl: HTTPS_URL, lifetime: 30 * DAY, renewsAfter: DAY },
  // Ignored: 30 days and daily, whatever it says.
  { name: 'https, 1 day', publicUrl: HTTPS_URL, setting: 1, lifetime: 30 * DAY, renewsAfter: DAY },
  { name: 'https, 7 days', publicUrl: HTTPS_URL, setting: 7, lifetime: 30 * DAY, renewsAfter: DAY },
];

let db: TestDb;
let ipCounter = 0;

/** A new documentation-range address per request: the per-address sign-in limit is not the test. */
function freshIp(): string {
  ipCounter += 1;
  return `198.18.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
}

type Send = { method?: 'GET' | 'POST' | 'DELETE'; cookie?: string; body?: unknown };

function send(t: TestApp, url: string, opts: Send = {}): Promise<LightMyRequestResponse> {
  const headers: Record<string, string> = { origin: browserAt.get(t) ?? t.publicUrl };
  if (opts.cookie) headers.cookie = opts.cookie;
  return t.app.inject({
    method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'),
    url,
    headers,
    remoteAddress: freshIp(),
    ...(opts.body !== undefined ? { payload: opts.body as object } : {}),
  });
}

const auth = (t: TestApp, path: string, opts: Send = {}) =>
  send(t, `${AUTH_BASE_PATH}${path}`, opts);

/** The route every "next request" below calls. */
const nextRequest = (t: TestApp, cookie: string) => send(t, '/api/v1/me/sessions', { cookie });

const email = (label: string) => `${label}-${randomUUID()}@example.com`;

/** The sign-up's own session is gone, so the one row left is the sign-in under test. */
const noSessions = (userId: string) =>
  db.pools.auth.query('DELETE FROM auth.session WHERE user_id = $1', [userId]);

async function newAccount(t: TestApp, label: string) {
  const address = email(label);
  const { userId, cookie } = await signUp(t.auth, address, PASSWORD);
  await userEmail(db, userId, true);
  return { userId, address, cookie };
}

type SignedIn = { userId: string; cookie: string; line: string };

/** The session cookie's Set-Cookie line, found among whatever else the response set. */
function sessionLine(res: LightMyRequestResponse): string {
  return setCookies(res).find((c) => c.includes('session_token=')) ?? '';
}

const METHODS: Record<string, (t: TestApp) => Promise<SignedIn>> = {
  password: async (t) => {
    const { userId, address } = await newAccount(t, 'password');
    await noSessions(userId);
    const res = await auth(t, '/sign-in/email', { body: { email: address, password: PASSWORD } });
    expect(res.statusCode, res.body).toBe(200);
    return { userId, cookie: jar(res), line: sessionLine(res) };
  },
  'email link': async (t) => {
    const { userId, address } = await newAccount(t, 'link');
    await noSessions(userId);
    await auth(t, '/sign-in/magic-link', { body: { email: address } });
    const token = t.auth.mails.at(-1)?.token ?? '';
    const res = await auth(t, '/magic-link/verify', { body: { token } });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toEqual({ mfaRequired: false });
    return { userId, cookie: jar(res), line: sessionLine(res) };
  },
  'password and a 2FA code': async (t) => {
    const { userId, address, cookie } = await newAccount(t, 'totp');
    const { secret } = await enrolTotp(t.auth, { userId, cookie }, PASSWORD);
    await noSessions(userId);
    const challenged = await auth(t, '/sign-in/email', {
      body: { email: address, password: PASSWORD },
    });
    expect(challenged.json()).toMatchObject({ twoFactorRedirect: true });
    const res = await auth(t, '/two-factor/verify-totp', {
      cookie: jar(challenged),
      body: { code: await nextTotp(secret, userId) },
    });
    expect(res.statusCode, res.body).toBe(200);
    return { userId, cookie: jar(res, jar(challenged)), line: sessionLine(res) };
  },
  "a managed account's admin code": async (t) => {
    const username = `kid_${randomUUID().slice(0, 8)}`;
    const { userId } = await createManagedUser(t.auth, {
      username,
      displayName: 'Peter',
      password: PASSWORD,
    });
    const code = await issueResetCode(t.auth, db.pools.auth, userId);
    const newPassword = 'a password of his own';
    const redeemed = await send(t, '/api/v1/auth/reset-code', {
      body: { username, code, newPassword },
    });
    expect(redeemed.statusCode, redeemed.body).toBe(204);
    await noSessions(userId);
    const res = await auth(t, '/sign-in/username', { body: { username, password: newPassword } });
    expect(res.statusCode, res.body).toBe(200);
    return { userId, cookie: jar(res), line: sessionLine(res) };
  },
  // The server has no passkey gate of its own: over http it is the browser that says no, on any
  // address but localhost (a secure context, and what PUBLIC_URL is here). Whichever door the
  // session comes through, it gets the row's length. Browser side: e2e/http-sign-in.spec.ts.
  passkey: async (t) => {
    const { userId } = await newAccount(t, 'passkey');
    await noSessions(userId);
    const origin = t.publicUrl;
    const key = await registerSoftPasskey(db.pools.auth, userId, {
      id: new URL(origin).hostname,
      origin,
    });
    const options = await auth(t, '/passkey/generate-authenticate-options');
    expect(options.statusCode, options.body).toBe(200);
    const challengeCookie = jar(options);
    const res = await auth(t, '/passkey/verify-authentication', {
      cookie: challengeCookie,
      body: { response: key.assert({ challenge: options.json().challenge, userVerified: true }) },
    });
    expect(res.statusCode, res.body).toBe(200);
    return { userId, cookie: jar(res, challengeCookie), line: sessionLine(res) };
  },
};

type SessionRow = { id: string; expires_at: Date; created_at: Date; updated_at: Date };

async function onlyRow(userId: string): Promise<SessionRow> {
  const { rows } = await db.pools.auth.query<SessionRow>(
    'SELECT id, expires_at, created_at, updated_at FROM auth.session WHERE user_id = $1',
    [userId],
  );
  expect(rows).toHaveLength(1);
  return rows[0] as SessionRow;
}

/** Moves the clock: the session was last renewed `elapsed` seconds ago, in a row of `lifetime`. */
const lastRenewed = (userId: string, elapsed: number, lifetime: number) =>
  db.pools.auth.query(
    `UPDATE auth.session SET expires_at = now() + make_interval(secs => $2) WHERE user_id = $1`,
    [userId, lifetime - elapsed],
  );

const secondsFromNow = (at: Date) => (at.getTime() - Date.now()) / 1000;

function expectCookie(line: string, row: Row) {
  const https = row.publicUrl === HTTPS_URL;
  expect(line).toContain(`Max-Age=${row.lifetime};`);
  expect(line).toMatch(/;\s*HttpOnly/i);
  expect(line).toMatch(/;\s*SameSite=Lax/i);
  expect(line).toMatch(/;\s*Path=\//i);
  if (https) {
    expect(line).toMatch(/^__Secure-/);
    expect(line).toMatch(/;\s*Secure/i);
  } else {
    expect(line).not.toMatch(/__Secure-/);
    expect(line).not.toMatch(/;\s*Secure/i);
  }
}

beforeAll(async () => {
  db = await testDb();
  await db.reset();
});

describe.each(
  ROWS.flatMap((row) => [
    { ...row, where: 'the main address', extra: false },
    { ...row, where: 'an extra address', extra: true },
  ]),
)('$name, on $where', (row) => {
  let t: TestApp;

  beforeAll(async () => {
    t = await testApp(db, {
      publicUrl: row.publicUrl,
      ...(row.setting !== undefined ? { httpSignInDays: row.setting } : {}),
      ...(row.extra
        ? { extraAddresses: [extraAddressOf(row.publicUrl)], authOriginCheck: true }
        : {}),
    });
    if (row.extra) browserAt.set(t, extraAddressOf(row.publicUrl));
  });
  afterAll(async () => {
    await t.app.close();
  });

  const methods = Object.keys(METHODS).filter((m) => !(row.extra && m === 'passkey'));
  it.each(methods)('with %s', async (method) => {
    const signIn = METHODS[method] as (t: TestApp) => Promise<SignedIn>;
    const { userId, cookie, line } = await signIn(t);

    // The sign-in's expiry, in the database and in the cookie.
    const first = await onlyRow(userId);
    expect(Math.round((first.expires_at.getTime() - first.created_at.getTime()) / 1000)).toBe(
      row.lifetime,
    );
    expectCookie(line, row);

    // No renewal where none is due.
    const notDue = row.renewsAfter === null ? row.lifetime - HOUR : row.renewsAfter - 60;
    await lastRenewed(userId, notDue, row.lifetime);
    const before = await onlyRow(userId);
    const quiet = await nextRequest(t, cookie);
    expect(quiet.statusCode, quiet.body).toBe(200);
    expect(setCookies(quiet)).toEqual([]);
    expect((await onlyRow(userId)).expires_at).toEqual(before.expires_at);

    if (row.renewsAfter !== null) {
      // Renewal, once it is due: the whole length again, in both places, the sign-in's age kept.
      await lastRenewed(userId, row.renewsAfter + 60, row.lifetime);
      const due = await nextRequest(t, cookie);
      expect(due.statusCode, due.body).toBe(200);
      expectCookie(sessionLine(due), row);
      const renewed = await onlyRow(userId);
      expect(secondsFromNow(renewed.expires_at)).toBeGreaterThan(row.lifetime - 30);
      expect(secondsFromNow(renewed.expires_at)).toBeLessThanOrEqual(row.lifetime);
      expect(renewed.created_at).toEqual(first.created_at);
      // And none straight after it.
      const again = await nextRequest(t, cookie);
      expect(setCookies(again)).toEqual([]);
    }

    // Expired: the next request signs out, and the row and the cookie go.
    await db.pools.auth.query(
      `UPDATE auth.session SET expires_at = now() - interval '1 second' WHERE user_id = $1`,
      [userId],
    );
    const gone = await nextRequest(t, cookie);
    expect(gone.statusCode).toBe(401);
    expect(gone.json()).toMatchObject({ code: 'unauthenticated' });
    expect(sessionLine(gone)).toMatch(/Max-Age=0/i);
    const { rows } = await db.pools.auth.query('SELECT 1 FROM auth.session WHERE user_id = $1', [
      userId,
    ]);
    expect(rows).toEqual([]);
    expect((await auth(t, '/get-session', { cookie })).json()).toBeNull();
  });

  it('holds Better Auth to these numbers, the ten minutes included', async () => {
    const { sessionConfig } = await t.auth.$context;
    expect(sessionConfig.expiresIn).toBe(row.lifetime);
    expect(sessionConfig.freshAge).toBe(600);
    if (row.renewsAfter !== null) expect(sessionConfig.updateAge).toBe(row.renewsAfter);
  });

  it('Admin → Status says what is in force', async () => {
    const admin = await newAccount(t, 'admin');
    await ownerTx(db, (c) =>
      c.query('INSERT INTO public.instance_admins (user_id) VALUES ($1)', [admin.userId]),
    );
    const res = await send(t, '/api/v1/admin/status', { cookie: admin.cookie });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().signIn).toEqual({
      hours: row.lifetime / HOUR,
      renewed: row.renewsAfter !== null,
      https: row.publicUrl === HTTPS_URL,
      setting: row.setting ?? null,
    });
  });

  it('sign out everywhere ends every sign-in, renewed ones too; sign out ends its own', async () => {
    const admin = await newAccount(t, 'chief');
    await ownerTx(db, (c) =>
      c.query('INSERT INTO public.instance_admins (user_id) VALUES ($1)', [admin.userId]),
    );
    const person = await newAccount(t, 'person');
    await noSessions(person.userId);
    const signIn = async () =>
      jar(await auth(t, '/sign-in/email', { body: { email: person.address, password: PASSWORD } }));
    const [one, two, three] = [await signIn(), await signIn(), await signIn()];
    if (row.renewsAfter !== null) {
      await lastRenewed(person.userId, row.renewsAfter + 60, row.lifetime);
      expect(sessionLine(await nextRequest(t, one))).not.toBe('');
    }
    expect(
      (await auth(t, '/sign-out', { method: 'POST', cookie: three, body: {} })).statusCode,
    ).toBe(200);
    expect((await nextRequest(t, three)).statusCode).toBe(401);
    expect((await nextRequest(t, two)).statusCode).toBe(200);

    const out = await send(t, `/api/v1/admin/users/${person.userId}/sign-out-everywhere`, {
      cookie: admin.cookie,
      body: {},
    });
    expect(out.statusCode, out.body).toBeLessThan(300);
    expect((await nextRequest(t, one)).statusCode).toBe(401);
    expect((await nextRequest(t, two)).statusCode).toBe(401);
    const { rows } = await db.pools.auth.query('SELECT 1 FROM auth.session WHERE user_id = $1', [
      person.userId,
    ]);
    expect(rows).toEqual([]);
  });
});

// The ten-minute rule goes by the row's created_at (auth/reauth.ts; Better Auth's
// freshSessionMiddleware; auth/oidc.ts). A renewal writes expires_at and updated_at only, so a
// sign-in kept alive for days never counts as recent.
describe.each(ROWS.filter((r) => r.renewsAfter !== null))('recent sign-in: $name', (row) => {
  let t: TestApp;
  const body = () => ({ newEmail: email('new') });

  beforeAll(async () => {
    t = await testApp(db, {
      publicUrl: row.publicUrl,
      ...(row.setting !== undefined ? { httpSignInDays: row.setting } : {}),
      google: {
        clientId: 'test-client.apps.googleusercontent.com',
        clientSecret: 'test-secret',
        invites: oidcInvites(db.pools.app),
      },
    });
  });
  afterAll(async () => {
    await t.app.close();
  });

  /** An account with no password, one sign-in `minutes` old, whose renewal is due now. */
  async function passwordless(minutes: number) {
    const { userId, cookie } = await newAccount(t, 'nopass');
    await db.pools.auth.query(
      `DELETE FROM auth.account WHERE user_id = $1 AND provider_id = 'credential'`,
      [userId],
    );
    await db.pools.auth.query(
      `UPDATE auth.session SET created_at = now() - make_interval(mins => $2) WHERE user_id = $1`,
      [userId, minutes],
    );
    await lastRenewed(userId, (row.renewsAfter as number) + 60, row.lifetime);
    return { userId, cookie, before: await onlyRow(userId) };
  }

  it('a renewal in the same request does not make an old sign-in recent', async () => {
    const { userId, cookie, before } = await passwordless(11);
    const res = await send(t, '/api/v1/me/email-change', { cookie, body: body() });
    expect(res.statusCode, res.body).toBe(403);
    expect(res.json()).toMatchObject({ code: 'reauth_required', reauth: 'sign_in' });
    // It did renew in that request: the refusal is not for want of one.
    expectCookie(sessionLine(res), row);
    const after = await onlyRow(userId);
    expect(after.expires_at.getTime()).toBeGreaterThan(before.expires_at.getTime());
    expect(after.updated_at.getTime()).toBeGreaterThan(before.updated_at.getTime());
    expect(after.created_at).toEqual(before.created_at);
    // Nor does the request after it.
    const next = await send(t, '/api/v1/me/email-change', { cookie, body: body() });
    expect(next.statusCode).toBe(403);
    expect(next.json()).toMatchObject({ code: 'reauth_required' });
  });

  it('Better Auth’s own check holds too: linking an account from an old sign-in', async () => {
    const { cookie } = await passwordless(11);
    const res = await auth(t, '/link-social', {
      cookie,
      body: { provider: 'google', callbackURL: '/settings' },
    });
    expect(res.statusCode, res.body).toBe(403);
    expect(res.json()).toMatchObject({ code: 'SESSION_NOT_FRESH' });
  });

  it('a sign-in under ten minutes old still counts', async () => {
    const { cookie } = await passwordless(9);
    const res = await send(t, '/api/v1/me/email-change', { cookie, body: body() });
    expect(res.statusCode, res.body).toBe(202);
  });

  it('an account with a password is asked for it, however new the sign-in', async () => {
    const { cookie } = await newAccount(t, 'haspass');
    const res = await send(t, '/api/v1/me/email-change', { cookie, body: body() });
    expect(res.statusCode, res.body).toBe(403);
    expect(res.json()).toMatchObject({ code: 'reauth_required', reauth: 'password' });
  });
});

describe('a session still waiting for its second factor (setting on)', () => {
  it('stays refused, however long it lasts', async () => {
    const t = await testApp(db, { httpSignInDays: 7 });
    const { userId, address, cookie } = await newAccount(t, 'pending');
    await enrolTotp(t.auth, { userId, cookie }, PASSWORD);
    await noSessions(userId);
    await auth(t, '/sign-in/magic-link', { body: { email: address } });
    const res = await auth(t, '/magic-link/verify', {
      body: { token: t.auth.mails.at(-1)?.token ?? '' },
    });
    expect(res.json()).toEqual({ mfaRequired: true });
    await lastRenewed(userId, DAY + 60, 7 * DAY);
    const pending = await nextRequest(t, jar(res));
    expect(pending.statusCode).toBe(403);
    expect(pending.json()).toMatchObject({ code: 'mfa_required' });
    await t.app.close();
  });
});

describe('changing the setting, with sign-ins already made', () => {
  it('turned on: a 12-hour sign-in becomes the longer one at its next use', async () => {
    const off = await testApp(db);
    const on = await testApp(db, { httpSignInDays: 7 });
    const { userId, cookie, line } = await (METHODS.password as (t: TestApp) => Promise<SignedIn>)(
      off,
    );
    expect(line).toContain(`Max-Age=${12 * HOUR};`);
    const res = await nextRequest(on, cookie);
    expect(sessionLine(res)).toContain(`Max-Age=${7 * DAY};`);
    expect(secondsFromNow((await onlyRow(userId)).expires_at)).toBeGreaterThan(7 * DAY - 30);
    await Promise.all([off.app.close(), on.app.close()]);
  });

  it('turned off: a longer sign-in runs out in its own time, never renewed', async () => {
    const on = await testApp(db, { httpSignInDays: 7 });
    const off = await testApp(db);
    const { userId, cookie } = await (METHODS.password as (t: TestApp) => Promise<SignedIn>)(on);
    await lastRenewed(userId, DAY + 60, 7 * DAY);
    const before = await onlyRow(userId);
    const res = await nextRequest(off, cookie);
    expect(res.statusCode).toBe(200);
    expect(setCookies(res)).toEqual([]);
    expect((await onlyRow(userId)).expires_at).toEqual(before.expires_at);
    await Promise.all([on.app.close(), off.app.close()]);
  });
});
