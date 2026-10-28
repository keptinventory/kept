import { newId } from '@kept/shared';
import type { LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import { call, join, type Person, peopleApp, person } from '../../test/people.js';
import { createLocation, createThing, eventsOf, type Loc, ok, own } from '../../test/things.js';
import { setTimeLimitsForTests } from '../codes/format-rule.js';

// Place templates (#238): storage furniture made in one step with a place for each compartment,
// as it stands, numbered top left to bottom right, with codes derived from the furniture's own
// code, and one Undo. Through the front door in the web contract's shapes
// (apps/web/src/api/inventory/types.ts "place templates").
//
// The household, as templates.test.ts: Ibrahim owns Home and Garage. In Home, Bruce is an admin,
// Louis a member and Talia a viewer; the Garage is Ibrahim's alone. Alfred has his own
// household, بيت العائلة, and sees nothing of Ibrahim's.

let db: TestDb;
let t: TestApp;
let ibrahim: Person;
let bruce: Person;
let louis: Person;
let talia: Person;
let alfred: Person;
let home: Loc;
let garage: Loc;
let family: Loc;
let restoreLimits: () => void;

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  t = await peopleApp(db);
  ibrahim = await person(t, db, 'ibrahim');
  bruce = await person(t, db, 'bruce');
  louis = await person(t, db, 'louis');
  talia = await person(t, db, 'talia');
  alfred = await person(t, db, 'alfred');
  home = await createLocation(t, db, ibrahim, 'household', 'Home');
  garage = await createLocation(t, db, ibrahim, 'household', 'Garage');
  family = await createLocation(t, db, alfred, 'household', 'بيت العائلة');
  await join(db, home.id, bruce.userId, 'admin');
  await join(db, home.id, louis.userId, 'member');
  await join(db, home.id, talia.userId, 'viewer');
  // A loaded machine can stall a format rule's timed check; these tests are about what a rule
  // allows, not its limits (codes.test.ts covers those).
  restoreLimits = setTimeLimitsForTests({ vet: 5_000, check: 5_000 });
});

afterAll(async () => {
  restoreLimits();
  await t.app.close();
});

type Compartment = {
  id: string;
  name: string;
  n: number;
  row: number;
  col: number;
  code: string | null;
};
type Made = {
  place: { id: string; name: string; kindKey: string; parentId: string | null; rowVersion: number };
  compartments: Compartment[];
};

const fromTemplate = (as: Person, loc: Loc, body: Record<string, unknown>) =>
  call(t, `/api/v1/locations/${loc.id}/places/from-template`, { as, body });

const made = (res: LightMyRequestResponse) => ok(res, 201) as unknown as Made;

