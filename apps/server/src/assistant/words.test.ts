import { describe, expect, it } from 'vitest';
import { noAnswer, viewerRefusal, wordsLocale } from './words.js';

// The assistant's fixed sentences: every interface language has its own.

const ALL = ['en', 'ar', 'fr', 'de', 'it', 'vi', 'uk', 'es'] as const;

describe('wordsLocale()', () => {
  it.each([
    ['es-MX', 'es'],
    ['uk-UA', 'uk'],
    ['vi', 'vi'],
    ['fr-CA', 'fr'],
    ['ar', 'ar'],
    ['pt-BR', 'en'],
    ['', 'en'],
  ])('%s → %s', (tag, want) => {
    expect(wordsLocale(tag)).toBe(want);
  });
});

describe('the fixed sentences', () => {
  it('differ in every language, and name the location inside the refusal', () => {
    for (const make of [
      (l: string) => noAnswer(l),
      (l: string) => viewerRefusal(l, null),
      (l: string) => viewerRefusal(l, 'Home'),
    ])
      expect(new Set(ALL.map(make)).size).toBe(ALL.length);
    for (const l of ALL) expect(viewerRefusal(l, 'Home')).toContain('Home');
  });
});
