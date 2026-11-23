import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { KEPT_VERSION, NATIVE_CAPTURE_PAYLOAD_VERSION, newId } from '@kept/shared';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import { jar, type TestApp, testApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import {
  fixture,
  sha256,
  type TestFiles,
  testFiles,
  uniqueJpeg,
  upload,
} from '../../test/files.js';
import { call, type Person, peopleApp, person } from '../../test/people.js';
import { type TestPgTools, testPgTools } from '../../test/pg-tools.js';
import { asOwner } from '../../test/tenancy.js';
import { builtinType, createLocation, createThing, type Loc, own } from '../../test/things.js';
import type { AlertDeps } from '../alerts/alerts.js';
import { withScope } from '../db/scope.js';
import { systemJobs } from '../jobs/system.js';
import { assertBlobKey, originalKey } from '../storage/blob-store.js';
import { S3BlobStore } from '../storage/s3.js';
import { backupCron } from './config.js';
import { EXPORT_SKIPPED, runExport } from './export.js';
import { legacyRuns } from './legacy.js';
import {
  blobToFile,
  countRows,
  extensionsOf,
  hashBlob,
  hashFile,
  ownedTables,
  parseManifest,
  referencedBlobs,
} from './manifest.js';
import {
  BACKUP_LOCK_KEY,
  BackupRunningError,
  bucketVersioningOf,
  readBackupStatus,
  runSnapshot,
  type SnapshotDeps,
} from './nightly.js';
import type { PgTools } from './pg-tools.js';
import { FakeRestic } from './restic/fake.js';
import type { Restic } from './restic/restic.js';
import { ResticCli } from './restic/run.js';
import { RestoreError, restoreVerified, runResticRestore, runRestore } from './restore.js';
import type { ResolvedBackupSettings } from './settings.js';
import { LocalDirTarget } from './target.js';

// The nightly snapshot on restic, end to end against a
// real database and file store: the dump, the manifest with per-table data digests and every
// blob, the snapshot's contents, retention, the size check, the lock, and secrets that never leave
// the restic child's environment. restic is the in-memory fake (restic/fake.ts) unless
// KEPT_TEST_RESTIC=1, when the real binary (KEPT_RESTIC_BIN) runs the round trip too. Also: the
// alpha's runs stay restorable (`--legacy`) and `kept admin export` is unchanged.
//
// pg_dump/pg_restore must be the server's major version (18): test/pg-tools.ts uses the local
// ones when they match, else the ones inside the dev database's container.

const SUPERUSER_URL = 'postgres://postgres:postgres@localhost:5452/postgres';
const PASSWORD = 'a backup password, long enough';
const REAL = process.env.KEPT_TEST_RESTIC === '1';

function r2DrillStores() {
  const source = process.env.KEPT_TEST_R2_SOURCE_BUCKET;
  const destination = process.env.KEPT_TEST_R2_DESTINATION_BUCKET;
  if (!source && !destination) return null;
  const endpoint = process.env.KEPT_TEST_R2_ENDPOINT;
  const accessKeyId = process.env.KEPT_TEST_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.KEPT_TEST_R2_SECRET_ACCESS_KEY;
  if (
    !REAL ||
    !source ||
    !/^kept-mvp1-drill-[0-9a-f]{12}-source$/.test(source) ||
    destination !== source.replace(/-source$/, '-recovered') ||
    !endpoint ||
    !/^https:\/\/[0-9a-f]{32}\.r2\.cloudflarestorage\.com$/.test(endpoint) ||
    !accessKeyId ||
    !secretAccessKey
  ) {
    throw new Error('The R2 drill needs real Restic and paired disposable R2 buckets.');
  }
  const open = (bucket: string) =>
    new S3BlobStore({
      bucket,
      endpoint,
      region: 'auto',
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    });
  return { source: open(source), destination: open(destination) };
}

const r2Drill = r2DrillStores();

vi.setConfig({ testTimeout: 300_000, hookTimeout: 180_000 });

let db: TestDb;
let files: TestFiles;
let t: TestApp;
let ibrahim: Person;
let garage: Loc;
let pgt: TestPgTools;
let scratch: string;
let photo: Buffer;
const extraDbs: string[] = [];

async function superuser<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client({ connectionString: SUPERUSER_URL });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

/** A new, empty database owned by kept_owner (template1 has the extensions, as setup does). */
async function emptyDatabase(label: string): Promise<string> {
  const name = `kept_${label}_${inject('keptRunId')}_${process.env.VITEST_POOL_ID ?? '0'}`;
  await superuser(async (c) => {
    await c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await c.query(`CREATE DATABASE ${name} OWNER kept_owner`);
  });
  extraDbs.push(name);
  return `postgres://kept_owner:kept_owner@localhost:5452/${name}`;
}

async function countsAt(url: string): Promise<Record<string, number>> {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    return await countRows(c, await ownedTables(c));
  } finally {
    await c.end();
  }
}

const runsOf = (where = 'true') =>
  asOwner(db, async (c) => {
    const { rows } = await c.query<{
      id: string;
      kind: string;
      status: string;
      error: string | null;
      snapshot_id: string | null;
      detail: Record<string, unknown>;
      bucket_versioning_ok: boolean | null;
    }>(
      `SELECT id, kind, status, error, snapshot_id, detail, bucket_versioning_ok
         FROM public.backup_runs WHERE ${where} ORDER BY started_at`,
    );
    return rows;
  });

function settingsFor(dir: string, password = PASSWORD): ResolvedBackupSettings {
  return {
    target: { kind: 'dir', path: dir },
    password,
    time: '02:30',
    keep: { daily: 7, weekly: 4, monthly: 6 },
    description: `directory ${dir}`,
    locked: true,
  };
}

function realRestic(): Restic {
  return new ResticCli({
    bin: process.env.KEPT_RESTIC_BIN || 'restic',
    cacheDir: path.join(scratch, 'restic-cache'),
  });
}

