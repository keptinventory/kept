import { newId, TAG_COLOURS } from '@kept/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import { join, type Person, peopleApp, person } from '../../test/people.js';
import { op, sent } from '../../test/sync-ops.js';
import { createLocation, createThing, type Loc, own } from '../../test/things.js';

// `tag_things` through POST /api/v1/sync/ops: tags added or taken off on the phone, new tags made
// offline with them. Ibrahim owns Home; Louis is a member and Talia a viewer.

let db: TestDb;
let t: TestApp;
let ibrahim: Person;
let louis: Person;
let talia: Person;
let home: Loc;

const tagsOf = async (thingId: string) =>
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
  home = await createLocation(t, db, ibrahim, 'essentials');
  await join(db, home.id, louis.userId, 'member');
  await join(db, home.id, talia.userId, 'viewer');
});

afterAll(async () => {
  await t.app.close();
});

describe('tag_things', () => {
  it('adds and removes tags, as one change a thing', async () => {
    const camping = await tag('Camping');
    const beach = await tag('Beach');
    const tent = await createThing(t, ibrahim, home, { name: 'Tent', tagIds: [beach] });
    const [r] = await sent(t, louis, [
      op('tag_things', home.id, { thingIds: [tent.id], add: [camping], remove: [beach] }),
    ]);
    expect(r?.outcome).toBe('applied');
    expect(await tagsOf(tent.id)).toEqual(['Camping']);
    const events = await own<{ action: string }>(
      db,
      `SELECT action FROM public.audit_events WHERE entity_id = $1 ORDER BY at DESC LIMIT 1`,
      [tent.id],
    );
    expect(events[0]?.action).toBe('thing.update');
  });

  it('makes a tag made offline, or uses the one that has its name already', async () => {
    await tag('Garden');
    const rake = await createThing(t, ibrahim, home, { name: 'Rake' });
    const fresh = newId();
    const known = newId();
    const [r] = await sent(t, louis, [
      op('tag_things', home.id, {
        thingIds: [rake.id],
        add: [fresh, known],
        create: [
          { id: fresh, name: 'Tools', colour: TAG_COLOURS.blue },
          { id: known, name: 'garden' },
        ],
      }),
    ]);
    expect(r?.outcome, JSON.stringify(r)).toBe('applied');
    expect(await tagsOf(rake.id)).toEqual(['Garden', 'Tools']);
    const made = await own<{ id: string; colour: string }>(
      db,
      `SELECT id, colour FROM public.tags WHERE owner_account_id = $1 AND name = 'Tools'`,
      [home.accountId],
    );
    expect(made).toEqual([{ id: fresh, colour: TAG_COLOURS.blue }]);
  });

  it('leaves a thing trashed meanwhile, and drops the op when none is left', async () => {
    const winter = await tag('Winter');
    const coat = await createThing(t, ibrahim, home, { name: 'Coat' });
    const scarf = await createThing(t, ibrahim, home, { name: 'Scarf' });
    await own(db, 'UPDATE public.things SET deleted_at = now() WHERE id = $1', [scarf.id]);
    const [partly] = await sent(t, louis, [
      op('tag_things', home.id, { thingIds: [coat.id, scarf.id], add: [winter] }),
    ]);
    expect(partly?.outcome).toBe('applied');
    expect(await tagsOf(coat.id)).toEqual(['Winter']);
    expect(await tagsOf(scarf.id)).toEqual([]);
    const [gone] = await sent(t, louis, [
      op('tag_things', home.id, { thingIds: [scarf.id], add: [winter] }),
    ]);
    expect(gone?.outcome).toBe('dropped');
  });

  it("is a viewer's not_permitted", async () => {
    const lamp = await createThing(t, ibrahim, home, { name: 'Lamp' });
    const [r] = await sent(t, talia, [
      op('tag_things', home.id, { thingIds: [lamp.id], add: [await tag('Lights')] }),
    ]);
    expect([r?.outcome, r?.reason]).toEqual(['dropped', 'not_permitted']);
  });
});
