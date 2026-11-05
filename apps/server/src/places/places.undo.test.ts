import { newId } from '@kept/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import { call, join, type Person, peopleApp, person, type RecordedJob } from '../../test/people.js';
import {
  createLocation,
  createThing,
  eventsOf,
  type Json,
  type Loc,
  ok,
  own,
  place,
  setDisplayName,
} from '../../test/things.js';
import { undoableActions } from '../audit/undo.js';

// Undo of place edits and moves: the `place.update` and
// `place.move` events PATCH /api/v1/places/:id writes, reversed through
// POST /api/v1/audit/:eventId/undo (places/undo.ts). Then the `place.move` lines a trash, a restore
// and the undo of a trash write for the places they move (#441).

let db: TestDb;
let t: TestApp;
const sent: RecordedJob[] = [];
let ola: Person; // owner
let max: Person; // member
let mo: Person; // member
let vic: Person; // viewer
let home: Loc;

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  t = await peopleApp(db, { sent });
  ola = await person(t, db, 'ola');
  max = await person(t, db, 'max');
  mo = await person(t, db, 'mo');
  vic = await person(t, db, 'vic');
  await setDisplayName(db, mo, 'Alfred');
  home = await createLocation(t, db, ola, 'complete');
  await join(db, home.id, max.userId, 'member');
  await join(db, home.id, mo.userId, 'member');
  await join(db, home.id, vic.userId, 'viewer');
});

beforeEach(() => {
  sent.splice(0);
});

const view = async (as: Person, id: string) => ok(await call(t, `/api/v1/places/${id}`, { as }));

async function patch(as: Person, id: string, body: object): Promise<Json> {
  const current = await view(ola, id);
  return ok(
    await call(t, `/api/v1/places/${id}`, {
      method: 'PATCH',
      as,
      headers: { 'if-match': String(current.rowVersion) },
      body,
    }),
  );
}

const undo = (as: Person, eventId: string) =>
  call(t, `/api/v1/audit/${eventId}/undo`, { as, body: {} });

/** The place's audit events, oldest first. */
const auditOfPlace = (id: string) => eventsOf(db, home.id, id);

