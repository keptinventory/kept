import { randomBytes } from 'node:crypto';
import {
  bearerAuthChallengeResponse,
  getOAuthProtectedResourceMetadataUrl,
  hostHeaderValidationResponse,
  originValidationResponse,
  verifyBearerToken,
} from '@modelcontextprotocol/server';
import type { FastifyRequest } from 'fastify';
import type pg from 'pg';
import type { KeptApp } from '../http/app.js';
import type { InventoryDeps } from '../http/routes.js';
import { readFormerHostnames } from '../labels/former-hosts.js';
import { hasOAuthProvider, oauthAccessVerifier } from '../oauth/verify.js';
import { semanticPrep } from '../search/semantic.js';
import { mcpVerifier, type OAuthAccessVerifier } from './auth.js';
import { MCP_BODY_LIMIT, mcpHandler } from './server.js';

// POST /mcp: the MCP endpoint (D63, D128), mounted by hand:
// a web Request built from Fastify's, the SDK's
// handler.fetch(), and its Response sent through Fastify's own reply (so helmet, the request
// log and x-request-id still apply). GET and DELETE answer 405: stateless (D63). `/mcp` never
// gets the SPA (http/web.ts).
//
// In front of the handler, in order:
// 1. Host: the public URL's host, or a former one; Origin: none (a non-browser client)
//    or Kept's own (no other site's page may drive it). Both 403 with a JSON-RPC body.
// 2. The bearer token (mcp/auth.ts): a personal token, or an OAuth access token when T12's
//    connectors are on; a failure is 401 with `WWW-Authenticate: Bearer`, carrying
//    `resource_metadata` when OAuth is on so a client can find the authorization server.
//    `expectedResource`: the verifier reports each token's audience in `AuthInfo.resource`, and
//    the SDK refuses one that isn't `<public URL>/mcp`.
// The route itself is `auth: 'none'` (no session lookup, no CSRF for a bearer): the token is the
// only credential. Each tool call is limited and audited per token (mcp/server.ts).
//
// The route catalogue allowlists it ("MCP endpoint; each tool call audits itself").

const HOSTS_CACHE_MS = 30_000;

/** The public URL's host and the former ones (read as kept_system, cached briefly). */
function allowedHosts(system: pg.Pool, publicUrl: string) {
  const own = new URL(publicUrl).hostname.toLowerCase();
  let cache: { at: number; hosts: string[] } | null = null;
  return async (): Promise<string[]> => {
    if (cache && Date.now() - cache.at < HOSTS_CACHE_MS) return cache.hosts;
    const former = await readFormerHostnames(system).catch((): string[] => []);
    cache = { at: Date.now(), hosts: [own, ...former] };
    return cache.hosts;
  };
}

/** A web Request for the SDK, from Fastify's (already parsed) request. */
function webRequest(req: FastifyRequest, publicUrl: string): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined || name === 'content-length' || name === 'transfer-encoding') continue;
    for (const one of Array.isArray(value) ? value : [value]) headers.append(name, one);
  }
  const url = new URL(req.url, new URL(publicUrl).origin);
  const body =
    req.method === 'POST' && req.body !== undefined
      ? typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body)
      : null;
  return new Request(url, { method: req.method, headers, body });
}

/** A 403 for a request whose `Origin` isn't exactly the public URL's origin (scheme, host and
 * port); the SDK's own check below compares the host name only. No Origin header passes. */
function foreignOriginResponse(request: Request, publicOrigin: string): Response | undefined {
  const origin = request.headers.get('origin');
  if (origin === null) return undefined;
  let same = false;
  try {
    same = new URL(origin).origin === publicOrigin;
  } catch {
    same = false;
  }
  if (same) return undefined;
  return Response.json(
    { jsonrpc: '2.0', error: { code: -32000, message: 'Origin not allowed' }, id: null },
    { status: 403 },
  );
}

export async function mcpRoutes(app: KeptApp, deps: InventoryDeps): Promise<void> {
  const { pools } = deps;
  const publicUrl = deps.env.KEPT_PUBLIC_URL.replace(/\/+$/, '');
  const resource = new URL(`${publicUrl}/mcp`);
  const key = deps.tokenKey ?? randomBytes(32);
  const hosts = allowedHosts(pools.system, publicUrl);
  const origins = [new URL(publicUrl).hostname.toLowerCase()];
  const publicOrigin = new URL(publicUrl).origin;
  // OAuth access tokens, when the connectors are on (an https public URL and Better Auth).
  const oauth: OAuthAccessVerifier | null = hasOAuthProvider(deps.auth)
    ? oauthAccessVerifier({ auth: deps.auth, pool: pools.app, publicUrl })
    : null;
  const verifier = mcpVerifier({ pool: pools.app, key, resource, oauth });
  const resourceMetadataUrl = oauth ? getOAuthProtectedResourceMetadataUrl(resource) : undefined;
  const handler = mcpHandler(
    {
      pool: pools.app,
      tools: {
        pools,
        jobs: deps.jobs,
        files: deps.files,
        baseUrl: publicUrl,
        log: deps.log,
        // search_things and where_is search by meaning too, paid by the location's payer.
        semantic: semanticPrep({ pools, ai: deps.ai, log: deps.log }),
      },
    },
    (err) => deps.log.warn({ err: { name: err.name, message: err.message } }, 'mcp refused'),
  );
  app.addHook('onClose', () => handler.close());

  app.post(
    '/mcp',
    { config: { auth: 'none' }, bodyLimit: MCP_BODY_LIMIT, schema: { hide: true } },
    async (req, reply) => {
      const request = webRequest(req, publicUrl);
      const refused =
        hostHeaderValidationResponse(request, await hosts()) ??
        foreignOriginResponse(request, publicOrigin) ??
        originValidationResponse(request, origins);
      if (refused) return reply.send(refused);
      const challenge = resourceMetadataUrl ? { resourceMetadataUrl } : {};
      let authInfo: Awaited<ReturnType<typeof verifyBearerToken>>;
      try {
        authInfo = await verifyBearerToken(req.headers.authorization, {
          verifier,
          expectedResource: resource,
          ...challenge,
        });
      } catch (err) {
        return reply.send(bearerAuthChallengeResponse(err, challenge));
      }
      return reply.send(await handler.fetch(request, { authInfo, parsedBody: req.body }));
    },
  );

  for (const method of ['GET', 'DELETE'] as const) {
    app.route({
      method,
      url: '/mcp',
      config: { auth: 'none' },
      schema: { hide: true },
      handler: async (_req, reply) => reply.code(405).header('allow', 'POST').send(),
    });
  }
}
