import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { composeBody } from './release/compose-notes.mjs';

const scripts = path.dirname(fileURLToPath(import.meta.url));
const composer = path.join(scripts, 'release', 'compose-notes.mjs');

// A CHANGELOG section as changelog.mjs writes it, with invented handles.
const section = `## 1.4.0 (2026-10-21)

### Highlights

- **Passkeys in Settings.** Add, rename and remove them (#239).
- **Labels print what you see.** The preview is the sheet.

### Features

- **auth:** passkeys in Settings (#239, closes #226, reported by @talia) (c000004)
- **mail:** a logo in every email (#244) (c000002)

### Fixes

- **labels:** the preview is the print (#246) (c000001)

### Documentation

- **readme:** the chat server (#242) (c000005)

### Behind the scenes

- **e2e:** room for eleven test servers (#245) (c000003)

### Contributors

@bruce · @louis · @talia
`;

// The release record as scripts/release/notes.sh writes it (shortened).
const record = `# Kept 1.4.0

Built 2026-10-21 from commit \`0123456789abcdef0123456789abcdef01234567\` by \`scripts/release.sh\`.

## The image

\`ghcr.io/keptinventory/kept@sha256:aaaa\`, for linux/amd64 and linux/arm64.

| Platform | Manifest |
|---|---|
| linux/amd64 | \`sha256:bbbb\` |

## Verify

\`\`\`sh
cosign verify --key cosign.pub ghcr.io/keptinventory/kept:1.4.0
\`\`\`
`;

const base = {
  version: '1.4.0',
  previous: 'v1.3.0',
  section,
  record,
  migrations: true,
  image: 'ghcr.io/keptinventory/kept',
  mirror: 'docker.io/keptinventory/kept',
  chart: 'oci://ghcr.io/keptinventory/charts/kept',
  repoUrl: 'https://github.com/keptinventory/kept',
};

