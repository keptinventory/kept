/**
 * Type to find a language (#450): one matcher for the app's pickers and the docs site's menu.
 *
 * A language is found by its own name, its name in English, or its name in the interface's
 * language (`Intl.DisplayNames`, so a new language needs no entry here). Where Intl can't say,
 * its own name and its tag still find it.
 *
 * On text folded the way search folds it (`normalize`: case, accents, Arabic letter forms), tried
 * in this order, and the first step that finds anything is the answer:
 *  1. One or two letters: the start of a word, not counting the Arabic article, so that `ال`, which
 *     starts nearly every Arabic language name, doesn't match them all. Three or more: anywhere in
 *     a name.
 *  2. A typo: one edit (a swap of neighbours counts as one) from five letters, two from eight,
 *     against a whole word or the same length of its start, so a typo is forgiven while still
 *     typing too. Nothing is forgiven under five letters.
 *
 * Results keep the list's order.
 */
import { normalize, stripPrefixes } from './normalize.js';

export type SearchableLanguage = {
  /** Its BCP 47 tag. */
  id: string;
  /** Its name in itself. */
  name: string;
};

type Entry<T> = {
  language: T;
  /** Every name, folded, with and without the Arabic article. */
  names: readonly string[];
  /** Every name, folded, without the Arabic article. */
  stems: readonly string[];
};

export type LanguageSearch<T> = readonly Entry<T>[];

const FORMAT_CHARACTERS = /\p{Cf}/gu; // Bidi marks and the like, invisible in a pasted name.
const WORD_BREAK = /[\s\p{P}]+/u;
const MIN_LETTERS_INSIDE = 3;
const MIN_LETTERS_ONE_TYPO = 5;
const MIN_LETTERS_TWO_TYPOS = 8;

function fold(text: string): string {
  return normalize(text.replace(FORMAT_CHARACTERS, ''));
}

/** `tag`'s name in `displayLanguage`, or null where Intl can't say. */
function displayName(tag: string, displayLanguage: string): string | null {
  try {
    const names = new Intl.DisplayNames([displayLanguage], { type: 'language', fallback: 'none' });
    return names.of(tag) ?? null;
  } catch {
    return null; // No Intl.DisplayNames, or a tag it refuses.
  }
}

/** Everything `findLanguages` needs, worked out once per interface language. */
export function languageSearch<T extends SearchableLanguage>(
  languages: readonly T[],
  interfaceLanguage: string,
): LanguageSearch<T> {
  return languages.map((language) => {
    const translated = [
      displayName(language.id, 'en'),
      displayName(language.id, interfaceLanguage),
    ].filter((name) => name !== null);
    const given = translated.length > 0 ? translated : [language.id];
    const folded = [language.name, ...given].map(fold);
    const stems = folded.map(stripPrefixes);
    return { language, stems, names: [...new Set([...folded, ...stems])] };
  });
}

/** Optimal string alignment: insert, delete, replace, or swap two neighbours, each one edit. */
function editDistance(a: readonly string[], b: readonly string[]): number {
  let beforeLast: number[] = [];
  let last = [...Array(b.length + 1).keys()];
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min((last[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (last[j - 1] ?? 0) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        best = Math.min(best, (beforeLast[j - 2] ?? 0) + 1);
      row.push(best);
    }
    beforeLast = last;
    last = row;
  }
  return last[b.length] ?? 0;
}

/** The languages `query` finds, in the list's order; all of them for an empty query. */
export function findLanguages<T>(search: LanguageSearch<T>, query: string): T[] {
  const q = fold(query);
  if (q === '') return search.map((entry) => entry.language);
  const letters = [...q];

  const found = search.filter((entry) =>
    letters.length < MIN_LETTERS_INSIDE
      ? entry.stems.some((stem) => stem.split(WORD_BREAK).some((word) => word.startsWith(q)))
      : entry.names.some((name) => name.includes(q)),
  );
  if (found.length > 0 || letters.length < MIN_LETTERS_ONE_TYPO) {
    return found.map((entry) => entry.language);
  }

  const allowed = letters.length >= MIN_LETTERS_TWO_TYPOS ? 2 : 1;
  const close = (text: string) => {
    const chars = [...text];
    return (
      editDistance(letters, chars) <= allowed ||
      editDistance(letters, chars.slice(0, letters.length)) <= allowed
    );
  };
  return search
    .filter((entry) =>
      entry.names.some((name) => close(name) || name.split(WORD_BREAK).some(close)),
    )
    .map((entry) => entry.language);
}
