import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { comparePlaceSiblings, naturalCompare, newId } from '@kept/shared';
import pg from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb, withSuperuser } from '../../test/db.js';
import { call, join as joinLocation, type Person, peopleApp, person } from '../../test/people.js';
import { builtinType, createLocation, createThing, type Loc, ok, own } from '../../test/things.js';
import { runMigrations } from '../db/migrate.js';
import { withScope } from '../db/scope.js';
import { placeRows } from '../map/view.js';
import { listThingsSql } from '../things/service.js';
import { ListQuery } from '../things/validate.js';
import { runTool } from '../tools/context.js';
import type { ToolContext } from '../tools/types.js';

// Places and things in one order everywhere: floors first in their own order, everything else
// A to Z with numbers read as numbers. Through the routes as a member, the MCP tools, the map's
// read, and the database (the collation, the index the list pages with, the migration).

let db: TestDb;
let t: TestApp;
let ibrahim: Person;
let louis: Person;
let home: Loc;

const NAMES = ['Box 10', 'Box 2', 'attic', 'Ärmel', 'Basement', 'رف ١٠', 'رف ٢'];
const natural = (names: string[]) => [...names].sort(naturalCompare);

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  t = await peopleApp(db);
  ibrahim = await person(t, db, 'ibrahim');
  louis = await person(t, db, 'louis');
  home = await createLocation(t, db, ibrahim, 'complete');
  await joinLocation(db, home.id, louis.userId, 'member');
});

const get = async <T>(url: string, as: Person = louis): Promise<T> =>
  ok(await call(t, url, { as, method: 'GET' })) as unknown as T;

async function newPlace(name: string, parentId: string | null = null, kindKey = 'room') {
  const res = await call(t, `/api/v1/locations/${home.id}/places`, {
    as: louis,
    body: { name, kindKey, ...(parentId ? { parentId } : {}) },
  });
  return ok(res, 201).id;
}

type Node = {
  id: string;
  parentId: string | null;
  name: string;
  kindKey: string;
  sort: number;
  createdAt: string;
  boxCount: number;
};
type Box = { id: string; placeId: string; name: string; contentCount: number };
const tree = () => get<{ places: Node[]; boxes: Box[] }>(`/api/v1/locations/${home.id}/places`);

