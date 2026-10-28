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
// PUT /api/v1/locations/:locationId/place-folds {placeIds (≤ MAX_FOLDS)} → 204
//
// PUT replaces the caller's folds in the location: a toggle, "Fold all" and "Open all" each send
// the whole set. Ids of places that aren't in the location (or that the caller can't see) are
// dropped, never an error: a place another person just deleted mustn't fail a fold. Any member
// may fold, viewers too; personal tokens can't (not in tokens/access.ts). Not audited: folding is
// the person's own view and changes nothing anyone else sees (route-catalogue allowlist).

/** More than any outline shows: a location's places, with room to spare. */
export const MAX_FOLDS = 5000;

const Params = z.object({ locationId: z.uuid() });
export const PlaceFoldsSchema = z.object({ placeIds: z.array(z.uuid()) });
const PutBody = z.object({ placeIds: z.array(z.uuid()).max(MAX_FOLDS) }).strict();

/** The caller's folded places in `locationId`, as RLS lets them see them, oldest place first. */
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

/** Makes the caller's folds in `locationId` exactly `placeIds` (those that are places there). */
export async function replaceFolds(
  client: pg.ClientBase,
  locationId: string,
  placeIds: readonly string[],
): Promise<void> {
  await client.query(
    `DELETE FROM public.place_folds f USING public.places p
      WHERE p.id = f.place_id AND f.user_id = kept.current_user_id() AND p.location_id = $1`,
    [locationId],
  );
  if (placeIds.length === 0) return;
  await client.query(
    `INSERT INTO public.place_folds (user_id, place_id)
     SELECT kept.current_user_id(), p.id FROM public.places p
      WHERE p.location_id = $1 AND p.id = ANY($2::uuid[])
     ON CONFLICT DO NOTHING`,
    [locationId, placeIds.map((id) => id.toLowerCase())],
  );
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
    { schema: { params: Params, body: PutBody } },
    (req, reply) =>
      scopedWrite(pools, req, reply, async (_tx, client) => {
        const locationId = req.params.locationId.toLowerCase();
        await requireMembership(client, locationId);
        await replaceFolds(client, locationId, req.body.placeIds);
        return { status: 204, body: undefined };
      }),
  );
}
