#!/usr/bin/env node
// The GitHub release's notes, from the version's CHANGELOG section (scripts/changelog.mjs) and the
// release record (scripts/release/notes.sh). release.yml runs it; the record itself is unchanged.
//
//   node scripts/release/compose-notes.mjs --version X.Y.Z --section <file> --record <file>
//        [--from <previous tag>] [--to <ref>] [--image <repo>] [--mirror <repo>|''] [--chart <oci ref>]
//        [--repo-url <url>] [--out <file>]
//
// The page, in order: Highlights; What's changed (the user-facing groups, then documentation and
// behind-the-scenes work folded away); Upgrade (the image on both registries, Compose, the chart,
// and whether the database changes: a migration .sql added or changed between --from and --to);
// Contributors; the full changelog link; and the whole release record, folded.

import { execFileSync } from 'node:child_process';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Section groups folded away under "Documentation and behind the scenes". */
export const FOLDED = ['Documentation', 'Behind the scenes'];
const MIGRATION = /^apps\/server\/migrations\/[^/]+\.sql$/;
/** A highlight's media line, as changelog.mjs writes it (or bare, as the highlights file has it). */
const WHATS_NEW_MEDIA = /^\s*(?:<!-- whats-new .*-->|!\[[^\]]*\]\([^)]*\))\s*$/;

/** A CHANGELOG section → { preamble, groups: [[title, text]] }, its "## X.Y.Z (date)" line dropped. */
export function parseSection(section) {
  const groups = [];
  const preamble = [];
  for (const line of section.replace(/\r\n/g, '\n').split('\n')) {
    if (/^## /.test(line)) continue;
    const h = /^### (.+)$/.exec(line);
    if (h) groups.push([h[1].trim(), []]);
    else if (groups.length) groups.at(-1)[1].push(line);
    else preamble.push(line);
  }
  return {
    preamble: preamble.join('\n').trim(),
    groups: groups.map(([title, lines]) => [title, lines.join('\n').trim()]),
  };
}

/** The release body as markdown. */
export function composeBody({
  version,
  previous,
  section,
  record,
  migrations,
  image,
  mirror,
  chart,
  repoUrl,
}) {
  const { preamble, groups } = parseSection(section);
  const take = (title) => groups.find(([t]) => t === title)?.[1];
  const out = [];
  const block = (...lines) => out.push(...lines, '');

  // A highlight's media for What's new in Kept (a `<!-- whats-new … -->` line, changelog.mjs) is
  // the app's, not the page's.
  const highlights = take('Highlights')
    ?.split('\n')
    .filter((l) => !WHATS_NEW_MEDIA.test(l))
    .join('\n');
  if (highlights) block('## Highlights', '', highlights);

  block("## What's changed");
  const open = groups.filter(([t]) => ![...FOLDED, 'Highlights', 'Contributors'].includes(t));
  if (open.length) for (const [t, text] of open) block(`### ${t}`, '', text);
  else block(preamble || 'No user-facing changes.');
  const folded = groups.filter(([t]) => FOLDED.includes(t));
  if (folded.length) {
    block('<details><summary>Documentation and behind the scenes</summary>');
    for (const [t, text] of folded) block(`### ${t}`, '', text);
    block('</details>');
  }

  const images = [image, mirror].filter(Boolean).map((r) => `\`${r}:${version}\``);
  block(
    '## Upgrade',
    '',
    `- **Image:** ${images.join(' or ')}`,
    `- **Docker Compose:** set \`KEPT_IMAGE\` in \`.env\` to the image, then \`docker compose pull && docker compose up -d\``,
    `- **Helm:** the chart \`${chart}\`, version \`${version}\``,
    migrations
      ? '- **Database changes:** yes (migrations run on start; with a backup target set, a snapshot is taken first).'
      : '- **Database changes:** none.',
  );

  const contributors = take('Contributors');
  if (contributors) block('## Contributors', '', contributors);

  if (previous) block(`**Full changelog**: ${repoUrl}/compare/${previous}...v${version}`);

  const recordBody = record.replace(/\r\n/g, '\n').split('\n').slice(1).join('\n').trim();
  block(
    '<details><summary>Image, chart and how to verify</summary>',
    '',
    recordBody,
    '',
    '</details>',
  );
  return `${out.join('\n').trimEnd()}\n`;
}

/** Whether a migration's .sql was added or changed between two refs. */
export function migrationsChanged(from, to, cwd = process.cwd()) {
  if (!from) return true;
  const out = execFileSync(
    'git',
    ['diff', '--name-only', `${from}`, `${to}`, '--', 'apps/server/migrations'],
    { cwd, encoding: 'utf8' },
  );
  return out.split('\n').some((f) => MIGRATION.test(f.trim()));
}

function args(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--') || i + 1 >= argv.length) throw new Error(`bad argument: ${k}`);
    opts[k.slice(2)] = argv[++i];
  }
  return opts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const opts = args(process.argv.slice(2));
    for (const k of ['version', 'section', 'record']) {
      if (!opts[k]) throw new Error(`--${k} is required`);
    }
    // The defaults are release.sh's DEFAULT_REGISTRY, its chart repository beside it, and
    // mirror-dockerhub.sh's destination.
    const image = opts.image ?? 'ghcr.io/keptinventory/kept';
    const body = composeBody({
      version: opts.version,
      previous: opts.from ?? '',
      section: readFileSync(opts.section, 'utf8'),
      record: readFileSync(opts.record, 'utf8'),
      migrations: migrationsChanged(opts.from, opts.to ?? 'HEAD'),
      image,
      mirror: opts.mirror ?? 'docker.io/keptinventory/kept',
      chart: opts.chart ?? `oci://${image.slice(0, image.lastIndexOf('/'))}/charts/kept`,
      repoUrl: opts['repo-url'] ?? 'https://github.com/keptinventory/kept',
    });
    if (opts.out) {
      const tmp = `${opts.out}.tmp-${process.pid}`;
      writeFileSync(tmp, body);
      renameSync(tmp, opts.out);
    } else {
      process.stdout.write(body);
    }
  } catch (err) {
    console.error(`compose-notes: ${err.message}`);
    process.exit(1);
  }
}