describe('composeBody', () => {
  const body = composeBody(base);

  it('leaves the highlights’ media names off the release page (What’s new reads them)', () => {
    const withMedia = section.replace(
      '(#239).\n',
      '(#239).\n  <!-- whats-new ![settings](passkeys.mp4) -->\n',
    );
    const page = composeBody({ ...base, section: withMedia });
    expect(page).not.toMatch(/whats-new|passkeys\.mp4/);
    expect(page).toContain(
      '- **Passkeys in Settings.** Add, rename and remove them (#239).\n- **Labels print what you see.**',
    );
  });

  it('lays the page out in order: highlights, changes, upgrade, contributors, link, record', () => {
    const order = [
      '## Highlights\n',
      "## What's changed\n",
      '<details><summary>Documentation and behind the scenes</summary>',
      '## Upgrade\n',
      '## Contributors\n\n@bruce · @louis · @talia\n',
      '**Full changelog**: https://github.com/keptinventory/kept/compare/v1.3.0...v1.4.0',
      '<details><summary>Image, chart and how to verify</summary>',
    ].map((s) => body.indexOf(s));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(body.startsWith('## Highlights\n\n- **Passkeys in Settings.**')).toBe(true);
    expect(body).not.toContain('## 1.4.0');
  });

  it('keeps the user-facing groups open and folds documentation and internal work away', () => {
    const open = body.slice(body.indexOf("## What's changed"), body.indexOf('<details>'));
    expect(open).toContain(
      '### Features\n\n- **auth:** passkeys in Settings (#239, closes #226, reported by @talia)',
    );
    expect(open).toContain('### Fixes\n\n- **labels:** the preview is the print');
    expect(open).not.toContain('readme');
    const folded = body.slice(body.indexOf('<details>'), body.indexOf('</details>'));
    expect(folded).toContain('### Documentation\n\n- **readme:** the chat server');
    expect(folded).toContain('### Behind the scenes\n\n- **e2e:** room for eleven test servers');
  });

  it('says how to upgrade, with both registries and the database changes', () => {
    const upgrade = body.slice(body.indexOf('## Upgrade'), body.indexOf('## Contributors'));
    expect(upgrade).toContain(
      '`ghcr.io/keptinventory/kept:1.4.0` or `docker.io/keptinventory/kept:1.4.0`',
    );
    expect(upgrade).toContain('set `KEPT_IMAGE`');
    expect(upgrade).toContain('`docker compose pull && docker compose up -d`');
    expect(upgrade).toContain('`oci://ghcr.io/keptinventory/charts/kept`, version `1.4.0`');
    expect(upgrade).toMatch(/Database changes:\*\* yes \(migrations run on start;/);
    const none = composeBody({ ...base, migrations: false });
    expect(none).toMatch(/Database changes:\*\* none\./);
    const unmirrored = composeBody({ ...base, mirror: '' });
    expect(unmirrored).not.toContain('docker.io');
  });

  it('holds the whole release record, untouched but its title, in the last fold', () => {
    const fold = body.slice(body.lastIndexOf('<details>'));
    expect(fold).toContain(record.split('\n').slice(1).join('\n').trim());
    expect(fold).not.toContain('# Kept 1.4.0');
    expect(fold.trimEnd().endsWith('</details>')).toBe(true);
  });

  it('leaves out what the section does not have, and says so when nothing user-facing changed', () => {
    const bare = composeBody({
      ...base,
      section: '## 1.4.1 (2026-10-22)\n\nNo user-facing changes.\n',
      version: '1.4.1',
      previous: 'v1.4.0',
    });
    expect(bare).not.toContain('## Highlights');
    expect(bare).not.toContain('## Contributors');
    expect(bare).not.toContain('Documentation and behind the scenes');
    expect(bare).toContain("## What's changed\n\nNo user-facing changes.");
    // The first release has nothing to compare with.
    expect(composeBody({ ...base, previous: '' })).not.toContain('Full changelog');
  });

  it('passes the attribution check', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'kept-notes-'));
    try {
      const file = path.join(dir, 'body.md');
      writeFileSync(file, body);
      const r = spawnSync('bash', [path.join(scripts, 'check-attribution.sh'), file], {
        encoding: 'utf8',
      });
      expect(r.status).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('compose-notes.mjs over a fixture history', () => {
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
  const put = (file, text) => {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), text);
    git('add', file);
    git('commit', '-q', '-m', `add ${file}`);
  };
  const compose = (...args) =>
    spawnSync(
      'node',
      [composer, '--version', '1.4.0', '--section', 'section.md', '--record', 'record.md', ...args],
      { cwd: dir, encoding: 'utf8' },
    );

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'kept-compose-'));
    git('init', '-q', '-b', 'main');
    writeFileSync(path.join(dir, 'section.md'), section);
    writeFileSync(path.join(dir, 'record.md'), record);
    put('README.md', 'Kept\n');
    git('tag', 'v1.2.0');
    put('apps/server/migrations/0001_things.sql', 'create table t ();\n');
    git('tag', 'v1.3.0');
    put('apps/server/migrations/meta/_journal.json', '{}\n');
    put('README.md', 'Kept, again\n');
    git('tag', 'v1.4.0');
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('says the database changes when a migration was added between the tags', () => {
    const r = compose('--from', 'v1.2.0', '--to', 'v1.3.0');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/Database changes:\*\* yes/);
    expect(r.stdout).toContain('compare/v1.2.0...v1.4.0');
  });

  it('says none when only migration metadata or other files changed', () => {
    const r = compose('--from', 'v1.3.0', '--to', 'v1.4.0');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/Database changes:\*\* none/);
  });

  it('writes the body to --out', () => {
    const r = compose('--from', 'v1.3.0', '--to', 'v1.4.0', '--out', 'body.md');
    expect(r.status).toBe(0);
    expect(readFileSync(path.join(dir, 'body.md'), 'utf8')).toMatch(/^## Highlights\n/);
  });
});

