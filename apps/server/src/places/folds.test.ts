import { newId } from '@kept/shared';
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

const putFolds = (as: Person, locationId: string, placeIds: string[]) =>
  call(t, url(locationId), { as, method: 'PUT', body: { placeIds } });

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  t = await peopleApp(db);
  ola = await person(t, db, 'ola');
  vic = await person(t, db, 'vic');
  bob = await person(t, db, 'bob');
  home = await createLocation(ola, 'Home');
  await join(db, home, vic.userId, 'viewer');
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
    expect((await putFolds({ ...ola, cookie: '' }, home, [bedroom])).statusCode).toBe(401);
  });

  // Not audited: the PUT is on test/route-catalogue.test.ts's allowlist.
  it('replaces the set each time, the same on every device, and writes no audit row', async () => {
    expect((await putFolds(ola, home, [underBed, bedroom])).statusCode).toBe(204);
    expect((await folds(ola, home)).sort()).toEqual([bedroom, underBed].sort());
    // "Open all" sends an empty set; a toggle sends the whole new set.
    expect((await putFolds(ola, home, [wardrobe])).statusCode).toBe(204);
    expect(await folds(ola, home)).toEqual([wardrobe]);
    expect((await putFolds(ola, home, [])).statusCode).toBe(204);
    expect(await folds(ola, home)).toEqual([]);
    const audit = await own(
      `SELECT action FROM public.audit_events WHERE actor_id = $1 AND action LIKE 'place%'`,
      [ola.userId],
    );
    expect(audit).toEqual([]);
  });

  it("is each person's own: a viewer folds too, and sees only their own folds", async () => {
    await putFolds(ola, home, [bedroom]);
    expect((await putFolds(vic, home, [underBed])).statusCode).toBe(204);
    expect(await folds(vic, home)).toEqual([underBed]);
    expect(await folds(ola, home)).toEqual([bedroom]);
    await putFolds(ola, home, []);
    await putFolds(vic, home, []);
  });

  it("drops ids that aren't places in the location, and keeps the other location's folds", async () => {
    expect((await putFolds(bob, bobs, [bobsShed])).statusCode).toBe(204);
    // Bob's shed sent with Home's places, and an id that is no place at all.
    expect((await putFolds(ola, home, [bedroom, bobsShed, newId()])).statusCode).toBe(204);
    expect(await folds(ola, home)).toEqual([bedroom]);
    expect(await folds(bob, bobs)).toEqual([bobsShed]);
    await putFolds(ola, home, []);
  });

  it("is a 404 in a location the caller isn't in, and a 400 for a body that isn't ids", async () => {
    expect((await call(t, url(bobs), { as: ola })).statusCode).toBe(404);
    expect((await putFolds(ola, bobs, [bobsShed])).statusCode).toBe(404);
    expect(await folds(bob, bobs)).toEqual([bobsShed]);
    expect(
      (await call(t, url(home), { as: ola, method: 'PUT', body: { placeIds: ['x'] } })).statusCode,
    ).toBe(400);
    expect(
      (await call(t, url(home), { as: ola, method: 'PUT', body: { placeIds: [], more: 1 } }))
        .statusCode,
    ).toBe(400);
  });

  it('a deleted place takes its fold with it, and a member who left no longer reads theirs', async () => {
    const attic = await place(home, 'Attic');
    await putFolds(vic, home, [attic, bedroom]);
    await own('DELETE FROM public.places WHERE id = $1', [attic]);
    expect(await folds(vic, home)).toEqual([bedroom]);
    await own('DELETE FROM public.memberships WHERE location_id = $1 AND user_id = $2', [
      home,
      vic.userId,
    ]);
    expect((await call(t, url(home), { as: vic })).statusCode).toBe(404);
    // Row-level security, not only the route: their row is there, and out of their sight.
    const rows = await own('SELECT 1 FROM public.place_folds WHERE user_id = $1', [vic.userId]);
    expect(rows).toHaveLength(1);
  });
});
