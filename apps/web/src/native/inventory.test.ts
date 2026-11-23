import { describe, expect, it, vi } from 'vitest';
import { capacitorAdapters, type PlatformAdapters } from './adapters';
import type { Connection } from './bridge';
import {
  type InventoryCache,
  inventoryPath,
  loadInventory,
  localInventorySearch,
  pendingForRecord,
} from './inventory';

const connection: Connection = {
  id: 'https://kept.example.com|user-1|epoch-1',
  origin: 'https://kept.example.com',
  account: 'user-1',
  epoch: 'epoch-1',
};

describe('inventory snapshot, path, and offline search', () => {
  it('builds readable location paths and searches names, notes, codes, and attachments', () => {
    const cache: InventoryCache = {
      asOf: '2026-11-22T20:00:00Z',
      truncated: false,
      locations: [
        {
          id: 'loc-1',
          ownerAccountId: 'acc-1',
          name: 'Home',
          kind: 'home',
          timezone: 'UTC',
          languages: ['en'],
          role: 'owner',
          effectiveModules: [],
          unplacedPlaceId: 'place-1',
          suggestRadiusM: 100,
        },
      ],
      types: [],
      places: [
        {
          id: 'place-1',
          locationId: 'loc-1',
          parentId: null,
          name: 'Garage',
          kindKey: 'room',
          icon: null,
          isUnplaced: false,
          sort: 0,
          deleted: false,
        },
        {
          id: 'place-2',
          locationId: 'loc-1',
          parentId: 'place-1',
          name: 'Shelf B',
          kindKey: 'shelf',
          icon: null,
          isUnplaced: false,
          sort: 1,
          deleted: false,
        },
      ],
      things: [
        {
          id: 'box-1',
          locationId: 'loc-1',
          shortCode: '7KQ4MZ',
          labelPrinted: true,
          name: 'Holiday Box',
          typeId: 't-box',
          placeId: 'place-2',
          containerId: null,
          quantity: '1',
          aliases: {},
          lifecycle: 'in_use',
          reviewState: 'confirmed',
          locationUncertain: false,
          lastSeenAt: null,
          coverFileId: null,
          isContainer: true,
          deleted: false,
        },
        {
          id: 'item-1',
          locationId: 'loc-1',
          shortCode: '8AB2CD',
          labelPrinted: false,
          name: 'Decorations',
          typeId: null,
          placeId: null,
          containerId: 'box-1',
          quantity: '1',
          aliases: { en: ['Wreath'] },
          lifecycle: 'in_use',
          reviewState: 'confirmed',
          locationUncertain: false,
          lastSeenAt: null,
          coverFileId: null,
          isContainer: false,
          deleted: false,
        },
      ],
      codes: [
        {
          code: '7KQ4MZ',
          locationId: 'loc-1',
          state: 'assigned',
          thingId: 'box-1',
          placeId: null,
          isPrimary: true,
        },
      ],
      legacyCodes: [],
      details: {
        'item-1': {
          id: 'item-1',
          notes: 'Fragile ornaments stored in foam',
          attachments: [{ id: 'att-1', name: 'tree-assembly.pdf', role: 'document' }],
        },
      },
    };

    const target = cache.things[1];
    if (!target) throw new Error('Expected second thing');
    expect(inventoryPath(cache, target)).toEqual(['Home', 'Garage', 'Shelf B', 'Holiday Box']);
    expect(localInventorySearch(cache, 'fragile').map((t) => t.id)).toEqual(['item-1']);
    expect(localInventorySearch(cache, 'assembly').map((t) => t.id)).toEqual(['item-1']);
    expect(localInventorySearch(cache, '7KQ4MZ').map((t) => t.id)).toEqual(['box-1']);
    expect(localInventorySearch(cache, 'wreath').map((t) => t.id)).toEqual(['item-1']);
  });

  it('paginates snapshots, applies tombstones, and preserves surviving details', async () => {
    let savedCache = JSON.stringify({
      asOf: '2026-11-22T19:00:00Z',
      truncated: false,
      locations: [],
      types: [],
      places: [],
      things: [],
      codes: [],
      legacyCodes: [],
      details: {
        't-keep': { id: 't-keep', notes: 'Saved note', attachments: [] },
        't-gone': { id: 't-gone', notes: 'Deleted note', attachments: [] },
      },
    } satisfies InventoryCache);

    const request = vi
      .fn()
      .mockResolvedValueOnce({
        asOf: '2026-11-22T20:00:00Z',
        complete: false,
        nextCursor: 'page-2',
        locations: [
          {
            id: 'loc-1',
            ownerAccountId: 'acc-1',
            name: 'Home',
            kind: 'home',
            timezone: 'UTC',
            languages: ['en'],
            role: 'owner',
            effectiveModules: [],
            unplacedPlaceId: 'place-1',
            suggestRadiusM: 100,
          },
        ],
        types: { items: [] },
        changes: {
          places: [],
          things: [
            {
              id: 't-keep',
              locationId: 'loc-1',
              shortCode: '7KQ4MZ',
              labelPrinted: false,
              name: 'Box',
              typeId: null,
              placeId: 'place-1',
              containerId: null,
              quantity: '1',
              aliases: {},
              lifecycle: 'in_use',
              reviewState: 'confirmed',
              locationUncertain: false,
              lastSeenAt: null,
              coverFileId: null,
              isContainer: true,
              deleted: false,
            },
            {
              id: 't-gone',
              locationId: 'loc-1',
              shortCode: null,
              labelPrinted: false,
              name: 'Old',
              typeId: null,
              placeId: 'place-1',
              containerId: null,
              quantity: '1',
              aliases: {},
              lifecycle: 'in_use',
              reviewState: 'confirmed',
              locationUncertain: false,
              lastSeenAt: null,
              coverFileId: null,
              isContainer: false,
              deleted: false,
            },
          ],
          codes: [],
          legacyCodes: [],
        },
        removed: [],
        revokedLocationIds: [],
      })
      .mockResolvedValueOnce({
        asOf: '2026-11-22T20:00:01Z',
        complete: true,
        nextCursor: null,
        locations: [
          {
            id: 'loc-1',
            ownerAccountId: 'acc-1',
            name: 'Home',
            kind: 'home',
            timezone: 'UTC',
            languages: ['en'],
            role: 'owner',
            effectiveModules: [],
            unplacedPlaceId: 'place-1',
            suggestRadiusM: 100,
          },
        ],
        types: { items: null },
        changes: { places: [], things: [], codes: [], legacyCodes: [] },
        removed: [{ entityType: 'thing', entityId: 't-gone', locationId: 'loc-1' }],
        revokedLocationIds: [],
      });

    const adapters: PlatformAdapters = {
      ...capacitorAdapters,
      transport: { ...capacitorAdapters.transport, request },
      outbox: {
        ...capacitorAdapters.outbox,
        async cached() {
          return savedCache;
        },
        async saveCache(_conn, data) {
          savedCache = data;
        },
      },
    };

    const next = await loadInventory(connection, adapters);
    expect(next.things.map((t) => t.id)).toEqual(['t-keep']);
    expect(Object.keys(next.details)).toEqual(['t-keep']);
  });

  it('filters pending captures by destination box', () => {
    const entries = [
      {
        capture: {
          id: 'c-1',
          payload: JSON.stringify({ locationId: 'loc-1', boxId: 'box-1', name: 'Lights' }),
          takenAt: '2026-11-22T20:00:00Z',
          files: [],
        },
      },
      {
        capture: {
          id: 'c-2',
          payload: JSON.stringify({ locationId: 'loc-1', boxId: 'box-2', name: 'Tools' }),
          takenAt: '2026-11-22T20:00:00Z',
          files: [],
        },
      },
    ];
    expect(pendingForRecord(entries, 'box-1').map((e) => e.capture.id)).toEqual(['c-1']);
  });
});
