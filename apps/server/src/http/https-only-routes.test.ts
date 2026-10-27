import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import { type TestFiles, testFiles } from '../../test/files.js';
import { call, type Person, peopleApp, person } from '../../test/people.js';
import { ownerTx } from '../../test/tenancy.js';
import { builtinType, createLocation, createThing, own } from '../../test/things.js';
import { fixedSecretKeys, keyringOf } from '../crypto/keyring.js';

// What stays HTTPS-only on a Kept whose public URL is plain http, all on one app: everything
// that shows a secret value or hands out a key answers 403 `https_required`, holds no secret in
// its answer and makes nothing. An export without secret values is the one that goes ahead.
// Each route's own suite tests its guard too; this one fails if any of them goes missing.

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const VALUE = 'HOME-NETWORK-COMBINATION-5520';
const PASS = 'correct horse battery staple';
/** Any run id: the refusal comes before the run is looked up. */
const IMPORT_RUN = '0b7e2c4a-5d1f-4e8a-9c3b-2a6f8d0e1b47';
const keys = fixedSecretKeys(keyringOf({ version: 1, key: randomBytes(32), retired: new Map() }));

let db: TestDb;
let files: TestFiles;
let plain: TestApp;
let admin: Person;
let locationId: string;
let safe: string;

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  files = await testFiles();
  // No publicUrl: the test app's own, plain http.
  plain = await peopleApp(db, { files, secretKeys: keys, sent: [] });
  admin = await person(plain, db, 'bruce');
  await ownerTx(db, (c) =>
    c.query('INSERT INTO public.instance_admins (user_id) VALUES ($1)', [admin.userId]),
  );
  await own(
    db,
    `INSERT INTO public.instance_settings (key, value)
     VALUES ('recovery_kit_acknowledged_at', to_jsonb(now())) ON CONFLICT (key) DO NOTHING`,
  );
  const loc = await createLocation(plain, db, admin, 'complete', 'Study');
  locationId = loc.id;
  safe = (
    await createThing(plain, admin, loc, { name: 'Safe', typeId: await builtinType(db, 'safe') })
  ).id;
  const put = await call(plain, `/api/v1/things/${safe}/secrets/combination`, {
    as: admin,
    method: 'PUT',
    body: { value: VALUE },
  });
  expect(put.statusCode, put.body).toBe(204);
});

afterAll(async () => {
  await plain?.app.close();
  await files?.cleanup();
});

type Refused = {
  what: string;
  path: () => string;
  method?: 'POST' | 'PUT';
  body: () => unknown;
  headers?: Record<string, string>;
  /** Nothing of this was made. */
  none: () => Promise<unknown[]>;
};

const REFUSED: Refused[] = [
  {
    what: 'revealing a secret value',
    path: () => `/api/v1/things/${safe}/secrets/combination/reveal`,
    body: () => ({}),
    none: () => own(db, `SELECT 1 FROM public.audit_events WHERE action LIKE 'secret.reveal%'`),
  },
  {
    what: 'making an access token in the browser',
    path: () => '/api/v1/tokens',
    body: () => ({ name: 'Home Assistant', scope: 'read', locationIds: [locationId] }),
    none: () => own(db, 'SELECT 1 FROM public.api_tokens'),
  },
  {
    what: 'downloading the recovery kit',
    path: () => '/api/v1/admin/recovery-kit/download',
    body: () => ({ password: 'kept-test-password', format: 'text' }),
    none: () =>
      own(db, `SELECT 1 FROM public.audit_events WHERE action = 'instance.recovery_kit_download'`),
  },
  {
    what: 'changing the backup settings',
    path: () => '/api/v1/admin/backup',
    method: 'PUT',
    body: () => ({
      target: { kind: 'dir', path: '/mnt/nas/kept' },
      password: PASS,
      time: '03:15',
      keep: { daily: 7, weekly: 4, monthly: 6 },
    }),
    headers: { 'if-match': '0' },
    none: () => own(db, `SELECT 1 FROM public.instance_settings WHERE key LIKE 'backup%'`),
  },
  {
    what: 'testing the backup settings',
    path: () => '/api/v1/admin/backup/test',
    body: () => ({}),
    none: async () => [],
  },
  {
    what: "opening an export's secrets with its passphrase (an import)",
    path: () => `/api/v1/imports/${IMPORT_RUN}/passphrase`,
    body: () => ({ passphrase: PASS }),
    none: () => own(db, `SELECT 1 FROM public.audit_events WHERE action = 'import.passphrase'`),
  },
  {
    what: 'an export with secret values',
    path: () => '/api/v1/exports',
    body: () => ({
      scope: { locationId },
      includeSecrets: true,
      passphrase: PASS,
      passphraseAgain: PASS,
    }),
    none: () => own(db, 'SELECT 1 FROM public.export_runs WHERE include_secrets'),
  },
];

describe('over plain http', () => {
  for (const r of REFUSED) {
    it(`refuses ${r.what}: 403 https_required, nothing in the answer, nothing made`, async () => {
      const res = await call(plain, r.path(), {
        as: admin,
        method: r.method ?? 'POST',
        body: r.body(),
        ...(r.headers ? { headers: r.headers } : {}),
      });
      expect(res.statusCode, res.body).toBe(403);
      expect(res.json()).toMatchObject({ code: 'https_required' });
      expect(res.body).not.toContain(VALUE);
      expect(res.body).not.toContain(PASS);
      expect(await r.none()).toHaveLength(0);
    });
  }

  it('starts an export without secret values', async () => {
    const res = await call(plain, '/api/v1/exports', {
      as: admin,
      body: { scope: { locationId } },
    });
    expect(res.statusCode, res.body).toBe(202);
    expect(res.json()).toMatchObject({ includesSecrets: false });
    expect(res.body).not.toContain(VALUE);
  });
});
