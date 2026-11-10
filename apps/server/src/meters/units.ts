import { KM_PER_MILE } from '@kept/shared';
import type pg from 'pg';
import { actorOf } from '../audit/actor.js';
import { audited } from '../audit/audited.js';
import {
  lastChangedBy,
  notUndoable,
  registerUndo,
  type UndoArgs,
  undoableUntil,
  undoConflict,
} from '../audit/undo.js';
import { checkVersion } from '../http/conventions.js';
import { conflict, invalid } from '../http/errors.js';
import { type Ctx, type MeterRow, type MeterView, meterView, writableMeter } from './service.js';

// Change unit on a meter (#385, `meters.manage`):
//
// - Relabel: the readings were always in the new unit; only `meters.unit` changes.
// - Convert (an odometer, km ↔ mi only, 1 mi = 1.609344 km): every reading (accepted or waiting
//   for review), the replacement offsets (the meter's and each event's), the daily limit, and the
//   schedules that count on the meter (every N, the lead, the base and a snooze's value) are
//   converted, rounded to the column's thousandth. Each schedule's anchor follows by the 0175
//   trigger, so an anchor taken from a service's reading is the converted reading.
// - An odometer counts in km or mi; an hours meter or a custom one is relabelled only.
// - The preview (POST …/unit/preview) answers what a change would do and changes nothing.
// - One audited event, `meter.unit`, on the meter and its vehicle's history, undoable for 7 days.
//   It keeps what Undo needs (`unit_change`, hidden from the history): every converted value
//   before, and the row versions after. Undo puts every value back exactly, unless anything on
//   the meter changed since (a reading logged, kept, edited or removed; a schedule changed or
//   added), when it refuses and says so.

const DISTANCE = ['km', 'mi'] as const;

export type UnitChangeBody = { unit: string; convert: boolean };

export type UnitPreview = {
  from: string;
  to: string;
  convert: boolean;
  /** Readings that change: every reading of the meter when converting, else 0. */
  readings: number;
  /** The latest accepted reading before and after; null without one. */
  example: { before: string; after: string } | null;
  /** The offset in force before and after; null when it doesn't change. */
  offset: { before: string; after: string } | null;
  /** The meter's own daily limit before and after; null when it has none or it doesn't change. */
  maxPerDay: { before: string; after: string } | null;
  replacements: number;
  schedules: number;
};

export type UnitChangeResult = {
  meter: MeterView;
  changed: { readings: number; replacements: number; schedules: number };
  undo: { eventId: string; until: string };
};

/** What Undo needs, kept in the event (`unit_change`). */
type UnitChangeState = {
  meterVersion: number;
  offset?: string;
  maxPerDay?: string | null;
  /** [id, value before, row version after]. */
  readings?: [string, string, number][];
  /** [id, offset before, row version after]. */
  events?: [string, string, number][];
  /** [id, every_units, lead_units, base_value, snoozed_until_value (before), row version after]. */
  schedules?: [string, string | null, string | null, string | null, string | null, number][];
};

/** The SQL that converts `col` into `to` (km or mi), to the column's thousandth. Constants only. */
function converted(col: string, to: string): string {
  return to === 'mi' ? `round(${col} / ${KM_PER_MILE}, 3)` : `round(${col} * ${KM_PER_MILE}, 3)`;
}

/** The unit to change to, and whether to convert, checked against the meter. */
function target(meter: MeterRow, body: UnitChangeBody): { to: string; convert: boolean } {
  const from = meter.unit.trim().toLowerCase();
  const to = meter.kind === 'distance' ? body.unit.trim().toLowerCase() : body.unit.trim();
  if (meter.kind === 'distance' && !(DISTANCE as readonly string[]).includes(to)) {
    throw invalid('Check body.unit: an odometer counts in km or mi.');
  }
  if (to === meter.unit || (meter.kind === 'distance' && to === from)) {
    throw invalid('Check body.unit: the meter counts in it already.');
  }
  if (
    body.convert &&
    (meter.kind !== 'distance' || !(DISTANCE as readonly string[]).includes(from))
  ) {
    throw invalid(
      'Check body.convert: only an odometer in km or mi converts its readings. Change the unit alone instead.',
    );
  }
  return { to, convert: body.convert };
}

