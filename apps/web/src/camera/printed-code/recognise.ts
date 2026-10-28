/**
 * Reading a printed short code (#303) from a camera frame, on the phone, with no QR: the code is
 * always set the same way (IBM Plex Mono 600, three characters, a hyphen, three, from the
 * 32-character alphabet), so a small purpose-built reader does what a general OCR engine would,
 * in a few kilobytes:
 *
 * 1. **Binarise** against the local light (a mean and spread over a window, from integral images),
 *    once for dark ink and once for light ink on dark tape.
 * 2. **Components:** each blob of ink, 8-connected, with its box.
 * 3. **Lines:** six glyph-sized blobs of one height at one pitch, with a hyphen in a one-glyph gap
 *    after the third and no glyph of that height just before or after: the printed code's shape,
 *    which ordinary words, barcodes and smaller text beside the code don't have.
 * 4. **Glyphs:** each slot is sampled along the line (so a turned label reads), in the cell the
 *    templates were drawn in, at a few scales and shifts, and compared with the 32 templates by
 *    normalised cross-correlation, which ignores brightness and contrast.
 * 5. **Sure or not:** every glyph must match well, and clearly better than its next-best
 *    character. A read that isn't sure still comes back, marked so: the scanner asks the person.
 *
 * Pure functions on a grey image, so it runs and is tested anywhere (no canvas, no DOM).
 */
import { SHORT_CODE } from '@kept/shared';
import { CAP_EM, COLS, GLYPH_CHARS, ROWS, sampleAt } from './geometry';
import { likeness, normalise, templates } from './templates';

/** A grey image, one value (0–255) per pixel, row by row. */
export type Gray = { width: number; height: number; data: ArrayLike<number> };
/** A blob of ink: its box (x1, y1 past the end), its pixel count, its label. */
export type Blob = { x0: number; y0: number; x1: number; y1: number; area: number; label: number };
export type Polarity = 'dark' | 'light';

/** A glyph's best character, its score (−1 to 1) and its lead over the next best (`lead`). */
export type GlyphMatch = { char: string; score: number; margin: number };
export type PrintedRead = {
  code: string;
  /** Every glyph matched well and clearly: the scanner may open it as it does a QR. */
  sure: boolean;
  /** The weakest glyph's match (−1 to 1), and the weakest lead over a next-best character. */
  score: number;
  margin: number;
  /** Where the code is, in pixels of the image read. */
  box: { x: number; y: number; width: number; height: number };
};

/**
 * What every glyph of a sure read needs: its match, and its lead over the next-best character
 * (`lead`). Set from the sample photos (recognise.test.ts): on 400 photos made far harder than
 * the test's own (cap height 10–24 px, blur up to 2.5 px, noise up to 25 levels), 17 came back
 * wrong, every one with a weakest match under 0.78 or a weakest lead under 0.23, and none with
 * both at or over these.
 */
export const SURE_SCORE = 0.75;
export const SURE_MARGIN = 0.2;
/** Below this, the line isn't the code at all. */
const FLOOR_SCORE = 0.55;

// ----- 1. binarise -------------------------------------------------------------------------------

/** Sums over boxes in O(1): (w+1) × (h+1) running totals of values and of their squares. */
function integrals(g: Gray): { sum: Float64Array; sq: Float64Array } {
  const w = g.width;
  const h = g.height;
  const sum = new Float64Array((w + 1) * (h + 1));
  const sq = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    let rowSq = 0;
    for (let x = 0; x < w; x++) {
      const v = g.data[y * w + x] as number;
      row += v;
      rowSq += v * v;
      const i = (y + 1) * (w + 1) + x + 1;
      sum[i] = (sum[i - w - 1] as number) + row;
      sq[i] = (sq[i - w - 1] as number) + rowSq;
    }
  }
  return { sum, sq };
}

/**
 * Ink pixels (1) of one polarity: a pixel (smoothed over 3 × 3) darker (or lighter) than its
 * neighbourhood's mean by half its spread, and by at least a few levels, so flat ground and
 * camera noise stay blank.
 */
