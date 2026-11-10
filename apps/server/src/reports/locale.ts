import type { Digits } from '@kept/shared';

// The languages Kept's PDFs are written in (#465): every language Kept speaks, the mail's too
// (mail/messages.ts). What each says lives in words/<locale>.ts; this file holds how each one
// writes what isn't a word: its Intl locale, digits, direction and punctuation.

export const REPORT_LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'uk', 'vi'] as const;
export type ReportLocale = (typeof REPORT_LOCALES)[number];

/** The report language for a BCP 47 tag (`ar-EG` → `ar`, `fr-CA` → `fr`); English for anything
 * else. */
export function reportLocaleOf(tag: string | null | undefined): ReportLocale {
  const language = (tag ?? '').trim().toLowerCase().split(/[-_]/)[0] ?? '';
  return (REPORT_LOCALES as readonly string[]).includes(language)
    ? (language as ReportLocale)
    : 'en';
}

/** The Intl locale dates and numbers are written in: Egyptian Arabic and British English as
 * before, every other language as itself. */
export const intlLocaleOf = (locale: ReportLocale): string =>
  locale === 'ar' ? 'ar-EG' : locale === 'en' ? 'en-GB' : locale;

/** Eastern digits only in Arabic, when the reader asked for them (D143). */
export const numberingOf = (locale: ReportLocale, digits: Digits): 'latn' | 'arab' =>
  locale === 'ar' && digits === 'eastern' ? 'arab' : 'latn';

export const dirOf = (locale: ReportLocale): 'ltr' | 'rtl' => (locale === 'ar' ? 'rtl' : 'ltr');

/** Between a line's parts: a comma, the Arabic comma in Arabic; never the middle dot (#459). */
export const sepOf = (locale: ReportLocale): string => (locale === 'ar' ? '، ' : ', ');

/** Between a path's steps, pointing from the outer place to the inner one. */
export const pathSeparatorOf = (locale: ReportLocale): '›' | '‹' => (locale === 'ar' ? '‹' : '›');

/** After a label ("Serial number: …"): French puts a no-break space before the colon. */
export const colonOf = (locale: ReportLocale): string => (locale === 'fr' ? ' : ' : ': ');

/** The plural form `n` takes in `locale` (Arabic's six, Ukrainian's four, one in Vietnamese). */
export const pluralOf = (locale: ReportLocale, n: number): Intl.LDMLPluralRule =>
  new Intl.PluralRules(locale).select(n);
