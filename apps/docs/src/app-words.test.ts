import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LANGS, type Lang } from './i18n';

// A docs page that quotes the app quotes it in the page's own language, as the app shows it.
const repo = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
const page = (lang: Lang, path: string) =>
  repo(`apps/docs/src/content/docs/${lang === 'en' ? '' : `${lang}/`}${path}`);

/** A `msgstr` of the web app's catalogue. */
function appWord(lang: Lang, msgid: string): string {
  const po = repo(`apps/web/src/locales/${lang}/messages.po`);
  const head = `msgid "${msgid}"\nmsgstr "`;
  const at = po.indexOf(head);
  expect(at, `${lang}: ${msgid}`).toBeGreaterThan(-1);
  const rest = po.slice(at + head.length);
  return rest.slice(0, rest.indexOf('"\n'));
}

describe('the app’s words in the docs', () => {
  it.each(LANGS)(
    'the assistant’s card shows a type it doesn’t know as the app says it, in %s',
    (lang) => {
      expect(page(lang, 'users/mcp-clients.md')).toContain(appWord(lang, 'not set'));
    },
  );
});

/** The "Capture and the Inbox" section of everyday use, by its heading in each language (#508). */
const CAPTURE_HEADING: Record<Lang, string> = {
  en: '## Capture and the Inbox',
  ar: '## الالتقاط والوارد',
  de: '## Erfassen und der Eingang',
  es: '## Capturar y la bandeja de entrada',
  fr: '## La capture et la Réception',
  it: '## Acquisire e In arrivo',
  uk: '## Додавання та Вхідні',
  vi: '## Chụp và Hộp thư đến',
};

/** The labels the section quotes, as the app's English strings (its catalogue's msgids). */
const CAPTURE_WORDS = [
  'Capture',
  'Draft',
  'Inbox',
  'Home',
  'Insights',
  'Drafts',
  'Unnamed thing',
  'Edit',
  'Save',
  'Confirm',
  'Reject',
  'Move',
  'Set type',
  'More',
  'Accept',
  'Discard',
  'Accept names',
];

function section(text: string, heading: string): string {
  const at = text.indexOf(`\n${heading}\n`);
  expect(at, heading).toBeGreaterThan(-1);
  const rest = text.slice(at + heading.length + 2);
  const end = rest.indexOf('\n## ');
  return end === -1 ? rest : rest.slice(0, end);
}

describe('Draft and finishing a capture in the Inbox (#508)', () => {
  it.each(LANGS)('everyday use quotes each label as the app shows it, in %s', (lang) => {
    const text = section(page(lang, 'users/everyday-use.md'), CAPTURE_HEADING[lang]);
    for (const word of CAPTURE_WORDS) expect(text, word).toContain(`**${appWord(lang, word)}**`);
  });

  it.each(LANGS)('the glossary has Draft, in the app’s word, in %s', (lang) => {
    const glossary = page(lang, 'users/glossary.md');
    expect(glossary).toContain(`\n**${appWord(lang, 'Draft')}**`);
    // Capture is named as the app's tab is.
    expect(glossary).toContain(`\n**${appWord(lang, 'Capture')}**`);
    expect(glossary).toContain(
      `${lang === 'en' ? '' : `/${lang}`}/users/everyday-use/#${CAPTURE_HEADING[lang]
        .slice(3)
        .toLowerCase()
        .replaceAll(' ', '-')}`,
    );
  });
});
