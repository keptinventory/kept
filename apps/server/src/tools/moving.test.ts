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

// Moving mode's tools (1.x, D251) through runTool(), at the MCP door: start a move, add numbered
// boxes, pack them, mark one in transit (and Undo), unpack it into its room in the other location
// with everything in it (and Undo), who may do what, and that the assistant is offered none.
//
// Ibrahim owns Flat (Complete: Moving mode on), House (where the move goes) and Garage
// (Household: Moving mode off). Louis is a member of Flat and House, Talia a viewer of Flat.

let db: TestDb;
let t: TestApp;
let ibrahim: Person;
let louis: Person;
let talia: Person;
let flat: Loc;
let house: Loc;
let garage: Loc;
let hallway: string;
let kitchen: string;

const MOVING: ToolName[] = [
  'list_moves',
  'get_move',
  'start_move',
  'add_box',
  'pack_into_box',
  'set_box_status',
  'unpack_box',
];

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  t = await peopleApp(db);
  ibrahim = await person(t, db, 'ibrahim');
  louis = await person(t, db, 'louis');
  talia = await person(t, db, 'talia');
  flat = await createLocation(t, db, ibrahim, 'complete', 'Flat');
  house = await createLocation(t, db, ibrahim, 'complete', 'House');
  garage = await createLocation(t, db, ibrahim, 'household', 'Garage');
  await join(db, flat.id, louis.userId, 'member');
  await join(db, house.id, louis.userId, 'member');
  await join(db, flat.id, talia.userId, 'viewer');
  hallway = await place(db, flat, 'Hallway');
  kitchen = await place(db, house, 'Kitchen');
  // MCP on in Garage too, so the only thing missing there is Moving mode.
  await own(
    db,
    `INSERT INTO public.location_modules (location_id, module, enabled, enabled_at)
     VALUES ($1, 'mcp', true, now())
     ON CONFLICT (location_id, module) DO UPDATE SET enabled = true, enabled_at = now()`,
    [garage.id],
  );
});

afterAll(async () => {
  await t?.app.close();
});

// biome-ignore lint/suspicious/noExplicitAny: the envelope was validated against its zod schema
type Answer = Record<string, any>;

let seq = 0;
const ctx = (
  who: Person,
  { scope = 'write', via = 'mcp' }: { scope?: 'read' | 'write'; via?: ToolVia } = {},
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
    requestId: `moving-tool-${seq}`,
    via,
  };
};

async function tool(
  who: Person,
  name: ToolName,
  args: Record<string, unknown>,
  opts: { scope?: 'read' | 'write'; via?: ToolVia } = {},
) {
  const env = (await runTool(ctx(who, opts), name, args)) as Envelope<Answer>;
  const parsed = envelopeSchema(TOOL_DEFS[name].output).safeParse(env);
  expect(parsed.success, `${name}: ${JSON.stringify(parsed.error?.issues?.slice(0, 3))}`).toBe(
    true,
  );
  expect(byteLength(env)).toBeLessThanOrEqual(OUTPUT_LIMIT_BYTES);
  return env;
}

async function data(who: Person, name: ToolName, args: Record<string, unknown>) {
  const env = await tool(who, name, args);
  if (isToolError(env)) throw new Error(`${name}: ${env.error} (${env.hint})`);
  return env.data;
}

const thingRow = async (id: string) =>
  (
    await own<{ location_id: string; place_id: string | null; container_id: string | null }>(
      db,
      'SELECT location_id, place_id, container_id FROM public.things WHERE id = $1',
      [id],
    )
  )[0];

const actions = async (entityId: string) =>
  (
    await own<{ action: string }>(
      db,
      'SELECT action FROM public.audit_events WHERE entity_id = $1 ORDER BY id',
      [entityId],
    )
  ).map((r) => r.action);

