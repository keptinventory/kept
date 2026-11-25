/**
 * QR codes for labels (D120): `uqr` (MIT, 0.1.3, already the invite page's encoder) loaded only
 * when a label is drawn, so it stays out of every other chunk. A label's QR has the standard
 * quiet zone of 4 modules, which a sticker's edge would otherwise eat, and error correction M.
 *
 * What the QR holds is the person's choice, remembered on this browser like the stock: the link
 * (`<public-url>/l/<code>`, which any phone camera opens) or the code alone, a far smaller QR
 * (21 modules a side for a 6-character code against 29 or more for a link) that only Kept's own
 * scanner reads (shared/scan.ts takes a bare code as a Kept label).
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { LabelCellContent } from '@/api/capture/types';

export type Encode = typeof import('uqr').encode;

let loading: Promise<Encode> | null = null;

export function loadQr(): Promise<Encode> {
  loading ??= import('uqr').then((m) => m.encode);
  return loading;
}

/** The encoder once loaded; null while it loads. */
export function useQrEncoder(): Encode | null {
  const [encode, setEncode] = useState<Encode | null>(null);
  useEffect(() => {
    let live = true;
    void loadQr().then((fn) => {
      if (live) setEncode(() => fn);
    });
    return () => {
      live = false;
    };
  }, []);
  return encode;
}

export const QUIET_ZONE = 4;

/** What a label's QR holds: its link, or its code alone. */
export type QrContent = 'link' | 'code';

const QR_CONTENT_KEY = 'kept.labels.qr';
const listeners = new Set<() => void>();

/** The remembered choice; the link when nothing (or nothing valid) is remembered. */
function qrContent(): QrContent {
  try {
    return localStorage.getItem(QR_CONTENT_KEY) === 'code' ? 'code' : 'link';
  } catch {
    // Storage blocked: the link.
    return 'link';
  }
}

/** Picked on this page: followed even where storage can't keep it. */
let chosen: QrContent | null = null;
const current = (): QrContent => chosen ?? qrContent();

export function setQrContent(content: QrContent): void {
  chosen = content;
  try {
    localStorage.setItem(QR_CONTENT_KEY, content);
  } catch {
    // Nothing to keep it in: this page still follows `chosen`.
  }
  for (const l of listeners) l();
}

/** The choice, kept current across every label drawn on the page. */
export function useQrContent(): QrContent {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    current,
    () => 'link',
  );
}

/** The choice now, outside React (the phone PNGs). */
export const currentQrContent = current;

/** The text a label's QR encodes. */
export function qrValue(label: Pick<LabelCellContent, 'code' | 'url'>, content: QrContent): string {
  return content === 'code' ? label.code : label.url;
}

/** The module matrix, quiet zone included: `true` is a dark module. */
export function qrMatrix(encode: Encode, value: string): boolean[][] {
  return encode(value, { ecc: 'M', border: QUIET_ZONE }).data;
}

/** One SVG path of unit squares, one per dark module: no inline styles, so the CSP allows it. */
export function qrPath(matrix: readonly (readonly boolean[])[]): string {
  let d = '';
  matrix.forEach((row, y) => {
    row.forEach((on, x) => {
      if (on) d += `M${x} ${y}h1v1h-1z`;
    });
  });
  return d;
}
