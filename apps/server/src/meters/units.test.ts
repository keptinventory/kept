import { newId } from '@kept/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
} from '../../test/things.js';
import { runScan } from '../reminders/scan.js';

// #385 through the front door: an odometer starts in the unit of the person who sets it up, and
// Change unit relabels a meter or converts its readings, the replacement offsets, the daily limit
// and the schedules that count on it (1 mi = 1.609344 km), with a preview, a history entry and
// Undo.

let db: TestDb;
let t: TestApp;
let ibrahim: Person; // owner of the Garage, metric
let bruce: Person; // admin, imperial
let louis: Person; // member
let garage: Loc;
let carType: string;

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  t = await peopleApp(db);
  ibrahim = await person(t, db, 'ibrahim');
  bruce = await person(t, db, 'bruce');
  louis = await person(t, db, 'louis');
  garage = await createLocation(t, db, ibrahim, 'complete', 'Garage');
  await join(db, garage.id, bruce.userId, 'admin');
  await join(db, garage.id, louis.userId, 'member');
  carType = await builtinType(db, 'car');
  const units = await call(t, '/api/v1/me', {
    as: bruce,
    method: 'PATCH',
    body: { units: 'imperial' },
  });
  expect(units.statusCode, units.body).toBe(200);
});

afterAll(async () => {
  await t.app.close();
});

type Car = { id: string; meterId: string };

async function newCar(as: Person = ibrahim, name = 'Corolla'): Promise<Car> {
  const thing = await createThing(t, as, garage, { name, typeId: carType });
  return { id: thing.id, meterId: ((thing.meters as { id: string }[])[0] as { id: string }).id };
}

const day = (n: number) => new Date(Date.UTC(2026, 5, n, 9)).toISOString();

async function reading(car: Car, value: string, takenAt: string) {
  ok(
    await call(t, `/api/v1/meters/${car.meterId}/readings`, {
      as: ibrahim,
      body: { value, takenAt },
    }),
    201,
  );
}

const values = (meterId: string) =>
  own<{ value: string }>(
    db,
    `SELECT trim_scale(value)::text AS value FROM public.meter_readings
      WHERE meter_id = $1 ORDER BY taken_at`,
    [meterId],
  ).then((rows) => rows.map((r) => r.value));

const meterRow = async (meterId: string) =>
  (
    await own<{
      unit: string;
      offset: string;
      max_per_day: string | null;
      row_version: number;
    }>(
      db,
      `SELECT unit, trim_scale("offset")::text AS "offset",
              trim_scale(max_per_day)::text AS max_per_day, row_version
         FROM public.meters WHERE id = $1`,
      [meterId],
    )
  )[0];

const scheduleRow = async (id: string) =>
  (
    await own<{
      every_units: string | null;
      lead_units: string | null;
      base_value: string | null;
      anchor_value: string | null;
      snoozed_until_value: string | null;
    }>(
      db,
      `SELECT trim_scale(every_units)::text AS every_units, trim_scale(lead_units)::text AS lead_units,
              trim_scale(base_value)::text AS base_value, trim_scale(anchor_value)::text AS anchor_value,
              trim_scale(snoozed_until_value)::text AS snoozed_until_value
         FROM public.schedules WHERE id = $1`,
      [id],
    )
  )[0];

const change = (
  as: Person,
  meterId: string,
  body: Record<string, unknown>,
  headers?: Record<string, string>,
) => call(t, `/api/v1/meters/${meterId}/unit`, { as, body, ...(headers ? { headers } : {}) });

const preview = (as: Person, meterId: string, body: Record<string, unknown>) =>
  call(t, `/api/v1/meters/${meterId}/unit/preview`, { as, body });

type Changed = Json & { meter: Json; changed: Json; undo: { eventId: string } };
const changed = async (res: Awaited<ReturnType<typeof change>>) => ok(res) as unknown as Changed;

const undo = (as: Person, eventId: string) =>
  call(t, `/api/v1/audit/${eventId}/undo`, { as, body: {} });

