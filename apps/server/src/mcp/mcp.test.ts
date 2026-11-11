import { OUTPUT_LIMIT_BYTES } from '@kept/mcp';
import { formatToken, newTokenParts, parseToken } from '@kept/shared';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import { call, join, type Person, peopleApp, person } from '../../test/people.js';
import { createLocation, createThing, type Json, type Loc, ok, own } from '../../test/things.js';
import { MCP_MAX_TOOL_INPUT_ELEMENTS } from './server.js';

// `/mcp` through the official client (@modelcontextprotocol/client), with its HTTP
// routed into the app (app.inject), pinned to 2026-07-28 and in its default (2025) mode. Ibrahim
// owns Home (every module, MCP on), Garage (essentials: no MCP) and Office (every module); Louis
// is a member of Home and Garage, Talia a viewer of Home.

let db: TestDb;
let t: TestApp;
let ibrahim: Person;
let louis: Person;
let talia: Person;
let home: Loc;
let garage: Loc;
let office: Loc;
const clients: Client[] = [];

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  // Token creation is https only.
  t = await peopleApp(db, { publicUrl: 'https://kept.example' });
  ibrahim = await person(t, db, 'ibrahim');
  louis = await person(t, db, 'louis');
  talia = await person(t, db, 'talia');
  home = await createLocation(t, db, ibrahim, 'complete');
  garage = await createLocation(t, db, ibrahim, 'essentials', 'Garage');
  await join(db, home.id, louis.userId, 'member');
  await join(db, garage.id, louis.userId, 'member');
  await join(db, home.id, talia.userId, 'viewer');
  office = await createLocation(t, db, ibrahim, 'complete', 'Office');
  await createThing(t, ibrahim, home, { name: 'HDMI cable' });
  await createThing(t, ibrahim, office, { name: 'HDMI adapter' });
});

afterAll(async () => {
  for (const c of clients) await c.close().catch(() => {});
});

/** fetch() into the app: what a client on the network would send, through app.inject. */
function injectFetch(): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => {
      headers[k] = v;
    });
    headers.host = url.host;
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text();
    const res = await t.app.inject({
      method: req.method as 'POST',
      url: `${url.pathname}${url.search}`,
      headers,
      ...(body ? { payload: body } : {}),
    });
    const out = new Headers();
    for (const [k, v] of Object.entries(res.headers)) {
      if (v === undefined) continue;
      for (const one of Array.isArray(v) ? v : [String(v)]) out.append(k, one);
    }
    return new Response(
      res.statusCode === 202 || res.statusCode === 204 ? null : new Uint8Array(res.rawPayload),
      {
        status: res.statusCode,
        headers: out,
      },
    );
  }) as typeof fetch;
}

async function connect(secret: string, era: 'modern' | 'legacy' = 'modern'): Promise<Client> {
  const client = new Client(
    { name: 'kept-test', version: '0.0.0' },
    era === 'modern' ? { versionNegotiation: { mode: { pin: '2026-07-28' } } } : {},
  );
  const transport = new StreamableHTTPClientTransport(new URL(`${t.publicUrl}/mcp`), {
    fetch: injectFetch(),
    requestInit: { headers: { authorization: `Bearer ${secret}` } },
  });
  await client.connect(transport);
  clients.push(client);
  return client;
}

async function token(who: Person, scope: 'read' | 'write', locationIds: string[]) {
  const res = await call(t, '/api/v1/tokens', {
    as: who,
    body: { name: `${scope} token`, scope, locationIds },
  });
  return ok(res, 201) as unknown as { token: Json; secret: string };
}

/** A tool's text, parsed, with its size checked against the 8 KB contract. */
function answer(result: { content?: unknown; isError?: boolean }): Json {
  const part = (result.content as { type: string; text: string }[])[0];
  expect(part?.type).toBe('text');
  expect(Buffer.byteLength(part?.text ?? '')).toBeLessThanOrEqual(OUTPUT_LIMIT_BYTES);
  return JSON.parse(part?.text ?? '{}') as Json;
}

