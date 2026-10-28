/**
 * Floor plan to map (D266, D267): a plan's rooms, as the model read them, turned into map rooms.
 *
 * The model only transcribes (extraction.ts `PlanExtraction`): boxes and optional corners as
 * fractions of the image, the labels, the sizes printed (copied character for character), the
 * floors, a scale bar and doors. Everything numeric is worked out here, in pure code that the
 * server runs once when the read finishes (so everyone opening the plan sees the same draft) and
 * the web runs again when someone types a room's size:
 *
 * 1. Straighten: the main angle of the corners' edges (their median, folded into ±45°) is turned
 *    back about the image's middle. Boxes alone can't show a skew.
 * 2. Rectangles: four corners or a box give the bounding rectangle; more corners (an L, a T) give
 *    the largest rectangle inside, noted `not_rectangle`.
 * 3. Scale (findScale), always said: a typed size, printed sizes (median, 15 % agreement), a
 *    scale bar, doors taken as 80 cm, else a guess (the largest room's long side 4.5 m).
 * 4. Per floor: metres from that floor's own top-left corner.
 * 5. Under 1 m a side (MAP_LIMITS.minRoom): left out, noted `too_small`.
 * 6. Tidy: overlaps split at their middle along the thinner side; gaps a wall thick (≤ 35 cm)
 *    between rooms facing each other along ≥ 50 cm closed at the middle.
 * 7. Snap to the 10 cm grid with the 1 m minimum (D267), then separate anything that snapping
 *    made touch over an edge.
 *
 * Placing a floor's rooms beside a map floor's own (placeBeside), matching floors and same-name
 * rooms (matchFloors, matchRoom) and turning the whole plan (turnDrafts) are the review's, on the
 * web; the server's apply checks the result again (map/floor-plans.ts).
 */
import { estimateImageTokens, type ProviderKind, type ReasoningLevel } from './ai.js';
import {
  CONFIDENCE_MIN,
  MAX_OUTPUT_TOKENS,
  type PlanExtraction,
  REASONING_ALLOWANCE,
} from './extraction.js';
import {
  defaultRoomKind,
  MAP_LIMITS,
  type MapRect,
  type MapRoomKind,
  rectsOverlap,
} from './map.js';
import { normalize } from './normalize.js';

/** `floor_plans.status` (0162): reading, then ready to review; or the read failed, or AI capture
 * was off; then applied or discarded. */
export const FLOOR_PLAN_STATUSES = [
  'reading',
  'ready',
  'failed',
  'off',
  'applied',
  'discarded',
] as const;
export type FloorPlanStatus = (typeof FLOOR_PLAN_STATUSES)[number];

/** The plan file's limits: the image sent is at most this many pixels on its long side (the
 * evidence re-encode), a PDF's first page is rendered at `pdfPx`, and a review nobody finishes is
 * discarded after `staleDays` (the daily trash job). */
export const FLOOR_PLAN_FILE = Object.freeze({ maxPx: 3072, pdfPx: 2560, staleDays: 30 });

/** The quarter turns a plan can be sent at (`floor_plans.turn`). */
export const PLAN_TURNS = [0, 90, 180, 270] as const;
export type PlanTurn = (typeof PLAN_TURNS)[number];

/** Metres: the room grid (D267), and the gap left beside a floor's rooms. */
export const PLAN_STEP = 0.1;
export const PLAN_GAP = 1;
/** With nothing to scale by, the largest room's long side is taken as this (metres). */
export const PLAN_GUESS_LONG_SIDE = 4.5;
/** A door opening, when only doors give the scale (metres; spec §3). */
export const PLAN_DOOR_WIDTH = 0.8;

const MIN_ROOM_M = MAP_LIMITS.minRoom / 100;

// ---- Sizes as printed ---------------------------------------------------------------------------

const DIGITS: Readonly<Record<string, string>> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
  '٫': '.',
};

