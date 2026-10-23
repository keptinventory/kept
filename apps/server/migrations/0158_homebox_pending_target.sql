ALTER TABLE "import_runs" DROP CONSTRAINT "import_runs_target_chk";--> statement-breakpoint
ALTER TABLE "import_runs" ADD COLUMN "new_location" jsonb;--> statement-breakpoint
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_new_location_chk" CHECK (new_location IS NULL OR (jsonb_typeof(new_location) = 'object'
          AND source = 'homebox_zip' AND location_id IS NULL));--> statement-breakpoint
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_target_chk" CHECK (location_id IS NOT NULL OR status IN ('draft', 'failed', 'cancelled')
          OR (status = 'checked' AND new_location IS NOT NULL));--> statement-breakpoint
-- A Homebox import into a new location (1.13.0): the location is made when Import runs, not when
-- it is chosen, so an import left at its check leaves nothing behind. Until then the run holds
-- what the location will be (`new_location`); its creator may set it (kept_app's update policy,
-- 0080, already limits a run with no target to its creator).
GRANT UPDATE (new_location) ON public.import_runs TO kept_app;
--> statement-breakpoint
-- The target, once (0080), now also for a checked Homebox run whose new location is made at
-- Import: the same creator-only, administered-location rules. The pending location is cleared in
-- the same statement (import_runs_new_location_chk).
CREATE OR REPLACE FUNCTION kept.set_import_target(p_run uuid, p_location uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  r public.import_runs%ROWTYPE;
  uid uuid := kept.current_user_id();
BEGIN
  SELECT * INTO r FROM public.import_runs x WHERE x.id = p_run FOR UPDATE;
  IF r.id IS NULL OR uid IS NULL
     OR NOT (r.created_by = uid
             OR (r.location_id IS NOT NULL AND r.location_id IN (SELECT kept.admin_location_ids())))
  THEN
    RAISE EXCEPTION 'no such import run' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF r.location_id IS NOT NULL THEN
    RAISE EXCEPTION 'an import''s location is set once'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'import_runs_target_fixed';
  END IF;
  IF NOT (r.status = 'draft' OR (r.status = 'checked' AND r.new_location IS NOT NULL))
     OR p_location IS NULL
     OR p_location NOT IN (SELECT kept.admin_location_ids()) THEN
    RAISE EXCEPTION 'no such location to import into' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.import_runs x SET location_id = p_location, new_location = NULL
   WHERE x.id = p_run;
END $$;
--> statement-breakpoint
-- A new account's Personal location starts with Essentials (1.13.0): finding things, without the
-- money, vehicles, lending and paperwork a person never chose. Existing Personal locations keep
-- what they have. The rest of the function is 0007's.
CREATE OR REPLACE FUNCTION kept.ensure_account(p_timezone text, p_locale text, p_currency text)
RETURNS TABLE (owner_account_id uuid, location_id uuid, created boolean, timezone text,
               currency text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
#variable_conflict use_column
DECLARE
  uid uuid := kept.current_user_id();
  u record;
  acct uuid;
  loc uuid;
  tz text;
  cur text;
  loc_tz text;
  loc_cur text;
  loc_created boolean := false;
  lang text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'ensuring an account needs a user scope' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT au.name, au.email INTO u FROM auth."user" au WHERE au.id = uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such user' USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('kept.ensure_account'), hashtext(uid::text));

  -- 1. The owner account (D114).
  SELECT oa.id INTO acct FROM public.owner_accounts oa WHERE oa.user_id = uid;
  IF acct IS NULL THEN
    acct := uuidv7();
    INSERT INTO public.owner_accounts (id, user_id) VALUES (acct, uid);
  END IF;

  -- Defaults: an existing profile's time zone wins (a managed profile made first);
  -- otherwise the caller's, if Postgres knows it; otherwise UTC. A currency Kept doesn't have
  -- falls back to USD, a malformed locale to en.
  SELECT p.timezone INTO tz FROM public.user_profiles p WHERE p.user_id = uid;
  IF tz IS NULL THEN
    tz := CASE WHEN p_timezone IS NOT NULL
                    AND EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names n WHERE n.name = p_timezone)
               THEN p_timezone ELSE 'UTC' END;
  END IF;
  cur := CASE WHEN EXISTS (SELECT 1 FROM public.currencies c WHERE c.code = p_currency AND c.enabled)
              THEN p_currency ELSE 'USD' END;
  lang := CASE WHEN p_locale ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,3}$' THEN p_locale ELSE 'en' END;

  -- 2–4. The Personal location (preset essentials since 1.13.0), its owner membership and its
  -- Unplaced area.
  SELECT l.id, l.timezone, l.currency INTO loc, loc_tz, loc_cur
    FROM public.locations l WHERE l.owner_account_id = acct AND l.kind = 'personal';
  IF loc IS NULL THEN
    loc := uuidv7();
    INSERT INTO public.locations (id, owner_account_id, kind, name, timezone, currency, preset)
    VALUES (loc, acct, 'personal', 'Personal', tz, cur, 'essentials');
    INSERT INTO public.memberships (location_id, user_id, role) VALUES (loc, uid, 'owner');
    loc_tz := tz;
    loc_cur := cur;
    loc_created := true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.places pl WHERE pl.location_id = loc AND pl.is_unplaced) THEN
    INSERT INTO public.places (location_id, name, is_unplaced) VALUES (loc, 'Unplaced', true);
  END IF;

  -- 5. The profile, named after the auth user (the part of the address before @ if unnamed).
  INSERT INTO public.user_profiles (user_id, display_name, timezone, locale)
  VALUES (uid, coalesce(nullif(btrim(u.name), ''), split_part(u.email, '@', 1)), tz, lang)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN QUERY SELECT acct, loc, loc_created, loc_tz, loc_cur::text;
END $$;
