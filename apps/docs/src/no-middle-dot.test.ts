import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// No middle dot anywhere people read (#478): between links, after a name, between values. A comma,
// a colon or separate items instead.
const root = join(import.meta.dirname, '../../..');
const docs = join(import.meta.dirname, 'content/docs');
const MIDDLE_DOT = '·';

/** The files under `dir` whose names match `kind`. */
function files(dir: string, kind: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path, kind);
    return kind.test(name) ? [path] : [];
  });
}
const pages = (dir: string) => files(dir, /\.mdx?$/);

/** `file:line` for every line holding a middle dot. */
function dots(path: string): string[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .flatMap((line, i) => (line.includes(MIDDLE_DOT) ? [`${relative(root, path)}:${i + 1}`] : []));
}

describe('the middle dot', () => {
  it('is nowhere in the README', () => {
    expect(dots(join(root, 'README.md'))).toEqual([]);
  });

  it('is nowhere in the docs, in any language', () => {
    expect(pages(docs).length).toBeGreaterThan(0);
    expect(pages(docs).flatMap(dots)).toEqual([]);
  });

  it('is nowhere in the diagrams', () => {
    const diagrams = files(join(import.meta.dirname, 'assets'), /\.svg$/);
    expect(diagrams.length).toBeGreaterThan(0);
    expect(diagrams.flatMap(dots)).toEqual([]);
  });
});
