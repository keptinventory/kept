import { isAPIError } from 'better-auth/api';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import { auditAccountEvent } from '../accounts/account-audit.js';
import type { Pools } from '../db/pools.js';
import type { Scope } from '../db/scope.js';
import type { KeptApp } from '../http/app.js';
import { AppError, invalid, unauthenticated } from '../http/errors.js';
import { proxiesFor, scopeCookieToIngress } from '../http/ingress.js';
import { AUTH_BASE_PATH, type Auth } from './auth.js';
import { authRequestHeaders, ClientIpError, requestClientIp } from './client-ip.js';
import { INGRESS_ORIGIN_HEADER } from './ingress-origin.js';
import { gateSession, type ResolvedSession, resolveSession } from './session.js';
import { limiterKey, reserveInWindow } from './sign-in-limiter.js';

// Better Auth on Fastify, and the session every Kept route sees (D176, D181).
//
// How a route says who may call it (`config.auth`):
// - 'required' (the default, for every route that doesn't say otherwise; security review M1): a
//   signed-in session whose second factor, if the user enrolled one, was proven in it. Otherwise
//   401 `unauthenticated`, or 403 `mfa_required` for a pending session (the two-factor gate).
// - 'optional': the same session when there is one, else `req.scope` stays null. A pending
//   session counts as none.
// - 'none': no session lookup at all. Each public route says so itself: health, the web bundle
//   and its SPA fallback (the not-found handler), the OpenAPI document, the Better Auth mount,
//   token-holding links such as the magic-link POST, sign-up and setup.
// `config.allowMfaPending: true` lets a pending session
// through a 'required' route with `req.authSession` set but `req.scope` null: for the few routes
// that finish or abandon sign-in.
// An account in its 30 days before deletion (D225) gets 403 `account_deletion_pending` from every
// route except those with `config.allowDeletionPending: true` (/me, keeping the account), which
// get the full scope; an 'optional' route sees no session.
//
// A handler reads `req.scope` ({userId, mfa}) and runs its queries in
// `withScope(app.pools.app, req.scope, …)`; `requireScope(req)` narrows it for TypeScript.
// `req.authSession` carries the rest (session id, 2FA state) for the few routes that need it.

export type AuthMode = 'required' | 'optional' | 'none';

declare module 'fastify' {
  interface FastifyContextConfig {
    /** Who may call this route; see auth/http.ts. Default: 'required'. */
    auth?: AuthMode;
    /** Lets a session still waiting for its second factor reach a 'required' route. */
    allowMfaPending?: boolean;
    /** Lets an account in its grace before deletion (D225) reach this route. */
    allowDeletionPending?: boolean;
  }
  interface FastifyRequest {
    /** The resolved Better Auth session, when the route looked one up; null otherwise. */
    authSession: ResolvedSession | null;
  }
}

/** The route's auth mode: its own `config.auth`, else 'required'. An unmatched URL reaches
 * only the not-found handler (a JSON 404, or the SPA's index.html), so it needs no session. */
