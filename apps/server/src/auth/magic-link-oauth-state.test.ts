import { randomUUID } from 'node:crypto';
import type { LightMyRequestResponse } from 'fastify';
import { beforeEach, describe, expect, it } from 'vitest';
import { fragmentToken, jar, type TestApp, testApp } from '../../test/app.js';
import { signUp } from '../../test/auth.js';
import { type TestDb, testDb } from '../../test/db.js';
import { AUTH_BASE_PATH, hashVerificationIdentifier } from './auth.js';
import { GOOGLE_PROVIDER_ID } from './google.js';

// GHSA-965c-763c-88jm (critical, better-auth >= 1.4.0-beta.18 < 1.7.7): an OAuth sign-in's
// `state` could be spent as a magic-link token. Kept met every condition: magic links stored
// hashed, a global identifier hasher (hashVerificationIdentifier), Google or OIDC on, and the
// state kept in auth.verification. Both rows were stored under SHA-256 of an unprefixed value,
// and the lookup's plain-identifier fallback let the magic-link hash of the state find the state's
// row. The state's value carries the caller's `additionalData`, so an `email` there named whose
// account the "magic link" signed in. Better Auth 1.7.7 prefixes both identifiers
// (`magic-link:`, `auth-state:`) and checks the record's type; Kept's hasher keeps the part up to
// the first `:` readable, so the two flows can't meet under it either.

const PASSWORD = 'correct horse battery';
const GOOGLE = {
  clientId: '1234.apps.googleusercontent.com',
  clientSecret: 'google-secret',
  invites: { find: async () => null },
};

let db: TestDb;
let t: TestApp;

const email = (label: string) => `${label}-${randomUUID()}@example.com`;

function post(path: string, body: unknown, cookie = ''): Promise<LightMyRequestResponse> {
  const headers: Record<string, string> = { origin: t.publicUrl };
  if (cookie) headers.cookie = cookie;
  return t.app.inject({
    method: 'POST',
    url: `${AUTH_BASE_PATH}${path}`,
    headers,
    remoteAddress: `198.51.100.${Math.floor(Math.random() * 250) + 1}`,
    payload: body as object,
  });
}

/** The attacker's half: a Google sign-in started with the victim's address in `additionalData`,
 * stopped before Google. The authorisation URL hands back the plain state. */
async function startGoogle(additionalData: Record<string, unknown>): Promise<string> {
  const res = await post('/sign-in/social', {
    provider: GOOGLE_PROVIDER_ID,
    callbackURL: '/',
    additionalData,
  });
  expect(res.statusCode).toBe(200);
  const { url } = res.json() as { url: string };
  const state = new URL(url).searchParams.get('state');
  expect(state).toBeTruthy();
  return state as string;
}

const sessions = (userId: string) =>
  db.pools.auth
    .query('SELECT id FROM auth.session WHERE user_id = $1', [userId])
    .then((r) => r.rows.length);

beforeEach(async () => {
  db = await testDb();
  await db.reset();
  t = await testApp(db, { google: GOOGLE as never });
});

describe('an OAuth state is never a magic link (GHSA-965c-763c-88jm)', () => {
  it('refuses a Google state presented as a magic-link token, and signs no one in', async () => {
    const victim = email('victim');
    const { userId } = await signUp(t.auth, victim, PASSWORD);
    await db.pools.auth.query('UPDATE auth."user" SET email_verified = true WHERE id = $1', [
      userId,
    ]);
    await db.pools.auth.query('DELETE FROM auth.session WHERE user_id = $1', [userId]);

    const state = await startGoogle({ email: victim, name: 'Mallory' });
    const res = await post('/magic-link/verify', { token: state });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ code: 'token_invalid' });
    expect(jar(res)).not.toMatch(/session_token/);
    expect(await sessions(userId)).toBe(0);
  });

  // Kept's magic links never sign up (disableSignUp), which refused this case before 1.7.7 too;
  // it stays as a guard for the advisory's other half (a new account marked verified).
  it('refuses it for an address with no account too, and makes no account', async () => {
    const stranger = email('stranger');
    const state = await startGoogle({ email: stranger });
    const res = await post('/magic-link/verify', { token: state });

    expect(res.statusCode).toBe(400);
    const { rows } = await db.pools.auth.query('SELECT 1 FROM auth."user" WHERE email = $1', [
      stranger,
    ]);
    expect(rows).toHaveLength(0);
  });

  it('keeps the two flows apart in auth.verification under Kept’s hasher', async () => {
    const owner = email('owner');
    await signUp(t.auth, owner, PASSWORD);
    expect((await post('/sign-in/magic-link', { email: owner, callbackURL: '/' })).statusCode).toBe(
      200,
    );
    await new Promise((r) => setTimeout(r, 50)); // the mail goes out in the background
    const link = t.auth.mails.at(-1);
    expect(link?.email).toBe(owner);
    const state = await startGoogle({});

    const { rows } = await db.pools.auth.query<{ identifier: string }>(
      'SELECT identifier FROM auth.verification',
    );
    const ids = rows.map((r) => r.identifier);
    const magic = ids.filter((id) => id.startsWith('magic-link:'));
    const oauth = ids.filter((id) => id.startsWith('auth-state:'));
    expect(magic).toHaveLength(1);
    expect(oauth).toHaveLength(1);
    // Hashed, not stored as the plain state (a read of the table can't resume the flow).
    expect(ids.some((id) => id.includes(state))).toBe(false);
    expect(oauth[0]).toBe(await hashVerificationIdentifier(`auth-state:${state}`));

    // The real link still signs its owner in, once.
    const token = fragmentToken(link?.url ?? '');
    const ok = await post('/magic-link/verify', { token });
    expect(ok.statusCode).toBe(200);
    expect((await post('/magic-link/verify', { token })).statusCode).toBe(400);
  });
});
