import { randomBytes, randomUUID } from 'node:crypto';
import { link, mkdir, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import type pg from 'pg';
import { CliError } from '../admin/cli.js';
import { readPasswordFileIfPresent } from '../config/db-passwords.js';

// `kept bootstrap`: Kept's four database logins and its extensions, as the Postgres superuser,
// on every `docker compose up` (the bootstrap service, before migrate). The same statements as
// charts/kept/files/roles.sh and the managed-Postgres page, so a database made by any of them
// converges: a login that is missing is created, and every login's password is set to the one
// Kept will use.
//
// Each login's password: KEPT_DB_<LOGIN>_PASSWORD when set (the .env of an install made before
// 1.13.0); else the file KEPT_DB_<LOGIN>_PASSWORD_FILE names; else a new one generated into that
// file. The serving container reads the app, auth and system files from its config volume; only
// migrate (and this) mount the owner's. Nothing here prints a password.

export type Login = 'owner' | 'app' | 'auth' | 'system';
export type BootstrapRoles = Record<Login, string>;
export type PasswordSource = 'environment' | 'file' | 'generated';

export const KEPT_ROLES: BootstrapRoles = {
  owner: 'kept_owner',
  app: 'kept_app',
  auth: 'kept_auth',
  system: 'kept_system',
};

const LOGINS: readonly Login[] = ['owner', 'app', 'auth', 'system'];
const EXTENSIONS = ['pg_trgm', 'unaccent', 'vector'] as const;

export type BootstrapOptions = {
  env: Record<string, string | undefined>;
  /** A connection as the superuser (or a managed provider's admin) to `database`. */
  connect: () => Promise<pg.Client>;
  database: string;
  /** The role names; Kept's own unless a test says otherwise. */
  roles?: BootstrapRoles;
  print: (line: string) => void;
};

const variable = (login: Login) => `KEPT_DB_${login.toUpperCase()}_PASSWORD`;

/**
 * Publishes a new password file with no window where a reader sees half of it, and without two
 * concurrent runs each keeping their own: written and fsynced under a temp name, then linked into
 * place; link() fails with EEXIST when another run got there first, and its file wins.
 */
async function publish(file: string, value: string): Promise<boolean> {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await open(tmp, 'wx', 0o600);
  try {
    await handle.writeFile(`${value}\n`);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await link(tmp, file);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw err;
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

async function resolvePassword(
  login: Login,
  env: Record<string, string | undefined>,
): Promise<{ password: string; source: PasswordSource; file: string | undefined }> {
  const given = env[variable(login)];
  const fileVar = `${variable(login)}_FILE`;
  const file = env[fileVar] || undefined;
  if (given) return { password: given, source: 'environment', file };
  if (!file) {
    throw new CliError(`${variable(login)} is unset and ${fileVar} names no file to keep it in`);
  }
  const read = () => {
    try {
      return readPasswordFileIfPresent(file, fileVar);
    } catch (err) {
      throw new CliError((err as Error).message);
    }
  };
  const existing = read();
  if (existing !== null) return { password: existing, source: 'file', file };
  const generated = randomBytes(32).toString('hex');
  if (await publish(file, generated)) return { password: generated, source: 'generated', file };
  const winner = read();
  if (winner === null) throw new CliError(`${file} vanished after another run wrote it`);
  return { password: winner, source: 'file', file };
}

export async function bootstrapDatabase(
  opts: BootstrapOptions,
): Promise<Record<Login, PasswordSource>> {
  const roles = opts.roles ?? KEPT_ROLES;
  const resolved = {} as Record<Login, Awaited<ReturnType<typeof resolvePassword>>>;
  for (const login of LOGINS) resolved[login] = await resolvePassword(login, opts.env);

  const client = await opts.connect();
  // A backend ended under it emits 'error'; unhandled, that ends the process instead of failing.
  client.on('error', () => {});
  try {
    const id = (name: string) => client.escapeIdentifier(name);
    await client.query('BEGIN');
    const { rows } = await client.query<{ rolname: string }>(
      'SELECT rolname FROM pg_roles WHERE rolname = ANY($1)',
      [LOGINS.map((login) => roles[login])],
    );
    const present = new Set(rows.map((r) => r.rolname));
    for (const login of LOGINS) {
      const role = roles[login];
      if (!present.has(role)) {
        await client.query(
          `CREATE ROLE ${id(role)} LOGIN NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS`,
        );
      }
      // A utility statement takes no bind parameters: the password goes as an escaped literal.
      await client.query(
        `ALTER ROLE ${id(role)} PASSWORD ${client.escapeLiteral(resolved[login].password)}`,
      );
    }
    // A request can't run away or sit idle inside a transaction.
    await client.query(`ALTER ROLE ${id(roles.app)} SET statement_timeout = '15s'`);
    await client.query(
      `ALTER ROLE ${id(roles.app)} SET idle_in_transaction_session_timeout = '30s'`,
    );
    for (const ext of EXTENSIONS) {
      await client.query(`CREATE EXTENSION IF NOT EXISTS ${id(ext)} WITH SCHEMA public`);
    }
    // A non-superuser admin may hand ownership to a role only while it is a member of it.
    const { rows: me } = await client.query<{ super: boolean; member: boolean }>(
      `SELECT rolsuper AS super, pg_has_role(current_user, $1, 'MEMBER') AS member
         FROM pg_roles WHERE rolname = current_user`,
      [roles.owner],
    );
    const borrow = me[0]?.super !== true && me[0]?.member !== true;
    if (borrow) await client.query(`GRANT ${id(roles.owner)} TO CURRENT_USER`);
    await client.query(`ALTER DATABASE ${id(opts.database)} OWNER TO ${id(roles.owner)}`);
    await client.query(`ALTER SCHEMA public OWNER TO ${id(roles.owner)}`);
    if (borrow) await client.query(`REVOKE ${id(roles.owner)} FROM CURRENT_USER`);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end().catch(() => {});
  }

  const outcome = {} as Record<Login, PasswordSource>;
  for (const login of LOGINS) {
    const { source, file } = resolved[login];
    outcome[login] = source;
    const said =
      source === 'environment'
        ? `password from ${variable(login)}`
        : source === 'file'
          ? `password kept in ${file}`
          : `password generated into ${file}`;
    opts.print(`kept: ${roles[login]}: ${said}`);
  }
  opts.print(`kept: the four logins and the extensions are in place in ${opts.database}`);
  return outcome;
}
