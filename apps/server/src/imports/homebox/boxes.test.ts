import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestApp } from '../../../test/app.js';
import { homeboxFixture, homeboxZip, uploadArchive } from '../../../test/archive-imports.js';
import { type TestDb, testDb } from '../../../test/db.js';
import { type TestFiles, testFiles } from '../../../test/files.js';
import {
  call,
  join,
  type Person,
  peopleApp,
  person,
  type RecordedJob,
} from '../../../test/people.js';
import { createLocation, type Loc, ok, own } from '../../../test/things.js';
import type { Scope } from '../../db/scope.js';
import { runHomeboxImport } from './job.js';

// A Homebox 0.27 upgrade (homebox-0.27.0-boxes.zip: global.item and global.location, nine boxes
// and two bins named like boxes, eight used-up items) through the front door into a new
// location, and the repair of an import made the way imports were made before 1.13.0. Ibrahim
// imports; Louis is a member of the location he imports into, Bruce its admin.

let db: TestDb;
let t: TestApp;
let files: TestFiles;
const sent: RecordedJob[] = [];
let ibrahim: Person;
let bruce: Person;
let louis: Person;
let zip: Buffer;

const log = { info: () => {}, error: () => {} };
const LONG = 240_000;
const scopeOf = (p: Person): Scope => ({ userId: p.userId, mfa: false });
const jobDeps = () => ({
  pools: db.pools,
  files,
  jobs: { send: async () => {}, sendTenant: async () => {} },
  log,
});

type Run = {
  id: string;
  locationId: string | null;
  rowVersion: number;
  status: string;
  inspect: {
    collections: {
      mapping: {
        types: { id: string; name: string }[];
        boxes: { id: string; name: string }[];
        catchAll: string | null;
      };
    }[];
  };
};

const runOf = async (as: Person, id: string) =>
  ok(await call(t, `/api/v1/imports/${id}`, { as })) as unknown as Run;

/** Uploads the backup, targets `target`, makes `choices` (over the defaults), checks and runs. */
async function importBoxes(
  as: Person,
  target: object,
  choices: (run: Run) => Record<string, unknown>,
): Promise<Run> {
  const id = await uploadArchive(t, as, zip);
  ok(await call(t, `/api/v1/imports/${id}/inspect`, { as, body: {} }));
  ok(await call(t, `/api/v1/imports/${id}/target`, { as, body: target }));
  let run = await runOf(as, id);
  ok(
    await call(t, `/api/v1/imports/${id}/choices`, {
      as,
      headers: { 'if-match': String(run.rowVersion) },
      body: {
        choices: {
          archived: 'archived',
          currency: 'GBP',
          quantityRounding: 'keep_note',
          fields: {},
          types: {},
          insured: 'field',
          seeded: 'skip_unused',
          ...choices(run),
        },
      },
    }),
  );
  ok(await call(t, `/api/v1/imports/${id}/dry-run`, { as, body: {} }));
  ok(await call(t, `/api/v1/imports/${id}/run`, { as, body: {} }), 202);
  await runHomeboxImport(jobDeps(), scopeOf(as), id);
  run = await runOf(as, id);
  expect(run.status).toBe('done');
  return run;
}

const thingsIn = (locationId: string) =>
  own<{
    id: string;
    name: string;
    quantity: string;
    lifecycle: string;
    notes: string | null;
    type: string | null;
    builtin: string | null;
    container: string | null;
    place: string | null;
  }>(
    db,
    `SELECT t.id, t.name, t.quantity::text AS quantity, t.lifecycle, t.notes, y.name AS type,
            y.builtin_key AS builtin, c.name AS container, p.name AS place
       FROM public.things t
       LEFT JOIN public.types y ON y.id = t.type_id
       LEFT JOIN public.things c ON c.id = t.container_id
       LEFT JOIN public.places p ON p.id = t.place_id
      WHERE t.location_id = $1 AND t.deleted_at IS NULL ORDER BY t.name`,
    [locationId],
  );

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  files = await testFiles();
  t = await peopleApp(db, { sent, files });
  ibrahim = await person(t, db, 'ibrahim');
  bruce = await person(t, db, 'bruce');
  louis = await person(t, db, 'louis');
  zip = await homeboxFixture('homebox-0.27.0-boxes.zip');
}, 120_000);

afterAll(async () => {
  await files?.cleanup();
});

