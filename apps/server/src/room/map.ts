/**
 * Accepted room drafts onto the map (#194). When a draft a room capture made is accepted (one by
 * one or in bulk), and its room has a rectangle on the location's map, it gets a node there
 * (map/service.ts `addNodes`: its shape from its type and name, free floor, flagged placed by
 * Kept). Anything else is left as it was; a failure here never fails the accept: it runs inside
 * a savepoint and is undone alone.
 */
import type pg from 'pg';
import type { Scope, Tx } from '../db/scope.js';
import { addNodes } from '../map/service.js';

type Ctx = { tx: Tx; client: pg.ClientBase; scope: Scope; requestId: string };

export async function placeAccepted(ctx: Ctx, thingIds: readonly string[]): Promise<string[]> {
  if (thingIds.length === 0) return [];
  const { rows } = await ctx.client.query<{ id: string; location_id: string }>(
    `SELECT t.id, t.location_id FROM public.things t
      WHERE t.id = ANY ($1::uuid[]) AND t.review_state <> 'draft' AND t.deleted_at IS NULL
        AND EXISTS (SELECT 1 FROM public.room_captures r
                     WHERE r.batch_id = t.capture_batch_id AND r.location_id = t.location_id)`,
    [[...thingIds]],
  );
  const byLocation = new Map<string, string[]>();
  for (const r of rows)
    byLocation.set(r.location_id, [...(byLocation.get(r.location_id) ?? []), r.id]);
  const added: string[] = [];
  for (const [locationId, ids] of byLocation) {
    await ctx.client.query('SAVEPOINT room_map');
    try {
      const out = await addNodes(ctx, locationId, { nodes: ids.map((id) => ({ id })) });
      await ctx.client.query('RELEASE SAVEPOINT room_map');
      added.push(...out.added);
    } catch {
      await ctx.client.query('ROLLBACK TO SAVEPOINT room_map');
    }
  }
  return added;
}
