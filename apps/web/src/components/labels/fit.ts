/**
 * Fitting a label's name and place into the text column beside its QR (on narrow tape, beside its
 * code), never cutting them: the text wraps at spaces (a word wider than the column breaks between
 * letters, so a CJK name or one long word still wraps), and when the lines are taller than the
 * label the font steps down, 0.1 mm at a time, to the readable minimum (2.2 mm for the name,
 * 2.0 mm for the place, about 6 pt).
 * A label that still doesn't fit at the minimum is reported (`fits: false`, `labelsTooLong`) so
 * the builder can list it before anything prints; its text is never dropped or ended with "…".
 *
 * The lines are worked out here, once, and every renderer draws exactly these lines: the print
 * sheet, the builder's preview (the same `LabelCell`, scaled) and the phone PNGs. Widths come from
 * the label's own faces through a canvas (`useLabelMeasure`), with an estimate where there is no
 * canvas (tests, an old browser).
 */
import type { LabelStock } from '@kept/shared';
import { useMemo, useSyncExternalStore } from 'react';
import type { LabelCellContent } from '@/api/capture/types';
import { cellMetrics, LABEL_SANS, NAME_MIN, PATH_MIN } from './layout';

export { NAME_MIN, PATH_MIN };

/** Line height of the name and place lines, in em. */
export const FIT_LINE_HEIGHT = 1.2;
/** How far the font steps down each time, in mm. */
const STEP = 0.1;
/**
 * The share of the column the lines may fill: a canvas and the page's own layout can measure the
 * same text a hair apart, and this keeps a line from touching the column's edge either way.
 */
const SLACK = 0.97;

/** A text's width in mm at `size` mm (the em box), in the label's sans face. */
export type TextMeasure = (text: string, size: number, weight?: 400 | 600) => number;

export type FittedText = { lines: string[]; size: number };
export type LabelFit = { name: FittedText | null; path: FittedText | null; fits: boolean };

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

/** A word's user-perceived characters: a letter with its marks, an emoji sequence. */
function graphemes(word: string): string[] {
  return segmenter ? Array.from(segmenter.segment(word), (s) => s.segment) : Array.from(word);
}

/**
 * Greedy wrap at spaces into lines no wider than `width`; a word wider than the line breaks
 * between its characters. Every word is kept: the lines joined with a space (or, for a broken
 * word, with nothing) are the text.
 */
export function wrapLines(text: string, width: number, widthOf: (s: string) => number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (widthOf(next) <= width) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = '';
    if (widthOf(word) <= width) {
      line = word;
      continue;
    }
    let chunk = '';
    for (const g of graphemes(word)) {
      if (chunk && widthOf(chunk + g) > width) {
        lines.push(chunk);
        chunk = g;
      } else chunk += g;
    }
    line = chunk;
  }
  if (line) lines.push(line);
  return lines;
}

/** Down to a hundredth of a millimetre, as the label's CSS sets it. */
const floor2 = (n: number) => Math.floor(n * 100 + 1e-6) / 100;

/** The name's and place's lines and sizes for one label on `stock`. */
export function fitLabel(
  stock: LabelStock,
  text: { name?: string; path?: string },
  measure: TextMeasure,
): LabelFit {
  const m = cellMetrics(stock);
  const name = text.name?.trim() ?? '';
  const path = m.place ? (text.path?.trim() ?? '') : '';
  if (m.compact || (!name && !path)) return { name: null, path: null, fits: true };
  const width = m.text * SLACK;
  const room = stock.cell.h - 2 * m.pad;
  const gap = m.pad * 0.6;
  // The code heads the text column, except on narrow tape, where it has a column of its own.
  const above = m.codeColumn ? 0 : m.code;
  for (let k = 0; ; k++) {
    const ns = k === 0 ? m.name : Math.max(NAME_MIN, floor2(m.name - STEP * k));
    const ps = k === 0 ? m.path : Math.max(PATH_MIN, floor2(m.path - STEP * k * (m.path / m.name)));
    const nl = name ? wrapLines(name, width, (s) => measure(s, ns, 600)) : [];
    const pl = path ? wrapLines(path, width, (s) => measure(s, ps, 400)) : [];
    let height = above;
    for (const [lines, size] of [
      [nl, ns],
      [pl, ps],
    ] as const)
      if (lines.length) height += (height > 0 ? gap : 0) + lines.length * size * FIT_LINE_HEIGHT;
    const fits = height <= room + 1e-9;
    if (fits || (ns <= NAME_MIN && ps <= PATH_MIN)) {
      return {
        name: name ? { lines: nl, size: ns } : null,
        path: path ? { lines: pl, size: ps } : null,
        fits,
      };
    }
  }
}

