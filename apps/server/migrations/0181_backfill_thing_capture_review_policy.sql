-- Old clients stored the policy on the first extraction only.
UPDATE public.things AS t SET capture_review_only = true
 WHERE t.id IN (SELECT e.thing_id FROM public.extractions AS e WHERE e.review_only)
   AND NOT t.capture_review_only;
--> statement-breakpoint
-- A re-analysis may already have been queued without inheriting that policy.
UPDATE public.extractions AS e SET review_only = true
 FROM public.things AS t
 WHERE t.id = e.thing_id AND t.capture_review_only AND NOT e.review_only
   AND e.mode IN ('thing', 'label')
   AND e.status IN ('queued', 'running', 'paused_budget', 'waiting_provider');
