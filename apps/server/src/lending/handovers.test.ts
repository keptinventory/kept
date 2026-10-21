import { addDays } from '@kept/shared';
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
  setDisplayName,
} from '../../test/things.js';

// Hand-overs (1.14, #170) through the front door: lending a box makes one hand-over with a line
// per thing inside it; each line comes back on its own (came back in a condition, damaged, not
// returned, lost, part of a quantity); something with someone is moved or trashed only when
// confirmed; the due-soon reminder; the lend's undo; the history names the person.

let db: TestDb;
let t: TestApp;
let ibrahim: Person; // owner of Home
let louis: Person; // member
let talia: Person; // viewer
let home: Loc;
let boxType: string;
let today: string;
let murdock: string;
let alex: string;

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  t = await peopleApp(db);
  ibrahim = await person(t, db, 'ibrahim');
  louis = await person(t, db, 'louis');
  talia = await person(t, db, 'talia');
  await setDisplayName(db, ibrahim, 'Ibrahim');
  await setDisplayName(db, louis, 'Louis');
  home = await createLocation(t, db, ibrahim, 'complete');
  await join(db, home.id, louis.userId, 'member');
  await join(db, home.id, talia.userId, 'viewer');
  boxType = await builtinType(db, 'box_bin');
  const [row] = await own<{ today: string }>(
    db,
    `SELECT (now() AT TIME ZONE 'Africa/Cairo')::date::text AS today`,
  );
  today = row?.today as string;
  const people = await own<{ id: string; display_name: string }>(
    db,
    `INSERT INTO public.people (owner_account_id, display_name)
     VALUES ($1, 'Murdock'), ($1, 'Alex') RETURNING id, display_name`,
    [home.accountId],
  );
  murdock = people.find((p) => p.display_name === 'Murdock')?.id as string;
  alex = people.find((p) => p.display_name === 'Alex')?.id as string;
});

const post = (as: Person, url: string, body: unknown, version?: number) =>
  call(t, url, {
    as,
    body,
    ...(version !== undefined ? { headers: { 'if-match': String(version) } } : {}),
  });
const undo = (as: Person, eventId: string) =>
  call(t, `/api/v1/audit/${eventId}/undo`, { as, body: {} });
const lend = async (as: Person, thingId: string, body: Record<string, unknown>) =>
  ok(await post(as, `/api/v1/things/${thingId}/lend`, body), 201);
const thing = (id: string) =>
  own<{
    quantity: string;
    lifecycle: string;
    condition: string | null;
    deleted_at: Date | null;
    container_id: string | null;
  }>(
    db,
    `SELECT trim_scale(quantity)::text AS quantity, lifecycle, condition, deleted_at, container_id
       FROM public.things WHERE id = $1`,
    [id],
  ).then((r) => r[0]);

type Line = Json & {
  id: string;
  thingId: string;
  pathAtLend: string | null;
  returnedAt: string | null;
  outcome: string | null;
  rowVersion: number;
};
const linesOf = (h: Json) => h.lines as Line[];
const lineOf = (h: Json, thingId: string) => linesOf(h).find((l) => l.thingId === thingId) as Line;

/** A camera bag with a lens pouch inside, a lens in the pouch, a strap, and 5 batteries. */
async function cameraBag(prefix: string) {
  const study = await place(db, home, `${prefix} study`);
  const bag = await createThing(t, ibrahim, home, {
    name: `${prefix} camera bag`,
    typeId: boxType,
    placeId: study,
  });
  const pouch = await createThing(t, ibrahim, home, {
    name: 'Lens pouch',
    typeId: boxType,
    containerId: bag.id,
  });
  const lens = await createThing(t, ibrahim, home, { name: 'Wide lens', containerId: pouch.id });
  const strap = await createThing(t, ibrahim, home, { name: 'Strap', containerId: bag.id });
  const batteries = await createThing(t, ibrahim, home, {
    name: 'AA batteries',
    containerId: bag.id,
    quantity: 5,
  });
  return { study, bag, pouch, lens, strap, batteries };
}

