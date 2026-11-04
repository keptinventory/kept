import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { jar, setCookies, type TestApp, testApp } from '../../test/app.js';
import { enrolTotp, nextTotp, signUp } from '../../test/auth.js';
import { type TestDb, testDb } from '../../test/db.js';
import { ownerTx, userEmail } from '../../test/tenancy.js';
import { registerSoftPasskey, softRegistration } from '../../test/webauthn.js';
import { ensureAccount } from '../accounts/ensure-account.js';
import { HA_SUPERVISOR_ADDRESS } from '../http/ingress.js';
import { loadWebBundle, type WebBundle } from '../http/web.js';
import { ensureSetupCode } from '../setup/setup-code.js';
import { AUTH_BASE_PATH } from './auth.js';

// KEPT_EXTRA_ADDRESSES (#405, D275) through the front door: Kept's own Origin check and Better
// Auth's, both on, as in production. Each case says what the browser sends. The sign-in length
// table on an extra address is in http-sign-in-days.test.ts.

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const PASSWORD = 'correct horse battery';
const MAIN = 'http://kept.lan:8080';
const EXTRA = 'http://kept-ts.lan:8080';
const EXTRA_IP = 'http://100.64.0.7:8080';
const HTTPS_MAIN = 'https://kept.example.test';
const HTTPS_EXTRA = 'https://kept-ts.example.test';

const LOOKALIKES = [
  'http://kept-ts.lan.example.com:8080',
  'http://kept-ts.lan:81',
  'http://kept-ts.lan',
  'http://kept-ts.lan:8081',
  'https://kept-ts.lan:8080',
  'http://kept-ts.lan.:8080',
  'http://evil.kept-ts.lan:8080',
  // What a client could write; a browser sends only a bare origin.
  'http://kept-ts.lan:8080@evil.example',
  'http://kept-ts.lan@evil.example',
  // Cyrillic е in place of e: as UTF-8 bytes reach Node on the wire, and as a browser sends it.
  Buffer.from('http://kеpt-ts.lan:8080', 'utf8').toString('latin1'),
  'http://xn--kpt-ts-3nf.lan:8080',
  'http://evil.example',
];

/** Not an origin any browser sends. A write is refused, as the comparison is whole; Better Auth
 * tidies these before comparing, which gives a client nothing it couldn't write itself. */
const NOT_BROWSER_ORIGINS = ['http://kept-ts.lan:8080/', 'HTTP://KEPT-TS.LAN:8080'];

let db: TestDb;
let ip = 0;

function freshIp(): string {
  ip += 1;
  return `198.19.${Math.floor(ip / 250)}.${(ip % 250) + 1}`;
}

type Send = {
  method?: 'GET' | 'POST' | 'PUT';
  origin?: string | null;
  cookie?: string;
  body?: unknown;
  headers?: Record<string, string>;
  remoteAddress?: string;
};

function send(t: TestApp, url: string, opts: Send = {}): Promise<LightMyRequestResponse> {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.origin) headers.origin = opts.origin;
  if (opts.cookie) headers.cookie = opts.cookie;
  return t.app.inject({
    method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'),
    url,
    headers,
    remoteAddress: opts.remoteAddress ?? freshIp(),
    ...(opts.body !== undefined ? { payload: opts.body as object } : {}),
  });
}

const email = (label = 'extra') => `${label}-${randomUUID()}@example.com`;

async function account(t: TestApp, label?: string) {
  const address = email(label);
  const { userId, cookie } = await signUp(t.auth, address, PASSWORD);
  await userEmail(db, userId, true);
  await ensureAccount(db.pools, userId);
  return { userId, address, cookie };
}

const signIn = (t: TestApp, address: string, origin: string) =>
  send(t, `${AUTH_BASE_PATH}/sign-in/email`, {
    origin,
    body: { email: address, password: PASSWORD },
  });

/** What every write carries through the inventory's own routes. */
const LOCATION = () => ({
  name: `Home ${randomUUID().slice(0, 8)}`,
  kind: 'home',
  preset: 'essentials',
  timezone: 'Africa/Cairo',
  currency: 'EGP',
  rooms: [],
});

const newLocation = (t: TestApp, origin: string | null, cookie: string) =>
  send(t, '/api/v1/locations', {
    origin,
    cookie,
    headers: { 'idempotency-key': randomUUID() },
    body: LOCATION(),
  });

const onLocalList = { publicUrl: MAIN, extraAddresses: [EXTRA, EXTRA_IP], authOriginCheck: true };

beforeAll(async () => {
  db = await testDb();
  await db.reset();
});

