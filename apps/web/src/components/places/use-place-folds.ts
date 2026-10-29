/**
 * The places you folded in a location's outline (#358), remembered on the server per person
 * (`GET/PUT /api/v1/locations/:id/place-folds`), so every device opens the outline the same way.
 *
 * - Read once per location and session.
 * - A fold is sent as a change (`{fold, open}`), never as the whole set: a fold made before the
 *   read arrives, after it failed, or from a tab whose read is old can't erase the other folds.
 * - The cache changes first; changes go one at a time per location, in order.
 * - A read that started before a change arrives without it: the change is put back on top.
 * - A change the server refuses, or that can't be sent (offline), is undone on the page, unless
 *   a later change has touched the same place since.
 */
import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { api } from '@/api/client';
import { inventoryPaths as p } from '@/api/inventory/paths';
import { inventoryKeys } from '@/api/inventory/queries';
import type { PlaceFolds, PlaceFoldsChange } from '@/api/inventory/types';

const EMPTY: ReadonlySet<string> = new Set();

type Sent = { seq: number; change: PlaceFoldsChange; failed: boolean };

/** Each location's recent changes, in order, so a read can put the newer ones back on top. */
const log = new Map<string, Sent[]>();
/** The last request sent per location: the next one waits for it. */
const sending = new Map<string, Promise<unknown>>();
let seq = 0;
const KEEP = 200;

/** `ids` with `change` applied. */
function applied(ids: readonly string[], { fold, open }: PlaceFoldsChange): string[] {
  const out = new Set(ids);
  for (const id of open) out.delete(id);
  for (const id of fold) out.add(id);
  return [...out];
}

async function read(locationId: string): Promise<PlaceFolds> {
  const from = seq;
  const { placeIds } = await api.get<PlaceFolds>(p.placeFolds(locationId));
  const newer = (log.get(locationId) ?? []).filter((s) => s.seq > from && !s.failed);
  return { placeIds: newer.reduce((ids, s) => applied(ids, s.change), placeIds) };
}

/** Undoes a refused change in the cache, place by place, unless a later change touched it. */
function undo(qc: QueryClient, locationId: string, sent: Sent, before: ReadonlySet<string>) {
  const later = (log.get(locationId) ?? []).filter((s) => s.seq > sent.seq && !s.failed);
  const touched = new Set(later.flatMap((s) => [...s.change.fold, ...s.change.open]));
  qc.setQueryData<PlaceFolds>(inventoryKeys.placeFolds(locationId), (old) => {
    const ids = new Set(old?.placeIds ?? []);
    for (const id of [...sent.change.fold, ...sent.change.open]) {
      if (touched.has(id)) continue;
      if (before.has(id)) ids.add(id);
      else ids.delete(id);
    }
    return { placeIds: [...ids] };
  });
}

export function usePlaceFolds(locationId: string | undefined): {
  folded: ReadonlySet<string>;
  change: (change: Partial<PlaceFoldsChange>) => void;
} {
  const qc = useQueryClient();
  const id = locationId ?? '';
  const query = useQuery({
    queryKey: inventoryKeys.placeFolds(id),
    queryFn: () => read(id),
    enabled: !!locationId,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  const ids = query.data?.placeIds;
  const folded = useMemo(() => (ids ? new Set(ids) : EMPTY), [ids]);
  const change = useCallback(
    (partial: Partial<PlaceFoldsChange>) => {
      if (!id) return;
      const body: PlaceFoldsChange = { fold: partial.fold ?? [], open: partial.open ?? [] };
      if (body.fold.length + body.open.length === 0) return;
      const key = inventoryKeys.placeFolds(id);
      const before = new Set(qc.getQueryData<PlaceFolds>(key)?.placeIds ?? []);
      seq += 1;
      const sent: Sent = { seq, change: body, failed: false };
      log.set(id, [...(log.get(id) ?? []), sent].slice(-KEEP));
      qc.setQueryData<PlaceFolds>(key, (old) => ({
        placeIds: applied(old?.placeIds ?? [], body),
      }));
      const send = (sending.get(id) ?? Promise.resolve())
        .catch(() => {})
        .then(() => api.put<void>(p.placeFolds(id), body))
        .catch(() => {
          sent.failed = true;
          undo(qc, id, sent, before);
        });
      sending.set(id, send);
    },
    [id, qc],
  );
  return { folded, change };
}
