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
  type Loc,
  ok,
  own,
  place,
  setDisplayName,
} from '../../test/things.js';

// Scan sessions through the front door: the phone saves a walk as `scan_session_lines` ops, then
// one `scan_session_finish`, and reads it back with GET /api/v1/scan-sessions/:id. The undo is
// the ordinary POST /api/v1/audit/:eventId/undo.

let db: TestDb;
let t: TestApp;
let ibrahim: Person; // owner of Home and Cottage
let louis: Person; // member of Home
let talia: Person; // viewer of Home
let home: Loc;
let cottage: Loc;
let boxType: string;

type Line = {
  thingId: string;
  readAt: string;
  action: 'seen' | 'not_here' | 'move';
  to?: { placeId: string } | { containerId: string };
};
type Target =
  | { placeId: string; inside?: boolean }
  | { containerId: string }
  | { locationId: string };

const HOUR = 3_600_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

function session(mode: 'count' | 'pack' | 'move', target: Target) {
  return { id: newId(), mode, target, startedAt: ago(2 * HOUR) };
}

/** The ops a phone queues for a session: its lines in chunks, then the finish. */
function walk(
  loc: Loc,
  s: ReturnType<typeof session>,
  lines: Line[],
  finish: { expected?: number; contentsSeen?: boolean } = {},
  chunk = 500,
): QueueItem[] {
  const ops: QueueItem[] = [];
  for (let i = 0; i < lines.length; i += chunk) {
    ops.push(
      op(
        'scan_session_lines',
        loc.id,
        { session: s, lines: lines.slice(i, i + chunk) },
        { idempotencyKey: `scan-lines:${s.id}:${i / chunk}` },
      ),
    );
  }
  ops.push(
    op(
      'scan_session_finish',
      loc.id,
      { sessionId: s.id, ...finish },
      {
        idempotencyKey: `scan-finish:${s.id}`,
        dependsOn: ops.map((o) => o.idempotencyKey),
      },
    ),
  );
  return ops;
}

const thingOf = async (id: string) =>
  (
    await own<{
      location_id: string;
      place_id: string | null;
      container_id: string | null;
      last_seen_at: Date;
      location_uncertain: boolean;
    }>(
      db,
      `SELECT location_id, place_id, container_id, last_seen_at, location_uncertain
         FROM public.things WHERE id = $1`,
      [id],
    )
  )[0];

/** Seen two days ago: a walk's read is newer. */
const lastSeenLongAgo = (...ids: string[]) =>
  own(
    db,
    `UPDATE public.things SET last_seen_at = now() - interval '2 days' WHERE id = ANY ($1::uuid[])`,
    [ids],
  );

const sessionView = async (as: Person, id: string) =>
  ok(await call(t, `/api/v1/scan-sessions/${id}`, { as })) as unknown as Record<string, unknown> & {
    undo: { eventId: string; until: string };
  };

const undo = (as: Person, eventId: string) =>
  call(t, `/api/v1/audit/${eventId}/undo`, { as, body: {} });

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  t = await peopleApp(db);
  ibrahim = await person(t, db, 'ibrahim');
  louis = await person(t, db, 'louis');
  talia = await person(t, db, 'talia');
  await setDisplayName(db, ibrahim, 'Ibrahim');
  home = await createLocation(t, db, ibrahim, 'household');
  cottage = await createLocation(t, db, ibrahim, 'household', 'Cottage');
  await join(db, home.id, louis.userId, 'member');
  await join(db, home.id, talia.userId, 'viewer');
  boxType = await builtinType(db, 'box_bin');
});

afterAll(async () => {
  await t.app.close();
});