describe('a listed address', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await testApp(db, onLocalList);
  });
  afterAll(async () => {
    await t.app.close();
  });

  it.each([MAIN, EXTRA, EXTRA_IP])('%s signs in and writes', async (origin) => {
    const { address } = await account(t);
    const res = await signIn(t, address, origin);
    expect(res.statusCode, res.body).toBe(200);
    const cookie = jar(res);
    // No Domain: the cookie stays on the address that asked for it.
    for (const line of setCookies(res)) expect(line).not.toMatch(/;\s*Domain=/i);
    const made = await newLocation(t, origin, cookie);
    expect(made.statusCode, made.body).toBe(201);
    expect((await send(t, '/api/v1/me', { cookie })).statusCode).toBe(200);
    // And signs out, as Better Auth's own mount is what checks that one.
    const out = await send(t, `${AUTH_BASE_PATH}/sign-out`, { origin, cookie, body: {} });
    expect(out.statusCode, out.body).toBe(200);
  });

  it('takes an email link and a password reset request, and a 2FA code', async () => {
    const { userId, address, cookie } = await account(t);
    const link = await send(t, `${AUTH_BASE_PATH}/sign-in/magic-link`, {
      origin: EXTRA,
      body: { email: address },
    });
    expect(link.statusCode, link.body).toBe(200);
    const reset = await send(t, `${AUTH_BASE_PATH}/request-password-reset`, {
      origin: EXTRA,
      body: { email: address },
    });
    expect(reset.statusCode, reset.body).toBe(200);

    const { secret } = await enrolTotp(t.auth, { userId, cookie }, PASSWORD);
    const challenged = await signIn(t, address, EXTRA);
    expect(challenged.json()).toMatchObject({ twoFactorRedirect: true });
    const res = await send(t, `${AUTH_BASE_PATH}/two-factor/verify-totp`, {
      origin: EXTRA,
      cookie: jar(challenged),
      body: { code: await nextTotp(secret, userId) },
    });
    expect(res.statusCode, res.body).toBe(200);
  });

  it('accepts a same-origin request with an opaque Origin, as before, and nothing else', async () => {
    const { cookie } = await account(t);
    const opaque = await newLocation(t, 'null', cookie);
    expect(opaque.statusCode).toBe(403);
    expect(opaque.json()).toMatchObject({ code: 'forbidden' });
    const bare = await newLocation(t, null, cookie);
    expect(bare.statusCode).toBe(403);
    expect(bare.json()).toMatchObject({ code: 'forbidden' });
  });
});

describe('an address not on the list', () => {
  let t: TestApp;
  let cookie: string;
  let address: string;
  beforeAll(async () => {
    t = await testApp(db, onLocalList);
    ({ cookie, address } = await account(t));
  });
  afterAll(async () => {
    await t.app.close();
  });

  it.each(LOOKALIKES)('%s can neither write nor sign in', async (origin) => {
    const write = await newLocation(t, origin, cookie);
    expect(write.statusCode, write.body).toBe(403);
    expect(write.json()).toMatchObject({ code: 'origin_mismatch', expectedOrigin: MAIN });

    const res = await signIn(t, address, origin);
    expect(res.statusCode, res.body).toBe(403);
    expect(res.json()).toMatchObject({ code: 'origin_mismatch', expectedOrigin: MAIN });
    expect(setCookies(res).filter((c) => c.includes('session_token='))).toEqual([]);
  });

  it.each(NOT_BROWSER_ORIGINS)('%s can’t write', async (origin) => {
    const write = await newLocation(t, origin, cookie);
    expect(write.statusCode, write.body).toBe(403);
    expect(write.json()).toMatchObject({ code: 'origin_mismatch', expectedOrigin: MAIN });
  });

  it('is told the main address only, never the list', async () => {
    for (const res of [
      await newLocation(t, 'http://evil.example', cookie),
      await signIn(t, address, 'http://evil.example'),
    ]) {
      expect(res.body).toContain(MAIN);
      expect(res.body).not.toContain('kept-ts');
      expect(res.body).not.toContain('100.64.0.7');
    }
  });

  it('gets no more from a `Host` or forwarded header that names a listed address', async () => {
    const write = await newLocation(t, 'http://evil.example', cookie);
    expect(write.statusCode).toBe(403);
    const forged = await send(t, '/api/v1/locations', {
      origin: 'http://evil.example',
      cookie,
      headers: {
        host: 'kept-ts.lan:8080',
        'x-forwarded-host': 'kept-ts.lan:8080',
        'x-forwarded-proto': 'http',
        forwarded: 'host=kept-ts.lan:8080;proto=http',
        referer: `${EXTRA}/`,
        'idempotency-key': randomUUID(),
      },
      body: LOCATION(),
    });
    expect(forged.statusCode).toBe(403);
    expect(forged.json()).toMatchObject({ code: 'origin_mismatch', expectedOrigin: MAIN });
  });

  it('a client can’t name its own origin to Better Auth, in app mode or out of it', async () => {
    const res = await send(t, `${AUTH_BASE_PATH}/sign-in/email`, {
      origin: 'http://evil.example',
      headers: { 'x-kept-ingress-origin': 'http://evil.example' },
      body: { email: address, password: PASSWORD },
    });
    expect(res.statusCode, res.body).toBe(403);
    expect(res.json()).toMatchObject({ code: 'origin_mismatch' });
  });

  it('a Referer on a listed address is no Origin', async () => {
    const res = await send(t, '/api/v1/locations', {
      cookie,
      headers: { referer: `${EXTRA}/things`, 'idempotency-key': randomUUID() },
      body: LOCATION(),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: 'forbidden' });
  });
});

