import { newId } from '@kept/shared';
import type { LightMyRequestResponse } from 'fastify';
import { beforeAll, describe, expect, it } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import { call, join, type Person, peopleApp, person } from '../../test/people.js';
import { createLocation, type Loc, own } from '../../test/things.js';
import { THING_CAP } from './view.js';

// The graph view's read (#207) through the front door, as the web calls it: GET
// /api/v1/locations/:id/graph. Fixtures are seeded as kept_owner; every read goes through the app
// as a signed-in user on kept_app, under row-level security.

let db: TestDb;
let t: TestApp;
let ola: Person; // owner
let vic: Person; // viewer
let bob: Person; // outsider
let home: Loc;
let bobs: Loc;

const sql = <T extends Record<string, unknown>>(text: string, values: unknown[] = []) =>
  own<T>(db, text, values);

async function placeOf(loc: Loc, name: string, parentId: string | null, kind = 'room') {
  const id = newId();
  await sql(
    'INSERT INTO public.places (id, location_id, parent_id, name, kind_key) VALUES ($1, $2, $3, $4, $5)',
    [id, loc.id, parentId, name, kind],
  );
  return id;
}

async function thingOf(
  loc: Loc,
  name: string,
  where: { placeId?: string; containerId?: string },
  typeKey: string | null = null,
) {
  const id = newId();
  await sql(
    `INSERT INTO public.things (id, location_id, place_id, container_id, name, type_id)
     VALUES ($1, $2, $3, $4, $5,
             (SELECT id FROM public.types WHERE owner_account_id IS NULL AND builtin_key = $6))`,
    [id, loc.id, where.placeId ?? null, where.containerId ?? null, name, typeKey],
  );
  return id;
}

async function tagOf(loc: Loc, name: string, colour: string | null) {
  const id = newId();
  await sql(
    'INSERT INTO public.tags (id, owner_account_id, name, colour) VALUES ($1, $2, $3, $4)',
    [id, loc.accountId, name, colour],
  );
  return id;
}

const tag = (loc: Loc, thingId: string, tagId: string) =>
  sql('INSERT INTO public.thing_tags (location_id, thing_id, tag_id) VALUES ($1, $2, $3)', [
    loc.id,
    thingId,
    tagId,
  ]);

type GraphJson = {
  locationId: string;
  places: {
    id: string;
    parentId: string | null;
    name: string;
    kindKey: string;
    isUnplaced: boolean;
  }[];
  things: {
    id: string;
    name: string;
    placeId: string | null;
    containerId: string | null;
    isContainer: boolean;
    typeKey: string | null;
    tagIds: string[];
  }[];
  counts: { holderId: string; things: number }[];
  more: number;
  attention: { subjectId: string; holderId: string | null; kind: string }[];
  tags: { id: string; name: string; colour: string | null }[];
};

async function json<T>(res: Promise<LightMyRequestResponse>, status = 200): Promise<T> {
  const r = await res;
  expect(r.statusCode, r.body).toBe(status);
  return r.json() as T;
}

const getGraph = (as: Person, loc: Loc = home) =>
  call(t, `/api/v1/locations/${loc.id}/graph`, { as });

type Key =
  | 'ground'
  | 'living'
  | 'garage'
  | 'shelf'
  | 'box'
  | 'lantern'
  | 'batteries'
  | 'drill'
  | 'draft'
  | 'camping'
  | 'den';
let ids: Record<Key, string>;

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  t = await peopleApp(db, { sent: [] });
  ola = await person(t, db, 'ola');
  vic = await person(t, db, 'vic');
  bob = await person(t, db, 'bob');
  home = await createLocation(t, db, ola, 'complete');
  bobs = await createLocation(t, db, bob, 'complete', 'Bob home');
  await join(db, home.id, vic.userId, 'viewer');

  const ground = await placeOf(home, 'Ground floor', null, 'floor');
  const living = await placeOf(home, 'Living room', ground);
  const garage = await placeOf(home, 'Garage', null);
  const shelf = await placeOf(home, 'Tool shelf', garage, 'zone');
  const box = await thingOf(home, 'Box 02', { placeId: garage }, 'box_bin');
  const lantern = await thingOf(home, 'Lantern', { containerId: box });
  const batteries = await thingOf(home, 'AA batteries', { placeId: living }, 'batteries');
  const drill = await thingOf(home, 'Drill', { placeId: shelf }, 'power_tool');
  const draft = await thingOf(home, 'Half-captured', { placeId: living });
  await sql("UPDATE public.things SET review_state = 'draft' WHERE id = $1", [draft]);
  const camping = await tagOf(home, 'Camping', '#30A46C');
  await tag(home, lantern, camping);
  await tag(home, box, camping);

  // Low stock and a loan, the map's pins.
  await sql(
    `INSERT INTO public.stock_rules (thing_id, location_id, min_quantity, created_by)
     VALUES ($1, $2, 6, $3)`,
    [batteries, home.id, ola.userId],
  );
  const murdock = newId();
  await sql(
    `INSERT INTO public.people (id, owner_account_id, display_name) VALUES ($1, $2, 'Murdock')`,
    [murdock, home.accountId],
  );
  await sql(
    `INSERT INTO public.loans (location_id, thing_id, direction, person_id, started_at, created_by)
     VALUES ($1, $2, 'out', $3, now(), $4)`,
    [home.id, drill, murdock, ola.userId],
  );

  // Bob's own place, thing and tag: never in Ola's graph.
  const den = await placeOf(bobs, 'Den', null);
  const bobsThing = await thingOf(bobs, 'Bob lamp', { placeId: den });
  const bobsTag = await tagOf(bobs, 'Bob tag', '#E5484D');
  await tag(bobs, bobsThing, bobsTag);

  ids = { ground, living, garage, shelf, box, lantern, batteries, drill, draft, camping, den };
});

