import { FLOOR_PLAN_STATUSES } from '@kept/shared';
import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, pgTable, unique, uuid } from 'drizzle-orm/pg-core';
import { id, mutable, textEnum } from './common.js';
import { locations } from './tenancy.js';

// Floor plan to map (1.14.3, D266): one row per plan someone uploaded on the map, while it is read
// and reviewed. The upload is an attachment under review on the row (`attachments.floor_plan_id`,
// `in_review`); one `plan` extraction reads it (`extractions.floor_plan_id`), and its job writes the
// checked answer and the proposed rooms into `result` (`reading` → `ready`, or `failed`). Adding the
// rooms (`applied`, with the event that did it) or discarding the plan (`discarded`) clears
// `result` and lets the file go. Members and above see and change a location's rows; the
// row-level security is in the custom migration that follows (0163).

const status = textEnum('status', FLOOR_PLAN_STATUSES);

export const floorPlans = pgTable(
  'floor_plans',
  {
    id: id(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    status: status.col().notNull().default('reading'),
    /** The quarter turn the plan is read at (the server turns the image before sending it). */
    turn: integer('turn').notNull().default(0),
    /** Keep the plan with the location once the rooms are added (a location document, D155). */
    keepPlan: boolean('keep_plan').notNull().default(false),
    /** The checked answer, the image's sent size, the proposed rooms and the scale. */
    result: jsonb('result'),
    /** The `floor_plan.apply` event that added the rooms. */
    appliedEventId: uuid('applied_event_id'),
    createdBy: uuid('created_by').notNull(),
    ...mutable(),
  },
  (t) => [
    status.check('floor_plans'),
    unique('floor_plans_location_id_uq').on(t.locationId, t.id),
    check('floor_plans_turn_chk', sql`turn IN (0, 90, 180, 270)`),
    check('floor_plans_result_chk', sql`result IS NULL OR jsonb_typeof(result) = 'object'`),
    index('floor_plans_location_idx').on(t.locationId, t.createdAt),
  ],
);
