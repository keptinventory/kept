import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import yauzl from 'yauzl';
import type { TestApp } from '../../../test/app.js';
import { homeboxZip, uploadArchive } from '../../../test/archive-imports.js';
import { type TestDb, testDb } from '../../../test/db.js';
import { type TestFiles, testFiles } from '../../../test/files.js';
import { FakePaperless } from '../../../test/paperless-fake.js';
import { call, type Person, peopleApp, person } from '../../../test/people.js';
import { createLocation, type Loc, ok, own } from '../../../test/things.js';
import { forgeZip } from '../../../test/zip-forge.js';
import { limiterKey } from '../../auth/sign-in-limiter.js';
import type { Keyring, MasterKey } from '../../crypto/envelope.js';
import { fixedSecretKeys } from '../../crypto/keyring.js';
import { runJob } from '../../jobs/boss.js';
import { PaperlessError } from '../../paperless/client.js';
import { homeboxImportJobs, runHomeboxImport } from './job.js';
import { PaperlessTitles, TITLE_CONCURRENCY, withTitlesKept } from './paperless-titles.js';
import type { PaperlessLinkOp } from './plan.js';

// A Homebox link to a Paperless document takes its title from Paperless (#422): asked outside the
// chunk's transaction, on the connection's own address and by document number only, never at an
// address the export names. Paperless is a stand-in on 127.0.0.1 (test/paperless-fake.ts).

const LONG = 240_000;

let db: TestDb;
let t: TestApp;
let files: TestFiles;
let fake: FakePaperless;
let other: FakePaperless;
let ibrahim: Person;
let homeZip: Buffer;
const master: MasterKey = { key: randomBytes(32), keyVersion: 1 };
const secretKeys = fixedSecretKeys({
  current: master,
  keyring: new Map([[1, master.key]]) as Keyring,
});
const logged: unknown[] = [];
const log = {
  info: (...args: unknown[]) => void logged.push(args),
  error: (...args: unknown[]) => void logged.push(args),
};

async function unzipped(zip: Buffer): Promise<{ name: string; data: Buffer }[]> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(zip, { lazyEntries: true }, (err, z) => {
      if (err) return reject(err);
      const out: { name: string; data: Buffer }[] = [];
      z.on('entry', (entry) => {
        z.openReadStream(entry, (e, stream) => {
          if (e) return reject(e);
          const chunks: Buffer[] = [];
          stream.on('data', (c: Buffer) => chunks.push(c));
          stream.on('end', () => {
            out.push({ name: entry.fileName, data: Buffer.concat(chunks) });
            z.readEntry();
          });
        });
      });
      z.on('end', () => resolve(out));
      z.on('error', reject);
      z.readEntry();
    });
  });
}

/** The Home export with its one link attachment made into these links, on the same thing. */
async function exportLinking(links: { title: string; path: string }[]): Promise<Buffer> {
  const entries = (await unzipped(homeZip)).map((e) => {
    if (e.name !== 'attachments.json') return e;
    const rows = JSON.parse(e.data.toString('utf8')) as Record<string, unknown>[];
    const at = rows.findIndex((r) => r.title === 'Manufacturer page');
    const base = rows[at] as Record<string, unknown>;
    rows.splice(at, 1, ...links.map((l) => ({ ...base, ...l, id: randomUUID() })));
    return { ...e, data: Buffer.from(JSON.stringify(rows)) };
  });
  return forgeZip(entries);
}

const connect = async (loc: Loc) => {
  await db.pools.auth.query('DELETE FROM auth.sign_in_failures WHERE key = $1', [
    limiterKey('paperless-check', ibrahim.userId),
  ]);
  ok(
    await call(t, `/api/v1/locations/${loc.id}/paperless`, {
      as: ibrahim,
      method: 'PUT',
      body: { url: fake.url, token: fake.token },
    }),
  );
  fake.requests.length = 0;
};

