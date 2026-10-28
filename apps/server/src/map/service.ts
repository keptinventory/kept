import {
  canCarry,
  capacityOf,
  carryOf,
  cmToM,
  firstOverlap,
  footprintOf,
  guessModel,
  hangRange,
  isMapModel,
  isWallModel,
  MAP_LIMITS,
  MAP_ROOM_KINDS,
  MAP_SURFACES,
  type MapRect,
  type MapShapeKey,
  mToCm,
  offWall,
  placeInRoom,
  shapeOnAdd,
} from '@kept/shared';
import type pg from 'pg';
import { z } from 'zod';
import { actorOf } from '../audit/actor.js';
import { audited } from '../audit/audited.js';
import type { Scope, Tx } from '../db/scope.js';
import { AppError, invalid } from '../http/errors.js';
import { requireCan, requireMembership } from '../locations/access.js';
import {
  mapTree,
  NODE_COLUMNS,
  type NodeRow,
  nodeRows,
  placeRows,
  thingRows,
  versionOf,
} from './view.js';

// PUT /api/v1/locations/:id/layout (1.x, D237): one arrange session, the whole layout at once.
//
// - Anyone who may edit things there arranges (members and up, `things.edit`); viewers see the
//   map and can't change it.
// - The body is the location's complete layout: the rows replace the old ones. A room or node
//   left out goes back to the web's automatic layout.
// - `version` is the layout the session started from (GET …/map); if someone arranged since, 409
//   `conflict` with `reason: 'arranged_since'`, so nobody overwrites another's work unseen.
// - Checked: every room is a room of this location (a live place on a floor or at the top);
//   every node a live place in a room or a live thing in use in a room, each at most once; a
//   model from the catalogue; a host that is another node of the session and can carry it (small
//   things on a top, a webcam on a screen's edge, monitors on an arm, #137), no more than an arm
//   holds, with no loop; rooms on one floor don't overlap.
// - A thing on a wall (#138) sends `height`, its middle's height in centimetres: only a wall shape
//   has one, on nothing, between the floor and HANG_TOP, flat against the wall its turn puts at
//   its back, in a room of the session (its walls are what it hangs on). A wall shape without a
//   height is an older map's and stays as it is; the web hangs it when it next arranges.
// - Audited `place.arrange` on the location with the whole layout before and after (the diff's
//   `layout`, which the web never shows), undoable for ten minutes (undo.ts).

const RoomBody = z.object({
  id: z.uuid(),
  x: z.number().int().min(0).max(MAP_LIMITS.maxCoord),
  z: z.number().int().min(0).max(MAP_LIMITS.maxCoord),
  w: z.number().int().min(MAP_LIMITS.minRoom).max(MAP_LIMITS.maxRoom),
  d: z.number().int().min(MAP_LIMITS.minRoom).max(MAP_LIMITS.maxRoom),
  kind: z.enum(MAP_ROOM_KINDS),
  surface: z.enum(MAP_SURFACES),
});

const NodeBody = z.object({
  id: z.uuid(),
  x: z.number().int().min(0).max(MAP_LIMITS.maxCoord),
  z: z.number().int().min(0).max(MAP_LIMITS.maxCoord),
  rot: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  model: z.string().max(40),
  hostId: z.uuid().nullable(),
  /** #138: optional, so a layout from before it still saves. */
  height: z.number().int().min(0).max(MAP_LIMITS.maxHeight).nullable().optional(),
});

export const LayoutBody = z.object({
  version: z.string().max(40).nullable(),
  rooms: z.array(RoomBody).max(MAP_LIMITS.rooms),
  nodes: z.array(NodeBody).max(MAP_LIMITS.nodes),
});
export type LayoutBody = z.infer<typeof LayoutBody>;

export type Ctx = { tx: Tx; client: pg.ClientBase; scope: Scope; requestId: string };

