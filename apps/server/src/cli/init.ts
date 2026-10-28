import { randomUUID } from 'node:crypto';
import { open, readFile, rename, unlink } from 'node:fs/promises';
import { isIP } from 'node:net';
import path from 'node:path';
import { CliError } from '../admin/cli.js';
import { formatSetupCode, generateSetupCode, isSetupCodeShape } from '../setup/setup-code.js';

// `kept init`: the first step of a Compose install, run as `docker compose run --rm init`.
// It asks for the address Kept will be opened at and writes `.env` next to compose.yaml with
// that address, the port, the image and a preset setup code, then shows the code. It writes no
// password: the bootstrap service generates the database's on first start. Run again over an
// existing `.env`, it changes only the lines it owns and keeps every other one (an operator's
// own KEPT_SECRET_KEY must never be lost).

export type InitIO = {
  /** Shows the question and returns the typed line. */
  ask: (question: string) => Promise<string>;
  print: (line: string) => void;
  /** A person at a terminal: questions may be asked. */
  interactive: boolean;
};

export type InitOptions = {
  dir: string;
  /** The address, given on the command line; nothing is asked. */
  url?: string | undefined;
  /** The running image's version: a release is pinned into KEPT_IMAGE. */
  version: string;
  io: InitIO;
  generateCode?: () => string;
  /** Gives the new file to the folder's owner (the container runs as root to write it). */
  chownTo?: (file: string) => void;
};

export type InitResult = {
  file: string;
  code: string;
  publicUrl: string;
  /** An existing .env was updated rather than a new one written. */
  merged: boolean;
  written: boolean;
};

export type AddressNote = 'assumed-http' | 'ip' | 'localhost' | 'https-proxy';
export type Address = { url: string; port: number | null; notes: AddressNote[] };

export const IMAGE_REPOSITORY = 'ghcr.io/keptinventory/kept';
const RELEASE = /^\d+\.\d+\.\d+$/;

/** The address as Kept needs it (scheme, host and port only), or an Error saying why not. */
export function parseAddress(input: string): Address {
  let text = input.trim();
  if (text === '') throw new Error('Type the address, such as http://kept.home.arpa:8080.');
  const notes: AddressNote[] = [];
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
    text = `http://${text}`;
    notes.push('assumed-http');
  }
  let u: URL;
  try {
    u = new URL(text);
  } catch {
    throw new Error(`"${input.trim()}" is not an address. Try http://kept.home.arpa:8080.`);
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('Start the address with http:// or https://.');
  }
  if (u.hostname === '') throw new Error('Type the address, such as http://kept.home.arpa:8080.');
  if (u.username || u.password) throw new Error('Leave the user name or password out.');
  if (u.pathname !== '/' || u.search || u.hash) {
    throw new Error('Only the name and port: no path after them (Kept serves from the root).');
  }
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '::1' ||
    host.startsWith('127.')
  ) {
    notes.push('localhost');
  } else if (isIP(host)) {
    notes.push('ip');
  }
  if (u.protocol === 'https:') notes.push('https-proxy');
  const port = u.protocol === 'http:' ? Number(u.port || 80) : null;
  return { url: u.origin, port, notes };
}

const yes = (answer: string, byDefault: boolean) => {
  const a = answer.trim().toLowerCase();
  return a === '' ? byDefault : a === 'y' || a === 'yes';
};

const IP_WARNING =
  'That is an IP address. If this machine is ever given a new one, the labels you printed point nowhere. A name set in your router (or in each device’s hosts file) avoids that.';
const LOCALHOST_WARNING =
  'Only this machine can open localhost: phones and other computers on your network can’t.';

async function askAddress(io: InitIO): Promise<Address> {
  for (;;) {
    let address: Address;
    try {
      address = parseAddress(await io.ask('Address: '));
    } catch (err) {
      io.print((err as Error).message);
      continue;
    }
    const warning = address.notes.includes('ip')
      ? IP_WARNING
      : address.notes.includes('localhost')
        ? LOCALHOST_WARNING
        : null;
    if (warning) {
      io.print(warning);
      if (!yes(await io.ask(`Use ${address.url} anyway? [y/N] `), false)) continue;
    }
    return address;
  }
}

