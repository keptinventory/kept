import { createHash, randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { EXPORT_PATHS, type ExportEntity } from '@kept/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import yauzl from 'yauzl';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import { type TestFiles, testFiles } from '../../test/files.js';
import { forgeKeptExport, stageKeptRun } from '../../test/kept-export.js';
import { call, join, type Person, peopleApp, person } from '../../test/people.js';
import { createLocation, type Loc, ok, own, place, setDisplayName } from '../../test/things.js';
import { fixedSecretKeys, keyringOf } from '../crypto/keyring.js';
import { entitySchema } from '../exports/format.js';
import { buildExport } from '../exports/job.js';
import { importedId } from '../imports/kept/ids.js';
import { runKeptImport } from '../imports/kept/job.js';
import { openKeptArchive, readManifest } from '../imports/kept/read.js';
import { exportKey, importArchiveKey } from '../storage/blob-store.js';

// Moves in a Kept export. Louis packs Flat in three moves: one within Flat (a box packed
// for the study, one in transit, one unpacked into the hallway), one that is done, and one going
// to House. Ibrahim exports Flat (the real export job) and Nora imports it on another server (a
// fresh database and blob store, the real import job). The moves come back with their names and
// status, the done one done at the same time; each box with its number, state and when that
// changed, its room remapped, its container the imported box. The move to House comes in as a
// move within the new location, its rooms not chosen: the export holds one location, and House
// isn't it. Who changed a box's state is Nora, as every imported row's maker is. An export
// from before moves travelled (version 3) still imports.

vi.setConfig({ testTimeout: 300_000, hookTimeout: 300_000 });

const keys = fixedSecretKeys(keyringOf({ version: 1, key: randomBytes(32), retired: new Map() }));
const log = { info: () => {}, error: () => {} };

let db: TestDb;
let db2: TestDb;
let files: TestFiles;
let files2: TestFiles;
let t: TestApp;
let t2: TestApp;
let ibrahim: Person;
let louis: Person;
let nora: Person;
let flat: Loc;
let house: Loc;
let target: Loc;
let hallway: string;
let study: string;
let kitchen: string;
let archive: { file: string; bytes: number; sha256: string; dir: string };
let runId: string;
let runAt: number;

type Box = {
  moveId: string;
  containerId: string;
  number: number;
  state: string;
  stateAt: string;
  stateBy: { displayName: string } | null;
  name: string | null;
  placeId: string | null;
  destination: { placeId: string; name: string; locationId: string } | null;
  rowVersion: number;
};
type Move = {
  id: string;
  locationId: string;
  toLocationId: string | null;
  name: string;
  status: string;
  finishedAt: string | null;
  counts: { packed: number; in_transit: number; unpacked: number; total: number };
  boxes: Box[];
  rowVersion: number;
};

let within: Move;
let done: Move;
let away: Move;

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const read = async (app: TestApp, as: Person, id: string) =>
  ok(await call(app, `/api/v1/moves/${id}`, { as })) as unknown as Move;
const start = async (body: object) =>
  ok(
    await call(t, `/api/v1/locations/${flat.id}/moves`, { as: louis, body }),
    201,
  ) as unknown as Move;
const newBox = async (moveId: string, destinationPlaceId?: string) =>
  ok(
    await call(t, `/api/v1/moves/${moveId}/boxes`, {
      as: louis,
      body: { new: { prefix: 'Box' }, ...(destinationPlaceId ? { destinationPlaceId } : {}) },
    }),
    201,
  ) as unknown as Box;
const mark = async (moveId: string, containerId: string, state: string) =>
  ok(
    await call(t, `/api/v1/moves/${moveId}/boxes/${containerId}`, {
      method: 'PATCH',
      as: louis,
      body: { state },
    }),
  );
const unpack = async (moveId: string, containerId: string) =>
  ok(await call(t, `/api/v1/moves/${moveId}/boxes/${containerId}/unpack`, { as: louis, body: {} }));

/** Every entry name of a ZIP on disk. */
function entryNames(file: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true }, (err, z) => {
      if (err || !z) return reject(err);
      const names: string[] = [];
      z.on('entry', (e: yauzl.Entry) => {
        names.push(e.fileName);
        z.readEntry();
      });
      z.on('end', () => {
        z.close();
        resolve(names);
      });
      z.on('error', reject);
      z.readEntry();
    });
  });
}

const acknowledgeKit = (d: TestDb) =>
  own(
    d,
    `INSERT INTO public.instance_settings (key, value)
     VALUES ('recovery_kit_acknowledged_at', to_jsonb(now())) ON CONFLICT (key) DO NOTHING`,
  );

const importAs = (person: Person, run: string) =>
  runKeptImport(
    { pools: db2.pools, files: files2, keys, log },
    { userId: person.userId, mfa: true },
    run,
  );