describe('a count', () => {
  it('marks what was read seen at the time it was read, and only what was chosen not here', async () => {
    const study = await place(db, home, 'Study');
    const lamp = await createThing(t, ibrahim, home, { name: 'Lamp', placeId: study });
    const webcam = await createThing(t, ibrahim, home, { name: 'HD webcam', placeId: study });
    const mouse = await createThing(t, ibrahim, home, { name: 'Mouse', placeId: study });
    const kept = await createThing(t, ibrahim, home, { name: 'Notebook', placeId: study });
    await lastSeenLongAgo(lamp.id, webcam.id, mouse.id, kept.id);
    const before = await thingOf(kept.id);
    const readAt = ago(HOUR);
    const s = session('count', { placeId: study, inside: true });
    const results = await sent(
      t,
      louis,
      walk(
        home,
        s,
        [
          { thingId: lamp.id, readAt, action: 'seen' },
          { thingId: webcam.id, readAt, action: 'seen' },
          { thingId: mouse.id, readAt, action: 'not_here' },
        ],
        { expected: 4 },
      ),
    );
    expect(results.map((r) => r.outcome)).toEqual(['applied', 'applied']);
    expect(results[1]?.entity).toEqual({ type: 'scan_session', id: s.id });

    expect((await thingOf(lamp.id))?.last_seen_at.toISOString()).toBe(readAt);
    expect((await thingOf(webcam.id))?.location_uncertain).toBe(false);
    expect((await thingOf(mouse.id))?.location_uncertain).toBe(true);
    // Left alone: not read, not chosen.
    expect(await thingOf(kept.id)).toEqual(before);

    const view = await sessionView(louis, s.id);
    expect(view).toMatchObject({
      id: s.id,
      mode: 'count',
      locationId: home.id,
      expected: 4,
      seen: 2,
      notHere: 1,
      moved: 0,
      skipped: 0,
    });
    expect(view.finishedAt).toEqual(expect.any(String));
    expect(view.undo).toEqual({ eventId: expect.any(String), until: expect.any(String) });

    // One Activity entry for the whole walk.
    const events = await own<{ action: string; entity_type: string; entity_id: string }>(
      db,
      `SELECT action, entity_type, entity_id FROM public.audit_events
        WHERE location_id = $1 AND action = 'scan.session'`,
      [home.id],
    );
    expect(events).toEqual([{ action: 'scan.session', entity_type: 'place', entity_id: study }]);
    // Talia, a viewer, reads the saved session too.
    expect((await sessionView(talia, s.id)).seen).toBe(2);
  });

  it('never moves a seen date backwards', async () => {
    const lamp = await createThing(t, ibrahim, home, { name: 'Desk lamp' });
    const now = await thingOf(lamp.id);
    const s = session('count', { locationId: home.id });
    await sent(
      t,
      ibrahim,
      walk(home, s, [{ thingId: lamp.id, readAt: ago(5 * HOUR), action: 'seen' }], {
        expected: 1,
      }),
    );
    expect((await thingOf(lamp.id))?.last_seen_at).toEqual(now?.last_seen_at);
  });

  it('moves a thing found elsewhere here, and with the option, marks a box’s contents seen', async () => {
    const hall = await place(db, home, 'Hall');
    const shelf = await place(db, home, 'Shelf B');
    const box = await createThing(t, ibrahim, home, {
      name: 'Box 14',
      typeId: boxType,
      placeId: hall,
    });
    const cable = await createThing(t, ibrahim, home, { name: 'HDMI cable', containerId: box.id });
    const strayed = await createThing(t, ibrahim, home, { name: 'Tape', placeId: shelf });
    const elsewhere = await createThing(t, ibrahim, cottage, { name: 'Torch' });
    await lastSeenLongAgo(box.id, cable.id);
    const readAt = ago(HOUR);
    const s = session('count', { placeId: hall, inside: true });
    const results = await sent(
      t,
      ibrahim,
      walk(
        home,
        s,
        [
          { thingId: box.id, readAt, action: 'seen' },
          { thingId: strayed.id, readAt, action: 'move', to: { placeId: hall } },
          { thingId: elsewhere.id, readAt, action: 'move', to: { placeId: hall } },
        ],
        { expected: 1, contentsSeen: true },
      ),
    );
    expect(results.at(-1)?.outcome).toBe('applied');
    expect((await thingOf(strayed.id))?.place_id).toBe(hall);
    expect(await thingOf(elsewhere.id)).toMatchObject({ location_id: home.id, place_id: hall });
    expect((await thingOf(cable.id))?.last_seen_at.toISOString()).toBe(readAt);
    // The box and, with the option, the cable inside it.
    expect(await sessionView(ibrahim, s.id)).toMatchObject({ seen: 2, moved: 2, skipped: 0 });
  });

  it('is undone as a whole, and refused once something it changed has changed since', async () => {
    const den = await place(db, home, 'Den');
    const attic = await place(db, home, 'Attic');
    const radio = await createThing(t, ibrahim, home, { name: 'Radio', placeId: den });
    const clock = await createThing(t, ibrahim, home, { name: 'Clock', placeId: attic });
    const fan = await createThing(t, ibrahim, home, { name: 'Fan', placeId: den });
    const was = {
      radio: await thingOf(radio.id),
      clock: await thingOf(clock.id),
      fan: await thingOf(fan.id),
    };
    const s = session('count', { placeId: den, inside: true });
    const readAt = new Date(Date.now() + 1000).toISOString();
    await sent(
      t,
      ibrahim,
      walk(
        home,
        s,
        [
          { thingId: radio.id, readAt: ago(0), action: 'seen' },
          { thingId: clock.id, readAt, action: 'move', to: { placeId: den } },
          { thingId: fan.id, readAt: ago(0), action: 'not_here' },
        ],
        { expected: 2 },
      ),
    );
    const { undo: u } = await sessionView(ibrahim, s.id);
    const res = await undo(ibrahim, u.eventId);
    expect(res.statusCode, res.body).toBe(200);
    expect(await thingOf(radio.id)).toEqual(was.radio);
    expect((await thingOf(clock.id))?.place_id).toBe(attic);
    expect(await thingOf(fan.id)).toEqual(was.fan);

    const again = session('count', { placeId: den, inside: true });
    await sent(
      t,
      ibrahim,
      walk(home, again, [{ thingId: fan.id, readAt: ago(0), action: 'not_here' }], {
        expected: 1,
      }),
    );
    // Seen by someone since: the undo would hide that.
    ok(await call(t, `/api/v1/things/${fan.id}/seen`, { as: louis, body: {} }));
    const refused = await undo(ibrahim, (await sessionView(ibrahim, again.id)).undo.eventId);
    expect(refused.statusCode).toBe(409);
  });

  it('skips a line whose thing was trashed meanwhile, and saves the rest', async () => {
    const vase = await createThing(t, ibrahim, home, { name: 'Vase' });
    const bowl = await createThing(t, ibrahim, home, { name: 'Bowl' });
    expect(
      (await call(t, `/api/v1/things/${bowl.id}/trash`, { as: ibrahim, body: {} })).statusCode,
    ).toBeLessThan(300);
    const s = session('count', { locationId: home.id });
    const results = await sent(
      t,
      ibrahim,
      walk(
        home,
        s,
        [
          { thingId: vase.id, readAt: ago(0), action: 'seen' },
          { thingId: bowl.id, readAt: ago(0), action: 'seen' },
        ],
        { expected: 2 },
      ),
    );
    expect(results.map((r) => r.outcome)).toEqual(['applied', 'applied']);
    expect(await sessionView(ibrahim, s.id)).toMatchObject({ seen: 1, skipped: 1 });
  });

  it('saves 1,200 lines in three chunks as one session', async () => {
    const pantry = await place(db, home, 'Pantry');
    const ids = (
      await own<{ id: string }>(
        db,
        `INSERT INTO public.things (location_id, place_id, name, created_by, last_seen_at)
         SELECT $1, $2, 'Jar ' || g, $3, now() - interval '2 days'
           FROM generate_series(1, 1200) g RETURNING id`,
        [home.id, pantry, ibrahim.userId],
      )
    ).map((r) => r.id);
    const s = session('count', { placeId: pantry, inside: true });
    const readAt = ago(HOUR);
    const ops = walk(
      home,
      s,
      ids.map((thingId) => ({ thingId, readAt, action: 'seen' as const })),
      { expected: 1200 },
    );
    expect(ops.map((o) => o.op)).toEqual([
      'scan_session_lines',
      'scan_session_lines',
      'scan_session_lines',
      'scan_session_finish',
    ]);
    expect((await sent(t, ibrahim, ops)).map((r) => r.outcome)).toEqual([
      'applied',
      'applied',
      'applied',
      'applied',
    ]);
    expect(await sessionView(ibrahim, s.id)).toMatchObject({ seen: 1200, expected: 1200 });
    const late = await own<{ n: number }>(
      db,
      `SELECT count(*)::int AS n FROM public.things WHERE id = ANY ($1::uuid[])
          AND last_seen_at = $2::timestamptz`,
      [ids, readAt],
    );
    expect(late[0]?.n).toBe(1200);
  });
});

