import {
  byteLength,
  type Envelope,
  envelopeSchema,
  isToolError,
  OUTPUT_LIMIT_BYTES,
  TOOL_DEFS,
  type ToolName,
} from '@kept/mcp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import { call, join, type Person, peopleApp, person } from '../../test/people.js';
import { createLocation, createThing, type Loc, ok, own, place } from '../../test/things.js';
import { runTool, toolsFor } from './context.js';
import type { ToolContext, ToolVia } from './types.js';

// The place tools (#313): update_place is the app's place form (Rename, Move, its fields, Order of
// the places here and Move up / Move down) and turn_into_boxes is "Turn places into boxes", each
// through its route's operation, so the same rules and the same Undo hold. Ibrahim owns Home
// (Complete: MCP and the assistant on) and Garage; Louis is a member of Home, Talia a viewer;
// Alfred owns بيت العائلة, which none of them can see.

let db: TestDb;
let t: TestApp;
let ibrahim: Person;
let louis: Person;
let talia: Person;
let alfred: Person;
let home: Loc;
let garage: Loc;
let family: Loc;

// biome-ignore lint/suspicious/noExplicitAny: the envelope was validated against its zod schema
type Answer = Record<string, any>;

let seq = 0;
const ctx = (
  who: Person,
  {
    scope = 'write',
    via = 'mcp',
    ifMatch,
  }: { scope?: 'read' | 'write'; via?: ToolVia; ifMatch?: number } = {},
): ToolContext => {
  seq += 1;
  return {
    deps: {
      pools: db.pools,
      jobs: null,
      files: null,
      providerResolved: async () => true,
      baseUrl: 'https://kept.example',
    },
    principal: { userId: who.userId, mfa: false, scope },
    locale: 'en',
    requestId: `place-tool-${seq}`,
    via,
    ...(ifMatch !== undefined ? { ifMatch } : {}),
  };
};

async function tool(who: Person | ToolContext, name: ToolName, args: Record<string, unknown>) {
  const env = (await runTool('deps' in who ? who : ctx(who), name, args)) as Envelope<Answer>;
  const parsed = envelopeSchema(TOOL_DEFS[name].output).safeParse(env);
  expect(parsed.success, `${name}: ${JSON.stringify(parsed.error?.issues?.slice(0, 3))}`).toBe(
    true,
  );
  expect(byteLength(env)).toBeLessThanOrEqual(OUTPUT_LIMIT_BYTES);
  return env;
}

async function data(who: Person | ToolContext, name: ToolName, args: Record<string, unknown>) {
  const env = await tool(who, name, args);
  if (isToolError(env)) throw new Error(`${name}: ${env.error} (${env.hint})`);
  return env.data;
}

async function refusal(who: Person | ToolContext, name: ToolName, args: Record<string, unknown>) {
  const env = await tool(who, name, args);
  if (!isToolError(env)) throw new Error(`${name} answered ${JSON.stringify(env.data)}`);
  return env.error;
}

type Row = {
  name: string;
  kind_key: string;
  parent_id: string | null;
  child_order: string;
  sort: number;
  row_version: number;
};
const row = async (id: string) =>
  (
    await own<Row>(
      db,
      'SELECT name, kind_key, parent_id, child_order, sort, row_version FROM public.places WHERE id = $1',
      [id],
    )
  )[0];

const events = (requestLike: string) =>
  own<{ id: string; action: string; entity_id: string; undoable_until: Date | null }>(
    db,
    `SELECT id, action, entity_id, undoable_until FROM public.audit_events
      WHERE request_id LIKE $1 ORDER BY id`,
    [requestLike],
  );

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  t = await peopleApp(db);
  ibrahim = await person(t, db, 'ibrahim');
  louis = await person(t, db, 'louis');
  talia = await person(t, db, 'talia');
  alfred = await person(t, db, 'alfred');
  home = await createLocation(t, db, ibrahim, 'complete', 'Home');
  garage = await createLocation(t, db, ibrahim, 'complete', 'Garage');
  family = await createLocation(t, db, alfred, 'complete', 'بيت العائلة');
  await join(db, home.id, louis.userId, 'member');
  await join(db, home.id, talia.userId, 'viewer');
});

