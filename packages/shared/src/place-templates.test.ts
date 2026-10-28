import { describe, expect, it } from 'vitest';
import {
  asItStands,
  BUILTIN_PLACE_TEMPLATES,
  builtinPlaceTemplate,
  canTurn,
  cellCount,
  cellsOf,
  fillPattern,
  layoutProblem,
  numberAt,
  type PlaceLayout,
  patternProblem,
  usesParent,
  withCount,
} from './place-templates.js';

const grid = (across: number, up: number): PlaceLayout => ({ kind: 'grid', across, up });
const numbers = (layout: PlaceLayout, o: 'upright' | 'side' = 'upright') =>
  cellsOf(layout, o).map((c) => `${c.n}@${c.row},${c.col}`);

describe('the grid as it stands', () => {
  it('counts a 4 × 4 from the top left, row by row: 1…16', () => {
    const cells = cellsOf(grid(4, 4));
    expect(cells.map((c) => c.n)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    expect(cells[0]).toEqual({ n: 1, row: 1, col: 1 });
    expect(cells[3]).toEqual({ n: 4, row: 1, col: 4 });
    expect(cells[4]).toEqual({ n: 5, row: 2, col: 1 });
    expect(cells[15]).toEqual({ n: 16, row: 4, col: 4 });
  });

  it('builds a 2 × 4 upright as 4 rows of 2, and on its side as 2 rows of 4', () => {
    expect(asItStands(grid(2, 4), 'upright')).toEqual({ columns: 2, rows: 4 });
    expect(asItStands(grid(2, 4), 'side')).toEqual({ columns: 4, rows: 2 });
    // Upright: 1–2, 3–4, 5–6, 7–8.
    expect(numbers(grid(2, 4))).toEqual([
      '1@1,1',
      '2@1,2',
      '3@2,1',
      '4@2,2',
      '5@3,1',
      '6@3,2',
      '7@4,1',
      '8@4,2',
    ]);
    // On its side: 1…4 on the top row, 5…8 below.
    expect(numbers(grid(2, 4), 'side')).toEqual([
      '1@1,1',
      '2@1,2',
      '3@1,3',
      '4@1,4',
      '5@2,1',
      '6@2,2',
      '7@2,3',
      '8@2,4',
    ]);
  });

  it('turns only a grid that is not square', () => {
    expect(canTurn(grid(2, 4))).toBe(true);
    expect(canTurn(grid(1, 4))).toBe(true);
    expect(canTurn(grid(4, 4))).toBe(false);
    expect(canTurn({ kind: 'levels', count: 6 })).toBe(false);
    expect(canTurn({ kind: 'drawers', count: 9 })).toBe(false);
  });

  it('stacks levels and drawers in one column, the top one first', () => {
    expect(asItStands({ kind: 'levels', count: 6 })).toEqual({ columns: 1, rows: 6 });
    expect(numbers({ kind: 'drawers', count: 3 })).toEqual(['1@1,1', '2@2,1', '3@3,1']);
    expect(cellCount({ kind: 'levels', count: 6 })).toBe(6);
    expect(cellCount(grid(2, 8))).toBe(16);
  });

  it('numbers a cell from where it sits', () => {
    expect(numberAt({ row: 2, col: 3 }, 4)).toBe(7);
    for (const c of cellsOf(grid(4, 2), 'side')) expect(numberAt(c, 2)).toBe(c.n);
  });

  it('refuses layouts out of bounds', () => {
    expect(layoutProblem(grid(4, 4))).toBeNull();
    expect(layoutProblem(grid(0, 4))).toMatch(/1 to 12/);
    expect(layoutProblem(grid(13, 1))).toMatch(/1 to 12/);
    expect(layoutProblem(grid(1.5, 2))).toMatch(/1 to 12/);
    expect(layoutProblem(grid(11, 11))).toMatch(/at most 100/);
    expect(layoutProblem({ kind: 'levels', count: 0 })).toMatch(/1 to 40/);
    expect(layoutProblem({ kind: 'drawers', count: 41 })).toMatch(/1 to 40/);
    expect(layoutProblem({ kind: 'drawers', count: 40 })).toBeNull();
  });

  it('changes the count of levels and drawers, never a grid', () => {
    expect(withCount({ kind: 'levels', count: 6 }, 5)).toEqual({ kind: 'levels', count: 5 });
    expect(withCount(grid(2, 2), 5)).toEqual(grid(2, 2));
    expect(withCount({ kind: 'drawers', count: 9 }, undefined)).toEqual({
      kind: 'drawers',
      count: 9,
    });
  });
});

describe('patterns', () => {
  it('derives a 4 × 4’s codes from the parent: KX01-F0101 … KX01-F0404', () => {
    const pattern = '{parent}-F{col:02}{row:02}';
    const codes = cellsOf(grid(4, 4)).map((c) => fillPattern(pattern, { ...c, parent: 'KX01' }));
    expect(codes[0]).toBe('KX01-F0101');
    expect(codes[2]).toBe('KX01-F0301'); // column 3, row 1
    expect(codes[15]).toBe('KX01-F0404');
    expect(new Set(codes).size).toBe(16);
  });

  it('takes column and row from the grid as it stands', () => {
    const pattern = '{parent}-{col}{row}';
    const side = cellsOf(grid(2, 4), 'side').map((c) =>
      fillPattern(pattern, { ...c, parent: 'K' }),
    );
    expect(side).toEqual(['K-11', 'K-21', 'K-31', 'K-41', 'K-12', 'K-22', 'K-32', 'K-42']);
  });

  it('fills names and pads numbers', () => {
    expect(fillPattern('Cube {n}', { n: 3, row: 1, col: 3 })).toBe('Cube 3');
    expect(fillPattern('Drawer {n:03}', { n: 7, row: 7, col: 1 })).toBe('Drawer 007');
    expect(fillPattern('R{row}C{col}', { n: 5, row: 2, col: 1 })).toBe('R2C1');
  });

  it('refuses unknown placeholders, stray braces and {parent} in a name', () => {
    expect(patternProblem('Cube {n}', { code: false })).toBeNull();
    expect(patternProblem('{parent}-F{col:02}{row:02}', { code: true, distinct: true })).toBeNull();
    expect(patternProblem('Cube {x}', { code: false })).toEqual({ reason: 'unknown', token: 'x' });
    expect(patternProblem('Cube {n', { code: false })).toEqual({ reason: 'braces' });
    expect(patternProblem('Cube n}', { code: false })).toEqual({ reason: 'braces' });
    expect(patternProblem('{n:7}', { code: false })).toEqual({ reason: 'braces' });
    expect(patternProblem('{parent} {n}', { code: false })).toEqual({ reason: 'parent' });
    expect(patternProblem('  ', { code: true })).toEqual({ reason: 'empty' });
  });

  it('asks a pattern to tell the compartments apart', () => {
    expect(patternProblem('{parent}-A', { code: true, distinct: true })).toEqual({
      reason: 'indistinct',
    });
    expect(patternProblem('{parent}-{row}', { code: true, distinct: true })).toEqual({
      reason: 'indistinct',
    });
    expect(patternProblem('{parent}-{row}{col}', { code: true, distinct: true })).toBeNull();
    expect(patternProblem('{parent}-{n}', { code: true, distinct: true })).toBeNull();
  });

  it('knows when a pattern needs the parent’s code', () => {
    expect(usesParent('{parent}-{n}')).toBe(true);
    expect(usesParent('F{n:02}')).toBe(false);
  });
});

describe('the built-in templates', () => {
  it('has cube shelves 1×4, 2×2, 2×4, 4×4, 2×8, a bookcase of 6, a chest of 9 and a shelving unit', () => {
    expect(BUILTIN_PLACE_TEMPLATES.map((b) => b.key)).toEqual([
      'cube_1x4',
      'cube_2x2',
      'cube_2x4',
      'cube_4x4',
      'cube_2x8',
      'bookcase',
      'chest',
      'shelving',
    ]);
    expect(builtinPlaceTemplate('cube_2x8')?.layout).toEqual(grid(2, 8));
    expect(builtinPlaceTemplate('bookcase')?.layout).toEqual({ kind: 'levels', count: 6 });
    expect(builtinPlaceTemplate('chest')?.layout).toEqual({ kind: 'drawers', count: 9 });
    for (const b of BUILTIN_PLACE_TEMPLATES) expect(layoutProblem(b.layout)).toBeNull();
  });
});
