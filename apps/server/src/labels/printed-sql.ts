// Whether a thing or a place carries a printed label: one of its codes was confirmed printed
// ("Printed OK?" on its batch) or is a pre-printed blank claimed onto it. Any of its codes counts,
// not only the primary one: a blank claimed onto an existing thing is a physical label although
// the thing keeps its own primary code. The same rule as "Label everything unprinted" and Home's
// unprinted count (labels/service.ts, home/service.ts). Lists show the amber tape only then.

/** SQL boolean: `id` (a thing's or a place's id expression) has a printed label. */
export const labelPrintedSql = (col: 'thing_id' | 'place_id', id: string): string =>
  `EXISTS (SELECT 1 FROM public.short_ids lp
            WHERE lp.${col} = ${id} AND lp.state = 'assigned' AND lp.printed_at IS NOT NULL)`;

/**
 * SQL: the code `id` shows, its label: the most recently printed of its codes, else its primary
 * code (shown quietly, as it has no printed label). A blank claimed onto a thing that already had a
 * code is the one on the box, so that is the one lists and its page show; every code still finds it.
 */
export const shownCodeSql = (col: 'thing_id' | 'place_id', id: string): string =>
  `(SELECT sc.code FROM public.short_ids sc
     WHERE sc.${col} = ${id} AND sc.state = 'assigned' AND (sc.printed_at IS NOT NULL OR sc.is_primary)
     ORDER BY sc.printed_at DESC NULLS LAST, sc.is_primary DESC, sc.code LIMIT 1)`;
