import { describe, expect, it } from 'vitest';
import {
  compareCatalogues,
  duplicateEntries,
  icuShape,
  missingLocales,
  oneLosesNumber,
  shapeProblems,
} from './check-i18n.mjs';

const extracted = (...ids) => new Map(ids.map((id) => [id, { message: id }]));

describe('compareCatalogues', () => {
  it('passes when every extracted message is in every catalogue', () => {
    const r = compareCatalogues(extracted('a', 'b'), {
      en: { a: 'A', b: 'B' },
      ar: { a: 'أ', b: 'ب' },
    });
    expect(r.missing).toEqual({ en: [], ar: [] });
  });

  it('reports a message that is in the source but in no catalogue, per locale', () => {
    const r = compareCatalogues(extracted('a', 'new'), { en: { a: 'A' }, ar: { a: 'أ' } });
    expect(r.missing).toEqual({ en: ['new'], ar: ['new'] });
  });

  it('reports a message missing from one locale only', () => {
    const r = compareCatalogues(extracted('a', 'b'), { en: { a: 'A', b: 'B' }, ar: { a: 'أ' } });
    expect(r.missing).toEqual({ en: [], ar: ['b'] });
  });

  it('counts an empty Arabic translation as untranslated, not missing (English shows)', () => {
    const r = compareCatalogues(extracted('a', 'b'), {
      en: { a: 'A', b: 'B' },
      ar: { a: 'أ', b: '' },
    });
    expect(r.missing.ar).toEqual([]);
    expect(r.untranslated).toEqual({ en: 0, ar: 1 });
  });

  it('counts obsolete entries without failing on them', () => {
    const r = compareCatalogues(extracted('a'), {
      en: { a: 'A', gone: 'G' },
      ar: { a: 'أ', gone: '' },
    });
    expect(r.missing).toEqual({ en: [], ar: [] });
    expect(r.obsolete).toEqual({ en: 1, ar: 1 });
    // An obsolete entry is not "untranslated" either.
    expect(r.untranslated.ar).toBe(0);
  });

  it('names the obsolete entries per locale, for --list-obsolete', () => {
    const r = compareCatalogues(extracted('a'), {
      en: { a: 'A', gone: 'G', old: 'O' },
      ar: { a: 'أ', gone: 'ج' },
    });
    expect(r.obsoleteIds).toEqual({ en: ['gone', 'old'], ar: ['gone'] });
    expect(r.obsolete).toEqual({ en: 2, ar: 1 });
  });
});

describe('the languages the app ships', () => {
  it('requires all eight in the config', () => {
    expect(missingLocales(['ar', 'de', 'en', 'es', 'fr', 'it', 'uk', 'vi'])).toEqual([]);
    expect(missingLocales(['en', 'ar'])).toEqual(['de', 'es', 'fr', 'it', 'uk', 'vi']);
    expect(missingLocales(['ar', 'de', 'en', 'fr', 'it'])).toEqual(['es', 'uk', 'vi']);
  });

  it('flags a translation that drops a placeholder, a tag or a plural', () => {
    const src = new Map([
      ['p', { message: 'Moved {name} to {place}' }],
      ['t', { message: '<0>{0}</0> is empty' }],
      ['n', { message: '{n, plural, one {# thing} other {# things}}' }],
      ['ok', { message: 'Saved {n}' }],
    ]);
    const r = shapeProblems(src, {
      de: { p: '', t: '<0>{0}</0> ist leer' },
      en: {},
      fr: {
        p: '{name} déplacé',
        t: '{0} est vide',
        n: '{n} objets',
        ok: 'Enregistré : {n}',
      },
    });
    expect(r.fr).toEqual([
      { id: 'p', why: 'placeholders' },
      { id: 't', why: 'tags' },
      { id: 'n', why: 'plurals' },
    ]);
    // Empty entries are the untranslated check's business, not this one's.
    expect(r.de).toEqual([]);
  });
});

