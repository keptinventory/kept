import type { Auth } from '../auth/auth.js';
import type { Pools } from '../db/pools.js';
import { type Scope, withScope } from '../db/scope.js';
import type { McpExtra } from '../mcp/auth.js';
import { forgetOAuthClient, revokeToken } from '../tokens/service.js';
import { oauthAccessVerifier } from './verify.js';

// RFC 7009 revocation of an OAuth access token at `/api/v1/auth/oauth2/revoke`. Better Auth's
// access tokens are JWTs it doesn't store, so it answers `unsupported_token_type` for one. Kept's
// grant row is what `/mcp` checks on every call (oauth/verify.ts), so a revoked access token ends
// that grant, exactly as revoking the app in Connections does, and the app must ask again.
// Only the client the token was issued to revokes it; Better Auth has already authenticated
// that client by the time it answers `unsupported_token_type`.

/** The client a revocation request names: the form's `client_id`, or HTTP Basic's user. Two
 * that disagree name none. */
function clientOf(form: URLSearchParams, authorization: string | undefined): string | null {
  const named = form.getAll('client_id');
  if (named.length > 1) return null;
  let basic: string | null = null;
  if (authorization && /^basic\s+/i.test(authorization)) {
    const decoded = Buffer.from(authorization.replace(/^basic\s+/i, ''), 'base64').toString();
    const colon = decoded.indexOf(':');
    try {
      basic = decodeURIComponent(colon < 0 ? decoded : decoded.slice(0, colon));
    } catch {
      return null;
    }
  }
  if (basic !== null && named[0] !== undefined && basic !== named[0]) return null;
  return basic ?? named[0] ?? null;
}

export type OAuthRevoker = (
  form: string,
  authorization: string | undefined,
  requestId: string,
) => Promise<boolean>;

/** Ends the grant behind a valid access token its own client revokes; false when the request
 * isn't that (the caller then answers as Better Auth did). */
export function oauthRevoker(opts: {
  auth: Auth;
  pools: Pick<Pools, 'app' | 'auth'>;
  publicUrl: string;
}): OAuthRevoker {
  const verify = oauthAccessVerifier({
    auth: opts.auth,
    pool: opts.pools.app,
    publicUrl: opts.publicUrl,
  });
  return async (raw, authorization, requestId) => {
    const form = new URLSearchParams(raw);
    const tokens = form.getAll('token');
    const client = clientOf(form, authorization);
    if (tokens.length !== 1 || !client) return false;
    const token = (tokens[0] as string).replace(/^bearer\s+/i, '');
    let extra: McpExtra;
    try {
      const info = await verify(token);
      if (info.clientId !== client) return false;
      extra = info.extra as McpExtra;
    } catch {
      return false;
    }
    const scope: Scope = { userId: extra.userId, mfa: false };
    await withScope(opts.pools.app, scope, (tx, c) =>
      revokeToken({ tx, client: c, scope, requestId }, extra.tokenId),
    );
    await forgetOAuthClient(opts.pools.auth, extra.userId, client);
    return true;
  };
}