/** Western digits, one kind of times sign, plain feet and inch marks, single spaces. */
function plain(raw: string): string {
  return [...raw]
    .map((c) => DIGITS[c] ?? c)
    .join('')
    .replace(/[×✕✖*]/g, ' x ')
    .replace(/(\d)\s*[xX]\s*(?=\d)/g, '$1 x ')
    .replace(/[’′]/g, "'")
    .replace(/[”″]|''/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

const UNIT: Readonly<Record<string, number>> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  مم: 0.001,
  سم: 0.01,
  م: 1,
};
const METRIC_UNIT = '(mm|cm|m|مم|سم|م)';
const NUM = '(\\d+(?:[.,]\\d+)?)';
const FEET = '(?<![\\d.])(\\d+(?:\\.\\d+)?)\\s*(?:\'|ft)\\s*(?:(\\d+(?:\\.\\d+)?)\\s*(?:"|in)?)?';
const IMPERIAL = new RegExp(`${FEET}\\s*x\\s*${FEET}`, 'i');
const METRIC = new RegExp(
  `(?<![\\d.,])${NUM}\\s*${METRIC_UNIT}?\\s*x\\s*${NUM}\\s*${METRIC_UNIT}?`,
  'i',
);

const inMetres = (m: number) => (m > 0 && m <= MAP_LIMITS.maxRoom / 100 ? m : null);

/**
 * A printed room size as two lengths in metres (as printed: the first, then the second), or
 * null. Metric with m, cm or mm (or none: then by magnitude), a decimal comma, `×` or `x`, feet
 * and inches, Arabic-Indic digits with ٫ and م. An area ("15 m²") is not a size.
 */
export function parseSize(raw: string): [number, number] | null {
  const s = plain(raw);
  if (/m²|m2\b|sq\.?\s*(?:m|ft)|م²/i.test(s) && !/x/i.test(s)) return null;
  const imp = IMPERIAL.exec(s);
  const met = METRIC.exec(s);
  // Whichever comes first in the text (a table may give metres, then feet).
  if (imp && (!met || imp.index < met.index)) {
    const len = (f?: string, i?: string) => (Number(f) * 12 + Number(i ?? 0)) * 0.0254;
    const a = inMetres(len(imp[1], imp[2]));
    const b = inMetres(len(imp[3], imp[4]));
    return a && b ? [a, b] : null;
  }
  if (!met) return null;
  const unit = (met[4] ?? met[2] ?? '').toLowerCase();
  const num = (v: string | undefined) => Number((v ?? '').replace(',', '.'));
  const a0 = num(met[1]);
  const b0 = num(met[3]);
  // No unit: by magnitude (a home's room is 0.5–30 m; 50–3,000 is centimetres; more is mm).
  const f = UNIT[unit] ?? (Math.max(a0, b0) > 3000 ? 0.001 : Math.max(a0, b0) > 50 ? 0.01 : 1);
  const a = inMetres(a0 * f);
  const b = inMetres(b0 * f);
  return a && b ? [a, b] : null;
}

/** One printed length in metres (a scale bar's label): its largest number, in the text's unit
 * (metres when it names none). */
export function parseLength(raw: string): number | null {
  const s = plain(raw);
  const nums = [...s.matchAll(/(\d+(?:[.,]\d+)?)/g)].map((m) =>
    Number((m[1] ?? '').replace(',', '.')),
  );
  if (nums.length === 0) return null;
  const n = Math.max(...nums);
  const f = /\bft\b|'|feet/i.test(s)
    ? 0.3048
    : /\bmm\b|مم/i.test(s)
      ? 0.001
      : /\bcm\b|سم/i.test(s)
        ? 0.01
        : 1;
  return inMetres(n * f);
}

// ---- Scale ----------------------------------------------------------------------------------------

export type PlanScaleFrom = 'typed' | 'sizes' | 'scale_bar' | 'doors' | 'guess';
export type PlanScale = {
  /** Metres per pixel of the image sent. */
  mPerPx: number;
  from: PlanScaleFrom;
  /** Printed sizes: how many agree, of how many rooms had one. */
  agree: number;
  of: number;
  /** Typed: the room whose size was typed. */
  typedKey?: string;
};

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return Number.NaN;
  return n % 2 ? (s[(n - 1) / 2] as number) : ((s[n / 2 - 1] as number) + (s[n / 2] as number)) / 2;
};

