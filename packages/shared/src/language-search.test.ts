import { afterEach, describe, expect, it, vi } from 'vitest';
import { findLanguages, languageSearch } from './language-search.js';

const LANGUAGES = [
  { id: 'ar', name: 'العربية' },
  { id: 'de', name: 'Deutsch' },
  { id: 'en', name: 'English' },
  { id: 'fr', name: 'Français' },
  { id: 'it', name: 'Italiano' },
  { id: 'vi', name: 'Tiếng Việt' },
];
/** One more language: its names come from Intl, so nothing here needs an entry for it. */
const WITH_UKRAINIAN = [...LANGUAGES, { id: 'uk', name: 'Українська' }];

function find(query: string, interfaceTag = 'en', languages = LANGUAGES): string[] {
  return findLanguages(languageSearch(languages, interfaceTag), query).map((l) => l.id);
}

afterEach(() => vi.unstubAllGlobals());

describe('findLanguages', () => {
  it('shows every language, in the list order, for an empty box', () => {
    expect(find('')).toEqual(['ar', 'de', 'en', 'fr', 'it', 'vi']);
    expect(find('   ')).toEqual(['ar', 'de', 'en', 'fr', 'it', 'vi']);
  });

  it('finds a language by its own name', () => {
    expect(find('Deutsch')).toEqual(['de']);
    expect(find('العربية')).toEqual(['ar']);
    expect(find('Tiếng Việt')).toEqual(['vi']);
  });

  it('finds a language by its name in English, whatever the interface says', () => {
    expect(find('german')).toEqual(['de']);
    expect(find('german', 'ar')).toEqual(['de']);
    expect(find('arabic', 'fr')).toEqual(['ar']);
    expect(find('vietnamese', 'de')).toEqual(['vi']);
  });

  it("finds a language by its name in the interface's own language", () => {
    expect(find('Französisch', 'de')).toEqual(['fr']);
    expect(find('allemand', 'fr')).toEqual(['de']);
    expect(find('tedesco', 'it')).toEqual(['de']);
    expect(find('الألمانية', 'ar')).toEqual(['de']);
    // The interface's words only count in that interface.
    expect(find('allemand', 'de')).toEqual([]);
  });

  it('finds by the start of a name, for a language the list did not have before', () => {
    expect(find('ukr', 'en', WITH_UKRAINIAN)).toEqual(['uk']);
    expect(find('укр', 'en', WITH_UKRAINIAN)).toEqual(['uk']);
    expect(find('ger')).toEqual(['de']);
    expect(find('viet')).toEqual(['vi']);
  });

  it('finds inside a name from three letters', () => {
    expect(find('man')).toEqual(['de']);
    expect(find('việt')).toEqual(['vi']);
  });

  it('folds case and accents, in both directions', () => {
    expect(find('francais')).toEqual(['fr']);
    expect(find('FRANÇAIS')).toEqual(['fr']);
    expect(find('tieng viet')).toEqual(['vi']);
    expect(find('fránçáis')).toEqual(['fr']);
    expect(find('الالمانية', 'ar')).toEqual(['de']);
    expect(find('الْعَرَبِيَّة')).toEqual(['ar']);
  });

  it('ignores the Arabic article, as search does', () => {
    expect(find('عربية')).toEqual(['ar']);
    expect(find('ألمانية', 'ar')).toEqual(['de']);
  });

  it('forgives a small typo in a longer query', () => {
    expect(find('vietnames')).toEqual(['vi']);
    expect(find('vietnamse')).toEqual(['vi']);
    expect(find('germn')).toEqual(['de']);
    expect(find('deutch')).toEqual(['de']);
    expect(find('englsih')).toEqual(['en']);
    expect(find('italain')).toEqual(['it']);
    expect(find('vietnamesse')).toEqual(['vi']);
    // Still typing, with the typo already in.
    expect(find('vietnm')).toEqual(['vi']);
  });

  it('forgives two typos only from eight letters', () => {
    expect(find('vietnemise')).toEqual(['vi']);
    expect(find('gerrmn')).toEqual([]);
  });

  it('forgives nothing in a short query', () => {
    expect(find('grm')).toEqual([]);
    expect(find('germ')).toEqual(['de']);
    expect(find('gemr')).toEqual([]);
  });

  it("doesn't turn other languages into these by accident", () => {
    for (const other of ['spanish', 'dutch', 'russian', 'korean', 'japanese', 'chinese', 'polish'])
      expect(find(other), other).toEqual([]);
  });

  it('never lets a short query match everything', () => {
    for (const tag of ['ar', 'de', 'en', 'fr', 'it', 'vi']) {
      for (const query of ['a', 'e', 'i', 'n', 's', 'ا', 'ال', 'an', 'is']) {
        expect(find(query, tag).length, `${query} in ${tag}`).toBeLessThan(LANGUAGES.length);
      }
    }
    expect(find('a')).toEqual(['ar']);
    // One letter or two: the start of a word, not anywhere inside it.
    expect(find('n')).toEqual([]);
    expect(find('ge')).toEqual(['de']);
    expect(find('وي')).toEqual([]);
  });

  it('never lets the Arabic article alone match every Arabic name', () => {
    expect(find('ال', 'ar')).toEqual(['de']);
    expect(find('الف', 'ar')).toEqual(['fr', 'vi']);
    expect(find('ف', 'ar')).toEqual(['fr', 'vi']);
  });

  it('keeps the list order, and returns nothing for no match', () => {
    expect(find('i')).toEqual(['it']);
    expect(find('zzz')).toEqual([]);
    expect(find('xylophone')).toEqual([]);
  });

  it('survives an interface language it cannot use', () => {
    expect(find('german', 'not a language!')).toEqual(['de']);
    expect(find('Deutsch', 'not a language!')).toEqual(['de']);
  });

  it('survives a language tag it cannot use', () => {
    const odd = [{ id: 'not a language!', name: 'Klingon' }];
    expect(find('klingon', 'en', odd)).toEqual(['not a language!']);
  });

  it('falls back to own names and tags where Intl.DisplayNames is missing or throws', () => {
    vi.stubGlobal('Intl', { ...Intl, DisplayNames: undefined });
    expect(find('Deutsch')).toEqual(['de']);
    expect(find('francais')).toEqual(['fr']);
    expect(find('german')).toEqual([]);
    expect(find('vi')).toEqual(['vi']);
    vi.stubGlobal('Intl', {
      ...Intl,
      DisplayNames: class {
        constructor() {
          throw new RangeError('no data');
        }
      },
    });
    expect(find('Deutsch')).toEqual(['de']);
    expect(find('it')).toEqual(['it']);
  });

  it('falls back the same way where Intl has no data for a language', () => {
    vi.stubGlobal('Intl', {
      ...Intl,
      DisplayNames: class {
        of() {
          return undefined;
        }
      },
    });
    expect(find('Italiano')).toEqual(['it']);
    expect(find('de')).toEqual(['de']);
  });
});
