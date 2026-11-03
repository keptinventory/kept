/**
 * Compartments of furniture made from a place template (#238, 1.14.4): turning the unit, and
 * merging and splitting its compartments. Pure rules; the server applies them to the places
 * (apps/server/src/templates/furniture.ts) and the web's demo does the same in memory.
 *
 * - **The grid as it stands** (place-templates.ts): `columns` × `rows`, counted top left to
 *   bottom right, row by row. A compartment covers a rectangle of it: its top left cell, and
 *   `rows` × `cols` cells (1 × 1 unless merged). Every cell of the grid belongs to exactly one
 *   compartment: as its top left cell, or as one of the `parts` a merge took in.
 * - **Its number** `n` is the one its name and label carry. A new compartment's is its counting
 *   position; it changes only when someone renumbers. Stored compartments from before 1.14.4
 *   have none: their counting position is their number.
 * - **Turning** (only a grid that isn't square, upright ↔ on its side) moves every compartment
 *   with the unit, the top going to the right (clockwise as you face it) or to the left. Its
 *   things, labels and short IDs stay with it. Then either:
 *   - **Keep the codes**: names, numbers and codes stay as they are; only where each sits changes.
 *   - **Renumber**: each compartment takes the number of where it now stands, its name follows
 *     when it still is its pattern's, and with a code pattern each gets the code of its new
 *     position. An old position code (one the pattern gave) keeps working: it resolves to the
 *     compartment now in the position it named, the one the new numbering gives it to, or else the
 *     one now at its number. Codes typed by hand stay on their compartment.
 * - **Merging** adjacent compartments that make a rectangle: the one at its top left (the lowest
 *   position) keeps its number, name and codes; each other one becomes a part of it, and its own
 *   codes and short IDs move to it, so its labels open the merged compartment.
 * - **Splitting** a merged compartment gives each of its cells back, with the codes it brought.
 */
import {
  asItStands,
  type FurnitureLayout,
  fillPattern,
  numberAt,
  type PlaceCell,
  type PlaceOrientation,
  usesParent,
} from './place-templates.js';

/** Which way a unit turned, as you face it: its top to the right (clockwise) or to the left. */
export const TURN_DIRECTIONS = ['right', 'left'] as const;
export type TurnDirection = (typeof TURN_DIRECTIONS)[number];

/** A short ID a compartment holds, and whether it is its own primary one. */
export type ShortIdHold = { code: string; primary: boolean };

/** A cell a merged compartment took in: where it sits, the place it was (now in the trash),
 * its number and name then, and the own codes and short IDs it brought. */
export type CompartmentPart = PlaceCell & {
  n: number;
  placeId: string;
  name: string;
  codes: string[];
  shortIds: ShortIdHold[];
};

/** `places.cell` as stored: the top left cell, the span when merged, its number, its parts. */
export type StoredCell = PlaceCell & {
  rows?: number;
  cols?: number;
  n?: number;
  parts?: CompartmentPart[];
};

/** A compartment as these rules see it. `codes` and `shortIds` are those of its own top left
 * cell: a part's are in the part. */
export type Compartment = PlaceCell & {
  id: string;
  name: string;
  rows: number;
  cols: number;
  n: number;
  codes: string[];
  shortIds: ShortIdHold[];
  parts: CompartmentPart[];
};

export type Grid = { columns: number; rows: number };

const whole = (v: unknown, min = 1): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= 10_000;

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

const holds = (v: unknown): ShortIdHold[] =>
  Array.isArray(v)
    ? v.flatMap((x) =>
        x && typeof x === 'object' && typeof (x as ShortIdHold).code === 'string'
          ? [{ code: (x as ShortIdHold).code, primary: (x as ShortIdHold).primary === true }]
          : [],
      )
    : [];

/** A stored cell read back, or null when it doesn't read as one. */
export function parseCell(raw: unknown): StoredCell | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  if (!whole(c.row) || !whole(c.col)) return null;
  const out: StoredCell = { row: c.row, col: c.col };
  if (c.rows !== undefined && whole(c.rows)) out.rows = c.rows;
  if (c.cols !== undefined && whole(c.cols)) out.cols = c.cols;
  if (c.n !== undefined && whole(c.n)) out.n = c.n;
  if (Array.isArray(c.parts)) {
    out.parts = c.parts.flatMap((p) => {
      if (!p || typeof p !== 'object') return [];
      const q = p as Record<string, unknown>;
      if (!whole(q.row) || !whole(q.col) || !whole(q.n) || typeof q.placeId !== 'string') return [];
      return [
        {
          row: q.row,
          col: q.col,
          n: q.n,
          placeId: q.placeId,
          name: typeof q.name === 'string' ? q.name : '',
          codes: strings(q.codes),
          shortIds: holds(q.shortIds),
        },
      ];
    });
  }
  return out;
}