describe('sibling places', () => {
  it('read A to Z with numbers in order, in the tree and in the contents, as the web sorts', async () => {
    const parent = await newPlace('Storeroom');
    for (const n of NAMES) await newPlace(n, parent, 'zone');
    const { places } = await tree();
    const kids = places.filter((p) => p.parentId === parent);
    expect(kids.map((p) => p.name)).toEqual(natural(NAMES));
    // The web's own sort of the same rows agrees.
    expect([...kids].sort(comparePlaceSiblings).map((p) => p.name)).toEqual(natural(NAMES));
    const contents = await get<{ places: { name: string }[] }>(`/api/v1/places/${parent}/contents`);
    expect(contents.places.map((p) => p.name)).toEqual(natural(NAMES));
    expect(natural(NAMES)).toEqual([
      'Ärmel',
      'attic',
      'Basement',
      'Box 2',
      'Box 10',
      'رف ٢',
      'رف ١٠',
    ]);
  });

  it('keep floors first, in the order they were made; only a new floor takes a position', async () => {
    const level = await newPlace('Level');
    const upper = await newPlace('Upper floor', level, 'floor');
    const ground = await newPlace('Ground floor', level, 'floor');
    const annex = await newPlace('Annex', level, 'room');
    const sorts = await own<{ id: string; sort: number }>(
      db,
      'SELECT id, sort FROM public.places WHERE parent_id = $1',
      [level],
    );
    expect(new Map(sorts.map((r) => [r.id, r.sort]))).toEqual(
      new Map([
        [upper, 0],
        [ground, 1],
        [annex, 0],
      ]),
    );
    let kids = (await tree()).places.filter((p) => p.parentId === level);
    expect(kids.map((p) => p.id)).toEqual([upper, ground, annex]);
    // A floor's own sort still counts first; every other place ignores it.
    await own(db, 'UPDATE public.places SET sort = -1 WHERE id = $1', [ground]);
    await own(db, 'UPDATE public.places SET sort = -5 WHERE id = $1', [annex]);
    kids = (await tree()).places.filter((p) => p.parentId === level);
    expect(kids.map((p) => p.id)).toEqual([ground, upper, annex]);
    expect([...kids].sort(comparePlaceSiblings).map((p) => p.id)).toEqual([ground, upper, annex]);
  });

  it('put a new floor after floors already numbered 0, 1, 2, in the tree and on the map', async () => {
    const block = await newPlace('Block');
    const floors: string[] = [];
    for (const [i, n] of ['Cellar', 'Ground', 'First'].entries()) {
      const [row] = await own<{ id: string }>(
        db,
        `INSERT INTO public.places (location_id, parent_id, name, kind_key, sort)
         VALUES ($1, NULL, $2, 'floor', $3) RETURNING id`,
        [home.id, `${n} ${block.slice(-4)}`, i],
      );
      floors.push(row?.id as string);
    }
    const added = await newPlace(`Second ${block.slice(-4)}`, null, 'floor');
    const sorts = await own<{ sort: number }>(db, 'SELECT sort FROM public.places WHERE id = $1', [
      added,
    ]);
    expect(sorts[0]?.sort).toBeGreaterThan(2);
    // A new room still takes 0: only floors keep a position.
    const room = await newPlace(`Den ${block.slice(-4)}`);
    expect(
      (await own<{ sort: number }>(db, 'SELECT sort FROM public.places WHERE id = $1', [room]))[0]
        ?.sort,
    ).toBe(0);
    const ours = new Set([...floors, added]);
    const topFloors = (await tree()).places.filter((p) => ours.has(p.id)).map((p) => p.id);
    expect(topFloors).toEqual([...floors, added]);
    const rows = await withScope(db.pools.app, { userId: louis.userId, mfa: false }, (_tx, c) =>
      placeRows(c, home.id),
    );
    expect(rows.filter((r) => ours.has(r.id)).map((r) => r.id)).toEqual([...floors, added]);
  });

  it("stack on the map in the tree's order", async () => {
    const first = await newPlace('Zeta floor', null, 'floor');
    const second = await newPlace('Alpha floor', null, 'floor');
    const rows = await withScope(db.pools.app, { userId: louis.userId, mfa: false }, (_tx, c) =>
      placeRows(c, home.id),
    );
    const floors = rows.filter((r) => r.id === first || r.id === second);
    expect(floors.map((r) => r.id)).toEqual([first, second]);
  });
});

describe('things in a place', () => {
  it('read A to Z with numbers in order on the contents, the list and MCP list_contents', async () => {
    const shed = await newPlace('Shed');
    await newPlace('Rack 10', shed, 'zone');
    await newPlace('Rack 9', shed, 'zone');
    for (const name of ['Box 10', 'box 2', 'Anchor', 'Box 1']) {
      await createThing(t, louis, home, { name, placeId: shed });
    }
    const want = ['Anchor', 'Box 1', 'box 2', 'Box 10'];
    const contents = await get<{
      places: { name: string }[];
      things: { items: { name: string }[] };
    }>(`/api/v1/places/${shed}/contents`);
    expect(contents.places.map((p) => p.name)).toEqual(['Rack 9', 'Rack 10']);
    expect(contents.things.items.map((x) => x.name)).toEqual(want);
    const list = await get<{ items: { name: string }[] }>(
      `/api/v1/things?locationId=${home.id}&placeId=${shed}`,
    );
    expect(list.items.map((x) => x.name)).toEqual(want);

    const ctx: ToolContext = {
      deps: { pools: db.pools, jobs: null, files: null, providerResolved: async () => true },
      principal: { userId: louis.userId, mfa: false, scope: 'write' },
      locale: 'en',
      requestId: 'order-test',
      via: 'mcp',
    };
    const env = (await runTool(ctx, 'list_contents', { place_id: shed })) as {
      data: {
        items: {
          place?: { untrusted: { name: string } };
          thing?: { untrusted: { name: string } };
        }[];
      };
    };
    expect(env.data.items.map((i) => (i.place ?? i.thing)?.untrusted.name)).toEqual([
      'Rack 9',
      'Rack 10',
      ...want,
    ]);
  });
});