/** Upload, target, default choices, dry run. */
async function prepare(loc: Loc, zip: Buffer): Promise<string> {
  const as = ibrahim;
  const id = await uploadArchive(t, as, zip);
  ok(await call(t, `/api/v1/imports/${id}/target`, { as, body: { locationId: loc.id } }));
  ok(await call(t, `/api/v1/imports/${id}/inspect`, { as, body: {} }));
  const run = ok(await call(t, `/api/v1/imports/${id}`, { as }));
  ok(
    await call(t, `/api/v1/imports/${id}/choices`, {
      as,
      headers: { 'if-match': String(run.rowVersion) },
      body: {
        choices: {
          archived: 'skip',
          currency: 'EGP',
          quantityRounding: 'keep_note',
          fields: {},
          types: {},
          insured: 'field',
          seeded: 'skip_unused',
        },
      },
    }),
  );
  ok(await call(t, `/api/v1/imports/${id}/dry-run`, { as, body: {} }));
  return id;
}

/** Runs the prepared import to its end: `done`, or the test fails. `viaJob`: the worker's way. */
async function run(id: string, opts: { chunk?: number; viaJob?: boolean } = {}): Promise<void> {
  const res = await call(t, `/api/v1/imports/${id}/run`, { as: ibrahim, body: {} });
  expect(res.statusCode, res.body).toBe(202);
  if (opts.viaJob) {
    const job = homeboxImportJobs({
      pools: db.pools,
      mailer: { send: async () => {} },
      publicUrl: 'https://kept.example',
      log,
      files,
      secretKeys,
      sendTenant: async () => {},
    }).find((j) => j.name === 'import-homebox');
    if (!job) throw new Error('no import-homebox job');
    await runJob(job, { userId: ibrahim.userId, mfa: false, data: { runId: id } }, db.pools);
  } else {
    await runHomeboxImport(
      {
        pools: db.pools,
        files,
        jobs: { send: async () => {}, sendTenant: async () => {} },
        log,
        secretKeys,
        ...(opts.chunk ? { chunk: opts.chunk } : {}),
      },
      { userId: ibrahim.userId, mfa: false },
      id,
    );
  }
  const [row] = await own<{ status: string; error: string | null }>(
    db,
    'SELECT status, error FROM public.import_runs WHERE id = $1',
    [id],
  );
  expect(row).toEqual({ status: 'done', error: null });
}

const fresh = (name: string) => createLocation(t, db, ibrahim, 'complete', name);
const titlesIn = async (loc: Loc) =>
  Object.fromEntries(
    (
      await own<{ document_id: number; title: string }>(
        db,
        'SELECT document_id, title FROM public.paperless_links WHERE location_id = $1',
        [loc.id],
      )
    ).map((r) => [r.document_id, r.title]),
  );
const docAsked = (f: FakePaperless, id: number) => f.count(`/api/documents/${id}/`);
const asked = (f: FakePaperless) =>
  f.requests.filter((r) => r.path.startsWith('/api/documents/')).length;
type ReportRow = {
  status: string;
  ref: { kind: string; id: string; name?: string };
  issues: { code: string; params?: { count?: number } }[];
};
/** What the done screen reads: the run's stored report. */
const reportOf = async (id: string) => {
  const view = ok(await call(t, `/api/v1/imports/${id}`, { as: ibrahim })) as unknown as {
    report?: { rows: ReportRow[] };
  };
  expect(view.report, 'the run still has a report that parses').toBeDefined();
  return view.report?.rows ?? [];
};
const titleNotes = async (id: string) =>
  (await reportOf(id)).flatMap((r) =>
    r.issues.filter((i) => i.code === 'hb_paperless_titles_kept').map((i) => i.params?.count),
  );
const docUrl = (n: number) => `${fake.url}/documents/${n}/details`;

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  files = await testFiles();
  fake = new FakePaperless();
  other = new FakePaperless();
  await fake.start();
  await other.start();
  t = await peopleApp(db, { sent: [], files, secretKeys });
  ibrahim = await person(t, db, 'ibrahim');
  // The stand-ins are on 127.0.0.1: the admin's switch for private addresses, as on a LAN.
  await own(
    db,
    `INSERT INTO public.instance_settings (key, value) VALUES ('ssrf_allow_private', 'true')
     ON CONFLICT (key) DO UPDATE SET value = 'true'`,
  );
  homeZip = await homeboxZip('home');
}, 120_000);

