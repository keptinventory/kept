-- Whole-image visual search reads bounded, live photo sources. Vectors are rebuildable and
-- stay behind doors. Every door resolves current memberships, MFA and token scope again.
ALTER TABLE public.visual_embeddings ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.visual_embeddings FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY owner_all ON public.visual_embeddings FOR ALL TO kept_owner
  USING (true) WITH CHECK (true);
--> statement-breakpoint
REVOKE ALL ON public.visual_embeddings FROM kept_app, kept_system, kept_auth, PUBLIC;
--> statement-breakpoint

-- The original-file route permits owners, administrators and members. Apply that boundary
-- to whole-image evidence as well. The visibility door also checks role expiry, MFA, trash,
-- and the token's own narrower locations. Hidden Personal is respected for the default scope.
CREATE FUNCTION kept.visual_locations(p_locations uuid[]) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT m.location_id FROM public.memberships m
   WHERE m.user_id = kept.current_user_id() AND m.role IN ('owner', 'admin', 'member')
     AND m.location_id IN (SELECT kept.visible_location_ids())
     AND CASE WHEN p_locations IS NULL
              THEN m.location_id NOT IN (SELECT kept.hidden_location_ids())
              ELSE m.location_id = ANY (p_locations) END
$$;
--> statement-breakpoint
CREATE FUNCTION kept.visual_sources(p_locations uuid[], p_attachment uuid)
RETURNS TABLE (attachment_id uuid, location_id uuid, thing_id uuid, file_id uuid,
               content_hash text, storage_key text, bytes bigint, captured_at timestamptz)
LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
  SELECT a.id, a.location_id, t.id, f.id, f.sha256::text, f.storage_key, f.bytes, f.created_at
    FROM public.attachments a
    JOIN public.things t ON t.id = a.thing_id AND t.location_id = a.location_id
    JOIN public.files f ON f.id = a.file_id AND f.location_id = a.location_id
   WHERE (p_attachment IS NULL OR a.id = p_attachment)
     AND a.location_id IN (SELECT kept.visual_locations(p_locations))
     AND a.role = 'photo' AND NOT a.in_review
     AND t.deleted_at IS NULL AND t.review_state <> 'draft' AND t.name IS NOT NULL
     AND f.class IN ('photo', 'evidence') AND f.bytes <= 8388608
     AND f.mime IN ('image/jpeg', 'image/png', 'image/webp')
$$;
--> statement-breakpoint

