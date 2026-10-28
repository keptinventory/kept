/**
 * A small TrueType reader and rasteriser, for tests and build scripts only (never bundled): the
 * printed-code recogniser's glyph templates are made from the label's own font with it
 * (scripts/printed-code-glyphs.ts), and the recogniser's tests draw sample tape labels with it, in
 * that font, at any size and angle, without a canvas or a system font.
 *
 * Reads a WOFF 1.0 file (the @fontsource files the app ships), simple and composite `glyf`
 * outlines, `cmap` formats 4 and 12, and draws with the non-zero winding rule, anti-aliased
 * (each pixel row is sampled on several sub-rows, each span's ends fractional). Erasable
 * TypeScript only, so Node runs it as it is.
 */
import { inflateSync } from 'node:zlib';

export type Point = { x: number; y: number };
/** A glyph's closed contours in font units, y up. */
export type Outline = Point[][];

export type Font = {
  unitsPerEm: number;
  ascender: number;
  descender: number;
  capHeight: number;
  /** The glyph id for a character; 0 (.notdef) when the font has none. */
  glyphOf: (ch: string) => number;
  advanceOf: (glyph: number) => number;
  outlineOf: (glyph: number) => Outline;
};

/** The tables of a WOFF 1.0 file, each inflated. */
function woffTables(woff: Uint8Array): Map<string, DataView> {
  const v = new DataView(woff.buffer, woff.byteOffset, woff.byteLength);
  if (v.getUint32(0) !== 0x774f4646) throw new Error('not a WOFF 1.0 file');
  const n = v.getUint16(12);
  const tables = new Map<string, DataView>();
  for (let i = 0; i < n; i++) {
    const o = 44 + i * 20;
    const tag = String.fromCharCode(
      v.getUint8(o),
      v.getUint8(o + 1),
      v.getUint8(o + 2),
      v.getUint8(o + 3),
    );
    const offset = v.getUint32(o + 4);
    const comp = v.getUint32(o + 8);
    const orig = v.getUint32(o + 12);
    const raw = woff.subarray(offset, offset + comp);
    const data = comp < orig ? new Uint8Array(inflateSync(raw)) : raw;
    tables.set(tag, new DataView(data.buffer, data.byteOffset, data.byteLength));
  }
  return tables;
}

function need(tables: Map<string, DataView>, tag: string): DataView {
  const t = tables.get(tag);
  if (!t) throw new Error(`font has no ${tag} table`);
  return t;
}

/** Character → glyph, from the Unicode subtable (format 12 if there is one, else 4). */
function readCmap(cmap: DataView): (code: number) => number {
  const n = cmap.getUint16(2);
  let f4 = -1;
  let f12 = -1;
  for (let i = 0; i < n; i++) {
    const platform = cmap.getUint16(4 + i * 8);
    const encoding = cmap.getUint16(6 + i * 8);
    const offset = cmap.getUint32(8 + i * 8);
    const format = cmap.getUint16(offset);
    const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    if (!unicode) continue;
    if (format === 12) f12 = offset;
    if (format === 4) f4 = offset;
  }
  if (f12 >= 0) {
    const groups = cmap.getUint32(f12 + 12);
    return (code) => {
      for (let g = 0; g < groups; g++) {
        const o = f12 + 16 + g * 12;
        const start = cmap.getUint32(o);
        const end = cmap.getUint32(o + 4);
        if (code >= start && code <= end) return cmap.getUint32(o + 8) + (code - start);
      }
      return 0;
    };
  }
  if (f4 < 0) throw new Error('font has no Unicode cmap');
  const segs = cmap.getUint16(f4 + 6) / 2;
  const ends = f4 + 14;
  const starts = ends + segs * 2 + 2;
  const deltas = starts + segs * 2;
  const ranges = deltas + segs * 2;
  return (code) => {
    for (let s = 0; s < segs; s++) {
      if (code > cmap.getUint16(ends + s * 2)) continue;
      const start = cmap.getUint16(starts + s * 2);
      if (code < start) return 0;
      const delta = cmap.getInt16(deltas + s * 2);
      const rangeAt = ranges + s * 2;
      const range = cmap.getUint16(rangeAt);
      if (range === 0) return (code + delta) & 0xffff;
      const g = cmap.getUint16(rangeAt + range + (code - start) * 2);
      return g === 0 ? 0 : (g + delta) & 0xffff;
    }
    return 0;
  };
}

