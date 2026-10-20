/**
 * Where a place's page opens the location map (#190): a floor on that floor, a room focused, a
 * place drawn on the map in its room with it selected, a place that isn't drawn in its room (on
 * the nearest drawn place that holds it, if one does), and nothing for a place the map doesn't
 * have. Pure, over the server's map, so the page can tell before drawing anything.
 */
import type { MapView } from '@/api/map/types';
import { levelKeyOf, NO_FLOOR } from './layout';

/** A place's page: the place and its path from the top of the location, itself last. */
export type MapScope = { placeId: string; path: readonly string[] };

/** What a place's page hands the map: the scope, the place's name for its notes, and the
 * location's address for "Open the map of …". */
export type PlaceScope = MapScope & { name: string; locationAddress: string };

export type ScopeAt =
  | { at: 'floor'; levelKey: string }
  | { at: 'room'; levelKey: string; roomId: string; noFloor: boolean }
  | { at: 'node'; levelKey: string; roomId: string; nodeId: string; noFloor: boolean }
  | {
      at: 'inside';
      levelKey: string;
      roomId: string;
      /** The nearest place above it that is drawn in the room; null when none is. */
      holderId: string | null;
      noFloor: boolean;
    }
  | { at: 'off' };

export function scopeOn(
  view: Pick<MapView, 'levels' | 'rooms' | 'nodes'>,
  scope: MapScope,
): ScopeAt {
  const { placeId } = scope;
  if (view.levels.some((l) => l.id === placeId)) return { at: 'floor', levelKey: placeId };
  const hasFloors = view.levels.some((l) => l.id !== null);
  const roomAt = (roomId: string) => {
    const room = view.rooms.find((r) => r.id === roomId);
    if (!room) return null;
    const levelKey = levelKeyOf(room.levelId);
    return { levelKey, roomId, noFloor: hasFloors && levelKey === NO_FLOOR };
  };
  const room = roomAt(placeId);
  if (room) return { at: 'room', ...room };
  const node = view.nodes.find((n) => n.id === placeId);
  const nodeRoom = node ? roomAt(node.roomId) : null;
  if (node && nodeRoom) return { at: 'node', ...nodeRoom, nodeId: node.id };
  // Up the path from its parent: the first drawn holder, then the room.
  let holderId: string | null = null;
  for (let i = scope.path.length - 1; i >= 0; i--) {
    const step = scope.path[i];
    if (!step || step === placeId) continue;
    const inRoom = roomAt(step);
    if (inRoom) return { at: 'inside', ...inRoom, holderId };
    if (!holderId && view.nodes.some((n) => n.id === step)) holderId = step;
  }
  return { at: 'off' };
}
