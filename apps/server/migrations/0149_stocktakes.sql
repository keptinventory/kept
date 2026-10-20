ALTER TABLE "scan_session_lines" DROP CONSTRAINT "scan_session_lines_action_chk";--> statement-breakpoint
ALTER TABLE "scan_sessions" DROP CONSTRAINT "scan_sessions_totals_chk";--> statement-breakpoint
ALTER TABLE "scan_session_lines" ADD COLUMN "was_place_id" uuid;--> statement-breakpoint
ALTER TABLE "scan_session_lines" ADD COLUMN "was_container_id" uuid;--> statement-breakpoint
ALTER TABLE "scan_session_lines" ADD COLUMN "read_by" uuid;--> statement-breakpoint
ALTER TABLE "scan_session_lines" ADD COLUMN "area_place_id" uuid;--> statement-breakpoint
ALTER TABLE "scan_session_lines" ADD COLUMN "found_qty" numeric(12, 3);--> statement-breakpoint
ALTER TABLE "scan_session_lines" ADD COLUMN "expected_qty" numeric(12, 3);--> statement-breakpoint
ALTER TABLE "scan_session_lines" ADD COLUMN "short_not_here" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "scan_sessions" ADD COLUMN "missing" integer;--> statement-breakpoint
ALTER TABLE "scan_sessions" ADD COLUMN "elsewhere" integer;--> statement-breakpoint
ALTER TABLE "scan_sessions" ADD COLUMN "on_loan" integer;--> statement-breakpoint
ALTER TABLE "scan_sessions" ADD COLUMN "in_repair" integer;--> statement-breakpoint
ALTER TABLE "scan_sessions" ADD COLUMN "not_counted" integer;--> statement-breakpoint
ALTER TABLE "scan_sessions" ADD COLUMN "counted_place_ids" uuid[];--> statement-breakpoint
ALTER TABLE "scan_sessions" ADD COLUMN "schedule_id" uuid;--> statement-breakpoint
ALTER TABLE "scan_sessions" ADD COLUMN "finished_by" uuid;--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "kind" text DEFAULT 'task' NOT NULL;--> statement-breakpoint
ALTER TABLE "scan_session_lines" ADD CONSTRAINT "scan_session_lines_was_place_id_places_id_fk" FOREIGN KEY ("was_place_id") REFERENCES "public"."places"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_session_lines" ADD CONSTRAINT "scan_session_lines_was_container_id_things_id_fk" FOREIGN KEY ("was_container_id") REFERENCES "public"."things"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_session_lines" ADD CONSTRAINT "scan_session_lines_area_place_id_places_id_fk" FOREIGN KEY ("area_place_id") REFERENCES "public"."places"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_sessions" ADD CONSTRAINT "scan_sessions_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scan_sessions_schedule_idx" ON "scan_sessions" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX "scan_sessions_open_idx" ON "scan_sessions" USING btree ("location_id") WHERE finished_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "schedules_one_count_uq" ON "schedules" USING btree ("place_id") WHERE kind = 'count' AND active;--> statement-breakpoint
ALTER TABLE "scan_session_lines" ADD CONSTRAINT "scan_session_lines_qty_chk" CHECK ((found_qty IS NULL OR found_qty > 0) AND (expected_qty IS NULL OR expected_qty >= 0)
          AND (NOT short_not_here OR found_qty IS NOT NULL));--> statement-breakpoint
ALTER TABLE "scan_session_lines" ADD CONSTRAINT "scan_session_lines_action_chk" CHECK ("action" IN ('seen', 'not_here', 'move', 'missing', 'elsewhere', 'on_loan', 'in_repair', 'trashed', 'not_counted'));--> statement-breakpoint
ALTER TABLE "scan_sessions" ADD CONSTRAINT "scan_sessions_totals_chk" CHECK (seen >= 0 AND not_here >= 0 AND moved >= 0 AND skipped >= 0
          AND (expected IS NULL OR expected >= 0)
          AND (missing IS NULL OR missing >= 0) AND (elsewhere IS NULL OR elsewhere >= 0)
          AND (on_loan IS NULL OR on_loan >= 0) AND (in_repair IS NULL OR in_repair >= 0)
          AND (not_counted IS NULL OR not_counted >= 0));--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_kind_chk" CHECK ("kind" IN ('task', 'count'));--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_count_chk" CHECK (kind <> 'count' OR (place_id IS NOT NULL AND every_months BETWEEN 1 AND 24
                              AND every_units IS NULL AND due_on IS NULL));