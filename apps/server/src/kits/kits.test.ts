import { beforeAll, describe, expect, it } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import { call, join, type Person, peopleApp, person } from '../../test/people.js';
import {
  builtinType,
  createLocation,
  createThing,
  eventsOf,
  type Json,
  type Loc,
  ok,
  own,
  place,
} from '../../test/things.js';

// Kits (1.14, #170) through the front door: a container with a parts list; each part's status
// (in the kit, elsewhere, missing, with someone, in the Trash); one kit per part; parts of the
// kit's own location; make, edit and dissolve, each undoable; a viewer reads.

let db: TestDb;
let t: TestApp;
let ibrahim: Person;
let louis: Person;
let talia: Person;
let home: Loc;
let cottage: Loc;
let boxType: string;
let murdock: string;

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  t = await peopleApp(db);
  ibrahim = await person(t, db, 'ibrahim');
  louis = await person(t, db, 'louis');
  talia = await person(t, db, 'talia');
  home = await createLocation(t, db, ibrahim, 'complete');
  cottage = await createLocation(t, db, ibrahim, 'complete', 'Cottage');
  await join(db, home.id, louis.userId, 'member');
  await join(db, home.id, talia.userId, 'viewer');
  boxType = await builtinType(db, 'box_bin');
  const [m] = await own<{ id: string }>(
    db,
    `INSERT INTO public.people (owner_account_id, display_name) VALUES ($1, 'Murdock') RETURNING id`,
    [home.accountId],
  );
  murdock = m?.id as string;
});

const send = (
  as: Person,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  body?: unknown,
  version?: number,
) =>
  call(t, url, {
    as,
    method,
    ...(body !== undefined ? { body } : {}),
    ...(version !== undefined ? { headers: { 'if-match': String(version) } } : {}),
  });
const kitOf = async (as: Person, id: string) =>
  ok(await call(t, `/api/v1/things/${id}/kit`, { as })).kit as Json | null;
const statusOf = (kit: Json, thingId: string) =>
  (kit.parts as { thing: { id: string }; status: string }[]).find((p) => p.thing.id === thingId)
    ?.status;
const undo = (as: Person, eventId: string) =>
  call(t, `/api/v1/audit/${eventId}/undo`, { as, body: {} });

async function bag(prefix: string) {
  const study = await place(db, home, `${prefix} study`);
  const kit = await createThing(t, ibrahim, home, {
    name: `${prefix} camera bag`,
    typeId: boxType,
    placeId: study,
  });
  const body = await createThing(t, ibrahim, home, { name: 'Camera body', containerId: kit.id });
  const lens = await createThing(t, ibrahim, home, { name: 'Lens', containerId: kit.id });
  const battery = await createThing(t, ibrahim, home, { name: 'Spare battery', placeId: study });
  return { study, kit, body, lens, battery };
}

