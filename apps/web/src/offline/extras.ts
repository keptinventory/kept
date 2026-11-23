/**
 * "Keep this location available offline" on the device (D159, D181):
 * fetch a location's extras (GET /api/v1/sync/extras, server sync/extras.ts), encrypt them under
 * the app lock's data key (offline/lock.ts) and keep them in IndexedDB (offline/db.ts).
 * Loaded lazily with Dexie; nothing of it is in the entry chunk.
 *
 * - **Never the Cache API** (D181): a document's bytes come from its five-minute signed URL
 *   (`POST /api/v1/files/:id/url?thingId=`, the original) with `cache: 'no-store'`, are checked
 *   against the server's SHA-256, then sealed into IndexedDB. The service worker never caches
 *   /api or /f (sw.ts), and a presigned S3 URL is cross-origin, which it doesn't handle.
 * - **Ciphertext at rest:** each thing's money and each document's description and bytes are
 *   AES-GCM under the data key, with the row's id as additional data. In the clear: ids, the
 *   location, the stored size (for the device's cap) and the counts.
 * - **Caps** (KEEP_OFFLINE): a document over `fileBytes` is listed, not stored ("too large to keep
 *   offline"); the device's total over `deviceBytes` refuses before the download (from the
 *   estimate) and stops one that grows past it: `KeepOfflineTooLarge` names what is kept.
 * - **A refresh** stages encrypted documents in IndexedDB and keeps the small thing rows in
 *   memory. One transaction publishes the rows and totals after the download succeeds. It reuses
 *   unchanged document bodies and leaves the previous download readable if the refresh fails.
 * - Removed when the toggle goes off (`dropLocation`), on any 401 and after ten wrong PINs
 *   (wipe.ts clearCache), for a revoked location (dexie-store.ts applySnapshot), and with the
 *   whole database on sign-out.
 */
import {
  KEEP_OFFLINE,
  type SyncExtra,
  type SyncExtraDocument,
  type SyncExtrasEstimate,
  type SyncExtrasPage,
} from '@kept/shared';
import {
  EXTRAS_TABLES,
  type ExtraDocDownloadRow,
  type ExtraRow,
  KeptDb,
  type KeptOfflineRow,
} from './db';
import { randomBytes, seal, sealJson, sha256Hex, unseal, unsealJson } from './lock';

/** What keeping a location needs from the network; the screens pass the real API. */
export type ExtrasApi = {
  page: (locationId: string, cursor?: string) => Promise<SyncExtrasPage>;
  estimate: (locationId: string) => Promise<SyncExtrasEstimate>;
  /** The signed URL of a document's original; `thingId` serves a receipt after a move (D115). */
  fileUrl: (fileId: string, thingId: string) => Promise<{ url: string }>;
  fetchBytes?: (url: string) => Promise<ArrayBuffer>;
};

/** A kept document as the screens read it, once unsealed. */
export type KeptDocument = SyncExtraDocument & { thingId: string; tooLarge: boolean };

export type KeepProgress = { done: number; total: number };

/** Keeping this would pass the device's cap (`keep_offline_too_large`). */
export class KeepOfflineTooLarge extends Error {
  constructor(
    /** What it would take, in bytes, with what is already kept. */
    readonly needed: number,
    /** The locations kept now, largest first: what to turn off. */
    readonly kept: { locationId: string; bytes: number }[],
  ) {
    super('keep_offline_too_large');
    this.name = 'KeepOfflineTooLarge';
  }
}

/** A downloaded document whose bytes don't match the server's hash. */
export class KeepOfflineCorrupt extends Error {
  constructor(readonly attachmentId: string) {
    super('the document did not match its hash');
    this.name = 'KeepOfflineCorrupt';
  }
}

export function openDeviceDb(userId: string, options?: ConstructorParameters<typeof KeptDb>[1]) {
  return new KeptDb(userId, options);
}

const extraId = (thingId: string) => `extra:${thingId}`;
const docId = (attachmentId: string) => `doc:${attachmentId}`;
const bodyId = (attachmentId: string) => `body:${attachmentId}`;

type DocMeta = SyncExtraDocument & { thingId: string };

const defaultFetch = async (url: string): Promise<ArrayBuffer> => {
  const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.arrayBuffer();
};

export async function keptLocations(db: KeptDb): Promise<KeptOfflineRow[]> {
  return db.keptOffline.toArray();
}

/** Bytes stored for every kept location on this device. */
export async function deviceBytes(db: KeptDb): Promise<number> {
  return (await db.keptOffline.toArray()).reduce((n, r) => n + r.bytes, 0);
}

async function othersOf(db: KeptDb, locationId: string) {
  return (await db.keptOffline.toArray())
    .filter((r) => r.locationId !== locationId)
    .map((r) => ({ locationId: r.locationId, bytes: r.bytes }));
}

const tooLarge = (kept: { locationId: string; bytes: number }[], needed: number) =>
  new KeepOfflineTooLarge(
    needed,
    [...kept].sort((a, b) => b.bytes - a.bytes),
  );