type PxRoom = { wPx: number; hPx: number; size: [number, number] | null };

/** A printed size paired to the box's aspect: which way round it goes, and its metres a pixel. */
function pairUp(r: PxRoom, size: [number, number]) {
  const [a, b] = size;
  const straight = [a / r.wPx, b / r.hPx] as const;
  const turned = [b / r.wPx, a / r.hPx] as const;
  const spread = (p: readonly [number, number]) => Math.abs(Math.log(p[0] / p[1]));
  const s = spread(straight) <= spread(turned);
  const p = s ? straight : turned;
  return { s: Math.sqrt(p[0] * p[1]), w: s ? a : b, d: s ? b : a };
}

/** Metres per pixel, and where it came from (spec §6). */
export function findScale(input: {
  rooms: readonly PxRoom[];
  bar?: { px: number; metres: number } | null;
  doorsPx?: readonly number[] | undefined;
  typed?: { index: number; w: number; d: number } | null;
}): PlanScale {
  const typedRoom = input.typed ? input.rooms[input.typed.index] : undefined;
  if (input.typed && typedRoom && typedRoom.wPx > 0 && typedRoom.hPx > 0) {
    const s = pairUp(typedRoom, [input.typed.w, input.typed.d]).s;
    return { mPerPx: s, from: 'typed', agree: 1, of: 1 };
  }
  const each = input.rooms.flatMap((r) =>
    r.size && r.wPx > 0 && r.hPx > 0 ? [pairUp(r, r.size).s] : [],
  );
  if (each.length > 0) {
    // The median, and the sizes within 15 % of it; when none is (two that disagree), the largest
    // group that agrees with one of them, the first on a tie.
    const m = median(each);
    let agree = each.filter((s) => Math.abs(s / m - 1) <= 0.15);
    if (agree.length === 0) {
      for (const c of each) {
        const near = each.filter((s) => Math.abs(s / c - 1) <= 0.15);
        if (near.length > agree.length) agree = near;
      }
    }
    return { mPerPx: median(agree), from: 'sizes', agree: agree.length, of: each.length };
  }
  if (input.bar && input.bar.px > 0 && input.bar.metres > 0) {
    return { mPerPx: input.bar.metres / input.bar.px, from: 'scale_bar', agree: 1, of: 1 };
  }
  const doors = (input.doorsPx ?? []).filter((d) => d > 0);
  if (doors.length >= 2) {
    return {
      mPerPx: PLAN_DOOR_WIDTH / median(doors),
      from: 'doors',
      agree: doors.length,
      of: doors.length,
    };
  }
  const big = Math.max(1, ...input.rooms.map((r) => Math.max(r.wPx, r.hPx)));
  return { mPerPx: PLAN_GUESS_LONG_SIDE / big, from: 'guess', agree: 0, of: 0 };
}

// ---- Geometry -------------------------------------------------------------------------------------

/** What a draft's row says about it (the web words them). */
export const PLAN_NOTES = ['size_disagrees', 'not_rectangle', 'too_small', 'name_unclear'] as const;
export type PlanNote = (typeof PLAN_NOTES)[number];

/** One proposed room, in metres from its plan floor's own corner. */
export type PlanDraft = {
  /** `plan:{i}`, i its index in the answer's rooms: stable across a rescale. */
  key: string;
  /** The label as printed; null when the room had none (the web names it "Room {n}"). */
  name: string | null;
  /** An index into PlanDrafts.floors. */
  floor: number;
  kind: MapRoomKind;
  x: number;
  z: number;
  w: number;
  d: number;
  /** The size printed for it, paired to the drawing's way round. */
  printed: { w: number; d: number; text: string } | null;
  notes: PlanNote[];
  /** Under 1 m a side: not added (its row stays, switched off). */
  skip: boolean;
};

