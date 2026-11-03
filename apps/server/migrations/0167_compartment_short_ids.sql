-- Furniture's compartments (#238, 1.14.4): merging compartments moves the short IDs of the ones
-- merged away to the one that stays (not its primary), so their printed labels open it; a split
-- and an undo move them back (apps/server/src/templates/furniture.ts). kept_app can't write a
-- short ID's place (0016), so this door does it for one piece of furniture's compartments only:
-- the furniture is a live place in a location the caller may write in, every code is an assigned
-- short ID of that location on a place directly in it, and every place a code goes to is one
-- too (live or in the trash). `p_moves` is [{code, place_id, is_primary}]. Codes that move lose
-- primary first, so a place never has two. Additive: nothing older calls it.
CREATE FUNCTION kept.move_compartment_short_ids(p_furniture uuid, p_moves jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  uid uuid := kept.current_user_id();
  f public.places%ROWTYPE;
  n integer;
BEGIN
  SELECT * INTO f FROM public.places pl
   WHERE pl.id = p_furniture AND pl.deleted_at IS NULL
     AND pl.location_id IN (SELECT kept.writable_location_ids());
  IF uid IS NULL OR f.id IS NULL OR jsonb_typeof(p_moves) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'no such furniture of yours' USING ERRCODE = 'insufficient_privilege';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('kept.places'), hashtext(f.location_id::text));
  IF EXISTS (
    SELECT 1
      FROM jsonb_to_recordset(p_moves) AS m(code text, place_id uuid, is_primary boolean)
      LEFT JOIN public.short_ids s ON s.code = m.code
      LEFT JOIN public.places src ON src.id = s.place_id
      LEFT JOIN public.places dst ON dst.id = m.place_id
     WHERE s.code IS NULL OR s.state <> 'assigned' OR s.location_id <> f.location_id
        OR src.parent_id IS DISTINCT FROM p_furniture OR dst.parent_id IS DISTINCT FROM p_furniture
        OR dst.location_id <> f.location_id OR m.is_primary IS NULL
  ) THEN
    RAISE EXCEPTION 'those labels aren''t this furniture''s' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.short_ids s SET is_primary = false
    FROM jsonb_to_recordset(p_moves) AS m(code text, place_id uuid, is_primary boolean)
   WHERE s.code = m.code AND s.is_primary;
  UPDATE public.short_ids s SET place_id = m.place_id
    FROM jsonb_to_recordset(p_moves) AS m(code text, place_id uuid, is_primary boolean)
   WHERE s.code = m.code;
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.short_ids s SET is_primary = true
    FROM jsonb_to_recordset(p_moves) AS m(code text, place_id uuid, is_primary boolean)
   WHERE s.code = m.code AND m.is_primary;
  RETURN n;
END $$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION kept.move_compartment_short_ids(uuid, jsonb) FROM PUBLIC, kept_system;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kept.move_compartment_short_ids(uuid, jsonb) TO kept_app;
