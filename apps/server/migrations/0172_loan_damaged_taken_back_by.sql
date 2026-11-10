ALTER TABLE "loans" ADD COLUMN "damaged" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "taken_back_by" uuid;