/**
 * Where each label goes and how big its parts are (D44, D134, D175, D185). Pure, so the
 * print sheet (sheet.tsx), the builder's preview and the phone PNG (png.ts) share one geometry
 * and the tests can pin it per stock.
 *
 * All lengths are millimetres. A sheet is physical paper: its cells run left to right from the
 * top-left corner in every language, like the maker's numbering, so the sheet is laid out LTR
 * and only the names inside a label follow their own direction (`dir=auto`, D97).
 */
import { cellsFor, hasQr, isSheet, isTape, type LabelCell, type LabelStock } from '@kept/shared';
import type { LabelCellContent } from '@/api/capture/types';

/** The label's faces: Plex Sans with Plex Sans Arabic for Arabic names (D97), Plex Mono for codes. */
export const LABEL_SANS = '"IBM Plex Sans", "IBM Plex Sans Arabic", sans-serif';
export const LABEL_MONO = '"IBM Plex Mono", monospace';

/** A CSS length in millimetres, rounded to a hundredth so snapshots stay readable. */
export const mm = (n: number) => `${Math.round(n * 100) / 100}mm`;

/** CSS pixels per millimetre (96 per inch). */
export const PX_PER_MM = 96 / 25.4;

/** The paper by name where it has one, so the print dialog picks that paper itself. */
function pageSize(stock: LabelStock): string {
  const { w, h } = stock.page;
  if (w === 210 && h === 297) return 'A4';
  if (w === 215.9 && h === 279.4) return 'letter';
  return `${mm(w)} ${mm(h)}`;
}

/**
 * The one `@page` rule a print view installs for its stock: the paper, and no margin, so the
 * browser's default settings (Margins "Default", scale 100 %) print each label in its cell.
 */
export function pageCss(stock: LabelStock): string {
  return `@page { size: ${pageSize(stock)}; margin: 0; }`;
}

export type PlacedLabel = { label: LabelCellContent; cell: LabelCell };

/**
 * The labels on their pages, from `startCell` (1-based, sheets only; a roll ignores it). Pages
 * with no label are never produced, so a start cell near the end of a sheet can't print a blank
 * page first.
 */
export function placeLabels(
  stock: LabelStock,
  labels: readonly LabelCellContent[],
  startCell = 1,
): PlacedLabel[][] {
  const { pages, cells } = cellsFor(stock, labels.length, isSheet(stock) ? startCell : 1);
  const out: PlacedLabel[][] = Array.from({ length: pages }, () => []);
  cells.forEach((cell, i) => {
    const label = labels[i];
    if (label) out[cell.page]?.push({ label, cell });
  });
  return out;
}

/** Cells per page: 1 on a roll. */
export const perPage = (stock: LabelStock) => stock.cols * stock.rows;

/** The pages `count` labels take from `startCell`, without placing them. */
export function pagesFor(stock: LabelStock, count: number, startCell = 1): number {
  if (count <= 0) return 0;
  const offset = isSheet(stock) ? startCell - 1 : 0;
  return Math.ceil((offset + count) / perPage(stock));
}

/** "Row 4, column 1" for a 1-based cell on a sheet. */
export function rowColOf(stock: LabelStock, cell: number): { row: number; col: number } {
  return { row: Math.floor((cell - 1) / stock.cols) + 1, col: ((cell - 1) % stock.cols) + 1 };
}

export type CellMetrics = {
  /** Inner padding on every side. */
  pad: number;
  /** The QR's side, quiet zone included; 0 on tape too narrow for one. */
  qr: number;
  /**
   * On tape with no QR, the code's own column, before the text column; 0 where the code sits at
   * the top of the text column.
   */
  codeColumn: number;
  /** The text column's width, beside the QR (or the code). */
  text: number;
  /**
   * Font sizes (the em box): the code; the name and the place they start at, before a long one
   * steps down towards `NAME_MIN` and `PATH_MIN` (fit.ts).
   */
  code: number;
  name: number;
  path: number;
  /** A compact stock prints only the QR and the code. */
  compact: boolean;
  /** Whether the place prints: not on a compact stock, nor on tape. */
  place: boolean;
};