describe('what stays as it is on an extra address', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await testApp(db, onLocalList);
  });
  afterAll(async () => {
    await t.app.close();
  });

  it('secrets stay refused over plain http', async () => {
    const { cookie } = await account(t);
    const made = await newLocation(t, EXTRA, cookie);
    expect(made.statusCode, made.body).toBe(201);
    const res = await send(t, '/api/v1/tokens', {
      origin: EXTRA,
      cookie,
      body: { name: 'x', scope: 'read', locationIds: [made.json().id] },
    });
    expect(res.statusCode, res.body).toBe(403);
    expect(res.json()).toMatchObject({ code: 'https_required' });
  });

  it('a sensitive change still needs the password', async () => {
    const { cookie } = await account(t);
    const res = await send(t, '/api/v1/me/email-change', {
      origin: EXTRA,
      cookie,
      body: { newEmail: email('new') },
    });
    expect(res.statusCode, res.body).toBe(403);
    expect(res.json()).toMatchObject({ code: 'reauth_required', reauth: 'password' });
  });

  it('the headers name no address: no CORS, and the same policy whichever Host asks', async () => {
    const answers = await Promise.all(
      ['kept.lan:8080', 'kept-ts.lan:8080', 'evil.example'].map((host) =>
        send(t, '/api/v1/setup', { origin: EXTRA, headers: { host } }),
      ),
    );
    for (const res of answers) {
      expect(res.headers).not.toHaveProperty('access-control-allow-origin');
      expect(res.headers).not.toHaveProperty('access-control-allow-credentials');
      expect(String(res.headers['content-security-policy'])).toContain("default-src 'self'");
      expect(String(res.headers['content-security-policy'])).not.toContain('kept');
      expect(res.headers['content-security-policy']).toBe(
        answers[0]?.headers['content-security-policy'],
      );
      // Plain http: no HSTS on any address.
      expect(res.headers).not.toHaveProperty('strict-transport-security');
    }
  });

  it('over https, every address gets HSTS and __Secure- cookies, as the main one', async () => {
    const https = await testApp(db, {
      publicUrl: HTTPS_MAIN,
      extraAddresses: [HTTPS_EXTRA],
      authOriginCheck: true,
    });
    const { address } = await account(https);
    const res = await signIn(https, address, HTTPS_EXTRA);
    expect(res.statusCode, res.body).toBe(200);
    expect(String(res.headers['strict-transport-security'])).toContain('max-age=31536000');
    const line = setCookies(res).find((c) => c.includes('session_token='));
    expect(line).toMatch(/^__Secure-/);
    expect(line).toMatch(/;\s*Secure/i);
    await https.app.close();
  });
});

describe('with no KEPT_EXTRA_ADDRESSES', () => {
  it('an extra address is refused as it always was, and nothing new is said', async () => {
    const t = await testApp(db, { publicUrl: MAIN, authOriginCheck: true });
    const { address, cookie } = await account(t);
    const write = await newLocation(t, EXTRA, cookie);
    expect(write.statusCode).toBe(403);
    expect(write.json()).toMatchObject({ code: 'origin_mismatch', expectedOrigin: MAIN });
    const res = await signIn(t, address, EXTRA);
    expect(res.statusCode).toBe(403);
    expect((await send(t, '/api/v1/setup')).json()).not.toHaveProperty('mainAddress');
    await t.app.close();
  });
});

