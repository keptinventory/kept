import type { LightMyRequestResponse } from 'fastify';
import { beforeAll, describe, expect, it } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import { call, join, type Person, peopleApp, person } from '../../test/people.js';
import {
  builtinType,
  createLocation,
  createThing,
  eventsOf,
  type Json,
  type Loc,
  ok,
  own,
} from '../../test/things.js';
import { undoableActions } from '../audit/undo.js';
import { runTool } from '../tools/context.js';
import type { ToolContext } from '../tools/types.js';

// A place's sub-places: many turned into boxes in one step with one Undo
// (POST /api/v1/places/:id/convert-children-to-containers, then POST /api/v1/audit/undo), and
// their own order (PATCH /api/v1/places/:id {childOrder}, POST /api/v1/places/:id/reorder).
// Through the routes as the web calls them; fixtures through the routes too, so the audit rows
// are real.

let db: TestDb;
let t: TestApp;
let ibrahim: Person; // owner
let louis: Person; // member
let alfred: Person; // member
let talia: Person; // viewer
let home: Loc;

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  t = await peopleApp(db);
  ibrahim = await person(t, db, 'ibrahim');
  louis = await person(t, db, 'louis');
  alfred = await person(t, db, 'alfred');
  talia = await person(t, db, 'talia');
  home = await createLocation(t, db, ibrahim, 'complete');
  await join(db, home.id, louis.userId, 'member');
  await join(db, home.id, alfred.userId, 'member');
  await join(db, home.id, talia.userId, 'viewer');
});

const get = async <T>(url: string, as: Person = louis): Promise<T> =>
  ok(await call(t, url, { as, method: 'GET' })) as unknown as T;

async function newPlace(name: string, parentId: string | null = null, kindKey = 'zone') {
  const res = await call(t, `/api/v1/locations/${home.id}/places`, {
    as: louis,
    body: { name, kindKey, ...(parentId ? { parentId } : {}) },
  });
  return ok(res, 201).id;
}

type View = Json & { rowVersion: number; childOrder: string; counts: { things: number } };
const view = (id: string, as: Person = louis) => get<View>(`/api/v1/places/${id}`, as);

async function setOrder(id: string, childOrder: 'name' | 'custom', as: Person = louis) {
  const current = await view(id);
  return call(t, `/api/v1/places/${id}`, {
    as,
    method: 'PATCH',
    headers: { 'if-match': String(current.rowVersion) },
    body: { childOrder },
  });
}

const reorder = (parent: string, placeId: string, direction: 'up' | 'down', as = louis) =>
  call(t, `/api/v1/places/${parent}/reorder`, { as, body: { placeId, direction } });

const convertMany = (parent: string, placeIds: string[], as: Person = louis) =>
  call(t, `/api/v1/places/${parent}/convert-children-to-containers`, { as, body: { placeIds } });