function depsFor(restic: Restic, dir: string, more: Partial<SnapshotDeps> = {}): SnapshotDeps {
  return {
    ownerUrl: db.urls.owner,
    restic,
    settings: settingsFor(dir),
    dataDir: files.dir,
    storage: 'local',
    blobs: files.blobs,
    pgTools: pgt.tools,
    ...more,
  };
}

/** A pg_dump stand-in for the many-run cases: a few bytes, so 40 nights take seconds. */
function tinyDump(bytes = 4096): PgTools {
  return {
    versions: () => pgt.tools.versions(),
    dump: async (_url, out) => writeFile(out, Buffer.alloc(bytes, 7), { mode: 0o600 }),
    restore: () => Promise.reject(new Error('not in these tests')),
  };
}

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  files = await testFiles();
  t = await peopleApp(db, { files: { ...files, blobs: r2Drill?.source ?? files.blobs } });
  ibrahim = await person(t, db, 'ibrahim');
  garage = await createLocation(t, db, ibrahim, 'household', 'Garage');
  for (const name of ['Drill', 'Ladder', 'Toolbox'])
    await createThing(t, ibrahim, garage, { name });
  photo = await uniqueJpeg();
  const res = await upload(t, ibrahim, garage.id, photo);
  expect(res.statusCode, res.body).toBe(201);
  const major = await asOwner(db, async (c) => {
    const { rows } = await c.query<{ n: number }>(
      `SELECT current_setting('server_version_num')::int / 10000 AS n`,
    );
    return rows[0]?.n ?? 0;
  });
  scratch = await mkdtemp(path.join(tmpdir(), 'kept-backup-'));
  pgt = await testPgTools(major);
  process.stderr.write(`backup.test.ts: using ${pgt.how}${REAL ? ', real restic' : ''}\n`);
});

afterAll(async () => {
  await t.app.close();
  r2Drill?.source.destroy();
  r2Drill?.destination.destroy();
  await files.cleanup();
  await rm(scratch, { recursive: true, force: true });
  await superuser(async (c) => {
    for (const name of extraDbs) await c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  });
});

