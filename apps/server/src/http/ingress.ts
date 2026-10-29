import type { IncomingHttpHeaders } from 'node:http';
import { isIP } from 'node:net';
import type { FastifyReply, FastifyRequest } from 'fastify';

// Home Assistant ingress (D273). Inside Home Assistant, Kept is shown at
// `<Home Assistant>/api/hassio_ingress/<token>/`: the browser talks to Home Assistant, Core passes
// the request to the Supervisor, and the Supervisor to Kept, from 172.30.32.2 only, with the
// prefix stripped and named in X-Ingress-Path. Core passes on the X-Forwarded-Host and -Proto the
// request came with, and sets them from its own request only when there are none
// (homeassistant/components/hassio/ingress.py `_init_header`): behind a proxy in front of Home
// Assistant they are that proxy's, so a TLS-terminating proxy must send `X-Forwarded-Proto: https`
// for Kept to see https. From 2026.10.4 the Supervisor removes any X-Remote-User-* the client
// sent and sets its own (supervisor/api/ingress.py, #7398); setup trusts the groups only then
// (KEPT_HA_TRUST_GROUPS).
//
// One rule decides whether a request came that way, and everything ingress changes keys off it:
// the page's <base href>, framing, the expected Origin, the cookie's Path, no service worker, and
// first-run setup without the code for a Home Assistant administrator. A request is an ingress
// request only when ALL of these hold:
// - app mode is on (KEPT_HA=1, which only the Home Assistant app's image sets);
// - the TCP peer is the Supervisor, 172.30.32.2 (the socket, never a header);
// - X-Ingress-Path is exactly `/api/hassio_ingress/<20–64 URL-safe characters>`;
// - X-Forwarded-Host is one host (name, IPv4 or [IPv6], optional port) and X-Forwarded-Proto is
//   `http` or `https`.
// Anything else is an ordinary request, whatever headers it carries: outside app mode nothing
// here runs at all.

/** The Supervisor's address on Home Assistant's internal network (`hassio`, 172.30.32.0/23). */
export const HA_SUPERVISOR_ADDRESS = '172.30.32.2';

/** Home Assistant Core's address on that network: it appends the client to X-Forwarded-For, and
 * the Supervisor appends Core. Both are the app's KEPT_TRUSTED_PROXIES. */
export const HA_CORE_ADDRESS = '172.30.32.1';

/** Core's administrators group (homeassistant/auth/const.py GROUP_ID_ADMIN); the Supervisor folds
 * owners into it (supervisor/const.py `effective_group_ids`). */
export const HA_ADMIN_GROUP = 'system-admin';

const INGRESS_PATH = /^\/api\/hassio_ingress\/[A-Za-z0-9_-]{20,64}$/;
const HOST_NAME =
  /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/;

export type HomeAssistantUser = {
  id: string;
  name: string | null;
  displayName: string | null;
  groups: string[];
};

export type IngressContext = {
  /** `/api/hassio_ingress/<token>`, no trailing slash. */
  prefix: string;
  /** Home Assistant's origin as the browser sees it: the expected Origin of writes. */
  origin: string;
  /** Home Assistant is served over https (Q4: only then is the request secure). */
  secure: boolean;
  /** Who Home Assistant says is signed in to it; never a Kept user. */
  haUser: HomeAssistantUser | null;
};

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by ingressHook() (app.ts) for an ingress request; null for every other request. */
    ingress: IngressContext | null;
  }
}

export type IngressInput = {
  appMode: boolean;
  remoteAddress: string | undefined;
  headers: IncomingHttpHeaders | Record<string, string | string[] | undefined>;
};