const auditIds = (res: LightMyRequestResponse) =>
  String(res.headers['x-kept-audit-event'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const undo = (as: Person, eventId: string) =>
  call(t, `/api/v1/audit/${eventId}/undo`, { as, body: {} });

async function room(name: string, loc: Loc = home, as: Person = ibrahim): Promise<string> {
  return ok(
    await call(t, `/api/v1/locations/${loc.id}/places`, {
      as,
      body: { name, kindKey: 'room' },
    }),
    201,
  ).id as string;
}

const rows = (parentId: string) =>
  own<{
    id: string;
    name: string;
    kind_key: string;
    sort: number;
    cell: { row: number; col: number } | null;
    deleted_at: Date | null;
  }>(
    db,
    `SELECT id, name, kind_key, sort, cell, deleted_at FROM public.places
      WHERE parent_id = $1 ORDER BY sort, id`,
    [parentId],
  );

const codesOf = async (placeId: string) =>
  (
    await own<{ code: string }>(
      db,
      `SELECT code FROM public.legacy_codes WHERE place_id = $1 AND source = 'own' ORDER BY code`,
      [placeId],
    )
  ).map((r) => r.code);

async function setRule(
  loc: Loc,
  rule: { pattern: string; message: string; example: string } | null,
) {
  const current = ok(await call(t, `/api/v1/locations/${loc.id}/own-codes`, { as: ibrahim }));
  ok(
    await call(t, `/api/v1/locations/${loc.id}/own-codes`, {
      as: ibrahim,
      method: 'PUT',
      body: { numbering: { enabled: false, prefix: '', pad: 4 }, rule },
      headers: { 'if-match': String(current.rowVersion) },
    }),
  );
}

// Place templates of the account, as the settings screen sends them.
const createTemplate = (as: Person, accountId: string, body: Record<string, unknown>) =>
  call(t, `/api/v1/accounts/${accountId}/place-templates`, { as, body });

const KALLAX = {
  name: 'Wide cube shelf',
  layout: { kind: 'grid', across: 3, up: 2 },
  kindKey: 'furniture',
  compartmentKindKey: 'cube',
  compartmentName: 'Fach {n}',
  codePattern: '{parent}-F{col:02}{row:02}',
};

async function template(over: Record<string, unknown> = {}, locations: Loc[] = [home]) {
  return ok(
    await createTemplate(ibrahim, home.accountId, {
      ...KALLAX,
      ...over,
      locationIds: locations.map((l) => l.id),
    }),
    201,
  ) as unknown as { id: string; rowVersion: number; name: string };
}

// ---------------------------------------------------------------------------------------------

describe('migration 0161 and the built-in kinds', () => {
  it('adds templates.applies_to, places.layout and places.cell, and their grants', async () => {
    const cols = await own<{
      table_name: string;
      column_name: string;
      column_default: string | null;
    }>(
      db,
      `SELECT table_name, column_name, column_default FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (table_name, column_name) IN (('templates', 'applies_to'), ('places', 'layout'),
                                            ('places', 'cell'))
        ORDER BY table_name, column_name`,
    );
    expect(cols).toEqual([
      { table_name: 'places', column_name: 'cell', column_default: null },
      { table_name: 'places', column_name: 'layout', column_default: null },
      { table_name: 'templates', column_name: 'applies_to', column_default: "'thing'::text" },
    ]);
    const [grant] = await own<{ layout: boolean; cell: boolean; applies: boolean }>(
      db,
      `SELECT has_column_privilege('kept_app', 'public.places', 'layout', 'UPDATE') AS layout,
              has_column_privilege('kept_app', 'public.places', 'cell', 'UPDATE') AS cell,
              has_column_privilege('kept_app', 'public.templates', 'applies_to', 'UPDATE')
                AS applies`,
    );
    expect(grant).toEqual({ layout: true, cell: true, applies: false });
  });

  it('seeds furniture, cube, shelf and drawer as built-in place kinds', async () => {
    const kinds = await own<{ key: string; icon: string }>(
      db,
      `SELECT key, icon FROM public.place_kinds
        WHERE owner_account_id IS NULL AND key IN ('furniture', 'cube', 'shelf', 'drawer')
        ORDER BY key`,
    );
    expect(kinds).toEqual([
      { key: 'cube', icon: 'lucide:grid-2x2' },
      { key: 'drawer', icon: 'lucide:archive' },
      { key: 'furniture', icon: 'lucide:library-big' },
      { key: 'shelf', icon: 'lucide:rows-3' },
    ]);
  });
});

describe('creating furniture from a built-in template', () => {
  // catalogue: POST /api/v1/locations/:locationId/places/from-template
  it('makes a 4 × 4 cube shelf and its 16 cubes in one step, counted row by row', async () => {
    const living = await room('Living room');
    const res = await fromTemplate(louis, home, {
      template: { builtin: 'cube_4x4' },
      parentId: living,
      name: 'Cube shelf 01',
    });
    const out = made(res);
    expect(out.place).toMatchObject({
      name: 'Cube shelf 01',
      kindKey: 'furniture',
      parentId: living,
    });
    expect(out.compartments).toHaveLength(16);
    expect(out.compartments[0]).toMatchObject({ name: 'Cube 1', n: 1, row: 1, col: 1, code: null });
    expect(out.compartments[4]).toMatchObject({ name: 'Cube 5', n: 5, row: 2, col: 1 });
    expect(out.compartments[15]).toMatchObject({ name: 'Cube 16', n: 16, row: 4, col: 4 });

    const kids = await rows(out.place.id);
    expect(kids.map((k) => k.name)).toEqual(Array.from({ length: 16 }, (_, i) => `Cube ${i + 1}`));
    expect(new Set(kids.map((k) => k.kind_key))).toEqual(new Set(['cube']));
    expect(kids[5]?.cell).toEqual({ row: 2, col: 2 });
    // Shown in counting order: the furniture is in Custom order, each cube at its number.
    const [unit] = await own<{ child_order: string; layout: unknown }>(
      db,
      'SELECT child_order, layout FROM public.places WHERE id = $1',
      [out.place.id],
    );
    expect(unit).toEqual({
      child_order: 'custom',
      layout: {
        kind: 'grid',
        across: 4,
        up: 4,
        orientation: 'upright',
        compartmentName: 'Cube {n}',
        codePattern: null,
      },
    });
    const contents = ok(
      await call(t, `/api/v1/places/${out.place.id}/contents`, { as: louis }),
    ) as unknown as { places: { name: string }[] };
    expect(contents.places.map((p) => p.name).slice(0, 3)).toEqual(['Cube 1', 'Cube 2', 'Cube 3']);

    // One event, on the furniture, undoable: the request's one Undo.
    const ids = auditIds(res);
    expect(ids).toHaveLength(1);
    const events = await eventsOf(db, home.id, out.place.id);
    expect(events.map((e) => e.action)).toEqual(['place.create']);
    expect(events[0]?.id).toBe(ids[0]);
    expect(events[0]?.actor_id).toBe(louis.userId);
    expect(events[0]?.diff.template?.after).toBe('cube_4x4');
    expect(events[0]?.diff.compartments?.after).toEqual(out.compartments.map((c) => c.id));
  });

  it('builds a 2 × 4 as it stands: upright 4 rows of 2, on its side 2 rows of 4', async () => {
    const upright = made(
      await fromTemplate(louis, home, { template: { builtin: 'cube_2x4' }, name: 'Upright' }),
    );
    expect(upright.compartments.map((c) => `${c.n}:${c.row},${c.col}`)).toEqual([
      '1:1,1',
      '2:1,2',
      '3:2,1',
      '4:2,2',
      '5:3,1',
      '6:3,2',
      '7:4,1',
      '8:4,2',
    ]);
    const side = made(
      await fromTemplate(louis, home, {
        template: { builtin: 'cube_2x4' },
        name: 'On its side',
        orientation: 'side',
      }),
    );
    expect(side.compartments.map((c) => `${c.n}:${c.row},${c.col}`)).toEqual([
      '1:1,1',
      '2:1,2',
      '3:1,3',
      '4:1,4',
      '5:2,1',
      '6:2,2',
      '7:2,3',
      '8:2,4',
    ]);
    const [unit] = await own<{ layout: unknown }>(
      db,
      'SELECT layout FROM public.places WHERE id = $1',
      [side.place.id],
    );
    expect(unit?.layout).toMatchObject({ kind: 'grid', across: 2, up: 4, orientation: 'side' });
  });

  it('makes a bookcase with the levels asked for, named as the web sends them', async () => {
    const out = made(
      await fromTemplate(louis, home, {
        template: { builtin: 'bookcase' },
        name: 'Bookcase',
        count: 5,
        compartmentName: 'Regal {n}',
      }),
    );
    expect(out.compartments.map((c) => c.name)).toEqual([
      'Regal 1',
      'Regal 2',
      'Regal 3',
      'Regal 4',
      'Regal 5',
    ]);
    expect((await rows(out.place.id)).every((k) => k.kind_key === 'shelf')).toBe(true);
    const chest = made(
      await fromTemplate(louis, home, { template: { builtin: 'chest' }, name: 'Chest' }),
    );
    expect(chest.compartments).toHaveLength(9);
    expect(chest.compartments[8]).toMatchObject({ name: 'Drawer 9', row: 9, col: 1 });
  });

  it('refuses a side for what only stands upright, a count for a grid, and a bad name pattern', async () => {
    const side = await fromTemplate(louis, home, {
      template: { builtin: 'bookcase' },
      name: 'Bookcase',
      orientation: 'side',
    });
    expect(side.statusCode, side.body).toBe(400);
    const square = await fromTemplate(louis, home, {
      template: { builtin: 'cube_2x2' },
      name: 'Square',
      orientation: 'side',
    });
    expect(square.statusCode).toBe(400);
    const count = await fromTemplate(louis, home, {
      template: { builtin: 'cube_2x2' },
      name: 'Square',
      count: 3,
    });
    expect(count.statusCode).toBe(400);
    const tooMany = await fromTemplate(louis, home, {
      template: { builtin: 'chest' },
      name: 'Chest',
      count: 41,
    });
    expect(tooMany.statusCode).toBe(400);
    const name = await fromTemplate(louis, home, {
      template: { builtin: 'chest' },
      name: 'Chest',
      compartmentName: 'Drawer {x}',
    });
    expect(name.statusCode).toBe(400);
    const unknown = await fromTemplate(louis, home, {
      template: { builtin: 'wardrobe' },
      name: 'W',
    });
    expect(unknown.statusCode).toBe(400);
  });
});

describe('codes derived from the parent', () => {
  it('gives the furniture its code and each cube {parent}-F{col:02}{row:02}', async () => {
    const out = made(
      await fromTemplate(louis, home, {
        template: { builtin: 'cube_4x4' },
        name: 'Cube shelf KX01',
        code: 'kx01',
        codePattern: '{parent}-F{col:02}{row:02}',
      }),
    );
    expect(await codesOf(out.place.id)).toEqual(['KX01']);
    expect(out.compartments[0]?.code).toBe('KX01-F0101');
    expect(out.compartments[2]?.code).toBe('KX01-F0301'); // column 3, row 1
    expect(out.compartments[15]?.code).toBe('KX01-F0404');
    expect(await codesOf(out.compartments[2]?.id as string)).toEqual(['KX01-F0301']);
    // The code resolves like any own code (scan, search, the jump box).
    const found = ok(
      await call(t, `/api/v1/places/${out.compartments[2]?.id}/codes`, { as: louis }),
    ) as unknown as { codes: { code: string }[] };
    expect(found.codes.map((c) => c.code)).toEqual(['KX01-F0301']);
  });

  it('checks every code against the location’s rule and names the one that breaks it', async () => {
    await setRule(garage, {
      pattern: 'KX\\d{2}(-F0[1-2]\\d{2})?',
      message: 'Codes are KX, two digits, then -F and four.',
      example: 'KX01-F0101',
    });
    const res = await fromTemplate(ibrahim, garage, {
      template: { builtin: 'cube_4x4' },
      name: 'Cube shelf',
      code: 'KX02',
      codePattern: '{parent}-F{col:02}{row:02}',
    });
    expect(res.statusCode, res.body).toBe(400);
    const body = res.json() as { hint: string; failed: { code: string; reason: string } };
    expect(body.failed).toMatchObject({ code: 'KX02-F0301', reason: 'rule' });
    expect(body.hint).toContain('KX02-F0301');
    expect((res.json() as { rule: { message: string } }).rule.message).toBe(
      'Codes are KX, two digits, then -F and four.',
    );
    // Nothing was made.
    const left = await own(
      db,
      `SELECT 1 FROM public.places WHERE location_id = $1 AND name = 'Cube shelf'`,
      [garage.id],
    );
    expect(left).toHaveLength(0);
    // The furniture's own code is checked too.
    const parent = await fromTemplate(ibrahim, garage, {
      template: { builtin: 'cube_1x4' },
      name: 'Cube shelf',
      code: 'BOOK',
    });
    expect(parent.statusCode).toBe(400);
    expect((parent.json() as { failed: { code: string } }).failed.code).toBe('BOOK');
    // A 2 × 2 fits the rule.
    made(
      await fromTemplate(ibrahim, garage, {
        template: { builtin: 'cube_2x2' },
        name: 'Small cube shelf',
        code: 'KX03',
        codePattern: '{parent}-F{col:02}{row:02}',
      }),
    );
    await setRule(garage, null);
  });

  it('refuses a code already on something else here, naming it, and makes nothing', async () => {
    const drill = await createThing(t, louis, home, { name: 'Drill' });
    ok(
      await call(t, `/api/v1/things/${drill.id}/codes`, {
        as: louis,
        body: { code: 'KX09-F0201' },
      }),
      201,
    );
    const res = await fromTemplate(louis, home, {
      template: { builtin: 'cube_2x2' },
      name: 'Taken',
      code: 'KX09',
      codePattern: '{parent}-F{col:02}{row:02}',
    });
    expect(res.statusCode, res.body).toBe(409);
    expect((res.json() as { failed: { code: string; reason: string } }).failed).toEqual({
      code: 'KX09-F0201',
      reason: 'taken',
    });
    expect(await own(db, `SELECT 1 FROM public.places WHERE name = 'Taken'`)).toHaveLength(0);
    expect(await own(db, `SELECT 1 FROM public.legacy_codes WHERE code = 'KX09'`)).toHaveLength(0);
  });

  it('needs the furniture’s code when the pattern uses {parent}, and a pattern that tells cells apart', async () => {
    const noParent = await fromTemplate(louis, home, {
      template: { builtin: 'cube_2x2' },
      name: 'No code',
      codePattern: '{parent}-{n}',
    });
    expect(noParent.statusCode).toBe(400);
    const same = await fromTemplate(louis, home, {
      template: { builtin: 'cube_2x2' },
      name: 'Same codes',
      code: 'SAME',
      codePattern: '{parent}-{row}',
    });
    expect(same.statusCode).toBe(400);
    // Without {parent}, no furniture code is needed.
    const plain = made(
      await fromTemplate(louis, home, {
        template: { builtin: 'chest' },
        name: 'Chest',
        count: 2,
        codePattern: 'CH-{n:02}',
      }),
    );
    expect(plain.compartments.map((c) => c.code)).toEqual(['CH-01', 'CH-02']);
    expect(await codesOf(plain.place.id)).toEqual([]);
  });
});

describe('one Undo', () => {
  it('puts the furniture and its compartments in the trash and frees their codes', async () => {
    const res = await fromTemplate(louis, home, {
      template: { builtin: 'cube_2x2' },
      name: 'Undo me',
      code: 'UN01',
      codePattern: '{parent}-{n}',
    });
    const out = made(res);
    const [eventId] = auditIds(res);
    ok(await undo(louis, eventId as string));
    const [unit] = await own<{ deleted_at: Date | null; trash_batch_id: string | null }>(
      db,
      'SELECT deleted_at, trash_batch_id FROM public.places WHERE id = $1',
      [out.place.id],
    );
    expect(unit?.deleted_at).not.toBeNull();
    const kids = await rows(out.place.id);
    expect(kids.every((k) => k.deleted_at !== null)).toBe(true);
    const batches = await own<{ trash_batch_id: string }>(
      db,
      'SELECT DISTINCT trash_batch_id FROM public.places WHERE id = $1 OR parent_id = $1',
      [out.place.id],
    );
    expect(batches).toEqual([{ trash_batch_id: unit?.trash_batch_id }]);
    expect(await own(db, `SELECT 1 FROM public.legacy_codes WHERE code LIKE 'UN01%'`)).toHaveLength(
      0,
    );
    // The same codes can be used again.
    made(
      await fromTemplate(louis, home, {
        template: { builtin: 'cube_2x2' },
        name: 'Again',
        code: 'UN01',
        codePattern: '{parent}-{n}',
      }),
    );
  });

  it('refuses once something was put in a compartment, and changes nothing', async () => {
    const res = await fromTemplate(louis, home, {
      template: { builtin: 'cube_1x4' },
      name: 'In use',
    });
    const out = made(res);
    await createThing(t, louis, home, {
      name: 'Board game',
      placeId: out.compartments[1]?.id as string,
    });
    const refused = await undo(louis, auditIds(res)[0] as string);
    expect(refused.statusCode, refused.body).toBe(409);
    expect((await rows(out.place.id)).every((k) => k.deleted_at === null)).toBe(true);
  });

  it('refuses once a compartment was renamed since', async () => {
    const res = await fromTemplate(louis, home, {
      template: { builtin: 'cube_1x4' },
      name: 'Renamed',
    });
    const out = made(res);
    const cube = out.compartments[0] as Compartment;
    const view = ok(await call(t, `/api/v1/places/${cube.id}`, { as: louis }));
    ok(
      await call(t, `/api/v1/places/${cube.id}`, {
        as: louis,
        method: 'PATCH',
        headers: { 'if-match': String(view.rowVersion) },
        body: { name: 'Games' },
      }),
    );
    const refused = await undo(louis, auditIds(res)[0] as string);
    expect(refused.statusCode).toBe(409);
  });
});

describe('who may', () => {
  it('lets members make furniture, never a viewer or another household', async () => {
    const viewer = await fromTemplate(talia, home, {
      template: { builtin: 'cube_2x2' },
      name: 'No',
    });
    expect(viewer.statusCode).toBe(403);
    const other = await fromTemplate(alfred, home, {
      template: { builtin: 'cube_2x2' },
      name: 'No',
    });
    expect(other.statusCode).toBe(404);
    // A parent in another location is as absent as one that doesn't exist.
    const theirs = await room('غرفة', family, alfred);
    const elsewhere = await fromTemplate(louis, home, {
      template: { builtin: 'cube_2x2' },
      name: 'No',
      parentId: theirs,
    });
    expect(elsewhere.statusCode).toBe(404);
  });
});

describe('the account’s own place templates', () => {
  // catalogue: POST /api/v1/accounts/:accountId/place-templates
  it('are made by admins, shared into locations, and used by members there', async () => {
    const tpl = await template();
    expect(tpl).toMatchObject({ name: 'Wide cube shelf' });
    const [event] = await own<{ action: string; diff: Record<string, { after?: unknown }> }>(
      db,
      `SELECT action, diff FROM public.audit_events
        WHERE entity_type = 'template' AND entity_id = $1`,
      [tpl.id],
    );
    expect(event?.action).toBe('template.create');
    expect(event?.diff.applies_to?.after).toBe('place');

    const usable = ok(
      await call(t, `/api/v1/place-templates?locationId=${home.id}`, { as: louis }),
    ) as unknown as { items: { id: string; layout: unknown; codePattern: string | null }[] };
    expect(usable.items.map((i) => i.id)).toEqual([tpl.id]);
    expect(usable.items[0]).toMatchObject({
      layout: { kind: 'grid', across: 3, up: 2 },
      codePattern: '{parent}-F{col:02}{row:02}',
    });
    // Not shared with the Garage, not a viewer's, never another household's.
    const inGarage = ok(
      await call(t, `/api/v1/place-templates?locationId=${garage.id}`, { as: ibrahim }),
    );
    expect(inGarage.items).toEqual([]);
    const viewer = ok(
      await call(t, `/api/v1/place-templates?locationId=${home.id}`, { as: talia }),
    );
    expect(viewer.items).toEqual([]);
    const other = ok(
      await call(t, `/api/v1/place-templates?locationId=${home.id}`, { as: alfred }),
    );
    expect(other.items).toEqual([]);
    // Thing templates and place templates stay apart.
    const things = ok(await call(t, `/api/v1/templates?locationId=${home.id}`, { as: louis }));
    expect((things.items as { id: string }[]).map((i) => i.id)).not.toContain(tpl.id);
    const patchAsThing = await call(t, `/api/v1/templates/${tpl.id}`, {
      as: ibrahim,
      method: 'PATCH',
      headers: { 'if-match': String(tpl.rowVersion) },
      body: { name: 'Changed' },
    });
    expect(patchAsThing.statusCode).toBe(404);

    // Louis makes one, its codes from the template's pattern, its names from the template's.
    const out = made(
      await fromTemplate(louis, home, {
        template: { id: tpl.id },
        name: 'Cube shelf KX05',
        code: 'KX05',
      }),
    );
    expect(out.compartments.map((c) => c.name)).toEqual([
      'Fach 1',
      'Fach 2',
      'Fach 3',
      'Fach 4',
      'Fach 5',
      'Fach 6',
    ]);
    expect(out.compartments.map((c) => c.code)).toEqual([
      'KX05-F0101',
      'KX05-F0201',
      'KX05-F0301',
      'KX05-F0102',
      'KX05-F0202',
      'KX05-F0302',
    ]);
    // A template not shared with the location is not found there.
    const garageUse = await fromTemplate(ibrahim, garage, { template: { id: tpl.id }, name: 'No' });
    expect(garageUse.statusCode).toBe(404);
  });

  it('are refused to members and to anyone outside the account, and checked', async () => {
    const member = await createTemplate(louis, home.accountId, {
      ...KALLAX,
      locationIds: [home.id],
    });
    expect(member.statusCode).toBe(403);
    const outsider = await createTemplate(alfred, home.accountId, {
      ...KALLAX,
      locationIds: [home.id],
    });
    expect(outsider.statusCode).toBe(404);
    const badLayout = await createTemplate(ibrahim, home.accountId, {
      ...KALLAX,
      layout: { kind: 'grid', across: 0, up: 2 },
      locationIds: [home.id],
    });
    expect(badLayout.statusCode).toBe(400);
    const badPattern = await createTemplate(ibrahim, home.accountId, {
      ...KALLAX,
      codePattern: '{parent}-{x}',
      locationIds: [home.id],
    });
    expect(badPattern.statusCode).toBe(400);
    const badKind = await createTemplate(ibrahim, home.accountId, {
      ...KALLAX,
      compartmentKindKey: 'nonesuch',
      locationIds: [home.id],
    });
    expect(badKind.statusCode).toBe(400);
    const otherLocation = await createTemplate(ibrahim, home.accountId, {
      ...KALLAX,
      locationIds: [family.id],
    });
    expect(otherLocation.statusCode).toBe(404);
  });

  // catalogue: PATCH /api/v1/place-templates/:id
  it('are changed by admins of every location they are shared with', async () => {
    const tpl = await template({ name: 'Both places' }, [home, garage]);
    const asBruce = await call(t, `/api/v1/place-templates/${tpl.id}`, {
      as: bruce,
      method: 'PATCH',
      headers: { 'if-match': String(tpl.rowVersion) },
      body: { name: 'Renamed' },
    });
    expect(asBruce.statusCode).toBe(403);
    const changed = ok(
      await call(t, `/api/v1/place-templates/${tpl.id}`, {
        as: ibrahim,
        method: 'PATCH',
        headers: { 'if-match': String(tpl.rowVersion) },
        body: {
          name: 'Renamed',
          layout: { kind: 'drawers', count: 4 },
          compartmentKindKey: 'drawer',
        },
      }),
    );
    expect(changed).toMatchObject({ name: 'Renamed', layout: { kind: 'drawers', count: 4 } });
    const [event] = await own<{
      action: string;
      diff: Record<string, { before?: unknown; after?: unknown }>;
    }>(
      db,
      `SELECT action, diff FROM public.audit_events
        WHERE entity_type = 'template' AND entity_id = $1 ORDER BY at DESC, id DESC LIMIT 1`,
      [tpl.id],
    );
    expect(event?.action).toBe('template.update');
    expect(event?.diff.name).toMatchObject({ before: 'Both places', after: 'Renamed' });
    const stale = await call(t, `/api/v1/place-templates/${tpl.id}`, {
      as: ibrahim,
      method: 'PATCH',
      headers: { 'if-match': String(tpl.rowVersion) },
      body: { name: 'Again' },
    });
    expect(stale.statusCode).toBe(412);
    const admin = ok(
      await call(t, `/api/v1/accounts/${home.accountId}/place-templates`, { as: ibrahim }),
    );
    expect((admin.items as { id: string }[]).map((i) => i.id)).toContain(tpl.id);
    const bruceList = ok(
      await call(t, `/api/v1/accounts/${home.accountId}/place-templates`, { as: bruce }),
    );
    expect((bruceList.items as { id: string }[]).map((i) => i.id)).not.toContain(tpl.id);
  });

  // catalogue: DELETE /api/v1/place-templates/:id
  it('are deleted by those admins; furniture made from one stays', async () => {
    const tpl = await template({ name: 'Short lived' });
    const out = made(
      await fromTemplate(louis, home, { template: { id: tpl.id }, name: 'Stays', code: 'KX66' }),
    );
    const asLouis = await call(t, `/api/v1/place-templates/${tpl.id}`, {
      as: louis,
      method: 'DELETE',
    });
    expect(asLouis.statusCode).toBe(403);
    const gone = await call(t, `/api/v1/place-templates/${tpl.id}`, {
      as: ibrahim,
      method: 'DELETE',
    });
    expect(gone.statusCode).toBe(204);
    const [event] = await own<{ action: string }>(
      db,
      `SELECT action FROM public.audit_events
        WHERE entity_type = 'template' AND entity_id = $1 ORDER BY at DESC LIMIT 1`,
      [tpl.id],
    );
    expect(event?.action).toBe('template.delete');
    expect(await rows(out.place.id)).toHaveLength(6);
    // A thing template's id is not a place template.
    const thingTpl = ok(
      await call(t, `/api/v1/accounts/${home.accountId}/templates`, {
        as: ibrahim,
        body: { name: 'Cable', payload: {}, locationIds: [home.id] },
      }),
      201,
    );
    const asPlace = await fromTemplate(louis, home, { template: { id: thingTpl.id }, name: 'No' });
    expect(asPlace.statusCode).toBe(404);
    const delAsPlace = await call(t, `/api/v1/place-templates/${thingTpl.id}`, {
      as: ibrahim,
      method: 'DELETE',
    });
    expect(delAsPlace.statusCode).toBe(404);
  });
});

describe('Label everything here', () => {
  it('labels the furniture and every compartment at once, in counting order', async () => {
    const out = made(
      await fromTemplate(louis, home, { template: { builtin: 'cube_4x4' }, name: 'Label me' }),
    );
    const res = await call(t, '/api/v1/labels/batches', {
      as: louis,
      body: {
        id: newId(),
        locationId: home.id,
        kind: 'places',
        unprinted: { placeId: out.place.id },
        stock: 'a4_24_70x37',
      },
    });
    const batch = ok(res, 201) as unknown as { batch: { labels: { name?: string }[] } };
    expect(batch.batch.labels).toHaveLength(17);
    expect(batch.batch.labels.map((l) => l.name).slice(1, 4)).toEqual([
      'Cube 1',
      'Cube 2',
      'Cube 3',
    ]);
    expect(batch.batch.labels.map((l) => l.name).at(-1)).toBe('Cube 16');
  });
});
