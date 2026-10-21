/**
 * The scanner (D101, D137): one decoder for the whole app. Scan, the box check's
 * "Found something else" and the capture camera's label recognition all read through
 * `appDetect()`.
 *
 * - **The decoder:** the browser's own `BarcodeDetector` where it reads every format below
 *   (Android Chrome); otherwise `barcode-detector`'s ponyfill with the self-hosted ZXing wasm
 *   (./zxing.ts), loaded on the first scan, never with the page. Every iPhone takes the wasm path.
 * - **Formats:** Kept labels are QR codes; products carry EAN-13, EAN-8, UPC-A or UPC-E; Code 128
 *   is on many shop and asset labels; Data Matrix on electronics and parts (often GS1, with a
 *   serial number); Code 39 and Code 93 on asset tags; ITF-14 on cartons; Codabar on library
 *   labels; PDF417 and Aztec on shipping labels, warranty cards and tickets.
 * - **The wasm reads in turn:** each format costs the reader time on every frame, and the 2D ones
 *   most (all thirteen at once took 3.5 times as long as the first six). So the first six are read
 *   on every frame and the rest take turns on every other frame (`WASM_FRAMES`): a QR label reads
 *   as fast as before, a Data Matrix within four frames.
 * - **The loop:** `requestVideoFrameCallback` where there is one, else `requestAnimationFrame`,
 *   throttled to about 8 frames a second on a downscaled copy of the frame, and never two decodes
 *   at once (V12 falls back to 4 fps and 640 px on slow phones).
 * - **A failure means "no scanner":** a decoder that can't start (the wasm refused, as under a CSP
 *   without `'wasm-unsafe-eval'`, or a chunk that isn't cached) is `ScannerUnavailable`, and the
 *   screen leads with "Type the code".
 */
import type { Box, Detect, Detected } from './label-recogniser';