/** A car with three readings, a replacement, a daily limit and two schedules on its odometer. */
async function loadedCar(as: Person = ibrahim) {
  const car = await newCar(as);
  await reading(car, '10000', day(1));
  await reading(car, '10500', day(10));
  await reading(car, '11000', day(20));
  ok(
    await call(t, `/api/v1/meters/${car.meterId}/replaced`, {
      as: ibrahim,
      body: { at: day(21), offset: '11000' },
    }),
    201,
  );
  await reading(car, '200', day(25));
  const meter = await meterRow(car.meterId);
  ok(
    await call(t, `/api/v1/meters/${car.meterId}`, {
      as: ibrahim,
      method: 'PATCH',
      body: { maxPerDay: 800 },
      headers: { 'if-match': String(meter?.row_version) },
    }),
  );
  const oil = ok(
    await call(t, '/api/v1/schedules', {
      as: ibrahim,
      body: {
        subject: { thingId: car.id },
        name: 'Oil change',
        everyUnits: '10000',
        meterId: car.meterId,
        leadUnits: '1000',
        anchorValue: '10000',
      },
    }),
    201,
  );
  const tyres = ok(
    await call(t, '/api/v1/schedules', {
      as: ibrahim,
      body: {
        subject: { thingId: car.id },
        name: 'Tyre rotation',
        everyMonths: 12,
        everyUnits: '8000',
        meterId: car.meterId,
        anchorValue: '10500',
      },
    }),
    201,
  );
  // A schedule on months alone doesn't count on the meter.
  ok(
    await call(t, '/api/v1/schedules', {
      as: ibrahim,
      body: { subject: { thingId: car.id }, name: 'Brake fluid', everyMonths: 24 },
    }),
    201,
  );
  return { car, oil: oil.id as string, tyres: tyres.id as string };
}

describe('a new odometer’s unit', () => {
  it('follows the Units setting of the person who adds the vehicle', async () => {
    const metric = await newCar(ibrahim, 'Metric car');
    const imperial = await newCar(bruce, 'Imperial car');
    expect((await meterRow(metric.meterId))?.unit).toBe('km');
    expect((await meterRow(imperial.meterId))?.unit).toBe('mi');
  });
});

describe('POST /api/v1/meters/:id/unit/preview', () => {
  it('says what a conversion would change, and changes nothing', async () => {
    const { car } = await loadedCar();
    const before = await values(car.meterId);
    const res = await preview(bruce, car.meterId, { unit: 'mi', convert: true });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toEqual({
      from: 'km',
      to: 'mi',
      convert: true,
      readings: 4,
      example: { before: '200', after: '124.274' },
      offset: { before: '11000', after: '6835.083' },
      maxPerDay: { before: '800', after: '497.097' },
      replacements: 1,
      schedules: 2,
    });
    expect(await values(car.meterId)).toEqual(before);
    expect((await meterRow(car.meterId))?.unit).toBe('km');
  });

  it('changes nothing but the label when only relabelling', async () => {
    const { car } = await loadedCar();
    const res = ok(await preview(ibrahim, car.meterId, { unit: 'mi', convert: false }));
    expect(res).toEqual({
      from: 'km',
      to: 'mi',
      convert: false,
      readings: 0,
      example: { before: '200', after: '200' },
      offset: null,
      maxPerDay: null,
      replacements: 0,
      schedules: 0,
    });
  });
});