export function binarise(g: Gray, polarity: Polarity): Uint8Array {
  const { width: w, height: h } = g;
  const { sum, sq } = integrals(g);
  const W = w + 1;
  const boxSum = (t: Float64Array, x0: number, y0: number, x1: number, y1: number) =>
    (t[y1 * W + x1] as number) -
    (t[y0 * W + x1] as number) -
    (t[y1 * W + x0] as number) +
    (t[y0 * W + x0] as number);
  const r = Math.max(7, Math.round(Math.min(w, h) / 16));
  const mask = new Uint8Array(w * h);
  const dark = polarity === 'dark';
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    const sy0 = Math.max(0, y - 1);
    const sy1 = Math.min(h, y + 2);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const n = (x1 - x0) * (y1 - y0);
      const mean = boxSum(sum, x0, y0, x1, y1) / n;
      const spread = Math.sqrt(Math.max(0, boxSum(sq, x0, y0, x1, y1) / n - mean * mean));
      const sx0 = Math.max(0, x - 1);
      const sx1 = Math.min(w, x + 2);
      const v = boxSum(sum, sx0, sy0, sx1, sy1) / ((sx1 - sx0) * (sy1 - sy0));
      const d = Math.max(10, spread * 0.5);
      if (dark ? v < mean - d : v > mean + d) mask[y * w + x] = 1;
    }
  }
  return mask;
}

// ----- 2. components -----------------------------------------------------------------------------

/** The mask's blobs, 8-connected, and each pixel's blob label (0 for none). */
export function components(
  mask: Uint8Array,
  width: number,
  height: number,
): { blobs: Blob[]; labels: Int32Array } {
  const labels = new Int32Array(width * height);
  const parent: number[] = [0];
  const find = (a: number): number => {
    let r = a;
    while (parent[r] !== r) r = parent[r] as number;
    while (parent[a] !== r) {
      const next = parent[a] as number;
      parent[a] = r;
      a = next;
    }
    return r;
  };
  const join = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!mask[i]) continue;
      let label = 0;
      // The four neighbours already seen: west, north-west, north, north-east.
      const seen = [
        x > 0 ? labels[i - 1] : 0,
        x > 0 && y > 0 ? labels[i - width - 1] : 0,
        y > 0 ? labels[i - width] : 0,
        x < width - 1 && y > 0 ? labels[i - width + 1] : 0,
      ];
      for (const s of seen) {
        if (!s) continue;
        if (!label) label = s;
        else if (s !== label) join(label, s);
      }
      if (!label) {
        label = parent.length;
        parent.push(label);
      }
      labels[i] = label;
    }
  const boxes = new Map<number, Blob>();
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!labels[i]) continue;
      const l = find(labels[i] as number);
      labels[i] = l;
      const b = boxes.get(l);
      if (!b) boxes.set(l, { x0: x, y0: y, x1: x + 1, y1: y + 1, area: 1, label: l });
      else {
        if (x < b.x0) b.x0 = x;
        if (x + 1 > b.x1) b.x1 = x + 1;
        b.y1 = y + 1;
        b.area++;
      }
    }
  return { blobs: [...boxes.values()], labels };
}

// ----- 3. lines ----------------------------------------------------------------------------------

const cx = (b: Blob) => (b.x0 + b.x1) / 2;
const cy = (b: Blob) => (b.y0 + b.y1) / 2;
const bh = (b: Blob) => b.y1 - b.y0;
const bw = (b: Blob) => b.x1 - b.x0;

function glyphLike(b: Blob): boolean {
  const h = bh(b);
  const w = bw(b);
  const fill = b.area / (w * h);
  return h >= 8 && w / h >= 0.25 && w / h <= 1.15 && fill >= 0.12 && fill <= 0.9;
}

function dashLike(b: Blob): boolean {
  const h = bh(b);
  const w = bw(b);
  return w >= 2 && h <= w && b.area / (w * h) >= 0.4;
}

const alike = (a: Blob, b: Blob, lo = 0.72) => {
  const r = bh(a) / bh(b);
  return r >= lo && r <= 1 / lo;
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
};

