import { mapModel, sizedKey, sizedOf } from '@kept/shared';
import { describe, expect, it } from 'vitest';
import { type Box, sizedParts } from './sized';

// #240, #241: a cube shelf and a bookcase drawn from their numbers. The boards and the spaces
// between them, in metres, corner at the origin, width along x, depth along z, up along y.

const cm = (v: number) => Math.round(v * 1000) / 10;
const bounds = (boxes: readonly Box[]) => {
  const lo = (a: (b: Box) => number, s: (b: Box) => number) =>
    Math.min(...boxes.map((b) => a(b) - s(b) / 2));
  const hi = (a: (b: Box) => number, s: (b: Box) => number) =>
    Math.max(...boxes.map((b) => a(b) + s(b) / 2));
  return {
    w: cm(
      hi(
        (b) => b.x,
        (b) => b.w,
      ) -
        lo(
          (b) => b.x,
          (b) => b.w,
        ),
    ),
    h: cm(
      hi(
        (b) => b.y,
        (b) => b.h,
      ) -
        lo(
          (b) => b.y,
          (b) => b.h,
        ),
    ),
    d: cm(
      hi(
        (b) => b.z,
        (b) => b.d,
      ) -
        lo(
          (b) => b.z,
          (b) => b.d,
        ),
    ),
    floor: cm(
      lo(
        (b) => b.y,
        (b) => b.h,
      ),
    ),
  };
};
const partsOf = (key: Parameters<typeof sizedOf>[0]) => {
  const s = sizedOf(key);
  if (!s) throw new Error(key);
  return sizedParts(s);
};

describe('a cube shelf drawn from its grid (#240)', () => {
  it.each([
    [1, 4, 42, 147],
    [4, 1, 147, 42],
    [2, 2, 77, 77],
    [2, 4, 77, 147],
    [3, 3, 112, 112],
    [4, 4, 147, 147],
    [5, 5, 182, 182],
  ])('%i across × %i up measures %i × 39 × %i cm, as its model', (across, up, w, h) => {
    const key = sizedKey({ base: 'cube_grid', across, up });
    const { boards, spaces } = partsOf(key);
    expect(bounds(boards)).toEqual({ w, h, d: 39, floor: 0 });
    const m = mapModel(key);
    expect([cm(m.w), cm(m.d), cm(m.h ?? 0)]).toEqual([w, 39, h]);
    // A frame of four boards, a divider between each two cubes, no back: one space per cube.
    expect(boards).toHaveLength(4 + (across - 1) + (up - 1));
    expect(spaces).toHaveLength(across * up);
    for (const s of spaces) expect([cm(s.w), cm(s.h)]).toEqual([33, 33]);
  });

  it('opens every cube to the front, row by row from the bottom', () => {
    const { spaces } = partsOf('cube_grid_3x2');
    expect(spaces.map((s) => cm(s.y - s.h / 2))).toEqual([4.5, 4.5, 4.5, 39.5, 39.5, 39.5]);
    expect(spaces.slice(0, 3).map((s) => cm(s.x - s.w / 2))).toEqual([4.5, 39.5, 74.5]);
  });
});

describe('a bookcase drawn with its levels (#241)', () => {
  it('stands 80 × 28 × 202 cm with 6 levels at first, as its model', () => {
    const { boards, spaces } = partsOf('bookcase');
    expect(bounds(boards)).toEqual({ w: 80, h: 202, d: 28, floor: 0 });
    expect(spaces).toHaveLength(6);
  });

  it.each([1, 3, 6, 8])('spaces %i levels evenly, from the bottom shelf to the top', (levels) => {
    const key = sizedKey({ base: 'bookcase', w: 60, d: 30, h: 180, levels });
    const { boards, spaces } = partsOf(key);
    expect(bounds(boards)).toEqual({ w: 60, h: 180, d: 30, floor: 0 });
    expect(spaces).toHaveLength(levels);
    // The bottom shelf, one between each two levels, and the top: one more than the levels.
    expect(boards.filter((b) => b.part === 'shelf')).toHaveLength(levels + 1);
    const heights = new Set(spaces.map((s) => cm(s.h)));
    expect(heights.size).toBe(1);
    for (let i = 1; i < spaces.length; i++) {
      const below = spaces[i - 1] as Box;
      const here = spaces[i] as Box;
      expect(here.y).toBeGreaterThan(below.y);
    }
    const top = spaces[spaces.length - 1] as Box;
    expect(top.y + top.h / 2).toBeLessThan(1.8);
  });
});
