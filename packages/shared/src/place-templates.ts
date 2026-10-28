/**
 * Place templates (#238): storage furniture made in one step, with a place for each of its
 * compartments. A template gives the size; the person picks how the unit stands.
 *
 * - **Layouts.** A grid of cubes (`across` × `up` as the unit stands upright: a cube shelf 2 × 4 is
 *   2 across and 4 up), a column of levels (a bookcase's shelves) or a stack of drawers.
 * - **Orientation** belongs to the place, not the template: a grid that isn't square can stand
 *   upright or lie on its side, which swaps its columns and rows. Levels and drawers stand
 *   upright only.
 * - **Counting order** is fixed on the grid as it stands: top left to bottom right, row by row.
 *   Compartment 1 is the top left; row 1 is the top row, column 1 the leftmost.
 * - **Patterns.** A compartment's name and its own code come from patterns with `{n}` (its
 *   number), `{row}` and `{col}`, each optionally zero-padded (`{col:02}`); a code pattern may
 *   also use `{parent}`, the furniture's own code: `{parent}-F{col:02}{row:02}` gives
 *   `KX01-F0101` … `KX01-F0404` on a 4 × 4.
 *
 * The server builds the places (apps/server/src/templates/place-templates.ts); the web shows the
 * same numbering before anything is saved.
 */

export const PLACE_LAYOUT_KINDS = ['grid', 'levels', 'drawers'] as const;
export type PlaceLayoutKind = (typeof PLACE_LAYOUT_KINDS)[number];

export type PlaceLayout =
  | { kind: 'grid'; across: number; up: number }
  | { kind: 'levels'; count: number }
  | { kind: 'drawers'; count: number };

export const PLACE_ORIENTATIONS = ['upright', 'side'] as const;
export type PlaceOrientation = (typeof PLACE_ORIENTATIONS)[number];

/** The largest units a template makes: a side of a grid, a count of levels or drawers, and
 * compartments in all. */
export const PLACE_LAYOUT_LIMITS = { side: 12, count: 40, cells: 100 } as const;

/** What a furniture place stores about itself (`places.layout`): its template's size and how it
 * stands. */
export type FurnitureLayout = PlaceLayout & { orientation: PlaceOrientation };

/** Where a compartment sits on the grid as it stands (`places.cell`), 1-based. */
export type PlaceCell = { row: number; col: number };

/** One compartment as it stands: its number in counting order, its row and its column. */
export type CompartmentCell = PlaceCell & { n: number };

const whole = (v: number, max: number) => Number.isInteger(v) && v >= 1 && v <= max;

/** Why a layout can't be built, in plain words, or null. */
export function layoutProblem(layout: PlaceLayout): string | null {
  if (layout.kind === 'grid') {
    const { side, cells } = PLACE_LAYOUT_LIMITS;
    if (!whole(layout.across, side) || !whole(layout.up, side)) {
      return `A grid is 1 to ${side} across and 1 to ${side} up.`;
    }
    if (layout.across * layout.up > cells) return `A grid has at most ${cells} compartments.`;
    return null;
  }
  const { count } = PLACE_LAYOUT_LIMITS;
  if (!whole(layout.count, count)) return `Choose 1 to ${count}.`;
  return null;
}

/** Whether the unit can lie on its side: a grid that isn't square. */
export const canTurn = (layout: PlaceLayout): boolean =>
  layout.kind === 'grid' && layout.across !== layout.up;

/** The grid as it stands: how many columns and rows. On its side, a grid's across and up swap;
 * levels and drawers are one column. */
export function asItStands(
  layout: PlaceLayout,
  orientation: PlaceOrientation = 'upright',
): { columns: number; rows: number } {
  if (layout.kind !== 'grid') return { columns: 1, rows: layout.count };
  return orientation === 'side'
    ? { columns: layout.up, rows: layout.across }
    : { columns: layout.across, rows: layout.up };
}

/** How many compartments the layout has. */
export function cellCount(layout: PlaceLayout): number {
  return layout.kind === 'grid' ? layout.across * layout.up : layout.count;
}

/** Every compartment in counting order: top left to bottom right, row by row. */
export function cellsOf(
  layout: PlaceLayout,
  orientation: PlaceOrientation = 'upright',
): CompartmentCell[] {
  const { columns, rows } = asItStands(layout, orientation);
  const out: CompartmentCell[] = [];
  for (let row = 1; row <= rows; row++) {
    for (let col = 1; col <= columns; col++) {
      out.push({ n: (row - 1) * columns + col, row, col });
    }
  }
  return out;
}

/** A compartment's number from where it sits on a grid of `columns`. */
export const numberAt = (cell: PlaceCell, columns: number): number =>
  (cell.row - 1) * columns + cell.col;

// ---------------------------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------------------------

/** The placeholders a pattern may use; `parent` only in a code pattern. */
export const PATTERN_TOKENS = ['parent', 'n', 'row', 'col'] as const;
export type PatternToken = (typeof PATTERN_TOKENS)[number];

export type PatternValues = { n: number; row: number; col: number; parent?: string | null };

