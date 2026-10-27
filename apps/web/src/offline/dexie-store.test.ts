/**
 * The Dexie store on fake-indexeddb: the T3 contract suite, plus what only a real database
 * shows (atomic pages, bytes round-tripping, quota handling, the 10,000-thing sanity check).
 */
import { newId, type SnapThing } from '@kept/shared';
import Dexie from 'dexie';
import { describe, expect, it, vi } from 'vitest';
import { fakeIdb, makeDexieStore } from '@/test/dexie';
import { firstPage, storeContract } from '@/test/store-contract';
import { dbName, V1_STORES, V5_STORES } from './db';
import { StorageFullError } from './persist';

storeContract('DexieStore (fake-indexeddb)', () => makeDexieStore());

const LOC = '01926f00-0000-7000-8000-00000000b002';
const FAMILY = '01926f00-0000-7000-8000-00000000b005';
const GARAGE = '01926f00-0000-7000-8000-0000000c0011';
const DRILL = '01926f00-0000-7000-8000-0000000d0005';
const CABLE = '01926f00-0000-7000-8000-0000000d0030';

const quota = () => new DOMException('The quota has been exceeded.', 'QuotaExceededError');

describe('DexieStore', () => {
  it('v2 starts the copy over, since its things had no meters, and keeps the queue', async () => {
    const idb = fakeIdb();
    const userId = newId();
    // A phone that synced under v1: a thing with no `meters`, a cursor, and a capture waiting.
    const v1 = new Dexie(dbName(userId), idb);
    v1.version(1).stores(V1_STORES);
    await v1.table('things').put({ id: DRILL, locationId: LOC, name: 'Bosch drill', terms: [] });
    await v1.table('meta').bulkPut([
      { key: 'cursor', value: 'old-cursor' },
      { key: 'lastSyncAt', value: 1 },
    ]);
    await v1.table('queue').add({
      clientVersion: '0.1.0',
      payloadVersion: 1,
      clientId: 'c1',
      idempotencyKey: 'move:c1',
      op: 'move',
      takenAt: '2026-09-27T11:06:00.000Z',
      locationId: LOC,
      payload: { thingIds: [DRILL], to: { placeId: GARAGE } },
      state: 'pending',
    });
    v1.close();

    const s = makeDexieStore(userId, idb);
    expect(await s.cursor()).toBeNull();
    expect(await s.thing(DRILL)).toBeUndefined();
    expect(await s.db.queue.count()).toBe(1);
    expect(await s.meta('lastSyncAt')).toBe(1);
    await s.applySnapshot(firstPage());
    expect((await s.thing(DRILL))?.name).toBe('Bosch drill');
  });

  it('a v2 copy, whose terms v3 rebuilt in place, now starts over at v6', async () => {
    const idb = fakeIdb();
    const userId = newId();
    // A phone that synced under v2: the drill's terms have no codes, its Homebox code is kept.
    const v2 = new Dexie(dbName(userId), idb);
    v2.version(2).stores(V1_STORES);
    await v2.table('things').put({
      ...firstPage().changes.things[0],
      terms: ['bosch', 'drill', '7kq4mz'],
    });
    await v2.table('legacyCodes').put({
      locationId: LOC,
      source: 'homebox',
      sourceCollection: 'main',
      code: '000-001',
      thingId: DRILL,
      placeId: null,
      key: `${LOC}:homebox:main:000-001`,
    });
    await v2.table('meta').put({ key: 'cursor', value: 'v2-cursor' });
    v2.close();

    const s = makeDexieStore(userId, idb);
    expect(await s.cursor()).toBeNull();
    expect(await s.search('bosch', 10)).toEqual([]);
    // The next sync brings the copy back, its terms with its codes.
    await s.applySnapshot(firstPage());
    expect((await s.search('000-001', 10)).map((t) => t.id)).toEqual([DRILL]);
  });

  it('v6 starts the copy over, since its codes had no print status, and keeps the queue', async () => {
    const idb = fakeIdb();
    const userId = newId();
    // A phone that synced under v5: codes without `printed`, a cursor, and a capture waiting.
    const v5 = new Dexie(dbName(userId), idb);
    v5.version(5).stores(V5_STORES);
    await v5.table('things').put({ ...firstPage().changes.things[0], terms: ['bosch'] });
    await v5.table('codes').bulkPut(firstPage().changes.codes);
    await v5.table('meta').bulkPut([
      { key: 'cursor', value: 'v5-cursor' },
      { key: 'lastSyncAt', value: 1 },
    ]);
    await v5.table('tray').put({ thingId: DRILL, addedAt: 1 });
    await v5.table('queue').add({
      clientVersion: '0.1.0',
      payloadVersion: 1,
      clientId: 'c1',
      idempotencyKey: 'move:c1',
      op: 'move',
      takenAt: '2026-09-27T11:06:00.000Z',
      locationId: LOC,
      payload: { thingIds: [DRILL], to: { placeId: GARAGE } },
      state: 'pending',
    });
    v5.close();

    const s = makeDexieStore(userId, idb);
    expect(await s.cursor()).toBeNull();
    expect(await s.thing(DRILL)).toBeUndefined();
    expect(await s.db.codes.count()).toBe(0);
    expect(await s.meta('lastSyncAt')).toBe(1);
    expect(await s.tray()).toEqual([DRILL]);
    expect(await s.db.queue.count()).toBe(1);
  });

  it('finds الكابل offline by its bare form كابل and by its Arabic alias', async () => {
    const s = makeDexieStore();
    await s.applySnapshot(firstPage());
    expect((await s.search('كابل', 10)).map((t) => t.id)).toEqual([CABLE]);
    expect((await s.search('وصلة', 10)).map((t) => t.id)).toEqual([CABLE]);
    expect((await s.search('bosch dri', 10)).map((t) => t.id)).toEqual([DRILL]);
  });

  it('a removed tombstone deletes the row; revokedLocationIds removes that location’s rows', async () => {
    const s = makeDexieStore();
    await s.applySnapshot(firstPage());
    await s.applySnapshot(
      firstPage({
        changes: { places: [], things: [], codes: [], legacyCodes: [] },
        removed: [
          { locationId: LOC, entityType: 'thing', entityId: DRILL },
          { locationId: LOC, entityType: 'code', entityId: '7KQ4MZ' },
          { locationId: LOC, entityType: 'legacy_code', entityId: `${LOC}:homebox:main:000-001` },
        ],
        revokedLocationIds: [FAMILY],
        nextCursor: 'cursor-2',
      }),
    );
    expect(await s.thing(DRILL)).toBeUndefined();
    expect(await s.byCode('7KQ4MZ')).toBeUndefined();
    expect(await s.byLegacy('homebox', '000-001')).toEqual([]);
    expect(await s.thing(CABLE)).toBeUndefined();
    expect(await s.placesOf(FAMILY)).toEqual([]);
    expect(await s.db.things.where('locationId').equals(FAMILY).count()).toBe(0);
    expect(await s.search('كابل', 10)).toEqual([]);
  });

  it('a page is all or nothing: a failed page leaves the rows and the cursor as they were', async () => {
    const s = makeDexieStore();
    await s.applySnapshot(firstPage());
    const spy = vi.spyOn(s.db.codes, 'bulkPut').mockRejectedValueOnce(new Error('disk'));
    const drill = (await s.thing(DRILL)) as SnapThing;
    await expect(
      s.applySnapshot(
        firstPage({
          changes: {
            places: [],
            things: [{ ...drill, name: 'Renamed drill' }],
            codes: [],
            legacyCodes: [],
          },
          nextCursor: 'cursor-2',
        }),
      ),
    ).rejects.toThrow('disk');
    spy.mockRestore();
    expect((await s.thing(DRILL))?.name).toBe('Bosch drill');
    expect(await s.cursor()).toBe('cursor-1');
  });

  it('keeps queued files as bytes and gives them back as Blobs with their type', async () => {
    const s = makeDexieStore();
    const id = newId();
    await s.enqueue(
      {
        clientId: id,
        idempotencyKey: `cap:${id}`,
        op: 'create_thing',
        takenAt: '2026-09-27T11:05:00.000Z',
        locationId: LOC,
        payload: { id, target: { placeId: GARAGE }, mode: 'thing', batchId: newId(), files: [] },
      },
      [
        {
          id: 'f1',
          kind: 'original',
          blob: new Blob(['jpeg'], { type: 'image/jpeg' }),
          sha256: 'ab',
        },
      ],
    );
    const [entry] = await s.pending();
    const [blob] = await s.blobsOf(entry?.seq ?? -1);
    expect(blob?.blob.type).toBe('image/jpeg');
    expect(await blob?.blob.text()).toBe('jpeg');
    expect(blob?.uploaded).toBe(false);
  });

  it('when the phone is full, frees the thumbnail cache and retries the capture once', async () => {
    const s = makeDexieStore();
    await s.db.thumbs.put({
      fileId: 't1',
      bytes: new ArrayBuffer(8),
      type: 'image/jpeg',
      size: 8,
      lastUsedAt: 1,
    });
    const add = vi.spyOn(s.db.queue, 'add').mockRejectedValueOnce(quota());
    const id = newId();
    await s.enqueue(
      {
        clientId: id,
        idempotencyKey: `cap:${id}`,
        op: 'mark_seen',
        takenAt: '2026-09-27T11:05:00.000Z',
        locationId: LOC,
        payload: { thingId: DRILL },
      },
      [],
    );
    add.mockRestore();
    expect(await s.db.thumbs.count()).toBe(0);
    expect(await s.pending()).toHaveLength(1);
  });

  it('when even that does not fit, says so with StorageFullError and queues nothing', async () => {
    const s = makeDexieStore();
    const add = vi.spyOn(s.db.queue, 'add').mockRejectedValue(quota());
    const id = newId();
    await expect(
      s.enqueue(
        {
          clientId: id,
          idempotencyKey: `cap:${id}`,
          op: 'mark_seen',
          takenAt: '2026-09-27T11:05:00.000Z',
          locationId: LOC,
          payload: { thingId: DRILL },
        },
        [],
      ),
    ).rejects.toBeInstanceOf(StorageFullError);
    add.mockRestore();
    expect(await s.pending()).toEqual([]);
  });

  // What a jsdom run can show is the shape of the cost, not the phone's speed: a 10,000-thing page
  // costs about ten times a 1,000-thing one (0.08 s and 0.75 s of CPU on a laptop, mostly
  // fake-indexeddb's own structured clones and index upkeep). An absolute bound alone failed under
  // full-suite load: CPU time stretches too when cores are shared (1.5–2.9 s seen for the 10,000).
  // So both sizes are timed in the same run, each the best of a few, and their ratio must stay
  // near linear (10×; quadratic work would be ~100×). The ceiling catches a store that turned
  // uniformly slow, at several times the worst loaded run seen.
  it('applies a 10,000-thing snapshot page in time linear in its size (a jsdom sanity check, not the phone)', {
    retry: 2,
  }, async () => {
    const base = firstPage();
    const things: SnapThing[] = Array.from({ length: 10_000 }, (_, i) => ({
      id: `01926f00-0000-7000-8000-${String(i).padStart(12, '0')}`,
      locationId: LOC,
      shortCode: null,
      name: `Thing number ${i}`,
      typeId: '',
      placeId: GARAGE,
      containerId: null,
      quantity: '1',
      aliases: { en: [`alias ${i}`] },
      lifecycle: 'in_use',
      reviewState: 'confirmed',
      locationUncertain: false,
      lastSeenAt: null,
      coverFileId: null,
      isContainer: false,
      deleted: false,
    }));
    // CPU time, not wall time: a worker waiting for a core is not a slow store. Each page goes to
    // a fresh store, as a phone's first sync does.
    const cpuMs = async (n: number) => {
      const s = makeDexieStore();
      const page = { ...base, changes: { ...base.changes, things: things.slice(0, n) } };
      const cpu = process.cpuUsage();
      await s.applySnapshot(page);
      const used = process.cpuUsage(cpu);
      expect(await s.db.things.count()).toBe(n);
      return (used.user + used.system) / 1000;
    };
    // Warm the JIT on a small page first: the phone's first sync isn't its first line of code.
    await cpuMs(500);
    const small: number[] = [];
    const large: number[] = [];
    for (let round = 0; round < 2; round++) {
      small.push(await cpuMs(1_000));
      large.push(await cpuMs(10_000));
    }
    small.push(await cpuMs(1_000));
    const best = Math.min(...large);
    expect(best / Math.min(...small)).toBeLessThan(25);
    expect(best).toBeLessThan(6_000);
  });
});