export type PlanDrafts = {
  isPlan: boolean;
  /** Past PLAN_LIMITS.rooms: Kept read the first 60. */
  more: boolean;
  scale: PlanScale;
  skewDeg: number;
  /** One per floor the plan shows, in its order (at least one when there are rooms). */
  floors: { label: string | null }[];
  rooms: PlanDraft[];
  /**
   * Where the image lies in each floor's metres (index: the floor), for the review's underlay:
   * its middle's position and its size, before any turn, and its tilt (the straightening, in
   * degrees). A room's draft and its box on the image line up through these.
   */
  images: { cx: number; cz: number; w: number; h: number }[];
};

type Pt = [number, number];
type Rect = { x: number; z: number; w: number; d: number };

/** Dominant angle of the corners' edges (radians, folded into −45°..45°), or 0. */
function skewOf(rooms: NonNullable<PlanExtraction['rooms']>, W: number, H: number): number {
  const angles: number[] = [];
  for (const r of rooms) {
    const c = r.corners;
    if (!c || c.length < 4) continue;
    for (let k = 0; k < c.length; k++) {
      const [x1, y1] = c[k] as Pt;
      const [x2, y2] = c[(k + 1) % c.length] as Pt;
      const dx = (x2 - x1) * W;
      const dy = (y2 - y1) * H;
      if (Math.hypot(dx, dy) < 20) continue;
      let a = Math.atan2(dy, dx);
      while (a > Math.PI / 4) a -= Math.PI / 2;
      while (a < -Math.PI / 4) a += Math.PI / 2;
      angles.push(a);
    }
  }
  return angles.length >= 4 ? median(angles) : 0;
}

/** Near-equal coordinates (within `tol`) as one line each: a hand-read L's corners line up. */
function lines(values: readonly number[], tol: number): (v: number) => number {
  const sorted = [...values].sort((a, b) => a - b);
  const groups: number[][] = [];
  for (const v of sorted) {
    const g = groups[groups.length - 1];
    if (g && v - (g[g.length - 1] as number) <= tol) g.push(v);
    else groups.push([v]);
  }
  const means = groups.map((g) => ({
    lo: g[0] as number,
    hi: g[g.length - 1] as number,
    m: g.reduce((a, b) => a + b, 0) / g.length,
  }));
  return (v) => means.find((g) => v >= g.lo - 1e-9 && v <= g.hi + 1e-9)?.m ?? v;
}

/** Whether a point is inside a polygon (even-odd). */
function inside(poly: readonly Pt[], x: number, z: number): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i] as Pt;
    const [xj, zj] = poly[j] as Pt;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

/** The largest axis-aligned rectangle inside a rectilinear polygon, from every pair of its x and
 * z lines: enough for the L, T and U rooms a home plan draws. */
export function largestRect(poly: readonly Pt[]): Rect {
  const xs = [...new Set(poly.map((p) => p[0]))].sort((a, b) => a - b);
  const zs = [...new Set(poly.map((p) => p[1]))].sort((a, b) => a - b);
  let best: Rect = { x: 0, z: 0, w: 0, d: 0 };
  for (let a = 0; a < xs.length; a++)
    for (let b = a + 1; b < xs.length; b++)
      for (let c = 0; c < zs.length; c++)
        for (let e = c + 1; e < zs.length; e++) {
          let ok = true;
          for (let i = a; i < b && ok; i++)
            for (let k = c; k < e && ok; k++)
              ok = inside(
                poly,
                ((xs[i] as number) + (xs[i + 1] as number)) / 2,
                ((zs[k] as number) + (zs[k + 1] as number)) / 2,
              );
          const x0 = xs[a] as number;
          const z0 = zs[c] as number;
          const w = (xs[b] as number) - x0;
          const d = (zs[e] as number) - z0;
          if (ok && w * d > best.w * best.d) best = { x: x0, z: z0, w, d };
        }
  return best;
}

type Live = Rect & { floor: number; skip: boolean };

const EPS = 1e-6;

/** Overlaps split at their middle along the thinner side; gaps up to `wallGap` between rooms that
 * face each other along at least half a metre closed at the middle. Repeated until nothing
 * changes, at most 20 passes, in a fixed order. */
