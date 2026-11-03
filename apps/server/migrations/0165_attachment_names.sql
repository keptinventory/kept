ALTER TABLE "attachments" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_name_chk" CHECK (name IS NULL OR char_length(name) BETWEEN 1 AND 200);