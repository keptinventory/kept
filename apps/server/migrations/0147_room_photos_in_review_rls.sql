-- Custom SQL migration file, put your code below! --
-- 1.x, #194: room photos are private until reviewed. Above, drizzle's part:
-- attachments.in_review. Below:
--   1. attachments: a row under review is read only by the location's members and up
--      (kept.writable_location_ids(): never a viewer, never a read token), the people who review
--      its Room card. files and file_derivatives follow, as their policies read through
--      attachments' (0020): a viewer gets neither the original nor a thumbnail of one.
--   2. The cover cache (0036) leaves photos under review out, and is refreshed when one becomes
--      an ordinary photo: a box's cover, which viewers, the phone's copy and share links read,
--      is never a room photo still under review.
--   3. Room cards open before this migration: their photos go under review now.
--   4. kept_app may clear the flag (Done with "Keep room photos", room/review.ts), never set it
--      again: kept.guard_attachment_review() refuses false → true (42501). A room capture sets it
--      on insert.

-- 1. Reading ------------------------------------------------------------------------------------
ALTER POLICY app_select ON public.attachments
  USING (location_id IN (SELECT kept.visible_location_ids())
         AND (NOT in_review OR location_id IN (SELECT kept.writable_location_ids())));
--> statement-breakpoint

-- 2. The cover cache ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION kept.refresh_thing_cover() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.thing_id IS NOT NULL THEN
    ids := ids || OLD.thing_id;
  END IF;
  IF TG_OP IN ('UPDATE', 'INSERT') AND NEW.thing_id IS NOT NULL THEN
    ids := ids || NEW.thing_id;
  END IF;
  IF cardinality(ids) = 0 THEN
    RETURN NULL;
  END IF;
  UPDATE public.things t
     SET cover_file_id = c.file_id
    FROM (SELECT x.id,
                 (SELECT a.file_id FROM public.attachments a
                   WHERE a.thing_id = x.id AND a.role = 'photo' AND a.file_id IS NOT NULL
                     AND NOT a.in_review
                   ORDER BY a.sort, a.created_at, a.id LIMIT 1) AS file_id
            FROM unnest(ids) AS x(id)) c
   WHERE t.id = c.id AND t.cover_file_id IS DISTINCT FROM c.file_id;
  RETURN NULL;
END $$;
--> statement-breakpoint
DROP TRIGGER attachments_thing_cover ON public.attachments;
--> statement-breakpoint
CREATE TRIGGER attachments_thing_cover
  AFTER INSERT OR DELETE OR UPDATE OF role, sort, thing_id, file_id, in_review ON public.attachments
  FOR EACH ROW EXECUTE FUNCTION kept.refresh_thing_cover();
--> statement-breakpoint

-- 3. Room cards already open --------------------------------------------------------------------
UPDATE public.attachments a SET in_review = true
  FROM public.room_captures rc
  JOIN public.inbox_items i ON i.room_capture_id = rc.id AND i.kind = 'room'
 WHERE i.resolved_at IS NULL AND a.id = ANY (rc.attachment_ids);
--> statement-breakpoint

-- 4. Clearing, never setting again --------------------------------------------------------------
GRANT UPDATE (in_review) ON public.attachments TO kept_app;
--> statement-breakpoint
CREATE FUNCTION kept.guard_attachment_review() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.in_review AND NOT OLD.in_review THEN
    RAISE EXCEPTION 'a photo goes under review only when it is taken'
      USING ERRCODE = 'insufficient_privilege', CONSTRAINT = 'attachments_in_review';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION kept.guard_attachment_review() FROM PUBLIC, kept_app, kept_system;
--> statement-breakpoint
CREATE TRIGGER attachments_guard_review BEFORE UPDATE OF in_review ON public.attachments
  FOR EACH ROW EXECUTE FUNCTION kept.guard_attachment_review();
