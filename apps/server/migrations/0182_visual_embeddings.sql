CREATE TABLE "visual_embeddings" (
	"attachment_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"content_hash" text NOT NULL,
	"region" text DEFAULT 'whole' NOT NULL,
	"generation" text NOT NULL,
	"state" text NOT NULL,
	"embedding" vector,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visual_embeddings_pk" PRIMARY KEY("attachment_id","content_hash","region","generation"),
	CONSTRAINT "visual_embeddings_hash_chk" CHECK (content_hash ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "visual_embeddings_region_chk" CHECK (region = 'whole'),
	CONSTRAINT "visual_embeddings_generation_chk" CHECK (char_length(generation) BETWEEN 1 AND 200),
	CONSTRAINT "visual_embeddings_state_chk" CHECK ((state = 'ready' AND embedding IS NOT NULL AND vector_dims(embedding) = 512)
          OR (state = 'failed' AND embedding IS NULL))
);
--> statement-breakpoint
ALTER TABLE "visual_embeddings" ADD CONSTRAINT "visual_embeddings_attachment_id_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."attachments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visual_embeddings" ADD CONSTRAINT "visual_embeddings_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visual_embeddings_location_generation_idx" ON "visual_embeddings" USING btree ("location_id","generation");