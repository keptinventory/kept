import { describe, expect, it } from 'vitest';
import {
  cmToInches,
  feetAndInches,
  formatFeetInches,
  formatRoomSideField,
  formatSpan,
  inchesToCm,
  labelSize,
  ROOM_SIDE_CM,
  readRoomSide,
  readSpan,
  roomSideStep,
} from './length.js';

// #385: lengths in metric or imperial. Stored in whole centimetres either way; only what is shown
// and typed changes.

describe('centimetres and inches', () => {
  it('converts at 2.54 cm an inch, to whole units', () => {
    expect(inchesToCm(1)).toBe(3);
    expect(inchesToCm(12)).toBe(30);
    expect(inchesToCm(150)).toBe(381);
    expect(cmToInches(381)).toBe(150);
    expect(cmToInches(358)).toBe(141);
    expect(cmToInches(0)).toBe(0);
  });

  it('splits a length into feet and inches, to the nearest inch', () => {
    expect(feetAndInches(381)).toEqual({ feet: 12, inches: 6 });
    expect(feetAndInches(358)).toEqual({ feet: 11, inches: 9 });
    expect(feetAndInches(30)).toEqual({ feet: 1, inches: 0 });
    expect(feetAndInches(5)).toEqual({ feet: 0, inches: 2 });
    // 11 ft 11.6 in rounds up to 12 ft, never "11 ft 12 in".
    expect(feetAndInches(365)).toEqual({ feet: 12, inches: 0 });
  });

  it('never drifts a whole inch value through centimetres', () => {
    for (let n = 0; n <= 4000; n++) expect(cmToInches(inchesToCm(n))).toBe(n);
  });
});

describe('formatFeetInches', () => {
  it('writes feet and inches, leaving out a zero part', () => {
    expect(formatFeetInches(381, 'en')).toBe('12 ft 6 in');
    expect(formatFeetInches(366, 'en')).toBe('12 ft');
    expect(formatFeetInches(15, 'en')).toBe('6 in');
    expect(formatFeetInches(0, 'en')).toBe('0 in');
  });

  it('writes the number in the locale’s digits', () => {
    expect(formatFeetInches(381, 'ar-u-nu-arab')).toMatch(/١٢.*٦/);
  });
});

describe('formatSpan', () => {
  it('shows metres, centimetres, feet and inches, or inches', () => {
    expect(formatSpan(358, 'en', 'metric')).toBe('3.58 m');
    expect(formatSpan(80, 'en', 'metric', 'cm')).toBe('80 cm');
    expect(formatSpan(358, 'en', 'imperial')).toBe('11 ft 9 in');
    expect(formatSpan(80, 'en', 'imperial', 'cm')).toBe('31 in');
    expect(formatSpan(358, 'de', 'metric')).toBe('3,58 m');
  });
});

