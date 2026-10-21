/**
 * Where each label goes and how big its parts are (D44, D134, D175, D185). Pure, so the
 * print sheet (sheet.tsx), the builder's preview and the phone PNG (png.ts) share one geometry
 * and the tests can pin it per stock.
 *
 * All lengths are millimetres. A sheet is physical paper: its cells run left to right from the
 * top-left corner in every language, like the maker's numbering, so the sheet is laid out LTR
 * and only the names inside a label follow their own direction (`dir=auto`, D97).
 */
import { cellsFor, isSheet, type LabelCell, type LabelStock } from '@kept/shared';
import type { LabelCellContent } from '@/api/capture/types';

/** The label's faces: Plex Sans with Plex Sans Arabic for Arabic names (D97), Plex Mono for codes. */
export const LABEL_SANS = '"IBM Plex Sans", "IBM Plex Sans Arabic", sans-serif';
export const LABEL_MONO = '"IBM Plex Mono", monospace';

/** A CSS length in millimetres, rounded to a hundredth so snapshots stay readable. */
export const mm = (n: number) => `${Math.round(n * 100) / 100}mm`;

/** The one `@page` rule a print view installs for its stock: the paper, no printer margin. */
export function pageCss(stock: LabelStock): string {
  return `@page { size: ${mm(stock.page.w)} ${mm(stock.page.h)}; margin: 0; }`;
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
  /** The QR's side, quiet zone included. */
  qr: number;
  /** The text column's width, beside the QR. */
  text: number;
  /** Font sizes (the em box): the code, the name, the path. */
  code: number;
  name: number;
  path: number;
  /** A compact stock prints only the QR and the code. */
  compact: boolean;
};

/** Plex Mono's advance is 0.6 em; the code is set 0.06 em apart, 7 characters with the hyphen. */
const CODE_EM = 7 * 0.66;

/**
 * The parts of one label, scaled from the designs' 40 × 30 mm label (D134: QR, the code large in
 * mono, the name, the place). The code never wraps: it shrinks to fit the text column.
 */
export function cellMetrics(stock: LabelStock): CellMetrics {
  const { w, h } = stock.cell;
  const pad = Math.max(1.5, h * 0.06);
  const qr = Math.min(h - 2 * pad, w * 0.48);
  const text = Math.max(0, w - qr - 3 * pad);
  const compact = stock.content === 'compact';
  return {
    pad,
    qr,
    text,
    code: Math.min(h * (compact ? 0.16 : 0.13), text / CODE_EM),
    name: Math.max(2.2, h * 0.077),
    path: Math.max(1.8, h * 0.059),
    compact,
  };
}

export type PreviewMetrics = {
  /** Percentages of the cell's width (CSS `cqw` inside a cell): padding, the QR's side. */
  pad: number;
  qr: number;
  /** Font sizes, the same way: the code, and the name under it. */
  code: number;
  name: number;
  /** Only the QR and the code, as on the paper. */
  compact: boolean;
};

/**
 * One label's parts at the sheet preview's scale, as percentages of the cell's width. The QR and
 * padding are the printed label's own; the text is set larger than on paper, as large as the
 * code can be and still fit its column (capped by the cell's height), so a 100 px cell stays
 * readable. The name is one line under the code.
 */
export function previewMetrics(stock: LabelStock): PreviewMetrics {
  const m = cellMetrics(stock);
  const { w, h } = stock.cell;
  const code = Math.min(m.text / CODE_EM, h * 0.2);
  const pct = (n: number) => (n / w) * 100;
  return {
    pad: pct(m.pad),
    qr: pct(m.qr),
    code: pct(code),
    name: pct(code * 0.8),
    compact: m.compact,
  };
}

/** The name's direction for the canvas (the HTML uses `dir=auto`): its first strong letter's. */
export function directionOfText(text: string): 'ltr' | 'rtl' {
  const m = text.match(/[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]|[֐-ࣿיִ-﷿ﹰ-﻿]/);
  return m && /[֐-ࣿיִ-﷿ﹰ-﻿]/.test(m[0]) ? 'rtl' : 'ltr';
}