/** The labels whose name and place don't fit `stock` even at the minimum, in print order. */
export function labelsTooLong(
  stock: LabelStock,
  labels: readonly LabelCellContent[],
  measure: TextMeasure,
): LabelCellContent[] {
  return labels.filter((l) => !fitLabel(stock, l, measure).fits);
}

/**
 * A width estimate in em per character, for when there is no canvas: wide letters, narrow
 * letters, CJK and fullwidth forms a full em, spaces narrow; semibold a little wider.
 */
export function estimateWidth(text: string, size: number, weight: 400 | 600 = 600): number {
  let em = 0;
  for (const ch of text) {
    if (/\s/.test(ch)) em += 0.26;
    else if (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠]/.test(ch)) em += 1;
    else if (/[MWmw@%]/.test(ch)) em += 0.82;
    else if (/[A-Z0-9]/.test(ch)) em += 0.62;
    else if (/[iljtf.,:;'!|()[\]]/.test(ch)) em += 0.3;
    else em += 0.52;
  }
  return em * size * (weight === 600 ? 1.04 : 1);
}

// ---------------------------------------------------------------------------------------------
// Measuring in the browser: the label's faces through a canvas, once they have loaded.

type Ctx2d = { font: string; measureText: (s: string) => { width: number } };
let ctx: Ctx2d | null | undefined;
const widths = new Map<string, number>();
let version = 0;
let started = false;
/** The faces `loadLabelFaces` asks for have loaded (or failed to: the fallback is final). */
let facesLoaded = false;
const listeners = new Set<() => void>();

function context(): Ctx2d | null {
  if (ctx !== undefined) return ctx;
  try {
    ctx =
      typeof OffscreenCanvas === 'undefined'
        ? null
        : (new OffscreenCanvas(1, 1).getContext('2d') as Ctx2d | null);
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Measures in the label's faces where there is a canvas, else estimates. */
export const canvasMeasure: TextMeasure = (text, size, weight = 600) => {
  const c = context();
  if (!c) return estimateWidth(text, size, weight);
  const key = `${weight}|${text}`;
  let w = widths.get(key);
  if (w === undefined) {
    c.font = `${weight} 100px ${LABEL_SANS}`;
    w = c.measureText(text).width / 100;
    widths.set(key, w);
  }
  return w * size;
};

/** Loads the faces a label is set in; a canvas never waits for a font on its own. */
export async function loadLabelFaces() {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all([
    document.fonts.load(`600 10px "IBM Plex Mono"`, '7KQ‑4MZ'),
    document.fonts.load(`600 10px "IBM Plex Sans"`, 'Aa'),
    document.fonts.load(`400 10px "IBM Plex Sans"`, 'Aa'),
    document.fonts.load(`600 10px "IBM Plex Sans Arabic"`, 'بيت'),
    document.fonts.load(`400 10px "IBM Plex Sans Arabic"`, 'بيت'),
  ]).catch(() => undefined);
}

const hasFonts = () => typeof document !== 'undefined' && !!document.fonts;

function remeasure() {
  widths.clear();
  version += 1;
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!started) {
    started = true;
    if (hasFonts()) {
      void loadLabelFaces().then(() => {
        facesLoaded = true;
        remeasure();
      });
      document.fonts.addEventListener('loadingdone', remeasure);
    }
  }
  return () => listeners.delete(listener);
}

/**
 * The browser's measure for fitting labels, new each time the label's faces finish loading (so
 * every label fits again in the real faces), and whether they have loaded: print once `ready`.
 */
export function useLabelMeasure(): { measure: TextMeasure; ready: boolean } {
  const v = useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new measure for each version
  const measure = useMemo<TextMeasure>(() => (t, s, w) => canvasMeasure(t, s, w), [v]);
  return { measure, ready: !hasFonts() || (v > 0 && facesLoaded) };
}
