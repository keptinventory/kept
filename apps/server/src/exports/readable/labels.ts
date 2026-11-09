import { type ReportLocale, reportLocaleOf } from '../../reports/locale.js';
import { PDF_WORDS, type ReadableOwnWords } from '../../reports/words/index.js';

// The readable copy's words (D159), in every report language (#465), like the inventory report
// it carries. The tables live in reports/words/<locale>.ts; the Arabic follows the report's,
// which follows the web catalogue.

export type ReadableLocale = ReportLocale;

export const readableLocaleOf = (locale: string | null | undefined): ReadableLocale =>
  reportLocaleOf(locale);

export type ReadableWords = ReadableOwnWords & {
  thingCount: (n: number, formatted: string) => string;
  unplaced: string;
  trashed: string;
  serial: string;
  bought: string;
};

export function readableWords(locale: ReadableLocale): ReadableWords {
  const words = PDF_WORDS[locale];
  return {
    ...words.readable,
    thingCount: words.inventory.thingCount,
    unplaced: words.inventory.unplaced,
    trashed: words.inventory.trashed,
    serial: words.inventory.serial,
    bought: words.inventory.bought,
  };
}