describe('a snapshot', () => {
  it('holds the dump, the manifest with data digests, and every local file; the next adds only new files', async () => {
    const restic = REAL ? realRestic() : new FakeRestic();
    const target = path.join(scratch, 'first');
    const deps = depsFor(restic, target);
    const before = await countsAt(db.urls.owner);
    const run = await runSnapshot(deps, { kind: 'nightly' });
    expect(run).toMatchObject({ kind: 'nightly', status: 'ok', missing: 0, error: null });
    expect(run.snapshotId).toMatch(/^[0-9a-f]{64}$/);
    expect(run.target).toBe(`directory ${target}`);
    // The fake keeps its repository in memory, so the target directory exists only for real.
    expect(run.sameVolume).toBe(REAL ? true : null);
    expect(run.detail).toMatchObject({ snapshots: 1, rows: { 'public.things': 3 } });

    // The stable directory: the manifest describes the dump beside it, from the same snapshot.
    const dbDir = path.join(files.dir, 'backup', 'db');
    const manifest = parseManifest(await readFile(path.join(dbDir, 'manifest.json')));
    expect(manifest).toMatchObject({ version: 2, kind: 'nightly', filesInSnapshot: true });
    // What the database held, with this run's own `running` row, written before the snapshot.
    expect(manifest.tables).toEqual({
      ...before,
      'public.backup_runs': (before['public.backup_runs'] ?? 0) + 1,
    });
    expect(Object.keys(manifest.digests ?? {}).sort()).toEqual(Object.keys(before).sort());
    expect(manifest.database.sha256).toBe((await hashFile(path.join(dbDir, 'db.dump'))).sha256);
    expect(manifest.blobs.map((b) => b.sha256)).toContain(sha256(photo));
    expect((await stat(path.join(dbDir, 'manifest.json'))).mode & 0o777).toBe(0o600);

    // The snapshot: the stable directory and every referenced blob, under / (R1).
    const opened = {
      location: path.join(target, 'restic'),
      env: { RESTIC_PASSWORD: PASSWORD },
      description: '',
    };
    const nodes = (await restic.ls(opened, run.snapshotId as string))
      .filter((n) => n.type === 'file')
      .map((n) => n.path);
    expect(nodes).toEqual(
      expect.arrayContaining(['/backup/db/db.dump', '/backup/db/manifest.json']),
    );
    for (const b of manifest.blobs) expect(nodes).toContain(`/blobs/${b.key}`);
    expect(nodes.some((p) => p.startsWith('/tmp/') || p.startsWith('/.cache/'))).toBe(false);

    // The next run: the dump and manifest change (the audit has grown), no file is new.
    const second = await runSnapshot(deps, { kind: 'nightly' });
    expect(second.filesNew).toBe(0);
    const res = await upload(t, ibrahim, garage.id, await uniqueJpeg());
    expect(res.statusCode, res.body).toBe(201);
    const third = await runSnapshot(deps, { kind: 'nightly' });
    expect(third.filesNew).toBeGreaterThanOrEqual(1);
    // Three the same day: retention keeps the newest and, while its buckets aren't full, the
    // oldest (R1: restic's "oldest … snapshot").
    expect(third.detail).toMatchObject({ snapshots: 2, forgotten: 1 });

    // Audited as system, figures only.
    const audits = await asOwner(db, async (c) => {
      const { rows } = await c.query<{
        actor_type: string;
        diff: Record<string, { after: unknown }>;
      }>(
        `SELECT actor_type, diff FROM public.audit_events WHERE action = 'instance.backup'
          AND diff -> 'backup' ->> 'after' = $1`,
        [run.id],
      );
      return rows;
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.actor_type).toBe('system');
    expect(audits[0]?.diff.status?.after).toBe('ok');

    // The alpha status line reads backup_runs now.
    const status = await asOwner(db, (c) => readBackupStatus(c));
    expect(status.last?.id).toBe(third.id);
    expect(status.lastOk?.id).toBe(third.id);
  });

  it('a database-only run (the pre-upgrade snapshot) holds the dump and manifest alone', async () => {
    const restic = new FakeRestic();
    const target = path.join(scratch, 'dbonly');
    const run = await runSnapshot(depsFor(restic, target), {
      kind: 'pre_upgrade',
      databaseOnly: true,
      fromVersion: '1.0.0',
      toVersion: '1.1.0',
    });
    expect(run).toMatchObject({ status: 'ok', fromVersion: '1.0.0', toVersion: '1.1.0' });
    const repo = {
      location: path.join(target, 'restic'),
      env: { RESTIC_PASSWORD: PASSWORD },
      description: '',
    };
    const nodes = (await restic.ls(repo, run.snapshotId as string)).filter(
      (n) => n.type === 'file',
    );
    expect(nodes.map((n) => n.path).sort()).toEqual([
      '/backup/db/db.dump',
      '/backup/db/manifest.json',
    ]);
    const [snap] = await restic.snapshots(repo);
    expect(snap?.tags).toEqual(['kept', 'pre_upgrade', `v${KEPT_VERSION}`]);
  });

  it('with S3 file storage holds no files, and records the bucket versioning', async () => {
    const restic = new FakeRestic();
    const target = path.join(scratch, 's3-storage');
    const run = await runSnapshot(
      depsFor(restic, target, { storage: 's3', bucketVersioning: async () => false }),
      { kind: 'nightly' },
    );
    expect(run).toMatchObject({ status: 'ok', storageMode: 's3', bucketVersioningOk: false });
    const repo = {
      location: path.join(target, 'restic'),
      env: { RESTIC_PASSWORD: PASSWORD },
      description: '',
    };
    const nodes = await restic.ls(repo, run.snapshotId as string);
    expect(nodes.some((n) => n.path.startsWith('/blobs'))).toBe(false);
    const manifest = parseManifest(
      await readFile(path.join(files.dir, 'backup', 'db', 'manifest.json')),
    );
    expect(manifest.filesInSnapshot).toBe(false);
    expect(manifest.blobs.length).toBeGreaterThan(0);
  });
});

describe('the nightly job', () => {
  const jobDeps = {
    log: { info() {}, error() {} },
    mailer: { send: async () => {} },
    publicUrl: 'http://kept.test',
  };
  const backupConfig = (rawEnv: Record<string, string>, restic: Restic) => ({
    time: '04:15',
    ownerUrl: db.urls.owner,
    storage: 'local' as const,
    dataDir: files.dir,
    pgTools: pgt.tools,
    restic,
    rawEnv,
  });

  it('is scheduled at KEPT_BACKUP_TIME in UTC, and without a password does nothing', async () => {
    expect(backupCron('02:30')).toBe('30 2 * * *');
    expect(backupCron('23:05')).toBe('5 23 * * *');
    const idle = systemJobs({ ...jobDeps, pools: db.pools }).find((j) => j.name === 'backup');
    expect(idle).toMatchObject({ kind: 'system', schedule: '30 2 * * *' });
    const restic = new FakeRestic();
    const job = systemJobs({
      ...jobDeps,
      pools: db.pools,
      files,
      backup: backupConfig({ KEPT_BACKUP_DIR: path.join(scratch, 'nopass') }, restic),
    }).find((j) => j.name === 'backup');
    expect(job).toMatchObject({ schedule: '15 4 * * *' });
    const before = (await runsOf()).length;
    if (job?.kind === 'system') await job.handler(null);
    expect((await runsOf()).length).toBe(before);
    expect(restic.calls).toEqual([]);
  });

  it('runs a nightly snapshot with the settings it reads, and a manual one when asked', async () => {
    const restic = new FakeRestic();
    const dir = path.join(scratch, 'job');
    const job = systemJobs({
      ...jobDeps,
      pools: db.pools,
      files,
      backup: backupConfig({ KEPT_BACKUP_DIR: dir, KEPT_BACKUP_PASSWORD: PASSWORD }, restic),
    }).find((j) => j.name === 'backup');
    if (job?.kind !== 'system') throw new Error('no backup job');
    await job.handler(null);
    await job.handler({ kind: 'manual' });
    const rows = await runsOf(`target = 'directory ${dir}'`);
    expect(rows.map((r) => [r.kind, r.status])).toEqual([
      ['nightly', 'ok'],
      ['manual', 'ok'],
    ]);
  });
});

describe('retention', () => {
  it('keeps 7 daily, 4 weekly and 6 monthly of the nightly series; pre-upgrade snapshots their last 3', async () => {
    // Forty faked days are the contract's (test/restic-contract.ts, the same forget); here, nine
    // nights through the whole run. 1–9 January 2026: the last 7 days, and while the weekly and
    // monthly buckets aren't full, the oldest (R1): every night but the 2nd.
    const restic = new FakeRestic();
    const target = path.join(scratch, 'nights');
    const deps = depsFor(restic, target, { pgTools: tinyDump() });
    for (let day = 0; day < 9; day++) {
      // An upgrade on the 5th: the version tag changes, the series doesn't (forget groups by
      // host within the kind's tags, so a release never starts a group of its own).
      await runSnapshot(
        { ...deps, version: day < 4 ? '1.0.0' : '1.1.0' },
        {
          kind: 'nightly',
          time: new Date(Date.UTC(2026, 0, 1 + day, 2, 30)),
          // The first sets the size baseline for the stand-in dump.
          ...(day === 0 ? { acceptSize: true } : {}),
        },
      );
    }
    for (let i = 0; i < 4; i++) {
      await runSnapshot(deps, {
        kind: 'pre_upgrade',
        databaseOnly: true,
        time: new Date(Date.UTC(2026, 0, 2 + i, 1)),
      });
    }
    const repo = {
      location: path.join(target, 'restic'),
      env: { RESTIC_PASSWORD: PASSWORD },
      description: '',
    };
    const nightly = await restic.snapshots(repo, { tags: ['kept', 'nightly'] });
    expect(nightly.map((s) => s.time.toISOString().slice(0, 10)).sort()).toEqual([
      '2026-01-01',
      '2026-01-03',
      '2026-01-04',
      '2026-01-05',
      '2026-01-06',
      '2026-01-07',
      '2026-01-08',
      '2026-01-09',
    ]);
    const upgrades = await restic.snapshots(repo, { tags: ['kept', 'pre_upgrade'] });
    expect(upgrades.map((s) => s.time.toISOString().slice(0, 10))).toEqual([
      '2026-01-05',
      '2026-01-04',
      '2026-01-03',
    ]);
    expect(restic.calls.filter((c) => c.command === 'forget')).toHaveLength(13);
  });

  it('a suspiciously small dump is a warning: its retention is skipped and the admins are told', async () => {
    const restic = new FakeRestic();
    const target = path.join(scratch, 'shrunk');
    const alerts: AlertDeps = { pools: db.pools, mailer: { send: async () => {} } };
    const big = await runSnapshot(depsFor(restic, target, { pgTools: tinyDump(4 << 20), alerts }), {
      kind: 'nightly',
    });
    expect(big.status).toBe('ok');
    const forgetsBefore = restic.calls.filter((c) => c.command === 'forget').length;
    const small = await runSnapshot(
      depsFor(restic, target, { pgTools: tinyDump(1 << 20), alerts }),
      {
        kind: 'nightly',
      },
    );
    expect(small).toMatchObject({ status: 'warning', error: 'backup_suspicious_size' });
    expect(small.snapshotId).toMatch(/^[0-9a-f]{64}$/);
    expect(small.detail).toMatchObject({
      retentionSkipped: true,
      shrank: [`dump ${4 << 20} → ${1 << 20}`],
    });
    expect(restic.calls.filter((c) => c.command === 'forget').length).toBe(forgetsBefore);
    const alert = await asOwner(db, async (c) => {
      const { rows } = await c.query(
        `SELECT resolved_at, payload FROM public.admin_alerts WHERE dedupe_key = 'backup_suspicious_size'`,
      );
      return rows[0];
    });
    expect(alert).toMatchObject({ resolved_at: null });

    // Still small the next night: still suspect against the last good one.
    const again = await runSnapshot(
      depsFor(restic, target, { pgTools: tinyDump(1 << 20), alerts }),
      {
        kind: 'nightly',
      },
    );
    expect(again.error).toBe('backup_suspicious_size');
    // Accepted: the new baseline, retention runs, the alert resolves.
    const accepted = await runSnapshot(
      depsFor(restic, target, { pgTools: tinyDump(1 << 20), alerts }),
      {
        kind: 'manual',
        acceptSize: true,
      },
    );
    expect(accepted).toMatchObject({ status: 'ok', error: null });
    const resolved = await asOwner(db, async (c) => {
      const { rows } = await c.query(
        `SELECT resolved_at FROM public.admin_alerts WHERE dedupe_key = 'backup_suspicious_size'`,
      );
      return rows[0];
    });
    expect(resolved?.resolved_at).not.toBeNull();
    const next = await runSnapshot(
      depsFor(restic, target, { pgTools: tinyDump(1 << 20), alerts }),
      {
        kind: 'nightly',
      },
    );
    expect(next.status).toBe('ok');
  });
});

describe('a file lost from storage', () => {
  it('makes the run a warning while its row is still there; a purge that raced the run does not', async () => {
    const lost = await uniqueJpeg();
    const res = await upload(t, ibrahim, garage.id, lost);
    const fileId = (res.json() as { id: string }).id;
    const [row] = await asOwner(
      db,
      async (c) =>
        (
          await c.query<{ storage_key: string }>(
            'SELECT storage_key FROM public.files WHERE id = $1',
            [fileId],
          )
        ).rows,
    );
    await files.blobs.delete(row?.storage_key as string);
    try {
      const run = await runSnapshot(depsFor(new FakeRestic(), path.join(scratch, 'lost')), {
        kind: 'manual',
      });
      expect(run).toMatchObject({ status: 'warning', error: 'files_missing' });
      expect(run.missing).toBeGreaterThanOrEqual(1);
    } finally {
      await asOwner(db, (c) => c.query('DELETE FROM public.files WHERE id = $1', [fileId]));
    }
  });
});

describe('a retried "Run now"', () => {
  it('takes the same run row again when the job retries, and finishes it', async () => {
    const restic = new FakeRestic();
    const runId = newId();
    const dir = path.join(scratch, 'retry');
    restic.failNext('unreachable');
    await expect(runSnapshot(depsFor(restic, dir), { kind: 'manual', runId })).rejects.toThrow();
    expect(await runsOf(`id = '${runId}'`)).toMatchObject([{ status: 'failed' }]);
    // pg-boss retries the job with the same data, so the same id (backup policy, one retry).
    await runSnapshot(depsFor(restic, dir), { kind: 'manual', runId });
    expect(await runsOf(`id = '${runId}'`)).toMatchObject([{ status: 'ok', error: null }]);
  });
});

describe('an interrupted run', () => {
  it('a run that finds a `running` row left behind (its process died) marks it backup_interrupted', async () => {
    const leftover = newId();
    await asOwner(db, (c) =>
      c.query(
        `INSERT INTO public.backup_runs (id, kind, storage_mode, target, started_at)
         VALUES ($1, 'nightly', 'local', 'directory /x', now() - interval '1 hour')`,
        [leftover],
      ),
    );
    const run = await runSnapshot(depsFor(new FakeRestic(), path.join(scratch, 'interrupted')), {
      kind: 'manual',
    });
    expect(run.status).toBe('ok');
    const [row] = await runsOf(`id = '${leftover}'`);
    expect(row).toMatchObject({ status: 'failed', error: 'backup_interrupted' });
    const finished = await asOwner(db, (c) =>
      c.query<{ finished: boolean }>(
        'SELECT finished_at IS NOT NULL AS finished FROM public.backup_runs WHERE id = $1',
        [leftover],
      ),
    );
    expect(finished.rows[0]?.finished).toBe(true);
  });
});

describe('one run at a time', () => {
  it('a second run while one holds the lock is refused and records nothing', async () => {
    const holder = new pg.Client({ connectionString: db.urls.owner });
    await holder.connect();
    try {
      await holder.query('SELECT pg_advisory_lock($1)', [BACKUP_LOCK_KEY]);
      const before = (await runsOf()).length;
      await expect(
        runSnapshot(depsFor(new FakeRestic(), path.join(scratch, 'locked')), { kind: 'manual' }),
      ).rejects.toBeInstanceOf(BackupRunningError);
      expect((await runsOf()).length).toBe(before);
    } finally {
      await holder.end();
    }
  });
});

describe('secrets', () => {
  it('never reach argv, a log line, backup_runs, the audit or an error, even when restic echoes the password', async () => {
    // A stand-in restic that prints the password it was given (from its environment) on stderr,
    // as an exit_error, and fails: the wrapper must scrub it.
    const bin = path.join(scratch, 'echo-restic.sh');
    await writeFile(
      bin,
      `#!/bin/sh\nprintf '{"message_type":"exit_error","code":1,"message":"Fatal: no luck with %s"}\\n' "$RESTIC_PASSWORD" >&2\nexit 1\n`,
    );
    await chmod(bin, 0o755);
    const argvs: string[][] = [];
    const envNames: string[][] = [];
    const spy = ((
      cmd: string,
      args: readonly string[],
      options: { env?: Record<string, string> },
    ) => {
      argvs.push([cmd, ...args]);
      envNames.push(Object.keys(options.env ?? {}));
      return spawn(cmd, args, options);
    }) as unknown as typeof spawn;
    const logs: string[] = [];
    const log = {
      info: (obj: object, msg: string) => logs.push(JSON.stringify({ ...obj, msg })),
      error: (obj: object, msg: string) => logs.push(JSON.stringify({ ...obj, msg })),
    };
    const restic = new ResticCli({
      bin,
      spawn: spy,
      onLog: (line) => logs.push(line),
    });
    const alerts: AlertDeps = { pools: db.pools, mailer: { send: async () => {} } };
    const err = await runSnapshot(
      depsFor(restic, path.join(scratch, 'echo'), { log, alerts, pgTools: tinyDump() }),
      { kind: 'manual' },
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('[redacted]');
    expect((err as Error).message).not.toContain(PASSWORD);
    expect(argvs.length).toBeGreaterThan(0);
    expect(JSON.stringify(argvs)).not.toContain(PASSWORD);
    expect(envNames.every((names) => names.includes('RESTIC_PASSWORD'))).toBe(true);
    expect(envNames.flat().some((n) => n.startsWith('KEPT_') || n === 'DATABASE_URL')).toBe(false);
    expect(logs.join('\n')).not.toContain(PASSWORD);
    const [row] = await runsOf(`target = 'directory ${path.join(scratch, 'echo')}'`);
    expect(row).toMatchObject({ status: 'failed', error: 'restic_failed' });
    expect(JSON.stringify(row)).not.toContain(PASSWORD);
    const audit = await asOwner(db, async (c) => {
      const { rows } = await c.query(
        `SELECT diff FROM public.audit_events WHERE action = 'instance.backup'
          AND diff -> 'backup' ->> 'after' = $1`,
        [row?.id],
      );
      return rows;
    });
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit)).not.toContain(PASSWORD);
    const alert = await asOwner(db, async (c) => {
      const { rows } = await c.query(
        `SELECT payload FROM public.admin_alerts WHERE dedupe_key = 'backup_failed'`,
      );
      return rows[0];
    });
    expect(alert?.payload).toMatchObject({ error: 'restic_failed' });
    expect(JSON.stringify(alert)).not.toContain(PASSWORD);
  });
});

