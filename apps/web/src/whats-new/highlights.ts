/**
 * What's new in Kept: a release's Highlights, as CHANGELOG.md keeps them (scripts/changelog.mjs
 * writes `## X.Y.Z (date)` and its `### Highlights` bullets from .tmp/notes/highlights-X.Y.Z.md).
 * whats-new-plugin.ts reads them at build time, for the version being built only; the card
 * (components/whats-new.tsx) shows each as a slide: its media, a bold title and one plain line.
 *
 * A bullet's media is the line under it, `![icon](file)`, which the changelog keeps in a comment
 * (`<!-- whats-new ![icon](file) -->`) so GitHub shows no broken image. `file` is in
 * public/whats-new/X.Y.Z/ (scripts/record-whats-new.mjs); `icon` names the app's area, drawn when
 * there is no media or it can't load.
 */

/** A release's version (`1.14.1`): a development build (`0.0.0-dev`) has no card. */
export function isReleaseVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(version);
}

/** The release's full notes on GitHub; its tags are `vX.Y.Z` (scripts/release-notes.test.mjs). */
export function releaseNotesUrl(version: string): string {
  return `https://github.com/keptinventory/kept/releases/tag/v${version}`;
}

/** A bullet's markdown as plain text: links and code marks become their words; bold stays. */
function plain(line: string): string {
  return line
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

/**
 * The `- ` bullets under `### Highlights` in `version`'s section, as plain text with **bold**.
 * None when the version has no section or no Highlights. A paragraph or a table between them
 * (1.13.0's) is left out: the card is a short list.
 */
export function highlightsOf(changelog: string, version: string): string[] {
  return highlightEntries(changelog, version).map((e) => e.text);
}

/** A slide's media as the plugin passes it: paths under the app's base, and its size. */
export type SlideMedia =
  | {
      kind: 'video';
      /** The MP4 (H.264); `webm` is the same clip as VP9, offered first when there is one. */
      src: string;
      webm?: string;
      poster: string;
      width: number;
      height: number;
    }
  | { kind: 'image'; src: string; width: number; height: number };
/** One highlight as a slide (whats-new-plugin.ts builds them; components/whats-new.tsx shows them). */
export type Slide = { title: string; line: string; icon: string | null; media: SlideMedia | null };

/** A media name: a .webp picture or an .mp4 clip in the version's folder, nothing else. */
const MEDIA_NAME = /^[a-z0-9][a-z0-9-]*\.(?:webp|mp4)$/;
const MEDIA_LINE = /^\s*(?:<!-- whats-new\s+)?!\[([a-z-]*)\]\(([^)]*)\)\s*(?:-->)?\s*$/;

export type MediaRef = { icon: string | null; file: string };

/** `![icon](file)` (bare, or in the changelog's comment) → its icon and file; null otherwise. */
export function mediaLine(line: string): MediaRef | null {
  const m = MEDIA_LINE.exec(line);
  if (!m?.[2] || !MEDIA_NAME.test(m[2])) return null;
  return { icon: m[1] || null, file: m[2] };
}

export type HighlightEntry = { text: string; icon: string | null; file: string | null };

/** The version's highlights (as `highlightsOf`), each with the media named under it, if any. */
export function highlightEntries(changelog: string, version: string): HighlightEntry[] {
  const lines = changelog.split(/\r?\n/);
  const head = lines.findIndex((l) => l.startsWith(`## ${version} (`) || l === `## ${version}`);
  if (head < 0) return [];
  const out: HighlightEntry[] = [];
  let inHighlights = false;
  for (const line of lines.slice(head + 1)) {
    if (line.startsWith('## ')) break;
    if (line.startsWith('### ')) {
      if (inHighlights) break;
      inHighlights = line.trim() === '### Highlights';
      continue;
    }
    if (!inHighlights) continue;
    if (line.startsWith('- ')) {
      out.push({ text: plain(line.slice(2)), icon: null, file: null });
      continue;
    }
    const media = mediaLine(line);
    const last = out.at(-1);
    if (media && last && !last.file) Object.assign(last, media);
  }
  return out.filter((e) => e.text);
}

/**
 * A highlight as a slide: its bold lead as the title (no closing full stop) and the first
 * sentence after it as the line. A highlight without a lead is its first sentence alone.
 */
export function slideText(text: string): { title: string; line: string } {
  const short = cardLine(text);
  const lead = /^\*\*([^*]+)\*\*/.exec(short);
  if (!lead?.[1]) return { title: short.replaceAll('**', ''), line: '' };
  return {
    title: lead[1].trim().replace(/[.:]$/, ''),
    line: short.slice(lead[0].length).replaceAll('**', '').trim(),
  };
}

/**
 * A highlight as the card shows it: its bold lead and the first sentence after it, without issue
 * numbers ("(#301, #330)"). The card stays small; the full notes are a link away.
 */
export function cardLine(line: string): string {
  const text = line.replace(/\s*\(#\d+(?:,\s*#\d+)*\)/g, '');
  const lead = /^\*\*[^*]+\*\*/.exec(text)?.[0] ?? '';
  const rest = text.slice(lead.length);
  // A sentence ends at a full stop or question mark before a capital or the end: "1.7.13" and
  // "e.g. the" go on.
  const end = /[.?](?=\s+[A-Z]|\s*$)/.exec(rest);
  return `${lead}${end ? rest.slice(0, end.index + 1) : rest}`.trim();
}
