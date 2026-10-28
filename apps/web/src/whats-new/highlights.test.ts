// @vitest-environment node
/**
 * What's new in Kept, at build time: a release's Highlights bullets from CHANGELOG.md (written by
 * scripts/changelog.mjs from .tmp/notes/highlights-X.Y.Z.md), for the version the app is built
 * as, through the `virtual:kept-whats-new` module (whats-new-plugin.ts). Bullets only, as plain
 * text with **bold** kept; links and code marks become their words.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { whatsNewPlugin } from '../../whats-new-plugin';
import { boldParts, cardLine, highlightsOf, isReleaseVersion, releaseNotesUrl } from './highlights';

const CHANGELOG = fileURLToPath(new URL('../../../../CHANGELOG.md', import.meta.url));

const SAMPLE = `# Changelog

## 2.1.0 (2026-11-02)

### Highlights

- **Shelves.** A [shelf](https://example.org/x) has a \`code\` now (#12).
- **Small fixes.** Two of them.

Some words between that are not a bullet.

### Other

- Not a highlight (#13) (abc1234)

## 2.0.9 (2026-11-01)

### Other

- No highlights in this one (#11) (def5678)

## 2.0.8 (2026-10-30)

### Highlights

- **Older.** Not 2.1.0's.
`;

describe('highlightsOf', () => {
  it('takes the version’s Highlights bullets, plain text with bold kept', () => {
    expect(highlightsOf(SAMPLE, '2.1.0')).toEqual([
      '**Shelves.** A shelf has a code now (#12).',
      '**Small fixes.** Two of them.',
    ]);
    expect(highlightsOf(SAMPLE, '2.0.8')).toEqual(["**Older.** Not 2.1.0's."]);
  });

  it('has none for a version without Highlights, or one not in the changelog', () => {
    expect(highlightsOf(SAMPLE, '2.0.9')).toEqual([]);
    expect(highlightsOf(SAMPLE, '9.9.9')).toEqual([]);
    expect(highlightsOf(SAMPLE, '0.0.0-dev')).toEqual([]);
    // "2.1" is not "2.1.0".
    expect(highlightsOf(SAMPLE, '2.1')).toEqual([]);
  });

  it('reads the real CHANGELOG.md: 1.14.0’s seven, 1.13.0’s bullets but not its table', () => {
    const changelog = readFileSync(CHANGELOG, 'utf8');
    const v14 = highlightsOf(changelog, '1.14.0');
    expect(v14).toHaveLength(7);
    expect(v14[0]).toMatch(/^\*\*Graph view\.\*\* /);
    const v13 = highlightsOf(changelog, '1.13.0');
    expect(v13.length).toBeGreaterThan(0);
    for (const line of v13) expect(line).not.toMatch(/^\||\|$/);
  });
});

describe('cardLine', () => {
  it('keeps a highlight to its lead and first sentence, without issue numbers', () => {
    expect(
      cardLine(
        "**Graph view.** A location's floors as a graph, in 2D or 3D. Pick a node for its card (#207).",
      ),
    ).toBe("**Graph view.** A location's floors as a graph, in 2D or 3D.");
    expect(cardLine('**Move a room.** Drag it, and it moves (#301, #330).')).toBe(
      '**Move a room.** Drag it, and it moves.',
    );
    // A version number or "e.g." is not the end of a sentence.
    expect(cardLine('**Security.** better-auth 1.7.13 fixes it. Update soon.')).toBe(
      '**Security.** better-auth 1.7.13 fixes it.',
    );
    expect(cardLine('No lead. Second sentence.')).toBe('No lead.');
  });
});

describe('the virtual module', () => {
  it('holds only the built version and its highlights', async () => {
    const plugin = whatsNewPlugin({ version: '1.14.0', changelog: CHANGELOG });
    const id = await plugin.resolveId('virtual:kept-whats-new');
    expect(id).toBeTruthy();
    const code = String(await plugin.load(String(id)));
    const release = JSON.parse(code.replace(/^export default /, '').replace(/;\s*$/, ''));
    expect(release.version).toBe('1.14.0');
    expect(release.highlights).toHaveLength(7);
    // The card's short lines: each its lead and first sentence.
    expect(release.highlights[0]).toMatch(/^\*\*Graph view\.\*\* [^.]+\.$/);
    // Nothing of other releases rides along.
    expect(code).not.toContain('1.13.1');
    expect(plugin.resolveId('something-else')).toBeNull();
  });

  it('builds a changelog it can’t read with no highlights, never a failed build', async () => {
    // A directory where the file should be: it exists, but reading it throws (EISDIR).
    const dir = mkdtempSync(path.join(tmpdir(), 'kept-whats-new-'));
    try {
      const plugin = whatsNewPlugin({ version: '1.14.0', changelog: dir });
      expect(String(await plugin.load(String(plugin.resolveId('virtual:kept-whats-new'))))).toBe(
        'export default {"version":"1.14.0","highlights":[]};',
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('builds a development version with no highlights, and a missing changelog with none', async () => {
    const dev = whatsNewPlugin({ version: '0.0.0-dev', changelog: CHANGELOG });
    expect(String(await dev.load(String(dev.resolveId('virtual:kept-whats-new'))))).toBe(
      'export default {"version":"0.0.0-dev","highlights":[]};',
    );
    const none = whatsNewPlugin({ version: '1.14.0', changelog: '/nowhere/CHANGELOG.md' });
    expect(String(await none.load(String(none.resolveId('virtual:kept-whats-new'))))).toContain(
      '"highlights":[]',
    );
  });
});

describe('helpers', () => {
  it('splits bold from plain', () => {
    expect(boldParts('**Graph view.** A graph, **fast**.')).toEqual([
      { text: 'Graph view.', bold: true },
      { text: ' A graph, ', bold: false },
      { text: 'fast', bold: true },
      { text: '.', bold: false },
    ]);
    expect(boldParts('No bold')).toEqual([{ text: 'No bold', bold: false }]);
  });

  it('knows a release version and its notes on GitHub (tags are vX.Y.Z)', () => {
    expect(isReleaseVersion('1.14.1')).toBe(true);
    expect(isReleaseVersion('0.0.0-dev')).toBe(false);
    expect(isReleaseVersion('1.14')).toBe(false);
    expect(releaseNotesUrl('1.14.1')).toBe(
      'https://github.com/keptinventory/kept/releases/tag/v1.14.1',
    );
  });
});
