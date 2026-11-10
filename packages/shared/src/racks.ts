/**
 * Racks measured in rack units (#373): a 19-inch or 10-inch rack is furniture whose height is a
 * count of units (U, 44.45 mm each), and gear is a thing that takes some units at a position.
 * Pure rules; the server checks a position with them (apps/server/src/templates/racks.ts) and the
 * web draws the rack's elevation with them.
 *
 * - **A rack** is a place made from a rack template: `places.layout` is `{kind: 'rack', units,
 *   width, numbering, mount}`. Its units are 1 to 60. It has no compartment places: what sits in
 *   which unit is on the gear.
 * - **Gear** is a thing directly in the rack. Its height (`things.rack_units`) is 0 to 60 units in
 *   half-unit steps; 0 is gear beside the rails (a power strip, a cable manager), which never
 *   takes a unit. Its position (`things.rack_at`) is the lowest unit it takes, counted from the
 *   bottom whatever the rack's numbering (so changing the numbering never moves gear), in half
 *   units, which face it is mounted on (front or rear), and whether it is full depth (it takes
 *   both faces) or half.
 * - **Two pieces clash** when they share a half unit on a face; a full-depth piece is on both
 *   faces. A position that clashes, or goes past the top of the rack, is refused.
 * - **A position counts only while the thing is in that rack** (`rack_at.rackId` is its place):
 *   moved out, or into another rack, by any path, it has none.
 * - **Shown in the rack's numbering**: U1 at the bottom (the usual way), or at the top.
 */

export const RACK_WIDTHS = [19, 10] as const;
export type RackWidth = (typeof RACK_WIDTHS)[number];

export const RACK_NUMBERINGS = ['bottom', 'top'] as const;
export type RackNumbering = (typeof RACK_NUMBERINGS)[number];

export const RACK_MOUNTS = ['floor', 'wall'] as const;
export type RackMount = (typeof RACK_MOUNTS)[number];

export const RACK_FACES = ['front', 'rear'] as const;
export type RackFace = (typeof RACK_FACES)[number];

/** A rack's units, and the most a piece of gear takes. */
export const RACK_LIMITS = Object.freeze({ units: 60, gear: 60 });

/** One rack unit in millimetres (EIA-310: 1.75 in). */
export const RACK_UNIT_MM = 44.45;

/** A rack as `places.layout` stores it. */
export type RackLayout = {
  kind: 'rack';
  units: number;
  width: RackWidth;
  numbering: RackNumbering;
  mount: RackMount;
};

/** Where a piece of gear is mounted: its lowest unit counted from the bottom (1, 1.5, 2 …), its
 * face, and whether it is full depth. */
export type RackPosition = { u: number; face: RackFace; full: boolean };

/** `things.rack_at` as stored: the position, and the rack it was given in. */
export type StoredRackPosition = RackPosition & { rackId: string };

/** A piece of gear as these rules see it: its height in units (null: not given, taken as 1) and
 * its position, if it has one. */
export type Gear = { id: string; units: number | null; at: RackPosition | null };

const isWhole = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** Whether `v` is a number of half units: 0, 0.5, 1, 1.5 … */
export const isHalfStep = (v: number): boolean => Number.isFinite(v) && Number.isInteger(v * 2);

/** Why a rack's unit count can't be used, or null. */
export function rackUnitsProblem(units: number): string | null {
  return isWhole(units, 1, RACK_LIMITS.units)
    ? null
    : `A rack is 1 to ${RACK_LIMITS.units} units high.`;
}

/** A stored layout read back as a rack, or null when it isn't one. */
export function parseRack(raw: unknown): RackLayout | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.kind !== 'rack' || !isWhole(r.units, 1, RACK_LIMITS.units)) return null;
  return {
    kind: 'rack',
    units: r.units,
    width: r.width === 10 ? 10 : 19,
    numbering: r.numbering === 'top' ? 'top' : 'bottom',
    mount: r.mount === 'wall' ? 'wall' : 'floor',
  };
}

/** A stored position read back, or null when it doesn't read as one. */
export function parseRackPosition(raw: unknown): StoredRackPosition | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.rackId !== 'string' || typeof r.u !== 'number') return null;
  if (!isHalfStep(r.u) || r.u < 1 || r.u > RACK_LIMITS.units) return null;
  if (r.face !== 'front' && r.face !== 'rear') return null;
  return { rackId: r.rackId, u: r.u, face: r.face, full: r.full !== false };
}

