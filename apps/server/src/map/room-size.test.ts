import { MAP_LIMITS, newId } from '@kept/shared';
import type { LightMyRequestResponse } from 'fastify';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import { call, join, type Person, peopleApp, person } from '../../test/people.js';
import { createLocation, eventsOf, type Loc, own } from '../../test/things.js';

// Rooms with their real size (#372): a room made with its length and width goes on the map in
// the same transaction as the place, with one Undo for both; rooms go down to 50 cm a side, in
// the API and in map_nodes' own check. Through the front door as the web calls it; fixtures as
// kept_owner.

let db: TestDb;
let t: TestApp;
let ola: Person; // owner
let max: Person; // member
let vic: Person; // viewer
let home: Loc;
let ground: string;
let first: string;
let living: string;
let bedroom: string;
let garage: string;

const sql = <T extends Record<string, unknown>>(text: string, values: unknown[] = []) =>
  own<T>(db, text, values);

async function placeOf(name: string, parentId: string | null, kind = 'room') {
  const id = newId();
  await sql(
    'INSERT INTO public.places (id, location_id, parent_id, name, kind_key) VALUES ($1, $2, $3, $4, $5)',
    [id, home.id, parentId, name, kind],
  );
  return id;
}

async function json<T>(res: Promise<LightMyRequestResponse>, status = 200): Promise<T> {
  const r = await res;
  expect(r.statusCode, r.body).toBe(status);
  return r.json() as T;
}

const createPlace = (as: Person, body: Record<string, unknown>) =>
  call(t, `/api/v1/locations/${home.id}/places`, { as, body });

const putLayout = (as: Person, body: unknown) =>
  call(t, `/api/v1/locations/${home.id}/layout`, { as, method: 'PUT', body });

type MapJson = {
  version: string | null;
  rooms: {
    id: string;
    levelId: string | null;
    layout: { x: number; z: number; w: number; d: number; kind: string; surface: string } | null;
  }[];
};
const getMap = (as: Person) => json<MapJson>(call(t, `/api/v1/locations/${home.id}/map`, { as }));

type NodeRow = { x: number; z: number; w: number; d: number; kind: string; surface: string };
const nodeOf = async (placeId: string) =>
  (
    await sql<NodeRow>(
      `SELECT x_cm AS x, z_cm AS z, w_cm AS w, d_cm AS d, room_kind AS kind, surface
         FROM public.map_nodes WHERE place_id = $1`,
      [placeId],
    )
  )[0];

/** The seeded rooms, arranged: the living room on the ground floor, the bedroom on the first,
 * the garage on no floor. */
const arranged = (version: string | null) => ({
  version,
  rooms: [
    { id: living, x: 0, z: 0, w: 600, d: 500, kind: 'room', surface: 'wood' },
    { id: bedroom, x: 0, z: 0, w: 400, d: 500, kind: 'room', surface: 'wood' },
    { id: garage, x: 700, z: 0, w: 700, d: 600, kind: 'room', surface: 'concrete' },
  ],
  nodes: [],
});

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  t = await peopleApp(db);
  ola = await person(t, db, 'ola');
  max = await person(t, db, 'max');
  vic = await person(t, db, 'vic');
  home = await createLocation(t, db, ola, 'complete');
  await join(db, home.id, max.userId, 'member');
  await join(db, home.id, vic.userId, 'viewer');
  ground = await placeOf('Ground floor', null, 'floor');
  first = await placeOf('First floor', null, 'floor');
  await sql('UPDATE public.places SET sort = 1 WHERE id = $1', [first]);
  living = await placeOf('Living room', ground);
  bedroom = await placeOf('Bedroom', first);
  garage = await placeOf('Garage', null);
});

beforeEach(async () => {
  // Rooms made by earlier cases stay in the tree, unarranged: the map lays them out itself.
  await sql('DELETE FROM public.map_nodes WHERE location_id = $1', [home.id]);
});

