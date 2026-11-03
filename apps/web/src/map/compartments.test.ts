import { describe, expect, it } from 'vitest';
import { compartmentAt, compartmentBoxes } from './compartments';
import { furnitureModel } from './layout';

// #238 (1.14.4): furniture's compartments inside its shape on the map.

const cells = (columns: number, rows: number) =>
  Array.from({ length: columns * rows }, (_, i) => ({
    id: `c${i + 1}`,
    row: Math.floor(i / columns) + 1,
    col: (i % columns) + 1,
    rows: 1,
    cols: 1,
  }));
const cm = (m: number) => Math.round(m * 1000) / 10;

describe('compartment boxes', () => {
  it('uses a cube shelf’s own openings: compartment 1 is the top left cube', () => {
    const boxes = compartmentBoxes('cube_grid_2x4', { columns: 2, rows: 4 }, cells(2, 4));
    const first = boxes.get('c1');
    const last = boxes.get('c8');
    // 33 cm cubes between 2 cm dividers in a 4.5 cm frame: the top row starts 109.5 cm up.
    expect(first && [cm(first.x - first.w / 2), cm(first.y - first.h / 2), cm(first.w)]).toEqual([
      4.5, 109.5, 33,
    ]);
    expect(last && [cm(last.x - last.w / 2), cm(last.y - last.h / 2)]).toEqual([39.5, 4.5]);
  });

  it('covers every cell of a merged compartment', () => {
    const list = [
      { id: 'top', row: 1, col: 1, rows: 1, cols: 2 },
      { id: 'a', row: 2, col: 1, rows: 1, cols: 1 },
      { id: 'b', row: 2, col: 2, rows: 1, cols: 1 },
    ];
    const boxes = compartmentBoxes('cube_grid', { columns: 2, rows: 2 }, list);
    const top = boxes.get('top');
    // Two cubes and the divider between them: 33 + 2 + 33.
    expect(top && cm(top.w)).toBe(68);
  });

  it('uses a bookcase’s levels, the first at the top', () => {
    const boxes = compartmentBoxes('bookcase', { columns: 1, rows: 6 }, cells(1, 6));
    const one = boxes.get('c1') as { y: number };
    const six = boxes.get('c6') as { y: number };
    expect(one.y).toBeGreaterThan(six.y);
  });

  it('divides any other shape evenly as it stands', () => {
    // The chest of drawers' model, 1.14 m wide and 1.88 m high, as 1 column of 9.
    const boxes = compartmentBoxes('drawers', { columns: 1, rows: 9 }, cells(1, 9));
    const one = boxes.get('c1') as { y: number; h: number };
    const nine = boxes.get('c9') as { y: number; h: number };
    expect(one.y).toBeCloseTo(1.88 - 1.88 / 18);
    expect(nine.y).toBeCloseTo(1.88 / 18);
    // A cube shelf whose drawn grid isn't the furniture's (turned since) is divided too.
    const turned = compartmentBoxes('cube_grid_2x4', { columns: 4, rows: 2 }, cells(4, 2));
    expect(turned.size).toBe(8);
  });
});

describe('picking a compartment', () => {
  const boxes = compartmentBoxes('cube_grid', { columns: 2, rows: 2 }, cells(2, 2));

  it('finds the compartment a point on the front falls in', () => {
    const c3 = boxes.get('c3') as { x: number; y: number };
    expect(compartmentAt(boxes, c3)).toBe('c3');
    const c2 = boxes.get('c2') as { x: number; y: number };
    expect(compartmentAt(boxes, c2)).toBe('c2');
  });

  it('counts a tap on a board for the nearer one, and one far off for none', () => {
    const c1 = boxes.get('c1') as { x: number; y: number; w: number };
    expect(compartmentAt(boxes, { x: c1.x + c1.w / 2 + 0.005, y: c1.y })).toBe('c1');
    expect(compartmentAt(boxes, { x: 5, y: 5 })).toBeNull();
  });
});

describe('the shape furniture takes when nobody picked one', () => {
  it('is a cube shelf of its grid as it stands, a bookcase of its levels, or a chest', () => {
    expect(furnitureModel({ kind: 'grid', columns: 2, rows: 4 })).toBe('cube_grid_2x4');
    expect(furnitureModel({ kind: 'grid', columns: 4, rows: 2 })).toBe('cube_grid_4x2');
    expect(furnitureModel({ kind: 'grid', columns: 2, rows: 2 })).toBe('cube_grid');
    expect(furnitureModel({ kind: 'levels', columns: 1, rows: 6 })).toBe('bookcase');
    expect(furnitureModel({ kind: 'levels', columns: 1, rows: 4 })).toBe('bookcase_80x28x202_4');
    expect(furnitureModel({ kind: 'drawers', columns: 1, rows: 9 })).toBe('drawers');
    // Too big to draw: it keeps its guess.
    expect(furnitureModel({ kind: 'grid', columns: 12, rows: 2 })).toBeNull();
  });
});