export function authMode(req: FastifyRequest): AuthMode {
  if (req.is404) return 'none';
  return req.routeOptions.config.auth ?? 'required';
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** `Authorization: Bearer kpt_…`: a personal token (tokens/verify.ts). */
const PERSONAL_BEARER = /^Bearer\s+kpt_/i;

const NOT_THIS_SITE = 'The request did not come from this site.';

/**
 * 403 `origin_mismatch`: a page at another address than KEPT_PUBLIC_URL's (http://127.0.0.1:8080
 * when Kept is set up for http://kept.lan:8080, say). The body names the address Kept is set up
 * for (`expectedOrigin`), which every label and mail already prints, so the page can say "Open it
 * there" instead of "You don't have permission".
 */
export function originMismatch(expectedOrigin: string): AppError {
  return new AppError(
    'origin_mismatch',
    403,
    NOT_THIS_SITE,
    { expectedOrigin },
    `This Kept is set up for ${expectedOrigin}.`,
  );
}

/**
 * CSRF (security review I4). A write that carries a cookie must come from Kept's own pages:
 * its `Origin` is the origin of KEPT_PUBLIC_URL, or, when the browser sent no usable Origin
 * (absent, or `null`), `Sec-Fetch-Site: same-origin`. Another Origin is 403 `origin_mismatch`
 * (with the expected one); no usable Origin is 403 `forbidden`. Both come before
 * the session is looked up or the body is parsed, on every route: a `text/plain` or multipart
 * form posted from another site (a CORS "simple request", which no preflight stops) never
 * reaches a handler with the victim's cookie.
 *
 * Better Auth's mount runs its own origin check on the same requests (cookie + unsafe method →
 * Origin, or Referer, must be a trusted origin, which is exactly KEPT_PUBLIC_URL's). This hook
 * runs first and is the stricter of the two (no Referer fallback), so the two never disagree in
 * the permissive direction. A request without a cookie has no ambient authority to abuse and is
 * left to the route.
 */
export function csrfHook(publicUrl: string) {
  const publicOrigin = new URL(publicUrl).origin;
  return async function checkRequestOrigin(req: FastifyRequest) {
    if (SAFE_METHODS.has(req.method) || !req.headers.cookie) return;
    // A personal token's request ignores cookies (tokens/verify.ts): no ambient authority to
    // abuse, and another site can't set Authorization without a CORS preflight Kept never answers.
    if (PERSONAL_BEARER.test(String(req.headers.authorization ?? ''))) return;
    assertFromThisSite(req, expectedOrigin(req, publicOrigin));
  };
}

/** The origin a write must come from: Home Assistant's under ingress (D273), else KEPT_PUBLIC_URL's.
 * A cross-site page can't make a request look like ingress: the Supervisor's address is the socket,
 * and Home Assistant's own `ingress_session` cookie is SameSite=Strict. */
export function expectedOrigin(req: FastifyRequest, publicOrigin: string): string {
  return req.ingress ? req.ingress.origin : publicOrigin;
}

/**
 * csrfHook's rule for one request, cookie or not: its `Origin` is `expected` (else 403
 * `origin_mismatch`), or with no usable Origin, `Sec-Fetch-Site: same-origin` (else 403
 * `forbidden`). First-run setup applies it too: it carries no cookie, but it makes the instance
 * admin and signs them in, so it must come from Kept's own setup page (Home Assistant's, through ingress).
 */
export function assertFromThisSite(req: FastifyRequest, expected: string): void {
  const origin = req.headers.origin;
  if (origin && origin !== 'null') {
    if (origin === expected) return;
    throw originMismatch(expected);
  }
  if (req.headers['sec-fetch-site'] === 'same-origin') return;
  throw new AppError('forbidden', 403, NOT_THIS_SITE);
}

/** The scope of a route that required a session. */
export function requireScope(req: FastifyRequest): Scope {
  if (!req.scope) throw unauthenticated();
  return req.scope;
}

/** The request's headers as Better Auth must see them: the client address decided from the
 * socket and KEPT_TRUSTED_PROXIES (auth/client-ip.ts), never from what the client wrote. */
export function authHeaders(req: FastifyRequest, trustedProxies: readonly string[]): Headers {
  try {
    const headers = authRequestHeaders({
      headers: req.headers,
      remoteAddress: req.socket.remoteAddress,
      trustedProxies: proxiesFor(req, trustedProxies),
    });
    // Hop-by-hop and framing headers describe this connection, not the Request we build.
    for (const name of ['host', 'connection', 'content-length', 'transfer-encoding', 'expect']) {
      headers.delete(name);
    }
    headers.delete(INGRESS_ORIGIN_HEADER);
    if (req.ingress) headers.set(INGRESS_ORIGIN_HEADER, req.ingress.origin);
    return headers;
  } catch (err) {
    if (err instanceof ClientIpError) {
      throw invalid('The client address could not be determined.');
    }
    throw err;
  }
}

/** Copies Set-Cookie (each one separately) from a Better Auth response onto the reply. Under
 * ingress each is scoped to the prefix (http/ingress.ts), so the session never reaches the rest of
 * Home Assistant. */
export function forwardCookies(reply: FastifyReply, headers: Headers | null | undefined): void {
  const ingress = reply.request.ingress;
  const set = headers?.getSetCookie() ?? [];
  const cookies = ingress ? set.map((line) => scopeCookieToIngress(line, ingress)) : set;
  if (cookies.length === 0) return;
  const existing = reply.getHeader('set-cookie');
  const before = existing === undefined ? [] : Array.isArray(existing) ? existing : [existing];
  reply.header('set-cookie', [...before.map(String), ...cookies]);
}

export type SessionHookOptions = {
  auth: Auth | null;
  pools: Pick<Pools, 'auth'>;
  trustedProxies: readonly string[];
  /** Runs for every request that got a scope (the cached ensureAccount check). */
  onScope?: (req: FastifyRequest, scope: Scope, headers: Headers) => Promise<void>;
};

/** The onRequest hook that decides `req.scope` and `req.authSession` for every route. */
export function sessionHook(opts: SessionHookOptions) {
  return async function resolveRequestSession(req: FastifyRequest, reply: FastifyReply) {
    const mode = authMode(req);
    if (mode === 'none') return;
    // A personal token already gave the request its scope (tokens/verify.ts bearerHook, which
    // runs first); its cookies, if any, are ignored.
    if (req.token) return;
    let session: ResolvedSession | null = null;
    let headers: Headers | null = null;
    // No cookie, no session: skip the lookup (and its database round trip).
    if (opts.auth && req.headers.cookie) {
      headers = authHeaders(req, opts.trustedProxies);
      const resolved = await resolveSession(opts.auth, opts.pools.auth, headers);
      // A sliding refresh re-issues the cookie (D181: never over plain HTTP).
      forwardCookies(reply, resolved.responseHeaders);
      session = resolved.session;
    }
    req.authSession = session;
    const decision = gateSession(session);
    if (decision.ok) {
      if (session?.deletionPending && !req.routeOptions.config.allowDeletionPending) {
        if (mode === 'optional') return;
        throw new AppError('account_deletion_pending', 403, undefined, {
          purgeAfter: session.deletionPending,
        });
      }
      req.scope = decision.scope;
      if (opts.onScope && headers) await opts.onScope(req, decision.scope, headers);
      return;
    }
    if (mode === 'optional') return;
    if (decision.code === 'mfa_required' && req.routeOptions.config.allowMfaPending) return;
    throw new AppError(decision.code, decision.status);
  };
}

export type AuthRoutesOptions = {
  auth: Auth;
  /** kept_auth for Better Auth's tables; kept_app for the account's audit events. */
  pools: Pick<Pools, 'auth' | 'app'>;
  publicUrl: string;
  trustedProxies: readonly string[];
  /** With OAuth connectors on: ends the grant behind an access token its client revokes
   * (oauth/revoke.ts). The form body, the Authorization header and the request id; true when
   * it did. */
  revokeOAuthAccess?: (
    form: string,
    authorization: string | undefined,
    id: string,
  ) => Promise<boolean>;
};

/** Removes every `token` field, at any depth, from a Better Auth JSON body (security review
 * M6). The session lives in an HttpOnly cookie; a token in a body is one a script on the page
 * could read and carry off. */
export function withoutTokens(body: unknown): unknown {
  if (Array.isArray(body)) return body.map(withoutTokens);
  if (body === null || typeof body !== 'object') return body;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (key === 'token') continue;
    out[key] = withoutTokens(value);
  }
  return out;
}

