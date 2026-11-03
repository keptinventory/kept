/**
 * Furniture's compartments on the map (#238, 1.14.4): where each is inside the furniture's shape,
 * so the engine can outline them, light the picked one and tell which one a tap hit. Pure numbers
 * in the shape's own frame (engine/sized.ts): its corner at the origin, width along x, up along y,
 * depth along z, front towards +z; each box by its middle, metres.
 *
 * A cube shelf or a bookcase drawn from its numbers (sized.ts) whose grid is the furniture's gives
 * each compartment its own opening; any other shape is divided evenly, as the furniture stands, on
 * its front: drawn shapes have no openings to follow.
 */
import { type MapShapeKey, mapModel, sizedOf } from '@kept/shared';
import type { MapCompartment } from '@/api/map/types';
import { type Box, sizedParts } from './engine/sized';

type Grid = { columns: number; rows: number };

/** A box covering both. */
const union = (a: Box, b: Box): Box => {
  const x0 = Math.min(a.x - a.w / 2, b.x - b.w / 2);
  const x1 = Math.max(a.x + a.w / 2, b.x + b.w / 2);
  const y0 = Math.min(a.y - a.h / 2, b.y - b.h / 2);
  const y1 = Math.max(a.y + a.h / 2, b.y + b.h / 2);
  const z0 = Math.min(a.z - a.d / 2, b.z - b.d / 2);
  const z1 = Math.max(a.z + a.d / 2, b.z + b.d / 2);
  return {
    x: (x0 + x1) / 2,
    y: (y0 + y1) / 2,
    z: (z0 + z1) / 2,
    w: x1 - x0,
    h: y1 - y0,
    d: z1 - z0,
  };
};

/** Each cell's box, row by row from the top (row 1) and column by column from the left. */
function cellBoxes(model: MapShapeKey, grid: Grid): (row: number, col: number) => Box {
  const sized = sizedOf(model);
  if (sized?.base === 'cube_grid' && sized.across === grid.columns && sized.up === grid.rows) {
    const { spaces } = sizedParts(sized);
    // Its spaces go up from the bottom row, left to right.
    return (row, col) => spaces[(grid.rows - row) * grid.columns + (col - 1)] as Box;
  }
  if (sized?.base === 'bookcase' && grid.columns === 1 && sized.levels === grid.rows) {
    const { spaces } = sizedParts(sized);
    return (row) => spaces[grid.rows - row] as Box;
  }
  const m = mapModel(model);
  const h = m.h ?? 1;
  const cw = m.w / grid.columns;
  const ch = h / grid.rows;
  // A little in from the sides, so neighbours' outlines don't touch.
  const gap = Math.min(cw, ch) * 0.06;
  return (row, col) => ({
    x: (col - 0.5) * cw,
    y: h - (row - 0.5) * ch,
    z: m.d / 2,
    w: cw - 2 * gap,
    h: ch - 2 * gap,
    d: m.d,
  });
}

/** Every compartment's box, a merged one over all its cells. */
export function compartmentBoxes(
  model: MapShapeKey,
  grid: Grid,
  compartments: readonly Pick<MapCompartment, 'id' | 'row' | 'col' | 'rows' | 'cols'>[],
): Map<string, Box> {
  const at = cellBoxes(model, grid);
  const out = new Map<string, Box>();
  for (const c of compartments) {
    let box: Box | null = null;
    for (let r = c.row; r < c.row + c.rows; r++) {
      for (let k = c.col; k < c.col + c.cols; k++) {
        if (r < 1 || k < 1 || r > grid.rows || k > grid.columns) continue;
        const cell = at(r, k);
        box = box ? union(box, cell) : cell;
      }
    }
    if (box) out.set(c.id, box);
  }
  return out;
}

/** The compartment whose box a point on the furniture's front falls in (x across, y up, the
 * shape's frame), or null. */
export function compartmentAt(
  boxes: ReadonlyMap<string, Box>,
  point: { x: number; y: number },
): string | null {
  let best: string | null = null;
  let far = Number.POSITIVE_INFINITY;
  for (const [id, b] of boxes) {
    const dx = Math.max(0, Math.abs(point.x - b.x) - b.w / 2);
    const dy = Math.max(0, Math.abs(point.y - b.y) - b.h / 2);
    const d = Math.hypot(dx, dy);
    if (d < far) {
      far = d;
      best = id;
    }
  }
  // A tap on a board between two counts for the nearer one; one well outside, for none.
  return far <= 0.05 ? best : null;
}
