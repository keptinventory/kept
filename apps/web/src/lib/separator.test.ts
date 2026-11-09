/** The separator between a line's parts (#459): a comma, the Arabic comma in Arabic, never the
 * middle dot, in the catalogue and in lines built in code. In Arabic the dot also read as the zero
 * beside an Eastern digit (UI step-4 review L1). */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { i18n, type Messages } from '@lingui/core';
import { afterEach, describe, expect, it } from 'vitest';
import { activateLocale } from '@/i18n/i18n';
import { localiseSeparators, makeFormatter, sep, separatorFor } from './format';
import { formatLocale, LOCALES } from './prefs';

const DOT = '·';

afterEach(async () => {
  await activateLocale('en');
});

describe('the separator', () => {
  it('is a comma, and the Arabic comma in Arabic, whatever the digits', () => {
    expect(separatorFor('en')).toBe(', ');
    expect(separatorFor('fr')).toBe(', ');
    expect(separatorFor('ar')).toBe('، ');
    expect(makeFormatter(formatLocale('ar', 'eastern')).sep).toBe('، ');
    expect(makeFormatter(formatLocale('ar', 'western')).sep).toBe('، ');
    expect(makeFormatter('de').sep).toBe(', ');
  });

  it('follows the language being read, for lines built in code', async () => {
    expect(sep()).toBe(', ');
    await activateLocale('ar');
    expect(sep()).toBe('، ');
  });

  it("replaces the catalogue's dot in every language, inside plural choices too", () => {
    // Compiled as @lingui/vite-plugin compiles the .po: text and tokens, choices as messages.
    const messages = {
      a: [`الضمانات ${DOT} `, ['0']],
      b: [['n', 'plural', { one: [`صندوق ${DOT} واحد`], other: [`صندوق ${DOT} كثير`] }]],
      c: [`${DOT} موروث`],
      d: [`Warranties ${DOT} `, ['0']],
    } as unknown as Messages;
    // By a variable, so Lingui's extractor doesn't take these test ids for the app's messages.
    const say = (id: keyof typeof messages, values?: Record<string, unknown>) => i18n._(id, values);
    i18n.load('ar-test', localiseSeparators(messages, 'ar'));
    i18n.activate('ar-test');
    expect(say('a', { 0: '٢' })).toBe('الضمانات، ٢');
    expect(say('b', { n: 3 })).toBe('صندوق، كثير');
    expect(say('c')).toBe('، موروث');
    i18n.load('en-test', localiseSeparators(messages, 'en'));
    i18n.activate('en-test');
    expect(say('d', { 0: '2' })).toBe('Warranties, 2');
  });

  it.each(LOCALES)('reaches every message in %s: none keeps the dot', async (locale) => {
    await activateLocale(locale);
    expect(JSON.stringify(Object.values(i18n.messages))).not.toContain(DOT);
  });
});

/**
 * A line built in code, outside a catalogue message (`<Trans>`, `t`, `plural`…), never writes the
 * dot: it uses `sep()` or the formatter's `sep`, or separate elements. Comments may name it.
 */
describe('lines built in code', () => {
  type Node = { type: string; [key: string]: unknown };
  const { parseSync } = createRequire(import.meta.url)('@babel/core') as {
    parseSync: (code: string, options: object) => { program: Node } | null;
  };
  const src = join(dirname(fileURLToPath(import.meta.url)), '..');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts'))
        files.push(path);
    }
  };
  walk(src);
  const CATALOGUE_TAGS = new Set(['Trans', 'Plural', 'Select', 'SelectOrdinal']);
  const CATALOGUE_CALLS = new Set(['t', 'msg', 'plural', 'select', 'selectOrdinal']);
  const nameOf = (n: unknown): string => {
    const x = n as { name?: string; property?: { name?: string } } | undefined;
    return x?.name ?? x?.property?.name ?? '';
  };
  const inCatalogue = (n: Node) =>
    (n.type === 'JSXElement' &&
      CATALOGUE_TAGS.has(nameOf((n.openingElement as { name: unknown }).name))) ||
    (n.type === 'TaggedTemplateExpression' && CATALOGUE_CALLS.has(nameOf(n.tag))) ||
    (n.type === 'CallExpression' && CATALOGUE_CALLS.has(nameOf(n.callee)));
  const textOf = (n: Node): string => {
    if (n.type === 'StringLiteral' || n.type === 'JSXText') return n.value as string;
    if (n.type === 'TemplateElement') return (n.value as { raw: string }).raw;
    if (n.type === 'RegExpLiteral') return n.pattern as string;
    return '';
  };

  it('never writes the middle dot outside a catalogue message', () => {
    const found: string[] = [];
    for (const file of files) {
      const code = readFileSync(file, 'utf8');
      if (!code.includes(DOT)) continue;
      const ast = parseSync(code, {
        filename: file,
        configFile: false,
        babelrc: false,
        parserOpts: { plugins: ['typescript', 'jsx'] },
      });
      const visit = (node: Node, catalogue: boolean) => {
        const here = catalogue || inCatalogue(node);
        if (!here && textOf(node).includes(DOT)) {
          const { line } = (node.loc as { start: { line: number } }).start;
          found.push(`${relative(src, file)}:${line}`);
        }
        for (const [key, child] of Object.entries(node)) {
          if (key === 'loc' || key.endsWith('Comments')) continue;
          for (const c of Array.isArray(child) ? child : [child])
            if (c && typeof (c as Node).type === 'string') visit(c as Node, here);
        }
      };
      if (ast) visit(ast.program, false);
    }
    expect(found).toEqual([]);
  });
});