describe('undo of place.update and place.move', () => {
  it('registers both actions', () => {
    expect(undoableActions()).toEqual(expect.arrayContaining(['place.update', 'place.move']));
  });

  it('undoes an edit: every changed field back, one audit row pointing at it', async () => {
    const p = await place(db, home, 'Attic');
    await patch(max, p, { name: 'Loft', icon: 'lucide:house', sort: 3 });
    const [edit] = (await auditOfPlace(p)).slice(-1);
    expect(edit?.action).toBe('place.update');
    expect(edit?.undoable_until).not.toBeNull();

    const res = ok(await undo(max, edit?.id as string));
    expect(res.undoOf).toBe(edit?.id);
    expect(await view(max, p)).toMatchObject({ name: 'Attic', icon: null });
    const [row] = await own<{ sort: number }>(db, 'SELECT sort FROM public.places WHERE id = $1', [
      p,
    ]);
    expect(row?.sort).toBe(0);
    const [audit] = (await auditOfPlace(p)).slice(-1);
    expect(audit).toMatchObject({
      id: res.eventId,
      action: 'place.update',
      actor_id: max.userId,
      undo_of: edit?.id,
      undoable_until: null,
    });
    expect(audit?.diff).toMatchObject({
      name: { before: 'Loft', after: 'Attic' },
      icon: { before: 'lucide:house', after: null },
      sort: { before: 3, after: 0 },
    });
    expect(sent).toContainEqual({ name: 'reindex', data: { locationId: home.id } });

    const again = await undo(max, edit?.id as string);
    expect(again.statusCode).toBe(409);
  });

  it('undoes a re-parent (place.move): back under the old parent', async () => {
    const wingA = await place(db, home, 'Wing A');
    const wingB = await place(db, home, 'Wing B');
    const den = await place(db, home, 'Den', wingA);
    await patch(max, den, { parentId: wingB });
    const [move] = (await auditOfPlace(den)).slice(-1);
    expect(move?.action).toBe('place.move');

    const res = ok(await undo(max, move?.id as string));
    expect((await view(max, den)).parentId).toBe(wingA);
    const [audit] = (await auditOfPlace(den)).slice(-1);
    expect(audit).toMatchObject({ id: res.eventId, action: 'place.move', undo_of: move?.id });
    expect(audit?.diff).toMatchObject({ parent_id: { before: wingB, after: wingA } });
  });

  it('undoes a move to the top level back under its parent', async () => {
    const block = await place(db, home, 'Block');
    const flat = await place(db, home, 'Flat', block);
    await patch(max, flat, { parentId: null });
    const [move] = (await auditOfPlace(flat)).slice(-1);
    ok(await undo(max, move?.id as string));
    expect((await view(max, flat)).parentId).toBe(block);
  });

  it('refuses when a field changed since, saying who', async () => {
    const p = await place(db, home, 'Porch');
    await patch(max, p, { name: 'Stoop' });
    const [edit] = (await auditOfPlace(p)).slice(-1);
    await patch(mo, p, { name: 'Veranda' });
    const res = await undo(max, edit?.id as string);
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({
      code: 'undo_refused',
      reason: 'changed_since',
      field: 'name',
      conflicts: ['name'],
      changedBy: { displayName: 'Alfred' },
    });
    expect((await view(max, p)).name).toBe('Veranda');
  });

  it('refuses when the old parent is in the trash, or the place itself is', async () => {
    const shed = await place(db, home, 'Shed');
    const barn = await place(db, home, 'Barn');
    const rack = await place(db, home, 'Rack', shed);
    await patch(max, rack, { parentId: barn });
    const [move] = (await auditOfPlace(rack)).slice(-1);
    ok(await call(t, `/api/v1/places/${shed}/trash`, { as: max, body: {} }));
    const res = await undo(max, move?.id as string);
    expect(res.statusCode).toBe(409);
    expect(res.json().hint).toMatch(/trash/);
    expect((await view(max, rack)).parentId).toBe(barn);

    const hut = await place(db, home, 'Hut');
    await patch(max, hut, { name: 'Cabin' });
    const [edit] = (await auditOfPlace(hut)).slice(-1);
    ok(await call(t, `/api/v1/places/${hut}/trash`, { as: max, body: {} }));
    const gone = await undo(max, edit?.id as string);
    expect(gone.statusCode).toBe(409);
    expect(gone.json().hint).toMatch(/trash/);
  });

  it('refuses a loop the tree has grown since (409)', async () => {
    const a = await place(db, home, 'Loop A');
    const b = await place(db, home, 'Loop B');
    // A was under B and moved to the top; then B moved under A. Undoing A's move would put A
    // under its own child.
    await patch(max, a, { parentId: b });
    await patch(max, a, { parentId: null });
    const [aMove] = (await auditOfPlace(a)).slice(-1);
    await patch(max, b, { parentId: a });
    const res = await undo(max, aMove?.id as string);
    expect(res.statusCode).toBe(409);
    expect((await view(max, a)).parentId).toBeNull();
  });

  it('puts custom fields back per key, keeping the money class', async () => {
    const kind = newId();
    await own(
      db,
      `INSERT INTO public.place_kinds (id, owner_account_id, key, name, icon)
       VALUES ($1, $2, 'vault_room', 'Vault room', 'lucide:warehouse')`,
      [kind, home.accountId],
    );
    await own(
      db,
      `INSERT INTO public.type_fields (owner_account_id, place_kind_id, key, label, kind, secret, sort)
       VALUES ($1, $2, 'paint', 'Paint', 'text', false, 1),
              ($1, $2, 'worth', 'Worth', 'money', false, 2)`,
      [home.accountId, kind],
    );
    const p = newId();
    await own(
      db,
      `INSERT INTO public.places (id, location_id, name, kind_key, custom)
       VALUES ($1, $2, 'Strongroom', 'vault_room', '{"paint":"white"}')`,
      [p, home.id],
    );
    await patch(ola, p, { custom: { paint: 'Sage', worth: { amount: '1200', currency: 'EGP' } } });
    const [edit] = (await auditOfPlace(p)).slice(-1);
    expect(edit?.diff['custom.worth']).toMatchObject({ class: 'money' });

    ok(await undo(ola, edit?.id as string));
    expect((await view(ola, p)).custom).toEqual({ paint: 'white' });
    const [audit] = (await auditOfPlace(p)).slice(-1);
    expect(audit?.diff).toMatchObject({
      'custom.paint': { before: 'Sage', after: 'white', class: 'plain' },
      'custom.worth': { before: { amount: '1200', currency: 'EGP' }, after: null, class: 'money' },
    });
  });

  it('refuses to put back a place kind that is archived or gone since (409)', async () => {
    const kindId = newId();
    await own(
      db,
      `INSERT INTO public.place_kinds (id, owner_account_id, key, name, icon)
       VALUES ($1, $2, 'larder_kind', 'Larder', 'lucide:box')`,
      [kindId, home.accountId],
    );
    const p = newId();
    await own(
      db,
      `INSERT INTO public.places (id, location_id, name, kind_key)
       VALUES ($1, $2, 'Larder', 'larder_kind')`,
      [p, home.id],
    );
    await patch(max, p, { kindKey: 'room' });
    const [edit] = (await auditOfPlace(p)).slice(-1);
    await own(db, 'UPDATE public.place_kinds SET archived_at = now() WHERE id = $1', [kindId]);
    const archived = await undo(max, edit?.id as string);
    expect(archived.statusCode, archived.body).toBe(409);
    expect(archived.json().hint).toMatch(/kind/);
    expect((await view(max, p)).kindKey).toBe('room');

    await own(db, 'DELETE FROM public.place_kinds WHERE id = $1', [kindId]);
    const gone = await undo(max, edit?.id as string);
    expect(gone.statusCode, gone.body).toBe(409);
    expect((await view(max, p)).kindKey).toBe('room');
  });

  it("is 403 for a viewer and for a member undoing someone else's change", async () => {
    const p = await place(db, home, 'Cellar');
    await patch(ola, p, { name: 'Wine cellar' });
    const [edit] = (await auditOfPlace(p)).slice(-1);
    expect((await undo(vic, edit?.id as string)).statusCode).toBe(403);
    expect((await undo(max, edit?.id as string)).statusCode).toBe(403);
    expect((await view(ola, p)).name).toBe('Wine cellar');
  });
});

