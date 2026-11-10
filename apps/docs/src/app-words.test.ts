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