function tidy(rooms: Live[], wallGap: number): void {
  for (let pass = 0; pass < 20; pass++) {
    let changed = false;
    for (let i = 0; i < rooms.length; i++)
      for (let j = i + 1; j < rooms.length; j++) {
        const a = rooms[i] as Live;
        const b = rooms[j] as Live;
        if (a.skip || b.skip || a.floor !== b.floor) continue;
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oz = Math.min(a.z + a.d, b.z + b.d) - Math.max(a.z, b.z);
        if (ox > EPS && oz > EPS) {
          if (ox <= oz) meet(a, b, 'x', true);
          else meet(a, b, 'z', true);
          changed = true;
        } else if (oz > 0.5 && ox < -EPS && -ox <= wallGap) {
          meet(a, b, 'x', false);
          changed = true;
        } else if (ox > 0.5 && oz < -EPS && -oz <= wallGap) {
          meet(a, b, 'z', false);
          changed = true;
        }
      }
    if (!changed) return;
  }
}

/** Two rooms meet at the middle of their overlap (or their gap) along one axis. */
function meet(a: Live, b: Live, axis: 'x' | 'z', overlap: boolean): void {
  const size = axis === 'x' ? 'w' : 'd';
  const [lo, hi] = a[axis] <= b[axis] ? [a, b] : [b, a];
  const mid = overlap
    ? (Math.max(lo[axis], hi[axis]) + Math.min(lo[axis] + lo[size], hi[axis] + hi[size])) / 2
    : (lo[axis] + lo[size] + hi[axis]) / 2;
  const end = hi[axis] + hi[size];
  lo[size] = mid - lo[axis];
  hi[axis] = mid;
  hi[size] = end - mid;
}

const grid = (v: number) => Math.round(v / PLAN_STEP) / (1 / PLAN_STEP);

/** Every corner on the 10 cm grid, each side at least 1 m. */
function snapAll(rooms: Live[]): void {
  for (const r of rooms) {
    if (r.skip) continue;
    const x0 = grid(r.x);
    const z0 = grid(r.z);
    r.w = Math.max(MIN_ROOM_M, grid(grid(r.x + r.w) - x0));
    r.d = Math.max(MIN_ROOM_M, grid(grid(r.z + r.d) - z0));
    r.x = x0;
    r.z = z0;
  }
}

/** What snapping (or the 1 m minimum) left overlapping is cut on the grid, or, when a cut would
 * leave a side under 1 m, moved clear to the right of the floor. Ends with no overlap. */
function separate(rooms: Live[]): void {
  const hit = (a: Live, b: Live) =>
    !a.skip && !b.skip && a.floor === b.floor && a !== b && rectsOverlap(a, b);
  for (let guard = 0; guard < 400; guard++) {
    let pair: [Live, Live] | null = null;
    outer: for (const a of rooms)
      for (const b of rooms)
        if (a !== b && rooms.indexOf(a) < rooms.indexOf(b) && hit(a, b)) {
          pair = [a, b];
          break outer;
        }
    if (!pair) return;
    const [a, b] = pair;
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const oz = Math.min(a.z + a.d, b.z + b.d) - Math.max(a.z, b.z);
    const axis = ox <= oz ? 'x' : 'z';
    const size = axis === 'x' ? 'w' : 'd';
    const [lo, hi] = a[axis] <= b[axis] ? [a, b] : [b, a];
    const mid = grid(
      (Math.max(lo[axis], hi[axis]) + Math.min(lo[axis] + lo[size], hi[axis] + hi[size])) / 2,
    );
    const end = grid(hi[axis] + hi[size]);
    const loSize = grid(mid - lo[axis]);
    const hiSize = grid(end - mid);
    if (loSize >= MIN_ROOM_M && hiSize >= MIN_ROOM_M && hi[axis] < mid + EPS) {
      lo[size] = loSize;
      hi[axis] = mid;
      hi[size] = hiSize;
    } else {
      // The later room goes clear of everything on its floor.
      const floor = rooms.filter((r) => !r.skip && r.floor === b.floor && r !== b);
      b.x = grid(Math.max(...floor.map((r) => r.x + r.w)) + PLAN_GAP);
    }
  }
}

