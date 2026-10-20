import { newId } from '@kept/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import { type TestFiles, testFiles, upload } from '../../test/files.js';
import { call, join, type Person, peopleApp, person, type RecordedJob } from '../../test/people.js';
import { roomPhoto } from '../../test/room-photos.js';
import { createLocation, type Json, type Loc, ok, own, place } from '../../test/things.js';
import { providerKeyAad } from '../ai/db-keys.js';
import { type MockAnswer, mockKey } from '../ai/mock.js';
import { aiRuntime } from '../ai/runtime.js';
import { seal } from '../crypto/envelope.js';
import { partsFor } from '../extraction/image.js';
import { type ExtractionJobDeps, runExtraction } from '../extraction/job.js';
import type { RoomResult } from './finish.js';

// Room photos (#194) end to end through the mock provider: POST /captures in ROOM mode, the
// `extract` job per photo, and the last photo's finish (merge, already in Kept, drafts).

let db: TestDb;
let t: TestApp;
let files: TestFiles;
const sent: RecordedJob[] = [];
let ibrahim: Person; // owner of Home
let louis: Person; // member of Home
let talia: Person; // viewer of Home
let home: Loc;
let study: string;

const MASTER = { key: Buffer.alloc(32, 9), keyVersion: 1 };
const keyring = new Map([[1, MASTER.key]]);
const silent = { warn: () => {}, info: () => {}, error: () => {} };
let answers: Record<string, MockAnswer> = {};
let seed = 0;

const deps = (): ExtractionJobDeps => ({
  pools: db.pools,
  ai: {
    mock: true,
    runtime: (scope) =>
      aiRuntime({ pools: db.pools, keyring: () => keyring, log: silent, mock: answers }, scope),
  },
  files,
  sendLater: async () => {},
  log: silent,
});

const c = <T>(value: T, confidence = 0.9) => ({ value, confidence });
const obj = (
  name: string,
  bbox: [number, number, number, number],
  kind = 'item',
  more: Record<string, unknown> = {},
) => ({ bbox, kind, name: c(name), aliases: { en: [name.toLowerCase()] }, ...more });

async function photo(as: Person = louis): Promise<{ fileId: string; bytes: Buffer }> {
  const bytes = await roomPhoto(++seed);
  const res = await upload(t, as, home.id, bytes, { cls: 'photo' });
  expect(res.statusCode, res.body).toBe(201);
  return { fileId: (res.json() as { id: string }).id, bytes };
}

/** The mock's key for what the job sends for this file. */
async function keyOf(fileId: string): Promise<string> {
  const parts = await partsFor(
    'room',
    [{ attachmentId: 'a', fileId, locationId: home.id, mime: 'image/jpeg' }],
    { blobs: files.blobs, textOf: async () => null },
  );
  const img = parts.images[0];
  if (!img) throw new Error('nothing to send');
  return mockKey(img.bytes);
}

function capture(as: Person, over: Record<string, unknown>) {
  return call(t, '/api/v1/captures', {
    as,
    body: {
      id: newId(),
      locationId: home.id,
      target: { placeId: study },
      mode: 'room',
      batchId: newId(),
      files: [],
      ...over,
    },
    headers: { 'idempotency-key': newId() },
  });
}

const roomRow = async (id: string) =>
  (
    await own<{
      status: string;
      place_id: string | null;
      container_id: string | null;
      codes: string[];
      attachment_ids: string[];
      result: RoomResult | null;
    }>(
      db,
      `SELECT status, place_id, container_id, codes, attachment_ids, result
         FROM public.room_captures WHERE id = $1`,
      [id],
    )
  )[0];

const photosOf = (roomId: string) =>
  own<{ id: string; status: string; attachment_id: string; mode: string }>(
    db,
    `SELECT id, status, attachment_id, mode FROM public.extractions
      WHERE room_capture_id = $1 ORDER BY created_at, id`,
    [roomId],
  );

/** Captures `n` photos with these answers, runs every photo's job, and answers the room. */
async function roomOf(objectsPerPhoto: unknown[][], over: Record<string, unknown> = {}) {
  const shots = [];
  for (const objects of objectsPerPhoto) {
    const p = await photo();
    answers[await keyOf(p.fileId)] = { output: { objects } };
    shots.push(p);
  }
  const batchId = newId();
  const out = ok(
    await capture(louis, {
      batchId,
      files: shots.map((s) => ({ fileId: s.fileId, role: 'photo' })),
      ...over,
    }),
    201,
  ) as Json & { room: { id: string } };
  for (const ex of await photosOf(out.room.id)) {
    await runExtraction(deps(), { userId: louis.userId, mfa: false }, ex.id);
  }
  return { id: out.room.id, batchId, row: await roomRow(out.room.id) };
}

