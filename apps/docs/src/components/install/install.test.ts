import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LANGS, type Lang } from '../../i18n';
import { install } from '../../words';
import { commands, printed, RELEASE } from './commands';
import {
  DEFAULT_PATH,
  GROUPS,
  hashOf,
  INSTALL_PATHS,
  isPathId,
  PATH_IDS,
  pathFromHash,
} from './paths';

// The install page (#492): a picker of the ways to run Kept, then that path's steps.

const repo = (path: string) =>
  readFileSync(new URL(`../../../../../${path}`, import.meta.url), 'utf8');
const docs = (path: string) =>
  readFileSync(new URL(`../../content/docs/${path}`, import.meta.url), 'utf8');
const pageOf = (lang: Lang) =>
  docs(lang === 'en' ? 'install/index.mdx' : `${lang}/install/index.mdx`);

/** The text of each path's section on a page, by id, in the page's order. */
function sections(page: string): [string, string][] {
  return [...page.matchAll(/<InstallPath id="([^"]+)">([\s\S]*?)<\/InstallPath>/g)].map((m) => [
    m[1] as string,
    m[2] as string,
  ]);
}

/** A `msgstr` of the web app's catalogue, for the app's own words on the page. */
function appWord(lang: Lang, msgid: string): string {
  const po = repo(`apps/web/src/locales/${lang}/messages.po`);
  const at = po.indexOf(`msgid "${msgid}"\nmsgstr "`);
  expect(at, `${lang}: ${msgid}`).toBeGreaterThan(-1);
  const rest = po.slice(at + `msgid "${msgid}"\nmsgstr "`.length);
  return rest.slice(0, rest.indexOf('"\n'));
}

describe('the paths', () => {
  it('are each in a group the picker shows, with the default among them', () => {
    expect(new Set(PATH_IDS).size).toBe(PATH_IDS.length);
    for (const path of INSTALL_PATHS) expect(GROUPS).toContain(path.group);
    for (const group of GROUPS) {
      expect(
        INSTALL_PATHS.some((path) => path.group === group),
        group,
      ).toBe(true);
    }
    expect(PATH_IDS).toContain(DEFAULT_PATH);
  });

  it('have a name and a hint in every language', () => {
    for (const lang of LANGS) {
      for (const id of PATH_IDS) {
        expect(install[lang]?.paths[id].name, `${lang} ${id}`).toMatch(/\S/);
        expect(install[lang]?.paths[id].hint, `${lang} ${id}`).toMatch(/\S/);
      }
    }
  });
});

describe('the choice in the address', () => {
  it('opens the path the hash names', () => {
    for (const id of PATH_IDS) expect(pathFromHash(hashOf(id))).toBe(id);
    expect(pathFromHash('#kubernetes')).toBe('kubernetes');
    expect(pathFromHash('kubernetes')).toBe('kubernetes');
  });

  it('opens the path that holds what the hash names', () => {
    const owner = (id: string) => ({ 'a-step': 'source', elsewhere: 'nowhere' })[id];
    expect(pathFromHash('#a-step', owner)).toBe('source');
    expect(pathFromHash('#elsewhere', owner)).toBeNull();
  });

  it('opens nothing for an empty hash, a heading outside the paths or a broken one', () => {
    expect(pathFromHash('')).toBeNull();
    expect(pathFromHash('#')).toBeNull();
    expect(pathFromHash('#updates')).toBeNull();
    expect(pathFromHash('#%E0%A4%A')).toBeNull();
    expect(isPathId('truenas')).toBe(false);
  });
});

