import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  applyDatabasePasswordFiles,
  completeDatabaseUrls,
  DB_PASSWORD_FILES,
} from './db-passwords.js';
import { EnvError } from './env.js';

const dir = mkdtempSync(path.join(tmpdir(), 'kept-dbpw-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function file(name: string, body: string): string {
  const p = path.join(dir, name);
  writeFileSync(p, body, { mode: 0o600 });
  return p;
}

describe('database password files', () => {
  it('maps each database URL to its own file variable', () => {
    expect(DB_PASSWORD_FILES).toEqual({
      KEPT_DATABASE_URL: 'KEPT_DB_APP_PASSWORD_FILE',
      KEPT_AUTH_DATABASE_URL: 'KEPT_DB_AUTH_PASSWORD_FILE',
      KEPT_SYSTEM_DATABASE_URL: 'KEPT_DB_SYSTEM_PASSWORD_FILE',
      KEPT_OWNER_DATABASE_URL: 'KEPT_DB_OWNER_PASSWORD_FILE',
    });
  });

  it('fills a URL without a password from its file, URL-encoded, the line break dropped', () => {
    const f = file('kept_app', 'p@ss/word:x\n');
    const out = completeDatabaseUrls({
      KEPT_DATABASE_URL: 'postgres://kept_app:@db:5432/kept',
      KEPT_DB_APP_PASSWORD_FILE: f,
    });
    expect(out.KEPT_DATABASE_URL).toBe('postgres://kept_app:p%40ss%2Fword%3Ax@db:5432/kept');
    expect(new URL(out.KEPT_DATABASE_URL as string).password).toBe('p%40ss%2Fword%3Ax');
    expect(decodeURIComponent(new URL(out.KEPT_DATABASE_URL as string).password)).toBe(
      'p@ss/word:x',
    );
  });

  it('fills a URL that names no password at all, and leaves the source untouched', () => {
    const f = file('kept_owner', 'abc123\r\n');
    const source = {
      KEPT_OWNER_DATABASE_URL: 'postgres://kept_owner@db:5432/kept',
      KEPT_DB_OWNER_PASSWORD_FILE: f,
    };
    const out = completeDatabaseUrls(source);
    expect(out.KEPT_OWNER_DATABASE_URL).toBe('postgres://kept_owner:abc123@db:5432/kept');
    expect(source.KEPT_OWNER_DATABASE_URL).toBe('postgres://kept_owner@db:5432/kept');
  });

  it('keeps a URL that carries a password and never reads the file', () => {
    const out = completeDatabaseUrls(
      {
        KEPT_AUTH_DATABASE_URL: 'postgres://kept_auth:fromenv@db:5432/kept',
        KEPT_DB_AUTH_PASSWORD_FILE: path.join(dir, 'missing'),
      },
      () => {
        throw new Error('read');
      },
    );
    expect(out.KEPT_AUTH_DATABASE_URL).toBe('postgres://kept_auth:fromenv@db:5432/kept');
  });

  it('leaves a URL without a password alone when no file is named', () => {
    const out = completeDatabaseUrls({ KEPT_SYSTEM_DATABASE_URL: 'postgres://kept_system@db/k' });
    expect(out.KEPT_SYSTEM_DATABASE_URL).toBe('postgres://kept_system@db/k');
  });

  it('ignores an empty file variable, as an unset one', () => {
    const out = completeDatabaseUrls({
      KEPT_SYSTEM_DATABASE_URL: 'postgres://kept_system:@db/k',
      KEPT_DB_SYSTEM_PASSWORD_FILE: '',
    });
    expect(out.KEPT_SYSTEM_DATABASE_URL).toBe('postgres://kept_system:@db/k');
  });

  it('refuses a named file that does not exist, naming the variable, the file and the bootstrap', () => {
    const missing = path.join(dir, 'kept_system');
    const run = () =>
      completeDatabaseUrls({
        KEPT_SYSTEM_DATABASE_URL: 'postgres://kept_system:@db:5432/kept',
        KEPT_DB_SYSTEM_PASSWORD_FILE: missing,
      });
    expect(run).toThrow(EnvError);
    expect(run).toThrow(/KEPT_SYSTEM_DATABASE_URL/);
    expect(run).toThrow(new RegExp(missing.replaceAll('/', '\\/')));
    expect(run).toThrow(/bootstrap/);
  });

  it.each([
    ['an empty file', ''],
    ['a line break inside', 'Zq7v\nWk2m'],
    ['a control character', 'Zq7v\u0000Wk2m'],
    ['more than 1024 characters', 'Zq7v'.repeat(300)],
  ])('refuses %s without printing the content', (_what, body) => {
    const f = file(`bad-${body.length}-${body.charCodeAt(4)}`, body);
    let message = '';
    try {
      completeDatabaseUrls({
        KEPT_DATABASE_URL: 'postgres://kept_app:@db:5432/kept',
        KEPT_DB_APP_PASSWORD_FILE: f,
      });
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toMatch(/KEPT_DB_APP_PASSWORD_FILE/);
    if (body.length > 3) expect(message).not.toContain(body.slice(0, 4));
  });

  it('applies the files to an environment in place', () => {
    const f = file('kept_app_apply', 'deadbeef');
    const env: Record<string, string | undefined> = {
      KEPT_DATABASE_URL: 'postgres://kept_app:@db:5432/kept',
      KEPT_DB_APP_PASSWORD_FILE: f,
      OTHER: 'kept as is',
    };
    applyDatabasePasswordFiles(env);
    expect(env).toEqual({
      KEPT_DATABASE_URL: 'postgres://kept_app:deadbeef@db:5432/kept',
      KEPT_DB_APP_PASSWORD_FILE: f,
      OTHER: 'kept as is',
    });
  });
});
