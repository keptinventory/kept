import type { LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import { call, join, type Person, peopleApp, person, type RecordedJob } from '../../test/people.js';
import { createLocation, createThing, eventsOf, type Loc, ok, own } from '../../test/things.js';

// Furniture's compartments after it is made (#238, 1.14.4): turning it (Renumber or Keep the
// codes), merging compartments and splitting them, each one undoable event whose undo puts
// everything back; old codes and labels keep resolving. Through the front door, in the web
// contract's shapes (apps/web/src/api/inventory/types.ts "furniture").
//
// The household: Ibrahim owns Home; Louis is a member there and Talia a viewer. Alfred has his own
// household and sees nothing of Ibrahim's.

let db: TestDb;
let t: TestApp;
let ibrahim: Person;
let louis: Person;
let talia: Person;
let alfred: Person;
let home: Loc;
const sent: RecordedJob[] = [];

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  t = await peopleApp(db, { sent });
  ibrahim = await person(t, db, 'ibrahim');
  louis = await person(t, db, 'louis');
  talia = await person(t, db, 'talia');
  alfred = await person(t, db, 'alfred');
  home = await createLocation(t, db, ibrahim, 'household', 'Home');
  await join(db, home.id, louis.userId, 'member');
  await join(db, home.id, talia.userId, 'viewer');
});

afterAll(async () => {
  await t.app.close();
});

type View = {
  id: string;
  name: string;
  furniture: {
    columns: number;
    rows: number;
    canTurn: boolean;
    layout: { orientation: string };
    compartments: {
      id: string;
      name: string;
      n: number;
      row: number;
      col: number;
      rows: number;
      cols: number;
      shortCode: string | null;
      code: string | null;
      things: number;
    }[];
  } | null;
};