afterAll(async () => {
  await t?.app.close();
});

describe('update_place', () => {
  it('renames a place and changes its kind, as the app’s Rename does: one undoable place.update', async () => {
    const study = await place(db, home, 'Study');
    const c = ctx(louis);
    const d = await data(c, 'update_place', {
      place_id: study,
      fields: { name: 'Office', kind: 'closet' },
    });
    expect(d.place).toMatchObject({ id: study, kind: 'closet', untrusted: { name: 'Office' } });
    expect(d.changed_fields).toEqual(['name', 'kind']);
    expect(await row(study)).toMatchObject({ name: 'Office', kind_key: 'closet' });
    const [event] = await events(c.requestId);
    expect(event).toMatchObject({ id: d.audit_event_id, action: 'place.update' });
    expect(d.undo_until).toBe(event?.undoable_until?.toISOString());
    // The app's Undo puts it back.
    ok(await call(t, `/api/v1/audit/${d.audit_event_id}/undo`, { as: louis, body: {} }));
    expect(await row(study)).toMatchObject({ name: 'Study', kind_key: 'room' });
  });

  it('moves a place into another, or to the top of the location (place.move, undoable)', async () => {
    const hall = await place(db, home, 'Hall');
    const cupboard = await place(db, home, 'Hall cupboard');
    const moved = await data(louis, 'update_place', {
      place_id: cupboard,
      fields: { parent_id: hall },
    });
    expect(moved.place.untrusted.path).toEqual(['Home', 'Hall', 'Hall cupboard']);
    expect((await row(cupboard))?.parent_id).toBe(hall);
    const [event] = await own<{ action: string }>(
      db,
      'SELECT action FROM public.audit_events WHERE id = $1',
      [moved.audit_event_id],
    );
    expect(event?.action).toBe('place.move');
    expect(moved.undo_until).not.toBeNull();
    // Never into itself or a place inside it, and never inside the Unplaced area.
    expect(
      await refusal(louis, 'update_place', { place_id: hall, fields: { parent_id: hall } }),
    ).toBe('conflict');
    expect(
      await refusal(louis, 'update_place', { place_id: hall, fields: { parent_id: cupboard } }),
    ).toBe('conflict');
    await data(louis, 'update_place', { place_id: cupboard, fields: { parent_id: null } });
    expect((await row(cupboard))?.parent_id).toBeNull();
    expect(
      await refusal(louis, 'update_place', {
        place_id: hall,
        fields: { parent_id: home.unplacedId },
      }),
    ).toBe('conflict');
  });

  it('sets Custom order, then Move up / Move down among the places beside it', async () => {
    const pantry = await place(db, home, 'Pantry');
    const a = await place(db, home, 'Shelf A', pantry);
    const b = await place(db, home, 'Shelf B', pantry);
    const c = await place(db, home, 'Shelf C', pantry);
    // Not in Custom order yet: the app's 409, said as it says it.
    expect(await refusal(louis, 'update_place', { place_id: c, move: 'up' })).toBe('conflict');
    const order = await data(louis, 'update_place', {
      place_id: pantry,
      fields: { child_order: 'custom' },
    });
    expect(order.changed_fields).toEqual(['child_order']);
    expect((await row(pantry))?.child_order).toBe('custom');
    const ctxUp = ctx(louis);
    const up = await data(ctxUp, 'update_place', { place_id: c, move: 'up' });
    expect(up.order).toEqual([a, c, b]);
    // The app's reorder: audited once on the parent, not undoable (the opposite move is the undo).
    const [event] = await events(ctxUp.requestId);
    expect(event).toMatchObject({ action: 'place.reorder', entity_id: pantry });
    expect(event?.undoable_until).toBeNull();
    expect(up).toMatchObject({ audit_event_id: event?.id, undo_until: null });
    expect((await data(louis, 'update_place', { place_id: c, move: 'down' })).order).toEqual([
      a,
      b,
      c,
    ]);
    // At the end there is no step to take: refused, nothing written.
    expect(await refusal(louis, 'update_place', { place_id: c, move: 'down' })).toBe('conflict');
    // The top of a location is always A to Z.
    expect(await refusal(louis, 'update_place', { place_id: pantry, move: 'up' })).toBe('conflict');
  });

  it('refuses a field its kind doesn’t have, and a kind there is none of', async () => {
    const attic = await place(db, home, 'Attic');
    expect(
      await refusal(louis, 'update_place', { place_id: attic, fields: { custom: { nope: 1 } } }),
    ).toBe('validation');
    expect(
      await refusal(louis, 'update_place', { place_id: attic, fields: { kind: 'spaceship' } }),
    ).toBe('validation');
    expect((await row(attic))?.kind_key).toBe('room');
  });

  it('a confirmed card on a place changed since is precondition_failed, nothing written', async () => {
    const loft = await place(db, home, 'Loft');
    const was = (await row(loft))?.row_version as number;
    await data(ibrahim, 'update_place', { place_id: loft, fields: { name: 'Loft (big)' } });
    expect(
      await refusal(ctx(louis, { via: 'assistant', ifMatch: was }), 'update_place', {
        place_id: loft,
        fields: { name: 'Loft (small)' },
      }),
    ).toBe('precondition_failed');
    expect((await row(loft))?.name).toBe('Loft (big)');
  });

  it('a viewer and a read-only connection are refused, and never offered it', async () => {
    const den = await place(db, home, 'Den');
    expect(await refusal(talia, 'update_place', { place_id: den, fields: { name: 'Snug' } })).toBe(
      'forbidden',
    );
    expect(
      await refusal(ctx(louis, { scope: 'read' }), 'update_place', {
        place_id: den,
        fields: { name: 'Snug' },
      }),
    ).toBe('token_scope');
    expect((await row(den))?.name).toBe('Den');
    const forTalia = (await toolsFor(ctx(talia), [home.id]))[0]?.tools ?? [];
    expect(forTalia).not.toContain('update_place');
    expect(forTalia).not.toContain('turn_into_boxes');
    for (const via of ['mcp', 'assistant'] as const) {
      const forLouis = (await toolsFor(ctx(louis, { via }), [home.id]))[0]?.tools ?? [];
      expect(forLouis).toContain('update_place');
      expect(forLouis).toContain('turn_into_boxes');
    }
  });

  it('a place in another location, or one the caller can’t see, is not found', async () => {
    const bench = await place(db, garage, 'Workbench');
    const majlis = await place(db, family, 'المجلس');
    // Louis isn't in Garage: the place isn't there for him.
    expect(
      await refusal(louis, 'update_place', { place_id: bench, fields: { name: 'Bench' } }),
    ).toBe('not_found');
    // Named with Home as the location, Garage's place is not found.
    expect(
      await refusal(ibrahim, 'update_place', {
        location_id: home.id,
        place_id: bench,
        fields: { name: 'Bench' },
      }),
    ).toBe('not_found');
    // Nor may a place go inside one of another location.
    const shelf = await place(db, home, 'Shelf by the door');
    expect(
      await refusal(ibrahim, 'update_place', { place_id: shelf, fields: { parent_id: bench } }),
    ).toBe('not_found');
    expect(
      await refusal(ibrahim, 'update_place', {
        location_id: home.id,
        place_id: majlis,
        fields: { name: 'x' },
      }),
    ).toBe('not_found');
    // Asked in a location the caller can't reach: unavailable, as every tool answers.
    expect(
      await refusal(ibrahim, 'update_place', {
        location_id: family.id,
        place_id: majlis,
        fields: { name: 'x' },
      }),
    ).toBe('tool_unavailable');
    expect((await row(bench))?.name).toBe('Workbench');
  });
});

