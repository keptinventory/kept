ALTER TABLE "places" ADD COLUMN "child_order" text DEFAULT 'name' NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_child_order_chk" CHECK (child_order IN ('name', 'custom'));--> statement-breakpoint
-- A place's own order for the places inside it (1.13.0): 'name' is A to Z (places/order.ts),
-- 'custom' is by their `sort`. Switching back to A to Z keeps every `sort`, so switching to
-- Custom again brings the same order back. The app sets it through PATCH /api/v1/places/:id.
GRANT UPDATE (child_order) ON public.places TO kept_app;
