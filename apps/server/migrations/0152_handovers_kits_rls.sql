-- Custom SQL migration file, put your code below! --
-- 1.14 (#170): kits and hand-overs. Above, in 0151, drizzle's part: `handovers` (one lend of a
-- thing, a box or a kit to a person), the loans' new columns (their hand-over, where each sat in
-- the box, the outcome, conditions out and in, the return note), `kits` (a container's flag) and
-- `kit_parts` (what should be in it). Below:
--   1. Row-level security, as the loans' (0051): everyone who sees the location reads; members
--      and above write; a hand-over's person is of the location's account.
--   2. Every existing loan becomes a one-line hand-over with the loan's own id (nothing else of it
--      changes, but its outcome: `returned` where it came back), then `loans.handover_id` is NOT
--      NULL and a loan is closed exactly when it has an outcome.
--   3. A loan written without a hand-over (a borrow, an older export, an undone delete) gets its
--      one-line hand-over the same way; a loan closed without an outcome is `returned`, and one
--      reopened has none.
--   4. The agenda's loans are due from their lead days before the due date (the due-soon
--      reminder), when they have one.
-- src/lending/handovers.test.ts and src/db/handover-migration.test.ts test them;
-- test/leak-household.ts fills the tables.

-- 1. Row-level security -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['handovers', 'kits', 'kit_parts'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY owner_all ON public.%I FOR ALL TO kept_owner USING (true) WITH CHECK (true)',
      t);
    EXECUTE format('REVOKE UPDATE ON public.%I FROM kept_app, kept_system', t);
    EXECUTE format(
      'CREATE TRIGGER touch_row BEFORE INSERT OR UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION kept.touch_row()', t);
    EXECUTE format($p$
      CREATE POLICY app_select ON public.%I FOR SELECT TO kept_app
        USING (location_id IN (SELECT kept.visible_location_ids()))$p$, t);
    EXECUTE format($p$
      CREATE POLICY app_update ON public.%I FOR UPDATE TO kept_app
        USING (location_id IN (SELECT kept.writable_location_ids()))
        WITH CHECK (location_id IN (SELECT kept.writable_location_ids()))$p$, t);
    EXECUTE format($p$
      CREATE POLICY app_delete ON public.%I FOR DELETE TO kept_app
        USING (location_id IN (SELECT kept.writable_location_ids()))$p$, t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['handovers', 'kits'] LOOP
    EXECUTE format($p$
      CREATE POLICY app_insert ON public.%I FOR INSERT TO kept_app
        WITH CHECK (location_id IN (SELECT kept.writable_location_ids())
                    AND created_by = (SELECT kept.current_user_id()))$p$, t);
  END LOOP;
END $$;
--> statement-breakpoint
CREATE POLICY app_insert ON public.kit_parts FOR INSERT TO kept_app
  WITH CHECK (location_id IN (SELECT kept.writable_location_ids()));
--> statement-breakpoint
GRANT UPDATE (person_id, due_on, lead_days, notes, condition_out, updated_at, row_version)
  ON public.handovers TO kept_app;
--> statement-breakpoint
GRANT UPDATE (updated_at, row_version) ON public.kits TO kept_app;
--> statement-breakpoint
GRANT UPDATE (quantity, updated_at, row_version) ON public.kit_parts TO kept_app;
--> statement-breakpoint
GRANT UPDATE (handover_id, path_at_lend, outcome, condition_out, condition_in, return_notes)
  ON public.loans TO kept_app;
--> statement-breakpoint
-- Invoker, as kept.guard_household_refs(): a person the caller can't see is refused like one of
-- another account (42501, a 404).
CREATE FUNCTION kept.guard_handover_person() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.people p
                   JOIN public.locations l ON l.owner_account_id = p.owner_account_id
                  WHERE p.id = NEW.person_id AND l.id = NEW.location_id) THEN
    RAISE EXCEPTION 'a hand-over''s person belongs to its location''s account'
      USING ERRCODE = 'insufficient_privilege', CONSTRAINT = 'handovers_person_account';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION kept.guard_handover_person() FROM PUBLIC, kept_app, kept_system;
