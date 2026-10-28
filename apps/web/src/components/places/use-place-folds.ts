/**
 * The places you folded in a location's outline (#358), remembered on the server per person
 * (`GET/PUT /api/v1/locations/:id/place-folds`), so every device opens the outline the same way.
 * Read once per location and session; a fold changes the cache first and then sends the whole
 * set, one request at a time per location, so the last fold wins. Offline, or when a request
 * fails, folds still work on this page and are not remembered.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { api } from '@/api/client';
import { inventoryPaths as p } from '@/api/inventory/paths';
import { inventoryKeys } from '@/api/inventory/queries';
import type { PlaceFolds } from '@/api/inventory/types';

const EMPTY: ReadonlySet<string> = new Set();

/** The last request sent per location: the next one waits for it. */
const sending = new Map<string, Promise<unknown>>();

export function usePlaceFolds(locationId: string | undefined): {
  folded: ReadonlySet<string>;
  setFolded: (next: ReadonlySet<string>) => void;
} {
  const qc = useQueryClient();
  const id = locationId ?? '';
  const key = inventoryKeys.placeFolds(id);
  const query = useQuery({
    queryKey: key,
    queryFn: () => api.get<PlaceFolds>(p.placeFolds(id)),
    enabled: !!locationId,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  const ids = query.data?.placeIds;
  const folded = useMemo(() => (ids ? new Set(ids) : EMPTY), [ids]);
  const setFolded = useCallback(
    (next: ReadonlySet<string>) => {
      if (!id) return;
      const body: PlaceFolds = { placeIds: [...next] };
      void qc.cancelQueries({ queryKey: inventoryKeys.placeFolds(id) });
      qc.setQueryData<PlaceFolds>(inventoryKeys.placeFolds(id), body);
      const send = (sending.get(id) ?? Promise.resolve())
        .catch(() => {})
        .then(() => api.put<void>(p.placeFolds(id), body))
        .catch(() => {
          // Offline or refused: the fold stays on this page, and isn't remembered.
        });
      sending.set(id, send);
    },
    [id, qc],
  );
  return { folded, setFolded };
}
