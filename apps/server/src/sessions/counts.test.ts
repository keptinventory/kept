import { newId, type QueueItem } from '@kept/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import { call, join, type Person, peopleApp, person } from '../../test/people.js';
import { op, sent } from '../../test/sync-ops.js';
import {
  builtinType,
  createLocation,
  createThing,
  type Json,
  type Loc,
  ok,
  own,
  place,
  setDisplayName,
} from '../../test/things.js';
import type { ChannelSender } from '../reminders/channel.js';
import { runScan } from '../reminders/scan.js';

// Counts that keep every result (1.14, #172): what a count found missing, elsewhere, away or in
// an area nobody counted is stored beside what it applied; the Counts list, a count's result
// with its comparison, a box check's lines, planned counts and shared counts, through the front
// door as the web calls them.

let db: TestDb;
let t: TestApp;
let ibrahim: Person; // owner of Home
let louis: Person; // member of Home
let talia: Person; // viewer of Home
let home: Loc;
let boxType: string;
let murdock: string;

type Line = {
  thingId: string;
  readAt: string;
  action: string;
  to?: { placeId: string } | { containerId: string };
  quantity?: string;
  short?: 'not_here';
};
type Target =
  | { placeId: string; inside?: boolean }
  | { containerId: string }
  | { locationId: string };

const HOUR = 3_600_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

function session(target: Target, countedPlaceIds?: string[]) {
  return {
    id: newId(),
    mode: 'count' as const,
    target,
    startedAt: ago(2 * HOUR),
    ...(countedPlaceIds ? { countedPlaceIds } : {}),
  };
}

function walk(
  s: ReturnType<typeof session>,
  lines: Line[],
  finish: { expected?: number; contentsSeen?: boolean } = {},
): QueueItem[] {
  const lineOp = op(
    'scan_session_lines',
    home.id,
    { session: s, lines },
    { idempotencyKey: `scan-lines:${s.id}:0` },
  );
  return [
    lineOp,
    op(
      'scan_session_finish',
      home.id,
      { sessionId: s.id, ...finish },
      { idempotencyKey: `scan-finish:${s.id}`, dependsOn: [lineOp.idempotencyKey] },
    ),
  ];
}

const count = async (as: Person, s: ReturnType<typeof session>, lines: Line[], expected = 0) => {
  const results = await sent(t, as, walk(s, lines, { expected }));
  expect(results.map((r) => r.outcome)).toEqual(['applied', 'applied']);
};

const get = async (as: Person, url: string) => ok(await call(t, url, { as }));
const result = (as: Person, id: string) => get(as, `/api/v1/scan-sessions/${id}/result`);
const undo = (as: Person, eventId: string) =>
  call(t, `/api/v1/audit/${eventId}/undo`, { as, body: {} });

type ResultLine = {
  thing: { id: string; name: string | null; trashed: boolean };
  result: string;
  was: { id: string; name: string } | null;
  now: { id: string; name: string } | null;
  area: { id: string; name: string } | null;
  foundQty: string | null;
  expectedQty: string | null;
};
const linesOf = (r: Json) => r.lines as ResultLine[];
const resultOf = (r: Json, thingId: string) =>
  linesOf(r).find((l) => l.thing.id === thingId)?.result;

async function lendTo(thingId: string) {
  return ok(
    await call(t, `/api/v1/things/${thingId}/lend`, {
      as: ibrahim,
      body: { person: { id: murdock } },
    }),
    201,
  );
}

async function inRepair(thingId: string) {
  await own(
    db,
    `INSERT INTO public.claims (location_id, thing_id, opened_on, status, created_by)
     VALUES ($1, $2, current_date, 'in_repair', $3)`,
    [home.id, thingId, ibrahim.userId],
  );
}

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  t = await peopleApp(db);
  ibrahim = await person(t, db, 'ibrahim');
  louis = await person(t, db, 'louis');
  talia = await person(t, db, 'talia');
  await setDisplayName(db, ibrahim, 'Ibrahim');
  await setDisplayName(db, louis, 'Louis');
  home = await createLocation(t, db, ibrahim, 'complete');
  await join(db, home.id, louis.userId, 'member');
  await join(db, home.id, talia.userId, 'viewer');
  boxType = await builtinType(db, 'box_bin');
  const [m] = await own<{ id: string }>(
    db,
    `INSERT INTO public.people (owner_account_id, display_name) VALUES ($1, 'Murdock') RETURNING id`,
    [home.accountId],
  );
  murdock = m?.id as string;
});

