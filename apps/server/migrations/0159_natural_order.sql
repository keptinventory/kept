-- Custom SQL migration file, put your code below! --
-- Places and things in natural order (1.13.0): ICU's root order with numbers read as numbers
-- ("Box 2" before "Box 10", Eastern Arabic digits too). The web sorts the same way with
-- Intl.Collator (packages/shared/src/order.ts). `und-u-kn` is ICU's standard form of
-- `und-u-kn-true`; the collation keeps the longer name the code uses.
CREATE COLLATION IF NOT EXISTS public."und-u-kn-true" (provider = icu, locale = 'und-u-kn');
--> statement-breakpoint
-- The things list's name order (things/service.ts, things/sheet.ts), its keyset ending in the id:
-- a location's first page and every page after a cursor read this index in order. Replaces 0016's,
-- whose expression no query used.
DROP INDEX IF EXISTS public.things_name_sort_idx;
--> statement-breakpoint
CREATE INDEX things_name_sort_idx ON public.things
  (location_id, (lower(coalesce(name, '')) COLLATE "und-u-kn-true"), id)
  WHERE deleted_at IS NULL;
