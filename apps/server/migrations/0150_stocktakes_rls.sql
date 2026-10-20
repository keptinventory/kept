-- Custom SQL migration file, put your code below! --
-- 1.14 (#172): stocktakes. Above, in 0149, drizzle's part: the kept results of a count (new line
-- actions, where each thing was, its area, who read it, quantities found; the totals, the areas
-- counted and who finished it on the session), planned counts (schedules.kind = 'count', a place
-- every 1–24 months, one active per place) and the session's link to the planned count it
-- completed. Below:
--   1. A count is shared until it is finished: any member who counts in its location adds lines
--      to an open session (as themselves), a read upgrades a result that was only kept (a thing
--      someone else's phone listed as missing, then found), and any of them finishes it, once;
--      the finish re-decides the kept results of everyone's lines (lent, in repair, trashed, not
--      counted). Lines read before 1.14 were read by the person who started their session.
--   2. A planned count is done by counting its place: kept.recompute_schedule_anchor() (0063's)
--      also reads the latest finished count linked to the schedule and not undone, in the
--      location's zone. Linking a count re-anchors the schedule and ends its snooze and skip, as a
--      completing service does; undoing the count (its `scan.session` event's undo) re-anchors it.
--   3. The reminder scan (kept_system) closes a planned count's reminder as done when a count
--      linked to it finished since it opened: it reads scan_sessions.
-- src/sessions/counts.test.ts tests them; test/leak-capture.ts fills the tables.

-- 1. A shared count -------------------------------------------------------------------------------
UPDATE public.scan_session_lines l SET read_by = s.started_by
  FROM public.scan_sessions s WHERE s.id = l.session_id AND l.read_by IS NULL;
--> statement-breakpoint
DROP POLICY app_update ON public.scan_sessions;
--> statement-breakpoint
-- Open: anyone who counts there adds to it (its areas) and finishes it, as themselves.
CREATE POLICY app_update ON public.scan_sessions FOR UPDATE TO kept_app
  USING (location_id IN (SELECT kept.writable_location_ids()) AND finished_at IS NULL)
  WITH CHECK (location_id IN (SELECT kept.writable_location_ids())
              AND (finished_by IS NULL OR finished_by = (SELECT kept.current_user_id())));
--> statement-breakpoint
GRANT UPDATE (missing, elsewhere, on_loan, in_repair, not_counted, counted_place_ids, schedule_id,
              finished_by)
  ON public.scan_sessions TO kept_app;
--> statement-breakpoint
DROP POLICY app_insert ON public.scan_session_lines;
--> statement-breakpoint
CREATE POLICY app_insert ON public.scan_session_lines FOR INSERT TO kept_app
  WITH CHECK (location_id IN (SELECT kept.writable_location_ids())
              AND read_by = (SELECT kept.current_user_id())
              AND EXISTS (SELECT 1 FROM public.scan_sessions s
                           WHERE s.id = session_id AND s.finished_at IS NULL));
--> statement-breakpoint
CREATE POLICY app_update ON public.scan_session_lines FOR UPDATE TO kept_app
  USING (location_id IN (SELECT kept.writable_location_ids())
         AND EXISTS (SELECT 1 FROM public.scan_sessions s
                      WHERE s.id = session_id AND s.finished_at IS NULL))
  WITH CHECK (location_id IN (SELECT kept.writable_location_ids()));
--> statement-breakpoint
GRANT UPDATE (read_at, action, to_place_id, to_container_id, read_by, found_qty, expected_qty,
              short_not_here)
  ON public.scan_session_lines TO kept_app;
--> statement-breakpoint

-- 2. Planned counts -------------------------------------------------------------------------------
-- The day a planned count was last done: its latest finished count, linked and not undone.
CREATE FUNCTION kept.schedule_counted_on(p_schedule uuid) RETURNS date
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT max((s.finished_at AT TIME ZONE l.timezone)::date)
    FROM public.scan_sessions s
    JOIN public.locations l ON l.id = s.location_id
   WHERE s.schedule_id = p_schedule AND s.finished_at IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.audit_events u
                      WHERE u.undo_of = s.audit_event_id AND u.location_id = s.location_id)
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION kept.schedule_counted_on(uuid) FROM PUBLIC, kept_app, kept_system;
--> statement-breakpoint
-- 0063's, with the latest count: the later of it and the latest confirmed service.
CREATE OR REPLACE FUNCTION kept.recompute_schedule_anchor(p_schedule uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  s public.schedules%ROWTYPE;
  last_on date;
  counted_on date;
  last_value numeric;
BEGIN
  SELECT * INTO s FROM public.schedules x WHERE x.id = p_schedule;
  IF s.id IS NULL THEN
    RETURN;
  END IF;
  SELECT r.serviced_on INTO last_on
    FROM public.service_completions c JOIN public.service_records r ON r.id = c.service_record_id
   WHERE c.schedule_id = p_schedule AND r.review_state = 'confirmed'
   ORDER BY r.serviced_on DESC, r.created_at DESC, r.id DESC LIMIT 1;
  IF s.kind = 'count' THEN
    counted_on := kept.schedule_counted_on(p_schedule);
    IF counted_on IS NOT NULL AND (last_on IS NULL OR counted_on > last_on) THEN
      last_on := counted_on;
    END IF;
  END IF;
  IF s.meter_id IS NOT NULL THEN
    SELECT d.value + m.offset INTO last_value
      FROM public.service_completions c
      JOIN public.service_records r ON r.id = c.service_record_id
      JOIN public.meter_readings d ON d.id = r.meter_reading_id
      JOIN public.meters m ON m.id = d.meter_id
     WHERE c.schedule_id = p_schedule AND d.meter_id = s.meter_id
       AND r.review_state = 'confirmed'
     ORDER BY r.serviced_on DESC, r.created_at DESC, r.id DESC LIMIT 1;
  END IF;
  UPDATE public.schedules x
     SET anchor_on = coalesce(last_on, x.base_on),
         anchor_value = coalesce(last_value, x.base_value)
   WHERE x.id = p_schedule
     AND (x.anchor_on IS DISTINCT FROM coalesce(last_on, x.base_on)
          OR x.anchor_value IS DISTINCT FROM coalesce(last_value, x.base_value));
END $$;
--> statement-breakpoint
-- A count linked to a planned count: as a completion, it ends the snooze and the skip.
CREATE FUNCTION kept.scan_session_schedule_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.schedule_id IS NOT NULL THEN
    UPDATE public.schedules x
       SET snoozed_until = NULL, snoozed_until_value = NULL, skip_next = false
     WHERE x.id = NEW.schedule_id
       AND (x.snoozed_until IS NOT NULL OR x.snoozed_until_value IS NOT NULL OR x.skip_next);
    PERFORM kept.recompute_schedule_anchor(NEW.schedule_id);
  END IF;
  IF OLD.schedule_id IS NOT NULL AND OLD.schedule_id IS DISTINCT FROM NEW.schedule_id THEN
    PERFORM kept.recompute_schedule_anchor(OLD.schedule_id);
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION kept.scan_session_schedule_changed() FROM PUBLIC, kept_app, kept_system;
--> statement-breakpoint
CREATE TRIGGER scan_sessions_schedule AFTER UPDATE OF schedule_id ON public.scan_sessions
  FOR EACH ROW WHEN (OLD.schedule_id IS DISTINCT FROM NEW.schedule_id)
  EXECUTE FUNCTION kept.scan_session_schedule_changed();
--> statement-breakpoint
-- An undone count no longer counts: its schedule is re-anchored on the undo's own row.
CREATE FUNCTION kept.scan_session_undone() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  sid uuid;
BEGIN
  FOR sid IN SELECT s.schedule_id FROM public.scan_sessions s
              WHERE s.audit_event_id = NEW.undo_of AND s.location_id = NEW.location_id
                AND s.schedule_id IS NOT NULL LOOP
    PERFORM kept.recompute_schedule_anchor(sid);
  END LOOP;
  RETURN NULL;
END $$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION kept.scan_session_undone() FROM PUBLIC, kept_app, kept_system;
--> statement-breakpoint
CREATE TRIGGER audit_events_scan_session_undone AFTER INSERT ON public.audit_events
  FOR EACH ROW WHEN (NEW.action = 'scan.session' AND NEW.undo_of IS NOT NULL)
  EXECUTE FUNCTION kept.scan_session_undone();
--> statement-breakpoint

-- 3. The reminder scan's read ---------------------------------------------------------------------
CREATE POLICY system_select ON public.scan_sessions FOR SELECT TO kept_system USING (true);
--> statement-breakpoint
COMMENT ON POLICY system_select ON public.scan_sessions IS
  'the reminder scan (T14) closes a planned count''s reminder when a count of its place, linked to it, finished since it opened';