/**
 * Keeps (or refreshes) a location: checks the estimate against the device's cap, then fetches
 * every page and document, sealing each under `key`.
 */
export async function keepLocation(
  db: KeptDb,
  key: CryptoKey,
  locationId: string,
  api: ExtrasApi,
  onProgress?: (p: KeepProgress) => void,
): Promise<KeptOfflineRow> {
  const fetchBytes = api.fetchBytes ?? defaultFetch;
  const run = Array.from(randomBytes(8), (b) => b.toString(16).padStart(2, '0')).join('');
  const staged = db.extraDocDownloads.where('locationId').equals(locationId);
  const previous = await db.transaction(
    'rw',
    db.meta,
    db.keptOffline,
    db.extraDocDownloads,
    async () => {
      if (await db.meta.get('lockedAt')) throw new Error('the offline cache is locked');
      const current = await db.keptOffline.get(locationId);
      await staged.delete(); // Clear an interrupted or superseded download for this location.
      await db.keptOffline.put({ ...summary('downloading', current), downloadId: run });
      return current;
    },
  );

  const things: ExtraRow[] = [];
  const totals = { things: 0, documents: 0, bytes: 0, tooLarge: 0 };
  let estimateAccepted = false;
  try {
    const others = await othersOf(db, locationId);
    const elsewhere = others.reduce((n, r) => n + r.bytes, 0);
    const estimate = await api.estimate(locationId);
    if (elsewhere + estimate.totalBytes > KEEP_OFFLINE.deviceBytes) {
      throw tooLarge(others, elsewhere + estimate.totalBytes);
    }
    estimateAccepted = true;
    onProgress?.({ done: 0, total: estimate.totalBytes });
    let cursor: string | undefined;
    for (;;) {
      const page = await api.page(locationId, cursor);
      for (const item of page.items) {
        totals.things += 1;
        things.push({
          thingId: item.thingId,
          locationId,
          run,
          sealed: await sealJson(key, extraId(item.thingId), item),
        });
        for (const doc of item.documents) {
          const stagedDoc = await downloadDocument(doc, item.thingId, others, elsewhere);
          await db.transaction('rw', db.keptOffline, db.extraDocDownloads, async () => {
            await requireActiveDownload();
            await db.extraDocDownloads.put(stagedDoc);
          });
          totals.documents += 1;
          if (doc.bytes > KEEP_OFFLINE.fileBytes) {
            totals.tooLarge += 1;
          } else {
            totals.bytes += stagedDoc.bytes;
            onProgress?.({
              done: totals.bytes,
              total: Math.max(estimate.totalBytes, totals.bytes),
            });
          }
        }
      }
      if (!page.next_cursor) break;
      cursor = page.next_cursor;
    }
    return await db.transaction(
      'rw',
      EXTRAS_TABLES.map((table) => db[table]),
      async () => {
        await requireActiveDownload();
        // Another location may have finished downloading while this one fetched files.
        const kept = await othersOf(db, locationId);
        const needed = kept.reduce((n, r) => n + r.bytes, totals.bytes);
        if (needed > KEEP_OFFLINE.deviceBytes) throw tooLarge(kept, needed);

        await db.extras.bulkPut(things);
        // Move one document at a time so there is no need to load every encrypted body into memory.
        for (const id of await staged.primaryKeys()) {
          const pending = await db.extraDocDownloads.get(id);
          if (!pending) throw new Error('a staged offline document is missing');
          const { cachedRun, ...doc } = pending;
          if (cachedRun !== undefined) {
            const cached = await db.extraDocs.get(doc.attachmentId);
            if (!cached?.body || cached.locationId !== locationId || cached.run !== cachedRun) {
              throw new Error('a cached offline document changed during the download');
            }
            doc.body = cached.body;
          }
          await db.extraDocDownloads.delete(id);
          await db.extraDocs.put(doc);
        }
        const fromPreviousRun = (row: { run: string }) => row.run !== run;
        await db.extras.where('locationId').equals(locationId).filter(fromPreviousRun).delete();
        await db.extraDocs.where('locationId').equals(locationId).filter(fromPreviousRun).delete();
        const ready: KeptOfflineRow = {
          locationId,
          state: 'ready',
          ...totals,
          updatedAt: Date.now(),
        };
        await db.keptOffline.put(ready);
        return ready;
      },
    );
  } catch (e) {
    await db
      .transaction('rw', db.keptOffline, db.extraDocDownloads, async () => {
        if ((await db.keptOffline.get(locationId))?.downloadId !== run) return;
        await staged.delete();
        if (estimateAccepted || previous?.state === 'downloading') {
          await db.keptOffline.put(summary('failed', previous));
        } else if (previous) {
          await db.keptOffline.put(previous);
        } else {
          await db.keptOffline.delete(locationId);
        }
      })
      .catch(() => {
        // Preserve the original failure. A retry or cache removal can also clear the staged rows.
      });
    throw e;
  }

  function summary(state: 'downloading' | 'failed', kept?: KeptOfflineRow): KeptOfflineRow {
    return {
      locationId,
      state,
      things: kept?.things ?? 0,
      documents: kept?.documents ?? 0,
      bytes: kept?.bytes ?? 0,
      tooLarge: kept?.tooLarge ?? 0,
      updatedAt: kept?.updatedAt ?? null,
    };
  }

  async function requireActiveDownload() {
    if ((await db.keptOffline.get(locationId))?.downloadId !== run) {
      throw new Error('the offline download was cancelled');
    }
  }

  async function downloadDocument(
    doc: SyncExtraDocument,
    thingId: string,
    others: { locationId: string; bytes: number }[],
    elsewhere: number,
  ): Promise<ExtraDocDownloadRow> {
    const { attachmentId } = doc;
    const meta: DocMeta = { ...doc, thingId };
    const row: ExtraDocDownloadRow = {
      attachmentId,
      locationId,
      thingId,
      run,
      meta: await sealJson(key, docId(attachmentId), meta),
      bytes: 0,
      body: null,
    };
    if (doc.bytes > KEEP_OFFLINE.fileBytes) return row;

    const needed = elsewhere + totals.bytes + doc.bytes;
    if (needed > KEEP_OFFLINE.deviceBytes) throw tooLarge(others, needed);
    // Read just this document. An unchanged body stays in place until publication.
    const cached = await db.extraDocs.get(attachmentId);
    if (cached?.body && cached.locationId === locationId) {
      const cachedMeta = await unsealJson<DocMeta>(key, docId(attachmentId), cached.meta).catch(
        () => null,
      );
      if (cachedMeta?.sha256 === doc.sha256) {
        return { ...row, bytes: cached.bytes, cachedRun: cached.run };
      }
    }

    const { url } = await api.fileUrl(doc.fileId, thingId);
    const bytes = await fetchBytes(url);
    if ((await sha256Hex(bytes)) !== doc.sha256) throw new KeepOfflineCorrupt(attachmentId);
    return { ...row, bytes: bytes.byteLength, body: await seal(key, bodyId(attachmentId), bytes) };
  }
}

