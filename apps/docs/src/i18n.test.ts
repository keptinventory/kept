import { describe, expect, it } from 'vitest';
import { LANGS, langOf, localePath, numberTag, pick } from './i18n';
import { locales } from './locales.mjs';

describe('the site languages', () => {
  it('are the ones in locales.mjs, English first', () => {
    expect(LANGS).toEqual(Object.values(locales).map((l) => l.lang));
    expect(LANGS[0]).toBe('en');
    expect(LANGS).toHaveLength(8);
  });

  it('read a page language, and treat an unknown one as English', () => {
    expect(langOf('uk')).toBe('uk');
    expect(langOf('es')).toBe('es');
    expect(langOf('xx')).toBe('en');
    expect(langOf(undefined)).toBe('en');
  });

  it('fall back to English for a language with no words', () => {
    const words = { en: 'Docs', fr: 'Docs fr' };
    expect(pick(words, 'fr')).toBe('Docs fr');
    expect(pick(words, 'vi')).toBe('Docs');
  });

  it('put a page under its own locale, English at the root', () => {
    expect(localePath(undefined, '/integrations/')).toBe('/integrations/');
    expect(localePath('root', '/integrations/')).toBe('/integrations/');
    expect(localePath('ar', '/integrations/')).toBe('/ar/integrations/');
    expect(localePath('fr', '/install/compose/')).toBe('/fr/install/compose/');
  });

  it('write numbers in the language, Arabic with the app’s Eastern digits', () => {
    expect(numberTag('ar')).toBe('ar-EG-u-nu-arab');
    expect(numberTag('en')).toBe('en');
    expect(new Intl.NumberFormat(numberTag('de')).format(1234.5)).toBe('1.234,5');
  });
});
