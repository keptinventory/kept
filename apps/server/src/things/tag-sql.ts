import { z } from 'zod';

// A thing's tags in the SQL every thing list shares: the chips a row carries, "has any / all /
// none of" these tags, and the key a list grouped by tag sorts by. One order everywhere: the tag's
// name A to Z (ICU, as the lists sort names), then its id, so a row's first chip is the group it is
// listed under.

const ICU = 'COLLATE "und-x-icu"';

/** SQL: the tags of thing `t` (an id expression) as `[{id, name, colour}]`, A to Z. */
export const tagsSql = (t: string): string =>
  `coalesce((SELECT jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'colour', g.colour)
                              ORDER BY lower(g.name) ${ICU}, g.id)
               FROM public.thing_tags x JOIN public.tags g ON g.id = x.tag_id
              WHERE x.thing_id = ${t}), '[]'::jsonb)`;

/**
 * SQL: the group key of thing `t` in a list grouped by tag: `0<first tag name> <id>`, or `1` with
 * no tag, so untagged things come last.
 */
export const tagGroupSql = (t: string): string =>
  `coalesce((SELECT '0' || lower(g.name) || ' ' || g.id::text
               FROM public.thing_tags x JOIN public.tags g ON g.id = x.tag_id
              WHERE x.thing_id = ${t}
              ORDER BY lower(g.name) ${ICU}, g.id LIMIT 1), '1')`;

/**
 * SQL: thing `t` has any of the tags in `ids` (a uuid[] expression), or, with `all`, every one.
 * The caller wraps it in matchOf() for "none of".
 */
export const tagMatchSql = (t: string, ids: string, all = false): string =>
  all
    ? `(SELECT count(DISTINCT g.tag_id) FROM public.thing_tags g
         WHERE g.thing_id = ${t} AND g.tag_id = ANY (${ids})) = cardinality(${ids})`
    : `EXISTS (SELECT 1 FROM public.thing_tags g
                WHERE g.thing_id = ${t} AND g.tag_id = ANY (${ids}))`;

/** Whether the request asks "has all of" for filter `name` (`all=<name>`); "none of" wins. */
export const isAll = (
  all: readonly string[] | undefined,
  not: readonly string[] | undefined,
  name: string,
): boolean => (all?.includes(name) ?? false) && !(not?.includes(name) ?? false);

export const ThingTagSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  colour: z.string().nullable(),
});
export type ThingTag = z.infer<typeof ThingTagSchema>;

/** A row's `tags` column (tagsSql()) as the API sends it. */
export const tagsOfRow = (v: unknown): ThingTag[] =>
  Array.isArray(v)
    ? v.map((g) => ({
        id: String((g as ThingTag).id),
        name: String((g as ThingTag).name),
        colour: (g as ThingTag).colour ?? null,
      }))
    : [];
