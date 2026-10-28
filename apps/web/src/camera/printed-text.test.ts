/**
 * The scanner's decoder with printed codes added: a barcode or QR read wins, and only a frame
 * with nothing in it is read for a printed code, at most every so often, by the reader loaded on
 * the first such frame. A reader that can't load turns printed codes off; barcodes still read.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Detected } from './label-recogniser';
import { PRINTED_CODE, withPrintedCodes } from './printed-text';

const canvas = {} as CanvasImageSource;
const frame = { width: 2, height: 2, data: new Uint8ClampedArray(16) };

function setup(found: Detected[] = [], reads: ({ code: string; sure: boolean } | null)[] = []) {
  let t = 0;
  const reader = vi.fn(() => reads.shift() ?? null);
  const load = vi.fn(async () => ({ agreeingReads: () => reader }));
  const detect = withPrintedCodes(async () => found, {
    load,
    frameOf: () => frame,
    now: () => t,
    every: 300,
  });
  return { detect, reader, load, tick: (ms: number) => (t += ms) };
}

describe('withPrintedCodes', () => {
  it('passes a barcode read through without looking for a printed code', async () => {
    const qr = { rawValue: 'https://kept.example/l/K7D2QX', format: 'qr_code' };
    const { detect, load } = setup([qr]);
    expect(await detect(canvas)).toEqual([qr]);
    expect(load).not.toHaveBeenCalled();
  });

  it('reads an empty frame for a printed code, marked as one and sure or not', async () => {
    const { detect, tick } = setup([], [{ code: 'K7D2QX', sure: false }]);
    tick(1000);
    expect(await detect(canvas)).toEqual([
      { rawValue: 'K7D2QX', format: PRINTED_CODE, sure: false },
    ]);
  });

  it('looks at most every `every` ms', async () => {
    const { detect, reader, tick } = setup();
    tick(1000);
    await detect(canvas);
    tick(100);
    await detect(canvas);
    expect(reader).toHaveBeenCalledTimes(1);
    tick(300);
    await detect(canvas);
    expect(reader).toHaveBeenCalledTimes(2);
  });

  it('turns printed codes off when the reader cannot load, and keeps reading barcodes', async () => {
    const load = vi.fn(async () => {
      throw new Error('offline');
    });
    let t = 1000;
    const detect = withPrintedCodes(async () => [], {
      load,
      frameOf: () => frame,
      now: () => (t += 1000),
    });
    expect(await detect(canvas)).toEqual([]);
    expect(await detect(canvas)).toEqual([]);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
