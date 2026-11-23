import { createHash, randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { jar, type TestApp, testApp } from '../../test/app.js';
import { enrolTotp, type SignedIn, signUp } from '../../test/auth.js';
import { type TestDb, testDb } from '../../test/db.js';
import { ensureAccount } from '../accounts/ensure-account.js';
import { resetNativeSyncEpoch } from './native.js';
import { resolveSession } from './session.js';

const origin = 'https://kept.example.com';
const verifier = randomBytes(32).toString('base64url');
const state = randomBytes(32).toString('base64url');
const challenge = createHash('sha256').update(verifier).digest('base64url');
const form = new URLSearchParams({ challenge, state }).toString();

describe('Kept for iPhone sign-in', () => {
  let db: TestDb;
  let test: TestApp;
  let user: SignedIn;

  beforeEach(async () => {
    db = await testDb();
    await db.reset();
    test = await testApp(db, { publicUrl: origin });
    user = await signUp(test.auth, 'ibrahim@kept.test');
    await ensureAccount(db.pools, user.userId);
  });

  afterEach(async () => {
    await test.app.close();
  });

  function authorize(cookie = user.cookie, from = origin) {
    return test.app.inject({
      method: 'POST',
      url: '/native/connect',
      headers: { origin: from, cookie, 'content-type': 'application/x-www-form-urlencoded' },
      payload: form,
    });
  }

  async function grant(cookie = user.cookie): Promise<string> {
    const response = await authorize(cookie);
    expect(response.statusCode).toBe(303);
    expect(response.headers['cache-control']).toBe('no-store');
    const callback = new URL(String(response.headers.location));
    expect(callback.href.split('?')[0]).toBe('kept-nfc://auth/callback');
    expect(callback.searchParams.get('state')).toBe(state);
    return callback.searchParams.get('code') ?? '';
  }

  function exchange(code: string, proof = verifier) {
    return test.app.inject({
      method: 'POST',
      url: '/api/v1/native/exchange',
      headers: { origin },
      payload: { code, verifier: proof },
    });
  }

  it('requires explicit same-origin approval and an eligible browser session', async () => {
    const url = `/native/connect?${form}`;
    const anonymous = await test.app.inject({ url });
    expect(anonymous.statusCode).toBe(303);
    expect(String(anonymous.headers.location)).toContain('/signin?next=');
    const page = await test.app.inject({ url, headers: { cookie: user.cookie } });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('Continue as ibrahim@kept.test');
    expect((await authorize(user.cookie, 'https://elsewhere.example')).statusCode).toBe(403);
    expect((await authorize('')).statusCode).toBe(401);
  });

  // catalogue: POST /api/v1/native/exchange
  it('accepts only the correct verifier and mints one independent live session', async () => {
    const source = await resolveSession(
      test.auth,
      db.pools.auth,
      new Headers({ cookie: user.cookie }),
    );
    await db.pools.auth.query(
      "UPDATE auth.session SET created_at = now() - interval '2 days' WHERE id = $1",
      [source.session?.sessionId],
    );
    const code = await grant();
    expect((await exchange(code, randomBytes(32).toString('base64url'))).statusCode).toBe(401);
    const answers = await Promise.all([exchange(code), exchange(code)]);
    expect(answers.map((r) => r.statusCode).sort()).toEqual([200, 401]);
    const response = answers.find((r) => r.statusCode === 200);
    if (!response) throw new Error('Missing native session response');
    const cookie = jar(response);
    expect(cookie).not.toBe(user.cookie);
    const native = await resolveSession(test.auth, db.pools.auth, new Headers({ cookie }));
    expect(native.session?.userId).toBe(user.userId);
    const audit = await db.pools.system.query(
      "SELECT entity_id FROM public.audit_events WHERE action = 'session.native_connected'",
    );
    expect(audit.rows).toEqual([{ entity_id: native.session?.sessionId }]);
    const { rows } = await db.pools.auth.query(
      'SELECT created_at FROM auth.session WHERE id = ANY($1::uuid[])',
      [[native.session?.sessionId, source.session?.sessionId]],
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]?.created_at).toEqual(rows[1]?.created_at);
  });

  it('binds grants to the live source session and carries proven MFA', async () => {
    const enrolled = await enrolTotp(test.auth, user, 'correct horse battery');
    expect((await authorize(user.cookie)).statusCode).toBe(401);
    const code = await grant(enrolled.cookie);
    const response = await exchange(code);
    expect(response.statusCode).toBe(200);
    const native = await resolveSession(
      test.auth,
      db.pools.auth,
      new Headers({ cookie: jar(response) }),
    );
    expect(native.session).toMatchObject({ userId: user.userId, mfa: true, mfaPending: false });
    const another = await grant(enrolled.cookie);
    await db.pools.auth.query('DELETE FROM auth.session WHERE id <> $1', [
      native.session?.sessionId,
    ]);
    expect((await exchange(another)).statusCode).toBe(401);
  });

  it('rejects a different account and a queue from before a restore', async () => {
    const response = await exchange(await grant());
    expect(response.statusCode).toBe(200);
    const { account, epoch } = response.json<{ account: string; epoch: string }>();
    const headers = {
      cookie: jar(response),
      'x-kept-native-account': account,
      'x-kept-native-epoch': epoch,
    };
    expect((await test.app.inject({ url: '/api/v1/locations', headers })).statusCode).toBe(200);
    const other = await signUp(test.auth, 'alfred@kept.test');
    expect(
      (
        await test.app.inject({
          url: '/api/v1/locations',
          headers: { ...headers, cookie: other.cookie },
        })
      ).statusCode,
    ).toBe(401);
    await resetNativeSyncEpoch(db.pools.auth);
    expect((await test.app.inject({ url: '/api/v1/locations', headers })).statusCode).toBe(409);
  });

  it('negotiates capture for an already authenticated session with the matching context', async () => {
    const response = await exchange(await grant());
    expect(response.statusCode, response.body).toBe(200);
    const { account, epoch } = response.json<{ account: string; epoch: string }>();
    const cookie = jar(response);
    const url = '/api/v1/native/capture-capabilities';
    const headers = { cookie, 'x-kept-native-account': account, 'x-kept-native-epoch': epoch };
    const capability = await test.app.inject({ url, headers });
    expect(capability.statusCode, capability.body).toBe(200);
    expect(capability.headers['cache-control']).toBe('no-store');
    expect(capability.json()).toEqual({
      contractVersion: 1,
      capturePayloadVersions: [2],
      account,
      epoch,
    });
    expect((await test.app.inject({ url, headers: { cookie } })).statusCode).toBe(400);
    const other = await signUp(test.auth, 'alfred@kept.test');
    expect(
      (await test.app.inject({ url, headers: { ...headers, cookie: other.cookie } })).statusCode,
    ).toBe(401);
    await resetNativeSyncEpoch(db.pools.auth);
    const stale = await test.app.inject({ url, headers });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ code: 'conflict', reason: 'restore_epoch_mismatch' });
  });

  it('rejects an expired grant and an expired native session', async () => {
    const expiredGrant = await grant();
    await db.pools.auth.query(
      "UPDATE auth.verification SET expires_at = now() - interval '1 second' WHERE identifier LIKE 'kept-native-grant:%'",
    );
    expect((await exchange(expiredGrant)).statusCode).toBe(401);

    const response = await exchange(await grant());
    expect(response.statusCode).toBe(200);
    const cookie = jar(response);
    const { session } = await resolveSession(test.auth, db.pools.auth, new Headers({ cookie }));
    await db.pools.auth.query(
      "UPDATE auth.session SET expires_at = now() - interval '1 second' WHERE id = $1",
      [session?.sessionId],
    );
    expect((await test.app.inject({ url: '/api/v1/me', headers: { cookie } })).statusCode).toBe(
      401,
    );
  });
});
