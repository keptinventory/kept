import { describe, expect, it } from 'vitest';
import {
  type Compartment,
  codesHeld,
  compartmentOf,
  coverageProblem,
  mergeCompartments,
  mergeProblem,
  parseCell,
  positionCode,
  splitCompartment,
  storedCellOf,
  turnCell,
  turnCompartments,
  turnRect,
} from './compartments.js';
import { cellsOf, type FurnitureLayout, fillPattern } from './place-templates.js';

// #238 (1.14.4): turning furniture, renumbering it, merging and splitting its compartments.

const upright = (across: number, up: number): FurnitureLayout => ({
  kind: 'grid',
  across,
  up,
  orientation: 'upright',
});

const LETTERS = 'ABCDEFGHIJKLMNOP';
const CODE = '{parent}-F{col:02}{row:02}';

/** A unit's compartments as made: A, B, … in counting order, named "Cube n", coded by `code`. */
function made(layout: FurnitureLayout, code: string | null = CODE): Compartment[] {
  return cellsOf(layout, layout.orientation).map((cell) => ({
    id: LETTERS[cell.n - 1] as string,
    name: `Cube ${cell.n}`,
    row: cell.row,
    col: cell.col,
    rows: 1,
    cols: 1,
    n: cell.n,
    codes: code ? [fillPattern(code, { ...cell, parent: 'KX01' })] : [],
    shortIds: [{ code: `SID00${LETTERS[cell.n - 1]}`, primary: true }],
    parts: [],
  }));
}

const patterns = { name: 'Cube {n}', code: CODE, parent: 'KX01' };
const by = (list: Compartment[], id: string) => list.find((c) => c.id === id) as Compartment;
const where = (c: Compartment) => `${c.row},${c.col}`;

describe('turning a rectangle a quarter', () => {
  const grid = { columns: 2, rows: 4 };

  it('moves the top left to the top right when the top goes right (clockwise)', () => {
    expect(turnCell({ row: 1, col: 1 }, grid, 'right')).toEqual({ row: 1, col: 4 });
    expect(turnCell({ row: 4, col: 1 }, grid, 'right')).toEqual({ row: 1, col: 1 });
    expect(turnCell({ row: 1, col: 2 }, grid, 'right')).toEqual({ row: 2, col: 4 });
  });

  it('moves the top left to the bottom left when the top goes left', () => {
    expect(turnCell({ row: 1, col: 1 }, grid, 'left')).toEqual({ row: 2, col: 1 });
    expect(turnCell({ row: 1, col: 2 }, grid, 'left')).toEqual({ row: 1, col: 1 });
    expect(turnCell({ row: 4, col: 2 }, grid, 'left')).toEqual({ row: 1, col: 4 });
  });

  it('turns a merged span with it: 2 rows of 1 become 1 row of 2', () => {
    const r = turnRect({ row: 1, col: 1, rows: 2, cols: 1 }, grid, 'right');
    expect(r).toEqual({ row: 1, col: 3, rows: 1, cols: 2 });
    expect(turnRect({ row: 1, col: 1, rows: 2, cols: 1 }, grid, 'left')).toEqual({
      row: 2,
      col: 1,
      rows: 1,
      cols: 2,
    });
  });

  it('comes back where it started after turning right and then left', () => {
    for (const cell of cellsOf(upright(2, 4))) {
      const there = turnCell(cell, grid, 'right');
      expect(turnCell(there, { columns: 4, rows: 2 }, 'left')).toEqual({
        row: cell.row,
        col: cell.col,
      });
    }
  });
});

describe('Keep the codes', () => {
  it('moves each compartment with the unit and changes nothing else', () => {
    const list = made(upright(2, 4));
    const out = turnCompartments(list, upright(2, 4), 'right', false, patterns);
    expect(out.orientation).toBe('side');
    expect(out.grid).toEqual({ columns: 4, rows: 2 });
    expect(coverageProblem(out.compartments, out.grid)).toBeNull();
    const a = by(out.compartments, 'A');
    expect(where(a)).toBe('1,4');
    expect(a).toMatchObject({ n: 1, name: 'Cube 1', codes: ['KX01-F0101'] });
    expect(by(out.compartments, 'G')).toMatchObject({ row: 1, col: 1, n: 7, name: 'Cube 7' });
  });
});

