/**
 * The scan Worker (./worker-detect.ts): decodes the frames it is sent, one at a time, with the
 * native `BarcodeDetector` where this worker has one that reads every format, else the ZXing wasm
 * (loaded on the first frame; precached with the app, so it works offline). The formats and their
 * turns are the main thread's (scanner.ts), and so is the choice (`createDetect`): a decoder that
 * can't start, or refuses as unsupported, answers "unavailable" for that frame and is picked
 * again on the next one (#486).
 */
import { createDetect, loadWasmScanner, nativeScanner, ScannerUnavailable } from './scanner';
import type { ScanWorkerAnswer, ScanWorkerAsk } from './worker-detect';

const detect = createDetect({
  native: () => nativeScanner(self as unknown as { BarcodeDetector?: unknown }),
  wasm: loadWasmScanner,
});

self.onmessage = async (e: MessageEvent<ScanWorkerAsk>) => {
  const { id, bitmap } = e.data;
  const answer = (a: ScanWorkerAnswer) => (self as unknown as Worker).postMessage(a);
  try {
    answer({ id, found: await detect(bitmap) });
  } catch (err) {
    answer(err instanceof ScannerUnavailable ? { id, unavailable: true } : { id, failed: true });
  } finally {
    bitmap.close();
  }
};
