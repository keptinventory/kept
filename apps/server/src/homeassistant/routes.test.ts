import { parseToken } from '@kept/shared';
import type { LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import { call, join, type Person, peopleApp, person } from '../../test/people.js';
import { createLocation, type Json, type Loc, ok, own } from '../../test/things.js';
import { HomeAssistantLinks } from './link.js';

// Linking the Kept integration from the Home Assistant app (#376). Kept is on plain http, as most
// app installs are: New token refuses there, the link doesn't, because its secret never reaches a
// browser. Ibrahim owns Home and Garage; Talia is a viewer of Home.

const LINK_SECRET = 'link-secret-for-tests-0123456789abcdefghijk';
const PREFIX = '/api/v1/home-assistant/link-requests';

const db: TestDb = await testDb();
let t: TestApp;
let off: TestApp;
let ibrahim: Person;
let talia: Person;
let home: Loc;
let garage: Loc;

beforeAll(async () => {
  await db.reset();
  t = await peopleApp(db, {
    publicUrl: 'http://homeassistant.local:8080',
    appMode: true,
    homeAssistantLinks: new HomeAssistantLinks(LINK_SECRET),
  });
  // A normal install: no link secret, so nothing here answers.
  off = await peopleApp(db, { publicUrl: 'http://kept.lan:8080' });
  ibrahim = await person(t, db, 'ibrahim');
  talia = await person(t, db, 'talia');
  home = await createLocation(t, db, ibrahim, 'complete');
  garage = await createLocation(t, db, ibrahim, 'essentials', 'Garage');
  await join(db, home.id, talia.userId, 'viewer');
});
afterAll(async () => {
  await off.app.close();
});

type Opened = { id: string; code: string; claimKey: string; expiresAt: string };

/** Home Assistant asks: no cookie, no Origin, the link secret from the discovery message. */
function ask(app: TestApp = t, linkSecret = LINK_SECRET): Promise<LightMyRequestResponse> {
  return app.app.inject({
    method: 'POST',
    url: PREFIX,
    payload: { linkSecret },
    remoteAddress: '172.30.32.1',
  });
}

async function opened(): Promise<Opened> {
  return ok(await ask(), 201) as unknown as Opened;
}

function claim(id: string, claimKey: string): Promise<LightMyRequestResponse> {
  return t.app.inject({
    method: 'POST',
    url: `${PREFIX}/${id}/claim`,
    payload: { claimKey },
    remoteAddress: '172.30.32.1',
  });
}

/** The person's own account-level token events (as kept_owner). */
function tokenAudit(who: Person) {
  return own<{ action: string; entity_id: string; diff: unknown }>(
    db,
    `SELECT e.action, e.entity_id, e.diff FROM public.audit_events e
      WHERE e.entity_type = 'api_token' AND e.actor_id = $1 ORDER BY e.at, e.id`,
    [who.userId],
  );
}

describe('linking the Kept integration from the Home Assistant app', () => {
  it('refuses a wrong link secret, and outside the app nothing answers', async () => {
    expect((await ask(t, `${LINK_SECRET}x`)).statusCode).toBe(403);
    expect((await ask(off)).statusCode).toBe(404);
    const listed = ok(await call(off, PREFIX, { as: ibrahim }));
    expect(listed).toEqual({ available: false, items: [] });
  });

  it('shows a request only to someone signed in, and never its claim key', async () => {
    const req = await opened();
    expect((await call(t, PREFIX)).statusCode).toBe(401);
    const listed = ok(await call(t, PREFIX, { as: talia })) as unknown as {
      available: boolean;
      items: Json[];
    };
    expect(listed.available).toBe(true);
    expect(listed.items).toContainEqual(expect.objectContaining({ id: req.id, code: req.code }));
    expect(JSON.stringify(listed)).not.toContain(req.claimKey);
  });

  // catalogue: POST /api/v1/home-assistant/link-requests/:id/approve
  it('approve: over plain http, makes a read token as the person, audited, the secret only to Home Assistant', async () => {
    const req = await opened();
    expect(ok(await claim(req.id, req.claimKey))).toEqual({ state: 'pending' });
    // New token still refuses over plain http.
    const newToken = await call(t, '/api/v1/tokens', {
      as: ibrahim,
      body: { name: 'Script', scope: 'read', locationIds: [home.id] },
    });
    expect(newToken.statusCode).toBe(403);

    const res = await call(t, `${PREFIX}/${req.id}/approve`, {
      as: ibrahim,
      body: { scope: 'read', locationIds: [home.id] },
    });
    const approved = ok(res, 201) as unknown as { token: Json & { id: string } };
    expect(approved.token).toMatchObject({
      kind: 'personal',
      name: 'Home Assistant',
      scope: 'read',
      locations: [{ id: home.id, name: 'Home' }],
    });
    expect(res.body).not.toMatch(/kpt_/);
    const events = await tokenAudit(ibrahim);
    expect(events.at(-1)).toMatchObject({ action: 'token.create', entity_id: approved.token.id });

    // A stranger with the id but not the claim key learns nothing.
    expect((await claim(req.id, 'not-the-key')).statusCode).toBe(404);
    const got = ok(await claim(req.id, req.claimKey)) as unknown as {
      state: string;
      token: string;
    };
    expect(got.state).toBe('approved');
    expect(parseToken(got.token)).not.toBeNull();
    expect(JSON.stringify(events)).not.toContain(got.token.slice(4));
    // Once.
    expect((await claim(req.id, req.claimKey)).statusCode).toBe(404);

    // The token reads Home for Home Assistant, over the internal network, and nothing else.
    const summary = await t.app.inject({
      method: 'GET',
      url: '/api/v1/summary',
      headers: { authorization: `Bearer ${got.token}` },
      remoteAddress: '172.30.32.1',
    });
    const body = ok(summary) as unknown as { locations: { id: string }[] };
    expect(body.locations.map((l) => l.id)).toEqual([home.id]);
    // And it can't make or list tokens, or approve another link.
    const asToken = await t.app.inject({
      method: 'GET',
      url: PREFIX,
      headers: { authorization: `Bearer ${got.token}` },
    });
    expect(asToken.statusCode).toBe(403);
  });

  it('a viewer’s approval only reads, as New token’s does', async () => {
    const req = await opened();
    const res = await call(t, `${PREFIX}/${req.id}/approve`, {
      as: talia,
      body: { scope: 'write', locationIds: [home.id] },
    });
    expect(res.statusCode).toBe(403);
    // The request still waits for someone.
    const listed = ok(await call(t, PREFIX, { as: talia })) as unknown as {
      items: { id: string }[];
    };
    expect(listed.items.map((i) => i.id)).toContain(req.id);
  });

  it('approves only a request still waiting', async () => {
    const res = await call(t, `${PREFIX}/0193a0c0-0000-7000-8000-000000000000/approve`, {
      as: ibrahim,
      body: { scope: 'read', locationIds: [home.id] },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ code: 'not_found' });
  });

  it('a write approval across two locations asks first (D179), as New token does', async () => {
    const req = await opened();
    const first = await call(t, `${PREFIX}/${req.id}/approve`, {
      as: ibrahim,
      body: { scope: 'write', locationIds: [home.id, garage.id] },
    });
    expect(ok(first)).toEqual({ warning: 'cross_location_write' });
    const second = await call(t, `${PREFIX}/${req.id}/approve`, {
      as: ibrahim,
      body: { scope: 'write', locationIds: [home.id, garage.id], confirmCrossLocation: true },
    });
    expect(ok(second, 201)).toMatchObject({ token: { scope: 'write' } });
    const got = ok(await claim(req.id, req.claimKey)) as unknown as { state: string };
    expect(got.state).toBe('approved');
  });

  it('declined: Home Assistant is told once, and no token is made', async () => {
    const before = (await tokenAudit(ibrahim)).length;
    const req = await opened();
    const res = await call(t, `${PREFIX}/${req.id}/decline`, { as: ibrahim, method: 'POST' });
    expect(res.statusCode).toBe(204);
    expect(ok(await claim(req.id, req.claimKey))).toEqual({ state: 'declined' });
    expect((await claim(req.id, req.claimKey)).statusCode).toBe(404);
    expect((await tokenAudit(ibrahim)).length).toBe(before);
    // Signed in only.
    const other = await opened();
    expect((await call(t, `${PREFIX}/${other.id}/decline`, { method: 'POST' })).statusCode).toBe(
      401,
    );
  });
});
