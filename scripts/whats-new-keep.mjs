#!/usr/bin/env node
// One release's What's new media in the tree: the release flow adds X.Y.Z's folder
// (apps/web/public/whats-new/X.Y.Z/, scripts/record-whats-new.mjs) and its recipe
// (scripts/whats-new/X.Y.Z.json), and this removes the earlier versions' from the working tree, so
// the repository doesn't grow by a release's clips each time (a shallow clone, Home Assistant's
// for one, gets the whole current tree). Git history keeps them; a build ships only its own
// version's anyway (apps/web/whats-new-plugin.ts). Commit the removals with the new folder.
//
//   node scripts/whats-new-keep.mjs --version X.Y.Z [--root <repository>]
import { existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MEDIA = 'apps/web/public/whats-new';
const RECIPES = 'scripts/whats-new';

/** Removes every other version's media folder and recipe under `root`; returns what went. */
export function keepOnly(root, version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`a version is X.Y.Z, not ${version}`);
  if (!existsSync(path.join(root, MEDIA, version)))
    throw new Error(`no ${MEDIA}/${version}/: record it first, nothing removed`);
  const removed = [];
  for (const name of readdirSync(path.join(root, MEDIA)).sort()) {
    if (name === version || !/^\d+\.\d+\.\d+$/.test(name)) continue;
    rmSync(path.join(root, MEDIA, name), { recursive: true, force: true });
    removed.push(`${MEDIA}/${name}`);
  }
  if (existsSync(path.join(root, RECIPES))) {
    for (const name of readdirSync(path.join(root, RECIPES)).sort()) {
      if (name === `${version}.json` || !/^\d+\.\d+\.\d+\.json$/.test(name)) continue;
      rmSync(path.join(root, RECIPES, name), { force: true });
      removed.push(`${RECIPES}/${name}`);
    }
  }
  return removed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const arg = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
  try {
    const root = arg('--root') ?? fileURLToPath(new URL('..', import.meta.url));
    const removed = keepOnly(root, arg('--version') ?? '');
    for (const r of removed) console.log(`removed ${r}`);
    if (!removed.length) console.log('nothing earlier to remove');
  } catch (err) {
    console.error(`whats-new-keep: ${err.message}`);
    process.exit(1);
  }
}
