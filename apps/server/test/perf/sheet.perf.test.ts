import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import type { PgBoss } from 'pg-boss';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBoss } from '../../src/jobs/boss.js';
import { bossQueue, createRequestQueues } from '../../src/jobs/queue.js';
import { packageRoot } from '../../src/package-root.js';
import type { TestApp } from '../app.js';
import { type TestDb, testDb } from '../db.js';
import { call, join, type Person, peopleApp, person } from '../people.js';
import { createLocation, type Loc, own, place } from '../things.js';
import { calibration, under } from './limits.js';
import { stats } from './timing.js';

// The spreadsheet view's save: POST /api/v1/things/bulk-edit with 200 rows, the most one
// request takes, in a location of 5,000 things (the size the old save was measured at). Full
// mode only (scripts/ci-local.sh `perf`; vitest.perf.config.ts); the normal run leaves test/perf
// out.
//
// The fixture: one location (Home, the household preset) owned by Ann, with Mo (member), holding
// 5,000 things in 20 places, 12 tags and 6 brands, bulk-inserted as kept_owner with every trigger
// firing, then ANALYZEd. Each save is a sheet's heaviest ordinary save: every row renamed, given
// a brand, a model and two tags, and every other row moved to another place (so two undoable
// events for half the rows), as the member (row-level security and can() on every row). Each
// timed save edits 200 rows no save has touched, at the versions read just before. The rows are
// checked after each: every one saved, a `thing.update` per row and a `thing.move` per moved row.
// Then one save is undone together (POST /api/v1/audit/undo), timed and recorded. A real pg-boss
// queue takes the re-embeds, as in production.
//
// LIMITS (reference-runner ms; under() scales them, test/perf/limits.ts). The old row-by-row
// save measured 3–4 s for 200 rows on a quiet machine: 5,312 statements, about 26 a row.
// Set-based (sheet.ts bulkEdit, 2026-10-20) it measured 546, 400 of them the re-embeds' sends,
// and then about 350 once those share one scope read (200 fewer reads, counted not timed). Old
// and new saves interleaved in one run on an M1 Pro took p50 16.9 s and 2.2 s (load 43–58 from
// other test suites, calibration factor 1.47): 7.8 times faster under the same load. No quiet
// run was possible that day, so the limit is the target itself, 1 s, which the old save fails
// threefold on any machine.

const THINGS = 5_000;
const PLACES = 20;
const TAGS = 12;
const BRANDS = 6;
const ROWS = 200;
const WARMUP = 1;
const RUNS = 5;
const LIMITS = { save200MaxMs: 1_000 };

let db: TestDb;
let t: TestApp;
let boss: PgBoss;
let ann: Person;
let mo: Person;
let home: Loc;
const places: string[] = [];
let tags: string[] = [];
let brands: string[] = [];
let ids: string[] = [];
const results: Record<string, unknown> = {};

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  // A real job queue, as production has: each renamed thing queues its embedding (pg-boss's
  // INSERT in the request's transaction), part of what a save costs. Every queue a request sends
  // to is created as the server creates them at boot: pg-boss refuses a send to a missing queue.
  boss = createBoss({
    connectionString: db.urls.system,
    supervise: false,
    schedule: false,
    max: 2,
  });
  await boss.start();
  await createRequestQueues(boss);
  t = await peopleApp(db, { jobs: bossQueue(boss) });
  const started = performance.now();
  ann = await person(t, db, 'ann');
  mo = await person(t, db, 'mo');
  home = await createLocation(t, db, ann, 'household', 'Home');
  await join(db, home.id, mo.userId, 'member');
  for (let i = 1; i <= PLACES; i++) places.push(await place(db, home, `Room ${i}`));
  tags = (
    await own<{ id: string }>(
      db,
      `INSERT INTO public.tags (owner_account_id, name)
       SELECT $1, 'Tag ' || n FROM generate_series(1, $2) AS n RETURNING id`,
      [home.accountId, TAGS],
    )
  ).map((r) => r.id);
  brands = (
    await own<{ id: string }>(
      db,
      `INSERT INTO public.brands (owner_account_id, name)
       SELECT $1, 'Brand ' || n FROM generate_series(1, $2) AS n RETURNING id`,
      [home.accountId, BRANDS],
    )
  ).map((r) => r.id);
  await own(
    db,
    `INSERT INTO public.things (location_id, place_id, name, created_by)
     SELECT $1, ($2::uuid[])[1 + n % $4], 'Thing ' || lpad(n::text, 5, '0'), $3
       FROM generate_series(1, $5) AS n`,
    [home.id, places, ann.userId, PLACES, THINGS],
  );
  ids = (
    await own<{ id: string }>(
      db,
      'SELECT id FROM public.things WHERE location_id = $1 ORDER BY name',
      [home.id],
    )
  ).map((r) => r.id);
  // A tag on every third thing, so a save replaces some and adds others.
  await own(
    db,
    `INSERT INTO public.thing_tags (location_id, thing_id, tag_id)
     SELECT $1, id, ($2::uuid[])[1 + n % $3]
       FROM (SELECT id, row_number() OVER (ORDER BY name) AS n
               FROM public.things WHERE location_id = $1) x
      WHERE n % 3 = 0`,
    [home.id, tags, TAGS],
  );
  await own(db, 'ANALYZE public.things, public.places, public.thing_tags, public.tags');
  expect(ids).toHaveLength(THINGS);
  results.fixture = {
    things: THINGS,
    places: PLACES,
    rowsPerSave: ROWS,
    seedMs: Math.round(performance.now() - started),
  };
}, 600_000);

