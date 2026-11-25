-- Custom SQL migration file, put your code below! --
-- A split keeps its purchase after a move (#583). A thing bought in one location and moved to
-- another of the same account keeps its purchase line in the first (D115). Splitting it there
-- (the split itself, part of a move, a partial loan return or handover, a box check's "found 2 of
-- 3", a counting session) inserts the new part in the new location with that line, and
-- kept.guard_purchase_line_link() (0018) refused it: 42501, answered as "This isn't here any
-- more, or you can't see it."
--
-- One exemption: on INSERT, a split part may take its source's line when the source is in the
-- part's location and holds that same line. The source is read as the caller (the function stays
-- SECURITY INVOKER), so it must be a thing the caller can see; its line got there by the guard or
-- by a move, which copies a line across accounts. So a part can only repeat a link that already
-- exists in its own location: never another account's line, never one from a location it isn't
-- in. An UPDATE that sets a line is checked as before (`split_from_id` has no UPDATE grant).
-- Additive: the function's signature, owner, grants, security and search_path, and the trigger,
-- are unchanged.

CREATE OR REPLACE FUNCTION kept.guard_purchase_line_link() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.purchase_line_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.purchase_line_id IS DISTINCT FROM OLD.purchase_line_id)
     AND NOT EXISTS (SELECT 1 FROM public.purchase_lines pl
                      WHERE pl.id = NEW.purchase_line_id AND pl.location_id = NEW.location_id)
     AND NOT (TG_OP = 'INSERT' AND NEW.split_from_id IS NOT NULL
              AND EXISTS (SELECT 1 FROM public.things s
                           WHERE s.id = NEW.split_from_id AND s.location_id = NEW.location_id
                             AND s.purchase_line_id = NEW.purchase_line_id)) THEN
    RAISE EXCEPTION 'a thing''s purchase line is one of its own location'
      USING ERRCODE = 'insufficient_privilege', CONSTRAINT = 'things_purchase_line';
  END IF;
  RETURN NEW;
END $$;
