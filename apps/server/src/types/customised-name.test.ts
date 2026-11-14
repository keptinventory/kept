import { type Envelope, envelopeSchema, isToolError, TOOL_DEFS, type ToolName } from '@kept/mcp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import { call, type Person, peopleApp, person } from '../../test/people.js';
import { builtinType, createLocation, createThing, type Loc, ok, own } from '../../test/things.js';
import { withScope } from '../db/scope.js';
import { thingRows } from '../map/view.js';
import { gather } from '../reports/gather.js';
import { runTool } from '../tools/context.js';
import type { ToolContext } from '../tools/types.js';

// #546: a customised built-in keeps its name. "Customise" copies the built-in into the account
// (kept.customise_type) with no name of its own, pointing at the built-in through
// `copied_from_id`, so it still reads in each person's language. Every reader names the copy
// through that pointer: the thing page, the tools, search, lists, the CSV, reports, the map, the
// phone's snapshot and share links. A copy renamed by hand shows its own name.
//
// Ibrahim owns Home (complete). Its router is a Network device; he customises Network device.

let db: TestDb;
let t: TestApp;
let ibrahim: Person;
let home: Loc;
let builtin: string;
let copy: string;
let router: string;

type TypeRef = { id: string; name: string | null; builtinKey: string | null } | null;

// biome-ignore lint/suspicious/noExplicitAny: the envelope was validated against its zod schema
type Answer = Record<string, any>;

let seq = 0;
async function tool(name: ToolName, args: Record<string, unknown>): Promise<Answer> {
  seq += 1;
  const ctx: ToolContext = {
    deps: {
      pools: db.pools,
      jobs: null,
      files: null,
      providerResolved: async () => true,
      baseUrl: 'https://kept.example',
    },
    principal: { userId: ibrahim.userId, mfa: false, scope: 'write' },
    locale: 'de',
    requestId: `customised-name-${seq}`,
    via: 'mcp',
  };
  const env = (await runTool(ctx, name, args)) as Envelope<Answer>;
  expect(envelopeSchema(TOOL_DEFS[name].output).safeParse(env).success).toBe(true);
  if (isToolError(env)) throw new Error(`${name}: ${env.error} (${env.hint})`);
  return env.data;
}

const typeOfThing = async (id: string) =>
  (ok(await call(t, `/api/v1/things/${id}`, { as: ibrahim })) as unknown as { type: TypeRef }).type;

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  t = await peopleApp(db);
  ibrahim = await person(t, db, 'ibrahim');
  home = await createLocation(t, db, ibrahim, 'complete', 'Home');
  builtin = await builtinType(db, 'network_device');
  router = (await createThing(t, ibrahim, home, { name: 'Hall router', typeId: builtin })).id;
  const res = await call(t, `/api/v1/types/${builtin}/customise`, {
    as: ibrahim,
    body: { accountId: home.accountId },
  });
  expect(res.statusCode, res.body).toBe(200);
  copy = (res.json() as { typeId: string }).typeId;
});

afterAll(async () => {
  await t?.app.close();
});