const runRow = async (id: string) =>
  (
    await own<{ status: string; error: string | null; created_at: Date }>(
      db2,
      'SELECT status, error, created_at FROM public.import_runs WHERE id = $1',
      [id],
    )
  )[0];

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  files = await testFiles();
  await acknowledgeKit(db);
  // An export is https only.
  t = await peopleApp(db, {
    sent: [],
    files,
    secretKeys: keys,
    publicUrl: 'https://kept.example',
  });
  ibrahim = await person(t, db, 'ibrahim');
  louis = await person(t, db, 'louis');
  await setDisplayName(db, ibrahim, 'Ibrahim');
  await setDisplayName(db, louis, 'Louis');
  flat = await createLocation(t, db, ibrahim, 'complete', 'Flat');
  house = await createLocation(t, db, ibrahim, 'complete', 'House');
  await join(db, flat.id, louis.userId, 'member');
  await join(db, house.id, louis.userId, 'member');
  hallway = await place(db, flat, 'Hallway');
  study = await place(db, flat, 'Study');
  kitchen = await place(db, house, 'Kitchen');

  // Within Flat: Box 1 packed for the study, Box 2 in transit, Box 3 unpacked into the hallway.
  const a = await start({ name: 'Spring clear-out' });
  await newBox(a.id, study);
  const b2 = await newBox(a.id);
  await mark(a.id, b2.containerId, 'in_transit');
  const b3 = await newBox(a.id, hallway);
  await unpack(a.id, b3.containerId);
  within = await read(t, louis, a.id);

  // A move that is over: its one box unpacked into the study, and the move marked done.
  const d = await start({ name: 'Last spring' });
  const d1 = await newBox(d.id, study);
  await unpack(d.id, d1.containerId);
  const open = await read(t, louis, d.id);
  ok(
    await call(t, `/api/v1/moves/${d.id}`, {
      method: 'PATCH',
      as: louis,
      headers: ifMatch(open.rowVersion),
      body: { status: 'done' },
    }),
  );
  done = await read(t, louis, d.id);
  expect(done.finishedAt).not.toBeNull();

  // To House: one box packed for House's kitchen.
  const h = await start({ name: 'To the house', toLocationId: house.id });
  await newBox(h.id, kitchen);
  away = await read(t, louis, h.id);

  // Ibrahim exports Flat, through the route and the real job.
  const res = await call(t, '/api/v1/exports', {
    as: ibrahim,
    body: { scope: { locationId: flat.id }, options: { readable: true, pdf: false } },
  });
  expect(res.statusCode, res.body).toBe(202);
  const { id: exportId } = res.json() as { id: string };
  const outcome = await buildExport(
    { pools: db.pools, files, secretKeys: keys, publicUrl: 'https://kept.example', log },
    { userId: ibrahim.userId, mfa: false },
    { exportId },
  );
  expect(outcome.status).toBe('done');
  const dir = await mkdtemp(path.join(tmpdir(), 'kept-moves-'));
  const file = path.join(dir, 'flat.zip');
  const hash = createHash('sha256');
  const stream = await files.blobs.stream(exportKey(exportId));
  stream.on('data', (c: Buffer) => hash.update(c));
  await pipeline(stream, createWriteStream(file));
  archive = { file, bytes: (await stat(file)).size, sha256: hash.digest('hex'), dir };

  // Nora, on another server.
  db2 = await testDb('b');
  await db2.reset();
  files2 = await testFiles();
  await acknowledgeKit(db2);
  t2 = await peopleApp(db2, { files: files2, secretKeys: keys });
  nora = await person(t2, db2, 'nora');
  await setDisplayName(db2, nora, 'Nora');
  target = await createLocation(t2, db2, nora, 'complete', 'Flat');
  runId = await stageKeptRun(
    db2,
    files2,
    { ...archive, manifest: { keptVersion: 'test' } as never },
    { userId: nora.userId, locationId: target.id },
  );
  await importAs(nora, runId);
  const run = await runRow(runId);
  expect(run).toMatchObject({ status: 'done', error: null });
  runAt = run?.created_at.getTime() ?? 0;
});

afterAll(async () => {
  await t?.app.close();
  await t2?.app.close();
  await files?.cleanup();
  await files2?.cleanup();
  if (archive) await rm(archive.dir, { recursive: true, force: true });
});

const newIdOf = (oldId: string) => importedId(runId, oldId, runAt);

/** A box as the board shows it, its ids mapped with `idOf`. */
const shape = (b: Box, idOf: (id: string) => string) => ({
  containerId: idOf(b.containerId),
  number: b.number,
  state: b.state,
  stateAt: b.stateAt,
  name: b.name,
  destination: b.destination ? idOf(b.destination.placeId) : null,
});