describe('turn_into_boxes', () => {
  it('turns places into boxes as the app’s Turn places into boxes, one Undo for all', async () => {
    const closet = await place(db, home, 'Hall closet');
    const one = await place(db, home, 'Crate one', closet);
    const two = await place(db, home, 'Crate two', closet);
    const rack = await place(db, home, 'Rack', closet);
    await place(db, home, 'Rack top', rack);
    const kitchen = await place(db, home, 'Kitchen');
    const cable = await createThing(t, louis, home, { name: 'Extension lead', placeId: one });
    const c = ctx(louis);
    const d = await data(c, 'turn_into_boxes', { place_ids: [one, two, rack, kitchen] });
    expect((d.boxes as Answer[]).map((b) => b.id)).toEqual([one, two]);
    expect((d.boxes as Answer[])[0]).toMatchObject({
      untrusted: { name: 'Crate one', path: ['Home', 'Hall closet'] },
    });
    expect(
      (d.refused as Answer[]).map((r) => [r.place.id, r.reason, r.place.untrusted.name]),
    ).toEqual([
      [rack, 'has_places', 'Rack'],
      [kitchen, 'top_level', 'Kitchen'],
    ]);
    // The same id, now a thing, with what was in it inside it.
    const [box] = await own<{ id: string; place_id: string }>(
      db,
      'SELECT id, place_id FROM public.things WHERE id = $1',
      [one],
    );
    expect(box).toEqual({ id: one, place_id: closet });
    const [inside] = await own<{ container_id: string }>(
      db,
      'SELECT container_id FROM public.things WHERE id = $1',
      [cable.id],
    );
    expect(inside?.container_id).toBe(one);
    // The app's audit: one undoable place.convert_to_container per box.
    const written = await events(c.requestId);
    expect(written.map((e) => [e.action, e.entity_id])).toEqual([
      ['place.convert_to_container', one],
      ['place.convert_to_container', two],
    ]);
    expect(written.every((e) => e.undoable_until)).toBe(true);
    expect(d.audit_event_ids).toEqual(written.map((e) => e.id));
    expect(d.audit_event_id).toBe(written[0]?.id);
    // The app's one Undo, all or none: both are places again, the lead back in its place.
    ok(await call(t, '/api/v1/audit/undo', { as: louis, body: { eventIds: d.audit_event_ids } }));
    expect((await row(one))?.parent_id).toBe(closet);
    expect((await row(two))?.parent_id).toBe(closet);
    const [back] = await own<{ place_id: string }>(
      db,
      'SELECT place_id FROM public.things WHERE id = $1',
      [cable.id],
    );
    expect(back?.place_id).toBe(one);
  });

  it('places under different parents, in one call; nothing that can become a box is refused', async () => {
    const shed = await place(db, home, 'Shed');
    const loft = await place(db, home, 'Loft space');
    const tub = await place(db, home, 'Tub', shed);
    const bag = await place(db, home, 'Bag', loft);
    const d = await data(louis, 'turn_into_boxes', { place_ids: [tub, bag] });
    expect((d.boxes as Answer[]).map((b) => b.id)).toEqual([tub, bag]);
    expect(d.audit_event_ids).toHaveLength(2);
    expect(await refusal(louis, 'turn_into_boxes', { place_ids: [shed] })).toBe('conflict');
  });

  it('a viewer is refused; a place elsewhere is not found; nothing changes', async () => {
    const porch = await place(db, home, 'Porch');
    const crate = await place(db, home, 'Porch crate', porch);
    const bench = await place(db, garage, 'Garage shelf');
    const pegs = await place(db, garage, 'Pegs', bench);
    expect(await refusal(talia, 'turn_into_boxes', { place_ids: [crate] })).toBe('forbidden');
    expect(
      await refusal(ibrahim, 'turn_into_boxes', { location_id: home.id, place_ids: [crate, pegs] }),
    ).toBe('not_found');
    expect(await refusal(louis, 'turn_into_boxes', { place_ids: [pegs] })).toBe('not_found');
    expect(await row(crate)).toBeDefined();
    expect(await row(pegs)).toBeDefined();
  });
});
