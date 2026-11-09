import { type ReportLocale, reportLocaleOf } from './locale.js';
import { type InventoryWords, PDF_WORDS, type ReportLabels } from './words/index.js';

// The inventory report's words, in every report language (#465; D201 wrote it in English or
// Arabic only). The tables live in words/<locale>.ts; the Arabic follows the web catalogue's
// wording (apps/web/src/locales/ar/messages.po) for every term the app already uses: conditions,
// lifecycles, "Unplaced", "Serial number", "Contents".

export type { ReportLabels, ReportLocale };
export { reportLocaleOf };

export function wordsFor(locale: ReportLocale): InventoryWords {
  return PDF_WORDS[locale].inventory;
}

/** The labels the template reads (`d.labels`). */
export function templateLabels(locale: ReportLocale): ReportLabels {
  const w = wordsFor(locale);
  return {
    title: w.title,
    things: w.things,
    places: w.places,
    photos: w.photos,
    totals: w.totals,
    contents: w.contents,
    page: w.page,
    of: w.of,
    serial: w.serial,
    subtotal: w.subtotal,
    bought: w.bought,
    confidential: w.confidential,
    empty: w.empty,
  };
}