/** The height a piece of gear is counted at: its own, else 1 unit. */
export const unitsOf = (g: Pick<Gear, 'units'>): number => g.units ?? 1;

/** The half units a position takes, as half-unit indexes from the bottom (0 is the lower half of
 * U1), from the first to the last. Empty for 0U gear. */
export function halvesOf(u: number, units: number): number[] {
  const first = Math.round((u - 1) * 2);
  const out: number[] = [];
  for (let h = first; h < first + Math.round(units * 2); h++) out.push(h);
  return out;
}

const facesOf = (at: RackPosition): RackFace[] => (at.full ? ['front', 'rear'] : [at.face]);

export type RackProblem =
  /** Not in half units: 1, 1.5, 2 … */
  | { reason: 'half' }
  /** Below U1 or past the top: the rack ends at its last unit. */
  | { reason: 'outside'; top: number }
  /** 0U gear sits beside the rails and has no unit. */
  | { reason: 'zero' }
  /** Taken by another piece, on that face. */
  | { reason: 'taken'; by: string; face: RackFace; u: number };

/**
 * What's wrong with putting `gear` at its position in `rack` beside the `others` (their own
 * positions; `gear` itself among them is skipped), or null when it fits. `gear.at` null is always
 * fine: it takes no unit.
 */
export function rackProblem(
  rack: Pick<RackLayout, 'units'>,
  gear: Gear,
  others: readonly Gear[],
): RackProblem | null {
  const at = gear.at;
  if (!at) return null;
  const units = unitsOf(gear);
  if (!isHalfStep(at.u) || !isHalfStep(units)) return { reason: 'half' };
  if (units === 0) return { reason: 'zero' };
  if (at.u < 1 || at.u + units > rack.units + 1) {
    return { reason: 'outside', top: rack.units };
  }
  const mine = new Set(halvesOf(at.u, units));
  const myFaces = facesOf(at);
  // Lowest clash first, so the sentence names the unit a person sees first from the bottom.
  let found: Extract<RackProblem, { reason: 'taken' }> | null = null;
  for (const o of others) {
    if (o.id === gear.id || !o.at || unitsOf(o) === 0) continue;
    const face = facesOf(o.at).find((f) => myFaces.includes(f));
    if (!face) continue;
    const shared = halvesOf(o.at.u, unitsOf(o)).filter((h) => mine.has(h));
    if (shared.length === 0) continue;
    const u = 1 + Math.floor(Math.min(...shared) / 2);
    if (!found || u < found.u) found = { reason: 'taken', by: o.id, face, u };
  }
  return found;
}

/** The lowest position counted from the bottom where `units` fit on `face` (both faces when
 * `full`), in whole units, or null when nowhere does. */
export function firstFree(
  rack: Pick<RackLayout, 'units'>,
  others: readonly Gear[],
  units: number,
  face: RackFace,
  full: boolean,
): number | null {
  const need = Math.max(units, 0.5);
  for (let u = 1; u + need <= rack.units + 1; u++) {
    const gear: Gear = { id: '\u0000', units: need, at: { u, face, full } };
    if (!rackProblem(rack, gear, others)) return u;
  }
  return null;
}

/** A unit as the rack's numbering shows it: U1 at the bottom, or at the top. `u` counted from
 * the bottom. */
export function shownUnit(rack: Pick<RackLayout, 'units' | 'numbering'>, u: number): number {
  return rack.numbering === 'top' ? rack.units - u + 1 : u;
}

/**
 * The units a position covers as the rack shows them, lowest number first: `{from, to}`, equal
 * for a piece one unit high. Half units show where they start: a 1U piece at 12.5 covers U12.5 to
 * U13.
 */
export function shownRange(
  rack: Pick<RackLayout, 'units' | 'numbering'>,
  u: number,
  units: number,
): { from: number; to: number } {
  const halves = halvesOf(u, Math.max(units, 0.5));
  const low = 1 + (halves[0] as number) / 2;
  const high = 1 + Math.floor((halves.at(-1) as number) / 2);
  if (rack.numbering === 'bottom') return { from: low, to: high };
  // From the top, the highest unit has the lowest number; a half start rounds to its unit.
  return { from: shownUnit(rack, high), to: shownUnit(rack, Math.floor(low)) };
}