describe('history lines for the places a trash or a restore moves (#441)', () => {
  const trash = (as: Person, id: string, body: object) =>
    call(t, `/api/v1/places/${id}/trash`, { as, body });
  const restore = (as: Person, id: string) =>
    call(t, `/api/v1/places/${id}/restore`, { as, method: 'POST' });
  /** The event the trash's Undo toast sends: the one id in the response's header. */
  const undoId = (res: { headers: Record<string, unknown> }) =>
    res.headers['x-kept-audit-event'] as string;
  const moves = async (id: string) =>
    (await auditOfPlace(id)).filter((e) => e.action === 'place.move');

  it('a trash writes one line per child place it moves out, not undoable, and no more', async () => {
    const room = await place(db, home, 'Workshop');
    const shelf = await place(db, home, 'Shelf', room);
    const tray = await place(db, home, 'Tray', shelf);
    const rack = await place(db, home, 'Rack', shelf);
    const pocket = await place(db, home, 'Pocket', tray);
    const res = await trash(max, shelf, { contents: 'move' });
    const body = ok(res);
    expect(new Set(body.moved as string[])).toEqual(new Set([tray, rack]));

    for (const child of [tray, rack]) {
      const lines = await moves(child);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({
        actor_id: max.userId,
        undo_of: null,
        undoable_until: null,
      });
      expect(lines[0]?.diff.parent_id).toMatchObject({ before: shelf, after: room });
    }
    // What is under a child moved with it, without changing its parent.
    expect(await moves(pocket)).toEqual([]);
    // The trash's own event is the one Undo: the lines aren't a second way to undo.
    expect(undoId(res)).toBe((await auditOfPlace(shelf)).at(-1)?.id);
  });

  it('a trash at the top level, or into a chosen place, says where each child went', async () => {
    const top = await place(db, home, 'Top shed');
    const low = await place(db, home, 'Low shelf', top);
    ok(await trash(max, top, { contents: 'move' }));
    expect((await moves(low))[0]?.diff.parent_id).toMatchObject({ before: top, after: null });

    const from = await place(db, home, 'Old closet');
    const to = await place(db, home, 'New closet');
    const hook = await place(db, home, 'Hook', from);
    ok(await trash(max, from, { contents: 'move', moveTo: { placeId: to } }));
    expect((await moves(hook))[0]?.diff.parent_id).toMatchObject({ before: from, after: to });

    // The Unplaced area takes things only: the child places go to the top level.
    const attic = await place(db, home, 'Old attic');
    const beam = await place(db, home, 'Beam', attic);
    ok(await trash(max, attic, { contents: 'move', moveTo: { placeId: home.unplacedId } }));
    expect((await moves(beam))[0]?.diff.parent_id).toMatchObject({ before: attic, after: null });
  });

  it('a trash that moves no place writes no line', async () => {
    const all = await place(db, home, 'Gone room');
    const corner = await place(db, home, 'Gone corner', all);
    ok(await trash(max, all, { contents: 'trash' }));
    expect(await moves(corner)).toEqual([]);

    const only = await place(db, home, 'Things only');
    await createThing(t, max, home, { name: 'Broom', placeId: only });
    ok(await trash(max, only, { contents: 'move' }));
    expect(await moves(only)).toEqual([]);
  });

  it('a restore whose parent is in the trash writes the line for the top level', async () => {
    const outer = await place(db, home, 'Loft');
    const inner = await place(db, home, 'Loft corner', outer);
    const under = await place(db, home, 'Loft nook', inner);
    ok(await trash(max, inner, { contents: 'trash' }));
    ok(await trash(max, outer, {}));

    ok(await restore(mo, inner));
    expect((await view(mo, inner)).parentId).toBeNull();
    const lines = await moves(inner);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ actor_id: mo.userId, undo_of: null, undoable_until: null });
    expect(lines[0]?.diff.parent_id).toMatchObject({ before: outer, after: null });
    // Trashed with it, and back under it: it didn't move.
    expect((await view(mo, under)).parentId).toBe(inner);
    expect(await moves(under)).toEqual([]);
  });

  it('a restore through a thing of the batch writes the line too', async () => {
    const outer = await place(db, home, 'Barn');
    const inner = await place(db, home, 'Barn stall', outer);
    const pail = await createThing(t, max, home, { name: 'Pail', placeId: inner });
    ok(await trash(max, inner, { contents: 'trash' }));
    ok(await trash(max, outer, {}));
    ok(await call(t, `/api/v1/things/${pail.id}/restore`, { as: max, method: 'POST' }));
    expect((await moves(inner))[0]?.diff.parent_id).toMatchObject({ before: outer, after: null });
  });

  it('a restore that puts a place back where it was writes no line', async () => {
    const hall = await place(db, home, 'Hall');
    const coat = await place(db, home, 'Coat rail', hall);
    ok(await trash(max, coat, {}));
    ok(await restore(max, coat));
    expect((await view(max, coat)).parentId).toBe(hall);
    expect(await moves(coat)).toEqual([]);
  });

  it('undo of the trash puts each child back with a reverse line', async () => {
    const room = await place(db, home, 'Garage');
    const shelf = await place(db, home, 'Garage shelf', room);
    const tray = await place(db, home, 'Garage tray', shelf);
    const res = await trash(max, shelf, { contents: 'move' });
    ok(res);

    ok(await undo(max, undoId(res)));
    expect((await view(max, tray)).parentId).toBe(shelf);
    const lines = await moves(tray);
    expect(lines.map((e) => e.diff.parent_id)).toEqual([
      expect.objectContaining({ before: shelf, after: room }),
      expect.objectContaining({ before: room, after: shelf }),
    ]);
    // Like the trash's, a line of the undo isn't undoable, and isn't the undo's own row.
    expect(lines[1]).toMatchObject({ actor_id: max.userId, undo_of: null, undoable_until: null });
    expect((await auditOfPlace(shelf)).at(-1)).toMatchObject({
      action: 'place.trash',
      undo_of: undoId(res),
    });
  });

  it('undo of the trash writes no line for a child that moved on, or went to the trash', async () => {
    const room = await place(db, home, 'Cellar room');
    const away = await place(db, home, 'Cellar away');
    const shelf = await place(db, home, 'Cellar shelf', room);
    const moved = await place(db, home, 'Cellar moved', shelf);
    const binned = await place(db, home, 'Cellar binned', shelf);
    const res = await trash(max, shelf, { contents: 'move' });
    ok(res);
    await patch(max, moved, { parentId: away });
    ok(await trash(max, binned, {}));

    ok(await undo(max, undoId(res)));
    expect((await view(max, moved)).parentId).toBe(away);
    // The trash's line, then the owner's own move; nothing from the undo.
    expect((await moves(moved)).map((e) => e.diff.parent_id)).toEqual([
      expect.objectContaining({ before: shelf, after: room }),
      expect.objectContaining({ before: room, after: away }),
    ]);
    expect(await moves(binned)).toHaveLength(1);
  });

  it('undo of the trash writes the line when its parent is still in the trash', async () => {
    const outer = await place(db, home, 'Pantry');
    const inner = await place(db, home, 'Pantry shelf', outer);
    const res = await trash(max, inner, {});
    ok(res);
    ok(await trash(max, outer, {}));

    ok(await undo(max, undoId(res)));
    expect((await view(max, inner)).parentId).toBeNull();
    const lines = await moves(inner);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ undo_of: null, undoable_until: null });
    expect(lines[0]?.diff.parent_id).toMatchObject({ before: outer, after: null });
  });

  it('names who moved it when an earlier move can no longer be undone', async () => {
    const wing = await place(db, home, 'East wing');
    const hall = await place(db, home, 'East hall');
    const den = await place(db, home, 'East den', wing);
    await patch(max, den, { parentId: hall });
    const [move] = (await auditOfPlace(den)).slice(-1);
    ok(await trash(mo, hall, { contents: 'move' }));

    const res = await undo(max, move?.id as string);
    expect(res.statusCode, res.body).toBe(409);
    expect(res.json()).toMatchObject({
      reason: 'changed_since',
      field: 'parent_id',
      changedBy: { displayName: 'Alfred' },
    });
  });

  it("reads as a plain move on the place's page, with no Undo; a thing's history is its own", async () => {
    type Row = {
      summaryKey: string;
      summary: string;
      undo_of: string | null;
      undoable_until: string | null;
    };
    const room = await place(db, home, 'Study');
    const shelf = await place(db, home, 'Study shelf', room);
    const tray = await place(db, home, 'Study tray', shelf);
    const pen = await createThing(t, max, home, { name: 'Pen', placeId: tray });
    const ink = await createThing(t, max, home, { name: 'Ink', placeId: shelf });
    const res = await trash(max, shelf, { contents: 'move' });
    ok(res);

    const page = async (url: string) =>
      (ok(await call(t, url, { as: max })) as unknown as { items: Row[] }).items;
    const [line] = await page(`/api/v1/places/${tray}/history`);
    expect(line).toMatchObject({
      summaryKey: 'place.move',
      summary: 'Moved Study tray',
      undo_of: null,
      undoable_until: null,
    });
    // The pen is still on the tray: the tray's move isn't a line of its own in the pen's history.
    const keys = async (id: string) =>
      (await page(`/api/v1/things/${id}/history`)).map((e) => e.summaryKey);
    expect(await keys(pen.id)).not.toContain('place.move');
    // The ink moved with the trash, whose row is in its history.
    expect(await keys(ink.id)).toContain('place.trash');

    ok(await undo(max, undoId(res)));
    const [back] = await page(`/api/v1/places/${tray}/history`);
    expect(back).toMatchObject({
      summaryKey: 'place.move',
      summary: 'Moved Study tray',
      undo_of: null,
      undoable_until: null,
    });
  });

  it("refuses the undo of a room's creation once a trash has moved it, as for any move", async () => {
    const places = `/api/v1/locations/${home.id}/places`;
    const floor = ok(
      await call(t, places, { as: max, body: { name: 'Upstairs', kindKey: 'floor' } }),
      201,
    ).id;
    // Made with its size, so its create has an Undo (#372).
    const made = await call(t, places, {
      as: max,
      body: { name: 'Nursery', kindKey: 'room', parentId: floor, map: { w: 300, d: 300 } },
    });
    const room = ok(made, 201).id;
    ok(await trash(max, floor, { contents: 'move' }));
    const res = await undo(max, undoId(made));
    expect(res.statusCode, res.body).toBe(409);
    expect(res.json()).toMatchObject({ reason: 'changed_since' });
    expect((await view(max, room)).deletedAt ?? null).toBeNull();
  });
});
