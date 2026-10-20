/**
 * What a count expects, from the phone's snapshot (so it works offline): a place with the places
 * inside it (or alone), a box with everything inside it, or a whole location; things in use and
 * confirmed only, never a trashed thing or a draft.
 */
import type { SnapPlace, SnapshotPage, SnapThing } from '@kept/shared';
import { describe, expect, it } from 'vitest';
import { MemoryStore } from '@/offline/store';
import { areasFor, expectedFor } from './expected';

const HOME = '01926f00-0000-7000-8000-00000000e001';
const UNPLACED = '01926f00-0000-7000-8000-00000000e0ff';
const GARAGE = '01926f00-0000-7000-8000-00000000e010';
const SHELF = '01926f00-0000-7000-8000-00000000e011';
const BOX = '01926f00-0000-7000-8000-00000000e021';

const place = (id: string, name: string, parentId: string | null = null): SnapPlace => ({
  id,
  locationId: HOME,
  parentId,
  name,
  kindKey: 'zone',
  icon: null,
  isUnplaced: id === UNPLACED,
  sort: 1,
  deleted: false,
});
let n = 0;
const thing = (over: Partial<SnapThing>): SnapThing => ({
  id: `01926f00-0000-7000-8000-0000000f${String(++n).padStart(4, '0')}`,
  locationId: HOME,
  shortCode: null,
  name: `Thing ${n}`,
  typeId: null,
  placeId: null,
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
  ...over,
});

async function phone() {
  const box = thing({ id: BOX, placeId: SHELF, isContainer: true, name: 'Box 14' });
  const things = {
    onGarage: thing({ placeId: GARAGE, barcode: '5901234123457' }),
    box,
    inBox: thing({ containerId: BOX }),
    onShelf: thing({ placeId: SHELF }),
    loose: thing({ placeId: UNPLACED }),
    sold: thing({ placeId: GARAGE, lifecycle: 'sold' }),
    // An archived thing (1.13's lifecycle) is in no count's list: never expected, never missing.
    archived: thing({ placeId: GARAGE, lifecycle: 'archived' as SnapThing['lifecycle'] }),
    lent: thing({
      placeId: SHELF,
      quantity: '6',
      derived: ['lent'],
      loan: { direction: 'out', personName: 'Murdock', dueOn: null },
    }),
    draft: thing({ placeId: GARAGE, reviewState: 'draft' }),
    trashed: thing({ placeId: GARAGE, deleted: true }),
  };
  const store = new MemoryStore();
  const page: SnapshotPage = {
    asOf: '2026-10-20T10:00:00.000Z',
    payloadVersion: 1,
    minPayloadVersion: 1,
    locations: [
      {
        id: HOME,
        name: 'Home',
        kind: 'house',
        timezone: 'Africa/Cairo',
        languages: ['en'],
        role: 'member',
        effectiveModules: [],
        unplacedPlaceId: UNPLACED,
        suggestRadiusM: 150,
      },
    ],
    types: { hash: 'h', items: [] },
    changes: {
      places: [place(UNPLACED, ''), place(GARAGE, 'Garage'), place(SHELF, 'Shelf B', GARAGE)],
      things: Object.values(things),
      codes: [],
      legacyCodes: [],
    },
    removed: [],
    revokedLocationIds: [],
    nextCursor: 'c',
    complete: true,
  };
  await store.applySnapshot(page);
  return { store, things };
}

const ids = (list: { id: string }[]) => list.map((t) => t.id).sort();

describe('expectedFor', () => {
  it('a place with the places inside it: everything there, boxes’ contents too', async () => {
    const { store, things: t } = await phone();
    const list = await expectedFor(store, {
      kind: 'place',
      id: GARAGE,
      locationId: HOME,
      name: 'Garage',
      inside: true,
    });
    expect(ids(list)).toEqual(ids([t.onGarage, t.box, t.inBox, t.onShelf, t.lent]));
    expect(list.find((x) => x.id === t.onGarage.id)?.barcode).toBe('5901234123457');
    // What a count needs to never call it missing, and to count it in number.
    expect(list.find((x) => x.id === t.lent.id)).toMatchObject({
      quantity: '6',
      derived: ['lent'],
      loan: { personName: 'Murdock' },
    });
    expect(list.some((x) => x.id === t.archived.id || x.id === t.sold.id)).toBe(false);
  });

  it("a count's areas: the place and the places inside it", async () => {
    const { store } = await phone();
    const areas = await areasFor(store, {
      kind: 'place',
      id: GARAGE,
      locationId: HOME,
      name: 'Garage',
      inside: true,
    });
    expect(areas.map((a) => a.name)).toEqual(['Garage', 'Shelf B']);
  });

  it('a place alone: what is directly there and in its boxes', async () => {
    const { store, things: t } = await phone();
    const list = await expectedFor(store, {
      kind: 'place',
      id: GARAGE,
      locationId: HOME,
      name: 'Garage',
      inside: false,
    });
    expect(ids(list)).toEqual(ids([t.onGarage]));
  });

  it('a box: everything inside it', async () => {
    const { store, things: t } = await phone();
    const list = await expectedFor(store, {
      kind: 'container',
      id: BOX,
      locationId: HOME,
      name: 'Box 14',
    });
    expect(ids(list)).toEqual(ids([t.inBox]));
  });

  it('a whole location: everything in it', async () => {
    const { store, things: t } = await phone();
    const list = await expectedFor(store, {
      kind: 'location',
      id: HOME,
      locationId: HOME,
      name: 'Home',
    });
    expect(ids(list)).toEqual(ids([t.onGarage, t.box, t.inBox, t.onShelf, t.loose, t.lent]));
  });
});
