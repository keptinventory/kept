/**
 * The scan Worker's decoder choice (#486): a decoder that can't start answers "unavailable" for
 * that frame, and the next start picks again instead of answering "unavailable" until the worker
 * is gone. The worker's `self` is the test's window; the decoders are fakes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Detect } from './label-recogniser';
import type { ScanWorkerAnswer, ScanWorkerAsk } from './worker-detect';

const decoders = vi.hoisted(() => ({
  native: vi.fn<() => Promise<Detect | null>>(),
  wasm: vi.fn<() => Promise<Detect>>(),
}));
vi.mock('./scanner', async (original) => ({
  ...(await original<typeof import('./scanner')>()),
  nativeScanner: decoders.native,
  loadWasmScanner: decoders.wasm,
}));

const qr = { rawValue: 'https://kept.example/l/7KQ4MZ', format: 'qr_code' };
let answers: ScanWorkerAnswer[];

beforeEach(async () => {
  vi.resetModules();
  answers = [];
  vi.spyOn(window, 'postMessage').mockImplementation(((a: ScanWorkerAnswer) => {
    answers.push(a);
  }) as typeof window.postMessage);
  decoders.native.mockReset().mockResolvedValue(null);
  decoders.wasm.mockReset();
  await import('./scan.worker');
});
afterEach(() => {
  vi.restoreAllMocks();
  window.onmessage = null;
});

async function ask(id: number) {
  const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
  const data: ScanWorkerAsk = { id, bitmap, formats: [] };
  await (window.onmessage as unknown as (e: { data: ScanWorkerAsk }) => Promise<void>)({ data });
  return bitmap;
}

describe('the scan worker', () => {
  it('picks its decoder again after one that could not start', async () => {
    decoders.wasm
      .mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module'))
      .mockResolvedValue(async () => [qr]);
    await ask(1);
    await ask(2);
    expect(answers).toEqual([
      { id: 1, unavailable: true },
      { id: 2, found: [qr] },
    ]);
  });

  it('drops a decoder that refuses as unsupported, and closes every frame', async () => {
    decoders.native
      .mockResolvedValueOnce(async () => {
        throw new DOMException('Barcode detection service unavailable.', 'NotSupportedError');
      })
      .mockResolvedValue(async () => [qr]);
    const first = await ask(1);
    await ask(2);
    expect(answers).toEqual([
      { id: 1, unavailable: true },
      { id: 2, found: [qr] },
    ]);
    expect(first.close).toHaveBeenCalled();
  });

  it('counts any other error as one bad frame', async () => {
    decoders.wasm.mockResolvedValue(async () => {
      throw new Error('one bad frame');
    });
    await ask(1);
    expect(answers).toEqual([{ id: 1, failed: true }]);
  });
});
