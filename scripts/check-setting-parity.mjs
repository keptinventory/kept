#!/usr/bin/env node
// Fails when a KEPT_* setting is added in one place and not the others. Every setting Kept reads
// (apps/server/src/config/env.ts) must be:
//
//   1. in compose.env.example, where people set it, or on NOT_IN_ENV_EXAMPLE with the reason;
//   2. passed through by compose.yaml (`${KEPT_X…}`) if it is in compose.env.example: a value in
//      `.env` that compose.yaml doesn't hand to the container, or overrides with a fixed value,
//      never reaches Kept;
//   3. mapped by the Home Assistant app (docker/ha/options.mjs, its start script, the steps it
//      shares with the Unraid image in docker/one-container.sh, or the Dockerfile), or
//      on NOT_IN_HA_APP with the reason: the app's settings come from its options, not `.env`.
//
// And no file names a KEPT_* setting env.ts doesn't know (a typo, or one that was removed).
// The configuration reference is checked by the docs step (`pnpm --filter @kept/docs check:config`).
//
// Usage: node scripts/check-setting-parity.mjs   (part of `pnpm lint`)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Settings people don't set in compose.env.example, each with why. */
export const NOT_IN_ENV_EXAMPLE = {
  // compose.yaml sets these itself: the databases, their passwords, the files and the role.
  KEPT_AUTH_DATABASE_URL: 'compose.yaml sets it',
  KEPT_DATABASE_URL: 'compose.yaml sets it',
  KEPT_SYSTEM_DATABASE_URL: 'compose.yaml sets it',
  KEPT_DB_APP_PASSWORD_FILE: 'compose.yaml sets it',
  KEPT_DB_AUTH_PASSWORD_FILE: 'compose.yaml sets it',
  KEPT_DB_OWNER_PASSWORD_FILE: 'compose.yaml sets it',
  KEPT_DB_SYSTEM_PASSWORD_FILE: 'compose.yaml sets it',
  KEPT_DATA_DIR: 'compose.yaml sets it',
  KEPT_ROLE: 'compose.yaml sets it',
  KEPT_SOURCE_URL: 'compose.yaml sets it',
  // The image's own paths and port.
  KEPT_CONFIG_DIR: "the image's default",
  KEPT_EMBEDDINGS_DIR: "the image's default",
  KEPT_RESTIC_BIN: "the image's default",
  KEPT_RESTIC_CACHE_DIR: "the image's default",
  KEPT_PORT: "the image's default",
  // Tests and development only.
  KEPT_AI_MOCK: 'tests only',
  KEPT_EVAL_DIR: 'development only',
  // The Home Assistant app's own.
  KEPT_HA: 'the Home Assistant app sets it',
  KEPT_HA_TRUST_GROUPS: 'the Home Assistant app sets it',
  KEPT_HA_LINK_SECRET_FILE: 'the Home Assistant app sets it',
  // Kept serving TLS itself and rotating its key: the HTTPS page and the key runbook.
  KEPT_TLS_CERT_FILE: 'documented on the HTTPS page',
  KEPT_TLS_KEY_FILE: 'documented on the HTTPS page',
  KEPT_SECRET_KEY_VERSION: 'a key-rotation runbook step',
  KEPT_SECRET_KEYS_RETIRED: 'a key-rotation runbook step',
  // Not in the example as of 1.14.4; decide when someone asks.
  KEPT_APPRISE_URL: 'not in the example as of 1.14.4',
  KEPT_BACKUP_KEEP: 'not in the example as of 1.14.4',
  KEPT_ERROR_DSN: 'not in the example as of 1.14.4',
};

/** Settings compose.env.example names that compose.yaml doesn't take from .env, each with why. */
export const NOT_PASSED_BY_COMPOSE = {
  KEPT_OWNER_DATABASE_URL:
    'compose.yaml builds it for migrate only; the serving process gets it from a compose.override.yaml, on purpose',
};

