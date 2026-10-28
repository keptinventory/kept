#!/usr/bin/env node
// Home Assistant ingress (D273) serves Kept under a prefix, so every server path the web app uses
// must go through the places that know it: the paths modules (apps/web/src/api/**/paths.ts and the
// two older modules below), whose URLs reach fetch(), where apps/web/src/lib/base-path.ts puts them
// under the prefix. A raw '/api/…' string anywhere else in the web app is one more URL to keep
// right; this fails on one, so it is named in a paths module instead.
//
// It also fails on a bare in-page link (`href="#id"`, ``href={`#id`}``): index.html has a
// `<base href>`, so a bare `#id` resolves against the base, the home page (or the ingress prefix),
// and navigates away. apps/web/src/lib/base-path.ts hashHref(id) names the page itself.
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

const BARE_HASH = /\bhref=(?:"#|'#|\{\s*[`'"]#)/;

/** The 1-based lines of `file` with a bare `href="#…"` link, outside comments and tests. */
export function bareHashLinks(file, text) {
  if (/\/test\/|\.test\.tsx?$/.test(file)) return [];
  const lines = [];
  text.split('\n').forEach((line, i) => {
    if (!COMMENT.test(line) && BARE_HASH.test(line)) lines.push(i + 1);
  });
  return lines;
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
  const hashes = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const line of rawApiPaths(file, text)) found.push(`${file}:${line}`);
    for (const line of bareHashLinks(file, text)) hashes.push(`${file}:${line}`);
  }
  if (found.length > 0) {
    console.error(
      "check-web-api-paths: a raw '/api/' path outside the paths modules (name it in apps/web/src/api/…/paths.ts):",
    );
    for (const f of found) console.error(`  ${f}`);
  }
  if (hashes.length > 0) {
    console.error(
      'check-web-api-paths: a bare href="#…" goes to the home page under <base href> (use hashHref(id) from lib/base-path.ts):',
    );
    for (const f of hashes) console.error(`  ${f}`);
  }
  if (found.length > 0 || hashes.length > 0) process.exit(1);
  console.log(
    `check-web-api-paths: ${files.length} files, server paths only in the paths modules, no bare #links`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
