import { randomBytes } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import { call, join, type Person, peopleApp, person } from '../../test/people.js';
import { createLocation, type Loc, own } from '../../test/things.js';
import { CliError } from '../admin/cli.js';
import type { Mail } from '../mail/mailer.js';
import { createCliToken, type TokenCreateInput, tokenCreateLines } from './token.js';

// `kept admin token create`: a personal token made on the server, for a Kept on plain HTTP
// whose browser can't make one. It goes through the token service as the person (their RLS),
// works on /api/v1 and /mcp like one made in Settings → Connections, and is printed once.
// Ibrahim owns Home and Garage; Bruce is a member of Home and of Garage, Talia a viewer of
// Home; Louis belongs to Home and to Office, whose members differ.

const db: TestDb = await testDb();
const key = randomBytes(32);
let t: TestApp;
let ibrahim: Person;
let bruce: Person;
let talia: Person;
let louis: Person;
let home: Loc;
let garage: Loc;
let office: Loc;
const mail: Mail[] = [];

beforeAll(async () => {
  await db.reset();
  t = await peopleApp(db, { tokenKey: key });
  ibrahim = await person(t, db, 'ibrahim');
  bruce = await person(t, db, 'bruce');
  talia = await person(t, db, 'talia');
  louis = await person(t, db, 'louis');
  home = await createLocation(t, db, ibrahim, 'complete');
  garage = await createLocation(t, db, ibrahim, 'essentials', 'Garage');
  office = await createLocation(t, db, ibrahim, 'complete', 'Office');
  await join(db, home.id, bruce.userId, 'member');
  await join(db, garage.id, bruce.userId, 'member');
  await join(db, home.id, talia.userId, 'viewer');
  await join(db, home.id, louis.userId, 'member');
  await join(db, office.id, louis.userId, 'member');
});

const make = (input: Partial<TokenCreateInput> & { user: string }) =>
  createCliToken(
    {
      pools: db.pools,
      key,
      publicUrl: t.publicUrl,
      mailer: {
        send: async (m) => {
          mail.push(m);
        },
      },
    },
    { scope: 'read', name: 'Home Assistant', ...input },
  );

const bearer = (
  secret: string,
  url: string,
  init: { method?: 'GET' | 'POST'; body?: unknown } = {},
) =>
  t.app.inject({
    method: init.method ?? 'GET',
    url,
    headers: {
      authorization: `Bearer ${secret}`,
      ...(init.body
        ? { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }
        : {}),
    },
    ...(init.body ? { payload: JSON.stringify(init.body) } : {}),
  });

