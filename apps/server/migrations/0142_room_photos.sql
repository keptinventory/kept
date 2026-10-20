CREATE TABLE "room_captures" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"location_id" uuid NOT NULL,
	"place_id" uuid,
	"container_id" uuid,
	"batch_id" uuid NOT NULL,
	"status" text DEFAULT 'reading' NOT NULL,
	"codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"attachment_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"result" jsonb,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_version" integer DEFAULT 1 NOT NULL,
	"change_seq" bigint,
	CONSTRAINT "room_captures_location_id_uq" UNIQUE("location_id","id"),
	CONSTRAINT "room_captures_status_chk" CHECK ("status" IN ('reading', 'merging', 'ready', 'failed', 'off')),
	CONSTRAINT "room_captures_target_chk" CHECK (num_nonnulls(place_id, container_id) = 1),
	CONSTRAINT "room_captures_codes_chk" CHECK (cardinality(codes) <= 60),
	CONSTRAINT "room_captures_photos_chk" CHECK (cardinality(attachment_ids) BETWEEN 1 AND 5),
	CONSTRAINT "room_captures_result_chk" CHECK (result IS NULL OR jsonb_typeof(result) = 'object')
);
--> statement-breakpoint
ALTER TABLE "llm_calls" DROP CONSTRAINT "llm_calls_task_chk";--> statement-breakpoint
ALTER TABLE "extractions" DROP CONSTRAINT "extractions_mode_chk";--> statement-breakpoint
ALTER TABLE "inbox_items" DROP CONSTRAINT "inbox_items_kind_chk";--> statement-breakpoint
ALTER TABLE "inbox_items" DROP CONSTRAINT "inbox_items_subject_chk";--> statement-breakpoint
ALTER TABLE "extractions" ADD COLUMN "room_capture_id" uuid;--> statement-breakpoint
ALTER TABLE "inbox_items" ADD COLUMN "room_capture_id" uuid;--> statement-breakpoint
ALTER TABLE "map_nodes" ADD COLUMN "placed_by_kept" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "keep_room_photos" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "room_captures" ADD CONSTRAINT "room_captures_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_captures" ADD CONSTRAINT "room_captures_place_fk" FOREIGN KEY ("location_id","place_id") REFERENCES "public"."places"("location_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "room_captures" ADD CONSTRAINT "room_captures_container_fk" FOREIGN KEY ("location_id","container_id") REFERENCES "public"."things"("location_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "room_captures_location_idx" ON "room_captures" USING btree ("location_id","created_at");--> statement-breakpoint
CREATE INDEX "room_captures_batch_idx" ON "room_captures" USING btree ("batch_id");--> statement-breakpoint
ALTER TABLE "extractions" ADD CONSTRAINT "extractions_room_capture_fk" FOREIGN KEY ("location_id","room_capture_id") REFERENCES "public"."room_captures"("location_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_room_capture_fk" FOREIGN KEY ("location_id","room_capture_id") REFERENCES "public"."room_captures"("location_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "extractions_room_capture_idx" ON "extractions" USING btree ("room_capture_id") WHERE room_capture_id IS NOT NULL;--> statement-breakpoint
ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_task_chk" CHECK ("task" IN ('extract_thing', 'extract_receipt', 'extract_label', 'extract_reading', 'assistant_turn', 'assistant_followup', 'embed_thing', 'embed_query', 'connection_test', 'enrich_aliases', 'extract_room', 'extract_room_merge'));--> statement-breakpoint
ALTER TABLE "extractions" ADD CONSTRAINT "extractions_mode_chk" CHECK ("mode" IN ('thing', 'receipt', 'label', 'reading', 'room'));--> statement-breakpoint
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_kind_chk" CHECK ("kind" IN ('draft', 'reading', 'label_claim', 'currency', 'duplicate', 'receipt', 'sync_drop', 'room'));--> statement-breakpoint
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_subject_chk" CHECK (kind = 'sync_drop' OR num_nonnulls(thing_id, purchase_id, meter_reading_id, code, room_capture_id) >= 1);