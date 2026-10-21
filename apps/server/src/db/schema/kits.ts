import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  numeric,
  pgTable,
  primaryKey,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { mutable } from './common.js';
import { locations } from './tenancy.js';
import { things } from './things.js';

// Kits (1.14, #170): a container with a parts list, what *should* be in it. The kit row is the
// container's flag (its id is the thing's); its parts are things of the same location, each in at
// most one kit, with how many belong. A part may be elsewhere (lent, moved out, in another place):
// the Parts tab says where. Row-level security in 0152.

export const kits = pgTable(
  'kits',
  {
    thingId: uuid('thing_id').primaryKey(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by').notNull(),
    ...mutable(),
  },
  (t) => [
    foreignKey({
      name: 'kits_thing_fk',
      columns: [t.locationId, t.thingId],
      foreignColumns: [things.locationId, things.id],
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    unique('kits_location_id_uq').on(t.locationId, t.thingId),
    index('kits_location_idx').on(t.locationId),
  ],
);

export const kitParts = pgTable(
  'kit_parts',
  {
    kitId: uuid('kit_id').notNull(),
    locationId: uuid('location_id').notNull(),
    /** A thing is a part of at most one kit. */
    thingId: uuid('thing_id')
      .notNull()
      .unique('kit_parts_thing_uq')
      .references(() => things.id, { onDelete: 'cascade' }),
    quantity: numeric('quantity', { precision: 12, scale: 3 }).notNull().default('1'),
    ...mutable(),
  },
  (t) => [
    primaryKey({ name: 'kit_parts_pk', columns: [t.kitId, t.thingId] }),
    foreignKey({
      name: 'kit_parts_kit_fk',
      columns: [t.locationId, t.kitId],
      foreignColumns: [kits.locationId, kits.thingId],
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    check('kit_parts_quantity_chk', sql`quantity > 0`),
    check('kit_parts_not_itself_chk', sql`thing_id <> kit_id`),
    index('kit_parts_location_idx').on(t.locationId),
  ],
);
