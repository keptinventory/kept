import type pg from 'pg';
import { z } from 'zod';
import type { Tx } from '../db/scope.js';
import { notFound } from '../http/errors.js';
import { shownCodeSql } from '../labels/printed-sql.js';
import { requireMembership } from '../locations/access.js';
import { attentionOf, placeRows } from '../map/view.js';
import { thingNameSql } from '../places/order.js';

// GET /api/v1/locations/:id/graph (#207): a location as a graph, in one read under the caller's
// row-level security. The web lays it out (2D focus rings and the 3D floors) from this.
//
// - Places: every live place of the location, the Unplaced area included, in the tree's order.
// - Things: the live things in use (no drafts) with where they are (`placeId`, or `containerId`
//   for a thing in a box) and their tag ids, containers first, up to THING_CAP; the rest are
//   counted in `more`. `counts` has every holder's direct number of things, those past the cap
//   too, so a folded box or room still says how much is in it.
// - Attention: the map's pins (map/view.ts attentionOf, the same modules and rules), each with
//   the place or box it is in (`holderId`), so a pin on a thing past the cap still shows on the
//   node that holds it.
// - Tags: the tags on those things (name and colour), A to Z.

export const THING_CAP = 2000;

export const GraphViewSchema = z.object({
  locationId: z.uuid(),
  places: z.array(
    z.object({
      id: z.uuid(),
      parentId: z.uuid().nullable(),
      name: z.string(),
      kindKey: z.string(),
      shortCode: z.string().nullable(),
      isUnplaced: z.boolean(),
    }),
  ),
  things: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      shortCode: z.string().nullable(),
      placeId: z.uuid().nullable(),
      containerId: z.uuid().nullable(),
      isContainer: z.boolean(),
      /** Its built-in type, its own or its nearest built-in parent's. */
      typeKey: z.string().nullable(),
      /** A custom type's own name; null for built-in types. */
      typeName: z.string().nullable(),
      tagIds: z.array(z.uuid()),
    }),
  ),
  /** Every holder's direct number of live things in use, past the cap included. */
  counts: z.array(z.object({ holderId: z.uuid(), things: z.number().int() })),
  /** Things past THING_CAP, not in `things`. */
  more: z.number().int(),
  attention: z.array(
    z.object({
      subjectId: z.uuid(),
      /** The place or box it is in (a place's parent place); null at the top. */
      holderId: z.uuid().nullable(),
      kind: z.enum(['low', 'lent', 'due']),
    }),
  ),
  tags: z.array(z.object({ id: z.uuid(), name: z.string(), colour: z.string().nullable() })),
});
export type GraphView = z.infer<typeof GraphViewSchema>;

type ThingRow = {
  id: string;
  name: string | null;
  short_code: string | null;
  place_id: string | null;
  container_id: string | null;
  is_container: boolean;
  type_key: string | null;
  type_name: string | null;
  tag_ids: string[];
};

const LIVE = `t.location_id = $1 AND t.deleted_at IS NULL AND t.lifecycle = 'in_use'
        AND t.review_state <> 'draft'`;