-- Raw source metadata follows existing files/attachments RLS in the invoker function above.
-- These doors use the same source predicates and return no vector or source-storage key.
CREATE FUNCTION kept.visual_coverage(p_locations uuid[], p_generation text)
RETURNS TABLE (ready integer, pending integer, failed integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT count(*) FILTER (WHERE e.state = 'ready')::int,
         count(*) FILTER (WHERE e.state IS NULL)::int,
         count(*) FILTER (WHERE e.state = 'failed')::int
    FROM kept.visual_sources(p_locations, NULL) s
    LEFT JOIN public.visual_embeddings e ON e.attachment_id = s.attachment_id
     AND e.location_id = s.location_id AND e.file_id = s.file_id AND e.content_hash = s.content_hash
     AND e.region = 'whole' AND e.generation = p_generation
$$;
--> statement-breakpoint
CREATE FUNCTION kept.visual_backlog(p_location uuid, p_generation text, p_limit integer)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT s.attachment_id FROM kept.visual_sources(ARRAY[p_location], NULL) s
    LEFT JOIN public.visual_embeddings e ON e.attachment_id = s.attachment_id
     AND e.location_id = s.location_id AND e.file_id = s.file_id AND e.content_hash = s.content_hash
     AND e.region = 'whole' AND e.generation = p_generation
   WHERE p_location IN (SELECT kept.admin_location_ids())
     AND e.state IS DISTINCT FROM 'ready'
   ORDER BY (e.state IS NULL) DESC, s.attachment_id
   LIMIT greatest(0, least(coalesce(p_limit, 0), 100))
$$;
--> statement-breakpoint
CREATE FUNCTION kept.visual_current(p_attachment uuid, p_location uuid, p_file uuid,
                                    p_hash text, p_generation text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (
    SELECT 1 FROM kept.visual_sources(ARRAY[p_location], p_attachment) s
    JOIN public.visual_embeddings e ON e.attachment_id = s.attachment_id
     AND e.location_id = s.location_id AND e.file_id = s.file_id AND e.content_hash = s.content_hash
   WHERE s.file_id = p_file AND s.content_hash = p_hash
     AND e.region = 'whole' AND e.generation = p_generation AND e.state = 'ready')
$$;
--> statement-breakpoint
CREATE FUNCTION kept.visual_store(p_attachment uuid, p_location uuid, p_file uuid, p_hash text,
                                  p_generation text, p_vector vector) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF p_location NOT IN (SELECT kept.writable_location_ids()) THEN RETURN false; END IF;
  IF p_vector IS NOT NULL AND (vector_dims(p_vector) <> 512 OR (p_vector <#> p_vector) >= 0) THEN
    RETURN false;
  END IF;
  -- Serialize with moves/role changes on the attachment and lifecycle changes on the thing.
  -- A racing delete, rebind or trash may finish after this write but cannot resurrect a match.
  PERFORM 1 FROM public.attachments a JOIN public.things t ON t.id = a.thing_id
   WHERE a.id = p_attachment AND a.location_id = p_location FOR UPDATE OF a, t;
  INSERT INTO public.visual_embeddings AS e
    (attachment_id, location_id, file_id, content_hash, region, generation, state, embedding)
  SELECT s.attachment_id, s.location_id, s.file_id, s.content_hash, 'whole', p_generation,
         CASE WHEN p_vector IS NULL THEN 'failed' ELSE 'ready' END, p_vector
    FROM kept.visual_sources(ARRAY[p_location], p_attachment) s
   WHERE s.file_id = p_file AND s.content_hash = p_hash
     AND p_location IN (SELECT kept.writable_location_ids())
  ON CONFLICT (attachment_id, content_hash, region, generation) DO UPDATE
      SET location_id = excluded.location_id, file_id = excluded.file_id, state = excluded.state,
          embedding = excluded.embedding, indexed_at = now()
    WHERE e.state <> 'ready' OR excluded.state = 'ready'
       OR e.location_id <> excluded.location_id OR e.file_id <> excluded.file_id;
  RETURN FOUND;
END $$;
--> statement-breakpoint
CREATE FUNCTION kept.visual_matches(p_locations uuid[], p_generation text, p_query vector,
                                    p_min_score real, p_limit integer)
RETURNS TABLE (attachment_id uuid, location_id uuid, thing_id uuid, file_id uuid,
               captured_at timestamptz, score double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  WITH eligible AS MATERIALIZED (
    SELECT s.attachment_id, s.location_id, s.thing_id, s.file_id, s.captured_at, e.embedding
      FROM kept.visual_sources(p_locations, NULL) s
      JOIN public.visual_embeddings e ON e.attachment_id = s.attachment_id
       AND e.location_id = s.location_id AND e.file_id = s.file_id AND e.content_hash = s.content_hash
     WHERE e.region = 'whole' AND e.generation = p_generation AND e.state = 'ready'
       AND vector_dims(p_query) = 512 AND (p_query <#> p_query) < 0
  ), ranked AS (
    SELECT e.attachment_id, e.location_id, e.thing_id, e.file_id, e.captured_at,
           greatest(-1.0, least(1.0, 1.0 - (e.embedding <=> p_query))) AS score
      FROM eligible e
  ), unique_things AS (
    SELECT DISTINCT ON (r.thing_id) r.* FROM ranked r
     WHERE r.score >= p_min_score
     ORDER BY r.thing_id, r.score DESC, r.attachment_id
  )
  SELECT u.* FROM unique_things u ORDER BY u.score DESC, u.attachment_id
   LIMIT greatest(1, least(coalesce(p_limit, 10), 20))
$$;
--> statement-breakpoint

-- A changed photo association cannot regain its old vector by cycling through a move,
-- a non-photo role or another file. A delete cascades via the attachment key.
CREATE FUNCTION kept.visual_attachment_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  DELETE FROM public.visual_embeddings e WHERE e.attachment_id = OLD.id;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER attachments_visual_changed
  AFTER UPDATE OF location_id, file_id, thing_id, role, in_review ON public.attachments
  FOR EACH ROW WHEN ((OLD.location_id, OLD.file_id, OLD.thing_id, OLD.role, OLD.in_review)
                    IS DISTINCT FROM
                    (NEW.location_id, NEW.file_id, NEW.thing_id, NEW.role, NEW.in_review))
  EXECUTE FUNCTION kept.visual_attachment_changed();
--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION kept.visual_locations(uuid[]), kept.visual_sources(uuid[], uuid),
 kept.visual_coverage(uuid[], text), kept.visual_backlog(uuid, text, integer),
 kept.visual_current(uuid, uuid, uuid, text, text), kept.visual_store(uuid, uuid, uuid, text, text, vector),
 kept.visual_matches(uuid[], text, vector, real, integer), kept.visual_attachment_changed()
 FROM PUBLIC, kept_app, kept_system, kept_auth;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION kept.visual_locations(uuid[]), kept.visual_sources(uuid[], uuid),
 kept.visual_coverage(uuid[], text), kept.visual_backlog(uuid, text, integer),
 kept.visual_current(uuid, uuid, uuid, text, text), kept.visual_store(uuid, uuid, uuid, text, text, vector),
 kept.visual_matches(uuid[], text, vector, real, integer) TO kept_app;