--> statement-breakpoint
CREATE TRIGGER handovers_guard_person BEFORE INSERT OR UPDATE OF person_id ON public.handovers
  FOR EACH ROW EXECUTE FUNCTION kept.guard_handover_person();
--> statement-breakpoint

-- 2. Existing loans: one-line hand-overs ------------------------------------------------------------
INSERT INTO public.handovers (id, location_id, direction, person_id, root_thing_id, started_at,
                              due_on, lead_days, notes, created_by, created_at)
SELECT o.id, o.location_id, o.direction, o.person_id, o.thing_id, o.started_at, o.due_on,
       o.lead_days, o.notes, o.created_by, o.created_at
  FROM public.loans o
 WHERE o.handover_id IS NULL;
--> statement-breakpoint
UPDATE public.loans o
   SET handover_id = o.id,
       outcome = CASE WHEN o.returned_at IS NOT NULL THEN 'returned' END
 WHERE o.handover_id IS NULL;
--> statement-breakpoint
ALTER TABLE public.loans ALTER COLUMN handover_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE public.loans ADD CONSTRAINT loans_closed_outcome_chk
  CHECK ((returned_at IS NULL) = (outcome IS NULL));
--> statement-breakpoint

-- 3. A loan without a hand-over gets one; closing sets an outcome ------------------------------------
CREATE FUNCTION kept.loan_handover() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.handover_id IS NULL THEN
    INSERT INTO public.handovers (id, location_id, direction, person_id, root_thing_id,
                                  started_at, due_on, lead_days, notes, created_by)
    VALUES (NEW.id, NEW.location_id, NEW.direction, NEW.person_id, NEW.thing_id, NEW.started_at,
            NEW.due_on, NEW.lead_days, NEW.notes, NEW.created_by)
    ON CONFLICT (id) DO NOTHING;
    NEW.handover_id := NEW.id;
  END IF;
  IF NEW.returned_at IS NOT NULL AND NEW.outcome IS NULL THEN
    NEW.outcome := 'returned';
  ELSIF NEW.returned_at IS NULL THEN
    NEW.outcome := NULL;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION kept.loan_handover() FROM PUBLIC, kept_app, kept_system;
--> statement-breakpoint
CREATE TRIGGER loans_handover BEFORE INSERT OR UPDATE OF returned_at, outcome ON public.loans
  FOR EACH ROW EXECUTE FUNCTION kept.loan_handover();
--> statement-breakpoint

-- 4. The agenda: a loan's due-soon ---------------------------------------------------------------
CREATE OR REPLACE VIEW public.agenda_items WITH (security_invoker = on) AS
WITH loc AS (
  SELECT l.id, l.timezone, (now() AT TIME ZONE l.timezone)::date AS today,
         kept.module_on(l.id, 'schedules') AS on_schedules,
         kept.module_on(l.id, 'warranties') AS on_warranties,
         kept.module_on(l.id, 'paperwork') AS on_paperwork,
         kept.module_on(l.id, 'vehicles') AS on_vehicles,
         kept.module_on(l.id, 'lending') AS on_lending,
         kept.module_on(l.id, 'consumables') AS on_consumables
    FROM public.locations l
   WHERE l.deleted_at IS NULL)
-- Schedules: due from the lead, or from the day the estimate reaches it; overdue after the due
-- point. A one-off that is done (step 2) is on no agenda.
SELECT 'schedule'::text AS source_type, s.id AS source_id, s.location_id, s.thing_id,
       s.place_id, CASE WHEN n.state = 'overdue' THEN 'overdue' ELSE 'due' END AS kind,
       n.due_on, n.due_value, s.meter_id, n.state,
       CASE WHEN n.basis = 'units' OR n.due_on IS NULL THEN 'meter:' || n.due_value::text
            ELSE 'date:' || n.due_on::text END AS due_period,
       'schedules'::text AS module, s.name AS title,
       n.estimated_on, n.estimated
  FROM public.schedules s
  JOIN loc ON loc.id = s.location_id
  LEFT JOIN public.things t ON t.id = s.thing_id
  LEFT JOIN public.places p ON p.id = s.place_id
 CROSS JOIN LATERAL kept.schedule_due(s, loc.today, now()) n
 WHERE s.active AND loc.on_schedules AND n.state <> 'done'
   AND (s.thing_id IS NULL OR (t.deleted_at IS NULL AND t.lifecycle = 'in_use'))
   AND (s.place_id IS NULL OR p.deleted_at IS NULL)
