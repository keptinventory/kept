/**
 * Free floor in a room for things Kept puts on the map by itself (a room photo's accepted
 * things): each goes at the first spot, row by row from the room's corner, that keeps off the
 * walls and clear of everything already standing there and of each other. Metres, rectangles from
 * their corner, as the map's layout stores them. Pure, so the server and the tests share it.
 */
import { type MapRect, rectsOverlap } from './map.js';

/** From the walls, as the web's automatic layout keeps. */
const WALL = 0.15;
/** Between things. */
const GAP = 0.1;
const EPS = 1e-6;

const round = (n: number) => Math.round(n * 100) / 100;

/** A spot for each size, in order, or null for one that doesn't fit any more. */
export function placeInRoom(
  room: { w: number; d: number },
  taken: readonly MapRect[],
  sizes: readonly { w: number; d: number }[],
): ({ x: number; z: number } | null)[] {
  const placed: MapRect[] = [...taken];
  const clear = (r: MapRect) => {
    const padded = {
      x: r.x - GAP + EPS,
      z: r.z - GAP + EPS,
      w: r.w + 2 * GAP - 2 * EPS,
      d: r.d + 2 * GAP - 2 * EPS,
    };
    return !placed.some((p) => rectsOverlap(p, padded));
  };
  return sizes.map((s) => {
    const xs = [WALL, ...placed.map((p) => p.x + p.w + GAP)];
    const zs = [WALL, ...placed.map((p) => p.z + p.d + GAP)];
    const spots = zs
      .flatMap((z) => xs.map((x) => ({ x: round(x), z: round(z) })))
      .filter(
        (c) =>
          c.x >= WALL - EPS &&
          c.z >= WALL - EPS &&
          c.x + s.w <= room.w - WALL + EPS &&
          c.z + s.d <= room.d - WALL + EPS,
      )
      .sort((a, b) => a.z - b.z || a.x - b.x);
    const at = spots.find((c) => clear({ ...c, w: s.w, d: s.d })) ?? null;
    if (at) placed.push({ ...at, w: s.w, d: s.d });
    return at;
  });
}
