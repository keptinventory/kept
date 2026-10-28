/**
 * Frame after frame: a printed code is reported once two reads in a row agree, so one frame's
 * misread never reaches the scanner; it is sure only when both reads were.
 */
import { describe, expect, it } from 'vitest';
import { agreeingReads } from './reader';
import type { PrintedRead } from './recognise';

const read = (code: string, sure = true): PrintedRead => ({
  code,
  sure,
  score: sure ? 0.9 : 0.7,
  margin: sure ? 0.6 : 0.1,
  box: { x: 0, y: 0, width: 10, height: 10 },
});

/** A reader fed `reads` in turn, one frame each, 300 ms apart. */
function feed(reads: (PrintedRead | null)[], within?: number) {
  let t = 0;
  let i = 0;
  const next = agreeingReads(() => reads[i++] ?? null, {
    now: () => t,
    ...(within ? { within } : {}),
  });
  const frame = { width: 1, height: 1, data: new Uint8ClampedArray(4) };
  return reads.map(() => {
    t += 300;
    return next(frame);
  });
}

describe('agreeingReads', () => {
  it('reports a code read twice in a row, once', () => {
    expect(feed([read('K7D2QX'), read('K7D2QX'), read('K7D2QX')])).toEqual([
      null,
      { code: 'K7D2QX', sure: true },
      null,
    ]);
  });

  it('never reports a code read once, or two codes that differ', () => {
    expect(feed([read('K7D2QX'), read('K7D2QB'), null, read('K7D2QX')])).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it('is unsure unless both reads were sure', () => {
    expect(feed([read('K7D2QX', false), read('K7D2QX')])[1]).toEqual({
      code: 'K7D2QX',
      sure: false,
    });
  });

  it('does not join reads too far apart', () => {
    expect(feed([read('K7D2QX'), read('K7D2QX')], 200)).toEqual([null, null]);
  });
});
