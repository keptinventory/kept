import { randomBytes } from 'node:crypto';
import type { LightMyRequestResponse } from 'fastify';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { expect } from 'vitest';
import { appleNonce, digest, IPHONE_BUNDLE_ID } from '../src/auth/native-apple.js';
import { jar, type TestApp } from './app.js';
import { call } from './people.js';

// Only Apple's signing key is replaced. App routes verify real RS256 JWTs and use real Kept sessions.
const { privateKey, publicKey } = await generateKeyPair('RS256');
export const nativeAppleKeys = createLocalJWKSet({
  keys: [{ ...(await exportJWK(publicKey)), kid: 'test-apple' }],
});

export async function appleProof(
  origin: string,
  subject: string,
  options: { issuer?: string; audience?: string; nonce?: string; expiresAt?: number } = {},
) {
  const verifier = randomBytes(32).toString('base64url');
  const state = randomBytes(32).toString('base64url');
  const challenge = digest(verifier);
  const identityToken = await new SignJWT({
    nonce: options.nonce ?? appleNonce(origin, challenge),
    email: 'relay@privaterelay.appleid.com',
    email_verified: 'true',
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-apple' })
    .setIssuer(options.issuer ?? 'https://appleid.apple.com')
    .setAudience(options.audience ?? IPHONE_BUNDLE_ID)
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime(options.expiresAt ?? '5m')
    .sign(privateKey);
  return { verifier, state, identityToken };
}

export async function appleTicket(t: TestApp, subject: string) {
  const input = await appleProof(t.publicUrl, subject);
  const result = await call(t, '/api/v1/native/apple', { body: input });
  expect(result.statusCode, result.body).toBe(200);
  const { appleToken } = result.json<{ appleToken: string }>();
  return {
    ...input,
    url: `/native/connect?${new URLSearchParams({ appleToken })}`,
    form: new URLSearchParams({ appleToken, confirmLink: 'yes' }).toString(),
  };
}

export function approveApple(
  t: TestApp,
  form: string,
  cookie?: string,
  origin = t.publicUrl,
): Promise<LightMyRequestResponse> {
  return t.app.inject({
    method: 'POST',
    url: '/native/connect',
    headers: {
      origin,
      ...(cookie ? { cookie } : {}),
      'content-type': 'application/x-www-form-urlencoded',
    },
    payload: form,
  });
}

export async function connectNativeApple(t: TestApp, user: { cookie: string; userId: string }) {
  const ticket = await appleTicket(t, user.userId);
  const approval = await approveApple(t, ticket.form, user.cookie);
  expect(approval.statusCode, approval.body).toBe(303);
  const code = new URL(String(approval.headers.location)).searchParams.get('code');
  const exchanged = await call(t, '/api/v1/native/exchange', {
    body: { code, verifier: ticket.verifier },
  });
  expect(exchanged.statusCode, exchanged.body).toBe(200);
  return { ...exchanged.json<{ account: string; epoch: string }>(), cookie: jar(exchanged) };
}
