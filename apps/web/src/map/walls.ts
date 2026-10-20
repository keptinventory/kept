/**
 * Walls that would hide the room (3D only). A room on the map has walls on two sides, −x and −z;
 * the opening view looks at them from inside. Turned so that a wall stands between the camera and
 * the room, that wall drops to a curb, as isometric room views cut their near walls; turned back,
 * it stands again. The camera is orthographic and far away, so only its turn matters.
 */

/** A wall's full height and its curb, in metres. */
export const WALL_HEIGHT = 1.3;
export const CURB = 0.12;

/** How far round the camera stands on a wall's outer side before the wall starts to drop, and
 * when it is fully down (the sine of the angle past edge-on). */
const START = 0.08;
const END = 0.5;

/**
 * The height of a room's wall on its `side` (−x or −z) for a camera turned `az` radians round
 * the room (the engine's view.az: the camera stands at (sin az, cos az) from what it looks at).
 * Allocates nothing: the engine calls it every frame of a turn.
 */
export function wallHeight(side: 'x' | 'z', az: number): number {
  // How far the camera stands outside the wall: >0 beyond it, <0 inside the room's side.
  const out = side === 'x' ? -Math.sin(az) : -Math.cos(az);
  const t = (out - START) / (END - START);
  if (t <= 0) return WALL_HEIGHT;
  if (t >= 1) return CURB;
  const k = t * t * (3 - 2 * t);
  return CURB + (WALL_HEIGHT - CURB) * (1 - k);
}
