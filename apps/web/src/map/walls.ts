/**
 * Walls that would hide the room (3D only). A room on the map has walls on two sides, −x and −z;
 * the opening view looks at them from inside. Turned so that a wall stands between the camera and
 * the room, that wall drops to a curb, as isometric room views cut their near walls; turned back,
 * it stands again. The camera is orthographic and far away, so only its turn matters.
 *
 * #138: a wall something hangs on stands on whichever side it is, tall enough to clear it, and
 * drops the same way. What hangs on a wall goes with it: hidden once the dropping wall's top passes
 * its middle, back as the wall rises again (a thing in mid-air, or lowered onto the floor, would
 * say it is somewhere it isn't).
 */
import type { MapWall } from '@kept/shared';

/** A wall's full height and its curb, in metres. */
export const WALL_HEIGHT = 1.3;
export const CURB = 0.12;
/** How far a wall stands above the top of the highest thing hung on it (metres). */
export const WALL_ABOVE = 0.15;

/** How far round the camera stands on a wall's outer side before the wall starts to drop, and
 * when it is fully down (the sine of the angle past edge-on). */
const START = 0.08;
const END = 0.5;

/**
 * The height of a room's wall on its `side` for a camera turned `az` radians round the room (the
 * engine's view.az: the camera stands at (sin az, cos az) from what it looks at), the wall `full`
 * metres tall when it stands. Allocates nothing: the engine calls it every frame of a turn.
 */
export function wallHeight(side: MapWall, az: number, full = WALL_HEIGHT): number {
  // How far the camera stands outside the wall: >0 beyond it, <0 inside the room's side.
  const along = side === '-x' || side === '+x' ? Math.sin(az) : Math.cos(az);
  const out = side[0] === '-' ? -along : along;
  const t = (out - START) / (END - START);
  if (t <= 0) return full;
  if (t >= 1) return CURB;
  const k = t * t * (3 - 2 * t);
  return CURB + (full - CURB) * (1 - k);
}

/**
 * How tall a room's wall on `side` stands, or null for no wall there: a room's two back walls
 * (−x and −z, indoors) at WALL_HEIGHT; any wall something hangs on (`top`: the highest top of
 * them) at least WALL_ABOVE above it.
 */
export function fullHeight(
  side: MapWall,
  top: number | undefined,
  indoors: boolean,
): number | null {
  const base = indoors && (side === '-x' || side === '-z') ? WALL_HEIGHT : 0;
  const need = top === undefined ? 0 : top + WALL_ABOVE;
  const h = Math.max(base, need);
  return h > 0 ? h : null;
}

/** Whether a thing whose middle hangs at `middle` shows on a wall standing `wall` metres now. */
export const hungShown = (wall: number, middle: number): boolean => wall >= middle - 1e-9;
