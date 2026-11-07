/**
 * Ukrainian's `one` is also 21, 31, 101: those keep their number, and only exactly 1 is written
 * as a word. scripts/check-i18n.mjs fails a catalogue that loses it; this reads it back.
 */
import { plural } from '@lingui/core/macro';
import { beforeAll, describe, expect, it } from 'vitest';
import { activateLocale, i18n } from './i18n';

// Through an object, so the macro writes the same message as the screens do: `{0, plural, …}`.
const opened = (n: number) => {
  const link = { views: n };
  return plural(link.views, { 0: 'Not opened yet', one: 'Opened once', other: 'Opened # times' });
};
const everyMonths = (n: number) => {
  const every = { months: n };
  return plural(every.months, { one: 'Every month', other: 'Every # months' });
};

describe('a Ukrainian plural', () => {
  beforeAll(async () => {
    await activateLocale('uk', 'western');
  });

  it('writes exactly one as a word', () => {
    expect(opened(1)).toBe('Відкрито один раз');
    expect(everyMonths(1)).toBe('Щомісяця');
  });

  it.each([
    [21, 'Відкрито 21 раз'],
    [31, 'Відкрито 31 раз'],
    [101, 'Відкрито 101 раз'],
    [22, 'Відкрито 22 рази'],
    [25, 'Відкрито 25 разів'],
    [0, 'Ще не відкривали'],
  ])('keeps the number at %i', (n, text) => {
    expect(opened(n)).toBe(text);
  });

  it('keeps it in the month schedule too', () => {
    expect(i18n.locale).toBe('uk');
    expect(everyMonths(21)).toBe('Кожні 21 місяць');
  });
});
