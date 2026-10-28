/**
 * Sized shapes (#240, #241), as boards: a cube shelf from its grid and a bookcase from its size and
 * levels, so the map draws whatever grid or size a node's model carries without a model of its
 * own. Pure numbers (draw.ts turns them into boxes). Metres, in the shape's own frame: its corner
 * at the origin, width along x, up along y, depth along z, front towards +z; each box by its
 * middle. `spaces` are the openings between the boards: a cube each, or a level each.
 */
import { CUBE_GRID, cubeRunCm, type SizedShape } from '@kept/shared';

export type Box = { x: number; y: number; z: number; w: number; h: number; d: number };
export type Board = Box & { part: 'side' | 'shelf' | 'divider' | 'back' | 'plinth' };

/** A bookcase's boards (metres): its sides, shelves and top, its back and its plinth. */
const CASE = { t: 0.018, back: 0.004, plinth: 0.06 } as const;

const rect = (x0: number, y0: number, z0: number, w: number, h: number, d: number): Box => ({
  x: x0 + w / 2,
  y: y0 + h / 2,
  z: z0 + d / 2,
  w,
  h,
  d,
});
const box = (part: Board['part'], ...at: Parameters<typeof rect>): Board => ({
  part,
  ...rect(...at),
});

/** A cube shelf: a frame, a divider between each two cubes either way, open at the back. */
function cubeGrid(across: number, up: number): { boards: Board[]; spaces: Box[] } {
  const f = CUBE_GRID.frame / 100;
  const t = CUBE_GRID.divider / 100;
  const c = CUBE_GRID.cube / 100;
  const d = CUBE_GRID.depth / 100;
  const w = cubeRunCm(across) / 100;
  const h = cubeRunCm(up) / 100;
  const at = (i: number) => f + i * (c + t);
  const boards: Board[] = [
    box('side', 0, 0, 0, f, h, d),
    box('side', w - f, 0, 0, f, h, d),
    box('shelf', f, 0, 0, w - 2 * f, f, d),
    box('shelf', f, h - f, 0, w - 2 * f, f, d),
  ];
  for (let i = 1; i < across; i++) boards.push(box('divider', at(i) - t, f, 0, t, h - 2 * f, d));
  for (let j = 1; j < up; j++) boards.push(box('shelf', f, at(j) - t, 0, w - 2 * f, t, d));
  const spaces: Box[] = [];
  for (let j = 0; j < up; j++)
    for (let i = 0; i < across; i++) spaces.push(rect(at(i), at(j), 0, c, c, d));
  return { boards, spaces };
}

/** A bookcase: two sides on a plinth, a back, and its levels evenly between the bottom shelf and
 * the top. */
function bookcase(wc: number, dc: number, hc: number, levels: number) {
  const { t, back, plinth } = CASE;
  const w = wc / 100;
  const d = dc / 100;
  const h = hc / 100;
  const inner = w - 2 * t;
  const space = (h - plinth - t * (levels + 1)) / levels;
  const boards: Board[] = [
    box('side', 0, 0, 0, t, h, d),
    box('side', w - t, 0, 0, t, h, d),
    box('back', t, plinth, 0, inner, h - plinth - t, back),
    box('plinth', t, 0, d - 0.03, inner, plinth, 0.018),
  ];
  const spaces: Box[] = [];
  for (let i = 0; i <= levels; i++) {
    const y = plinth + i * (space + t);
    boards.push(box('shelf', t, y, back, inner, t, d - back));
    if (i < levels) spaces.push(rect(t, y + t, back, inner, space, d - back));
  }
  return { boards, spaces };
}

/** A sized shape's boards and the spaces between them. */
export function sizedParts(s: SizedShape): { boards: Board[]; spaces: Box[] } {
  return s.base === 'cube_grid' ? cubeGrid(s.across, s.up) : bookcase(s.w, s.d, s.h, s.levels);
}
