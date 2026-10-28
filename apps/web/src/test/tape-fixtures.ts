/**
 * Sample photos of tape labels for the printed-code recogniser's tests, drawn here so no image
 * file is committed and every sample is the test's own: the code set in IBM Plex Mono 600 as a
 * tape label prints it (0.06 em apart, or 0 as a PNG prints it; the non-breaking hyphen comes from
 * a fallback face, since Plex Mono has none), sometimes the name beside it in Plex Sans, on tape
 * lying on a table, then turned, blurred, lit unevenly, low in contrast and noisy, dark on light
 * tape or light on dark. Everything follows from a seed, so a failing sample can be drawn again.
 */
import type { Font, Point } from './font-raster';
import { drawText, fillPolygons, plane, textPolygons } from './font-raster';

export type Gray = { width: number; height: number; data: Uint8ClampedArray };

/** mulberry32: a small seeded generator, 0 ≤ n < 1. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type TapePhoto = {
  /** What is printed: six characters (any, so a sample can hold a near-miss), or other text. */
  text: string;
  /** Print the text as a code (three, a hyphen, three) or as it is. */
  asCode?: boolean;
  /** The code's cap height in the photo, in pixels. */
  capPx: number;
  /** Turned clockwise, in degrees. */
  angle?: number;
  /** Box-blur radius in pixels (two passes, close to a Gaussian). */
  blur?: number;
  /** Noise, as a standard deviation in grey levels. */
  noise?: number;
  /** Ink against tape: 1 is black on white, lower is a faded print or a poor exposure. */
  contrast?: number;
  /** How much darker one side of the photo is (0–1). */
  light?: number;
  /** Light ink on dark tape (white on black TZe). */
  inverted?: boolean;
  /** The name printed beside the code, in Plex Sans. */
  name?: string;
  /** Space after each character, in em: 0.06 as a label prints, 0 as a PNG does. */
  spacing?: number;
  /** The hyphen's look (it comes from another face): Plex Mono's own, wide, or short and thin. */
  hyphen?: 'plex' | 'wide' | 'thin';
  width?: number;
  height?: number;
  /** Where the label sits, as a fraction of the free room (0.5 is the centre). */
  at?: { x: number; y: number };
  seed?: number;
};

const rect = (x: number, y: number, w: number, h: number): Point[] => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

function turn(points: Point[], o: Point, deg: number): Point[] {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return points.map((p) => ({
    x: o.x + (p.x - o.x) * c - (p.y - o.y) * s,
    y: o.y + (p.x - o.x) * s + (p.y - o.y) * c,
  }));
}

function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r <= 0) return src;
  const out = new Float32Array(src.length);
  const tmp = new Float32Array(src.length);
  const rad = Math.max(1, Math.round(r));
  const pass = (from: Float32Array, to: Float32Array, horizontal: boolean) => {
    const n = horizontal ? w : h;
    const lines = horizontal ? h : w;
    for (let line = 0; line < lines; line++) {
      for (let i = 0; i < n; i++) {
        let sum = 0;
        let count = 0;
        for (let k = -rad; k <= rad; k++) {
          const j = Math.min(n - 1, Math.max(0, i + k));
          sum += from[horizontal ? line * w + j : j * w + line] as number;
          count++;
        }
        to[horizontal ? line * w + i : i * w + line] = sum / count;
      }
    }
  };
  pass(src, tmp, true);
  pass(tmp, out, false);
  if (r < 1) {
    // A softer blur: part way between the image and one pass.
    for (let i = 0; i < out.length; i++)
      out[i] = (src[i] as number) * (1 - r) + (out[i] as number) * r;
  }
  return out;
}

