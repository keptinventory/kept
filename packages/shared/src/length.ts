/**
 * A room's sides as a person types and reads them (#372): metres to the centimetre, stored as
 * whole centimetres (map_nodes `w_cm`, `d_cm`). The size fields and labels go through these
 * alone, so imperial (#385) changes this file, not the screens.
 *
 * Typing is read here (`readLength`), not by the field: the person's locale's decimal mark, so
 * 0,80 in French, German, Italian and Vietnamese and 0.80 in English, Western or Eastern Arabic
 * digits whichever the setting shows, and anything else is said to be wrong rather than dropped
 * (a React Aria NumberField dropped what it couldn't use: "0,8" in English was 8 m). Grouping is
 * off, so a comma is never read as thousands (a side is at most 100 m).
 */
/** A room's side on the map, in whole centimetres: from 50 cm (a narrow balcony, #372) to
 * 100 m. MAP_LIMITS.minRoom and maxRoom are these. Here rather than in map.ts, so a screen that
 * only types a room's size doesn't load the map's model catalogue (the PWA precache keeps map.ts
 * on demand). */
export const ROOM_SIDE_CM = Object.freeze({ min: 50, max: 10_000 });

/** The unit the fields show. Metric only for now; #385 adds feet and inches. */
export type LengthUnit = 'm';

/** A room side's field: its unit and the step of its − and + buttons and arrow keys. */
export const ROOM_SIDE = Object.freeze({ unit: 'm' as LengthUnit, step: 0.01 });

/** How a room side's field shows its number: metres with two decimals (0.80 m), never grouped. */
export function roomSideFormat(_unit: LengthUnit = ROOM_SIDE.unit): Intl.NumberFormatOptions {
  return {
    style: 'unit',
    unit: 'meter',
    unitDisplay: 'short',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  };
}

/** A side typed in `unit` as whole centimetres; null when nothing (or no number) was typed. */
export function roomSideToCm(value: number, _unit: LengthUnit = ROOM_SIDE.unit): number | null {
  if (!Number.isFinite(value)) return null;
  // 3.58 m is 357.99999999999994 cm in floating point: rounded, it is 358.
  return Math.round(value * 100);
}

/** Whole centimetres as the field's number. */
export function roomSideFromCm(cm: number, _unit: LengthUnit = ROOM_SIDE.unit): number {
  return cm / 100;
}

export type RoomSideProblem = 'missing' | 'not_a_number' | 'too_small' | 'too_large';

/** Why a side can't be a room's: nothing typed, not a number (NaN: what `readLength` couldn't
 * read), under 50 cm, over 100 m (ROOM_SIDE_CM). */
export function roomSideProblem(cm: number | null): RoomSideProblem | null {
  if (cm === null) return 'missing';
  if (!Number.isFinite(cm)) return 'not_a_number';
  if (cm < ROOM_SIDE_CM.min) return 'too_small';
  if (cm > ROOM_SIDE_CM.max) return 'too_large';
  return null;
}

/** A side for reading, without its unit: "0.8", "3.58", "4" (no trailing zeros). `locale` is a
 * BCP 47 tag, digits included (ar-u-nu-arab). */
export function formatRoomSide(
  cm: number,
  locale: string,
  _unit: LengthUnit = ROOM_SIDE.unit,
): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2, useGrouping: false }).format(
    Math.round(cm) / 100,
  );
}

/** Format marks a pasted or formatted number can carry: LRM, RLM, ALM, and the bidi isolates. */
const MARKS = /[\u200e\u200f\u061c\u2066-\u2069]/g;

/** What a unit is written as, short ("m", "متر"), in `locale` and in English. */
function unitWords(locale: string, unit: string): string[] {
  const of = (tag: string) =>
    new Intl.NumberFormat(tag, { style: 'unit', unit, unitDisplay: 'short' })
      .formatToParts(1)
      .filter((p) => p.type === 'unit')
      .map((p) => p.value)
      .join('');
  return [...new Set([of(locale), of('en')])].filter(Boolean);
}

/** A digit in any of the sets a person may type, as a Western one: Eastern Arabic ٠–٩, Persian
 * ۰–۹ and 0–9. */
function westernDigit(ch: string): string | null {
  const c = ch.charCodeAt(0);
  if (c >= 0x30 && c <= 0x39) return ch;
  if (c >= 0x660 && c <= 0x669) return String(c - 0x660);
  if (c >= 0x6f0 && c <= 0x6f9) return String(c - 0x6f0);
  return null;
}

/**
 * A number as a person typed it into a length's field, in `locale` (a BCP 47 tag, digits
 * included: ar-u-nu-arab). Read: Western and Eastern Arabic digits, whichever the setting shows
 * (a phone's other keyboard types the other set); the locale's decimal mark, and the Arabic one
 * (٫) everywhere, with "." too in Arabic; the unit the field shows (`unit`, an Intl unit; null
 * for a count), so a value it formatted reads back. Not read, and so `false`: anything else, such as a comma in
 * English ("0,8"), an exponent ("1e3"), a sign ("-2"), grouping or a second decimal mark. null
 * when nothing is typed.
 */
export function readLength(
  text: string,
  locale: string,
  unit: string | null = 'meter',
): number | null | false {
  // Spaces only around the number: "3 58" is not 358.
  let s = text.replace(MARKS, '').trim();
  for (const word of unit ? unitWords(locale, unit).sort((a, b) => b.length - a.length) : []) {
    if (s.endsWith(word)) s = s.slice(0, -word.length).trim();
    else if (s.startsWith(word)) s = s.slice(word.length).trim();
  }
  if (!s) return null;
  const decimal =
    new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === 'decimal')?.value ??
    '.';
  const marks = new Set([decimal, '\u066b']);
  if (locale.split('-')[0] === 'ar') marks.add('.');
  let plain = '';
  for (const ch of s) {
    const d = westernDigit(ch);
    if (d !== null) plain += d;
    else if (marks.has(ch)) plain += '.';
    else return false;
  }
  if (!/^(\d+\.?\d*|\.\d+)$/.test(plain)) return false;
  return Number(plain);
}