afterAll(async () => {
  await t?.app.close();
  await boss?.stop({ graceful: false });
  const dir = path.join(packageRoot(), '../../.tmp/perf');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'sheet.json');
  writeFileSync(
    file,
    `${JSON.stringify({ at: new Date().toISOString(), calibration: calibration(), results }, null, 2)}\n`,
  );
  console.log(`sheet perf: ${JSON.stringify(results)} → ${file}`);
});

/** The versions of `slice` now, by id. */
async function versionsOf(slice: string[]): Promise<Map<string, number>> {
  const rows = await own<{ id: string; v: number }>(
    db,
    'SELECT id, row_version AS v FROM public.things WHERE id = ANY($1::uuid[])',
    [slice],
  );
  return new Map(rows.map((r) => [r.id, Number(r.v)]));
}

/** The heaviest ordinary save of `slice` (run `n`): see the header. */
async function editsOf(slice: string[], n: number) {
  const v = await versionsOf(slice);
  return slice.map((id, i) => ({
    id,
    rowVersion: v.get(id) as number,
    set: {
      name: `Renamed ${n}-${i}`,
      brandId: brands[(n + i) % BRANDS],
      model: `M-${n}-${i}`,
      tagIds: [tags[(n + i) % TAGS], tags[(n + i + 5) % TAGS]],
      ...(i % 2 === 0 ? { to: { placeId: places[(n + i + 7) % PLACES] } } : {}),
    },
  }));
}

type Saved = { results: { ok: boolean }[]; rows: unknown[]; events: string[] };

async function save(slice: string[], n: number): Promise<{ ms: number; body: Saved }> {
  const edits = await editsOf(slice, n);
  const start = performance.now();
  const res = await call(t, '/api/v1/things/bulk-edit', { as: mo, body: { edits } });
  const ms = performance.now() - start;
  expect(res.statusCode, res.body).toBe(200);
  const body = res.json() as Saved;
  expect(body.results.every((r) => r.ok)).toBe(true);
  expect(body.rows).toHaveLength(slice.length);
  // A thing.update per row and a thing.move per moved row (every other one).
  expect(body.events).toHaveLength(slice.length + slice.length / 2);
  return { ms, body };
}

describe('the spreadsheet save (full mode only)', () => {
  it(`saves ${ROWS} rows at ${THINGS} things in under ${LIMITS.save200MaxMs} ms`, async () => {
    const samples: number[] = [];
    let last: Saved | null = null;
    for (let n = 0; n < WARMUP + RUNS; n++) {
      const { ms, body } = await save(ids.slice(n * ROWS, (n + 1) * ROWS), n);
      if (n >= WARMUP) samples.push(ms);
      last = body;
    }
    const s = stats(samples);
    results.save200 = s;
    under(results, 'save200MaxMs', s.max, LIMITS.save200MaxMs);

    // One Undo for the whole save, recorded (the sheet's toast sends it).
    const undoStart = performance.now();
    const undo = await call(t, '/api/v1/audit/undo', {
      as: mo,
      body: { eventIds: (last as Saved).events },
    });
    results.undo200Ms = Math.round((performance.now() - undoStart) * 10) / 10;
    expect(undo.statusCode, undo.body).toBe(200);
  }, 600_000);
});
