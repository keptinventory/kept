import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { emptyTranslations, newIds, parsePo } from './check-i18n-extract.mjs';

const PO = `msgid ""
msgstr ""
"Language: ar\\n"

#: src/a.tsx
msgid "Save"
msgstr "حفظ"

#: src/b.tsx
msgctxt "Display button"
msgid "Last seen"
msgstr ""

#: src/c.tsx
msgid ""
"A long "
"message"
msgstr ""
"رسالة "
"طويلة"

#~ msgid "Gone"
#~ msgstr "ذهب"
`;

describe('parsePo', () => {
  it('reads live entries, contexts and multi-line strings, and skips the header and obsolete ones', () => {
    const m = parsePo(PO);
    expect([...m.keys()]).toEqual(['Save', 'Display button\u0004Last seen', 'A long message']);
    expect(m.get('Save')).toBe('حفظ');
    expect(m.get('Display button\u0004Last seen')).toBe('');
    expect(m.get('A long message')).toBe('رسالة طويلة');
  });

  it('unescapes quotes and newlines', () => {
    const m = parsePo('msgid "Say \\"hi\\"\\n"\nmsgstr "قل \\"أهلا\\"\\n"\n');
    expect(m.get('Say "hi"\n')).toBe('قل "أهلا"\n');
  });
});

describe('newIds and emptyTranslations', () => {
  const committed = new Map([
    ['a', 'أ'],
    ['b', ''],
  ]);
  it('flags an id the extract adds', () => {
    expect(
      newIds(
        new Map([
          ['a', ''],
          ['c', ''],
        ]),
        committed,
      ),
    ).toEqual(['c']);
  });
  it('flags an empty translation only for ids the source still uses', () => {
    expect(
      emptyTranslations(
        new Map([
          ['a', ''],
          ['b', ''],
        ]),
        committed,
      ),
    ).toEqual(['b']);
    expect(emptyTranslations(new Map([['a', '']]), committed)).toEqual([]);
  });
});

// Spanish sentences that once kept an English word.
describe('the Spanish catalogue', () => {
  const es = parsePo(
    readFileSync(new URL('../apps/web/src/locales/es/messages.po', import.meta.url), 'utf8'),
  );
  it.each([
    '{0, plural, one {# thing in {where}} other {# things in {where}}}',
    '{count, plural, one {Made labels for # thing} other {Made labels for # things}}',
    '{count, plural, one {Made labels for # place} other {Made labels for # places}}',
    '{count, plural, one {Made # blank label} other {Made # blank labels}}',
  ])('%s has no English left', (id) => {
    expect(es.get(id)).toBeTruthy();
    expect(es.get(id)).not.toMatch(/\b(in|for|Made|blank)\b/);
  });
});

// The committed catalogues themselves: no live entry has an empty translation in any
// non-English locale. An empty msgstr would show English in that language's UI.
describe('the committed catalogues', () => {
  for (const locale of ['ar', 'fr', 'de', 'it', 'vi', 'uk', 'es']) {
    it(`${locale}: every msgstr is written`, () => {
      const url = new URL(`../apps/web/src/locales/${locale}/messages.po`, import.meta.url);
      const entries = parsePo(readFileSync(url, 'utf8'));
      expect(entries.size).toBeGreaterThan(1000);
      const empty = [...entries].filter(([, t]) => t === '').map(([k]) => k);
      expect(empty).toEqual([]);
    });
  }
});