describe('a Homebox 0.27 upgrade into a new location', () => {
  it(
    'comes over as chosen: no internal names, used-up things archived, boxes in the garage, Essentials',
    async () => {
      const run = await importBoxes(
        ibrahim,
        {
          newLocation: {
            name: 'Maple Street',
            kind: 'home',
            timezone: 'Europe/London',
            currency: 'GBP',
          },
        },
        (r) => {
          const m = r.inspect.collections[0]?.mapping;
          return {
            types: { [m?.catchAll as string]: { none: true } },
            zeroQuantity: 'keep_or_archive',
            boxes: (m?.boxes ?? []).map((b) => b.id),
          };
        },
      );
      const loc = run.locationId as string;
      const [location] = await own<{ preset: string }>(
        db,
        'SELECT preset FROM public.locations WHERE id = $1',
        [loc],
      );
      expect(location?.preset).toBe('essentials');
      const things = await thingsIn(loc);
      // No type named after Homebox's keys, and none made at all: No type.
      const types = await own<{ name: string }>(
        db,
        `SELECT name FROM public.types WHERE owner_account_id = (
           SELECT owner_account_id FROM public.locations WHERE id = $1)`,
        [loc],
      );
      expect(types.map((y) => y.name).join()).not.toContain('global.');
      expect(things.find((x) => x.name === 'Hammer')?.type).toBeNull();
      // The used-up things: archived, with Homebox's 0 in the notes.
      const used = things.filter((x) => x.notes?.includes('Quantity in Homebox: 0'));
      expect(used).toHaveLength(8);
      expect(used.every((x) => x.lifecycle === 'archived' && Number(x.quantity) === 1)).toBe(true);
      // The garage's boxes are boxes, holding what was in them; the bins too.
      const boxes = things.filter((x) => /^(Box \d\d|Bin \d)$/.test(x.name));
      expect(boxes).toHaveLength(14);
      expect(boxes.every((x) => x.builtin === 'box_bin')).toBe(true);
      expect(things.find((x) => x.name === 'Box 01')?.place).toBe('Garage');
      expect(things.find((x) => x.name === 'Christmas lights')?.container).toBe('Box 01');
      const places = await own<{ name: string }>(
        db,
        'SELECT name FROM public.places WHERE location_id = $1 AND deleted_at IS NULL',
        [loc],
      );
      expect(places.map((p) => p.name)).not.toContain('Box 01');
      expect(places.map((p) => p.name)).toContain('Shelf C');
      // Only the tackle box became a box; nothing else opens as a container.
      expect(things.find((x) => x.name === 'Tackle box')?.builtin).toBe('box_bin');
      expect(things.filter((x) => x.builtin === 'box_bin').map((x) => x.name)).toHaveLength(16);
      // Nothing to repair in an import made this way.
      const plan = ok(await call(t, `/api/v1/imports/${run.id}/repair`, { as: ibrahim }));
      expect(plan).toEqual({ zero: [], containerTypes: [], renames: [] });
    },
    LONG,
  );
});