describe('readSpan', () => {
  it('reads feet and inches, written any usual way', () => {
    for (const typed of [
      `12'6"`,
      `12' 6"`,
      '12′6″',
      '12’ 6”',
      '12 ft 6 in',
      '12ft6in',
      '12 feet 6 inches',
      `12'6`,
      '12 ft 6',
    ]) {
      expect(readSpan(typed, 'en', 'imperial'), typed).toBeCloseTo(381, 6);
    }
    expect(readSpan('12 ft', 'en', 'imperial')).toBeCloseTo(365.76, 6);
    expect(readSpan('6 in', 'en', 'imperial')).toBeCloseTo(15.24, 6);
    expect(readSpan('6"', 'en', 'imperial')).toBeCloseTo(15.24, 6);
    expect(readSpan('12.5 ft', 'en', 'imperial')).toBeCloseTo(381, 6);
  });

  it('reads a bare number in the field’s unit', () => {
    expect(readSpan('12', 'en', 'imperial')).toBeCloseTo(365.76, 6);
    expect(readSpan('30', 'en', 'imperial', 'in')).toBeCloseTo(76.2, 6);
    expect(readSpan('3.8', 'en', 'metric')).toBeCloseTo(380, 6);
    expect(readSpan('80', 'en', 'metric', 'cm')).toBe(80);
  });

  it('reads metres and centimetres typed with their unit in either system', () => {
    expect(readSpan('3.8 m', 'en', 'imperial')).toBeCloseTo(380, 6);
    expect(readSpan('3,8 m', 'en', 'imperial')).toBeCloseTo(380, 6);
    expect(readSpan('80 cm', 'en', 'imperial')).toBe(80);
    expect(readSpan('3.8 m', 'en', 'metric')).toBeCloseTo(380, 6);
    expect(readSpan(`12'6"`, 'en', 'metric')).toBeCloseTo(381, 6);
  });

  it('reads what it formatted, in every language', () => {
    for (const tag of ['ar', 'ar-u-nu-arab', 'de', 'en', 'es', 'fr', 'it', 'uk', 'vi']) {
      for (const cm of [50, 381, 1000, 10_000]) {
        const shown = formatSpan(cm, tag, 'imperial');
        const back = readSpan(shown, tag, 'imperial');
        expect(back, `${tag} ${shown}`).not.toBe(false);
        expect(formatSpan(back as number, tag, 'imperial'), tag).toBe(shown);
        expect(readSpan(formatSpan(cm, tag, 'metric'), tag, 'metric'), tag).toBeCloseTo(cm, 6);
      }
    }
  });

  it('says what isn’t a length, rather than guessing', () => {
    expect(readSpan('', 'en', 'imperial')).toBeNull();
    expect(readSpan('  ', 'en', 'imperial')).toBeNull();
    for (const typed of ['12 6', 'abc', '-2 ft', '1e3', `6" 12'`, '12 ft ft', '3 m 20 cm 2']) {
      expect(readSpan(typed, 'en', 'imperial'), typed).toBe(false);
    }
  });
});

describe('a room side in either system', () => {
  it('shows the field in metres, or feet and inches', () => {
    expect(formatRoomSideField(358, 'en', 'metric')).toBe('3.58 m');
    expect(formatRoomSideField(358, 'en', 'imperial')).toBe('11 ft 9 in');
  });

  it('reads it back as whole centimetres', () => {
    expect(readRoomSide(`12'6"`, 'en', 'imperial')).toBe(381);
    expect(readRoomSide('12 ft 6 in', 'en', 'imperial')).toBe(381);
    expect(readRoomSide('3.8 m', 'en', 'imperial')).toBe(380);
    expect(readRoomSide('3.58', 'en', 'metric')).toBe(358);
    expect(readRoomSide('', 'en', 'imperial')).toBeNull();
    expect(readRoomSide('x', 'en', 'imperial')).toBe(false);
  });

  it('round-trips without drifting a centimetre', () => {
    for (let cm = ROOM_SIDE_CM.min; cm <= 2000; cm++) {
      // Metric is exact.
      expect(readRoomSide(formatRoomSideField(cm, 'en', 'metric'), 'en', 'metric')).toBe(cm);
      // Imperial shows the nearest inch: read back, it is that inch, and shows the same again.
      const shown = formatRoomSideField(cm, 'en', 'imperial');
      const back = readRoomSide(shown, 'en', 'imperial') as number;
      expect(Math.abs(back - cm)).toBeLessThanOrEqual(1.27);
      expect(formatRoomSideField(back, 'en', 'imperial')).toBe(shown);
      expect(readRoomSide(formatRoomSideField(back, 'en', 'imperial'), 'en', 'imperial')).toBe(
        back,
      );
    }
  });

  it('steps a centimetre in metric and an inch in imperial', () => {
    expect(roomSideStep(358, 1, 'metric')).toBe(359);
    expect(roomSideStep(358, -1, 'metric')).toBe(357);
    // 358 cm shows as 141 in: a step goes to 142 in, and back to 140 in.
    expect(roomSideStep(358, 1, 'imperial')).toBe(inchesToCm(142));
    expect(roomSideStep(358, -1, 'imperial')).toBe(inchesToCm(140));
  });
});

describe('label sizes', () => {
  it('are millimetres in metric and inches to two decimals in imperial', () => {
    expect(labelSize(70, 'metric')).toBe(70);
    expect(labelSize(38.1, 'metric')).toBe(38);
    expect(labelSize(66.675, 'imperial')).toBe(2.63);
    expect(labelSize(25.4, 'imperial')).toBe(1);
    expect(labelSize(215.9, 'imperial')).toBe(8.5);
    expect(labelSize(24, 'imperial')).toBe(0.94);
  });
});
