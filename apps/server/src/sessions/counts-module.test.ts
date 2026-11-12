import { newId, type QueueItem } from '@kept/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import { call, join, type Person, peopleApp, person } from '../../test/people.js';
import { op, sent } from '../../test/sync-ops.js';
import {
  createLocation,
  createThing,
  type Json,
  type Loc,
  ok,
  own,
  place,
} from '../../test/things.js';

// Counts as a module a location can turn off (#506), like Labels and Lending: on in every preset,
// so a location keeps its counts; off, the counts' reads are 404 `module_off`, their writes 409,
// the phone's count ops are dropped, and a planned count leaves the agenda. A pack or a move,
// the other kinds of scan session, don't need it.

let db: TestDb;
let t: TestApp;
let ibrahim: Person; // owner of Home
let louis: Person; // member of Home
let home: Loc;

const HOUR = 3_600_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

type Plain = Record<string, unknown>;

const session = (mode: 'count' | 'pack' | 'move', target: Plain) => ({
  id: newId(),
  mode,
  target,
  startedAt: ago(2 * HOUR),
});

function walk(s: ReturnType<typeof session>, lines: Plain[]): QueueItem[] {
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
      { sessionId: s.id, expected: lines.length },
      { idempotencyKey: `scan-finish:${s.id}`, dependsOn: [lineOp.idempotencyKey] },
    ),
  ];
}

const switchCounts = async (enabled: boolean) =>
  ok(
    await call(t, `/api/v1/locations/${home.id}/modules`, {
      as: ibrahim,
      body: { module: 'counts', enabled },
    }),
  );

const status = async (as: Person, url: string, body?: unknown) => {
  const res = await call(t, url, { as, ...(body === undefined ? {} : { body }) });
  const code = res.headers['content-type']?.toString().includes('json')
    ? (res.json() as { code?: string }).code
    : undefined;
  return { status: res.statusCode, code };
};

const agendaHas = async (scheduleId: string) => {
  const r = ok(await call(t, '/api/v1/agenda?sourceType=schedule', { as: ibrahim }));
  return (r.items as Json[]).some((x) => x.sourceId === scheduleId);
};

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  t = await peopleApp(db);
  ibrahim = await person(t, db, 'ibrahim');
  louis = await person(t, db, 'louis');
  home = await createLocation(t, db, ibrahim, 'household');
  await join(db, home.id, louis.userId, 'member');
});

afterAll(async () => {
  await t.app.close();
});

