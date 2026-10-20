import { SCAN_SESSION_ACTIONS, SCAN_SESSION_MODES } from '@kept/shared';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { id, textEnum, tstz } from './common.js';
import { places } from './places.js';
import { schedules } from './schedules.js';
import { locations } from './tenancy.js';
import { things } from './things.js';

// Scan sessions (1.12, #168): one walk with the camera that reads many labels and applies them
// to a mode: count, pack into boxes, move to a place. The phone holds the walk; when it is saved
// the lines arrive in chunks (the `scan_session_lines` sync op) and the finish
// (`scan_session_finish`) applies them all at once, as one undoable `scan.session` event.
//
// A session lives in its target's location for row-level security. A line names a thing that may
// be in another location (a count reads every label you can see; a move may cross locations), so
// `thing_id` and the line's target are plain foreign keys: purging a thing takes its lines with
// it. Row-level security, grants and the finish's update rights are in the custom migration that
// follows.
//
// 1.14 (#172): a count keeps every result. Its lines also hold what it found missing, left
// elsewhere, lent out, in repair, in the Trash or in an area nobody counted (stored, never
// applied), where each thing was when it was counted (`was_*`, `area_place_id`) and, for a thing
// counted in number, how many were found. A count is open on the server until it is finished:
// several people (and phones, and days) add lines to the same session, each line saying who read
// it (`read_by`), and anyone who counts there finishes it. A finished count of a place completes
// that place's planned count (`schedule_id`).

const mode = textEnum('mode', SCAN_SESSION_MODES);
const action = textEnum('action', SCAN_SESSION_ACTIONS);

export const scanSessions = pgTable(
  'scan_sessions',
  {
    /** Made on the phone (UUIDv7, the ops window). */
    id: id(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    mode: mode.col().notNull(),
    /** A count's place, with the places inside it when `target_inside`; a move's place. */
    targetPlaceId: uuid('target_place_id').references(() => places.id, { onDelete: 'set null' }),
    /** A count's box, a pack's first box, a move's container. */
    targetContainerId: uuid('target_container_id').references(() => things.id, {
      onDelete: 'set null',
    }),
    targetInside: boolean('target_inside'),
    startedBy: uuid('started_by').notNull(),
    startedAt: tstz('started_at').notNull(),
    /** Set once, by its finish; lines arrive only while it is null. */
    finishedAt: tstz('finished_at'),
    /** A count's expected list ("312 of 340"). */
    expected: integer('expected'),
    seen: integer('seen').notNull().default(0),
    notHere: integer('not_here').notNull().default(0),
    moved: integer('moved').notNull().default(0),
    /** Lines that couldn't be applied at the finish (trashed meanwhile, no longer editable). */
    skipped: integer('skipped').notNull().default(0),
    /** A count's kept results (1.14): null on a count saved before them ("not recorded"). */
    missing: integer('missing'),
    elsewhere: integer('elsewhere'),
    onLoan: integer('on_loan'),
    inRepair: integer('in_repair'),
    notCounted: integer('not_counted'),
    /** A count: the areas it counted (a read or a tick in each, or "Checked: empty"). Null: all
     * of them (a box, or a count saved before areas). */
    countedPlaceIds: uuid('counted_place_ids').array(),
    /** The planned count its finish completed. */
    scheduleId: uuid('schedule_id').references(() => schedules.id, { onDelete: 'set null' }),
    /** Who finished it: anyone who counts there may (a count is open to everyone until then). */
    finishedBy: uuid('finished_by'),
    /** The finish's `scan.session` event: its undo. */
    auditEventId: uuid('audit_event_id'),
    createdAt: tstz('created_at').notNull().defaultNow(),
  },
  (t) => [
    mode.check('scan_sessions'),
    unique('scan_sessions_location_id_uq').on(t.locationId, t.id),
    check('scan_sessions_target_chk', sql`num_nonnulls(target_place_id, target_container_id) <= 1`),
    check(
      'scan_sessions_totals_chk',
      sql`seen >= 0 AND not_here >= 0 AND moved >= 0 AND skipped >= 0
          AND (expected IS NULL OR expected >= 0)
          AND (missing IS NULL OR missing >= 0) AND (elsewhere IS NULL OR elsewhere >= 0)
          AND (on_loan IS NULL OR on_loan >= 0) AND (in_repair IS NULL OR in_repair >= 0)
          AND (not_counted IS NULL OR not_counted >= 0)`,
    ),
    index('scan_sessions_location_idx').on(t.locationId, t.startedAt),
    index('scan_sessions_schedule_idx').on(t.scheduleId),
    // The open count of a target, for "Count in progress by Sam: Join".
    index('scan_sessions_open_idx').on(t.locationId).where(sql`finished_at IS NULL`),
  ],
);

/** One label read and what to do with it. Append-only; each thing once per session. */
export const scanSessionLines = pgTable(
  'scan_session_lines',
  {
    sessionId: uuid('session_id').notNull(),
    locationId: uuid('location_id').notNull(),
    thingId: uuid('thing_id')
      .notNull()
      .references(() => things.id, { onDelete: 'cascade' }),
    readAt: tstz('read_at').notNull(),
    action: action.col().notNull(),
    toPlaceId: uuid('to_place_id').references(() => places.id, { onDelete: 'set null' }),
    toContainerId: uuid('to_container_id').references(() => things.id, { onDelete: 'set null' }),
    /** Where Kept had the thing when the line was saved (1.14): its place or its box. */
    wasPlaceId: uuid('was_place_id').references(() => places.id, { onDelete: 'set null' }),
    wasContainerId: uuid('was_container_id').references(() => things.id, {
      onDelete: 'set null',
    }),
    /** Who read it (a count is shared until it is finished). */
    readBy: uuid('read_by'),
    /** Its area: the place it was in, through its boxes. */
    areaPlaceId: uuid('area_place_id').references(() => places.id, { onDelete: 'set null' }),
    /** A seen line counted in number: how many were found, of how many Kept had. */
    foundQty: numeric('found_qty', { precision: 12, scale: 3 }),
    expectedQty: numeric('expected_qty', { precision: 12, scale: 3 }),
    /** The rest were chosen "not here": the finish splits them off. */
    shortNotHere: boolean('short_not_here').notNull().default(false),
  },
  (t) => [
    action.check('scan_session_lines'),
    primaryKey({ name: 'scan_session_lines_pk', columns: [t.sessionId, t.thingId] }),
    foreignKey({
      name: 'scan_session_lines_session_fk',
      columns: [t.locationId, t.sessionId],
      foreignColumns: [scanSessions.locationId, scanSessions.id],
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    check('scan_session_lines_to_chk', sql`num_nonnulls(to_place_id, to_container_id) <= 1`),
    check(
      'scan_session_lines_qty_chk',
      sql`(found_qty IS NULL OR found_qty > 0) AND (expected_qty IS NULL OR expected_qty >= 0)
          AND (NOT short_not_here OR found_qty IS NOT NULL)`,
    ),
    index('scan_session_lines_thing_idx').on(t.thingId),
  ],
);
