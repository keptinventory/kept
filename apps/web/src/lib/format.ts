/**
 * Numbers and dates in the person's language and digits (D143). Short IDs, codes,
 * usernames and URLs are never passed through here: they stay as printed, Western and LTR.
 */
import { i18n, type Messages } from '@lingui/core';
import { useMemo } from 'react';
import { type DateFormatPref, formatLocale, usePrefs } from './prefs';

/**
 * The separator between the parts of a line ("Warranties · 2", "Samsung TV · Home"). In Arabic it
 * is the Arabic comma, as the designs' own Arabic uses it ("مثقاب بوش، ١٨ فولت"): the kit's
 * "·" beside an Eastern digit reads as the zero "٠" ("· ٢" as ٢٠; UI step-4 review L1). The comma
 * binds to the part before it, so a line never starts with it. `keep`: the part before keeps the
 * separator in the other languages too (a no-break space before the dot).
 */
export function separatorFor(locale: string, { keep = false }: { keep?: boolean } = {}): string {
  if (locale.startsWith('ar')) return '، ';
  return keep ? '\u00a0· ' : ' · ';
}

/** The separator in the language being read (Lingui's active locale): for a line built in JSX or
 * a string. A translated message gets it from its catalogue (`localiseSeparators`). */
export const sep = (options?: { keep?: boolean }): string =>
  separatorFor(i18n.locale ?? 'en', options);

/**
 * The catalogue's messages with the language's separator (`separatorFor`) in place of " · ", so
 * every translated line follows it without a translator writing it (Lingui's compiled messages:
 * strings, or tokens whose plural and select choices are messages too).
 */
export function localiseSeparators(messages: Messages, locale: string): Messages {
  const to = separatorFor(locale);
  if (to === ' · ') return messages;
  const text = (s: string) => s.replace(/[ \u00a0]*·[ \u00a0]*/g, to);
  const walk = (m: unknown): unknown => {
    if (typeof m === 'string') return text(m);
    if (Array.isArray(m)) return m.map(walk);
    if (m && typeof m === 'object')
      return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, walk(v)]));
    return m;
  };
  return Object.fromEntries(Object.entries(messages).map(([id, m]) => [id, walk(m)])) as Messages;
}

export type Formatter = {
  /** The separator between a line's parts (`separatorFor`). */
  sep: string;
  num: (n: number) => string;
  /**
   * "12 Oct" (this year) or "12 Oct 2027", with no-break spaces: a date never splits. In the
   * person's date format (#362) when they chose one: "12 Oct 2026", 12/10/2026 or 2026-10-12.
   */
  day: (iso: string) => string;
  /** `day` with the year always: purchase and warranty dates (#362). */
  date: (iso: string) => string;
  /** "Sat 31 Oct 2026". */
  longDay: (iso: string) => string;
  /** "12 Oct, 09:12"; with the year, or as 12/10/2026, 09:12 or 2026-10-12 09:12 when chosen. */
  dateTime: (iso: string) => string;
  /** "Friday 26 September". */
  today: (d?: Date) => string;
  /** "3 days ago", "in 5 days", "today". */
  relative: (iso: string, now?: Date) => string;
};

const DAY = 86_400_000;

/** Dates never split across lines: their spaces become no-break spaces. */
const unbroken = (s: string) => s.replace(/ /g, '\u00a0');

/**
 * 2026-10-29 in the language's digits. In Arabic it is held left to right (LRI … PDI), so a
 * right-to-left line can't turn it round.
 */
function isoDate(tag: string): (d: Date) => string {
  const f = new Intl.DateTimeFormat(tag, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return (d) => {
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      f.formatToParts(d).find((p) => p.type === type)?.value ?? '';
    const out = `${part('year')}-${part('month')}-${part('day')}`;
    return tag.startsWith('ar') ? `\u2066${out}\u2069` : out;
  };
}

export function makeFormatter(tag: string, dateFormat: DateFormatPref = 'auto'): Formatter {
  const nf = new Intl.NumberFormat(tag);
  const sameYear = new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short' });
  const otherYear = new Intl.DateTimeFormat(tag, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const long = new Intl.DateTimeFormat(tag, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const dt = new Intl.DateTimeFormat(tag, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const numeric = new Intl.DateTimeFormat(tag, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const iso = isoDate(tag);
  const time = new Intl.DateTimeFormat(tag, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const dtYear = new Intl.DateTimeFormat(tag, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const dtNumeric = new Intl.DateTimeFormat(tag, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const weekday = new Intl.DateTimeFormat(tag, { weekday: 'long', day: 'numeric', month: 'long' });
  const rtf = new Intl.RelativeTimeFormat(tag, { numeric: 'auto' });
  /** A date in the chosen format; `year` keeps the year in the language's own short form. */
  const formatDay = (d: Date, year: boolean): string => {
    if (dateFormat === 'iso') return iso(d);
    if (dateFormat === 'numeric') return numeric.format(d);
    const withYear =
      year || dateFormat === 'medium' || d.getFullYear() !== new Date().getFullYear();
    // "Deleted Sep / 27" wrapped at 375 (the phone pass): the line breaks around a date.
    return unbroken((withYear ? otherYear : sameYear).format(d));
  };
  return {
    sep: separatorFor(tag),
    num: (n) => nf.format(n),
    day: (value) => formatDay(new Date(value), false),
    date: (value) => formatDay(new Date(value), true),
    longDay: (value) => long.format(new Date(value)),
    dateTime: (value) => {
      const d = new Date(value);
      if (dateFormat === 'iso') return `${iso(d)} ${time.format(d)}`;
      if (dateFormat === 'numeric') return dtNumeric.format(d);
      if (dateFormat === 'medium') return dtYear.format(d);
      return dt.format(d);
    },
    today: (d = new Date()) => weekday.format(d),
    relative: (iso, now = new Date()) => {
      const diff = new Date(iso).getTime() - now.getTime();
      const abs = Math.abs(diff);
      if (abs < 60_000) return rtf.format(0, 'second');
      if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), 'minute');
      if (abs < DAY) return rtf.format(Math.round(diff / 3_600_000), 'hour');
      return rtf.format(Math.round(diff / DAY), 'day');
    },
  };
}

/** "412 KB" (or "316 B") in the reader's language and digits. */
export function useBytes(): (n: number) => string {
  const { locale, digits } = usePrefs();
  return (n) =>
    n < 1024
      ? new Intl.NumberFormat(formatLocale(locale, digits), {
          style: 'unit',
          unit: 'byte',
          unitDisplay: 'short',
        }).format(n)
      : new Intl.NumberFormat(formatLocale(locale, digits), {
          style: 'unit',
          unit: 'kilobyte',
          unitDisplay: 'short',
          maximumFractionDigits: 0,
        }).format(n / 1024);
}

export function useFormat(): Formatter {
  const { locale, digits, region, dateFormat } = usePrefs();
  return useMemo(
    () => makeFormatter(formatLocale(locale, digits, region), dateFormat),
    [locale, digits, region, dateFormat],
  );
}
