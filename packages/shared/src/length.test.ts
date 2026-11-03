import { describe, expect, it } from 'vitest';
import {
  formatRoomSide,
  ROOM_SIDE,
  ROOM_SIDE_CM,
  readLength,
  roomSideFormat,
  roomSideFromCm,
  roomSideProblem,
  roomSideToCm,
} from './length.js';
import { MAP_LIMITS } from './map.js';

// #372: a room's sides, typed in metres to the centimetre and kept as whole centimetres.

describe('the map’s room limits (#372)', () => {
  it('takes a room from 50 cm a side (a narrow balcony) to 100 m', () => {
    expect(MAP_LIMITS.minRoom).toBe(50);
    expect(MAP_LIMITS.maxRoom).toBe(10_000);
    expect(ROOM_SIDE_CM).toEqual({ min: MAP_LIMITS.minRoom, max: MAP_LIMITS.maxRoom });
  });
});

describe('roomSideToCm and roomSideFromCm', () => {
  it('reads metres as whole centimetres, without float dust', () => {
    expect(roomSideToCm(0.8)).toBe(80);
    expect(roomSideToCm(3.58)).toBe(358);
    expect(roomSideToCm(0.5)).toBe(50);
    expect(roomSideToCm(4)).toBe(400);
    // A third decimal is rounded to the centimetre.
    expect(roomSideToCm(2.345)).toBe(235);
    expect(roomSideToCm(2.344)).toBe(234);
  });

  it('is null when nothing (or no number) was typed', () => {
    expect(roomSideToCm(Number.NaN)).toBeNull();
    expect(roomSideToCm(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('gives the field its number back', () => {
    expect(roomSideFromCm(80)).toBe(0.8);
    expect(roomSideFromCm(358)).toBe(3.58);
    for (const cm of [50, 80, 101, 358, 999, 10_000]) {
      expect(roomSideToCm(roomSideFromCm(cm))).toBe(cm);
    }
  });

  it('steps by the centimetre', () => {
    expect(ROOM_SIDE).toEqual({ unit: 'm', step: 0.01 });
  });
});

describe('roomSideProblem', () => {
  it('says what keeps a side off the map', () => {
    expect(roomSideProblem(null)).toBe('missing');
    expect(roomSideProblem(Number.NaN)).toBe('not_a_number');
    expect(roomSideProblem(49)).toBe('too_small');
    expect(roomSideProblem(50)).toBeNull();
    expect(roomSideProblem(358)).toBeNull();
    expect(roomSideProblem(10_000)).toBeNull();
    expect(roomSideProblem(10_001)).toBe('too_large');
  });
});

describe('roomSideFormat: the field’s number', () => {
  // French writes a narrow no-break space before the unit; the others a no-break space.
  const field = (locale: string, m: number) =>
    new Intl.NumberFormat(locale, roomSideFormat()).format(m).replace(/[\u00a0\u202f]/g, ' ');

  it('shows metres with two decimals, in the reader’s own decimal mark', () => {
    expect(field('en', 0.8)).toBe('0.80 m');
    expect(field('en', 3.58)).toBe('3.58 m');
    expect(field('fr', 0.8)).toBe('0,80 m');
    expect(field('de', 0.8)).toBe('0,80 m');
    expect(field('it', 0.8)).toBe('0,80 m');
    expect(field('vi', 0.8)).toBe('0,80 m');
  });

  it('never groups thousands, so a comma is only ever a decimal', () => {
    expect(roomSideFormat().useGrouping).toBe(false);
    expect(field('en', 100)).toBe('100.00 m');
  });
});

describe('formatRoomSide: a side for reading', () => {
  it('is to the centimetre, without trailing zeros', () => {
    expect(formatRoomSide(80, 'en')).toBe('0.8');
    expect(formatRoomSide(358, 'en')).toBe('3.58');
    expect(formatRoomSide(400, 'en')).toBe('4');
    expect(formatRoomSide(358, 'de')).toBe('3,58');
    expect(formatRoomSide(10_000, 'en')).toBe('100');
  });

  it('follows the reader’s digits', () => {
    expect(formatRoomSide(358, 'ar-u-nu-arab')).toBe('٣٫٥٨');
    expect(formatRoomSide(358, 'ar-u-nu-latn')).toBe('3.58');
  });
});

describe('readLength: what was typed (1.14.4 review)', () => {
  it('reads the locale’s decimal mark, and the unit the field shows', () => {
    expect(readLength('0.8', 'en')).toBe(0.8);
    expect(readLength('0.80 m', 'en')).toBe(0.8);
    expect(readLength('3.58m', 'en-GB')).toBe(3.58);
    expect(readLength('.5', 'en')).toBe(0.5);
    expect(readLength('4', 'en')).toBe(4);
    for (const l of ['fr', 'de', 'it', 'vi']) {
      expect(readLength('0,8', l)).toBe(0.8);
      expect(readLength('0,80\u202fm', l)).toBe(0.8);
    }
  });

  it('reads Western and Eastern Arabic digits whichever the setting shows', () => {
    for (const l of ['ar-u-nu-arab', 'ar-u-nu-latn']) {
      expect(readLength('٠٫٨', l)).toBe(0.8);
      expect(readLength('0.8', l)).toBe(0.8);
      expect(readLength('٣.٥٨', l)).toBe(3.58);
      expect(readLength('0٫8', l)).toBe(0.8);
      expect(readLength('٠٫٨٠ متر', l)).toBe(0.8);
      expect(readLength('\u200f3.58 متر', l)).toBe(3.58);
    }
    // The Arabic decimal mark and digits are read in any language.
    expect(readLength('٣٫٥٨', 'en')).toBe(3.58);
  });

  it('is false, not a different number, for what a length can’t be', () => {
    expect(readLength('0,8', 'en')).toBe(false);
    expect(readLength('1e3', 'en')).toBe(false);
    expect(readLength('-2', 'en')).toBe(false);
    expect(readLength('+2', 'en')).toBe(false);
    expect(readLength('1,000', 'en')).toBe(false);
    expect(readLength('1.2.3', 'en')).toBe(false);
    expect(readLength('0.8', 'de')).toBe(false);
    expect(readLength('two', 'en')).toBe(false);
    expect(readLength('3 58', 'en')).toBe(false);
    expect(readLength('1\u202f000', 'fr')).toBe(false);
    expect(readLength('.', 'en')).toBe(false);
    expect(readLength('٠٬٨', 'ar-u-nu-arab')).toBe(false);
  });

  it('is null when nothing is typed', () => {
    expect(readLength('', 'en')).toBeNull();
    expect(readLength('  ', 'en')).toBeNull();
    expect(readLength('m', 'en')).toBeNull();
  });

  it('reads centimetres where the field is in centimetres', () => {
    expect(readLength('120 cm', 'en', 'centimeter')).toBe(120);
    expect(readLength('١٢٠ سم', 'ar-u-nu-arab', 'centimeter')).toBe(120);
    // A count has no unit.
    expect(readLength('4', 'ar-u-nu-arab', null)).toBe(4);
    expect(readLength('4 m', 'en', null)).toBe(false);
  });
});
