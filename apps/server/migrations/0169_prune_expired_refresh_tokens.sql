-- Custom SQL migration file, put your code below! --
-- #424: every refresh of a connector's token keeps the old row, revoked, and adds a new one (#411),
-- so a connector in constant use adds about 8,760 rows a year and nothing removed them. An expired
-- row goes now. Better Auth's token endpoint refuses an expired token before it asks whether the
-- token was revoked, so a replay of one never reached the lineage check, and with the row gone it
-- is refused as an unknown token. A revoked row that hasn't expired stays: its replay is what ends
-- the lineage. One difference: the revocation endpoint has no expiry check, so a rotated token sent
-- there ended its lineage even when expired; gone, it is refused and ends nothing. A
-- deleted row's stored access tokens go by refresh_id's ON DELETE CASCADE (Kept's are JWTs, not
-- stored; a stored one lasts an hour against the refresh token's 30 days). The function is
-- 0111's with one DELETE added. It runs as its definer, so kept_system gets no right in schema
-- auth.

CREATE OR REPLACE FUNCTION kept.prune_stale_rows()
RETURNS TABLE (what text, removed bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  n bigint;
BEGIN
  DELETE FROM auth.sign_in_failures f
   WHERE greatest(f.window_start, f.last_failure_at) < now() - interval '25 hours';
  GET DIAGNOSTICS n = ROW_COUNT;
  what := 'auth.sign_in_failures'; removed := n; RETURN NEXT;

  DELETE FROM auth.session_mfa m USING auth.session s
   WHERE s.id = m.session_id AND s.expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  what := 'auth.session_mfa'; removed := n; RETURN NEXT;

  DELETE FROM public.idempotency_keys k WHERE k.created_at < now() - interval '30 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  what := 'idempotency_keys'; removed := n; RETURN NEXT;

  -- 0111: as long as an op may be resent (SYNC_LIMITS: 90 days and a day of clock skew), so a
  -- replay finds its answer instead of applying again.
  DELETE FROM public.sync_ops o WHERE o.received_at < now() - interval '91 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  what := 'sync_ops'; removed := n; RETURN NEXT;

  DELETE FROM public.inbox_items i WHERE i.resolved_at < now() - interval '90 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  what := 'inbox_items'; removed := n; RETURN NEXT;

  -- 0055: the centre keeps 90 days; the reminder ledger a year.
  DELETE FROM public.notifications x WHERE x.created_at < now() - interval '90 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  what := 'notifications'; removed := n; RETURN NEXT;

  DELETE FROM public.reminder_deliveries d WHERE d.created_at < now() - interval '1 year';
  GET DIAGNOSTICS n = ROW_COUNT;
  what := 'reminder_deliveries'; removed := n; RETURN NEXT;

  DELETE FROM public.reminder_occurrences o
   WHERE o.state <> 'open' AND o.closed_at < now() - interval '1 year'
     AND NOT EXISTS (SELECT 1 FROM public.reminder_deliveries d WHERE d.occurrence_id = o.id);
  GET DIAGNOSTICS n = ROW_COUNT;
  what := 'reminder_occurrences'; removed := n; RETURN NEXT;

  DELETE FROM public.notification_digests g WHERE g.digest_on < current_date - 365;
  GET DIAGNOSTICS n = ROW_COUNT;
  what := 'notification_digests'; removed := n; RETURN NEXT;

  -- 0070: a rate window is a minute; two hours is plenty for Retry-After.
  DELETE FROM public.token_rate_windows w WHERE w.minute < now() - interval '2 hours';
  GET DIAGNOSTICS n = ROW_COUNT;
  what := 'token_rate_windows'; removed := n; RETURN NEXT;

  -- 0078: a webhook's deliveries keep 30 days.
  DELETE FROM public.webhook_deliveries d WHERE d.created_at < now() - interval '30 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  what := 'webhook_deliveries'; removed := n; RETURN NEXT;

  -- 0169: an expired refresh token is refused whether its row is here or not.
  DELETE FROM auth.oauth_refresh_token r WHERE r.expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  what := 'auth.oauth_refresh_token'; removed := n; RETURN NEXT;
END $$;
