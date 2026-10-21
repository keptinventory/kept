import { newId, TAG_COLOURS } from '@kept/shared';
import type pg from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import { call, join, type Person, peopleApp, person } from '../../test/people.js';
import { ownerTx } from '../../test/tenancy.js';

// Tags as an everyday tool: palette colours, the per-account cap, how many things use a tag, and
// a delete that counts the Trash. Bob owns an account with one location, "Bob home"; Adam is an
// admin there, Mel a member and Vic a viewer.

let db: TestDb;
let t: TestApp;
let bob: Person;
let adam: Person;
let mel: Person;
let vic: Person;
let account: string;
let home: string;

const own = <T extends pg.QueryResultRow>(text: string, values: unknown[] = []) =>
  ownerTx(db, async (c) => (await c.query<T>(text, values)).rows);

type Tag = { id: string; name: string; colour: string | null; rowVersion: number };

async function createTag(as: Person, body: object): Promise<Tag> {
  const res = await call(t, `/api/v1/accounts/${account}/tags`, { as, body });
  expect(res.statusCode, res.body).toBe(201);
  return (res.json() as { item: Tag }).item;
}

/** A thing in Bob home's Unplaced area with `tagIds`, trashed when `trashed`. */
async function thing(tagIds: string[], trashed = false): Promise<string> {
  const id = newId();
  await own(
    `INSERT INTO public.things (id, location_id, place_id, name, deleted_at)
     VALUES ($1, $2, (SELECT id FROM public.places WHERE location_id = $2 AND is_unplaced),
             'Thing', CASE WHEN $3 THEN now() ELSE NULL END)`,
    [id, home, trashed],
  );
  for (const tagId of tagIds) {
    await own('INSERT INTO public.thing_tags (location_id, thing_id, tag_id) VALUES ($1, $2, $3)', [
      home,
      id,
      tagId,
    ]);
  }
  return id;
}

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  t = await peopleApp(db);
  bob = await person(t, db, 'bob');
  adam = await person(t, db, 'adam');
  mel = await person(t, db, 'mel');
  vic = await person(t, db, 'vic');
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
  await join(db, home, adam.userId, 'admin');
  await join(db, home, mel.userId, 'member');
  await join(db, home, vic.userId, 'viewer');
});