UNION ALL
-- Warranties: expiring from the lead to the last day covered (lifetime: none); expired after.
SELECT 'warranty', w.id, w.location_id, w.thing_id, NULL::uuid, 'expiring',
       w.effective_ends_on, NULL::numeric, NULL::uuid,
       CASE WHEN loc.today > w.effective_ends_on THEN 'expired'
            WHEN loc.today >= w.effective_ends_on - w.lead_days THEN 'expiring'
            ELSE 'upcoming' END,
       'date:' || w.effective_ends_on::text, 'warranties', w.provider, NULL::date, false
  FROM public.warranties w
  JOIN loc ON loc.id = w.location_id
  JOIN public.things t ON t.id = w.thing_id
 WHERE w.effective_ends_on IS NOT NULL AND loc.on_warranties
   AND t.deleted_at IS NULL AND t.lifecycle = 'in_use'
UNION ALL
-- Registration (Q4: D55's warranty-registration deadline): due from 14 days before.
SELECT 'registration', w.id, w.location_id, w.thing_id, NULL::uuid, 'due',
       w.registration_deadline, NULL::numeric, NULL::uuid,
       CASE WHEN loc.today > w.registration_deadline THEN 'overdue'
            WHEN loc.today >= w.registration_deadline - 14 THEN 'due'
            ELSE 'upcoming' END,
       'date:' || w.registration_deadline::text, 'warranties', w.provider, NULL::date, false
  FROM public.warranties w
  JOIN loc ON loc.id = w.location_id
  JOIN public.things t ON t.id = w.thing_id
 WHERE NOT w.registered AND w.registration_deadline IS NOT NULL
   AND loc.on_warranties
   AND t.deleted_at IS NULL AND t.lifecycle = 'in_use'
UNION ALL
-- Documents, current ones only: expiring from the lead, overdue after (an expired lease matters).
-- A vehicle's document also while Vehicles alone is on (step 5, step 4's Q5).
SELECT 'document', d.id, d.location_id, d.thing_id, d.place_id,
       CASE WHEN loc.today > d.expires_on THEN 'overdue' ELSE 'expiring' END,
       d.expires_on, NULL::numeric, NULL::uuid,
       CASE WHEN loc.today > d.expires_on THEN 'overdue'
            WHEN loc.today >= d.expires_on - d.lead_days THEN 'expiring'
            ELSE 'upcoming' END,
       'date:' || d.expires_on::text,
       CASE WHEN loc.on_paperwork THEN 'paperwork' ELSE 'vehicles' END,
       d.title, NULL::date, false
  FROM public.expiring_documents d
  JOIN loc ON loc.id = d.location_id
  LEFT JOIN public.things t ON t.id = d.thing_id
  LEFT JOIN public.places p ON p.id = d.place_id
 WHERE d.superseded_by_id IS NULL
   AND (loc.on_paperwork
        OR (t.id IS NOT NULL AND loc.on_vehicles AND kept.is_vehicle_type(t.type_id)))
   AND (d.thing_id IS NULL OR (t.deleted_at IS NULL AND t.lifecycle = 'in_use'))
   AND (d.place_id IS NULL OR p.deleted_at IS NULL)
