/** A label maker's tape is named as each language says it: the tape first, then its width. */
import { i18n } from '@lingui/core';
import { t } from '@lingui/core/macro';
import { afterEach, describe, expect, it } from 'vitest';
import { activateLocale } from '@/i18n/i18n';

afterEach(async () => {
  await activateLocale('en');
});

const titles = () => {
  const width = '12';
  return [t(i18n)`${width} mm tape`, t(i18n)`${width} in tape`];
};

describe('a tape’s title', () => {
  it.each([
    ['es', ['Cinta de 12 mm', 'Cinta de 12 in']],
    ['uk', ['Стрічка 12 мм', 'Стрічка 12 дюйма']],
    ['de', ['Schriftband 12 mm', 'Schriftband 12 in']],
    ['en', ['12 mm tape', '12 in tape']],
  ] as const)('reads naturally in %s', async (locale, expected) => {
    await activateLocale(locale);
    expect(titles()).toEqual(expected);
  });
});
