/**
 * `virtual:kept-whats-new`: the version this build is (KEPT_VERSION, as vite.config.ts's `define`
 * inlines it) and that release's Highlights from CHANGELOG.md as slides, read once at build time:
 * each a bold title, one plain line (its lead and first sentence, highlights.ts `slideText`), the
 * app's area for its icon, and its picture or clip when the highlight names one.
 *
 * Only that one release goes into the bundle, a few hundred bytes, so the card's words work offline
 * and cost the precache next to nothing. Its media are files in public/whats-new/<version>/,
 * described by that folder's media.json (scripts/record-whats-new.mjs writes both): their size, so
 * nothing jumps as they load, a clip's poster and its WebM. They are served as plain files, fetched when the
 * card opens and never precached (vite.config.ts's globIgnores; scripts/check-bundle.mjs fails a
 * build that does). A media name with no file, or no entry in media.json, fails a release build
 * (`strict`); elsewhere it leaves its slide with the icon and a warning. A build ships only this
 * version's folder: closeBundle removes the others from its output.
 *
 * A development build (0.0.0-dev), a version without Highlights, or a checkout without a readable
 * changelog builds no slides, and the app shows no card.
 */
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  highlightEntries,
  isReleaseVersion,
  type Slide,
  type SlideMedia,
  slideText,
} from './src/whats-new/highlights';

const ID = 'virtual:kept-whats-new';
const RESOLVED = `\0${ID}`;
/** The folder of each version's media, in the repository and in the build's output. */
const FOLDER = 'whats-new';
const PUBLIC_MEDIA = fileURLToPath(new URL(`./public/${FOLDER}`, import.meta.url));

type MediaEntry = { width: number; height: number; poster?: string; webm?: string };

/** The version's media.json, or none. */
function mediaIndex(dir: string): Record<string, MediaEntry> {
  try {
    return JSON.parse(readFileSync(path.join(dir, 'media.json'), 'utf8'));
  } catch {
    return {};
  }
}

const sized = (e: MediaEntry | undefined): e is MediaEntry =>
  !!e && Number.isInteger(e.width) && e.width > 0 && Number.isInteger(e.height) && e.height > 0;

/**
 * A highlight's media, checked against the folder: null when it isn't there to show, with a
 * warning, or `missing` throws (a release build: a named file that isn't there is a mistake).
 */
function mediaOf(
  file: string,
  version: string,
  media: string,
  missing: (why: string) => void,
): SlideMedia | null {
  const dir = path.join(media, version);
  const entry = mediaIndex(dir)[file];
  const src = `${FOLDER}/${version}/${file}`;
  const here = (f: string) => existsSync(path.join(dir, f));
  if (!sized(entry) || !here(file)) {
    missing(`What's new ${version}: no ${file} in ${FOLDER}/${version} (or media.json)`);
    return null;
  }
  const { width, height } = entry;
  if (!file.endsWith('.mp4')) return { kind: 'image', src, width, height };
  if (!entry.poster || !here(entry.poster)) {
    missing(`What's new ${version}: ${file} has no poster`);
    return null;
  }
  const poster = `${FOLDER}/${version}/${entry.poster}`;
  const webm = entry.webm && here(entry.webm) ? { webm: `${FOLDER}/${version}/${entry.webm}` } : {};
  return { kind: 'video', src, ...webm, poster, width, height };
}

/** The slides, or none: a changelog that is missing or can't be read never fails a build. */
function slidesFrom(
  changelog: string,
  version: string,
  media: string,
  missing: (why: string) => void,
): Slide[] {
  if (!isReleaseVersion(version)) return [];
  let text: string;
  try {
    text = readFileSync(changelog, 'utf8');
  } catch {
    return [];
  }
  return highlightEntries(text, version).map(({ text: line, icon, file }) => ({
    ...slideText(line),
    icon,
    media: file ? mediaOf(file, version, media, missing) : null,
  }));
}

export function whatsNewPlugin({
  version,
  changelog,
  media = PUBLIC_MEDIA,
  strict = false,
}: {
  version: string;
  changelog: string;
  /** Where each version's media folder is (public/whats-new); tests pass their own. */
  media?: string;
  /**
   * A release build (vite.config.ts: not a demo): a highlight naming media its folder doesn't have
   * fails the build. The dev server, demos and tests keep the slide's words and its icon.
   */
  strict?: boolean;
}) {
  let outDir: string | null = null;
  let command: 'build' | 'serve' = 'serve';
  return {
    name: 'kept-whats-new',
    configResolved(config: {
      command: 'build' | 'serve';
      root: string;
      build: { outDir: string };
    }): void {
      command = config.command;
      outDir = path.resolve(config.root, config.build.outDir);
    },
    resolveId(id: string): string | null {
      return id === ID ? RESOLVED : null;
    },
    load(id: string): string | null {
      if (id !== RESOLVED) return null;
      const missing = (why: string) => {
        if (strict && command === 'build') throw new Error(why);
        console.warn(why);
      };
      const slides = slidesFrom(changelog, version, media, missing);
      return `export default ${JSON.stringify({ version, slides })};`;
    },
    /** The output keeps this version's media only (Vite copies every version's from public/). */
    closeBundle(): void {
      // Only a build has output of its own: the dev server and vitest leave dist/ alone.
      if (!outDir || command !== 'build') return;
      const built = path.join(outDir, FOLDER);
      if (!existsSync(built)) return;
      if (!isReleaseVersion(version)) {
        rmSync(built, { recursive: true, force: true });
        return;
      }
      for (const name of readdirSync(built)) {
        if (name !== version) rmSync(path.join(built, name), { recursive: true, force: true });
      }
    },
  };
}