afterAll(async () => {
  await fake?.stop();
  await other?.stop();
  await files?.cleanup();
});

beforeEach(() => {
  fake.down = false;
  fake.token = 'f'.repeat(40);
  fake.forbidden.clear();
  fake.requests.length = 0;
  other.requests.length = 0;
  logged.length = 0;
});

describe('a Homebox link to a Paperless document, during the import (#422)', () => {
  it(
    "takes its title from Paperless, not Homebox's, asking once per document; the check never asks",
    async () => {
      const loc = await fresh('Den');
      await connect(loc);
      const id = await prepare(
        loc,
        await exportLinking([
          { title: 'Homebox says receipt', path: docUrl(12) },
          { title: 'Homebox says manual', path: `${fake.url}/api/documents/13/download/` },
          { title: 'The receipt again', path: `${fake.url}/documents/12` },
        ]),
      );
      // The dry run plans in a request's transaction: Paperless isn't asked.
      expect(asked(fake)).toBe(0);
      await run(id, { viaJob: true });
      expect(await titlesIn(loc)).toEqual({ 12: 'Drill receipt', 13: 'Bosch GSB 18V manual' });
      expect(docAsked(fake, 12)).toBe(1);
      expect(docAsked(fake, 13)).toBe(1);
      expect(await titleNotes(id)).toEqual([]);
      // The audit event says what the link holds.
      const titles = await own<{ title: string }>(
        db,
        `SELECT diff->'title'->>'after' AS title FROM public.audit_events
          WHERE location_id = $1 AND action = 'paperless_link.create' ORDER BY 1`,
        [loc.id],
      );
      expect(titles.map((r) => r.title)).toEqual(['Bosch GSB 18V manual', 'Drill receipt']);
    },
    LONG,
  );

  it(
    "keeps Homebox's title for a document Paperless doesn't have or won't show, and carries on",
    async () => {
      const loc = await fresh('Attic');
      await connect(loc);
      fake.forbidden.add(13);
      const id = await prepare(
        loc,
        await exportLinking([
          { title: 'Gone from Paperless', path: docUrl(999) },
          { title: 'Not for this token', path: docUrl(13) },
          { title: 'Homebox says receipt', path: docUrl(12) },
        ]),
      );
      await run(id);
      expect(await titlesIn(loc)).toEqual({
        999: 'Gone from Paperless',
        13: 'Not for this token',
        12: 'Drill receipt',
      });
      expect(await titleNotes(id)).toEqual([2]);
    },
    LONG,
  );

  it(
    "succeeds with Homebox's titles when Paperless can't be reached, and stops asking",
    async () => {
      const loc = await fresh('Loft');
      await connect(loc);
      const id = await prepare(
        loc,
        await exportLinking(
          [12, 13, 14, 21, 31, 32, 33, 34, 35, 36, 37, 38].map((n) => ({
            title: `Homebox ${n}`,
            path: docUrl(n),
          })),
        ),
      );
      fake.down = true;
      // Small chunks: the stop holds from one chunk to the next.
      await run(id, { chunk: 3 });
      const titles = await titlesIn(loc);
      expect(Object.values(titles).sort()).toEqual(
        [12, 13, 14, 21, 31, 32, 33, 34, 35, 36, 37, 38].map((n) => `Homebox ${n}`).sort(),
      );
      // Those already on their way when the first failed, and none after.
      expect(asked(fake)).toBeLessThanOrEqual(TITLE_CONCURRENCY);
      // Summed over the chunks, one row in the report.
      expect(await titleNotes(id)).toEqual([12]);
      const blob = JSON.stringify([logged, await reportOf(id)]);
      expect(blob).not.toContain(fake.token);
    },
    LONG,
  );

  it(
    'stops asking when Paperless refuses the token, which reaches neither report nor log',
    async () => {
      const loc = await fresh('Porch');
      await connect(loc);
      const token = fake.token;
      const id = await prepare(
        loc,
        await exportLinking(
          [12, 13, 14, 21, 31, 32, 33, 34, 35, 36].map((n) => ({
            title: `Homebox ${n}`,
            path: docUrl(n),
          })),
        ),
      );
      fake.token = 'a'.repeat(40); // the one Kept holds is now revoked
      await run(id);
      expect(asked(fake)).toBeLessThanOrEqual(TITLE_CONCURRENCY);
      expect(await titleNotes(id)).toEqual([10]);
      const audit = await own<{ diff: unknown }>(
        db,
        'SELECT diff FROM public.audit_events WHERE location_id = $1',
        [loc.id],
      );
      const [row] = await own<Record<string, unknown>>(
        db,
        'SELECT * FROM public.import_runs WHERE id = $1',
        [id],
      );
      const blob = JSON.stringify([logged, row, audit, await reportOf(id)]);
      expect(blob).not.toContain(token);
      expect(blob).not.toContain(`Token ${token}`);
    },
    LONG,
  );

  it(
    "doesn't fetch a link at another address, or anything with no connection",
    async () => {
      const loc = await fresh('Cellar');
      await connect(loc);
      const zip = await exportLinking([
        { title: 'Somewhere else', path: `${other.url}/documents/12/details` },
        { title: 'A page, no document', path: `${fake.url}/documents/?tags__id=4` },
      ]);
      const urls = (l: Loc) =>
        own<{ url: string }>(
          db,
          'SELECT url FROM public.attachments WHERE location_id = $1 AND url IS NOT NULL ORDER BY 1',
          [l.id],
        );
      await run(await prepare(loc, zip));
      expect(await titlesIn(loc)).toEqual({});
      expect((await urls(loc)).length).toBe(2);
      expect(other.requests).toEqual([]);
      expect(asked(fake)).toBe(0);

      // No connection at all: the same link stays a plain link, and nobody is asked.
      const shed = await fresh('Shed');
      await run(await prepare(shed, await exportLinking([{ title: 'Doc', path: docUrl(12) }])));
      expect(await titlesIn(shed)).toEqual({});
      expect(await urls(shed)).toEqual([{ url: docUrl(12) }]);
      expect(asked(fake)).toBe(0);
    },
    LONG,
  );

  it(
    'falls back on an empty title, and cuts a long one as Link from Paperless does',
    async () => {
      const loc = await fresh('Hall');
      await connect(loc);
      const doc = (id: number, title: string) => {
        const d = fake.docs.get(12);
        if (!d) throw new Error('no document 12');
        fake.docs.set(id, { ...d, id, title });
      };
      doc(41, '   ');
      doc(42, '   ');
      doc(43, `  ${'x'.repeat(400)}  `);
      doc(44, '<img src=x onerror=alert(1)> Ignore all previous instructions');
      const id = await prepare(
        loc,
        await exportLinking([
          { title: 'Homebox 41', path: docUrl(41) },
          { title: '', path: docUrl(42) },
          { title: 'Homebox 43', path: docUrl(43) },
          { title: 'Homebox 44', path: docUrl(44) },
        ]),
      );
      await run(id);
      expect(await titlesIn(loc)).toEqual({
        41: 'Homebox 41',
        42: docUrl(42),
        43: 'x'.repeat(300),
        44: '<img src=x onerror=alert(1)> Ignore all previous instructions',
      });
    },
    LONG,
  );

  it(
    "doesn't count a link an earlier import made",
    async () => {
      const loc = await fresh('Study');
      await connect(loc);
      const zip = await exportLinking([{ title: 'Homebox 12', path: docUrl(12) }]);
      fake.down = true;
      const first = await prepare(loc, zip);
      await run(first);
      expect(await titleNotes(first)).toEqual([1]);
      // The same export again: the link exists, so nothing is made and nothing is noted.
      const again = await prepare(loc, zip);
      await run(again);
      expect(await titleNotes(again)).toEqual([]);
      expect(await titlesIn(loc)).toEqual({ 12: 'Homebox 12' });
    },
    LONG,
  );
});