/** POST /api/v1/meters/:id/unit/preview → UnitPreview. Read-only. */
export async function previewUnitChange(
  ctx: Ctx,
  id: string,
  body: UnitChangeBody,
): Promise<UnitPreview> {
  const { client } = ctx;
  const meter = await writableMeter(client, id, 'meters.manage');
  const { to, convert } = target(meter, body);
  const value = (col: string) => (convert ? converted(col, to) : col);
  const { rows } = await client.query<{
    readings: number;
    replacements: number;
    schedules: number;
    latest: string | null;
    latest_after: string | null;
    offset_after: string;
    max_after: string | null;
  }>(
    `SELECT (SELECT count(*)::int FROM public.meter_readings r WHERE r.meter_id = m.id) AS readings,
            (SELECT count(*)::int FROM public.meter_events e WHERE e.meter_id = m.id) AS replacements,
            (SELECT count(*)::int FROM public.schedules s WHERE s.meter_id = m.id) AS schedules,
            trim_scale(l.value)::text AS latest,
            trim_scale(${value('l.value')})::text AS latest_after,
            trim_scale(${value('m."offset"')})::text AS offset_after,
            trim_scale(${value('m.max_per_day')})::text AS max_after
       FROM public.meters m
       LEFT JOIN LATERAL (
         SELECT r.value FROM public.meter_readings r
          WHERE r.meter_id = m.id AND r.state = 'accepted'
          ORDER BY r.taken_at DESC, r.id DESC LIMIT 1) l ON true
      WHERE m.id = $1`,
    [id],
  );
  const r = rows[0];
  if (!r) throw invalid();
  return {
    from: meter.unit,
    to,
    convert,
    readings: convert ? r.readings : 0,
    example: r.latest !== null ? { before: r.latest, after: r.latest_after ?? r.latest } : null,
    offset:
      convert && Number(meter.offset) !== 0
        ? { before: meter.offset, after: r.offset_after }
        : null,
    maxPerDay:
      convert && meter.max_per_day !== null && r.max_after !== null
        ? { before: meter.max_per_day, after: r.max_after }
        : null,
    replacements: convert ? r.replacements : 0,
    schedules: convert ? r.schedules : 0,
  };
}

