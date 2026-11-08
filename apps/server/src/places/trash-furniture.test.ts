import type { LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import { call, join, type Person, peopleApp, person, type RecordedJob } from '../../test/people.js';
import { createLocation, eventsOf, type Loc, ok, own } from '../../test/things.js';

// Trashing furniture made from a place template (#445): its compartments go with it, to the
// trash and back on Restore, and the only question is what happens to what is in it: in the
// furniture itself and in every compartment, a box moving whole with what is inside it, and a
// place someone added to the furniture by hand. Undo puts each one back where it was, and each
// place moved out gets its own history line (#441).
//
// The household: Ibrahim owns Home; Louis is a member there.

let db: TestDb;
let t: TestApp;
let ibrahim: Person;
let louis: Person;
let home: Loc;
const sent: RecordedJob[] = [];

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  t = await peopleApp(db, { sent });
  ibrahim = await person(t, db, 'ibrahim');
  louis = await person(t, db, 'louis');
  home = await createLocation(t, db, ibrahim, 'household', 'Home');
  await join(db, home.id, louis.userId, 'member');
});

afterAll(async () => {
  await t.app.close();
});

type Counts = { places: number; things: number; compartments?: number };
type View = {
  counts: Counts;
  furniture: { compartments: { id: string; n: number; things: number }[] } | null;
};