afterAll(async () => {
  await t.app.close();
});

describe('a count keeps every result', () => {
  it('stores missing and elsewhere without applying them, with where each thing was', async () => {
    const study = await place(db, home, 'Study');
    const shelf = await place(db, home, 'Shelf', study);
    const hall = await place(db, home, 'Hall');
    const lamp = await createThing(t, ibrahim, home, { name: 'Lamp', placeId: study });
    const webcam = await createThing(t, ibrahim, home, { name: 'HD webcam', placeId: shelf });
    const tape = await createThing(t, ibrahim, home, { name: 'Tape', placeId: hall });
    const before = await own<{ location_uncertain: boolean }>(
      db,
      'SELECT location_uncertain FROM public.things WHERE id = $1',
      [webcam.id],
    );
    const s = session({ placeId: study, inside: true }, [study, shelf]);
    await count(
      louis,
      s,
      [
        { thingId: lamp.id, readAt: ago(HOUR), action: 'seen' },
        { thingId: webcam.id, readAt: ago(HOUR), action: 'missing' },
        { thingId: tape.id, readAt: ago(HOUR), action: 'elsewhere' },
      ],
      2,
    );
    // Missing is kept, not applied: "not here" is only what was chosen.
    expect(
      await own(db, 'SELECT location_uncertain FROM public.things WHERE id = $1', [webcam.id]),
    ).toEqual(before);
    const r = await result(louis, s.id);
    expect(r.session).toMatchObject({
      seen: 1,
      notHere: 0,
      missing: 1,
      elsewhere: 1,
      onLoan: 0,
      inRepair: 0,
      notCounted: 0,
      skipped: 0,
      recorded: true,
    });
    const webcamLine = linesOf(r).find((l) => l.thing.id === webcam.id);
    expect(webcamLine).toMatchObject({
      result: 'missing',
      was: { id: shelf, name: 'Shelf' },
      now: { id: shelf },
      area: { id: shelf, name: 'Shelf' },
    });
    expect(linesOf(r).find((l) => l.thing.id === tape.id)).toMatchObject({
      result: 'elsewhere',
      was: { id: hall },
      area: { id: hall },
    });
    // Talia, a viewer, reads the result too.
    expect(linesOf(await result(talia, s.id))).toHaveLength(3);
  });

  it('never calls a thing lent out, in repair or in the Trash missing', async () => {
    const den = await place(db, home, 'Den');
    const drill = await createThing(t, ibrahim, home, { name: 'Drill', placeId: den });
    const tv = await createThing(t, ibrahim, home, { name: 'TV', placeId: den });
    const vase = await createThing(t, ibrahim, home, { name: 'Vase', placeId: den });
    const kettle = await createThing(t, ibrahim, home, { name: 'Kettle', placeId: den });
    await lendTo(drill.id);
    await inRepair(tv.id);
    ok(await call(t, `/api/v1/things/${vase.id}/trash`, { as: ibrahim, body: {} }));
    const s = session({ placeId: den, inside: true }, [den]);
    // The phone didn't know: it sent all four as missing.
    await count(
      ibrahim,
      s,
      [drill, tv, vase, kettle].map((x) => ({
        thingId: x.id,
        readAt: ago(HOUR),
        action: 'missing',
      })),
      4,
    );
    const r = await result(ibrahim, s.id);
    expect(resultOf(r, drill.id)).toBe('on_loan');
    expect(resultOf(r, tv.id)).toBe('in_repair');
    expect(resultOf(r, vase.id)).toBe('trashed');
    expect(resultOf(r, kettle.id)).toBe('missing');
    expect(linesOf(r).find((l) => l.thing.id === vase.id)?.thing.trashed).toBe(true);
    expect(r.session).toMatchObject({ missing: 1, onLoan: 1, inRepair: 1 });
    // Nor "not here" when chosen for a lent thing.
    const again = session({ placeId: den, inside: true }, [den]);
    await count(ibrahim, again, [{ thingId: drill.id, readAt: ago(0), action: 'not_here' }], 3);
    expect(resultOf(await result(ibrahim, again.id), drill.id)).toBe('on_loan');
    const [d] = await own<{ location_uncertain: boolean }>(
      db,
      'SELECT location_uncertain FROM public.things WHERE id = $1',
      [drill.id],
    );
    expect(d?.location_uncertain).toBe(false);
  });

  it('calls what is in an area nobody counted not counted, never missing', async () => {
    const garage = await place(db, home, 'Workshop');
    const wall = await place(db, home, 'Tool wall', garage);
    const bench = await place(db, home, 'Bench', garage);
    const box = await createThing(t, ibrahim, home, {
      name: 'Screws box',
      typeId: boxType,
      placeId: bench,
    });
    const hammer = await createThing(t, ibrahim, home, { name: 'Hammer', placeId: wall });
    const saw = await createThing(t, ibrahim, home, { name: 'Saw', placeId: wall });
    const screws = await createThing(t, ibrahim, home, { name: 'Screws', containerId: box.id });
    // The tool wall was counted (a read); the bench wasn't.
    const s = session({ placeId: garage, inside: true }, [wall]);
    await count(
      ibrahim,
      s,
      [
        { thingId: hammer.id, readAt: ago(HOUR), action: 'seen' },
        { thingId: saw.id, readAt: ago(HOUR), action: 'missing' },
        { thingId: box.id, readAt: ago(HOUR), action: 'missing' },
        { thingId: screws.id, readAt: ago(HOUR), action: 'missing' },
      ],
      4,
    );
    const r = await result(ibrahim, s.id);
    expect(resultOf(r, saw.id)).toBe('missing');
    expect(resultOf(r, box.id)).toBe('not_counted');
    // Its area is the place its box is in.
    expect(linesOf(r).find((l) => l.thing.id === screws.id)).toMatchObject({
      result: 'not_counted',
      area: { id: bench },
    });
    expect(r.session).toMatchObject({ missing: 1, notCounted: 2 });
  });

  it('a count from before 1.14 says its results were not recorded', async () => {
    const attic = await place(db, home, 'Old attic');
    const s = session({ placeId: attic, inside: true });
    const clock = await createThing(t, ibrahim, home, { name: 'Clock', placeId: attic });
    await count(ibrahim, s, [{ thingId: clock.id, readAt: ago(HOUR), action: 'seen' }], 2);
    await own(
      db,
      `UPDATE public.scan_sessions SET missing = NULL, elsewhere = NULL, on_loan = NULL,
              in_repair = NULL, not_counted = NULL WHERE id = $1`,
      [s.id],
    );
    expect((await result(ibrahim, s.id)).session).toMatchObject({
      recorded: false,
      missing: null,
    });
  });
});