// ---------------------------------------------------------------------------------------------
// The alpha's runs: still restorable for one release, never written again.

/** An alpha run, written the way T31c's nightly did: runs/<id>/{db.dump,manifest.json}, blobs/. */
async function alphaRun(target: LocalDirTarget): Promise<string> {
  const id = `20260927T023000Z-${Math.random().toString(16).slice(2, 8).padEnd(6, '0')}`;
  const work = await mkdtemp(path.join(scratch, 'alpha-'));
  const dump = path.join(work, 'db.dump');
  await pgt.tools.dump(db.urls.owner, dump);
  const facts = await asOwner(db, async (c) => ({
    tables: await countRows(c, await ownedTables(c)),
    referenced: await referencedBlobs(c),
    extensions: await extensionsOf(c),
    server: (await c.query<{ v: string }>(`SELECT current_setting('server_version') AS v`)).rows[0]
      ?.v,
  }));
  const blobs = [];
  for (const { key } of facts.referenced) {
    const tmp = path.join(work, 'blob');
    const copied = await blobToFile(files.blobs, key, tmp);
    await target.put(`blobs/${key}`, tmp);
    blobs.push({ key, ...copied });
  }
  const db1 = await hashFile(dump);
  await target.put(`runs/${id}/db.dump`, dump);
  const manifestFile = path.join(work, 'manifest.json');
  await writeFile(
    manifestFile,
    JSON.stringify({
      format: 'kept-backup',
      version: 1,
      id,
      createdAt: new Date().toISOString(),
      keptVersion: KEPT_VERSION,
      postgres: { server: facts.server, dumpMajor: (await pgt.tools.versions()).dump },
      extensions: facts.extensions,
      database: { file: 'db.dump', bytes: db1.bytes, sha256: db1.sha256 },
      tables: facts.tables,
      storage: 'local',
      blobs,
      missing: [],
    }),
  );
  await target.put(`runs/${id}/manifest.json`, manifestFile);
  await rm(work, { recursive: true, force: true });
  return id;
}