/** POST /api/v1/meters/:id/unit (If-Match optional, `meters.manage`) → UnitChangeResult. */
export async function changeUnit(
  ctx: Ctx,
  id: string,
  body: UnitChangeBody,
  expected: number | null,
): Promise<UnitChangeResult> {
  const { client, tx, scope } = ctx;
  const meter = await writableMeter(client, id, 'meters.manage');
  if (expected !== null && meter.row_version !== expected) {
    const name = await lastChangedBy(client, meter.location_id, { type: 'meter', id });
    checkVersion(
      { rowVersion: meter.row_version },
      expected,
      ['unit'],
      name ? { displayName: name } : null,
    );
  }
  const { to, convert } = target(meter, body);
  const state: UnitChangeState = { meterVersion: 0 };
  const changed = { readings: 0, replacements: 0, schedules: 0 };
  if (convert) {
    const readings = await client.query<{ id: string; value: string }>(
      `SELECT id, value::text AS value FROM public.meter_readings WHERE meter_id = $1 ORDER BY id`,
      [id],
    );
    const events = await client.query<{ id: string; offset: string }>(
      `SELECT id, "offset"::text AS "offset" FROM public.meter_events WHERE meter_id = $1
        ORDER BY id`,
      [id],
    );
    const schedules = await client.query<{
      id: string;
      every_units: string | null;
      lead_units: string | null;
      base_value: string | null;
      snoozed_until_value: string | null;
    }>(
      `SELECT id, every_units::text AS every_units, lead_units::text AS lead_units,
              base_value::text AS base_value, snoozed_until_value::text AS snoozed_until_value
         FROM public.schedules WHERE meter_id = $1 ORDER BY id`,
      [id],
    );
    const { rows: m } = await client.query<{ offset: string; max_per_day: string | null }>(
      `SELECT "offset"::text AS "offset", max_per_day::text AS max_per_day
         FROM public.meters WHERE id = $1`,
      [id],
    );
    await client.query(
      `UPDATE public.meter_readings SET value = ${converted('value', to)} WHERE meter_id = $1`,
      [id],
    );
    await client.query(
      `UPDATE public.meter_events SET "offset" = ${converted('"offset"', to)} WHERE meter_id = $1`,
      [id],
    );
    // A limit or an interval stays above 0 however small it was. No limit of its own (NULL) stays
    // none: GREATEST skips a NULL, so it would make one of 0.001 (#510). A meter's schedule
    // always has every_units (schedules_meter_chk).
    await client.query(
      `UPDATE public.meters
          SET "offset" = ${converted('"offset"', to)},
              max_per_day = CASE WHEN max_per_day IS NULL THEN NULL
                                 ELSE greatest(${converted('max_per_day', to)}, 0.001) END
        WHERE id = $1`,
      [id],
    );
    await client.query(
      `UPDATE public.schedules
          SET every_units = greatest(${converted('every_units', to)}, 0.001),
              lead_units = ${converted('lead_units', to)},
              base_value = ${converted('base_value', to)},
              snoozed_until_value = ${converted('snoozed_until_value', to)}
        WHERE meter_id = $1`,
      [id],
    );
    changed.readings = readings.rows.length;
    changed.replacements = events.rows.length;
    changed.schedules = schedules.rows.length;
    state.offset = m[0]?.offset ?? '0';
    state.maxPerDay = m[0]?.max_per_day ?? null;
    state.readings = readings.rows.map((r) => [r.id, r.value, 0]);
    state.events = events.rows.map((e) => [e.id, e.offset, 0]);
    state.schedules = schedules.rows.map((s) => [
      s.id,
      s.every_units,
      s.lead_units,
      s.base_value,
      s.snoozed_until_value,
      0,
    ]);
  }
  // Last: the 0175 trigger re-anchors the meter's schedules on the converted readings.
  await client.query('UPDATE public.meters SET unit = $2 WHERE id = $1', [id, to]);
  await versionsAfter(client, id, state);
  const until = undoableUntil();
  const event = await audited(tx, {
    locationId: meter.location_id,
    actor: actorOf(scope),
    action: 'meter.unit',
    entity: { type: 'meter', id },
    before: { unit: meter.unit },
    after: {
      unit: to,
      ...(convert ? { converted: changed.readings } : {}),
      unit_change: state,
    },
    rootThingId: meter.thing_id,
    requestId: ctx.requestId,
    undoableUntil: until,
  });
  return {
    meter: await meterView(client, id),
    changed,
    undo: { eventId: event.id, until: until.toISOString() },
  };
}

/** Fills in the row versions the change left, which Undo checks nothing has moved past. */
async function versionsAfter(client: pg.ClientBase, id: string, state: UnitChangeState) {
  const versions = async (table: string, column: string) => {
    const { rows } = await client.query<{ id: string; row_version: number }>(
      `SELECT id, row_version FROM public.${table} WHERE ${column} = $1`,
      [id],
    );
    return new Map(rows.map((r) => [r.id, r.row_version]));
  };
  const { rows } = await client.query<{ row_version: number }>(
    'SELECT row_version FROM public.meters WHERE id = $1',
    [id],
  );
  state.meterVersion = rows[0]?.row_version ?? 0;
  if (state.readings) {
    const v = await versions('meter_readings', 'meter_id');
    for (const r of state.readings) r[2] = v.get(r[0]) ?? 0;
  }
  if (state.events) {
    const v = await versions('meter_events', 'meter_id');
    for (const e of state.events) e[2] = v.get(e[0]) ?? 0;
  }
  if (state.schedules) {
    const v = await versions('schedules', 'meter_id');
    for (const s of state.schedules) s[5] = v.get(s[0]) ?? 0;
  }
}

/** Whether `rows` (id → row version now) are exactly `kept` (id and version as the change left). */
function same(rows: Map<string, number>, kept: readonly [string, ...unknown[]][], at: number) {
  if (rows.size !== kept.length) return false;
  return kept.every((k) => rows.get(k[0]) === k[at]);
}