describe('a move over MCP', () => {
  let moveId: string;
  let box1: Answer;
  let lamp: { id: string };
  let toaster: { id: string };

  it('starts a move to another location, audited as move.create', async () => {
    const d = await data(louis, 'start_move', {
      location_id: flat.id,
      name: 'Flat to the house',
      to_location_id: house.id,
    });
    moveId = d.move.id;
    expect(d.move).toMatchObject({
      location_id: flat.id,
      to_location_id: house.id,
      status: 'active',
      counts: { packed: 0, in_transit: 0, unpacked: 0, total: 0 },
      url: `https://kept.example/moving/${moveId}`,
      untrusted: { name: 'Flat to the house', to_location: 'House' },
    });
    expect(d.undo_until).toBeNull();
    expect(await actions(moveId)).toEqual(['move.create']);
  });

  it('adds numbered boxes: a new one with its room, then a container that is there', async () => {
    const one = await data(louis, 'add_box', {
      move_id: moveId,
      prefix: 'Box',
      place_id: hallway,
      destination_place_id: kitchen,
    });
    box1 = one.box;
    expect(one.box).toMatchObject({
      number: 1,
      state: 'packed',
      visible: true,
      location_id: flat.id,
      contents: 0,
      destination: { place_id: kitchen, location_id: house.id, untrusted: { name: 'Kitchen' } },
      untrusted: { name: 'Box 1' },
    });
    expect(one.box.short_code).toMatch(/^[0-9A-Z]{6}$/);
    expect(one.box.url).toBe(`https://kept.example/moving/${moveId}/boxes/${one.box.box_id}`);
    const crate = await createThing(t, louis, flat, { name: 'Wine crate' });
    const two = await data(louis, 'add_box', { move_id: moveId, container_id: crate.id });
    expect(two.box).toMatchObject({
      number: 2,
      box_id: crate.id,
      untrusted: { name: 'Wine crate' },
    });
    expect(await actions(crate.id)).toEqual(['thing.create', 'move_box.create']);

    // A container's own number takes no new box's word or place; a room where the move isn't going.
    const mixed = await tool(louis, 'add_box', {
      move_id: moveId,
      container_id: crate.id,
      prefix: 'Box',
    });
    expect(mixed).toMatchObject({ error: 'validation' });
    const wrongRoom = await tool(louis, 'add_box', {
      move_id: moveId,
      destination_place_id: hallway,
    });
    expect(wrongRoom).toMatchObject({ error: 'validation' });
  });

  it('packs things into a box by its short ID: ordinary moves, each undoable', async () => {
    lamp = await createThing(t, louis, flat, { name: 'Desk lamp' });
    toaster = await createThing(t, louis, flat, { name: 'Toaster' });
    const d = await data(louis, 'pack_into_box', {
      move_id: moveId,
      box_id: box1.short_code,
      thing_ids: [lamp.id, toaster.id],
    });
    expect(d.box).toMatchObject({ number: 1, contents: 2 });
    expect(d.things.map((x: Answer) => x.untrusted.path)).toEqual([
      ['Flat', 'Hallway', 'Box 1'],
      ['Flat', 'Hallway', 'Box 1'],
    ]);
    expect(d.audit_event_ids).toHaveLength(2);
    expect(d.undo_until).not.toBeNull();
    expect(await actions(lamp.id)).toContain('thing.move');
    expect((await thingRow(lamp.id))?.container_id).toBe(box1.box_id);

    const itself = await tool(louis, 'pack_into_box', {
      move_id: moveId,
      box_id: box1.box_id,
      thing_ids: [box1.box_id],
    });
    expect(itself).toMatchObject({ error: 'validation' });
  });

  it('lists the moves with their counts, and a move’s boxes with the ones still missing', async () => {
    const list = await data(talia, 'list_moves', {});
    expect(list.items.map((m: Answer) => m.id)).toEqual([moveId]);
    expect(list.items[0].counts).toEqual({ packed: 2, in_transit: 0, unpacked: 0, total: 2 });
    const done = await data(louis, 'list_moves', { status: 'done' });
    expect(done.items).toEqual([]);

    const move = await data(talia, 'get_move', { move_id: moveId });
    expect(move.items.map((b: Answer) => [b.number, b.state])).toEqual([
      [1, 'packed'],
      [2, 'packed'],
    ]);
    expect(move.missing).toEqual([1, 2]);
    const page = (await tool(talia, 'get_move', { move_id: moveId, limit: 1 })) as Answer;
    expect(page.data.items.map((b: Answer) => b.number)).toEqual([1]);
    const next = await data(talia, 'get_move', { move_id: moveId, cursor: page.next_cursor });
    expect(next.items.map((b: Answer) => b.number)).toEqual([2]);
  });

  it('marks a box in transit, undoably, and says when nothing changed', async () => {
    const marked = await data(louis, 'set_box_status', {
      move_id: moveId,
      box_id: box1.box_id,
      state: 'in_transit',
    });
    expect(marked).toMatchObject({ changed: true, box: { state: 'in_transit' } });
    expect(marked.undo_until).not.toBeNull();
    const again = await data(louis, 'set_box_status', {
      move_id: moveId,
      box_id: box1.box_id,
      state: 'in_transit',
    });
    expect(again).toMatchObject({ changed: false, audit_event_id: marked.audit_event_id });

    ok(await call(t, `/api/v1/audit/${marked.audit_event_id}/undo`, { as: louis, body: {} }));
    const after = await data(louis, 'get_move', { move_id: moveId });
    expect(after.items[0].state).toBe('packed');
  });

  it('unpacks a box into its room in the other location, with everything in it; Undo puts it back', async () => {
    const d = await data(louis, 'unpack_box', { move_id: moveId, box_id: box1.box_id });
    expect(d.box).toMatchObject({ state: 'unpacked', location_id: house.id, contents: 2 });
    expect(await thingRow(box1.box_id)).toMatchObject({
      location_id: house.id,
      place_id: kitchen,
    });
    expect(await thingRow(lamp.id)).toMatchObject({
      location_id: house.id,
      container_id: box1.box_id,
    });
    expect(await actions(box1.box_id)).toContain('move_box.unpack');
    const missing = await data(louis, 'get_move', { move_id: moveId });
    expect(missing.missing).toEqual([2]);

    ok(await call(t, `/api/v1/audit/${d.audit_event_id}/undo`, { as: louis, body: {} }));
    expect(await thingRow(box1.box_id)).toMatchObject({ location_id: flat.id, place_id: hallway });
    expect((await thingRow(toaster.id))?.location_id).toBe(flat.id);

    // No room chosen and none given: it asks for one.
    const two = (await data(louis, 'get_move', { move_id: moveId })).items[1];
    const noRoom = await tool(louis, 'unpack_box', { move_id: moveId, box_id: two.box_id });
    expect(noRoom).toMatchObject({ error: 'validation' });
    const into = await data(louis, 'unpack_box', {
      move_id: moveId,
      box_id: two.box_id,
      place_id: kitchen,
    });
    expect(into.box).toMatchObject({ state: 'unpacked', location_id: house.id });
  });

  it('refuses to change a move that is done', async () => {
    await own(db, `UPDATE public.moves SET status = 'done', finished_at = now() WHERE id = $1`, [
      moveId,
    ]);
    const env = await tool(louis, 'add_box', { move_id: moveId });
    expect(env).toMatchObject({ error: 'conflict' });
    const done = await data(louis, 'list_moves', { status: 'done' });
    expect(done.items.map((m: Answer) => m.id)).toEqual([moveId]);
  });
});