/**
 * The model's answer as proposed rooms, per floor, in metres (spec §7). `image` is the size of the
 * image sent; `typed` is a size someone typed for one room (Set a room's size), which then gives
 * the scale.
 */
export function draftRooms(
  answer: PlanExtraction,
  image: { w: number; h: number },
  opts: { typed?: { key: string; w: number; d: number } | null } = {},
): PlanDrafts {
  const W = image.w;
  const H = image.h;
  const rooms = answer.is_plan ? (answer.rooms ?? []) : [];
  const labels = (answer.floors ?? []).map((f) => f.label.value);
  const floorCount = Math.max(1, labels.length);
  const floors = Array.from({ length: floorCount }, (_, i) => ({ label: labels[i] ?? null }));

  const skew = skewOf(rooms, W, H);
  const cos = Math.cos(-skew);
  const sin = Math.sin(-skew);
  const unturn = ([x, y]: Pt): Pt => {
    const px = x * W - W / 2;
    const py = y * H - H / 2;
    return [px * cos - py * sin, px * sin + py * cos];
  };

  // Each room in pixels of the straightened drawing.
  const px = rooms.map((r) => {
    const notes: PlanNote[] = [];
    const [bx, by, bw, bh] = r.box;
    const poly: Pt[] = (
      r.corners && r.corners.length >= 4
        ? r.corners
        : ([
            [bx, by],
            [bx + bw, by],
            [bx + bw, by + bh],
            [bx, by + bh],
          ] as Pt[])
    ).map(unturn);
    const xs = poly.map((p) => p[0]);
    const zs = poly.map((p) => p[1]);
    let rect: Rect = {
      x: Math.min(...xs),
      z: Math.min(...zs),
      w: Math.max(...xs) - Math.min(...xs),
      d: Math.max(...zs) - Math.min(...zs),
    };
    if (poly.length > 4) {
      const tol = 0.04 * Math.max(rect.w, rect.d);
      const lx = lines(xs, tol);
      const lz = lines(zs, tol);
      const straight = poly.map(([a, b]) => [lx(a), lz(b)] as Pt);
      const lr = largestRect(straight);
      if (lr.w * lr.d > 0 && lr.w * lr.d < rect.w * rect.d * 0.97) {
        notes.push('not_rectangle');
        rect = lr;
      }
    }
    const sizeText = r.size_text?.value ?? null;
    const size = sizeText ? parseSize(sizeText) : null;
    const floor = r.floor !== undefined && r.floor < floorCount ? r.floor : 0;
    return { r, rect, size, sizeText, notes, floor };
  });

  const typedIndex = opts.typed ? rooms.findIndex((_, i) => `plan:${i}` === opts.typed?.key) : -1;
  const bar = answer.scale_bar
    ? (() => {
        const a = unturn(answer.scale_bar.from);
        const b = unturn(answer.scale_bar.to);
        const metres = parseLength(answer.scale_bar.text);
        return metres ? { px: Math.hypot(b[0] - a[0], b[1] - a[1]), metres } : null;
      })()
    : null;
  const found = findScale({
    // An L's printed size is its whole outline's, not its largest part's: left out of the scale.
    rooms: px.map((p) => ({
      wPx: p.rect.w,
      hPx: p.rect.d,
      size: p.notes.includes('not_rectangle') ? null : p.size,
    })),
    bar,
    doorsPx: answer.doors?.map((d) => Math.max(d.box[2] * W, d.box[3] * H)),
    typed:
      opts.typed && typedIndex >= 0
        ? { index: typedIndex, w: opts.typed.w, d: opts.typed.d }
        : null,
  });
  const scale: PlanScale =
    found.from === 'typed' && opts.typed ? { ...found, typedKey: opts.typed.key } : found;
  const k = scale.mPerPx;

  // Metres from each floor's own top-left corner.
  const origin = new Map<number, { x: number; z: number }>();
  for (const p of px) {
    const o = origin.get(p.floor);
    origin.set(p.floor, {
      x: Math.min(o?.x ?? Number.POSITIVE_INFINITY, p.rect.x),
      z: Math.min(o?.z ?? Number.POSITIVE_INFINITY, p.rect.z),
    });
  }
  const live: Live[] = px.map((p) => {
    const o = origin.get(p.floor) ?? { x: 0, z: 0 };
    const w = p.rect.w * k;
    const d = p.rect.d * k;
    return {
      x: (p.rect.x - o.x) * k,
      z: (p.rect.z - o.z) * k,
      w,
      d,
      floor: p.floor,
      skip: w < MIN_ROOM_M - 0.05 || d < MIN_ROOM_M - 0.05,
    };
  });
  tidy(live, 0.35);
  snapAll(live);
  tidy(live, 0);
  snapAll(live);
  separate(live);
  // Each floor's rooms start at its corner again (a cut or a move may have changed it).
  const moved = new Map<number, { x: number; z: number }>();
  for (const f of new Set(live.filter((r) => !r.skip).map((r) => r.floor))) {
    const here = live.filter((r) => !r.skip && r.floor === f);
    const mx = Math.min(...here.map((r) => r.x));
    const mz = Math.min(...here.map((r) => r.z));
    moved.set(f, { x: mx, z: mz });
    for (const r of here) {
      r.x = grid(r.x - mx);
      r.z = grid(r.z - mz);
    }
  }
  // The image's middle is (0, 0) in the straightened pixel frame.
  const images = floors.map((_, f) => {
    const o = origin.get(f) ?? { x: 0, z: 0 };
    const m = moved.get(f) ?? { x: 0, z: 0 };
    return { cx: (0 - o.x) * k - m.x, cz: (0 - o.z) * k - m.z, w: W * k, h: H * k };
  });

  const drafts: PlanDraft[] = px.map((p, i) => {
    const g = live[i] as Live;
    const notes = [...p.notes];
    let printed: PlanDraft['printed'] = null;
    if (p.size && p.sizeText) {
      const [a, b] = p.size;
      const straight = Math.abs(Math.log(a / g.w)) + Math.abs(Math.log(b / g.d));
      const turned = Math.abs(Math.log(b / g.w)) + Math.abs(Math.log(a / g.d));
      const [pw, pd] = straight <= turned ? [a, b] : [b, a];
      printed = { w: pw, d: pd, text: p.sizeText };
      if (
        !p.notes.includes('not_rectangle') &&
        (Math.abs(pw / g.w - 1) > 0.2 || Math.abs(pd / g.d - 1) > 0.2)
      )
        notes.push('size_disagrees');
    }
    if (g.skip) notes.push('too_small');
    const name = p.r.name?.value ?? null;
    if (p.r.name && p.r.name.confidence < CONFIDENCE_MIN) notes.push('name_unclear');
    const cm = (v: number) => Math.round(v * 100) / 100;
    return {
      key: `plan:${i}`,
      name,
      floor: p.floor,
      kind: p.r.kind ?? defaultRoomKind(name ?? ''),
      x: g.skip ? 0 : g.x,
      z: g.skip ? 0 : g.z,
      w: g.skip ? cm(g.w) : g.w,
      d: g.skip ? cm(g.d) : g.d,
      printed,
      notes,
      skip: g.skip,
    };
  });
  return {
    isPlan: answer.is_plan,
    more: answer.more === true,
    scale,
    skewDeg: (skew * 180) / Math.PI,
    floors: rooms.length > 0 || labels.length > 0 ? floors : [],
    rooms: drafts,
    images: rooms.length > 0 || labels.length > 0 ? images : [],
  };
}