/** A contour's points (on and off the curve) as a polygon: each quadratic curve flattened. */
function flatten(points: { x: number; y: number; on: boolean }[]): Point[] {
  if (points.length === 0) return [];
  // Start on an on-curve point (or the midpoint of two off-curve ones).
  let start = points.findIndex((p) => p.on);
  const pts = points.slice();
  if (start < 0) {
    const a = pts[0] as { x: number; y: number; on: boolean };
    const b = pts[1] ?? a;
    pts.unshift({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, on: true });
    start = 0;
  }
  const ring = [...pts.slice(start), ...pts.slice(0, start)];
  const first = ring[0] as { x: number; y: number };
  const out: Point[] = [{ x: first.x, y: first.y }];
  let prev = first;
  let ctrl: { x: number; y: number } | null = null;
  const curve = (c: { x: number; y: number }, to: { x: number; y: number }) => {
    for (let k = 1; k <= 8; k++) {
      const t = k / 8;
      const u = 1 - t;
      out.push({
        x: u * u * prev.x + 2 * u * t * c.x + t * t * to.x,
        y: u * u * prev.y + 2 * u * t * c.y + t * t * to.y,
      });
    }
  };
  for (let i = 1; i <= ring.length; i++) {
    const p = ring[i % ring.length] as { x: number; y: number; on: boolean };
    if (p.on) {
      if (ctrl) curve(ctrl, p);
      else out.push({ x: p.x, y: p.y });
      prev = p;
      ctrl = null;
    } else if (ctrl) {
      const mid = { x: (ctrl.x + p.x) / 2, y: (ctrl.y + p.y) / 2 };
      curve(ctrl, mid);
      prev = mid;
      ctrl = p;
    } else ctrl = p;
  }
  return out;
}

/** Reads a WOFF 1.0 font. */
export function readFont(woff: Uint8Array): Font {
  const tables = woffTables(woff);
  const head = need(tables, 'head');
  const hhea = need(tables, 'hhea');
  const maxp = need(tables, 'maxp');
  const hmtx = need(tables, 'hmtx');
  const loca = need(tables, 'loca');
  const glyf = need(tables, 'glyf');
  const os2 = tables.get('OS/2');
  const unitsPerEm = head.getUint16(18);
  const longLoca = head.getInt16(50) === 1;
  const numGlyphs = maxp.getUint16(4);
  const numMetrics = hhea.getUint16(34);
  const cmap = readCmap(need(tables, 'cmap'));
  const offsetOf = (g: number) => (longLoca ? loca.getUint32(g * 4) : loca.getUint16(g * 2) * 2);

  const outlineOf = (g: number, depth = 0): Outline => {
    if (g < 0 || g >= numGlyphs || depth > 8) return [];
    const at = offsetOf(g);
    if (offsetOf(g + 1) === at) return [];
    const contours = glyf.getInt16(at);
    if (contours < 0) {
      // A composite: its parts, each moved (and scaled, if it says so).
      const out: Outline = [];
      let o = at + 10;
      for (;;) {
        const flags = glyf.getUint16(o);
        const part = glyf.getUint16(o + 2);
        o += 4;
        let dx: number;
        let dy: number;
        if (flags & 1) {
          dx = glyf.getInt16(o);
          dy = glyf.getInt16(o + 2);
          o += 4;
        } else {
          dx = glyf.getInt8(o);
          dy = glyf.getInt8(o + 1);
          o += 2;
        }
        let a = 1;
        let b = 0;
        let c = 0;
        let d = 1;
        const f2 = (p: number) => glyf.getInt16(p) / 16384;
        if (flags & 0x8) {
          a = d = f2(o);
          o += 2;
        } else if (flags & 0x40) {
          a = f2(o);
          d = f2(o + 2);
          o += 4;
        } else if (flags & 0x80) {
          a = f2(o);
          b = f2(o + 2);
          c = f2(o + 4);
          d = f2(o + 6);
          o += 8;
        }
        if (!(flags & 2)) throw new Error('composite glyphs placed by points are not read');
        for (const contour of outlineOf(part, depth + 1))
          out.push(contour.map((p) => ({ x: a * p.x + c * p.y + dx, y: b * p.x + d * p.y + dy })));
        if (!(flags & 0x20)) break;
      }
      return out;
    }
    const ends: number[] = [];
    for (let i = 0; i < contours; i++) ends.push(glyf.getUint16(at + 10 + i * 2));
    const count = (ends[ends.length - 1] ?? -1) + 1;
    let o = at + 10 + contours * 2;
    o += 2 + glyf.getUint16(o);
    const flags: number[] = [];
    while (flags.length < count) {
      const f = glyf.getUint8(o++);
      flags.push(f);
      if (f & 8) {
        const repeat = glyf.getUint8(o++);
        for (let r = 0; r < repeat; r++) flags.push(f);
      }
    }
    const coords = (short: number, same: number) => {
      const out: number[] = [];
      let v = 0;
      for (const f of flags) {
        if (f & short) {
          const d = glyf.getUint8(o++);
          v += f & same ? d : -d;
        } else if (!(f & same)) {
          v += glyf.getInt16(o);
          o += 2;
        }
        out.push(v);
      }
      return out;
    };
    const xs = coords(2, 16);
    const ys = coords(4, 32);
    const out: Outline = [];
    let from = 0;
    for (const end of ends) {
      const pts = [];
      for (let i = from; i <= end; i++)
        pts.push({ x: xs[i] as number, y: ys[i] as number, on: ((flags[i] as number) & 1) === 1 });
      out.push(flatten(pts));
      from = end + 1;
    }
    return out;
  };

  return {
    unitsPerEm,
    ascender: hhea.getInt16(4),
    descender: hhea.getInt16(6),
    capHeight: os2 && os2.getUint16(0) >= 2 ? os2.getInt16(88) : Math.round(unitsPerEm * 0.7),
    glyphOf: (ch) => cmap(ch.codePointAt(0) ?? 0),
    advanceOf: (g) => hmtx.getUint16(Math.min(g, numMetrics - 1) * 4),
    outlineOf: (g) => outlineOf(g),
  };
}

