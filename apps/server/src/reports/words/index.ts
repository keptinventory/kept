import type { ReportLocale } from '../locale.js';
import { AR } from './ar.js';
import { DE } from './de.js';
import { EN } from './en.js';
import { ES } from './es.js';
import { FR } from './fr.js';
import { IT } from './it.js';
import type { PdfWords } from './types.js';
import { UK } from './uk.js';
import { VI } from './vi.js';

export type * from './types.js';

/** Every PDF's words, by report language (#465): a language missing, or missing a key, is a type
 * error, so a PDF can't ship untranslated. */
export const PDF_WORDS: Readonly<Record<ReportLocale, PdfWords>> = {
  ar: AR,
  de: DE,
  en: EN,
  es: ES,
  fr: FR,
  it: IT,
  uk: UK,
  vi: VI,
};