describe('POST /api/v1/meters/:id/unit', () => {
  // catalogue: POST /api/v1/meters/:id/unit
  it('converts km to mi: readings, offsets, daily limit and schedules, audited and undoable', async () => {
    const { car, oil, tyres } = await loadedCar();
    const meter = await meterRow(car.meterId);
    const res = await change(
      bruce,
      car.meterId,
      { unit: 'mi', convert: true },
      { 'if-match': String(meter?.row_version) },
    );
    expect(res.statusCode, res.body).toBe(200);
    const out = res.json();
    expect(out.meter).toMatchObject({ unit: 'mi', offset: '6835.083', maxPerDay: 497.097 });
    expect(out.meter.latest).toMatchObject({ value: '124.274' });
    expect(out.changed).toEqual({ readings: 4, replacements: 1, schedules: 2 });
    expect(out.undo).toEqual({ eventId: expect.any(String), until: expect.any(String) });

    expect(await values(car.meterId)).toEqual(['6213.712', '6524.398', '6835.083', '124.274']);
    const [event] = await own<{ offset: string }>(
      db,
      `SELECT trim_scale("offset")::text AS "offset" FROM public.meter_events WHERE meter_id = $1`,
      [car.meterId],
    );
    expect(event?.offset).toBe('6835.083');
    expect(await scheduleRow(oil)).toEqual({
      every_units: '6213.712',
      lead_units: '621.371',
      base_value: '6213.712',
      anchor_value: '6213.712',
      snoozed_until_value: null,
    });
    expect(await scheduleRow(tyres)).toMatchObject({
      every_units: '4970.97',
      base_value: '6524.398',
      anchor_value: '6524.398',
    });

    const [audit] = (await eventsOf(db, garage.id, car.meterId)).filter(
      (e) => e.action === 'meter.unit',
    );
    expect(audit).toMatchObject({ actor_id: bruce.userId });
    expect(audit?.diff).toMatchObject({
      unit: { before: 'km', after: 'mi' },
      converted: { before: null, after: 4 },
    });
    const [root] = await own<{ root_thing_id: string }>(
      db,
      'SELECT root_thing_id FROM public.audit_events WHERE id = $1',
      [out.undo.eventId],
    );
    expect(root?.root_thing_id).toBe(car.id);

    // Undo puts back every value exactly, and the unit.
    const back = await undo(bruce, out.undo.eventId);
    expect(back.statusCode, back.body).toBe(200);
    expect(await values(car.meterId)).toEqual(['10000', '10500', '11000', '200']);
    expect(await meterRow(car.meterId)).toMatchObject({
      unit: 'km',
      offset: '11000',
      max_per_day: '800',
    });
    expect(await scheduleRow(oil)).toEqual({
      every_units: '10000',
      lead_units: '1000',
      base_value: '10000',
      anchor_value: '10000',
      snoozed_until_value: null,
    });
    expect(await scheduleRow(tyres)).toMatchObject({ every_units: '8000', base_value: '10500' });
  });

  it('converts mi to km', async () => {
    const car = await newCar(bruce, 'Imperial truck');
    await reading(car, '1000', day(1));
    await reading(car, '1500.5', day(10));
    const res = ok(await change(bruce, car.meterId, { unit: 'km', convert: true }));
    expect(res.meter).toMatchObject({ unit: 'km' });
    expect(await values(car.meterId)).toEqual(['1609.344', '2414.821']);
  });

  it('keeps no daily limit as none: a later reading is not a jump (#510)', async () => {
    const car = await newCar(ibrahim, 'No limit car');
    await reading(car, '10000', day(1));
    expect((await meterRow(car.meterId))?.max_per_day).toBeNull();
    const view = ok(await preview(ibrahim, car.meterId, { unit: 'mi', convert: true }));
    expect(view.maxPerDay).toBeNull();
    ok(await change(ibrahim, car.meterId, { unit: 'mi', convert: true }));
    expect((await meterRow(car.meterId))?.max_per_day).toBeNull();
    // 6213.712 mi, then 100 mi a day later: a normal day's driving, accepted.
    const next = ok(
      await call(t, `/api/v1/meters/${car.meterId}/readings`, {
        as: ibrahim,
        body: { value: '6313.712', takenAt: day(2) },
      }),
      201,
    );
    expect(next).toMatchObject({ reading: { state: 'accepted' } });
  });

  it('sends a reminder already sent once, not again after a conversion and its undo', async () => {
    const car = await newCar(ibrahim, 'Reminder car');
    await reading(car, '10000', day(1));
    await reading(car, '15100', day(20));
    const oil = ok(
      await call(t, '/api/v1/schedules', {
        as: ibrahim,
        body: {
          subject: { thingId: car.id },
          name: 'Oil change',
          everyUnits: '5000',
          meterId: car.meterId,
          anchorValue: '10000',
        },
      }),
      201,
    ).id as string;
    const sent = async () =>
      (
        await own<{ occurrences: number; notifications: number; deliveries: number }>(
          db,
          `SELECT (SELECT count(*)::int FROM public.reminder_occurrences o
                    WHERE o.source_id = $1) AS occurrences,
                  (SELECT count(*)::int FROM public.notifications n
                     JOIN public.reminder_occurrences o ON o.id = n.occurrence_id
                    WHERE o.source_id = $1) AS notifications,
                  (SELECT count(*)::int FROM public.reminder_deliveries d
                     JOIN public.reminder_occurrences o ON o.id = d.occurrence_id
                    WHERE o.source_id = $1) AS deliveries`,
          [oil],
        )
      )[0];
    const scan = () => runScan({ pools: db.pools, channels: {} });
    await scan();
    const first = await sent();
    expect(first?.occurrences).toBe(1);
    expect(first?.notifications).toBeGreaterThan(0);

    const res = await changed(await change(ibrahim, car.meterId, { unit: 'mi', convert: true }));
    await scan();
    expect(await sent()).toEqual(first);
    const [open] = await own<{ due_period: string; state: string }>(
      db,
      'SELECT due_period, state FROM public.reminder_occurrences WHERE source_id = $1',
      [oil],
    );
    expect(open?.state).toBe('open');

    ok(await undo(ibrahim, res.undo.eventId));
    await scan();
    expect(await sent()).toEqual(first);
  });

  it('relabels only: the readings were always in the new unit, and stay', async () => {
    const { car, oil } = await loadedCar();
    const before = await values(car.meterId);
    const res = await changed(await change(ibrahim, car.meterId, { unit: 'mi', convert: false }));
    expect(res.meter).toMatchObject({ unit: 'mi', offset: '11000', maxPerDay: 800 });
    expect(res.changed).toEqual({ readings: 0, replacements: 0, schedules: 0 });
    expect(await values(car.meterId)).toEqual(before);
    expect(await scheduleRow(oil)).toMatchObject({ every_units: '10000' });
    const [audit] = (await eventsOf(db, garage.id, car.meterId)).filter(
      (e) => e.action === 'meter.unit',
    );
    expect(audit?.diff).toMatchObject({ unit: { before: 'km', after: 'mi' } });
    expect(audit?.diff).not.toHaveProperty('converted');
    ok(await undo(ibrahim, res.undo.eventId));
    expect((await meterRow(car.meterId))?.unit).toBe('km');
    expect(await values(car.meterId)).toEqual(before);
  });

  it('refuses Undo once a reading has come in since, and says so', async () => {
    const { car } = await loadedCar();
    const res = await changed(await change(ibrahim, car.meterId, { unit: 'mi', convert: true }));
    await reading(car, '300', day(28));
    const back = await undo(ibrahim, res.undo.eventId);
    expect(back.statusCode).toBe(409);
    expect(back.json()).toMatchObject({ code: 'undo_refused', reason: 'changed_since' });
    expect((await meterRow(car.meterId))?.unit).toBe('mi');
  });

  it('keeps fuel use the same figure after a conversion and after its undo', async () => {
    const car = await newCar(ibrahim, 'Fuel car');
    const fill = (value: string, takenAt: string, amount: string) =>
      call(t, `/api/v1/things/${car.id}/fuel`, {
        as: ibrahim,
        body: {
          id: newId(),
          takenAt,
          amount,
          unit: 'L',
          isFull: true,
          reading: { meterId: car.meterId, value },
        },
        headers: { 'idempotency-key': newId() },
      });
    ok(await fill('10000', day(1), '40'), 201);
    ok(await fill('10500', day(8), '35'), 201);
    ok(await fill('11000', day(15), '35'), 201);
    const summary = async () =>
      ok(await call(t, `/api/v1/things/${car.id}/fuel/summary`, { as: ibrahim })) as unknown as {
        byUnit: { unit: string; consumption: { perHundred: string } | null }[];
      };
    const km = await summary();
    expect(km.byUnit[0]?.consumption?.perHundred).toBe('7');
    const res = await changed(await change(ibrahim, car.meterId, { unit: 'mi', convert: true }));
    const mi = await summary();
    // 7 L per 100 km is 11.27 L per 100 mi: the same fuel use, counted on miles.
    expect(Number(mi.byUnit[0]?.consumption?.perHundred)).toBeCloseTo(11.265, 2);
    ok(await undo(ibrahim, res.undo.eventId));
    expect((await summary()).byUnit[0]?.consumption?.perHundred).toBe('7');
  });

  it('relabels an hours meter or a custom one, and converts neither', async () => {
    const pump = await createThing(t, ibrahim, garage, { name: 'Generator' });
    const hours = ok(
      await call(t, `/api/v1/things/${pump.id}/meters`, {
        as: ibrahim,
        body: { kind: 'hours', unit: 'h' },
      }),
      201,
    );
    const custom = ok(
      await call(t, `/api/v1/things/${pump.id}/meters`, {
        as: ibrahim,
        body: { kind: 'custom', unit: 'm³', label: 'Flow' },
      }),
      201,
    );
    for (const id of [hours.id as string, custom.id as string]) {
      const bad = await change(ibrahim, id, { unit: 'L', convert: true });
      expect(bad.statusCode, bad.body).toBe(400);
    }
    ok(await change(ibrahim, custom.id as string, { unit: 'L', convert: false }));
    expect((await meterRow(custom.id as string))?.unit).toBe('L');
  });

  it('takes only km or mi on an odometer, and a unit that differs', async () => {
    const car = await newCar();
    for (const body of [
      { unit: 'furlong', convert: false },
      { unit: 'km', convert: false },
      { unit: 'km', convert: true },
      { unit: '', convert: false },
      { unit: 'mi' },
    ]) {
      const bad = await change(ibrahim, car.meterId, body);
      expect(bad.statusCode, JSON.stringify(body)).toBe(400);
    }
  });

  it('is for owners and admins (meters.manage), and checks If-Match', async () => {
    const car = await newCar();
    expect((await change(louis, car.meterId, { unit: 'mi', convert: false })).statusCode).toBe(403);
    expect((await preview(louis, car.meterId, { unit: 'mi', convert: true })).statusCode).toBe(403);
    const stale = await change(
      ibrahim,
      car.meterId,
      { unit: 'mi', convert: false },
      { 'if-match': '99' },
    );
    expect(stale.statusCode).toBe(412);
    expect((await change(ibrahim, newId(), { unit: 'mi', convert: false })).statusCode).toBe(404);
  });
});
