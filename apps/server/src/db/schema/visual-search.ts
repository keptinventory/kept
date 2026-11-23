import { sql } from 'drizzle-orm';
import { check, customType, index, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { tstz } from './common.js';
import { attachments } from './files.js';
import { locations } from './tenancy.js';

const vector = customType<{ data: string }>({ dataType: () => 'vector' });

/** Rebuildable whole-image index. The database doors enforce current source eligibility. */
export const visualEmbeddings = pgTable(
  'visual_embeddings',
  {
    attachmentId: uuid('attachment_id')
      .notNull()
      .references(() => attachments.id, { onDelete: 'cascade' }),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    fileId: uuid('file_id').notNull(),
    contentHash: text('content_hash').notNull(),
    region: text('region').notNull().default('whole'),
    generation: text('generation').notNull(),
    state: text('state').notNull(),
    embedding: vector('embedding'),
    indexedAt: tstz('indexed_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({
      name: 'visual_embeddings_pk',
      columns: [t.attachmentId, t.contentHash, t.region, t.generation],
    }),
    check('visual_embeddings_hash_chk', sql`content_hash ~ '^[0-9a-f]{64}$'`),
    check('visual_embeddings_region_chk', sql`region = 'whole'`),
    check('visual_embeddings_generation_chk', sql`char_length(generation) BETWEEN 1 AND 200`),
    check(
      'visual_embeddings_state_chk',
      sql`(state = 'ready' AND embedding IS NOT NULL AND vector_dims(embedding) = 512)
          OR (state = 'failed' AND embedding IS NULL)`,
    ),
    index('visual_embeddings_location_generation_idx').on(t.locationId, t.generation),
  ],
);
