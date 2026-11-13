/**
 * Sized shapes (#240, #241, #485), as boards: a cube shelf from its grid, a bookcase from its size
 * and levels and a shelving unit from its size and shelves, so the map draws whatever grid or size
 * a node's model carries without a model of its own. Pure numbers (draw.ts turns them into boxes).
 * Metres, in the shape's own frame: its corner at the origin, width along x, up along y, depth
 * along z, front towards +z; each box by its middle. `spaces` are the openings between the boards:
 * a cube each, a level each, or what stands on each shelf.
 */
import { CUBE_GRID, cubeRunCm, type SizedShape } from '@kept/shared';

export type Box = { x: number; y: number; z: number; w: number; h: number; d: number };
export type Board = Box & { part: 'side' | 'shelf' | 'divider' | 'back' | 'plinth' | 'post' };

/** A bookcase's boards (metres): its sides, shelves and top, its back and its plinth. */
const CASE = { t: 0.018, back: 0.004, plinth: 0.06 } as const;

/** A shelving unit's parts (metres): its posts, its shelves, how high the bottom one stands and
 * the most room the top one is given. */
const RACKING = { post: 0.035, t: 0.02, bottom: 0.08, topRoom: 0.4 } as const;

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

/** A shelving unit: four posts the full height and its shelves evenly between the bottom one,
 * off the floor, and the top, flush with the posts; open on every side. What stands on a shelf
 * is its space, up to the next one; the top shelf's is above the unit, 40 cm at most. */
function shelvingUnit(wc: number, dc: number, hc: number, shelves: number) {
  const { post, t, bottom, topRoom } = RACKING;
  const w = wc / 100;
  const d = dc / 100;
  const h = hc / 100;
  const boards: Board[] = [];
  for (const x of [0, w - post])
    for (const z of [0, d - post]) boards.push(box('post', x, 0, z, post, h, post));
  const step = (h - t - bottom) / (shelves - 1);
  const room = step - t;
  const spaces: Box[] = [];
  for (let i = 0; i < shelves; i++) {
    const y = i === shelves - 1 ? h - t : bottom + i * step;
    boards.push(box('shelf', 0, y, 0, w, t, d));
    spaces.push(
      rect(post, y + t, 0, w - 2 * post, i < shelves - 1 ? room : Math.min(room, topRoom), d),
    );
  }
  return { boards, spaces };
}

/** A sized shape's boards and the spaces between them. */
export function sizedParts(s: SizedShape): { boards: Board[]; spaces: Box[] } {
  if (s.base === 'cube_grid') return cubeGrid(s.across, s.up);
  if (s.base === 'shelving_unit') return shelvingUnit(s.w, s.d, s.h, s.shelves);
  return bookcase(s.w, s.d, s.h, s.levels);
}