/** Settings the Home Assistant app doesn't offer or set, each with why. */
export const NOT_IN_HA_APP = {
  // Not offered on purpose (homeassistant/kept/config.yaml): S3 file storage, and Kept's own
  // backups, since Home Assistant's backups are the backup here.
  ...Object.fromEntries(
    [
      'KEPT_STORAGE',
      'KEPT_S3_ACCESS_KEY_ID',
      'KEPT_S3_BUCKET',
      'KEPT_S3_ENDPOINT',
      'KEPT_S3_FORCE_PATH_STYLE',
      'KEPT_S3_PUBLIC_ENDPOINT',
      'KEPT_S3_REGION',
      'KEPT_S3_SECRET_ACCESS_KEY',
    ].map((k) => [k, 'S3 file storage is not offered in the app']),
  ),
  ...Object.fromEntries(
    [
      'KEPT_BACKUP_DIR',
      'KEPT_BACKUP_KEEP',
      'KEPT_BACKUP_KEEP_DAILY',
      'KEPT_BACKUP_KEEP_MONTHLY',
      'KEPT_BACKUP_KEEP_WEEKLY',
      'KEPT_BACKUP_PASSWORD',
      'KEPT_BACKUP_S3_ACCESS_KEY_ID',
      'KEPT_BACKUP_S3_BUCKET',
      'KEPT_BACKUP_S3_ENDPOINT',
      'KEPT_BACKUP_S3_FORCE_PATH_STYLE',
      'KEPT_BACKUP_S3_PREFIX',
      'KEPT_BACKUP_S3_REGION',
      'KEPT_BACKUP_S3_SECRET_ACCESS_KEY',
      'KEPT_BACKUP_SFTP',
      'KEPT_BACKUP_SFTP_KEY_FILE',
      'KEPT_BACKUP_SFTP_KNOWN_HOSTS',
      'KEPT_BACKUP_TIME',
    ].map((k) => [k, "Home Assistant's backups are the backup here"]),
  ),
  KEPT_AI_MOCK: 'tests only',
  KEPT_EVAL_DIR: 'development only',
  // Not offered in the app as of 1.14.4; decide when someone asks.
  ...Object.fromEntries(
    [
      'KEPT_ALLOW_DOWNGRADE',
      'KEPT_AUTH_SECRET',
      'KEPT_BARCODE_CONTACT',
      'KEPT_BARCODE_LOOKUP',
      'KEPT_EMBEDDINGS',
      'KEPT_EMBEDDINGS_DIR',
      'KEPT_ERROR_DSN',
      'KEPT_IMAGE_CONCURRENCY',
      'KEPT_METRICS_TOKEN',
      'KEPT_RESTIC_CACHE_DIR',
      'KEPT_SECRET_KEY',
      'KEPT_SECRET_KEY_VERSION',
      'KEPT_SECRET_KEYS_RETIRED',
      'KEPT_SETUP_CODE',
      'KEPT_UPDATE_CHECK',
      'KEPT_UPGRADE_SNAPSHOT',
      'KEPT_VAPID_PRIVATE_KEY',
      'KEPT_VAPID_PUBLIC_KEY',
      'KEPT_VAPID_SUBJECT',
    ].map((k) => [k, 'not offered in the app as of 1.14.4']),
  ),
};

/** Names that are KEPT_* but not settings env.ts reads: build-time values, the Home Assistant
 * app's own, and compose's own variables (the database passwords its init step writes, the port
 * and image it publishes, Caddy's domain). */
const NOT_SETTINGS = new Set([
  'KEPT_VERSION',
  'KEPT_REVISION',
  'KEPT_HA_DEMO',
  'KEPT_USER',
  'KEPT_DOMAIN',
  'KEPT_DB_',
  'KEPT_DB_APP_PASSWORD',
  'KEPT_DB_AUTH_PASSWORD',
  'KEPT_DB_OWNER_PASSWORD',
  'KEPT_DB_SUPERUSER_PASSWORD',
  'KEPT_DB_SYSTEM_PASSWORD',
  'KEPT_HTTP_PORT',
  'KEPT_IMAGE',
]);

