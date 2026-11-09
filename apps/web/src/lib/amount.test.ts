import { AmountError } from '@kept/shared';
import { describe, expect, it } from 'vitest';
import { amountText, readAmount } from './amount';

describe('amount fields read and write by the reader’s language (#474)', () => {
  it('reads a point before three digits as grouping where the language writes a decimal comma', () => {
    expect(readAmount('1.234', 'de')).toBe('1234');
    expect(readAmount('1.234', 'es')).toBe('1234');
    expect(readAmount('1.234', 'vi')).toBe('1234');
    expect(readAmount('1.234', 'en')).toBe('1.234');
    expect(() => readAmount('0.125', 'de')).toThrow(AmountError);
  });

  it('fills a field the way it is read back', () => {
    expect(amountText('1234.5', 'de')).toBe('1234,5');
    expect(amountText('12.345', 'fr')).toBe('12,345');
    expect(amountText('28999.00', 'en')).toBe('28999');
    expect(amountText('1234.5', 'ar-u-nu-arab')).toBe('١٢٣٤٫٥');
    expect(amountText(null, 'de')).toBe('');
    expect(amountText('not money', 'de')).toBe('not money');
    for (const tag of ['ar-u-nu-arab', 'ar-u-nu-latn', 'de', 'en', 'es', 'fr', 'it', 'uk', 'vi']) {
      for (const amount of ['0.5', '1.234', '12.345', '1234', '12345.6789']) {
        expect([tag, readAmount(amountText(amount, tag), tag)]).toEqual([tag, amount]);
      }
    }
  });
});