describe('who may use the moving tools', () => {
  it('lets a viewer read but not change; a read connection writes nothing', async () => {
    const viewer = await tool(talia, 'start_move', { location_id: flat.id, name: 'Nope' });
    expect(viewer).toMatchObject({ error: 'forbidden' });
    const read = await tool(
      louis,
      'start_move',
      { location_id: flat.id, name: 'Nope' },
      {
        scope: 'read',
      },
    );
    expect(read).toMatchObject({ error: 'token_scope' });
    const reach = await toolsFor({
      deps: { pools: db.pools, jobs: null, files: null, providerResolved: async () => true },
      principal: { userId: louis.userId, mfa: false, scope: 'read' },
      via: 'mcp',
    });
    const inFlat = reach.find((r) => r.location.id === flat.id)?.tools ?? [];
    expect(MOVING.filter((n) => inFlat.includes(n))).toEqual(['list_moves', 'get_move']);
  });

  it('offers all seven to a member over MCP, none to the assistant, and none where Moving mode is off', async () => {
    const deps = { pools: db.pools, jobs: null, files: null, providerResolved: async () => true };
    const principal = { userId: louis.userId, mfa: false, scope: 'write' as const };
    const mcp = await toolsFor({ deps, principal, via: 'mcp' });
    expect(
      MOVING.filter((n) => mcp.find((r) => r.location.id === flat.id)?.tools.includes(n)),
    ).toEqual(MOVING);
    const assistant = await toolsFor({ deps, principal, via: 'assistant' });
    for (const r of assistant) for (const n of MOVING) expect(r.tools).not.toContain(n);
    const asked = await tool(louis, 'list_moves', { location_id: flat.id }, { via: 'assistant' });
    expect(asked).toMatchObject({ error: 'tool_unavailable' });

    const off = await tool(ibrahim, 'start_move', { location_id: garage.id, name: 'Nope' });
    expect(off).toMatchObject({ error: 'tool_unavailable' });
    const owner = await toolsFor({
      deps,
      principal: { userId: ibrahim.userId, mfa: false, scope: 'write' },
      via: 'mcp',
    });
    const inGarage = owner.find((r) => r.location.id === garage.id)?.tools ?? [];
    expect(inGarage).toContain('where_is');
    for (const n of MOVING) expect(inGarage).not.toContain(n);
  });

  it('answers a move in another location as not found', async () => {
    const other = await data(ibrahim, 'start_move', {
      location_id: house.id,
      name: 'House shuffle',
    });
    const env = await tool(louis, 'get_move', { location_id: flat.id, move_id: other.move.id });
    expect(env).toMatchObject({ error: 'not_found' });
  });
});
