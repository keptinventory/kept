import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The Home Assistant app's option labels (homeassistant/kept/translations/<language>.yaml): the
// Supervisor reads every file there into the app's `translations`, named by its language
// (supervisor/store/data.py `_read_app_translations`), and the Configuration tab shows them. A key
// one file lacks shows the raw option name in that language.

const DIR = new URL('../homeassistant/kept/translations/', import.meta.url);
const LANGUAGES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'uk', 'vi'];
// Home Assistant lists Latin American Spanish as its own language and falls back to English from
// it, not to Spanish, so it gets the Spanish file again.
const FILES = [...LANGUAGES, 'es-419'];

const read = (lang) => readFileSync(new URL(`${lang}.yaml`, DIR), 'utf8');
/** The file's keys, from its layout (two levels of options, then `name` and `description`). */
const keys = (text) =>
  text
    .split('\n')
    .filter((line) => /^( {2}| {4})?[^\s:]+:/.test(line))
    .map((line) => (/^\s*(\S+?):/.exec(line) ?? [])[1]);
/** What must read the same in every language: addresses, paths and example mail. */
const literal = (text) =>
  (
    text
      .replace(/\n +/g, ' ')
      .match(/\b(?:https?|smtps?):\/\/\w[^\s,)]*|\/api\/v1\/[\w/]+|\/ssl\b/g) ?? []
  )
    .map((s) => s.replace(/[.،。]+$/, ''))
    .sort();

describe('the Home Assistant option labels', () => {
  it('are there in every language of the app, and only those', () => {
    expect(readdirSync(DIR).sort()).toEqual(FILES.map((lang) => `${lang}.yaml`).sort());
  });

  it('say the same in Latin American Spanish as in Spanish', () => {
    expect(read('es-419')).toBe(read('es'));
  });

  it.each(LANGUAGES)('%s has the same options as English', (lang) => {
    expect(keys(read(lang))).toEqual(keys(read('en')));
  });

  it.each(LANGUAGES)('%s writes the addresses and paths as they are', (lang) => {
    expect(literal(read(lang))).toEqual(literal(read('en')));
  });

  it('names every option the app offers', () => {
    const config = readFileSync(
      new URL('../homeassistant/kept/config.yaml', import.meta.url),
      'utf8',
    );
    const schema = config.slice(config.indexOf('\nschema:')).split('\n').slice(2);
    const end = schema.findIndex((line) => /^\S/.test(line));
    const options = schema
      .slice(0, end < 0 ? undefined : end)
      .filter((line) => /^ {2}\w+:/.test(line))
      .map((line) => (/^ {2}(\w+):/.exec(line) ?? [])[1]);
    const named = keys(read('en'));
    for (const option of options) expect(named, option).toContain(`${option}`);
  });
});