describe('pack and move', () => {
  it('packs into two boxes, switching target mid-walk, and undoes as one', async () => {
    const hall = await place(db, home, 'Packing hall');
    const box1 = await createThing(t, ibrahim, home, {
      name: 'Box 1',
      typeId: boxType,
      placeId: hall,
    });
    const box2 = await createThing(t, ibrahim, home, {
      name: 'Box 2',
      typeId: boxType,
      placeId: hall,
    });
    const a = await createThing(t, ibrahim, home, { name: 'Plates', placeId: hall });
    const b = await createThing(t, ibrahim, home, { name: 'Cups', placeId: hall });
    const c = await createThing(t, ibrahim, home, { name: 'Books', placeId: hall });
    const s = session('pack', { containerId: box1.id });
    const readAt = ago(0);
    const results = await sent(
      t,
      louis,
      walk(home, s, [
        { thingId: a.id, readAt, action: 'move', to: { containerId: box1.id } },
        { thingId: b.id, readAt, action: 'move', to: { containerId: box1.id } },
        { thingId: c.id, readAt, action: 'move', to: { containerId: box2.id } },
      ]),
    );
    expect(results.map((r) => r.outcome)).toEqual(['applied', 'applied']);
    expect((await thingOf(a.id))?.container_id).toBe(box1.id);
    expect((await thingOf(b.id))?.container_id).toBe(box1.id);
    expect((await thingOf(c.id))?.container_id).toBe(box2.id);
    const view = await sessionView(louis, s.id);
    expect(view).toMatchObject({ mode: 'pack', moved: 3, skipped: 0 });
    // The moves carry no undo of their own: the session's is the one.
    const moves = await own<{ undoable_until: Date | null }>(
      db,
      `SELECT undoable_until FROM public.audit_events
        WHERE action = 'thing.move' AND entity_id = ANY ($1::uuid[])`,
      [[a.id, b.id, c.id]],
    );
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((m) => m.undoable_until === null)).toBe(true);

    const res = await undo(louis, view.undo.eventId);
    expect(res.statusCode, res.body).toBe(200);
    for (const x of [a, b, c]) expect((await thingOf(x.id))?.place_id).toBe(hall);
  });

  it('moves things to a place, skipping a line that would put a box inside itself', async () => {
    const garage = await place(db, home, 'Garage shelf');
    const crate = await createThing(t, ibrahim, home, { name: 'Crate', typeId: boxType });
    const tool = await createThing(t, ibrahim, home, { name: 'Hammer' });
    const s = session('move', { containerId: crate.id });
    const results = await sent(
      t,
      ibrahim,
      walk(home, s, [
        { thingId: tool.id, readAt: ago(0), action: 'move', to: { placeId: garage } },
        { thingId: crate.id, readAt: ago(0), action: 'move', to: { containerId: crate.id } },
      ]),
    );
    expect(results.at(-1)?.outcome).toBe('applied');
    expect((await thingOf(tool.id))?.place_id).toBe(garage);
    expect(await sessionView(ibrahim, s.id)).toMatchObject({ moved: 1, skipped: 1 });
  });
});