/** Read on every frame: Kept labels, product barcodes and Code 128 (BarcodeDetector names). */
export const HOT_FORMATS = ['qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] as const;

/** What the scanner reads (BarcodeDetector format names): the one list, main thread and worker. */
export const SCAN_FORMATS = [
  ...HOT_FORMATS,
  'data_matrix',
  'code_39',
  'code_93',
  'itf',
  'codabar',
  'pdf417',
  'aztec',
] as const;
export type ScanFormat = (typeof SCAN_FORMATS)[number];

const withHot = (...more: ScanFormat[]): readonly ScanFormat[] => [...HOT_FORMATS, ...more];

/** The wasm reader's formats, frame by frame, in a loop: the hot ones always, the rest in turn. */
export const WASM_FRAMES: readonly (readonly ScanFormat[])[] = [
  HOT_FORMATS,
  withHot('data_matrix'),
  HOT_FORMATS,
  withHot('code_39', 'code_93', 'itf', 'codabar'),
  HOT_FORMATS,
  withHot('data_matrix'),
  HOT_FORMATS,
  withHot('pdf417', 'aztec'),
];

/** About 8 decodes a second. */
export const SCAN_FPS = 8;
/** The long edge of the frame the decoder sees. */
export const SCAN_MAX_SIDE = 960;
/** The fallback for older phones, if testing on a device shows the loop can't keep up. */
export const SLOW_PHONE = { fps: 4, maxSide: 640 } as const;

/** The decoder can't run on this device: the screen offers "Type the code" instead. */
export class ScannerUnavailable extends Error {
  constructor(cause?: unknown) {
    super('Barcode scanning is unavailable on this device.');
    this.name = 'ScannerUnavailable';
    if (cause !== undefined) this.cause = cause;
  }
}

type NativeDetected = { rawValue: string; format: string; boundingBox?: Box };
type NativeDetector = { detect: (source: CanvasImageSource) => Promise<NativeDetected[]> };
type NativeCtor = {
  new (opts: { formats: string[] }): NativeDetector;
  getSupportedFormats?: () => Promise<string[]>;
};

/**
 * The browser's `BarcodeDetector`, if it reads every format the scanner reads; null otherwise, and
 * the wasm reads them all. A partial native reader would make a code readable on one phone and
 * not on another.
 */
export async function nativeScanner(
  scope: { BarcodeDetector?: unknown } = globalThis as { BarcodeDetector?: unknown },
): Promise<Detect | null> {
  const Ctor = scope.BarcodeDetector as NativeCtor | undefined;
  if (typeof Ctor !== 'function') return null;
  try {
    const supported = (await Ctor.getSupportedFormats?.()) ?? [];
    if (!SCAN_FORMATS.every((f) => supported.includes(f))) return null;
    const detector = new Ctor({ formats: [...SCAN_FORMATS] });
    return async (source) =>
      (await detector.detect(source)).map((d) => {
        const r = d.boundingBox;
        return {
          rawValue: d.rawValue,
          format: d.format,
          ...(r ? { box: { x: r.x, y: r.y, width: r.width, height: r.height } } : {}),
        };
      });
  } catch {
    return null;
  }
}

/**
 * A `Detect` that reads each call with the next frame's formats in `frames` (in a loop), each
 * reader made once, the first time its turn comes.
 */
export function rotatingDetect(
  make: (formats: readonly string[]) => Detect,
  frames: readonly (readonly string[])[] = WASM_FRAMES,
): Detect {
  const readers = new Map<number, Detect>();
  let turn = 0;
  return (source) => {
    const i = turn;
    turn = (turn + 1) % frames.length;
    let read = readers.get(i);
    if (!read) {
      read = make(frames[i] ?? HOT_FORMATS);
      readers.set(i, read);
    }
    return read(source);
  };
}

/** The wasm reader, fetched with its chunk the first time it is needed, reading in turn. */
export const loadWasmScanner = async (): Promise<Detect> => {
  const { zxingDetect } = await import('./zxing');
  return rotatingDetect(zxingDetect);
};

const unsupported = (e: unknown) =>
  !!e && typeof e === 'object' && 'name' in e && e.name === 'NotSupportedError';

/**
 * A `Detect` that picks its decoder on the first call: the native one when it reads every
 * format, else the wasm. A decoder that can't start, or refuses as unsupported, throws
 * `ScannerUnavailable` from then on.
 */
export function createDetect({
  native = nativeScanner,
  wasm = loadWasmScanner,
}: {
  native?: () => Promise<Detect | null>;
  wasm?: () => Promise<Detect>;
} = {}): Detect {
  let chosen: Promise<Detect> | null = null;
  const pick = () => {
    chosen ??= (async () => {
      try {
        return (await native()) ?? (await wasm());
      } catch (e) {
        throw new ScannerUnavailable(e);
      }
    })();
    return chosen;
  };
  return async (source) => {
    const detect = await pick();
    try {
      return await detect(source);
    } catch (e) {
      if (unsupported(e)) throw new ScannerUnavailable(e);
      throw e;
    }
  };
}

let shared: Detect | null = null;

/** The app's one decoder (Scan, box check, capture's label recognition, room photos). */
export function appDetect(): Detect {
  shared ??= createDetect();
  return shared;
}

// ----- the loop ---------------------------------------------------------------------------------

type FrameVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

/**
 * Decodes a video frame somewhere other than the main thread (camera/worker-detect.ts): the
 * frame downscaled to `size`, its boxes in pixels of that size. Throws `ScannerUnavailable` when
 * no decoder can start there; anything else it throws means "decode on the main thread instead".
 */
export type FrameDecoder = (
  video: HTMLVideoElement,
  size: { width: number; height: number },
) => Promise<Detected[]>;

export type ScanLoopOptions = {
  fps?: number;
  maxSide?: number;
  /** Decode off the main thread; when it breaks, the loop decodes with `detect` from then on. */
  decoder?: FrameDecoder | null;
  /** The decoder couldn't start: the loop has stopped. */
  onUnavailable?: (e: ScannerUnavailable) => void;
  now?: () => number;
};

/** Each code's box as fractions of a `width` × `height` frame. */
const fractions = (found: Detected[], width: number, height: number): Detected[] =>
  found.map((d) =>
    d.box
      ? {
          ...d,
          box: {
            x: d.box.x / width,
            y: d.box.y / height,
            width: d.box.width / width,
            height: d.box.height / height,
          },
        }
      : d,
  );

/**
 * Decodes what `video` shows, about `fps` times a second, and reports every frame that read
 * something: every code in it, each with its box as fractions of the frame where the decoder
 * gave one. Answers a stop function. The frame's canvas is created with `willReadFrequently`,
 * because the ponyfill reads its pixels back on every decode (Chromium warns about it).
 */
export function startScanLoop(
  video: HTMLVideoElement,
  detect: Detect,
  onRead: (found: Detected[]) => void,
  {
    fps = SCAN_FPS,
    maxSide = SCAN_MAX_SIDE,
    onUnavailable,
    now = () => performance.now(),
    decoder = null,
  }: ScanLoopOptions = {},
): () => void {
  const v = video as FrameVideo;
  let offThread = decoder;
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  const onMainThread = () => {
    if (!canvas) {
      canvas = document.createElement('canvas');
      ctx = canvas.getContext('2d', { willReadFrequently: true });
    }
    return { canvas, ctx };
  };
  const every = 1000 / fps;
  let stopped = false;
  let busy = false;
  let last = Number.NEGATIVE_INFINITY;
  let handle: number | null = null;
  const byFrame = typeof v.requestVideoFrameCallback === 'function';

  const schedule = () => {
    if (stopped) return;
    handle = byFrame
      ? (v.requestVideoFrameCallback?.(tick) ?? null)
      : requestAnimationFrame(() => tick());
  };
  const read = async (width: number, height: number): Promise<Detected[]> => {
    if (offThread) {
      try {
        return await offThread(v, { width, height });
      } catch (e) {
        if (e instanceof ScannerUnavailable) throw e;
        // The worker broke: the main thread decodes from now on.
        offThread = null;
      }
    }
    const main = onMainThread();
    if (!main.ctx) return [];
    main.canvas.width = width;
    main.canvas.height = height;
    main.ctx.drawImage(v, 0, 0, width, height);
    return detect(main.canvas);
  };
  const decode = async () => {
    const w = v.videoWidth;
    const h = v.videoHeight;
    if (!w || !h) return;
    const k = Math.min(1, maxSide / Math.max(w, h));
    const width = Math.round(w * k);
    const height = Math.round(h * k);
    try {
      const found = await read(width, height);
      if (!stopped && found.length > 0) onRead(fractions(found, width, height));
    } catch (e) {
      if (e instanceof ScannerUnavailable) {
        stopped = true;
        onUnavailable?.(e);
      }
      // Anything else is one bad frame; the next one tries again.
    }
  };
  function tick() {
    if (stopped) return;
    const t = now();
    if (!busy && t - last >= every) {
      last = t;
      busy = true;
      void decode().finally(() => {
        busy = false;
      });
    }
    schedule();
  }
  schedule();
  return () => {
    stopped = true;
    if (handle === null) return;
    if (byFrame) v.cancelVideoFrameCallback?.(handle);
    else cancelAnimationFrame(handle);
  };
}

/** A short buzz on a read, where the phone can (Android; iPhones have no `vibrate`). */
export function buzz(): void {
  try {
    navigator.vibrate?.(30);
  } catch {
    // A nicety only.
  }
}

// ----- the diagnostics probe (T23's panel; V12 and the Safari CSP question) ---------------------

/**
 * Decodes a QR code drawn on a canvas with the wasm reader, twice: whether the wasm runs here at
 * all (Safari under `'wasm-unsafe-eval'`, which could only be assumed), how long the first
 * decode takes with the wasm's compile, and how long a frame takes after (V12's "fast enough on
 * older iPhones"). Facts only, for the copied report; nothing is sent.
 */
export async function probeWasmScanner(): Promise<{ ok: boolean; facts: string[] }> {
  const text = 'https://kept.example/l/7KQ4MZ';
  try {
    const [{ encode }, { zxingDetect }] = await Promise.all([import('uqr'), import('./zxing')]);
    const qr = encode(text, { border: 4 });
    const scale = 4;
    const canvas = document.createElement('canvas');
    canvas.width = qr.size * scale;
    canvas.height = qr.size * scale;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { ok: false, facts: ['wasm=no-canvas'] };
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    for (const [y, row] of qr.data.entries())
      for (const [x, on] of row.entries()) if (on) ctx.fillRect(x * scale, y * scale, scale, scale);
    const detect = zxingDetect(['qr_code']);
    const t0 = performance.now();
    const first = await detect(canvas);
    const t1 = performance.now();
    await detect(canvas);
    const t2 = performance.now();
    const ok = first[0]?.rawValue === text;
    return {
      ok,
      facts: [
        `wasm=${ok ? 'reads' : 'no-read'}`,
        `first=${Math.round(t1 - t0)}ms`,
        `frame=${Math.round(t2 - t1)}ms`,
      ],
    };
  } catch (e) {
    const name = e && typeof e === 'object' && 'name' in e ? String(e.name) : 'error';
    return { ok: false, facts: [`wasm=failed:${name}`] };
  }
}