/** The next glyph to the right of `a` at a distance of `lo`–`hi` of its height, on its line. */
function nextRight(a: Blob, glyphs: readonly Blob[], lo: number, hi: number): Blob | null {
  let best: Blob | null = null;
  let bestDx = Number.POSITIVE_INFINITY;
  const h = bh(a);
  for (const b of glyphs) {
    if (b === a || !alike(a, b)) continue;
    const dx = cx(b) - cx(a);
    const m = (h + bh(b)) / 2;
    if (dx < lo * m || dx > hi * m) continue;
    if (Math.abs(cy(b) - cy(a)) > 0.3 * dx + 0.1 * m) continue;
    if (dx < bestDx) {
      best = b;
      bestDx = dx;
    }
  }
  return best;
}

/**
 * Every run of blobs shaped like a printed code, each as its six glyphs in reading order: one
 * height (a fifth less, or a third more for Q's tail), one pitch (0.6–1.25 of the height, each
 * within a fifth of the others), a gap of about two pitches after the third with a hyphen in it
 * and no glyph, and no glyph of that height within one and a half pitches before the first or
 * after the last.
 */
export function findCodeLines(blobs: readonly Blob[]): Blob[][] {
  const glyphs = blobs.filter(glyphLike);
  const dashes = blobs.filter(dashLike);
  const lines: Blob[][] = [];
  for (const first of glyphs) {
    const run: Blob[] = [first];
    let ok = true;
    for (let k = 1; k < 6 && ok; k++) {
      const prev = run[k - 1] as Blob;
      const next =
        k === 3 ? nextRight(prev, glyphs, 1.35, 2.6) : nextRight(prev, glyphs, 0.6, 1.25);
      if (next) run.push(next);
      else ok = false;
    }
    if (!ok) continue;
    const [g0, , g2, g3, , g5] = run as [Blob, Blob, Blob, Blob, Blob, Blob];
    // One height (Q's tail makes it about a third taller).
    const h = median(run.map(bh));
    if (run.some((b) => bh(b) < 0.8 * h || bh(b) > 1.38 * h)) continue;
    // One pitch, and the hyphen's gap about two of them.
    const gaps = run
      .slice(1)
      .map((b, i) => Math.hypot(cx(b) - cx(run[i] as Blob), cy(b) - cy(run[i] as Blob)));
    const p = median([gaps[0], gaps[1], gaps[3], gaps[4]] as number[]);
    if (p < 0.6 * h || p > 1.25 * h) continue;
    if ([0, 1, 3, 4].some((i) => Math.abs((gaps[i] as number) - p) > 0.2 * p)) continue;
    const mid = gaps[2] as number;
    if (mid < 1.7 * p || mid > 2.4 * p) continue;
    // The direction of the line; nothing of the code's height just before or after it.
    const ux = (cx(g5) - cx(g0)) / (6 * p);
    const uy = (cy(g5) - cy(g0)) / (6 * p);
    const along = (b: Blob, from: Blob) => (cx(b) - cx(from)) * ux + (cy(b) - cy(from)) * uy;
    const across = (b: Blob, from: Blob) =>
      Math.abs(-(cx(b) - cx(from)) * uy + (cy(b) - cy(from)) * ux);
    const span = along(g3, g2);
    const crowded = glyphs.some(
      (b) =>
        !run.includes(b) &&
        alike(b, g0, 0.7) &&
        across(b, g0) < 0.5 * h &&
        ((along(b, g0) < 0 && along(b, g0) > -1.6 * p) ||
          (along(b, g5) > 0 && along(b, g5) < 1.6 * p) ||
          (along(b, g2) > 0.3 * span && along(b, g2) < 0.7 * span)),
    );
    if (crowded) continue;
    // The hyphen: a short bar between the third and fourth glyphs, near the middle of their height.
    const hyphen = dashes.some((d) => {
      const t = along(d, g2) / span;
      return (
        t > 0.3 &&
        t < 0.7 &&
        across(d, g2) < 0.3 * h &&
        bh(d) <= 0.35 * h &&
        bw(d) >= 0.15 * h &&
        bw(d) <= 0.9 * h
      );
    });
    if (!hyphen) continue;
    if (!lines.some((l) => l[0] === first)) lines.push(run);
  }
  return lines;
}

// ----- 4. glyphs ---------------------------------------------------------------------------------

/**
 * How clearly `char` beat `next`: the gap between their scores as a share of the most two such
 * templates can ever differ (1 − their likeness), so 8 against B, which are much alike, counts
 * the same as 7 against W. 1 is a perfect `char`; 0 is halfway between the two.
 */
