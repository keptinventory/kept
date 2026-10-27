/**
 * The place operations of D160 and the moves of D45 as fetchers and hooks, for the browse
 * screens (task 25). The shared fetchers live in api/inventory/queries.ts; the few it lacks are
 * here, beside the screens that use them, so parallel web tasks never edit the same file.
 *
 * Every write invalidates places, things and home: a move or a trash changes counts, paths and
 * the Unplaced number on Home at once, and the lists are cheap to refetch.
 */
import { siblingOrder } from '@kept/shared';
import {
  type Query,
  type QueryClient,
  useInfiniteQuery,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api, ifMatch, written } from '@/api/client';
import { inventoryPaths as p } from '@/api/inventory/paths';
import {
  type ContentsParams,
  inventoryApi,
  inventoryKeys as k,
  nextCursor,
} from '@/api/inventory/queries';
import type {
  BoxNode,
  ConvertChildrenBody,
  ConvertChildrenResult,
  ConvertToContainerBody,
  ConvertToContainerResult,
  EmptyIntoBody,
  LabelResult,
  MergePlaceBody,
  MoveResult,
  PlaceNode,
  PlaceView,
  ReorderBody,
  ReorderResult,
  ThingListParams,
} from '@/api/inventory/types';
import { keys, useLocations } from '@/api/queries';
import type { LocationKind, Role } from '@/api/types';

export const placeApi = {
  /**
   * Merge `id` into `targetId` (owners and admins). The server checks both versions: If-Match is
   * the target's (read fresh here, since the picker only has its id), `sourceRowVersion` the
   * version of the place the person is looking at (T25 decision 5).
   */
  mergeInto: async (id: string, targetId: string, sourceRowVersion: number) => {
    const target = await inventoryApi.place(targetId);
    const body: MergePlaceBody = { targetId, sourceRowVersion };
    return api.post<PlaceView>(p.placeMergeInto(id), body, ifMatch(target.rowVersion));
  },
  convertToContainer: (id: string, rowVersion: number, body: ConvertToContainerBody = {}) =>
    api.post<ConvertToContainerResult>(p.placeConvertToContainer(id), body, ifMatch(rowVersion)),
  /** Places inside `id` as boxes, one row each; `auditEvents` are what one Undo reverses. */
  convertChildren: (id: string, body: ConvertChildrenBody) =>
    written.post<ConvertChildrenResult>(p.placeConvertChildren(id), body),
  /** One of its places a step up or down, while `id` is in Custom order. */
  reorder: (id: string, body: ReorderBody) => api.post<ReorderResult>(p.placeReorder(id), body),
  label: (id: string) => api.post<LabelResult>(p.placeLabel(id)),
  emptyInto: (thingId: string, body: EmptyIntoBody) =>
    api.post<MoveResult>(p.thingEmptyInto(thingId), body),
};

/** A place's own queries: its page, its contents and its history. */
const ownQueries =
  (id: string) =>
  ({ queryKey: [root, part, of] }: Query): boolean =>
    root === 'places' &&
    of === id &&
    (part === 'detail' || part === 'contents' || part === 'history');

/**
 * After any place or move write: everything that shows places, things or their counts.
 * `gone` is a place the write ended (turned into a box): its own queries go stale without a
 * refetch, which could only answer 404 and put "Couldn't load this" on the page still showing it.
 */
export function invalidateBrowse(
  qc: QueryClient,
  { gone }: { gone?: string } = {},
): Promise<unknown> {
  const own = gone ? ownQueries(gone) : () => false;
  return Promise.all([
    qc.invalidateQueries({ queryKey: k.places.all, predicate: (q) => !own(q) }),
    ...(gone
      ? [qc.invalidateQueries({ queryKey: k.places.all, predicate: own, refetchType: 'none' })]
      : []),
    qc.invalidateQueries({ queryKey: k.things.all }),
    qc.invalidateQueries({ queryKey: k.home }),
    qc.invalidateQueries({ queryKey: keys.locations }),
  ]);
}

export function useInvalidateBrowse() {
  const qc = useQueryClient();
  return () => invalidateBrowse(qc);
}

