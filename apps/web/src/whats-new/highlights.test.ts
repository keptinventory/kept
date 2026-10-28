// @vitest-environment node
/**
 * What's new in Kept, at build time: a release's Highlights bullets from CHANGELOG.md (written by
 * scripts/changelog.mjs from .tmp/notes/highlights-X.Y.Z.md), for the version the app is built
 * as, through the `virtual:kept-whats-new` module (whats-new-plugin.ts). Bullets only, as plain
 * text with **bold** kept; links and code marks become their words.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { whatsNewPlugin } from '../../whats-new-plugin';
import {
  cardLine,
  highlightEntries,
  highlightsOf,
  isReleaseVersion,
  mediaLine,
  releaseNotesUrl,
  slideText,
} from './highlights';

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

/** The virtual module's code → its value. */
const releaseOf = (code: unknown) =>
  JSON.parse(
    String(code)
      .replace(/^export default /, '')
      .replace(/;\s*$/, ''),
  );

const loadOf = async (plugin: ReturnType<typeof whatsNewPlugin>) =>
  releaseOf(await plugin.load(String(plugin.resolveId('virtual:kept-whats-new'))));

describe('media lines', () => {
  it('reads `![icon](file)`, bare or in the changelog’s comment', () => {
    expect(mediaLine('  ![places](furniture.mp4)')).toEqual({
      icon: 'places',
      file: 'furniture.mp4',
    });
    expect(mediaLine('  <!-- whats-new ![](homebox.webp) -->')).toEqual({
      icon: null,
      file: 'homebox.webp',
    });
    expect(mediaLine('- **A bullet.** with ![x](y.webp) inside')).toBeNull();
    expect(mediaLine('![](../escape.webp)')).toBeNull();
    expect(mediaLine('![](clip.gif)')).toBeNull();
  });

  it('gives each highlight the media named under it, and none when nothing is', () => {
    const changelog = `## 3.0.0 (2026-12-01)

### Highlights

- **Shelves.** A shelf has a code now (#12).
  <!-- whats-new ![places](shelves.mp4) -->
- **Paperwork.** Linked documents sit with your files.
  ![paperwork](paperwork.webp)
- **Small fixes.** Two of them.

### Other

- x (abc1234)
`;
    expect(highlightEntries(changelog, '3.0.0')).toEqual([
      { text: '**Shelves.** A shelf has a code now (#12).', icon: 'places', file: 'shelves.mp4' },
      {
        text: '**Paperwork.** Linked documents sit with your files.',
        icon: 'paperwork',
        file: 'paperwork.webp',
      },
      { text: '**Small fixes.** Two of them.', icon: null, file: null },
    ]);
    // The old reader still sees the bullets alone.
    expect(highlightsOf(changelog, '3.0.0')).toHaveLength(3);
  });

  it('makes a slide’s bold title and its one plain line', () => {
    expect(
      slideText('**Furniture with compartments.** A bookcase in one step. With Undo (#238).'),
    ).toEqual({ title: 'Furniture with compartments', line: 'A bookcase in one step.' });
    expect(slideText('No lead here. Second.')).toEqual({ title: 'No lead here.', line: '' });
  });
});

