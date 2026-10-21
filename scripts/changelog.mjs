#!/usr/bin/env node
// CHANGELOG.md from conventional commits: the release pull request's changelog section, which
// becomes the top of the GitHub release's notes (scripts/release/compose-notes.mjs).
//
//   node scripts/changelog.mjs --version X.Y.Z [--from <ref>] [--to <ref>] [--date YYYY-MM-DD]
//                              [--highlights <file>] [--repo <owner/name>] [--write <CHANGELOG.md>]
//
// Commits in <from>..<to> (all of <to> without --from) are grouped: breaking changes (`type!:` or a
// `BREAKING CHANGE:` footer), features, fixes, performance, translations, "Other" for a subject
// that isn't conventional, documentation, and "Behind the scenes" for features, fixes and
// performance work on an internal scope (INTERNAL_SCOPES). Tests, chores, CI, builds, style,
// refactors and spikes are left out: they change nothing a person running Kept sees.
//
// --highlights puts a hand-written file of bullets at the top of the section, under Highlights.
// Without it there is no Highlights section: nothing is ever written for you.
//
// GitHub is asked (`gh api graphql`, read-only) who wrote each pull request and which issues it
// closed, by whom: "closes #N, reported by @x" goes on the change's line, and a Contributors line
// lists every author and reporter. If gh is missing or fails, both are left out with a warning
// and the section is still written. KEPT_CHANGELOG_GH names another gh binary.
//
// Without --write the section is printed; with it, the section goes in above the newest one, or
// replaces this version's section when the file has one (the file is made if missing).

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const CONVENTIONAL = /^(?<type>[a-z][a-z0-9]*)(?:\((?<scope>[^)]*)\))?(?<bang>!)?: (?<subject>.+)$/;
const PR_SUFFIX = /\s\(#(\d+)\)$/;

export const REPO = 'keptinventory/kept';

export const GROUPS = [
  ['breaking', 'Breaking changes'],
  ['feat', 'Features'],
  ['fix', 'Fixes'],
  ['perf', 'Performance'],
  ['i18n', 'Translations'],
  ['other', 'Other'],
  ['docs', 'Documentation'],
  ['internal', 'Behind the scenes'],
];

/** Conventional types that never reach the changelog. */
export const HIDDEN = new Set([
  'test',
  'chore',
  'ci',
  'build',
  'style',
  'refactor',
  'spike',
  'wip',
]);

/** Scopes nobody running Kept sees: a feature, fix or performance change on one goes behind the scenes. */
export const INTERNAL_SCOPES = ['e2e', 'test', 'ci', 'release', 'build', 'deps-dev'];
const INTERNAL_TYPES = new Set(['feat', 'fix', 'perf']);

export const HEADER = `# Changelog

Kept's releases, newest first. Written by \`scripts/changelog.mjs\` from the commits' conventional
subjects when a release is cut (\`scripts/release.sh\`).
`;

const isInternal = (scope) =>
  Boolean(scope) &&
  scope
    .split(',')
    .map((s) => s.trim())
    .every((s) => INTERNAL_SCOPES.includes(s));

/** One commit → { group, scope, subject, hash, pr }, or null when it is left out. */
export function classify({ hash, subject, body = '' }) {
  const whole = subject.trim();
  const pr = PR_SUFFIX.exec(whole)?.[1];
  const base = { hash, pr: pr ? Number(pr) : null };
  const m = CONVENTIONAL.exec(whole);
  if (!m) return { ...base, group: 'other', scope: null, subject: whole };
  const { type, scope, bang } = m.groups;
  const breaking = Boolean(bang) || /^BREAKING[ -]CHANGE: /m.test(body);
  if (breaking) {
    return { ...base, group: 'breaking', scope: scope || null, subject: m.groups.subject };
  }
  if (HIDDEN.has(type)) return null;
  let group = GROUPS.some(([g]) => g === type) ? type : 'other';
  if (INTERNAL_TYPES.has(type) && isInternal(scope)) group = 'internal';
  return {
    ...base,
    group,
    scope: scope || null,
    subject: group === 'other' ? whole : m.groups.subject,
  };
}

/** A highlights file's text, checked: bullets only (continuation lines allowed), no headings. */
export function parseHighlights(text) {
  const body = text.replace(/\r\n/g, '\n').trim();
  if (/^#/m.test(body)) throw new Error('the highlights file has a heading: bullets only');
  if (!/^- \S/m.test(body)) throw new Error('the highlights file has no bullets ("- ...")');
  return body;
}

const isBot = (author) =>
  !author || author.bot || author.login.endsWith('[bot]') || author.login === 'github-actions';

/** "a", "a and b", "a, b and c". */
const and = (items) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

/**
 * What GitHub knows about the release's pull requests: { pulls, contributors }, or null when no
 * commit names a pull request or GitHub can't be asked (then `warn` says why). `contributors` is
 * every author of a pull request and of an issue one closed, no bots, sorted, each once.
 */
export async function gatherGitHub(commits, fetcher, warn = (m) => console.error(m)) {
  const numbers = [
    ...new Set(
      commits
        .map((c) => PR_SUFFIX.exec(c.subject.trim())?.[1])
        .filter(Boolean)
        .map(Number),
    ),
  ].sort((a, b) => a - b);
  if (!numbers.length) return null;
  try {
    const pulls = await fetcher.pulls(numbers);
    const people = new Set();
    for (const { author, closes } of pulls.values()) {
      for (const who of [author, ...closes.map((i) => i.author)]) {
        if (!isBot(who)) people.add(who.login);
      }
    }
    const contributors = [...people].sort((a, b) =>
      a.localeCompare(b, 'en', { sensitivity: 'base' }),
    );
    return { pulls, contributors };
  } catch (err) {
    warn(`changelog: closed issues and contributors left out (GitHub: ${err.message})`);
    return null;
  }
}

/** "(#239)" → "(#239, closes #226, reported by @x)" from what GitHub said about #239. */
function withClosures(subject, pr, github) {
  const info = pr && github?.pulls.get(pr);
  if (!info?.closes?.length) return subject;
  const closes = `closes ${info.closes.map((i) => `#${i.number}`).join(', ')}`;
  const reporters = [];
  for (const { author } of info.closes) {
    if (isBot(author) || author.login === info.author?.login) continue;
    if (!reporters.includes(`@${author.login}`)) reporters.push(`@${author.login}`);
  }
  const reported = reporters.length ? `, reported by ${and(reporters)}` : '';
  return subject.replace(PR_SUFFIX, ` (#${pr}, ${closes}${reported})`);
}

/**
 * The markdown section for one release. Commits are given newest first, as git log prints them.
 * `highlights` is parseHighlights' text; `github` is gatherGitHub's result.
 */
export function renderSection(version, date, commits, { highlights, github } = {}) {
  const entries = commits.map(classify).filter(Boolean);
  const lines = [`## ${version} (${date})`, ''];
  if (highlights) lines.push('### Highlights', '', highlights, '');
  if (!entries.length) lines.push('No user-facing changes.', '');
  for (const [group, title] of GROUPS) {
    const items = entries.filter((e) => e.group === group);
    if (!items.length) continue;
    lines.push(`### ${title}`, '');
    for (const e of items) {
      const subject = withClosures(e.subject, e.pr, github);
      lines.push(`- ${e.scope ? `**${e.scope}:** ` : ''}${subject} (${e.hash.slice(0, 7)})`);
    }
    lines.push('');
  }
  if (github?.contributors.length) {
    // GitHub draws the release page's contributor avatars from these mentions.
    lines.push('### Contributors', '', github.contributors.map((l) => `@${l}`).join(' · '), '');
  }
  return lines.join('\n');
}

/** `existing` with `section` above its newest release, or in place of the same version's. */
export function insertSection(existing, section) {
  const text = existing?.trim() ? existing : HEADER;
  const heading = section.slice(0, section.indexOf('(') + 1);
  const lines = text.split('\n');
  const own = lines.findIndex((l) => l.startsWith(heading));
  if (own !== -1) {
    let end = lines.findIndex((l, i) => i > own && l.startsWith('## '));
    if (end === -1) end = lines.length;
    const before = lines.slice(0, own).join('\n');
    const after = lines.slice(end).join('\n');
    return `${before}\n${section.trimEnd()}\n${after ? `\n${after}` : ''}`;
  }
  const at = text.search(/^## /m);
  const head = at === -1 ? `${text.trimEnd()}\n\n` : text.slice(0, at);
  const rest = at === -1 ? '' : text.slice(at);
  return `${head}${section.trimEnd()}\n${rest ? `\n${rest}` : ''}`;
}

/** Commits in the range, newest first. */
export function readCommits(from, to = 'HEAD', cwd = process.cwd()) {
  const range = from ? `${from}..${to}` : to;
  const out = execFileSync('git', ['log', '--format=%H%x1f%s%x1f%b%x1e', range], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return out
    .split('\x1e')
    .map((r) => r.replace(/^\n/, ''))
    .filter((r) => r.trim())
    .map((r) => {
      const [hash, subject, body] = r.split('\x1f');
      return { hash, subject, body };
    });
}

const actor = (a) => (a ? { login: a.login, bot: a.__typename === 'Bot' } : null);

/**
 * GitHub through `gh api graphql`. `run(args)` returns gh's stdout; the default runs the gh binary
 * (KEPT_CHANGELOG_GH, else `gh`).
 */
export function ghFetcher({
  repo = REPO,
  run = (args) =>
    execFileSync(process.env.KEPT_CHANGELOG_GH || 'gh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 16 * 1024 * 1024,
    }),
} = {}) {
  const [owner, name] = repo.split('/');
  return {
    /** number → { author, closes: [{ number, author }] }; an author is null for a deleted account. */
    async pulls(numbers) {
      const fields = numbers.map(
        (n) =>
          `p${n}: pullRequest(number: ${n}) { number author { __typename login } ` +
          'closingIssuesReferences(first: 20) { nodes { number author { __typename login } } } }',
      );
      const query = `query { repository(owner: "${owner}", name: "${name}") { ${fields.join(' ')} } }`;
      const out = JSON.parse(run(['api', 'graphql', '-f', `query=${query}`]));
      if (out.errors?.length) throw new Error(out.errors.map((e) => e.message).join('; '));
      const pulls = new Map();
      for (const pr of Object.values(out.data?.repository ?? {})) {
        if (!pr) continue;
        pulls.set(pr.number, {
          author: actor(pr.author),
          closes: pr.closingIssuesReferences.nodes.map((i) => ({
            number: i.number,
            author: actor(i.author),
          })),
        });
      }
      return pulls;
    },
  };
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
    if (!opts.version) throw new Error('--version is required');
    const date = opts.date ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('--date is YYYY-MM-DD');
    let highlights;
    if (opts.highlights) {
      if (!existsSync(opts.highlights)) throw new Error(`no highlights file ${opts.highlights}`);
      highlights = parseHighlights(readFileSync(opts.highlights, 'utf8'));
    }
    const commits = readCommits(opts.from, opts.to ?? 'HEAD');
    const github = await gatherGitHub(commits, ghFetcher({ repo: opts.repo ?? REPO }));
    const section = renderSection(opts.version, date, commits, { highlights, github });
    if (opts.write) {
      const existing = existsSync(opts.write) ? readFileSync(opts.write, 'utf8') : '';
      const tmp = `${opts.write}.tmp-${process.pid}`;
      writeFileSync(tmp, insertSection(existing, section));
      renameSync(tmp, opts.write);
    } else {
      process.stdout.write(section);
    }
  } catch (err) {
    console.error(`changelog: ${err.message}`);
    process.exit(1);
  }
}