describe('quantities', () => {
  it('keeps "2 of 6 missing", and splits the rest off as not here when chosen, undone with it', async () => {
    const pantry = await place(db, home, 'Pantry');
    const cans = await createThing(t, ibrahim, home, {
      name: 'Tins',
      placeId: pantry,
      quantity: 6,
    });
    const jars = await createThing(t, ibrahim, home, {
      name: 'Jars',
      placeId: pantry,
      quantity: 5,
    });
    const s = session({ placeId: pantry, inside: true }, [pantry]);
    await count(
      ibrahim,
      s,
      [
        { thingId: cans.id, readAt: ago(HOUR), action: 'seen', quantity: '4' },
        { thingId: jars.id, readAt: ago(HOUR), action: 'seen', quantity: '3', short: 'not_here' },
      ],
      2,
    );
    const r = await result(ibrahim, s.id);
    expect(linesOf(r).find((l) => l.thing.id === cans.id)).toMatchObject({
      result: 'seen',
      foundQty: '4',
      expectedQty: '6',
    });
    const rows = await own<{ id: string; quantity: string; location_uncertain: boolean }>(
      db,
      `SELECT id, trim_scale(quantity)::text AS quantity, location_uncertain FROM public.things
        WHERE (id = $1 OR split_from_id = $1) AND deleted_at IS NULL ORDER BY created_at`,
      [jars.id],
    );
    expect(rows.map((x) => [x.quantity, x.location_uncertain])).toEqual([
      ['3', false],
      ['2', true],
    ]);
    // Without the choice, nothing is split.
    const [c] = await own<{ quantity: string }>(
      db,
      'SELECT trim_scale(quantity)::text AS quantity FROM public.things WHERE id = $1',
      [cans.id],
    );
    expect(c?.quantity).toBe('6');

    const view = await get(ibrahim, `/api/v1/scan-sessions/${s.id}`);
    const res = await undo(ibrahim, (view.undo as { eventId: string }).eventId);
    expect(res.statusCode, res.body).toBe(200);
    const back = await own<{ quantity: string }>(
      db,
      `SELECT trim_scale(quantity)::text AS quantity FROM public.things
        WHERE (id = $1 OR split_from_id = $1) AND deleted_at IS NULL`,
      [jars.id],
    );
    expect(back.map((x) => x.quantity)).toEqual(['5']);
  });
});