const TOKEN = z.string().min(1).max(512);

/** The body limit of routes anyone may call without a session (security review M8). */
export const ANONYMOUS_BODY_LIMIT = 16_384;

/** Per client IP, attempts at the routes that redeem a mailed token (security review M5). */
export const TOKEN_ATTEMPTS_PER_IP_PER_HOUR = 30;

/** 429 with the wait in the body and in Retry-After (what the web client reads). */
export function rateLimited(reply: FastifyReply, retryAfter: number): AppError {
  reply.header('retry-after', String(retryAfter));
  return new AppError('rate_limited', 429, undefined, { retryAfter });
}

/**
 * Reserves one token redemption for the request's client IP (security review M5): the
 * magic-link and email-change confirmations. A token is 32 random bytes, so this bounds load
 * and log noise rather than guessing; it is shared across replicas like every Kept limiter.
 */
export async function reserveTokenAttempt(
  authPool: pg.Pool,
  headers: Headers,
  reply: FastifyReply,
): Promise<void> {
  const ip = requestClientIp(headers);
  if (!ip) throw invalid('The client address could not be determined.');
  const decision = await reserveInWindow(
    authPool,
    limiterKey('token-ip', ip),
    TOKEN_ATTEMPTS_PER_IP_PER_HOUR,
    3600,
  );
  if (!decision.allowed) throw rateLimited(reply, decision.retryAfter);
}