describe('a plural whose one branch is also 21, 31, 101', () => {
  const lost =
    '{n, plural, one {Відкрито один раз} few {Відкрито # рази} other {Відкрито # разів}}';
  const kept =
    '{n, plural, =1 {Відкрито один раз} one {Відкрито # раз} few {Відкрито # рази} other {Відкрито # разів}}';

  it('fails when one has no # and another branch has', () => {
    expect(oneLosesNumber(lost)).toBe(true);
    expect(oneLosesNumber('{n, plural, one {з 1 локацією} other {з # локаціями}}')).toBe(true);
  });

  it('passes =1 with # in one, and a plural with no # at all', () => {
    expect(oneLosesNumber(kept)).toBe(false);
    expect(oneLosesNumber('{n, plural, one {подія} few {події} many {подій} other {події}}')).toBe(
      false,
    );
    expect(oneLosesNumber('Без числа')).toBe(false);
  });

  it('reads branches past a placeholder inside one', () => {
    expect(oneLosesNumber('{n, plural, one {Позичено {who}} other {Позичено {who}: #}}')).toBe(
      true,
    );
  });

  it('only counts against the languages it applies to', () => {
    const source = '{n, plural, one {Opened once} other {Opened # times}}';
    const r = shapeProblems(new Map([['k', { message: source }]]), {
      en: {},
      fr: { k: '{n, plural, one {Ouvert une fois} other {Ouvert # fois}}' },
      uk: { k: lost },
    });
    expect(r.fr).toEqual([]);
    expect(r.uk).toEqual([{ id: 'k', why: expect.stringContaining('=1') }]);
    const fixed = shapeProblems(new Map([['k', { message: source }]]), { uk: { k: kept } });
    expect(fixed.uk).toEqual([]);
  });
});

describe("a message's shape (an ICU walk, not a regex)", () => {
  it('takes a one-word plural branch as text, not a placeholder', () => {
    expect(icuShape('{n, plural, one {thing} other {things}}')).toEqual({ names: 'n', plurals: 1 });
    const src = new Map([['k', { message: '{n, plural, one {thing} other {things}}' }]]);
    const r = shapeProblems(src, {
      ar: {
        k: '{n, plural, zero {أشياء} one {شيء} two {شيئان} few {أشياء} many {شيئًا} other {شيء}}',
      },
      en: {},
      fr: { k: '{n, plural, one {objet} other {objets}}' },
    });
    expect(r).toEqual({ ar: [], fr: [] });
  });

  it('still finds a placeholder inside a branch, a nested plural, and a typed argument', () => {
    expect(
      icuShape('{n, plural, one {# of {name}} other {{m, plural, one {x} other {y}} {name}}}'),
    ).toEqual({
      names: 'm,n,name',
      plurals: 2,
    });
    expect(icuShape('Due {when, date, short} at {km, number}')).toEqual({
      names: 'km,when',
      plurals: 0,
    });
    expect(icuShape('{kind, select, car {a car} other {{kind}}}')).toEqual({
      names: 'kind',
      plurals: 1,
    });
  });

  it("honours ICU quoting: '{x}' is text, '' an apostrophe", () => {
    expect(icuShape("'{x}' and l''{name}")).toEqual({ names: 'name', plurals: 0 });
  });

  it('flags a translation that loses a placeholder a branch carried', () => {
    const src = new Map([['k', { message: '{n, plural, one {# by {who}} other {# by {who}}}' }]]);
    const r = shapeProblems(src, {
      en: {},
      de: { k: '{n, plural, one {# von jemandem} other {#}}' },
    });
    expect(r.de).toEqual([{ id: 'k', why: 'placeholders' }]);
  });
});

describe('duplicateEntries', () => {
  const po = (...entries) => entries.join('\n\n');
  const header = 'msgid ""\nmsgstr ""\n"Language: de\\n"';

  it('finds two entries with the same msgid and no context (the later one wins at runtime)', () => {
    const text = po(
      header,
      '#: src/a.tsx\nmsgid "Units"\nmsgstr "Höheneinheiten"',
      '#: src/b.tsx\nmsgid "Units"\nmsgstr "Einheiten"',
    );
    expect(duplicateEntries(text)).toEqual([{ context: null, id: 'Units' }]);
  });

  it('tells entries apart by their context', () => {
    const text = po(
      header,
      'msgctxt "rack"\nmsgid "Units"\nmsgstr "Höheneinheiten"',
      'msgid "Units"\nmsgstr "Einheiten"',
    );
    expect(duplicateEntries(text)).toEqual([]);
  });

  it('finds a repeated context and msgid, and joins multi-line strings', () => {
    const text = po(
      header,
      'msgctxt "rack"\nmsgid ""\n"Un"\n"its"\nmsgstr "A"',
      'msgctxt "rack"\nmsgid "Units"\nmsgstr "B"',
    );
    expect(duplicateEntries(text)).toEqual([{ context: 'rack', id: 'Units' }]);
  });

  it('leaves obsolete #~ entries out', () => {
    const text = po(header, 'msgid "Units"\nmsgstr "A"', '#~ msgid "Units"\n#~ msgstr "B"');
    expect(duplicateEntries(text)).toEqual([]);
  });
});
