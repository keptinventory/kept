/**
 * The glyph templates (./glyphs.ts) as vectors to compare a sampled cell with: each one centred
 * on its mean and scaled to length 1, so comparing two is one dot product, and a cell's
 * brightness and contrast don't count (normalised cross-correlation).
 */
import { COLS, GLYPH_CHARS, ROWS } from './geometry';
import { GLYPHS_BASE64 } from './glyphs';

/** `v` less its mean, at length 1; all zeros when it is flat. */
export function normalise(v: ArrayLike<number>): Float32Array {
  const out = new Float32Array(v.length);
  let mean = 0;
  for (let i = 0; i < v.length; i++) mean += v[i] as number;
  mean /= v.length || 1;
  let sq = 0;
  for (let i = 0; i < v.length; i++) {
    const d = (v[i] as number) - mean;
    out[i] = d;
    sq += d * d;
  }
  const norm = Math.sqrt(sq);
  if (norm > 1e-9) for (let i = 0; i < out.length; i++) out[i] = (out[i] as number) / norm;
  else out.fill(0);
  return out;
}

/** How alike two normalised vectors are: 1 the same, 0 unrelated, −1 opposite. */
export function similarity(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] as number) * (b[i] as number);
  return s;
}

let cache: Float32Array[] | null = null;

/** One normalised template per character of `GLYPH_CHARS`, in its order. */
export function templates(): Float32Array[] {
  if (cache) return cache;
  const bin = atob(GLYPHS_BASE64);
  const per = COLS * ROWS;
  const out: Float32Array[] = [];
  for (let g = 0; g < GLYPH_CHARS.length; g++) {
    const cell = new Float32Array(per);
    for (let k = 0; k < per; k++) {
      const byte = bin.charCodeAt((g * per + k) >> 1);
      cell[k] = k % 2 === 0 ? byte >> 4 : byte & 15;
    }
    out.push(normalise(cell));
  }
  cache = out;
  return out;
}

let pairs: Float32Array | null = null;

/** How alike the templates of characters `i` and `j` (indexes in `GLYPH_CHARS`) are. */
export function likeness(i: number, j: number): number {
  const all = templates();
  const n = all.length;
  if (!pairs) {
    pairs = new Float32Array(n * n);
    for (let a = 0; a < n; a++)
      for (let b = 0; b < n; b++)
        pairs[a * n + b] = similarity(all[a] as Float32Array, all[b] as Float32Array);
  }
  return pairs[i * n + j] as number;
}
