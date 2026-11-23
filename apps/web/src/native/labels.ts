import { normaliseInputCode, parseScan, SHORT_CODE, storedCodeOf } from '@kept/shared';
import { capturePaths } from '@/api/capture/paths';
import type { ScanOutcome } from '@/api/capture/types';
import { ApiError } from '@/api/client';
import { capacitorAdapters, type PlatformAdapters } from './adapters';
import type { Connection } from './bridge';
import type { InventoryCache } from './inventory';

export type Target = Extract<ScanOutcome, { outcome: 'open' }>['target'];
export type ScanCandidate = Extract<
  ScanOutcome,
  { outcome: 'legacy_ambiguous' }
>['candidates'][number];

export type ReadResult =
  | { status: 'resolved'; target: Target; cached: boolean }
  | { status: 'ambiguous'; candidates: ScanCandidate[] }
  | { status: 'unassigned'; claim?: { code: string; locationId: string } }
  | {
      status: 'malformed' | 'foreign' | 'unresolved' | 'not_in_your_kept' | 'not_kept';
    };

export function approvedLabel(text: string, origin: string) {
  let url: URL;
  try {
    url = new URL(text.trim());
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

/** Rejects `/l/...` URLs pointing at a different Kept server even when scanned as QR codes. */
function checkQrUrlOrigin(text: string, origin: string) {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!/^\/l(?:\/|$)/i.test(url.pathname)) return null;
  if (url.username || url.password) return { status: 'malformed' } as const;
  if (url.origin !== origin) return { status: 'foreign' } as const;
  const part = /^\/l\/([a-z0-9]{6})$/i.exec(url.pathname)?.[1];
  const code = part ? normaliseInputCode(part) : '';
  if (url.search || url.hash || !SHORT_CODE.test(code)) return { status: 'malformed' } as const;
  return { status: 'approved', code } as const;
}

export function labelUrl(origin: string, code: string): string {
  return `${origin}/l/${encodeURIComponent(code)}`;
}

function resolveOfflineFromCache(
  cache: InventoryCache | undefined,
  parsed: ReturnType<typeof parseScan>,
  rawText: string,
): ReadResult {
  if (!cache) return { status: 'unresolved' };

  if (parsed.kind === 'kept') {
    const code = parsed.code;
    const hit = cache.codes.find((entry) => entry.code === code);
    if (hit) {
      if (hit.state === 'retired') return { status: 'not_in_your_kept' };
      if (hit.state === 'blank') {
        const location = cache.locations.find((entry) => entry.id === hit.locationId);
        return location && location.role !== 'viewer'
          ? { status: 'unassigned' }
          : { status: 'not_in_your_kept' };
      }
      if (hit.state === 'assigned') {
        if (hit.thingId && cache.things.some((item) => item.id === hit.thingId)) {
          return {
            status: 'resolved',
            target: { id: hit.thingId, kind: 'thing', locationId: hit.locationId },
            cached: true,
          };
        }
        if (hit.placeId && cache.places.some((item) => item.id === hit.placeId)) {
          return {
            status: 'resolved',
            target: { id: hit.placeId, kind: 'place', locationId: hit.locationId },
            cached: true,
          };
        }
      }
    }
    const cachedThing = cache.things.find((item) => item.shortCode === code);
    if (cachedThing) {
      return {
        status: 'resolved',
        target: { id: cachedThing.id, kind: 'thing', locationId: cachedThing.locationId },
        cached: true,
      };
    }
    const keptLegacy = cache.legacyCodes.find(
      (entry) => entry.source === 'kept' && entry.code === code,
    );
    if (keptLegacy) {
      if (keptLegacy.thingId && cache.things.some((item) => item.id === keptLegacy.thingId)) {
        return {
          status: 'resolved',
          target: { id: keptLegacy.thingId, kind: 'thing', locationId: keptLegacy.locationId },
          cached: true,
        };
      }
      if (keptLegacy.placeId && cache.places.some((item) => item.id === keptLegacy.placeId)) {
        return {
          status: 'resolved',
          target: { id: keptLegacy.placeId, kind: 'place', locationId: keptLegacy.locationId },
          cached: true,
        };
      }
    }
    return { status: 'unresolved' };
  }

  const legacyCode =
    parsed.kind === 'homebox'
      ? (parsed.assetId ?? parsed.uuid ?? '').toUpperCase()
      : storedCodeOf(rawText);
  if (legacyCode) {
    const matches = cache.legacyCodes.filter((entry) =>
      parsed.kind === 'homebox'
        ? entry.source === 'homebox' && entry.code === legacyCode
        : entry.code === legacyCode,
    );
    const candidates: ScanCandidate[] = [];
    const seen = new Set<string>();
    for (const entry of matches) {
      const targetId = entry.thingId ?? entry.placeId;
      if (!targetId || seen.has(targetId)) continue;
      const locationName = cache.locations.find((loc) => loc.id === entry.locationId)?.name ?? '';
      if (entry.thingId) {
        const thing = cache.things.find((t) => t.id === entry.thingId);
        if (thing) {
          seen.add(targetId);
          candidates.push({
            id: thing.id,
            kind: 'thing',
            name: thing.name ?? '',
            locationId: entry.locationId,
            locationName,
          });
        }
      } else if (entry.placeId) {
        const place = cache.places.find((p) => p.id === entry.placeId);
        if (place) {
          seen.add(targetId);
          candidates.push({
            id: place.id,
            kind: 'place',
            name: place.name,
            locationId: entry.locationId,
            locationName,
          });
        }
      }
    }
    if (candidates.length === 1 && candidates[0]) {
      const only = candidates[0];
      return {
        status: 'resolved',
        target: { id: only.id, kind: only.kind, locationId: only.locationId },
        cached: true,
      };
    }
    if (candidates.length > 1) {
      return { status: 'ambiguous', candidates };
    }
  }

  return { status: 'unresolved' };
}

export async function resolveLabel(
  connection: Connection,
  cache: InventoryCache | undefined,
  text: string,
  mode: 'nfc' | 'qr',
  format?: string,
  onlineRequired = false,
  adapters: PlatformAdapters = capacitorAdapters,
): Promise<ReadResult> {
  const nfcCheck = mode === 'nfc' ? approvedLabel(text, connection.origin) : undefined;
  if (nfcCheck && nfcCheck.status !== 'approved') return nfcCheck;

  const qrCheck = mode === 'qr' ? checkQrUrlOrigin(text, connection.origin) : null;
  if (qrCheck && qrCheck.status !== 'approved') return qrCheck;

  const parsed = parseScan(text, format);

  try {
    const response = await adapters.transport.request<ScanOutcome>(
      connection,
      capturePaths.scanResolve,
      {
        method: 'POST',
        body: { text, ...(format ? { format } : {}) },
      },
    );
    switch (response.outcome) {
      case 'open':
        return { status: 'resolved', target: response.target, cached: false };
      case 'claim':
        return {
          status: 'unassigned',
          ...(parsed.kind === 'kept'
            ? { claim: { code: parsed.code, locationId: response.locationId } }
            : {}),
        };
      case 'legacy_ambiguous':
        return { status: 'ambiguous', candidates: response.candidates };
      case 'not_kept':
      case 'barcode':
        return { status: 'not_kept' };
      case 'not_in_your_kept':
        return { status: 'not_in_your_kept' };
    }
  } catch (error) {
    if (onlineRequired || !(error instanceof ApiError && error.status === 0)) throw error;
  }

  return resolveOfflineFromCache(cache, parsed, text);
}

export function describeTargetFromCache(
  cache: InventoryCache | undefined,
  target: Target,
): string | null {
  if (!cache) return null;
  if (target.kind === 'thing') {
    return cache.things.find((item) => item.id === target.id)?.name ?? null;
  }
  return cache.places.find((item) => item.id === target.id)?.name ?? null;
}

export async function inspectTagOwner(
  connection: Connection,
  cache: InventoryCache | undefined,
  existingUrl: string,
  adapters: PlatformAdapters = capacitorAdapters,
): Promise<string | null> {
  const checked = approvedLabel(existingUrl, connection.origin);
  if (checked.status !== 'approved') return null;
  try {
    const resolved = await resolveLabel(
      connection,
      cache,
      existingUrl,
      'nfc',
      undefined,
      false,
      adapters,
    );
    if (resolved.status === 'resolved') {
      return describeTargetFromCache(cache, resolved.target);
    }
  } catch {
    // Non-fatal: still let user inspect/overwrite even if lookup failed.
  }
  return null;
}

export function isTarget(result: ReadResult, id: string): boolean {
  return result.status === 'resolved' && result.target.kind === 'thing' && result.target.id === id;
}
