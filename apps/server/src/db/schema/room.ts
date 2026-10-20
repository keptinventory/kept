import { ROOM_CAPTURE_STATUSES, ROOM_LIMITS } from '@kept/shared';
import { sql } from 'drizzle-orm';
import { check, foreignKey, index, jsonb, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { id, mutable, textEnum } from './common.js';
import { places } from './places.js';
import { locations } from './tenancy.js';
import { things } from './things.js';

// Room photos (#194): one row per Room capture, tying its photos, the extraction of each photo and
// its inbox item together. The photos are the target's own `photo` attachments (`attachment_ids`,
// in the order taken); each is read by one `extractions` row (`room_capture_id`), and the job of
// the last one to finish merges them (`status` reading → merging → ready) into `result`: the
// drafts it made, storage furniture proposed as places, and what is already in Kept. Members and
// above see and change a location's rows (the inbox's rule); the row-level security is in the
// custom migration that follows. The id is the capture's own (the phone's client id).

const status = textEnum('status', ROOM_CAPTURE_STATUSES);

export const roomCaptures = pgTable(
  'room_captures',
  {
    id: id(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    /** Where the drafts go: a place, or a container. */
    placeId: uuid('place_id'),
    containerId: uuid('container_id'),
    batchId: uuid('batch_id').notNull(),
    status: status.col().notNull().default('reading'),
    /** The Kept codes the phone read in the photos (upper case). */
    codes: text('codes').array().notNull().default(sql`'{}'::text[]`),
    /** The photos, as the target's attachments, in the order taken. */
    attachmentIds: uuid('attachment_ids').array().notNull().default(sql`'{}'::uuid[]`),
    result: jsonb('result'),
    createdBy: uuid('created_by').notNull(),
    ...mutable(),
  },
  (t) => [
    status.check('room_captures'),
    unique('room_captures_location_id_uq').on(t.locationId, t.id),
    check('room_captures_target_chk', sql`num_nonnulls(place_id, container_id) = 1`),
    check(
      'room_captures_codes_chk',
      sql`cardinality(codes) <= ${sql.raw(String(ROOM_LIMITS.codes))}`,
    ),
    check(
      'room_captures_photos_chk',
      sql`cardinality(attachment_ids) BETWEEN 1 AND ${sql.raw(String(ROOM_LIMITS.photos))}`,
    ),
    check('room_captures_result_chk', sql`result IS NULL OR jsonb_typeof(result) = 'object'`),
    foreignKey({
      name: 'room_captures_place_fk',
      columns: [t.locationId, t.placeId],
      foreignColumns: [places.locationId, places.id],
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    foreignKey({
      name: 'room_captures_container_fk',
      columns: [t.locationId, t.containerId],
      foreignColumns: [things.locationId, things.id],
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    index('room_captures_location_idx').on(t.locationId, t.createdAt),
    index('room_captures_batch_idx').on(t.batchId),
  ],
);