/**
 * A place's contents (`usePlaceContents` with an on/off switch, so a list that shows either a
 * place or a container can call both hooks unconditionally). Same query keys.
 */
export const useContentsQuery = (id: string, params: ContentsParams, enabled: boolean) =>
  useInfiniteQuery({
    queryKey: k.places.contents(id, params),
    queryFn: ({ pageParam }) =>
      inventoryApi.placeContents(id, { ...params, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.things.next_cursor ?? undefined,
    enabled,
  });

/** `useThings` with an on/off switch. Same query keys. */
export const useThingsQuery = (params: ThingListParams, enabled: boolean) =>
  useInfiniteQuery({
    queryKey: k.things.list(params),
    queryFn: ({ pageParam }) =>
      inventoryApi.things({ ...params, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    enabled,
  });

/** One location's place tree (flat; `parentId` makes the tree). */
export const usePlaceTree = (locationId: string) =>
  useQuery({
    queryKey: k.places.tree(locationId),
    queryFn: () => inventoryApi.places(locationId),
    enabled: !!locationId,
  });

export type LocationTree = {
  location: { id: string; name: string; kind: LocationKind; role: Role };
  places: PlaceNode[];
  boxes: BoxNode[];
};

/**
 * The place trees of every location the caller can see (the move picker's search, D45). One
 * request per location; a household has a handful.
 */
export function useAllPlaceTrees(): { trees: LocationTree[]; isPending: boolean } {
  const locations = useLocations();
  const list = locations.data ?? [];
  const results = useQueries({
    queries: list.map((l) => ({
      queryKey: k.places.tree(l.id),
      queryFn: () => inventoryApi.places(l.id),
    })),
  });
  return {
    isPending: locations.isPending || results.some((r) => r.isPending),
    trees: list.flatMap((l, i) => {
      const data = results[i]?.data;
      return data
        ? [
            {
              location: { id: l.id, name: l.name, kind: l.kind, role: l.role },
              places: data.places,
              boxes: data.boxes ?? [],
            },
          ]
        : [];
    }),
  };
}

/** Children by parent id, sorted the way the server sorts (floors in their order, then A to Z;
 * a parent in Custom order by its own order). */
export function childrenOf<P extends PlaceNode>(places: P[]): Map<string | null, P[]> {
  const out = new Map<string | null, P[]>();
  const orderOf = new Map(places.map((pl) => [pl.id, pl.childOrder]));
  for (const pl of places) {
    const list = out.get(pl.parentId) ?? [];
    list.push(pl);
    out.set(pl.parentId, list);
  }
  for (const [parent, list] of out) list.sort(siblingOrder(parent ? orderOf.get(parent) : 'name'));
  return out;
}

/** `id` and every place under it (a place can't move into its own subtree). */
export function subtreeOf(places: PlaceNode[], id: string): Set<string> {
  const kids = childrenOf(places);
  const out = new Set<string>([id]);
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop() as string;
    for (const c of kids.get(cur) ?? [])
      if (!out.has(c.id)) {
        out.add(c.id);
        stack.push(c.id);
      }
  }
  return out;
}

/** The names from the root down to `id`, for a picker row ("Office › Desk drawer"). */
export function pathNames(places: PlaceNode[], id: string): string[] {
  const byId = new Map(places.map((pl) => [pl.id, pl]));
  const out: string[] = [];
  const seen = new Set<string>();
  for (let cur = byId.get(id); cur && !seen.has(cur.id); cur = byId.get(cur.parentId ?? '')) {
    seen.add(cur.id);
    out.unshift(cur.name);
  }
  return out;
}

// ----- recent places (the picker's first group, D45) ---------------------------------------

const RECENT_KEY = 'kept.recentPlaces';
const RECENT_MAX = 5;

/** Place ids this viewer last moved things into, newest first. A per-device convenience. */
export function recentPlaceIds(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function rememberPlace(id: string): void {
  try {
    const next = [id, ...recentPlaceIds().filter((x) => x !== id)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // No storage: the picker simply has no recent group.
  }
}
