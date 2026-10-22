/**
 * A file's size in the reader's language and digits, for archives, exports and what a phone keeps
 * offline: "138 kB", "48.2 MB", "1.2 GB". Decimal units, as the board draws them; one decimal from
 * a megabyte up. Under a kilobyte it is a count of bytes in words, "1 byte", "512 bytes", with the
 * language's own plural forms (Intl's short unit says "512 byte").
 */
import { plural } from '@lingui/core/macro';
import { formatLocale, usePrefs } from '@/lib/prefs';

const UNITS = [
  [1e9, 'gigabyte'],
  [1e6, 'megabyte'],
  [1e3, 'kilobyte'],
] as const;

export function useFileSize(): (bytes: number) => string {
  const { locale, digits } = usePrefs();
  const tag = formatLocale(locale, digits);
  return (bytes) => {
    const found = UNITS.find(([s]) => bytes >= s);
    if (!found) return plural(bytes, { one: '# byte', other: '# bytes' });
    const [size, unit] = found;
    return new Intl.NumberFormat(tag, {
      style: 'unit',
      unit,
      unitDisplay: 'short',
      maximumFractionDigits: size >= 1e6 ? 1 : 0,
    }).format(bytes / size);
  };
}
