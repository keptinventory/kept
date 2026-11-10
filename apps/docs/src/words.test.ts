import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { groupName, integrationGroups, integrations, wordsOf } from './data/integrations';
import { LANGS } from './i18n';
import { sidebarLabels } from './sidebar-labels.mjs';
import * as words from './words';

const OTHERS = LANGS.filter((lang) => lang !== 'en' && lang !== 'ar');
// No middle dot in any language (#478): a comma, a colon or separate items instead.
const MIDDLE_DOT = '·';

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

describe('the components’ words', () => {
  const tables = Object.entries(words).filter(([name]) => name !== 'default');

  it.each(tables)('%s has words for every language', (_name, table) => {
    for (const lang of LANGS) expect(table, lang).toHaveProperty(lang);
  });

  it.each(tables)(
    '%s has no empty word in the languages besides English and Arabic',
    (_name, table) => {
      for (const lang of OTHERS) {
        const t = (table as Record<string, unknown>)[lang];
        const texts = typeof t === 'function' ? [(t as (c: string) => string)('0')] : strings(t);
        expect(texts.length, lang).toBeGreaterThan(0);
        for (const text of texts) expect(text.trim(), lang).not.toBe('');
      }
    },
  );

  it.each(tables)('%s has no middle dot in any language', (_name, table) => {
    for (const lang of LANGS) {
      const t = (table as Record<string, unknown>)[lang];
      const texts = typeof t === 'function' ? [(t as (c: string) => string)('0')] : strings(t);
      for (const text of texts) expect(text, lang).not.toContain(MIDDLE_DOT);
    }
  });

  it('keeps the hero’s three facts and the integrations link’s number in every language', () => {
    for (const lang of LANGS) {
      expect(words.hero[lang]?.facts, lang).toHaveLength(3);
      expect(words.integrations[lang]?.all('37'), lang).toContain('37');
      expect(words.tryMap[lang]?.credit, lang).toHaveLength(2);
    }
  });
});

describe('the integrations’ words', () => {
  it('give every group and every entry words in every language', () => {
    for (const lang of OTHERS) {
      for (const group of integrationGroups) {
        expect(groupName(group, lang), `${group.id} ${lang}`).not.toBe(group.en);
        for (const item of group.items) {
          const w = wordsOf(item, lang);
          expect(w.name, `${item.id} ${lang}`).toMatch(/\S/);
          expect(w.body, `${item.id} ${lang}`).toMatch(/\S/);
          // Not the English text left in place; a name such as "CSV" is the same in every language.
          expect(w.body, `${item.id} ${lang}`).not.toBe(item.en.body);
          expect(w.title === undefined, `${item.id} ${lang} title`).toBe(
            item.en.title === undefined,
          );
        }
      }
    }
  });

  it('keep English and Arabic as they are, and fall back to English for another code', () => {
    const csv = integrations.find((i) => i.id === 'csv');
    expect(csv && wordsOf(csv, 'en')).toBe(csv?.en);
    expect(csv && wordsOf(csv, 'ar')).toBe(csv?.ar);
    const group = integrationGroups[0];
    expect(group && groupName(group, 'en')).toBe('Bring things in');
    expect(group && groupName(group, 'ar')).toBe(group?.ar);
  });
});

describe('the sidebar groups', () => {
  const config = readFileSync(new URL('../astro.config.mjs', import.meta.url), 'utf8');
  const used = [...config.matchAll(/\bgroup\('([^']+)'/g)].map((m) => m[1] as string);

  it('are found in the config', () => {
    expect(used.length).toBeGreaterThanOrEqual(6);
  });

  it('name the API reference, the group starlight-openapi writes, in every language', () => {
    expect(config).toContain("sidebar: { label: 'API reference' }");
    expect(readFileSync(new URL('./route-data.ts', import.meta.url), 'utf8')).toContain(
      "API_GROUP = 'API reference'",
    );
    const names = (sidebarLabels as Record<string, Record<string, string>>)['API reference'];
    for (const lang of LANGS.filter((l) => l !== 'en')) {
      expect(names?.[lang], lang).toMatch(/\S/);
    }
  });

  it('have a name in every language', () => {
    for (const label of used) {
      const names = (sidebarLabels as Record<string, Record<string, string>>)[label];
      expect(names, label).toBeDefined();
      for (const lang of LANGS.filter((l) => l !== 'en')) {
        expect(names?.[lang], `${label} ${lang}`).toMatch(/\S/);
      }
    }
  });
});
