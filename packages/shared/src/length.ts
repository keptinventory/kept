/**
 * A room's sides as a person types and reads them (#372): metres to the centimetre, stored as
 * whole centimetres (map_nodes `w_cm`, `d_cm`). The size fields and labels go through these
 * alone, so imperial (#385) changes this file, not the screens.
 *
 * Typing is read here (`readLength`), not by the field: "." or "," as the decimal mark in every
 * language (a phone's decimal keypad offers only its region's mark, so an English UI on a
 * German-region iPhone types only ","), and the Arabic ٫ too; Western or Eastern Arabic digits
 * whichever the setting shows; and anything else is said to be wrong rather than dropped (a React
 * Aria NumberField dropped what it couldn't use: "0,8" in English was 8 m). Grouping is off and a
 * side is at most 100 m, so a comma is never read as thousands.
 *
 * Shown by `formatLength`: the number in the locale's digits and mark, and the unit's word
 * written after it by hand, because Arabic inflects the word by number (متر, متران, أمتار, مترًا)
 * and for 1 and 2 writes the word alone, without digits ("متران"), which a field can't show.
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

/** A length with its unit, as a field shows it: the number in `locale`'s digits and decimal
 * mark (`fraction` digits, never grouped), then the unit's short word as the locale writes it
 * after a fraction (1.5 m), so the digits are always there and the word is one `readLength`
 * reads back. `unit` is an Intl unit ('meter', 'centimeter'). */
export function formatLength(
  value: number,
  locale: string,
  unit: string,
  fraction: { min?: number; max: number },
): string {
  const number = numberFormat(locale, {
    minimumFractionDigits: fraction.min ?? 0,
    maximumFractionDigits: fraction.max,
    useGrouping: false,
  }).format(value);
  const [before, after] = unitPattern(locale, unit);
  return `${before}${number}${after}`;
}

const formats = new Map<string, Intl.NumberFormat>();

/** One Intl.NumberFormat per locale and options: a field formats and reads on every commit, and a
 * formatter costs far more to make than to use. */
function numberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = formats.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, options);
    formats.set(key, f);
  }
  return f;
}

const patterns = new Map<string, [string, string]>();

/** What a fraction's unit is written around (1.5 m, "١٫٥ متر"): the text before its number and
 * after it. */
function unitPattern(locale: string, unit: string): [string, string] {
  const key = `${locale}|${unit}`;
  let pattern = patterns.get(key);
  if (!pattern) {
    let before = '';
    let after = '';
    let seen = false;
    for (const p of numberFormat(locale, {
      style: 'unit',
      unit,
      unitDisplay: 'short',
    }).formatToParts(1.5)) {
      if (p.type === 'integer' || p.type === 'decimal' || p.type === 'fraction') seen = true;
      else if (seen) after += p.value;
      else before += p.value;
    }
    pattern = seen ? [before, after] : ['', ` ${before}`];
    patterns.set(key, pattern);
  }
  return pattern;
}

/** A room side's field: metres with two decimals (0.80 m, "٠٫٨٠ متر"), never grouped. */
export function formatRoomSideField(
  cm: number,
  locale: string,
  _unit: LengthUnit = ROOM_SIDE.unit,
): string {
  return formatLength(roomSideFromCm(cm), locale, 'meter', { min: 2, max: 2 });
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
  return numberFormat(locale, { maximumFractionDigits: 2, useGrouping: false }).format(
    Math.round(cm) / 100,
  );
}

/** Format marks a pasted or formatted number can carry: LRM, RLM, ALM, and the bidi isolates. */
const MARKS = /[\u200e\u200f\u061c\u2066-\u2069]/g;

/** Numbers whose unit words, between them, are every form a locale writes: Arabic inflects the
 * word by number (متر 0.5, 1, 1.5 and 100; متران 2; أمتار 3–10; مترًا 11–99). */
const WORD_FORMS = [0.5, 1, 2, 3, 11, 100, 1.5];

/** Every way a unit is written, short ("m", "متر", "متران", "أمتار", "مترًا"), in `locale` and in
 * English; longest first, so "مترًا" is taken whole rather than as "متر" and a stray mark. */
const wordsOf = new Map<string, string[]>();

function unitWords(locale: string, unit: string): string[] {
  const key = `${locale}|${unit}`;
  const known = wordsOf.get(key);
  if (known) return known;
  const words = new Set<string>();
  for (const tag of [locale, 'en']) {
    const f = numberFormat(tag, { style: 'unit', unit, unitDisplay: 'short' });
    for (const n of WORD_FORMS) {
      const word = f
        .formatToParts(n)
        .filter((p) => p.type === 'unit')
        .map((p) => p.value)
        .join('')
        .trim();
      if (word) words.add(word);
    }
  }
  const sorted = [...words].sort((a, b) => b.length - a.length);
  wordsOf.set(key, sorted);
  return sorted;
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

/** The decimal marks read in every language: ".", "," and the Arabic ٫ (U+066B). The Arabic
 * thousands mark ٬ (U+066C) is not one. */
const DECIMAL_MARKS = new Set(['.', ',', '\u066b']);

/**
 * A number as a person typed it into a length's field, in `locale` (a BCP 47 tag, digits
 * included: ar-u-nu-arab). Read: Western and Eastern Arabic digits, whichever the setting shows
 * (a phone's other keyboard types the other set); one decimal mark, ".", "," or "٫", in any
 * language (a phone's decimal keypad offers only its region's mark: 0,8 is 0.8 m everywhere);
 * the unit the field shows (`unit`, an Intl unit; null for a count), in any form the locale or
 * English writes it, so a value the field formatted reads back. `whole`: digits only, no decimal
 * mark (a count, whole centimetres). Not read, and so `false`: anything else, such as an exponent
 * ("1e3"), a sign ("-2"), a space inside ("3 58"), a second decimal mark or a letter. null when
 * nothing is typed.
 */
export function readLength(
  text: string,
  locale: string,
  unit: string | null = 'meter',
  { whole = false }: { whole?: boolean } = {},
): number | null | false {
  // Spaces only around the number: "3 58" is not 358.
  let s = text.replace(MARKS, '').trim();
  for (const word of unit ? unitWords(locale, unit) : []) {
    if (s.endsWith(word)) {
      s = s.slice(0, -word.length).trim();
      break;
    }
    if (s.startsWith(word)) {
      s = s.slice(word.length).trim();
      break;
    }
  }
  if (!s) return null;
  let plain = '';
  for (const ch of s) {
    const d = westernDigit(ch);
    if (d !== null) plain += d;
    else if (!whole && DECIMAL_MARKS.has(ch)) plain += '.';
    else return false;
  }
  if (!/^(\d+\.?\d*|\.\d+)$/.test(plain)) return false;
  return Number(plain);
}
