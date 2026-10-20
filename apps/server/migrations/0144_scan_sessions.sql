CREATE TABLE "scan_session_lines" (
	"session_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"thing_id" uuid NOT NULL,
	"read_at" timestamp with time zone NOT NULL,
	"action" text NOT NULL,
	"to_place_id" uuid,
	"to_container_id" uuid,
	CONSTRAINT "scan_session_lines_pk" PRIMARY KEY("session_id","thing_id"),
	CONSTRAINT "scan_session_lines_action_chk" CHECK ("action" IN ('seen', 'not_here', 'move')),
	CONSTRAINT "scan_session_lines_to_chk" CHECK (num_nonnulls(to_place_id, to_container_id) <= 1)
);
--> statement-breakpoint
CREATE TABLE "scan_sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"location_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"target_place_id" uuid,
	"target_container_id" uuid,
	"target_inside" boolean,
	"started_by" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"expected" integer,
	"seen" integer DEFAULT 0 NOT NULL,
	"not_here" integer DEFAULT 0 NOT NULL,
	"moved" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"audit_event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scan_sessions_location_id_uq" UNIQUE("location_id","id"),
	CONSTRAINT "scan_sessions_mode_chk" CHECK ("mode" IN ('count', 'pack', 'move')),
	CONSTRAINT "scan_sessions_target_chk" CHECK (num_nonnulls(target_place_id, target_container_id) <= 1),
	CONSTRAINT "scan_sessions_totals_chk" CHECK (seen >= 0 AND not_here >= 0 AND moved >= 0 AND skipped >= 0
          AND (expected IS NULL OR expected >= 0))
);
--> statement-breakpoint
ALTER TABLE "sync_ops" DROP CONSTRAINT "sync_ops_op_chk";--> statement-breakpoint
ALTER TABLE "scan_session_lines" ADD CONSTRAINT "scan_session_lines_thing_id_things_id_fk" FOREIGN KEY ("thing_id") REFERENCES "public"."things"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_session_lines" ADD CONSTRAINT "scan_session_lines_to_place_id_places_id_fk" FOREIGN KEY ("to_place_id") REFERENCES "public"."places"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_session_lines" ADD CONSTRAINT "scan_session_lines_to_container_id_things_id_fk" FOREIGN KEY ("to_container_id") REFERENCES "public"."things"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_session_lines" ADD CONSTRAINT "scan_session_lines_session_fk" FOREIGN KEY ("location_id","session_id") REFERENCES "public"."scan_sessions"("location_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "scan_sessions" ADD CONSTRAINT "scan_sessions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_sessions" ADD CONSTRAINT "scan_sessions_target_place_id_places_id_fk" FOREIGN KEY ("target_place_id") REFERENCES "public"."places"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_sessions" ADD CONSTRAINT "scan_sessions_target_container_id_things_id_fk" FOREIGN KEY ("target_container_id") REFERENCES "public"."things"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scan_session_lines_thing_idx" ON "scan_session_lines" USING btree ("thing_id");--> statement-breakpoint
CREATE INDEX "scan_sessions_location_idx" ON "scan_sessions" USING btree ("location_id","started_at");--> statement-breakpoint
ALTER TABLE "sync_ops" ADD CONSTRAINT "sync_ops_op_chk" CHECK ("op" IN ('create_thing', 'move', 'log_reading', 'claim_label', 'mark_seen', 'not_here', 'create_area', 'box_check', 'move_box', 'move_box_room', 'scan_session_lines', 'scan_session_finish'));