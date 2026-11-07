/**
 * The site's languages for its own components (the words Starlight's JSON files in content/i18n
 * don't cover): which languages there are, which one a page is in, and a table of words that
 * falls back to English for a language it has no entry for. The list is src/locales.mjs.
 */
import { locales } from './locales.mjs';

export type Lang = 'ar' | 'de' | 'en' | 'es' | 'fr' | 'it' | 'uk' | 'vi';
/** The languages whose words are written out in the component tables. */
export type OtherLang = Exclude<Lang, 'en' | 'ar'>;

/** Every language, in the language menu's order. */
export const LANGS = Object.values(locales).map((locale) => locale.lang) as Lang[];

/** A page's language: its `lang`, or English for one this file does not know. */
export function langOf(code: string | undefined): Lang {
  return LANGS.includes(code as Lang) ? (code as Lang) : 'en';
}

/** Words per language; English is required, another language without an entry shows English. */
export type Words<T> = { en: T } & Partial<Record<Lang, T>>;

export function pick<T>(words: Words<T>, lang: Lang): T {
  return words[lang] ?? words.en;
}

/** A site path under a page's locale: `/ar/install/` for Arabic, the path itself for English. */
export function localePath(locale: string | undefined, href: string): string {
  return locale && locale !== 'root' ? `/${locale}${href}` : href;
}

/** The tag numbers are written with: Arabic uses the app's Eastern digits. */
export function numberTag(lang: Lang): string {
  return lang === 'ar' ? 'ar-EG-u-nu-arab' : lang;
}
