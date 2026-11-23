/** A same-app path to return to after signing in, or undefined. Never another origin. */
export function safeNext(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return undefined;
  return value;
}

export const nextSearch = (search: Record<string, unknown>): { next?: string } => {
  const next = safeNext(search.next);
  return next ? { next } : {};
};

import { appHref } from './base-path';

/** Kept's iPhone consent page is served by Fastify, outside the React router. */
export function finishSignIn(next: string | undefined, navigate: (href: string) => void): void {
  const target = safeNext(next) ?? '/';
  const href = appHref(target);
  if (target.startsWith('/native/connect?')) window.location.assign(href);
  else navigate(href);
}
