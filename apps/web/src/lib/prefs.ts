/**
 * Theme, language, digits, region, date format, content width, sidebar and place tree preferences.
 * The pre-paint script in index.html applies the stored values before React loads; this module
 * owns changing them afterwards. Keep the keys in step.
 * localStorage may throw (private mode, blocked storage): every access is guarded, and the app
 * works without it, falling back to the OS colour scheme and the browser language.
 */
import { useSyncExternalStore } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';
/** D204: the launch languages. Arabic is the only right-to-left one. */
export type Locale = 'en' | 'ar' | 'fr' | 'de' | 'it' | 'vi' | 'uk' | 'es';
/** D143: in Arabic, Western (0123) or Eastern Arabic (٠١٢٣) digits. Other languages are always Western. */
export type Digits = 'western' | 'eastern';
/** D203: page content in the readable column (the default) or across the whole space. */
export type WidthPref = 'centered' | 'full';
/**
 * #362: how English writes its dates: the United States' "Oct 29", or the United Kingdom's
 * "29 Oct" (and 29/10/2026). Only English has the choice; the other languages have one way.
 */
export type EnglishRegion = 'us' | 'gb';
/**
 * #362: how dates are written. `auto` is the language's own short form ("29 Oct", with the year
 * only when it isn't this year); `medium` always has the year ("29 Oct 2026"); `numeric` is the
 * language's digits-only form (29/10/2026 in the UK, 10/29/2026 in the US, 29.10.2026 in German);
 * `iso` is 2026-10-29 in every language.
 */
export type DateFormatPref = 'auto' | 'medium' | 'numeric' | 'iso';
export const DATE_FORMATS: readonly DateFormatPref[] = ['auto', 'medium', 'numeric', 'iso'];

export const THEME_KEY = 'kept.theme';
export const LOCALE_KEY = 'kept.locale';
export const DIGITS_KEY = 'kept.digits';
export const WIDTH_KEY = 'kept.width';
export const REGION_KEY = 'kept.region';
export const DATE_FORMAT_KEY = 'kept.dateFormat';
export const LOCALES: readonly Locale[] = ['en', 'ar', 'fr', 'de', 'it', 'vi', 'uk', 'es'];

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** The launch language a BCP 47 tag belongs to (`ar-EG` → `ar`, `fr-CA` → `fr`), or null. */
export function localeOfTag(tag: string): Locale | null {
  const language = tag.trim().toLowerCase().split(/[-_]/)[0];
  return isLocale(language) ? language : null;
}
/** D198: the desktop sidebar as a full sidebar or an icon rail, remembered per device. */
export const SIDEBAR_KEY = 'kept.sidebar';
export type SidebarPref = 'collapsed' | 'expanded' | 'auto';
/** With no stored choice the rail is the default below this width (tablets), D198. */
export const SIDEBAR_WIDE_QUERY = '(min-width: 1024px)';

/** #427: the place tree beside a page, folded to a rail or not, remembered per device. */
export const PLACE_TREE_KEY = 'kept.placeTree';
/** #427: its width in CSS pixels, remembered per device. index.html reads the same bounds. */
export const PLACE_TREE_WIDTH_KEY = 'kept.placeTreeWidth';
/** The width before anyone drags it: 15rem, what the column always was. */
export const PLACE_TREE_DEFAULT = 240;
/** Under this a row four levels deep (indent, fold button, icon) has no room left for its name. */
export const PLACE_TREE_MIN = 208;
/** Enough for five levels and a long name. The column also stops at 40% of the page's area. */
export const PLACE_TREE_MAX = 512;

/** A width within the bounds. `limit` is what fits this page now; it never beats the minimum. */
export function clampPlaceTreeWidth(px: number, limit: number = PLACE_TREE_MAX): number {
  const max = Math.max(PLACE_TREE_MIN, Math.min(limit, PLACE_TREE_MAX));
  return Math.round(Math.min(max, Math.max(PLACE_TREE_MIN, px)));
}

/** A stored width, clamped; anything else is the default. The pre-paint script does the same. */
export function parsePlaceTreeWidth(raw: string | null): number {
  return raw !== null && /^\d{1,5}$/.test(raw)
    ? clampPlaceTreeWidth(Number(raw))
    : PLACE_TREE_DEFAULT;
}

// Maghreb Arabic writes Western digits; elsewhere Eastern Arabic is the default (D143).
const WESTERN_DIGIT_REGIONS = new Set(['ma', 'dz', 'tn', 'ly', 'eh', 'mr']);