const thing = async (id: string) =>
  (
    await own<{
      name: string | null;
      review_state: string;
      place_id: string | null;
      container_id: string | null;
      capture_batch_id: string | null;
      model: string | null;
      colour: string | null;
      field_status: Record<string, { state: string }>;
    }>(
      db,
      `SELECT name, review_state, place_id, container_id, capture_batch_id, model, colour,
              field_status
         FROM public.things WHERE id = $1`,
      [id],
    )
  )[0];

async function seedThing(name: string, over: { placeId?: string; containerId?: string } = {}) {
  const id = newId();
  await own(
    db,
    `INSERT INTO public.things (id, location_id, place_id, container_id, name)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      id,
      home.id,
      over.containerId ? null : (over.placeId ?? study),
      over.containerId ?? null,
      name,
    ],
  );
  return id;
}

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  files = await testFiles();
  t = await peopleApp(db, { files, sent });
  ibrahim = await person(t, db, 'ibrahim');
  louis = await person(t, db, 'louis');
  talia = await person(t, db, 'talia');
  home = await createLocation(t, db, ibrahim, 'household');
  await join(db, home.id, louis.userId, 'member');
  await join(db, home.id, talia.userId, 'viewer');
  study = await place(db, home, 'Study');
  const providerId = newId();
  await own(
    db,
    `INSERT INTO public.ai_providers (id, scope, owner_account_id, kind, key_ciphertext,
                                      key_version, models, created_by)
     VALUES ($1, 'account', $2, 'groq', $3, 1, '{"vision": "qwen/qwen3.8-27b"}', $4)`,
    [
      providerId,
      home.accountId,
      JSON.stringify(seal(MASTER, 'gsk_TESTKEY-room', providerKeyAad(providerId))),
      ibrahim.userId,
    ],
  );
});

beforeEach(() => {
  answers = {};
});

afterAll(async () => {
  await t.app.close();
  await files.cleanup();
});

describe('a room capture', () => {
  it('puts the photos on the place, reads each one, and opens one room item in the batch', async () => {
    const shots = [await photo(), await photo(), await photo()];
    const batchId = newId();
    const res = await capture(louis, {
      batchId,
      files: shots.map((s) => ({ fileId: s.fileId, role: 'photo' })),
      codes: ['K7D2QX', 'K7D2QX'],
    });
    const out = ok(res, 201) as Json & {
      room: { id: string; photos: number; status: string };
      inboxItemId: string;
    };
    expect(out.room).toMatchObject({ photos: 3, status: 'reading' });
    const row = await roomRow(out.room.id);
    expect(row).toMatchObject({ status: 'reading', place_id: study, container_id: null });
    expect(row?.codes).toEqual(['K7D2QX']);
    const photos = await own<{ id: string; place_id: string; role: string; sort: number }>(
      db,
      'SELECT id, place_id, role, sort FROM public.attachments WHERE id = ANY ($1::uuid[]) ORDER BY sort',
      [row?.attachment_ids],
    );
    expect(photos.map((p) => [p.place_id, p.role])).toEqual([
      [study, 'photo'],
      [study, 'photo'],
      [study, 'photo'],
    ]);
    const exs = await photosOf(out.room.id);
    expect(exs.map((e) => [e.mode, e.status])).toEqual([
      ['room', 'queued'],
      ['room', 'queued'],
      ['room', 'queued'],
    ]);
    expect(exs.map((e) => e.attachment_id)).toEqual(row?.attachment_ids);
    const items = await own<{ id: string; kind: string; batch_id: string }>(
      db,
      `SELECT id, kind, batch_id FROM public.inbox_items
        WHERE room_capture_id = $1 AND resolved_at IS NULL`,
      [out.room.id],
    );
    expect(items).toEqual([{ id: out.inboxItemId, kind: 'room', batch_id: batchId }]);
    expect(
      await own(
        db,
        `SELECT entity_type, entity_id FROM public.audit_events
          WHERE action = 'room.capture' AND location_id = $1 ORDER BY at DESC LIMIT 1`,
        [home.id],
      ),
    ).toEqual([{ entity_type: 'place', entity_id: study }]);
  });

  it('into a box: the photos go on the box', async () => {
    const box = await seedThing('Archive box');
    const p = await photo();
    const out = ok(
      await capture(louis, {
        target: { containerId: box },
        files: [{ fileId: p.fileId, role: 'photo' }],
      }),
      201,
    ) as Json & { room: { id: string } };
    expect(await roomRow(out.room.id)).toMatchObject({ place_id: null, container_id: box });
  });

  it('refuses no photo, six photos, the Unplaced area, a name, and codes on another mode', async () => {
    const six: { fileId: string }[] = [];
    for (let i = 0; i < 6; i++) six.push(await photo());
    const f = (n: number) => six.slice(0, n).map((s) => ({ fileId: s.fileId, role: 'photo' }));
    expect((await capture(louis, { files: [] })).statusCode).toBe(400);
    expect((await capture(louis, { files: f(6) })).statusCode).toBe(400);
    expect((await capture(louis, { files: f(1), target: { unplaced: true } })).statusCode).toBe(
      400,
    );
    expect(
      (await capture(louis, { files: f(1), target: { placeId: home.unplacedId } })).statusCode,
    ).toBe(400);
    expect((await capture(louis, { files: f(1), name: 'Study' })).statusCode).toBe(400);
    expect(
      (await capture(louis, { files: f(1), mode: 'thing', codes: ['K7D2QX'] })).statusCode,
    ).toBe(400);
  });

  it('is refused to a viewer', async () => {
    const p = await photo(ibrahim);
    const res = await capture(talia, { files: [{ fileId: p.fileId, role: 'photo' }] });
    expect(res.statusCode).toBe(403);
  });
});

describe('reading and finishing a room', () => {
  it('reads each photo, merges the same object, and drafts the rest with its own picture', async () => {
    const { row, batchId } = await roomOf(
      [
        [obj('Desk lamp', [0.1, 0.1, 0.2, 0.3], 'item', { type_hint: c('lamp') })],
        [
          obj('Desk lamp', [0.2, 0.1, 0.4, 0.5], 'item', { type_hint: c('lamp') }),
          obj('Office chair', [0.5, 0.4, 0.3, 0.5], 'furniture', { colour: c('black') }),
        ],
      ],
      {},
    );
    expect(row?.status).toBe('ready');
    const result = row?.result as RoomResult;
    // The mock's default merge names no groups: the same name and type merge by names only when
    // the call can't be had, so with the call both lamps stay... unless answered.
    expect(result.merged).toBe('model');
    expect(result.photos.map((p) => [p.status, p.objects])).toEqual([
      ['read', 1],
      ['read', 2],
    ]);
    expect(result.drafts).toHaveLength(3);
    const chair = result.drafts.find((d) => d.name === 'Office chair');
    expect(chair).toMatchObject({ kind: 'furniture', photo: 1 });
    const t1 = await thing(chair?.thingId as string);
    expect(t1).toMatchObject({
      name: 'Office chair',
      review_state: 'draft',
      place_id: study,
      capture_batch_id: batchId,
      colour: 'black',
    });
    expect(t1?.field_status.name?.state).toBe('extracted');
    const pics = await own<{ width: number; height: number }>(
      db,
      `SELECT f.width, f.height FROM public.attachments a JOIN public.files f ON f.id = a.file_id
        WHERE a.thing_id = $1`,
      [chair?.thingId],
    );
    // 30% × 50% of the 800 × 600 photo it was seen in.
    expect(pics).toEqual([{ width: 240, height: 300 }]);
    const drafts = await own<{ kind: string; extraction_id: string | null }>(
      db,
      `SELECT kind, extraction_id FROM public.inbox_items
        WHERE thing_id = $1 AND resolved_at IS NULL`,
      [chair?.thingId],
    );
    expect(drafts).toEqual([{ kind: 'draft', extraction_id: null }]);
  });

  it('merges what the merge call groups, keeping the clearest picture', async () => {
    answers.kept_room_merge = { output: { groups: [[0, 1]] } };
    const { row } = await roomOf([
      [obj('Bookcase', [0.1, 0.1, 0.2, 0.3], 'furniture')],
      [obj('Bookcase', [0.1, 0.1, 0.6, 0.6], 'furniture')],
    ]);
    const result = row?.result as RoomResult;
    expect(result.merged).toBe('model');
    expect(result.drafts).toEqual([
      expect.objectContaining({ name: 'Bookcase', photo: 1, kind: 'furniture' }),
    ]);
  });

  it('merges by name and type when the merge call fails', async () => {
    answers.kept_room_merge = { error: { status: 500 } };
    const { row } = await roomOf([
      [obj('Floor lamp', [0.1, 0.1, 0.2, 0.3], 'item', { type_hint: c('lamp') })],
      [obj('floor lamp', [0.1, 0.1, 0.2, 0.3], 'item', { type_hint: c('Lamp') })],
    ]);
    const result = row?.result as RoomResult;
    expect(result.merged).toBe('names');
    expect(result.drafts).toHaveLength(1);
  });

  it('leaves out what is already in the room, and lists it', async () => {
    const nook = await place(db, home, 'Reading nook', study);
    const radio = await seedThing('Radio', { placeId: nook });
    const { row } = await roomOf([
      [obj('Radio', [0.1, 0.1, 0.2, 0.3]), obj('Throw blanket', [0.5, 0.5, 0.2, 0.2])],
    ]);
    const result = row?.result as RoomResult;
    expect(result.already).toEqual([
      { thingId: radio, name: 'Radio', matchedBy: 'name_type', photo: 0, seen: false },
    ]);
    expect(result.drafts.map((d) => d.name)).toEqual(['Throw blanket']);
  });

  it('lists a thing whose label the phone read, wherever it is in the location', async () => {
    const kettle = await seedThing('Kettle', { placeId: home.unplacedId });
    await own(
      db,
      `INSERT INTO public.short_ids (code, location_id, thing_id, state) VALUES ($1, $2, $3, 'assigned')`,
      ['K3TM2Q', home.id, kettle],
    );
    const { row } = await roomOf([[obj('Electric kettle', [0.1, 0.1, 0.2, 0.3])]], {
      codes: ['K3TM2Q'],
    });
    const result = row?.result as RoomResult;
    // The label names the kettle for certain; the photo's own name for it differs.
    expect(result.already).toEqual([
      { thingId: kettle, name: 'Kettle', matchedBy: 'code', photo: null, seen: false },
    ]);
    expect(result.drafts.map((d) => d.name)).toEqual(['Electric kettle']);
  });

  it('proposes storage furniture as places, and drafts it in a box', async () => {
    const { row } = await roomOf([[obj('Wardrobe', [0.1, 0.1, 0.4, 0.8], 'storage')]]);
    const result = row?.result as RoomResult;
    expect(result.places).toEqual([
      expect.objectContaining({ index: 0, name: 'Wardrobe', placeId: null, photo: 0 }),
    ]);
    expect(result.drafts).toEqual([]);
    const box = await seedThing('Toy chest');
    const inBox = await roomOf([[obj('Shoe rack', [0.1, 0.1, 0.4, 0.4], 'storage')]], {
      target: { containerId: box },
    });
    expect(inBox.row?.result?.places).toEqual([]);
    expect(inBox.row?.result?.drafts.map((d) => d.name)).toEqual(['Shoe rack']);
  });

  it('notes a photo that could not be read, and the photo with more than it could list', async () => {
    const good = await photo();
    const bad = await photo();
    answers[await keyOf(good.fileId)] = {
      output: { objects: [obj('Picture frame', [0.1, 0.1, 0.2, 0.2])], more: true },
    };
    answers[await keyOf(bad.fileId)] = { text: 'not json' };
    const out = ok(
      await capture(louis, {
        files: [good, bad].map((s) => ({ fileId: s.fileId, role: 'photo' })),
      }),
      201,
    ) as Json & { room: { id: string } };
    for (const ex of await photosOf(out.room.id)) {
      await runExtraction(deps(), { userId: louis.userId, mfa: false }, ex.id);
    }
    const row = await roomRow(out.room.id);
    expect(row?.status).toBe('ready');
    expect(row?.result?.photos.map((p) => [p.status, p.objects, p.more])).toEqual([
      ['read', 1, true],
      ['failed', 0, false],
    ]);
  });

  it('waits for every photo, and fails when none could be read', async () => {
    const a = await photo();
    const b = await photo();
    answers[await keyOf(a.fileId)] = { text: 'not json' };
    answers[await keyOf(b.fileId)] = { text: 'not json' };
    const out = ok(
      await capture(louis, { files: [a, b].map((s) => ({ fileId: s.fileId, role: 'photo' })) }),
      201,
    ) as Json & { room: { id: string } };
    const [first, second] = await photosOf(out.room.id);
    await runExtraction(deps(), { userId: louis.userId, mfa: false }, first?.id as string);
    expect((await roomRow(out.room.id))?.status).toBe('reading');
    await runExtraction(deps(), { userId: louis.userId, mfa: false }, second?.id as string);
    expect((await roomRow(out.room.id))?.status).toBe('failed');
  });

  it('caps a photo at sixty objects', async () => {
    const many = Array.from({ length: 61 }, (_, i) =>
      obj(`Book ${i}`, [(i % 10) / 10, Math.floor(i / 10) / 10, 0.09, 0.09]),
    );
    const { row } = await roomOf([many]);
    expect(row?.result?.photos[0]).toMatchObject({ objects: 60, more: true });
    expect(row?.result?.drafts).toHaveLength(60);
  });
});

/** The audit actions written about one entity, oldest first. */
const auditActionsOf = async (entityId: string) =>
  (
    await own<{ action: string }>(
      db,
      'SELECT action FROM public.audit_events WHERE entity_id = $1 ORDER BY at, id',
      [entityId],
    )
  ).map((r) => r.action);

describe('the Room card', () => {
  type Card = {
    id: string;
    kind: string;
    rowVersion: number;
    batch: { id: string } | null;
    room?: {
      status: string;
      target: { kind: string; id: string; name: string };
      progress: { done: number; total: number };
      photos: { status: string; objects: number; thumbUrl: string | null }[];
      drafts: { made: number; waiting: number; failed: number };
      places: { index: number; name: string; placeId: string | null }[];
      already: { thingId: string; matchedBy: string; seen: boolean }[];
      keepPhotos: boolean;
    };
  };
  const cardOf = async (roomId: string, as: Person = louis): Promise<Card> => {
    const page = ok(
      await call(t, `/api/v1/inbox?locationId=${home.id}&mine=0&kind=room&limit=200`, { as }),
    ) as unknown as { items: Card[] };
    const [row] = await own<{ id: string }>(
      db,
      'SELECT id FROM public.inbox_items WHERE room_capture_id = $1',
      [roomId],
    );
    const card = page.items.find((i) => i.id === row?.id);
    if (!card) throw new Error('no card');
    return card;
  };
  const act = (as: Person, card: Card, verb: string, body: unknown = {}) =>
    call(t, `/api/v1/inbox/${card.id}/room/${verb}`, {
      as,
      body,
      headers: { 'if-match': String(card.rowVersion) },
    });

  it('shows the photos, the drafts, the proposed places and what is already in Kept', async () => {
    const lamp = await seedThing('Reading lamp');
    const { id, batchId } = await roomOf([
      [
        obj('Reading lamp', [0.1, 0.1, 0.2, 0.3]),
        obj('Bookcase', [0.4, 0.1, 0.4, 0.8], 'storage'),
        obj('Footstool', [0.5, 0.7, 0.2, 0.2], 'furniture'),
      ],
    ]);
    const card = await cardOf(id);
    expect(card.batch?.id).toBe(batchId);
    expect(card.room).toMatchObject({
      status: 'ready',
      target: { kind: 'place', id: study, name: 'Study' },
      progress: { done: 1, total: 1 },
      drafts: { made: 1, waiting: 1, failed: 0 },
      places: [{ index: 0, name: 'Bookcase', placeId: null }],
      already: [{ thingId: lamp, matchedBy: 'name_type', seen: false }],
      keepPhotos: false,
    });
    expect(card.room?.photos).toEqual([expect.objectContaining({ status: 'read', objects: 3 })]);
  });

  // catalogue: POST /api/v1/inbox/:id/room/places
  // catalogue: POST /api/v1/inbox/:id/room/seen
  it('adds proposed places once, marks listed things seen, and refuses others', async () => {
    const vase = await seedThing('Blue vase');
    const { id } = await roomOf([
      [obj('Blue vase', [0.1, 0.1, 0.2, 0.3]), obj('Cabinet', [0.4, 0.1, 0.4, 0.8], 'storage')],
    ]);
    let card = await cardOf(id);
    const index = card.room?.places[0]?.index as number;
    const added = ok(await act(louis, card, 'places', { indexes: [index] })) as unknown as {
      placeIds: string[];
    };
    expect(added.placeIds).toHaveLength(1);
    const [placeRow] = await own<{ name: string; parent_id: string; kind_key: string }>(
      db,
      'SELECT name, parent_id, kind_key FROM public.places WHERE id = $1',
      [added.placeIds[0]],
    );
    expect(placeRow).toEqual({ name: 'Cabinet', parent_id: study, kind_key: 'closet' });
    expect(await auditActionsOf(added.placeIds[0] as string)).toEqual(['place.create']);
    card = await cardOf(id);
    expect(card.room?.places).toEqual([
      { index, name: 'Cabinet', photo: 0, placeId: added.placeIds[0] },
    ]);
    // Again: nothing new.
    expect(
      (
        ok(await act(louis, card, 'places', { indexes: [index] })) as unknown as {
          placeIds: string[];
        }
      ).placeIds,
    ).toEqual([]);
    card = await cardOf(id);
    expect((await act(louis, card, 'seen', { thingIds: [study] })).statusCode).toBe(400);
    ok(await act(louis, card, 'seen', { thingIds: [vase] }));
    card = await cardOf(id);
    expect(card.room?.already).toEqual([expect.objectContaining({ thingId: vase, seen: true })]);
    const [seen] = await own<{ last_seen_at: Date | null }>(
      db,
      'SELECT last_seen_at FROM public.things WHERE id = $1',
      [vase],
    );
    expect(seen?.last_seen_at).toBeInstanceOf(Date);
    expect(await auditActionsOf(vase)).toEqual(['thing.seen']);
  });

  // catalogue: POST /api/v1/inbox/:id/room/done
  it('Done deletes the full photos, and keeps them where the location keeps room photos', async () => {
    const first = await roomOf([[obj('Desk clock', [0.1, 0.1, 0.2, 0.3])]]);
    const photosOfRoom = (ids: string[] | undefined) =>
      own(db, 'SELECT id FROM public.attachments WHERE id = ANY ($1::uuid[])', [ids]);
    expect(await photosOfRoom(first.row?.attachment_ids)).toHaveLength(1);
    const card = await cardOf(first.id);
    expect(ok(await act(louis, card, 'done'))).toEqual({ photosKept: false });
    expect(await photosOfRoom(first.row?.attachment_ids)).toHaveLength(0);
    expect(await auditActionsOf(first.row?.attachment_ids[0] as string)).toEqual([
      'attachment.delete',
    ]);
    expect(await auditActionsOf(card.id)).toEqual(['inbox.resolve']);
    // The draft stays, with its own picture.
    const draft = first.row?.result?.drafts[0]?.thingId as string;
    expect((await thing(draft))?.review_state).toBe('draft');
    expect(
      await own(
        db,
        `SELECT 1 FROM public.inbox_items WHERE thing_id = $1 AND resolved_at IS NULL`,
        [draft],
      ),
    ).toHaveLength(1);
    expect(
      await own(db, 'SELECT 1 FROM public.attachments WHERE thing_id = $1', [draft]),
    ).toHaveLength(1);

    await own(db, 'UPDATE public.locations SET keep_room_photos = true WHERE id = $1', [home.id]);
    try {
      const second = await roomOf([[obj('Wall clock', [0.1, 0.1, 0.2, 0.3])]]);
      expect(ok(await act(louis, await cardOf(second.id), 'done'))).toEqual({ photosKept: true });
      expect(await photosOfRoom(second.row?.attachment_ids)).toHaveLength(1);
    } finally {
      await own(db, 'UPDATE public.locations SET keep_room_photos = false WHERE id = $1', [
        home.id,
      ]);
    }
  });

  // catalogue: POST /api/v1/inbox/:id/room/discard
  it('Retry reads a failed room again; Discard deletes its photos', async () => {
    const p = await photo();
    answers[await keyOf(p.fileId)] = { text: 'not json' };
    const out = ok(
      await capture(louis, { files: [{ fileId: p.fileId, role: 'photo' }] }),
      201,
    ) as Json & { room: { id: string } };
    const [ex] = await photosOf(out.room.id);
    await runExtraction(deps(), { userId: louis.userId, mfa: false }, ex?.id as string);
    expect((await roomRow(out.room.id))?.status).toBe('failed');
    let card = await cardOf(out.room.id);
    expect(card.room?.photos[0]?.status).toBe('failed');
    // Done is refused while reading only; a failed room can be retried.
    ok(await act(louis, card, 'retry'));
    expect((await roomRow(out.room.id))?.status).toBe('reading');
    const again = (await photosOf(out.room.id)).filter((e) => e.status === 'queued');
    expect(again).toHaveLength(1);
    answers[await keyOf(p.fileId)] = {
      output: { objects: [obj('Plant pot', [0.1, 0.1, 0.3, 0.3])] },
    };
    await runExtraction(deps(), { userId: louis.userId, mfa: false }, again[0]?.id as string);
    expect((await roomRow(out.room.id))?.status).toBe('ready');
    card = await cardOf(out.room.id);
    expect((await act(louis, card, 'retry')).statusCode).toBe(409);
    expect(ok(await act(louis, card, 'discard'))).toEqual({ photosKept: false });
    expect(await auditActionsOf(card.id)).toEqual(['inbox.resolve']);
    expect(
      await own(db, 'SELECT 1 FROM public.attachments WHERE id = ANY ($1::uuid[])', [
        (await roomRow(out.room.id))?.attachment_ids,
      ]),
    ).toHaveLength(0);
  });

  it('refuses Done while the photos are read, and is no viewer’s', async () => {
    const p = await photo();
    const out = ok(
      await capture(louis, { files: [{ fileId: p.fileId, role: 'photo' }] }),
      201,
    ) as Json & { room: { id: string } };
    const card = await cardOf(out.room.id);
    expect(card.room?.status).toBe('reading');
    expect(card.room?.progress).toEqual({ done: 0, total: 1 });
    expect((await act(louis, card, 'done')).statusCode).toBe(409);
    // A viewer has no inbox: the item is as missing as a random id.
    expect((await act(talia, card, 'done')).statusCode).toBe(404);
  });

  describe('photos under review', () => {
    // While the Room card is open, its photos are its reviewers' (members and up) only: a viewer
    // finds them on no page, no file URL, no search, no share link and no phone copy. Done with
    // the location keeping room photos makes them ordinary photos, seen by everyone.
    type Seen = {
      place: string[];
      file: number;
      thumb: string | null;
      snapshotCover: string | null;
    };
    const seenBy = async (
      as: Person,
      box: string,
      photo: { attachmentId: string; fileId: string },
    ): Promise<Seen> => {
      const place = ok(await call(t, `/api/v1/places/${study}`, { as })) as unknown as {
        attachments: { id: string }[];
      };
      const file = await call(t, `/api/v1/files/${photo.fileId}/url`, {
        as,
        body: { variant: 'thumb' },
      });
      const found = ok(
        await call(t, `/api/v1/search?q=${encodeURIComponent('Hobby crate')}`, { as }),
      ) as unknown as { things: { items: { id: string; thumbUrl: string | null }[] } };
      let cover: string | null = null;
      let cursor: string | undefined;
      for (let i = 0; i < 20; i++) {
        const page = ok(
          await call(
            t,
            `/api/v1/sync/snapshot${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
            { as },
          ),
        ) as unknown as {
          changes: { things: { id: string; coverFileId: string | null }[] };
          nextCursor: string;
          complete: boolean;
        };
        const row = page.changes.things.find((x) => x.id === box);
        if (row) cover = row.coverFileId;
        if (page.complete) break;
        cursor = page.nextCursor;
      }
      return {
        place: place.attachments.map((a) => a.id),
        file: file.statusCode,
        thumb: found.things.items.find((x) => x.id === box)?.thumbUrl ?? null,
        snapshotCover: cover,
      };
    };

    async function shareBox(box: string) {
      const res = await call(t, `/api/v1/locations/${home.id}/share-links`, {
        as: ibrahim,
        body: { thingId: box },
      });
      expect(res.statusCode, res.body).toBe(201);
      const token = new URL((res.json() as { url: string }).url).pathname.slice('/s/'.length);
      return async () => {
        const page = await t.app.inject({ method: 'GET', url: `/api/v1/shared/${token}` });
        expect(page.statusCode, page.body).toBe(200);
        return (page.json() as { thing: { photo: unknown } | null }).thing?.photo ?? null;
      };
    }

    /** A room capture of the Study (one photo) and one of a box (one photo), both read. */
    async function twoRooms() {
      const box = await seedThing('Hobby crate');
      const room = await roomOf([[obj('Desk fan', [0.1, 0.1, 0.2, 0.3])]]);
      const inBox = await roomOf([[obj('Glue gun', [0.1, 0.1, 0.2, 0.3])]], {
        target: { containerId: box },
      });
      const fileOf = async (attachmentId: string) =>
        (
          await own<{ file_id: string }>(
            db,
            'SELECT file_id FROM public.attachments WHERE id = $1',
            [attachmentId],
          )
        )[0]?.file_id as string;
      const placePhoto = room.row?.attachment_ids[0] as string;
      const boxPhoto = inBox.row?.attachment_ids[0] as string;
      return {
        box,
        room,
        inBox,
        placePhoto: { attachmentId: placePhoto, fileId: await fileOf(placePhoto) },
        boxPhoto: { attachmentId: boxPhoto, fileId: await fileOf(boxPhoto) },
      };
    }

    it('are hidden from a viewer and shown to the members who review them', async () => {
      const r = await twoRooms();
      const shared = await shareBox(r.box);

      const viewer = await seenBy(talia, r.box, r.placePhoto);
      expect(viewer.place).not.toContain(r.placePhoto.attachmentId);
      expect(viewer.file).toBe(404);
      expect(viewer.thumb).toBeNull();
      expect(viewer.snapshotCover).toBeNull();
      expect((await seenBy(talia, r.box, r.boxPhoto)).file).toBe(404);
      // Nor on the box's share link, whoever opens it.
      expect(await shared()).toBeNull();

      for (const member of [louis, ibrahim]) {
        const seen = await seenBy(member, r.box, r.placePhoto);
        expect(seen.place).toContain(r.placePhoto.attachmentId);
        expect(seen.file).toBe(200);
        expect(seen.thumb).not.toBeNull();
        expect((await seenBy(member, r.box, r.boxPhoto)).file).toBe(200);
      }

      // Closing the cards without keeping them deletes them, as before.
      ok(await act(louis, await cardOf(r.room.id), 'discard'));
      ok(await act(louis, await cardOf(r.inBox.id), 'discard'));
    });

    it('become ordinary photos on Done where the location keeps room photos', async () => {
      await own(db, 'UPDATE public.locations SET keep_room_photos = true WHERE id = $1', [home.id]);
      try {
        const r = await twoRooms();
        const shared = await shareBox(r.box);
        ok(await act(louis, await cardOf(r.room.id), 'done'));
        ok(await act(louis, await cardOf(r.inBox.id), 'done'));

        const viewer = await seenBy(talia, r.box, r.placePhoto);
        expect(viewer.place).toContain(r.placePhoto.attachmentId);
        expect(viewer.file).toBe(200);
        expect(viewer.thumb).not.toBeNull();
        expect(viewer.snapshotCover).toBe(r.boxPhoto.fileId);
        expect((await seenBy(talia, r.box, r.boxPhoto)).file).toBe(200);
        expect(await shared()).not.toBeNull();
      } finally {
        await own(db, 'UPDATE public.locations SET keep_room_photos = false WHERE id = $1', [
          home.id,
        ]);
      }
    });
  });
});