describe('the Counts list', () => {
  it('lists counts and box checks of a location, newest first, filtered and paged', async () => {
    const loc = await createLocation(t, db, ibrahim, 'complete', 'Cottage');
    const kitchen = await place(db, loc, 'Kitchen');
    const box = await createThing(t, ibrahim, loc, {
      name: 'Box 3',
      typeId: boxType,
      placeId: kitchen,
    });
    const cup = await createThing(t, ibrahim, loc, { name: 'Cup', containerId: box.id });
    const pan = await createThing(t, ibrahim, loc, { name: 'Pan', placeId: kitchen });
    const lines = (s: ReturnType<typeof session>, l: Line[], expected: number) => {
      const lineOp = op(
        'scan_session_lines',
        loc.id,
        { session: s, lines: l },
        { idempotencyKey: `scan-lines:${s.id}:0` },
      );
      return [
        lineOp,
        op(
          'scan_session_finish',
          loc.id,
          { sessionId: s.id, expected },
          { idempotencyKey: `scan-finish:${s.id}`, dependsOn: [lineOp.idempotencyKey] },
        ),
      ];
    };
    const first = session({ placeId: kitchen, inside: true }, [kitchen]);
    await sent(
      t,
      ibrahim,
      lines(
        first,
        [
          { thingId: pan.id, readAt: ago(3 * HOUR), action: 'seen' },
          { thingId: cup.id, readAt: ago(3 * HOUR), action: 'missing' },
        ],
        2,
      ),
    );
    ok(
      await call(t, `/api/v1/things/${box.id}/box-check`, {
        as: ibrahim,
        body: { id: newId(), lines: [{ thingId: cup.id, expectedQty: '1', foundQty: '1' }] },
      }),
    );
    const second = session({ placeId: kitchen, inside: true }, [kitchen]);
    await sent(
      t,
      ibrahim,
      lines(second, [{ thingId: pan.id, readAt: ago(HOUR), action: 'seen' }], 1),
    );

    const all = await get(ibrahim, `/api/v1/locations/${loc.id}/counts`);
    const items = all.items as Json[];
    expect(items.map((i) => i.kind)).toEqual(['count', 'box_check', 'count']);
    expect(items[0]).toMatchObject({
      id: second.id,
      kind: 'count',
      by: { displayName: 'Ibrahim' },
      target: { type: 'place', id: kitchen, name: 'Kitchen' },
      found: 1,
      expected: 1,
      missing: 0,
    });
    expect(items[1]).toMatchObject({
      kind: 'box_check',
      target: { type: 'thing', id: box.id, name: 'Box 3' },
      found: 1,
      expected: 1,
    });
    const missing = await get(ibrahim, `/api/v1/locations/${loc.id}/counts?had=missing`);
    expect((missing.items as Json[]).map((i) => i.id)).toEqual([first.id]);
    const checks = await get(ibrahim, `/api/v1/locations/${loc.id}/counts?kind=box_check`);
    expect((checks.items as Json[]).map((i) => i.kind)).toEqual(['box_check']);
    const q = await get(ibrahim, `/api/v1/locations/${loc.id}/counts?q=box`);
    expect((q.items as Json[]).map((i) => i.kind)).toEqual(['box_check']);
    const page = await get(ibrahim, `/api/v1/locations/${loc.id}/counts?limit=2`);
    expect((page.items as Json[]).length).toBe(2);
    const rest = await get(
      ibrahim,
      `/api/v1/locations/${loc.id}/counts?limit=2&cursor=${encodeURIComponent(String(page.next_cursor))}`,
    );
    expect((rest.items as Json[]).map((i) => i.id)).toEqual([first.id]);
    expect(rest.next_cursor).toBeNull();

    // The second count against the first: the cup isn't on its list any more, the pan was found
    // both times.
    const r = await result(ibrahim, second.id);
    expect(r.previous).toMatchObject({ id: first.id });
    expect(r.compare).toEqual({ newlyMissing: [], foundAgain: [], newThings: [] });

    // A box check's lines.
    const check = (items[1] as Json).id as string;
    const detail = await get(ibrahim, `/api/v1/box-checks/${check}`);
    expect(detail).toMatchObject({
      id: check,
      by: { displayName: 'Ibrahim' },
      container: { id: box.id, name: 'Box 3' },
      lines: [{ thing: { id: cup.id, name: 'Cup' }, expectedQty: '1', foundQty: '1' }],
    });
  });

  it('compares a count with the previous one of the same place', async () => {
    const shed = await place(db, home, 'Shed');
    const rake = await createThing(t, ibrahim, home, { name: 'Rake', placeId: shed });
    const hose = await createThing(t, ibrahim, home, { name: 'Hose', placeId: shed });
    const first = session({ placeId: shed, inside: true }, [shed]);
    await count(
      ibrahim,
      first,
      [
        { thingId: rake.id, readAt: ago(3 * HOUR), action: 'seen' },
        { thingId: hose.id, readAt: ago(3 * HOUR), action: 'missing' },
      ],
      2,
    );
    const spade = await createThing(t, ibrahim, home, { name: 'Spade', placeId: shed });
    const second = session({ placeId: shed, inside: true }, [shed]);
    await count(
      ibrahim,
      second,
      [
        { thingId: rake.id, readAt: ago(HOUR), action: 'missing' },
        { thingId: hose.id, readAt: ago(HOUR), action: 'seen' },
        { thingId: spade.id, readAt: ago(HOUR), action: 'seen' },
      ],
      3,
    );
    const r = await result(ibrahim, second.id);
    expect(r.previous).toMatchObject({ id: first.id });
    expect(r.compare).toEqual({
      newlyMissing: [rake.id],
      foundAgain: [hose.id],
      newThings: [spade.id],
    });
    // The first has nothing before it.
    const r1 = await result(ibrahim, first.id);
    expect(r1.previous).toBeNull();
    expect(r1.compare).toBeNull();
  });

  it('is a 404 for a location or a count the caller can’t see', async () => {
    const other = await person(t, db, 'peter');
    expect((await call(t, `/api/v1/locations/${home.id}/counts`, { as: other })).statusCode).toBe(
      404,
    );
    expect(
      (await call(t, `/api/v1/scan-sessions/${newId()}/result`, { as: ibrahim })).statusCode,
    ).toBe(404);
  });
});

