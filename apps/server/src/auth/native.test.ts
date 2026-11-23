import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { jar, type TestApp, testApp } from '../../test/app.js';
import { enrolTotp, nextTotp, type SignedIn, signUp } from '../../test/auth.js';
import { type TestDb, testDb } from '../../test/db.js';
import { appleProof, appleTicket, approveApple, nativeAppleKeys } from '../../test/native-apple.js';
import { call } from '../../test/people.js';
import { ensureAccount } from '../accounts/ensure-account.js';
import { resetNativeSyncEpoch } from './native.js';
import { resolveSession } from './session.js';

const origin = 'https://kept.example.com';
const subject = 'existing-apple-subject';

describe('Kept for iPhone sign-in', () => {
  let db: TestDb;
  let test: TestApp;
  let user: SignedIn;
  let verifier: string;

  beforeEach(async () => {
    db = await testDb();
    await db.reset();
    test = await testApp(db, { publicUrl: origin, nativeAppleKeys });
    user = await signUp(test.auth, 'ibrahim@kept.test');
    await ensureAccount(db.pools, user.userId);
  });

  afterEach(async () => {
    await test.app.close();
  });

  async function grant(cookie = user.cookie): Promise<string> {
    const ticket = await appleTicket(test, subject);
    verifier = ticket.verifier;
    const response = await approveApple(test, ticket.form, cookie);
    expect(response.statusCode, response.body).toBe(303);
    expect(response.headers['cache-control']).toBe('no-store');
    const callback = new URL(String(response.headers.location));
    expect(callback.href.split('?')[0]).toBe('kept-nfc://auth/callback');
    expect(callback.searchParams.get('state')).toBe(ticket.state);
    expect((await approveApple(test, ticket.form, cookie)).statusCode).toBe(401);
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

  // catalogue: POST /native/connect
  it('rejects browser-only native login and requires explicit account linking', async () => {
    const browserOnly = await approveApple(
      test,
      new URLSearchParams({
        challenge: randomBytes(32).toString('base64url'),
        state: randomBytes(32).toString('base64url'),
      }).toString(),
      user.cookie,
    );
    expect(browserOnly.statusCode).toBe(400);

    const ticket = await appleTicket(test, subject);
    const anonymous = await test.app.inject({ url: ticket.url });
    expect(anonymous.statusCode).toBe(200);
    expect(anonymous.body).toContain('Sign in to link your Kept account');
    expect(anonymous.headers['referrer-policy']).toBe('same-origin');
    const page = await test.app.inject({ url: ticket.url, headers: { cookie: user.cookie } });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain(
      'Link Apple Account relay@privaterelay.appleid.com to Kept account ibrahim@kept.test',
    );
    expect(
      (await approveApple(test, ticket.form, user.cookie, 'https://elsewhere.example')).statusCode,
    ).toBe(403);
    expect((await approveApple(test, ticket.form)).statusCode).toBe(401);
    const withoutConsent = new URLSearchParams(ticket.form);
    withoutConsent.delete('confirmLink');
    expect((await approveApple(test, withoutConsent.toString(), user.cookie)).statusCode).toBe(403);
    expect((await approveApple(test, ticket.form, user.cookie)).statusCode).toBe(303);
    const link = await db.pools.auth.query(
      'SELECT user_id, account_id, access_token, refresh_token, id_token FROM auth.account WHERE provider_id = $1',
      ['apple'],
    );
    expect(link.rows).toEqual([
      {
        user_id: user.userId,
        account_id: subject,
        access_token: null,
        refresh_token: null,
        id_token: null,
      },
    ]);
    const audit = await db.pools.system.query(
      "SELECT action FROM public.audit_events WHERE action = 'sign_in.apple_linked'",
    );
    expect(audit.rows).toEqual([{ action: 'sign_in.apple_linked' }]);
  });

  it('rejects invalid Apple claims, mismatched origins, and replayed proof', async () => {
    const path = '/api/v1/native/apple';
    for (const options of [
      { issuer: 'https://other.example' },
      { audience: 'info.keptinventory.other' },
      { nonce: 'wrong' },
      { expiresAt: 1 },
    ]) {
      const proof = await appleProof(origin, subject, options);
      expect((await call(test, path, { body: proof })).statusCode).toBe(401);
    }
    const proof = await appleProof(origin, subject);
    expect(
      (await call(test, path, { body: proof, headers: { origin: 'https://other.example' } }))
        .statusCode,
    ).toBe(403);
    expect((await call(test, path, { body: proof, as: user })).statusCode).toBe(403);
    const responses = await Promise.all([
      call(test, path, { body: proof }),
      call(test, path, { body: proof }),
    ]);
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 401]);
  });

  it('starts a returning Apple sign-in for the linked account even with a different browser user', async () => {
    await grant();
    const other = await signUp(test.auth, 'other@kept.test');
    const ticket = await appleTicket(test, subject);
    const page = await test.app.inject({ url: ticket.url, headers: { cookie: other.cookie } });
    expect(page.body).toContain('Continue with Apple');
    const setup = await approveApple(test, ticket.form, other.cookie);
    expect(setup.statusCode, setup.body).toBe(303);
    expect(setup.headers.location).toBe(ticket.url);
    expect((await approveApple(test, ticket.form)).statusCode).toBe(401);
    const consent = await approveApple(test, ticket.form, jar(setup));
    expect(consent.statusCode, consent.body).toBe(303);
    const code = new URL(String(consent.headers.location)).searchParams.get('code') ?? '';
    const response = await exchange(code, ticket.verifier);
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({ account: user.userId });
    expect((await call(test, '/api/v1/locations', { as: { cookie: jar(setup) } })).statusCode).toBe(
      401,
    );
    expect(
      (await call(test, '/api/v1/locations', { as: { cookie: jar(response) } })).statusCode,
    ).toBe(200);
  });

  it('requires Kept MFA for a returning Apple sign-in and revokes the resulting native session', async () => {
    await grant();
    const enrolled = await enrolTotp(test.auth, user);
    const ticket = await appleTicket(test, subject);
    const kickoff = await approveApple(test, ticket.form);
    expect(kickoff.statusCode, kickoff.body).toBe(303);
    const pending = { cookie: jar(kickoff) };
    const page = await test.app.inject({ url: ticket.url, headers: pending });
    expect(page.headers.location).toMatch(/^\/signin\/two-factor\?next=/);
    expect((await approveApple(test, ticket.form, pending.cookie)).statusCode).toBe(401);
    expect((await call(test, '/api/v1/locations', { as: pending })).statusCode).toBe(403);

    const second = await call(test, '/api/v1/auth/two-factor/verify-totp', {
      as: pending,
      body: { code: await nextTotp(enrolled.secret, user.userId) },
    });
    expect(second.statusCode, second.body).toBe(200);
    const consent = await approveApple(test, ticket.form, jar(second, pending.cookie));
    expect(consent.statusCode, consent.body).toBe(303);
    const code = new URL(String(consent.headers.location)).searchParams.get('code') ?? '';
    const response = await exchange(code, ticket.verifier);
    expect(response.statusCode, response.body).toBe(200);
    const device = { cookie: jar(response) };
    const sessions = await call(test, '/api/v1/me/sessions', { as: device });
    const current = sessions.json().sessions.find((entry: { current: boolean }) => entry.current);
    expect(current).toMatchObject({ userAgent: 'Kept for iPhone', secondFactor: true });
    const revoke = await call(test, `/api/v1/me/sessions/${current.id}`, {
      method: 'DELETE',
      as: enrolled,
    });
    expect(revoke.statusCode, revoke.body).toBe(204);
    expect((await call(test, '/api/v1/locations', { as: device })).statusCode).toBe(401);
  });

  it('revokes native access on unlinking and invalidates previously issued Apple grants', async () => {
    const signedIn = await exchange(await grant());
    expect(signedIn.statusCode, signedIn.body).toBe(200);
    const pending = await grant();
    const { rows } = await db.pools.auth.query<{ id: string }>(
      'SELECT id FROM auth.account WHERE user_id = $1 AND provider_id = $2',
      [user.userId, 'apple'],
    );
    const unlink = await call(test, `/api/v1/me/linked/${rows[0]?.id}`, {
      method: 'DELETE',
      as: user,
      body: { password: 'correct horse battery' },
    });
    expect(unlink.statusCode, unlink.body).toBe(204);
    expect((await exchange(pending)).statusCode).toBe(401);
    expect(
      (await call(test, '/api/v1/locations', { as: { cookie: jar(signedIn) } })).statusCode,
    ).toBe(401);
  });

  // catalogue: POST /api/v1/native/exchange
  it('accepts only the correct verifier and mints one independent live session', async () => {
    await grant(); // Link while the source session is fresh.
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
    expect(
      (await approveApple(test, (await appleTicket(test, subject)).form, user.cookie)).statusCode,
    ).toBe(401);
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
    const code = await grant();
    const ticket = await appleTicket(test, subject);
    await resetNativeSyncEpoch(db.pools.auth);
    expect((await exchange(code)).statusCode).toBe(401);
    expect((await approveApple(test, ticket.form, user.cookie)).statusCode).toBe(401);
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
      capturePayloadVersions: [2, 3],
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
      "UPDATE auth.verification SET expires_at = now() - interval '1 second' WHERE identifier LIKE 'kept-native-apple:grant:%'",
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
