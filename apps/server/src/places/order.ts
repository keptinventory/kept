import type pg from 'pg';

/**
 * The order places and things are listed in, on the server: the tree, a place's contents, the
 * things list and its CSV, the spreadsheet, the map, the readable export and the MCP tools all
 * use these fragments, so they agree with each other and with the web, which sorts what it holds
 * with the same rule (packages/shared/src/order.ts).
 *
 * - Sibling places: the Unplaced area first (it is top level); then floors, by `sort` then when
 *   they were made (the map stacks them in this order, the first is the ground); every other
 *   place A to Z with numbers read as numbers ("Box 2" before "Box 10"); the id last.
 * - The places inside a place in Custom order (`child_order = 'custom'`): by `sort` first, and
 *   places at the same position by the rule above. A location's top level is always A to Z.
 * - Things by name the same way.
 *
 * `sort` is kept as it is for every place: floors and Custom order read it here, and switching a
 * place back to A to Z changes no `sort`.
 */

/** ICU's root order with numbers read as numbers (migration 0159). */
export const NATURAL = 'COLLATE "und-u-kn-true"';

/** ORDER BY for sibling places of alias `p` (`places p`). */
export const placeOrderSql = (p: string): string =>
  `${p}.is_unplaced DESC,
   CASE WHEN EXISTS (SELECT 1 FROM public.places kept_parent
                      WHERE kept_parent.id = ${p}.parent_id AND kept_parent.child_order = 'custom')
        THEN ${p}.sort END,
   (${p}.kind_key = 'floor') DESC,
   CASE WHEN ${p}.kind_key = 'floor' THEN ${p}.sort END,
   CASE WHEN ${p}.kind_key = 'floor' THEN ${p}.created_at END,
   ${p}.name ${NATURAL}, ${p}.id`;

/** A thing's name as the lists sort it (things_name_sort_idx's expression). */
export const thingNameSql = (t: string): string => `lower(coalesce(${t}.name, '')) ${NATURAL}`;

/**
 * Rows already in sibling order (any parent), depth first: each place followed by its children.
 * A row whose parent isn't among the rows counts as top level, or with `orphans: 'drop'` is left
 * out with everything under it.
 */
export function treeWalk<T extends { id: string; parent_id: string | null }>(
  rows: readonly T[],
  { orphans = 'root' }: { orphans?: 'root' | 'drop' } = {},
): (T & { depth: number })[] {
  const ids = new Set(rows.map((r) => r.id));
  const kids = new Map<string | null, T[]>();
  for (const r of rows) {
    if (orphans === 'drop' && r.parent_id && !ids.has(r.parent_id)) continue;
    const parent = r.parent_id && ids.has(r.parent_id) ? r.parent_id : null;
    const list = kids.get(parent) ?? [];
    list.push(r);
    kids.set(parent, list);
  }
  const out: (T & { depth: number })[] = [];
  const seen = new Set<string>();
  const walk = (r: T, depth: number) => {
    if (seen.has(r.id)) return;
    seen.add(r.id);
    out.push({ ...r, depth });
    for (const c of kids.get(r.id) ?? []) walk(c, depth + 1);
  };
  for (const r of kids.get(null) ?? []) walk(r, 0);
  return out;
}

/** A place made in, or moved into, a place in Custom order goes after its siblings there. Under
 * any other parent its `sort` stays as it is. */
export async function lastInCustomOrder(client: pg.ClientBase, id: string): Promise<void> {
  await client.query(
    `UPDATE public.places p
        SET sort = (SELECT coalesce(max(s.sort) + 1, 0) FROM public.places s
                     WHERE s.parent_id = p.parent_id AND s.id <> p.id AND s.deleted_at IS NULL)
      WHERE p.id = $1
        AND EXISTS (SELECT 1 FROM public.places o
                     WHERE o.id = p.parent_id AND o.child_order = 'custom')`,
    [id],
  );
}
