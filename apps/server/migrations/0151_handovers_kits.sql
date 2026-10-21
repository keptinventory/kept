CREATE TABLE "kit_parts" (
	"kit_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"thing_id" uuid NOT NULL,
	"quantity" numeric(12, 3) DEFAULT '1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_version" integer DEFAULT 1 NOT NULL,
	"change_seq" bigint,
	CONSTRAINT "kit_parts_pk" PRIMARY KEY("kit_id","thing_id"),
	CONSTRAINT "kit_parts_thing_uq" UNIQUE("thing_id"),
	CONSTRAINT "kit_parts_quantity_chk" CHECK (quantity > 0),
	CONSTRAINT "kit_parts_not_itself_chk" CHECK (thing_id <> kit_id)
);
--> statement-breakpoint
CREATE TABLE "kits" (
	"thing_id" uuid PRIMARY KEY NOT NULL,
	"location_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_version" integer DEFAULT 1 NOT NULL,
	"change_seq" bigint,
	CONSTRAINT "kits_location_id_uq" UNIQUE("location_id","thing_id")
);
--> statement-breakpoint
CREATE TABLE "handovers" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"location_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"person_id" uuid NOT NULL,
	"root_thing_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"due_on" date,
	"lead_days" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"condition_out" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_version" integer DEFAULT 1 NOT NULL,
	"change_seq" bigint,
	CONSTRAINT "handovers_location_id_uq" UNIQUE("location_id","id"),
	CONSTRAINT "handovers_direction_chk" CHECK ("direction" IN ('out', 'in')),
	CONSTRAINT "handovers_condition_out_chk" CHECK ("condition_out" IN ('new', 'good', 'fair', 'poor', 'broken')),
	CONSTRAINT "handovers_lead_days_chk" CHECK (lead_days BETWEEN 0 AND 60),
	CONSTRAINT "handovers_notes_chk" CHECK (char_length(notes) <= 2000)
);
--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "handover_id" uuid;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "path_at_lend" text;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "outcome" text;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "condition_out" text;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "condition_in" text;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "return_notes" text;--> statement-breakpoint
ALTER TABLE "kit_parts" ADD CONSTRAINT "kit_parts_thing_id_things_id_fk" FOREIGN KEY ("thing_id") REFERENCES "public"."things"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit_parts" ADD CONSTRAINT "kit_parts_kit_fk" FOREIGN KEY ("location_id","kit_id") REFERENCES "public"."kits"("location_id","thing_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "kits" ADD CONSTRAINT "kits_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kits" ADD CONSTRAINT "kits_thing_fk" FOREIGN KEY ("location_id","thing_id") REFERENCES "public"."things"("location_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_root_thing_id_things_id_fk" FOREIGN KEY ("root_thing_id") REFERENCES "public"."things"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kit_parts_location_idx" ON "kit_parts" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "kits_location_idx" ON "kits" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "handovers_person_idx" ON "handovers" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "handovers_root_idx" ON "handovers" USING btree ("root_thing_id");--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_handover_id_handovers_id_fk" FOREIGN KEY ("handover_id") REFERENCES "public"."handovers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "loans_handover_idx" ON "loans" USING btree ("handover_id");--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_outcome_chk" CHECK ("outcome" IN ('returned', 'lost'));--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_condition_out_chk" CHECK ("condition_out" IN ('new', 'good', 'fair', 'poor', 'broken'));--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_condition_in_chk" CHECK ("condition_in" IN ('new', 'good', 'fair', 'poor', 'broken'));--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_return_notes_chk" CHECK (char_length(return_notes) <= 2000);--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_path_chk" CHECK (char_length(path_at_lend) <= 1000);