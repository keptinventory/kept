import { newId } from '@kept/shared';
import type pg from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import { call, join, type Person, peopleApp, person } from '../../test/people.js';
import { ownerTx } from '../../test/tenancy.js';

// A thing's tags in every list: the chips each row carries, "has all of", grouping by tag, and
// adding or removing tags on many things at once. Bob owns "Bob home"; Mel is a member there and
// Vic a viewer. Ann has her own account.

let db: TestDb;
let t: TestApp;
let bob: Person;
let mel: Person;
let vic: Person;
let ann: Person;
let account: string;
let home: string;
let unplaced: string;
let camping: string;
let beach: string;
let winter: string;

const own = <T extends pg.QueryResultRow>(text: string, values: unknown[] = []) =>
  ownerTx(db, async (c) => (await c.query<T>(text, values)).rows);

type Row = {
  id: string;
  name: string;
  tags: { id: string; name: string; colour: string | null }[];
};

async function tag(name: string, accountId = account): Promise<string> {
  const [row] = await own<{ id: string }>(
    'INSERT INTO public.tags (owner_account_id, name) VALUES ($1, $2) RETURNING id',
    [accountId, name],
  );
  return row?.id as string;
}

async function thing(name: string, tagIds: string[]): Promise<string> {
  const id = newId();
  await own('INSERT INTO public.things (id, location_id, place_id, name) VALUES ($1, $2, $3, $4)', [
    id,
    home,
    unplaced,
    name,
  ]);
  for (const tagId of tagIds) {
    await own('INSERT INTO public.thing_tags (location_id, thing_id, tag_id) VALUES ($1, $2, $3)', [
      home,
      id,
      tagId,
    ]);
  }
  return id;
}

const tagsOf = async (thingId: string) =>
  (
    await own<{ tag_id: string }>(
      'SELECT tag_id FROM public.thing_tags WHERE thing_id = $1 ORDER BY tag_id',
      [thingId],
    )
  ).map((r) => r.tag_id);

async function list(url: string, as: Person = mel): Promise<Row[]> {
  const res = await call(t, url, { as });
  expect(res.statusCode, res.body).toBe(200);
  const body = res.json() as { items?: Row[]; things?: { items: Row[] } };
  return body.items ?? body.things?.items ?? [];
}

