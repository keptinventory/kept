import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { jar, type TestApp, testApp } from '../../test/app.js';
import { signUp } from '../../test/auth.js';
import { type TestDb, testDb } from '../../test/db.js';
import { freshIp } from '../../test/people.js';
import { AUTH_BASE_PATH } from './auth.js';

// Security review I4: a cookie-bearing write must come from Kept's own origin. The CORS "simple
// requests" a hostile page can send without a preflight (a text/plain or multipart form POST)
// carry the victim's cookie, so the check can't rely on the body being JSON.

const PASSWORD = 'correct horse battery';
const EVIL = 'https://evil.example';

let db: TestDb;
let t: TestApp;
let cookie: string;

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  // Better Auth's own Origin check as production has it (Better Auth skips it under tests).
  t = await testApp(db, { authOriginCheck: true });
  const email = `csrf-${randomUUID()}@example.com`;
  await signUp(t.auth, email, PASSWORD);
  const res = await t.app.inject({
    method: 'POST',
    url: `${AUTH_BASE_PATH}/sign-in/email`,
    headers: { origin: t.publicUrl },
    remoteAddress: freshIp(),
    payload: { email, password: PASSWORD },
  });
  expect(res.statusCode).toBe(200);
  cookie = jar(res);
});

type Req = {
  method?: 'GET' | 'POST' | 'DELETE';
  url?: string;
  headers?: Record<string, string>;
  payload?: string | object;
  withCookie?: boolean;
};

function send(opts: Req) {
  return t.app.inject({
    method: opts.method ?? 'POST',
    url: opts.url ?? '/api/v1/me/email-change',
    headers: { ...(opts.withCookie === false ? {} : { cookie }), ...opts.headers },
    remoteAddress: freshIp(),
    ...(opts.payload !== undefined ? { payload: opts.payload } : {}),
  });
}

const CSRF_HINT = 'The request did not come from this site.';
const refusedByCsrf = (res: { statusCode: number; json: () => unknown }) =>
  res.statusCode === 403 && (res.json() as { hint?: string }).hint === CSRF_HINT;