describe('a kit', () => {
  // catalogue: POST /api/v1/things/:id/kit
  it('is a container with a parts list, each part where it is now', async () => {
    const b = await bag('A');
    expect(await kitOf(talia, b.kit.id)).toBeNull();
    // A viewer can't make one.
    expect(
      (await send(talia, 'POST', `/api/v1/things/${b.kit.id}/kit`, { parts: [] })).statusCode,
    ).toBe(403);
    const made = await send(louis, 'POST', `/api/v1/things/${b.kit.id}/kit`, {
      parts: [
        { thingId: b.body.id },
        { thingId: b.lens.id },
        { thingId: b.battery.id, quantity: '2' },
      ],
    });
    expect(made.statusCode, made.body).toBe(201);
    const kit = made.json() as Json;
    expect(kit.summary).toEqual({ parts: 3, inKit: 2, notInKit: 1, complete: false });
    expect(statusOf(kit, b.battery.id)).toBe('elsewhere');
    expect((kit.parts as Json[]).find((p) => (p.thing as Json).id === b.battery.id)).toMatchObject({
      quantity: '2',
      where: { id: b.study, name: 'A study' },
    });
    const [event] = (await eventsOf(db, home.id, b.kit.id)).filter(
      (e) => e.action === 'kit.create',
    );
    expect(event?.diff).toMatchObject({ kit: { before: null, after: true } });

    // Not here, lent, in the Trash.
    await own(db, 'UPDATE public.things SET location_uncertain = true WHERE id = $1', [b.lens.id]);
    expect(statusOf((await kitOf(talia, b.kit.id)) as Json, b.lens.id)).toBe('in_kit');
    await own(db, `UPDATE public.things SET container_id = NULL, place_id = $2 WHERE id = $1`, [
      b.lens.id,
      b.study,
    ]);
    expect(statusOf((await kitOf(talia, b.kit.id)) as Json, b.lens.id)).toBe('missing');
    ok(
      await send(ibrahim, 'POST', `/api/v1/things/${b.battery.id}/lend`, {
        person: { id: murdock },
      }),
      201,
    );
    const lent = (await kitOf(talia, b.kit.id)) as Json;
    expect(statusOf(lent, b.battery.id)).toBe('with_someone');
    ok(await send(ibrahim, 'POST', `/api/v1/things/${b.body.id}/trash`, {}));
    expect(statusOf((await kitOf(talia, b.kit.id)) as Json, b.body.id)).toBe('trashed');
  });

  it('takes a part of no other kit, of its own location, never itself', async () => {
    const a = await bag('B');
    const other = await createThing(t, ibrahim, home, { name: 'Second bag', typeId: boxType });
    ok(
      await send(ibrahim, 'POST', `/api/v1/things/${a.kit.id}/kit`, {
        parts: [{ thingId: a.body.id }],
      }),
      201,
    );
    const taken = await send(ibrahim, 'POST', `/api/v1/things/${other.id}/kit`, {
      parts: [{ thingId: a.body.id }],
    });
    expect(taken.statusCode).toBe(409);
    expect(taken.json()).toMatchObject({ code: 'in_another_kit', kit: 'B camera bag' });
    const far = await createThing(t, ibrahim, cottage, { name: 'Far tripod' });
    expect(
      (
        await send(ibrahim, 'POST', `/api/v1/things/${other.id}/kit`, {
          parts: [{ thingId: far.id }],
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await send(ibrahim, 'POST', `/api/v1/things/${other.id}/kit`, {
          parts: [{ thingId: other.id }],
        })
      ).statusCode,
    ).toBe(400);
  });

  // catalogue: PUT /api/v1/things/:id/kit
  // catalogue: DELETE /api/v1/things/:id/kit
  it('changes its parts and is dissolved, each undone', async () => {
    const b = await bag('C');
    const made = ok(
      await send(ibrahim, 'POST', `/api/v1/things/${b.kit.id}/kit`, {
        parts: [{ thingId: b.body.id }, { thingId: b.lens.id }],
      }),
      201,
    );
    expect((made.summary as Json).complete).toBe(true);
    const put = await send(
      louis,
      'PUT',
      `/api/v1/things/${b.kit.id}/kit`,
      { parts: [{ thingId: b.body.id }] },
      made.rowVersion as number,
    );
    expect(put.statusCode, put.body).toBe(200);
    expect(((put.json() as Json).summary as Json).parts).toBe(1);
    const updated = (await eventsOf(db, home.id, b.kit.id)).filter(
      (e) => e.action === 'kit.update',
    );
    expect(updated).toHaveLength(1);
    ok(await undo(louis, put.headers['x-kept-audit-event'] as string));
    expect((((await kitOf(louis, b.kit.id)) as Json).summary as Json).parts).toBe(2);

    const gone = await send(louis, 'DELETE', `/api/v1/things/${b.kit.id}/kit`);
    expect(gone.statusCode).toBe(204);
    expect(await kitOf(louis, b.kit.id)).toBeNull();
    expect((await eventsOf(db, home.id, b.kit.id)).at(-1)).toMatchObject({
      action: 'kit.dissolve',
    });
    ok(await undo(louis, gone.headers['x-kept-audit-event'] as string));
    expect((((await kitOf(louis, b.kit.id)) as Json).summary as Json).parts).toBe(2);
  });

  it('lists a location’s kits, the incomplete ones on their own', async () => {
    const loc = await createLocation(t, db, ibrahim, 'complete', 'Studio');
    const full = await createThing(t, ibrahim, loc, { name: 'Full kit', typeId: boxType });
    const inFull = await createThing(t, ibrahim, loc, { name: 'Tripod', containerId: full.id });
    const short = await createThing(t, ibrahim, loc, { name: 'Short kit', typeId: boxType });
    const away = await createThing(t, ibrahim, loc, { name: 'Light' });
    for (const [k, p] of [
      [full.id, inFull.id],
      [short.id, away.id],
    ] as const)
      ok(await send(ibrahim, 'POST', `/api/v1/things/${k}/kit`, { parts: [{ thingId: p }] }), 201);
    const all = ok(await call(t, `/api/v1/locations/${loc.id}/kits`, { as: ibrahim }));
    expect((all.items as Json[]).map((i) => (i.thing as Json).name)).toEqual([
      'Full kit',
      'Short kit',
    ]);
    const incomplete = ok(
      await call(t, `/api/v1/locations/${loc.id}/kits?incomplete=1`, { as: ibrahim }),
    );
    expect((incomplete.items as Json[]).map((i) => (i.thing as Json).name)).toEqual(['Short kit']);
    // The things lists' filters: Kits, Incomplete kits.
    const search = async (state: string) =>
      (
        ok(await call(t, `/api/v1/search?locationId=${loc.id}&state=${state}`, { as: ibrahim }))
          .things as { items: Json[] }
      ).items.map((i) => i.name);
    expect((await search('kit')).sort()).toEqual(['Full kit', 'Short kit']);
    expect(await search('kit_incomplete')).toEqual(['Short kit']);
  });

  it('lent as a whole: its parts inside go with it, and one kept elsewhere when asked', async () => {
    const b = await bag('D');
    ok(
      await send(ibrahim, 'POST', `/api/v1/things/${b.kit.id}/kit`, {
        parts: [{ thingId: b.body.id }, { thingId: b.lens.id }, { thingId: b.battery.id }],
      }),
      201,
    );
    const res = ok(
      await send(ibrahim, 'POST', `/api/v1/things/${b.kit.id}/lend`, {
        person: { id: murdock },
        alsoParts: [b.battery.id],
      }),
      201,
    );
    expect(((res.handover as Json).counts as Json).lines).toBe(4);
    const kit = (await kitOf(talia, b.kit.id)) as Json;
    expect(kit.lent).toMatchObject({ person: 'Murdock' });
    // The part kept elsewhere went with it: the kit is whole, with Murdock.
    expect(kit.summary).toMatchObject({ inKit: 3, notInKit: 0, complete: true });
    // Not a part: refused.
    const stray = await createThing(t, ibrahim, home, { name: 'Stray' });
    const again = await createThing(t, ibrahim, home, { name: 'E bag', typeId: boxType });
    ok(await send(ibrahim, 'POST', `/api/v1/things/${again.id}/kit`, { parts: [] }), 201);
    expect(
      (
        await send(ibrahim, 'POST', `/api/v1/things/${again.id}/lend`, {
          person: { id: murdock },
          alsoParts: [stray.id],
        })
      ).statusCode,
    ).toBe(400);
  });
});
