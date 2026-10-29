#!/usr/bin/env node
// The kept repository is also Home Assistant's app repository for Kept (D272): Settings → Apps →
// Repositories → https://github.com/keptinventory/kept. The Supervisor clones it and lists every
// `config.json`, `config.yaml` or `config.yml` it finds, at any depth, as an app, except under a
// folder whose name starts with `.` or is `rootfs` (home-assistant/supervisor
// supervisor/store/data.py `_find_app_configs`, read 2026-10-28). So the app's own
// homeassistant/kept/config.yaml must stay the only one: any other would show up in people's app
// store as a broken app. This fails on one.
//
// Usage: node scripts/check-ha-app.mjs   (part of `pnpm lint`)
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** The one app config the repository may hold. */
export const APP_CONFIG = 'homeassistant/kept/config.yaml';

const CONFIG = /^config\.(?:json|ya?ml)$/;

/** The tracked files the Supervisor would read as an app's config, other than the app's own. */
export function strayAppConfigs(files) {
  return files.filter((file) => {
    if (file === APP_CONFIG) return false;
    const parts = file.split('/');
    const name = parts.at(-1) ?? '';
    if (!CONFIG.test(name)) return false;
    return !parts.slice(0, -1).some((dir) => dir.startsWith('.') || dir === 'rootfs');
  });
}

function main() {
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
  const stray = strayAppConfigs(files);
  if (stray.length > 0) {
    console.error(
      `check-ha-app: Home Assistant would list these as apps (only ${APP_CONFIG} may exist; rename them, or move them under a dot folder):`,
    );
    for (const file of stray) console.error(`  ${file}`);
    process.exit(1);
  }
  console.log(`check-ha-app: ${APP_CONFIG} is the only app config`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