describe('what a page needs to know', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await testApp(db, onLocalList);
  });
  afterAll(async () => {
    await t.app.close();
  });

  it('GET /api/v1/setup names the main address, never the list', async () => {
    const res = await send(t, '/api/v1/setup');
    expect(res.json().mainAddress).toBe(MAIN);
    expect(res.body).not.toContain('kept-ts');
    expect(res.body).not.toContain('100.64.0.7');
  });

  it('Admin → Status shows the addresses in force, to an instance admin only', async () => {
    const admin = await account(t, 'admin');
    await ownerTx(db, (c) =>
      c.query('INSERT INTO public.instance_admins (user_id) VALUES ($1)', [admin.userId]),
    );
    const res = await send(t, '/api/v1/admin/status', { cookie: admin.cookie });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().addresses).toEqual({ main: MAIN, extra: [EXTRA, EXTRA_IP] });
    const member = await account(t, 'member');
    const refused = await send(t, '/api/v1/admin/status', { cookie: member.cookie });
    expect(refused.statusCode).toBe(403);
    expect(refused.body).not.toContain('kept-ts');
    const anonymous = await send(t, '/api/v1/admin/status');
    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.body).not.toContain('kept-ts');
  });

  it('with none set, Status says so', async () => {
    const plain = await testApp(db, { publicUrl: MAIN });
    const admin = await account(plain, 'plain');
    await ownerTx(db, (c) =>
      c.query('INSERT INTO public.instance_admins (user_id) VALUES ($1)', [admin.userId]),
    );
    const res = await send(plain, '/api/v1/admin/status', { cookie: admin.cookie });
    expect(res.json().addresses).toEqual({ main: MAIN, extra: [] });
    await plain.app.close();
  });

  it('the page is the same on every address: no list in it, nothing taken from Host', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'kept-extra-addresses-'));
    await mkdir(path.join(dir, 'assets'));
    await writeFile(
      path.join(dir, 'index.html'),
      '<!doctype html><html><head><base href="/" /></head><body></body></html>',
    );
    const withPage = await testApp(db, {
      ...onLocalList,
      web: (await loadWebBundle(dir)) as WebBundle,
    });
    const pages = await Promise.all(
      ['kept.lan:8080', 'kept-ts.lan:8080', 'evil.example'].map((host) =>
        send(withPage, '/signin', { headers: { host, 'x-forwarded-host': host } }),
      ),
    );
    for (const res of pages) {
      expect(res.statusCode).toBe(200);
      expect(res.body).toBe(pages[0]?.body);
      expect(res.body).not.toContain('kept-ts');
      expect(res.body).not.toContain('kept.lan');
    }
    await withPage.app.close();
    await rm(dir, { recursive: true, force: true });
  });
});