/** A float image: one coverage or grey value per pixel, row by row. */
export type Plane = { width: number; height: number; data: Float32Array };

export const plane = (width: number, height: number, fill = 0): Plane => ({
  width,
  height,
  data: new Float32Array(width * height).fill(fill),
});

/**
 * Adds the polygons' coverage (0–1, non-zero winding) to `into`, `rows` sub-rows a pixel.
 * Coordinates are pixels, y down.
 */
export function fillPolygons(into: Plane, polygons: Point[][], rows = 6): void {
  const edges: { x0: number; y0: number; x1: number; y1: number; dir: number }[] = [];
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const poly of polygons)
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i] as Point;
      const b = poly[(i + 1) % poly.length] as Point;
      if (a.y === b.y) continue;
      const down = a.y < b.y;
      edges.push(
        down
          ? { x0: a.x, y0: a.y, x1: b.x, y1: b.y, dir: 1 }
          : { x0: b.x, y0: b.y, x1: a.x, y1: a.y, dir: -1 },
      );
      top = Math.min(top, a.y, b.y);
      bottom = Math.max(bottom, a.y, b.y);
    }
  const r0 = Math.max(0, Math.floor(top));
  const r1 = Math.min(into.height - 1, Math.ceil(bottom));
  const w = into.width;
  const xs: { x: number; dir: number }[] = [];
  for (let r = r0; r <= r1; r++) {
    for (let s = 0; s < rows; s++) {
      const y = r + (s + 0.5) / rows;
      xs.length = 0;
      for (const e of edges)
        if (y >= e.y0 && y < e.y1)
          xs.push({ x: e.x0 + ((y - e.y0) / (e.y1 - e.y0)) * (e.x1 - e.x0), dir: e.dir });
      xs.sort((p, q) => p.x - q.x);
      let wind = 0;
      for (let i = 0; i < xs.length - 1; i++) {
        wind += (xs[i] as { dir: number }).dir;
        if (wind === 0) continue;
        const a = Math.max(0, (xs[i] as { x: number }).x);
        const b = Math.min(w, (xs[i + 1] as { x: number }).x);
        if (b <= a) continue;
        const weight = 1 / rows;
        const ia = Math.floor(a);
        const ib = Math.floor(b);
        const row = r * w;
        if (ia === ib) {
          into.data[row + ia] = (into.data[row + ia] as number) + (b - a) * weight;
          continue;
        }
        into.data[row + ia] = (into.data[row + ia] as number) + (ia + 1 - a) * weight;
        for (let x = ia + 1; x < ib; x++)
          into.data[row + x] = (into.data[row + x] as number) + weight;
        if (ib < w) into.data[row + ib] = (into.data[row + ib] as number) + (b - ib) * weight;
      }
    }
  }
}

export type TextRun = {
  text: string;
  /** The em size in pixels. */
  size: number;
  /** The baseline's start, in pixels. */
  x: number;
  y: number;
  /** Extra space after each character, in em (the label sets the code 0.06 em apart). */
  letterSpacing?: number;
  /** Turned clockwise about (x, y), in degrees. */
  angle?: number;
};

/** A run of text as polygons in pixels (y down), and its advance in pixels. */
export function textPolygons(font: Font, run: TextRun): { polygons: Point[][]; advance: number } {
  const k = run.size / font.unitsPerEm;
  const rad = ((run.angle ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const polygons: Point[][] = [];
  let pen = 0;
  for (const ch of run.text) {
    const g = font.glyphOf(ch);
    for (const contour of font.outlineOf(g))
      polygons.push(
        contour.map((p) => {
          const lx = pen + p.x * k;
          const ly = -p.y * k;
          return { x: run.x + lx * cos - ly * sin, y: run.y + lx * sin + ly * cos };
        }),
      );
    pen += font.advanceOf(g) * k + (run.letterSpacing ?? 0) * run.size;
  }
  return { polygons, advance: pen };
}

/** Draws a run of text's coverage into `into` (added, so clamp when you read it). */
export function drawText(into: Plane, font: Font, run: TextRun): number {
  const { polygons, advance } = textPolygons(font, run);
  fillPolygons(into, polygons);
  return advance;
}