/** The longest pattern a template stores. */
export const PATTERN_MAX = 100;

const TOKEN = /\{([a-z]+)(?::(0[1-6]))?\}/g;

export type PatternProblem =
  | { reason: 'unknown'; token: string }
  | { reason: 'braces' }
  | { reason: 'parent' }
  | { reason: 'empty' }
  | { reason: 'indistinct' };

/**
 * What's wrong with a pattern, or null. A name pattern can't use `{parent}`; a pattern must use
 * at least `{n}` or both `{row}` and `{col}` to tell the compartments apart (`distinct`).
 */
export function patternProblem(
  pattern: string,
  opts: { code: boolean; distinct?: boolean },
): PatternProblem | null {
  if (pattern.trim() === '') return { reason: 'empty' };
  const used = new Set<string>();
  for (const m of pattern.matchAll(TOKEN)) {
    const name = m[1] as string;
    if (!(PATTERN_TOKENS as readonly string[]).includes(name)) {
      return { reason: 'unknown', token: name };
    }
    if (name === 'parent' && !opts.code) return { reason: 'parent' };
    used.add(name);
  }
  if (/[{}]/.test(pattern.replace(TOKEN, ''))) return { reason: 'braces' };
  if (opts.distinct && !used.has('n') && !(used.has('row') && used.has('col'))) {
    return { reason: 'indistinct' };
  }
  return null;
}

/** Whether the pattern uses `{parent}`. */
export const usesParent = (pattern: string): boolean =>
  [...pattern.matchAll(TOKEN)].some((m) => m[1] === 'parent');

/** The pattern with each placeholder filled in (pads are digits: `{col:02}` → `03`). A pattern
 * with a problem is filled as far as it can be; check it first. */
export function fillPattern(pattern: string, v: PatternValues): string {
  return pattern.replace(TOKEN, (whole, name: string, pad?: string) => {
    const raw =
      name === 'parent'
        ? (v.parent ?? '')
        : name === 'n'
          ? v.n
          : name === 'row'
            ? v.row
            : name === 'col'
              ? v.col
              : null;
    if (raw === null) return whole;
    const s = String(raw);
    return pad && name !== 'parent' ? s.padStart(Number(pad), '0') : s;
  });
}

// ---------------------------------------------------------------------------------------------
// Built-in templates
// ---------------------------------------------------------------------------------------------

/** The built-in place kinds a template's furniture and compartments use (BUILTIN_PLACE_KINDS). */
export const FURNITURE_KIND = 'furniture';

export type BuiltinPlaceTemplate = {
  key: string;
  layout: PlaceLayout;
  /** The furniture's kind and its compartments'. */
  kindKey: string;
  compartmentKindKey: string;
  /** The count can be changed when the place is made (levels and drawers). */
  adjustable: boolean;
};

const cubes = (across: number, up: number): BuiltinPlaceTemplate => ({
  key: `cube_${across}x${up}`,
  layout: { kind: 'grid', across, up },
  kindKey: FURNITURE_KIND,
  compartmentKindKey: 'cube',
  adjustable: false,
});

/** Cube shelves 1 × 4, 2 × 2, 2 × 4, 4 × 4 and 2 × 8 (across × up, upright), a bookcase with 6
 * levels, a chest with 9 drawers and a shelving unit with 4 levels. */
export const BUILTIN_PLACE_TEMPLATES: readonly BuiltinPlaceTemplate[] = [
  cubes(1, 4),
  cubes(2, 2),
  cubes(2, 4),
  cubes(4, 4),
  cubes(2, 8),
  {
    key: 'bookcase',
    layout: { kind: 'levels', count: 6 },
    kindKey: FURNITURE_KIND,
    compartmentKindKey: 'shelf',
    adjustable: true,
  },
  {
    key: 'chest',
    layout: { kind: 'drawers', count: 9 },
    kindKey: FURNITURE_KIND,
    compartmentKindKey: 'drawer',
    adjustable: true,
  },
  {
    key: 'shelving',
    layout: { kind: 'levels', count: 4 },
    kindKey: FURNITURE_KIND,
    compartmentKindKey: 'shelf',
    adjustable: true,
  },
];

export const BUILTIN_PLACE_TEMPLATE_KEYS = BUILTIN_PLACE_TEMPLATES.map((b) => b.key) as [
  string,
  ...string[],
];

export const builtinPlaceTemplate = (key: string): BuiltinPlaceTemplate | undefined =>
  BUILTIN_PLACE_TEMPLATES.find((b) => b.key === key);

/** The compartment name a layout gets when nobody gives one (the web sends its own words). */
export const DEFAULT_COMPARTMENT_NAMES: Readonly<Record<PlaceLayoutKind, string>> = {
  grid: 'Cube {n}',
  levels: 'Shelf {n}',
  drawers: 'Drawer {n}',
};

/** The layout with a count changed (levels and drawers); a grid is unchanged. */
export function withCount(layout: PlaceLayout, count: number | undefined): PlaceLayout {
  if (count === undefined || layout.kind === 'grid') return layout;
  return { ...layout, count };
}