describe('/mcp', () => {
  it('lists read and write tools for a member’s write token, read tools for a viewer’s read token', async () => {
    const write = await connect((await token(louis, 'write', [home.id])).secret);
    const names = (await write.listTools()).tools.map((x) => x.name);
    expect(names).toEqual(expect.arrayContaining(['where_is', 'create_place', 'capabilities']));
    const read = await connect((await token(talia, 'read', [home.id])).secret);
    const readNames = (await read.listTools()).tools.map((x) => x.name);
    expect(readNames).toContain('where_is');
    expect(readNames).not.toContain('create_place');
    // Garage has MCP off: a token for Garage alone is offered nothing.
    const garageOnly = await connect((await token(louis, 'write', [garage.id])).secret);
    expect((await garageOnly.listTools()).tools).toEqual([]);
  });

  it('answers a read within the 8 KB contract, and a 2025-era client too', async () => {
    const { secret } = await token(louis, 'read', [home.id]);
    for (const era of ['modern', 'legacy'] as const) {
      const client = await connect(secret, era);
      const res = await client.callTool({ name: 'where_is', arguments: { query: 'HDMI' } });
      const body = answer(res);
      expect(res.isError, JSON.stringify(body)).toBeFalsy();
      expect(body.as_of).toBeTruthy();
      expect(JSON.stringify(body)).toContain('HDMI cable');
    }
  });

  it('writes as the token: audited as it, and listed in recent changes', async () => {
    const { token: made, secret } = await token(louis, 'write', [home.id]);
    const client = await connect(secret);
    const res = await client.callTool({
      name: 'create_place',
      arguments: { name: 'Box 3', kind: 'zone' },
    });
    const body = answer(res);
    expect(res.isError, JSON.stringify(body)).toBeFalsy();
    const events = await own<{ actor_type: string; actor_id: string; action: string }>(
      db,
      `SELECT actor_type, actor_id, action FROM public.audit_events
        WHERE actor_type = 'token' AND actor_id = $1`,
      [made.id],
    );
    expect(events).toEqual([{ actor_type: 'token', actor_id: made.id, action: 'place.create' }]);
    const changes = ok(await call(t, '/api/v1/connections/changes', { as: louis }));
    expect((changes.items as Json[]).map((c) => (c.token as Json).id)).toContain(made.id);
  });

  it('offers the moving tools: reads to a viewer’s read token, all to a member’s write token, which packs a box as the token', async () => {
    const moving = [
      'list_moves',
      'get_move',
      'start_move',
      'add_box',
      'pack_into_box',
      'set_box_status',
      'unpack_box',
    ];
    const read = await connect((await token(talia, 'read', [home.id])).secret);
    const readNames = (await read.listTools()).tools.map((x) => x.name);
    expect(moving.filter((n) => readNames.includes(n))).toEqual(['list_moves', 'get_move']);

    const { token: made, secret } = await token(louis, 'write', [home.id]);
    const client = await connect(secret);
    const names = (await client.listTools()).tools.map((x) => x.name);
    expect(moving.filter((n) => names.includes(n))).toEqual(moving);
    const call = async (name: string, args: Record<string, unknown>) => {
      const res = await client.callTool({ name, arguments: args });
      const body = answer(res);
      expect(res.isError, JSON.stringify(body)).toBeFalsy();
      return body.data as Json;
    };
    const started = (await call('start_move', { name: 'Spring clear-out' })).move as Json;
    const box = (await call('add_box', { move_id: started.id })).box as Json;
    const mug = await createThing(t, louis, home, { name: 'Travel mug' });
    const packed = await call('pack_into_box', {
      move_id: started.id,
      box_id: box.short_code,
      thing_ids: [mug.id],
    });
    expect((packed.box as Json).contents).toBe(1);
    const moves = await call('get_move', { move_id: started.id });
    expect(moves.missing).toEqual([1]);
    expect(JSON.stringify(moves)).toContain('Spring clear-out');
    const events = await own<{ action: string }>(
      db,
      `SELECT action FROM public.audit_events
        WHERE actor_type = 'token' AND actor_id = $1 ORDER BY id`,
      [made.id],
    );
    expect(events.map((e) => e.action)).toEqual(
      expect.arrayContaining(['move.create', 'move_box.create', 'thing.move']),
    );
  });

  it('offers change_lifecycle to a member’s write token, not a viewer’s read token; it ends a thing as the token, undoably', async () => {
    const read = await connect((await token(talia, 'read', [home.id])).secret);
    expect((await read.listTools()).tools.map((x) => x.name)).not.toContain('change_lifecycle');

    const { token: made, secret } = await token(louis, 'write', [home.id]);
    const client = await connect(secret);
    const listed = (await client.listTools()).tools.find((x) => x.name === 'change_lifecycle');
    expect(listed?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false });
    const tent = await createThing(t, louis, home, { name: 'Old tent' });
    const res = await client.callTool({
      name: 'change_lifecycle',
      arguments: { thing_id: tent.id, lifecycle: 'given_away', ended_to: 'Murdock' },
    });
    const body = answer(res);
    expect(res.isError, JSON.stringify(body)).toBeFalsy();
    expect(body.data).toMatchObject({ lifecycle: 'given_away', thing: { id: tent.id } });
    expect((body.data as Json).undo_until).toBeTruthy();
    const events = await own<{ action: string }>(
      db,
      `SELECT action FROM public.audit_events
        WHERE actor_type = 'token' AND actor_id = $1 AND entity_id = $2`,
      [made.id, tent.id],
    );
    expect(events).toEqual([{ action: 'thing.lifecycle' }]);
    const [live] = await own<{ lifecycle: string; deleted_at: Date | null }>(
      db,
      'SELECT lifecycle, deleted_at FROM public.things WHERE id = $1',
      [tent.id],
    );
    expect(live).toEqual({ lifecycle: 'given_away', deleted_at: null });
  });

  it('keeps change_lifecycle in the token’s locations, though its creator reaches more', async () => {
    // Ibrahim owns Home and Office (both with MCP on); his token holds Home only.
    const client = await connect((await token(ibrahim, 'write', [home.id])).secret);
    const chair = await createThing(t, ibrahim, office, { name: 'Desk chair' });
    const res = await client.callTool({
      name: 'change_lifecycle',
      arguments: { location_id: office.id, thing_id: chair.id, lifecycle: 'disposed' },
    });
    expect(res.isError).toBe(true);
    const bare = await client.callTool({
      name: 'change_lifecycle',
      arguments: { thing_id: chair.id, lifecycle: 'disposed' },
    });
    expect(bare.isError).toBe(true);
    expect(answer(bare)).toMatchObject({ error: 'not_found' });
    const [live] = await own<{ lifecycle: string }>(
      db,
      'SELECT lifecycle FROM public.things WHERE id = $1',
      [chair.id],
    );
    expect(live?.lifecycle).toBe('in_use');
  });

  it('refuses a token per call once its creator loses the role, in Kept’s words', async () => {
    const peter = await person(t, db, 'louis-two');
    const membership = await join(db, home.id, peter.userId, 'member');
    const { secret } = await token(peter, 'read', [home.id]);
    const client = await connect(secret);
    expect((await client.listTools()).tools.length).toBeGreaterThan(0);
    await own(db, 'DELETE FROM public.memberships WHERE id = $1', [membership]);
    // The token is revoked with the membership: the next request is a 401 with the challenge.
    const res = await t.app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        host: new URL(t.publicUrl).host,
        authorization: `Bearer ${secret}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
    });
    expect(res.statusCode).toBe(401);
    expect(String(res.headers['www-authenticate'])).toMatch(/^Bearer /);
  });

  it('refuses a foreign Host or Origin, no token, and GET or DELETE', async () => {
    const { secret } = await token(louis, 'read', [home.id]);
    const base = {
      method: 'POST' as const,
      url: '/mcp',
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
    };
    const headers = {
      host: new URL(t.publicUrl).host,
      authorization: `Bearer ${secret}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    };
    expect(
      (await t.app.inject({ ...base, headers: { ...headers, host: 'evil.example' } })).statusCode,
    ).toBe(403);
    expect(
      (
        await t.app.inject({
          ...base,
          headers: { ...headers, origin: 'https://evil.example' },
        })
      ).statusCode,
    ).toBe(403);
    // The whole origin is compared with the public URL's: scheme and port too, not the name.
    for (const origin of ['http://kept.example', 'https://kept.example:8443', 'null']) {
      const res = await t.app.inject({ ...base, headers: { ...headers, origin } });
      expect(res.statusCode, origin).toBe(403);
    }
    expect(
      (
        await t.app.inject({
          ...base,
          headers: { ...headers, origin: new URL(t.publicUrl).origin },
        })
      ).statusCode,
    ).toBe(200);
    const { authorization: _, ...anonymous } = headers;
    expect((await t.app.inject({ ...base, headers: anonymous })).statusCode).toBe(401);
    for (const method of ['GET', 'DELETE'] as const) {
      const res = await t.app.inject({
        method,
        url: '/mcp',
        headers: { host: headers.host, authorization: headers.authorization },
      });
      expect(res.statusCode, method).toBe(405);
    }
  });
  it('refuses a bearer Kept never issued: a made-up token, a real lookup with another secret, a token of another kind', async () => {
    const { secret } = await token(louis, 'read', [home.id]);
    const real = parseToken(secret);
    expect(real).not.toBeNull();
    const headers = {
      host: new URL(t.publicUrl).host,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    };
    const listWith = (bearer: string) =>
      t.app.inject({
        method: 'POST',
        url: '/mcp',
        headers: { ...headers, authorization: `Bearer ${bearer}` },
        payload: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
      });
    expect((await listWith(secret)).statusCode).toBe(200);
    const forged = {
      // Well formed, but no row here: what a token from another instance looks like.
      unknown: formatToken(newTokenParts()),
      // This token's row, with a secret its stored HMAC wasn't made from.
      wrongSecret: formatToken({ lookup: real?.lookup ?? '', secret: newTokenParts().secret }),
      // Not a personal token, and OAuth is off on this instance.
      jwt: 'eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJ4IiwiYXVkIjoiaHR0cHM6Ly9vdGhlci5leGFtcGxlL21jcCJ9.c2ln',
    };
    for (const [why, bearer] of Object.entries(forged)) {
      const res = await listWith(bearer);
      expect(res.statusCode, why).toBe(401);
      expect(String(res.headers['www-authenticate']), why).toMatch(/^Bearer /);
      expect(res.body, why).not.toContain('where_is');
    }
  });

  it('keeps overlapping clients apart: each sees its own tools and answers, though their request ids collide', async () => {
    // Both clients number their requests from 0, so every pair below shares a JSON-RPC id.
    const homeRead = await connect((await token(louis, 'read', [home.id])).secret);
    const officeWrite = await connect((await token(ibrahim, 'write', [office.id])).secret);
    const rounds = 6;
    const [homeTools, officeTools] = await Promise.all([
      Promise.all(Array.from({ length: rounds }, () => homeRead.listTools())),
      Promise.all(Array.from({ length: rounds }, () => officeWrite.listTools())),
    ]);
    for (const res of homeTools) expect(res.tools.map((x) => x.name)).not.toContain('create_place');
    for (const res of officeTools) expect(res.tools.map((x) => x.name)).toContain('create_place');
    const ask = (client: Client) =>
      Promise.all(
        Array.from({ length: rounds }, () =>
          client.callTool({ name: 'where_is', arguments: { query: 'HDMI' } }),
        ),
      );
    const [homeAnswers, officeAnswers] = await Promise.all([ask(homeRead), ask(officeWrite)]);
    for (const res of homeAnswers) {
      const text = JSON.stringify(answer(res));
      expect(text).toContain('HDMI cable');
      expect(text).not.toContain('HDMI adapter');
    }
    for (const res of officeAnswers) {
      const text = JSON.stringify(answer(res));
      expect(text).toContain('HDMI adapter');
      expect(text).not.toContain('HDMI cable');
    }
  });

  it('answers a tool call with more argument elements than any tool takes as a tool error, and keeps serving', async () => {
    const client = await connect((await token(louis, 'read', [home.id])).secret);
    const flood = await client.callTool({
      name: 'where_is',
      arguments: { query: 'HDMI', padding: new Array(MCP_MAX_TOOL_INPUT_ELEMENTS + 1).fill(0) },
    });
    expect(flood.isError).toBe(true);
    expect(JSON.stringify(flood.content)).toContain(`maximum of ${MCP_MAX_TOOL_INPUT_ELEMENTS}`);
    expect(JSON.stringify(flood.content)).not.toContain('HDMI cable');
    const res = await client.callTool({ name: 'where_is', arguments: { query: 'HDMI' } });
    expect(res.isError).toBeFalsy();
    expect(JSON.stringify(answer(res))).toContain('HDMI cable');
  });
});

