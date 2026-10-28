#!/usr/bin/env node
// The Home Assistant app's version is always Kept's (D272). The release PR runs
//
//   node scripts/release/ha-app.mjs bump X.Y.Z
//
// after scripts/changelog.mjs wrote CHANGELOG.md's X.Y.Z section: it sets `version` in
// homeassistant/kept/config.yaml (and in the test-only demo app's), and puts X.Y.Z on top of
// homeassistant/kept/CHANGELOG.md with that release's highlights, which Home Assistant shows when
// the update is offered. scripts/release.sh refuses a version the app's config.yaml doesn't name, so
// the image `ghcr.io/keptinventory/kept-ha:X.Y.Z` and the version that asks for it ship together.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const APP_CONFIGS = [
  'homeassistant/kept/config.yaml',
  'homeassistant/.test/kept-demo/config.yaml',
];
export const APP_CHANGELOG = 'homeassistant/kept/CHANGELOG.md';

const VERSION = /^\d+\.\d+\.\d+$/;
const VERSION_LINE = /^version: .*$/m;

/** The config with its `version:` line set to `version`. */
export function bumpConfig(yaml, version) {
  if (!VERSION.test(version)) throw new Error(`the app's version is X.Y.Z, not '${version}'`);
  if (!VERSION_LINE.test(yaml)) throw new Error('the config has no version line');
  return yaml.replace(VERSION_LINE, `version: "${version}"`);
}

/** CHANGELOG.md's `### Highlights` bullets of `version`, as plain lines (no bold). */
function highlights(rootChangelog, version) {
  const start = rootChangelog.indexOf(`\n## ${version} (`);
  if (start < 0) return [];
  const rest = rootChangelog.slice(start + 1);
  const end = rest.indexOf('\n## ', 1);
  const section = end < 0 ? rest : rest.slice(0, end);
  const at = section.indexOf('### Highlights');
  if (at < 0) return [];
  const lines = [];
  for (const line of section.slice(at).split('\n').slice(1)) {
    if (line.startsWith('### ')) break;
    if (line.startsWith('- ')) lines.push(line.replace(/\*\*([^*]+)\*\*/g, '$1'));
  }
  return lines;
}

/** The app's changelog with `version` on top (the first `## Unreleased` section becomes it). */
export function bumpChangelog(app, version, rootChangelog) {
  if (app.includes(`\n## ${version}\n`)) return app;
  if (app.includes('\n## Unreleased\n'))
    return app.replace('\n## Unreleased\n', `\n## ${version}\n`);
  const bullets = highlights(rootChangelog, version);
  const body = bullets.length > 0 ? bullets.join('\n') : `- Kept ${version}.`;
  const first = app.indexOf('\n## ');
  const section = `## ${version}\n\n${body}\n\n`;
  return first < 0
    ? `${app.trimEnd()}\n\n${section}`
    : `${app.slice(0, first + 1)}${section}${app.slice(first + 1)}`;
}

function main() {
  const [cmd, version] = process.argv.slice(2);
  if (cmd !== 'bump' || !version) {
    console.error('usage: node scripts/release/ha-app.mjs bump X.Y.Z');
    process.exit(2);
  }
  for (const file of APP_CONFIGS) {
    if (existsSync(file)) writeFileSync(file, bumpConfig(readFileSync(file, 'utf8'), version));
  }
  writeFileSync(
    APP_CHANGELOG,
    bumpChangelog(
      readFileSync(APP_CHANGELOG, 'utf8'),
      version,
      readFileSync('CHANGELOG.md', 'utf8'),
    ),
  );
  console.log(`the Home Assistant app is version ${version}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
