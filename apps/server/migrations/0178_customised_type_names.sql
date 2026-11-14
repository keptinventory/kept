-- Custom SQL migration file, put your code below! --
-- A customised built-in type keeps its name (#546). kept.customise_type() (0021) copies a
-- built-in into the account with no name and no key of its own, pointing at the built-in through
-- `copied_from_id`, so the copy reads in each person's language until someone renames it. The
-- readers that named a type by its own `builtin_key` alone showed the copy as "No type"; the
-- server's readers now resolve the key through `copied_from_id` (types/graph.ts typeKeySql), and
-- this one, a share link's thing, does the same.
--
-- Copies made before this release need no change: their rows were right all along (name NULL,
-- copied_from_id set), only the readers were wrong. The search document and the embedding text
-- already read the built-in's names through `copied_from_id` (0016, 0155).
-- Additive: the function's signature, owner and grants are unchanged.
CREATE OR REPLACE FUNCTION kept.share_thing_json(t public.things) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
  SELECT jsonb_build_object(
    'name', t.name,
    'type', (SELECT jsonb_build_object('icon', ty.icon, 'name', ty.name,
                                       'builtinKey', coalesce(ty.builtin_key,
                                         (SELECT k.builtin_key FROM public.types k
                                           WHERE k.id = ty.copied_from_id)))
               FROM public.types ty WHERE ty.id = t.type_id),
    'path', kept.share_path(t.place_id, t.container_id),
    'quantity', t.quantity,
    'condition', t.condition,
    'description', t.notes,
    'photo', (SELECT jsonb_build_object(
                       'fileId', f.id,
                       'mime', f.mime,
                       'thumb', (SELECT d.storage_key FROM public.file_derivatives d
                                  WHERE d.file_id = f.id AND d.variant = 'thumb'),
                       'large', coalesce(
                         (SELECT d.storage_key FROM public.file_derivatives d
                           WHERE d.file_id = f.id AND d.variant = 'share'),
                         (SELECT d.storage_key FROM public.file_derivatives d
                           WHERE d.file_id = f.id AND d.variant = 'display')))
                FROM public.files f
               WHERE f.id = t.cover_file_id AND f.derivative_state = 'ready'
                 AND f.location_id = t.location_id))
$$;