/** The graph of a location the caller can see (404 otherwise). */
export async function graphView(
  tx: Tx,
  client: pg.ClientBase,
  locationId: string,
): Promise<GraphView> {
  await requireMembership(client, locationId);
  const { rows: loc } = await client.query<{ id: string }>(
    'SELECT id FROM public.locations WHERE id = $1 AND deleted_at IS NULL',
    [locationId],
  );
  if (!loc[0]) throw notFound();
  const places = await placeRows(client, locationId);

  const { rows: things } = await client.query<ThingRow>(
    `SELECT t.id, t.name, t.place_id, t.container_id,
            ${shownCodeSql('thing_id', 't.id')} AS short_code,
            coalesce(ty.builtin_key,
                     (SELECT pt.builtin_key FROM public.types pt WHERE pt.id = ty.parent_id))
              AS type_key,
            CASE WHEN ty.builtin_key IS NULL THEN ty.name END AS type_name,
            (coalesce('container' = ANY (kept.type_capabilities(t.type_id)), false)
              OR EXISTS (SELECT 1 FROM public.things c
                          WHERE c.container_id = t.id AND c.deleted_at IS NULL)) AS is_container,
            coalesce((SELECT array_agg(x.tag_id ORDER BY x.tag_id)
                        FROM public.thing_tags x WHERE x.thing_id = t.id), '{}') AS tag_ids
       FROM public.things t
       LEFT JOIN public.types ty ON ty.id = t.type_id
      WHERE ${LIVE}
      ORDER BY is_container DESC, ${thingNameSql('t')}, t.id
      LIMIT ${THING_CAP + 1}`,
    [locationId],
  );
  const { rows: totals } = await client.query<{ holder_id: string; n: number; total: number }>(
    `SELECT coalesce(t.container_id, t.place_id) AS holder_id, count(*)::int AS n,
            (sum(count(*)) OVER ())::int AS total
       FROM public.things t
      WHERE ${LIVE} AND coalesce(t.container_id, t.place_id) IS NOT NULL
      GROUP BY 1
      ORDER BY 1`,
    [locationId],
  );
  const shown = things.slice(0, THING_CAP);
  const total = totals[0]?.total ?? 0;

  const attention = await attentionOf(tx, client, locationId);
  const placeParent = new Map(places.map((p) => [p.id, p.parent_id]));
  const holder = new Map<string, string | null>();
  for (const t of shown) holder.set(t.id, t.container_id ?? t.place_id);
  const unknown = attention
    .map((a) => a.subjectId)
    .filter((id) => !holder.has(id) && !placeParent.has(id));
  if (unknown.length) {
    const { rows } = await client.query<{ id: string; holder_id: string | null }>(
      `SELECT t.id, coalesce(t.container_id, t.place_id) AS holder_id
         FROM public.things t
        WHERE t.location_id = $1 AND t.deleted_at IS NULL AND t.lifecycle = 'in_use'
          AND t.review_state <> 'draft' AND t.id = ANY ($2::uuid[])`,
      [locationId, [...new Set(unknown)]],
    );
    for (const r of rows) holder.set(r.id, r.holder_id);
  }

  const tagIds = [...new Set(shown.flatMap((t) => t.tag_ids))];
  const { rows: tags } = tagIds.length
    ? await client.query<{ id: string; name: string; colour: string | null }>(
        `SELECT g.id, g.name, g.colour FROM public.tags g WHERE g.id = ANY ($1::uuid[])
          ORDER BY lower(g.name) COLLATE "und-x-icu", g.id`,
        [tagIds],
      )
    : { rows: [] };
  const seenTags = new Set(tags.map((g) => g.id));

  return {
    locationId,
    places: places.map((p) => ({
      id: p.id,
      parentId: p.parent_id,
      name: p.name,
      kindKey: p.kind_key,
      shortCode: p.short_code,
      isUnplaced: p.is_unplaced,
    })),
    things: shown.map((t) => ({
      id: t.id,
      name: t.name ?? '',
      shortCode: t.short_code,
      placeId: t.place_id,
      containerId: t.container_id,
      isContainer: t.is_container,
      typeKey: t.type_key,
      typeName: t.type_name,
      // A tag the caller can't read (another account's) isn't named, so it isn't drawn.
      tagIds: t.tag_ids.filter((id) => seenTags.has(id)),
    })),
    counts: totals.map((r) => ({ holderId: r.holder_id, things: r.n })),
    more: Math.max(0, total - shown.length),
    attention: attention
      .filter((a) => holder.has(a.subjectId) || placeParent.has(a.subjectId))
      .map((a) => ({
        subjectId: a.subjectId,
        holderId: (holder.has(a.subjectId)
          ? holder.get(a.subjectId)
          : placeParent.get(a.subjectId)) as string | null,
        kind: a.kind,
      })),
    tags,
  };
}
