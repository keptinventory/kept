/**
 * The scanner's decoder in a Worker (scan sessions, #168): the frame is copied off the video as
 * an `ImageBitmap` at the size the decoder reads, transferred to the worker (./scan.worker.ts),
 * and decoded there with the same choice as on the main thread (the native `BarcodeDetector`
 * where the worker has one that reads QR codes, else the ZXing wasm), so the screen never waits
 * on a decode. `startScanLoop` takes it as its `decoder`, and falls back to the main thread when
 * it breaks.
 *
 * None where the browser has no `Worker` or no `createImageBitmap` (the loop then decodes on the
 * main thread, as Scan always has). The worker's chunk is cached on first use, not precached: a
 * worker that can't load (offline before its first use) fails, and the loop decodes on the main
 * thread from then on.
 */
import type { Detected } from './label-recogniser';
import { type FrameDecoder, SCAN_FORMATS, ScannerUnavailable } from './scanner';

export type ScanWorkerAsk = { id: number; bitmap: ImageBitmap; formats: readonly string[] };
export type ScanWorkerAnswer =
  | { id: number; found: Detected[] }
  | { id: number; unavailable: true }
  /** One bad frame: the next tries again. */
  | { id: number; failed: true };

type CreateBitmap = (source: HTMLVideoElement, options: ImageBitmapOptions) => Promise<ImageBitmap>;

const defaultWorker = () =>
  new Worker(new URL('./scan.worker.ts', import.meta.url), { type: 'module', name: 'scan' });

export function workerDecoder({
  worker = typeof Worker === 'function' ? defaultWorker : null,
  createBitmap = typeof createImageBitmap === 'function'
    ? (createImageBitmap as unknown as CreateBitmap)
    : null,
}: {
  worker?: (() => Worker) | null;
  createBitmap?: CreateBitmap | null;
} = {}): FrameDecoder | null {
  if (!worker || !createBitmap) return null;
  let w: Worker | null = null;
  let broken: Error | null = null;
  let next = 1;
  const waiting = new Map<
    number,
    { resolve: (d: Detected[]) => void; reject: (e: Error) => void }
  >();
  const start = (): Worker => {
    if (w) return w;
    const made = worker();
    made.onmessage = (e: MessageEvent<ScanWorkerAnswer>) => {
      const a = e.data;
      const p = waiting.get(a.id);
      if (!p) return;
      waiting.delete(a.id);
      if ('found' in a) p.resolve(a.found);
      else if ('unavailable' in a) p.reject(new ScannerUnavailable());
      else p.resolve([]);
    };
    made.onerror = () => {
      broken = new Error('The scan worker stopped.');
      made.terminate();
      for (const p of waiting.values()) p.reject(broken);
      waiting.clear();
    };
    w = made;
    return made;
  };
  return async (video, size) => {
    if (broken) throw broken;
    const target = start();
    const bitmap = await createBitmap(video, {
      resizeWidth: size.width,
      resizeHeight: size.height,
      resizeQuality: 'low',
    });
    const id = next++;
    return new Promise<Detected[]>((resolve, reject) => {
      waiting.set(id, { resolve, reject });
      const ask: ScanWorkerAsk = { id, bitmap, formats: SCAN_FORMATS };
      target.postMessage(ask, [bitmap]);
    });
  };
}