describe('links stay on the main address, from whichever address they were asked for', () => {
  let t: TestApp;
  const forgedHost = {
    host: 'kept-ts.lan:8080',
    'x-forwarded-host': 'evil.example',
    'x-forwarded-proto': 'https',
  };
  beforeAll(async () => {
    t = await testApp(db, onLocalList);
  });
  afterAll(async () => {
    await t.app.close();
  });

  it('the email link', async () => {
    const { address } = await account(t);
    await send(t, `${AUTH_BASE_PATH}/sign-in/magic-link`, {
      origin: EXTRA,
      headers: forgedHost,
      body: { email: address },
    });
    const mail = t.auth.mails.at(-1);
    expect(mail?.url.startsWith(`${MAIN}/auth/confirm#token=`), mail?.url).toBe(true);
  });

  it('the password reset link, and the new password then works on the extra address', async () => {
    const { address } = await account(t);
    await send(t, `${AUTH_BASE_PATH}/request-password-reset`, {
      origin: EXTRA,
      headers: forgedHost,
      body: { email: address },
    });
    const mail = t.auth.resets.at(-1);
    expect(mail?.url.startsWith(`${MAIN}/auth/reset#token=`), mail?.url).toBe(true);
    const done = await send(t, `${AUTH_BASE_PATH}/reset-password`, {
      origin: MAIN,
      body: { token: mail?.token, newPassword: 'a new password of his' },
    });
    expect(done.statusCode, done.body).toBe(200);
    const res = await send(t, `${AUTH_BASE_PATH}/sign-in/email`, {
      origin: EXTRA,
      body: { email: address, password: 'a new password of his' },
    });
    expect(res.statusCode, res.body).toBe(200);
  });

  it('an email link signs in where it lands: the session is the main address’s to use', async () => {
    const { userId, address } = await account(t);
    await db.pools.auth.query('DELETE FROM auth.session WHERE user_id = $1', [userId]);
    await send(t, `${AUTH_BASE_PATH}/sign-in/magic-link`, {
      origin: EXTRA,
      body: { email: address },
    });
    const res = await send(t, `${AUTH_BASE_PATH}/magic-link/verify`, {
      origin: MAIN,
      body: { token: t.auth.mails.at(-1)?.token },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toEqual({ mfaRequired: false });
  });

  it('the email change confirmation', async () => {
    const { cookie } = await account(t);
    const before = t.mail.length;
    const changed = await send(t, '/api/v1/me/email-change', {
      origin: EXTRA,
      cookie,
      headers: forgedHost,
      body: { newEmail: email('new'), password: PASSWORD },
    });
    expect(changed.statusCode, changed.body).toBe(202);
    const sent = t.mail.slice(before);
    expect(sent.length).toBeGreaterThan(0);
    const written = JSON.stringify(sent);
    expect(written).not.toContain('kept-ts');
    expect(written).not.toContain('evil.example');
    expect(written).toContain(`${MAIN}/`);
  });

  it('the calendar feed', async () => {
    const { cookie } = await account(t);
    const res = await send(t, '/api/v1/me/calendar-feeds', {
      origin: EXTRA,
      cookie,
      headers: forgedHost,
      body: {},
    });
    expect(res.statusCode, res.body).toBe(201);
    expect(res.json().url.startsWith(`${MAIN}/cal/`), res.json().url).toBe(true);
  });

  it('Better Auth redirects to no address that isn’t listed', async () => {
    const { address } = await account(t);
    const asked = (callbackURL: string) =>
      send(t, `${AUTH_BASE_PATH}/sign-in/magic-link`, {
        origin: EXTRA,
        body: { email: address, callbackURL },
      });
    expect((await asked('/things')).statusCode).toBe(200);
    expect((await asked(`${EXTRA}/things`)).statusCode).toBe(200);
    expect((await asked(`${MAIN}/things`)).statusCode).toBe(200);
    for (const bad of [
      'http://evil.example/',
      'http://kept-ts.lan.example.com:8080/',
      'http://kept-ts.lan:8081/',
      'https://kept-ts.lan:8080/',
      'http://kept-ts.lan:8080@evil.example/',
      '//evil.example/',
    ]) {
      const res = await asked(bad);
      expect(res.statusCode, bad).toBe(403);
    }
  });
});

describe('passkeys and outside sign-ins: the main address only', () => {
  let t: TestApp;
  const rp = { id: new URL(HTTPS_MAIN).hostname, origin: HTTPS_MAIN };

  beforeAll(async () => {
    t = await testApp(db, {
      publicUrl: HTTPS_MAIN,
      extraAddresses: [HTTPS_EXTRA],
      authOriginCheck: true,
    });
  });
  afterAll(async () => {
    await t.app.close();
  });

  /** Fresh enough to add a passkey (`/me/passkeys/confirm`) from the given address. */
  async function confirmed(origin: string) {
    const { userId, cookie } = await account(t, 'passkey');
    const res = await send(t, '/api/v1/me/passkeys/confirm', {
      origin,
      cookie,
      body: { password: PASSWORD },
    });
    return { userId, cookie, res };
  }

  it('the relying party never comes from the request', async () => {
    const { cookie } = await confirmed(HTTPS_MAIN);
    const asked: Record<string, string>[] = [
      {},
      { host: 'kept-ts.example.test' },
      { 'x-forwarded-host': 'kept-ts.example.test', 'x-forwarded-proto': 'https' },
    ];
    for (const headers of asked) {
      const options = await send(t, `${AUTH_BASE_PATH}/passkey/generate-register-options`, {
        cookie,
        headers,
      });
      expect(options.statusCode, options.body).toBe(200);
      expect(options.json().rp.id).toBe('kept.example.test');
      const signIn = await send(t, `${AUTH_BASE_PATH}/passkey/generate-authenticate-options`, {
        headers,
      });
      expect(signIn.json().rpId).toBe('kept.example.test');
    }
  });

  it('a passkey signs in on the main address', async () => {
    const { userId } = await account(t, 'main');
    const key = await registerSoftPasskey(db.pools.auth, userId, rp);
    const options = await send(t, `${AUTH_BASE_PATH}/passkey/generate-authenticate-options`);
    const res = await send(t, `${AUTH_BASE_PATH}/passkey/verify-authentication`, {
      origin: HTTPS_MAIN,
      cookie: jar(options),
      body: { response: key.assert({ challenge: options.json().challenge, userVerified: true }) },
    });
    expect(res.statusCode, res.body).toBe(200);
  });

  it('a passkey sign-in from an extra address is refused, naming the main address', async () => {
    const { userId } = await account(t, 'extra');
    const key = await registerSoftPasskey(db.pools.auth, userId, rp);
    const options = await send(t, `${AUTH_BASE_PATH}/passkey/generate-authenticate-options`);
    const res = await send(t, `${AUTH_BASE_PATH}/passkey/verify-authentication`, {
      origin: HTTPS_EXTRA,
      cookie: jar(options),
      body: { response: key.assert({ challenge: options.json().challenge, userVerified: true }) },
    });
    expect(res.statusCode, res.body).toBe(403);
    expect(res.json()).toMatchObject({ code: 'origin_mismatch', expectedOrigin: HTTPS_MAIN });
    expect(setCookies(res).filter((c) => c.includes('session_token='))).toEqual([]);
  });

  it('a passkey signed for the extra address fails even with the main address’s Origin', async () => {
    const { userId } = await account(t, 'forged');
    const key = await registerSoftPasskey(db.pools.auth, userId, {
      id: rp.id,
      origin: HTTPS_EXTRA,
    });
    const options = await send(t, `${AUTH_BASE_PATH}/passkey/generate-authenticate-options`);
    const res = await send(t, `${AUTH_BASE_PATH}/passkey/verify-authentication`, {
      origin: HTTPS_MAIN,
      cookie: jar(options),
      body: { response: key.assert({ challenge: options.json().challenge, userVerified: true }) },
    });
    expect(res.statusCode, res.body).toBeGreaterThanOrEqual(400);
    expect(setCookies(res).filter((c) => /session_token=[^;]/.test(c))).toEqual([]);
  });

  it('adding a passkey from an extra address is refused at both steps', async () => {
    const refused = await confirmed(HTTPS_EXTRA);
    expect(refused.res.statusCode, refused.res.body).toBe(403);
    expect(refused.res.json()).toMatchObject({
      code: 'origin_mismatch',
      expectedOrigin: HTTPS_MAIN,
    });

    const { userId, cookie, res } = await confirmed(HTTPS_MAIN);
    expect(res.statusCode, res.body).toBe(204);
    const options = await send(t, `${AUTH_BASE_PATH}/passkey/generate-register-options`, {
      cookie,
    });
    const challengeCookie = jar(options, cookie);
    const fromExtra = await send(t, `${AUTH_BASE_PATH}/passkey/verify-registration`, {
      origin: HTTPS_EXTRA,
      cookie: challengeCookie,
      body: { response: softRegistration(options.json().challenge, rp), name: 'phone' },
    });
    expect(fromExtra.statusCode, fromExtra.body).toBe(403);
    expect(fromExtra.json()).toMatchObject({ code: 'origin_mismatch' });
    const { rows } = await db.pools.auth.query('SELECT 1 FROM auth.passkey WHERE user_id = $1', [
      userId,
    ]);
    expect(rows).toEqual([]);
  });

  it('a registration signed for the extra address fails from the main address too', async () => {
    const { userId, cookie, res } = await confirmed(HTTPS_MAIN);
    expect(res.statusCode, res.body).toBe(204);
    const options = await send(t, `${AUTH_BASE_PATH}/passkey/generate-register-options`, {
      cookie,
    });
    const forged = await send(t, `${AUTH_BASE_PATH}/passkey/verify-registration`, {
      origin: HTTPS_MAIN,
      cookie: jar(options, cookie),
      body: {
        response: softRegistration(options.json().challenge, { id: rp.id, origin: HTTPS_EXTRA }),
        name: 'phone',
      },
    });
    expect(forged.statusCode, forged.body).toBeGreaterThanOrEqual(400);
    const { rows } = await db.pools.auth.query('SELECT 1 FROM auth.passkey WHERE user_id = $1', [
      userId,
    ]);
    expect(rows).toEqual([]);
  });

  it.each(['/sign-in/social', '/link-social'])(
    '%s from an extra address is refused, naming the main address',
    async (path) => {
      const { cookie } = await account(t);
      const res = await send(t, `${AUTH_BASE_PATH}${path}`, {
        origin: HTTPS_EXTRA,
        cookie,
        body: { provider: 'google', callbackURL: '/' },
      });
      expect(res.statusCode, res.body).toBe(403);
      expect(res.json()).toMatchObject({ code: 'origin_mismatch', expectedOrigin: HTTPS_MAIN });
    },
  );

  it('what isn’t listed stays refused on these paths as well', async () => {
    const { cookie } = await account(t);
    const res = await send(t, `${AUTH_BASE_PATH}/link-social`, {
      origin: 'https://evil.example',
      cookie,
      body: { provider: 'google', callbackURL: '/' },
    });
    expect(res.statusCode, res.body).toBe(403);
    expect(res.json()).toMatchObject({ code: 'origin_mismatch', expectedOrigin: HTTPS_MAIN });
  });
});

describe('AI apps (MCP, OAuth): the main address only', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await testApp(db, {
      publicUrl: HTTPS_MAIN,
      extraAddresses: [HTTPS_EXTRA],
      authOriginCheck: true,
      oauth: {
        publicUrl: HTTPS_MAIN,
        isMetadataDocumentUrlAllowed: () => false,
        fetchClientMetadataResource: async () => new Response('not found', { status: 404 }),
      },
    });
  });
  afterAll(async () => {
    await t.app.close();
  });

  it('the issuer is the main address, whichever Host asks', async () => {
    for (const host of ['kept.example.test', 'kept-ts.example.test']) {
      const res = await send(t, '/.well-known/oauth-authorization-server/api/v1/auth', {
        headers: { host, 'x-forwarded-host': 'kept-ts.example.test' },
      });
      expect(res.statusCode, res.body).toBe(200);
      expect(res.json().issuer).toBe(`${HTTPS_MAIN}${AUTH_BASE_PATH}`);
      expect(res.body).not.toContain('kept-ts');
    }
  });

  it('consent from an extra address is refused', async () => {
    const { cookie } = await account(t);
    const res = await send(t, '/api/v1/oauth/consent?client_id=x', {
      origin: HTTPS_EXTRA,
      cookie,
      body: { accept: true, scope: 'read', locationIds: [] },
    });
    expect(res.statusCode, res.body).toBe(403);
    expect(res.json()).toMatchObject({ code: 'origin_mismatch', expectedOrigin: HTTPS_MAIN });
  });

  it('/mcp answers on the main address, and refuses an extra one by Origin and by Host', async () => {
    const { cookie } = await account(t);
    const made = await newLocation(t, HTTPS_MAIN, cookie);
    expect(made.statusCode, made.body).toBe(201);
    const token = await send(t, '/api/v1/tokens', {
      origin: HTTPS_MAIN,
      cookie,
      body: { name: 'an AI app', scope: 'read', locationIds: [made.json().id] },
    });
    expect(token.statusCode, token.body).toBe(201);
    const authorization = `Bearer ${token.json().secret}`;
    const mcp = (headers: Record<string, string>, origin?: string) =>
      send(t, '/mcp', {
        ...(origin ? { origin } : {}),
        headers: {
          authorization,
          accept: 'application/json, text/event-stream',
          ...headers,
        },
        body: {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'test', version: '1' },
          },
        },
      });
    const fine = await mcp({ host: 'kept.example.test' }, HTTPS_MAIN);
    expect(fine.statusCode, fine.body).toBe(200);
    const byOrigin = await mcp({ host: 'kept.example.test' }, HTTPS_EXTRA);
    expect(byOrigin.statusCode, byOrigin.body).toBe(403);
    const byHost = await mcp({ host: 'kept-ts.example.test' });
    expect(byHost.statusCode, byHost.body).toBe(403);
  });
});

