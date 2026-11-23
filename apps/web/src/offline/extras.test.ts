/**
 * Keep a location available offline, on one fake phone:
 * what is kept is ciphertext at rest, never goes through the Cache API, respects the per-file and
 * per-device caps, refreshes without fetching an unchanged document again, and goes on a 401
 * (with the unsent queue kept), on a revoked location, and when the toggle goes off.
 */
import {
  KEEP_OFFLINE,
  newId,
  type SyncExtra,
  type SyncExtraDocument,
  type SyncExtrasPage,
} from '@kept/shared';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeIdb, makeDexieStore } from '@/test/dexie';
import { firstPage } from '@/test/store-contract';
import { removeLock } from './app-lock-db';
import { dbName, V5_STORES } from './db';
import type { DexieStore } from './dexie-store';
import {
  documentBlob,
  dropLocation,
  type ExtrasApi,
  extraOf,
  KeepOfflineTooLarge,
  keepLocation,
  tooLargeOf,
} from './extras';
import { createLock, sealJson, sha256Hex } from './lock';
import { clearCache } from './wipe';

const HOME = '01926f00-0000-7000-8000-00000000b002';
const GARAGE = '01926f00-0000-7000-8000-00000000b003';
const TV = '01926f00-0000-7000-8000-0000000d0001';
const KETTLE = '01926f00-0000-7000-8000-0000000d0002';

const enc = new TextEncoder();
const bytesOf = (text: string) => enc.encode(text).buffer as ArrayBuffer;

/** A document the fake server holds: its bytes, and its description. */
async function doc(
  title: string | null,
  body: string,
  kind: SyncExtraDocument['kind'] = 'manual',
  bytes?: number,
) {
  const content = bytesOf(body);
  const d: SyncExtraDocument = {
    attachmentId: newId(),
    fileId: newId(),
    kind,
    title,
    mime: 'application/pdf',
    bytes: bytes ?? content.byteLength,
    sha256: await sha256Hex(content),
  };
  return { d, content };
}

type Fake = { api: ExtrasApi; fetched: string[]; files: Map<string, ArrayBuffer> };

function fakeServer(items: Record<string, SyncExtra[]>, files: Map<string, ArrayBuffer>): Fake {
  const fetched: string[] = [];
  const api: ExtrasApi = {
    page: async (locationId, cursor) => {
      const all = items[locationId] ?? [];
      const start = Number(cursor ?? 0);
      const page: SyncExtrasPage = {
        items: all.slice(start, start + 1),
        next_cursor: start + 1 < all.length ? String(start + 1) : null,
        totalBytes: 0,
      };
      return page;
    },
    estimate: async (locationId) => {
      const all = items[locationId] ?? [];
      const docs = all.flatMap((x) => x.documents);
      return {
        things: all.length,
        documents: docs.length,
        totalBytes: docs
          .filter((d) => d.bytes <= KEEP_OFFLINE.fileBytes)
          .reduce((n, d) => n + d.bytes, 0),
      };
    },
    fileUrl: async (fileId, thingId) => ({ url: `/f/${fileId}?thing=${thingId}` }),
    fetchBytes: async (url) => {
      fetched.push(url);
      const id = url.slice(3, url.indexOf('?'));
      const body = files.get(id);
      if (!body) throw new Error('404');
      return body;
    },
  };
  return { api, fetched, files };
}

let store: DexieStore;
let key: CryptoKey;
let manual: Awaited<ReturnType<typeof doc>>;
let receipt: Awaited<ReturnType<typeof doc>>;
let huge: Awaited<ReturnType<typeof doc>>;
let fake: Fake;
let items: Record<string, SyncExtra[]>;

/** A fake Cache API that records every use (nothing kept may go there). */
const cacheUse: string[] = [];
const caches = {
  open: vi.fn(async (name: string) => {
    cacheUse.push(`open:${name}`);
    return { put: vi.fn(), match: vi.fn() };
  }),
  keys: vi.fn(async () => cacheUse.filter((u) => u.startsWith('open:')).map((u) => u.slice(5))),
  match: vi.fn(async () => {
    cacheUse.push('match');
    return undefined;
  }),
};

