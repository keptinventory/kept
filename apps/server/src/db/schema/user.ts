import { sql } from 'drizzle-orm';
import { boolean, check, index, jsonb, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { user } from './auth.js';
import { id, mutable, tstz } from './common.js';
import { places } from './places.js';
import { locations } from './tenancy.js';

// A user's own things beside the inventory (D42, D138, D205): saved views
// of a list, optionally shared with a location, each person's pinned and default views per list,
// which hints they have seen, and the places they folded in the places outline. Row-level
// security is in 0020 (saved_views, user_hints), 0034 (saved_view_prefs) and 0164 (place_folds).

/** A list's name as `saved_views.surface` and `saved_view_prefs.surface` store it (D205);
 * @kept/shared's LIST_SURFACES is the set the app accepts. */
const SURFACE_CHECK = sql`surface ~ '^[a-z][a-z-]{0,31}$'`;

/** A saved view of a list (D42, D205). Shared views belong to a location and are readable by its
 * members. `surface` names the list; `query` is its list state (@kept/shared SavedListQuery). */
export const savedViews = pgTable(
  'saved_views',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    locationId: uuid('location_id').references(() => locations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    query: jsonb('query').notNull().default(sql`'{}'::jsonb`),
    shared: boolean('shared').notNull().default(false),
    surface: text('surface').notNull().default('search'),
    ...mutable(),
  },
  (t) => [
    check('saved_views_name_chk', sql`char_length(name) BETWEEN 1 AND 80`),
    check('saved_views_surface_chk', SURFACE_CHECK),
    check('saved_views_query_chk', sql`jsonb_typeof(query) = 'object'`),
    check('saved_views_shared_chk', sql`NOT shared OR location_id IS NOT NULL`),
    index('saved_views_user_idx').on(t.userId),
    index('saved_views_location_idx').on(t.locationId).where(sql`shared`),
    index('saved_views_user_surface_idx').on(t.userId, t.surface),
  ],
);

/** A person's own choices on one list's saved views (D205): the view it opens with, and the
 * views pinned as tabs, in order. A view the person can no longer see is dropped when read. */
export const savedViewPrefs = pgTable(
  'saved_view_prefs',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    surface: text('surface').notNull(),
    defaultViewId: uuid('default_view_id').references(() => savedViews.id, {
      onDelete: 'set null',
    }),
    pinned: uuid('pinned').array().notNull().default(sql`'{}'::uuid[]`),
  },
  (t) => [
    primaryKey({ name: 'saved_view_prefs_pk', columns: [t.userId, t.surface] }),
    check('saved_view_prefs_surface_chk', SURFACE_CHECK),
    check('saved_view_prefs_pinned_chk', sql`cardinality(pinned) <= 20`),
  ],
);

/** Hints a user has seen or dismissed (D138). */
export const userHints = pgTable(
  'user_hints',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    hintKey: text('hint_key').notNull(),
    seenAt: tstz('seen_at').notNull().defaultNow(),
    dismissed: boolean('dismissed').notNull().default(false),
  },
  (t) => [
    primaryKey({ name: 'user_hints_pk', columns: [t.userId, t.hintKey] }),
    check('user_hints_key_chk', sql`hint_key ~ '^[a-z0-9_.:-]{1,64}$'`),
  ],
);

/** The places a person folded in a location's places outline (#358), one row each, so the outline
 * opens the same on every device. Folding is the person's own view: not audited, and a place
 * that goes (or a person) takes its rows with it. */
export const placeFolds = pgTable(
  'place_folds',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ name: 'place_folds_pk', columns: [t.userId, t.placeId] }),
    index('place_folds_place_idx').on(t.placeId),
  ],
);
