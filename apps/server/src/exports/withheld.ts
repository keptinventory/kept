import type pg from 'pg';
import { type ReadContext, thingKept } from './data.js';

// The secret values an export without secrets leaves out, so the export can say so: for each
// kept thing and place, the keys of its secret fields that have a value. Never a value and never
// its ciphertext: kept.secret_fields_set() answers presence only, as it does for the thing page's
// "set" (things/view.ts). The job puts the keys on the row (`secretsWithheld`) and their count in
// the manifest; an importer ignores both, so the export imports as any other.

/** Subject id (thing or place) → its secret field keys with a value, sorted. */
export async function readWithheld(
  client: pg.ClientBase,
  ctx: Pick<ReadContext, 'locationId' | 'ended' | 'trashed'>,
): Promise<Map<string, string[]>> {
  const { rows } = await client.query<{ id: string; field_key: string }>(
    `SELECT x.id, s.field_key FROM public.things x
       CROSS JOIN LATERAL kept.secret_fields_set(x.id, NULL) s
      WHERE x.location_id = $1 AND ${thingKept('x', ctx)}
     UNION ALL
     SELECT x.id, s.field_key FROM public.places x
       CROSS JOIN LATERAL kept.secret_fields_set(NULL, x.id) s
      WHERE x.location_id = $1${ctx.trashed ? '' : ' AND x.deleted_at IS NULL'}
     ORDER BY 1, 2`,
    [ctx.locationId],
  );
  const out = new Map<string, string[]>();
  for (const r of rows) {
    const keys = out.get(r.id);
    if (keys) {
      if (!keys.includes(r.field_key)) keys.push(r.field_key);
    } else out.set(r.id, [r.field_key]);
  }
  return out;
}

/** How many values `withheld` names. */
export const withheldCount = (withheld: ReadonlyMap<string, readonly string[]>): number =>
  [...withheld.values()].reduce((n, keys) => n + keys.length, 0);
