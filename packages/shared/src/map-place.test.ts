import { describe, expect, it } from 'vitest';
import { rectsOverlap } from './map.js';
import { placeInRoom } from './map-place.js';

describe('placeInRoom', () => {
  it('puts the first thing at the corner, off the walls', () => {
    expect(placeInRoom({ w: 4, d: 3 }, [], [{ w: 0.5, d: 0.5 }])).toEqual([{ x: 0.15, z: 0.15 }]);
  });

  it('goes round what already stands there, in rows, never overlapping', () => {
    const taken = [{ x: 0.15, z: 0.15, w: 1, d: 1 }];
    const sizes = Array.from({ length: 8 }, () => ({ w: 0.6, d: 0.5 }));
    const spots = placeInRoom({ w: 3, d: 4 }, taken, sizes);
    const rects = spots.map((s, i) => {
      if (!s) throw new Error(`no spot for ${i}`);
      return { ...s, ...(sizes[i] as { w: number; d: number }) };
    });
    for (const [i, r] of rects.entries()) {
      expect(rectsOverlap(r, taken[0] as (typeof taken)[0])).toBe(false);
      expect(r.x + r.w).toBeLessThanOrEqual(3);
      expect(r.z + r.d).toBeLessThanOrEqual(4);
      for (const o of rects.slice(i + 1)) expect(rectsOverlap(r, o)).toBe(false);
    }
  });

  it('answers null for what no longer fits', () => {
    const spots = placeInRoom(
      { w: 1, d: 1 },
      [],
      [
        { w: 0.5, d: 0.5 },
        { w: 0.5, d: 0.5 },
      ],
    );
    expect(spots[0]).toEqual({ x: 0.15, z: 0.15 });
    expect(spots[1]).toBeNull();
  });
});
