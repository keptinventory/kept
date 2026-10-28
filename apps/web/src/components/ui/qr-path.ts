/**
 * A QR code as one SVG path from uqr's module matrix (MIT): the drawing QrCode renders, kept apart
 * from React so the docs' Try the map draws a label's QR the same way (D241).
 */
import { encode } from 'uqr';

/** The path's `d` (one 1×1 square per dark module, quiet zone included) and its side, in modules. */
export function qrPath(value: string): { d: string; n: number } {
  const qr = encode(value, { ecc: 'M', border: 2 });
  let d = '';
  qr.data.forEach((row, y) => {
    row.forEach((on, x) => {
      if (on) d += `M${x} ${y}h1v1h-1z`;
    });
  });
  return { d, n: qr.size };
}
