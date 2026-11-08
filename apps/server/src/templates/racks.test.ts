import type { LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import { call, join, type Person, peopleApp, person } from '../../test/people.js';
import { createLocation, createThing, type Loc, ok, own } from '../../test/things.js';

// Racks measured in rack units (#373): a rack made from a rack template, gear put at a unit, and
// the refusals: two pieces in the same unit on a face, a piece past the top of the rack, a piece
// that isn't in the rack. Through the front door in the web contract's shapes.
//
// Ibrahim owns Home; Louis is a member and Talia a viewer there.

let db: TestDb;
let t: TestApp;
let ibrahim: Person;
let louis: Person;
let talia: Person;
let home: Loc;

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  t = await peopleApp(db);
  ibrahim = await person(t, db, 'ibrahim');
  louis = await person(t, db, 'louis');
  talia = await person(t, db, 'talia');
  home = await createLocation(t, db, ibrahim, 'household', 'Home');
  await join(db, home.id, louis.userId, 'member');
  await join(db, home.id, talia.userId, 'viewer');
});

afterAll(async () => {
  await t.app.close();
});

type Json = Record<string, unknown>;

const fromTemplate = (as: Person, body: Json) =>
  call(t, `/api/v1/locations/${home.id}/places/from-template`, { as, body });

async function room(name: string): Promise<string> {
  return ok(
    await call(t, `/api/v1/locations/${home.id}/places`, {
      as: ibrahim,
      body: { name, kindKey: 'room' },
    }),
    201,
  ).id as string;
}

async function makeRack(name: string, body: Json = {}): Promise<string> {
  const parentId = await room(`${name} room`);
  const res = ok(
    await fromTemplate(ibrahim, {
      template: { builtin: 'rack_19_wall_12' },
      name,
      parentId,
      ...body,
    }),
    201,
  );
  return (res.place as { id: string }).id;
}

const thing = async (name: string, placeId: string) =>
  (await createThing(t, ibrahim, home, { name, placeId })) as {
    id: string;
    rowVersion: number;
  };

const patch = async (as: Person, id: string, body: Json) => {
  const now = ok(await call(t, `/api/v1/things/${id}`, { as: ibrahim })) as unknown as {
    rowVersion: number;
  };
  return call(t, `/api/v1/things/${id}`, {
    as,
    method: 'PATCH',
    headers: { 'if-match': String(now.rowVersion) },
    body,
  });
};

const place = (as: Person, id: string) => call(t, `/api/v1/places/${id}`, { as });

const details = (res: LightMyRequestResponse) => (res.json() as { rack?: Json }).rack;

describe('making a rack', () => {
  it('makes a rack with its units and numbering, and no compartments', async () => {
    const parentId = await room('Office');
    const res = ok(
      await fromTemplate(louis, {
        template: { builtin: 'rack_19_42' },
        name: 'Rack 1',
        parentId,
        units: 24,
        numbering: 'top',
        code: 'RACK1',
      }),
      201,
    );
    expect(res.compartments).toEqual([]);
    const id = (res.place as { id: string }).id;
    const view = ok(await place(talia, id));
    expect(view.rack).toEqual({ units: 24, width: 19, numbering: 'top', mount: 'floor', gear: [] });
    expect(view.furniture).toBeNull();
    const kids = await own(db, 'SELECT id FROM public.places WHERE parent_id = $1', [id]);
    expect(kids).toEqual([]);
  });

  it('refuses a rack past 60 units, and a count or compartment codes', async () => {
    const parentId = await room('Closet');
    const base = { template: { builtin: 'rack_19_24' }, name: 'Too tall', parentId };
    expect((await fromTemplate(ibrahim, { ...base, units: 61 })).statusCode).toBe(400);
    expect((await fromTemplate(ibrahim, { ...base, count: 4 })).statusCode).toBe(400);
    expect((await fromTemplate(ibrahim, { ...base, codePattern: '{n}' })).statusCode).toBe(400);
  });

  it('refuses units on furniture that isn’t a rack', async () => {
    const parentId = await room('Den');
    const res = await fromTemplate(ibrahim, {
      template: { builtin: 'bookcase' },
      name: 'Books',
      parentId,
      units: 12,
    });
    expect(res.statusCode).toBe(400);
  });

  it('is undone like other furniture', async () => {
    const parentId = await room('Attic');
    const res = await fromTemplate(ibrahim, {
      template: { builtin: 'rack_10_8' },
      name: 'Little rack',
      parentId,
    });
    ok(res, 201);
    const event = String(res.headers['x-kept-audit-event'] ?? '').split(',')[0];
    ok(await call(t, `/api/v1/audit/${event}/undo`, { as: ibrahim, body: {} }));
    const id = (res.json() as { place: { id: string } }).place.id;
    const [row] = await own<{ deleted: boolean }>(
      db,
      'SELECT deleted_at IS NOT NULL AS deleted FROM public.places WHERE id = $1',
      [id],
    );
    expect(row?.deleted).toBe(true);
  });
});

