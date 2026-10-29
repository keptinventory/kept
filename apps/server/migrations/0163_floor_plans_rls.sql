-- Custom SQL migration file, put your code below! --
-- 1.14.3, D266: floor plan to map. Above (0162), drizzle's part: floor_plans,
-- extractions.floor_plan_id (the plan's one `plan` extraction), attachments.floor_plan_id (the
-- upload, while it is reviewed), 'plan' in extractions_mode_chk, 'extract_plan' in
-- llm_calls_task_chk, and floor_plan_id in attachments_one_subject_chk. Below:
--   1. floor_plans is the map's review: members and above (kept.writable_location_ids()) read and
--      change a location's rows and insert only their own, as room_captures (0143). Viewers and
--      read tokens see none. No one deletes one: a location's purge takes it with it (referential
--      actions pass row-level security). No kept_system policy: the extract job runs as the
--      uploader.
--   2. The upload is inserted with attachments.in_review = true, so 0147's policy already keeps it
--      from viewers and read tokens.
--   3. kept.discard_stale_floor_plans(before, limit): the daily purge's door (kept_system only,
--      trash/jobs.ts) for reviews nobody finished. Each plan still open that was made before
--      `before` (open for 30 days: created_at, which no update moves) is
--      discarded with its result cleared, and its upload's attachment deleted, which takes the
--      extraction with it (its foreign key cascades) and lets the file go: the orphan purge
--      removes it a day later if nothing else holds it.
-- Old pods ignore the table and both columns. test/leak.test.ts and src/db/migrate.test.ts list
-- the function.

ALTER TABLE public.floor_plans ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.floor_plans FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY owner_all ON public.floor_plans FOR ALL TO kept_owner USING (true) WITH CHECK (true);
--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.floor_plans FROM kept_app, kept_system;
--> statement-breakpoint
CREATE POLICY app_select ON public.floor_plans FOR SELECT TO kept_app
  USING (location_id IN (SELECT kept.writable_location_ids()));
--> statement-breakpoint
CREATE POLICY app_insert ON public.floor_plans FOR INSERT TO kept_app
  WITH CHECK (location_id IN (SELECT kept.writable_location_ids())
              AND created_by = (SELECT kept.current_user_id()));
--> statement-breakpoint
CREATE POLICY app_update ON public.floor_plans FOR UPDATE TO kept_app
  USING (location_id IN (SELECT kept.writable_location_ids()))
  WITH CHECK (location_id IN (SELECT kept.writable_location_ids()));
--> statement-breakpoint
GRANT UPDATE (status, result, keep_plan, applied_event_id, updated_at, row_version)
  ON public.floor_plans TO kept_app;
--> statement-breakpoint
CREATE TRIGGER touch_row BEFORE INSERT OR UPDATE ON public.floor_plans
  FOR EACH ROW EXECUTE FUNCTION kept.touch_row();
--> statement-breakpoint

CREATE FUNCTION kept.discard_stale_floor_plans(p_before timestamptz, p_limit integer)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  ids uuid[];
BEGIN
  SELECT coalesce(array_agg(s.id), ARRAY[]::uuid[]) INTO ids FROM (
    SELECT f.id FROM public.floor_plans f
     WHERE f.status IN ('reading', 'ready', 'failed', 'off') AND f.created_at < p_before
     ORDER BY f.created_at, f.id
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED) s;
  IF cardinality(ids) = 0 THEN
    RETURN 0;
  END IF;
  DELETE FROM public.attachments a WHERE a.floor_plan_id = ANY (ids);
  UPDATE public.floor_plans f SET status = 'discarded', result = NULL WHERE f.id = ANY (ids);
  RETURN cardinality(ids);
END $$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION kept.discard_stale_floor_plans(timestamptz, integer)
  FROM PUBLIC, kept_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kept.discard_stale_floor_plans(timestamptz, integer) TO kept_system;
