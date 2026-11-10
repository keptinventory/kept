ALTER TABLE "things" ADD COLUMN "rack_units" numeric(3, 1);--> statement-breakpoint
ALTER TABLE "things" ADD COLUMN "rack_at" jsonb;--> statement-breakpoint
ALTER TABLE "things" ADD CONSTRAINT "things_rack_units_chk" CHECK (rack_units BETWEEN 0 AND 60 AND rack_units * 2 = trunc(rack_units * 2));--> statement-breakpoint
ALTER TABLE "things" ADD CONSTRAINT "things_rack_at_chk" CHECK (rack_at IS NULL OR jsonb_typeof(rack_at) = 'object');--> statement-breakpoint
-- Racks measured in rack units (#373, 1.14.7). A rack is furniture whose places.layout is
-- {kind: 'rack', units, width, numbering, mount} (no column: layout is jsonb since 0161). Gear is a
-- thing in it: rack_units is how many units it takes (0 to 60 in half units, 0 beside the rails),
-- rack_at where it is mounted ({rackId, u, face, full}, packages/shared racks.ts), counted only
-- while the thing's place is that rack. kept.clear_rack_position() empties rack_at when the thing
-- moves, by any path (a move, a bulk move, an offline op, an older pod, a merge), so gear moved out
-- and back never comes back to a unit someone else has since taken. Additive: the release before
-- never reads or writes the columns, and its moves are what the trigger is for.
-- src/db/migrate.test.ts lists the function (no role may call it).
GRANT UPDATE (rack_units, rack_at) ON public.things TO kept_app;
--> statement-breakpoint
CREATE FUNCTION kept.clear_rack_position() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  NEW.rack_at := NULL;
  RETURN NEW;
END $$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION kept.clear_rack_position() FROM PUBLIC, kept_app, kept_system;
--> statement-breakpoint
CREATE TRIGGER things_clear_rack_position BEFORE UPDATE OF place_id, container_id ON public.things
  FOR EACH ROW
  WHEN (NEW.rack_at IS NOT NULL AND (OLD.place_id IS DISTINCT FROM NEW.place_id
                                     OR OLD.container_id IS DISTINCT FROM NEW.container_id))
  EXECUTE FUNCTION kept.clear_rack_position();
