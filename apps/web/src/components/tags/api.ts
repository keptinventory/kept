/**
 * Tags (#209) as fetchers and hooks: search an account's tags (on the server: no cap), make one
 * inline (members may), and add or take tags off things, online as one undoable change
 * (`POST /things/tags`, its events undone together) or, offline, queued as a `tag_things` op.
 */
import { normalize } from '@kept/shared';
import { useLingui } from '@lingui/react/macro';
import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { isApiError, written } from '@/api/client';
import { inventoryPaths as p } from '@/api/inventory/paths';
import { inventoryApi, inventoryKeys } from '@/api/inventory/queries';
import type {
  CreateRegistryResult,
  Tag,
  TagThingsBody,
  TagThingsResult,
  ThingTag,
} from '@/api/inventory/types';
import { useOfferUndo } from '@/components/history/undo';
import { useErrorText } from '@/components/page';
import { toast } from '@/components/ui/toast';
import { useOffline } from '@/offline/provider';
import { queueTagThings } from './offline';

export const tagsApi = {
  /** The account's tags matching `q` (normalised, near matches too, best first; D42). */
  search: (accountId: string, q: string, limit = 50) =>
    inventoryApi.registry('tags', accountId, { ...(q.trim() ? { q: q.trim() } : {}), limit }),
  create: (accountId: string, name: string) =>
    inventoryApi.createRegistry('tags', accountId, { name }) as Promise<
      CreateRegistryResult<'tags'>
    >,
  tagThings: (body: TagThingsBody) => written.post<TagThingsResult>(p.thingsTags, body),
};

export const tagKeys = {
  search: (accountId: string, q: string) => ['registry', 'tags', accountId, 'pick', q] as const,
};

/** The account's tags for what's typed, as the picker lists them. */
export function useTagSearch(accountId: string, q: string, enabled = true) {
  return useQuery({
    queryKey: tagKeys.search(accountId, q.trim()),
    queryFn: () => tagsApi.search(accountId, q),
    enabled: enabled && !!accountId,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

/** Whether a tag of exactly this name (normalised) is among `tags`. */
export const hasName = (tags: readonly { name: string }[], name: string): boolean =>
  tags.some((g) => normalize(g.name) === normalize(name));

/** A tag as a thing carries it. */
export const thingTagOf = (g: Pick<Tag, 'id' | 'name' | 'colour'>): ThingTag => ({
  id: g.id,
  name: g.name,
  colour: g.colour,
});

/**
 * Makes a tag inline. One of that name already (normalised; a 409 with its id) is used instead:
 * the answer says which, and `possibleDuplicates` the near ones.
 */
export async function createTag(
  accountId: string,
  name: string,
): Promise<{ tag: ThingTag; made: boolean; near: { id: string; name: string }[] }> {
  try {
    const res = await tagsApi.create(accountId, name.trim());
    return {
      tag: thingTagOf(res.item),
      made: true,
      near: res.possibleDuplicates.filter((d) => d.id !== res.item.id),
    };
  } catch (e) {
    const existing = isApiError(e) ? e.details.existingId : undefined;
    if (typeof existing !== 'string') throw e;
    const tag = await inventoryApi.registry('tags', accountId, { q: name.trim(), limit: 20 });
    const found = tag.items.find((g) => g.id === existing);
    if (!found) throw e;
    return { tag: thingTagOf(found), made: false, near: [] };
  }
}

/** After a tag change, everything that shows tags or things reads again. */
export function invalidateTags(qc: QueryClient): Promise<unknown> {
  return Promise.all([
    qc.invalidateQueries({ queryKey: inventoryKeys.registry.all('tags') }),
    qc.invalidateQueries({ queryKey: inventoryKeys.things.all }),
    qc.invalidateQueries({ queryKey: inventoryKeys.places.all }),
    qc.invalidateQueries({ queryKey: ['search'] }),
  ]);
}

/**
 * Adds or takes off tags on things, with an Undo toast (the events undone together). Offline, or
 * when the server can't be reached, the change is queued on the phone for things of `locationId`
 * and shows at once. Answers whether anything was sent or queued; a failure is a toast.
 */
export function useTagThings() {
  const { t } = useLingui();
  const qc = useQueryClient();
  const offerUndo = useOfferUndo();
  const errorText = useErrorText();
  const store = useOffline()?.store ?? null;
  return useCallback(
    async (
      body: TagThingsBody,
      title: string,
      opts: { locationId?: string } = {},
    ): Promise<boolean> => {
      const queue = async () => {
        if (!store || !opts.locationId) return false;
        await queueTagThings(store, opts.locationId, body);
        await qc.invalidateQueries({ queryKey: ['offline-page'] });
        await qc.invalidateQueries({ queryKey: ['offline-tags'] });
        toast({
          title,
          description: t`On this phone; it syncs when you're online.`,
          tone: 'ok',
        });
        return true;
      };
      try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false && (await queue()))
          return true;
        const { body: res } = await tagsApi.tagThings(body);
        await invalidateTags(qc);
        offerUndo({ title }, res.events, { together: true });
        return true;
      } catch (e) {
        if (isApiError(e) && e.code === 'offline' && (await queue())) return true;
        toast({ title: t`Couldn't change the tags`, description: errorText(e), tone: 'danger' });
        return false;
      }
    },
    [qc, offerUndo, errorText, t, store],
  );
}
