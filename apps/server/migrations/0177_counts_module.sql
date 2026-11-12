-- Counts is a module a location can turn off (#506), like Labels and Lending. It is in every
-- preset (@kept/shared modules.ts), so a location keeps its counts until someone turns them off:
-- an existing location has no `location_modules` row for it, and its preset now says on.
--
-- 1. kept.module_enabled(): the presets' modules as modules.ts has them, Counts in each.
--    kept.module_on() is unchanged (Counts depends on nothing); src/db/agenda.test.ts checks the
--    two agree.
-- 2. The agenda: a planned count (a schedule of kind `count`) is on it only while Counts is on
--    too, so with Counts off it reminds no one and leaves Home's Needs you. The rest of the view is
--    0152's.
-- Additive: both are CREATE OR REPLACE with the same signature and columns; the release before
-- this one never asks about 'counts', and a planned count it reads stays on its agenda.

CREATE OR REPLACE FUNCTION kept.module_enabled(p_location uuid, p_module text) RETURNS boolean
LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
  SELECT coalesce(
    (SELECT lm.enabled FROM public.location_modules lm
      WHERE lm.location_id = p_location AND lm.module = p_module),
    (SELECT p_module = ANY (CASE l.preset
       WHEN 'essentials' THEN ARRAY['labels', 'counts', 'ai_capture', 'ai_assistant']
       WHEN 'household' THEN ARRAY['labels', 'counts', 'money', 'warranties', 'schedules',
                                   'lending', 'paperwork', 'vehicles', 'ai_capture',
                                   'ai_assistant']
       WHEN 'complete' THEN ARRAY['labels', 'counts', 'money', 'warranties', 'schedules',
                                  'lending', 'paperwork', 'vehicles', 'fuel', 'consumables',
                                  'moving', 'secrets', 'ai_capture', 'ai_assistant', 'mcp']
       ELSE '{}'::text[] END)
       FROM public.locations l WHERE l.id = p_location),
    false)
$$;
--> statement-breakpoint
CREATE OR REPLACE VIEW public.agenda_items WITH (security_invoker = on) AS
WITH loc AS (
  SELECT l.id, l.timezone, (now() AT TIME ZONE l.timezone)::date AS today,
         kept.module_on(l.id, 'schedules') AS on_schedules,
         kept.module_on(l.id, 'warranties') AS on_warranties,
         kept.module_on(l.id, 'paperwork') AS on_paperwork,
         kept.module_on(l.id, 'vehicles') AS on_vehicles,
         kept.module_on(l.id, 'lending') AS on_lending,
         kept.module_on(l.id, 'consumables') AS on_consumables,
         kept.module_on(l.id, 'counts') AS on_counts
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
   AND (s.kind <> 'count' OR loc.on_counts)
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