describe('the virtual module', () => {
  /** A changelog and a public/whats-new folder for 3.0.0, in a scratch directory. */
  function fixture() {
    const dir = mkdtempSync(path.join(tmpdir(), 'kept-whats-new-'));
    const changelog = path.join(dir, 'CHANGELOG.md');
    writeFileSync(
      changelog,
      `# Changelog

## 3.0.0 (2026-12-01)

### Highlights

- **Shelves.** A shelf has a code now (#12). More words.
  <!-- whats-new ![places](shelves.mp4) -->
- **Paperwork.** Linked documents sit with your files.
  <!-- whats-new ![paperwork](paperwork.webp) -->
- **Gone.** Its clip was never recorded.
  <!-- whats-new ![](missing.mp4) -->
- **Small fixes.** Two of them.

## 2.9.0 (2026-11-01)

### Highlights

- **Older.** Not this one.
`,
    );
    const media = path.join(dir, 'whats-new');
    mkdirSync(path.join(media, '3.0.0'), { recursive: true });
    mkdirSync(path.join(media, '2.9.0'), { recursive: true });
    for (const f of ['shelves.mp4', 'shelves.webm', 'shelves.webp', 'paperwork.webp'])
      writeFileSync(path.join(media, '3.0.0', f), 'x');
    writeFileSync(path.join(media, '2.9.0', 'older.webp'), 'x');
    writeFileSync(
      path.join(media, '3.0.0', 'media.json'),
      JSON.stringify({
        'shelves.mp4': { width: 960, height: 600, poster: 'shelves.webp', webm: 'shelves.webm' },
        'paperwork.webp': { width: 960, height: 600 },
        'missing.mp4': { width: 960, height: 600, poster: 'missing.webp' },
      }),
    );
    return { dir, changelog, media };
  }

  it('holds only the built version’s slides: title, line, icon and its media', async () => {
    const { dir, changelog, media } = fixture();
    try {
      const release = await loadOf(whatsNewPlugin({ version: '3.0.0', changelog, media }));
      expect(release).toEqual({
        version: '3.0.0',
        slides: [
          {
            title: 'Shelves',
            line: 'A shelf has a code now.',
            icon: 'places',
            media: {
              kind: 'video',
              src: 'whats-new/3.0.0/shelves.mp4',
              webm: 'whats-new/3.0.0/shelves.webm',
              poster: 'whats-new/3.0.0/shelves.webp',
              width: 960,
              height: 600,
            },
          },
          {
            title: 'Paperwork',
            line: 'Linked documents sit with your files.',
            icon: 'paperwork',
            media: {
              kind: 'image',
              src: 'whats-new/3.0.0/paperwork.webp',
              width: 960,
              height: 600,
            },
          },
          // Named, but no file in the folder: the slide keeps its words and shows its icon.
          { title: 'Gone', line: 'Its clip was never recorded.', icon: null, media: null },
          { title: 'Small fixes', line: 'Two of them.', icon: null, media: null },
        ],
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('ships only this version’s media folder in the build', async () => {
    const { dir, changelog, media } = fixture();
    const out = path.join(dir, 'dist');
    try {
      mkdirSync(path.join(out, 'whats-new', '3.0.0'), { recursive: true });
      mkdirSync(path.join(out, 'whats-new', '2.9.0'), { recursive: true });
      const plugin = whatsNewPlugin({ version: '3.0.0', changelog, media });
      plugin.configResolved({ root: dir, build: { outDir: 'dist' } });
      plugin.closeBundle();
      expect(existsSync(path.join(out, 'whats-new', '3.0.0'))).toBe(true);
      expect(existsSync(path.join(out, 'whats-new', '2.9.0'))).toBe(false);
      // A development build ships none.
      const dev = whatsNewPlugin({ version: '0.0.0-dev', changelog, media });
      dev.configResolved({ root: dir, build: { outDir: 'dist' } });
      dev.closeBundle();
      expect(existsSync(path.join(out, 'whats-new'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reads the real CHANGELOG.md: 1.14.1’s seven slides, each with its media', async () => {
    const release = await loadOf(whatsNewPlugin({ version: '1.14.1', changelog: CHANGELOG }));
    expect(release.version).toBe('1.14.1');
    expect(release.slides).toHaveLength(7);
    expect(release.slides[0].title).toBe('Furniture with compartments');
    for (const slide of release.slides) {
      expect(slide.media, slide.title).not.toBeNull();
      expect(slide.media.width).toBeGreaterThan(0);
    }
    // Nothing of other releases rides along.
    expect(JSON.stringify(release)).not.toContain('Graph view');
  });

  it('builds a changelog it can’t read with no slides, never a failed build', async () => {
    // A directory where the file should be: it exists, but reading it throws (EISDIR).
    const dir = mkdtempSync(path.join(tmpdir(), 'kept-whats-new-'));
    try {
      expect(await loadOf(whatsNewPlugin({ version: '1.14.0', changelog: dir }))).toEqual({
        version: '1.14.0',
        slides: [],
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('builds a development version with no slides, and a missing changelog with none', async () => {
    expect(await loadOf(whatsNewPlugin({ version: '0.0.0-dev', changelog: CHANGELOG }))).toEqual({
      version: '0.0.0-dev',
      slides: [],
    });
    const none = whatsNewPlugin({ version: '1.14.0', changelog: '/nowhere/CHANGELOG.md' });
    expect((await loadOf(none)).slides).toEqual([]);
    expect(none.resolveId('something-else')).toBeNull();
  });
});

describe('helpers', () => {
  it('knows a release version and its notes on GitHub (tags are vX.Y.Z)', () => {
    expect(isReleaseVersion('1.14.1')).toBe(true);
    expect(isReleaseVersion('0.0.0-dev')).toBe(false);
    expect(isReleaseVersion('1.14')).toBe(false);
    expect(releaseNotesUrl('1.14.1')).toBe(
      'https://github.com/keptinventory/kept/releases/tag/v1.14.1',
    );
  });
});