const auditIds = (res: LightMyRequestResponse) =>
  String(res.headers['x-kept-audit-event'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const undo = (as: Person, eventId: string) =>
  call(t, `/api/v1/audit/${eventId}/undo`, { as, body: {} });

async function room(name: string): Promise<string> {
  return ok(
    await call(t, `/api/v1/locations/${home.id}/places`, {
      as: ibrahim,
      body: { name, kindKey: 'room' },
    }),
    201,
  ).id as string;
}

let serial = 0;
/** A cube shelf in a new room, coded `KX<nn>` with `{parent}-F{col:02}{row:02}`. */
async function shelf(builtin = 'cube_2x4', orientation = 'upright') {
  serial += 1;
  const code = `KX${String(serial).padStart(2, '0')}`;
  const res = await call(t, `/api/v1/locations/${home.id}/places/from-template`, {
    as: ibrahim,
    body: {
      parentId: await room(`Room ${serial}`),
      template: { builtin },
      name: `Cube shelf ${serial}`,
      orientation,
      code,
      codePattern: '{parent}-F{col:02}{row:02}',
    },
  });
  const made = ok(res, 201) as unknown as {
    place: { id: string };
    compartments: { id: string; n: number; code: string }[];
  };
  return { id: made.place.id, code, cells: made.compartments };
}

const view = async (id: string) =>
  ok(await call(t, `/api/v1/places/${id}`, { as: ibrahim })) as unknown as View;

const furnitureOf = async (id: string) => {
  const f = (await view(id)).furniture;
  expect(f).not.toBeNull();
  return f as NonNullable<View['furniture']>;
};

const turn = (as: Person, id: string, body: Record<string, unknown>) =>
  call(t, `/api/v1/places/${id}/turn`, { as, body });
const merge = (as: Person, id: string, compartmentIds: string[]) =>
  call(t, `/api/v1/places/${id}/merge-compartments`, { as, body: { compartmentIds } });
const split = (as: Person, id: string, compartmentId: string) =>
  call(t, `/api/v1/places/${id}/split-compartment`, { as, body: { compartmentId } });

const codesOf = async (placeId: string) =>
  (
    await own<{ code: string }>(
      db,
      `SELECT code FROM public.legacy_codes WHERE place_id = $1 AND source = 'own' ORDER BY code`,
      [placeId],
    )
  ).map((r) => r.code);

/** What a scanned or typed code opens, as the scanner asks. */
const opens = async (as: Person, text: string) => {
  const r = ok(await call(t, '/api/v1/scan/resolve', { as, body: { text } }));
  return r.outcome === 'open' ? (r.target as { id: string }).id : String(r.outcome);
};

const label = async (placeId: string) =>
  ok(await call(t, `/api/v1/places/${placeId}/label`, { as: ibrahim, body: {} })).code as string;

const grid = (f: NonNullable<View['furniture']>) =>
  f.compartments
    .slice()
    .sort((a, b) => a.n - b.n)
    .map(
      (c) =>
        `${c.n}:${c.name}@${c.row},${c.col}${c.rows * c.cols > 1 ? `+${c.rows}x${c.cols}` : ''}`,
    );

describe('the furniture view', () => {
  it('shows its grid as it stands and its compartments in counting order', async () => {
    const s = await shelf('cube_2x4', 'side');
    const f = await furnitureOf(s.id);
    expect(f).toMatchObject({ columns: 4, rows: 2, canTurn: true });
    expect(f.layout.orientation).toBe('side');
    expect(grid(f).slice(0, 2)).toEqual(['1:Cube 1@1,1', '2:Cube 2@1,2']);
    expect(f.compartments[0]?.code).toBe(`${s.code}-F0101`);
    // Any other place has none.
    expect((await view(home.unplacedId)).furniture).toBeNull();
  });
});

describe('turning furniture', () => {
  // catalogue: POST /api/v1/places/:id/turn
  it('Keep the codes: moves each compartment with the unit, one undoable event', async () => {
    const s = await shelf();
    const was = grid(await furnitureOf(s.id));
    const res = await turn(ibrahim, s.id, { direction: 'right', renumber: false });
    const body = ok(res) as unknown as { place: View };
    const f = body.place.furniture as NonNullable<View['furniture']>;
    expect(f).toMatchObject({ columns: 4, rows: 2 });
    expect(f.layout.orientation).toBe('side');
    // Cube 1 was the top left upright; its top went right, so it is the top right now.
    const one = f.compartments.find((c) => c.name === 'Cube 1');
    expect(one).toMatchObject({ n: 1, row: 1, col: 4, code: `${s.code}-F0101` });
    expect(f.compartments.find((c) => c.name === 'Cube 7')).toMatchObject({ row: 1, col: 1 });
    const [eventId] = auditIds(res);
    const events = await eventsOf(db, home.id, s.id);
    const ev = events.find((e) => e.id === eventId);
    expect(ev?.action).toBe('place.turn');
    expect(ev?.undoable_until).not.toBeNull();
    expect(ev?.diff.turned?.after).toBe('right');

    ok(await undo(ibrahim, eventId as string));
    const back = await furnitureOf(s.id);
    expect(back).toMatchObject({ columns: 2, rows: 4 });
    expect(grid(back)).toEqual(was);
    expect(back.compartments.find((c) => c.name === 'Cube 1')).toMatchObject({ row: 1, col: 1 });
  });

  it('Renumber: numbers, names and codes each by where it now stands; old codes still open', async () => {
    const s = await shelf();
    const before = new Map(s.cells.map((c) => [c.n, c.id]));
    const shortC = await label(before.get(3) as string);
    const res = await turn(louis, s.id, { direction: 'right', renumber: true });
    const f = (ok(res) as unknown as { place: View }).place.furniture as NonNullable<
      View['furniture']
    >;
    expect(grid(f)).toEqual([
      '1:Cube 1@1,1',
      '2:Cube 2@1,2',
      '3:Cube 3@1,3',
      '4:Cube 4@1,4',
      '5:Cube 5@2,1',
      '6:Cube 6@2,2',
      '7:Cube 7@2,3',
      '8:Cube 8@2,4',
    ]);
    // The old Cube 1 (top left upright) is the top right now, Cube 4.
    const wasOne = before.get(1) as string;
    expect(f.compartments.find((c) => c.id === wasOne)).toMatchObject({ n: 4, name: 'Cube 4' });
    expect(await codesOf(wasOne)).toEqual([`${s.code}-F0401`]);
    // An old code opens the compartment now in the place it named: F0102 is column 1, row 2.
    const nowAt = (n: number) => f.compartments.find((c) => c.n === n)?.id;
    expect(await opens(ibrahim, `${s.code}-F0102`)).toBe(nowAt(5));
    // F0103 named row 3, which a unit on its side hasn't: it opens the compartment now at its
    // number, 5.
    expect(await opens(ibrahim, `${s.code}-F0103`)).toBe(nowAt(5));
    expect(await opens(ibrahim, `${s.code}-F0204`)).toBe(nowAt(8));
    // The printed label stays on its compartment.
    expect(await opens(ibrahim, shortC)).toBe(before.get(3));

    // One Undo puts names, numbers and codes back.
    ok(await undo(louis, auditIds(res)[0] as string));
    const back = await furnitureOf(s.id);
    expect(back.compartments.find((c) => c.id === wasOne)).toMatchObject({
      n: 1,
      name: 'Cube 1',
      row: 1,
      col: 1,
    });
    expect(await codesOf(wasOne)).toEqual([`${s.code}-F0101`]);
    expect(await opens(ibrahim, `${s.code}-F0103`)).toBe(before.get(5));
  });

  it('refuses a new code something else here already has, changing nothing', async () => {
    const s = await shelf();
    const other = await room('Hall');
    ok(
      await call(t, `/api/v1/places/${other}/codes`, {
        as: ibrahim,
        body: { code: `${s.code}-F0401` },
      }),
      201,
    );
    const res = await turn(ibrahim, s.id, { direction: 'right', renumber: true });
    expect(res.statusCode, res.body).toBe(409);
    expect(res.json().failed).toMatchObject({
      code: `${s.code}-F0401`,
      reason: 'taken',
    });
    expect((await furnitureOf(s.id)).layout.orientation).toBe('upright');
  });

  it('turns only a grid that isn’t square, and only for members and up', async () => {
    const square = await shelf('cube_2x2');
    expect(
      (await turn(ibrahim, square.id, { direction: 'left', renumber: false })).statusCode,
    ).toBe(409);
    const s = await shelf();
    expect((await turn(talia, s.id, { direction: 'left', renumber: false })).statusCode).toBe(403);
    expect((await turn(alfred, s.id, { direction: 'left', renumber: false })).statusCode).toBe(404);
    const plain = await room('Plain');
    expect((await turn(ibrahim, plain, { direction: 'left', renumber: false })).statusCode).toBe(
      409,
    );
  });

  it('won’t undo once a compartment changed since', async () => {
    const s = await shelf();
    const res = await turn(ibrahim, s.id, { direction: 'left', renumber: true });
    const f = await furnitureOf(s.id);
    const first = f.compartments[0] as { id: string };
    const place = ok(await call(t, `/api/v1/places/${first.id}`, { as: ibrahim }));
    ok(
      await call(t, `/api/v1/places/${first.id}`, {
        as: ibrahim,
        method: 'PATCH',
        body: { name: 'Cables' },
        headers: { 'if-match': String(place.rowVersion) },
      }),
    );
    const refused = await undo(ibrahim, auditIds(res)[0] as string);
    expect(refused.statusCode).toBe(409);
    expect(refused.json().reason).toBe('changed_since');
  });
});

describe('merging and splitting compartments', () => {
  // catalogue: POST /api/v1/places/:id/merge-compartments
  it('merges into the top left one: its code, the others’ codes and labels, their things', async () => {
    const s = await shelf('cube_2x2');
    const [a, b, c] = s.cells.map((x) => x.id) as [string, string, string, string];
    const shortB = await label(b);
    const thing = await createThing(t, ibrahim, home, { name: 'Cables', placeId: b });
    const res = await merge(ibrahim, s.id, [b, a]);
    const f = (ok(res) as unknown as { place: View }).place.furniture as NonNullable<
      View['furniture']
    >;
    expect(grid(f)).toEqual(['1:Cube 1@1,1+1x2', '3:Cube 3@2,1', '4:Cube 4@2,2']);
    expect(f.compartments[0]).toMatchObject({ id: a, code: `${s.code}-F0101`, things: 1 });
    // B is in the trash; its code and its printed label open the merged compartment.
    const [gone] = await own<{ deleted: boolean; cell: unknown }>(
      db,
      'SELECT deleted_at IS NOT NULL AS deleted, cell FROM public.places WHERE id = $1',
      [b],
    );
    expect(gone).toEqual({ deleted: true, cell: null });
    expect(await opens(ibrahim, `${s.code}-F0201`)).toBe(a);
    expect(await opens(ibrahim, shortB)).toBe(a);
    const [moved] = await own<{ place_id: string }>(
      db,
      'SELECT place_id FROM public.things WHERE id = $1',
      [thing.id],
    );
    expect(moved?.place_id).toBe(a);
    const thingEvents = await eventsOf(db, home.id, thing.id);
    expect(thingEvents.at(-1)?.action).toBe('thing.move');
    const ev = (await eventsOf(db, home.id, s.id)).find((e) => e.id === auditIds(res)[0]);
    expect(ev?.action).toBe('place.merge_compartments');

    // A merge of compartments that don't make a rectangle.
    expect((await merge(ibrahim, s.id, [a, c])).statusCode).toBe(400);

    // One Undo brings B back, with its code, its label and its things.
    ok(await undo(ibrahim, auditIds(res)[0] as string));
    expect(await opens(ibrahim, `${s.code}-F0201`)).toBe(b);
    expect(await opens(ibrahim, shortB)).toBe(b);
    const [home2] = await own<{ place_id: string }>(
      db,
      'SELECT place_id FROM public.things WHERE id = $1',
      [thing.id],
    );
    expect(home2?.place_id).toBe(b);
    expect(grid(await furnitureOf(s.id))).toEqual([
      '1:Cube 1@1,1',
      '2:Cube 2@1,2',
      '3:Cube 3@2,1',
      '4:Cube 4@2,2',
    ]);
    // B's short ID is its own primary again.
    const [primary] = await own<{ is_primary: boolean }>(
      db,
      'SELECT is_primary FROM public.short_ids WHERE code = $1',
      [shortB],
    );
    expect(primary?.is_primary).toBe(true);
  });

  // catalogue: POST /api/v1/places/:id/split-compartment
  it('splits a merged compartment back into its cells, each with its code', async () => {
    const s = await shelf('cube_2x2');
    const [a, b, c, d] = s.cells.map((x) => x.id) as [string, string, string, string];
    ok(await merge(ibrahim, s.id, [a, b, c, d]));
    expect(grid(await furnitureOf(s.id))).toEqual(['1:Cube 1@1,1+2x2']);
    const res = await split(louis, s.id, a);
    const f = (ok(res) as unknown as { place: View }).place.furniture as NonNullable<
      View['furniture']
    >;
    expect(grid(f)).toEqual(['1:Cube 1@1,1', '2:Cube 2@1,2', '3:Cube 3@2,1', '4:Cube 4@2,2']);
    // The same places, out of the trash, with their codes.
    expect(f.compartments.map((x) => x.id)).toEqual([a, b, c, d]);
    expect(await codesOf(d)).toEqual([`${s.code}-F0202`]);
    expect(await opens(ibrahim, `${s.code}-F0202`)).toBe(d);
    const ev = (await eventsOf(db, home.id, s.id)).find((e) => e.id === auditIds(res)[0]);
    expect(ev?.action).toBe('place.split');

    // Its Undo merges them again.
    ok(await undo(louis, auditIds(res)[0] as string));
    expect(grid(await furnitureOf(s.id))).toEqual(['1:Cube 1@1,1+2x2']);
    expect(await opens(ibrahim, `${s.code}-F0202`)).toBe(a);
    // A single cell can't be split.
    const single = await shelf('cube_2x2');
    expect((await split(ibrahim, single.id, single.cells[0]?.id as string)).statusCode).toBe(409);
  });

  it('won’t undo a split once something was put in one of its pieces', async () => {
    const s = await shelf('cube_1x4');
    const [a, b] = s.cells.map((x) => x.id) as [string, string];
    ok(await merge(ibrahim, s.id, [a, b]));
    const res = await split(ibrahim, s.id, a);
    ok(res);
    // A thing put in the second piece: undoing would trash the piece around it.
    const vase = await createThing(t, ibrahim, home, { name: 'Vase', placeId: b });
    const refused = await undo(ibrahim, auditIds(res)[0] as string);
    expect(refused.statusCode, refused.body).toBe(409);
    const [piece] = await own<{ live: boolean }>(
      db,
      'SELECT deleted_at IS NULL AS live FROM public.places WHERE id = $1',
      [b],
    );
    expect(piece?.live).toBe(true);
    // Moved out again, the undo goes through.
    await own(db, 'UPDATE public.things SET place_id = $2 WHERE id = $1', [vase.id, s.id]);
    ok(await undo(ibrahim, auditIds(res)[0] as string));
    expect(grid(await furnitureOf(s.id))[0]).toBe('1:Cube 1@1,1+2x1');
  });

  it('makes a new place for a cell whose place was deleted for good', async () => {
    const s = await shelf('cube_1x4');
    const [a, b] = s.cells.map((x) => x.id) as [string, string];
    ok(await merge(ibrahim, s.id, [a, b]));
    const gone = await call(t, `/api/v1/places/${b}`, { as: ibrahim, method: 'DELETE' });
    expect(gone.statusCode, gone.body).toBe(204);
    const f = (ok(await split(ibrahim, s.id, a)) as unknown as { place: View }).place
      .furniture as NonNullable<View['furniture']>;
    const second = f.compartments.find((x) => x.n === 2);
    expect(second?.id).not.toBe(b);
    expect(second?.name).toBe('Cube 2');
    expect(second?.code).toBe(`${s.code}-F0102`);
  });

  it('turns a merged compartment with the unit', async () => {
    const s = await shelf();
    const [a, , c] = s.cells.map((x) => x.id) as [string, string, string];
    ok(await merge(ibrahim, s.id, [a, c]));
    const f = (
      ok(await turn(ibrahim, s.id, { direction: 'right', renumber: false })) as unknown as {
        place: View;
      }
    ).place.furniture as NonNullable<View['furniture']>;
    expect(f.compartments.find((x) => x.id === a)).toMatchObject({
      row: 1,
      col: 3,
      rows: 1,
      cols: 2,
    });
    // Split on its side gives the other cell back where it now stands.
    const back = (ok(await split(ibrahim, s.id, a)) as unknown as { place: View }).place
      .furniture as NonNullable<View['furniture']>;
    expect(back.compartments.find((x) => x.id === c)).toMatchObject({ row: 1, col: 4, rows: 1 });
  });
});

describe('the database door that moves compartment labels (0167)', () => {
  // kept.move_compartment_short_ids is SECURITY DEFINER: kept_app can't move a short ID itself
  // (0016). Called straight, as the app's login with someone's scope, it moves only labels of
  // one piece of furniture's own compartments, for someone who may write in its location.
  const door = async (as: Person, furniture: string, moves: unknown[]) => {
    const c = await db.pools.app.connect();
    try {
      await c.query('BEGIN');
      await c.query(
        "SELECT set_config('app.user_id', $1, true), set_config('app.mfa', 'true', true)",
        [as.userId],
      );
      const r = await c.query<{ n: number }>(
        'SELECT kept.move_compartment_short_ids($1, $2::jsonb) AS n',
        [furniture, JSON.stringify(moves)],
      );
      return r.rows[0]?.n;
    } catch (e) {
      return (e as { code?: string }).code;
    } finally {
      await c.query('ROLLBACK');
      c.release();
    }
  };

  it('moves its own compartments’ labels for a member, and nothing for anyone else', async () => {
    const a = await shelf();
    const b = await shelf();
    const fa = (await furnitureOf(a.id)).compartments.sort((x, y) => x.n - y.n);
    const fb = (await furnitureOf(b.id)).compartments.sort((x, y) => x.n - y.n);
    const [a1, a2] = fa;
    const [b1] = fb;
    if (!a1 || !a2 || !b1) throw new Error('a 2 × 4 shelf has compartments');
    // A compartment has a short ID once its label is printed.
    const codeA1 = await label(a1.id);
    const codeB1 = await label(b1.id);
    const mine = [{ code: codeA1, place_id: a2.id, is_primary: false }];

    expect(await door(louis, a.id, mine)).toBe(1);
    // A viewer, and someone from another household, are turned away.
    expect(await door(talia, a.id, mine)).toBe('42501');
    expect(await door(alfred, a.id, mine)).toBe('42501');
    // Another furniture's label, or a label sent to another furniture's compartment.
    expect(await door(louis, a.id, [{ code: codeB1, place_id: a2.id, is_primary: false }])).toBe(
      '42501',
    );
    expect(await door(louis, a.id, [{ code: codeA1, place_id: b1.id, is_primary: false }])).toBe(
      '42501',
    );
    // The furniture's own label isn't a compartment's.
    const own = await label(a.id);
    expect(await door(louis, a.id, [{ code: own, place_id: a2.id, is_primary: false }])).toBe(
      '42501',
    );
  });
});

describe('search after a change', () => {
  // A compartment's name and parent are in the things' place path (search, breadcrumbs): each
  // change, and its undo, queues the location's reindex, as a place rename or move does.
  const reindexed = () => {
    const n = sent.filter(
      (j) => j.name === 'reindex' && (j.data as { locationId?: string }).locationId === home.id,
    ).length;
    sent.length = 0;
    return n;
  };

  it('reindexes the location after a turn, a merge, a split and each undo', async () => {
    const s = await shelf();
    const cells = (await furnitureOf(s.id)).compartments.sort((a, b) => a.n - b.n);
    reindexed();
    const turned = await turn(ibrahim, s.id, { direction: 'right', renumber: true });
    ok(turned);
    expect(reindexed()).toBeGreaterThan(0);
    ok(await undo(ibrahim, auditIds(turned)[0] as string));
    expect(reindexed()).toBeGreaterThan(0);
    const [a, b] = cells;
    if (!a || !b) throw new Error('a 2 × 4 shelf has compartments');
    const merged = await merge(ibrahim, s.id, [a.id, b.id]);
    ok(merged);
    expect(reindexed()).toBeGreaterThan(0);
    ok(await split(ibrahim, s.id, a.id));
    expect(reindexed()).toBeGreaterThan(0);
  });
});

describe('the map and the labels', () => {
  it('draws the compartments in the furniture and names the one a thing is in', async () => {
    const s = await shelf('cube_2x2');
    const [, b] = s.cells.map((x) => x.id) as [string, string];
    const thing = await createThing(t, ibrahim, home, { name: 'Lamp bulbs', placeId: b });
    const map = ok(
      await call(t, `/api/v1/locations/${home.id}/map`, { as: ibrahim }),
    ) as unknown as {
      nodes: {
        id: string;
        grid: { columns: number; rows: number } | null;
        compartments: { id: string; n: number }[];
      }[];
      things: { id: string; parentId: string; compartmentId: string | null }[];
    };
    const node = map.nodes.find((n) => n.id === s.id);
    expect(node?.grid).toEqual({ columns: 2, rows: 2, kind: 'grid' });
    expect(node?.compartments.map((c) => c.n)).toEqual([1, 2, 3, 4]);
    expect(map.things.find((x) => x.id === thing.id)).toMatchObject({
      parentId: s.id,
      compartmentId: b,
    });
  });

  it('prints a renumbered compartment with its new name, and a merged one with its own code', async () => {
    const s = await shelf();
    const ids = s.cells.map((x) => x.id);
    const codes = await Promise.all(ids.map(label));
    ok(await turn(ibrahim, s.id, { direction: 'right', renumber: true }));
    const preview = ok(
      await call(t, '/api/v1/labels/batches', {
        as: ibrahim,
        body: {
          locationId: home.id,
          kind: 'places',
          placeIds: [ids[0]],
          stock: 'a4_24_70x37',
          dryRun: true,
        },
      }),
    ) as unknown as { labels: { code: string; name: string }[] };
    expect(preview.labels).toEqual([expect.objectContaining({ code: codes[0], name: 'Cube 4' })]);
    // Merged, the one at the top left prints its own code, not the label of the cell it took in.
    ok(await merge(ibrahim, s.id, [ids[1] as string, ids[0] as string]));
    const merged = ok(
      await call(t, '/api/v1/labels/batches', {
        as: ibrahim,
        body: {
          locationId: home.id,
          kind: 'places',
          placeIds: [ids[0]],
          stock: 'a4_24_70x37',
          dryRun: true,
        },
      }),
    ) as unknown as { labels: { code: string }[] };
    expect(merged.labels.map((l) => l.code)).toEqual([codes[0]]);
  });
});
