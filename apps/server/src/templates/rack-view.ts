import {
  parseRack,
  parseRackPosition,
  RACK_FACES,
  RACK_MOUNTS,
  RACK_NUMBERINGS,
  type RackLayout,
  type RackPosition,
} from '@kept/shared';
import type pg from 'pg';
import { z } from 'zod';

// What racks look like to a reader (#373): a rack's page and the thing page's "In the rack". Apart
// from racks.ts, which checks and writes positions, so the thing and place views can use it
// without importing the places service back.

const PositionSchema = z.object({
  u: z.number(),
  face: z.enum(RACK_FACES),
  full: z.boolean(),
});

const RackShape = {
  units: z.number().int(),
  width: z.union([z.literal(19), z.literal(10)]),
  numbering: z.enum(RACK_NUMBERINGS),
  mount: z.enum(RACK_MOUNTS),
};

/** What a rack's page shows: its size and numbering, and the gear directly in it with where each
 * is mounted (null: not placed yet). */
export const RackViewSchema = z.object({
  ...RackShape,
  gear: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      shortCode: z.string().nullable(),
      /** Its height in units; null when not given (counted as 1U). */
      units: z.number().nullable(),
      at: PositionSchema.nullable(),
      /** For PATCH /things/:id (If-Match). */
      rowVersion: z.number().int(),
    }),
  ),
});
export type RackView = z.infer<typeof RackViewSchema>;

/** The rack a thing is directly in, and its position there (the thing page's "In the rack"). */
export const ThingRackSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  units: z.number().int(),
  numbering: z.enum(RACK_NUMBERINGS),
  at: PositionSchema.nullable(),
});
export type ThingRack = z.infer<typeof ThingRackSchema>;

/** A place's rack layout, or null when it isn't a rack. */
export async function rackOf(client: pg.ClientBase, placeId: string): Promise<RackLayout | null> {
  const { rows } = await client.query<{ layout: unknown }>(
    'SELECT layout FROM public.places WHERE id = $1 AND deleted_at IS NULL',
    [placeId],
  );
  return parseRack(rows[0]?.layout ?? null);
}

type GearRow = {
  id: string;
  name: string | null;
  short_code: string | null;
  units: number | null;
  rack_at: unknown;
  row_version: number;
};

/** The live things directly in a rack (not in a box in it), each with its position there. */
export async function gearRows(client: pg.ClientBase, rackId: string) {
  const { rows } = await client.query<GearRow>(
    `SELECT t.id, t.name, t.rack_units::float8 AS units, t.rack_at, t.row_version,
            (SELECT s.code FROM public.short_ids s
              WHERE s.thing_id = t.id AND s.is_primary AND s.state = 'assigned' LIMIT 1)
              AS short_code
       FROM public.things t
      WHERE t.place_id = $1 AND t.container_id IS NULL AND t.deleted_at IS NULL
      ORDER BY t.name COLLATE "und-u-kn-true", t.id`,
    [rackId],
  );
  return rows.map((r) => {
    const at = parseRackPosition(r.rack_at);
    const position: RackPosition | null =
      at && at.rackId === rackId ? { u: at.u, face: at.face, full: at.full } : null;
    return {
      id: r.id,
      name: r.name ?? '',
      shortCode: r.short_code,
      units: r.units,
      at: position,
      rowVersion: r.row_version,
    };
  });
}

/** A rack's page: null for a place that isn't a rack. */
export async function rackViewOf(client: pg.ClientBase, placeId: string): Promise<RackView | null> {
  const rack = await rackOf(client, placeId);
  if (!rack) return null;
  const { kind: _, ...shape } = rack;
  return { ...shape, gear: await gearRows(client, placeId) };
}

/** The rack a thing is directly in, with its position; null when it isn't in one. */
export async function thingRackOf(
  client: pg.ClientBase,
  thing: { place_id: string | null; container_id: string | null; rack_at: unknown },
): Promise<ThingRack | null> {
  if (!thing.place_id || thing.container_id) return null;
  const { rows } = await client.query<{ id: string; name: string; layout: unknown }>(
    'SELECT id, name, layout FROM public.places WHERE id = $1 AND deleted_at IS NULL',
    [thing.place_id],
  );
  const rack = parseRack(rows[0]?.layout ?? null);
  const place = rows[0];
  if (!rack || !place) return null;
  const at = parseRackPosition(thing.rack_at);
  return {
    id: place.id,
    name: place.name,
    units: rack.units,
    numbering: rack.numbering,
    at: at && at.rackId === place.id ? { u: at.u, face: at.face, full: at.full } : null,
  };
}