// ---- The review's steps (the web) -----------------------------------------------------------------

/** How far to move one floor's rooms, as a block, to sit to the right of `existing` (that map
 * floor's rooms), PLAN_GAP clear, from the top. Metres. */
export function placeBeside(
  rooms: readonly MapRect[],
  existing: readonly MapRect[],
): { dx: number; dz: number } {
  if (rooms.length === 0) return { dx: 0, dz: 0 };
  const minX = Math.min(...rooms.map((r) => r.x));
  const minZ = Math.min(...rooms.map((r) => r.z));
  const start = existing.length
    ? Math.ceil((Math.max(...existing.map((r) => r.x + r.w)) + PLAN_GAP) / PLAN_STEP - 1e-6) *
      PLAN_STEP
    : 0;
  const top = existing.length ? Math.max(0, Math.min(...existing.map((r) => r.z))) : 0;
  return { dx: grid(start - minX), dz: grid(top - minZ) };
}

/** Every room a quarter turn clockwise (as the plan view shows it) about its floor's corner;
 * each floor starts at its corner again. */
export function turnDrafts<T extends MapRect & { floor: number }>(rooms: readonly T[]): T[] {
  const out = rooms.map((r) => ({ ...r, x: -(r.z + r.d), z: r.x, w: r.d, d: r.w }));
  for (const f of new Set(out.map((r) => r.floor))) {
    const here = out.filter((r) => r.floor === f);
    const mx = Math.min(...here.map((r) => r.x));
    const mz = Math.min(...here.map((r) => r.z));
    for (const r of here) {
      r.x = grid(r.x - mx) || 0;
      r.z = grid(r.z - mz) || 0;
    }
  }
  return out;
}