/** A layout row as the audit stores it, in a fixed order, so undo can compare. */
export type LayoutImage = {
  id: string;
  s: 'place' | 'thing';
  x: number;
  z: number;
  w: number | null;
  d: number | null;
  rot: number;
  model: string | null;
  kind: string | null;
  surface: string | null;
  host: string | null;
  /** A thing on a wall's height (#138), left out when it stands: an audit stored before #138
   * then still equals the layout it describes, so its undo isn't refused. */
  height?: number;
};

export function imageOf(rows: readonly NodeRow[]): LayoutImage[] {
  return rows
    .map((r) => ({
      id: (r.place_id ?? r.thing_id) as string,
      s: r.place_id ? ('place' as const) : ('thing' as const),
      x: r.x,
      z: r.z,
      w: r.w,
      d: r.d,
      rot: r.rot,
      model: r.model,
      kind: r.room_kind,
      surface: r.surface,
      host: r.host_id,
      ...(r.height === null ? {} : { height: r.height }),
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Serialises arrange sessions of one location. */
export async function lockLayout(client: pg.ClientBase, locationId: string): Promise<void> {
  await client.query(`SELECT pg_advisory_xact_lock(hashtext('kept.map'), hashtext($1::text))`, [
    locationId,
  ]);
}

/** Replaces the location's rows with `image` (the caller checked it). */
export async function writeImage(
  client: pg.ClientBase,
  locationId: string,
  image: readonly LayoutImage[],
): Promise<NodeRow[]> {
  await client.query('DELETE FROM public.map_nodes WHERE location_id = $1', [locationId]);
  if (image.length === 0) return [];
  const { rows } = await client.query<NodeRow>(
    `INSERT INTO public.map_nodes (location_id, place_id, thing_id, x_cm, z_cm, w_cm, d_cm, rot, model,
                                   room_kind, surface, host_id, height_cm, created_by)
     SELECT $1, CASE WHEN r.s = 'place' THEN r.id END, CASE WHEN r.s = 'thing' THEN r.id END,
            r.x, r.z, r.w, r.d, r.rot, r.model, r.kind, r.surface, r.host, r.height,
            kept.current_user_id()
       FROM jsonb_to_recordset($2::jsonb)
         AS r(id uuid, s text, x int, z int, w int, d int, rot int, model text, kind text,
              surface text, host uuid, height int)
     RETURNING ${NODE_COLUMNS}`,
    [locationId, JSON.stringify(image)],
  );
  return rows;
}

const refuse = (hint: string) => invalid(hint);

type ThingRef = { id: string; place_id: string | null; container_id: string | null };

/** The checked layout as rows to store. */
async function checkedImage(
  client: pg.ClientBase,
  locationId: string,
  body: LayoutBody,
): Promise<LayoutImage[]> {
  const tree = mapTree(await placeRows(client, locationId));
  const { rows: thingList } = await client.query<ThingRef>(
    `SELECT t.id, t.place_id, t.container_id FROM public.things t
      WHERE t.location_id = $1 AND t.deleted_at IS NULL AND t.lifecycle = 'in_use'
        AND t.review_state <> 'draft'`,
    [locationId],
  );
  const things = new Map(thingList.map((t) => [t.id, t]));
  const roomOfThing = (id: string): string | null => {
    const seen = new Set<string>();
    let cur = things.get(id);
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      if (cur.place_id) return tree.roomOfPlace(cur.place_id);
      cur = cur.container_id ? things.get(cur.container_id) : undefined;
    }
    return null;
  };

  const seen = new Set<string>();
  const once = (id: string) => {
    if (seen.has(id)) throw refuse(`Check the layout: ${id} is in it twice.`);
    seen.add(id);
  };
  const image: LayoutImage[] = [];
  const byLevel = new Map<string, { x: number; z: number; w: number; d: number }[]>();
  const roomSize = new Map<string, { w: number; d: number }>();
  for (const r of body.rooms) {
    const id = r.id.toLowerCase();
    once(id);
    if (!tree.rooms.has(id)) throw refuse(`Check rooms: ${id} is not a room of this location.`);
    roomSize.set(id, { w: cmToM(r.w), d: cmToM(r.d) });
    const level = tree.rooms.get(id) ?? '';
    byLevel.set(level, [...(byLevel.get(level) ?? []), { x: r.x, z: r.z, w: r.w, d: r.d }]);
    image.push({
      id,
      s: 'place',
      x: r.x,
      z: r.z,
      w: r.w,
      d: r.d,
      rot: 0,
      model: null,
      kind: r.kind,
      surface: r.surface,
      host: null,
    });
  }
  for (const rects of byLevel.values()) {
    if (firstOverlap(rects)) {
      throw new AppError('conflict', 409, 'Rooms on one floor can’t overlap.', {
        reason: 'rooms_overlap',
      });
    }
  }

  const models = new Map<string, MapShapeKey>();
  const hosts = new Map<string, string>();
  for (const n of body.nodes) {
    const id = n.id.toLowerCase();
    once(id);
    if (!isMapModel(n.model)) throw refuse(`Check nodes: there is no model "${n.model}".`);
    const place = tree.places.get(id);
    let subject: 'place' | 'thing';
    let roomId: string | null;
    if (place) {
      roomId = tree.roomOfPlace(id);
      if (place.is_unplaced || tree.rooms.has(id) || !roomId) {
        throw refuse(`Check nodes: ${id} is not a place in a room of this location.`);
      }
      subject = 'place';
    } else if (things.has(id)) {
      roomId = roomOfThing(id);
      if (!roomId) throw refuse(`Check nodes: ${id} is not in a room of this location.`);
      subject = 'thing';
    } else {
      throw refuse(`Check nodes: ${id} is not a place or thing of this location.`);
    }
    const height = n.height ?? null;
    if (height !== null) checkWall(id, n, n.model, height, roomSize.get(roomId));
    models.set(id, n.model);
    if (n.hostId) hosts.set(id, n.hostId.toLowerCase());
    image.push({
      id,
      s: subject,
      x: n.x,
      z: n.z,
      w: null,
      d: null,
      rot: n.rot,
      model: n.model,
      kind: null,
      surface: null,
      host: n.hostId ? n.hostId.toLowerCase() : null,
      ...(height === null ? {} : { height }),
    });
  }
  const carried = new Map<string, number>();
  for (const [id, host] of hosts) {
    const hostModel = models.get(host);
    if (!hostModel) throw refuse(`Check nodes: ${id} stands on ${host}, which is not on the map.`);
    if (!carryOf(hostModel)) throw refuse(`Check nodes: nothing can stand on ${host}.`);
    if (!canCarry(hostModel, models.get(id) as MapShapeKey)) {
      throw refuse(`Check nodes: ${host} can't carry ${id}.`);
    }
    const n = (carried.get(host) ?? 0) + 1;
    if (n > capacityOf(hostModel)) throw refuse(`Check nodes: ${host} is full.`);
    carried.set(host, n);
    const chain = new Set([id]);
    let cur: string | undefined = host;
    while (cur) {
      if (chain.has(cur)) throw refuse(`Check nodes: ${id} stands on itself.`);
      chain.add(cur);
      cur = hosts.get(cur);
    }
  }
  return image.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** #138: a thing on a wall hangs on a wall of its room, at a height its shape can hang at. */
function checkWall(
  id: string,
  n: z.infer<typeof NodeBody>,
  model: MapShapeKey,
  height: number,
  room: { w: number; d: number } | undefined,
): void {
  if (!isWallModel(model)) throw refuse(`Check nodes: a ${model} doesn't hang on a wall (${id}).`);
  if (n.hostId) throw refuse(`Check nodes: ${id} hangs on a wall, so it stands on nothing.`);
  const range = hangRange(model);
  if (cmToM(height) < range.min - 0.005 || cmToM(height) > range.max + 0.005) {
    throw refuse(`Check nodes: ${id} can't hang at ${height} cm.`);
  }
  if (!room) throw refuse(`Check nodes: ${id} hangs in a room that isn't in the layout.`);
  // Whole centimetres either way: a centimetre or two from the wall is the wall.
  if (offWall(room, model, { x: cmToM(n.x), z: cmToM(n.z), rot: n.rot }) > 0.025) {
    throw refuse(`Check nodes: ${id} isn't against the wall behind it.`);
  }
}

/** Puts back rows Kept placed (a save that didn't know them), as they were. */
async function insertPlaced(
  client: pg.ClientBase,
  locationId: string,
  rows: readonly NodeRow[],
): Promise<NodeRow[]> {
  const { rows: out } = await client.query<NodeRow>(
    `INSERT INTO public.map_nodes (location_id, place_id, thing_id, x_cm, z_cm, rot, model,
                                   placed_by_kept, created_at, created_by)
     SELECT $1, r.place_id, r.thing_id, r.x, r.z, r.rot, r.model, true, r.created_at,
            kept.current_user_id()
       FROM jsonb_to_recordset($2::jsonb)
         AS r(place_id uuid, thing_id uuid, x int, z int, rot int, model text,
              created_at timestamptz)
     RETURNING ${NODE_COLUMNS}`,
    [
      locationId,
      JSON.stringify(
        rows.map((r) => ({
          place_id: r.place_id,
          thing_id: r.thing_id,
          x: r.x,
          z: r.z,
          rot: r.rot,
          model: r.model,
          created_at: r.created_at,
        })),
      ),
    ],
  );
  return out;
}

// POST /api/v1/locations/:id/layout/nodes (#194): Kept puts things on the map by itself (a room
// photo's accepted things). Each named thing (or place) that stands in a room the map has a
// rectangle for, and isn't on the map yet, gets a node: the shape asked for, else the one its
// type and name give (shapeOnAdd, as the map's "Put on the map"), on free floor in a row from the
// room's corner (placeInRoom), clear of what already stands there. The rows are flagged
// `placed_by_kept`: they don't move the layout's version, so someone arranging meanwhile isn't
// told to load it again, and their save keeps them (putLayout); the next arrange shows them to
// nudge. Anything else named is skipped, not refused: the call is a convenience, never a reason
// for an accept to fail. Audited `map.place` per thing put on the map.

export const AddNodesBody = z.object({
  nodes: z
    .array(z.object({ id: z.uuid(), model: z.string().max(40).optional() }))
    .min(1)
    .max(MAP_LIMITS.nodes),
});
export type AddNodesBody = z.infer<typeof AddNodesBody>;

export async function addNodes(
  c: Ctx,
  locationId: string,
  body: AddNodesBody,
): Promise<{ added: string[]; version: string | null }> {
  const me = await requireMembership(c.client, locationId);
  requireCan(me.role, 'things.edit');
  await lockLayout(c.client, locationId);
  const before = await nodeRows(c.client, locationId);
  const tree = mapTree(await placeRows(c.client, locationId));
  const things = new Map((await thingRows(c.client, locationId)).map((t) => [t.id, t]));
  const roomOfThing = (id: string): string | null => {
    const seen = new Set<string>();
    let cur = things.get(id);
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      if (cur.place_id) return tree.roomOfPlace(cur.place_id);
      cur = cur.container_id ? things.get(cur.container_id) : undefined;
    }
    return null;
  };
  const roomOf = (id: string): string | null =>
    tree.places.has(id) ? tree.roomOfPlace(id) : roomOfThing(id);
  const onMap = new Map(before.map((r) => [(r.place_id ?? r.thing_id) as string, r]));
  const roomRect = (id: string) => {
    const r = onMap.get(id);
    return r && r.w !== null && r.d !== null ? { w: cmToM(r.w), d: cmToM(r.d) } : null;
  };
  // What already stands on each room's floor.
  const taken = new Map<string, MapRect[]>();
  for (const r of before) {
    if (r.w !== null || r.host_id) continue;
    const id = (r.place_id ?? r.thing_id) as string;
    const room = roomOf(id);
    if (!room || !r.model || !isMapModel(r.model)) continue;
    const f = footprintOf(r.model, r.rot);
    taken.set(room, [...(taken.get(room) ?? []), { x: cmToM(r.x), z: cmToM(r.z), ...f }]);
  }
  const wanted = new Map<
    string,
    { id: string; model: MapShapeKey; subject: 'place' | 'thing' }[]
  >();
  for (const n of body.nodes) {
    const id = n.id.toLowerCase();
    if (onMap.has(id)) continue;
    const place = tree.places.get(id);
    const thing = things.get(id);
    if (!place && !thing) continue;
    if (place && (place.is_unplaced || tree.rooms.has(id))) continue;
    const room = roomOf(id);
    if (!room || !roomRect(room)) continue;
    const model =
      n.model && isMapModel(n.model)
        ? n.model
        : thing
          ? shapeOnAdd({
              name: thing.name,
              typeKey: thing.type_key,
              typeName: thing.type_name,
              isContainer: thing.is_container,
            }).model
          : guessModel({ name: place?.name ?? null, subject: 'place', kindKey: place?.kind_key });
    wanted.set(room, [
      ...(wanted.get(room) ?? []),
      { id, model, subject: place ? 'place' : 'thing' },
    ]);
  }
  const rows: { id: string; s: 'place' | 'thing'; x: number; z: number; model: string }[] = [];
  for (const [room, list] of wanted) {
    const spots = placeInRoom(
      roomRect(room) as { w: number; d: number },
      taken.get(room) ?? [],
      list.map((x) => footprintOf(x.model, 0)),
    );
    list.forEach((x, i) => {
      const at = spots[i];
      if (at) rows.push({ id: x.id, s: x.subject, x: mToCm(at.x), z: mToCm(at.z), model: x.model });
    });
  }
  if (rows.length > 0) {
    await c.client.query(
      `INSERT INTO public.map_nodes (location_id, place_id, thing_id, x_cm, z_cm, rot, model,
                                     placed_by_kept, created_by)
       SELECT $1, CASE WHEN r.s = 'place' THEN r.id END, CASE WHEN r.s = 'thing' THEN r.id END,
              r.x, r.z, 0, r.model, true, kept.current_user_id()
         FROM jsonb_to_recordset($2::jsonb) AS r(id uuid, s text, x int, z int, model text)`,
      [locationId, JSON.stringify(rows)],
    );
    for (const r of rows) {
      await audited(c.tx, {
        locationId,
        actor: actorOf(c.scope),
        action: 'map.place',
        entity: { type: r.s, id: r.id },
        after: { x: r.x, z: r.z, model: r.model },
        ...(r.s === 'thing' ? { rootThingId: r.id, subjects: [r.id] } : {}),
        requestId: c.requestId,
      });
    }
  }
  return { added: rows.map((r) => r.id), version: versionOf(before) };
}

/** Ten minutes (the arrange session's undo, D237). */
export const ARRANGE_UNDO_MS = 10 * 60 * 1000;

export async function putLayout(
  c: Ctx,
  locationId: string,
  body: LayoutBody,
): Promise<{ version: string | null }> {
  const me = await requireMembership(c.client, locationId);
  requireCan(me.role, 'things.edit');
  await lockLayout(c.client, locationId);
  const before = await nodeRows(c.client, locationId);
  if (versionOf(before) !== body.version) {
    throw new AppError(
      'conflict',
      409,
      'Someone arranged this map since you opened it. Load it again to see theirs.',
      { reason: 'arranged_since' },
    );
  }
  const image = await checkedImage(c.client, locationId, body);
  // Things Kept put on the map since this session began, and that it doesn't name, stay.
  const since = body.version ? new Date(body.version) : null;
  const named = new Set(image.map((r) => r.id));
  const kept = before.filter(
    (r) =>
      r.placed_by_kept &&
      (since === null || r.created_at > since) &&
      !named.has((r.place_id ?? r.thing_id) as string),
  );
  let after = await writeImage(c.client, locationId, image);
  if (kept.length > 0) after = [...after, ...(await insertPlaced(c.client, locationId, kept))];
  await audited(c.tx, {
    locationId,
    actor: actorOf(c.scope),
    action: 'place.arrange',
    entity: { type: 'location', id: locationId },
    before: { layout: imageOf(before) },
    after: { layout: image },
    requestId: c.requestId,
    undoableUntil: new Date(Date.now() + ARRANGE_UNDO_MS),
  });
  return { version: versionOf(after) };
}
