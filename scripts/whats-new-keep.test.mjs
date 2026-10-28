/**
 * The release flow keeps one release's What's new media in the tree: adding X.Y.Z's removes the
 * folders (and recipes) of the versions before it, so a shallow clone doesn't carry every
 * release's clips. Git history keeps them.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { keepOnly } from './whats-new-keep.mjs';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'whats-new-keep.mjs');

function tree() {
  const dir = mkdtempSync(path.join(tmpdir(), 'kept-keep-'));
  const media = path.join(dir, 'apps/web/public/whats-new');
  const recipes = path.join(dir, 'scripts/whats-new');
  for (const v of ['1.14.3', '1.14.4']) {
    mkdirSync(path.join(media, v), { recursive: true });
    writeFileSync(path.join(media, v, 'a.webp'), 'x');
  }
  mkdirSync(recipes, { recursive: true });
  for (const f of ['1.14.3.json', '1.14.4.json', 'README.md'])
    writeFileSync(path.join(recipes, f), 'x');
  return { dir, media, recipes };
}

describe('keepOnly', () => {
  it('keeps this version’s media and recipe, and removes the earlier ones', () => {
    const { dir, media, recipes } = tree();
    try {
      expect(keepOnly(dir, '1.14.4')).toEqual([
        'apps/web/public/whats-new/1.14.3',
        'scripts/whats-new/1.14.3.json',
      ]);
      expect(existsSync(path.join(media, '1.14.4', 'a.webp'))).toBe(true);
      expect(existsSync(path.join(media, '1.14.3'))).toBe(false);
      expect(existsSync(path.join(recipes, '1.14.4.json'))).toBe(true);
      expect(existsSync(path.join(recipes, '1.14.3.json'))).toBe(false);
      // The format's README stays.
      expect(existsSync(path.join(recipes, 'README.md'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refuses to remove anything when this version has no media folder', () => {
    const { dir, media } = tree();
    try {
      expect(() => keepOnly(dir, '1.14.5')).toThrow(/no apps\/web\/public\/whats-new\/1\.14\.5/);
      expect(existsSync(path.join(media, '1.14.3'))).toBe(true);
      expect(() => keepOnly(dir, '1.14')).toThrow(/X\.Y\.Z/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('runs from the command line in the repository it is given', () => {
    const { dir, media } = tree();
    try {
      const r = spawnSync('node', [script, '--version', '1.14.4', '--root', dir], {
        encoding: 'utf8',
      });
      expect(r.status, r.stderr).toBe(0);
      expect(r.stdout).toContain('removed apps/web/public/whats-new/1.14.3');
      expect(existsSync(path.join(media, '1.14.3'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