beforeEach(async () => {
  vi.stubGlobal('caches', caches);
  cacheUse.length = 0;
  store = makeDexieStore(newId(), fakeIdb());
  ({ dataKey: key } = await createLock('482913', 1000));
  manual = await doc('TV manual', 'MANUAL-BYTES-PLAINTEXT');
  receipt = await doc(null, 'RECEIPT-BYTES-PLAINTEXT', 'receipt');
  huge = await doc('TV service manual', 'x', 'manual', KEEP_OFFLINE.fileBytes + 1);
  items = {
    [HOME]: [
      {
        thingId: TV,
        purchase: { date: '2026-09-01', price: '4999.5', currency: 'EGP' },
        currentValue: { amount: '3000', currency: 'EGP' },
        documents: [manual.d, receipt.d, huge.d],
      },
      {
        thingId: KETTLE,
        purchase: null,
        currentValue: null,
        moneyHidden: true,
        documents: [],
      },
    ],
  };
  fake = fakeServer(
    items,
    new Map([
      [manual.d.fileId, manual.content],
      [receipt.d.fileId, receipt.content],
    ]),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe('keeping a location', () => {
  it('opens a v6 offline copy after upgrading the database for staged downloads', async () => {
    const userId = newId();
    const idb = fakeIdb();
    const v6 = new Dexie(dbName(userId), idb);
    v6.version(6).stores(V5_STORES);
    const extra = items[HOME]?.[1];
    if (!extra) throw new Error('missing kettle fixture');
    const kept = {
      locationId: HOME,
      state: 'ready',
      things: 1,
      documents: 0,
      bytes: 0,
      tooLarge: 0,
      updatedAt: 1,
    };
    await v6.table('keptOffline').put(kept);
    await v6.table('extras').put({
      thingId: KETTLE,
      locationId: HOME,
      run: 'previous',
      sealed: await sealJson(key, `extra:${KETTLE}`, extra),
    });
    v6.close();

    const upgraded = makeDexieStore(userId, idb).db;
    expect(await extraOf(upgraded, key, KETTLE)).toEqual({ extra, documents: [] });
    expect(await upgraded.keptOffline.get(HOME)).toEqual(kept);
    expect(await upgraded.extraDocDownloads.count()).toBe(0);
    upgraded.close();
  });

  it('stores money and documents sealed, and opens them with the key', async () => {
    const progress: number[] = [];
    const row = await keepLocation(store.db, key, HOME, fake.api, (p) => progress.push(p.done));
    expect(row).toMatchObject({ state: 'ready', things: 2, documents: 3, tooLarge: 1 });
    expect(row.bytes).toBe(manual.d.bytes + receipt.d.bytes);
    expect(progress.at(-1)).toBe(manual.d.bytes + receipt.d.bytes);

    const tv = await extraOf(store.db, key, TV);
    expect(tv?.extra.purchase?.price).toBe('4999.5');
    expect(tv?.documents.map((d) => [d.title, d.tooLarge])).toEqual(
      expect.arrayContaining([
        ['TV manual', false],
        [null, false],
        ['TV service manual', true],
      ]),
    );
    const blob = await documentBlob(store.db, key, manual.d.attachmentId);
    expect(blob?.type).toBe('application/pdf');
    expect(await blob?.text()).toBe('MANUAL-BYTES-PLAINTEXT');
    // The too-large one is listed, never fetched.
    expect(fake.fetched.some((u) => u.includes(huge.d.fileId))).toBe(false);
    expect(await documentBlob(store.db, key, huge.d.attachmentId)).toBeNull();
    expect((await tooLargeOf(store.db, key, HOME)).map((d) => d.title)).toEqual([
      'TV service manual',
    ]);
    // A receipt is fetched with its thing, for one that stayed behind after a move.
    expect(fake.fetched).toContain(`/f/${receipt.d.fileId}?thing=${TV}`);
  });

  it('keeps a viewer’s money hidden as the server sent it', async () => {
    await keepLocation(store.db, key, HOME, fake.api);
    const kettle = await extraOf(store.db, key, KETTLE);
    expect(kettle?.extra).toMatchObject({ moneyHidden: true, purchase: null, currentValue: null });
  });

  it('is ciphertext at rest: no price, title or document byte in the raw rows', async () => {
    await keepLocation(store.db, key, HOME, fake.api);
    const raw = [
      ...(await store.db.extras.toArray()),
      ...(await store.db.extraDocs.toArray()),
      ...(await store.db.keptOffline.toArray()),
    ];
    const text = raw
      .flatMap((r) =>
        Object.values(r).flatMap((v) => {
          if (v instanceof ArrayBuffer) return [new TextDecoder().decode(v)];
          if (v && typeof v === 'object')
            return Object.values(v).map((x) =>
              x instanceof ArrayBuffer ? new TextDecoder().decode(x) : JSON.stringify(x),
            );
          return [String(v)];
        }),
      )
      .join('\n');
    for (const plain of ['4999.5', '3000', 'TV manual', 'MANUAL-BYTES', 'RECEIPT-BYTES', 'EGP']) {
      expect(text).not.toContain(plain);
    }
    // A wrong key opens nothing.
    const { dataKey: other } = await createLock('111111', 1000);
    await expect(extraOf(store.db, other, TV)).rejects.toThrow();
  });

  it('never touches the Cache API', async () => {
    await keepLocation(store.db, key, HOME, fake.api);
    await documentBlob(store.db, key, manual.d.attachmentId);
    expect(await caches.keys()).toEqual([]);
    expect(caches.open).not.toHaveBeenCalled();
    expect(caches.match).not.toHaveBeenCalled();
  });

  it('refuses a document whose bytes don’t match its hash', async () => {
    fake.files.set(manual.d.fileId, bytesOf('TAMPERED'));
    await expect(keepLocation(store.db, key, HOME, fake.api)).rejects.toThrow(/hash/);
    expect((await store.db.keptOffline.get(HOME))?.state).toBe('failed');
  });

  it('refreshes without fetching an unchanged document, and drops what went', async () => {
    await keepLocation(store.db, key, HOME, fake.api);
    const first = fake.fetched.length;
    items[HOME] = [{ ...(items[HOME]?.[0] as SyncExtra), documents: [manual.d] }];
    await keepLocation(store.db, key, HOME, fake.api);
    expect(fake.fetched.length).toBe(first);
    expect(await store.db.extras.get(KETTLE)).toBeUndefined();
    expect(await store.db.extraDocs.get(receipt.d.attachmentId)).toBeUndefined();
    expect((await store.db.keptOffline.get(HOME))?.documents).toBe(1);
  });

  it('keeps the last complete download readable when a later page fails, then replaces it on retry', async () => {
    const previous = await keepLocation(store.db, key, HOME, fake.api);
    const before = await extraOf(store.db, key, TV);
    const replacement = await doc('New TV manual', 'UPDATED-MANUAL');
    const item = items[HOME]?.[0];
    if (!item) throw new Error('missing TV fixture');
    const updated = { ...item, purchase: null, documents: [replacement.d] };
    items[HOME]?.splice(0, 1, updated);
    fake.files.set(replacement.d.fileId, replacement.content);
    const failing: ExtrasApi = {
      ...fake.api,
      page: async (locationId, cursor) => {
        if (cursor) {
          expect(await extraOf(store.db, key, TV)).toEqual(before);
          throw new Error('connection lost');
        }
        return fake.api.page(locationId, cursor);
      },
    };

    await expect(keepLocation(store.db, key, HOME, failing)).rejects.toThrow('connection lost');
    expect(await extraOf(store.db, key, TV)).toEqual(before);
    expect(await documentBlob(store.db, key, replacement.d.attachmentId)).toBeNull();
    expect(await store.db.extraDocDownloads.count()).toBe(0);
    expect(await store.db.keptOffline.get(HOME)).toEqual({ ...previous, state: 'failed' });

    const ready = await keepLocation(store.db, key, HOME, fake.api);
    expect(ready).toMatchObject({ state: 'ready', things: 2, documents: 1 });
    expect(ready.bytes).toBe(replacement.d.bytes);
    expect(await extraOf(store.db, key, TV)).toMatchObject({
      extra: updated,
      documents: [{ attachmentId: replacement.d.attachmentId }],
    });
    expect(await documentBlob(store.db, key, manual.d.attachmentId)).toBeNull();
    expect(await store.db.extraDocDownloads.count()).toBe(0);
  });

  it('keeps the previous publication when a write fails during publication', async () => {
    const previous = await keepLocation(store.db, key, HOME, fake.api);
    const before = await extraOf(store.db, key, TV);
    const item = items[HOME]?.[0];
    if (!item) throw new Error('missing TV fixture');
    items[HOME] = [{ ...item, purchase: null }];
    const put = vi.spyOn(store.db.extraDocs, 'put').mockRejectedValueOnce(new Error('disk error'));
    try {
      await expect(keepLocation(store.db, key, HOME, fake.api)).rejects.toThrow('disk error');
    } finally {
      put.mockRestore();
    }
    expect(await extraOf(store.db, key, TV)).toEqual(before);
    expect(await store.db.keptOffline.get(HOME)).toEqual({ ...previous, state: 'failed' });
    expect(await store.db.extraDocDownloads.count()).toBe(0);
  });

  it('refuses past the device’s cap and names what is kept', async () => {
    await store.db.keptOffline.put({
      locationId: GARAGE,
      state: 'ready',
      things: 1,
      documents: 1,
      bytes: KEEP_OFFLINE.deviceBytes - 10,
      tooLarge: 0,
      updatedAt: Date.now(),
    });
    const err = await keepLocation(store.db, key, HOME, fake.api).catch((e) => e);
    expect(err).toBeInstanceOf(KeepOfflineTooLarge);
    expect((err as KeepOfflineTooLarge).kept).toEqual([
      { locationId: GARAGE, bytes: KEEP_OFFLINE.deviceBytes - 10 },
    ]);
    expect(fake.fetched).toEqual([]);
  });
});

describe('what removes it', () => {
  it.each([
    ['switching it off', () => dropLocation(store.db, HOME)],
    ['clearing the cache on a 401', () => clearCache(store.db)],
    ['revoking the location', () => store.applySnapshot(firstPage({ revokedLocationIds: [HOME] }))],
    ['removing the app lock', () => removeLock(store.db)],
  ] as const)('does not republish a pending download after %s', async (_name, remove) => {
    const api: ExtrasApi = {
      ...fake.api,
      page: async (locationId, cursor) => {
        if (cursor) await remove();
        return fake.api.page(locationId, cursor);
      },
    };
    await expect(keepLocation(store.db, key, HOME, api)).rejects.toThrow();
    expect(await store.db.keptOffline.get(HOME)).toBeUndefined();
    expect(await store.db.extras.count()).toBe(0);
    expect(await store.db.extraDocs.count()).toBe(0);
    expect(await store.db.extraDocDownloads.count()).toBe(0);
  });

  it('the toggle going off', async () => {
    await keepLocation(store.db, key, HOME, fake.api);
    await dropLocation(store.db, HOME);
    expect(await store.db.extras.count()).toBe(0);
    expect(await store.db.extraDocs.count()).toBe(0);
    expect(await store.db.keptOffline.count()).toBe(0);
  });

  it('a 401: the extras go, the unsent queue and the lock stay', async () => {
    await keepLocation(store.db, key, HOME, fake.api);
    const { record } = await createLock('482913', 1000);
    await store.db.lock.put({ key: 'device', record });
    const id = newId();
    await store.enqueue(
      {
        clientId: id,
        idempotencyKey: `seen:${id}`,
        op: 'seen',
        takenAt: '2026-10-06T10:00:00.000Z',
        locationId: HOME,
        payload: { thingId: TV },
      } as never,
      [],
    );
    await clearCache(store.db);
    expect(await store.db.extras.count()).toBe(0);
    expect(await store.db.extraDocs.count()).toBe(0);
    expect(await store.db.keptOffline.count()).toBe(0);
    expect(await store.db.queue.count()).toBe(1);
    expect(await store.db.lock.get('device')).toBeDefined();
  });

  it('a location the server says is no longer yours', async () => {
    await keepLocation(store.db, key, HOME, fake.api);
    await store.applySnapshot(firstPage({ revokedLocationIds: [HOME] }));
    expect(await store.db.extras.count()).toBe(0);
    expect(await store.db.keptOffline.get(HOME)).toBeUndefined();
  });
});
