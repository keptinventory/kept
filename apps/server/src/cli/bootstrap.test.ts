import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withSuperuser } from '../../test/db.js';
import { type BootstrapRoles, bootstrapDatabase } from './bootstrap.js';

// The real roles are cluster-wide and shared by every test worker, so this runs the same code
// under scratch role names, in a scratch database, and drops both afterwards.
const tag = `kept_bt_${randomBytes(4).toString('hex')}`;
const roles: BootstrapRoles = {
  owner: `${tag}_owner`,
  app: `${tag}_app`,
  auth: `${tag}_auth`,
  system: `${tag}_system`,
};
const database = tag;
const HOST = 'localhost';
const PORT = 5452;

let dir: string;
let lines: string[];

function files() {
  return {
    KEPT_DB_OWNER_PASSWORD_FILE: path.join(dir, 'owner', roles.owner),
    KEPT_DB_APP_PASSWORD_FILE: path.join(dir, 'database', roles.app),
    KEPT_DB_AUTH_PASSWORD_FILE: path.join(dir, 'database', roles.auth),
    KEPT_DB_SYSTEM_PASSWORD_FILE: path.join(dir, 'database', roles.system),
  };
}

function run(env: Record<string, string | undefined> = {}) {
  lines = [];
  return bootstrapDatabase({
    env: { ...files(), ...env },
    connect: async () => {
      const client = new pg.Client({
        connectionString: `postgres://postgres:postgres@${HOST}:${PORT}/${database}`,
      });
      await client.connect();
      return client;
    },
    database,
    roles,
    print: (line) => lines.push(line),
  });
}

/** Logs in as `role` over TCP (the dev cluster checks passwords on TCP). */
async function canLogIn(role: string, password: string): Promise<boolean> {
  const client = new pg.Client({ host: HOST, port: PORT, user: role, password, database });
  client.on('error', () => {});
  try {
    await client.connect();
    await client.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

const read = async (file: string) => (await readFile(file, 'utf8')).trim();

async function roleRows() {
  return withSuperuser(async (c) => {
    const { rows } = await c.query(
      `SELECT rolname, rolcanlogin, rolsuper, rolcreaterole, rolcreatedb, rolbypassrls,
              coalesce(rolconfig, '{}') AS config
         FROM pg_roles WHERE rolname LIKE $1 ORDER BY rolname`,
      [`${tag}\\_%`],
    );
    return rows;
  });
}

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'kept-bootstrap-'));
  await withSuperuser((c) => c.query(`CREATE DATABASE ${database}`));
});

afterAll(async () => {
  await withSuperuser(async (c) => {
    await c.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    for (const role of Object.values(roles)) await c.query(`DROP ROLE IF EXISTS ${role}`);
  });
  await rm(dir, { recursive: true, force: true });
});

