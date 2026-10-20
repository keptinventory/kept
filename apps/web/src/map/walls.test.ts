import { describe, expect, it } from 'vitest';
import { CURB, WALL_HEIGHT, wallHeight } from './walls';

// A room's two walls stand on its −x and −z sides. Turned so that one stands between the camera
// and the room, it drops to a curb; turned back, it stands again.

const deg = (d: number) => (d * Math.PI) / 180;

describe('wallHeight', () => {
  it('keeps both walls standing at the opening view, which looks at them from inside', () => {
    expect(wallHeight('x', deg(45))).toBe(WALL_HEIGHT);
    expect(wallHeight('z', deg(45))).toBe(WALL_HEIGHT);
  });

  it('drops the wall the camera looks through, and only that one', () => {
    // Turned a quarter: the camera stands on the room's −z side.
    expect(wallHeight('z', deg(135))).toBe(CURB);
    expect(wallHeight('x', deg(135))).toBe(WALL_HEIGHT);
    // A quarter the other way: on the −x side.
    expect(wallHeight('x', deg(-45))).toBe(CURB);
    expect(wallHeight('z', deg(-45))).toBe(WALL_HEIGHT);
  });

  it('drops both when the camera looks from the walls’ corner', () => {
    expect(wallHeight('x', deg(225))).toBe(CURB);
    expect(wallHeight('z', deg(225))).toBe(CURB);
  });

  it('keeps a wall seen edge-on standing', () => {
    expect(wallHeight('z', deg(90))).toBe(WALL_HEIGHT);
    expect(wallHeight('x', deg(180))).toBe(WALL_HEIGHT);
  });

  it('goes down smoothly as the view turns, never jumping', () => {
    let prev = wallHeight('z', deg(90));
    for (let d = 91; d <= 180; d++) {
      const h = wallHeight('z', deg(d));
      expect(h).toBeLessThanOrEqual(prev);
      expect(prev - h).toBeLessThan((WALL_HEIGHT - CURB) / 8);
      prev = h;
    }
    expect(prev).toBe(CURB);
  });

  it('reads any number of whole turns the same, as two-finger turns leave them', () => {
    for (const d of [45, 135, 225, 315]) {
      for (const side of ['x', 'z'] as const) {
        expect(wallHeight(side, deg(d + 360 * 3))).toBeCloseTo(wallHeight(side, deg(d)), 9);
        expect(wallHeight(side, deg(d - 360 * 2))).toBeCloseTo(wallHeight(side, deg(d)), 9);
      }
    }
  });
});
