/**
 * A meter's unit and a typed number in the reader's language (UI step-5 review M1, M4).
 *
 * A meter's unit is free text (1–12 characters, `meters.unit`), but almost every meter is `km`,
 * `mi` or `h`: those three read in the reader's language from CLDR ("كم", "ميل", "س" in Arabic,
 * as the board writes them; "Std." in German). English keeps them as stored, and any other unit
 * is shown as typed. The stored value stays the key everywhere else (consumption, the reading
 * field's limits).
 *
 * A number put into a field for the reader (a default, or a value read from an invoice) is in
 * the reader's digits, as they would type it: no grouping, the Arabic decimal separator. Every
 * parser reads Eastern digits back (`westernNumber`, `parseAmount`, D172).
 */
import { formatSpan, type UnitSystem } from '@kept/shared';
import { QueryClientContext } from '@tanstack/react-query';
import { useContext, useMemo, useSyncExternalStore } from 'react';
import { keys } from '@/api/queries';
import type { Me } from '@/api/types';
import { formatLocale, type Locale, usePrefs } from './prefs';

const noSubscription = () => () => undefined;

/** The reader's unit system (Settings → Units, #385): kept on their profile, which the shell loads
 * first; metric until it has, and wherever there is no profile (the sign-in pages, a component
 * shown on its own). Read from the cache, never fetched here. Map sizes, label sizes and fuel use
 * follow it; stored values never change. */
export function useUnitSystem(): UnitSystem {
  const client = useContext(QueryClientContext);
  const read = () => client?.getQueryData<Me>(keys.me)?.profile.units ?? 'metric';
  return useSyncExternalStore(
    client ? (onChange) => client.getQueryCache().subscribe(onChange) : noSubscription,
    read,
    read,
  );
}

/**
 * Lengths in the reader's units and digits (#385), from @kept/shared's length.ts: `span(cm)` is
 * metres or feet and inches with the unit (3.58 m, 11 ft 9 in); `span(cm, 'cm')` is whole
 * centimetres or whole inches (80 cm, 31 in). `tag` is their locale with its digits.
 */
export function useLengths() {
  const { locale, digits } = usePrefs();
  const system = useUnitSystem();
  return useMemo(() => {
    const tag = formatLocale(locale, digits);
    return {
      system,
      tag,
      imperial: system === 'imperial',
      span: (cm: number, metric: 'm' | 'cm' = 'm') => formatSpan(cm, tag, system, metric),
    };
  }, [locale, digits, system]);
}

const INTL_UNITS: Record<string, string> = { km: 'kilometer', mi: 'mile', h: 'hour' };

/** The unit as the reader reads it: `km` → "كم" in Arabic; English and unknown units as stored. */
export function meterUnitLabel(unit: string, locale: Locale, tag: string = locale): string {
  if (locale === 'en') return unit;
  const intl = INTL_UNITS[unit.trim().toLowerCase()];
  if (!intl) return unit;
  try {
    const part = new Intl.NumberFormat(tag, { style: 'unit', unit: intl, unitDisplay: 'short' })
      .formatToParts(1)
      .find((p) => p.type === 'unit');
    return part?.value.trim() || unit;
  } catch {
    return unit;
  }
}

/** `(unit) => label` in the reader's language; null and undefined read as "". */
export function useMeterUnit(): (unit: string | null | undefined) => string {
  const { locale, digits } = usePrefs();
  return useMemo(() => {
    const tag = formatLocale(locale, digits);
    const cache = new Map<string, string>();
    return (unit) => {
      if (!unit) return '';
      let label = cache.get(unit);
      if (label === undefined) {
        label = meterUnitLabel(unit, locale, tag);
        cache.set(unit, label);
      }
      return label;
    };
  }, [locale, digits]);
}

/** A plain number ("1400", "12.5") in Eastern digits with "٫"; anything else unchanged. */
export function easternTyped(value: string): string {
  return value
    .replace(/[0-9]/g, (d) => String.fromCharCode(0x0660 + Number(d)))
    .replace(/\./g, '٫');
}

/** `(value) => value` as the reader types it: Eastern digits when they read Eastern digits. */
export function useTypedNumber(): (value: string | number) => string {
  const { locale, digits } = usePrefs();
  const eastern = formatLocale(locale, digits) === 'ar-u-nu-arab';
  return useMemo(
    () => (value) => (eastern ? easternTyped(String(value)) : String(value)),
    [eastern],
  );
}