/** The smallest name and place a label sets, in mm (about 6.2 pt and 5.7 pt): still readable. */
export const NAME_MIN = 2.2;
export const PATH_MIN = 2.0;

/** The place line's ink: near-black, so it reads on paper. */
export const PLACE_INK = '#222222';

/** The space between the code's characters, in em: the HTML label and the PNG both set it. */
export const CODE_TRACKING = 0.06;

/** Plex Mono's advance is 0.6 em; the code is set 0.06 em apart, 7 characters with the hyphen. */
const CODE_EM = 7 * 0.66;

/** Down to a hundredth of a millimetre, so the CSS sets exactly the size the fit worked with. */
const floor2 = (n: number) => Math.floor(n * 100 + 1e-6) / 100;

/**
 * The parts of one label, scaled from the designs' 40 × 30 mm label (D134: QR, the code large in
 * mono, the name, the place). The code never wraps: it shrinks to fit the text column. The name
 * starts at about a tenth of the label's height (never larger than four fifths of the code), the
 * place at four fifths of the name; fit.ts steps both down when a long one needs it.
 */
export function cellMetrics(stock: LabelStock): CellMetrics {
  if (isTape(stock)) return tapeMetrics(stock);
  const { w, h } = stock.cell;
  const pad = Math.max(1.5, h * 0.06);
  const qr = Math.min(h - 2 * pad, w * 0.48);
  const text = Math.max(0, w - qr - 3 * pad);
  const compact = stock.content === 'compact';
  const code = Math.min(h * (compact ? 0.16 : 0.13), text / CODE_EM);
  const name = floor2(Math.max(NAME_MIN, Math.min(h * 0.095, code * 0.8)));
  return {
    pad,
    qr,
    codeColumn: 0,
    text,
    code,
    name,
    path: floor2(Math.max(PATH_MIN, name * 0.8)),
    compact,
    place: !compact,
  };
}

/**
 * Tape (#303): the label is a band across the tape (three quarters of narrow tape, 18 mm of
 * 24 mm tape, as an 18 mm print head prints it), and the code is set large in it, since the code
 * is what is read on tape: by eye, and by the scanner from its printed text where there is no QR.
 * Narrow tape (no QR): the code fills most of the band's height in a column of its own, the name
 * beside it. Wide tape: the QR fills the band, the code and the name beside it, as on a roll.
 * The place never prints on tape.
 */
function tapeMetrics(stock: LabelStock): CellMetrics {
  const { w, h } = stock.cell;
  const pad = h <= 12 ? h * 0.125 : Math.max(1.5, (h - 18) / 2);
  const band = h - 2 * pad;
  if (hasQr(stock)) {
    const qr = band;
    const text = Math.max(0, w - qr - 3 * pad);
    const code = Math.min(band * 0.42, text / CODE_EM);
    const name = floor2(Math.max(NAME_MIN, Math.min(band * 0.2, code * 0.6)));
    return {
      pad,
      qr,
      codeColumn: 0,
      text,
      code,
      name,
      path: PATH_MIN,
      compact: false,
      place: false,
    };
  }
  const code = band * 0.62;
  const codeColumn = code * CODE_EM;
  const text = Math.max(0, w - codeColumn - 3 * pad);
  const name = floor2(Math.max(NAME_MIN, Math.min(band * 0.4, code * 0.6)));
  return {
    pad,
    qr: 0,
    codeColumn,
    text,
    code,
    name,
    path: PATH_MIN,
    compact: false,
    place: false,
  };
}

/** The name's direction for the canvas (the HTML uses `dir=auto`): its first strong letter's. */
export function directionOfText(text: string): 'ltr' | 'rtl' {
  const m = text.match(/[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]|[֐-ࣿיִ-﷿ﹰ-﻿]/);
  return m && /[֐-ࣿיִ-﷿ﹰ-﻿]/.test(m[0]) ? 'rtl' : 'ltr';
}
