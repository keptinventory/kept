/**
 * Printed codes with no QR (#303): the scanner's decoder, with frames that hold no QR or barcode
 * also read for a Kept code printed as text (narrow label-maker tape prints only the code). On the
 * phone and offline: the reader (./printed-code/) is a few kilobytes of plain code, loaded with
 * its chunk the first time a frame needs it, and precached with the app like the barcode wasm, so
 * it works offline from the start. Nothing is sent anywhere; the frame never leaves the page.
 *
 * At most one frame every `every` ms is read (the reader runs on the main thread, about 10 ms a
 * frame at 720 px on a laptop), on a copy no longer than `maxSide`. A code comes back as a
 * `Detected` in the `PRINTED_CODE` format, with `sure` saying whether every character matched
 * clearly; the scan screen opens a sure one that resolves to a real code, and asks about any
 * other. A reader that can't load turns printed codes off; barcodes still read.
 */
import type { Detect, Detected } from './label-recogniser';
import type { AgreedRead, Frame } from './printed-code/reader';
import { appDetect } from './scanner';

/** The `format` of a code read from its printed text. */
export const PRINTED_CODE = 'kept_printed_code';
export const PRINTED_EVERY_MS = 300;
export const PRINTED_MAX_SIDE = 720;

type ReaderModule = {
  agreeingReads: () => (frame: Frame) => AgreedRead | null;
};

let scratch: HTMLCanvasElement | null = null;

/** The frame as RGBA pixels, no longer than `maxSide`; null where there is no 2D canvas. */
function frameOf(source: CanvasImageSource, maxSide: number): Frame | null {
  const s = source as { width?: number; height?: number };
  const w = Number(s.width ?? 0);
  const h = Number(s.height ?? 0);
  if (!w || !h || typeof document === 'undefined') return null;
  const k = Math.min(1, maxSide / Math.max(w, h));
  scratch ??= document.createElement('canvas');
  const canvas = scratch;
  canvas.width = Math.round(w * k);
  canvas.height = Math.round(h * k);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function withPrintedCodes(
  detect: Detect,
  {
    load = () => import('./printed-code/reader') as Promise<ReaderModule>,
    frameOf: frame = frameOf,
    now = () => performance.now(),
    every = PRINTED_EVERY_MS,
    maxSide = PRINTED_MAX_SIDE,
  }: {
    load?: () => Promise<ReaderModule>;
    frameOf?: (source: CanvasImageSource, maxSide: number) => Frame | null;
    now?: () => number;
    every?: number;
    maxSide?: number;
  } = {},
): Detect {
  let reader: Promise<((frame: Frame) => AgreedRead | null) | null> | null = null;
  let last = Number.NEGATIVE_INFINITY;
  return async (source) => {
    const found = await detect(source);
    if (found.length > 0) return found;
    const t = now();
    if (t - last < every) return found;
    last = t;
    reader ??= load().then(
      (m) => m.agreeingReads(),
      () => null,
    );
    const read = await reader;
    if (!read) return found;
    const f = frame(source, maxSide);
    const agreed = f ? read(f) : null;
    if (!agreed) return found;
    const printed: Detected = { rawValue: agreed.code, format: PRINTED_CODE, sure: agreed.sure };
    return [printed];
  };
}

let shared: Detect | null = null;

/** The scan screen's decoder: the app's one decoder, and printed codes. */
export function scanDetect(): Detect {
  shared ??= withPrintedCodes(appDetect());
  return shared;
}
