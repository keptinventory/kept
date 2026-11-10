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
import { createLocation, createThing, type Loc, ok, own } from '../../test/things.js';
import { runTool, toolsFor } from './context.js';
import type { ToolContext, ToolVia } from './types.js';

// change_lifecycle: a thing's lifecycle through MCP, as the thing page's Change lifecycle sheet and
// its Archive action set it (POST /api/v1/things/:id/lifecycle). Sold, given away, lost, put
// away: the record and its history stay, nothing goes to the Trash, and the change is undoable for
// 7 days like any lifecycle change. Ibrahim owns Home (Complete: MCP and Money on) and Shed
// (Essentials with MCP turned on: no Money); Louis is a member of both, Talia a viewer of Home.

let db: TestDb;
let t: TestApp;
let ibrahim: Person;
let louis: Person;
let talia: Person;
let home: Loc;
let shed: Loc;

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
    requestId: `lifecycle-tool-${seq}`,
    via,
  };
};

async function tool(c: ToolContext, name: ToolName, args: Record<string, unknown>) {
  const env = (await runTool(c, name, args)) as Envelope<Answer>;
  const parsed = envelopeSchema(TOOL_DEFS[name].output).safeParse(env);
  expect(parsed.success, `${name}: ${JSON.stringify(parsed.error?.issues?.slice(0, 3))}`).toBe(
    true,
  );
  expect(byteLength(env)).toBeLessThanOrEqual(OUTPUT_LIMIT_BYTES);
  return env;
}

async function data(who: Person, name: ToolName, args: Record<string, unknown>) {
  const env = await tool(ctx(who), name, args);
  if (isToolError(env)) throw new Error(`${name}: ${env.error} (${env.hint})`);
  return env.data;
}

const row = (id: string) =>
  own<Record<string, unknown>>(
    db,
    `SELECT lifecycle, ended_on::text AS ended_on, ended_to, ended_notes,
            trim_scale(ended_price)::text AS ended_price, ended_currency, deleted_at
       FROM public.things WHERE id = $1`,
    [id],
  ).then((r) => r[0]);

const eventsOf = (id: string) =>
  own<{ id: string; action: string; actor_id: string; undoable_until: Date | null }>(
    db,
    `SELECT id, action, actor_id, undoable_until FROM public.audit_events
      WHERE entity_type = 'thing' AND entity_id = $1 ORDER BY at, id`,
    [id],
  );

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  t = await peopleApp(db);
  ibrahim = await person(t, db, 'ibrahim');
  louis = await person(t, db, 'louis');
  talia = await person(t, db, 'talia');
  home = await createLocation(t, db, ibrahim, 'complete');
  shed = await createLocation(t, db, ibrahim, 'essentials', 'Shed');
  await join(db, home.id, louis.userId, 'member');
  await join(db, shed.id, louis.userId, 'member');
  await join(db, home.id, talia.userId, 'viewer');
  // MCP on in Shed too, so the only thing missing there is Money.
  await own(
    db,
    `INSERT INTO public.location_modules (location_id, module, enabled, enabled_at)
     VALUES ($1, 'mcp', true, now())
     ON CONFLICT (location_id, module) DO UPDATE SET enabled = true, enabled_at = now()`,
    [shed.id],
  );
});

afterAll(async () => {
  await t?.app.close();
});

