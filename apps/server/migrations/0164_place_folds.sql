CREATE TABLE "place_folds" (
	"user_id" uuid NOT NULL,
	"place_id" uuid NOT NULL,
	CONSTRAINT "place_folds_pk" PRIMARY KEY("user_id","place_id")
);
--> statement-breakpoint
ALTER TABLE "place_folds" ADD CONSTRAINT "place_folds_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_folds" ADD CONSTRAINT "place_folds_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "place_folds_place_idx" ON "place_folds" USING btree ("place_id");
--> statement-breakpoint
-- Folded places in the places outline (#358, 1.14.3). Above, drizzle's part: place_folds
-- (src/db/schema/user.ts), one row per place a person folded. Below, row-level security as
-- saved_view_prefs (0034): a person's own rows, and only for places they can see (places' own
-- policies decide inside the subquery), so a place in a location they left drops out of their
-- reads. No updates: the row is its key, and the route replaces a location's rows. Not audited
-- by the database or the route: folding is the person's own view (test/route-catalogue.test.ts
-- allowlist). Additive: the release before ignores the table. test/leak-inventory.ts fills it.
ALTER TABLE public.place_folds ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.place_folds FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY owner_all ON public.place_folds FOR ALL TO kept_owner USING (true) WITH CHECK (true);
--> statement-breakpoint
REVOKE UPDATE ON public.place_folds FROM kept_app, kept_system;
--> statement-breakpoint
CREATE POLICY app_own ON public.place_folds FOR ALL TO kept_app
  USING (user_id = (SELECT kept.current_user_id())
         AND place_id IN (SELECT p.id FROM public.places p))
  WITH CHECK (user_id = (SELECT kept.current_user_id())
              AND place_id IN (SELECT p.id FROM public.places p));