describe('accepted room drafts on the map', () => {
  const draftItem = async (thingId: string) =>
    (
      await own<{ id: string; row_version: number }>(
        db,
        `SELECT id, row_version FROM public.inbox_items
          WHERE thing_id = $1 AND kind = 'draft' AND resolved_at IS NULL`,
        [thingId],
      )
    )[0] as { id: string; row_version: number };
  const nodeOf = async (thingId: string) =>
    (
      await own<{ model: string; placed_by_kept: boolean }>(
        db,
        'SELECT model, placed_by_kept FROM public.map_nodes WHERE thing_id = $1',
        [thingId],
      )
    )[0];

  it('puts an accepted draft on free floor where the room is drawn, one by one or in bulk', async () => {
    await own(
      db,
      `INSERT INTO public.map_nodes (location_id, place_id, x_cm, z_cm, w_cm, d_cm, room_kind, surface)
       VALUES ($1, $2, 0, 0, 500, 400, 'room', 'wood')
       ON CONFLICT DO NOTHING`,
      [home.id, study],
    );
    const { row } = await roomOf([
      [obj('Standing lamp', [0.1, 0.1, 0.2, 0.3]), obj('Laundry basket', [0.5, 0.5, 0.2, 0.2])],
    ]);
    const [lamp, basket] = (row?.result?.drafts ?? []).map((d) => d.thingId) as [string, string];
    const item = await draftItem(lamp);
    ok(
      await call(t, `/api/v1/inbox/${item.id}/accept`, {
        as: louis,
        body: {},
        headers: { 'if-match': String(item.row_version) },
      }),
    );
    expect(await nodeOf(lamp)).toEqual({ model: 'lamp', placed_by_kept: true });
    const bulk = await draftItem(basket);
    ok(
      await call(t, '/api/v1/inbox/bulk', {
        as: louis,
        body: { action: 'accept_names', ids: [bulk.id] },
      }),
    );
    expect((await nodeOf(basket))?.placed_by_kept).toBe(true);
  });

  it('leaves a draft that no room photo made where it is', async () => {
    const p = await photo();
    const res = ok(
      await call(t, '/api/v1/captures', {
        as: louis,
        body: {
          id: newId(),
          locationId: home.id,
          target: { placeId: study },
          mode: 'thing',
          batchId: newId(),
          files: [{ fileId: p.fileId, role: 'photo' }],
          name: 'Spare bulb',
        },
        headers: { 'idempotency-key': newId() },
      }),
      201,
    ) as Json & { thing: { id: string } };
    await own(db, `UPDATE public.things SET review_state = 'draft' WHERE id = $1`, [res.thing.id]);
    await own(
      db,
      `INSERT INTO public.inbox_items (location_id, kind, thing_id, batch_id, created_by)
       VALUES ($1, 'draft', $2, $3, $4)`,
      [home.id, res.thing.id, newId(), louis.userId],
    );
    const item = await draftItem(res.thing.id);
    ok(
      await call(t, `/api/v1/inbox/${item.id}/accept`, {
        as: louis,
        body: {},
        headers: { 'if-match': String(item.row_version) },
      }),
    );
    expect(await nodeOf(res.thing.id)).toBeUndefined();
  });
});