describe('lending a box', () => {
  it('makes one hand-over with a line for it and for everything inside, all the way down', async () => {
    const k = await cameraBag('A');
    // Already with Alex: it stays behind, and the answer says so.
    const cable = await createThing(t, ibrahim, home, { name: 'Cable', containerId: k.bag.id });
    await lend(ibrahim, cable.id, { person: { id: alex } });
    // No longer in use: it stays behind too.
    const old = await createThing(t, ibrahim, home, { name: 'Old cap', containerId: k.bag.id });
    await own(
      db,
      `UPDATE public.things SET lifecycle = 'sold', ended_on = current_date WHERE id = $1`,
      [old.id],
    );

    const res = await lend(louis, k.bag.id, {
      person: { id: murdock },
      dueOn: addDays(today, 7),
      conditionOut: 'good',
      notes: 'For the trip',
    });
    const h = res.handover as Json;
    expect(h).toMatchObject({
      person: { id: murdock, name: 'Murdock' },
      root: { id: k.bag.id },
      leadDays: 2,
      counts: { lines: 5, open: 5, returned: 0, lost: 0 },
    });
    expect(lineOf(h, k.lens.id)).toMatchObject({
      pathAtLend: 'A camera bag › Lens pouch',
      with: { id: k.bag.id },
      condition: { out: 'good', in: null },
      notes: 'For the trip',
    });
    expect(lineOf(h, k.strap.id).pathAtLend).toBe('A camera bag');
    expect(lineOf(h, k.bag.id).pathAtLend).toBeNull();
    expect((res.excluded as Json[]).map((x) => [x.thingId, x.reason, x.with])).toEqual(
      expect.arrayContaining([
        [cable.id, 'on_loan', 'Alex'],
        [old.id, 'ended', null],
      ]),
    );
    // Every line is a loan: the lens reads as lent, and nothing moved.
    const lens = ok(await call(t, `/api/v1/things/${k.lens.id}`, { as: talia }));
    expect(lens.derivedState).toEqual(['lent']);
    expect(lens.loanLine).toMatchObject({ personName: 'Murdock', withName: 'A camera bag' });
    expect((await thing(k.lens.id))?.container_id).toBe(k.pouch.id);
    // A viewer reads the hand-over.
    expect(ok(await call(t, `/api/v1/handovers/${h.id}`, { as: talia })).counts).toMatchObject({
      open: 5,
    });
    // The history names the person.
    const history = ok(await call(t, `/api/v1/things/${k.lens.id}/history`, { as: ibrahim }));
    expect(JSON.stringify(history)).toContain('to Murdock');
    // The box's hand-overs.
    const listed = ok(await call(t, `/api/v1/things/${k.bag.id}/handovers`, { as: talia }));
    expect((listed.items as Json[]).map((x) => x.id)).toEqual([h.id]);
  });

  it('refuses what has ended', async () => {
    const cup = await createThing(t, ibrahim, home, { name: 'Sold cup' });
    await own(
      db,
      `UPDATE public.things SET lifecycle = 'sold', ended_on = current_date WHERE id = $1`,
      [cup.id],
    );
    expect(
      (await post(ibrahim, `/api/v1/things/${cup.id}/lend`, { person: { id: murdock } }))
        .statusCode,
    ).toBe(409);
  });

  it('is undone as a whole while nothing changed, and not after a line came back', async () => {
    const k = await cameraBag('B');
    const res = await post(ibrahim, `/api/v1/things/${k.bag.id}/lend`, { person: { id: murdock } });
    expect(res.statusCode, res.body).toBe(201);
    const h = (res.json() as Json).handover as Json;
    const eventId = res.headers['x-kept-audit-event'] as string;
    ok(await undo(ibrahim, eventId));
    expect(await own(db, 'SELECT 1 FROM public.handovers WHERE id = $1', [h.id])).toEqual([]);
    expect(
      await own(db, 'SELECT 1 FROM public.loans WHERE thing_id = $1 AND returned_at IS NULL', [
        k.lens.id,
      ]),
    ).toEqual([]);

    const again = await post(ibrahim, `/api/v1/things/${k.bag.id}/lend`, {
      person: { id: murdock },
    });
    const h2 = (again.json() as Json).handover as Json;
    const strap = lineOf(h2, k.strap.id);
    ok(await post(ibrahim, `/api/v1/loans/${strap.id}/return`, {}, strap.rowVersion));
    expect((await undo(ibrahim, again.headers['x-kept-audit-event'] as string)).statusCode).toBe(
      409,
    );
  });

  it('puts a part lent from a quantity back into its row on undo', async () => {
    const pens = await createThing(t, ibrahim, home, { name: 'Pens', quantity: 10 });
    const res = await post(ibrahim, `/api/v1/things/${pens.id}/lend`, {
      person: { id: murdock },
      quantity: '4',
    });
    expect(res.statusCode, res.body).toBe(201);
    const part = ((res.json() as Json).thing as Json).id as string;
    expect((await thing(pens.id))?.quantity).toBe('6');
    ok(await undo(ibrahim, res.headers['x-kept-audit-event'] as string));
    expect((await thing(pens.id))?.quantity).toBe('10');
    expect((await thing(part))?.deleted_at).not.toBeNull();
  });
});