describe('a customised built-in type keeps its name (#546)', () => {
  it('customising moves the thing onto a copy that still answers to the built-in', async () => {
    expect(copy).not.toBe(builtin);
    const [row] = await own<{ type_id: string }>(
      db,
      'SELECT type_id FROM public.things WHERE id = $1',
      [router],
    );
    expect(row?.type_id).toBe(copy);
    const detail = ok(await call(t, `/api/v1/types/${copy}`, { as: ibrahim }));
    expect(detail).toMatchObject({
      builtinKey: 'network_device',
      name: null,
      copiedFromId: builtin,
    });
  });

  it('the thing page names the copy by the built-in, so it translates', async () => {
    expect(await typeOfThing(router)).toEqual({
      id: copy,
      icon: 'lucide:router',
      name: null,
      builtinKey: 'network_device',
    });
  });

  it('get_thing says the type in English, as for the built-in', async () => {
    const d = await tool('get_thing', { thing_id: router });
    expect(d.thing.untrusted.type).toBe('Network device');
    expect(d.thing.type_id).toBe(copy);
  });

  it('search finds the thing by its type name and names the type', async () => {
    for (const q of ['network', 'جهاز شبكة']) {
      const res = ok(
        await call(
          t,
          `/api/v1/search?q=${encodeURIComponent(q)}&kind=things&locationId=${home.id}`,
          {
            as: ibrahim,
          },
        ),
      ) as unknown as { things: { items: { id: string; type: TypeRef }[] } };
      const hit = res.things.items.find((i) => i.id === router);
      expect(hit, q).toBeDefined();
      expect(hit?.type).toMatchObject({ id: copy, builtinKey: 'network_device' });
    }
  });

  it('the place’s contents, the things list and the CSV name the type', async () => {
    const contents = ok(
      await call(t, `/api/v1/places/${home.unplacedId}/contents?group=type`, { as: ibrahim }),
    ) as unknown as { things: { items: { id: string; type: TypeRef }[] } };
    expect(contents.things.items.find((i) => i.id === router)?.type).toMatchObject({
      builtinKey: 'network_device',
    });
    const list = ok(
      await call(t, `/api/v1/things?locationId=${home.id}&group=type`, { as: ibrahim }),
    ) as unknown as { items: { id: string; type: TypeRef }[] };
    expect(list.items.find((i) => i.id === router)?.type).toMatchObject({
      builtinKey: 'network_device',
    });
    const csv = await call(t, `/api/v1/things.csv?locationId=${home.id}`, { as: ibrahim });
    expect(csv.statusCode, csv.body).toBe(200);
    const line = csv.body.split('\r\n').find((l) => l.includes('Hall router'));
    expect(line).toContain('Network device');
  });

  it('a report names the type in the report’s language, in its rows and its filter', async () => {
    const scope = { userId: ibrahim.userId, mfa: false };
    const got = await withScope(db.pools.app, scope, (tx, client) =>
      gather(tx, client, scope, {
        locationIds: [home.id],
        scope: { locationId: home.id },
        options: {
          filters: {
            placeIds: [],
            typeIds: [copy],
            tagIds: [],
            thingIds: [],
            includeEnded: false,
            includeTrashed: false,
          },
          include: { photos: false, qr: false, money: false },
          locale: 'de',
          digits: 'western',
        },
      }),
    );
    expect(got.things.find((x) => x.id === router)?.typeName).toBe('Netzwerkgerät');
    expect(got.filterNames.types).toEqual(['Netzwerkgerät']);
  });

  it('the map, the graph, the phone’s snapshot and a share link carry the built-in key', async () => {
    // The map draws only things in rooms; its rows are read as the map reads them.
    const scope = { userId: ibrahim.userId, mfa: false };
    const mapRows = await withScope(db.pools.app, scope, (_tx, client) =>
      thingRows(client, home.id),
    );
    expect(mapRows.find((x) => x.id === router)?.type_key).toBe('network_device');
    const graph = ok(
      await call(t, `/api/v1/locations/${home.id}/graph`, { as: ibrahim }),
    ) as unknown as {
      things: { id: string; typeKey: string | null }[];
    };
    expect(graph.things.find((x) => x.id === router)?.typeKey).toBe('network_device');
    const snap = ok(await call(t, '/api/v1/sync/snapshot', { as: ibrahim })) as unknown as {
      types: { items?: { id: string; builtinKey: string | null; name: string }[] };
    };
    expect(snap.types.items?.find((x) => x.id === copy)).toMatchObject({
      builtinKey: 'network_device',
      name: 'network_device',
    });
    const [shared] = await own<{ doc: { type: TypeRef } }>(
      db,
      'SELECT kept.share_thing_json(t) AS doc FROM public.things t WHERE t.id = $1',
      [router],
    );
    expect(shared?.doc.type).toMatchObject({ name: null, builtinKey: 'network_device' });
  });

  it('a copy renamed by hand shows its own name everywhere', async () => {
    const before = ok(await call(t, `/api/v1/types/${copy}`, { as: ibrahim }));
    const res = await call(t, `/api/v1/types/${copy}`, {
      as: ibrahim,
      method: 'PATCH',
      headers: { 'if-match': String(before.rowVersion) },
      body: { name: 'Mesh node' },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(await typeOfThing(router)).toMatchObject({ name: 'Mesh node' });
    const d = await tool('get_thing', { thing_id: router });
    expect(d.thing.untrusted.type).toBe('Mesh node');
  });
});