describe('repairing a past import', () => {
  let home: Loc;
  let run: Run;

  beforeAll(async () => {
    home = await createLocation(t, db, ibrahim, 'household', 'Home');
    await join(db, home.id, bruce.userId, 'admin');
    await join(db, home.id, louis.userId, 'member');
    // As imports did before 1.13.0: the type made from global.item, 0 became 1, and one item
    // holding a location gave the whole type the container capability.
    run = await importBoxes(ibrahim, { locationId: home.id }, (r) => {
      const m = r.inspect.collections[0]?.mapping;
      return { types: { [m?.catchAll as string]: { create: 'Item' } } };
    });
    await own(
      db,
      `UPDATE public.types SET name = 'global.item', capabilities = '{container}'
        WHERE id IN (SELECT entity_id FROM public.import_source_ids
                      WHERE run_id = $1 AND entity_type = 'type')`,
      [run.id],
    );
    // An old run's report says "became 1", with no note; mark one of them changed since.
    await own(
      db,
      `UPDATE public.things SET quantity = 2 WHERE name = 'Grout' AND location_id = $1`,
      [home.id],
    );
  }, LONG);

  it('lists the things that were 0 in Homebox, the container type and the global.item name', async () => {
    const plan = ok(
      await call(t, `/api/v1/imports/${run.id}/repair`, { as: bruce }),
    ) as unknown as {
      zero: { name: string }[];
      containerTypes: { name: string }[];
      renames: { name: string; to: string }[];
    };
    // Grout has quantity 2 now: left alone.
    expect(plan.zero.map((x) => x.name)).toEqual([
      'AA batteries',
      'Candles',
      'Gas canister',
      'Lures',
      'Spare light bulbs',
      'Wrapping paper',
      'Zip ties',
    ]);
    expect(plan.containerTypes.map((y) => y.name)).toEqual(['Item']);
    expect(plan.renames).toEqual([expect.objectContaining({ name: 'global.item', to: 'item' })]);
  });

  it('is not there for a member', async () => {
    expect((await call(t, `/api/v1/imports/${run.id}/repair`, { as: louis })).statusCode).toBe(404);
    const res = await call(t, `/api/v1/imports/${run.id}/repair`, {
      as: louis,
      body: { zero: true },
    });
    expect(res.statusCode).toBe(404);
  });

  // catalogue: POST /api/v1/imports/:id/repair
  it(
    'applies all three, and one undo of its events puts everything back',
    async () => {
      const res = await call(t, `/api/v1/imports/${run.id}/repair`, {
        as: ibrahim,
        body: { zero: true, containerTypes: true, names: { item: 'Item', location: 'Location' } },
      });
      expect(res.statusCode, res.body).toBe(200);
      expect(res.json()).toMatchObject({
        repaired: { things: 7, types: 1 },
        plan: { zero: [], containerTypes: [], renames: [] },
      });
      const after = await thingsIn(home.id);
      expect(after.find((x) => x.name === 'Candles')?.lifecycle).toBe('archived');
      expect(after.find((x) => x.name === 'Grout')?.lifecycle).toBe('in_use');
      const [type] = await own<{ name: string; capabilities: string[] }>(
        db,
        `SELECT name, capabilities FROM public.types WHERE id IN (
           SELECT entity_id FROM public.import_source_ids WHERE run_id = $1 AND entity_type = 'type')`,
        [run.id],
      );
      expect(type).toEqual({ name: 'Item', capabilities: [] });
      // The tackle box still holds the lure tray: a thing with contents is a container.
      expect(after.find((x) => x.name === 'Lure tray')?.container).toBe('Tackle box');

      // One undo: every event the repair wrote, together.
      const ids = String(res.headers['x-kept-audit-event'] ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      expect(ids).toHaveLength(8);
      const undo = await call(t, '/api/v1/audit/undo', { as: ibrahim, body: { eventIds: ids } });
      expect(undo.statusCode, undo.body).toBe(200);
      const back = await thingsIn(home.id);
      expect(back.find((x) => x.name === 'Candles')?.lifecycle).toBe('in_use');
      const [restored] = await own<{ name: string; capabilities: string[] }>(
        db,
        `SELECT name, capabilities FROM public.types WHERE id IN (
           SELECT entity_id FROM public.import_source_ids WHERE run_id = $1 AND entity_type = 'type')`,
        [run.id],
      );
      expect(restored).toEqual({ name: 'global.item', capabilities: ['container'] });
      const events = await own<{ action: string }>(
        db,
        `SELECT action FROM public.audit_events
          WHERE entity_type = 'import_run' AND entity_id = $1 AND action = 'import.repair'`,
        [run.id],
      );
      expect(events).toHaveLength(2);
    },
    LONG,
  );

  it('refuses with nothing chosen', async () => {
    const res = await call(t, `/api/v1/imports/${run.id}/repair`, { as: ibrahim, body: {} });
    expect(res.statusCode).toBe(400);
  });
});

describe('repairing a past import: what is never archived', () => {
  it(
    'leaves out a location that became a thing, and a thing holding others',
    async () => {
      const study = await createLocation(t, db, ibrahim, 'household', 'Study');
      zip = await homeboxZip('home');
      const run = await importBoxes(ibrahim, { locationId: study.id }, () => ({
        archived: 'in_use',
      }));
      zip = await homeboxFixture('homebox-0.27.0-boxes.zip');
      // Before 1.13.0 the Bits tray (a location inside the Toolbox) was reported as 0 → 1 too.
      await own(
        db,
        `UPDATE public.import_runs
          SET dry_run_report = jsonb_set(dry_run_report, '{rows}', (
            SELECT jsonb_agg(CASE WHEN r->'ref'->>'name' = 'Bits tray'
              THEN jsonb_set(r, '{issues}', (r->'issues') || '[{"column":"","code":"hb_quantity_zero","message":"x"}]')
              ELSE r END)
              FROM jsonb_array_elements(dry_run_report->'rows') r))
        WHERE id = $1`,
        [run.id],
      );
      const plan = ok(
        await call(t, `/api/v1/imports/${run.id}/repair`, { as: ibrahim }),
      ) as unknown as {
        zero: { name: string }[];
      };
      const names = plan.zero.map((x) => x.name);
      expect(names).not.toContain('Bits tray');
      expect(names).not.toContain('Toolbox');
      expect(names).toEqual(expect.arrayContaining(['Espresso machine', 'Cordless drill']));
    },
    LONG,
  );
});

describe('What to track: Essentials and what the backup uses', () => {
  type Summary = { purchases: number; warranties: number; services: number; schedules: number };
  /** The check's summary for a new location with Essentials and `modules` on top. */
  async function checkWith(modules: string[] | undefined): Promise<Summary> {
    const id = await uploadArchive(t, bruce, zip);
    const inspect = ok(
      await call(t, `/api/v1/imports/${id}/inspect`, { as: bruce, body: {} }),
    ) as unknown as Run['inspect'];
    const catchAll = inspect.collections[0]?.mapping.catchAll as string;
    ok(
      await call(t, `/api/v1/imports/${id}/target`, {
        as: bruce,
        body: {
          newLocation: {
            name: `Checked ${modules?.join(' ') ?? 'plain'}`,
            kind: 'home',
            timezone: 'Europe/London',
            currency: 'GBP',
            ...(modules ? { modules } : {}),
          },
        },
      }),
    );
    const run = await runOf(bruce, id);
    ok(
      await call(t, `/api/v1/imports/${id}/choices`, {
        as: bruce,
        headers: { 'if-match': String(run.rowVersion) },
        body: {
          choices: {
            archived: 'archived',
            currency: 'GBP',
            quantityRounding: 'keep_note',
            fields: {},
            types: { [catchAll]: { none: true } },
            insured: 'field',
            seeded: 'skip_unused',
          },
        },
      }),
    );
    const { report } = ok(
      await call(t, `/api/v1/imports/${id}/dry-run`, { as: bruce, body: {} }),
    ) as unknown as { report: { summary: Summary } };
    return report.summary;
  }
  const records = (s: Summary) => ({
    purchases: s.purchases,
    warranties: s.warranties,
    maintenance: s.services + s.schedules,
  });

  it(
    'with every module the backup uses ticked, prices, warranties and maintenance are records',
    async () => {
      expect(records(await checkWith(['money', 'warranties', 'schedules']))).toEqual({
        purchases: 10,
        warranties: 5,
        maintenance: 2,
      });
    },
    LONG,
  );

  it(
    'with Essentials alone, or one left unticked, that data stays in the notes',
    async () => {
      expect(records(await checkWith(undefined))).toEqual({
        purchases: 0,
        warranties: 0,
        maintenance: 0,
      });
      expect(records(await checkWith(['money', 'schedules']))).toEqual({
        purchases: 10,
        warranties: 0,
        maintenance: 2,
      });
    },
    LONG,
  );

  it(
    'makes the location with them, and Personal takes the same set',
    async () => {
      const run = await importBoxes(
        bruce,
        {
          newLocation: {
            name: 'Elm Road',
            kind: 'home',
            timezone: 'Europe/London',
            currency: 'GBP',
            modules: ['money', 'warranties', 'schedules'],
            alsoPersonal: true,
          },
        },
        (r) => ({
          types: { [r.inspect.collections[0]?.mapping.catchAll as string]: { none: true } },
        }),
      );
      const on = await own<{ kind: string; preset: string; modules: string[] }>(
        db,
        `SELECT l.kind, l.preset,
              array(SELECT m.module FROM public.location_modules m
                     WHERE m.location_id = l.id AND m.enabled
                       AND m.module IN ('money', 'warranties', 'schedules', 'lending')
                     ORDER BY m.module) AS modules
         FROM public.locations l
        WHERE l.id = $1 OR (l.kind = 'personal' AND l.owner_account_id = (
          SELECT owner_account_id FROM public.locations WHERE id = $1))
        ORDER BY l.kind`,
        [run.locationId],
      );
      expect(on).toEqual([
        { kind: 'home', preset: 'essentials', modules: ['money', 'schedules', 'warranties'] },
        { kind: 'personal', preset: 'essentials', modules: ['money', 'schedules', 'warranties'] },
      ]);
    },
    LONG,
  );
});
