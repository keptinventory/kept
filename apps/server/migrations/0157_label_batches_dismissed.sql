ALTER TABLE "label_batches" ADD COLUMN "dismissed_at" timestamp with time zone;--> statement-breakpoint
-- A batch set aside from the labels screen without printing it (src/labels/service.ts dismiss).
-- kept_app may set and clear it, as it may "Printed OK?"; RLS (0042's app_update) still limits
-- it to writers of the batch's location.
GRANT UPDATE (dismissed_at) ON public.label_batches TO kept_app;
