/**
 * The printed code's geometry, in em of the label's mono face (IBM Plex Mono, 600): what the
 * recogniser measures a glyph against, and the cell its templates (./glyphs.ts) are drawn in. The
 * template maker (src/test/printed-code-glyphs.ts) and the recogniser read these same numbers, so a template and a glyph sampled off
 * a photo line up.
 */

/** Plex Mono's cap height: every character of the alphabet is a capital or a digit. */
export const CAP_EM = 0.698;
/** Plex Mono's advance. A label sets the code 0.06 em apart (label-cell.tsx); a PNG doesn't. */
export const ADVANCE_EM = 0.6;

/** A glyph's cell: the advance wide, from `CELL_TOP_EM` above the baseline to `CELL_BOTTOM_EM`
 * below it (Q's tail). */
export const CELL_TOP_EM = 0.8;
export const CELL_BOTTOM_EM = 0.12;
/** Samples across and down a cell. */
export const COLS = 12;
export const ROWS = 18;

/** The characters a template exists for: the short-ID alphabet (no I, L, O or U), in its order
 * (a test holds it to @kept/shared's `ALPHABET`). */
export const GLYPH_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Where sample (col, row) sits, in em from the slot's centre on the baseline (y down). */
export function sampleAt(col: number, row: number): { u: number; v: number } {
  return {
    u: -ADVANCE_EM / 2 + ((col + 0.5) * ADVANCE_EM) / COLS,
    v: -CELL_TOP_EM + ((row + 0.5) * (CELL_TOP_EM + CELL_BOTTOM_EM)) / ROWS,
  };
}
