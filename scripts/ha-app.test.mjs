import { describe, expect, it } from 'vitest';
import { bumpChangelog, bumpConfig } from './release/ha-app.mjs';

// The release PR bumps the Home Assistant app's version with Kept's (D272): the app's version is
// always Kept's, and its changelog names each release's highlights.

const ROOT_CHANGELOG = `# Changelog

## 1.15.0 (2026-11-02)

### Highlights

- **Kept in Home Assistant.** Install it from Settings → Apps.
- **Faster search.** Results while you type (#400).

### Features

- **web:** a thing (#1)

## 1.14.1 (2026-10-28)

### Highlights

- **Older.** Not this one.
`;

describe('bumpConfig()', () => {
  it('sets the version line and nothing else', () => {
    const yaml = '# a comment\nname: Kept\nversion: "1.14.1"\nslug: kept\n';
    expect(bumpConfig(yaml, '1.15.0')).toBe(
      '# a comment\nname: Kept\nversion: "1.15.0"\nslug: kept\n',
    );
  });

  it('refuses a config with no version line, or a version that is not X.Y.Z', () => {
    expect(() => bumpConfig('name: Kept\n', '1.15.0')).toThrow(/version/);
    expect(() => bumpConfig('version: "1.14.1"\n', 'v1.15')).toThrow(/X\.Y\.Z/);
  });
});

describe('bumpChangelog()', () => {
  const app = '# Changelog\n\nIntro.\n\n## 1.14.2\n\n- Kept 1.14.2.\n';

  it('puts the release on top with its highlights, as plain lines', () => {
    expect(bumpChangelog(app, '1.15.0', ROOT_CHANGELOG)).toBe(
      '# Changelog\n\nIntro.\n\n## 1.15.0\n\n- Kept in Home Assistant. Install it from Settings → Apps.\n- Faster search. Results while you type (#400).\n\n## 1.14.2\n\n- Kept 1.14.2.\n',
    );
  });

  it('names the release when it has no highlights', () => {
    expect(bumpChangelog(app, '1.15.1', ROOT_CHANGELOG)).toContain('## 1.15.1\n\n- Kept 1.15.1.\n');
  });

  it('turns the unreleased first section into the release, once', () => {
    const first = '# Changelog\n\nIntro.\n\n## Unreleased\n\n- The first version of the app.\n';
    expect(bumpChangelog(first, '1.15.0', ROOT_CHANGELOG)).toBe(
      '# Changelog\n\nIntro.\n\n## 1.15.0\n\n- The first version of the app.\n',
    );
  });

  it('leaves a changelog that already has the release alone', () => {
    const done = bumpChangelog(app, '1.15.0', ROOT_CHANGELOG);
    expect(bumpChangelog(done, '1.15.0', ROOT_CHANGELOG)).toBe(done);
  });
});

describe('the Dockerfile', () => {
  it('keeps the kept image as its last stage, so a build without --target is unchanged', async () => {
    const { readFileSync } = await import('node:fs');
    const stages = [
      ...readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8').matchAll(
        /^FROM\s+\S+\s+AS\s+(\S+)/gm,
      ),
    ].map((m) => m[1]);
    expect(stages.at(-1)).toBe('runtime');
    expect(stages).toContain('ha');
    expect(stages).toContain('unraid');
  });
});

// docker/one-container.sh, the steps the Home Assistant app's start (docker/ha/kept-ha-start, D272)
// and the Unraid image's (docker/unraid/kept-unraid-start) share: what Postgres starts
// with. Postgres's processes never inherit a secret the start put in the environment, and it asks
// for no huge pages: an anonymous MAP_HUGETLB attempt is what AppArmor logged as a mapping named
// "/" (homeassistant/kept/apparmor.txt).
describe('the one-container start', () => {
  const read = async (path) => {
    const { readFileSync } = await import('node:fs');
    return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  };

  it('starts Postgres, and initdb, through PG_ENV_UNSET and without huge pages', async () => {
    const lib = await read('docker/one-container.sh');
    // The command that starts the server, joined across its continuation lines.
    const joined = lib.replace(/\\\n\s*/g, ' ');
    const server = joined.split('\n').find((l) => /"\$PGBIN\/postgres" -D/.test(l)) ?? '';
    const initdb = joined.split('\n').find((l) => /"\$PGBIN\/initdb"/.test(l)) ?? '';
    expect(server).toMatch(/-c huge_pages=off/);
    expect(initdb).toMatch(/-c huge_pages=off/);
    // Every way Postgres's binaries are run goes through it.
    expect(server).toMatch(/env "\$\{PG_ENV_UNSET\[@\]\}"/);
    expect(lib).toMatch(/as_postgres\(\) \{ env "\$\{PG_ENV_UNSET\[@\]\}" setpriv/);
    expect(initdb).toMatch(/^\s*as_postgres /);
  });

  it('the Home Assistant app leaves out the options’ secrets', async () => {
    const { SECRET_VARIABLES } = await import('../docker/ha/options.mjs');
    const start = await read('docker/ha/kept-ha-start');
    expect(start).toContain('. /usr/local/lib/kept-ha/one-container.sh');
    expect(SECRET_VARIABLES).toEqual(
      expect.arrayContaining([
        'KEPT_SMTP_URL',
        'KEPT_OIDC_CLIENT_SECRET',
        'KEPT_GOOGLE_CLIENT_SECRET',
        'KEPT_APPRISE_URL',
      ]),
    );
    const unset = /^PG_ENV_UNSET=\(([^)]*)\)/m.exec(start)?.[1] ?? '';
    for (const name of SECRET_VARIABLES) expect(unset.split(/\s+/), name).toContain(name);
    // Set before the first step that runs Postgres's binaries.
    expect(start.indexOf('PG_ENV_UNSET=(')).toBeLessThan(start.indexOf('\nmake_database'));
  });

  it('the Unraid image leaves out every variable but the few a process needs', async () => {
    const start = await read('docker/unraid/kept-unraid-start');
    expect(start).toContain('. /usr/local/lib/kept-unraid/one-container.sh');
    expect(start).toMatch(/PG_ENV_UNSET=\(\)\nwhile IFS= read -r name; do/);
    expect(start).toMatch(
      /PATH \| HOME \| LANG \| LC_\* \| TZ \| PWD \| SHLVL \| HOSTNAME \| TERM\) ;;/,
    );
    expect(start).toMatch(/\*\) PG_ENV_UNSET\+=\(-u "\$name"\) ;;/);
    expect(start).toContain('done < <(compgen -e)');
    expect(start.indexOf('done < <(compgen -e)')).toBeLessThan(start.indexOf('\nmake_database'));
    // The serving process never gets the owner login, and is never the Home Assistant app.
    expect(start).toMatch(/unset KEPT_ROLE KEPT_HA KEPT_HA_TRUST_GROUPS KEPT_HA_LINK_SECRET_FILE/);
    expect(start).toContain('KEPT_OWNER_DATABASE_URL');
  });

  it('both images ship the library where their start reads it', async () => {
    const dockerfile = await read('Dockerfile');
    expect(dockerfile).toContain(
      'COPY --chmod=0644 docker/one-container.sh /usr/local/lib/kept-ha/one-container.sh',
    );
    expect(dockerfile).toContain(
      'COPY --chmod=0644 docker/one-container.sh /usr/local/lib/kept-unraid/one-container.sh',
    );
  });
});
