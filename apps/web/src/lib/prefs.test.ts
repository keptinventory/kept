/**
 * Device preferences: the languages, their Intl tags, content width, and
 * the pre-paint script in index.html, which must make the same choices before React loads.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import indexHtml from '../../index.html?raw';
import {
  clampPlaceTreeWidth,
  formatLocale,
  initialLocale,
  isLocale,
  LOCALES,
  localeOfTag,
  PLACE_TREE_DEFAULT,
  PLACE_TREE_KEY,
  PLACE_TREE_MAX,
  PLACE_TREE_MIN,
  PLACE_TREE_WIDTH_KEY,
  parsePlaceTreeWidth,
  setPlaceTreeCollapsed,
  setPlaceTreeWidth,
  setThemePref,
  setWidthPref,
  storedPlaceTreeCollapsed,
  storedPlaceTreeWidth,
  storedWidthPref,
  THEME_KEY,
  WIDTH_KEY,
  watchSystemTheme,
} from './prefs';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  setWidthPref('centered');
  setThemePref('system');
  setPlaceTreeWidth(PLACE_TREE_DEFAULT);
  setPlaceTreeCollapsed(false);
});

describe('languages', () => {
  it('has the languages, and knows a tag by its language', () => {
    expect(LOCALES).toEqual(['ar', 'de', 'en', 'es', 'fr', 'it', 'uk', 'vi']);
    expect(isLocale('it')).toBe(true);
    expect(isLocale('vi')).toBe(true);
    expect(isLocale('uk')).toBe(true);
    expect(isLocale('es')).toBe(true);
    expect(isLocale('pt')).toBe(false);
    expect(localeOfTag('ar-EG')).toBe('ar');
    expect(localeOfTag('fr_CA')).toBe('fr');
    expect(localeOfTag('DE-at')).toBe('de');
    expect(localeOfTag('es-ES')).toBe('es');
    expect(localeOfTag('pt-BR')).toBeNull();
  });

  it('formats in the language itself; only Arabic carries a numbering system', () => {
    expect(formatLocale('fr', 'eastern')).toBe('fr');
    expect(formatLocale('de', 'western')).toBe('de');
    expect(formatLocale('it', 'eastern')).toBe('it');
    expect(formatLocale('en', 'eastern')).toBe('en');
    expect(formatLocale('ar', 'eastern')).toBe('ar-u-nu-arab');
    expect(formatLocale('ar', 'western')).toBe('ar-u-nu-latn');
    // Plurals and dates follow the locale through Intl.
    expect(new Intl.NumberFormat(formatLocale('de', 'western')).format(1234.5)).toBe('1.234,5');
  });

  it('writes Spanish numbers and dates in the browser’s region; the catalogue stays es (#474)', () => {
    vi.stubGlobal('navigator', { language: 'es-MX' });
    expect(formatLocale('es', 'western')).toBe('es-MX');
    expect(new Intl.NumberFormat(formatLocale('es', 'western')).format(1234567.5)).toBe(
      '1,234,567.5',
    );
    vi.stubGlobal('navigator', { language: 'es-419' });
    expect(formatLocale('es', 'eastern')).toBe('es-419');
    vi.stubGlobal('navigator', { language: 'es-AR-u-nu-arab' });
    expect(formatLocale('es', 'western')).toBe('es-AR');
    vi.stubGlobal('navigator', { language: 'es-ES' });
    expect(new Intl.NumberFormat(formatLocale('es', 'western')).format(1234567.5)).toBe(
      '1.234.567,5',
    );
    vi.stubGlobal('navigator', { language: 'es' });
    expect(formatLocale('es', 'western')).toBe('es');
    // A browser in another language: Spain's Spanish, as before.
    vi.stubGlobal('navigator', { language: 'en-US' });
    expect(formatLocale('es', 'western')).toBe('es');
    // Only Spanish follows the browser's region; English has its own choice.
    vi.stubGlobal('navigator', { language: 'fr-CA' });
    expect(formatLocale('fr', 'western')).toBe('fr');
  });

  it('starts in the stored language, else the browser’s when it is one of them', () => {
    vi.stubGlobal('navigator', { language: 'it-IT' });
    expect(initialLocale()).toBe('it');
    vi.stubGlobal('navigator', { language: 'pt-BR' });
    expect(initialLocale()).toBe('en');
    localStorage.setItem('kept.locale', 'de');
    expect(initialLocale()).toBe('de');
    localStorage.setItem('kept.locale', 'xx');
    vi.stubGlobal('navigator', { language: 'fr' });
    expect(initialLocale()).toBe('fr');
  });
});

describe('content width', () => {
  it('stores Full width, forgets Centered, and marks the document', () => {
    expect(storedWidthPref()).toBe('centered');
    setWidthPref('full');
    expect(localStorage.getItem(WIDTH_KEY)).toBe('full');
    expect(document.documentElement.dataset.width).toBe('full');
    expect(storedWidthPref()).toBe('full');
    setWidthPref('centered');
    expect(localStorage.getItem(WIDTH_KEY)).toBeNull();
    expect(document.documentElement.dataset.width).toBe('centered');
  });
});

describe('theme', () => {
  it('follows the device live while the choice is System', () => {
    let dark = false;
    const listeners = new Set<() => void>();
    vi.stubGlobal('matchMedia', (q: string) => ({
      get matches() {
        return q === '(prefers-color-scheme: dark)' && dark;
      },
      media: q,
      addEventListener: (_: string, l: () => void) => listeners.add(l),
      removeEventListener: (_: string, l: () => void) => listeners.delete(l),
    }));
    setThemePref('system');
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
    const stop = watchSystemTheme();
    expect(document.documentElement.dataset.theme).toBe('light');
    dark = true;
    for (const l of listeners) l();
    expect(document.documentElement.dataset.theme).toBe('dark');
    // A fixed choice ignores the device.
    setThemePref('light');
    for (const l of listeners) l();
    expect(document.documentElement.dataset.theme).toBe('light');
    stop();
    expect(listeners.size).toBe(0);
  });
});

describe('the place tree (#427)', () => {
  it('clamps a width to its bounds, and to a smaller limit when the page is narrow', () => {
    expect(clampPlaceTreeWidth(PLACE_TREE_DEFAULT)).toBe(PLACE_TREE_DEFAULT);
    expect(clampPlaceTreeWidth(1)).toBe(PLACE_TREE_MIN);
    expect(clampPlaceTreeWidth(99_999)).toBe(PLACE_TREE_MAX);
    expect(clampPlaceTreeWidth(300, 280)).toBe(280);
    // A narrow page never pushes the tree under its minimum.
    expect(clampPlaceTreeWidth(300, 50)).toBe(PLACE_TREE_MIN);
    expect(clampPlaceTreeWidth(300.6)).toBe(301);
  });

  it('reads a stored width clamped; anything bad or missing is the default', () => {
    expect(parsePlaceTreeWidth('320')).toBe(320);
    expect(parsePlaceTreeWidth('3')).toBe(PLACE_TREE_MIN);
    expect(parsePlaceTreeWidth('99999')).toBe(PLACE_TREE_MAX);
    for (const bad of [null, '', 'wide', '12.5', '-300', '300px', '1e3', 'NaN', 'Infinity', ' '])
      expect(parsePlaceTreeWidth(bad), String(bad)).toBe(PLACE_TREE_DEFAULT);
  });

  it('remembers the width and the fold; the defaults forget them', () => {
    setPlaceTreeWidth(320);
    expect(localStorage.getItem(PLACE_TREE_WIDTH_KEY)).toBe('320');
    expect(storedPlaceTreeWidth()).toBe(320);
    expect(document.documentElement.style.getPropertyValue('--place-tree-width')).toBe('320px');
    setPlaceTreeWidth(PLACE_TREE_DEFAULT);
    expect(localStorage.getItem(PLACE_TREE_WIDTH_KEY)).toBeNull();

    setPlaceTreeCollapsed(true);
    expect(localStorage.getItem(PLACE_TREE_KEY)).toBe('collapsed');
    expect(storedPlaceTreeCollapsed()).toBe(true);
    expect(document.documentElement.getAttribute('data-place-tree')).toBe('collapsed');
    setPlaceTreeCollapsed(false);
    expect(localStorage.getItem(PLACE_TREE_KEY)).toBeNull();
    expect(document.documentElement.getAttribute('data-place-tree')).toBe('expanded');

    localStorage.setItem(PLACE_TREE_KEY, 'sideways');
    expect(storedPlaceTreeCollapsed()).toBe(false);
  });

  it('still works when storage throws: the choice lasts for this page', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      expect(storedPlaceTreeWidth()).toBe(PLACE_TREE_DEFAULT);
      expect(storedPlaceTreeCollapsed()).toBe(false);
      expect(() => setPlaceTreeWidth(320)).not.toThrow();
      expect(document.documentElement.style.getPropertyValue('--place-tree-width')).toBe('320px');
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });
});

describe('the pre-paint script (index.html)', () => {
  // The inline script that reads the stored preferences (index.html also has zod's config).
  const script =
    [...indexHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)]
      .map((m) => m[1] ?? '')
      .find((body) => body.includes('kept.theme')) ?? '';

  function prePaint(stored: Record<string, string>, language = 'en-GB') {
    localStorage.clear();
    for (const [k, v] of Object.entries(stored)) localStorage.setItem(k, v);
    vi.stubGlobal('navigator', { language });
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(min-width: 1024px)' }));
    const d = document.documentElement;
    for (const a of ['data-theme', 'data-width', 'lang', 'dir']) d.removeAttribute(a);
    new Function(script)();
    return {
      width: d.getAttribute('data-width'),
      lang: d.getAttribute('lang'),
      dir: d.getAttribute('dir'),
    };
  }

  it('applies the stored width and language before React loads', () => {
    expect(script).toContain('kept.width');
    expect(prePaint({ 'kept.width': 'full', 'kept.locale': 'de' })).toEqual({
      width: 'full',
      lang: 'de',
      dir: 'ltr',
    });
    expect(prePaint({ 'kept.locale': 'ar' })).toEqual({
      width: 'centered',
      lang: 'ar',
      dir: 'rtl',
    });
  });

  it('falls back to the browser language when it is one of the five, else English', () => {
    expect(prePaint({}, 'fr-CA').lang).toBe('fr');
    expect(prePaint({}, 'it').lang).toBe('it');
    expect(prePaint({}, 'pt-BR').lang).toBe('en');
    expect(prePaint({ 'kept.width': 'wide' }).width).toBe('centered');
  });

  it('knows Ukrainian, left to right, whether stored or the browser’s', () => {
    expect(prePaint({ 'kept.locale': 'uk' })).toMatchObject({ lang: 'uk', dir: 'ltr' });
    expect(prePaint({}, 'uk-UA')).toMatchObject({ lang: 'uk', dir: 'ltr' });
  });

  it('knows Spanish, left to right, whether stored or the browser’s', () => {
    expect(prePaint({ 'kept.locale': 'es' })).toMatchObject({ lang: 'es', dir: 'ltr' });
    expect(prePaint({}, 'es-MX')).toMatchObject({ lang: 'es', dir: 'ltr' });
  });

  it('makes the same place tree choices as prefs.ts, before React loads', () => {
    const d = document.documentElement;
    const tree = (stored: Record<string, string>) => {
      prePaint(stored);
      return [d.getAttribute('data-place-tree'), d.style.getPropertyValue('--place-tree-width')];
    };
    const px = (n: number) => `${n}px`;
    expect(tree({})).toEqual(['expanded', px(PLACE_TREE_DEFAULT)]);
    expect(tree({ 'kept.placeTree': 'collapsed', 'kept.placeTreeWidth': '320' })).toEqual([
      'collapsed',
      '320px',
    ]);
    expect(tree({ 'kept.placeTree': 'sideways' })[0]).toBe('expanded');
    for (const raw of ['3', '99999', 'wide', '12.5', '-300', '300px', '1e3', ''])
      expect(tree({ 'kept.placeTreeWidth': raw })[1], raw).toBe(px(parsePlaceTreeWidth(raw)));
  });

  it('a blocked storage leaves the place tree at its defaults', () => {
    const d = document.documentElement;
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      prePaint({});
      expect(d.getAttribute('data-place-tree')).toBe('expanded');
      expect(d.style.getPropertyValue('--place-tree-width')).toBe(px240());
    } finally {
      getItem.mockRestore();
    }
    function px240() {
      return `${PLACE_TREE_DEFAULT}px`;
    }
  });
});
