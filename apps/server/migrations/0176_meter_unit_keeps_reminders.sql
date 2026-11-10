-- Custom SQL migration file, put your code below! ---- A meter's conversion keeps its reminders (#510): a schedule's occurrence is keyed by its due point
-- (`meter:15000`), and converting the odometer (meters/units.ts) moves that point to the new unit
-- (`meter:9320.568`), so the next scan saw a new occurrence and sent the reminder again.
--
-- kept.meter_unit_changed() (0175), after re-anchoring the meter's schedules, now carries each of
-- their occurrences across a km to mi change, or back: one whose due point, converted
-- (1 mi = 1.609344 km), is within half a unit of the schedule's due point now takes the agenda's
-- key, so it stays the one occurrence with its notifications and deliveries. Undo changes the
-- unit back and carries them back. A relabel leaves the values, and so the keys, as they were:
-- nothing to carry. A key already taken (an occurrence the scan wrote before this release) is
-- left alone.
-- Additive: the function's signature and the trigger are unchanged.

CREATE OR REPLACE FUNCTION kept.meter_unit_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  sid uuid;
  from_unit text := lower(btrim(OLD.unit));
  to_unit text := lower(btrim(NEW.unit));
  factor numeric;
BEGIN
  FOR sid IN SELECT x.id FROM public.schedules x WHERE x.meter_id = NEW.id LOOP
    PERFORM kept.recompute_schedule_anchor(sid);
  END LOOP;
  IF from_unit = 'km' AND to_unit = 'mi' THEN
    factor := 1 / 1.609344;
  ELSIF from_unit = 'mi' AND to_unit = 'km' THEN
    factor := 1.609344;
  ELSE
    RETURN NULL;
  END IF;
  UPDATE public.reminder_occurrences o
     SET due_period = a.due_period
    FROM public.agenda_items a
   WHERE o.source_type = 'schedule' AND a.source_type = 'schedule'
     AND a.source_id = o.source_id AND a.kind = o.kind AND a.meter_id = NEW.id
     AND o.location_id = a.location_id
     AND o.due_period LIKE 'meter:%' AND a.due_period LIKE 'meter:%'
     AND o.due_period <> a.due_period
     AND abs(substr(o.due_period, 7)::numeric * factor - a.due_value) <= 0.5
     AND NOT EXISTS (
       SELECT 1 FROM public.reminder_occurrences x
        WHERE x.location_id = o.location_id AND x.thing_id IS NOT DISTINCT FROM o.thing_id
          AND x.place_id IS NOT DISTINCT FROM o.place_id AND x.source_type = o.source_type
          AND x.source_id = o.source_id AND x.kind = o.kind AND x.due_period = a.due_period);
  RETURN NULL;
END $$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION kept.meter_unit_changed() FROM PUBLIC, kept_app, kept_system;
