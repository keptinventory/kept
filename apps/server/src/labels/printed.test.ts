import { randomShortCode } from '@kept/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import { call, type Person, peopleApp, person } from '../../test/people.js';
import {
  createLocation,
  createThing,
  type Json,
  type Loc,
  ok,
  own,
  place,
} from '../../test/things.js';

// `labelPrinted`: whether a thing or a place carries a printed label, wherever it is listed or
// shown (the web shows the amber tape only then). A label is printed once "Printed OK?" confirms
// its batch or a pre-printed blank is claimed; any of its codes counts, not only the primary one.

let db: TestDb;
let t: TestApp;
let ibrahim: Person;
let home: Loc;
let shelf: string;
let study: string;
let drill: { id: string; shortCode: string };
let kettle: { id: string };
let crate: { id: string; shortCode: string };
let blank: string;

type Row = { id: string; name: string | null; labelPrinted: boolean };

const printBatch = async (body: Record<string, unknown>) => {
  const made = ok(
    await call(t, '/api/v1/labels/batches', {
      as: ibrahim,
      body: { stock: 'a4_24_70x37', locationId: home.id, ...body },
    }),
    201,
  ) as unknown as { batch: { id: string } };
  ok(await call(t, `/api/v1/labels/batches/${made.batch.id}/printed`, { as: ibrahim, body: {} }));
};

const get = async <T = Json>(url: string) =>
  ok(await call(t, url, { as: ibrahim })) as unknown as T;
const byName = (rows: Row[]) => Object.fromEntries(rows.map((r) => [r.name, r.labelPrinted]));

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  t = await peopleApp(db);
  ibrahim = await person(t, db, 'ibrahim');
  home = await createLocation(t, db, ibrahim, 'complete');
  shelf = await place(db, home, 'Shelf A');
  study = await place(db, home, 'Study');
  drill = (await createThing(t, ibrahim, home, {
    name: 'Drill',
    placeId: shelf,
  })) as unknown as typeof drill;
  kettle = await createThing(t, ibrahim, home, { name: 'Kettle', placeId: shelf });
  crate = (await createThing(t, ibrahim, home, {
    name: 'Crate',
    placeId: shelf,
  })) as unknown as typeof crate;
  // The kettle's own code, printed and confirmed.
  await printBatch({ kind: 'things', thingIds: [kettle.id] });
  // A pre-printed blank, claimed onto the crate: a physical label, not the crate's primary code.
  blank = randomShortCode();
  await own(
    db,
    `INSERT INTO public.short_ids (code, location_id, state, is_primary) VALUES ($1, $2, 'blank', false)`,
    [blank, home.id],
  );
  ok(await call(t, `/api/v1/codes/${blank}/claim`, { as: ibrahim, body: { thingId: crate.id } }));
  // The shelf's label, printed; the study has none.
  await printBatch({ kind: 'places', placeIds: [shelf] });
});

afterAll(async () => {
  await t.app.close();
});