/** The toggle goes off: everything kept for the location goes. */
export async function dropLocation(db: KeptDb, locationId: string): Promise<void> {
  const tables = EXTRAS_TABLES.map((table) => db[table]);
  await db.transaction('rw', tables, async () => {
    for (const table of tables) await table.where('locationId').equals(locationId).delete();
  });
}

/** Everything kept, every location (the app lock turned off). */
export async function dropAll(db: KeptDb): Promise<void> {
  const tables = EXTRAS_TABLES.map((table) => db[table]);
  await db.transaction('rw', tables, async () => {
    for (const table of tables) await table.clear();
  });
}

/** A kept thing's money and documents, or null when its location isn't kept. */
export async function extraOf(
  db: KeptDb,
  key: CryptoKey,
  thingId: string,
): Promise<{ extra: SyncExtra; documents: KeptDocument[] } | null> {
  const kept = await db.transaction('r', db.extras, db.extraDocs, async () => {
    const row = await db.extras.get(thingId);
    if (!row) return null;
    const docs = await db.extraDocs.where('thingId').equals(thingId).toArray();
    return { row, docs };
  });
  if (!kept) return null;
  const { row, docs } = kept;
  const extra = await unsealJson<SyncExtra>(key, extraId(thingId), row.sealed);
  const documents: KeptDocument[] = [];
  for (const d of docs) {
    const meta = await unsealJson<DocMeta>(key, docId(d.attachmentId), d.meta);
    documents.push({ ...meta, tooLarge: d.body === null });
  }
  return { extra, documents };
}

/** Whether a thing's location is kept (no key needed: the row's presence only). */
export async function isKept(db: KeptDb, thingId: string): Promise<boolean> {
  return (await db.extras.get(thingId)) !== undefined;
}

/** The documents of a location too large to keep offline. */
export async function tooLargeOf(
  db: KeptDb,
  key: CryptoKey,
  locationId: string,
): Promise<KeptDocument[]> {
  const rows = await db.extraDocs
    .where('locationId')
    .equals(locationId)
    .filter((d) => d.body === null)
    .toArray();
  const out: KeptDocument[] = [];
  for (const d of rows) {
    out.push({
      ...(await unsealJson<DocMeta>(key, docId(d.attachmentId), d.meta)),
      tooLarge: true,
    });
  }
  return out;
}

/** A kept document's bytes, as a Blob of its type; null when not kept. */
export async function documentBlob(
  db: KeptDb,
  key: CryptoKey,
  attachmentId: string,
): Promise<Blob | null> {
  const row = await db.extraDocs.get(attachmentId);
  if (!row?.body) return null;
  const meta = await unsealJson<DocMeta>(key, docId(attachmentId), row.meta);
  const bytes = await unseal(key, bodyId(attachmentId), row.body);
  return new Blob([bytes], { type: meta.mime });
}
