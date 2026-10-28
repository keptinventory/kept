ALTER TABLE "place_kinds" DROP CONSTRAINT "place_kinds_named_chk";--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN "applies_to" text DEFAULT 'thing' NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "layout" jsonb;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "cell" jsonb;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_applies_to_chk" CHECK (applies_to IN ('thing', 'place'));--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_layout_chk" CHECK (layout IS NULL OR jsonb_typeof(layout) = 'object');--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_cell_chk" CHECK (cell IS NULL OR jsonb_typeof(cell) = 'object');--> statement-breakpoint
ALTER TABLE "place_kinds" ADD CONSTRAINT "place_kinds_named_chk" CHECK (owner_account_id IS NULL OR name IS NOT NULL OR key IN ('floor', 'room', 'zone', 'closet', 'furniture', 'cube', 'shelf', 'drawer'));--> statement-breakpoint
-- Place templates (#238, 1.14.1). A template makes a thing (quick add, as before) or, with
-- applies_to = 'place', a piece of furniture and a place for each of its compartments in one step
-- (templates/place-templates.ts). Place templates live in the same table, shared into locations
-- through template_locations under the same policies (0038). Furniture made from one keeps its
-- size and how it stands in places.layout; each compartment keeps where it sits in places.cell,
-- written when it is made and when the unit is turned. The new built-in place kinds (furniture,
-- cube, shelf, drawer) are seeded by `kept migrate` (db/seed-reference.ts); the CHECK above lets
-- an account customise them as it does the others. Additive: the release before ignores the
-- columns, and lists a place template among its thing templates only if rolled back to.
GRANT UPDATE (layout, cell) ON public.places TO kept_app;