describe('a Kept export with moves', () => {
  it('holds the moves and their boxes, without a user of this server (format version 4)', async () => {
    const staged = await stageKeptRun(
      db,
      files,
      { ...archive, manifest: { keptVersion: 'x' } as never },
      { userId: ibrahim.userId, locationId: flat.id, status: 'draft' },
    );
    const opened = await openKeptArchive(files.blobs, staged, archive.bytes);
    try {
      const manifest = await readManifest(opened);
      expect(manifest.version).toBeGreaterThanOrEqual(4);
      expect(manifest.counts.moves).toBe(3);
      expect(manifest.counts['move-boxes']).toBe(5);
      const rows: Record<string, unknown>[] = [];
      for (const entity of ['moves', 'move-boxes'] as const) {
        for await (const r of opened.ndjson(EXPORT_PATHS.data(entity), entitySchema(entity))) {
          rows.push(r as Record<string, unknown>);
        }
      }
      expect(rows.find((r) => r.id === done.id)).toMatchObject({
        name: 'Last spring',
        status: 'done',
        finishedAt: done.finishedAt,
      });
      expect(JSON.stringify(rows)).not.toContain(ibrahim.userId);
      expect(JSON.stringify(rows)).not.toContain(louis.userId);
    } finally {
      opened.close();
    }
    // The readable copy has them as spreadsheets too.
    const names = await entryNames(archive.file);
    expect(names).toContain('readable/moves.csv');
    expect(names).toContain('readable/move-boxes.csv');
  });

  it('imports each move and its boxes as they were: numbers, states, when, rooms', async () => {
    for (const source of [within, done]) {
      const got = await read(t2, nora, newIdOf(source.id));
      expect(got).toMatchObject({
        locationId: target.id,
        toLocationId: null,
        name: source.name,
        status: source.status,
        finishedAt: source.finishedAt,
        counts: source.counts,
      });
      expect(got.boxes.map((b) => shape(b, (id) => id))).toEqual(
        source.boxes.map((b) => shape(b, newIdOf)),
      );
      // Who changed each box is the importing person.
      for (const b of got.boxes) expect(b.stateBy).toEqual({ displayName: 'Nora' });
    }
    // The unpacked box is in the imported hallway, as it was.
    const unpacked = (await read(t2, nora, newIdOf(within.id))).boxes.find((b) => b.number === 3);
    expect(unpacked?.placeId).toBe(newIdOf(hallway));
  });

  it('brings a move to another location in as a move within this one, its rooms to choose again', async () => {
    const got = await read(t2, nora, newIdOf(away.id));
    expect(got).toMatchObject({ name: 'To the house', status: 'active', toLocationId: null });
    expect(got.boxes).toHaveLength(1);
    expect(got.boxes[0]).toMatchObject({ number: 1, state: 'packed', destination: null });
    expect(away.boxes[0]?.destination?.placeId).toBe(kitchen);
  });

  it('keeps a done move done: its boxes take no change until it is opened again', async () => {
    const got = await read(t2, nora, newIdOf(done.id));
    const box = got.boxes[0] as Box;
    const res = await call(t2, `/api/v1/moves/${got.id}/boxes/${box.containerId}`, {
      method: 'PATCH',
      as: nora,
      body: { state: 'packed' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ reason: 'move_done' });
    // The open one takes a new box, numbered after the imported ones.
    const added = ok(
      await call(t2, `/api/v1/moves/${newIdOf(within.id)}/boxes`, {
        as: nora,
        body: { new: { prefix: 'Box' } },
      }),
      201,
    ) as unknown as Box;
    expect(added.number).toBe(4);
  });

  it('writes nothing twice when the job runs again', async () => {
    const settled = async () =>
      Promise.all(
        [within, done, away].map(async (m) => {
          const got = await read(t2, nora, newIdOf(m.id));
          return { ...got, boxes: got.boxes.map((b) => shape(b, (id) => id)) };
        }),
      );
    const before = await settled();
    await own(db2, `UPDATE public.import_runs SET status = 'running' WHERE id = $1`, [runId]);
    await files2.blobs.put(importArchiveKey(runId), archive.file, {
      contentType: 'application/zip',
      bytes: archive.bytes,
    });
    await importAs(nora, runId);
    expect(await settled()).toEqual(before);
  });

  it('still imports an export from before moves travelled (version 3)', async () => {
    const forged = await forgeKeptExport(db, {
      userId: ibrahim.userId,
      locationId: flat.id,
      files,
      mutate: (m, entries) => {
        // As Kept 1.6 to 1.10 wrote it: no moves and no counts for them.
        m.version = 3;
        const counts = m.counts as Partial<Record<ExportEntity, number>>;
        for (const e of ['moves', 'move-boxes'] as const) {
          delete counts[e];
          entries.delete(EXPORT_PATHS.data(e));
        }
      },
    });
    try {
      const older = await createLocation(t2, db2, nora, 'complete', 'Flat, from 1.10');
      const run = await stageKeptRun(db2, files2, forged, {
        userId: nora.userId,
        locationId: older.id,
      });
      const opened = await openKeptArchive(files2.blobs, run, forged.bytes);
      const manifest = await readManifest(opened);
      opened.close();
      expect(manifest.counts.moves).toBe(0);
      await importAs(nora, run);
      expect(await runRow(run)).toMatchObject({ status: 'done', error: null });
      const [things] = await own<{ n: number }>(
        db2,
        'SELECT count(*)::int AS n FROM public.things WHERE location_id = $1',
        [older.id],
      );
      // The five boxes came in as things; no move did.
      expect(things?.n).toBe(5);
      const [moves] = await own<{ n: number }>(
        db2,
        'SELECT count(*)::int AS n FROM public.moves WHERE location_id = $1',
        [older.id],
      );
      expect(moves?.n).toBe(0);
    } finally {
      await forged.cleanup();
    }
  });
});
