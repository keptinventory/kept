/**
 * Decoding in a Worker: the frame goes over as an ImageBitmap (transferred, so nothing is
 * copied), the worker answers what it read, and a worker that can't decode says so. Without
 * `Worker` or `createImageBitmap` there is no frame decoder, and the scanner decodes on the main
 * thread as before. The worker is a fake here.
 */
import { describe, expect, it, vi } from 'vitest';
import { ScannerUnavailable } from './scanner';
import { type ScanWorkerAnswer, type ScanWorkerAsk, workerDecoder } from './worker-detect';

class FakeWorker {
  onmessage: ((e: MessageEvent<ScanWorkerAnswer>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  asked: { msg: ScanWorkerAsk; transfer: Transferable[] }[] = [];
  terminate = vi.fn();
  postMessage(msg: ScanWorkerAsk, transfer: Transferable[]) {
    this.asked.push({ msg, transfer });
  }
  answer(data: ScanWorkerAnswer) {
    this.onmessage?.({ data } as MessageEvent<ScanWorkerAnswer>);
  }
}

const video = document.createElement('video');
const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
const flush = () => new Promise((r) => setTimeout(r, 0));

function setup() {
  const w = new FakeWorker();
  const createBitmap = vi.fn(async () => bitmap);
  const decode = workerDecoder({ worker: () => w as unknown as Worker, createBitmap });
  if (!decode) throw new Error('expected a decoder');
  return { w, createBitmap, decode };
}

describe('the frame decoder in a worker', () => {
  it('sends the frame, downscaled, as a transferred bitmap, and answers what the worker read', async () => {
    const { w, createBitmap, decode } = setup();
    const read = decode(video, { width: 960, height: 540 });
    await flush();
    expect(createBitmap).toHaveBeenCalledWith(video, {
      resizeWidth: 960,
      resizeHeight: 540,
      resizeQuality: 'low',
    });
    const [ask] = w.asked;
    expect(ask?.transfer).toEqual([bitmap]);
    expect(ask?.msg).toMatchObject({ bitmap, formats: expect.arrayContaining(['qr_code']) });
    const found = [{ rawValue: 'K7D2QX', format: 'qr_code' }];
    w.answer({ id: ask?.msg.id ?? -1, found });
    expect(await read).toEqual(found);
  });

  it('answers each frame by its own id', async () => {
    const { w, decode } = setup();
    const a = decode(video, { width: 10, height: 10 });
    const b = decode(video, { width: 10, height: 10 });
    await flush();
    const [first, second] = w.asked;
    w.answer({ id: second?.msg.id ?? -1, found: [{ rawValue: 'B', format: 'qr_code' }] });
    w.answer({ id: first?.msg.id ?? -1, found: [{ rawValue: 'A', format: 'qr_code' }] });
    expect((await a)[0]?.rawValue).toBe('A');
    expect((await b)[0]?.rawValue).toBe('B');
  });

  it('is unavailable when the worker has no decoder that can start', async () => {
    const { w, decode } = setup();
    const read = decode(video, { width: 10, height: 10 });
    await flush();
    w.answer({ id: w.asked[0]?.msg.id ?? -1, unavailable: true });
    await expect(read).rejects.toBeInstanceOf(ScannerUnavailable);
  });

  it('fails every waiting frame when the worker itself fails', async () => {
    const { w, decode } = setup();
    const read = decode(video, { width: 10, height: 10 });
    await flush();
    w.onerror?.({} as ErrorEvent);
    await expect(read).rejects.toThrow();
    expect(w.terminate).toHaveBeenCalled();
  });

  it('is none without Worker or createImageBitmap', () => {
    expect(workerDecoder({ worker: null, createBitmap: async () => bitmap })).toBeNull();
    expect(
      workerDecoder({ worker: () => new FakeWorker() as never, createBitmap: null }),
    ).toBeNull();
  });
});