/**
 * Where a position starts as the rack numbers its units (#499): the lowest number it covers, half
 * units exact, so a person reads it off the rack. From the bottom that is `u` itself; from the top
 * it is the unit at the piece's top edge, so 1U from 3.5 in a 12U rack starts at U9.5. `units`
 * is the piece's height (`unitsOf`). `startFromShown` takes it back.
 */
export function shownStart(
  rack: Pick<RackLayout, 'units' | 'numbering'>,
  u: number,
  units: number,
): number {
  return rack.numbering === 'top' ? rack.units - u - units + 2 : u;
}

/** A start in the rack's numbering (`shownStart`) as stored: counted from the bottom. */
export function startFromShown(
  rack: Pick<RackLayout, 'units' | 'numbering'>,
  shown: number,
  units: number,
): number {
  return rack.numbering === 'top' ? rack.units - shown - units + 2 : shown;
}

/** One row of a rack's elevation from one face, top to bottom: a piece of gear, or a run of free
 * whole units (`from` and `to` counted from the bottom, `to` the higher). */
export type ElevationRow =
  | { kind: 'gear'; id: string; u: number; units: number }
  | { kind: 'empty'; from: number; to: number };

/**
 * The rack as seen from `face`, top to bottom: each piece mounted on that face (or full depth)
 * once, at its top, and the free units between them in runs, so a 42U rack with six pieces is a
 * handful of rows. A unit half taken counts as taken.
 */
export function elevationOf(
  rack: Pick<RackLayout, 'units'>,
  gear: readonly Gear[],
  face: RackFace,
): ElevationRow[] {
  const seen = gear.filter(
    (g): g is Gear & { at: RackPosition } =>
      g.at !== null && unitsOf(g) > 0 && facesOf(g.at).includes(face),
  );
  const taken = new Set<number>();
  for (const g of seen) {
    for (const h of halvesOf(g.at.u, unitsOf(g))) taken.add(1 + Math.floor(h / 2));
  }
  const rows: ElevationRow[] = [];
  const startsAt = new Map<number, (Gear & { at: RackPosition })[]>();
  for (const g of seen) {
    const top = 1 + Math.floor((halvesOf(g.at.u, unitsOf(g)).at(-1) as number) / 2);
    startsAt.set(top, [...(startsAt.get(top) ?? []), g]);
  }
  let run: { from: number; to: number } | null = null;
  for (let u = rack.units; u >= 1; u--) {
    if (!taken.has(u)) {
      run = run ? { from: u, to: run.to } : { from: u, to: u };
      continue;
    }
    if (run) {
      rows.push({ kind: 'empty', ...run });
      run = null;
    }
    for (const g of (startsAt.get(u) ?? []).sort((a, b) => b.at.u - a.at.u)) {
      rows.push({ kind: 'gear', id: g.id, u: g.at.u, units: unitsOf(g) });
    }
  }
  if (run) rows.push({ kind: 'empty', ...run });
  return rows;
}

// ---------------------------------------------------------------------------------------------
// Built-in rack templates
// ---------------------------------------------------------------------------------------------

export type BuiltinRackTemplate = {
  key: string;
  layout: RackLayout;
};

const rack = (key: string, units: number, width: RackWidth, mount: RackMount) => ({
  key,
  layout: { kind: 'rack' as const, units, width, numbering: 'bottom' as const, mount },
});

/** A 19-inch rack of 42U and of 24U on the floor, 12U and 6U on a wall, and a 10-inch 8U. */
export const BUILTIN_RACK_TEMPLATES: readonly BuiltinRackTemplate[] = [
  rack('rack_19_42', 42, 19, 'floor'),
  rack('rack_19_24', 24, 19, 'floor'),
  rack('rack_19_wall_12', 12, 19, 'wall'),
  rack('rack_19_wall_6', 6, 19, 'wall'),
  rack('rack_10_8', 8, 10, 'floor'),
];

export const BUILTIN_RACK_TEMPLATE_KEYS = BUILTIN_RACK_TEMPLATES.map((b) => b.key) as [
  string,
  ...string[],
];

export const builtinRackTemplate = (key: string): BuiltinRackTemplate | undefined =>
  BUILTIN_RACK_TEMPLATES.find((b) => b.key === key);