async function readDrillOriginal(app: TestApp, url: string) {
  if (r2Drill) {
    const file = await fetch(url, { redirect: 'error' });
    expect(file.status).toBe(200);
    return { bytes: Buffer.from(await file.arrayBuffer()), mime: file.headers.get('content-type') };
  }
  const file = await app.app.inject({ url });
  expect(file.statusCode).toBe(200);
  return { bytes: file.rawPayload, mime: file.headers['content-type'] };
}

async function recoverR2DrillBlobs(stores: NonNullable<typeof r2Drill>, restic: Restic) {
  const objects = await asOwner(db, referencedBlobs);
  const originalMimes = await asOwner(db, async (client) => {
    const { rows } = await client.query<{ key: string; mime: string }>(
      'SELECT storage_key AS key, mime FROM public.files',
    );
    return new Map(rows.map(({ key, mime }) => [key, mime]));
  });
  const staging = path.join(scratch, 'r2-archive-staging');
  const bytesByKey = new Map<string, number>();
  for (const object of objects) {
    const key = assertBlobKey(object.key);
    const file = path.join(staging, 'objects', key);
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    const copy = await blobToFile(stores.source, key, file);
    if (object.sha256) expect(copy.sha256).toBe(object.sha256);
    bytesByKey.set(key, copy.bytes);
  }
  const repo = {
    location: path.join(scratch, 'r2-originals-restic'),
    env: { RESTIC_PASSWORD: randomBytes(32).toString('base64url') },
    description: 'disposable independent blob backup',
  };
  await restic.init(repo);
  const { snapshotId } = await restic.backup(repo, {
    paths: ['objects'],
    cwd: staging,
    tags: ['r2-drill'],
  });
  await rm(staging, { recursive: true });

  // Simulate loss of the uploaded objects after the independent backup has completed.
  for (const { key } of objects) {
    await stores.source.delete(key);
    expect(await stores.source.exists(key)).toBe(false);
    expect(await stores.destination.exists(key)).toBe(false);
  }
  const recovered = path.join(scratch, 'r2-archive-recovered');
  await restic.restore(repo, snapshotId, { target: recovered });
  for (const [key, bytes] of bytesByKey) {
    await stores.destination.put(key, path.join(recovered, 'objects', key), {
      contentType: originalMimes.get(key) ?? 'image/jpeg',
      bytes,
    });
  }
  process.stderr.write(`R2 drill: independently recovered ${objects.length} referenced blobs.\n`);
}