const auditIds = (res: LightMyRequestResponse) =>
  String(res.headers['x-kept-audit-event'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const trash = (id: string, body: object) =>
  call(t, `/api/v1/places/${id}/trash`, { as: louis, body });
const restore = (id: string) => call(t, `/api/v1/places/${id}/restore`, { as: louis, body: {} });
const undo = (eventId: string) => call(t, `/api/v1/audit/${eventId}/undo`, { as: louis, body: {} });
const view = async (id: string) =>
  ok(await call(t, `/api/v1/places/${id}`, { as: ibrahim })) as unknown as View;

let serial = 0;
async function room(): Promise<string> {
  serial += 1;
  return ok(
    await call(t, `/api/v1/locations/${home.id}/places`, {
      as: ibrahim,
      body: { name: `Bedroom ${serial}`, kindKey: 'room' },
    }),
    201,
  ).id as string;
}

/** A chest of 9 drawers in a new room. */
async function chest() {
  const parent = await room();
  const made = ok(
    await call(t, `/api/v1/locations/${home.id}/places/from-template`, {
      as: ibrahim,
      body: { parentId: parent, template: { builtin: 'chest' }, name: `Chest ${serial}` },
    }),
    201,
  ) as unknown as { place: { id: string }; compartments: { id: string; n: number }[] };
  const drawers = [...made.compartments].sort((a, b) => a.n - b.n).map((c) => c.id);
  return { room: parent, id: made.place.id, drawers };
}

/** A place added by hand, as the API's create does (no cell). */
async function placeIn(parentId: string, name: string): Promise<string> {
  return ok(
    await call(t, `/api/v1/locations/${home.id}/places`, {
      as: ibrahim,
      body: { parentId, name, kindKey: 'zone' },
    }),
    201,
  ).id as string;
}

async function thing(name: string, where: { placeId?: string; containerId?: string }) {
  return ok(
    await call(t, '/api/v1/things', {
      as: ibrahim,
      body: { locationId: home.id, name, ...where },
    }),
    201,
  ).id as string;
}

const placeRow = async (id: string) =>
  (
    await own<{ parent_id: string | null; deleted: boolean; batch: string | null; cell: unknown }>(
      db,
      `SELECT parent_id, deleted_at IS NOT NULL AS deleted, trash_batch_id AS batch, cell
         FROM public.places WHERE id = $1`,
      [id],
    )
  )[0];
const thingRow = async (id: string) =>
  (
    await own<{
      place_id: string | null;
      container_id: string | null;
      deleted: boolean;
      batch: string | null;
    }>(
      db,
      `SELECT place_id, container_id, deleted_at IS NOT NULL AS deleted, trash_batch_id AS batch
         FROM public.things WHERE id = $1`,
      [id],
    )
  )[0];
const moveLines = async (id: string) =>
  (await eventsOf(db, home.id, id)).filter((e) => e.action === 'place.move');

describe('trashing furniture with compartments (#445)', () => {
  it('empty furniture: no question, its compartments go with it and come back on Restore', async () => {
    const c = await chest();
    const res = await trash(c.id, {});
    const body = ok(res) as unknown as { trashed: string[]; trashBatchId: string };
    expect(new Set(body.trashed)).toEqual(new Set([c.id, ...c.drawers]));
    for (const d of c.drawers) {
      expect(await placeRow(d)).toMatchObject({ deleted: true, batch: body.trashBatchId });
      expect((await placeRow(d))?.cell).not.toBeNull();
    }
    // The room holds no loose drawers.
    expect((await view(c.room)).counts.places).toBe(0);
    // Its history line counts no compartment as something inside.
    const [event] = (await eventsOf(db, home.id, c.id)).filter((e) => e.action === 'place.trash');
    expect(event?.diff.trashed?.after).toBe(1);

    const back = ok(await restore(c.id)) as unknown as { restored: string[]; hint?: string };
    expect(new Set(back.restored)).toEqual(new Set([c.id, ...c.drawers]));
    expect(back.hint).toBeUndefined();
    const f = (await view(c.id)).furniture;
    expect(f?.compartments.map((x) => x.id)).toEqual(c.drawers);
  });

  it('asks only about what is in it: every compartment, and places added by hand', async () => {
    const c = await chest();
    await thing('Socks', { placeId: c.drawers[0] });
    const box = await thing('Tie box', { placeId: c.drawers[1] });
    await thing('Tie', { containerId: box });
    await placeIn(c.id, 'Top tray');
    await placeIn(c.drawers[2] as string, 'Divider');
    const res = await trash(c.id, {});
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({
      code: 'contents_choice_required',
      // The box counts once: it moves whole.
      counts: { places: 2, things: 2, compartments: 9 },
    });
    expect((await placeRow(c.id))?.deleted).toBe(false);
  });

  it('a place added by hand is still asked about, and moves to the room', async () => {
    const c = await chest();
    const tray = await placeIn(c.id, 'Top tray');
    const res = await trash(c.id, {});
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ counts: { places: 1, things: 0, compartments: 9 } });
    const body = ok(await trash(c.id, { contents: 'move' })) as unknown as { moved: string[] };
    expect(body.moved).toEqual([tray]);
    expect(await placeRow(tray)).toMatchObject({ parent_id: c.room, deleted: false });
    for (const d of c.drawers) expect((await placeRow(d))?.deleted).toBe(true);
  });

  it('Move: what is in the drawers goes to the room, a box whole; the drawers go to the trash', async () => {
    const c = await chest();
    const socks = await thing('Socks', { placeId: c.drawers[0] });
    const box = await thing('Tie box', { placeId: c.drawers[1] });
    const tie = await thing('Tie', { containerId: box });
    const scarf = await thing('Scarf', { placeId: c.id });
    const tray = await placeIn(c.id, 'Top tray');
    const divider = await placeIn(c.drawers[2] as string, 'Divider');
    const pin = await thing('Pin', { placeId: divider });

    const res = await trash(c.id, { contents: 'move' });
    const body = ok(res) as unknown as { trashed: string[]; moved: string[] };
    expect(new Set(body.trashed)).toEqual(new Set([c.id, ...c.drawers]));
    expect(new Set(body.moved)).toEqual(new Set([socks, box, scarf, tray, divider]));

    for (const id of [socks, box, scarf]) {
      expect(await thingRow(id)).toMatchObject({ place_id: c.room, deleted: false });
    }
    // The box moved with what is in it.
    expect(await thingRow(tie)).toMatchObject({ container_id: box, deleted: false });
    for (const id of [tray, divider]) {
      expect(await placeRow(id)).toMatchObject({ parent_id: c.room, deleted: false });
    }
    expect(await thingRow(pin)).toMatchObject({ place_id: divider, deleted: false });
    for (const d of c.drawers) expect((await placeRow(d))?.deleted).toBe(true);
    // No loose drawers in the room: only what came out of them.
    expect((await view(c.room)).counts).toEqual({ places: 2, things: 3 });

    // One history line per place moved out, from where it really was (#441).
    expect((await moveLines(tray))[0]?.diff.parent_id).toMatchObject({
      before: c.id,
      after: c.room,
    });
    expect((await moveLines(divider))[0]?.diff.parent_id).toMatchObject({
      before: c.drawers[2],
      after: c.room,
    });

    // Undo puts every one back where it was, the drawers too.
    const [eventId] = auditIds(res);
    ok(await undo(eventId as string));
    for (const d of c.drawers) expect((await placeRow(d))?.deleted).toBe(false);
    expect(await thingRow(socks)).toMatchObject({ place_id: c.drawers[0] });
    expect(await thingRow(box)).toMatchObject({ place_id: c.drawers[1] });
    expect(await thingRow(tie)).toMatchObject({ container_id: box });
    expect(await thingRow(scarf)).toMatchObject({ place_id: c.id });
    expect(await placeRow(tray)).toMatchObject({ parent_id: c.id });
    expect(await placeRow(divider)).toMatchObject({ parent_id: c.drawers[2] });
    expect((await moveLines(divider)).at(-1)?.diff.parent_id).toMatchObject({
      before: c.room,
      after: c.drawers[2],
    });
    const f = (await view(c.id)).furniture;
    expect(f?.compartments.find((x) => x.id === c.drawers[0])?.things).toBe(1);
  });

  it('Move to a place picked: there, and Restore brings the drawers back empty', async () => {
    const c = await chest();
    const other = await room();
    const socks = await thing('Socks', { placeId: c.drawers[4] });
    ok(await trash(c.id, { contents: 'move', moveTo: { placeId: other } }));
    expect(await thingRow(socks)).toMatchObject({ place_id: other });

    const back = ok(await restore(c.id)) as unknown as { restored: string[] };
    expect(new Set(back.restored)).toEqual(new Set([c.id, ...c.drawers]));
    expect(await thingRow(socks)).toMatchObject({ place_id: other });
  });

  it('a drawer of the furniture is no place to move its contents to', async () => {
    const c = await chest();
    await thing('Socks', { placeId: c.drawers[0] });
    const res = await trash(c.id, { contents: 'move', moveTo: { placeId: c.drawers[1] } });
    expect(res.statusCode).toBe(409);
  });

  it('Trash them too: one batch, and Restore puts everything back as it was', async () => {
    const c = await chest();
    const socks = await thing('Socks', { placeId: c.drawers[0] });
    const box = await thing('Tie box', { placeId: c.drawers[1] });
    const tie = await thing('Tie', { containerId: box });
    const tray = await placeIn(c.id, 'Top tray');
    const res = await trash(c.id, { contents: 'trash' });
    const body = ok(res) as unknown as { trashed: string[]; trashBatchId: string };
    expect(new Set(body.trashed)).toEqual(new Set([c.id, ...c.drawers, socks, box, tie, tray]));
    for (const id of [socks, box, tie]) {
      expect(await thingRow(id)).toMatchObject({ deleted: true, batch: body.trashBatchId });
    }
    // Its history line counts what was inside, not the drawers.
    const [event] = (await eventsOf(db, home.id, c.id)).filter((e) => e.action === 'place.trash');
    expect(event?.diff.trashed?.after).toBe(5);

    ok(await restore(c.id));
    expect(await thingRow(socks)).toMatchObject({ place_id: c.drawers[0], deleted: false });
    expect(await thingRow(box)).toMatchObject({ place_id: c.drawers[1], deleted: false });
    expect(await thingRow(tie)).toMatchObject({ container_id: box, deleted: false });
    expect(await placeRow(tray)).toMatchObject({ parent_id: c.id, deleted: false });
    expect((await view(c.id)).furniture?.compartments).toHaveLength(9);
  });

  it('a place with places inside that is not furniture asks as before', async () => {
    const r = await room();
    const shelf = await placeIn(r, 'Shelf');
    const res = await trash(r, {});
    expect(res.statusCode).toBe(409);
    expect(res.json().counts).toEqual({ places: 1, things: 0 });
    ok(await trash(r, { contents: 'move' }));
    expect((await placeRow(shelf))?.deleted).toBe(false);
  });
});