UNION ALL
-- Loans out and in, open, with a due date: overdue from the day after (D56, D57). With a lead
-- (1.14, a hand-over's due-soon days, 2 by default), due from that many days before: kind `due`
-- until the due date, so the scan reminds of it too, then `overdue`.
SELECT 'loan', o.id, o.location_id, o.thing_id, NULL::uuid,
       CASE WHEN o.lead_days > 0 AND loc.today <= o.due_on THEN 'due' ELSE 'overdue' END,
       o.due_on, NULL::numeric, NULL::uuid,
       CASE WHEN loc.today > o.due_on THEN 'overdue'
            WHEN loc.today >= o.due_on - o.lead_days THEN 'due'
            ELSE 'upcoming' END,
       'date:' || o.due_on::text, 'lending', NULL::text, NULL::date, false
  FROM public.loans o
  JOIN loc ON loc.id = o.location_id
  JOIN public.things t ON t.id = o.thing_id
 WHERE o.returned_at IS NULL AND o.due_on IS NOT NULL AND loc.on_lending
   AND t.deleted_at IS NULL AND t.lifecycle = 'in_use'
UNION ALL
-- Thing expiries (D141): expiring from the thing's lead (30 days by default), overdue after.
SELECT 'thing_expiry', t.id, t.location_id, t.id, NULL::uuid,
       CASE WHEN loc.today > t.expires_on THEN 'overdue' ELSE 'expiring' END,
       t.expires_on, NULL::numeric, NULL::uuid,
       CASE WHEN loc.today > t.expires_on THEN 'overdue'
            WHEN loc.today >= t.expires_on - coalesce(t.expiry_lead_days, 30) THEN 'expiring'
            ELSE 'upcoming' END,
       'date:' || t.expires_on::text, 'schedules', NULL::text, NULL::date, false
  FROM public.things t
  JOIN loc ON loc.id = t.location_id
 WHERE t.expires_on IS NOT NULL AND loc.on_schedules
   AND t.deleted_at IS NULL AND t.lifecycle = 'in_use'
UNION ALL
-- Stale readings (step 5; D52, Q19): due from the latest accepted reading's local day plus the
-- meter's nudge_days, then rolled forward in steps of nudge_days to the last step on or before
-- today (0089), so a reading still not taken nudges again each period, under a new key
-- ('date:' || the step) that stays the same within the period; none before the first reading,
-- none with nudge_days NULL. Core: no module.
SELECT 'reading_stale', m.id, m.location_id, m.thing_id, NULL::uuid, 'due',
       p.due_on, NULL::numeric, m.id,
       CASE WHEN loc.today >= p.due_on THEN 'due' ELSE 'upcoming' END,
       'date:' || p.due_on::text, NULL::text, m.label, NULL::date, false
  FROM public.meters m
  JOIN loc ON loc.id = m.location_id
  JOIN public.things t ON t.id = m.thing_id
 CROSS JOIN LATERAL (
   SELECT (d.taken_at AT TIME ZONE loc.timezone)::date AS read_on
     FROM public.meter_readings d
    WHERE d.meter_id = m.id AND d.state = 'accepted'
    ORDER BY d.taken_at DESC LIMIT 1) r
 CROSS JOIN LATERAL (
   SELECT r.read_on
          + m.nudge_days * greatest(1, (loc.today - r.read_on) / m.nudge_days) AS due_on) p
 WHERE m.nudge_days IS NOT NULL AND t.deleted_at IS NULL AND t.lifecycle = 'in_use'
UNION ALL
-- Low stock (step 7; D14, D29, D113): a live thing in use below its "keep at least" while
-- Consumables is on, due from the location's day it ran low (stock_rules.low_since) and keyed on
-- it, so each time it runs low reminds once; restocked, it leaves the agenda and the scan closes
-- the reminder.
SELECT 'stock', r.id, r.location_id, r.thing_id, NULL::uuid, 'due',
       r.low_since, NULL::numeric, NULL::uuid, 'due',
       'date:' || r.low_since::text, 'consumables', NULL::text, NULL::date, false
  FROM public.stock_rules r
  JOIN loc ON loc.id = r.location_id
  JOIN public.things t ON t.id = r.thing_id
 WHERE loc.on_consumables AND r.low_since IS NOT NULL AND t.quantity < r.min_quantity
   AND t.deleted_at IS NULL AND t.lifecycle = 'in_use';

--> statement-breakpoint
REVOKE ALL ON public.agenda_items FROM PUBLIC, kept_app, kept_system;
--> statement-breakpoint
GRANT SELECT ON public.agenda_items TO kept_app, kept_system;