/** One header's value, or null when it is absent, repeated or empty. */
function single(headers: IngressInput['headers'], name: string): string | null {
  const value = headers[name];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function unmapped(ip: string): string {
  const match = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  return match?.[1] ?? ip;
}

/** `host`, `host:port`, `1.2.3.4:port` or `[v6]:port`, lower-cased; null for anything else. */
function forwardedHost(value: string | null): string | null {
  if (!value) return null;
  const match = /^(\[[0-9A-Fa-f:.]+\]|[^:[\]]+)(?::(\d{1,5}))?$/.exec(value);
  if (!match) return null;
  const [, host = '', port] = match;
  if (port !== undefined && Number(port) > 65535) return null;
  const bare = host.startsWith('[') ? host.slice(1, -1) : host;
  const ok = host.startsWith('[') ? isIP(bare) === 6 : isIP(bare) === 4 || HOST_NAME.test(bare);
  if (!ok) return null;
  return `${host.toLowerCase()}${port === undefined ? '' : `:${port}`}`;
}

/** The ingress context of a request, or null when it isn't an ingress request (see above). */
export function readIngress(input: IngressInput): IngressContext | null {
  if (!input.appMode) return null;
  if (!input.remoteAddress || unmapped(input.remoteAddress) !== HA_SUPERVISOR_ADDRESS) return null;
  const prefix = single(input.headers, 'x-ingress-path');
  if (!prefix || !INGRESS_PATH.test(prefix)) return null;
  const host = forwardedHost(single(input.headers, 'x-forwarded-host'));
  const proto = single(input.headers, 'x-forwarded-proto');
  if (!host || (proto !== 'http' && proto !== 'https')) return null;
  const id = single(input.headers, 'x-remote-user-id');
  const haUser = id
    ? {
        id,
        name: single(input.headers, 'x-remote-user-name'),
        displayName: single(input.headers, 'x-remote-user-display-name'),
        groups: (single(input.headers, 'x-remote-user-groups') ?? '')
          .split(',')
          .map((g) => g.trim())
          .filter(Boolean),
      }
    : null;
  return { prefix, origin: `${proto}://${host}`, secure: proto === 'https', haUser };
}

/** Whether the Home Assistant user behind an ingress request is one of its administrators. */
export function isHomeAssistantAdmin(ctx: IngressContext | null): boolean {
  return !!ctx?.haUser && ctx.haUser.groups.includes(HA_ADMIN_GROUP);
}

/** The onRequest hook that sets `req.ingress` (first, so every later hook can read it). */
export function ingressHook(appMode: boolean) {
  return async function readIngressRequest(req: FastifyRequest) {
    req.ingress = readIngress({
      appMode,
      remoteAddress: req.socket.remoteAddress,
      headers: req.headers,
    });
  };
}

/**
 * The onSend hook that lets Home Assistant frame an ingress response. Home Assistant shows an app
 * in an iframe of its own page, whose origin is the ingress URL's (frontend `ha-panel-app.ts`), so
 * `frame-ancestors 'self'` admits exactly that page; every other response keeps `'none'` (D181).
 */
export async function ingressFraming(req: FastifyRequest, reply: FastifyReply, payload: unknown) {
  if (!req.ingress) return payload;
  const csp = reply.getHeader('content-security-policy');
  if (typeof csp === 'string') {
    reply.header(
      'content-security-policy',
      csp.replace(/frame-ancestors 'none'/, "frame-ancestors 'self'"),
    );
  }
  return payload;
}

/**
 * A Set-Cookie line scoped to the ingress prefix: its Path becomes `<prefix>/`, any Domain goes
 * (the cookie stays on Home Assistant's host), and it is Secure when Home Assistant is https. So
 * Kept's session is sent to Kept's own requests only, never to the rest of Home Assistant.
 */
export function scopeCookieToIngress(line: string, ctx: IngressContext): string {
  const [rawPair = '', ...attrs] = line.split(';');
  // Home Assistant on plain http: a Secure cookie, or one named __Secure-/__Host-, never comes back
  // from an http page (Better Auth names and marks them so when KEPT_PUBLIC_URL is https). Plain
  // here; ingressCookieHeader() gives Better Auth its names back on the way in.
  const pair = ctx.secure ? rawPair : rawPair.trim().replace(/^__(?:Secure|Host)-/, '');
  const kept: string[] = [];
  let hasPath = false;
  let hasSecure = false;
  for (const raw of attrs) {
    const attr = raw.trim();
    if (!attr) continue;
    const name = attr.split('=')[0]?.trim().toLowerCase();
    if (name === 'domain') continue;
    if (name === 'path') {
      hasPath = true;
      kept.push(`Path=${ctx.prefix}/`);
      continue;
    }
    if (name === 'secure') {
      if (!ctx.secure) continue;
      hasSecure = true;
    }
    kept.push(attr);
  }
  if (!hasPath) kept.push(`Path=${ctx.prefix}/`);
  if (ctx.secure && !hasSecure) kept.push('Secure');
  return [pair.trim(), ...kept].join('; ');
}

/** Better Auth's cookie names start with this (its default `cookiePrefix`). */
const BETTER_AUTH_COOKIE = /^better-auth\./;

/**
 * The Cookie header of an ingress request as Better Auth must read it: when Better Auth uses secure
 * cookies (KEPT_PUBLIC_URL is https) but Home Assistant is plain http, scopeCookieToIngress() sent
 * its cookies without the `__Secure-` prefix, so the prefix goes back on here. Otherwise unchanged.
 */
export function ingressCookieHeader(cookie: string, secureCookies: boolean): string {
  if (!secureCookies) return cookie;
  return cookie
    .split(';')
    .map((part) => {
      const trimmed = part.trim();
      return BETTER_AUTH_COOKIE.test(trimmed) ? `__Secure-${trimmed}` : trimmed;
    })
    .join('; ');
}

const withCore = new WeakMap<readonly string[], readonly string[]>();

/**
 * The proxies to believe for a request. Behind ingress the chain is browser → Core (172.30.32.1) →
 * the Supervisor (172.30.32.2) → Kept, and X-Forwarded-For ends `<browser>, 172.30.32.1`. The app
 * trusts only the Supervisor (KEPT_TRUSTED_PROXIES); Core's address is skipped as a hop only for a
 * request that passed the ingress check, so a direct request from Core (the integration) keeps
 * Core's own address.
 */
export function proxiesFor(req: FastifyRequest, trusted: readonly string[]): readonly string[] {
  if (!req.ingress) return trusted;
  let list = withCore.get(trusted);
  if (!list) {
    list = Object.freeze([...trusted, HA_CORE_ADDRESS]);
    withCore.set(trusted, list);
  }
  return list;
}