const PASSKEY_REGISTER = `${AUTH_BASE_PATH}/passkey/verify-registration`;
const VERIFY_TOTP = `${AUTH_BASE_PATH}/two-factor/verify-totp`;

/** What the browser gets back for a passkey it just added: what Settings lists, never its public
 * key, credential id, counter, transports or owner. */
function passkeyAnswer(body: Record<string, unknown>) {
  const { id, name, createdAt, backedUp, deviceType } = body;
  return { id, name: name ?? null, createdAt: createdAt ?? null, backedUp, deviceType };
}

/** Whether Better Auth refused the request's Origin (`INVALID_ORIGIN`, a 403), read from a copy. */
async function refusedOrigin(res: Response): Promise<boolean> {
  if (res.status !== 403) return false;
  const body = (await res
    .clone()
    .json()
    .catch(() => null)) as { code?: unknown } | null;
  return body?.code === 'INVALID_ORIGIN';
}

/** The OAuth `error` code of a 400 from Better Auth, read from a copy of the response. */
async function oauthErrorOf(res: Response): Promise<unknown> {
  if (res.status !== 400) return null;
  const body = (await res
    .clone()
    .json()
    .catch(() => null)) as { error?: unknown } | null;
  return body?.error ?? null;
}

/** The Better Auth mount at /api/v1/auth/*, and Kept's magic-link confirm. */
export async function authRoutes(app: KeptApp, opts: AuthRoutesOptions): Promise<void> {
  const { auth, trustedProxies, pools } = opts;
  const origin = new URL(opts.publicUrl).origin;

  // OAuth's token, revoke and introspect endpoints take form bodies:
  // inside the mount only, a form body reaches Better Auth as the raw string it was sent as.
  await app.register(async (child) => {
    child.addContentTypeParser(
      'application/x-www-form-urlencoded',
      { parseAs: 'string' },
      (_req, body, done) => done(null, body),
    );
    child.route({
      method: ['GET', 'POST'],
      url: `${AUTH_BASE_PATH}/*`,
      config: { auth: 'none' },
      // Anonymous callers: no reason to accept more than a sign-in form (security review M8).
      bodyLimit: ANONYMOUS_BODY_LIMIT,
      schema: { hide: true },
      handler: async (req, reply) => {
        const headers = authHeaders(req, trustedProxies);
        // Our origin, never the Host header the client sent.
        const url = new URL(req.url, origin);
        const init: RequestInit = { method: req.method, headers };
        if (req.method === 'POST' && req.body !== undefined) {
          init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        }
        // A first code proven in a session whose two-factor is off turns it on: noted before,
        // audited after (Better Auth's own route, so Kept's routes can't log it).
        let turningOn: string | null = null;
        if (url.pathname === VERIFY_TOTP && req.method === 'POST' && req.headers.cookie) {
          const found = await auth.api
            .getSession({ headers, query: { disableRefresh: true } })
            .catch(() => null);
          if (found && found.user.twoFactorEnabled !== true) turningOn = found.user.id;
        }
        const res = await auth.handler(new Request(url, init));
        // Better Auth's own Origin check (a sign-in has no cookie yet, so csrfHook left it):
        // answered as Kept's, naming the address this Kept is set up for (Home Assistant's,
        // under ingress).
        if (await refusedOrigin(res)) throw originMismatch(expectedOrigin(req, origin));
        if (turningOn && res.status === 200) {
          const { rows } = await pools.auth.query<{ on: boolean }>(
            'SELECT coalesce(two_factor_enabled, false) AS on FROM auth."user" WHERE id = $1',
            [turningOn],
          );
          if (rows[0]?.on) {
            await auditAccountEvent(pools.app, turningOn, {
              action: 'two_factor.enable',
              entity: { type: 'user', id: turningOn },
              requestId: req.id,
            });
          }
        }
        // Better Auth stores no JWT access token, so it can't revoke one: it answers
        // `unsupported_token_type`, having authenticated the client. Kept's grant can be ended.
        if (
          opts.revokeOAuthAccess &&
          url.pathname === `${AUTH_BASE_PATH}/oauth2/revoke` &&
          typeof req.body === 'string' &&
          (await oauthErrorOf(res)) === 'unsupported_token_type' &&
          (await opts.revokeOAuthAccess(req.body, req.headers.authorization, req.id))
        ) {
          return reply.code(200).header('cache-control', 'no-store').send();
        }

        reply.code(res.status);
        for (const [name, value] of res.headers) {
          if (name === 'set-cookie' || name === 'content-length') continue;
          reply.header(name, value);
        }
        forwardCookies(reply, res.headers);
        const text = await res.text();
        const json = (res.headers.get('content-type') ?? '').includes('application/json');
        if (!json || !text || res.status >= 300) return reply.send(text || undefined);
        const parsed = JSON.parse(text) as unknown;
        if (url.pathname === PASSKEY_REGISTER && res.status === 200 && parsed) {
          const added = parsed as Record<string, unknown>;
          if (typeof added.userId === 'string' && typeof added.id === 'string') {
            await auditAccountEvent(pools.app, added.userId, {
              action: 'passkey.add',
              entity: { type: 'passkey', id: added.id },
              requestId: req.id,
            });
          }
          return reply.send(JSON.stringify(passkeyAnswer(added)));
        }
        return reply.send(JSON.stringify(withoutTokens(parsed)));
      },
    });
  });

  // D176: the emailed link opens /auth/confirm#token=…, and that page POSTs the token here:
  // Better Auth's own path, taken over for POST. Its GET (which would consume the token) is
  // switched off (DISABLED_AUTH_PATHS) and answers 404 through the mount, so a mail scanner
  // following any link reaches only the web page, which does nothing until the person acts.
  app.post(
    `${AUTH_BASE_PATH}/magic-link/verify`,
    {
      config: { auth: 'none' },
      bodyLimit: ANONYMOUS_BODY_LIMIT,
      schema: {
        body: z.object({ token: TOKEN }),
        response: { 200: z.object({ mfaRequired: z.boolean() }) },
      },
    },
    async (req, reply) => {
      const headers = authHeaders(req, trustedProxies);
      await reserveTokenAttempt(pools.auth, headers, reply);
      const result = await auth.api
        .magicLinkVerify({ query: { token: req.body.token }, headers, returnHeaders: true })
        .catch((err: unknown) => {
          // Unknown, used or expired: Better Auth answers with a redirect carrying the reason.
          if (isAPIError(err)) throw new AppError('token_invalid', 400);
          throw err;
        });
      forwardCookies(reply, result.headers);
      // With two-factor enrolled the new session is pending until TOTP, a backup code or a
      // passkey with user verification is proven in it. Read afresh: a first magic
      // link to an unverified address has just removed any two-factor (D197), after Better Auth
      // built its answer.
      const { id } = result.response.user as { id: string };
      const { rows } = await pools.auth.query<{ tfa: boolean }>(
        'SELECT coalesce(two_factor_enabled, false) AS tfa FROM auth."user" WHERE id = $1',
        [id],
      );
      return { mfaRequired: rows[0]?.tfa === true };
    },
  );
}