describe('paging through names the collation reads alike', () => {
  it('lists every thing once, in order, two at a time', async () => {
    const bay = await newPlace('Bay');
    const names = ['Box 10', 'box 1', 'Box 2', 'Box 01', 'Box 1'];
    for (const name of names) await createThing(t, louis, home, { name, placeId: bay });
    const whole = await get<{ items: { id: string; name: string }[] }>(
      `/api/v1/things?locationId=${home.id}&placeId=${bay}&limit=200`,
    );
    expect(whole.items.map((x) => x.name.toLowerCase())).toEqual([
      'box 01',
      'box 1',
      'box 1',
      'box 2',
      'box 10',
    ]);
    const want = whole.items.map((x) => x.id);

    const pages = async (
      first: string,
      next: (cursor: string) => string,
      of: (b: never) => {
        items: { id: string }[];
        next_cursor: string | null;
      },
    ) => {
      const seen: string[] = [];
      let url: string | null = first;
      for (let i = 0; url && i < 10; i++) {
        const page = of((await get<never>(url)) as never);
        seen.push(...page.items.map((x) => x.id));
        url = page.next_cursor ? next(page.next_cursor) : null;
      }
      return seen;
    };
    const list = `/api/v1/things?locationId=${home.id}&placeId=${bay}&limit=2`;
    expect(
      await pages(
        list,
        (c) => `${list}&cursor=${encodeURIComponent(c)}`,
        (b) => b,
      ),
    ).toEqual(want);
    const contents = `/api/v1/places/${bay}/contents?limit=2`;
    expect(
      await pages(
        contents,
        (c) => `${contents}&cursor=${encodeURIComponent(c)}`,
        (b: { things: { items: { id: string }[]; next_cursor: string | null } }) => b.things,
      ),
    ).toEqual(want);
  });
});

describe('boxes in the tree', () => {
  it('are leaves under their place: at most 50, A to Z, with what is inside counted', async () => {
    const garage = await newPlace('Garage');
    const binType = await builtinType(db, 'box_bin');
    for (let i = 1; i <= 51; i++)
      await createThing(t, louis, home, { name: `Crate ${i}`, placeId: garage, typeId: binType });
    // A place turned into a box keeps what was in it.
    const shelf = await newPlace('Crate 0', garage, 'zone');
    await createThing(t, louis, home, { name: 'Spanner', placeId: shelf });
    await createThing(t, louis, home, { name: 'Pliers', placeId: shelf });
    ok(await call(t, `/api/v1/places/${shelf}/convert-to-container`, { as: louis, body: {} }), 200);
    // A box in a box is part of the outer box, not a leaf; a box in the trash is gone; a plain
    // thing is not a box.
    const inner = await createThing(t, louis, home, {
      name: 'Inner crate',
      containerId: shelf,
      typeId: binType,
    });
    const gone = await createThing(t, louis, home, {
      name: 'Crate 99',
      placeId: garage,
      typeId: binType,
    });
    await own(db, 'UPDATE public.things SET deleted_at = now() WHERE id = $1', [gone.id]);
    await createThing(t, louis, home, { name: 'Ladder', placeId: garage });

    const { places, boxes } = await tree();
    expect(places.find((p) => p.id === garage)?.boxCount).toBe(52);
    const here = boxes.filter((b) => b.placeId === garage);
    expect(here).toHaveLength(50);
    const all = ['Crate 0', ...Array.from({ length: 51 }, (_, i) => `Crate ${i + 1}`)];
    expect(here.map((b) => b.name)).toEqual(all.slice(0, 50));
    expect(here[0]).toMatchObject({ id: shelf, name: 'Crate 0', contentCount: 3 });
    expect(boxes.some((b) => b.id === inner.id || b.id === gone.id)).toBe(false);
    expect(boxes.some((b) => b.name === 'Ladder')).toBe(false);
  });
});

