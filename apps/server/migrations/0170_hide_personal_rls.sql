-- Custom SQL migration file, put your code below! --
-- Hide the Personal location (#392). user_profiles.hide_personal is a preference; this makes it
-- take effect, and only where it should.
--
--   1. kept.hidden_location_ids(): the caller's Personal, while they asked to hide it and the
--      session can see another location. Worked out on every read, so no path that ends a
--      membership (removed, left, expired, the location deleted) has to remember Personal: with
--      nothing else left it is simply shown again, and hides again when there is another. Lists
--      use it to leave the location out; it is no part of any policy, so a direct link still
--      opens it: hiding is not access control. A token answers empty: a connection sees what it
--      was granted, hidden or not.
--   2. kept.ai_cascade(): where Personal is hidden, a personal key also pays for a location its
--      holder owns and uses alone, after the account's key. A shared location never reaches it
--      (D121).
--   3. export_runs' insert policy: "Export my data" runs on a location the person owns, Personal
--      or, while Personal is hidden, another one.
-- Additive: the release before reads none of this.

-- 1. The caller's hidden location ------------------------------------------------------------------
CREATE FUNCTION kept.hidden_location_ids() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT l.id
    FROM public.user_profiles up
    JOIN public.owner_accounts oa ON oa.user_id = up.user_id
    JOIN public.locations l ON l.owner_account_id = oa.id AND l.kind = 'personal'
   WHERE up.user_id = kept.current_user_id()
     AND up.hide_personal
     AND kept.current_token_id() IS NULL
     AND EXISTS (SELECT 1 FROM kept.visible_location_ids() AS v(id) WHERE v.id <> l.id)
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION kept.hidden_location_ids() FROM PUBLIC, kept_system;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kept.hidden_location_ids() TO kept_app;
--> statement-breakpoint
GRANT UPDATE (hide_personal) ON public.user_profiles TO kept_app;
--> statement-breakpoint

-- 2. Who pays where Personal is hidden --------------------------------------------------------------
CREATE OR REPLACE FUNCTION kept.ai_cascade(p_location uuid, p_user uuid, p_task text)
RETURNS TABLE (provider_id uuid, scope text, kind text, base_url text, model text,
               reasoning text, structured boolean, key_ciphertext jsonb, key_version integer,
               paying_scope text, paying_account_id uuid, paying_user_id uuid,
               fell_back boolean, owner_account_id uuid, tripped_until timestamptz,
               trip_reason text)
LANGUAGE plpgsql STABLE SET search_path = pg_catalog, public AS $$
DECLARE
  mk text := CASE p_task WHEN 'extraction' THEN 'vision' WHEN 'assistant' THEN 'chat'
                         WHEN 'embeddings' THEN 'embeddings' END;
  acct uuid;
  owner_user uuid;
  personal boolean := false;
  own_alone boolean := false;
BEGIN
  IF mk IS NULL THEN
    RAISE EXCEPTION 'unknown AI task %', p_task USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_location IS NOT NULL THEN
    SELECT l.owner_account_id, l.kind = 'personal', oa.user_id INTO acct, personal, owner_user
      FROM public.locations l JOIN public.owner_accounts oa ON oa.id = l.owner_account_id
     WHERE l.id = p_location;
    -- Its owner hid Personal and nobody else is in this one: their personal key reaches it, after
    -- the account's key, so hiding never changes who pays where a key already does.
    IF NOT coalesce(personal, true) THEN
      SELECT up.hide_personal
             AND NOT EXISTS (SELECT 1 FROM public.memberships m
                              WHERE m.location_id = p_location AND m.user_id <> owner_user
                                AND (m.expires_at IS NULL OR m.expires_at > now()))
        INTO own_alone
        FROM public.user_profiles up WHERE up.user_id = owner_user;
      own_alone := coalesce(own_alone, false);
    END IF;
  ELSE
    SELECT oa.id INTO acct FROM public.owner_accounts oa WHERE oa.user_id = p_user;
    owner_user := p_user;
    personal := true;
  END IF;
  RETURN QUERY
    WITH ord(n, sc, who) AS (
      SELECT 1, 'user', owner_user WHERE personal
      UNION ALL SELECT 2, 'account', acct
      UNION ALL SELECT 3, 'user', owner_user WHERE own_alone
      UNION ALL SELECT 4, 'instance', NULL::uuid)
    SELECT p.id, p.scope, p.kind, p.base_url, p.models->>mk, p.reasoning,
           coalesce((p.capabilities->>'structured')::boolean, false),
           p.key_ciphertext, p.key_version, p.scope,
           CASE WHEN p.scope = 'account' THEN p.owner_account_id END,
           CASE WHEN p.scope = 'user' THEN p.user_id END,
           o.n > (SELECT min(n) FROM ord), acct, br.until, br.reason
      FROM ord o
      JOIN public.ai_providers p
        ON p.scope = o.sc AND p.disabled_at IS NULL
       AND (o.sc = 'instance' OR (o.sc = 'account' AND p.owner_account_id = o.who)
            OR (o.sc = 'user' AND p.user_id = o.who))
      LEFT JOIN public.ai_breakers br ON br.provider_id = p.id
     WHERE (p.key_ciphertext IS NOT NULL OR (p.kind = 'openai_compatible' AND p.base_url IS NOT NULL))
       AND NOT coalesce(br.reason = 'auth' AND br.until > now(), false)
       AND coalesce(p.models->>mk, '') <> ''
     ORDER BY o.n
     LIMIT 1;
END $$;
--> statement-breakpoint

-- 3. "Export my data" on the location that takes over from Personal --------------------------------
DROP POLICY app_insert ON public.export_runs;
--> statement-breakpoint
CREATE POLICY app_insert ON public.export_runs FOR INSERT TO kept_app
  WITH CHECK (created_by = (SELECT kept.current_user_id())
              AND location_id IN (SELECT kept.admin_location_ids())
              AND CASE kind
                    WHEN 'claim_pack' THEN num_nonnulls(incident_id, thing_ids) = 1
                    WHEN 'me' THEN kept.owns_location(location_id) AND EXISTS (
                      SELECT 1 FROM public.locations l
                       WHERE l.id = location_id
                         AND (l.kind = 'personal'
                              OR EXISTS (SELECT 1 FROM kept.hidden_location_ids())))
                    ELSE true END
              AND (NOT include_secrets OR kept.owns_location(location_id))
              AND status = 'queued' AND storage_key IS NULL AND bytes IS NULL AND sha256 IS NULL
              AND error IS NULL AND started_at IS NULL AND finished_at IS NULL
              AND revoked_at IS NULL AND downloads = 0 AND last_downloaded_at IS NULL
              AND progress_done = 0 AND progress_total = 0
              AND expires_at <= now() + interval '7 days'
              AND (token_expires_at IS NULL OR token_expires_at <= expires_at));
