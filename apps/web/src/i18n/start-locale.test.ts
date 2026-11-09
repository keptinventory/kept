/**
 * #474: the language a page starts in is shown, never stored. Only a language the person picks is
 * kept, so a browser that changes its language, or one Kept learns later, is followed.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { chosenLocale, LOCALE_KEY, setLocale } from '@/lib/prefs';
import { startLocale } from './i18n';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('the language a page starts in (#474)', () => {
  it('follows the browser, and stores nothing', async () => {
    vi.stubGlobal('navigator', { language: 'de-DE' });
    expect(await startLocale()).toBe('de');
    expect(localStorage.getItem(LOCALE_KEY)).toBeNull();
    expect(chosenLocale()).toBeNull();
    vi.stubGlobal('navigator', { language: 'es-ES' });
    expect(await startLocale()).toBe('es');
  });

  it('keeps a language the person picked', async () => {
    vi.stubGlobal('navigator', { language: 'es-ES' });
    setLocale('fr');
    expect(localStorage.getItem(LOCALE_KEY)).toBe('fr');
    expect(await startLocale()).toBe('fr');
    expect(chosenLocale()).toBe('fr');
  });
});