describe('the code a thing shows', () => {
  it('is its printed label when it has one, else its own code', async () => {
    type Shown = { shortCode: string; labelPrinted: boolean };
    // The crate's label is the blank claimed onto it, not the code it was made with.
    expect(await get<Shown>(`/api/v1/things/${crate.id}`)).toMatchObject({
      shortCode: blank,
      labelPrinted: true,
    });
    const contents = await get<{ things: { items: (Row & Shown)[] } }>(
      `/api/v1/places/${shelf}/contents`,
    );
    expect(contents.things.items.find((r) => r.id === crate.id)?.shortCode).toBe(blank);
    const hits = await get<{ things: { items: (Row & Shown)[] } }>(
      '/api/v1/search?q=crate&kind=things',
    );
    expect(hits.things.items.map((r) => r.shortCode)).toEqual([blank]);
    // With nothing printed, its own (primary) code, shown quietly.
    expect(await get<Shown>(`/api/v1/things/${drill.id}`)).toMatchObject({
      shortCode: drill.shortCode,
      labelPrinted: false,
    });
  });

  it('is the code a reprint puts on the new label', async () => {
    const lamp = (await createThing(t, ibrahim, home, {
      name: 'Desk lamp',
      placeId: study,
    })) as unknown as { id: string; shortCode: string };
    const claimed = randomShortCode();
    await own(
      db,
      `INSERT INTO public.short_ids (code, location_id, state, is_primary) VALUES ($1, $2, 'blank', false)`,
      [claimed, home.id],
    );
    ok(
      await call(t, `/api/v1/codes/${claimed}/claim`, { as: ibrahim, body: { thingId: lamp.id } }),
    );
    // "Print its label": the reprint carries the claimed code the tape shows, not the lamp's own.
    const made = ok(
      await call(t, '/api/v1/labels/batches', {
        as: ibrahim,
        body: { stock: 'a4_24_70x37', locationId: home.id, kind: 'things', thingIds: [lamp.id] },
      }),
      201,
    ) as unknown as { batch: { labels: { code: string }[] } };
    expect(made.batch.labels.map((l) => l.code)).toEqual([claimed]);
    expect(claimed).not.toBe(lamp.shortCode);
  });

  it('is the most recently printed label when it has several', async () => {
    // The crate's own code printed after the claimed blank (an older sheet confirmed later):
    // that newer label is the one shown.
    await own(
      db,
      `UPDATE public.short_ids SET printed_at = now() + interval '1 minute' WHERE code = $1`,
      [crate.shortCode],
    );
    expect((await get<{ shortCode: string }>(`/api/v1/things/${crate.id}`)).shortCode).toBe(
      crate.shortCode,
    );
  });
});

describe('labelPrinted', () => {
  it("is on a thing's page: false until a label is printed or claimed", async () => {
    expect((await get(`/api/v1/things/${drill.id}`)).labelPrinted).toBe(false);
    expect((await get(`/api/v1/things/${kettle.id}`)).labelPrinted).toBe(true);
    expect((await get(`/api/v1/things/${crate.id}`)).labelPrinted).toBe(true);
  });

  it("is on every row of a place's contents and a location's things", async () => {
    const contents = await get<{ things: { items: Row[] } }>(`/api/v1/places/${shelf}/contents`);
    expect(byName(contents.things.items)).toEqual({ Drill: false, Kettle: true, Crate: true });
    const list = await get<{ items: Row[] }>(`/api/v1/things?locationId=${home.id}`);
    expect(byName(list.items)).toMatchObject({ Drill: false, Kettle: true, Crate: true });
  });

  it('is on search results', async () => {
    const hits = async (q: string) =>
      (await get<{ things: { items: Row[] } }>(`/api/v1/search?q=${q}&kind=things`)).things.items;
    expect(byName(await hits('kettle'))).toEqual({ Kettle: true });
    expect(byName(await hits('drill'))).toEqual({ Drill: false });
  });

  it("is on a place's page", async () => {
    expect((await get(`/api/v1/places/${shelf}`)).labelPrinted).toBe(true);
    expect((await get(`/api/v1/places/${study}`)).labelPrinted).toBe(false);
  });

  it("is on the map's rooms and things", async () => {
    const map = await get<{ rooms: { name: string; labelPrinted: boolean }[]; things: Row[] }>(
      `/api/v1/locations/${home.id}/map`,
    );
    expect(Object.fromEntries(map.rooms.map((r) => [r.name, r.labelPrinted]))).toMatchObject({
      'Shelf A': true,
      Study: false,
    });
    expect(byName(map.things)).toMatchObject({ Drill: false, Kettle: true, Crate: true });
  });

  it('is on a moving box, once its label is printed', async () => {
    const move = ok(
      await call(t, `/api/v1/locations/${home.id}/moves`, { as: ibrahim, body: { name: 'Move' } }),
      201,
    ) as unknown as { id: string };
    const box = ok(
      await call(t, `/api/v1/moves/${move.id}/boxes`, {
        as: ibrahim,
        body: { new: { prefix: 'Box' } },
      }),
      201,
    ) as unknown as { containerId: string; labelPrinted: boolean };
    expect(box.labelPrinted).toBe(false);
    await printBatch({ kind: 'things', thingIds: [box.containerId] });
    const after = await get<{
      labelPrinted: boolean;
    }>(`/api/v1/move-boxes/${box.containerId}`);
    expect(after.labelPrinted).toBe(true);
  });
});