describe('Renumber', () => {
  it('numbers, names and codes each compartment by where it now stands', () => {
    const list = made(upright(2, 4));
    const out = turnCompartments(list, upright(2, 4), 'right', true, patterns);
    const seen = out.compartments
      .slice()
      .sort((x, y) => x.n - y.n)
      .map((c) => `${c.n} ${c.id} ${c.name} ${c.codes.join('+')}`);
    // On its side, the top to the right: G E C A on the top row, H F D B below.
    expect(seen).toEqual([
      '1 G Cube 1 KX01-F0101',
      '2 E Cube 2 KX01-F0201',
      '3 C Cube 3 KX01-F0301',
      '4 A Cube 4 KX01-F0401',
      // The old codes of the rows that are gone resolve to the compartment now at their number.
      '5 H Cube 5 KX01-F0102+KX01-F0103',
      '6 F Cube 6 KX01-F0202+KX01-F0203',
      '7 D Cube 7 KX01-F0104+KX01-F0302',
      '8 B Cube 8 KX01-F0204+KX01-F0402',
    ]);
    // Every old code still resolves, each to one compartment.
    const held = codesHeld(out.compartments);
    for (const c of list) for (const code of c.codes) expect(held.has(code)).toBe(true);
    // Short IDs, the printed QR, stay with their compartment.
    expect(by(out.compartments, 'A').shortIds).toEqual([{ code: 'SID00A', primary: true }]);
  });

  it('with {n} codes, gives each number its code back: the old code is the new one', () => {
    const layout = upright(2, 4);
    const list = made(layout, 'KX-{n}');
    const out = turnCompartments(list, layout, 'left', true, { ...patterns, code: 'KX-{n}' });
    for (const c of out.compartments) expect(c.codes).toEqual([`KX-${c.n}`]);
    expect(by(out.compartments, 'B')).toMatchObject({ row: 1, col: 1, n: 1, name: 'Cube 1' });
  });

  it('keeps a code typed by hand, and a name someone changed, on its compartment', () => {
    const list = made(upright(2, 4));
    const c = by(list, 'C');
    c.codes = ['BLUE-BIN', ...c.codes];
    c.name = 'Cables';
    const out = turnCompartments(list, upright(2, 4), 'right', true, patterns);
    const now = by(out.compartments, 'C');
    expect(now.codes).toContain('BLUE-BIN');
    expect(now.name).toBe('Cables');
    expect(now.n).toBe(3);
  });

  it('without a code pattern, renumbers and renames only', () => {
    const list = made(upright(1, 4), null);
    list[0]?.codes.push('SPARE');
    const out = turnCompartments(list, upright(1, 4), 'right', true, { ...patterns, code: null });
    expect(by(out.compartments, 'A')).toMatchObject({ n: 4, name: 'Cube 4', codes: ['SPARE'] });
  });

  it('turns a merged compartment, its span and its parts', () => {
    const layout = upright(2, 4);
    const merged = mergeCompartments(made(layout), ['A', 'C']);
    const list = made(layout).filter((c) => c.id !== 'A' && c.id !== 'C');
    list.push(merged.survivor);
    const out = turnCompartments(list, layout, 'right', true, patterns);
    expect(coverageProblem(out.compartments, out.grid)).toBeNull();
    const a = by(out.compartments, 'A');
    // A over C upright: C A on the top row on its side, A keeps its top left (row 1, col 3).
    expect(a).toMatchObject({ row: 1, col: 3, rows: 1, cols: 2, n: 3 });
    expect(a.parts).toHaveLength(1);
    expect(a.parts[0]).toMatchObject({ placeId: 'C', row: 1, col: 4, n: 4 });
  });
});

