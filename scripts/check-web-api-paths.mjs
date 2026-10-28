#!/usr/bin/env node
// Home Assistant ingress (D273) serves Kept under a prefix, so every server path the web app uses
// must go through the places that know it: the paths modules (apps/web/src/api/**/paths.ts and the
// two older modules below), whose URLs reach fetch(), where apps/web/src/lib/base-path.ts puts them
// under the prefix. A raw '/api/…' string anywhere else in the web app is one more URL to keep
// right; this fails on one, so it is named in a paths module instead.
//
// Usage: node scripts/check-web-api-paths.mjs   (part of `pnpm lint`)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Modules that may name server paths besides apps/web/src/api/**\/paths.ts. */
const ALLOWED = new Set([
  'apps/web/src/api/inventory/codes.ts',
  'apps/web/src/api/portability/queries.ts',
  // The in-browser demo routes every /api/ request to its mock.
  'apps/web/src/demo.ts',
]);

const RAW = /['"`]\/api\//;
const COMMENT = /^\s*(?:\/\/|\/?\*)/;

function allowed(file) {
  if (ALLOWED.has(file)) return true;
  if (/^apps\/web\/src\/api\/(?:.+\/)?paths\.ts$/.test(file)) return true;
  if (/\/mock\/|\/test\/|\.test\.tsx?$/.test(file)) return true;
  return false;
}

/** The 1-based lines of `file` with a raw '/api/' string literal, outside comments. */
export function rawApiPaths(file, text) {
  if (allowed(file)) return [];
  const lines = [];
  text.split('\n').forEach((line, i) => {
    if (!COMMENT.test(line) && RAW.test(line)) lines.push(i + 1);
  });
  return lines;
}

function main() {
  const files = execFileSync('git', ['ls-files', '-z', 'apps/web/src'], { encoding: 'utf8' })
    .split('\0')
    .filter((f) => /\.(?:ts|tsx)$/.test(f));
  const found = [];
  for (const file of files) {
    for (const line of rawApiPaths(file, readFileSync(file, 'utf8'))) found.push(`${file}:${line}`);
  }
  if (found.length > 0) {
    console.error(
      "check-web-api-paths: a raw '/api/' path outside the paths modules (name it in apps/web/src/api/…/paths.ts):",
    );
    for (const f of found) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log(`check-web-api-paths: ${files.length} files, server paths only in the paths modules`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
