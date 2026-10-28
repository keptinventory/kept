/**
 * Labels as PNGs made on the phone (D44, D185), for label-printer apps that take an
 * image: one PNG per label at 300 dpi of the stock's cell, shared together through the share
 * sheet where the browser can share files, downloaded otherwise.
 *
 * The same geometry as the print sheet (`cellMetrics`) and the same lines (`fitLabel`). QR modules are filled rectangles on a
 * whole-pixel grid; text is `fillText`, so the canvas shapes Arabic, after the Plex faces have
 * loaded (a canvas never waits for a font on its own). `drawLabel` takes any 2D context, so a
 * test can rasterise it without a canvas.
 */
import type { LabelStock } from '@kept/shared';
import { printedCode } from '@kept/shared';
import type { LabelCellContent } from '@/api/capture/types';
import { canShareFiles, downloadsWork, saveFile, shareFiles } from '@/lib/files';
import { FIT_LINE_HEIGHT, fitLabel, loadLabelFaces, type TextMeasure } from './fit';
import { cellMetrics, directionOfText, LABEL_MONO, LABEL_SANS, PLACE_INK } from './layout';
import { loadQr, qrMatrix } from './qr';

export const PNG_DPI = 300;

export const pxOf = (millimetres: number) => Math.round((millimetres / 25.4) * PNG_DPI);

/** The PNG's size in pixels: the cell at 300 dpi. */
export function labelPixelSize(stock: LabelStock): { width: number; height: number } {
  return { width: pxOf(stock.cell.w), height: pxOf(stock.cell.h) };
}

/** What `drawLabel` uses of a canvas context. */
export type LabelContext = Pick<
  CanvasRenderingContext2D,
  'fillRect' | 'fillText' | 'measureText' | 'font' | 'fillStyle' | 'textAlign' | 'textBaseline'
> & { direction: CanvasDirection };

/** Draws one label: white ground, the QR (if the stock has one), the code, and the name and
 * place where the stock prints them. */
export function drawLabel(
  ctx: LabelContext,
  stock: LabelStock,
  label: LabelCellContent,
  matrix: readonly (readonly boolean[])[],
) {
  const { width, height } = labelPixelSize(stock);
  const m = cellMetrics(stock);
  const pad = pxOf(m.pad);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // The QR on whole pixels per module, centred in its square, so no module blurs. Narrow tape has
  // none: the code takes its place, in a column of its own.
  const side = pxOf(m.qr);
  if (m.qr > 0) {
    const n = matrix.length;
    const unit = Math.max(1, Math.floor(side / n));
    const qx = pad + Math.floor((side - unit * n) / 2);
    const qy = Math.floor((height - unit * n) / 2);
    ctx.fillStyle = '#000000';
    matrix.forEach((row, y) => {
      row.forEach((on, x) => {
        if (on) ctx.fillRect(qx + x * unit, qy + y * unit, unit, unit);
      });
    });
  }

  const beside = m.codeColumn > 0;
  const x0 = beside ? pad + pxOf(m.codeColumn) + pad : pad + side + pad;
  const textWidth = pxOf(m.text);
  const code = pxOf(m.code);
  type Block = { lines: string[]; step: number; font: string; color: string; rtl: boolean };
  const blocks: Block[] = [];
  ctx.textBaseline = 'top';
  ctx.font = `600 ${code}px ${LABEL_MONO}`;
  const codeBlock: Block = {
    lines: [printedCode(label.code)],
    step: code,
    font: ctx.font,
    color: '#000000',
    rtl: false,
  };
  if (beside) {
    ctx.fillStyle = '#000000';
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.fillText(printedCode(label.code), pad, Math.round((height - code) / 2));
  } else blocks.push(codeBlock);
  // The same lines and sizes as the HTML label (fit.ts), measured on this canvas.
  const measure: TextMeasure = (text, size, weight = 600) => {
    ctx.font = `${weight} 100px ${LABEL_SANS}`;
    return (ctx.measureText(text).width / 100) * size;
  };
  const fit = fitLabel(stock, label, measure);
  for (const [part, text, weight, color] of [
    [fit.name, label.name, 600, '#000000'],
    [fit.path, label.path, 400, PLACE_INK],
  ] as const) {
    if (!part || !text) continue;
    const size = pxOf(part.size);
    blocks.push({
      lines: part.lines,
      step: Math.round(size * FIT_LINE_HEIGHT),
      font: `${weight} ${size}px ${LABEL_SANS}`,
      color,
      rtl: directionOfText(text) === 'rtl',
    });
  }

  // Centred as a block beside the QR, like the HTML label.
  const gap = Math.round(pad * 0.6);
  const total =
    blocks.reduce((sum, b) => sum + b.step * b.lines.length, 0) +
    gap * Math.max(0, blocks.length - 1);
  let y = Math.max(pad, Math.round((height - total) / 2));
  for (const b of blocks) {
    ctx.font = b.font;
    ctx.fillStyle = b.color;
    ctx.direction = b.rtl ? 'rtl' : 'ltr';
    ctx.textAlign = b.rtl ? 'right' : 'left';
    const x = b.rtl ? x0 + textWidth : x0;
    for (const line of b.lines) {
      ctx.fillText(line, x, y);
      y += b.step;
    }
    y += gap;
  }
}

/** One PNG file per label, named by its code. */
export async function labelPngs(
  stock: LabelStock,
  labels: readonly LabelCellContent[],
): Promise<File[]> {
  const [encode] = await Promise.all([loadQr(), loadLabelFaces()]);
  const { width, height } = labelPixelSize(stock);
  const files: File[] = [];
  for (const label of labels) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d canvas');
    drawLabel(ctx, stock, label, qrMatrix(encode, label.url));
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'));
    if (!blob) throw new Error('canvas.toBlob gave nothing');
    files.push(new File([blob], `kept-${label.code}.png`, { type: 'image/png' }));
  }
  return files;
}

/**
 * Hands the PNGs to the share sheet (a label-printer app, Files, Messages) where the browser can
 * share files; otherwise downloads them. 'cancelled' when the person closed the share sheet,
 * 'refused' when the browser wouldn't share and can't download either (an installed iPhone app,
 * lib/files.ts). Pass files made before the press: iOS refuses a share that waited on them.
 */
export async function shareOrDownload(
  files: File[],
  title: string,
): Promise<'shared' | 'downloaded' | 'cancelled' | 'refused'> {
  if (canShareFiles(files)) {
    const how = await shareFiles(files, title);
    if (how !== 'refused') return how;
    // Refused for another reason (too many files, say): download them where that works.
  }
  if (!downloadsWork()) return 'refused';
  for (const file of files) saveFile(file);
  return 'downloaded';
}
