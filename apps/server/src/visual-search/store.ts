import type { VisualSearchCoverage, VisualSearchMatch } from '@kept/shared';
import type pg from 'pg';
import { vectorLiteral } from '../embeddings/provider.js';

const DIMENSIONS = 512;

export function validVector(vector: readonly number[]): boolean {
  return (
    vector.length === DIMENSIONS &&
    vector.every((value) => Number.isFinite(value) && Math.abs(value) <= 1.01) &&
    vector.some((value) => value !== 0)
  );
}

export async function visualLocations(
  client: pg.ClientBase,
  requested: string[] | undefined,
): Promise<string[]> {
  const { rows } = await client.query<{ id: string }>(
    'SELECT id FROM kept.visual_locations($1) AS l(id) ORDER BY id',
    [requested ?? null],
  );
  return rows.map(({ id }) => id);
}

export const EMPTY_COVERAGE: VisualSearchCoverage = {
  generation: null,
  ready: 0,
  pending: 0,
  failed: 0,
  paused: 0,
};

export async function visualCoverage(
  client: pg.ClientBase,
  generation: string,
  ids: string[],
): Promise<VisualSearchCoverage> {
  const { rows } = await client.query<Pick<VisualSearchCoverage, 'ready' | 'pending' | 'failed'>>(
    'SELECT * FROM kept.visual_coverage($1, $2)',
    [ids, generation],
  );
  return { ...EMPTY_COVERAGE, generation, ...rows[0] };
}

export async function visualMatches(
  client: pg.ClientBase,
  generation: string,
  ids: string[],
  vector: number[],
  minScore: number,
  limit: number,
  ambiguityMargin: number,
): Promise<{ matches: VisualSearchMatch[]; ambiguous: boolean }> {
  const { rows } = await client.query<
    Omit<VisualSearchMatch, 'capturedAt'> & { capturedAt: Date; is_alternate: boolean }
  >(
    `SELECT t.id AS "thingId", l.id AS "locationId", t.name,
            jsonb_build_array(jsonb_build_object('id', l.id, 'name', l.name)) ||
            coalesce((SELECT jsonb_agg(p.entry ORDER BY p.ordinal)
                       FROM jsonb_array_elements(kept.path_of(t.place_id, t.container_id))
                            WITH ORDINALITY AS p(entry, ordinal)
                      WHERE p.entry->>'name' IS NOT NULL), '[]'::jsonb) AS path,
            r.attachment_id AS "attachmentId", f.id AS "fileId", r.captured_at AS "capturedAt",
            r.score, r.is_alternate
       FROM kept.visual_matches($1, $2, $3, $4, $5, $6) r
       JOIN public.things t ON t.id = r.thing_id AND t.location_id = r.location_id
       JOIN public.locations l ON l.id = t.location_id
       JOIN public.attachments a ON a.id = r.attachment_id AND a.thing_id = t.id
       JOIN public.files f ON f.id = r.file_id AND f.id = a.file_id
      WHERE t.deleted_at IS NULL AND t.review_state <> 'draft' AND NOT a.in_review
      ORDER BY r.score DESC, r.attachment_id`,
    [ids, generation, vectorLiteral(vector), minScore, limit, ambiguityMargin],
  );
  return {
    matches: rows.map(({ is_alternate: _alternate, capturedAt, ...match }) => ({
      ...match,
      capturedAt: capturedAt.toISOString(),
    })),
    ambiguous: rows.some(({ is_alternate }) => is_alternate),
  };
}

export type VisualSource = {
  attachment_id: string;
  location_id: string;
  file_id: string;
  content_hash: string;
  storage_key: string;
  bytes: string;
  ready: boolean;
};

export async function visualSource(
  client: pg.ClientBase,
  attachmentId: string,
  generation: string,
) {
  const { rows } = await client.query<VisualSource>(
    `SELECT s.*, kept.visual_current(s.attachment_id, s.location_id, s.file_id, s.content_hash, $2) AS ready
       FROM kept.visual_sources(ARRAY(SELECT kept.writable_location_ids()), $1) s`,
    [attachmentId, generation],
  );
  return rows[0];
}

export async function storeVisualVector(
  client: pg.ClientBase,
  source: VisualSource,
  generation: string,
  vector: number[] | null,
): Promise<boolean> {
  const { rows } = await client.query<{ stored: boolean }>(
    'SELECT kept.visual_store($1, $2, $3, $4, $5, $6) AS stored',
    [
      source.attachment_id,
      source.location_id,
      source.file_id,
      source.content_hash,
      generation,
      vector ? vectorLiteral(vector) : null,
    ],
  );
  return rows[0]?.stored === true;
}

export async function pendingVisualAttachments(
  client: pg.ClientBase,
  locationId: string,
  generation: string,
) {
  const { rows } = await client.query<{ id: string }>(
    'SELECT id FROM kept.visual_backlog($1, $2, 100) AS b(id)',
    [locationId, generation],
  );
  return rows.map(({ id }) => id);
}