describe('change_lifecycle', () => {
  it('is offered to a member’s write principal over MCP, never to a reader, a viewer or the assistant', async () => {
    const names = (c: ToolContext) => toolsFor(c, [home.id]).then((ls) => ls[0]?.tools ?? []);
    expect(await names(ctx(louis))).toContain('change_lifecycle');
    expect(await names(ctx(louis, { scope: 'read' }))).not.toContain('change_lifecycle');
    expect(await names(ctx(talia))).not.toContain('change_lifecycle');
    expect(await names(ctx(louis, { via: 'assistant' }))).not.toContain('change_lifecycle');
    const viaAssistant = await runTool(ctx(louis, { via: 'assistant' }), 'change_lifecycle', {
      location_id: home.id,
      thing_id: 'K7D2QX',
      lifecycle: 'sold',
    });
    expect(viaAssistant).toMatchObject({ error: 'tool_unavailable' });
  });

  it('sells a thing with who to, when, for how much and a note: the record stays, out of the Trash, audited as the person, undoable', async () => {
    const bike = await createThing(t, ibrahim, home, { name: 'Bike' });
    const d = await data(louis, 'change_lifecycle', {
      location_id: home.id,
      thing_id: bike.id,
      lifecycle: 'sold',
      ended_on: '2026-10-01',
      ended_to: 'Murdock',
      ended_notes: 'Collected in person',
      ended_price: { amount: '120.50', currency: 'EGP' },
    });
    expect(d.lifecycle).toBe('sold');
    expect(d.thing).toMatchObject({ id: bike.id, untrusted: { name: 'Bike' } });
    expect(d.undo_until).not.toBeNull();
    expect(await row(bike.id)).toEqual({
      lifecycle: 'sold',
      ended_on: '2026-10-01',
      ended_to: 'Murdock',
      ended_notes: 'Collected in person',
      ended_price: '120.5',
      ended_currency: 'EGP',
      deleted_at: null,
    });
    const events = await eventsOf(bike.id);
    const last = events.at(-1);
    expect(last).toMatchObject({ id: d.audit_event_id, action: 'thing.lifecycle' });
    expect(last?.actor_id).toBe(louis.userId);
    expect(last?.undoable_until).not.toBeNull();
    // Still a thing anyone in Home can open, and in the list of ended things.
    const view = ok(await call(t, `/api/v1/things/${bike.id}`, { as: talia }));
    expect(view.lifecycle).toBe('sold');
    // Undo puts it back in use, as the app's Undo does.
    ok(await call(t, `/api/v1/audit/${d.audit_event_id}/undo`, { as: louis, body: {} }));
    expect(await row(bike.id)).toMatchObject({ lifecycle: 'in_use', ended_price: null });
  });

  it('takes a short ID, puts a thing away (archived) and brings it back with in_use', async () => {
    const lamp = await createThing(t, ibrahim, home, { name: 'Desk lamp' });
    const [code] = await own<{ code: string }>(
      db,
      `SELECT code FROM public.legacy_codes WHERE thing_id = $1 AND source = 'own'`,
      [lamp.id],
    );
    const ref = code?.code ?? lamp.id;
    const away = await data(louis, 'change_lifecycle', { thing_id: ref, lifecycle: 'archived' });
    expect(away.lifecycle).toBe('archived');
    expect(await row(lamp.id)).toMatchObject({ lifecycle: 'archived', ended_on: null });
    const back = await data(louis, 'change_lifecycle', { thing_id: ref, lifecycle: 'in_use' });
    expect(back.lifecycle).toBe('in_use');
    expect(await row(lamp.id)).toMatchObject({ lifecycle: 'in_use', deleted_at: null });
    expect((await eventsOf(lamp.id)).map((e) => e.action)).toEqual([
      'thing.create',
      'thing.lifecycle',
      'thing.lifecycle',
    ]);
  });

  it('refuses ended details with in_use: back in use clears them', async () => {
    const kettle = await createThing(t, ibrahim, home, { name: 'Kettle' });
    await data(louis, 'change_lifecycle', { thing_id: kettle.id, lifecycle: 'lost' });
    const env = await tool(ctx(louis), 'change_lifecycle', {
      thing_id: kettle.id,
      lifecycle: 'in_use',
      ended_notes: 'Found it behind the sofa',
    });
    expect(env).toMatchObject({ error: 'validation' });
    expect((env as { hint: string }).hint).toMatch(/ended_notes/);
    expect(await row(kettle.id)).toMatchObject({ lifecycle: 'lost' });
  });

  it('names its own field in a refusal: ended_price.currency, not the route’s body.endedCurrency', async () => {
    const tv = await createThing(t, ibrahim, home, { name: 'Television' });
    const env = await tool(ctx(louis), 'change_lifecycle', {
      location_id: home.id,
      thing_id: tv.id,
      lifecycle: 'sold',
      ended_price: { amount: '80', currency: 'ZZZ' },
    });
    expect(env).toMatchObject({ error: 'validation' });
    const hint = (env as { hint: string }).hint;
    expect(hint).toMatch(/ended_price\.currency/);
    expect(hint).not.toMatch(/endedCurrency|body\./);
    expect(await row(tv.id)).toMatchObject({ lifecycle: 'in_use' });
  });

  it('replaces the ended details it is sent: one left out is cleared, as the route does', async () => {
    const bench = await createThing(t, ibrahim, home, { name: 'Bench' });
    await data(louis, 'change_lifecycle', {
      location_id: home.id,
      thing_id: bench.id,
      lifecycle: 'given_away',
      ended_on: '2026-09-01',
      ended_to: 'Murdock',
      ended_notes: 'Picked up',
    });
    await data(louis, 'change_lifecycle', {
      location_id: home.id,
      thing_id: bench.id,
      lifecycle: 'given_away',
      ended_on: '2026-09-02',
    });
    expect(await row(bench.id)).toMatchObject({
      lifecycle: 'given_away',
      ended_on: '2026-09-02',
      ended_to: null,
      ended_notes: null,
    });
    expect(TOOL_DEFS.change_lifecycle.description).toMatch(/left out is cleared/);
  });

  it('refuses a viewer and a read principal, and writes nothing', async () => {
    const drill = await createThing(t, ibrahim, home, { name: 'Drill' });
    const viewer = await runTool(ctx(talia), 'change_lifecycle', {
      thing_id: drill.id,
      lifecycle: 'given_away',
    });
    expect(viewer).toMatchObject({ error: expect.stringMatching(/forbidden|tool_unavailable/) });
    const reader = await runTool(ctx(louis, { scope: 'read' }), 'change_lifecycle', {
      thing_id: drill.id,
      lifecycle: 'given_away',
    });
    expect(reader).toMatchObject({ error: 'token_scope' });
    expect(await row(drill.id)).toMatchObject({ lifecycle: 'in_use' });
  });

  it('refuses a price where Money is off, as the route does, and ends the thing without one', async () => {
    const mower = await createThing(t, ibrahim, shed, { name: 'Mower' });
    const env = await tool(ctx(louis), 'change_lifecycle', {
      location_id: shed.id,
      thing_id: mower.id,
      lifecycle: 'sold',
      ended_price: { amount: '40', currency: 'EGP' },
    });
    expect(isToolError(env)).toBe(true);
    expect(await row(mower.id)).toMatchObject({ lifecycle: 'in_use' });
    const d = await data(louis, 'change_lifecycle', {
      location_id: shed.id,
      thing_id: mower.id,
      lifecycle: 'sold',
      ended_to: 'Next door',
    });
    expect(d.lifecycle).toBe('sold');
  });

  it('answers a thing in a location the principal cannot reach as one that does not exist', async () => {
    const alfred = await person(t, db, 'alfred');
    const theirs = await createLocation(t, db, alfred, 'complete', 'بيت العائلة');
    const radio = await createThing(t, alfred, theirs, { name: 'Radio' });
    const env = await runTool(ctx(louis), 'change_lifecycle', {
      thing_id: radio.id,
      lifecycle: 'disposed',
    });
    expect(isToolError(env)).toBe(true);
    expect(await row(radio.id)).toMatchObject({ lifecycle: 'in_use' });
  });

  it('≡ POST /things/:id/lifecycle: the same row and the same audit action', async () => {
    const a = await createThing(t, ibrahim, home, { name: 'Sofa' });
    const b = await createThing(t, ibrahim, home, { name: 'Sofa' });
    ok(
      await call(t, `/api/v1/things/${a.id}/lifecycle`, {
        as: louis,
        headers: { 'if-match': String(a.rowVersion) },
        body: {
          lifecycle: 'given_away',
          endedOn: '2026-09-20',
          endedTo: 'Murdock',
          endedNotes: 'Too big for the flat',
        },
      }),
    );
    await data(louis, 'change_lifecycle', {
      thing_id: b.id,
      lifecycle: 'given_away',
      ended_on: '2026-09-20',
      ended_to: 'Murdock',
      ended_notes: 'Too big for the flat',
    });
    expect(await row(b.id)).toEqual(await row(a.id));
    const actions = async (id: string) => (await eventsOf(id)).map((e) => e.action);
    expect(await actions(b.id)).toEqual(await actions(a.id));
  });
});
