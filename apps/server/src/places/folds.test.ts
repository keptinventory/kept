import { newId } from '@kept/shared';
import type { LightMyRequestResponse } from 'fastify';
import type pg from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import { call, join, type Person, peopleApp, person } from '../../test/people.js';
import { ownerTx } from '../../test/tenancy.js';

// The places outline's folds (#358) through the front door, as the web calls them
// (apps/web/src/api/inventory/{types,paths}.ts and components/places/use-place-folds.ts).
// Fixtures are seeded as kept_owner; every read and write is a signed-in person on kept_app.

let db: TestDb;
let t: TestApp;
let ola: Person;
let vic: Person;
let bob: Person;
let ann: Person;
let home: string;
let bobs: string;
let bedroom: string;
let underBed: string;
let wardrobe: string;
let bobsShed: string;

const own = <T extends pg.QueryResultRow>(text: string, values: unknown[] = []) =>
  ownerTx(db, async (c) => (await c.query<T>(text, values)).rows);

async function createLocation(as: Person, name: string): Promise<string> {
  const res = await call(t, '/api/v1/locations', {
    as,
    body: {
      name,
      kind: 'home',
      preset: 'complete',
      timezone: 'Africa/Cairo',
      currency: 'EGP',
      rooms: [],
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return (res.json() as { id: string }).id;
}

async function place(locationId: string, name: string, parentId: string | null = null) {
  const id = newId();
  await own(
    `INSERT INTO public.places (id, location_id, parent_id, name, kind_key)
     VALUES ($1, $2, $3, $4, 'room')`,
    [id, locationId, parentId, name],
  );
  return id;
}

const url = (locationId: string) => `/api/v1/locations/${locationId}/place-folds`;

async function folds(as: Person, locationId: string): Promise<string[]> {
  const res = await call(t, url(locationId), { as });
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as { placeIds: string[] }).placeIds;
}

type Delta = { fold?: string[]; open?: string[] };

const putFolds = (as: Person, locationId: string, delta: Delta) =>
  call(t, url(locationId), { as, method: 'PUT', body: { fold: [], open: [], ...delta } });

/** Opens everything `as` folded in `locationId`, as "Open all" does. */
const openAll = async (as: Person, locationId: string) =>
  putFolds(as, locationId, { open: await folds(as, locationId) });

async function makeToken(who: Person, scope: 'read' | 'write', locationIds: string[]) {
  const res = await call(t, '/api/v1/tokens', {
    as: who,
    body: { name: 'Home Assistant', scope, locationIds },
  });
  expect(res.statusCode, res.body).toBe(201);
  return (res.json() as { secret: string }).secret;
}

const bearer = (secret: string, path: string, body?: unknown): Promise<LightMyRequestResponse> =>
  call(t, path, {
    ...(body === undefined ? {} : { method: 'PUT', body }),
    headers: { authorization: `Bearer ${secret}` },
  });

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  t = await peopleApp(db, { publicUrl: 'https://kept.example' });
  ola = await person(t, db, 'ola');
  vic = await person(t, db, 'vic');
  bob = await person(t, db, 'bob');
  ann = await person(t, db, 'ann');
  home = await createLocation(ola, 'Home');
  await join(db, home, vic.userId, 'viewer');
  await join(db, home, ann.userId, 'member');
  bobs = await createLocation(bob, 'Bob home');
  bedroom = await place(home, 'Bedroom');
  underBed = await place(home, 'Under bed', bedroom);
  wardrobe = await place(home, 'Wardrobe', bedroom);
  bobsShed = await place(bobs, 'Shed');
});

