/**
 * The printed-code reader as the scanner uses it, frame after frame (#303): each frame is read
 * (./recognise.ts), and a code is reported only when two reads in a row agree, so a single
 * frame's misread never reaches the scanner. The code is sure only when both reads were sure.
 * This module and the recogniser are one small chunk, loaded by camera/printed-text.ts the first
 * time a frame holds no QR or barcode.
 */
import { grayOf, type PrintedRead, readPrintedCode } from './recognise';

export type Frame = { width: number; height: number; data: ArrayLike<number> };
export type AgreedRead = { code: string; sure: boolean };

/** How long two reads may be apart and still agree. */
export const AGREE_WITHIN_MS = 1500;

/** A reader of RGBA frames that reports a code once two reads in a row agree on it. */
export function agreeingReads(
  read: (frame: Frame) => PrintedRead | null = (frame) => readPrintedCode(grayOf(frame)),
  { now = () => performance.now(), within = AGREE_WITHIN_MS } = {},
): (frame: Frame) => AgreedRead | null {
  let last: { code: string; sure: boolean; at: number } | null = null;
  return (frame) => {
    const r = read(frame);
    const at = now();
    if (!r) {
      last = null;
      return null;
    }
    if (last && last.code === r.code && at - last.at <= within) {
      const agreed = { code: r.code, sure: last.sure && r.sure };
      last = null;
      return agreed;
    }
    last = { code: r.code, sure: r.sure, at };
    return null;
  };
}