function lead(char: string, score: number, next: string, second: number): number {
  const i = GLYPH_CHARS.indexOf(char);
  const j = GLYPH_CHARS.indexOf(next);
  if (j < 0) return 1;
  return (score - second) / Math.max(0.02, 1 - likeness(i, j));
}

/** The best character for a cell of `COLS × ROWS` samples, its score and its lead (`lead`). */
export function matchCell(cell: ArrayLike<number>): GlyphMatch {
  const v = normalise(cell);
  const all = templates();
  let best = -2;
  let second = -2;
  let at = 0;
  let runner = -1;
  for (let t = 0; t < all.length; t++) {
    const tpl = all[t] as Float32Array;
    let s = 0;
    for (let i = 0; i < v.length; i++) s += (v[i] as number) * (tpl[i] as number);
    if (s > best) {
      second = best;
      runner = at;
      best = s;
      at = t;
    } else if (s > second) {
      second = s;
      runner = t;
    }
  }
  const char = GLYPH_CHARS[at] as string;
  return { char, score: best, margin: lead(char, best, GLYPH_CHARS[runner] ?? '', second) };
}

/** The image's value at (x, y), between pixels by bilinear interpolation; the edge beyond it. */
function sample(g: Gray, x: number, y: number): number {
  const w = g.width;
  const fx = Math.min(w - 1.001, Math.max(0, x));
  const fy = Math.min(g.height - 1.001, Math.max(0, y));
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const ax = fx - x0;
  const ay = fy - y0;
  const i = y0 * w + x0;
  const d = g.data;
  return (
    ((d[i] as number) * (1 - ax) + (d[i + 1] as number) * ax) * (1 - ay) +
    ((d[i + w] as number) * (1 - ax) + (d[i + w + 1] as number) * ax) * ay
  );
}

/** The scales a glyph is also tried at, around the measured one. */
const SCALES = [0.92, 1, 1.08];

/**
 * One slot's glyph: its cell sampled around `base` (the slot's centre on the baseline) along the
 * line's direction `(ux, uy)`, at a few scales and shifts of a sample, each compared with the
 * templates; the best character's best score, and its lead over every other character's best.
 */
function readGlyph(
  g: Gray,
  base: { x: number; y: number },
  ux: number,
  uy: number,
  em: number,
  polarity: Polarity,
): GlyphMatch {
  const best = new Map<string, number>();
  const per = COLS * ROWS;
  const cell = new Float32Array(per);
  const W = COLS + 2;
  const grid = new Float32Array(W * (ROWS + 2));
  for (const s of SCALES) {
    const e = em * s;
    // A sample spans this many pixels: average several points over it when it spans many.
    const step = (e * 0.6) / COLS;
    const sub = Math.min(4, Math.max(1, Math.ceil(step / 1.25)));
    for (let r = 0; r < ROWS + 2; r++)
      for (let c = 0; c < W; c++) {
        const { u, v } = sampleAt(c - 1, r - 1);
        let acc = 0;
        for (let sy = 0; sy < sub; sy++)
          for (let sx = 0; sx < sub; sx++) {
            const du = u * e + ((sx + 0.5) / sub - 0.5) * step;
            const dv = v * e + ((sy + 0.5) / sub - 0.5) * step;
            acc += sample(g, base.x + du * ux - dv * uy, base.y + du * uy + dv * ux);
          }
        const value = acc / (sub * sub);
        grid[r * W + c] = polarity === 'dark' ? 255 - value : value;
      }
    for (let dy = 0; dy <= 2; dy++)
      for (let dx = 0; dx <= 2; dx++) {
        for (let r = 0; r < ROWS; r++)
          for (let c = 0; c < COLS; c++) cell[r * COLS + c] = grid[(r + dy) * W + c + dx] as number;
        const v = normalise(cell);
        const all = templates();
        for (let t = 0; t < all.length; t++) {
          const tpl = all[t] as Float32Array;
          let score = 0;
          for (let i = 0; i < per; i++) score += (v[i] as number) * (tpl[i] as number);
          const ch = GLYPH_CHARS[t] as string;
          if (score > (best.get(ch) ?? -2)) best.set(ch, score);
        }
      }
  }
  let char = '';
  let top = -2;
  let next = '';
  let second = -2;
  for (const [ch, sc] of best) {
    if (sc > top) {
      next = char;
      second = top;
      top = sc;
      char = ch;
    } else if (sc > second) {
      next = ch;
      second = sc;
    }
  }
  return { char, score: top, margin: lead(char, top, next, second) };
}