const auditIds = (res: LightMyRequestResponse) =>
  String(res.headers['x-kept-audit-event'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const undoTogether = (eventIds: string[], as: Person = louis) =>
  call(t, '/api/v1/audit/undo', { as, body: { eventIds } });

type Node = { id: string; parentId: string | null; name: string; sort: number; childOrder: string };
const tree = () =>
  get<{ places: Node[]; boxes: { id: string; placeId: string; name: string | null }[] }>(
    `/api/v1/locations/${home.id}/places`,
  );
const kidsOf = async (parent: string) =>
  (await tree()).places.filter((p) => p.parentId === parent).map((p) => p.name);
const contentsOf = async (parent: string) =>
  (await get<{ places: { name: string }[] }>(`/api/v1/places/${parent}/contents`)).places.map(
    (p) => p.name,
  );

const sortsOf = async (parent: string) =>
  Object.fromEntries(
    (
      await own<{ name: string; sort: number }>(
        db,
        'SELECT name, sort FROM public.places WHERE parent_id = $1',
        [parent],
      )
    ).map((r) => [r.name, r.sort]),
  );

// ---------------------------------------------------------------------------------------------

describe('migration 0160', () => {
  it("adds places.child_order, 'name' by default, 'name' or 'custom' only", async () => {
    const [col] = await own<{ column_default: string; is_nullable: string }>(
      db,
      `SELECT column_default, is_nullable FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'places' AND column_name = 'child_order'`,
    );
    expect(col).toEqual({ column_default: "'name'::text", is_nullable: 'NO' });
    const p = await newPlace('Check shelf');
    await expect(
      own(db, "UPDATE public.places SET child_order = 'other' WHERE id = $1", [p]),
    ).rejects.toThrow(/places_child_order_chk/);
    const [grant] = await own<{ ok: boolean }>(
      db,
      `SELECT has_column_privilege('kept_app', 'public.places', 'child_order', 'UPDATE') AS ok`,
    );
    expect(grant?.ok).toBe(true);
  });
});

describe('Custom order (PATCH childOrder, POST reorder)', () => {
  // catalogue: PATCH /api/v1/places/:id
  it('switches a place to Custom order and back, audited and undoable, with sort kept', async () => {
    const shed = await newPlace('Tool shed', null, 'room');
    for (const n of ['Rack 10', 'Rack 2', 'Bench']) await newPlace(n, shed);
    expect((await view(shed)).childOrder).toBe('name');
    expect(await kidsOf(shed)).toEqual(['Bench', 'Rack 2', 'Rack 10']);
    // Places made before 1.13.0 kept their creation position: Custom shows it again.
    await own(
      db,
      `UPDATE public.places SET sort = CASE name WHEN 'Rack 10' THEN 1 WHEN 'Rack 2'
                     THEN 2 ELSE 3 END WHERE parent_id = $1`,
      [shed],
    );
    const before = await sortsOf(shed);

    expect((await setOrder(shed, 'custom')).statusCode).toBe(200);
    expect((await view(shed)).childOrder).toBe('custom');
    expect(await kidsOf(shed)).toEqual(['Rack 10', 'Rack 2', 'Bench']);
    expect(await contentsOf(shed)).toEqual(['Rack 10', 'Rack 2', 'Bench']);
    const [event] = (await eventsOf(db, home.id, shed)).slice(-1);
    expect(event?.action).toBe('place.update');
    expect(event?.diff.child_order).toEqual({ before: 'name', after: 'custom', class: 'plain' });
    expect(event?.undoable_until).not.toBeNull();

    // Back to A to Z: no position changes, and Custom again brings the same order.
    expect((await setOrder(shed, 'name')).statusCode).toBe(200);
    expect(await kidsOf(shed)).toEqual(['Bench', 'Rack 2', 'Rack 10']);
    expect(await sortsOf(shed)).toEqual(before);
    const [back] = (await eventsOf(db, home.id, shed)).slice(-1);
    const undo = await call(t, `/api/v1/audit/${back?.id}/undo`, { as: louis, body: {} });
    expect(undo.statusCode, undo.body).toBe(200);
    expect((await view(shed)).childOrder).toBe('custom');
    expect(await kidsOf(shed)).toEqual(['Rack 10', 'Rack 2', 'Bench']);
  });

  it('refuses a viewer and an order that is neither', async () => {
    const p = await newPlace('Loft', null, 'room');
    expect((await setOrder(p, 'custom', talia)).statusCode).toBe(403);
    const current = await view(p);
    const bad = await call(t, `/api/v1/places/${p}`, {
      as: louis,
      method: 'PATCH',
      headers: { 'if-match': String(current.rowVersion) },
      body: { childOrder: 'newest' },
    });
    expect(bad.statusCode).toBe(400);
  });

  // catalogue: POST /api/v1/places/:id/reorder
  it('moves a place up and down among its siblings, audited as place.reorder', async () => {
    const pantry = await newPlace('Pantry', null, 'room');
    const ids: Record<string, string> = {};
    for (const n of ['Shelf 1', 'Shelf 2', 'Shelf 3', 'Shelf 10'])
      ids[n] = await newPlace(n, pantry);
    expect((await setOrder(pantry, 'custom')).statusCode).toBe(200);
    // Every position 0: Custom starts A to Z.
    expect(await kidsOf(pantry)).toEqual(['Shelf 1', 'Shelf 2', 'Shelf 3', 'Shelf 10']);

    const down = ok(await reorder(pantry, ids['Shelf 1'] as string, 'down')) as unknown as {
      order: string[];
    };
    expect(down.order).toEqual([ids['Shelf 2'], ids['Shelf 1'], ids['Shelf 3'], ids['Shelf 10']]);
    expect(await kidsOf(pantry)).toEqual(['Shelf 2', 'Shelf 1', 'Shelf 3', 'Shelf 10']);
    expect(await contentsOf(pantry)).toEqual(['Shelf 2', 'Shelf 1', 'Shelf 3', 'Shelf 10']);
    ok(await reorder(pantry, ids['Shelf 10'] as string, 'up'));
    expect(await kidsOf(pantry)).toEqual(['Shelf 2', 'Shelf 1', 'Shelf 10', 'Shelf 3']);
    expect(await sortsOf(pantry)).toEqual({
      'Shelf 2': 0,
      'Shelf 1': 1,
      'Shelf 10': 2,
      'Shelf 3': 3,
    });
    const [event] = (await eventsOf(db, home.id, pantry)).slice(-1);
    expect(event?.action).toBe('place.reorder');
    expect(event?.diff.order?.after).toEqual([
      ids['Shelf 2'],
      ids['Shelf 1'],
      ids['Shelf 10'],
      ids['Shelf 3'],
    ]);

    // At an edge nothing moves.
    const edge = ok(await reorder(pantry, ids['Shelf 2'] as string, 'up')) as unknown as {
      order: string[];
    };
    expect(edge.order[0]).toBe(ids['Shelf 2']);

    // A to Z, then Custom again: the order comes back.
    expect((await setOrder(pantry, 'name')).statusCode).toBe(200);
    expect(await kidsOf(pantry)).toEqual(['Shelf 1', 'Shelf 2', 'Shelf 3', 'Shelf 10']);
    expect((await setOrder(pantry, 'custom')).statusCode).toBe(200);
    expect(await kidsOf(pantry)).toEqual(['Shelf 2', 'Shelf 1', 'Shelf 10', 'Shelf 3']);

    // MCP list_contents reads the same order.
    const ctx: ToolContext = {
      deps: { pools: db.pools, jobs: null, files: null, providerResolved: async () => true },
      principal: { userId: louis.userId, mfa: false, scope: 'write' },
      locale: 'en',
      requestId: 'custom-order-test',
      via: 'mcp',
    };
    const env = (await runTool(ctx, 'list_contents', { place_id: pantry })) as {
      data: { items: { place?: { untrusted: { name: string } } }[] };
    };
    expect(env.data.items.flatMap((i) => (i.place ? [i.place.untrusted.name] : []))).toEqual([
      'Shelf 2',
      'Shelf 1',
      'Shelf 10',
      'Shelf 3',
    ]);
  });

  it('puts a place made in, or moved into, a place in Custom order last', async () => {
    const hall = await newPlace('Hall', null, 'room');
    for (const n of ['Peg 3', 'Peg 1']) await newPlace(n, hall);
    expect((await setOrder(hall, 'custom')).statusCode).toBe(200);
    const pegs = await kidsOf(hall);
    expect(pegs).toEqual(['Peg 1', 'Peg 3']);
    await newPlace('Hook', hall);
    expect(await kidsOf(hall)).toEqual(['Peg 1', 'Peg 3', 'Hook']);
    const elsewhere = await newPlace('Basket', null, 'room');
    const current = await view(elsewhere);
    const moved = await call(t, `/api/v1/places/${elsewhere}`, {
      as: louis,
      method: 'PATCH',
      headers: { 'if-match': String(current.rowVersion) },
      body: { parentId: hall },
    });
    expect(moved.statusCode, moved.body).toBe(200);
    expect(await kidsOf(hall)).toEqual(['Peg 1', 'Peg 3', 'Hook', 'Basket']);
    // In A to Z, a new place keeps the position it was given (0).
    const loft = await newPlace('Loft room', null, 'room');
    const shelf = await newPlace('Shelf', loft);
    const [row] = await own<{ sort: number }>(db, 'SELECT sort FROM public.places WHERE id = $1', [
      shelf,
    ]);
    expect(row?.sort).toBe(0);
  });

  it('refuses a move while A to Z (409), a place that is not inside (404) and a viewer (403)', async () => {
    const attic = await newPlace('Attic', null, 'room');
    const a = await newPlace('Trunk', attic);
    await newPlace('Chest', attic);
    const elsewhere = await newPlace('Cellar', null, 'room');
    expect((await reorder(attic, a, 'down')).statusCode).toBe(409);
    expect((await setOrder(attic, 'custom')).statusCode).toBe(200);
    expect((await reorder(attic, elsewhere, 'down')).statusCode).toBe(404);
    expect((await reorder(attic, a, 'down', talia)).statusCode).toBe(403);
    const bad = await call(t, `/api/v1/places/${attic}/reorder`, {
      as: louis,
      body: { placeId: a, direction: 'sideways' },
    });
    expect(bad.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------------------------

describe('POST /api/v1/places/:id/convert-children-to-containers', () => {
  // catalogue: POST /api/v1/places/:id/convert-children-to-containers
  it('turns leaf sub-places into boxes, refusing the rest per row, each undoable', async () => {
    const garage = await newPlace('Garage', null, 'room');
    const box1 = await newPlace('Box 1', garage);
    const box2 = await newPlace('Box 2', garage);
    const rack = await newPlace('Rack', garage);
    await newPlace('Rack shelf', rack);
    const other = await newPlace('Hall', null, 'room');
    const spanner = await createThing(t, louis, home, { name: 'Spanner', placeId: box1 });

    const res = await convertMany(garage, [box1, box2, rack, other]);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toEqual({
      results: [
        { placeId: box1, status: 'converted', thingId: box1 },
        { placeId: box2, status: 'converted', thingId: box2 },
        { placeId: rack, status: 'refused', reason: 'has_places' },
        { placeId: other, status: 'refused', reason: 'not_here' },
      ],
    });
    const { places, boxes } = await tree();
    expect(places.map((p) => p.id)).toEqual(expect.arrayContaining([rack, other]));
    expect(places.some((p) => p.id === box1 || p.id === box2)).toBe(false);
    expect(boxes.filter((b) => b.placeId === garage).map((b) => b.name)).toEqual([
      'Box 1',
      'Box 2',
    ]);
    const [inside] = await own<{ container_id: string | null }>(
      db,
      'SELECT container_id FROM public.things WHERE id = $1',
      [spanner.id],
    );
    expect(inside?.container_id).toBe(box1);

    const ids = auditIds(res);
    expect(ids).toHaveLength(2);
    const [event] = (await eventsOf(db, home.id, box1)).filter(
      (e) => e.action === 'place.convert_to_container',
    );
    expect(event?.id).toBe(ids[0]);
    expect(event?.undoable_until).not.toBeNull();
    expect(event?.diff).toMatchObject({
      entity_type: { before: 'place', after: 'thing' },
      kind_key: { before: 'zone' },
      sort: { before: 0 },
    });
  });

  it('one Undo brings every place back with its kind, icon, position, fields and contents', async () => {
    const shed = await newPlace('Bike shed', null, 'room');
    const crateA = await newPlace('Crate A', shed);
    const crateB = await newPlace('Crate B', shed, 'room');
    await own(
      db,
      `UPDATE public.places SET icon = 'lucide:package', sort = 4, child_order = 'custom',
              custom = '{"colour": "green"}'::jsonb WHERE id = $1`,
      [crateA],
    );
    const pump = await createThing(t, louis, home, { name: 'Pump', placeId: crateA });
    const { code } = ok(
      await call(t, `/api/v1/places/${crateA}/label`, { as: louis, body: {} }),
    ) as unknown as { code: string };

    const res = await convertMany(shed, [crateA, crateB]);
    expect(res.statusCode, res.body).toBe(200);
    const ids = auditIds(res);
    expect(ids).toHaveLength(2);

    const undo = await undoTogether(ids);
    expect(undo.statusCode, undo.body).toBe(200);
    const a = await view(crateA);
    expect(a).toMatchObject({
      parentId: shed,
      name: 'Crate A',
      kindKey: 'zone',
      icon: 'lucide:package',
      childOrder: 'custom',
      shortCode: code,
    });
    expect(a.counts.things).toBe(1);
    expect((await view(crateB)).kindKey).toBe('room');
    const [row] = await own<{ sort: number; custom: object }>(
      db,
      'SELECT sort, custom FROM public.places WHERE id = $1',
      [crateA],
    );
    // The value the box set aside (not a field of a box) is the place's again.
    expect(row).toEqual({ sort: 4, custom: { colour: 'green' } });
    const [pumpRow] = await own<{ place_id: string | null; container_id: string | null }>(
      db,
      'SELECT place_id, container_id FROM public.things WHERE id = $1',
      [pump.id],
    );
    expect(pumpRow).toEqual({ place_id: crateA, container_id: null });
    expect((await tree()).boxes.some((b) => b.id === crateA || b.id === crateB)).toBe(false);
    const undone = (await eventsOf(db, home.id, crateA)).filter((e) => e.undo_of === ids[0]);
    expect(undone).toHaveLength(1);
  });

  it('refuses the whole Undo when a box changed since, and lets a member undo only their own', async () => {
    const porch = await newPlace('Porch', null, 'room');
    const tub1 = await newPlace('Tub 1', porch);
    const tub2 = await newPlace('Tub 2', porch);
    const res = await convertMany(porch, [tub1, tub2]);
    const ids = auditIds(res);
    expect(ids).toHaveLength(2);

    // Someone else's conversion: a member can't undo it.
    expect((await undoTogether(ids, alfred)).statusCode).toBe(403);

    // A box renamed since: nothing comes back.
    const box = await get<{ rowVersion: number }>(`/api/v1/things/${tub2}`);
    const rename = await call(t, `/api/v1/things/${tub2}`, {
      as: alfred,
      method: 'PATCH',
      headers: { 'if-match': String(box.rowVersion) },
      body: { name: 'Blue tub' },
    });
    expect(rename.statusCode, rename.body).toBe(200);
    const refused = await undoTogether(ids);
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ code: 'undo_refused', reason: 'changed_since' });
    const { boxes } = await tree();
    expect(
      boxes
        .filter((b) => b.placeId === porch)
        .map((b) => b.id)
        .sort(),
    ).toEqual([tub1, tub2].sort());
  });

  it('refuses the Undo when a box was tagged or linked since, and changes nothing', async () => {
    const shed = await newPlace('Potting shed', null, 'room');
    const tray1 = await newPlace('Tray 1', shed);
    const tray2 = await newPlace('Tray 2', shed);
    const trowel = await createThing(t, louis, home, { name: 'Trowel', placeId: shed });
    const tagged = auditIds(await convertMany(shed, [tray1]));
    const linked = auditIds(await convertMany(shed, [tray2]));
    // Neither bumps the box's row version: a tag and a link are rows of their own.
    const [tag] = await own<{ id: string }>(
      db,
      `INSERT INTO public.tags (owner_account_id, name) VALUES ($1, 'Seeds') RETURNING id`,
      [home.accountId],
    );
    await own(
      db,
      'INSERT INTO public.thing_tags (location_id, thing_id, tag_id) VALUES ($1, $2, $3)',
      [home.id, tray1, tag?.id],
    );
    await own(
      db,
      `INSERT INTO public.thing_links (location_id, from_thing_id, to_thing_id, kind)
       VALUES ($1, $2, $3, 'accessory_of')`,
      [home.id, trowel.id, tray2],
    );
    const cases: [string[], string][] = [
      [tagged, 'tags'],
      [linked, 'links'],
    ];
    for (const [ids, field] of cases) {
      const refused = await undoTogether(ids);
      expect(refused.statusCode, refused.body).toBe(409);
      expect(refused.json()).toMatchObject({
        code: 'undo_refused',
        reason: 'changed_since',
        conflicts: [field],
      });
    }
    const { boxes } = await tree();
    expect(
      boxes
        .filter((b) => b.placeId === shed)
        .map((b) => b.id)
        .sort(),
    ).toEqual([tray1, tray2].sort());
    const [kept] = await own<{ tags: number; links: number }>(
      db,
      `SELECT (SELECT count(*) FROM public.thing_tags WHERE thing_id = $1)::int AS tags,
              (SELECT count(*) FROM public.thing_links WHERE to_thing_id = $2)::int AS links`,
      [tray1, tray2],
    );
    expect(kept).toEqual({ tags: 1, links: 1 });
  });

  it('refuses a viewer (403) and a place that is not live (404); the single convert keeps no undo', async () => {
    const yard = await newPlace('Yard', null, 'room');
    const bin = await newPlace('Bin', yard);
    expect((await convertMany(yard, [bin], talia)).statusCode).toBe(403);
    const gone = await newPlace('Old yard', null, 'room');
    await own(db, 'UPDATE public.places SET deleted_at = now() WHERE id = $1', [gone]);
    expect((await convertMany(gone, [bin])).statusCode).toBe(404);
    const empty = await call(t, `/api/v1/places/${yard}/convert-children-to-containers`, {
      as: louis,
      body: { placeIds: [] },
    });
    expect(empty.statusCode).toBe(400);

    const single = await call(t, `/api/v1/places/${bin}/convert-to-container`, {
      as: louis,
      body: {},
    });
    expect(single.statusCode).toBe(200);
    expect(single.headers['x-kept-audit-event']).toBeUndefined();
    expect(undoableActions()).toContain('place.convert_to_container');
  });

  it('chooses the box type when one is named', async () => {
    const study = await newPlace('Study', null, 'room');
    const drawer = await newPlace('Drawer', study);
    const binType = await builtinType(db, 'box_bin');
    const res = await call(t, `/api/v1/places/${study}/convert-children-to-containers`, {
      as: louis,
      body: { placeIds: [drawer], typeId: binType },
    });
    expect(res.statusCode, res.body).toBe(200);
    const [row] = await own<{ type_id: string }>(
      db,
      'SELECT type_id FROM public.things WHERE id = $1',
      [drawer],
    );
    expect(row?.type_id).toBe(binType);
  });
});
