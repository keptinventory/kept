import type pg from 'pg';

// Shared by "Turn into a place" (things/service.ts convertToPlace) and the Undo of "Turn places
// into boxes" (places/undo.ts): both delete the box's row, so both refuse while it holds one of
// these.

/** What a thing would lose by becoming a place: a place has none of these (security review #23;
 * the web lists them before the user confirms). Meters are listed too, but the definer refuses
 * a thing with a meter whatever the caller says (things_has_meters): a reading history is never
 * dropped by a conversion. */
export const CONVERT_LOSSES = [
  'brand',
  'ended',
  'links',
  'meters',
  'purchase',
  'serial',
  'tags',
] as const;

export async function conversionLosses(client: pg.ClientBase, id: string): Promise<string[]> {
  const { rows } = await client.query<Record<(typeof CONVERT_LOSSES)[number], boolean>>(
    `SELECT t.brand_id IS NOT NULL AS brand,
            t.lifecycle <> 'in_use' AS ended,
            EXISTS (SELECT 1 FROM public.thing_links k
                     WHERE k.from_thing_id = t.id OR k.to_thing_id = t.id) AS links,
            EXISTS (SELECT 1 FROM public.meters m WHERE m.thing_id = t.id) AS meters,
            t.purchase_line_id IS NOT NULL AS purchase,
            t.serial IS NOT NULL AS serial,
            EXISTS (SELECT 1 FROM public.thing_tags g WHERE g.thing_id = t.id) AS tags
       FROM public.things t WHERE t.id = $1`,
    [id],
  );
  const row = rows[0];
  return row ? CONVERT_LOSSES.filter((k) => row[k]) : [];
}