export function storedDigits(): Digits {
  const v = read(DIGITS_KEY);
  if (v === 'western' || v === 'eastern') return v;
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase();
  const region = nav.split('-')[1] ?? '';
  return WESTERN_DIGIT_REGIONS.has(region) ? 'western' : 'eastern';
}

/** The stored English region, else the browser's when it is British English, else the US. */
export function storedRegion(): EnglishRegion {
  const v = read(REGION_KEY);
  if (v === 'us' || v === 'gb') return v;
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'en') ?? 'en';
  return /^en[-_]gb$/i.test(nav) ? 'gb' : 'us';
}

export function storedDateFormat(): DateFormatPref {
  const v = read(DATE_FORMAT_KEY);
  return (DATE_FORMATS as readonly string[]).includes(v ?? '') ? (v as DateFormatPref) : 'auto';
}

/**
 * The BCP 47 tag for Intl formatting: the locale plus, in Arabic, its numbering system, and in
 * English its region (`en-GB`, #362). The region defaults to the one chosen on this device.
 */
export function formatLocale(
  locale: Locale,
  digits: Digits,
  region: EnglishRegion = state.region,
): string {
  if (locale === 'en') return region === 'gb' ? 'en-GB' : 'en';
  if (locale !== 'ar') return locale;
  return digits === 'eastern' ? 'ar-u-nu-arab' : 'ar-u-nu-latn';
}

export function directionOf(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the choice lasts for this page only.
  }
}

function systemDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export function storedThemePref(): ThemePref {
  const v = read(THEME_KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
}

/** The stored language, else the browser's if it is one of the six, else English. */
export function initialLocale(): Locale {
  const v = read(LOCALE_KEY);
  if (isLocale(v)) return v;
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en';
  return localeOfTag(nav ?? 'en') ?? 'en';
}

export function storedWidthPref(): WidthPref {
  return read(WIDTH_KEY) === 'full' ? 'full' : 'centered';
}

export function storedSidebarPref(): SidebarPref {
  const v = read(SIDEBAR_KEY);
  return v === 'collapsed' || v === 'expanded' ? v : 'auto';
}

export function storedPlaceTreeCollapsed(): boolean {
  return read(PLACE_TREE_KEY) === 'collapsed';
}

export function storedPlaceTreeWidth(): number {
  return parsePlaceTreeWidth(read(PLACE_TREE_WIDTH_KEY));
}

function wideScreen(): boolean {
  try {
    return window.matchMedia(SIDEBAR_WIDE_QUERY).matches;
  } catch {
    return true; // no matchMedia (tests, old engines): the full sidebar
  }
}

/** The pre-paint script in index.html makes the same choice; keep them in step. */
function resolveSidebar(pref: SidebarPref): boolean {
  return pref === 'collapsed' || (pref === 'auto' && !wideScreen());
}

type State = {
  theme: ThemePref;
  resolvedTheme: 'light' | 'dark';
  locale: Locale;
  digits: Digits;
  region: EnglishRegion;
  dateFormat: DateFormatPref;
  width: WidthPref;
  sidebar: SidebarPref;
  /** Whether the desktop sidebar is the icon rail right now (D198). */
  sidebarCollapsed: boolean;
  placeTreeCollapsed: boolean;
  placeTreeWidth: number;
};

let state: State = {
  theme: storedThemePref(),
  resolvedTheme: 'light',
  locale: initialLocale(),
  digits: storedDigits(),
  region: storedRegion(),
  dateFormat: storedDateFormat(),
  width: storedWidthPref(),
  sidebar: storedSidebarPref(),
  sidebarCollapsed: false,
  placeTreeCollapsed: storedPlaceTreeCollapsed(),
  placeTreeWidth: storedPlaceTreeWidth(),
};
state = {
  ...state,
  resolvedTheme: resolve(state.theme),
  sidebarCollapsed: resolveSidebar(state.sidebar),
};

const listeners = new Set<() => void>();

function resolve(theme: ThemePref): 'light' | 'dark' {
  if (theme === 'system') return systemDark() ? 'dark' : 'light';
  return theme;
}

/** The page's paper colour per theme (tokens.css `--paper`), for the browser chrome (L85). */
export const THEME_COLOR = { light: '#F2F1EC', dark: '#151412' } as const;

function applyToDocument(s: State): void {
  const d = document.documentElement;
  d.setAttribute('data-theme', s.resolvedTheme);
  // index.html's theme-color metas, as its pre-paint script sets them.
  for (const m of document.querySelectorAll('meta[name="theme-color"]'))
    m.setAttribute('content', THEME_COLOR[s.resolvedTheme]);
  d.setAttribute('lang', s.locale);
  d.setAttribute('dir', directionOf(s.locale));
  d.setAttribute('data-width', s.width);
  d.setAttribute('data-sidebar', s.sidebarCollapsed ? 'collapsed' : 'expanded');
  d.setAttribute('data-place-tree', s.placeTreeCollapsed ? 'collapsed' : 'expanded');
  showPlaceTreeWidth(s.placeTreeWidth);
}

function set(next: Partial<State>): void {
  state = { ...state, ...next };
  applyToDocument(state);
  for (const l of listeners) l();
}

export function setThemePref(theme: ThemePref): void {
  write(THEME_KEY, theme === 'system' ? null : theme);
  set({ theme, resolvedTheme: resolve(theme) });
}

export function setLocale(locale: Locale): void {
  write(LOCALE_KEY, locale);
  set({ locale });
}

export function setDigits(digits: Digits): void {
  write(DIGITS_KEY, digits);
  set({ digits });
}

export function setRegion(region: EnglishRegion): void {
  write(REGION_KEY, region);
  set({ region });
}

/** 'auto' is the default, so it forgets the stored choice. */
export function setDateFormat(dateFormat: DateFormatPref): void {
  write(DATE_FORMAT_KEY, dateFormat === 'auto' ? null : dateFormat);
  set({ dateFormat });
}

/** D203: 'centered' is the default, so it forgets the stored choice. */
export function setWidthPref(width: WidthPref): void {
  write(WIDTH_KEY, width === 'centered' ? null : width);
  set({ width });
}

/** Store a sidebar choice; 'auto' forgets it and follows the screen width again. */
export function setSidebarPref(sidebar: SidebarPref): void {
  write(SIDEBAR_KEY, sidebar === 'auto' ? null : sidebar);
  set({ sidebar, sidebarCollapsed: resolveSidebar(sidebar) });
}

/** Collapse to the rail or expand it (the foot button and ⌘\ / Ctrl+\). */
export function toggleSidebar(): void {
  setSidebarPref(state.sidebarCollapsed ? 'expanded' : 'collapsed');
}

/** Fold the place tree to its rail or open it; expanded is the default, so it forgets the choice. */
export function setPlaceTreeCollapsed(placeTreeCollapsed: boolean): void {
  write(PLACE_TREE_KEY, placeTreeCollapsed ? 'collapsed' : null);
  set({ placeTreeCollapsed });
}

/**
 * The column's width, on the root as the pre-paint script sets it, and nothing else: a drag calls
 * this on every move, and setPlaceTreeWidth once at its end. Going through `set` on each move
 * would render everything that reads the preferences, and write to storage, per pointer event.
 */
export function showPlaceTreeWidth(px: number): void {
  document.documentElement.style.setProperty('--place-tree-width', `${px}px`);
}

/** Keep a place tree width; the default forgets the stored one. */
export function setPlaceTreeWidth(px: number): void {
  const placeTreeWidth = clampPlaceTreeWidth(px);
  write(
    PLACE_TREE_WIDTH_KEY,
    placeTreeWidth === PLACE_TREE_DEFAULT ? null : String(placeTreeWidth),
  );
  set({ placeTreeWidth });
}

/**
 * Without a stored choice, follow the width across 1024 px (a window resized, a tablet turned).
 * Re-reads once on subscribing, so it agrees with the pre-paint script's choice.
 */
export function watchSidebarWidth(): () => void {
  const sync = () => {
    const sidebar = storedSidebarPref();
    const sidebarCollapsed = resolveSidebar(sidebar);
    if (sidebar !== state.sidebar || sidebarCollapsed !== state.sidebarCollapsed)
      set({ sidebar, sidebarCollapsed });
  };
  sync();
  let mq: MediaQueryList;
  try {
    mq = window.matchMedia(SIDEBAR_WIDE_QUERY);
  } catch {
    return () => {};
  }
  mq.addEventListener('change', sync);
  return () => mq.removeEventListener('change', sync);
}

/** Follow the OS when the preference is "system". Call once at startup. */
export function watchSystemTheme(): () => void {
  let mq: MediaQueryList;
  try {
    mq = window.matchMedia('(prefers-color-scheme: dark)');
  } catch {
    return () => {};
  }
  const onChange = () => {
    if (state.theme === 'system') set({ resolvedTheme: resolve('system') });
  };
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function usePrefs(): State {
  return useSyncExternalStore(subscribe, () => state);
}