describe('Admin → Settings: former host names', () => {
  it('won’t take an extra address’s, and the list can’t send one away', async () => {
    const t = await testApp(db, onLocalList);
    const admin = await account(t, 'hosts');
    await ownerTx(db, (c) =>
      c.query('INSERT INTO public.instance_admins (user_id) VALUES ($1)', [admin.userId]),
    );
    const res = await send(t, '/api/v1/admin/settings', {
      method: 'PUT',
      origin: MAIN,
      cookie: admin.cookie,
      body: { formerHostnames: ['kept-ts.lan'] },
    });
    expect(res.statusCode, res.body).toBe(400);
    await ownerTx(db, (c) =>
      c.query(
        `INSERT INTO public.instance_settings (key, value) VALUES ('former_hostnames', '["kept-ts.lan","old.lan"]')
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      ),
    );
    const { forgetFormerHostnames } = await import('../labels/former-hosts.js');
    forgetFormerHostnames();
    const listed = await send(t, '/api/v1/setup', { headers: { host: 'kept-ts.lan:8080' } });
    expect(listed.statusCode).toBe(200);
    const former = await send(t, '/api/v1/setup', { headers: { host: 'old.lan:8080' } });
    expect(former.statusCode).toBe(301);
    expect(former.headers.location).toBe(`${MAIN}/api/v1/setup`);
    await ownerTx(db, (c) =>
      c.query(`DELETE FROM public.instance_settings WHERE key = 'former_hostnames'`),
    );
    forgetFormerHostnames();
    await t.app.close();
  });
});

describe('first-run setup', () => {
  it('runs from a listed address, and not from another', async () => {
    const fresh = await testDb();
    await fresh.reset();
    const t = await testApp(fresh, onLocalList);
    const code = await ensureSetupCode(fresh.pools.system);
    const body = (label: string) => ({
      code,
      email: email(label),
      password: PASSWORD,
      displayName: 'Ibrahim',
    });
    const refused = await send(t, '/api/v1/setup', {
      origin: 'http://kept-ts.lan.example.com:8080',
      body: body('refused'),
    });
    expect(refused.statusCode, refused.body).toBe(403);
    expect(refused.json()).toMatchObject({ code: 'origin_mismatch', expectedOrigin: MAIN });
    const done = await send(t, '/api/v1/setup', { origin: EXTRA, body: body('done') });
    expect(done.statusCode, done.body).toBe(201);
    await t.app.close();
  });
});

describe('Home Assistant ingress and extra addresses together (D273)', () => {
  const TOKEN = 'Xy7_dT9-kLmN0pQrStUvWxYz0123456789abcdEFGH';
  const HA = 'http://homeassistant.local:8123';
  const ingress = {
    'x-ingress-path': `/api/hassio_ingress/${TOKEN}`,
    'x-forwarded-host': 'homeassistant.local:8123',
    'x-forwarded-proto': 'http',
    'x-forwarded-for': '192.0.2.50, 172.30.32.1',
  };
  let t: TestApp;
  let address: string;
  let cookie: string;

  beforeAll(async () => {
    t = await testApp(db, {
      ...onLocalList,
      appMode: true,
      trustedProxies: [HA_SUPERVISOR_ADDRESS],
    });
    ({ address, cookie } = await account(t));
  });
  afterAll(async () => {
    await t.app.close();
  });

  const throughHa = (url: string, opts: Send) =>
    send(t, url, {
      ...opts,
      remoteAddress: HA_SUPERVISOR_ADDRESS,
      headers: { ...ingress, ...opts.headers },
    });

  it('under ingress, Home Assistant’s address still signs in and writes', async () => {
    const res = await throughHa(`${AUTH_BASE_PATH}/sign-in/email`, {
      origin: HA,
      body: { email: address, password: PASSWORD },
    });
    expect(res.statusCode, res.body).toBe(200);
    const made = await throughHa('/api/v1/locations', {
      origin: HA,
      cookie: jar(res),
      headers: { 'idempotency-key': randomUUID() },
      body: LOCATION(),
    });
    expect(made.statusCode, made.body).toBe(201);
  });

  it('under ingress, a write from an extra address is refused: the page there is Home Assistant’s', async () => {
    const made = await throughHa('/api/v1/locations', {
      origin: EXTRA,
      cookie,
      headers: { 'idempotency-key': randomUUID() },
      body: LOCATION(),
    });
    expect(made.statusCode).toBe(403);
    expect(made.json()).toMatchObject({ code: 'origin_mismatch', expectedOrigin: HA });
    expect(made.body).not.toContain('kept-ts');
  });

  it('on the port, an extra address and the main one work, and Home Assistant’s doesn’t', async () => {
    for (const origin of [MAIN, EXTRA, EXTRA_IP]) {
      const res = await signIn(t, address, origin);
      expect(res.statusCode, `${origin} ${res.body}`).toBe(200);
      const made = await newLocation(t, origin, jar(res));
      expect(made.statusCode, `${origin} ${made.body}`).toBe(201);
    }
    const refused = await newLocation(t, HA, cookie);
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({ code: 'origin_mismatch', expectedOrigin: MAIN });
    const signInRefused = await signIn(t, address, HA);
    expect(signInRefused.statusCode).toBe(403);
  });

  it('a forged ingress from elsewhere gets nothing: extras don’t widen it', async () => {
    const forged = await send(t, `${AUTH_BASE_PATH}/sign-in/email`, {
      origin: 'http://evil.example',
      headers: {
        ...ingress,
        'x-forwarded-host': 'evil.example',
        'x-kept-ingress-origin': 'http://evil.example',
      },
      body: { email: address, password: PASSWORD },
    });
    expect(forged.statusCode).toBe(403);
  });

  it('setup status names no main address under ingress, where the page has it already', async () => {
    const res = await throughHa('/api/v1/setup', {});
    expect(res.json()).not.toHaveProperty('mainAddress');
    expect((await send(t, '/api/v1/setup')).json().mainAddress).toBe(MAIN);
  });
});
