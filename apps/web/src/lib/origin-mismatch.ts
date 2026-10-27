/**
 * A Kept opened at another address than the one it is set up for (KEPT_PUBLIC_URL): its sign-in
 * and its saves are refused with 403 `origin_mismatch`, whose body names the right address
 * (`expectedOrigin`). The first refusal is noted here, so the app can show one strip with a link
 * to it, whatever the request was.
 */
import { useSyncExternalStore } from 'react';

/** `value` when it is an http(s) origin and nothing more ("http://kept.lan:8080"), else null. */
export function asOrigin(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin === value ? value : null;
  } catch {
    return null;
  }
}

/** The address an `origin_mismatch` refusal names, or null for any other error. */
export function expectedOriginOf(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const e = error as { code?: unknown; details?: { expectedOrigin?: unknown } };
  if (e.code !== 'origin_mismatch') return null;
  return asOrigin(e.details?.expectedOrigin);
}

/** The same page at the right address: `expected` with this page's path, query and fragment. */
export function sameRouteAt(expected: string): string {
  if (typeof location === 'undefined') return expected;
  return `${expected}${location.pathname}${location.search}${location.hash}`;
}

let noted: string | null = null;
const listeners = new Set<() => void>();

export function noteOriginMismatch(expected: string): void {
  if (noted === expected) return;
  noted = expected;
  for (const l of listeners) l();
}

/** Forgets the noted address (tests). */
export function resetOriginMismatch(): void {
  noted = null;
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The address a refused request named on this page, or null while none was refused. */
export function useOriginMismatch(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => noted,
    () => null,
  );
}