describe('Counts, a module a location can turn off (#506)', () => {
  it('is on in a new location of every preset', async () => {
    for (const preset of ['essentials', 'household', 'complete'] as const) {
      const loc = await createLocation(t, db, ibrahim, preset, `Counts ${preset}`);
      const view = ok(await call(t, `/api/v1/locations/${loc.id}`, { as: ibrahim }));
      expect(view.modules, preset).toContain('counts');
      expect((await status(ibrahim, `/api/v1/locations/${loc.id}/counts`)).status, preset).toBe(
        200,
      );
    }
  });

  it('off: its reads are 404 module_off, its writes 409, and it comes back as it was', async () => {
    const study = await place(db, home, 'Study');
    const lamp = await createThing(t, ibrahim, home, { name: 'Lamp', placeId: study });
    const before = session('count', { placeId: study, inside: true });
    const results = await sent(
      t,
      louis,
      walk(before, [{ thingId: lamp.id, readAt: ago(HOUR), action: 'seen' }]),
    );
    expect(results.map((r) => r.outcome)).toEqual(['applied', 'applied']);
    const open = session('count', { placeId: study, inside: true });
    ok(
      await call(t, '/api/v1/scan-sessions', {
        as: louis,
        body: { id: open.id, target: open.target },
      }),
      201,
    );

    await switchCounts(false);
    const view = ok(await call(t, `/api/v1/locations/${home.id}`, { as: ibrahim }));
    expect(view.modules).not.toContain('counts');

    const off404 = { status: 404, code: 'module_off' };
    expect(await status(louis, `/api/v1/locations/${home.id}/counts`)).toEqual(off404);
    expect(await status(louis, `/api/v1/scan-sessions/${before.id}`)).toEqual(off404);
    expect(await status(louis, `/api/v1/scan-sessions/${before.id}/result`)).toEqual(off404);
    expect(await status(louis, `/api/v1/scan-sessions/${before.id}/result.csv`)).toEqual(off404);
    expect(await status(louis, `/api/v1/scan-sessions/${open.id}/lines`)).toEqual(off404);
    expect(await status(louis, `/api/v1/scan-sessions/open?placeId=${study}`)).toEqual(off404);
    expect(await status(louis, `/api/v1/scan-sessions/open?locationId=${home.id}`)).toEqual(off404);
    const fresh = session('count', { placeId: study, inside: true });
    expect(
      await status(louis, '/api/v1/scan-sessions', { id: fresh.id, target: fresh.target }),
    ).toEqual({ status: 409, code: 'module_off' });

    // A count saved on a phone while it was off is dropped, the open one can't be finished.
    const offline = session('count', { placeId: study, inside: true });
    const dropped = await sent(
      t,
      louis,
      walk(offline, [{ thingId: lamp.id, readAt: ago(HOUR), action: 'seen' }]),
    );
    expect(dropped.map((r) => r.outcome)).toEqual(['dropped', 'dropped']);
    const finish = await sent(t, louis, [
      op('scan_session_finish', home.id, { sessionId: open.id, expected: 0 }),
    ]);
    expect(finish[0]?.outcome).toBe('dropped');
    expect(
      await own(db, 'SELECT finished_at FROM public.scan_sessions WHERE id = $1', [open.id]),
    ).toEqual([{ finished_at: null }]);

    // Back on: nothing was deleted.
    await switchCounts(true);
    const r = ok(await call(t, `/api/v1/scan-sessions/${before.id}/result`, { as: louis }));
    expect(r.session).toMatchObject({ seen: 1 });
    const list = ok(await call(t, `/api/v1/locations/${home.id}/counts`, { as: louis }));
    expect((list.items as Json[]).map((x) => x.id)).toContain(before.id);
  });

  it('off: a pack or a move is still a scan session of its own', async () => {
    const hall = await place(db, home, 'Hall');
    const shelf = await place(db, home, 'Shelf');
    const tape = await createThing(t, ibrahim, home, { name: 'Tape', placeId: hall });
    await switchCounts(false);
    try {
      const s = session('move', { placeId: shelf, inside: false });
      const results = await sent(
        t,
        louis,
        walk(s, [{ thingId: tape.id, readAt: ago(HOUR), action: 'move', to: { placeId: shelf } }]),
      );
      expect(results.map((r) => r.outcome)).toEqual(['applied', 'applied']);
      expect((await status(louis, `/api/v1/scan-sessions/${s.id}`)).status).toBe(200);
    } finally {
      await switchCounts(true);
    }
  });

  it('off: a count can’t be planned, and a planned count leaves the agenda', async () => {
    const loft = await place(db, home, 'Loft');
    const attic = await place(db, home, 'Attic');
    const made = ok(
      await call(t, '/api/v1/schedules', {
        as: ibrahim,
        body: { subject: { placeId: loft }, name: 'Count the loft', kind: 'count', everyMonths: 6 },
      }),
      201,
    );
    await own(
      db,
      `UPDATE public.schedules SET base_on = current_date - 200, anchor_on = current_date - 200
        WHERE id = $1`,
      [made.id],
    );
    expect(await agendaHas(made.id as string)).toBe(true);

    await switchCounts(false);
    try {
      expect(await agendaHas(made.id as string)).toBe(false);
      expect(
        await status(ibrahim, '/api/v1/schedules', {
          subject: { placeId: attic },
          name: 'Count the attic',
          kind: 'count',
          everyMonths: 3,
        }),
      ).toEqual({ status: 409, code: 'module_off' });
      // Any other schedule still can be.
      expect(
        (
          await status(ibrahim, '/api/v1/schedules', {
            subject: { placeId: attic },
            name: 'Air the attic',
            everyMonths: 3,
          })
        ).status,
      ).toBe(201);
    } finally {
      await switchCounts(true);
    }
    expect(await agendaHas(made.id as string)).toBe(true);
  });
});
