import { readFileSync } from 'node:fs';
import { EnvError } from './env.js';

// Database passwords kept in files (the Compose stack's bootstrap service writes them into the
// kept-config and kept-owner volumes). A database URL that carries a password is used exactly as
// given, which is how every install before 1.13.0 works; one without a password takes it from
// the file its `KEPT_DB_<LOGIN>_PASSWORD_FILE` names. The completed URL is what everything else
// sees (the pools, pg_dump, the restore), so nothing downstream knows about the files.

/** Each database URL and the variable naming its login's password file. */
export const DB_PASSWORD_FILES = {
  KEPT_DATABASE_URL: 'KEPT_DB_APP_PASSWORD_FILE',
  KEPT_AUTH_DATABASE_URL: 'KEPT_DB_AUTH_PASSWORD_FILE',
  KEPT_SYSTEM_DATABASE_URL: 'KEPT_DB_SYSTEM_PASSWORD_FILE',
  KEPT_OWNER_DATABASE_URL: 'KEPT_DB_OWNER_PASSWORD_FILE',
} as const;

/** The longest password a file may hold. */
export const MAX_DB_PASSWORD_LENGTH = 1024;

type Source = Record<string, string | undefined>;
type Read = (file: string, encoding: 'utf8') => string;

// biome-ignore lint/suspicious/noControlCharactersInRegex: the point is to find them.
const CONTROL = /[\u0000-\u001f\u007f]/;

/**
 * Reads one password file: one line, its trailing line break dropped. The messages name the
 * file, never its content.
 */
export function readPasswordFile(
  file: string,
  variable: string,
  read: Read = readFileSync,
): string {
  const value = readPasswordFileIfPresent(file, variable, read);
  if (value === null) throw new EnvError(`${variable}: ${file} does not exist`, 'invalid_env');
  return value;
}

/** As readPasswordFile, but null when the file does not exist. */
export function readPasswordFileIfPresent(
  file: string,
  variable: string,
  read: Read = readFileSync,
): string | null {
  let raw: string;
  try {
    raw = read(file, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new EnvError(
      `${variable}: ${file} could not be read (${(err as NodeJS.ErrnoException).code ?? 'error'})`,
      'invalid_env',
    );
  }
  const value = raw.replace(/\r?\n$/, '');
  if (value === '' || value.length > MAX_DB_PASSWORD_LENGTH || CONTROL.test(value)) {
    throw new EnvError(
      `${variable}: ${file} must hold one password on one line (1 to ${MAX_DB_PASSWORD_LENGTH} characters)`,
      'invalid_env',
    );
  }
  return value;
}

/** A copy of `source` with every password-less database URL completed from its file. */
export function completeDatabaseUrls(source: Source, read: Read = readFileSync): Source {
  const out: Source = { ...source };
  for (const [urlVar, fileVar] of Object.entries(DB_PASSWORD_FILES)) {
    const raw = source[urlVar];
    const file = source[fileVar];
    if (!raw || !file) continue;
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      continue; // The schema reports a malformed URL as what it is.
    }
    if (url.password !== '') continue;
    let password: string;
    try {
      password = readPasswordFile(file, fileVar, read);
    } catch (err) {
      if (!(err instanceof EnvError)) throw err;
      throw new EnvError(
        `${urlVar} has no password, and ${err.message}; Compose's bootstrap service writes it (it runs before migrate on every \`docker compose up\`)`,
        'invalid_env',
      );
    }
    url.password = encodeURIComponent(password);
    out[urlVar] = url.toString();
  }
  return out;
}

/** Completes the database URLs in `env` in place: the entrypoints call it before anything else
 * reads them. */
export function applyDatabasePasswordFiles(env: Source = process.env): void {
  const completed = completeDatabaseUrls(env);
  for (const urlVar of Object.keys(DB_PASSWORD_FILES)) {
    if (completed[urlVar] !== env[urlVar]) env[urlVar] = completed[urlVar];
  }
}
