import { normaliseInputCode, parseScan, SHORT_CODE } from '@kept/shared';
import { capturePaths } from '@/api/capture/paths';
import type { ScanOutcome } from '@/api/capture/types';
import { ApiError } from '@/api/client';
import { type Connection, nativeRequest } from './bridge';
import type { InventoryCache } from './inventory';

export type Target = Extract<ScanOutcome, { outcome: 'open' }>['target'];
type ReadResult =
  | { status: 'resolved'; target: Target; cached: boolean }
  | { status: 'malformed' | 'foreign' | 'unassigned' | 'unresolved' | 'not_in_your_kept' };

export function approvedLabel(text: string, origin: string) {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { status: 'malformed' } as const;
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    return { status: 'malformed' } as const;
  }
  if (url.origin !== origin) return { status: 'foreign' } as const;
  const part = /^\/l\/([a-z0-9]{6})$/i.exec(url.pathname)?.[1];
  const code = part ? normaliseInputCode(part) : '';
  if (url.search || url.hash || !SHORT_CODE.test(code)) return { status: 'malformed' } as const;
  return { status: 'approved', code } as const;
}

export function labelUrl(origin: string, code: string): string {
  return `${origin}/l/${encodeURIComponent(code)}`;
}

export async function resolveLabel(
  connection: Connection,
  cache: InventoryCache | undefined,
  text: string,
  mode: 'nfc' | 'qr',
  format?: string,
  onlineRequired = false,
): Promise<ReadResult> {
  const label = mode === 'nfc' ? approvedLabel(text, connection.origin) : undefined;
  if (label && label.status !== 'approved') return label;
  const parsed = parseScan(text, format);

  try {
    const response = await nativeRequest<ScanOutcome>(connection, capturePaths.scanResolve, {
      method: 'POST',
      body: { text, ...(format ? { format } : {}) },
    });
    if (response.outcome === 'open') {
      return { status: 'resolved', target: response.target, cached: false };
    }
    return { status: response.outcome === 'claim' ? 'unassigned' : 'not_in_your_kept' };
  } catch (error) {
    if (onlineRequired || !(error instanceof ApiError && error.status === 0)) throw error;
  }

  const code = label?.code ?? (parsed.kind === 'kept' ? parsed.code : null);
  const hit = cache?.codes.find((entry) => code === entry.code && entry.state === 'assigned');
  if (!hit) return { status: 'unresolved' };
  const { thingId, placeId, locationId } = hit;
  if (thingId && cache?.things.some((item) => item.id === thingId)) {
    return { status: 'resolved', target: { id: thingId, kind: 'thing', locationId }, cached: true };
  }
  if (placeId && cache?.places.some((item) => item.id === placeId)) {
    return { status: 'resolved', target: { id: placeId, kind: 'place', locationId }, cached: true };
  }
  return { status: 'unresolved' };
}

export function isTarget(result: ReadResult, id: string): boolean {
  return result.status === 'resolved' && result.target.kind === 'thing' && result.target.id === id;
}