describe('CSRF: cookie-bearing writes need our Origin or Sec-Fetch-Site: same-origin', () => {
  it('refuses a JSON write from another origin, naming the address Kept is set up for', async () => {
    const res = await send({ headers: { origin: EVIL }, payload: { newEmail: 'x@example.com' } });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({
      code: 'origin_mismatch',
      hint: CSRF_HINT,
      expectedOrigin: new URL(t.publicUrl).origin,
    });
  });

  it('says which address Kept is set up for when it is opened at another one', async () => {
    const expected = new URL(t.publicUrl).origin;
    const res = await send({
      headers: { origin: 'http://127.0.0.1:9', 'sec-fetch-site': 'same-origin' },
      payload: { newEmail: 'x@example.com' },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json() as { error: string; code: string; expectedOrigin: string };
    expect(body).toMatchObject({ code: 'origin_mismatch', expectedOrigin: expected });
    expect(body.error).toBe(`This Kept is set up for ${expected}.`);
  });

  it('keeps `forbidden` for a cookie-bearing write with no Origin at all', async () => {
    const res = await send({ payload: { newEmail: 'x@example.com' } });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: 'forbidden', hint: CSRF_HINT });
    expect(res.json()).not.toHaveProperty('expectedOrigin');
  });

  it('refuses a text/plain simple request from another origin, and one with no Origin at all', async () => {
    const body = JSON.stringify({ newEmail: 'x@example.com' });
    const cross = await send({
      headers: { origin: EVIL, 'content-type': 'text/plain', 'sec-fetch-site': 'cross-site' },
      payload: body,
    });
    expect(refusedByCsrf(cross)).toBe(true);
    const bare = await send({ headers: { 'content-type': 'text/plain' }, payload: body });
    expect(refusedByCsrf(bare)).toBe(true);
  });

  it('refuses a multipart form posted from another site', async () => {
    const boundary = 'kept-boundary';
    const res = await send({
      headers: {
        origin: EVIL,
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'sec-fetch-site': 'cross-site',
      },
      payload: `--${boundary}\r\nContent-Disposition: form-data; name="newEmail"\r\n\r\nx@example.com\r\n--${boundary}--\r\n`,
    });
    expect(refusedByCsrf(res)).toBe(true);
  });

  it('refuses Origin: null unless the browser says same-origin', async () => {
    const payload = { newEmail: 'x@example.com' };
    const cross = await send({
      headers: { origin: 'null', 'sec-fetch-site': 'cross-site' },
      payload,
    });
    expect(refusedByCsrf(cross)).toBe(true);
    const same = await send({
      headers: { origin: 'null', 'sec-fetch-site': 'same-origin' },
      payload,
    });
    expect(refusedByCsrf(same)).toBe(false);
  });

  it('lets our own origin through to the route, whatever the body type', async () => {
    const json = await send({
      headers: { origin: t.publicUrl },
      payload: { newEmail: 'x@example.com' },
    });
    // The route's own answer (re-authentication), not the CSRF refusal.
    expect(json.json()).toMatchObject({ code: 'reauth_required' });
    const multipart = await send({
      headers: {
        origin: t.publicUrl,
        'content-type': 'multipart/form-data; boundary=b',
      },
      payload: '--b--\r\n',
    });
    expect(multipart.statusCode).toBe(415);
    const sameSiteNoOrigin = await send({
      headers: { 'sec-fetch-site': 'same-origin' },
      payload: { newEmail: 'x@example.com' },
    });
    expect(sameSiteNoOrigin.json()).toMatchObject({ code: 'reauth_required' });
  });

  it('covers the Better Auth mount the same way', async () => {
    const res = await send({
      url: `${AUTH_BASE_PATH}/sign-out`,
      headers: { origin: EVIL, 'content-type': 'text/plain' },
      payload: '{}',
    });
    expect(refusedByCsrf(res)).toBe(true);
    // Still signed in.
    const me = await send({ method: 'GET', url: '/api/v1/me/sessions' });
    expect(me.statusCode).toBe(200);
  });

  it('leaves reads, and writes that carry no cookie, to the route', async () => {
    const read = await send({
      method: 'GET',
      url: '/api/v1/me/sessions',
      headers: { origin: EVIL },
    });
    expect(read.statusCode).toBe(200);
    const anonymous = await send({
      url: '/api/v1/auth/sign-up',
      withCookie: false,
      headers: { origin: EVIL },
      payload: { email: 'a@example.com', password: PASSWORD, displayName: 'A' },
    });
    expect(refusedByCsrf(anonymous)).toBe(false);
  });
});

describe("Better Auth's own origin check", () => {
  // Sign-in has no cookie yet, so Kept's hook leaves it to Better Auth, which refuses an Origin
  // other than the public URL's with INVALID_ORIGIN; the mount answers that as Kept's code.
  const signIn = (origin: string) =>
    t.app.inject({
      method: 'POST',
      url: `${AUTH_BASE_PATH}/sign-in/email`,
      headers: {
        origin,
        'sec-fetch-site': 'cross-site',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
      },
      remoteAddress: freshIp(),
      payload: { email: 'nobody@example.com', password: PASSWORD },
    });

  it('is answered as origin_mismatch with the address Kept is set up for', async () => {
    const res = await signIn('http://127.0.0.1:9');
    expect(res.statusCode).toBe(403);
    const expected = new URL(t.publicUrl).origin;
    expect(res.json()).toEqual({
      error: `This Kept is set up for ${expected}.`,
      code: 'origin_mismatch',
      hint: CSRF_HINT,
      expectedOrigin: expected,
    });
  });

  it('leaves a sign-in from our own origin alone', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: `${AUTH_BASE_PATH}/sign-in/email`,
      headers: { origin: t.publicUrl, 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors' },
      remoteAddress: freshIp(),
      payload: { email: 'nobody@example.com', password: PASSWORD },
    });
    expect(res.statusCode).toBe(401);
    expect((res.json() as { code: string }).code).toBe('INVALID_EMAIL_OR_PASSWORD');
  });
});