const NAME = /\bKEPT_[A-Z0-9_]+\b/g;
const namesIn = (text) => new Set(text.match(NAME) ?? []);
/** The settings a compose file takes from .env: `${KEPT_X}`, `${KEPT_X:-…}` and the like. A
 * fixed value (`KEPT_X: 1.2.3.4`) names the setting but never reads .env (#414). */
const passedIn = (text) => new Set([...text.matchAll(/\$\{(KEPT_[A-Z0-9_]+)\b/g)].map((m) => m[1]));

/** The settings env.ts declares: its schema's `KEPT_X:` keys. */
export function settingsIn(envTs) {
  return new Set([...envTs.matchAll(/^\s+(KEPT_[A-Z0-9_]+)\s*:/gm)].map((m) => m[1]));
}

/** Every problem, as one line each; empty when all is well. */
export function problems({
  envTs,
  envExample,
  composeYaml,
  haFiles,
  notInEnvExample = NOT_IN_ENV_EXAMPLE,
  notInHaApp = NOT_IN_HA_APP,
  notPassedByCompose = NOT_PASSED_BY_COMPOSE,
}) {
  const settings = settingsIn(envTs);
  const example = namesIn(envExample);
  const compose = namesIn(composeYaml);
  const passed = passedIn(composeYaml);
  const ha = namesIn(haFiles.join('\n'));
  const out = [];
  for (const s of [...settings].sort()) {
    if (!example.has(s) && !(s in notInEnvExample))
      out.push(`${s}: not in compose.env.example (add it, or to NOT_IN_ENV_EXAMPLE with why)`);
    if (!ha.has(s) && !(s in notInHaApp))
      out.push(
        `${s}: not in the Home Assistant app (map it in docker/ha/options.mjs, or add it to NOT_IN_HA_APP with why)`,
      );
  }
  for (const s of [...example].sort()) {
    if (settings.has(s) && !passed.has(s) && !(s in notPassedByCompose))
      out.push(`${s}: in compose.env.example but compose.yaml doesn't pass it to the container`);
  }
  const named = new Map([
    ['compose.env.example', example],
    ['compose.yaml', compose],
    ['the Home Assistant app', ha],
  ]);
  for (const [where, names] of named)
    for (const s of [...names].sort())
      if (!settings.has(s) && !NOT_SETTINGS.has(s))
        out.push(`${s}: named in ${where}, but env.ts reads no such setting`);
  for (const s of Object.keys({ ...notInEnvExample, ...notInHaApp }))
    if (!settings.has(s)) out.push(`${s}: on an exception list, but env.ts reads no such setting`);
  for (const s of Object.keys(notInEnvExample))
    if (example.has(s)) out.push(`${s}: in compose.env.example, so take it off NOT_IN_ENV_EXAMPLE`);
  for (const s of Object.keys(notInHaApp))
    if (ha.has(s)) out.push(`${s}: the Home Assistant app sets it, so take it off NOT_IN_HA_APP`);
  for (const s of Object.keys(notPassedByCompose))
    if (passed.has(s))
      out.push(`${s}: compose.yaml takes it from .env, so take it off NOT_PASSED_BY_COMPOSE`);
  return [...new Set(out)];
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const read = (p) => readFileSync(path.join(repo, p), 'utf8');
  const found = problems({
    envTs: read('apps/server/src/config/env.ts'),
    envExample: read('compose.env.example'),
    composeYaml: read('compose.yaml'),
    haFiles: [
      'docker/ha/options.mjs',
      'docker/ha/kept-ha-start',
      'docker/ha/kept-ha-backup',
      'docker/one-container.sh',
      'Dockerfile',
    ].map(read),
  });
  if (found.length > 0) {
    console.error('KEPT_* settings out of step (scripts/check-setting-parity.mjs):');
    for (const p of found) console.error(`  ${p}`);
    process.exit(1);
  }
}