describe('GET /api/v1/locations/:id/graph', () => {
  it('has every place, the live things with where they are, counts, pins and tags', async () => {
    const g = await json<GraphJson>(getGraph(ola));
    expect(g.locationId).toBe(home.id);
    const places = new Map(g.places.map((p) => [p.id, p]));
    expect(places.get(ids.living)).toMatchObject({ parentId: ids.ground, kindKey: 'room' });
    expect(places.get(ids.shelf)).toMatchObject({ parentId: ids.garage, kindKey: 'zone' });
    expect(places.get(home.unplacedId as string)?.isUnplaced).toBe(true);

    const things = new Map(g.things.map((x) => [x.id, x]));
    expect(things.get(ids.box)).toMatchObject({
      placeId: ids.garage,
      containerId: null,
      isContainer: true,
      typeKey: 'box_bin',
      tagIds: [ids.camping],
    });
    expect(things.get(ids.lantern)).toMatchObject({ containerId: ids.box, isContainer: false });
    // Containers first, so a box isn't the one past the cap.
    expect(g.things[0]?.id).toBe(ids.box);
    // A draft isn't in the inventory yet.
    expect(things.has(ids.draft)).toBe(false);

    const counts = new Map(g.counts.map((c) => [c.holderId, c.things]));
    expect(counts.get(ids.garage)).toBe(1);
    expect(counts.get(ids.box)).toBe(1);
    expect(counts.get(ids.living)).toBe(1);
    expect(g.more).toBe(0);

    expect(g.attention).toEqual(
      expect.arrayContaining([
        { subjectId: ids.batteries, holderId: ids.living, kind: 'low' },
        { subjectId: ids.drill, holderId: ids.shelf, kind: 'lent' },
      ]),
    );
    expect(g.tags).toEqual([{ id: ids.camping, name: 'Camping', colour: '#30A46C' }]);
  });

  it('gives a viewer the same graph, and nothing of another household', async () => {
    const g = await json<GraphJson>(getGraph(vic));
    expect(g.things.map((x) => x.name).sort()).toEqual([
      'AA batteries',
      'Box 02',
      'Drill',
      'Lantern',
    ]);
    expect(g.places.some((p) => p.id === ids.den)).toBe(false);
    expect(g.tags.map((x) => x.name)).toEqual(['Camping']);
    expect(JSON.stringify(g)).not.toContain('Bob');
  });

  it('is not found outside the location, nor for a location that is gone', async () => {
    expect((await getGraph(bob)).statusCode).toBe(404);
    expect((await getGraph(vic, bobs)).statusCode).toBe(404);
    const r = await call(t, `/api/v1/locations/${newId()}/graph`, { as: ola });
    expect(r.statusCode).toBe(404);
  });

  it('stops at the cap, and still counts what is past it in its holder', async () => {
    const attic = await placeOf(bobs, 'Attic', null);
    await sql(
      `INSERT INTO public.things (id, location_id, place_id, name)
       SELECT gen_random_uuid(), $1, $2, 'Old book ' || lpad(n::text, 5, '0')
         FROM generate_series(1, $3::int) n`,
      [bobs.id, attic, THING_CAP + 25],
    );
    const g = await json<GraphJson>(getGraph(bob, bobs));
    expect(g.things).toHaveLength(THING_CAP);
    // Bob's lamp and the books: everything past the cap is counted, not listed.
    expect(g.more).toBe(26);
    expect(g.counts.find((c) => c.holderId === attic)?.things).toBe(THING_CAP + 25);
  });
});
