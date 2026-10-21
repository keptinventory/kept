import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  classify,
  gatherGitHub,
  ghFetcher,
  HEADER,
  INTERNAL_SCOPES,
  insertSection,
  parseHighlights,
  renderSection,
} from './changelog.mjs';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'changelog.mjs');

describe('classify', () => {
  it('groups conventional subjects and hides the ones nobody running Kept sees', () => {
    expect(classify({ hash: 'a', subject: 'feat(web): a lock' })).toMatchObject({
      group: 'feat',
      scope: 'web',
      subject: 'a lock',
    });
    expect(classify({ hash: 'a', subject: 'fix: a crash' })).toMatchObject({
      group: 'fix',
      scope: null,
    });
    expect(classify({ hash: 'a', subject: 'i18n(web): plurals' })).toMatchObject({ group: 'i18n' });
    expect(classify({ hash: 'a', subject: 'test(web): more' })).toBeNull();
    expect(classify({ hash: 'a', subject: 'chore: bump' })).toBeNull();
  });

  it('marks `!` and a BREAKING CHANGE footer as breaking, even on a hidden type', () => {
    expect(classify({ hash: 'a', subject: 'feat(api)!: drop v0' }).group).toBe('breaking');
    expect(
      classify({
        hash: 'a',
        subject: 'refactor: env',
        body: 'x\n\nBREAKING CHANGE: KEPT_X is gone',
      }).group,
    ).toBe('breaking');
  });

  it('lists a subject that is not conventional under Other, whole', () => {
    expect(classify({ hash: 'a', subject: 'Merge the spike' })).toMatchObject({
      group: 'other',
      subject: 'Merge the spike',
    });
  });

  it('reads the pull request number a squash merge puts at the end of the subject', () => {
    expect(classify({ hash: 'a', subject: 'feat(auth): passkeys (#239)' })).toMatchObject({
      pr: 239,
      subject: 'passkeys (#239)',
    });
    expect(classify({ hash: 'a', subject: 'fix: no number' }).pr).toBeNull();
  });

  it('moves features, fixes and performance work on an internal scope behind the scenes', () => {
    expect(INTERNAL_SCOPES).toEqual(['e2e', 'test', 'ci', 'release', 'build', 'deps-dev']);
    expect(classify({ hash: 'a', subject: 'fix(e2e): room for eleven servers (#245)' }).group).toBe(
      'internal',
    );
    expect(classify({ hash: 'a', subject: 'feat(deps-dev): a newer vitest' }).group).toBe(
      'internal',
    );
    expect(classify({ hash: 'a', subject: 'perf(ci): cache the install' }).group).toBe('internal');
    expect(classify({ hash: 'a', subject: 'fix(e2e, ci): both' }).group).toBe('internal');
    // A scope a person running Kept sees, alongside an internal one, stays user-facing.
    expect(classify({ hash: 'a', subject: 'fix(web,e2e): the lock' }).group).toBe('fix');
    // Documentation stays documentation; a breaking change stays breaking.
    expect(classify({ hash: 'a', subject: 'docs(release): the record' }).group).toBe('docs');
    expect(classify({ hash: 'a', subject: 'feat(release)!: new tags' }).group).toBe('breaking');
  });
});