describe('kept admin token create', () => {
  it('makes a token that works on /api/v1 and /mcp, and tells the person', async () => {
    mail.length = 0;
    const made = await make({ user: ibrahim.email, name: 'Claude' });
    expect(made.secret).toMatch(/^kpt_/);
    expect(made.mcpUrl).toBe(`${t.publicUrl}/mcp`);

    // What Home Assistant reads first: the locations the token reaches.
    const locations = await bearer(made.secret, '/api/v1/locations');
    expect(locations.statusCode, locations.body).toBe(200);
    expect(locations.body).toContain(home.id);

    const mcp = await bearer(made.secret, '/mcp', {
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'kept-test', version: '0.0.0' },
        },
      },
    });
    expect(mcp.statusCode, mcp.body).toBe(200);
    const refused = await bearer('kpt_not_a_token', '/api/v1/locations');
    expect(refused.statusCode).toBe(401);

    // The person sees it in Settings → Connections, as their own.
    const listed = await call(t, '/api/v1/tokens', { as: ibrahim });
    const items = (listed.json() as { items: { id: string; name: string; scope: string }[] }).items;
    expect(items).toContainEqual(expect.objectContaining({ id: made.token.id, name: 'Claude' }));
    // Every location Ibrahim belongs to: Home, Garage, Office and his Personal one.
    expect(made.token.locations.map((l) => l.id).sort()).toEqual(
      [home.id, garage.id, office.id, ibrahim.personalLocationId].sort(),
    );
    expect(mail).toEqual([{ kind: 'admin-action', to: ibrahim.email, action: 'token-created' }]);
  });

  it('prints the token once, with the MCP address', async () => {
    const made = await make({ user: bruce.email });
    const lines = tokenCreateLines(made);
    const text = lines.join('\n');
    expect(text.split(made.secret)).toHaveLength(2);
    expect(text).toContain(`${t.publicUrl}/mcp`);
    expect(text).toContain('Home Assistant');
  });

  it('refuses an unknown or disabled account, and bad options', async () => {
    await expect(make({ user: 'nobody@example.com' })).rejects.toThrow(CliError);
    await expect(make({ user: bruce.email, scope: 'admin' })).rejects.toThrow(/--scope/);
    await expect(make({ user: bruce.email, name: '  ' })).rejects.toThrow(/--name/);
    await expect(make({ user: bruce.email, expires: '0' })).rejects.toThrow(/--expires/);
    await expect(make({ user: bruce.email, expires: 'soon' })).rejects.toThrow(/--expires/);
    const disabled = await person(t, db, 'peter');
    await own(db, 'UPDATE auth."user" SET banned = true WHERE id = $1', [disabled.userId]);
    await expect(make({ user: disabled.email })).rejects.toThrow(/disabled/);
  });

  it('expires after the days given', async () => {
    const before = Date.now();
    const made = await make({ user: bruce.email, expires: '30' });
    const at = Date.parse(made.token.expiresAt as string);
    expect(at - before).toBeGreaterThanOrEqual(30 * 86_400_000 - 5_000);
    expect(at - before).toBeLessThanOrEqual(30 * 86_400_000 + 5_000);
  });

  it('takes the locations named, by id or name', async () => {
    const byId = await make({ user: bruce.email, location: [garage.id] });
    expect(byId.token.locations.map((l) => l.id)).toEqual([garage.id]);
    const byName = await make({ user: bruce.email, location: ['garage'] });
    expect(byName.token.locations.map((l) => l.id)).toEqual([garage.id]);
    await expect(make({ user: bruce.email, location: ['Office'] })).rejects.toThrow(
      /doesn't belong to Office/,
    );
  });

  it('leaves out a location that asks for two-factor, and refuses one named', async () => {
    await own(db, 'UPDATE public.locations SET require_2fa = true WHERE id = $1', [garage.id]);
    try {
      const made = await make({ user: bruce.email });
      expect(made.token.locations.map((l) => l.id)).not.toContain(garage.id);
      expect(made.leftOut).toContainEqual({ name: 'Garage', why: 'two_factor' });
      await expect(make({ user: bruce.email, location: [garage.id] })).rejects.toThrow(
        /two-factor/,
      );
    } finally {
      await own(db, 'UPDATE public.locations SET require_2fa = false WHERE id = $1', [garage.id]);
    }
  });

  it("leaves a viewer's locations out of a write token, and refuses one named", async () => {
    const made = await make({ user: talia.email, scope: 'write' }).catch((e: Error) => e);
    // Talia views Home and owns only her Personal location: the token reaches that one.
    expect(made).not.toBeInstanceOf(Error);
    if (made instanceof Error) return;
    expect(made.token.locations.map((l) => l.id)).toEqual([talia.personalLocationId]);
    expect(made.leftOut).toContainEqual({ name: 'Home', why: 'viewer' });
    await expect(make({ user: talia.email, scope: 'write', location: [home.id] })).rejects.toThrow(
      /can only read/,
    );
    const read = await make({ user: talia.email, scope: 'read', location: [home.id] });
    expect(read.token.locations.map((l) => l.id)).toEqual([home.id]);
  });

  it('a write token across locations whose members differ needs --confirm-cross-location', async () => {
    await expect(
      make({ user: louis.email, scope: 'write', location: [home.id, office.id] }),
    ).rejects.toThrow(/--confirm-cross-location/);
    const made = await make({
      user: louis.email,
      scope: 'write',
      location: [home.id, office.id],
      confirmCrossLocation: true,
    });
    expect(made.token.locations.map((l) => l.id).sort()).toEqual([home.id, office.id].sort());
  });
});
