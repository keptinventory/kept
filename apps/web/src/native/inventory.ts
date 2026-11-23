import {
  newId,
  type SnapCode,
  type SnapLegacyCode,
  type SnapLocation,
  type SnapPlace,
  type SnapshotPage,
  type SnapThing,
  type SnapType,
} from '@kept/shared';
import { capturePaths } from '@/api/capture/paths';
import { ApiError } from '@/api/client';
import { inventoryPaths, qs } from '@/api/inventory/paths';
import type { AttachmentView, Page, PlaceView, ThingView } from '@/api/inventory/types';
import { matchesAll, queryWords } from '@/offline/local-search';
import { codesKey, legacyCodesByThing, termsOf } from '@/offline/store';
import { type Connection, nativeRequest } from './bridge';
import { readStored, storage } from './outbox';

export type RecordDetail = {
  id: string;
  notes: string | null;
  attachments: Pick<AttachmentView, 'id' | 'name' | 'role'>[];
};

export type InventoryCache = {
  asOf: string;
  truncated: boolean;
  locations: SnapLocation[];
  types: SnapType[];
  places: SnapPlace[];
  things: SnapThing[];
  codes: SnapCode[];
  legacyCodes: SnapLegacyCode[];
  details: Record<string, RecordDetail>;
};

const searchTerms = (value: string | null | undefined) => queryWords(value ?? '');

export function localInventorySearch(cache: InventoryCache, query: string): SnapThing[] {
  const words = queryWords(query);
  if (!words.length) return [];
  const byThing = legacyCodesByThing(cache.legacyCodes);
  for (const code of cache.codes) {
    if (!code.thingId || code.state !== 'assigned') continue;
    const key = codesKey({ id: code.thingId, locationId: code.locationId });
    byThing.set(key, [...(byThing.get(key) ?? []), code.code]);
  }
  return cache.things
    .filter((thing) => {
      const detail = cache.details[thing.id];
      return matchesAll(
        [
          ...termsOf(thing, byThing.get(codesKey(thing))),
          ...searchTerms(detail?.notes),
          ...(detail?.attachments.flatMap((attachment) => searchTerms(attachment.name)) ?? []),
        ],
        words,
      );
    })
    .slice(0, 50);
}

export function inventoryPath(cache: InventoryCache, record: SnapThing | SnapPlace): string[] {
  const parts: string[] = [];
  const seen = new Set([record.id]);
  let parent = 'containerId' in record ? (record.containerId ?? record.placeId) : record.parentId;
  while (parent && !seen.has(parent)) {
    seen.add(parent);
    const container = cache.things.find((item) => item.id === parent);
    const place = cache.places.find((item) => item.id === parent);
    const name = container?.name ?? place?.name;
    if (name) parts.unshift(name);
    parent = container?.containerId ?? container?.placeId ?? place?.parentId ?? null;
  }
  const location = cache.locations.find((entry) => entry.id === record.locationId);
  if (location) parts.unshift(location.name);
  return parts;
}

export async function readInventory(connection: Connection): Promise<InventoryCache | undefined> {
  return readStored<InventoryCache>(connection, 'cached');
}

export async function loadInventory(connection: Connection): Promise<InventoryCache> {
  const old = await readInventory(connection);
  const places = new Map<string, SnapPlace>();
  const things = new Map<string, SnapThing>();
  const codes = new Map<string, SnapCode>();
  const legacyCodes = new Map<string, SnapLegacyCode>();
  let cursor: string | undefined;

  for (let round = 0; round < 200; round++) {
    const page: SnapshotPage = await nativeRequest(
      connection,
      `${capturePaths.syncSnapshot}${qs({ cursor, limit: 1000 })}`,
    );
    const visible = new Set(page.locations.map((location) => location.id));
    for (const place of page.changes.places) {
      if (place.deleted) places.delete(place.id);
      else places.set(place.id, place);
    }
    for (const thing of page.changes.things) {
      if (thing.deleted) things.delete(thing.id);
      else things.set(thing.id, thing);
    }
    for (const code of page.changes.codes) codes.set(code.code, code);
    for (const code of page.changes.legacyCodes) {
      legacyCodes.set(
        `${code.locationId}:${code.source}:${code.sourceCollection}:${code.code}`,
        code,
      );
    }
    for (const row of page.removed) {
      if (row.entityType === 'thing') things.delete(row.entityId);
      if (row.entityType === 'place') places.delete(row.entityId);
      if (row.entityType === 'code') codes.delete(row.entityId);
      if (row.entityType === 'legacy_code') {
        for (const [key, code] of legacyCodes) {
          if (code.locationId === row.locationId && code.code === row.entityId)
            legacyCodes.delete(key);
        }
      }
    }

    if (page.complete) {
      const inScope = <T extends { locationId: string }>(items: Iterable<T>) =>
        [...items].filter((item) => visible.has(item.locationId));
      const next: InventoryCache = {
        asOf: page.asOf,
        truncated: page.truncated === true,
        locations: page.locations,
        types: page.types.items ?? old?.types ?? [],
        places: inScope(places.values()),
        things: inScope(things.values()),
        codes: inScope(codes.values()),
        legacyCodes: inScope(legacyCodes.values()),
        details: Object.fromEntries(
          Object.entries(old?.details ?? {}).filter(([id]) => {
            const thing = things.get(id);
            return !!thing && visible.has(thing.locationId);
          }),
        ),
      };
      await storage(connection, 'saveCache', { data: JSON.stringify(next) });
      return next;
    }
    if (page.nextCursor === cursor) break;
    cursor = page.nextCursor;
  }
  throw new ApiError(500, 'internal', 'The inventory snapshot did not finish.');
}

export async function loadDetail(
  connection: Connection,
  id: string,
): Promise<{
  thing: ThingView;
  attachments: AttachmentView[];
}> {
  const [thing, page] = await Promise.all([
    nativeRequest<ThingView>(connection, inventoryPaths.thing(id)),
    nativeRequest<Page<AttachmentView>>(
      connection,
      `${inventoryPaths.thingAttachments(id)}${qs({ limit: 100 })}`,
    ),
  ]);
  return { thing, attachments: page.items };
}

export async function loadPlace(connection: Connection, id: string): Promise<PlaceView> {
  return nativeRequest(connection, inventoryPaths.place(id));
}

export async function createBox(
  connection: Connection,
  cache: InventoryCache,
  destination: SnapPlace,
  name: string,
): Promise<ThingView> {
  const type = cache.types.find((entry) => entry.builtinKey === 'box_bin' && entry.isContainer);
  if (!type) throw new ApiError(400, 'validation', 'This Kept has no Box type.');
  return nativeRequest(connection, inventoryPaths.things, {
    method: 'POST',
    body: {
      id: newId(),
      typeId: type.id,
      name,
      locationId: destination.locationId,
      placeId: destination.id,
    },
  });
}