describe('renderSection and insertSection', () => {
  it('puts a new section above the newest, under the header', () => {
    const one = renderSection('1.0.0', '2026-10-01', [
      { hash: '1111111aaa', subject: 'feat: one' },
    ]);
    const two = renderSection('1.1.0', '2026-10-07', [{ hash: '2222222bbb', subject: 'fix: two' }]);
    const text = insertSection(insertSection('', one), two);
    expect(text.startsWith(HEADER)).toBe(true);
    expect(text.indexOf('## 1.1.0')).toBeLessThan(text.indexOf('## 1.0.0'));
    expect(text).toContain('### Fixes\n\n- two (2222222)');
  });

  it('replaces the section of a version the file already has, in place', () => {
    const one = renderSection('1.0.0', '2026-10-01', [
      { hash: '1111111aaa', subject: 'feat: one' },
    ]);
    const two = renderSection('1.1.0', '2026-10-07', [{ hash: '2222222bbb', subject: 'fix: two' }]);
    const again = renderSection('1.1.0', '2026-10-07', [
      { hash: '3333333ccc', subject: 'fix: three' },
    ]);
    const text = insertSection(insertSection(insertSection('', one), two), again);
    expect(text.match(/^## 1\.1\.0 /gm)).toHaveLength(1);
    expect(text).toContain('- three (3333333)');
    expect(text).not.toContain('- two (2222222)');
    expect(text.indexOf('## 1.1.0')).toBeLessThan(text.indexOf('## 1.0.0'));
    expect(insertSection(text, again)).toBe(text);
  });

  it('says so when nothing user-facing changed', () => {
    expect(
      renderSection('1.0.1', '2026-10-07', [{ hash: 'abcdef01', subject: 'test: x' }]),
    ).toContain('No user-facing changes.');
  });

  it('lists the user-facing groups first, then documentation, then behind the scenes', () => {
    const text = renderSection('1.2.0', '2026-10-20', [
      { hash: 'aaaaaaa1', subject: 'fix(e2e): a slower runner (#12)' },
      { hash: 'aaaaaaa2', subject: 'docs: the restore page (#11)' },
      { hash: 'aaaaaaa3', subject: 'Tidy the folder' },
      { hash: 'aaaaaaa4', subject: 'fix(web): the lock (#10)' },
    ]);
    const at = (h) => text.indexOf(`### ${h}\n`);
    expect(at('Fixes')).toBeGreaterThan(-1);
    expect(at('Fixes')).toBeLessThan(at('Other'));
    expect(at('Other')).toBeLessThan(at('Documentation'));
    expect(at('Documentation')).toBeLessThan(at('Behind the scenes'));
    expect(text).toContain('### Behind the scenes\n\n- **e2e:** a slower runner (#12) (aaaaaaa)');
  });

  it('puts the highlights at the top of the section, and none without them', () => {
    const commits = [{ hash: 'bbbbbbb1', subject: 'feat(labels): print what you see (#20)' }];
    const highlights = parseHighlights(
      '- **Labels print what you see.** The preview is the sheet.\n- **Branded emails.** A logo\n  in every email.\n',
    );
    const text = renderSection('1.3.0', '2026-10-21', commits, { highlights });
    expect(text.startsWith('## 1.3.0 (2026-10-21)\n\n### Highlights\n\n')).toBe(true);
    expect(text).toContain(
      '### Highlights\n\n- **Labels print what you see.** The preview is the sheet.\n- **Branded emails.** A logo\n  in every email.\n\n### Features',
    );
    expect(renderSection('1.3.0', '2026-10-21', commits)).not.toContain('Highlights');
  });

  it('refuses a highlights file with no bullets or with headings of its own', () => {
    expect(() => parseHighlights('\n\n')).toThrow(/no bullets/);
    expect(() => parseHighlights('Just a sentence.')).toThrow(/no bullets/);
    expect(() => parseHighlights('## Highlights\n- one')).toThrow(/heading/);
  });
});

// Invented handles: the fake GitHub behind these tests.
const user = (login) => ({ login, bot: false });
const pulls = new Map([
  [239, { author: user('bruce'), closes: [{ number: 226, author: user('talia') }] }],
  [
    244,
    {
      author: user('louis'),
      closes: [
        { number: 230, author: user('talia') },
        { number: 231, author: user('peter') },
      ],
    },
  ],
  // The author's own issue, and one a bot opened: closed, but nobody to credit.
  [
    245,
    {
      author: user('bruce'),
      closes: [
        { number: 240, author: user('bruce') },
        { number: 241, author: { login: 'renovate', bot: true } },
      ],
    },
  ],
  [250, { author: { login: 'renovate', bot: true }, closes: [] }],
  [
    251,
    { author: user('dependabot[bot]'), closes: [{ number: 9, author: user('github-actions') }] },
  ],
  [252, { author: null, closes: [] }],
  [253, { author: user('ibrahimroshdy'), closes: [] }],
]);
const fakeFetcher = () => ({ pulls: vi.fn(async () => pulls) });
const releaseCommits = [
  { hash: 'c000007', subject: 'fix(web): a maintainer fix (#253)' },
  { hash: 'c000001', subject: 'chore(deps): bump things (#250)' },
  { hash: 'c000002', subject: 'feat(mail): logo in every email (#244)' },
  { hash: 'c000003', subject: 'fix(e2e): room for eleven servers (#245)' },
  { hash: 'c000004', subject: 'feat(auth): passkeys in Settings (#239)' },
  { hash: 'c000005', subject: 'chore: lockfile (#251)' },
  { hash: 'c000006', subject: 'docs: a page by a deleted account (#252)' },
];

describe('the issues each pull request closes, and the contributors', () => {
  it('asks GitHub about every pull request in the release, hidden ones too', async () => {
    const fetcher = fakeFetcher();
    await gatherGitHub(releaseCommits, fetcher);
    expect(fetcher.pulls).toHaveBeenCalledWith([239, 244, 245, 250, 251, 252, 253]);
  });

  it('adds the issues a pull request closes to its line, and who reported them', async () => {
    const github = await gatherGitHub(releaseCommits, fakeFetcher());
    const text = renderSection('1.12.4', '2026-10-21', releaseCommits, { github });
    expect(text).toContain(
      '- **auth:** passkeys in Settings (#239, closes #226, reported by @talia) (c000004)',
    );
    expect(text).toContain(
      '- **mail:** logo in every email (#244, closes #230, #231, reported by @talia and @peter) (c000002)',
    );
    // The author's own issue and a bot's: closed, nobody credited.
    expect(text).toContain(
      '- **e2e:** room for eleven servers (#245, closes #240, #241) (c000003)',
    );
    expect(text).not.toMatch(/Thanks|New contributors/);
  });

  it('ends with one line of every author and reporter, sorted, each once, no bots', async () => {
    const github = await gatherGitHub(releaseCommits, fakeFetcher());
    const text = renderSection('1.12.4', '2026-10-21', releaseCommits, { github });
    expect(text.trimEnd()).toMatch(
      /### Contributors\n\n@bruce · @ibrahimroshdy · @louis · @peter · @talia$/,
    );
    expect(text).not.toMatch(/renovate|dependabot|github-actions/);
  });

  it('leaves the credits out, with a warning, when GitHub cannot be asked', async () => {
    const warn = vi.fn();
    const failing = {
      pulls: async () => {
        throw new Error('gh: command not found');
      },
    };
    const github = await gatherGitHub(releaseCommits, failing, warn);
    expect(github).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('gh: command not found'));
    const text = renderSection('1.12.4', '2026-10-21', releaseCommits, { github });
    expect(text).not.toContain('Contributors');
    expect(text).not.toContain('closes');
    expect(text).toContain('- **auth:** passkeys in Settings (#239) (c000004)');
  });

  it('asks nothing when no commit names a pull request', async () => {
    const fetcher = fakeFetcher();
    expect(await gatherGitHub([{ hash: 'd1', subject: 'feat: x' }], fetcher)).toBeNull();
    expect(fetcher.pulls).not.toHaveBeenCalled();
  });
});

describe('ghFetcher', () => {
  it('asks gh api graphql for the pull requests and reads authors and closed issues', async () => {
    const calls = [];
    const run = (args) => {
      calls.push(args);
      return JSON.stringify({
        data: {
          repository: {
            p239: {
              number: 239,
              author: { __typename: 'User', login: 'bruce' },
              closingIssuesReferences: {
                nodes: [{ number: 226, author: { __typename: 'User', login: 'talia' } }],
              },
            },
            p250: {
              number: 250,
              author: { __typename: 'Bot', login: 'renovate' },
              closingIssuesReferences: { nodes: [] },
            },
            p252: { number: 252, author: null, closingIssuesReferences: { nodes: [] } },
          },
        },
      });
    };
    const got = await ghFetcher({ repo: 'keptinventory/kept', run }).pulls([239, 250, 252]);
    expect(calls[0].slice(0, 2)).toEqual(['api', 'graphql']);
    const query = calls[0].find((a) => a.startsWith('query='));
    expect(query).toContain('repository(owner: "keptinventory", name: "kept")');
    expect(query).toContain('p239: pullRequest(number: 239)');
    expect(query).toContain('closingIssuesReferences');
    expect(got.get(239)).toEqual({
      author: { login: 'bruce', bot: false },
      closes: [{ number: 226, author: { login: 'talia', bot: false } }],
    });
    expect(got.get(250).author).toEqual({ login: 'renovate', bot: true });
    expect(got.get(252).author).toBeNull();
  });
});

describe('changelog.mjs over a fixture history', () => {
  let dir;
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Fixture',
        GIT_AUTHOR_EMAIL: 'fixture@kept.invalid',
        GIT_COMMITTER_NAME: 'Fixture',
        GIT_COMMITTER_EMAIL: 'fixture@kept.invalid',
      },
    });
  const commit = (subject, body = '') => {
    git('commit', '--allow-empty', '-q', '-m', subject, ...(body ? ['-m', body] : []));
  };
  // No network in tests: `gh` is a path that doesn't exist, so the GitHub part is left out.
  const offline = { ...process.env, KEPT_CHANGELOG_GH: '/nonexistent/gh' };
  const run = (...args) =>
    spawnSync('node', [script, ...args], { cwd: dir, encoding: 'utf8', env: offline });

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'kept-changelog-'));
    git('init', '-q', '-b', 'main');
    commit('feat: before the last release');
    git('tag', 'v0.9.0');
    commit('feat(backup): restic snapshots (#7)');
    commit('fix(web): the lock screen in Arabic');
    commit('refactor(config)!: KEPT_BACKUP_KEEP is the daily count');
    commit('docs: the restore runbook');
    commit('test(server): more digests');
    commit('fix(e2e): a slower runner');
    commit('Tidy the spike folder');
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('writes the section since the tag, grouped, into CHANGELOG.md, the same on a second run', () => {
    const file = path.join(dir, 'CHANGELOG.md');
    const highlights = path.join(dir, 'highlights.md');
    writeFileSync(highlights, '- **Snapshots.** Restic every night.\n');
    writeFileSync(file, `${HEADER}\n## 0.9.0 (2026-09-01)\n\n### Features\n\n- old (0000000)\n`);
    const args = [
      '--version',
      '1.0.0',
      '--from',
      'v0.9.0',
      '--date',
      '2026-10-07',
      '--highlights',
      highlights,
      '--write',
      file,
    ];
    const r = run(...args);
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/closed issues and contributors left out/);
    const text = readFileSync(file, 'utf8');
    const section = text.slice(text.indexOf('## 1.0.0'), text.indexOf('## 0.9.0'));
    expect(section).toMatch(
      /^## 1\.0\.0 \(2026-10-07\)\n\n### Highlights\n\n- \*\*Snapshots\.\*\*/,
    );
    expect(section).toMatch(
      /### Breaking changes\n\n- \*\*config:\*\* KEPT_BACKUP_KEEP is the daily count/,
    );
    expect(section).toMatch(
      /### Features\n\n- \*\*backup:\*\* restic snapshots \(#7\) \([0-9a-f]{7}\)/,
    );
    expect(section).toMatch(/### Fixes\n\n- \*\*web:\*\* the lock screen in Arabic/);
    expect(section).toMatch(/### Documentation\n\n- the restore runbook/);
    expect(section).toMatch(/### Behind the scenes\n\n- \*\*e2e:\*\* a slower runner/);
    expect(section).toMatch(/### Other\n\n- Tidy the spike folder/);
    expect(section).not.toContain('### Contributors');
    expect(section).not.toContain('more digests');
    expect(section).not.toContain('before the last release');
    // A second run for the same version replaces its section: the file comes out the same.
    expect(run(...args).status).toBe(0);
    expect(readFileSync(file, 'utf8')).toBe(text);
  });

  it('refuses a highlights file that does not exist', () => {
    const r = run('--version', '1.0.0', '--from', 'v0.9.0', '--highlights', 'nope.md');
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/nope\.md/);
  });
});