/** A photo of a tape label (or of any text set the same way). */
export function tapePhoto(mono: Font, sans: Font, o: TapePhoto): Gray {
  const rnd = seeded(o.seed ?? 1);
  const width = o.width ?? 480;
  const height = o.height ?? 320;
  const em = o.capPx / 0.698;
  const pitch = (0.6 + (o.spacing ?? 0.06)) * em;
  const angle = o.angle ?? 0;

  // The label's parts in label space: the code, then the name, on a tape strip around them.
  const glyphs: Point[][] = [];
  let pen = 0;
  const chars = [...o.text];
  const asCode = o.asCode ?? true;
  const hyphenAt = asCode ? 3 : -1;
  chars.forEach((ch, i) => {
    if (i === hyphenAt) {
      const kind = o.hyphen ?? 'plex';
      if (kind === 'plex')
        glyphs.push(...textPolygons(mono, { text: '-', size: em, x: pen, y: 0 }).polygons);
      else {
        const w = kind === 'wide' ? 0.5 * em : 0.3 * em;
        const t = kind === 'wide' ? 0.1 * em : 0.06 * em;
        glyphs.push(rect(pen + (0.6 * em - w) / 2, -0.3 * em - t / 2, w, t));
      }
      pen += pitch;
    }
    glyphs.push(...textPolygons(mono, { text: ch, size: em, x: pen, y: 0 }).polygons);
    pen += pitch;
  });
  const codeWidth = pen;
  let nameWidth = 0;
  const nameSize = 0.42 * em;
  if (o.name) {
    const { polygons, advance } = textPolygons(sans, {
      text: o.name,
      size: nameSize,
      x: codeWidth + 0.5 * em,
      y: -0.35 * em + nameSize * 0.35,
    });
    glyphs.push(...polygons);
    nameWidth = advance + 0.5 * em;
  }
  const tapeH = 2.1 * em;
  const marginX = 0.7 * em;
  const labelW = codeWidth + nameWidth + 2 * marginX;
  // Where the label goes: its centre somewhere the turned label still fits, roughly.
  const free = { x: Math.max(0, width - labelW), y: Math.max(0, height - tapeH * 1.6) };
  const at = o.at ?? { x: 0.3 + rnd() * 0.4, y: 0.3 + rnd() * 0.4 };
  const cx = labelW / 2 + free.x * at.x;
  const cy = tapeH * 0.8 + free.y * at.y;
  // Label space → photo: the code's baseline is 0.35 em below the tape's middle.
  const ox = cx - labelW / 2 + marginX;
  const oy = cy + 0.35 * em;
  const place = (pts: Point[]) =>
    turn(
      pts.map((p) => ({ x: p.x + ox, y: p.y + oy })),
      { x: cx, y: cy },
      angle,
    );

  const tapeMask = plane(width, height);
  fillPolygons(tapeMask, [place(rect(-marginX, -0.35 * em - tapeH / 2, labelW, tapeH))]);
  const ink = plane(width, height);
  fillPolygons(ink, glyphs.map(place));

  const inverted = o.inverted ?? false;
  const contrast = o.contrast ?? 1;
  const tape = inverted ? 28 + rnd() * 20 : 215 + rnd() * 30;
  const inkTone = inverted ? tape + contrast * (235 - tape) : tape - contrast * (tape - 18);
  const table = 70 + rnd() * 90;
  const light = o.light ?? 0;
  const dir = rnd() * Math.PI * 2;
  const dx = Math.cos(dir);
  const dy = Math.sin(dir);

  let img: Float32Array = new Float32Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const t = Math.min(1, tapeMask.data[i] as number);
      const c = Math.min(1, ink.data[i] as number);
      // A little texture on the table, none on the tape.
      const ground = table + 8 * Math.sin(x * 0.07 + y * 0.03) + 5 * Math.sin(y * 0.11);
      let v = ground * (1 - t) + (tape * (1 - c) + inkTone * c) * t;
      // Uneven light: darker towards one side.
      const g = 0.5 + 0.5 * (((x / width - 0.5) * dx + (y / height - 0.5) * dy) * 1.4);
      v *= 1 - light * Math.min(1, Math.max(0, g));
      img[i] = v;
    }
  img = boxBlur(img, width, height, o.blur ?? 0);
  const noise = o.noise ?? 0;
  const data = new Uint8ClampedArray(width * height);
  for (let i = 0; i < img.length; i++) {
    let v = img[i] as number;
    if (noise > 0) {
      const u = Math.max(1e-9, rnd());
      v += noise * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
    }
    data[i] = v;
  }
  return { width, height, data };
}

/** A photo with no code in it: a label of words, product-like bars, or the table alone. */
export function clutterPhoto(
  mono: Font,
  sans: Font,
  kind: 'words' | 'bars' | 'table',
  seed: number,
): Gray {
  const rnd = seeded(seed);
  const width = 480;
  const height = 320;
  const ink = plane(width, height);
  if (kind === 'words') {
    const words = ['Garden shears', 'Spare keys', 'HDMI cable', 'Box 12', 'Batteries AA'];
    for (let k = 0; k < 3; k++)
      drawText(ink, k === 1 ? mono : sans, {
        text: words[Math.floor(rnd() * words.length)] as string,
        size: 22 + rnd() * 30,
        x: 20 + rnd() * 120,
        y: 70 + k * 90,
        angle: (rnd() - 0.5) * 10,
      });
  } else if (kind === 'bars') {
    let x = 60;
    while (x < 420) {
      const w = 1 + Math.floor(rnd() * 4);
      fillPolygons(ink, [rect(x, 90, w, 140)]);
      x += w + 1 + Math.floor(rnd() * 4);
    }
  }
  const data = new Uint8ClampedArray(width * height);
  for (let i = 0; i < data.length; i++)
    data[i] = 230 - 200 * Math.min(1, ink.data[i] as number) + (rnd() - 0.5) * 10;
  return { width, height, data };
}