describe('planned counts', () => {
  const scheduleOf = async (placeId: string, id: unknown) =>
    ((await get(ibrahim, `/api/v1/places/${placeId}/schedules`)).items as Json[]).find(
      (x) => x.id === id,
    ) as Json;
  const createCount = (as: Person, placeId: string, everyMonths: number) =>
    call(t, '/api/v1/schedules', {
      as,
      body: { subject: { placeId }, name: 'Count the place', kind: 'count', everyMonths },
    });

  it('is a schedule on a place, every 1–24 months, one at a time', async () => {
    const loft = await place(db, home, 'Loft');
    const thing = await createThing(t, ibrahim, home, { name: 'Ladder' });
    const made = ok(await createCount(ibrahim, loft, 6), 201);
    expect(made).toMatchObject({ kind: 'count', everyMonths: 6 });
    expect((await createCount(ibrahim, loft, 3)).statusCode).toBe(409);
    const loft2 = await place(db, home, 'Loft 2');
    expect((await createCount(ibrahim, loft2, 25)).statusCode).toBe(400);
    expect(
      (
        await call(t, '/api/v1/schedules', {
          as: ibrahim,
          body: { subject: { thingId: thing.id }, name: 'Count it', kind: 'count', everyMonths: 3 },
        })
      ).statusCode,
    ).toBe(400);
    // A viewer can't plan one.
    expect((await createCount(talia, loft2, 6)).statusCode).toBe(403);
  });

  it('is done by counting its place, and undone with the count', async () => {
    const cellar = await place(db, home, 'Cellar');
    const wine = await createThing(t, ibrahim, home, { name: 'Wine rack', placeId: cellar });
    const made = ok(await createCount(ibrahim, cellar, 12), 201);
    // Last done a year and a week ago: overdue.
    await own(
      db,
      `UPDATE public.schedules SET base_on = current_date - 372, anchor_on = current_date - 372
        WHERE id = $1`,
      [made.id],
    );
    const before = await scheduleOf(cellar, made.id);
    expect((before.next as { state: string }).state).toBe('overdue');

    const s = session({ placeId: cellar, inside: true }, [cellar]);
    await count(louis, s, [{ thingId: wine.id, readAt: ago(HOUR), action: 'seen' }], 1);
    const after = await scheduleOf(cellar, made.id);
    expect((after.next as { state: string }).state).toBe('upcoming');
    expect(after.lastCount).toMatchObject({ id: s.id });
    expect((await result(ibrahim, s.id)).session).toMatchObject({
      schedule: { id: made.id, name: 'Count the place' },
    });

    const view = await get(louis, `/api/v1/scan-sessions/${s.id}`);
    ok(await undo(louis, (view.undo as { eventId: string }).eventId));
    const undone = await scheduleOf(cellar, made.id);
    expect((undone.next as { state: string }).state).toBe('overdue');
  });

  it('closes its reminder as done once its place is counted', async () => {
    const quiet: ChannelSender = { send: async () => ({ status: 'sent' }) };
    const scan = () =>
      runScan({
        pools: db.pools,
        channels: { email: quiet, webpush: quiet, webhook: quiet },
        send: async () => {},
      });
    const garret = await place(db, home, 'Garret');
    const trunk = await createThing(t, ibrahim, home, { name: 'Trunk', placeId: garret });
    const made = ok(await createCount(ibrahim, garret, 6), 201);
    await own(
      db,
      `UPDATE public.schedules SET base_on = current_date - 200, anchor_on = current_date - 200
        WHERE id = $1`,
      [made.id],
    );
    await scan();
    const state = async () =>
      (
        await own<{ state: string }>(
          db,
          `SELECT state FROM public.reminder_occurrences
            WHERE source_type = 'schedule' AND source_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [made.id],
        )
      )[0]?.state;
    expect(await state()).toBe('open');
    const s = session({ placeId: garret, inside: true }, [garret]);
    await count(ibrahim, s, [{ thingId: trunk.id, readAt: ago(0), action: 'seen' }], 1);
    await scan();
    expect(await state()).toBe('done');
  });

  it('a count of a box, or of another place, completes nothing', async () => {
    const porch = await place(db, home, 'Porch');
    const made = ok(await createCount(ibrahim, porch, 12), 201);
    const anchor = (await scheduleOf(porch, made.id)).anchorOn;
    const box = await createThing(t, ibrahim, home, {
      name: 'Porch box',
      typeId: boxType,
      placeId: porch,
    });
    const shoe = await createThing(t, ibrahim, home, { name: 'Boots', containerId: box.id });
    await count(
      ibrahim,
      session({ containerId: box.id }),
      [{ thingId: shoe.id, readAt: ago(HOUR), action: 'seen' }],
      1,
    );
    expect((await scheduleOf(porch, made.id)).anchorOn).toBe(anchor);
  });
});

describe('a shared count', () => {
  const start = (as: Person, target: Target, countedPlaceIds?: string[]) => {
    const s = session(target, countedPlaceIds);
    return {
      s,
      res: call(t, '/api/v1/scan-sessions', {
        as,
        body: { id: s.id, target, ...(countedPlaceIds ? { countedPlaceIds } : {}) },
      }),
    };
  };
  const linesOp = (as: Person, s: ReturnType<typeof session>, lines: Line[], n: number) =>
    sent(t, as, [
      op(
        'scan_session_lines',
        home.id,
        { session: s, lines },
        { idempotencyKey: `scan-lines:${s.id}:${as.userId}:${n}` },
      ),
    ]);
  const finish = (as: Person, s: ReturnType<typeof session>, expected: number) =>
    sent(t, as, [
      op(
        'scan_session_finish',
        home.id,
        { sessionId: s.id, expected },
        { idempotencyKey: `scan-finish:${s.id}:${as.userId}` },
      ),
    ]);

  it('is joined by others, merges what everyone read, and anyone finishes it', async () => {
    const house = await place(db, home, 'Annex');
    const kitchen = await place(db, home, 'Annex kitchen', house);
    const lounge = await place(db, home, 'Annex lounge', house);
    const bath = await place(db, home, 'Annex bath', house);
    const pot = await createThing(t, ibrahim, home, { name: 'Pot', placeId: kitchen });
    const pan = await createThing(t, ibrahim, home, { name: 'Pan', placeId: kitchen });
    const sofa = await createThing(t, ibrahim, home, { name: 'Sofa', placeId: lounge });
    const towel = await createThing(t, ibrahim, home, { name: 'Towel', placeId: bath });

    // A viewer can't open one.
    expect((await start(talia, { placeId: house, inside: true }).res).statusCode).toBe(403);
    const { s, res } = start(ibrahim, { placeId: house, inside: true });
    expect((await res).statusCode).toBe(201);
    // A retry answers the same session.
    expect(
      ok(
        await call(t, '/api/v1/scan-sessions', {
          as: ibrahim,
          body: { id: s.id, target: { placeId: house, inside: true } },
        }),
        201,
      ),
    ).toEqual({ id: s.id });

    // Louis opens the same place: "Count in progress by Ibrahim: Join".
    const open = await get(louis, `/api/v1/scan-sessions/open?placeId=${house}`);
    expect(open.session).toMatchObject({ id: s.id, by: { displayName: 'Ibrahim' }, lines: 0 });
    // Nothing open for another place.
    expect((await get(louis, `/api/v1/scan-sessions/open?placeId=${kitchen}`)).session).toBeNull();

    // Ibrahim counts the lounge; his phone lists the pan as missing (it didn't see the kitchen
    // counted). Louis joins and counts the kitchen, finding the pan.
    await linesOp(
      ibrahim,
      { ...s, countedPlaceIds: [lounge] },
      [
        { thingId: sofa.id, readAt: ago(5 * HOUR), action: 'seen' },
        { thingId: pan.id, readAt: ago(5 * HOUR), action: 'missing' },
        { thingId: towel.id, readAt: ago(5 * HOUR), action: 'not_counted' },
      ],
      0,
    );
    await linesOp(
      louis,
      { ...s, countedPlaceIds: [kitchen] },
      [
        { thingId: pot.id, readAt: ago(HOUR), action: 'seen' },
        { thingId: pan.id, readAt: ago(HOUR), action: 'seen' },
        // Already read by Ibrahim: the first read stays.
        { thingId: sofa.id, readAt: ago(HOUR), action: 'missing' },
      ],
      0,
    );
    const merged = await get(ibrahim, `/api/v1/scan-sessions/${s.id}/lines`);
    expect(merged.finishedAt).toBeNull();
    expect([...(merged.countedPlaceIds as string[])].sort()).toEqual([kitchen, lounge].sort());
    const byThing = new Map(
      (merged.lines as { thingId: string; action: string; readBy: { displayName: string } }[]).map(
        (l) => [l.thingId, l],
      ),
    );
    expect(byThing.get(pan.id)).toMatchObject({ action: 'seen', readBy: { displayName: 'Louis' } });
    expect(byThing.get(sofa.id)).toMatchObject({
      action: 'seen',
      readBy: { displayName: 'Ibrahim' },
    });
    expect((await get(talia, `/api/v1/scan-sessions/open?placeId=${house}`)).session).toMatchObject(
      { lines: 4 },
    );

    // A viewer can't add to it.
    const tal = await linesOp(talia, s, [{ thingId: towel.id, readAt: ago(0), action: 'seen' }], 0);
    expect(tal[0]?.outcome).not.toBe('applied');

    // Louis finishes it: the bath, counted by nobody, is not counted.
    expect((await finish(louis, s, 4)).map((r) => r.outcome)).toEqual(['applied']);
    const r = await result(talia, s.id);
    expect(r.session).toMatchObject({
      by: { displayName: 'Ibrahim' },
      finishedBy: { displayName: 'Louis' },
      seen: 3,
      missing: 0,
      notCounted: 1,
    });
    expect(resultOf(r, towel.id)).toBe('not_counted');
    expect(
      (r.session as { readers: { displayName: string }[] }).readers
        .map((x) => x.displayName)
        .sort(),
    ).toEqual(['Ibrahim', 'Louis']);
    // Finished: no longer open, and nothing more is added.
    expect((await get(louis, `/api/v1/scan-sessions/open?placeId=${house}`)).session).toBeNull();
    const late = await linesOp(
      louis,
      s,
      [{ thingId: towel.id, readAt: ago(0), action: 'seen' }],
      1,
    );
    expect(late[0]?.outcome).not.toBe('applied');
    expect((await finish(ibrahim, s, 4))[0]?.outcome).not.toBe('applied');
  });

  it('"I checked it": an area counted with nothing read turns what is there into missing', async () => {
    const flat = await place(db, home, 'Flat');
    const hall = await place(db, home, 'Flat hall', flat);
    const store = await place(db, home, 'Flat store', flat);
    const coat = await createThing(t, ibrahim, home, { name: 'Coat', placeId: hall });
    const mop = await createThing(t, ibrahim, home, { name: 'Mop', placeId: store });
    const s = session({ placeId: flat, inside: true }, [hall, store]);
    await count(
      ibrahim,
      s,
      [
        { thingId: coat.id, readAt: ago(HOUR), action: 'seen' },
        { thingId: mop.id, readAt: ago(HOUR), action: 'not_counted' },
      ],
      2,
    );
    const r = await result(ibrahim, s.id);
    expect(resultOf(r, mop.id)).toBe('missing');
    expect(r.session).toMatchObject({ missing: 1, notCounted: 0 });
  });

  it('a pack stays its own person’s', async () => {
    const box = await createThing(t, ibrahim, home, { name: 'Pack box', typeId: boxType });
    const mug = await createThing(t, ibrahim, home, { name: 'Mug' });
    const cup = await createThing(t, ibrahim, home, { name: 'Cup' });
    const pack = {
      id: newId(),
      mode: 'pack' as const,
      target: { containerId: box.id },
      startedAt: ago(HOUR),
    };
    const first = await sent(t, ibrahim, [
      op(
        'scan_session_lines',
        home.id,
        {
          session: pack,
          lines: [
            { thingId: mug.id, readAt: ago(HOUR), action: 'move', to: { containerId: box.id } },
          ],
        },
        { idempotencyKey: `scan-lines:${pack.id}:0` },
      ),
    ]);
    expect(first[0]?.outcome).toBe('applied');
    const other = await sent(t, louis, [
      op(
        'scan_session_lines',
        home.id,
        {
          session: pack,
          lines: [
            { thingId: cup.id, readAt: ago(HOUR), action: 'move', to: { containerId: box.id } },
          ],
        },
        { idempotencyKey: `scan-lines:${pack.id}:louis` },
      ),
    ]);
    expect(other[0]?.outcome).not.toBe('applied');
  });
});