async function undoUnitChange(args: UndoArgs): Promise<void> {
  const { event, client } = args;
  const id = event.entityId;
  if (event.entityType !== 'meter' || !id) throw notUndoable();
  const before = event.diff.unit?.before;
  const after = event.diff.unit?.after;
  const state = event.diff.unit_change?.after as UnitChangeState | undefined;
  if (typeof before !== 'string' || typeof after !== 'string' || !state) throw notUndoable();
  await client.query('SELECT 1 FROM public.meters WHERE id = $1 FOR UPDATE', [id]);
  const { rows } = await client.query<{ unit: string; row_version: number; location_id: string }>(
    `SELECT m.unit, m.row_version, m.location_id, m.thing_id FROM public.meters m
       JOIN public.things t ON t.id = m.thing_id AND t.deleted_at IS NULL
      WHERE m.id = $1`,
    [id],
  );
  const meter = rows[0] as
    | { unit: string; row_version: number; location_id: string; thing_id: string }
    | undefined;
  if (!meter) throw conflict("Can't undo: that meter is gone.");
  const changedSince = async (fields: string[]) =>
    undoConflict(
      fields,
      await lastChangedBy(client, meter.location_id, { type: 'meter', id }, event.at),
    );
  if (meter.unit !== after || meter.row_version !== state.meterVersion) {
    throw await changedSince(['unit']);
  }
  if (state.readings) {
    const versions = async (table: string) => {
      const { rows: r } = await client.query<{ id: string; row_version: number }>(
        `SELECT id, row_version FROM public.${table} WHERE meter_id = $1`,
        [id],
      );
      return new Map(r.map((x) => [x.id, x.row_version]));
    };
    if (!same(await versions('meter_readings'), state.readings, 2)) {
      throw await changedSince(['readings']);
    }
    if (!same(await versions('meter_events'), state.events ?? [], 2)) {
      throw await changedSince(['offset']);
    }
    if (!same(await versions('schedules'), state.schedules ?? [], 5)) {
      throw await changedSince(['schedules']);
    }
    const r = state.readings;
    await client.query(
      `UPDATE public.meter_readings x SET value = v.value
         FROM unnest($1::uuid[], $2::numeric[]) AS v(id, value) WHERE x.id = v.id`,
      [r.map((x) => x[0]), r.map((x) => x[1])],
    );
    const e = state.events ?? [];
    await client.query(
      `UPDATE public.meter_events x SET "offset" = v.o
         FROM unnest($1::uuid[], $2::numeric[]) AS v(id, o) WHERE x.id = v.id`,
      [e.map((x) => x[0]), e.map((x) => x[1])],
    );
    await client.query('UPDATE public.meters SET "offset" = $2, max_per_day = $3 WHERE id = $1', [
      id,
      state.offset ?? '0',
      state.maxPerDay ?? null,
    ]);
    const s = state.schedules ?? [];
    await client.query(
      `UPDATE public.schedules x
          SET every_units = v.every_units, lead_units = v.lead_units, base_value = v.base_value,
              snoozed_until_value = v.snoozed
         FROM unnest($1::uuid[], $2::numeric[], $3::numeric[], $4::numeric[], $5::numeric[])
              AS v(id, every_units, lead_units, base_value, snoozed)
        WHERE x.id = v.id`,
      [
        s.map((x) => x[0]),
        s.map((x) => x[1]),
        s.map((x) => x[2]),
        s.map((x) => x[3]),
        s.map((x) => x[4]),
      ],
    );
  }
  await client.query('UPDATE public.meters SET unit = $2 WHERE id = $1', [id, before]);
  await args.audit({
    action: 'meter.unit',
    entity: { type: 'meter', id },
    before: { unit: after },
    after: { unit: before, ...(state.readings ? { converted: state.readings.length } : {}) },
    rootThingId: meter.thing_id,
  });
}

let registered = false;

/** Registers `meter.unit`'s undo (idempotent; meters/routes.ts). */
export function registerUnitUndo(): void {
  if (registered) return;
  registered = true;
  registerUndo('meter.unit', undoUnitChange);
}
