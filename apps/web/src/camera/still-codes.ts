/**
 * Kept labels in still photos (#194): a Room capture's photos are read on the phone before they
 * are sent, so a thing whose label shows is known for certain, without asking AI. Each photo is
 * drawn at most `maxSide` on its long edge (a label across a room is small) and given to the
 * app's one decoder (`appDetect()`, scanner.ts: the native BarcodeDetector or the ZXing wasm);
 * every Kept code found is kept once, in order. A photo the decoder can't read is skipped; a
 * phone with no scanner reads none, and the capture goes on without codes.
 */
import { parseScan, ROOM_LIMITS } from '@kept/shared';
import { type Decode, type Drawable, decodeWithBitmap, drawScaled } from './image';
import type { Detect } from './label-recogniser';
import { appDetect, ScannerUnavailable } from './scanner';

/** Long enough for a label in a photo of a whole room, short enough to decode in a moment. */
export const STILL_MAX_SIDE = 2048;

export async function keptCodesIn(
  photos: readonly Blob[],
  {
    detect = appDetect(),
    decode = decodeWithBitmap,
    draw = (img: Drawable) => drawScaled(img, STILL_MAX_SIDE),
  }: {
    detect?: Detect;
    decode?: Decode;
    draw?: (img: Drawable) => CanvasImageSource;
  } = {},
): Promise<string[]> {
  const codes: string[] = [];
  for (const photo of photos) {
    try {
      const found = await detect(draw(await decode(photo)));
      for (const d of found) {
        const r = parseScan(d.rawValue, d.format);
        if (r.kind === 'kept' && !codes.includes(r.code)) codes.push(r.code);
      }
    } catch (e) {
      if (e instanceof ScannerUnavailable) break;
      // One photo the decoder couldn't read: the others still count.
    }
  }
  return codes.slice(0, ROOM_LIMITS.codes);
}