let tent: string;
let towel: string;
let both: string;
let plain: string;

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  t = await peopleApp(db);
  bob = await person(t, db, 'bob');
  mel = await person(t, db, 'mel');
  vic = await person(t, db, 'vic');
  ann = await person(t, db, 'ann');
  const [row] = await own<{ id: string }>(
    'SELECT id FROM public.owner_accounts WHERE user_id = $1',
    [bob.userId],
  );
  account = row?.id as string;
  const res = await call(t, '/api/v1/locations', {
    as: bob,
    body: {
      name: 'Bob home',
      kind: 'home',
      preset: 'essentials',
      timezone: 'Africa/Cairo',
      currency: 'EGP',
      rooms: [],
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  home = (res.json() as { id: string }).id;
  const [u] = await own<{ id: string }>(
    'SELECT id FROM public.places WHERE location_id = $1 AND is_unplaced',
    [home],
  );
  unplaced = u?.id as string;
  await join(db, home, mel.userId, 'member');
  await join(db, home, vic.userId, 'viewer');
  camping = await tag('Camping');
  beach = await tag('beach');
  winter = await tag('Winter');
  tent = await thing('Tent', [camping]);
  towel = await thing('Towel', [beach]);
  both = await thing('Cool box', [camping, beach]);
  plain = await thing('Lamp', []);
});

describe('a thing row carries its tags', () => {
  it('on the things list, A to Z', async () => {
    const rows = await list(`/api/v1/things?locationId=${home}&limit=50`);
    const row = rows.find((r) => r.id === both);
    expect(row?.tags.map((g) => g.name)).toEqual(['beach', 'Camping']);
    expect(rows.find((r) => r.id === plain)?.tags).toEqual([]);
  });

  it('in search results', async () => {
    const rows = await list(`/api/v1/search?q=Tent&kind=things`);
    expect(rows.find((r) => r.id === tent)?.tags.map((g) => g.id)).toEqual([camping]);
  });

  it("in a place's contents", async () => {
    const rows = await list(`/api/v1/places/${unplaced}/contents?limit=50`);
    expect(rows.find((r) => r.id === both)?.tags.map((g) => g.id)).toEqual([beach, camping]);
  });
});

describe('"has all of" the chosen tags', () => {
  it('the things list keeps only things with every one', async () => {
    const any = await list(
      `/api/v1/things?locationId=${home}&tagId=${camping}&tagId=${beach}&limit=50`,
    );
    expect(any.map((r) => r.id).sort()).toEqual([tent, towel, both].sort());
    const all = await list(
      `/api/v1/things?locationId=${home}&tagId=${camping}&tagId=${beach}&all=tagId&limit=50`,
    );
    expect(all.map((r) => r.id)).toEqual([both]);
  });

  it('search too', async () => {
    const all = await list(
      `/api/v1/search?kind=things&tagId=${camping}&tagId=${beach}&all=tagId&locationId=${home}`,
    );
    expect(all.map((r) => r.id)).toEqual([both]);
  });

  it("and a place's contents", async () => {
    const all = await list(
      `/api/v1/places/${unplaced}/contents?tag=${camping}&tag=${beach}&all=tag&limit=50`,
    );
    expect(all.map((r) => r.id)).toEqual([both]);
  });

  it('"none of" still wins when both are named', async () => {
    const none = await list(
      `/api/v1/things?locationId=${home}&tagId=${camping}&not=tagId&all=tagId&limit=50`,
    );
    expect(none.map((r) => r.id).sort()).toEqual([towel, plain].sort());
  });
});

describe('grouped by tag', () => {
  it('lists each thing once, under its first tag A to Z, untagged last; pages keep the order', async () => {
    const rows = await list(`/api/v1/things?locationId=${home}&group=tag&limit=50`);
    expect(rows.map((r) => r.id)).toEqual([both, towel, tent, plain]);
    const first = await call(t, `/api/v1/things?locationId=${home}&group=tag&limit=2`, { as: mel });
    const page = first.json() as { items: Row[]; next_cursor: string };
    const next = await list(
      `/api/v1/things?locationId=${home}&group=tag&limit=2&cursor=${encodeURIComponent(page.next_cursor)}`,
    );
    expect([...page.items, ...next].map((r) => r.id)).toEqual([both, towel, tent, plain]);
  });

  it("a place's contents too", async () => {
    const rows = await list(`/api/v1/places/${unplaced}/contents?group=tag&limit=50`);
    expect(rows.map((r) => r.id)).toEqual([both, towel, tent, plain]);
  });
});

describe('POST /api/v1/things/tags', () => {
  // catalogue: POST /api/v1/things/tags
  it('adds tags to the things that lack them, one undoable event each, undone together', async () => {
    const res = await call(t, '/api/v1/things/tags', {
      as: mel,
      body: { thingIds: [tent, towel, both], add: [winter, camping] },
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json() as { changed: string[]; events: string[] };
    expect(body.changed.sort()).toEqual([tent, towel, both].sort());
    expect(body.events).toHaveLength(3);
    const audit = await own<{ action: string; entity_id: string; diff: Record<string, unknown> }>(
      'SELECT action, entity_id, diff FROM public.audit_events WHERE id = ANY ($1::uuid[])',
      [body.events],
    );
    expect(audit.map((a) => a.action)).toEqual(['thing.update', 'thing.update', 'thing.update']);
    expect(audit.find((a) => a.entity_id === towel)?.diff).toMatchObject({
      tag_ids: { before: [beach], after: [beach, camping, winter].sort() },
    });
    expect(await tagsOf(towel)).toEqual([beach, camping, winter].sort());
    const undo = await call(t, '/api/v1/audit/undo', { as: mel, body: { eventIds: body.events } });
    expect(undo.statusCode, undo.body).toBe(200);
    expect(await tagsOf(towel)).toEqual([beach]);
    expect(await tagsOf(tent)).toEqual([camping]);
  });

  it('removes tags; a thing that has none of them is left alone', async () => {
    const res = await call(t, '/api/v1/things/tags', {
      as: mel,
      body: { thingIds: [tent, plain], remove: [camping] },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect((res.json() as { changed: string[] }).changed).toEqual([tent]);
    expect(await tagsOf(tent)).toEqual([]);
    await own('INSERT INTO public.thing_tags (location_id, thing_id, tag_id) VALUES ($1, $2, $3)', [
      home,
      tent,
      camping,
    ]);
  });

  it('refuses a viewer, nothing to do, too many things, and a tag of another account', async () => {
    const byVic = await call(t, '/api/v1/things/tags', {
      as: vic,
      body: { thingIds: [tent], add: [winter] },
    });
    expect(byVic.statusCode).toBe(403);
    const empty = await call(t, '/api/v1/things/tags', { as: mel, body: { thingIds: [tent] } });
    expect(empty.statusCode).toBe(400);
    const many = await call(t, '/api/v1/things/tags', {
      as: mel,
      body: { thingIds: Array.from({ length: 201 }, () => newId()), add: [winter] },
    });
    expect(many.statusCode).toBe(400);
    const [a] = await own<{ id: string }>(
      'SELECT id FROM public.owner_accounts WHERE user_id = $1',
      [ann.userId],
    );
    const foreign = await tag('Ann only', a?.id as string);
    const other = await call(t, '/api/v1/things/tags', {
      as: mel,
      body: { thingIds: [tent], add: [foreign] },
    });
    expect(other.statusCode).toBe(404);
    expect(await tagsOf(tent)).toEqual([camping]);
  });

  it('is a 404 for a thing you cannot see', async () => {
    const res = await call(t, '/api/v1/things/tags', {
      as: ann,
      body: { thingIds: [tent], add: [winter] },
    });
    expect(res.statusCode).toBe(404);
  });
});
