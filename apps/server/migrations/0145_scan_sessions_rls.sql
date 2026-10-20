-- Custom SQL migration file, put your code below! --
-- 1.12 (#168): scan sessions. Above, in 0144, drizzle's part: scan_sessions, scan_session_lines,
-- and the two new kinds in sync_ops_op_chk (`scan_session_lines`, `scan_session_finish`). Below,
-- row-level security:
--   Everyone who sees a session's location reads the session and its lines, viewers included (the
--   Activity entry names it). Members and above (kept.writable_location_ids()) start one as
--   themselves; lines are added only by the person who started it, and only while it is open. Its
--   finish sets the totals once; nothing else changes and nothing is deleted (a purged location or
--   thing takes its rows with it, through the foreign keys).
-- No kept_system policy: no job reads these tables.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['scan_sessions', 'scan_session_lines'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY owner_all ON public.%I FOR ALL TO kept_owner USING (true) WITH CHECK (true)',
      t);
    EXECUTE format('REVOKE UPDATE, DELETE ON public.%I FROM kept_app, kept_system', t);
  END LOOP;
END $$;
--> statement-breakpoint

-- Sessions ---------------------------------------------------------------------------------------
CREATE POLICY app_select ON public.scan_sessions FOR SELECT TO kept_app
  USING (location_id IN (SELECT kept.visible_location_ids()));
--> statement-breakpoint
CREATE POLICY app_insert ON public.scan_sessions FOR INSERT TO kept_app
  WITH CHECK (location_id IN (SELECT kept.writable_location_ids())
              AND started_by = (SELECT kept.current_user_id())
              AND finished_at IS NULL);
--> statement-breakpoint
CREATE POLICY app_update ON public.scan_sessions FOR UPDATE TO kept_app
  USING (location_id IN (SELECT kept.writable_location_ids())
         AND started_by = (SELECT kept.current_user_id()))
  WITH CHECK (location_id IN (SELECT kept.writable_location_ids())
              AND started_by = (SELECT kept.current_user_id()));
--> statement-breakpoint
GRANT UPDATE (finished_at, expected, seen, not_here, moved, skipped, audit_event_id)
  ON public.scan_sessions TO kept_app;
--> statement-breakpoint

-- Lines: added by the session's own person while it is open; append-only.
CREATE POLICY app_select ON public.scan_session_lines FOR SELECT TO kept_app
  USING (location_id IN (SELECT kept.visible_location_ids()));
--> statement-breakpoint
CREATE POLICY app_insert ON public.scan_session_lines FOR INSERT TO kept_app
  WITH CHECK (location_id IN (SELECT kept.writable_location_ids())
              AND EXISTS (SELECT 1 FROM public.scan_sessions s
                           WHERE s.id = session_id
                             AND s.started_by = (SELECT kept.current_user_id())
                             AND s.finished_at IS NULL));
