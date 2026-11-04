import { cimd } from '@better-auth/cimd';
import { mcp } from '@better-auth/mcp';
import type { ClientMetadataResourceFetch } from '@better-auth/oauth-provider';
import { OAUTH_SCOPES } from '@kept/shared';
import type { BetterAuthPlugin } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { jwt } from 'better-auth/plugins/jwt';

// Kept as an OAuth 2.1 authorization server for MCP connectors (D93, D125):
// Better Auth's `jwt()`, `mcp()` (which *is* its OAuth provider, bound to the
// `/mcp` resource) and `cimd()` (Client ID Metadata Documents, the MCP 2026-07-28 profile).
//
// - On only with an https public URL (D63, D125: a connector needs one); http is allowed on a
//   loopback host for local development and tests, as the mcp plugin itself allows.
// - Dynamic Client Registration stays off (the MCP spec marks it deprecated). A client that
//   connects only with DCR is the maintainer's decision.
// - Access tokens are JWTs for `<public URL>/mcp`, an hour long. Kept's grant row
//   (api_tokens, kind 'oauth') holds the scope and locations, checked on every call, so revoking
//   in Connections works at once (oauth/verify.ts).
// - Connectors stay signed in (#411): Better Auth issues a refresh token only for `offline_access`,
//   which MCP clients don't ask for (the resource metadata leaves it out, as it should), so
//   `connectorsStaySignedIn()` adds it to a PKCE authorization request for Kept's scopes, and the
//   consent step keeps it (oauth/consent.ts). Better Auth lets every authorization-code client
//   refresh (clientAllowsGrant); revoking in Connections deletes the refresh token
//   (tokens/service.ts forgetOAuthClient), and the grant row is checked on every call either way.
// - The jwt plugin's own session JWT is switched off: no `set-auth-jwt` header, and its `/token`
//   endpoint is in auth.ts's DISABLED_AUTH_PATHS.

export const OAUTH_ACCESS_TOKEN_SECONDS = 3600;

/** The scope a refresh token is issued for (OIDC Core §11; Better Auth's token endpoint). */
export const OFFLINE_ACCESS = 'offline_access';

export type OAuthServerOptions = {
  /** KEPT_PUBLIC_URL. */
  publicUrl: string;
  /** How client metadata is fetched (oauth/cimd-fetch.ts); tests pass an in-memory one. */
  fetchClientMetadataResource: ClientMetadataResourceFetch;
  /** Tests only: which client id URLs may be fetched at all. */
  isMetadataDocumentUrlAllowed?: (url: string) => boolean;
};

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Whether connectors can be offered at this public URL (D125). */
export function oauthAvailable(publicUrl: string): boolean {
  const url = new URL(publicUrl);
  return url.protocol === 'https:' || LOOPBACK.has(url.hostname);
}

/** Whether connectors are on in production: an https public URL only. */
export function oauthOnInProduction(publicUrl: string): boolean {
  return new URL(publicUrl).protocol === 'https:';
}

export const resourceOf = (publicUrl: string) => `${publicUrl.replace(/\/+$/, '')}/mcp`;

export function oauthPlugins(opts: OAuthServerOptions) {
  return [
    jwt({ disableSettingJwtHeader: true }),
    mcp({
      loginPage: '/signin',
      consentPage: '/oauth/consent',
      resource: resourceOf(opts.publicUrl),
      scopes: [OAUTH_SCOPES.read, OAUTH_SCOPES.write, OFFLINE_ACCESS],
      allowDynamicClientRegistration: false,
      allowUnauthenticatedClientRegistration: false,
      accessTokenExpiresIn: OAUTH_ACCESS_TOKEN_SECONDS,
    }),
    connectorsStaySignedIn(),
    cimd({
      fetchClientMetadataResource: opts.fetchClientMetadataResource,
      metadataProfile: 'mcp-2026-07-28',
      ...(opts.isMetadataDocumentUrlAllowed
        ? { isMetadataDocumentUrlAllowed: opts.isMetadataDocumentUrlAllowed }
        : {}),
    }),
  ];
}

/** An authorization request's parameters with `offline_access` added, or null to leave them as
 * they are: only a request for Kept's own scopes, with a PKCE challenge (Better Auth requires one
 * for `offline_access`), that doesn't already ask for it. */
export function withOfflineAccess(
  params: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (!params) return null;
  const { scope, code_challenge: challenge } = params;
  if (typeof scope !== 'string' || typeof challenge !== 'string' || !challenge) return null;
  const scopes = scope.split(' ').filter(Boolean);
  if (scopes.includes(OFFLINE_ACCESS)) return null;
  if (!scopes.some((s) => s === OAUTH_SCOPES.read || s === OAUTH_SCOPES.write)) return null;
  return { ...params, scope: [...scopes, OFFLINE_ACCESS].join(' ') };
}

/** Adds `offline_access` to an authorization request for Kept's scopes (#411), before Better Auth
 * validates and signs it, so the consent page's signed query carries it. */
function connectorsStaySignedIn(): BetterAuthPlugin {
  return {
    id: 'kept-oauth-offline-access',
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === '/oauth2/authorize',
          handler: createAuthMiddleware(async (ctx) => {
            // Better Auth reads a POSTed authorization request from the form, a GET from the query.
            if (ctx.method === 'POST') {
              const body = withOfflineAccess(ctx.body as Record<string, unknown> | undefined);
              return body ? { context: { body } } : undefined;
            }
            const query = withOfflineAccess(ctx.query as Record<string, unknown> | undefined);
            return query ? { context: { query } } : undefined;
          }),
        },
      ],
    },
  };
}

/** Admin → Status's connectors row (D125): the MCP URL, and whether OAuth connectors can be
 * offered (an https public URL) or only personal tokens work. */
export function connectorsStatus(publicUrl: string): {
  mcpUrl: string;
  oauth: 'available' | 'needs_https';
} {
  return {
    mcpUrl: resourceOf(publicUrl),
    oauth: oauthOnInProduction(publicUrl) ? 'available' : 'needs_https',
  };
}
