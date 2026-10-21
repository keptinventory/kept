/**
 * The scan Worker (./worker-detect.ts): decodes the frames it is sent, one at a time, with the
 * native `BarcodeDetector` where this worker has one that reads every format, else the ZXing wasm
 * (loaded on the first frame; precached with the app, so it works offline). The formats and their
 * turns are the main thread's (scanner.ts).
 */
import type { Detect } from './label-recogniser';
import { loadWasmScanner, nativeScanner } from './scanner';
import type { ScanWorkerAnswer, ScanWorkerAsk } from './worker-detect';

let chosen: Promise<Detect | null> | null = null;

const pick = (): Promise<Detect | null> => {
  chosen ??= (async () => {
    try {
      return (
        (await nativeScanner(self as unknown as { BarcodeDetector?: unknown })) ??
        (await loadWasmScanner())
      );
    } catch {
      return null;
    }
  })();
  return chosen;
};

self.onmessage = async (e: MessageEvent<ScanWorkerAsk>) => {
  const { id, bitmap } = e.data;
  const answer = (a: ScanWorkerAnswer) => (self as unknown as Worker).postMessage(a);
  try {
    const detect = await pick();
    if (!detect) {
      answer({ id, unavailable: true });
      return;
    }
    answer({ id, found: await detect(bitmap) });
  } catch (err) {
    const name = err && typeof err === 'object' && 'name' in err ? err.name : '';
    answer(name === 'NotSupportedError' ? { id, unavailable: true } : { id, failed: true });
  } finally {
    bitmap.close();
  }
};