it('restores the NFC inventory capture with its QR URL and byte-identical originals', async () => {
  const box = await createThing(t, ibrahim, garage, {
    name: 'Holiday box',
    typeId: await builtinType(db, 'box_bin'),
  });
  async function connect(app: TestApp) {
    const verifier = randomBytes(32).toString('base64url');
    const approval = await app.app.inject({
      method: 'POST',
      url: '/native/connect',
      headers: {
        origin: app.publicUrl,
        cookie: ibrahim.cookie,
        'content-type': 'application/x-www-form-urlencoded',
      },
      payload: new URLSearchParams({
        challenge: createHash('sha256').update(verifier).digest('base64url'),
        state: randomBytes(32).toString('base64url'),
      }).toString(),
    });
    expect(approval.statusCode, approval.body).toBe(303);
    const code = new URL(String(approval.headers.location)).searchParams.get('code');
    const exchange = await call(app, '/api/v1/native/exchange', { body: { code, verifier } });
    expect(exchange.statusCode, exchange.body).toBe(200);
    return { ...exchange.json<{ account: string; epoch: string }>(), cookie: jar(exchange) };
  }
  const { account, epoch, cookie } = await connect(t);
  expect(account).toBe(ibrahim.userId);
  const native = { cookie };
  const headers = { 'x-kept-native-account': account, 'x-kept-native-epoch': epoch };
  const staleHeaders = { ...headers, 'x-kept-native-epoch': newId() };
  const originals = [
    {
      bytes: await uniqueJpeg(),
      fileId: newId(),
      role: 'photo',
      cls: 'evidence',
      mime: 'image/jpeg',
    },
    {
      bytes: await uniqueJpeg(),
      fileId: newId(),
      role: 'photo',
      cls: 'evidence',
      mime: 'image/jpeg',
    },
    {
      bytes: await fixture('doc.pdf'),
      fileId: newId(),
      role: 'document',
      cls: 'document',
      mime: 'application/pdf',
    },
  ];
  const pdf = originals[2];
  if (!pdf) throw new Error('Missing PDF fixture');
  const staleUpload = await upload(t, native, garage.id, pdf.bytes, {
    id: pdf.fileId,
    cls: pdf.cls,
    contentType: pdf.mime,
    headers: staleHeaders,
  });
  expect(staleUpload.statusCode, staleUpload.body).toBe(409);
  for (const original of originals) {
    const opts = { id: original.fileId, cls: original.cls, contentType: original.mime, headers };
    const first = await upload(t, native, garage.id, original.bytes, opts);
    expect(first.statusCode, first.body).toBe(201);
    const retry = await upload(t, native, garage.id, original.bytes, opts);
    expect(retry.statusCode, retry.body).toBe(200);
    expect(retry.json()).toMatchObject({ id: original.fileId, sha256: sha256(original.bytes) });
  }
  const captureId = newId();
  const operation = {
    clientVersion: KEPT_VERSION,
    payloadVersion: NATIVE_CAPTURE_PAYLOAD_VERSION,
    clientId: captureId,
    idempotencyKey: captureId,
    locationId: garage.id,
    op: 'create_thing',
    takenAt: new Date().toISOString(),
    payload: {
      id: captureId,
      target: { containerId: box.id },
      mode: 'thing',
      name: 'Holiday decorations',
      note: 'Red and gold',
      batchId: newId(),
      reviewSuggestions: true,
      files: originals.map(({ fileId, role, bytes }) => ({
        fileId,
        role,
        sha256: sha256(bytes),
      })),
    },
  };
  const sync = (item: typeof operation, context = headers) =>
    call(t, '/api/v1/sync/ops', {
      as: native,
      body: { clientVersion: KEPT_VERSION, ops: [item] },
      headers: context,
    });
  const staleSync = await sync(operation, staleHeaders);
  expect(staleSync.statusCode, staleSync.body).toBe(409);

  const missingDestination = {
    ...operation,
    payload: { ...operation.payload, target: { containerId: newId() } },
  };
  expect((await sync(missingDestination)).json()).toMatchObject({
    results: [{ outcome: 'dropped', reason: 'target_missing' }],
  });
  expect((await sync(operation)).json()).toMatchObject({
    results: [{ outcome: 'dropped', reason: 'idempotency_mismatch' }],
  });
  const trashed = await createThing(t, ibrahim, garage, {
    name: 'Trashed box',
    typeId: await builtinType(db, 'box_bin'),
  });
  const trashedBox = await call(t, `/api/v1/things/${trashed.id}/trash`, {
    as: ibrahim,
    body: {},
  });
  expect(trashedBox.statusCode, trashedBox.body).toBe(200);
  expect(
    (
      await sync({
        ...missingDestination,
        idempotencyKey: newId(),
        payload: { ...operation.payload, target: { containerId: trashed.id } },
      })
    ).json(),
  ).toMatchObject({ results: [{ outcome: 'dropped', reason: 'target_trashed' }] });
  const corrected = { ...operation, idempotencyKey: newId() };
  const first = await sync(corrected);
  expect(first.statusCode, first.body).toBe(200);
  expect(first.json()).toMatchObject({
    results: [{ outcome: 'applied', entity: { id: captureId } }],
  });
  expect((await sync(corrected)).json()).toEqual(first.json());

  for (const original of originals) {
    const link = await call(t, `/api/v1/files/${original.fileId}/url?thingId=${captureId}`, {
      as: native,
      headers,
      body: { variant: 'original' },
    });
    expect(link.statusCode, link.body).toBe(200);
    const file = await readDrillOriginal(t, link.json<{ url: string }>().url);
    expect(file.mime).toBe(original.mime);
    expect(file.bytes.length).toBe(original.bytes.length);
    expect(sha256(file.bytes)).toBe(sha256(original.bytes));
  }

  const outsider = await person(t, db, 'bruce');
  const label = `https://kept.example.com/l/${box.shortCode}`;
  const denied = await call(t, '/api/v1/scan/resolve', { as: outsider, body: { text: label } });
  expect(denied.json()).toEqual({ outcome: 'not_in_your_kept' });
  const deniedMedia = await call(t, `/api/v1/files/${originals[0]?.fileId}/url`, {
    as: outsider,
    body: { variant: 'original' },
  });
  expect(deniedMedia.statusCode).toBe(404);

  const restic = REAL ? realRestic() : new FakeRestic();
  const target = path.join(scratch, 'native-mvp');
  const snapshotDeps = r2Drill
    ? depsFor(restic, target, {
        storage: 's3',
        blobs: r2Drill.source,
        bucketVersioning: () => bucketVersioningOf(r2Drill.source),
      })
    : depsFor(restic, target);
  const backup = await runSnapshot(snapshotDeps, { kind: 'nightly' });
  expect(backup.status).toBe('ok');
  const repo = {
    location: path.join(target, 'restic'),
    env: { RESTIC_PASSWORD: PASSWORD },
    description: '',
  };
  if (r2Drill) {
    const nodes = await restic.ls(repo, String(backup.snapshotId));
    expect(nodes.some(({ path: name }) => name === '/blobs' || name.startsWith('/blobs/'))).toBe(
      false,
    );
    const missing = await runResticRestore({
      ownerUrl: await emptyDatabase('r2_missing'),
      restic,
      repo,
      snapshot: String(backup.snapshotId),
      blobs: r2Drill.destination,
      pgTools: pgt.tools,
      tmpDir: files.tmpDir,
    });
    expect(restoreVerified(missing)).toBe(false);
    expect(missing.filesBad).toEqual(
      expect.arrayContaining(originals.map(({ fileId }) => originalKey(garage.id, fileId))),
    );
    await recoverR2DrillBlobs(r2Drill, restic);
  }
  const ownerUrl = await emptyDatabase('native_mvp');
  const restored = await testFiles();
  const restoredBlobs = r2Drill?.destination ?? restored.blobs;
  const restoredUrls = { ...db.urls, owner: ownerUrl };
  function poolFor(role: 'app' | 'auth' | 'system') {
    const url = new URL(db.urls[role]);
    url.pathname = new URL(ownerUrl).pathname;
    restoredUrls[role] = url.href;
    return new pg.Pool({ connectionString: url.href });
  }
  const pools = { app: poolFor('app'), auth: poolFor('auth'), system: poolFor('system') };
  const restoredDb = { ...db, urls: restoredUrls, pools };
  let restoredApp: TestApp | undefined;
  try {
    const report = await runResticRestore({
      ownerUrl,
      restic,
      repo,
      snapshot: String(backup.snapshotId),
      blobs: restoredBlobs,
      pgTools: pgt.tools,
      tmpDir: restored.tmpDir,
    });
    expect(restoreVerified(report)).toBe(true);
    for (const original of originals) {
      const stored = await hashBlob(restoredBlobs, originalKey(garage.id, original.fileId));
      expect(stored.sha256).toBe(sha256(original.bytes));
    }
    const recovered = await testApp(restoredDb, {
      publicUrl: t.publicUrl,
      files: { ...restored, blobs: restoredBlobs },
    });
    restoredApp = recovered;
    const renewed = await connect(recovered);
    expect(renewed.account).toBe(account);
    expect(renewed.epoch).not.toBe(epoch);
    const currentHeaders = { ...headers, 'x-kept-native-epoch': renewed.epoch };
    const oldContext = { ...headers, cookie: renewed.cookie };
    const staleCapability = await recovered.app.inject({
      url: '/api/v1/native/capture-capabilities',
      headers: oldContext,
    });
    expect(staleCapability.statusCode, staleCapability.body).toBe(409);
    expect(staleCapability.json()).toMatchObject({ reason: 'restore_epoch_mismatch' });
    const pendingId = newId();
    const refused = await call(recovered, '/api/v1/sync/ops', {
      as: renewed,
      headers,
      body: {
        clientVersion: KEPT_VERSION,
        ops: [
          {
            ...operation,
            clientId: pendingId,
            idempotencyKey: pendingId,
            payload: { ...operation.payload, id: pendingId },
          },
        ],
      },
    });
    expect(refused.statusCode, refused.body).toBe(409);
    expect(
      await own(restoredDb, 'SELECT 1 FROM public.sync_ops WHERE idempotency_key = $1', [
        pendingId,
      ]),
    ).toEqual([]);
    const refusedUpload = await upload(recovered, renewed, garage.id, pdf.bytes, {
      cls: pdf.cls,
      contentType: pdf.mime,
      headers,
    });
    expect(refusedUpload.statusCode, refusedUpload.body).toBe(409);

    const resolved = await call(recovered, '/api/v1/scan/resolve', {
      as: renewed,
      headers: currentHeaders,
      body: { text: label },
    });
    expect(resolved.json()).toMatchObject({
      outcome: 'open',
      target: { kind: 'thing', id: box.id, locationId: garage.id },
    });
    for (const original of originals) {
      const link = await call(
        recovered,
        `/api/v1/files/${original.fileId}/url?thingId=${captureId}`,
        {
          as: renewed,
          headers: currentHeaders,
          body: { variant: 'original' },
        },
      );
      expect(link.statusCode, link.body).toBe(200);
      const file = await readDrillOriginal(recovered, link.json<{ url: string }>().url);
      expect(file.mime).toBe(original.mime);
      expect(file.bytes.length).toBe(original.bytes.length);
      expect(sha256(file.bytes)).toBe(sha256(original.bytes));
    }
    await withScope(pools.app, { userId: account, mfa: false }, async (_tx, client) => {
      const record = await client.query(
        'SELECT container_id, name, notes FROM public.things WHERE id = $1',
        [captureId],
      );
      expect(record.rows).toEqual([
        { container_id: box.id, name: 'Holiday decorations', notes: 'Red and gold' },
      ]);
      const attachments = await client.query(
        'SELECT file_id, role FROM public.attachments WHERE thing_id = $1 ORDER BY sort',
        [captureId],
      );
      expect(attachments.rows).toEqual(
        originals.map(({ fileId, role }) => ({ file_id: fileId, role })),
      );
    });
  } finally {
    await restoredApp?.app.close();
    await Promise.all(Object.values(pools).map((pool) => pool.end()));
    await restored.cleanup();
  }
});

