-- Custom SQL migration file, put your code below! ---- Change unit on a meter (#385): an odometer relabelled between km and mi, or its readings
-- converted (meters/units.ts).
--
--   1. kept_app may change a meter's unit (owners and admins, `meters.manage`, checked by the
--      route; RLS as for the label).
--   2. A unit change re-anchors every schedule that counts on the meter: a schedule's anchor is
--      kept by kept.recompute_schedule_anchor() (0053, 0150) and has no grant, and a conversion
--      changes the reading a completing service recorded. Relabelling leaves the anchors as they
--      were, so the recompute finds nothing to write.
-- Additive: the release before never writes `unit` after a meter is made.

GRANT UPDATE (unit) ON public.meters TO kept_app;
--> statement-breakpoint
CREATE FUNCTION kept.meter_unit_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  sid uuid;
BEGIN
  FOR sid IN SELECT x.id FROM public.schedules x WHERE x.meter_id = NEW.id LOOP
    PERFORM kept.recompute_schedule_anchor(sid);
  END LOOP;
  RETURN NULL;
END $$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION kept.meter_unit_changed() FROM PUBLIC, kept_app, kept_system;
--> statement-breakpoint
CREATE TRIGGER meters_unit_changed AFTER UPDATE OF unit ON public.meters
  FOR EACH ROW WHEN (OLD.unit IS DISTINCT FROM NEW.unit)
  EXECUTE FUNCTION kept.meter_unit_changed();
