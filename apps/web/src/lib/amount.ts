/**
 * Amount fields (#474). What a person types is read by their language: where it writes a decimal
 * comma, `1.234` is one thousand two hundred and thirty-four, and what can't be told apart is
 * refused (`parseAmount` with a locale). The API takes the canonical form (`"1234.5"`), read
 * without a locale, so a field sends `readAmount`'s answer, and a field filled from the API shows
 * `amountText`, written the way `readAmount` reads it back.
 */
import { AmountError, parseAmount } from '@kept/shared';
import { currentFormatLocale } from './prefs';

const BIDI_MARKS = /[‎‏؜]/g;

/** What was typed in an amount field, canonical. Throws `AmountError` when it isn't an amount. */
export function readAmount(typed: string, locale: string = currentFormatLocale()): string {
  return parseAmount(typed, { locale });
}

/** A canonical amount from the API as an amount field shows it: no grouping, the reader's decimal
 * mark and digits. `''` for none; anything that isn't an amount is shown as it is. */
export function amountText(
  amount: string | null | undefined,
  locale: string = currentFormatLocale(),
): string {
  if (amount == null || amount === '') return '';
  let canonical: string;
  try {
    canonical = parseAmount(amount);
  } catch (e) {
    if (e instanceof AmountError) return amount;
    throw e;
  }
  return new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 4 })
    .format(canonical as Intl.StringNumericLiteral)
    .replace(BIDI_MARKS, '');
}
