/**
 * `virtual:kept-whats-new`: the version this build is (KEPT_VERSION, as vite.config.ts's `define`
 * inlines it) and that release's Highlights from CHANGELOG.md, read once at build time, each cut to
 * its lead and first sentence (highlights.ts `cardLine`). Only that one release goes into the
 * bundle, a few hundred bytes, so the card works offline and costs the precache next to nothing.
 * A development build (0.0.0-dev), a version without Highlights, or a checkout without a readable
 * changelog builds an empty list, and the app shows no card.
 */
import { readFileSync } from 'node:fs';
import { cardLine, highlightsOf, isReleaseVersion } from './src/whats-new/highlights';

const ID = 'virtual:kept-whats-new';
const RESOLVED = `\0${ID}`;

/** The card's lines, or none: a changelog that is missing or can't be read never fails a build. */
function highlightsFrom(changelog: string, version: string): string[] {
  if (!isReleaseVersion(version)) return [];
  try {
    return highlightsOf(readFileSync(changelog, 'utf8'), version).map(cardLine);
  } catch {
    return [];
  }
}

export function whatsNewPlugin({ version, changelog }: { version: string; changelog: string }) {
  return {
    name: 'kept-whats-new',
    resolveId(id: string): string | null {
      return id === ID ? RESOLVED : null;
    },
    load(id: string): string | null {
      if (id !== RESOLVED) return null;
      return `export default ${JSON.stringify({ version, highlights: highlightsFrom(changelog, version) })};`;
    },
  };
}
