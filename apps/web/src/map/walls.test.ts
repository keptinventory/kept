import { describe, expect, it } from 'vitest';
import { CURB, fullHeight, hungShown, WALL_ABOVE, WALL_HEIGHT, wallHeight } from './walls';

// A room's two walls stand on its −x and −z sides. Turned so that one stands between the camera
// and the room, it drops to a curb; turned back, it stands again. #138: a wall something hangs on
// stands too (on any side), tall enough for it, and drops the same way, taking what hangs on it.

const deg = (d: number) => (d * Math.PI) / 180;

describe('wallHeight', () => {
  it('keeps both walls standing at the opening view, which looks at them from inside', () => {
    expect(wallHeight('-x', deg(45))).toBe(WALL_HEIGHT);
    expect(wallHeight('-z', deg(45))).toBe(WALL_HEIGHT);
  });

  it('drops the wall the camera looks through, and only that one', () => {
    // Turned a quarter: the camera stands on the room's −z side.
    expect(wallHeight('-z', deg(135))).toBe(CURB);
    expect(wallHeight('-x', deg(135))).toBe(WALL_HEIGHT);
    // A quarter the other way: on the −x side.
    expect(wallHeight('-x', deg(-45))).toBe(CURB);
    expect(wallHeight('-z', deg(-45))).toBe(WALL_HEIGHT);
  });

  it('drops both when the camera looks from the walls’ corner', () => {
    expect(wallHeight('-x', deg(225))).toBe(CURB);
    expect(wallHeight('-z', deg(225))).toBe(CURB);
  });

  it('keeps a wall seen edge-on standing', () => {
    expect(wallHeight('-z', deg(90))).toBe(WALL_HEIGHT);
    expect(wallHeight('-x', deg(180))).toBe(WALL_HEIGHT);
  });

  it('goes down smoothly as the view turns, never jumping', () => {
    let prev = wallHeight('-z', deg(90));
    for (let d = 91; d <= 180; d++) {
      const h = wallHeight('-z', deg(d));
      expect(h).toBeLessThanOrEqual(prev);
      expect(prev - h).toBeLessThan((WALL_HEIGHT - CURB) / 8);
      prev = h;
    }
    expect(prev).toBe(CURB);
  });

  it('reads any number of whole turns the same, as two-finger turns leave them', () => {
    for (const d of [45, 135, 225, 315]) {
      for (const side of ['-x', '-z', '+x', '+z'] as const) {
        expect(wallHeight(side, deg(d + 360 * 3))).toBeCloseTo(wallHeight(side, deg(d)), 9);
        expect(wallHeight(side, deg(d - 360 * 2))).toBeCloseTo(wallHeight(side, deg(d)), 9);
      }
    }
  });

  it('drops the front walls at the opening view and stands them from the other side (#138)', () => {
    // The opening view looks from the +x, +z corner: those walls are between it and the room.
    expect(wallHeight('+x', deg(45))).toBe(CURB);
    expect(wallHeight('+z', deg(45))).toBe(CURB);
    // Turned to look at them from inside, they stand and the back walls drop.
    expect(wallHeight('+x', deg(225))).toBe(WALL_HEIGHT);
    expect(wallHeight('+z', deg(225))).toBe(WALL_HEIGHT);
    expect(wallHeight('-x', deg(225))).toBe(CURB);
  });

  it('stands a taller wall at its own height and drops it to the same curb', () => {
    expect(wallHeight('-z', deg(45), 2.1)).toBe(2.1);
    expect(wallHeight('-z', deg(135), 2.1)).toBe(CURB);
    const mid = wallHeight('-z', deg(112), 2.1);
    expect(mid).toBeGreaterThan(CURB);
    expect(mid).toBeLessThan(2.1);
  });
});

describe('walls for things on them (#138)', () => {
  it('stands the two back walls of a room, raised for what hangs there', () => {
    expect(fullHeight('-z', undefined, true)).toBe(WALL_HEIGHT);
    expect(fullHeight('-x', 1.0, true)).toBe(WALL_HEIGHT);
    // A clock's top at 1.95 m: the wall clears it.
    expect(fullHeight('-z', 1.95, true)).toBeCloseTo(1.95 + WALL_ABOVE);
  });

  it('stands any other wall only for something on it, in a room or outdoors', () => {
    expect(fullHeight('+x', undefined, true)).toBeNull();
    expect(fullHeight('+z', 1.55, true)).toBeCloseTo(1.55 + WALL_ABOVE);
    expect(fullHeight('-z', undefined, false)).toBeNull();
    expect(fullHeight('-x', 1.2, false)).toBeCloseTo(1.2 + WALL_ABOVE);
  });

  it('shows a thing while its wall stands behind its middle, and hides it as the wall drops', () => {
    const full = fullHeight('-z', 1.555, true) ?? 0;
    expect(hungShown(wallHeight('-z', deg(45), full), 1.2)).toBe(true);
    expect(hungShown(wallHeight('-z', deg(135), full), 1.2)).toBe(false);
    // On the way down, gone once the wall's top passes its middle.
    const partly = wallHeight('-z', deg(110), full);
    expect(hungShown(partly, 1.2)).toBe(partly >= 1.2);
  });
});
