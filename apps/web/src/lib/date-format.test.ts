/**
 * #362: English (UK) and a date format. The region changes English's Intl tag; the format
 * changes `day`, `dateTime` and the year-always `date` (purchase and warranty dates).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeFormatter } from './format';
import {
  DATE_FORMAT_KEY,
  formatLocale,
  REGION_KEY,
  setDateFormat,
  setRegion,
  storedDateFormat,
  storedRegion,
} from './prefs';

const nbsp = (s: string) => s.replace(/ /g, ' ');
// Noon, so the day is the same in every time zone a test runs in.
const LAST_YEAR = `${new Date().getFullYear() - 1}-10-29T12:00:00Z`;
const THIS_YEAR = `${new Date().getFullYear()}-10-29T12:00:00Z`;
const year = new Date().getFullYear();

afterEach(() => {
  vi.unstubAllGlobals();
  setRegion('us');
  setDateFormat('auto');
  localStorage.clear();
});

describe('English (UK)', () => {
  it('gives English its region; the other languages have one way', () => {
    expect(formatLocale('en', 'western', 'gb')).toBe('en-GB');
    expect(formatLocale('en', 'western', 'us')).toBe('en');
    expect(formatLocale('fr', 'western', 'gb')).toBe('fr');
    expect(formatLocale('ar', 'eastern', 'gb')).toBe('ar-u-nu-arab');
  });

  it('writes the day before the month', () => {
    expect(nbsp(makeFormatter('en-GB').day(THIS_YEAR))).toBe('29 Oct');
    expect(nbsp(makeFormatter('en').day(THIS_YEAR))).toBe('Oct 29');
  });

  it('is remembered on the device, and starts from a British browser', () => {
    vi.stubGlobal('navigator', { language: 'en-GB' });
    expect(storedRegion()).toBe('gb');
    vi.stubGlobal('navigator', { language: 'en-US' });
    expect(storedRegion()).toBe('us');
    setRegion('gb');
    expect(localStorage.getItem(REGION_KEY)).toBe('gb');
    expect(storedRegion()).toBe('gb');
  });
});

describe('date format', () => {
  it('auto: the short form, with the year only for another year', () => {
    const f = makeFormatter('en-GB');
    expect(nbsp(f.day(THIS_YEAR))).toBe('29 Oct');
    expect(nbsp(f.day(LAST_YEAR))).toBe(`29 Oct ${year - 1}`);
  });

  it('medium, numeric and ISO', () => {
    expect(nbsp(makeFormatter('en-GB', 'medium').day(THIS_YEAR))).toBe(`29 Oct ${year}`);
    expect(makeFormatter('en-GB', 'numeric').day(THIS_YEAR)).toBe(`29/10/${year}`);
    expect(makeFormatter('en', 'numeric').day(THIS_YEAR)).toBe(`10/29/${year}`);
    expect(makeFormatter('de', 'numeric').day(THIS_YEAR)).toBe(`29.10.${year}`);
    expect(makeFormatter('en-GB', 'iso').day(THIS_YEAR)).toBe(`${year}-10-29`);
    expect(makeFormatter('fr', 'iso').day(LAST_YEAR)).toBe(`${year - 1}-10-29`);
  });

  it('ISO in Arabic keeps the reader’s digits, held left to right', () => {
    expect(makeFormatter('ar-u-nu-latn', 'iso').day('2026-10-29T12:00:00Z')).toBe('⁦2026-10-29⁩');
    expect(makeFormatter('ar-u-nu-arab', 'iso').day('2026-10-29T12:00:00Z')).toBe('⁦٢٠٢٦-١٠-٢٩⁩');
  });

  it('purchase and warranty dates always carry the year', () => {
    expect(nbsp(makeFormatter('en-GB').date(THIS_YEAR))).toBe(`29 Oct ${year}`);
    expect(nbsp(makeFormatter('en').date(THIS_YEAR))).toBe(`Oct 29, ${year}`);
    expect(makeFormatter('en-GB', 'numeric').date(THIS_YEAR)).toBe(`29/10/${year}`);
    expect(makeFormatter('en-GB', 'iso').date(THIS_YEAR)).toBe(`${year}-10-29`);
  });

  it('a date and time follows it too', () => {
    const at = '2026-06-15T06:12:00Z'; // 09:12 in Cairo (tests pin TZ=Africa/Cairo)
    expect(makeFormatter('en-GB', 'iso').dateTime(at)).toBe('2026-06-15 09:12');
    expect(makeFormatter('en-GB', 'numeric').dateTime(at)).toBe('15/06/2026, 09:12');
    expect(makeFormatter('en-GB', 'medium').dateTime(at)).toBe('15 Jun 2026, 09:12');
  });

  it('is remembered on the device; auto forgets the choice', () => {
    setDateFormat('iso');
    expect(localStorage.getItem(DATE_FORMAT_KEY)).toBe('iso');
    expect(storedDateFormat()).toBe('iso');
    setDateFormat('auto');
    expect(localStorage.getItem(DATE_FORMAT_KEY)).toBeNull();
    localStorage.setItem(DATE_FORMAT_KEY, 'bogus');
    expect(storedDateFormat()).toBe('auto');
  });
});

// The suite runs in Cairo (vitest.config.ts), east of UTC, where reading a bare date as midnight
// UTC still lands on the right day. West of UTC it lands on the day before (#417).
describe('a date with no time', () => {
  const zone = process.env.TZ;
  afterEach(() => {
    process.env.TZ = zone;
  });

  it.each(['America/Toronto', 'Pacific/Honolulu', 'Africa/Cairo', 'Pacific/Auckland'])(
    'is that day in %s, in every format and across a new year',
    (tz) => {
      process.env.TZ = tz;
      const f = makeFormatter('en-GB');
      expect(nbsp(f.date('2023-11-25'))).toBe('25 Nov 2023');
      expect(nbsp(f.day('2023-11-25'))).toBe('25 Nov 2023');
      expect(nbsp(f.date('2024-01-01'))).toBe('1 Jan 2024');
      expect(f.longDay('2023-11-25')).toContain('25 Nov 2023');
      expect(makeFormatter('en-GB', 'iso').date('2023-11-25')).toBe('2023-11-25');
      expect(makeFormatter('en-GB', 'numeric').date('2023-11-25')).toBe('25/11/2023');
      expect(nbsp(makeFormatter('en-GB', 'medium').day('2023-11-25'))).toBe('25 Nov 2023');
    },
  );

  it('counts whole days from the same day, wherever it is read', () => {
    process.env.TZ = 'America/Toronto';
    const f = makeFormatter('en-GB');
    expect(f.relative('2023-11-25', new Date(2023, 10, 23, 12))).toBe('in 2 days');
  });

  it('leaves a real moment in time alone', () => {
    process.env.TZ = 'America/Toronto';
    const f = makeFormatter('en-GB');
    expect(nbsp(f.date('2023-11-25T00:00:00Z'))).toBe('24 Nov 2023');
  });
});