/** The code the characters spell, if they are six of the alphabet; else null. */
export function codeOf(chars: readonly string[]): string | null {
  const code = chars.join('');
  return chars.length === 6 && SHORT_CODE.test(code) ? code : null;
}

const SLOTS = [0, 1, 2, 4, 5, 6] as const;

/** One found line, read glyph by glyph. */
function readLine(g: Gray, line: readonly Blob[], polarity: Polarity): PrintedRead | null {
  // The slots' centres on a straight line: least squares over slot numbers 0, 1, 2, 4, 5, 6.
  const n = 6;
  const ks: readonly number[] = SLOTS;
  const mk = ks.reduce((a, k) => a + k, 0) / n;
  const xs = line.map(cx);
  const ys = line.map(cy);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let skk = 0;
  let skx = 0;
  let sky = 0;
  ks.forEach((k, i) => {
    skk += (k - mk) ** 2;
    skx += (k - mk) * ((xs[i] as number) - mx);
    sky += (k - mk) * ((ys[i] as number) - my);
  });
  const px = skx / skk;
  const py = sky / skk;
  const pitch = Math.hypot(px, py);
  if (!pitch) return null;
  const ux = px / pitch;
  const uy = py / pitch;
  // The cap height from the boxes, undoing the turn: box = W·|cos| + H·|sin| across, and so on.
  const cos = Math.abs(ux);
  const sin = Math.abs(uy);
  const caps = line.map((b) => (bh(b) * cos - bw(b) * sin) / Math.max(0.5, cos * cos - sin * sin));
  const cap = median(caps);
  if (!(cap > 4)) return null;
  const em = cap / CAP_EM;
  const glyphs = ks.map((k) => {
    // The centre line runs through the middle of the capitals; the baseline is half a cap below.
    const mid = { x: mx + (k - mk) * px, y: my + (k - mk) * py };
    const base = { x: mid.x - uy * (cap / 2), y: mid.y + ux * (cap / 2) };
    return readGlyph(g, base, ux, uy, em, polarity);
  });
  const code = codeOf(glyphs.map((m) => m.char));
  if (!code) return null;
  const score = Math.min(...glyphs.map((m) => m.score));
  const margin = Math.min(...glyphs.map((m) => m.margin));
  if (score < FLOOR_SCORE) return null;
  const x0 = Math.min(...line.map((b) => b.x0));
  const y0 = Math.min(...line.map((b) => b.y0));
  const x1 = Math.max(...line.map((b) => b.x1));
  const y1 = Math.max(...line.map((b) => b.y1));
  return {
    code,
    sure: score >= SURE_SCORE && margin >= SURE_MARGIN,
    score,
    margin,
    box: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 },
  };
}

/**
 * The printed code in a grey image, if there is one: the best-matching line of either polarity,
 * marked sure or not; null when nothing shaped like a code reads as one.
 */
export function readPrintedCode(g: Gray): PrintedRead | null {
  let best: PrintedRead | null = null;
  for (const polarity of ['dark', 'light'] as const) {
    const { blobs } = components(binarise(g, polarity), g.width, g.height);
    for (const line of findCodeLines(blobs)) {
      const read = readLine(g, line, polarity);
      if (read && (!best || read.score > best.score)) best = read;
    }
  }
  return best;
}

/** An RGBA frame (a canvas's `ImageData`) as grey: Rec. 601 luma, in integers. */
export function grayOf(rgba: { width: number; height: number; data: ArrayLike<number> }): Gray {
  const n = rgba.width * rgba.height;
  const data = new Uint8Array(n);
  const d = rgba.data;
  for (let i = 0; i < n; i++)
    data[i] =
      ((d[i * 4] as number) * 77 +
        (d[i * 4 + 1] as number) * 150 +
        (d[i * 4 + 2] as number) * 29) >>
      8;
  return { width: rgba.width, height: rgba.height, data };
}
