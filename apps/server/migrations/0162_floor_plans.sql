CREATE TABLE "floor_plans" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"location_id" uuid NOT NULL,
	"status" text DEFAULT 'reading' NOT NULL,
	"turn" integer DEFAULT 0 NOT NULL,
	"keep_plan" boolean DEFAULT false NOT NULL,
	"result" jsonb,
	"applied_event_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_version" integer DEFAULT 1 NOT NULL,
	"change_seq" bigint,
	CONSTRAINT "floor_plans_location_id_uq" UNIQUE("location_id","id"),
	CONSTRAINT "floor_plans_status_chk" CHECK ("status" IN ('reading', 'ready', 'failed', 'off', 'applied', 'discarded')),
	CONSTRAINT "floor_plans_turn_chk" CHECK (turn IN (0, 90, 180, 270)),
	CONSTRAINT "floor_plans_result_chk" CHECK (result IS NULL OR jsonb_typeof(result) = 'object')
);
--> statement-breakpoint
ALTER TABLE "llm_calls" DROP CONSTRAINT "llm_calls_task_chk";--> statement-breakpoint
ALTER TABLE "extractions" DROP CONSTRAINT "extractions_mode_chk";--> statement-breakpoint
ALTER TABLE "attachments" DROP CONSTRAINT "attachments_one_subject_chk";--> statement-breakpoint
ALTER TABLE "extractions" ADD COLUMN "floor_plan_id" uuid;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "floor_plan_id" uuid;--> statement-breakpoint
ALTER TABLE "floor_plans" ADD CONSTRAINT "floor_plans_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "floor_plans_location_idx" ON "floor_plans" USING btree ("location_id","created_at");--> statement-breakpoint
ALTER TABLE "extractions" ADD CONSTRAINT "extractions_floor_plan_fk" FOREIGN KEY ("location_id","floor_plan_id") REFERENCES "public"."floor_plans"("location_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_floor_plan_fk" FOREIGN KEY ("location_id","floor_plan_id") REFERENCES "public"."floor_plans"("location_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "extractions_floor_plan_idx" ON "extractions" USING btree ("floor_plan_id") WHERE floor_plan_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "attachments_floor_plan_idx" ON "attachments" USING btree ("floor_plan_id");--> statement-breakpoint
ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_task_chk" CHECK ("task" IN ('extract_thing', 'extract_receipt', 'extract_label', 'extract_reading', 'assistant_turn', 'assistant_followup', 'embed_thing', 'embed_query', 'connection_test', 'enrich_aliases', 'extract_room', 'extract_room_merge', 'extract_plan'));--> statement-breakpoint
ALTER TABLE "extractions" ADD CONSTRAINT "extractions_mode_chk" CHECK ("mode" IN ('thing', 'receipt', 'label', 'reading', 'room', 'plan'));--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_one_subject_chk" CHECK (num_nonnulls(thing_id, place_id, purchase_id, meter_reading_id, warranty_id, claim_id,
                       loan_id, incident_id, valuation_id, service_record_id,
                       expiring_document_id, fuel_entry_id, condition_room_id,
                       floor_plan_id) <= 1);