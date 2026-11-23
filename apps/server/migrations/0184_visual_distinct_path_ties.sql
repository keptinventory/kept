-- Best photo per record, with room for a near-tied distinct recorded path before applying
-- the result cap. Rank the same live, caller-scoped candidates as the original search door.
CREATE FUNCTION kept.visual_matches(p_locations uuid[], p_generation text, p_query vector,
                                    p_min_score real, p_limit integer,
                                    p_ambiguity_margin double precision)
RETURNS TABLE (attachment_id uuid, location_id uuid, thing_id uuid, file_id uuid,
               captured_at timestamptz, score double precision, is_alternate boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  WITH eligible AS MATERIALIZED (
    SELECT s.attachment_id, s.location_id, s.thing_id, s.file_id, s.captured_at,
           e.embedding, t.container_id, t.place_id
      FROM kept.visual_sources(p_locations, NULL) s
      JOIN public.visual_embeddings e ON e.attachment_id = s.attachment_id
       AND e.location_id = s.location_id AND e.file_id = s.file_id AND e.content_hash = s.content_hash
      JOIN public.things t ON t.id = s.thing_id AND t.location_id = s.location_id
     WHERE e.region = 'whole' AND e.generation = p_generation AND e.state = 'ready'
       AND vector_dims(p_query) = 512 AND (p_query <#> p_query) < 0
  ), ranked AS (
    SELECT e.attachment_id, e.location_id, e.thing_id, e.file_id, e.captured_at,
           e.container_id, e.place_id,
           greatest(-1.0, least(1.0, 1.0 - (e.embedding <=> p_query))) AS score
      FROM eligible e
  ), unique_things AS MATERIALIZED (
    SELECT DISTINCT ON (r.thing_id) r.* FROM ranked r
     WHERE r.score >= p_min_score
     ORDER BY r.thing_id, r.score DESC, r.attachment_id
  ), best AS (
    SELECT u.* FROM unique_things u ORDER BY u.score DESC, u.attachment_id LIMIT 1
  ), alternate AS (
    -- Location and immediate parent IDs uniquely identify the current recorded path.
    SELECT u.attachment_id FROM unique_things u CROSS JOIN best b
     WHERE (u.location_id, u.container_id, u.place_id)
             IS DISTINCT FROM (b.location_id, b.container_id, b.place_id)
       AND b.score - u.score < p_ambiguity_margin
     ORDER BY u.score DESC, u.attachment_id LIMIT 1
  ), chosen AS (
    SELECT u.attachment_id, u.location_id, u.thing_id, u.file_id, u.captured_at,
           u.score, a.attachment_id IS NOT NULL AS is_alternate
      FROM unique_things u CROSS JOIN best b
      LEFT JOIN alternate a ON a.attachment_id = u.attachment_id
     ORDER BY (u.attachment_id = b.attachment_id) DESC,
              (a.attachment_id IS NOT NULL) DESC, u.score DESC, u.attachment_id
     LIMIT greatest(1, least(coalesce(p_limit, 10), 20))
  )
  SELECT c.* FROM chosen c ORDER BY c.score DESC, c.attachment_id
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION kept.visual_matches(uuid[], text, vector, real, integer, double precision)
 FROM PUBLIC, kept_app, kept_system, kept_auth;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kept.visual_matches(uuid[], text, vector, real, integer, double precision)
 TO kept_app;
--> statement-breakpoint

-- Older applications may keep using the original strictly score-ordered search door.
CREATE OR REPLACE FUNCTION kept.visual_matches(p_locations uuid[], p_generation text, p_query vector,
                                              p_min_score real, p_limit integer)
RETURNS TABLE (attachment_id uuid, location_id uuid, thing_id uuid, file_id uuid,
               captured_at timestamptz, score double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT m.attachment_id, m.location_id, m.thing_id, m.file_id, m.captured_at, m.score
    FROM kept.visual_matches(p_locations, p_generation, p_query, p_min_score, p_limit, 0) m
   ORDER BY m.score DESC, m.attachment_id
$$;