// discord.yml's jq program, run as the workflow runs it, on release bodies.
const hasJq = spawnSync('jq', ['--version']).status === 0;
describe.skipIf(!hasJq)("discord.yml's payload", () => {
  const workflow = readFileSync(path.join(scripts, '..', '.github/workflows/discord.yml'), 'utf8');
  const program = /jq --arg role "\$ROLE" '\n([\s\S]*?)' release\.json/.exec(workflow)?.[1];
  const payload = (body, isPrerelease = false) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'kept-discord-'));
    try {
      writeFileSync(path.join(dir, 'program.jq'), program);
      writeFileSync(
        path.join(dir, 'release.json'),
        JSON.stringify({
          name: 'Kept 1.4.0',
          url: 'https://github.com/keptinventory/kept/releases/tag/v1.4.0',
          body,
          isPrerelease,
          publishedAt: '2026-10-21T20:00:00Z',
        }),
      );
      const out = execFileSync(
        'jq',
        ['--arg', 'role', '42', '-f', path.join(dir, 'program.jq'), path.join(dir, 'release.json')],
        { encoding: 'utf8' },
      );
      return JSON.parse(out);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it('is found in the workflow', () => {
    expect(program).toBeTruthy();
  });

  it('posts the highlights when the release has them, and nothing folded', () => {
    const text = payload(composeBody(base)).embeds[0].description;
    expect(text.startsWith('__**Highlights**__\n\n- **Passkeys in Settings.**')).toBe(true);
    expect(text).toContain('- **Labels print what you see.**');
    expect(text).not.toMatch(/Features|Upgrade|Contributors|details|sha256|Built /);
    expect(
      text.endsWith(
        '[Full release notes](https://github.com/keptinventory/kept/releases/tag/v1.4.0)',
      ),
    ).toBe(true);
  });

  it('posts no picture or clip that names a highlight’s media', () => {
    const withMedia = section.replace(
      '(#239).\n',
      '(#239).\n  <!-- whats-new ![settings](passkeys.mp4) -->\n',
    );
    const text = payload(composeBody({ ...base, section: withMedia })).embeds[0].description;
    expect(text).not.toMatch(/whats-new|passkeys\.mp4|<!--/);
    expect(text).toContain(
      '- **Passkeys in Settings.** Add, rename and remove them (#239).\n- **Labels',
    );
    // Even a release body edited by hand with a bare image line.
    expect(
      payload('## Highlights\n\n- **A.** b\n  ![](a.webp)\n').embeds[0].description,
    ).not.toMatch(/a\.webp|!\[/);
  });

  it("posts what's changed without the folded parts when there are no highlights", () => {
    const noHighlights = section.replace(/### Highlights\n\n[\s\S]*?(?=### Features)/, '');
    const text = payload(composeBody({ ...base, section: noHighlights })).embeds[0].description;
    expect(text.startsWith("__**What's changed**__\n\n**Features**\n\n- **auth:**")).toBe(true);
    expect(text).toContain('**Fixes**');
    expect(text).not.toMatch(/readme|e2e|details|Upgrade|Contributors|sha256|Built /);
  });

  it('still posts a release in the earlier layout: the part before the record', () => {
    const old = `## 1.3.0 (2026-10-20)\n\n### Features\n\n- **web:** a lock (c1)\n\nBuilt 2026-10-20 from commit \`abc\`.\n\n## The image\n`;
    const text = payload(old).embeds[0].description;
    expect(text.startsWith('**Features**\n\n- **web:** a lock (c1)')).toBe(true);
    expect(text).not.toContain('The image');
  });

  it('caps the length and pings the role only for a final release', () => {
    const long = `## Highlights\n\n${'- **A long one.** words words words\n'.repeat(200)}`;
    const p = payload(long);
    expect(p.embeds[0].description.length).toBeLessThan(3800 + 120);
    expect(p.embeds[0].description).toContain('…\n\n[Full release notes]');
    expect(p.allowed_mentions.roles).toEqual(['42']);
    expect(payload(long, true).allowed_mentions.roles).toEqual([]);
  });
});