describe('refusals', () => {
  it("drops a viewer's session: viewers only check", async () => {
    const thing = await createThing(t, ibrahim, home, { name: 'Kettle' });
    const s = session('count', { locationId: home.id });
    const results = await sent(
      t,
      talia,
      walk(home, s, [{ thingId: thing.id, readAt: ago(0), action: 'seen' }], { expected: 1 }),
    );
    expect(results.map((r) => [r.outcome, r.reason])).toEqual([
      ['dropped', 'not_permitted'],
      ['dropped', 'parent_dropped'],
    ]);
  });

  it('refuses lines for a session already saved, and a finish with nothing read', async () => {
    const thing = await createThing(t, ibrahim, home, { name: 'Toaster' });
    const s = session('count', { locationId: home.id });
    await sent(
      t,
      ibrahim,
      walk(home, s, [{ thingId: thing.id, readAt: ago(0), action: 'seen' }], { expected: 1 }),
    );
    const late = await sent(t, ibrahim, [
      op('scan_session_lines', home.id, {
        session: s,
        lines: [{ thingId: thing.id, readAt: ago(0), action: 'not_here' }],
      }),
    ]);
    expect(late[0]).toMatchObject({ outcome: 'dropped', reason: 'invalid' });

    const empty = await sent(t, ibrahim, [
      op('scan_session_finish', home.id, { sessionId: newId() }),
    ]);
    expect(empty[0]).toMatchObject({ outcome: 'dropped', reason: 'target_missing' });
  });

  it('a count is shared: another member who counts there may finish it', async () => {
    const thing = await createThing(t, ibrahim, home, { name: 'Iron' });
    const s = session('count', { locationId: home.id });
    await sent(t, ibrahim, [
      op('scan_session_lines', home.id, {
        session: s,
        lines: [{ thingId: thing.id, readAt: ago(0), action: 'seen' }],
      }),
    ]);
    const theirs = await sent(t, louis, [op('scan_session_finish', home.id, { sessionId: s.id })]);
    expect(theirs[0]?.outcome).toBe('applied');
  });

  it('answers a replay with the stored result and applies nothing twice', async () => {
    const thing = await createThing(t, ibrahim, home, { name: 'Blender' });
    const s = session('count', { locationId: home.id });
    const ops = walk(home, s, [{ thingId: thing.id, readAt: ago(0), action: 'not_here' }], {
      expected: 1,
    });
    const first = await sent(t, ibrahim, ops);
    const again = await sent(t, ibrahim, ops);
    expect(again).toEqual(first);
    const events = await own<{ n: number }>(
      db,
      `SELECT count(*)::int AS n FROM public.audit_events
        WHERE action = 'scan.session' AND diff->'session_id'->>'after' = $1`,
      [s.id],
    );
    expect(events[0]?.n).toBe(1);
  });

  it("answers 404 for a session you can't see", async () => {
    const s = session('count', { locationId: cottage.id });
    const thing = await createThing(t, ibrahim, cottage, { name: 'Rug' });
    await sent(
      t,
      ibrahim,
      walk(cottage, s, [{ thingId: thing.id, readAt: ago(0), action: 'seen' }], { expected: 1 }),
    );
    expect((await call(t, `/api/v1/scan-sessions/${s.id}`, { as: louis })).statusCode).toBe(404);
  });
});