describe('GET and PUT /api/v1/locations/:locationId/place-folds', () => {
  it('starts with nothing folded, and needs a session', async () => {
    expect(await folds(ola, home)).toEqual([]);
    expect((await call(t, url(home))).statusCode).toBe(401);
    expect((await putFolds({ ...ola, cookie: '' }, home, { fold: [bedroom] })).statusCode).toBe(
      401,
    );
  });

  // Not audited: the PUT is on test/route-catalogue.test.ts's allowlist.
  it('folds and opens only the places it names, keeping the rest, and writes no audit row', async () => {
    expect((await putFolds(ola, home, { fold: [underBed, bedroom] })).statusCode).toBe(204);
    expect((await folds(ola, home)).sort()).toEqual([bedroom, underBed].sort());
    // A device that never read the folds sends only its own change: the others stay.
    expect((await putFolds(ola, home, { fold: [wardrobe], open: [underBed] })).statusCode).toBe(
      204,
    );
    expect((await folds(ola, home)).sort()).toEqual([bedroom, wardrobe].sort());
    // Folding a folded place, or opening an open one, changes nothing.
    expect((await putFolds(ola, home, { fold: [bedroom], open: [underBed] })).statusCode).toBe(204);
    expect((await folds(ola, home)).sort()).toEqual([bedroom, wardrobe].sort());
    await openAll(ola, home);
    expect(await folds(ola, home)).toEqual([]);
    const audit = await own(
      `SELECT action FROM public.audit_events WHERE actor_id = $1 AND action LIKE 'place%'`,
      [ola.userId],
    );
    expect(audit).toEqual([]);
  });

  it('two changes sent at the same moment are both kept', async () => {
    const [a, b] = await Promise.all([
      putFolds(ola, home, { fold: [bedroom] }),
      putFolds(ola, home, { fold: [underBed] }),
    ]);
    expect([a?.statusCode, b?.statusCode]).toEqual([204, 204]);
    expect((await folds(ola, home)).sort()).toEqual([bedroom, underBed].sort());
    await openAll(ola, home);
  });

  it("is each person's own: a viewer folds too, and sees only their own folds", async () => {
    await putFolds(ola, home, { fold: [bedroom] });
    expect((await putFolds(vic, home, { fold: [underBed] })).statusCode).toBe(204);
    expect(await folds(vic, home)).toEqual([underBed]);
    expect(await folds(ola, home)).toEqual([bedroom]);
    await openAll(ola, home);
    await openAll(vic, home);
  });

  it("drops ids that aren't places in the location, and keeps the other location's folds", async () => {
    expect((await putFolds(bob, bobs, { fold: [bobsShed] })).statusCode).toBe(204);
    // Bob's shed sent with Home's places, and an id that is no place at all.
    expect(
      (await putFolds(ola, home, { fold: [bedroom, bobsShed, newId()], open: [bobsShed] }))
        .statusCode,
    ).toBe(400);
    expect((await putFolds(ola, home, { fold: [bedroom, bobsShed, newId()] })).statusCode).toBe(
      204,
    );
    expect((await putFolds(ola, home, { open: [bobsShed] })).statusCode).toBe(204);
    expect(await folds(ola, home)).toEqual([bedroom]);
    expect(await folds(bob, bobs)).toEqual([bobsShed]);
    await openAll(ola, home);
  });

  it("is a 404 in a location the caller isn't in, and a 400 for a body that isn't ids", async () => {
    expect((await call(t, url(bobs), { as: ola })).statusCode).toBe(404);
    expect((await putFolds(ola, bobs, { open: [bobsShed] })).statusCode).toBe(404);
    expect(await folds(bob, bobs)).toEqual([bobsShed]);
    const put = (body: unknown) => call(t, url(home), { as: ola, method: 'PUT', body });
    expect((await put({ fold: ['x'], open: [] })).statusCode).toBe(400);
    expect((await put({ fold: [], open: [], more: 1 })).statusCode).toBe(400);
    // The old whole-set body is refused, so a stale tab can't erase the others.
    expect((await put({ placeIds: [] })).statusCode).toBe(400);
    const many = Array.from({ length: 5001 }, () => newId());
    expect((await put({ fold: many, open: [] })).statusCode).toBe(400);
    expect((await put({ fold: [], open: many })).statusCode).toBe(400);
  });

  it('is closed to personal tokens, read or write, on both routes', async () => {
    for (const scope of ['read', 'write'] as const) {
      const secret = await makeToken(ola, scope, [home]);
      const get = await bearer(secret, url(home));
      expect(get.statusCode, get.body).toBe(403);
      expect((get.json() as { code: string }).code).toBe('token_scope');
      const put = await bearer(secret, url(home), { fold: [bedroom], open: [] });
      expect(put.statusCode, put.body).toBe(403);
      expect((put.json() as { code: string }).code).toBe('token_scope');
    }
    expect(await folds(ola, home)).toEqual([]);
  });

  it('a deleted place takes its fold with it', async () => {
    const attic = await place(home, 'Attic');
    await putFolds(vic, home, { fold: [attic, bedroom] });
    await own('DELETE FROM public.places WHERE id = $1', [attic]);
    expect(await folds(vic, home)).toEqual([bedroom]);
    await openAll(vic, home);
  });

  it("leaving a location drops your folds there, and keeps everyone else's", async () => {
    await putFolds(ann, home, { fold: [bedroom, underBed] });
    await putFolds(ola, home, { fold: [wardrobe] });
    await own('DELETE FROM public.memberships WHERE location_id = $1 AND user_id = $2', [
      home,
      ann.userId,
    ]);
    expect((await call(t, url(home), { as: ann })).statusCode).toBe(404);
    expect(await own('SELECT 1 FROM public.place_folds WHERE user_id = $1', [ann.userId])).toEqual(
      [],
    );
    expect(await folds(ola, home)).toEqual([wardrobe]);
    await openAll(ola, home);
  });
});