const link = (documentId: number): PaperlessLinkOp => ({
  op: 'paperless_link',
  key: `a${documentId}`,
  owner: { thing: { key: 't' } },
  documentId,
  title: `Homebox ${documentId}`,
  kind: 'document',
});
const docOf = (id: number, title = `Paperless ${id}`) => ({ id, title });

describe('asking Paperless for titles', () => {
  it('asks a few at a time', async () => {
    let now = 0;
    let most = 0;
    const source = {
      document: async (id: number) => {
        now += 1;
        most = Math.max(most, now);
        await new Promise((r) => setTimeout(r, 2));
        now -= 1;
        return docOf(id);
      },
    };
    const titles = new PaperlessTitles(async () => source);
    await titles.fetch(Array.from({ length: 40 }, (_, i) => link(i + 1)));
    expect(most).toBe(TITLE_CONCURRENCY);
    expect(titles.titleOf(40)).toBe('Paperless 40');
  });

  it("stops at the time budget: a Paperless that is only slow can't hold an import for hours", async () => {
    let clock = 0;
    let calls = 0;
    const source = {
      document: async (id: number) => {
        calls += 1;
        clock += 60_000;
        return docOf(id);
      },
    };
    const titles = new PaperlessTitles(async () => source, { budgetMs: 180_000, now: () => clock });
    await titles.fetch(Array.from({ length: 1000 }, (_, i) => link(i + 1)));
    await titles.fetch([link(2000)]);
    expect(calls).toBeLessThan(10);
    expect(titles.stopped).toBe('budget');
    expect(titles.titleOf(2000)).toBeUndefined();
  });

  it('never asks again after a connection failure, and never opens a connection it has no use for', async () => {
    let opened = 0;
    let calls = 0;
    const titles = new PaperlessTitles(async () => {
      opened += 1;
      return {
        document: async () => {
          calls += 1;
          throw new PaperlessError('unreachable');
        },
      };
    });
    await titles.fetch([]);
    expect(opened).toBe(0);
    await titles.fetch(Array.from({ length: 50 }, (_, i) => link(i + 1)));
    await titles.fetch([link(100)]);
    expect(opened).toBe(1);
    expect(calls).toBeLessThanOrEqual(TITLE_CONCURRENCY);
    expect(titles.stopped).toBe('unreachable');
  });

  it('treats a document it may not see as that document only, and a refused token as the end', async () => {
    const seen = (status: 401 | 403) =>
      new PaperlessTitles(async () => ({
        document: async (id) => {
          if (id === 1) throw new PaperlessError('auth_failed', status);
          return docOf(id);
        },
      }));
    const forbidden = seen(403);
    await forbidden.fetch([link(1)]);
    await forbidden.fetch([link(2)]);
    expect(forbidden.stopped).toBeNull();
    expect(forbidden.titleOf(2)).toBe('Paperless 2');
    const revoked = seen(401);
    await revoked.fetch([link(1)]);
    await revoked.fetch([link(2)]);
    expect(revoked.stopped).toBe('auth_failed');
    expect(revoked.titleOf(2)).toBeUndefined();
  });

  it('reads a connection that will not open as no titles, not a failed import', async () => {
    const titles = new PaperlessTitles(async () => {
      throw new Error('the sealed config would not open');
    });
    await titles.fetch([link(1)]);
    expect(titles.stopped).toBe('no_connection');
    expect(titles.titleOf(1)).toBeUndefined();
  });

  it('notes the links on one row of the report, adding up over chunks and a resumed run', () => {
    const entity = { status: 'text', ref: { kind: 'entity', id: 'e1' }, issues: [] };
    const once = withTitlesKept({ source: 'homebox_zip', summary: {}, rows: [entity] }, 2);
    const twice = withTitlesKept(once, 3) as { source: string; rows: ReportRow[] };
    expect(twice.source).toBe('homebox_zip');
    expect(twice.rows).toHaveLength(2);
    expect(twice.rows[0]).toEqual(entity);
    expect(twice.rows[1]?.status).toBe('ok');
    expect(twice.rows[1]?.issues[0]).toMatchObject({
      code: 'hb_paperless_titles_kept',
      params: { count: 5 },
    });
    expect(withTitlesKept(null, 1)).toBeNull();
  });
});