describe('the page in every language', () => {
  it.each(LANGS)(
    '%s has every path, in the picker’s order, each with what it needs and its steps',
    (lang) => {
      const page = pageOf(lang);
      expect(page).toContain('<InstallPicker>');
      const found = sections(page);
      expect(found.map(([id]) => id)).toEqual([...PATH_IDS]);
      for (const [id, body] of found) {
        expect(body, `${lang} ${id}`).toMatch(/<Need>\s*\S[\s\S]*?<\/Need>/);
        expect(body, `${lang} ${id}`).toMatch(/<Steps>\s*1\. [\s\S]*?<\/Steps>/);
        expect(body, `${lang} ${id}`).toContain('<See>');
      }
    },
  );

  it.each(LANGS)('%s is first in the Install group and has the shared sections', (lang) => {
    const page = pageOf(lang);
    expect(page).toMatch(/^---\n[\s\S]*?\n {2}order: 0\n[\s\S]*?---\n/);
    expect(page.match(/^## /gm)).toHaveLength(3);
    expect(page).toContain('/admin/troubleshooting/');
    expect(page).toContain('/admin/upgrades/');
  });

  it.each(LANGS)('%s quotes the app’s own words for the setup screens', (lang) => {
    const page = pageOf(lang);
    expect(page).toContain(`**${appWord(lang, 'Enter the setup code')}**`);
    expect(page).toContain(`**${appWord(lang, 'Create the first account')}**`);
  });

  it.each(LANGS)('%s has no middle dot', (lang) => {
    expect(pageOf(lang)).not.toContain('\u00b7');
  });

  it('runs every command from the shared list, never one of its own', () => {
    for (const lang of LANGS) {
      expect(pageOf(lang), lang).not.toMatch(/```(sh|bash|shell)/);
    }
  });
});

describe('the commands', () => {
  it('download the release compose.yaml runs, as the Compose guide does', () => {
    const guide = docs('install/compose.md');
    expect(guide).toContain(`/kept/v${RELEASE}/compose.yaml`);
    expect(guide).toContain(commands.compose.download);
    for (const line of [
      commands.compose.init,
      commands.compose.start,
      commands.compose.recoveryKit,
    ]) {
      expect(guide).toContain(line);
    }
  });

  it('update as the upgrades page says', () => {
    const upgrades = docs('admin/upgrades.md');
    expect(upgrades).toContain(commands.compose.update);
    for (const line of commands.source.update.split('\n')) expect(upgrades).toContain(line);
  });

  it('build from source as the guides say', () => {
    expect(repo('CONTRIBUTING.md')).toContain(commands.source.clone);
    const guide = docs('install/compose.md');
    expect(guide).toContain(commands.source.build);
    expect(guide).toContain('KEPT_IMAGE=kept:local');
    expect(guide).toContain('>> .env');
  });

  it('install the chart as its README says, from where the release publishes it', () => {
    const readme = repo('charts/kept/README.md');
    expect(readme).toContain(commands.kubernetes.secrets);
    expect(readme).toContain(
      commands.kubernetes.install
        .replace('ghcr.io/keptinventory', '<registry>')
        .replace(`--version ${RELEASE}`, '--version <X.Y.Z>'),
    );
    expect(docs('admin/upgrades.md')).toContain('`oci://ghcr.io/keptinventory/charts/kept`');
    expect(readme).toContain(commands.kubernetes.setupCode);
    expect(readme).toContain(commands.kubernetes.recoveryKit);
    expect(readme).toContain(commands.kubernetes.test);
  });
});

describe('the Proxmox VE commands', () => {
  it('are the host script’s own and its guide’s, at the release compose.yaml runs', () => {
    const script = repo('deploy/proxmox/kept.sh');
    expect(script).toContain(`#   ${commands.proxmox.install}`);
    expect(script).toContain(`KEPT_VERSION=${RELEASE}`);
    const guide = docs('install/proxmox.md');
    for (const line of Object.values(commands.proxmox)) expect(guide).toContain(line);
    // The update command the container gets, and the files the first run points at.
    const inside = repo('deploy/proxmox/kept-install.sh');
    expect(inside).toContain('>/usr/bin/update');
    expect(inside).toContain('CREDS=/root/kept.creds');
  });
});

describe('what Kept prints', () => {
  it('is what `kept init` prints', () => {
    const init = repo('apps/server/src/cli/init.ts');
    expect(init).toContain("io.print(existing !== null ? 'Updated .env.' : 'Wrote .env.');");
    expect(init).toContain(
      `io.print('');\n  io.print(\`KEPT SETUP CODE: \${code}\`);\n  io.print('');`,
    );
    expect(init).toContain(
      `io.print(\`Next: docker compose up -d, then open \${address.url} and enter the setup code.\`);`,
    );
    expect(printed.init).toContain('KEPT SETUP CODE: XXX-XXX');
    expect(printed.initUpdated.startsWith('Updated .env.\n\nKEPT SETUP CODE:')).toBe(true);
    expect(init).toContain(printed.initAgain);
  });

  it('is the line the server prints the setup code as', () => {
    expect(repo('apps/server/src/setup/setup-code.ts')).toContain(
      `return \`KEPT SETUP CODE: \${formatSetupCode(code)}\`;`,
    );
    expect(printed.setupCode).toMatch(/^KEPT SETUP CODE: [X]{3}-[X]{3}$/);
  });

  it('is the recovery kit’s first line', () => {
    const kit = repo('apps/server/src/setup/recovery-kit-content.ts');
    expect(kit).toMatch(/return \[\n\s+'KEPT RECOVERY KIT',/);
    expect(printed.recoveryKit).toBe('KEPT RECOVERY KIT');
  });

  it('is the first line of the chart’s notes', () => {
    const notes = repo('charts/kept/templates/NOTES.txt');
    expect(notes).toContain(
      'Kept {{ .Chart.AppVersion }} is installed as "{{ .Release.Name }}" in namespace "{{ .Release.Namespace }}".',
    );
    expect(printed.helmInstalled).toBe(
      `Kept ${RELEASE} is installed as "kept" in namespace "kept".`,
    );
  });

  it('is what the Unraid image logs at start, and its recovery kit as the Unraid guide says', () => {
    const lib = repo('docker/one-container.sh');
    expect(lib).toContain('log() { printf \'app: %s\\n\' "$*"; }');
    expect(repo('docker/unraid/kept-unraid-start')).toContain('log "Kept is at $KEPT_PUBLIC_URL"');
    expect(printed.unraid).toBe('app: Kept is at http://tower.local:8080');
    expect(
      docs('install/unraid.md')
        .split('\n')
        .map((line) => line.trim()),
    ).toContain(commands.unraid.recoveryKit);
    expect(repo('unraid/kept.xml')).toContain('Target="KEPT_PUBLIC_URL"');
  });

  it('is what the Proxmox VE script prints at the end', () => {
    expect(repo('deploy/proxmox/kept.sh')).toContain(`say "${printed.proxmox}"`);
  });

  it('is what the Home Assistant app logs at start', () => {
    const options = repo('docker/ha/options.mjs');
    expect(options).toContain(
      `\`Kept is at \${env.KEPT_PUBLIC_URL} (change it in Configuration: "Kept's address")\``,
    );
    expect(options).toContain("const host = text(info?.hostname) || 'homeassistant';");
    expect(printed.homeAssistant.startsWith('Kept is at http://homeassistant.local:8080 ')).toBe(
      true,
    );
  });
});

describe('the Unraid and Proxmox VE guides', () => {
  const page = (lang: Lang, file: string) =>
    docs(lang === 'en' ? `install/${file}` : `${lang}/install/${file}`);

  // One figure everywhere (install/hardware.md has the measurements behind it): about 500 MB,
  // 1 GB for imports and backups. Arabic writes its own digits.
  it('give Unraid one memory figure: the template, the guide and the install page', () => {
    expect(repo('unraid/kept.xml')).toContain(
      '<Requires>About 500 MB of free memory, 1 GB for imports and backups.',
    );
    for (const lang of LANGS) {
      const [mb, gb] = lang === 'ar' ? ['٥٠٠', '١'] : ['500', '1'];
      const need = sections(pageOf(lang)).find(([id]) => id === 'unraid')?.[1] ?? '';
      for (const [where, text] of [
        ['unraid.md', page(lang, 'unraid.md')],
        ['index.mdx', need],
      ]) {
        expect(text, `${lang} ${where}`).toMatch(new RegExp(`${mb} (MB|Mo|МБ|ميغابايت)`));
        expect(text, `${lang} ${where}`).toMatch(new RegExp(`${gb} (GB|Go|ГБ|جيجابايت)`));
        expect(text, `${lang} ${where}`).not.toMatch(/(300|٣٠٠) (MB|Mo|МБ|ميغابايت)/);
      }
    }
  });

  // Until the real-host checklist has run: the caution goes with that sign-off, not before.
  it('keep the Proxmox VE guide’s "not yet tested on a real host" caution in every language', () => {
    for (const lang of LANGS) {
      expect(page(lang, 'proxmox.md'), lang).toMatch(/^:::caution\[[^\]]+\]$/m);
    }
  });
});
