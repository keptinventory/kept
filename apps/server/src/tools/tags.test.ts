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
import { createLocation, createThing, type Loc, own } from '../../test/things.js';
import { runTool, toolsFor } from './context.js';
import type { ToolContext, ToolVia } from './types.js';

// Tags through the tools (#209): get_thing's tags, list_tags, tag_things (by name, making the
// tags it adds), and search_things with several tags, any or all of them. Ibrahim owns Home
// (Complete: MCP on); Louis is a member there, Talia a viewer.

let db: TestDb;
let t: TestApp;
let ibrahim: Person;
let louis: Person;
let talia: Person;
let home: Loc;
let camping: string;
let beach: string;
let tent: string;
let towel: string;
let coolBox: string;

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
    requestId: `tag-tool-${seq}`,
    via,
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

const tagNames = async (thingId: string) =>
  (
    await own<{ name: string }>(
      db,
      `SELECT g.name FROM public.thing_tags x JOIN public.tags g ON g.id = x.tag_id
        WHERE x.thing_id = $1 ORDER BY lower(g.name)`,
      [thingId],
    )
  ).map((r) => r.name);

async function tag(name: string): Promise<string> {
  const [row] = await own<{ id: string }>(
    db,
    'INSERT INTO public.tags (owner_account_id, name) VALUES ($1, $2) RETURNING id',
    [home.accountId, name],
  );
  return row?.id as string;
}

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  t = await peopleApp(db);
  ibrahim = await person(t, db, 'ibrahim');
  louis = await person(t, db, 'louis');
  talia = await person(t, db, 'talia');
  home = await createLocation(t, db, ibrahim, 'complete', 'Home');
  await join(db, home.id, louis.userId, 'member');
  await join(db, home.id, talia.userId, 'viewer');
  camping = await tag('Camping');
  beach = await tag('Beach');
  tent = (await createThing(t, ibrahim, home, { name: 'Tent', tagIds: [camping] })).id;
  towel = (await createThing(t, ibrahim, home, { name: 'Towel', tagIds: [beach] })).id;
  coolBox = (await createThing(t, ibrahim, home, { name: 'Cool box', tagIds: [camping, beach] }))
    .id;
});

afterAll(async () => {
  await t?.app.close();
});

describe('reading tags', () => {
  it('get_thing names its tags, A to Z, as untrusted text', async () => {
    const d = await data(talia, 'get_thing', { thing_id: coolBox });
    expect(d.thing.tags).toEqual([
      { id: beach, colour: null, untrusted: { name: 'Beach' } },
      { id: camping, colour: null, untrusted: { name: 'Camping' } },
    ]);
  });

  it('list_tags lists the account’s tags with how many things have each', async () => {
    const d = await data(talia, 'list_tags', {});
    const byName = Object.fromEntries(
      (d.items as Answer[]).map((g) => [g.untrusted.name, g.things]),
    );
    expect(byName).toMatchObject({ Beach: 2, Camping: 2 });
    const found = await data(talia, 'list_tags', { query: 'camp' });
    expect((found.items as Answer[]).map((g) => g.untrusted.name)).toEqual(['Camping']);
  });

  it('search_things takes several tags, any or all of them', async () => {
    const any = await data(talia, 'search_things', {
      query: '',
      filters: { tags: ['camping', 'Beach'] },
    });
    expect((any.items as Answer[]).map((x) => x.id).sort()).toEqual([tent, towel, coolBox].sort());
    const all = await data(talia, 'search_things', {
      query: '',
      filters: { tags: ['camping', 'Beach'], tag_match: 'all' },
    });
    expect((all.items as Answer[]).map((x) => x.id)).toEqual([coolBox]);
    const none = await data(talia, 'search_things', {
      query: '',
      filters: { tags: ['camping', 'Nothing like it'], tag_match: 'all' },
    });
    expect(none.items).toEqual([]);
  });
});

describe('tag_things', () => {
  it('adds tags by name, making the new one; one undoable event a thing', async () => {
    const d = await data(louis, 'tag_things', {
      thing_ids: [tent, towel],
      add: ['camping', 'Summer'],
    });
    expect((d.changed as Answer[]).map((x) => x.id).sort()).toEqual([tent, towel].sort());
    expect((d.created_tags as Answer[]).map((g) => g.untrusted.name)).toEqual(['Summer']);
    expect(d.audit_event_ids).toHaveLength(2);
    expect(await tagNames(towel)).toEqual(['Beach', 'Camping', 'Summer']);
    expect(await tagNames(tent)).toEqual(['Camping', 'Summer']);
  });

  it('takes tags off by name, saying which names no tag has', async () => {
    const d = await data(louis, 'tag_things', {
      thing_ids: [towel],
      remove: ['summer', 'Winter'],
    });
    expect(d.not_found).toEqual([{ untrusted: { value: 'Winter' } }]);
    expect(await tagNames(towel)).toEqual(['Beach', 'Camping']);
  });

  it('is a write tool: a viewer is never offered it', async () => {
    const offered = await toolsFor(ctx(talia), [home.id]);
    const names = offered[0]?.tools ?? [];
    expect(names).toContain('list_tags');
    expect(names).not.toContain('tag_things');
    const forLouis = (await toolsFor(ctx(louis), [home.id]))[0]?.tools ?? [];
    expect(forLouis).toContain('tag_things');
  });

  it('the assistant may call them too (offered when a question is about tags)', async () => {
    const offered = await toolsFor(ctx(louis, { via: 'assistant' }), [home.id]);
    expect(offered[0]?.tools ?? []).toContain('tag_things');
    expect(offered[0]?.tools ?? []).toContain('list_tags');
  });
});

describe('the tags field of add_thing and update_thing', () => {
  it('makes a tag no tag has yet, for a member, and uses the one that has the name', async () => {
    const d = await data(louis, 'add_thing', {
      items: [{ name: 'Sleeping bag', tags: ['camping', 'Hiking'] }],
    });
    const id = (d.things as Answer[])[0]?.id as string;
    expect(await tagNames(id)).toEqual(['Camping', 'Hiking']);
    expect(d.not_set ?? []).toEqual([]);
    await data(louis, 'update_thing', {
      thing_id: id,
      fields: { tags: ['Hiking', 'Winter gear'] },
    });
    expect(await tagNames(id)).toEqual(['Hiking', 'Winter gear']);
  });
});
