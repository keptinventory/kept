#!/usr/bin/env node
// The Home Assistant app's options as Kept's environment (D272; the app spec's §5.4 and §7).
//
// Home Assistant writes the options a person sets (homeassistant/kept/config.yaml `schema`) to
// /data/options.json. kept-ha-start runs this as root before anything else and sources what it
// prints: `export NAME='value'` lines, each value quoted for the shell. Lines for the person go to
// stderr, which is the app's Log tab; no value of a secret option is ever in one.
//
// Kept's address (KEPT_PUBLIC_URL) is the `public_url` option, or, when that is empty,
// `http://<Home Assistant's host name>.local:<the app's host port>` from the Supervisor (`GET /info`
// and `GET /addons/self/info`, which every app may call without extra permissions). The guess
// assumes mDNS works on the network; the option is the fix when it doesn't.
//
//   node options.mjs [--options /data/options.json]
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'];
const CONTAINER_PORT = '8080/tcp';
const SSL_DIR = '/ssl';
/** A file name inside /ssl: no directory part, no dot-dot. */
const SSL_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/** An http(s) origin with no path, query or fragment, without a trailing slash; else null. */
function originOnly(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** The first Supervisor that removes a client's X-Remote-User-Groups and sets its own
 * (home-assistant/supervisor #7398): setup without the code trusts that header. */
export const TRUSTED_GROUPS_SUPERVISOR = [2026, 10, 4];

/** Whether `version` (`YYYY.M.P`, maybe with a suffix) is at least `min`; false when unreadable. */
export function atLeast(version, min) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(typeof version === 'string' ? version : '');
  if (!m) return false;
  for (let i = 0; i < 3; i++) {
    const a = Number(m[i + 1]);
    if (a !== min[i]) return a > min[i];
  }
  return true;
}

/**
 * The environment Kept gets from the options, and the lines to log.
 * `info` is the Supervisor's `/info` data (host name, and the Supervisor's own version), `self` its
 * `/addons/self/info` data; either may be null (the Supervisor didn't answer): then the defaults
 * hold. Both are open to every app; `/supervisor/info` would need `hassio_api`.
 */
export function appEnv({ options, info, self }) {
  const opts = options ?? {};
  const env = {};
  const lines = [];

  let ssl = opts.ssl === true;
  if (ssl) {
    const cert = text(opts.certfile) || 'fullchain.pem';
    const key = text(opts.keyfile) || 'privkey.pem';
    if (SSL_FILE.test(cert) && SSL_FILE.test(key) && !cert.includes('..') && !key.includes('..')) {
      env.KEPT_TLS_CERT_FILE = `${SSL_DIR}/${cert}`;
      env.KEPT_TLS_KEY_FILE = `${SSL_DIR}/${key}`;
    } else {
      ssl = false;
      lines.push(
        'https is off: certfile and keyfile are file names in /ssl, like fullchain.pem and privkey.pem.',
      );
    }
  }

  const ports = self && typeof self.network === 'object' ? self.network : null;
  const hostPort = ports ? ports[CONTAINER_PORT] : 8080;
  const portOff = ports !== null && (hostPort === null || hostPort === undefined);
  const host = text(info?.hostname) || 'homeassistant';
  const derived = `${ssl ? 'https' : 'http'}://${host}.local:${portOff ? 8080 : hostPort}`;

  const asked = text(opts.public_url);
  const given = asked ? originOnly(asked) : null;
  if (asked && !given) {
    lines.push(
      `Kept's address "${asked}" is ignored: it must be http(s)://host[:port], with no path.`,
    );
  }
  env.KEPT_PUBLIC_URL = given ?? derived;
  lines.unshift(
    given
      ? `Kept is at ${env.KEPT_PUBLIC_URL}`
      : `Kept is at ${env.KEPT_PUBLIC_URL} (change it in Configuration: "Kept's address")`,
  );
  if (portOff) {
    lines.push(
      "Kept's port is off (Configuration → Network): labels, phones and mail links need it. Inside Home Assistant, Kept still opens from the sidebar.",
    );
  }

  if (atLeast(info?.supervisor, TRUSTED_GROUPS_SUPERVISOR)) {
    env.KEPT_HA_TRUST_GROUPS = '1';
  } else {
    // Always written, so a value the container was started with never gets through.
    env.KEPT_HA_TRUST_GROUPS = '0';
    lines.push(
      `Setup without the code for a Home Assistant administrator needs Supervisor ${TRUSTED_GROUPS_SUPERVISOR.join('.')} or later (this one: ${info?.supervisor || 'unknown'}); the setup code is needed.`,
    );
  }

  env.KEPT_LOG_LEVEL = LOG_LEVELS.includes(opts.log_level) ? opts.log_level : 'info';
  const smtpUrl = text(opts.smtp_url);
  if (smtpUrl) env.KEPT_SMTP_URL = smtpUrl;
  const smtpFrom = text(opts.smtp_from);
  if (smtpFrom) env.KEPT_SMTP_FROM = smtpFrom;
  return { env, lines };
}

/** `export NAME='value'` lines, each value single-quoted for a POSIX shell. */
export function shellExports(env) {
  let out = '';
  for (const [name, value] of Object.entries(env)) {
    if (!/^[A-Z_][A-Z0-9_]*$/.test(name)) throw new Error(`not a variable name: ${name}`);
    out += `export ${name}='${String(value).replaceAll("'", "'\\''")}'\n`;
  }
  return out;
}

/** GET a Supervisor endpoint's `data`, or null (no token, no answer, an error). */
async function supervisor(path) {
  const token = process.env.SUPERVISOR_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`http://supervisor${path}`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body && typeof body.data === 'object' ? body.data : null;
  } catch {
    return null;
  }
}

async function main() {
  const at = process.argv.indexOf('--options');
  const file = at > 0 ? process.argv[at + 1] : '/data/options.json';
  let options = {};
  try {
    options = JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw new Error(`${file} is not valid JSON`);
  }
  const [info, self] = await Promise.all([supervisor('/info'), supervisor('/addons/self/info')]);
  const { env, lines } = appEnv({ options, info, self });
  for (const line of lines) process.stderr.write(`app: ${line}\n`);
  process.stdout.write(shellExports(env));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    process.stderr.write(`app: ${err.message}\n`);
    process.exit(1);
  });
}
