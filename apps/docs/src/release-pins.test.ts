import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// The install docs download files from the release they were published with. The release pull
// request bumps the pins; a page it misses keeps sending people to an older release, in its
// language only (1.14.6 left most translated install pages on 1.14.5). The README's quick start
// is the same download.
const root = join(import.meta.dirname, '../../..');
const docs = join(import.meta.dirname, 'content/docs');

const released = (() => {
  const m = readFileSync(join(root, 'compose.yaml'), 'utf8').match(
    /ghcr\.io\/keptinventory\/kept:(\d+\.\d+\.\d+)\}/,
  );
  if (!m) throw new Error('compose.yaml names no default image');
  return m[1];
})();

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pages(path);
    return /\.mdx?$/.test(name) ? [path] : [];
  });
}

// Raw download URLs only: an image tag in prose can be history (upgrades: the image moved in 1.8.0).
const PIN = /keptinventory\/kept\/v(\d+\.\d+\.\d+)\//g;

/** `file: version` for each pin in `files` that isn't the release, and how many pins there are. */
function stalePins(files: string[]) {
  const stale: string[] = [];
  let pins = 0;
  for (const file of files) {
    for (const m of readFileSync(file, 'utf8').matchAll(PIN)) {
      pins++;
      const version = m[1];
      if (version !== released) stale.push(`${relative(root, file)}: ${version}`);
    }
  }
  return { stale, pins };
}

describe('release pins in the docs', () => {
  it('name the release compose.yaml runs, on every page in every language', () => {
    const { stale, pins } = stalePins(pages(docs));
    expect(pins).toBeGreaterThan(0);
    expect(stale).toEqual([]);
  });

  it('name the release compose.yaml runs in the README', () => {
    const { stale, pins } = stalePins([join(root, 'README.md')]);
    expect(pins).toBeGreaterThan(0);
    expect(stale).toEqual([]);
  });
});