describe('POST /api/v1/locations/:id/places with a size (#372)', () => {
  // catalogue: POST /api/v1/locations/:locationId/places
  it('makes the room and its rectangle on the map together, audited as one create', async () => {
    const res = await createPlace(max, {
      parentId: ground,
      name: 'Balcony',
      kindKey: 'room',
      map: { w: 80, d: 358 },
    });
    expect(res.statusCode, res.body).toBe(201);
    const room = res.json() as { id: string; name: string };
    // The first room arranged on its floor: at the corner. A balcony by its name, with a deck.
    expect(await nodeOf(room.id)).toEqual({
      x: 0,
      z: 0,
      w: 80,
      d: 358,
      kind: 'balcony',
      surface: 'deck',
    });
    const map = await getMap(vic);
    expect(map.version).not.toBeNull();
    expect(map.rooms.find((r) => r.id === room.id)).toMatchObject({
      levelId: ground,
      layout: { x: 0, z: 0, w: 80, d: 358, kind: 'balcony', surface: 'deck' },
    });
    const events = await eventsOf(db, home.id, room.id);
    expect(events.map((e) => e.action)).toEqual(['place.create']);
    expect(events[0]?.diff.map?.after).toEqual({
      x: 0,
      z: 0,
      w: 80,
      d: 358,
      kind: 'balcony',
      surface: 'deck',
    });
    // One Undo for both.
    expect(events[0]?.undoable_until).not.toBeNull();
    expect(res.headers['x-kept-audit-event']).toBe(events[0]?.id);
  });

  it('starts to the right of the rooms arranged on its own floor, a metre clear', async () => {
    const v = (await json<{ version: string }>(putLayout(ola, arranged(null)))).version;
    expect(v).not.toBeNull();
    const made = async (parentId: string | null, name: string) => {
      const r = await json<{ id: string }>(
        createPlace(max, {
          ...(parentId ? { parentId } : {}),
          name,
          kindKey: 'room',
          map: { w: 250, d: 300 },
        }),
        201,
      );
      return nodeOf(r.id);
    };
    expect(await made(ground, 'Study')).toMatchObject({ x: 700, z: 0, w: 250, d: 300 });
    expect(await made(first, 'Spare room')).toMatchObject({ x: 500, z: 0 });
    // On no floor, beside the garage (700 to 1400).
    expect(await made(null, 'Shed')).toMatchObject({ x: 1500, z: 0 });
    // The next on the ground floor goes after the study.
    expect(await made(ground, 'Pantry')).toMatchObject({ x: 1050, z: 0 });
  });

  it('leaves the map alone without a size', async () => {
    const r = await json<{ id: string }>(
      createPlace(max, { parentId: ground, name: 'Hall', kindKey: 'room' }),
      201,
    );
    expect(await nodeOf(r.id)).toBeUndefined();
    const [event] = await eventsOf(db, home.id, r.id);
    expect(event?.diff.map).toBeUndefined();
    expect(event?.undoable_until).toBeNull();
  });

  it('takes 50 cm a side and no less, 100 m and no more', async () => {
    expect(MAP_LIMITS.minRoom).toBe(50);
    const ok = await createPlace(max, {
      parentId: ground,
      name: 'Ledge',
      kindKey: 'room',
      map: { w: 50, d: 50 },
    });
    expect(ok.statusCode, ok.body).toBe(201);
    for (const map of [
      { w: 49, d: 200 },
      { w: 200, d: 49 },
      { w: 10_001, d: 200 },
      { w: 80.5, d: 200 },
    ]) {
      const res = await createPlace(max, { parentId: ground, name: 'Nook', kindKey: 'room', map });
      expect(res.statusCode, JSON.stringify(map)).toBe(400);
    }
    expect(await sql('SELECT 1 FROM public.places WHERE name = $1', ['Nook'])).toHaveLength(0);
  });

  it('only gives a room a size: a spot in a room or a floor is refused, and nothing is made', async () => {
    const spot = await createPlace(max, {
      parentId: living,
      name: 'Corner',
      kindKey: 'zone',
      map: { w: 100, d: 100 },
    });
    expect(spot.statusCode, spot.body).toBe(400);
    expect(spot.json()).toMatchObject({ hint: expect.stringContaining('body.map') });
    const floor = await createPlace(max, {
      name: 'Loft',
      kindKey: 'floor',
      map: { w: 100, d: 100 },
    });
    expect(floor.statusCode, floor.body).toBe(400);
    expect(
      await sql('SELECT 1 FROM public.places WHERE name = ANY ($1::text[])', [['Corner', 'Loft']]),
    ).toHaveLength(0);
  });

  it('is refused to a viewer', async () => {
    const res = await createPlace(vic, {
      parentId: ground,
      name: 'Balcony',
      kindKey: 'room',
      map: { w: 80, d: 358 },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('Undo of a room made with its size (#372)', () => {
  const undo = (eventId: string, as: Person = max) =>
    call(t, `/api/v1/audit/${eventId}/undo`, { as, body: {} });

  it('takes the room to the trash and its rectangle off the map', async () => {
    const res = await createPlace(max, {
      parentId: ground,
      name: 'Balcony',
      kindKey: 'room',
      map: { w: 80, d: 358 },
    });
    const room = res.json() as { id: string };
    const back = await undo(String(res.headers['x-kept-audit-event']));
    expect(back.statusCode, back.body).toBe(200);
    expect(await nodeOf(room.id)).toBeUndefined();
    const [place] = await sql<{ deleted: boolean }>(
      'SELECT deleted_at IS NOT NULL AS deleted FROM public.places WHERE id = $1',
      [room.id],
    );
    expect(place?.deleted).toBe(true);
    const events = await eventsOf(db, home.id, room.id);
    expect(events.at(-1)).toMatchObject({ action: 'place.trash' });
    expect(events.at(-1)?.diff.map?.before).toMatchObject({ w: 80, d: 358 });
    expect((await getMap(vic)).rooms.some((r) => r.id === room.id)).toBe(false);
  });

  it('still works after an arrange that left the room as it was', async () => {
    const res = await createPlace(max, {
      parentId: ground,
      name: 'Balcony',
      kindKey: 'room',
      map: { w: 80, d: 358 },
    });
    const room = res.json() as { id: string };
    const map = await getMap(ola);
    const body = arranged(map.version);
    body.rooms = [
      { id: living, x: 180, z: 0, w: 600, d: 500, kind: 'room', surface: 'wood' },
      { id: room.id, x: 0, z: 0, w: 80, d: 358, kind: 'balcony', surface: 'deck' },
      ...body.rooms.slice(1),
    ];
    expect((await putLayout(ola, body)).statusCode).toBe(200);
    expect((await undo(String(res.headers['x-kept-audit-event']))).statusCode).toBe(200);
    expect(await nodeOf(room.id)).toBeUndefined();
  });

  it('is refused once the room was resized on the map, and nothing changes', async () => {
    const res = await createPlace(max, {
      parentId: ground,
      name: 'Balcony',
      kindKey: 'room',
      map: { w: 80, d: 358 },
    });
    const room = res.json() as { id: string };
    const map = await getMap(ola);
    const body = arranged(map.version);
    body.rooms = [
      ...body.rooms,
      { id: room.id, x: 700, z: 0, w: 90, d: 358, kind: 'balcony', surface: 'deck' },
    ];
    expect((await putLayout(ola, body)).statusCode).toBe(200);
    const refused = await undo(String(res.headers['x-kept-audit-event']));
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ reason: 'changed_since' });
    expect(await nodeOf(room.id)).toMatchObject({ w: 90 });
  });
});

describe('rooms from 50 cm a side on the map (#372)', () => {
  it('arranges a 0.8 × 3.58 m balcony and a 50 cm ledge, and no less', async () => {
    const balcony = await placeOf('Balcony', ground);
    const ledge = await placeOf('Ledge', ground);
    const body = (w: number) => ({
      version: null,
      rooms: [
        { id: balcony, x: 0, z: 0, w: 80, d: 358, kind: 'balcony', surface: 'deck' },
        { id: ledge, x: 100, z: 0, w, d: 50, kind: 'room', surface: 'wood' },
      ],
      nodes: [],
    });
    expect((await putLayout(max, body(49))).statusCode).toBe(400);
    const res = await putLayout(max, body(50));
    expect(res.statusCode, res.body).toBe(200);
    expect(await nodeOf(balcony)).toMatchObject({ w: 80, d: 358 });
    expect(await nodeOf(ledge)).toMatchObject({ w: 50, d: 50 });
  });

  it('is map_nodes’ own check too: 50 cm goes in, 49 cm is refused', async () => {
    const nook = await placeOf('Cubby', ground);
    const insert = (w: number) =>
      sql(
        `INSERT INTO public.map_nodes (location_id, place_id, x_cm, z_cm, w_cm, d_cm, rot)
         VALUES ($1, $2, 0, 0, $3, 50, 0)`,
        [home.id, nook, w],
      );
    await expect(insert(49)).rejects.toMatchObject({
      code: '23514',
      constraint: 'map_nodes_size_chk',
    });
    await expect(insert(10_001)).rejects.toMatchObject({ constraint: 'map_nodes_size_chk' });
    await insert(50);
    expect(await nodeOf(nook)).toMatchObject({ w: 50, d: 50 });
  });
});
