import { CONDITIONS, LOAN_DIRECTIONS, LOAN_OUTCOMES } from '@kept/shared';
import { sql } from 'drizzle-orm';
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { id, mutable, textEnum, tstz } from './common.js';
import { locations } from './tenancy.js';
import { things } from './things.js';

// Lending and borrowing (D56, D57, D119, D172).
// Row-level security, the person guard and the thing's state bump are in the custom
// migration that follows (0051); see src/db/household-records.test.ts.

const direction = textEnum('direction', LOAN_DIRECTIONS);
const outcome = textEnum('outcome', LOAN_OUTCOMES);
const conditionOut = textEnum('condition_out', CONDITIONS);
const conditionIn = textEnum('condition_in', CONDITIONS);
const handoverConditionOut = textEnum('condition_out', CONDITIONS);

/**
 * A hand-over (1.14, #170): one lend to a person of a thing, a box (with everything inside it)
 * or a kit, with one loan (a line) per thing that went. The person, the dates, the due-soon lead
 * and the notes are the hand-over's, copied onto its lines; each line closes on its own (returned
 * or lost). A loan made without one (a borrow, an older export, an undone delete) gets a one-line
 * hand-over with the loan's own id (0152's trigger). Row-level security in 0152.
 */
export const handovers = pgTable(
  'handovers',
  {
    id: id(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    direction: direction.col().notNull(),
    personId: uuid('person_id').notNull(),
    /** What was handed over: the thing, box or kit lent (the other lines are inside it, or a
     * kit's parts kept elsewhere). */
    rootThingId: uuid('root_thing_id').references(() => things.id, { onDelete: 'set null' }),
    startedAt: tstz('started_at').notNull(),
    dueOn: date('due_on'),
    leadDays: integer('lead_days').notNull().default(0),
    notes: text('notes'),
    conditionOut: handoverConditionOut.col(),
    createdBy: uuid('created_by').notNull(),
    ...mutable(),
  },
  (t) => [
    direction.check('handovers'),
    handoverConditionOut.check('handovers'),
    unique('handovers_location_id_uq').on(t.locationId, t.id),
    check('handovers_lead_days_chk', sql`lead_days BETWEEN 0 AND 60`),
    check('handovers_notes_chk', sql`char_length(notes) <= 2000`),
    index('handovers_person_idx').on(t.personId),
    index('handovers_root_idx').on(t.rootThingId),
  ],
);

/**
 * A thing lent out to someone, or borrowed in from someone (D56): one open loan per thing.
 * The person is the account's people registry (a member is a person with
 * `member_user_id`), guarded in 0051. `previous_*` say where it was, for "return to
 * previous": no foreign key, the place may be gone by the return (the route falls back to
 * Unplaced). `split_from_thing_id` is the row a partial lend split off (D172). The return-place
 * and split keys are ON DELETE SET NULL (col), in 0051.
 */
export const loans = pgTable(
  'loans',
  {
    id: id(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    thingId: uuid('thing_id').notNull(),
    direction: direction.col().notNull(),
    personId: uuid('person_id').notNull(),
    startedAt: tstz('started_at').notNull(),
    dueOn: date('due_on'),
    returnedAt: tstz('returned_at'),
    returnPlaceId: uuid('return_place_id'),
    /** Where a lent thing came back into a container (step-4 UI review L7): the container, set
     * instead of `return_place_id`. ON DELETE SET NULL (col), in 0087. */
    returnContainerId: uuid('return_container_id'),
    previousPlaceId: uuid('previous_place_id'),
    previousContainerId: uuid('previous_container_id'),
    splitFromThingId: uuid('split_from_thing_id'),
    leadDays: integer('lead_days').notNull().default(0),
    /** The lend note. A return writes `return_notes` (1.14), never this. */
    notes: text('notes'),
    createdBy: uuid('created_by').notNull(),
    /** Its hand-over (1.14): every loan has one. NOT NULL, and the outcome check ("closed iff it
     * has an outcome"), are set in 0152 after the existing loans got theirs. */
    handoverId: uuid('handover_id').references(() => handovers.id, { onDelete: 'cascade' }),
    /** Where it sat when it went, inside the hand-over's box: "Camera bag › Lens pouch". */
    pathAtLend: text('path_at_lend'),
    /** Closed: came back (`returned`) or `lost`. Open: null. */
    outcome: outcome.col(),
    conditionOut: conditionOut.col(),
    conditionIn: conditionIn.col(),
    returnNotes: text('return_notes'),
    ...mutable(),
  },
  (t) => [
    direction.check('loans'),
    outcome.check('loans'),
    conditionOut.check('loans'),
    conditionIn.check('loans'),
    check('loans_return_notes_chk', sql`char_length(return_notes) <= 2000`),
    check('loans_path_chk', sql`char_length(path_at_lend) <= 1000`),
    index('loans_handover_idx').on(t.handoverId),
    unique('loans_location_id_uq').on(t.locationId, t.id),
    check('loans_lead_days_chk', sql`lead_days BETWEEN 0 AND 60`),
    check('loans_notes_chk', sql`char_length(notes) <= 2000`),
    // "Due ≥ start" is the route's, in the location's zone; the table only refuses a
    // due date more than a day before the start (zone slack).
    check(
      'loans_due_chk',
      sql`due_on IS NULL OR due_on >= (started_at AT TIME ZONE 'UTC')::date - 1`,
    ),
    check('loans_returned_chk', sql`returned_at IS NULL OR returned_at >= started_at`),
    check('loans_return_where_chk', sql`num_nonnulls(return_place_id, return_container_id) <= 1`),
    foreignKey({
      name: 'loans_thing_fk',
      columns: [t.locationId, t.thingId],
      foreignColumns: [things.locationId, things.id],
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    uniqueIndex('loans_one_open_uq').on(t.thingId).where(sql`returned_at IS NULL`),
    index('loans_due_idx').on(t.dueOn).where(sql`returned_at IS NULL`),
    index('loans_person_idx').on(t.personId),
    index('loans_thing_idx').on(t.thingId),
  ],
);
