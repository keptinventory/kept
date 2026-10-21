/**
 * Tags on the phone, offline (#209): the snapshot's tags to pick from, a tag made offline, and a
 * tag change queued as a `tag_things` op that the sync engine sends when back online. A tag made
 * offline travels in the op's `create`, so the server makes it first (or uses the tag that already
 * has the name).
 */
import { newId, normalize, type SnapTag } from '@kept/shared';
import { useQuery } from '@tanstack/react-query';
import type { TagThingsBody, ThingTag } from '@/api/inventory/types';
import type { OfflineStore } from '@/offline/store';

/** Tags made offline in this session and not yet in a queued op, by id. */
const madeOffline = new Map<string, { name: string }>();

/** A new tag, offline: it exists once the op that adds it is queued. */
export function newOfflineTag(name: string): ThingTag {
  const id = newId();
  madeOffline.set(id, { name: name.trim() });
  return { id, name: name.trim(), colour: null };
}

/** Queues tags added to or taken off things in `locationId`; answers the op's key. */
export async function queueTagThings(
  store: OfflineStore,
  locationId: string,
  body: TagThingsBody,
  opts: { dependsOn?: string[] } = {},
): Promise<string> {
  const create = (body.add ?? []).flatMap((id) => {
    const made = madeOffline.get(id);
    return made ? [{ id, name: made.name }] : [];
  });
  const clientId = newId();
  const item = {
    clientId,
    idempotencyKey: `tag_things:${clientId}`,
    op: 'tag_things' as const,
    takenAt: new Date().toISOString(),
    locationId,
    ...(opts.dependsOn?.length ? { dependsOn: opts.dependsOn } : {}),
    payload: {
      thingIds: body.thingIds,
      add: body.add ?? [],
      remove: body.remove ?? [],
      create,
    },
  };
  await store.enqueue(item, []);
  for (const c of create) madeOffline.delete(c.id);
  return item.idempotencyKey;
}

/** `tags` matching what's typed, A to Z: a name containing it, normalised. */
export function matchTags(tags: readonly SnapTag[], accountId: string, q: string): ThingTag[] {
  const needle = normalize(q.trim());
  return tags
    .filter((g) => g.accountId === accountId && (!needle || normalize(g.name).includes(needle)))
    .map((g) => ({ id: g.id, name: g.name, colour: g.colour }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The phone's tags of an account, for the picker offline. */
export function useOfflineTagOptions(
  store: OfflineStore | null,
  accountId: string,
  q: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['offline-tags', accountId, q.trim()],
    queryFn: async () => (store ? matchTags(await store.tags(), accountId, q) : []),
    enabled: enabled && !!store,
    networkMode: 'always',
    staleTime: 0,
  });
}

/** A thing's tags from the phone's: the ids it carries, named, A to Z (unknown ids left out). */
export function tagsOfSnap(tagIds: readonly string[] | undefined, tags: readonly SnapTag[]) {
  const byId = new Map(tags.map((g) => [g.id, g]));
  return (tagIds ?? [])
    .flatMap((id) => {
      const g = byId.get(id);
      return g ? [{ id: g.id, name: g.name, colour: g.colour }] : [];
    })
    .sort((a, b) => a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase()));
}
