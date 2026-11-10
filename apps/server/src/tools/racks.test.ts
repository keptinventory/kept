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
import { join, type Person, peopleApp, person } from '../../test/people.js';
import { createLocation, createThing, type Loc, own, place } from '../../test/things.js';
import { runTool } from './context.js';
import type { ToolContext } from './types.js';

// Racks over MCP and the assistant (#373, field parity #215): create_place makes a rack from a
// rack template with its units and numbering, as the app's Furniture with compartments does;
// update_thing gives gear its height and its unit, refused as the app refuses it; get_thing says
// where it sits. Ibrahim owns Home (Complete); Louis is a member.

let db: TestDb;
let t: TestApp;
let ibrahim: Person;
let louis: Person;
let home: Loc;

// biome-ignore lint/suspicious/noExplicitAny: the envelope was validated against its zod schema
type Answer = Record<string, any>;

let seq = 0;
const ctx = (who: Person): ToolContext => {
  seq += 1;
  return {
    deps: {
      pools: db.pools,
      jobs: null,
      files: null,
      providerResolved: async () => true,
      baseUrl: 'https://kept.example',
    },
    principal: { userId: who.userId, mfa: false, scope: 'write' },
    locale: 'en',
    requestId: `rack-tool-${seq}`,
    via: 'mcp',
  };
};

async function tool(who: Person, name: ToolName, args: Record<string, unknown>) {
  const env = (await runTool(ctx(who), name, args)) as Envelope<Answer>;
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

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  t = await peopleApp(db);
  ibrahim = await person(t, db, 'ibrahim');
  louis = await person(t, db, 'louis');
  home = await createLocation(t, db, ibrahim, 'complete', 'Home');
  await join(db, home.id, louis.userId, 'member');
});

afterAll(async () => {
  await t?.app.close();
});

describe('racks through the tools', () => {
  it('makes a rack, puts gear at a unit, refuses a taken one and says where it sits', async () => {
    const office = await place(db, home, 'Office');
    const made = await data(louis, 'create_place', {
      location_id: home.id,
      parent_id: office,
      name: 'Rack 1',
      template: 'rack_19_24',
      units: 12,
      numbering: 'top',
    });
    expect(made.compartments).toBe(0);
    const rack = made.place.id as string;

    const sw = (await createThing(t, ibrahim, home, { name: 'Switch', placeId: rack })) as {
      id: string;
    };
    const pc = (await createThing(t, ibrahim, home, { name: 'Mini PC', placeId: rack })) as {
      id: string;
    };
    // Both tools speak the rack's numbering (#499): U2 from the top is U11 from the bottom.
    await data(louis, 'update_thing', {
      location_id: home.id,
      thing_id: sw.id,
      fields: { rack_units: 1, rack_at: { u: 2, face: 'front', full: true } },
    });
    const taken = await tool(louis, 'update_thing', {
      location_id: home.id,
      thing_id: pc.id,
      fields: { rack_units: 2, rack_at: { u: 2, face: 'front', full: true } },
    });
    expect(isToolError(taken)).toBe(true);

    const got = await data(louis, 'get_thing', { location_id: home.id, thing_id: sw.id });
    expect(got.thing.rack).toEqual({
      place_id: rack,
      units: 1,
      u: 2,
      face: 'front',
      full: true,
    });
    const [stored] = await own<{ u: number }>(
      db,
      `SELECT (rack_at->>'u')::float8 AS u FROM public.things WHERE id = $1`,
      [sw.id],
    );
    expect(stored?.u).toBe(11);
  });

  it('takes back the unit get_thing gave, unchanged, on a rack numbered from the top (#499)', async () => {
    const office = await place(db, home, 'Server room');
    const made = await data(louis, 'create_place', {
      location_id: home.id,
      parent_id: office,
      name: 'Rack 2',
      template: 'rack_19_24',
      units: 12,
      numbering: 'top',
    });
    const rack = made.place.id as string;
    const nas = (await createThing(t, ibrahim, home, { name: 'NAS', placeId: rack })) as {
      id: string;
    };
    const shelf = (await createThing(t, ibrahim, home, { name: 'Shelf', placeId: rack })) as {
      id: string;
    };
    await data(louis, 'update_thing', {
      location_id: home.id,
      thing_id: nas.id,
      fields: { rack_units: 2, rack_at: { u: 5, face: 'front', full: true } },
    });
    // A half-unit start stays exact: 1U starting halfway down U8.
    await data(louis, 'update_thing', {
      location_id: home.id,
      thing_id: shelf.id,
      fields: { rack_units: 1, rack_at: { u: 8.5, face: 'rear', full: false } },
    });
    for (const [id, u] of [
      [nas.id, 5],
      [shelf.id, 8.5],
    ] as const) {
      const first = (await data(louis, 'get_thing', { location_id: home.id, thing_id: id })).thing
        .rack;
      expect(first.u).toBe(u);
      const { place_id: _, units: __, ...rackAt } = first;
      await data(louis, 'update_thing', {
        location_id: home.id,
        thing_id: id,
        fields: { rack_at: rackAt },
      });
      const again = (await data(louis, 'get_thing', { location_id: home.id, thing_id: id })).thing
        .rack;
      expect(again).toEqual(first);
    }
  });
});
