// @vitest-environment node
/**
 * What's new's pictures and clips (public/whats-new/<version>/) are fetched when the card opens,
 * never precached: a phone that installs Kept doesn't download a release's clips it may never open.
 * vite.config.ts leaves them out of Serwist's glob, and scripts/check-bundle.mjs fails a build that
 * precaches one anyway.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error: a plain .mjs script, without types
import { checkPrecache } from '../../scripts/check-bundle.mjs';

const web = fileURLToPath(new URL('../../', import.meta.url));

/** A built dist/ whose service worker precaches `urls` (and index.html). */
function dist(urls: string[]) {
  const dir = mkdtempSync(path.join(tmpdir(), 'kept-precache-'));
  const html = '<!doctype html><script type="module" src="/assets/index-a.js"></script>';
  writeFileSync(path.join(dir, 'index.html'), html);
  const md5 = createHash('md5').update(html).digest('hex');
  for (const u of urls) {
    mkdirSync(path.dirname(path.join(dir, u)), { recursive: true });
    writeFileSync(path.join(dir, u), 'x');
  }
  const manifest = [
    `{url:"index.html",revision:"${md5}"}`,
    ...urls.map((u) => `{url:"${u}",revision:null}`),
  ];
  writeFileSync(path.join(dir, 'sw.js'), `self.__SW_MANIFEST=[${manifest.join(',')}];`);
  return dir;
}

describe("What's new media and the precache", () => {
  it('fails a build that precaches a release’s picture or clip', () => {
    const dir = dist(['assets/index-a.js', 'whats-new/1.14.1/furniture.webp']);
    try {
      const { problems } = checkPrecache(dir);
      expect(problems).toEqual([
        "What's new media precached (loaded when the card opens): whats-new/1.14.1/furniture.webp",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('passes one without them', () => {
    const dir = dist(['assets/index-a.js']);
    try {
      expect(checkPrecache(dir).problems).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('is left out of the service worker’s glob', () => {
    const config = readFileSync(path.join(web, 'vite.config.ts'), 'utf8');
    const ignores = config.slice(config.indexOf('globIgnores:'));
    expect(ignores.slice(0, ignores.indexOf(']'))).toContain("'whats-new/**'");
  });
});
