-- Custom SQL migration file, put your code below! --
-- 1.x, #194: room photos. Above, drizzle's part: room_captures, extractions.room_capture_id,
-- inbox_items.room_capture_id (a 'room' item's subject), 'room' in the mode and kind checks, the
-- two ledger tasks, map_nodes.placed_by_kept and locations.keep_room_photos. Below:
--   room_captures is the inbox's data: members and above (kept.writable_location_ids()) read and
--   change a location's rows, and insert only their own. No one deletes one: a location's purge,
--   or its place or container's, takes it with it (referential actions pass row-level security).
--   No kept_system policy: the extract job runs as the capturing person.
--   map_nodes keeps its column grants (0131): kept_app reads and writes placed_by_kept as it does
--   the rest of a node's layout.
--   locations.keep_room_photos is a setting like long_unseen_months (0006's UPDATE grant).

ALTER TABLE public.room_captures ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.room_captures FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY owner_all ON public.room_captures FOR ALL TO kept_owner USING (true) WITH CHECK (true);
--> statement-breakpoint
REVOKE UPDATE, DELETE ON public.room_captures FROM kept_app, kept_system;
--> statement-breakpoint
CREATE POLICY app_select ON public.room_captures FOR SELECT TO kept_app
  USING (location_id IN (SELECT kept.writable_location_ids()));
--> statement-breakpoint
CREATE POLICY app_insert ON public.room_captures FOR INSERT TO kept_app
  WITH CHECK (location_id IN (SELECT kept.writable_location_ids())
              AND created_by = (SELECT kept.current_user_id()));
--> statement-breakpoint
CREATE POLICY app_update ON public.room_captures FOR UPDATE TO kept_app
  USING (location_id IN (SELECT kept.writable_location_ids()))
  WITH CHECK (location_id IN (SELECT kept.writable_location_ids()));
--> statement-breakpoint
GRANT UPDATE (status, result, updated_at, row_version) ON public.room_captures TO kept_app;
--> statement-breakpoint
CREATE TRIGGER touch_row BEFORE INSERT OR UPDATE ON public.room_captures
  FOR EACH ROW EXECUTE FUNCTION kept.touch_row();
--> statement-breakpoint
GRANT SELECT (placed_by_kept), INSERT (placed_by_kept) ON public.map_nodes TO kept_app;
--> statement-breakpoint
GRANT UPDATE (keep_room_photos) ON public.locations TO kept_app;