// A name Kept doesn't have yet becomes a vendor or person inline (D11). Over a token, the audit
// row of that create must name the token, as 0070's audit policy requires: a user actor while a
// token is the principal is refused by row security (a 500 before this was fixed).
describe('/mcp names a new shop or person over a token', () => {
  /** The account-level create rows the token made, by action. */
  const creates = (tokenId: string) =>
    own<{ action: string; entity_id: string }>(
      db,
      `SELECT action, entity_id FROM public.audit_events
        WHERE actor_type = 'token' AND actor_id = $1 AND location_id IS NULL ORDER BY id`,
      [tokenId],
    );

  async function writer() {
    const { token: made, secret } = await token(louis, 'write', [home.id]);
    const client = await connect(secret);
    const run = async (name: string, args: Record<string, unknown>) => {
      const res = await client.callTool({ name, arguments: args });
      const body = answer(res);
      expect(res.isError, JSON.stringify(body)).toBeFalsy();
      return body.data as Json;
    };
    return { id: made.id as string, run };
  }

  const vendorNamed = async (name: string) =>
    (await own<{ id: string }>(db, 'SELECT id FROM public.vendors WHERE name = $1', [name]))[0]?.id;
  const personNamed = async (name: string) =>
    (
      await own<{ id: string }>(db, 'SELECT id FROM public.people WHERE display_name = $1', [name])
    )[0]?.id;

  it('add_thing with a shop Kept has no vendor for makes the vendor, audited as the token', async () => {
    const w = await writer();
    await w.run('add_thing', {
      items: [
        {
          name: 'Kettle',
          purchase: { purchased_on: '2026-08-14', price: '900', currency: 'EGP', shop: 'Souq Bab' },
        },
      ],
    });
    const vendor = await vendorNamed('Souq Bab');
    expect(vendor).toBeDefined();
    expect(await creates(w.id)).toEqual([{ action: 'vendor.create', entity_id: vendor }]);
  });

  it('log_service with a new vendor makes it, audited as the token', async () => {
    const w = await writer();
    const boiler = await createThing(t, louis, home, { name: 'Boiler' });
    await w.run('log_service', {
      thing_id: boiler.id,
      serviced_on: '2026-08-20',
      vendor: 'Heliopolis Heating',
    });
    const vendor = await vendorNamed('Heliopolis Heating');
    expect(vendor).toBeDefined();
    expect(await creates(w.id)).toEqual([{ action: 'vendor.create', entity_id: vendor }]);
  });

  it('add_thing for someone Kept has no person for makes the person, audited as the token', async () => {
    const w = await writer();
    await w.run('add_thing', { items: [{ name: 'Scarf', belongs_to: 'Murdock' }] });
    const murdock = await personNamed('Murdock');
    expect(murdock).toBeDefined();
    expect(await creates(w.id)).toEqual([{ action: 'person.create', entity_id: murdock }]);
  });

  it('lend_thing to a new person makes the person, audited as the token', async () => {
    const w = await writer();
    const ladder = await createThing(t, louis, home, { name: 'Step ladder' });
    await w.run('lend_thing', { thing_id: ladder.id, person: 'Peter' });
    const peter = await personNamed('Peter');
    expect(peter).toBeDefined();
    expect(await creates(w.id)).toEqual([{ action: 'person.create', entity_id: peter }]);
  });
});
