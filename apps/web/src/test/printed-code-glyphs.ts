/**
 * The printed-code recogniser's templates, made from the label's own font (IBM Plex Mono 600, the
 * @fontsource WOFF the app ships): each character of the alphabet drawn large in its cell, then
 * averaged down to the cell's samples and kept at 4 bits. glyphs.test.ts keeps
 * src/camera/printed-code/glyphs.ts equal to what this makes (a file snapshot: `vitest -u` rewrites
 * it after a font or geometry change).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import {
  ADVANCE_EM,
  CELL_BOTTOM_EM,
  CELL_TOP_EM,
  COLS,
  GLYPH_CHARS,
  ROWS,
} from '@/camera/printed-code/geometry';
import { drawText, type Font, plane, readFont } from './font-raster';

const require = createRequire(import.meta.url);
/** A WOFF of an @fontsource package (its exports name only CSS, so found by its LICENSE). */
const fontFile = (pkg: string, file: string) =>
  join(dirname(require.resolve(`@fontsource/${pkg}/LICENSE`)), 'files', `${file}.woff`);

/** IBM Plex Mono 600, as labels print the code. */
export const loadMono = (): Font =>
  readFont(readFileSync(fontFile('ibm-plex-mono', 'ibm-plex-mono-latin-600-normal')));
/** IBM Plex Sans 600, as labels print a name. */
export const loadSans = (): Font =>
  readFont(readFileSync(fontFile('ibm-plex-sans', 'ibm-plex-sans-latin-600-normal')));

/** Pixels a sample is drawn at before it is averaged. */
const SUPER = 16;

/** One character's template: coverage 0–15, row by row. */
export function glyphTemplate(font: Font, ch: string): Uint8Array {
  const em = (COLS * SUPER) / ADVANCE_EM;
  const w = COLS * SUPER;
  const big = plane(w, Math.round((CELL_TOP_EM + CELL_BOTTOM_EM) * em));
  drawText(big, font, { text: ch, size: em, x: 0, y: CELL_TOP_EM * em });
  const out = new Uint8Array(COLS * ROWS);
  const rowPx = big.height / ROWS;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      let sum = 0;
      let n = 0;
      for (let y = Math.floor(r * rowPx); y < Math.floor((r + 1) * rowPx); y++)
        for (let x = c * SUPER; x < (c + 1) * SUPER; x++) {
          sum += Math.min(1, big.data[y * w + x] as number);
          n++;
        }
      out[r * COLS + c] = Math.round((sum / n) * 15);
    }
  return out;
}

/** Every template, two samples a byte (high nibble first), as base64. */
export function glyphTemplatesBase64(font: Font = loadMono()): string {
  const per = COLS * ROWS;
  const bytes = new Uint8Array((GLYPH_CHARS.length * per) / 2);
  [...GLYPH_CHARS].forEach((ch, i) => {
    const t = glyphTemplate(font, ch);
    for (let k = 0; k < per; k += 2)
      bytes[(i * per + k) / 2] = ((t[k] as number) << 4) | (t[k + 1] as number);
  });
  return Buffer.from(bytes).toString('base64');
}

/** The source of src/camera/printed-code/glyphs.ts. */
export function glyphsModule(base64: string = glyphTemplatesBase64()): string {
  const lines = base64.match(/.{1,96}/g) ?? [];
  return `/**
 * The printed code's glyph templates (IBM Plex Mono 600, the alphabet in order): each cell's
 * ${COLS} × ${ROWS} samples of ink coverage at 4 bits, two a byte, as base64. Generated from
 * @fontsource/ibm-plex-mono by src/test/printed-code-glyphs.ts (\`vitest -u\` on glyphs.test.ts
 * rewrites it); don't edit by hand.
 */
export const GLYPHS_BASE64 =
${lines.map((l, i) => `  '${l}'${i === lines.length - 1 ? ';' : ' +'}`).join('\n')}
`;
}