describe('merging', () => {
  const layout = upright(4, 4);

  it('needs two or more of its compartments that fill a rectangle', () => {
    const list = made(layout);
    expect(mergeProblem(list, ['A'])).toBe('fewer');
    expect(mergeProblem(list, ['A', 'A'])).toBe('fewer');
    expect(mergeProblem(list, ['A', 'Z'])).toBe('unknown');
    expect(mergeProblem(list, ['A', 'C'])).toBe('not_rectangle');
    expect(mergeProblem(list, ['A', 'F'])).toBe('not_rectangle');
    expect(mergeProblem(list, ['A', 'B', 'E'])).toBe('not_rectangle');
    expect(mergeProblem(list, ['A', 'B'])).toBeNull();
    expect(mergeProblem(list, ['A', 'B', 'E', 'F'])).toBeNull();
    expect(mergeProblem(list, ['B', 'F'])).toBeNull();
  });

  it('keeps the top left compartment, its number, name and codes; the others become its parts', () => {
    const { survivor, absorbed } = mergeCompartments(made(layout), ['F', 'B', 'E', 'A']);
    expect(absorbed.map((c) => c.id).sort()).toEqual(['B', 'E', 'F']);
    expect(survivor).toMatchObject({
      id: 'A',
      row: 1,
      col: 1,
      rows: 2,
      cols: 2,
      n: 1,
      name: 'Cube 1',
      codes: ['KX01-F0101'],
    });
    expect(survivor.parts.map((p) => `${p.placeId}@${p.row},${p.col} ${p.codes}`)).toEqual([
      'B@1,2 KX01-F0201',
      'E@2,1 KX01-F0102',
      'F@2,2 KX01-F0202',
    ]);
    expect(survivor.parts[0]?.shortIds).toEqual([{ code: 'SID00B', primary: true }]);
    // The codes of the cells that went still resolve: all four are on A.
    expect([...codesHeld([survivor]).keys()].sort()).toEqual([
      'KX01-F0101',
      'KX01-F0102',
      'KX01-F0201',
      'KX01-F0202',
    ]);
  });

  it('merges a merged compartment again, keeping every part', () => {
    const first = mergeCompartments(made(layout), ['A', 'B']).survivor;
    const rest = made(layout).filter((c) => c.id !== 'A' && c.id !== 'B');
    const second = mergeCompartments([first, ...rest], ['A', 'E', 'F']);
    expect(second.survivor).toMatchObject({ rows: 2, cols: 2 });
    expect(second.survivor.parts.map((p) => p.placeId)).toEqual(['B', 'E', 'F']);
  });

  it('says when the grid overlaps', () => {
    const list = made(layout);
    const { survivor } = mergeCompartments(list, ['A', 'B']);
    expect(
      coverageProblem([...list.filter((c) => c.id !== 'A'), survivor], { columns: 4, rows: 4 }),
    ).toBe('overlap');
  });
});

describe('splitting', () => {
  it('gives each cell back with the part recorded there, numbered as it stands', () => {
    const layout = upright(4, 4);
    const { survivor } = mergeCompartments(made(layout), ['A', 'B', 'E', 'F']);
    const { survivor: kept, pieces } = splitCompartment(survivor, { columns: 4, rows: 4 });
    expect(kept).toMatchObject({ id: 'A', rows: 1, cols: 1, parts: [], codes: ['KX01-F0101'] });
    expect(pieces.map((p) => `${p.n}@${p.row},${p.col} ${p.part?.placeId}`)).toEqual([
      '2@1,2 B',
      '5@2,1 E',
      '6@2,2 F',
    ]);
  });

  it('names a cell nobody recorded, with the code its position gives', () => {
    const lone: Compartment = {
      id: 'X',
      name: 'Cube 1',
      row: 1,
      col: 1,
      rows: 1,
      cols: 2,
      n: 1,
      codes: [],
      shortIds: [],
      parts: [],
    };
    const { pieces } = splitCompartment(lone, { columns: 2, rows: 1 });
    expect(pieces).toEqual([{ row: 1, col: 2, n: 2, part: null }]);
    expect(positionCode(patterns, { n: 2, row: 1, col: 2 })).toBe('KX01-F0201');
    expect(positionCode({ ...patterns, parent: null }, { n: 2, row: 1, col: 2 })).toBeNull();
  });
});

describe('the stored cell', () => {
  it('reads back what it writes, and a 1.14.1 cell counts from its position', () => {
    const { survivor } = mergeCompartments(made(upright(2, 2)), ['A', 'B']);
    const stored = storedCellOf(survivor);
    expect(stored).toMatchObject({ row: 1, col: 1, cols: 2, n: 1 });
    expect(stored.rows).toBeUndefined();
    expect(parseCell(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
    const old = parseCell({ row: 2, col: 1 });
    expect(old).toEqual({ row: 2, col: 1 });
    const c = compartmentOf(
      { id: 'C', name: 'Cube 3', cell: old as NonNullable<typeof old> },
      { columns: 2, rows: 2 },
      ['K-3'],
      [],
    );
    expect(c).toMatchObject({ n: 3, rows: 1, cols: 1, codes: ['K-3'] });
    expect(parseCell({ row: 0, col: 1 })).toBeNull();
    expect(parseCell('nope')).toBeNull();
  });

  it('takes a part’s codes out of its merged compartment’s own', () => {
    const { survivor } = mergeCompartments(made(upright(2, 2)), ['A', 'B']);
    const c = compartmentOf(
      { id: 'A', name: 'Cube 1', cell: storedCellOf(survivor) },
      { columns: 2, rows: 2 },
      ['KX01-F0101', 'KX01-F0201'],
      [
        { code: 'SID00A', primary: true },
        { code: 'SID00B', primary: false },
      ],
    );
    expect(c.codes).toEqual(['KX01-F0101']);
    expect(c.shortIds).toEqual([{ code: 'SID00A', primary: true }]);
    expect(c.parts[0]?.codes).toEqual(['KX01-F0201']);
  });
});
