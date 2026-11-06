/**
 * Words a catalogue got wrong once, read from the catalogues themselves: the layout switch's
 * "Table" is no piece of furniture, and Spanish says one word for a passkey.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const catalogue = (locale: string) =>
  readFileSync(path.join(import.meta.dirname, `../locales/${locale}/messages.po`), 'utf8');

/** Each message's translation, by its source. */
const entries = (locale: string) =>
  new Map(
    [...catalogue(locale).matchAll(/^msgid "(.*)"\nmsgstr "(.*)"$/gm)].map(
      (m) => [m[1] as string, m[2] as string] as const,
    ),
  );

describe('the catalogues', () => {
  it.each([
    ['es', 'Tabla', 'Enlace del manual'],
    ['uk', 'Таблиця', 'Посилання на інструкцію'],
    ['vi', 'Bảng', 'Liên kết sách hướng dẫn'],
  ])('%s writes the layout and the manual link for what they are', (locale, table, manual) => {
    const words = entries(locale);
    expect(words.get('Table')).toBe(table);
    expect(words.get('Manual link')).toBe(manual);
  });

  it('keep Ukrainian Capture apart from Scan', () => {
    const uk = entries('uk');
    expect(uk.get('Capture')).toBe('Додавання');
    for (const [id, text] of uk)
      if (/^Captur/.test(id)) expect(text.toLowerCase(), id).not.toContain('скан');
  });

  it('say llave de acceso for a passkey in Spanish, every time', () => {
    for (const [id, text] of entries('es')) {
      expect(text.toLowerCase(), id).not.toContain('passkey');
      if (/passkey/i.test(id)) expect(text.toLowerCase(), id).toContain('llave');
    }
    // An S3 access key is something else, and keeps its word.
    expect(entries('es').get('Secret access key')).toBe('Clave de acceso secreta');
  });

  it('call Kept and its sections by name in Spanish', () => {
    const es = entries('es');
    expect(es.get('Settings')).toBe('Configuración');
    expect(es.get('Allow private addresses in Admin → Settings')).toContain(
      'Admin → Configuración',
    );
    expect(es.get('Also in Paperwork')).toBe(`También en ${es.get('Paperwork')}`);
    expect(es.get('{cell} roll')).toBe('Rollo {cell}');
    expect(es.get('Graph')).toBe('Grafo');
    expect(es.get('Borrowed in')).not.toBe('Prestado en');
    expect(es.get('{0, plural, one {Kept # file} other {Kept # files}}')).not.toContain('Kept');
  });
});