describe('the things list pages with an index', () => {
  it("reads things_name_sort_idx in order for a location's first page and the next", async () => {
    const plan = async (cursor?: string) =>
      withScope(db.pools.app, { userId: louis.userId, mfa: false }, async (_tx, c) => {
        await c.query('SET LOCAL enable_seqscan = off');
        await c.query('SET LOCAL enable_sort = off');
        const q = ListQuery.parse({
          locationId: [home.id],
          limit: 50,
          ...(cursor ? { cursor } : {}),
        });
        const { text, values } = await listThingsSql(c, q);
        const { rows } = await c.query<{ 'QUERY PLAN': string }>(
          `EXPLAIN (COSTS OFF) ${text}`,
          values,
        );
        return rows.map((r) => r['QUERY PLAN']).join('\n');
      });
    const first = await plan();
    expect(first).toContain('things_name_sort_idx');
    expect(first).not.toMatch(/\bSort\b/);
    const page = await get<{ next_cursor: string | null }>(
      `/api/v1/things?locationId=${home.id}&limit=5`,
    );
    expect(page.next_cursor).not.toBeNull();
    const next = await plan(page.next_cursor as string);
    expect(next).toContain('things_name_sort_idx');
    expect(next).not.toMatch(/\bSort\b/);
  });
});

describe('migration 0159', () => {
  it('adds the numeric ICU collation', async () => {
    const rows = await own<{ provider: string; locale: string }>(
      db,
      `SELECT collprovider AS provider, colllocale AS locale FROM pg_collation
        WHERE collname = 'und-u-kn-true'`,
    );
    expect(rows).toEqual([{ provider: 'i', locale: 'und-u-kn' }]);
  });

  it('changes no place’s sort', async () => {
    const source = fileURLToPath(new URL('../../migrations', import.meta.url));
    const folder = await mkdtemp(join(tmpdir(), 'kept-order-migrations-'));
    const name = `kept_test_order_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const url = `postgres://kept_owner:kept_owner@localhost:5452/${name}`;
    try {
      await cp(source, folder, { recursive: true });
      const journalPath = join(folder, 'meta', '_journal.json');
      const journal = JSON.parse(await readFile(journalPath, 'utf8')) as {
        entries: { idx: number; tag: string }[];
      };
      const at = journal.entries.findIndex((e) => e.tag === '0159_natural_order');
      expect(at).toBeGreaterThan(0);
      await writeFile(
        journalPath,
        JSON.stringify({ ...journal, entries: journal.entries.slice(0, at) }),
      );
      await withSuperuser((c) => c.query(`CREATE DATABASE ${name} OWNER kept_owner`));
      await runMigrations(url, { folder });

      const client = new pg.Client({ connectionString: url });
      await client.connect();
      try {
        const user = newId();
        const account = newId();
        const location = newId();
        await client.query('BEGIN');
        await client.query('INSERT INTO auth."user" (id, name, email) VALUES ($1, $2, $3)', [
          user,
          'Ibrahim',
          `ibrahim-${user}@example.test`,
        ]);
        await client.query('INSERT INTO public.owner_accounts (id, user_id) VALUES ($1, $2)', [
          account,
          user,
        ]);
        await client.query(
          `INSERT INTO public.locations (id, owner_account_id, kind, name, timezone, currency)
           VALUES ($1, $2, 'home', 'Home', 'Africa/Cairo', 'EGP')`,
          [location, account],
        );
        await client.query(
          `INSERT INTO public.memberships (location_id, user_id, role) VALUES ($1, $2, 'owner')`,
          [location, user],
        );
        await client.query(
          `INSERT INTO public.places (location_id, name, kind_key, sort)
           SELECT $1, 'Shelf ' || n, CASE WHEN n % 2 = 0 THEN 'floor' ELSE 'room' END, 7 - n
             FROM generate_series(1, 6) n`,
          [location],
        );
        await client.query('COMMIT');
        const before = await client.query('SELECT id, sort FROM public.places ORDER BY id');
        await client.end();
        await runMigrations(url, { folder: source });
        const again = new pg.Client({ connectionString: url });
        await again.connect();
        try {
          const after = await again.query('SELECT id, sort FROM public.places ORDER BY id');
          expect(after.rows).toEqual(before.rows);
          expect(before.rows).toHaveLength(6);
        } finally {
          await again.end();
        }
      } catch (e) {
        await client.end().catch(() => {});
        throw e;
      }
    } finally {
      await withSuperuser((c) => c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`));
      await rm(folder, { recursive: true, force: true });
    }
  }, 120_000);
});