describe('gear in a rack', () => {
  it('puts gear at a unit, and shows it on the rack and the thing', async () => {
    const rack = await makeRack('Wall rack');
    const sw = await thing('Switch', rack);
    const res = ok(
      await patch(louis, sw.id, { rackUnits: 1, rackAt: { u: 11, face: 'front', full: true } }),
    );
    expect(res.rackUnits).toBe(1);
    expect(res.rack).toMatchObject({
      id: rack,
      name: 'Wall rack',
      units: 12,
      numbering: 'bottom',
      at: { u: 11, face: 'front', full: true },
    });
    const view = ok(await place(talia, rack)) as unknown as { rack: { gear: Json[] } };
    expect(view.rack.gear).toEqual([
      {
        id: sw.id,
        name: 'Switch',
        shortCode: expect.any(String),
        units: 1,
        at: { u: 11, face: 'front', full: true },
        rowVersion: expect.any(Number),
      },
    ]);
  });

  it('refuses two full-depth pieces in the same unit, naming the one there', async () => {
    const rack = await makeRack('Busy rack');
    const sw = await thing('Switch', rack);
    const pc = await thing('Mini PC', rack);
    ok(await patch(ibrahim, sw.id, { rackAt: { u: 11, face: 'front', full: true } }));
    const res = await patch(ibrahim, pc.id, { rackAt: { u: 11, face: 'front', full: true } });
    expect(res.statusCode).toBe(409);
    expect(details(res)).toEqual({
      reason: 'taken',
      u: 11,
      face: 'front',
      by: { id: sw.id, name: 'Switch' },
    });
    // A 2U piece starting below it overlaps too.
    const nas = await patch(ibrahim, pc.id, {
      rackUnits: 2,
      rackAt: { u: 10, face: 'front', full: true },
    });
    expect(nas.statusCode).toBe(409);
    const [row] = await own<{ rack_at: unknown; rack_units: string | null }>(
      db,
      'SELECT rack_at, rack_units FROM public.things WHERE id = $1',
      [pc.id],
    );
    expect(row).toEqual({ rack_at: null, rack_units: null });
  });

  it('lets half-depth pieces share a unit, front and rear', async () => {
    const rack = await makeRack('Shared rack');
    const sw = await thing('Switch', rack);
    const shelf = await thing('Shelf', rack);
    ok(await patch(ibrahim, sw.id, { rackAt: { u: 11, face: 'front', full: false } }));
    ok(await patch(ibrahim, shelf.id, { rackAt: { u: 11, face: 'rear', full: false } }));
  });

  it('refuses gear past the top of the rack, and positions not in half units', async () => {
    const rack = await makeRack('Short rack');
    const ups = await thing('UPS', rack);
    const top = await patch(ibrahim, ups.id, {
      rackUnits: 2,
      rackAt: { u: 12, face: 'front', full: true },
    });
    expect(top.statusCode).toBe(400);
    expect(details(top)).toEqual({ reason: 'outside', top: 12 });
    const half = await patch(ibrahim, ups.id, { rackAt: { u: 3.25, face: 'front', full: true } });
    expect(half.statusCode).toBe(400);
    expect(details(half)).toEqual({ reason: 'half' });
    const units = await patch(ibrahim, ups.id, { rackUnits: 1.3 });
    expect(units.statusCode).toBe(400);
  });

  it('refuses a taller height for placed gear when it would reach the next piece', async () => {
    const rack = await makeRack('Growing rack');
    const low = await thing('Router', rack);
    const high = await thing('Patch panel', rack);
    ok(await patch(ibrahim, low.id, { rackAt: { u: 2, face: 'front', full: true } }));
    ok(await patch(ibrahim, high.id, { rackAt: { u: 3, face: 'front', full: true } }));
    expect((await patch(ibrahim, low.id, { rackUnits: 2 })).statusCode).toBe(409);
    ok(await patch(ibrahim, low.id, { rackUnits: 1 }));
  });

  it('refuses a position for a thing that isn’t in a rack', async () => {
    const shelf = await room('Plain room');
    const lamp = await thing('Lamp', shelf);
    const res = await patch(ibrahim, lamp.id, { rackAt: { u: 1, face: 'front', full: true } });
    expect(res.statusCode).toBe(400);
  });

  it('keeps a viewer out', async () => {
    const rack = await makeRack('Viewer rack');
    const sw = await thing('Switch', rack);
    const res = await patch(talia, sw.id, { rackAt: { u: 1, face: 'front', full: true } });
    expect(res.statusCode).toBe(403);
  });

  it('forgets the position when the gear leaves the rack, so its unit is free again', async () => {
    const rack = await makeRack('Moving rack');
    const desk = await room('Desk room');
    const sw = await thing('Switch', rack);
    const pc = await thing('Mini PC', rack);
    ok(await patch(ibrahim, sw.id, { rackAt: { u: 5, face: 'front', full: true } }));
    ok(
      await call(t, '/api/v1/things/move', {
        as: ibrahim,
        body: { thingIds: [sw.id], to: { placeId: desk } },
      }),
    );
    ok(await patch(ibrahim, pc.id, { rackAt: { u: 5, face: 'front', full: true } }));
    // Back in the rack, the switch has no unit: U5 is the mini PC's.
    ok(
      await call(t, '/api/v1/things/move', {
        as: ibrahim,
        body: { thingIds: [sw.id], to: { placeId: rack } },
      }),
    );
    const view = ok(await call(t, `/api/v1/things/${sw.id}`, { as: ibrahim }));
    expect(view.rack).toMatchObject({ id: rack, at: null });
  });

  it('undoes a position, and refuses the undo of a removal once the unit is taken', async () => {
    const rack = await makeRack('Undo rack');
    const sw = await thing('Switch', rack);
    const pc = await thing('Mini PC', rack);
    ok(await patch(ibrahim, sw.id, { rackAt: { u: 7, face: 'front', full: true } }));
    const removed = await patch(ibrahim, sw.id, { rackAt: null });
    ok(removed);
    const event = String(removed.headers['x-kept-audit-event'] ?? '').split(',')[0];
    ok(await patch(ibrahim, pc.id, { rackAt: { u: 7, face: 'front', full: true } }));
    const res = await call(t, `/api/v1/audit/${event}/undo`, { as: ibrahim, body: {} });
    expect(res.statusCode).toBe(409);
    // With the mini PC moved up, the undo puts the switch back at U7.
    ok(await patch(ibrahim, pc.id, { rackAt: { u: 9, face: 'front', full: true } }));
    ok(await call(t, `/api/v1/audit/${event}/undo`, { as: ibrahim, body: {} }));
    const view = ok(await call(t, `/api/v1/things/${sw.id}`, { as: ibrahim }));
    expect(view.rack).toMatchObject({ at: { u: 7, face: 'front', full: true } });
  });

  it('lets only one of two people take the same unit at once', async () => {
    const rack = await makeRack('Race rack');
    const a = await thing('Server A', rack);
    const b = await thing('Server B', rack);
    const [ra, rb] = await Promise.all([
      patch(ibrahim, a.id, { rackAt: { u: 4, face: 'front', full: true } }),
      patch(louis, b.id, { rackAt: { u: 4, face: 'front', full: true } }),
    ]);
    expect([ra.statusCode, rb.statusCode].sort()).toEqual([200, 409]);
  });

  it('draws gear on the map at its unit', async () => {
    const rack = await makeRack('Map rack');
    const sw = await thing('Switch', rack);
    ok(await patch(ibrahim, sw.id, { rackUnits: 2, rackAt: { u: 3, face: 'rear', full: false } }));
    const map = ok(await call(t, `/api/v1/locations/${home.id}/map`, { as: talia })) as unknown as {
      nodes: { id: string; rack: Json | null }[];
    };
    expect(map.nodes.find((n) => n.id === rack)?.rack).toEqual({
      units: 12,
      numbering: 'bottom',
      mount: 'wall',
      gear: [{ id: sw.id, name: 'Switch', u: 3, units: 2, face: 'rear', full: false }],
    });
  });
});