/** A compartment's cell as stored: no span or parts when it has none. */
export function storedCellOf(c: Compartment): StoredCell {
  return {
    row: c.row,
    col: c.col,
    ...(c.rows > 1 ? { rows: c.rows } : {}),
    ...(c.cols > 1 ? { cols: c.cols } : {}),
    n: c.n,
    ...(c.parts.length > 0 ? { parts: [...c.parts].sort((a, b) => a.n - b.n) } : {}),
  };
}

/** The grid as the furniture stands now. */
export const gridOf = (layout: FurnitureLayout): Grid => asItStands(layout, layout.orientation);

/** A compartment from its stored cell, with its own codes and short IDs (all those of the place:
 * its parts' are taken out here). */
export function compartmentOf(
  place: { id: string; name: string; cell: StoredCell },
  grid: Grid,
  codes: readonly string[],
  shortIds: readonly ShortIdHold[],
): Compartment {
  const parts = place.cell.parts ?? [];
  const partCodes = new Set(parts.flatMap((p) => p.codes));
  const partIds = new Set(parts.flatMap((p) => p.shortIds.map((s) => s.code)));
  return {
    id: place.id,
    name: place.name,
    row: place.cell.row,
    col: place.cell.col,
    rows: place.cell.rows ?? 1,
    cols: place.cell.cols ?? 1,
    n: place.cell.n ?? numberAt(place.cell, grid.columns),
    codes: codes.filter((c) => !partCodes.has(c)).sort(),
    shortIds: shortIds.filter((s) => !partIds.has(s.code)),
    parts,
  };
}

/** Every cell a compartment covers, row by row. */
export function cellsCovered(c: Pick<Compartment, 'row' | 'col' | 'rows' | 'cols'>): PlaceCell[] {
  const out: PlaceCell[] = [];
  for (let r = c.row; r < c.row + c.rows; r++)
    for (let k = c.col; k < c.col + c.cols; k++) out.push({ row: r, col: k });
  return out;
}

const key = (c: PlaceCell) => `${c.row},${c.col}`;

/** Why the compartments don't cover the grid exactly once each (overlap or outside it), or
 * null. Turning and merging need a whole grid. */
