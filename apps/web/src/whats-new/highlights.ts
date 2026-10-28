/**
 * What's new in Kept: a release's Highlights, as CHANGELOG.md keeps them (scripts/changelog.mjs
 * writes `## X.Y.Z (date)` and its `### Highlights` bullets from .tmp/notes/highlights-X.Y.Z.md).
 * whats-new-plugin.ts reads them at build time, for the version being built only; the card
 * (components/whats-new.tsx) renders them as plain text with **bold**, no markdown library.
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
  const lines = changelog.split(/\r?\n/);
  const head = lines.findIndex((l) => l.startsWith(`## ${version} (`) || l === `## ${version}`);
  if (head < 0) return [];
  const out: string[] = [];
  let inHighlights = false;
  for (const line of lines.slice(head + 1)) {
    if (line.startsWith('## ')) break;
    if (line.startsWith('### ')) {
      if (inHighlights) break;
      inHighlights = line.trim() === '### Highlights';
      continue;
    }
    if (inHighlights && line.startsWith('- ')) out.push(plain(line.slice(2)));
  }
  return out.filter(Boolean);
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

export type BoldPart = { text: string; bold: boolean };

/** `**Graph view.** A graph` → the bold and plain runs, in order. */
export function boldParts(text: string): BoldPart[] {
  return text
    .split('**')
    .map((part, i) => ({ text: part, bold: i % 2 === 1 }))
    .filter((p) => p.text !== '');
}