describe('the alpha runs (--legacy)', () => {
  it('are listed and restore into an empty database with every row and file', async () => {
    const target = new LocalDirTarget(path.join(scratch, 'alpha'));
    const id = await alphaRun(target);
    expect(await legacyRuns(target)).toEqual([id]);
    const before = await countsAt(db.urls.owner);
    const emptyUrl = await emptyDatabase('legacy');
    const restored = await testFiles();
    try {
      const report = await runRestore({
        ownerUrl: emptyUrl,
        target,
        runId: id,
        blobs: restored.blobs,
        pgTools: pgt.tools,
        tmpDir: restored.tmpDir,
      });
      expect(report.mismatches).toEqual([]);
      const after = await countsAt(emptyUrl);
      expect(after['public.things']).toBe(before['public.things']);
      expect(report.filesPut).toBe(report.files);
    } finally {
      await restored.cleanup();
    }
  });

  it('refuse a database that is not empty', async () => {
    const target = new LocalDirTarget(path.join(scratch, 'alpha-refuse'));
    const id = await alphaRun(target);
    const err = await runRestore({
      ownerUrl: db.urls.owner,
      target,
      runId: id,
      blobs: files.blobs,
      pgTools: pgt.tools,
      tmpDir: files.tmpDir,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RestoreError);
    expect((err as Error).message).toMatch(/not empty/);
  });
});

describe('kept admin export', () => {
  it('writes every row as raw JSON and every file, 0600, and refuses a non-empty directory', async () => {
    const modeOf = async (p: string) => (await stat(p)).mode & 0o777;
    const out = path.join(scratch, 'export');
    const before = await countsAt(db.urls.owner);
    const report = await runExport({ ownerUrl: db.urls.owner, outDir: out, blobs: files.blobs });

    expect(await modeOf(out)).toBe(0o700);
    expect(await modeOf(path.join(out, 'manifest.json'))).toBe(0o600);
    for (const [table, rows] of Object.entries(report.tables)) {
      const file = path.join(out, 'tables', `${table}.ndjson`);
      expect(await modeOf(file)).toBe(0o600);
      const text = await readFile(file, 'utf8');
      expect(text === '' ? 0 : text.trimEnd().split('\n').length, table).toBe(rows);
      expect(rows, table).toBe(before[table]);
    }
    for (const skipped of EXPORT_SKIPPED) expect(report.tables[skipped]).toBeUndefined();
    const original = report.files.find((f) => f.sha256 === sha256(photo));
    expect(original).toBeDefined();
    const copy = await readFile(path.join(out, 'files', original?.key as string));
    expect(sha256(copy)).toBe(sha256(photo));
    await expect(
      runExport({ ownerUrl: db.urls.owner, outDir: out, blobs: files.blobs }),
    ).rejects.toThrow(/not empty/);
    expect((await readdir(out)).sort()).toEqual(['files', 'manifest.json', 'tables']);
  });
});