describe('kept bootstrap', () => {
  it('first run: makes the four logins, the extensions and the ownership, and generates the passwords', async () => {
    const result = await run();
    expect(result).toEqual({
      owner: 'generated',
      app: 'generated',
      auth: 'generated',
      system: 'generated',
    });

    const rows = await roleRows();
    expect(rows.map((r) => r.rolname)).toEqual(
      [roles.app, roles.auth, roles.owner, roles.system].sort(),
    );
    for (const r of rows) {
      expect(r).toMatchObject({
        rolcanlogin: true,
        rolsuper: false,
        rolcreaterole: false,
        rolcreatedb: false,
        rolbypassrls: false,
      });
    }
    const app = rows.find((r) => r.rolname === roles.app);
    expect([...app.config].sort()).toEqual([
      'idle_in_transaction_session_timeout=30s',
      'statement_timeout=15s',
    ]);

    const facts = await withSuperuser(async (c) => {
      const owner = await c.query(
        `SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname = $1`,
        [database],
      );
      return owner.rows[0]?.owner;
    });
    expect(facts).toBe(roles.owner);
    const inDb = new pg.Client({
      connectionString: `postgres://postgres:postgres@${HOST}:${PORT}/${database}`,
    });
    await inDb.connect();
    try {
      const ext = await inDb.query(
        `SELECT extname FROM pg_extension WHERE extname IN ('pg_trgm', 'unaccent', 'vector') ORDER BY 1`,
      );
      expect(ext.rows.map((r) => r.extname)).toEqual(['pg_trgm', 'unaccent', 'vector']);
      const schema = await inDb.query(
        `SELECT pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname = 'public'`,
      );
      expect(schema.rows[0]?.owner).toBe(roles.owner);
    } finally {
      await inDb.end();
    }

    for (const [login, file] of Object.entries(files())) {
      const info = await stat(file);
      expect(info.mode & 0o777, login).toBe(0o600);
      expect(await read(file)).toMatch(/^[0-9a-f]{64}$/);
    }
    const parent = await stat(path.join(dir, 'database'));
    expect(parent.mode & 0o777).toBe(0o700);

    expect(await canLogIn(roles.owner, await read(files().KEPT_DB_OWNER_PASSWORD_FILE))).toBe(true);
    expect(await canLogIn(roles.app, await read(files().KEPT_DB_APP_PASSWORD_FILE))).toBe(true);
    expect(await canLogIn(roles.auth, await read(files().KEPT_DB_AUTH_PASSWORD_FILE))).toBe(true);
    expect(await canLogIn(roles.system, await read(files().KEPT_DB_SYSTEM_PASSWORD_FILE))).toBe(
      true,
    );
  });

  it('second run changes nothing: the same files, the same roles, every login still works', async () => {
    const before = await Promise.all(Object.values(files()).map((f) => readFile(f)));
    const rowsBefore = await roleRows();

    const result = await run();
    expect(result).toEqual({ owner: 'file', app: 'file', auth: 'file', system: 'file' });

    const after = await Promise.all(Object.values(files()).map((f) => readFile(f)));
    expect(after).toEqual(before);
    expect(await roleRows()).toEqual(rowsBefore);
    expect(await canLogIn(roles.app, await read(files().KEPT_DB_APP_PASSWORD_FILE))).toBe(true);
    expect(await canLogIn(roles.owner, await read(files().KEPT_DB_OWNER_PASSWORD_FILE))).toBe(true);
  });

  it('a password set in the environment wins, is applied, and is not written to a file', async () => {
    const fileBefore = await read(files().KEPT_DB_AUTH_PASSWORD_FILE);
    const fromEnv = randomBytes(16).toString('hex');
    const result = await run({ KEPT_DB_AUTH_PASSWORD: fromEnv });
    expect(result.auth).toBe('environment');
    expect(await read(files().KEPT_DB_AUTH_PASSWORD_FILE)).toBe(fileBefore);
    expect(await canLogIn(roles.auth, fromEnv)).toBe(true);
    expect(await canLogIn(roles.auth, fileBefore)).toBe(false);

    // Back to the file on the next run without the variable: the role follows.
    expect((await run()).auth).toBe('file');
    expect(await canLogIn(roles.auth, fileBefore)).toBe(true);
  });

  it('a lost password file is generated again and the role takes it, so nothing is locked out', async () => {
    const old = await read(files().KEPT_DB_SYSTEM_PASSWORD_FILE);
    await unlink(files().KEPT_DB_SYSTEM_PASSWORD_FILE);
    const result = await run();
    expect(result.system).toBe('generated');
    const fresh = await read(files().KEPT_DB_SYSTEM_PASSWORD_FILE);
    expect(fresh).not.toBe(old);
    expect(await canLogIn(roles.system, fresh)).toBe(true);
    expect(await canLogIn(roles.system, old)).toBe(false);
  });

  it('a password with quotes and backslashes is set literally', async () => {
    const tricky = `it's a \\'; DROP ROLE ${roles.app}; --`;
    await writeFile(files().KEPT_DB_APP_PASSWORD_FILE, `${tricky}\n`, { mode: 0o600 });
    await run();
    expect(await canLogIn(roles.app, tricky)).toBe(true);
    expect((await roleRows()).map((r) => r.rolname)).toContain(roles.app);
  });

  it('refuses a login with neither a password nor a file to keep one in', async () => {
    await expect(
      bootstrapDatabase({
        env: { ...files(), KEPT_DB_OWNER_PASSWORD_FILE: '' },
        connect: () => Promise.reject(new Error('must not connect')),
        database,
        roles,
        print: () => {},
      }),
    ).rejects.toThrow(/KEPT_DB_OWNER_PASSWORD_FILE/);
  });

  it('never prints a password', async () => {
    const fromEnv = randomBytes(16).toString('hex');
    await run({ KEPT_DB_OWNER_PASSWORD: fromEnv });
    const printed = lines.join('\n');
    expect(lines.length).toBeGreaterThan(0);
    expect(printed).not.toContain(fromEnv);
    for (const file of Object.values(files())) {
      expect(printed).not.toContain(await read(file));
    }
    await run();
  });
});
