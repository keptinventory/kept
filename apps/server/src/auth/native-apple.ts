import { createHash } from 'node:crypto';
import { createRemoteJWKSet, errors, type JWTVerifyGetKey, jwtVerify } from 'jose';
import { z } from 'zod';
import { AppError, unauthenticated } from '../http/errors.js';

export const APPLE_PROVIDER = 'apple';
export const IPHONE_BUNDLE_ID = 'info.keptinventory.nfc';
const issuer = 'https://appleid.apple.com';
const appleKeys = createRemoteJWKSet(new URL('/auth/keys', issuer), { timeoutDuration: 5_000 });

export const digest = (value: string) => createHash('sha256').update(value).digest('base64url');
export const appleNonce = (origin: string, challenge: string) =>
  digest(`kept-native-apple-v1\n${origin}\n${challenge}`);

export type AppleIdentity = { subject: string; email: string | null };

export async function verifyNativeApple(
  token: string,
  nonce: string,
  keys: JWTVerifyGetKey = appleKeys,
): Promise<AppleIdentity> {
  let claims: Awaited<ReturnType<typeof jwtVerify>>['payload'];
  try {
    ({ payload: claims } = await jwtVerify(token, keys, {
      issuer,
      audience: IPHONE_BUNDLE_ID,
      algorithms: ['RS256'],
      requiredClaims: ['sub', 'exp', 'iat', 'nonce'],
      maxTokenAge: '5 minutes',
      clockTolerance: 15,
    }));
  } catch (error) {
    if (
      error instanceof errors.JWKSTimeout ||
      error instanceof errors.JWKSInvalid ||
      !(error instanceof errors.JOSEError)
    ) {
      throw new AppError('internal', 503, 'Kept could not reach Apple. Try again.');
    }
    throw unauthenticated();
  }
  if (
    claims.aud !== IPHONE_BUNDLE_ID ||
    !claims.sub ||
    claims.sub.length > 255 ||
    claims.nonce !== nonce
  ) {
    throw unauthenticated();
  }
  const email = z.email().max(254).safeParse(claims.email);
  const verified = claims.email_verified === true || claims.email_verified === 'true';
  return { subject: claims.sub, email: verified && email.success ? email.data : null };
}
