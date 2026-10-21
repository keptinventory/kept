-- 1.x (#209): a thing's tags join the text it is embedded from, one `tag: <name>` line each, A to
-- Z, after everything else (@kept/shared embedText's `tags`). Only tagged things' text changes, so
-- only they are embedded again (the backfill compares content hashes). A tag's rename reaches
-- the vectors the same way, through the hourly backfill.
CREATE OR REPLACE FUNCTION kept.embedding_text(t public.things) RETURNS text
LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
  SELECT concat_ws(E'\n',
    nullif(kept.embedding_text_of(
      t.name,
      ARRAY(SELECT v FROM jsonb_each(t.aliases) e,
                   jsonb_array_elements_text(CASE WHEN jsonb_typeof(e.value) = 'array'
                                                  THEN e.value ELSE '[]'::jsonb END) v),
      (SELECT coalesce(ty.name, ty.search_names,
                       (SELECT c.search_names FROM public.types c WHERE c.id = ty.copied_from_id))
         FROM public.types ty WHERE ty.id = t.type_id),
      (SELECT b.name FROM public.brands b WHERE b.id = t.brand_id),
      t.model,
      t.notes,
      (SELECT l.name FROM public.locations l WHERE l.id = t.location_id)
        || ARRAY(SELECT s ->> 'name'
                   FROM jsonb_array_elements(kept.path_of(t.place_id, t.container_id))
                        WITH ORDINALITY AS p(s, ord)
                  ORDER BY p.ord),
      (SELECT v.name FROM public.purchase_lines pl
         JOIN public.purchases pu ON pu.id = pl.purchase_id
         JOIN public.vendors v ON v.id = pu.vendor_id
        WHERE pl.id = t.purchase_line_id),
      ARRAY(SELECT pl.description FROM public.purchase_lines pl WHERE pl.id = t.purchase_line_id)),
      ''),
    (SELECT string_agg('tag: ' || x.v, E'\n' ORDER BY lower(x.v) COLLATE "und-x-icu", x.id)
       FROM (SELECT g.id, btrim(regexp_replace(g.name, '[[:space:]]+', ' ', 'g'), ' ') AS v
               FROM public.thing_tags tt JOIN public.tags g ON g.id = tt.tag_id
              WHERE tt.thing_id = t.id) x
      WHERE x.v <> ''))
$$;
