import type pg from 'pg';
import { z } from 'zod';
import type { KeptApp } from '../http/app.js';
import type { InventoryDeps } from '../http/routes.js';
import { scopedRead, scopedWrite } from '../http/write.js';
import { requireMembership } from '../locations/access.js';

// The places a person folded in a location's places outline (#358): `place_folds`, one row per
// folded place, so the outline opens the same on every device. Registered by places/routes.ts.
// The web contract is apps/web/src/api/inventory/{types,paths}.ts (PlaceFolds).
//
// GET /api/v1/locations/:locationId/place-folds → {placeIds}   (the caller's, in that location)
// PUT /api/v1/locations/:locationId/place-folds {fold, open (each ≤ MAX_FOLDS)} → 204
//
// PUT is a change, never the whole set: it folds the places in `fold` and opens those in
// `open`, and leaves every other fold as it is, so a device that hasn't read the folds yet (or
// read them before another device changed them) can't erase them. "Fold all" and "Open all"
// send every place they mean. An id in both lists is a 400. Ids of places that aren't in the
// location (or that the caller can't see) are dropped, never an error: a place another person
// just deleted mustn't fail a fold. Changes for one person in one location are applied one at a
// time (an advisory lock). Any member may fold, viewers too; personal tokens can't (not in
// tokens/access.ts). Not audited: folding is the person's own view and changes nothing anyone
// else sees (route-catalogue allowlist). Leaving a location drops the person's folds there
// (kept.drop_place_folds_in, migration 0164).

/** More than any outline shows: a location's places, with room to spare. */
export const MAX_FOLDS = 5000;

const Params = z.object({ locationId: z.uuid() });
export const PlaceFoldsSchema = z.object({ placeIds: z.array(z.uuid()) });
const Ids = z.array(z.uuid()).max(MAX_FOLDS);
export const PlaceFoldsChange = z
  .object({ fold: Ids, open: Ids })
  .strict()
  .refine(
    (b) => {
      const open = new Set(b.open.map((id) => id.toLowerCase()));
      return !b.fold.some((id) => open.has(id.toLowerCase()));
    },
    { message: 'A place is either folded or opened, not both.' },
  );
export type PlaceFoldsChange = z.infer<typeof PlaceFoldsChange>;

/** The caller's folded places in `locationId`, as RLS lets them see them. */
export async function listFolds(client: pg.ClientBase, locationId: string): Promise<string[]> {
  const { rows } = await client.query<{ place_id: string }>(
    `SELECT f.place_id FROM public.place_folds f
       JOIN public.places p ON p.id = f.place_id
      WHERE f.user_id = kept.current_user_id() AND p.location_id = $1
      ORDER BY f.place_id`,
    [locationId],
  );
  return rows.map((r) => r.place_id);
}

/** Folds `fold` and opens `open` for the caller in `locationId` (only places there count). */
export async function changeFolds(
  client: pg.ClientBase,
  locationId: string,
  { fold, open }: PlaceFoldsChange,
): Promise<void> {
  // One change at a time per person and location: two devices at once both land.
  await client.query(
    'SELECT pg_advisory_xact_lock(hashtext($1), hashtext(kept.current_user_id()::text || $2))',
    ['kept.place_folds', locationId],
  );
  if (open.length) {
    await client.query(
      `DELETE FROM public.place_folds f USING public.places p
        WHERE p.id = f.place_id AND f.user_id = kept.current_user_id() AND p.location_id = $1
          AND f.place_id = ANY($2::uuid[])`,
      [locationId, open.map((id) => id.toLowerCase())],
    );
  }
  if (fold.length) {
    await client.query(
      `INSERT INTO public.place_folds (user_id, place_id)
       SELECT kept.current_user_id(), p.id FROM public.places p
        WHERE p.location_id = $1 AND p.id = ANY($2::uuid[])
       ON CONFLICT DO NOTHING`,
      [locationId, fold.map((id) => id.toLowerCase())],
    );
  }
}

export async function placeFoldRoutes(app: KeptApp, deps: InventoryDeps): Promise<void> {
  const { pools } = deps;

  app.get(
    '/api/v1/locations/:locationId/place-folds',
    { schema: { params: Params, response: { 200: PlaceFoldsSchema } } },
    (req) =>
      scopedRead(pools, req, async (_tx, client) => {
        const locationId = req.params.locationId.toLowerCase();
        await requireMembership(client, locationId);
        return { placeIds: await listFolds(client, locationId) };
      }),
  );

  app.put(
    '/api/v1/locations/:locationId/place-folds',
    { schema: { params: Params, body: PlaceFoldsChange } },
    (req, reply) =>
      scopedWrite(pools, req, reply, async (_tx, client) => {
        const locationId = req.params.locationId.toLowerCase();
        await requireMembership(client, locationId);
        await changeFolds(client, locationId, req.body);
        return { status: 204, body: undefined };
      }),
  );
}