/** Replaces each NAME= line (every occurrence) or appends it; every other line stays as it was. */
function merge(text: string, values: ReadonlyMap<string, string>): string {
  const seen = new Set<string>();
  const lines = text.replace(/\n$/, '').split('\n');
  const out: string[] = [];
  for (const l of lines) {
    const name = /^([A-Z_][A-Z0-9_]*)=/.exec(l)?.[1];
    if (name && values.has(name)) {
      if (seen.has(name)) continue;
      seen.add(name);
      out.push(`${name}=${values.get(name)}`);
    } else {
      out.push(l);
    }
  }
  const missing = [...values].filter(([name]) => !seen.has(name));
  if (missing.length > 0) {
    out.push('', '# Set by `kept init`.', ...missing.map(([name, value]) => `${name}=${value}`));
  }
  return `${out.join('\n')}\n`;
}

function fresh(values: ReadonlyMap<string, string>): string {
  return [
    '# Written by `kept init`. compose.env.example in the Kept repository explains every other',
    '# setting. The database passwords are not here: the bootstrap service generates them on',
    '# first start into the kept-config and kept-owner volumes.',
    ...[...values].map(([name, value]) => `${name}=${value}`),
    '',
  ].join('\n');
}

function lastValue(text: string, name: string): string | undefined {
  const all = text.split('\n').filter((l) => l.startsWith(`${name}=`));
  return all
    .at(-1)
    ?.slice(name.length + 1)
    .trim();
}

/** Writes beside the target, then renames it into place: never a half-written .env. */
async function writeAtomically(file: string, text: string, chownTo?: (file: string) => void) {
  const tmp = path.join(path.dirname(file), `.env.${randomUUID()}.tmp`);
  const handle = await open(tmp, 'wx', 0o600);
  try {
    await handle.writeFile(text);
    await handle.sync();
    await handle.close();
    chownTo?.(tmp);
    await rename(tmp, file);
  } catch (err) {
    await handle.close().catch(() => {});
    await unlink(tmp).catch(() => {});
    throw err;
  }
}

export async function runInit(opts: InitOptions): Promise<InitResult> {
  const { io } = opts;
  const file = path.join(opts.dir, '.env');
  let existing: string | null = null;
  try {
    existing = await readFile(file, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  if (!opts.url && !io.interactive) {
    throw new CliError(
      'kept init asks for the address Kept will be opened at; without a terminal, give it with --url (e.g. --url http://kept.home.arpa:8080)',
    );
  }

  io.print('Kept: setting up this install.');
  if (existing !== null && io.interactive && !opts.url) {
    const update = await io.ask(
      'A .env is here already. Update its address and setup code, and keep everything else? [Y/n] ',
    );
    if (!yes(update, true)) {
      io.print('Nothing changed.');
      return { file, code: '', publicUrl: '', merged: false, written: false };
    }
  }

  let address: Address;
  if (opts.url) {
    try {
      address = parseAddress(opts.url);
    } catch (err) {
      throw new CliError((err as Error).message);
    }
    if (address.notes.includes('ip')) io.print(IP_WARNING);
    if (address.notes.includes('localhost')) io.print(LOCALHOST_WARNING);
  } else {
    io.print(
      'Which address will you open Kept at? Printed labels carry it in their QR codes, so choose one that won’t change: a name such as http://kept.home.arpa:8080 or https://kept.example.org rather than an IP address.',
    );
    address = await askAddress(io);
  }
  if (address.notes.includes('assumed-http')) io.print(`Using ${address.url}.`);
  if (address.notes.includes('https-proxy')) {
    io.print(
      `Kept itself serves plain HTTP on KEPT_HTTP_PORT (8080); a proxy with the certificate serves ${address.url} (the https profile, or your own).`,
    );
  }

  const kept = existing !== null ? lastValue(existing, 'KEPT_SETUP_CODE') : undefined;
  const code = formatSetupCode(
    kept && isSetupCodeShape(kept) ? kept : (opts.generateCode ?? generateSetupCode)(),
  );
  const values = new Map<string, string>();
  if (existing === null && RELEASE.test(opts.version)) {
    values.set('KEPT_IMAGE', `${IMAGE_REPOSITORY}:${opts.version}`);
  }
  values.set('KEPT_PUBLIC_URL', address.url);
  if (address.port !== null) values.set('KEPT_HTTP_PORT', String(address.port));
  values.set('KEPT_SETUP_CODE', code);

  await writeAtomically(
    file,
    existing !== null ? merge(existing, values) : fresh(values),
    opts.chownTo,
  );

  io.print(existing !== null ? 'Updated .env.' : 'Wrote .env.');
  io.print('');
  io.print(`KEPT SETUP CODE: ${code}`);
  io.print('');
  io.print(`Next: docker compose up -d, then open ${address.url} and enter the setup code.`);
  return { file, code, publicUrl: address.url, merged: existing !== null, written: true };
}
