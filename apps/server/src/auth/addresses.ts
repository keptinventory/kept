// KEPT_EXTRA_ADDRESSES (#405, D275): one Kept answering on several exact addresses, a LAN name and
// a Tailscale name, say. KEPT_PUBLIC_URL stays the main address: links, labels, QR codes, mail,
// calendar feeds, passkeys and OAuth stay on it. A web push names no address: its path opens on
// the address the device subscribed from. A listed address may sign in (password, email link, a
// code) and write; that is all it changes.
//
// Parsed once, at startup, into the exact origin a browser sends, and compared whole against the
// request's `Origin`: no parsing of what a client sent, no suffix or host match, so a lookalike
// has nothing to work on. `Host` and `X-Forwarded-*` play no part: a client writes those, and a
// browser's `Origin` is the one thing a page can't choose.

const HTTP_SCHEME = /^https?:\/\//i;
/** Characters URL parsing would quietly drop or decode, so that what's written isn't what's used.
 * Other control characters it refuses by itself. */
const NOT_AN_ADDRESS = /[\s%]/;

/** `@`, and the forms IDNA maps to it. */
const LOGIN = /[@＠﹫]/;

/** One entry as the origin a browser sends. A refusal says where the entry is in the list, never
 * what it says: a value this wrong may hold half a password. */
function originOf(entry: string, place: number): string {
  const refused = (why: string) => new Error(`address ${place}: ${why}`);
  // Better Auth reads `*` and `?` as wildcards; here a `?` after a slash is a query, refused below.
  if (entry.includes('*') || /^[^/]*(\/\/[^/]*)?\?/.test(entry)) {
    throw refused('no wildcards; list each address exactly');
  }
  if (!HTTP_SCHEME.test(entry)) {
    throw refused('starts with http:// or https://, like http://kept.lan:8080');
  }
  const rest = entry.replace(HTTP_SCHEME, '');
  if (/[/?#\\]/.test(rest.replace(/\/$/, ''))) {
    throw refused('the address alone, with no path or query');
  }
  if (NOT_AN_ADDRESS.test(entry)) throw refused('not a valid address');
  let url: URL;
  try {
    url = new URL(entry);
  } catch {
    throw refused('not a valid address');
  }
  if (url.hostname === '') throw refused('not a valid address');
  // Browsers treat `kept.lan.` as an address of its own, which nobody means to list.
  if (url.hostname.endsWith('.')) throw refused('no dot at the end of the name');
  // After parsing too: IDNA maps forms such as U+FF0A to `*`, and what's returned here is handed to
  // Better Auth, which would read it as a pattern (an open redirect through `callbackURL`).
  if (/[*?]/.test(url.origin)) throw refused('no wildcards; list each address exactly');
  // IDNA maps U+FF0C and U+FE50 to `,` too, which would read as two addresses.
  if (url.origin.includes(',')) throw refused('not a valid address');
  return url.origin;
}

/** The value's addresses, each as the origin a browser sends, once each. Throws on the first bad
 * entry, saying where it is and what's wrong with it. Empty entries are dropped. */
export function parseExtraAddresses(value: string | undefined): readonly string[] {
  const text = value ?? '';
  // Before anything splits it: a password may hold a comma, which would make two "entries", one of
  // them perhaps a valid address. Nothing of the value is repeated.
  if (LOGIN.test(text)) {
    throw new Error('an address has a login: write each address alone, with no user or password');
  }
  const entries = text
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return [...new Set(entries.map((entry, i) => originOf(entry, i + 1)))];
}

/** The first address on another scheme than the public URL's, or null. Cookies, HSTS and the
 * https-only gates follow the main address, so a mix stops startup. */
export function mixedSchemes(publicUrl: string, extras: readonly string[]): string | null {
  const scheme = new URL(publicUrl).protocol;
  return extras.find((origin) => new URL(origin).protocol !== scheme) ?? null;
}

/** The list without the main address, which needs no listing. */
export function withoutMainAddress(publicUrl: string, extras: readonly string[]): string[] {
  const main = new URL(publicUrl).origin;
  return extras.filter((origin) => origin !== main);
}

/** Whether a request's `Origin` is exactly one of the extra addresses. */
export function isExtraAddress(
  origin: string | undefined,
  extras: readonly string[] | undefined,
): boolean {
  return !!origin && !!extras && extras.includes(origin);
}

/** Better Auth's paths (under AUTH_BASE_PATH) refused when the request's `Origin` is an extra address:
 * a passkey belongs to one host name, and an outside sign-in and OAuth come back to KEPT_PUBLIC_URL.
 * Not `/callback/*`: a provider comes back by a redirect, a GET with no `Origin` to go by, and neither
 * of Kept's asks for a form post (auth/google.ts, auth/oidc.ts), so a check there would never fire. */
const MAIN_ADDRESS_ONLY = ['/passkey/', '/sign-in/social', '/link-social', '/oauth2/'];

export function isMainAddressOnly(authPath: string): boolean {
  return MAIN_ADDRESS_ONLY.some((path) =>
    path.endsWith('/') ? authPath.startsWith(path) : authPath === path,
  );
}
