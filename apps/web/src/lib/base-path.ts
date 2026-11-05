/**
 * Home Assistant ingress (D273): inside Home Assistant, Kept is served at
 * `<Home Assistant>/api/hassio_ingress/<token>/`. The server then sends index.html with
 * `<base href="<prefix>/">` and `<meta name="kept-ingress">` (apps/server/src/http/web.ts), so the
 * relative asset URLs and the router resolve under the prefix. What still names the server from
 * the root, the API paths (`/api/v1/…`), `/version` and the server's own file URLs (`/f/<token>`),
 * goes under it here.
 *
 * On every other install the page has `<base href="/">`, no meta tag, and nothing in this file
 * changes a URL or wraps anything.
 */

function meta(name: string): string | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? null;
}

/** Whether this page runs under Home Assistant ingress. */
export function underIngress(): boolean {
  return meta('kept-ingress') === '1';
}

/** The ingress prefix (`/api/hassio_ingress/<token>`, no trailing slash); '' everywhere else. */
export function ingressBase(): string {
  if (!underIngress()) return '';
  const path = new URL(document.baseURI).pathname;
  return path.replace(/\/+$/, '');
}

/** The router's basepath: the prefix under ingress, `/` otherwise. */
export function routerBasepath(): string {
  return ingressBase() || '/';
}

/**
 * A link to a section of this page. With `<base href>` in index.html a bare `#id` resolves against
 * the base (the home page, `/` or the ingress prefix), not the page, so a plain `href="#id"`
 * navigates away; this names the page itself: `<path><query>#id`, the prefix included.
 * scripts/check-web-api-paths.mjs fails on a bare `href="#…"`.
 */
export function hashHref(id: string): string {
  if (typeof location === 'undefined') return `#${id}`;
  return `${location.pathname}${location.search}#${id}`;
}

/** An in-app path (`/things/abc`, as the router names it) for the browser's own history, which
 * knows nothing of the router's basepath: under the prefix inside Home Assistant. */
export function appHref(path: string): string {
  return `${ingressBase()}${path}`;
}

/** A root-relative server path under the prefix; any other URL, and every URL outside
 * ingress, as it is. */
export function withBase(url: string): string {
  const base = ingressBase();
  if (!base || !url.startsWith('/') || url.startsWith('//') || url.startsWith('/\\')) return url;
  if (url === base || url.startsWith(`${base}/`)) return url;
  return `${base}${url}`;
}

/** The server's own file URLs (`/f/<token>`, storage/local.ts) in a response, under the prefix.
 * Outside ingress the body itself comes back, untouched. */
export function withBaseDeep<T>(body: T): T {
  const base = ingressBase();
  if (!base) return body;
  const walk = (value: unknown): unknown => {
    if (typeof value === 'string') return value.startsWith('/f/') ? `${base}${value}` : value;
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) out[k] = walk(v);
      return out;
    }
    return value;
  };
  return walk(body) as T;
}

const MAIN_ADDRESS_KEY = 'kept.main-address';
let mainAddress: string | null | undefined;

/** `GET /setup`'s `mainAddress` (D275): set only when the server has KEPT_EXTRA_ADDRESSES. Kept on
 * this device too, for a cold start offline, where the frame draws without asking (D210). */
export function noteMainAddress(value: unknown): void {
  let origin: string | null = null;
  try {
    if (typeof value === 'string' && new URL(value).origin === value) origin = value;
  } catch {}
  mainAddress = origin;
  try {
    if (origin) localStorage.setItem(MAIN_ADDRESS_KEY, origin);
    else localStorage.removeItem(MAIN_ADDRESS_KEY);
  } catch {
    // No storage: this page knows it, and asks again next time.
  }
}

function knownMainAddress(): string | null {
  if (mainAddress !== undefined) return mainAddress;
  try {
    mainAddress = localStorage.getItem(MAIN_ADDRESS_KEY);
  } catch {
    mainAddress = null;
  }
  return mainAddress;
}

/** The main address when this page is on another one (KEPT_EXTRA_ADDRESSES, D275), else null:
 * passkeys and outside sign-ins work there only. Under ingress, Home Assistant's own rules. */
export function mainAddressElsewhere(): string | null {
  if (typeof location === 'undefined' || underIngress()) return null;
  const main = knownMainAddress();
  return main && main !== location.origin ? main : null;
}

/**
 * Kept's own address for what leaves the page (a copied link, a label's QR code, a Shortcuts
 * recipe): under ingress the page's origin is Home Assistant's, which works only inside a Home
 * Assistant session, so the server names KEPT_PUBLIC_URL instead; on an extra address (D275), so
 * does `GET /setup`, as a printed label must work from anywhere. Elsewhere the page's origin.
 */
export function publicOrigin(): string {
  const named = underIngress() ? meta('kept-public-url') : mainAddressElsewhere();
  if (named) {
    try {
      return new URL(named).origin;
    } catch {}
  }
  return typeof location === 'undefined' ? '' : location.origin;
}

/**
 * A page of Home Assistant's own (`/config/backup`), for a link that leaves Kept: under ingress the
 * page's origin is Home Assistant's, and the path is outside the prefix, so the link names the
 * origin and opens in the top window (target="_top"), Home Assistant's frontend, not Kept's frame.
 * Null everywhere else: on Kept's own address, Home Assistant's address isn't known.
 */
export function homeAssistantHref(path: string): string | null {
  if (!underIngress() || typeof location === 'undefined') return null;
  return new URL(path, location.origin).toString();
}

let installed = false;

/**
 * Under ingress only: every `fetch()` and `XMLHttpRequest.open()` with a root-relative URL goes
 * under the prefix, so the ~20 places that fetch the server directly (uploads, exports, file
 * display, the offline extras) need no change of their own. A no-op everywhere else, and once.
 */
export function installIngressPrefixing(): void {
  if (installed || !ingressBase()) return;
  installed = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    realFetch(typeof input === 'string' ? withBase(input) : input, init)) as typeof fetch;
  const realOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function open(
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    const target = typeof url === 'string' ? withBase(url) : url;
    return (realOpen as (...a: unknown[]) => void).call(this, method, target, ...rest);
  } as typeof XMLHttpRequest.prototype.open;
}