describe('tag colours', () => {
  it('a new tag without a colour takes the least used palette colour', async () => {
    const first = await createTag(mel, { name: 'Camping' });
    expect(Object.values(TAG_COLOURS)).toContain(first.colour);
    const second = await createTag(mel, { name: 'Beach' });
    expect(second.colour).not.toBe(first.colour);
  });

  it('takes a palette colour in any case, stored upper case; refuses any other hex', async () => {
    const tag = await createTag(mel, { name: 'Fragile', colour: TAG_COLOURS.teal.toLowerCase() });
    expect(tag.colour).toBe(TAG_COLOURS.teal);
    const bad = await call(t, `/api/v1/accounts/${account}/tags`, {
      as: mel,
      body: { name: 'Odd', colour: '#123456' },
    });
    expect(bad.statusCode).toBe(400);
    const recolour = await call(t, `/api/v1/tags/${tag.id}`, {
      as: adam,
      method: 'PATCH',
      body: { colour: TAG_COLOURS.pink },
      headers: { 'if-match': String(tag.rowVersion) },
    });
    expect(recolour.statusCode, recolour.body).toBe(200);
    expect(recolour.json()).toMatchObject({ colour: TAG_COLOURS.pink });
    const noColour = await call(t, `/api/v1/tags/${tag.id}`, {
      as: adam,
      method: 'PATCH',
      body: { colour: null },
      headers: { 'if-match': String(tag.rowVersion + 1) },
    });
    expect(noColour.statusCode, noColour.body).toBe(200);
    expect(noColour.json()).toMatchObject({ colour: null });
  });

  it('a member may not recolour (tags.edit-delete)', async () => {
    const tag = await createTag(mel, { name: 'Recolour me' });
    const res = await call(t, `/api/v1/tags/${tag.id}`, {
      as: mel,
      method: 'PATCH',
      body: { colour: TAG_COLOURS.blue },
      headers: { 'if-match': String(tag.rowVersion) },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('how many things use a tag', () => {
  it('lists each tag with its live things; a tag item adds them per location', async () => {
    const tag = await createTag(mel, { name: 'Counted' });
    await thing([tag.id]);
    await thing([tag.id]);
    await thing([tag.id], true);
    const list = await call(t, `/api/v1/accounts/${account}/tags?q=Counted`, { as: vic });
    expect(list.statusCode, list.body).toBe(200);
    const items = (list.json() as { items: (Tag & { thingCount: number })[] }).items;
    expect(items.find((x) => x.id === tag.id)?.thingCount).toBe(2);
    const item = await call(t, `/api/v1/tags/${tag.id}`, { as: vic });
    expect(item.statusCode, item.body).toBe(200);
    expect(item.json()).toMatchObject({ thingCount: 2, uses: [{ locationId: home, count: 2 }] });
  });
});

describe('deleting a tag', () => {
  it('is refused while a trashed thing uses it, saying how many', async () => {
    const tag = await createTag(mel, { name: 'Trashed only' });
    await thing([tag.id], true);
    const res = await call(t, `/api/v1/tags/${tag.id}`, { as: adam, method: 'DELETE' });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: 'in_use', live: 0, trashed: 1 });
  });

  it('is refused while a live thing uses it', async () => {
    const tag = await createTag(mel, { name: 'Live use' });
    await thing([tag.id]);
    const res = await call(t, `/api/v1/tags/${tag.id}`, { as: adam, method: 'DELETE' });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: 'in_use', live: 1, trashed: 0 });
  });
});

describe('the per-account cap', () => {
  it('refuses the 1,001st tag', async () => {
    const [{ n } = { n: 0 }] = await own<{ n: number }>(
      'SELECT count(*)::int AS n FROM public.tags WHERE owner_account_id = $1',
      [account],
    );
    await own(
      `INSERT INTO public.tags (owner_account_id, name)
       SELECT $1, 'Filler ' || g FROM generate_series(1, $2::int) g`,
      [account, 1000 - n],
    );
    const res = await call(t, `/api/v1/accounts/${account}/tags`, {
      as: mel,
      body: { name: 'One too many' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: 'conflict', reason: 'tag_limit' });
    await own(`DELETE FROM public.tags WHERE owner_account_id = $1 AND name LIKE 'Filler %'`, [
      account,
    ]);
  });
});

describe('undoing a tag change', () => {
  const undo = (as: Person, eventId: string) =>
    call(t, `/api/v1/audit/${eventId}/undo`, { as, body: {} });
  const eventOf = (res: { headers: Record<string, unknown> }) =>
    String(res.headers['x-kept-audit-event'] ?? '');
  const tagsOf = async (thingId: string) =>
    (
      await own<{ tag_id: string }>(
        'SELECT tag_id FROM public.thing_tags WHERE thing_id = $1 ORDER BY tag_id',
        [thingId],
      )
    ).map((r) => r.tag_id);

  it('a rename and a recolour go back; an admin undoes, a member may not', async () => {
    const tag = await createTag(mel, { name: 'Picnic', colour: TAG_COLOURS.green });
    const res = await call(t, `/api/v1/tags/${tag.id}`, {
      as: adam,
      method: 'PATCH',
      body: { name: 'Picnics', colour: TAG_COLOURS.amber },
      headers: { 'if-match': String(tag.rowVersion) },
    });
    expect(res.statusCode, res.body).toBe(200);
    const eventId = eventOf(res);
    expect(eventId).toMatch(/^[0-9a-f-]{36}$/);
    // A member doesn't see the account's own changes, so there is nothing for them to undo.
    expect((await undo(mel, eventId)).statusCode).toBe(404);
    const done = await undo(adam, eventId);
    expect(done.statusCode, done.body).toBe(200);
    const back = await call(t, `/api/v1/tags/${tag.id}`, { as: mel });
    expect(back.json()).toMatchObject({ name: 'Picnic', colour: TAG_COLOURS.green });
    expect((await undo(adam, eventId)).json()).toMatchObject({ reason: 'already_undone' });
  });

  it('a rename changed again since is refused', async () => {
    const tag = await createTag(mel, { name: 'Hiking' });
    const first = await call(t, `/api/v1/tags/${tag.id}`, {
      as: adam,
      method: 'PATCH',
      body: { name: 'Hikes' },
      headers: { 'if-match': String(tag.rowVersion) },
    });
    await call(t, `/api/v1/tags/${tag.id}`, {
      as: bob,
      method: 'PATCH',
      body: { name: 'Walks' },
      headers: { 'if-match': String(tag.rowVersion + 1) },
    });
    const res = await undo(adam, eventOf(first));
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ reason: 'changed_since', field: 'name' });
  });

  it('a merge goes back: the tag returns to its things, the target leaves only where it was added', async () => {
    const from = await createTag(mel, { name: 'Tools old', colour: TAG_COLOURS.brown });
    const into = await createTag(mel, { name: 'Tools' });
    const onlyFrom = await thing([from.id]);
    const both = await thing([from.id, into.id]);
    const onlyInto = await thing([into.id]);
    const res = await call(t, `/api/v1/tags/${from.id}/merge-into`, {
      as: adam,
      body: { targetId: into.id },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(await tagsOf(onlyFrom)).toEqual([into.id]);
    const done = await undo(adam, eventOf(res));
    expect(done.statusCode, done.body).toBe(200);
    const back = await call(t, `/api/v1/tags/${from.id}`, { as: mel });
    expect(back.statusCode).toBe(200);
    expect(back.json()).toMatchObject({ name: 'Tools old', colour: TAG_COLOURS.brown });
    expect(await tagsOf(onlyFrom)).toEqual([from.id]);
    expect(await tagsOf(both)).toEqual([from.id, into.id].sort());
    expect(await tagsOf(onlyInto)).toEqual([into.id]);
  });

  it('a merge is not undone once its name is taken again', async () => {
    const from = await createTag(mel, { name: 'Sport' });
    const into = await createTag(mel, { name: 'Sports' });
    const res = await call(t, `/api/v1/tags/${from.id}/merge-into`, {
      as: adam,
      body: { targetId: into.id },
    });
    await createTag(mel, { name: 'sport' });
    const done = await undo(adam, eventOf(res));
    expect(done.statusCode).toBe(409);
    expect(done.json()).toMatchObject({ reason: 'changed_since' });
  });

  it('a delete goes back, with its id, name and colour', async () => {
    const tag = await createTag(mel, { name: 'Unused', colour: TAG_COLOURS.violet });
    const res = await call(t, `/api/v1/tags/${tag.id}`, { as: adam, method: 'DELETE' });
    expect(res.statusCode).toBe(204);
    const done = await undo(adam, eventOf(res));
    expect(done.statusCode, done.body).toBe(200);
    expect((await call(t, `/api/v1/tags/${tag.id}`, { as: mel })).json()).toMatchObject({
      name: 'Unused',
      colour: TAG_COLOURS.violet,
    });
  });
});
