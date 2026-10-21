/**
 * The scanner's choices and loop: the native detector only where it reads QR codes, the
 * wasm otherwise, "no scanner" when neither can start, and a loop that decodes about 8 frames a
 * second, never two at once, and stops for good when the decoder is unavailable. The decoders are
 * fakes here; scanner.decode.test.ts runs the real wasm on fixture images.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Detect } from './label-recogniser';
import {
  createDetect,
  type FrameDecoder,
  HOT_FORMATS,
  nativeScanner,
  rotatingDetect,
  SCAN_FORMATS,
  ScannerUnavailable,
  startScanLoop,
  WASM_FRAMES,
} from './scanner';

const qr = { rawValue: 'https://kept.example/l/7KQ4MZ', format: 'qr_code' };
const canvas = {} as CanvasImageSource;

function nativeCtor(formats: string[]) {
  const detect = vi.fn(async () => [qr]);
  const Ctor = vi.fn(function (this: unknown, _opts: { formats: string[] }) {
    return { detect };
  }) as unknown as {
    new (o: { formats: string[] }): unknown;
    getSupportedFormats(): Promise<string[]>;
  };
  Ctor.getSupportedFormats = async () => formats;
  return { Ctor, detect };
}

describe('the decoder', () => {
  it('uses the native detector where it reads every format, asking for all of them', async () => {
    const { Ctor } = nativeCtor([...SCAN_FORMATS, 'maxi_code']);
    const detect = await nativeScanner({ BarcodeDetector: Ctor });
    expect(await detect?.(canvas)).toEqual([qr]);
    expect(Ctor).toHaveBeenCalledWith({ formats: [...SCAN_FORMATS] });
  });

  it('takes no native detector that lacks a format, so every phone reads the same codes', async () => {
    const { Ctor } = nativeCtor(SCAN_FORMATS.filter((f) => f !== 'codabar'));
    expect(await nativeScanner({ BarcodeDetector: Ctor })).toBeNull();
  });

  it('reports where each code is in the frame, in pixels of what it read', async () => {
    const detect = vi.fn(async () => [
      { ...qr, boundingBox: { x: 10, y: 20, width: 30, height: 40 } },
    ]);
    const Ctor = Object.assign(
      vi.fn(function (this: unknown) {
        return { detect };
      }),
      { getSupportedFormats: async () => [...SCAN_FORMATS] },
    );
    const native = await nativeScanner({ BarcodeDetector: Ctor });
    expect(await native?.(canvas)).toEqual([
      { ...qr, box: { x: 10, y: 20, width: 30, height: 40 } },
    ]);
  });

  it('takes no native detector without QR support, or without one at all', async () => {
    expect(await nativeScanner({ BarcodeDetector: nativeCtor(['ean_13']).Ctor })).toBeNull();
    expect(await nativeScanner({})).toBeNull();
  });

  it('falls back to the wasm, loaded once, on the first scan', async () => {
    const wasmDetect = vi.fn<Detect>(async () => [qr]);
    const wasm = vi.fn(async () => wasmDetect);
    const detect = createDetect({ native: async () => null, wasm });
    expect(wasm).not.toHaveBeenCalled();
    await detect(canvas);
    await detect(canvas);
    expect(wasm).toHaveBeenCalledTimes(1);
    expect(wasmDetect).toHaveBeenCalledTimes(2);
  });

  it('is unavailable when the wasm cannot load or the reader refuses', async () => {
    const noChunk = createDetect({
      native: async () => null,
      wasm: async () =>
        Promise.reject(new TypeError('Failed to fetch dynamically imported module')),
    });
    await expect(noChunk(canvas)).rejects.toBeInstanceOf(ScannerUnavailable);
    const refused = createDetect({
      native: async () => null,
      wasm: async () => async () => {
        throw new DOMException('Barcode detection service unavailable.', 'NotSupportedError');
      },
    });
    await expect(refused(canvas)).rejects.toBeInstanceOf(ScannerUnavailable);
  });
});

describe('the wasm reader’s formats, frame by frame', () => {
  it('reads Kept labels, product barcodes and Code 128 on every frame', () => {
    for (const formats of WASM_FRAMES)
      expect(formats).toEqual(expect.arrayContaining([...HOT_FORMATS]));
  });

  it('reads every format within a few frames, and Data Matrix at least every fourth', () => {
    expect(new Set(WASM_FRAMES.flat())).toEqual(new Set(SCAN_FORMATS));
    WASM_FRAMES.forEach((_, i) => {
      const four = [0, 1, 2, 3].map((k) => WASM_FRAMES[(i + k) % WASM_FRAMES.length] ?? []);
      expect(four.some((f) => f.includes('data_matrix'))).toBe(true);
    });
  });

  it('asks each frame’s reader in turn, making each reader once', async () => {
    const made: string[][] = [];
    const detect = rotatingDetect(
      (formats) => {
        made.push([...formats]);
        return async () => [{ rawValue: formats.join(','), format: 'qr_code' }];
      },
      [['qr_code'], ['qr_code', 'aztec']],
    );
    const reads = [];
    for (let i = 0; i < 4; i++) reads.push((await detect(canvas))[0]?.rawValue);
    expect(reads).toEqual(['qr_code', 'qr_code,aztec', 'qr_code', 'qr_code,aztec']);
    expect(made).toHaveLength(2);
  });
});

describe('the loop', () => {
  afterEach(() => vi.restoreAllMocks());

  function fakeVideo() {
    const frames: (() => void)[] = [];
    const video = Object.assign(document.createElement('video'), {
      requestVideoFrameCallback: (cb: () => void) => frames.push(cb),
      cancelVideoFrameCallback: vi.fn(),
    });
    Object.defineProperty(video, 'videoWidth', { value: 1920 });
    Object.defineProperty(video, 'videoHeight', { value: 1080 });
    const frame = () => frames.shift()?.();
    return { video, frame };
  }

  it('decodes about 8 frames a second on a downscaled frame, reporting what it read', async () => {
    const drawn: number[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
    ) {
      return { drawImage: () => drawn.push(this.width) } as never;
    });
    const { video, frame } = fakeVideo();
    let clock = 0;
    const detect = vi.fn<Detect>(async () => [qr]);
    const onRead = vi.fn();
    const stop = startScanLoop(video, detect, onRead, { now: () => clock });
    for (let i = 0; i < 60; i++) {
      clock += 1000 / 60;
      frame();
      await Promise.resolve();
      await Promise.resolve();
    }
    stop();
    // One second of 60 fps video: 8 decodes, give or take the first frame.
    expect(detect.mock.calls.length).toBeGreaterThanOrEqual(7);
    expect(detect.mock.calls.length).toBeLessThanOrEqual(9);
    expect(drawn[0]).toBe(960);
    expect(onRead).toHaveBeenCalledWith([qr]);
  });

  it('reports every code in a frame, each box as a fraction of the frame', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: () => {},
    } as never);
    const { video, frame } = fakeVideo();
    const two = [
      { ...qr, box: { x: 96, y: 54, width: 96, height: 54 } },
      { rawValue: '4006381333931', format: 'ean_13' },
    ];
    const onRead = vi.fn();
    const stop = startScanLoop(video, async () => two, onRead, { now: () => 1000 });
    frame();
    await new Promise((r) => setTimeout(r, 0));
    stop();
    expect(onRead).toHaveBeenCalledWith([
      { ...qr, box: { x: 0.1, y: 0.1, width: 0.1, height: 0.1 } },
      { rawValue: '4006381333931', format: 'ean_13' },
    ]);
  });

  it('decodes off the main thread when given a frame decoder, sized like the canvas would be', async () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    const { video, frame } = fakeVideo();
    const decoder = vi.fn<FrameDecoder>(async () => [
      { ...qr, box: { x: 480, y: 270, width: 96, height: 54 } },
    ]);
    const detect = vi.fn<Detect>(async () => []);
    const onRead = vi.fn();
    const stop = startScanLoop(video, detect, onRead, { now: () => 1000, decoder });
    frame();
    await new Promise((r) => setTimeout(r, 0));
    stop();
    expect(decoder).toHaveBeenCalledWith(video, { width: 960, height: 540 });
    expect(detect).not.toHaveBeenCalled();
    expect(getContext).not.toHaveBeenCalled();
    expect(onRead).toHaveBeenCalledWith([
      { ...qr, box: { x: 0.5, y: 0.5, width: 0.1, height: 0.1 } },
    ]);
  });

  it('goes back to the main thread for good when the frame decoder breaks', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: () => {},
    } as never);
    const { video, frame } = fakeVideo();
    let clock = 0;
    const decoder = vi.fn<FrameDecoder>(async () => {
      throw new Error('the worker died');
    });
    const detect = vi.fn<Detect>(async () => [qr]);
    const onRead = vi.fn();
    const stop = startScanLoop(video, detect, onRead, { now: () => clock, decoder });
    for (let i = 0; i < 6; i++) {
      clock += 200;
      frame();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    }
    stop();
    expect(decoder).toHaveBeenCalledTimes(1);
    expect(detect.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(onRead).toHaveBeenCalledWith([qr]);
  });

  it('stops for good when the decoder is unavailable', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: () => {},
    } as never);
    const { video, frame } = fakeVideo();
    let clock = 0;
    const detect = vi.fn<Detect>(async () => {
      throw new ScannerUnavailable();
    });
    const onUnavailable = vi.fn();
    startScanLoop(video, detect, vi.fn(), { now: () => clock, onUnavailable });
    for (let i = 0; i < 30; i++) {
      clock += 200;
      frame();
      await Promise.resolve();
      await Promise.resolve();
    }
    expect(onUnavailable).toHaveBeenCalledTimes(1);
    expect(detect).toHaveBeenCalledTimes(1);
  });
});