export function coverageProblem(list: readonly Compartment[], grid: Grid): string | null {
  const seen = new Set<string>();
  for (const c of list) {
    for (const cell of cellsCovered(c)) {
      if (cell.row > grid.rows || cell.col > grid.columns) return 'outside';
      if (seen.has(key(cell))) return 'overlap';
      seen.add(key(cell));
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Turning
// ---------------------------------------------------------------------------------------------

/** The other way the unit stands. */
export const turnedOrientation = (o: PlaceOrientation): PlaceOrientation =>
  o === 'side' ? 'upright' : 'side';

/** A rectangle on a grid of `grid` turned a quarter, its top to the right or to the left: on
 * the turned grid (rows and columns swapped). */
export function turnRect<T extends PlaceCell & { rows: number; cols: number }>(
  r: T,
  grid: Grid,
  dir: TurnDirection,
): T {
  // Clockwise, (row, col) goes to (col, rows − row + 1); anticlockwise to (cols − col + 1, row).
  const row = dir === 'right' ? r.col : grid.columns - (r.col + r.cols - 1) + 1;
  const col = dir === 'right' ? grid.rows - (r.row + r.rows - 1) + 1 : r.row;
  return { ...r, row, col, rows: r.cols, cols: r.rows };
}

/** A cell turned as turnRect turns a 1 × 1. */
export function turnCell(c: PlaceCell, grid: Grid, dir: TurnDirection): PlaceCell {
  const t = turnRect({ row: c.row, col: c.col, rows: 1, cols: 1 }, grid, dir);
  return { row: t.row, col: t.col };
}

export type Patterns = {
  /** The compartments' name pattern ("Cube {n}"). */
  name: string | null;
  /** Their code pattern, if any. */
  code: string | null;
  /** The furniture's own code, `{parent}`. */
  parent: string | null;
  /** A code as stored (the server's upper case, trimmed, Eastern digits folded). */
  norm?: (code: string) => string;
};

const defaultNorm = (c: string) => c.trim().toUpperCase();

/** A slot: one cell with its own number, name and codes (a compartment's top left, or a part). */
type Slot = { owner: string; part: number | null; row: number; col: number; n: number };

function slotsOf(list: readonly Compartment[]): Slot[] {
  const out: Slot[] = [];
  for (const c of list) {
    out.push({ owner: c.id, part: null, row: c.row, col: c.col, n: c.n });
    c.parts.forEach((p, i) => {
      out.push({ owner: c.id, part: i, row: p.row, col: p.col, n: p.n });
    });
  }
  return out;
}

/** The position code a pattern gives a slot, or null without a pattern (or its parent). */
function patternCode(p: Patterns, v: { n: number; row: number; col: number }): string | null {
  if (!p.code) return null;
  if (usesParent(p.code) && !p.parent) return null;
  const norm = p.norm ?? defaultNorm;
  const code = norm(fillPattern(p.code, { ...v, parent: p.parent }));
  return code.length > 0 ? code : null;
}

/** A name that still is its pattern's for these values gets the new values' name. */
function renamed(
  pattern: string | null,
  name: string,
  was: { n: number; row: number; col: number },
  now: { n: number; row: number; col: number },
): string {
  if (!pattern) return name;
  return fillPattern(pattern, was).trim() === name.trim() ? fillPattern(pattern, now).trim() : name;
}

export type Turned = {
  orientation: PlaceOrientation;
  grid: Grid;
  compartments: Compartment[];
};

/**
 * The compartments after a quarter turn (see the header): each moved with the unit, and with
 * `renumber`, numbered, named and coded by where it now stands.
 */
export function turnCompartments(
  list: readonly Compartment[],
  layout: FurnitureLayout,
  dir: TurnDirection,
  renumber: boolean,
  patterns: Patterns,
): Turned {
  const grid = gridOf(layout);
  const next: Grid = { columns: grid.rows, rows: grid.columns };
  const moved = list.map((c) => {
    const r = turnRect(c, grid, dir);
    // A merged compartment is its top left cell: the part a turn brings there takes the cell its
    // own top left went to instead.
    const own = turnCell(c, grid, dir);
    const parts = c.parts.map((p) => {
      const cell = turnCell(p, grid, dir);
      return { ...p, ...(cell.row === r.row && cell.col === r.col ? own : cell) };
    });
    return { ...c, row: r.row, col: r.col, rows: r.rows, cols: r.cols, parts };
  });
  const orientation = turnedOrientation(layout.orientation);
  if (!renumber) return { orientation, grid: next, compartments: moved };

  // Where each slot was, and is now.
  const before = slotsOf(list);
  const after = slotsOf(moved);
  const nowN = (s: Slot) => numberAt(s, next.columns);
  const at = new Map(after.map((s) => [key(s), s]));
  const slotKey = (s: Slot) => `${s.owner}:${s.part ?? 'top'}`;

  // The new numbering's codes first: each is its position's now.
  const target = new Map<string, string>();
  const newCode = new Map<string, string>();
  for (const s of after) {
    const code = patternCode(patterns, { n: nowN(s), row: s.row, col: s.col });
    if (code && !target.has(code)) {
      target.set(code, slotKey(s));
      newCode.set(slotKey(s), code);
    }
  }
  // Then every old code: a position code goes to the compartment now in its position; one
  // typed by hand stays where it is.
  const codesOf = (c: Compartment, part: number | null) =>
    part === null ? c.codes : (c.parts[part]?.codes ?? []);
  const byId = new Map(list.map((c) => [c.id, c]));
  for (let i = 0; i < before.length; i++) {
    const was = before[i] as Slot;
    const now = after[i] as Slot;
    const owner = byId.get(was.owner) as Compartment;
    const old = patternCode(patterns, { n: was.n, row: was.row, col: was.col });
    for (const code of codesOf(owner, was.part)) {
      if (target.has(code)) continue;
      if (code === old) {
        const cells = next.columns;
        const there = at.get(
          key({ row: Math.ceil(was.n / cells), col: ((was.n - 1) % cells) + 1 }),
        );
        target.set(code, slotKey(there ?? now));
      } else target.set(code, slotKey(now));
    }
  }
  const routed = new Map<string, string[]>();
  for (const [code, slot] of target) routed.set(slot, [...(routed.get(slot) ?? []), code]);
  const sorted = (s: string) => [...(routed.get(s) ?? [])].sort();

  const compartments = moved.map((c) => {
    const old = byId.get(c.id) as Compartment;
    const top = { n: numberAt(c, next.columns), row: c.row, col: c.col };
    return {
      ...c,
      n: top.n,
      name: renamed(patterns.name, c.name, { n: old.n, row: old.row, col: old.col }, top),
      codes: sorted(`${c.id}:top`),
      parts: c.parts.map((p, i) => {
        const was = old.parts[i] as CompartmentPart;
        const v = { n: numberAt(p, next.columns), row: p.row, col: p.col };
        return {
          ...p,
          n: v.n,
          name: renamed(patterns.name, p.name, { n: was.n, row: was.row, col: was.col }, v),
          codes: sorted(`${c.id}:${i}`),
        };
      }),
    };
  });
  return { orientation, grid: next, compartments };
}

/** Every own code the compartments hold, with the place that holds it (a part's is held by its
 * merged compartment). */
export function codesHeld(list: readonly Compartment[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const c of list) {
    for (const code of c.codes) out.set(code, c.id);
    for (const p of c.parts) for (const code of p.codes) out.set(code, c.id);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Merging and splitting
// ---------------------------------------------------------------------------------------------

export type MergeProblem = 'fewer' | 'unknown' | 'not_rectangle';

/** Why these compartments can't be merged, or null: two or more of the furniture's, which
 * together fill a rectangle. */
export function mergeProblem(
  list: readonly Compartment[],
  ids: readonly string[],
): MergeProblem | null {
  const picked = [...new Set(ids)];
  if (picked.length < 2) return 'fewer';
  const chosen = picked.map((id) => list.find((c) => c.id === id));
  if (chosen.some((c) => !c)) return 'unknown';
  const cs = chosen as Compartment[];
  const top = Math.min(...cs.map((c) => c.row));
  const left = Math.min(...cs.map((c) => c.col));
  const bottom = Math.max(...cs.map((c) => c.row + c.rows - 1));
  const right = Math.max(...cs.map((c) => c.col + c.cols - 1));
  const area = cs.reduce((a, c) => a + c.rows * c.cols, 0);
  if (area !== (bottom - top + 1) * (right - left + 1)) return 'not_rectangle';
  const seen = new Set<string>();
  for (const c of cs) for (const cell of cellsCovered(c)) seen.add(key(cell));
  return seen.size === area ? null : 'not_rectangle';
}

export type Merged = { survivor: Compartment; absorbed: Compartment[] };

/** The merge of compartments that pass mergeProblem(): the one at the top left keeps its number,
 * name and codes; the others become its parts, with their codes and short IDs. */
export function mergeCompartments(list: readonly Compartment[], ids: readonly string[]): Merged {
  const cs = [...new Set(ids)].map((id) => list.find((c) => c.id === id) as Compartment);
  const top = Math.min(...cs.map((c) => c.row));
  const left = Math.min(...cs.map((c) => c.col));
  const bottom = Math.max(...cs.map((c) => c.row + c.rows - 1));
  const right = Math.max(...cs.map((c) => c.col + c.cols - 1));
  const keep = cs.find((c) => c.row === top && c.col === left) as Compartment;
  const absorbed = cs.filter((c) => c !== keep);
  const parts: CompartmentPart[] = [
    ...keep.parts,
    ...absorbed.flatMap((c) => [
      {
        row: c.row,
        col: c.col,
        n: c.n,
        placeId: c.id,
        name: c.name,
        codes: [...c.codes],
        shortIds: [...c.shortIds],
      },
      ...c.parts,
    ]),
  ].sort((a, b) => a.row - b.row || a.col - b.col);
  return {
    survivor: {
      ...keep,
      row: top,
      col: left,
      rows: bottom - top + 1,
      cols: right - left + 1,
      parts,
    },
    absorbed,
  };
}

/** One cell a split gives back: where, its number, and the part that was there, if recorded. */
export type SplitPiece = PlaceCell & { n: number; part: CompartmentPart | null };

export type Split = { survivor: Compartment; pieces: SplitPiece[] };

/** A merged compartment split into its cells: it keeps its top left one; every other cell comes
 * back, counted on the grid as it stands, with the part recorded there (null: none was). */
export function splitCompartment(c: Compartment, grid: Grid): Split {
  const pieces: SplitPiece[] = cellsCovered(c)
    .filter((cell) => cell.row !== c.row || cell.col !== c.col)
    .map((cell) => ({
      ...cell,
      n: numberAt(cell, grid.columns),
      part: c.parts.find((p) => p.row === cell.row && p.col === cell.col) ?? null,
    }));
  return { survivor: { ...c, rows: 1, cols: 1, parts: [] }, pieces };
}

/** The code a pattern gives a cell (null without one): what a split piece gets when no part was
 * recorded there. */
export const positionCode = (
  patterns: Patterns,
  v: { n: number; row: number; col: number },
): string | null => patternCode(patterns, v);
