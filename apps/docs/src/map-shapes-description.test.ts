import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The map shapes page's description says the words find a shape in each of Kept's languages, in
// every translation: naming them dates as soon as one is added.

const description = (lang: string) => {
  const url = new URL(`./content/docs/${lang}/users/map-shapes.mdx`, import.meta.url);
  const line = readFileSync(url, 'utf8').split('\n')[2] ?? '';
  return line.replace(/^description: /, '');
};

// The word for Italian in each language: the last of the five the description used to name.
const ITALIAN: Record<string, RegExp> = {
  ar: /الإيطالية/,
  de: /italienisch/i,
  es: /italiano/i,
  fr: /italien/i,
  it: /italiano/i,
  uk: /італійськ/i,
  vi: /tiếng Anh|\bÝ\b/,
};

describe('the map shapes description', () => {
  it.each(Object.keys(ITALIAN))('%s names no list of languages', (lang) => {
    const text = description(lang);
    expect(text).toContain('Kept');
    expect(text).not.toMatch(ITALIAN[lang] as RegExp);
  });
});
