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
-- reads. No updates: the row is its key; the route inserts and deletes rows. Not audited
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
--> statement-breakpoint
-- Leaving a location drops the person's folds there, on every path that ends a membership, in
-- its transaction: kept.membership_access_ended() (0070, last 0080) calls the new helper on a
-- DELETE, as it ends tokens, webhooks and portability runs. A purged location's places are gone
-- already (their folds cascade), so it is skipped. Unchanged otherwise. src/db/migrate.test.ts
-- lists the helper.
CREATE FUNCTION kept.drop_place_folds_in(p_user uuid, p_location uuid) RETURNS void
LANGUAGE sql SET search_path = pg_catalog, public AS $$
  DELETE FROM public.place_folds f USING public.places p
   WHERE f.place_id = p.id AND f.user_id = p_user AND p.location_id = p_location;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION kept.drop_place_folds_in(uuid, uuid)
  FROM PUBLIC, kept_app, kept_system;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION kept.membership_access_ended() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  purged boolean := NOT EXISTS (SELECT 1 FROM public.locations l WHERE l.id = OLD.location_id);
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM kept.redact_assistant_in(OLD.user_id, OLD.location_id);
    IF NOT purged THEN
      PERFORM kept.revoke_tokens_in(OLD.user_id, OLD.location_id, 'membership_ended');
      PERFORM kept.disable_webhooks_in(OLD.user_id, OLD.location_id);
      PERFORM kept.end_portability_runs_in(OLD.user_id, OLD.location_id);
      PERFORM kept.drop_place_folds_in(OLD.user_id, OLD.location_id);
    END IF;
  ELSIF NOT purged THEN
    IF NEW.role = 'viewer' AND OLD.role <> 'viewer' THEN
      PERFORM kept.revoke_tokens_in(OLD.user_id, OLD.location_id, 'role_lost');
    END IF;
    IF OLD.role IN ('owner', 'admin') AND NEW.role NOT IN ('owner', 'admin') THEN
      PERFORM kept.disable_webhooks_in(OLD.user_id, OLD.location_id);
      PERFORM kept.end_portability_runs_in(OLD.user_id, OLD.location_id);
    END IF;
  END IF;
  RETURN NULL;
END $$;