/** Where each plan floor goes (spec §7.4): an existing floor (`id`), a new one (`create`, named
 * as printed or, null, "Floor {n}" by the web), or the map's no-floor level (`id` null). */
export type FloorMatch = { id: string | null; name: string | null; create: boolean };

export function matchFloors(
  planFloors: readonly { label: string | null }[],
  existing: readonly { id: string; name: string }[],
  showing: string | null,
): FloorMatch[] {
  if (planFloors.length <= 1) {
    if (existing.length === 0)
      return planFloors.map(() => ({ id: null, name: null, create: false }));
    const at =
      existing.find((f) => f.id === showing) ?? (existing[0] as { id: string; name: string });
    return planFloors.map(() => ({ id: at.id, name: at.name, create: false }));
  }
  const used = new Set<string>();
  return planFloors.map((f) => {
    const same = f.label
      ? existing.find((e) => !used.has(e.id) && normalize(e.name) === normalize(f.label as string))
      : undefined;
    if (same) {
      used.add(same.id);
      return { id: same.id, name: same.name, create: false };
    }
    return { id: null, name: f.label, create: true };
  });
}

/** A proposal and the rooms already on its map floor (spec §7.5): a same-name room nobody
 * arranged is used (its place gets the rectangle); one already arranged turns the proposal off. */
export function matchRoom(
  name: string | null,
  levelId: string | null,
  rooms: readonly { id: string; name: string; levelId: string | null; arranged: boolean }[],
): { use?: string; arranged?: string } {
  if (!name) return {};
  const n = normalize(name);
  const same = rooms.filter((r) => r.levelId === levelId && normalize(r.name) === n);
  const free = same.find((r) => !r.arranged);
  if (free) return { use: free.id };
  const placed = same.find((r) => r.arranged);
  return placed ? { arranged: placed.id } : {};
}

// ---- Cost (spec §10.5) ------------------------------------------------------------------------

/** The prompt's own tokens, estimated (the rules and the question). */
const PLAN_PROMPT_TOKENS = 900;

/**
 * An upper bound on one read's tokens, shown before sending: the image as the server sends it
 * (at most FLOOR_PLAN_FILE.maxPx on its long side), the prompt, and the output allowance with the
 * reasoning allowance.
 */
export function planEstimate(input: {
  kind: ProviderKind;
  width: number;
  height: number;
  reasoning?: ReasoningLevel;
}): number {
  const long = Math.max(input.width, input.height);
  const f = long > FLOOR_PLAN_FILE.maxPx ? FLOOR_PLAN_FILE.maxPx / long : 1;
  const w = Math.max(1, Math.round(input.width * f));
  const h = Math.max(1, Math.round(input.height * f));
  return (
    estimateImageTokens(input.kind, w, h) +
    PLAN_PROMPT_TOKENS +
    MAX_OUTPUT_TOKENS.plan +
    REASONING_ALLOWANCE[input.reasoning ?? 'low']
  );
}