describe('returning a hand-over', () => {
  // catalogue: POST /api/v1/handovers/:id/return
  // catalogue: POST /api/v1/loans/:id/lost
  it('closes each line as it says: back in a condition, damaged, not returned, lost, part of it', async () => {
    const k = await cameraBag('C');
    const res = await lend(ibrahim, k.bag.id, { person: { id: murdock }, notes: 'Lend note' });
    const h = res.handover as Json;
    // A viewer can't.
    expect(
      (
        await post(talia, `/api/v1/handovers/${h.id}/return`, {
          lines: [{ loanId: lineOf(h, k.bag.id).id, outcome: 'back' }],
        })
      ).statusCode,
    ).toBe(403);

    const back = await post(louis, `/api/v1/handovers/${h.id}/return`, {
      lines: [
        {
          loanId: lineOf(h, k.bag.id).id,
          outcome: 'back',
          conditionIn: 'fair',
          updateCondition: true,
        },
        { loanId: lineOf(h, k.pouch.id).id, outcome: 'back' },
        {
          loanId: lineOf(h, k.lens.id).id,
          outcome: 'damaged',
          conditionIn: 'broken',
          notes: 'Cracked',
        },
        { loanId: lineOf(h, k.strap.id).id, outcome: 'lost', notes: 'Left on a train' },
        { loanId: lineOf(h, k.batteries.id).id, outcome: 'back', quantityBack: '3' },
      ],
    });
    expect(back.statusCode, back.body).toBe(200);
    const after = back.json() as Json;
    // The rest of the batteries stays out on a line of its own.
    expect(after.counts).toMatchObject({ lines: 6, open: 1, returned: 4, lost: 1 });
    expect(lineOf(after, k.bag.id)).toMatchObject({
      outcome: 'returned',
      condition: { in: 'fair' },
    });
    expect(lineOf(after, k.lens.id)).toMatchObject({
      outcome: 'returned',
      condition: { in: 'broken' },
      returnNotes: 'Cracked',
      notes: 'Lend note',
    });
    expect((await thing(k.bag.id))?.condition).toBe('fair');
    expect((await thing(k.lens.id))?.condition).toBeNull();
    expect(lineOf(after, k.strap.id).outcome).toBe('lost');
    expect((await thing(k.strap.id))?.lifecycle).toBe('lost');
    expect((await thing(k.batteries.id))?.quantity).toBe('3');
    const restLine = linesOf(after).find((l) => l.returnedAt === null) as Line;
    expect((await thing(restLine.thingId))?.quantity).toBe('2');
    expect(restLine.pathAtLend).toBe('C camera bag');

    // Each line's event is in its thing's history; the loss is `loan.lost`.
    const lost = (await eventsOf(db, home.id, lineOf(h, k.strap.id).id)).find(
      (e) => e.action === 'loan.lost',
    );
    expect(lost?.diff).toMatchObject({ outcome: { after: 'lost' } });

    // Undo: the loss, and the part return (the rest joins it again).
    const ids = (back.headers['x-kept-audit-event'] as string).split(', ');
    for (const id of ids) ok(await undo(louis, id));
    const reopened = ok(await call(t, `/api/v1/handovers/${h.id}`, { as: ibrahim }));
    expect(reopened.counts).toMatchObject({ lines: 5, open: 5, returned: 0, lost: 0 });
    expect((await thing(k.strap.id))?.lifecycle).toBe('in_use');
    expect((await thing(k.batteries.id))?.quantity).toBe('5');
    expect((await thing(k.bag.id))?.condition).toBeNull();

    // A line resolved later on its own: lost.
    const strap = lineOf(reopened, k.strap.id);
    const gone = await post(ibrahim, `/api/v1/loans/${strap.id}/lost`, {}, strap.rowVersion);
    expect(gone.statusCode, gone.body).toBe(200);
    expect((await eventsOf(db, home.id, strap.id)).at(-1)).toMatchObject({ action: 'loan.lost' });
  });

  // catalogue: PATCH /api/v1/handovers/:id
  it('changes the due date and the due-soon lead of its open lines', async () => {
    const drill = await createThing(t, ibrahim, home, { name: 'Drill' });
    const res = await lend(ibrahim, drill.id, {
      person: { id: murdock },
      dueOn: addDays(today, 10),
    });
    const h = res.handover as Json;
    const changed = await call(t, `/api/v1/handovers/${h.id}`, {
      as: louis,
      method: 'PATCH',
      body: { dueOn: addDays(today, 1), leadDays: 3 },
      headers: { 'if-match': String(h.rowVersion) },
    });
    expect(changed.statusCode, changed.body).toBe(200);
    expect(lineOf(changed.json() as Json, drill.id)).toMatchObject({ dueOn: addDays(today, 1) });
    const [event] = (await eventsOf(db, home.id, h.id as string)).filter(
      (e) => e.action === 'handover.update',
    );
    expect(event?.diff).toMatchObject({ lead_days: { before: 2, after: 3 } });
    // Due in a day, three days' lead: due now, and reminded.
    const items = await own<{ kind: string; state: string }>(
      db,
      `SELECT kind, state FROM public.agenda_items WHERE source_type = 'loan' AND source_id = $1`,
      [lineOf(h, drill.id).id],
    );
    expect(items).toEqual([{ kind: 'due', state: 'due' }]);
  });
});

describe('with someone: asked first', () => {
  it('moves or trashes a thing that is with someone, or packs into a lent box, only when confirmed', async () => {
    const k = await cameraBag('D');
    await lend(ibrahim, k.bag.id, { person: { id: murdock } });
    const shelf = await place(db, home, 'D shelf');
    const move = (body: Record<string, unknown>) =>
      call(t, '/api/v1/things/move', { as: ibrahim, body });
    const refused = await move({ thingIds: [k.lens.id], to: { placeId: shelf } });
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ code: 'on_loan', with: { person: 'Murdock' } });
    const mug = await createThing(t, ibrahim, home, { name: 'Mug' });
    expect((await move({ thingIds: [mug.id], to: { containerId: k.pouch.id } })).statusCode).toBe(
      409,
    );
    ok(await move({ thingIds: [mug.id], to: { containerId: k.pouch.id }, onLoan: 'confirm' }));
    expect((await post(ibrahim, `/api/v1/things/${k.strap.id}/trash`, {})).statusCode).toBe(409);
    ok(await post(ibrahim, `/api/v1/things/${k.strap.id}/trash`, { onLoan: 'confirm' }));
  });
});
