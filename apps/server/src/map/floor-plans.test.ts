import { FLOOR_PLAN_FILE, newId, type PlanDrafts, type PlanExtraction } from '@kept/shared';
import { answerFor, inventedPlan, sentSize } from '@kept/shared/floor-plan.fixtures';
import type { LightMyRequestResponse } from 'fastify';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import { type TestFiles, testFiles, upload } from '../../test/files.js';
import { notAPlanPng, planPng } from '../../test/floor-plans.js';
import { encryptedPdf, textPdf } from '../../test/pdf.js';
import { call, join, type Person, peopleApp, person, type RecordedJob } from '../../test/people.js';
import { createLocation, type Loc, own } from '../../test/things.js';
import { providerKeyAad } from '../ai/db-keys.js';
import { type MockAnswer, mockKey } from '../ai/mock.js';
import { aiRuntime } from '../ai/runtime.js';
import { seal } from '../crypto/envelope.js';
import { withScope } from '../db/scope.js';
import { readEntity } from '../exports/data.js';
import { entityDef } from '../exports/registry.js';
import { partsFor } from '../extraction/image.js';
import { type ExtractionJobDeps, runExtraction } from '../extraction/job.js';
import { planPrompt } from '../extraction/prompts/plan.js';
import { renderPdfForPlan } from './floor-plans.js';

// Floor plan to map (1.14.3, D266) through the front door: POST …/floor-plans with an invented
// plan, the `plan` extraction read by the mock provider, GET the review, apply its rooms in one
// event, undo that, discard, retry, the 30-day sweep, and the map's open plans. Ibrahim owns Home;
// Louis and Peter are members, Bruce an admin, Talia a viewer; Alfred owns بيت العائلة.

let db: TestDb;
let t: TestApp;
let files: TestFiles;
const sent: RecordedJob[] = [];
let ibrahim: Person;
let louis: Person;
let peter: Person;
let bruce: Person;
let talia: Person;
let alfred: Person;
let home: Loc;
let family: Loc;

const MASTER = { key: Buffer.alloc(32, 7), keyVersion: 1 };
const keyring = new Map([[1, MASTER.key]]);
const silent = { warn: () => {}, info: () => {}, error: () => {} };
let answers: Record<string, MockAnswer> = {};

const deps = (): ExtractionJobDeps => ({
  pools: db.pools,
  ai: {
    mock: true,
    runtime: (scope) =>
      aiRuntime({ pools: db.pools, keyring: () => keyring, log: silent, mock: answers }, scope),
  },
  files,
  sendLater: async () => {},
  log: silent,
});

const sql = <T extends Record<string, unknown>>(text: string, values: unknown[] = []) =>
  own<T>(db, text, values);

async function json<T>(res: Promise<LightMyRequestResponse>, status = 200): Promise<T> {
  const r = await res;
  expect(r.statusCode, r.body).toBe(status);
  return r.json() as T;
}

async function uploaded(
  as: Person,
  bytes: Buffer,
  loc: Loc = home,
  contentType = 'image/png',
): Promise<string> {
  const res = await upload(t, as, loc.id, bytes, { cls: 'document', contentType });
  expect([200, 201], res.body).toContain(res.statusCode);
  const body = res.json() as { id: string; deduplicatedFrom?: string };
  return body.deduplicatedFrom ?? body.id;
}

type View = {
  id: string;
  status: string;
  turn: number;
  keepPlan: boolean;
  read: { status: string; reason: string | null; attempt: number } | null;
  file: { id: string; attachmentId: string; mime: string } | null;
  image: { w: number; h: number } | null;
  answer: PlanExtraction | null;
  drafts: PlanDrafts | null;
};

const start = (as: Person, body: Record<string, unknown>, loc: Loc = home) =>
  call(t, `/api/v1/locations/${loc.id}/floor-plans`, { as, body });
const view = (as: Person, id: string) => call(t, `/api/v1/floor-plans/${id}`, { as });

/** The mock's key for what the job sends for this plan's upload. */
async function keyOf(
  fileId: string,
  mime = 'image/png',
  turn = 0,
  loc: Loc = home,
): Promise<string> {
  const parts = await partsFor('plan', [{ attachmentId: 'a', fileId, locationId: loc.id, mime }], {
    blobs: files.blobs,
    textOf: async () => null,
    turn,
    renderPdf: (id) => renderPdfForPlan(files, loc.id, id),
  });
  const img = parts.images[0];
  if (!img) throw new Error('nothing to send');
  return mockKey(img.bytes);
}

const extractionOf = async (planId: string) =>
  (
    await sql<{
      id: string;
      status: string;
      status_reason: string | null;
      mode: string;
      attempt: number;
    }>(
      `SELECT id, status, status_reason, mode, attempt FROM public.extractions
        WHERE floor_plan_id = $1 ORDER BY attempt DESC`,
      [planId],
    )
  )[0];

const run = async (as: Person, planId: string) => {
  const ex = await extractionOf(planId);
  if (!ex) throw new Error('no extraction');
  return runExtraction(deps(), { userId: as.userId, mfa: false }, ex.id);
};

/** Uploads an invented plan, answers it as the fixtures say, reads it, and returns the review. */
async function readPlan(id = 'f1-flat-dims', as: Person = louis, loc: Loc = home): Promise<View> {
  const bytes = await planPng(id);
  const fileId = await uploaded(as, bytes, loc);
  const p = inventedPlan(id);
  const size = sentSize(p);
  answers[await keyOf(fileId, 'image/png', 0, loc)] = {
    output: answerFor(p, size.w, size.h, { noise: 0.01, corners: 'none' }),
  };
  const out = await json<View>(start(as, { fileId }, loc), 201);
  await run(as, out.id);
  return json<View>(view(as, out.id));
}

async function placeOf(loc: Loc, name: string, parentId: string | null, kind = 'room') {
  const id = newId();
  await sql(
    'INSERT INTO public.places (id, location_id, parent_id, name, kind_key) VALUES ($1, $2, $3, $4, $5)',
    [id, loc.id, parentId, name, kind],
  );
  return id;
}

const mapOf = (as: Person, loc: Loc = home) =>
  json<{
    version: string | null;
    levels: { id: string | null }[];
    rooms: {
      id: string;
      name: string;
      levelId: string | null;
      layout: { x: number; w: number } | null;
    }[];
    openPlans: { id: string; status: string }[];
  }>(call(t, `/api/v1/locations/${loc.id}/map`, { as }));

type ApplyBody = {
  version: string | null;
  keepPlan: boolean;
  floors: { key: string; id: string | null; name: string }[];
  rooms: {
    key: string;
    floorKey: string | null;
    placeId: string | null;
    name: string;
    kind: string;
    surface: string;
    x: number;
    z: number;
    w: number;
    d: number;
  }[];
};

const apply = (as: Person, id: string, body: ApplyBody) =>
  call(t, `/api/v1/floor-plans/${id}/apply`, { as, body });

/** The review's drafts as the web would send them: every live room on one new or given level. */
function bodyOf(
  v: View,
  version: string | null,
  floor: { id: string | null; name: string } | null,
  over: Partial<ApplyBody> = {},
): ApplyBody {
  const live = (v.drafts?.rooms ?? []).filter((r) => !r.skip);
  return {
    version,
    keepPlan: false,
    floors: floor ? [{ key: 'f0', id: floor.id, name: floor.name }] : [],
    rooms: live.map((r) => ({
      key: r.key,
      floorKey: floor ? 'f0' : null,
      placeId: null,
      name: r.name ?? 'Room',
      kind: r.kind,
      surface: r.kind === 'balcony' ? 'deck' : 'wood',
      x: Math.round(r.x * 100) + 2000,
      z: Math.round(r.z * 100),
      w: Math.round(r.w * 100),
      d: Math.round(r.d * 100),
    })),
    ...over,
  };
}

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  files = await testFiles();
  t = await peopleApp(db, { files, sent });
  ibrahim = await person(t, db, 'ibrahim');
  louis = await person(t, db, 'louis');
  peter = await person(t, db, 'peter');
  bruce = await person(t, db, 'bruce');
  talia = await person(t, db, 'talia');
  alfred = await person(t, db, 'alfred');
  home = await createLocation(t, db, ibrahim, 'household');
  family = await createLocation(t, db, alfred, 'household');
  await join(db, home.id, louis.userId, 'member');
  await join(db, home.id, peter.userId, 'member');
  await join(db, home.id, bruce.userId, 'admin');
  await join(db, home.id, talia.userId, 'viewer');
  const providerId = newId();
  await sql(
    `INSERT INTO public.ai_providers (id, scope, owner_account_id, kind, key_ciphertext,
                                      key_version, models, created_by)
     VALUES ($1, 'account', $2, 'groq', $3, 1, '{"vision": "qwen/qwen3.8-27b"}', $4)`,
    [
      providerId,
      home.accountId,
      JSON.stringify(seal(MASTER, 'gsk_TESTKEY-plan', providerKeyAad(providerId))),
      ibrahim.userId,
    ],
  );
});

beforeEach(() => {
  answers = {};
  sent.length = 0;
});

afterAll(async () => {
  await t.app.close();
  await files.cleanup();
});

// ---- Starting a read ------------------------------------------------------------------------

describe('POST /api/v1/locations/:id/floor-plans', () => {
  // catalogue: POST /api/v1/locations/:id/floor-plans
  it('attaches the plan under review, makes the row, queues one plan read and audits it', async () => {
    const fileId = await uploaded(louis, await planPng('f8-no-scale'));
    const out = await json<View>(start(louis, { fileId, turn: 90 }), 201);
    expect(out).toMatchObject({ status: 'reading', turn: 90, keepPlan: false });
    expect(out.read).toMatchObject({ status: 'queued', attempt: 1 });
    const [att] = await sql<{
      floor_plan_id: string;
      in_review: boolean;
      role: string;
      file_id: string;
    }>(
      'SELECT floor_plan_id, in_review, role, file_id FROM public.attachments WHERE floor_plan_id = $1',
      [out.id],
    );
    expect(att).toMatchObject({
      floor_plan_id: out.id,
      in_review: true,
      role: 'document',
      file_id: fileId,
    });
    expect((await extractionOf(out.id))?.mode).toBe('plan');
    expect(sent.filter((j) => j.name === 'extract')).toHaveLength(1);
    const [ev] = await sql<{
      action: string;
      entity_type: string;
      undoable_until: Date | null;
      diff: Record<string, { after?: unknown }>;
    }>(
      `SELECT action, entity_type, undoable_until, diff FROM public.audit_events
        WHERE location_id = $1 AND action = 'floor_plan.read' ORDER BY at DESC LIMIT 1`,
      [home.id],
    );
    expect(ev).toMatchObject({
      action: 'floor_plan.read',
      entity_type: 'location',
      undoable_until: null,
    });
    expect(ev?.diff.plan_id?.after).toBe(out.id);
    // The plan is never the location's own document.
    const docs = await json<{ items: { id: string }[] }>(
      call(t, `/api/v1/locations/${home.id}/attachments`, { as: ibrahim }),
    );
    expect(out.file?.attachmentId).toBeTruthy();
    expect(docs.items.some((d) => d.id === out.file?.attachmentId)).toBe(false);
  });

  it('refuses a viewer (403) and anyone outside the location (404)', async () => {
    const fileId = await uploaded(louis, await planPng('f7-imperial'));
    expect((await start(talia, { fileId })).statusCode).toBe(403);
    expect((await start(alfred, { fileId })).statusCode).toBe(404);
    const theirs = await uploaded(alfred, await planPng('f7-imperial'), family);
    expect((await start(louis, { fileId: theirs }, family)).statusCode).toBe(404);
    // Someone else's file, even in a location of yours, isn't yours to send.
    expect((await start(louis, { fileId: theirs })).statusCode).toBe(404);
  });

  it('is 409 module_off with AI capture off, and waits when no provider reads photos', async () => {
    const shed = await createLocation(t, db, ibrahim, 'household');
    await sql(
      `INSERT INTO public.location_modules (location_id, module, enabled) VALUES ($1, 'ai_capture', false)
       ON CONFLICT (location_id, module) DO UPDATE SET enabled = false`,
      [shed.id],
    );
    const fileId = await uploaded(ibrahim, await planPng('f2-l-shape'), shed);
    const off = await start(ibrahim, { fileId }, shed);
    expect(off.statusCode, off.body).toBe(409);
    expect((off.json() as { code: string }).code).toBe('module_off');
    // Louis's own location is in an account with no provider.
    const own = await createLocation(t, db, louis, 'household');
    const mine = await uploaded(louis, await planPng('f2-l-shape'), own);
    const waits = await json<View>(start(louis, { fileId: mine }, own), 201);
    expect(waits.read).toMatchObject({ status: 'waiting_provider' });
  });

  it('refuses a file that is no image or PDF', async () => {
    // The upload route takes only images and PDFs today (storage/sniff.ts; videos only with
    // allowVideo, which no route passes yet), so the video D170 plans is put in place directly:
    // Louis's own file, in Home.
    const fileId = newId();
    await sql(
      `INSERT INTO public.files (id, location_id, storage_key, sha256, bytes, mime, class,
                                 derivative_state, created_by)
       VALUES ($1, $2, $3, $4, 10, 'video/mp4', 'video', 'not_applicable', $5)`,
      [fileId, home.id, `f/${home.id}/${fileId}`, 'a'.repeat(64), louis.userId],
    );
    const res = await start(louis, { fileId });
    expect(res.statusCode, res.body).toBe(400);
    expect(await sql('SELECT 1 FROM public.attachments WHERE file_id = $1', [fileId])).toEqual([]);
  });

  it('is never attached through POST /api/v1/attachments', async () => {
    const v = await readPlan('f2-l-shape');
    const fileId = await uploaded(louis, await planPng('f8-no-scale'));
    const res = await call(t, '/api/v1/attachments', {
      as: louis,
      body: {
        id: newId(),
        locationId: home.id,
        fileId,
        subject: { floorPlanId: v.id },
        role: 'document',
      },
    });
    // The route's own subjects don't include a plan: the body is refused outright.
    expect(res.statusCode, res.body).toBe(400);
    expect((res.json() as { hint?: string }).hint).toBe('Check body.subject.');
    expect(
      await sql('SELECT 1 FROM public.attachments WHERE floor_plan_id = $1 AND file_id = $2', [
        v.id,
        fileId,
      ]),
    ).toEqual([]);
  });
});

// ---- The read ---------------------------------------------------------------------------------

describe('the plan read (the extract job, mock provider)', () => {
  it('turns an invented plan’s answer into the review’s rooms, beside nothing yet', async () => {
    const v = await readPlan('f1-flat-dims');
    expect(v.status).toBe('ready');
    expect(v.image).toEqual(sentSize(inventedPlan('f1-flat-dims')));
    expect(v.drafts?.scale.from).toBe('sizes');
    expect(v.drafts?.rooms).toHaveLength(7);
    expect(v.drafts?.rooms.find((r) => r.name === 'Cupboard')).toMatchObject({ skip: true });
    expect(v.answer?.is_plan).toBe(true);
    const [call0] = await sql<{ task: string; prompt_version: string; extraction_id: string }>(
      `SELECT task, prompt_version, extraction_id FROM public.llm_calls
        WHERE extraction_id = (SELECT id FROM public.extractions WHERE floor_plan_id = $1 LIMIT 1)`,
      [v.id],
    );
    expect(call0).toMatchObject({ task: 'extract_plan', prompt_version: 'plan-v1' });
    expect((await extractionOf(v.id))?.status).toBe('succeeded');
  });

  it('answers the default (three rooms) for a plan the mock doesn’t know', async () => {
    const fileId = await uploaded(louis, await planPng('f6-scale-bar-doors'));
    const out = await json<View>(start(louis, { fileId }), 201);
    await run(louis, out.id);
    const v = await json<View>(view(louis, out.id));
    expect(v.status).toBe('ready');
    expect(v.drafts?.rooms.map((r) => r.name)).toEqual(['Living room', 'Kitchen', 'Bedroom']);
  });

  it('is ready with no rooms when the image is no plan', async () => {
    const fileId = await uploaded(louis, await notAPlanPng(3));
    answers[await keyOf(fileId)] = { output: { is_plan: false } };
    const out = await json<View>(start(louis, { fileId }), 201);
    await run(louis, out.id);
    const v = await json<View>(view(louis, out.id));
    expect(v.status).toBe('ready');
    expect(v.drafts).toMatchObject({ isPlan: false, rooms: [] });
  });

  // catalogue: POST /api/v1/floor-plans/:id/retry
  it('fails on an answer that isn’t the schema, and Try again reads it once more', async () => {
    const fileId = await uploaded(louis, await notAPlanPng(4));
    answers[await keyOf(fileId)] = { output: { rooms: 'nothing' } };
    const out = await json<View>(start(louis, { fileId }), 201);
    await run(louis, out.id);
    const v = await json<View>(view(louis, out.id));
    expect(v.status).toBe('failed');
    expect(v.read).toMatchObject({ status: 'failed' });
    answers[await keyOf(fileId)] = { output: { is_plan: true, rooms: [] } };
    const again = await json<View>(
      call(t, `/api/v1/floor-plans/${out.id}/retry`, { as: louis, body: {} }),
    );
    expect(again).toMatchObject({ status: 'reading', read: { status: 'queued', attempt: 2 } });
    const events = await sql<{ action: string }>(
      `SELECT action FROM public.audit_events WHERE location_id = $1 AND action = 'floor_plan.read'
          AND diff -> 'plan_id' ->> 'after' = $2`,
      [home.id, out.id],
    );
    expect(events).toHaveLength(2);
    await run(louis, out.id);
    expect((await json<View>(view(louis, out.id))).status).toBe('ready');
    // A viewer can't retry; a plan that isn't failed isn't retried.
    expect(
      (await call(t, `/api/v1/floor-plans/${out.id}/retry`, { as: talia, body: {} })).statusCode,
    ).toBe(404);
    expect(
      (await call(t, `/api/v1/floor-plans/${out.id}/retry`, { as: louis, body: {} })).statusCode,
    ).toBe(409);
  });

  it('fails, with its reason, a PDF whose first page can’t be drawn', async () => {
    const pdf = await uploaded(louis, encryptedPdf(), home, 'application/pdf');
    const out = await json<View>(start(louis, { fileId: pdf }), 201);
    const r = await run(louis, out.id);
    expect(r).toEqual({ status: 'failed', reason: 'pdf_render' });
    const v = await json<View>(view(louis, out.id));
    expect(v).toMatchObject({ status: 'failed', read: { status: 'failed', reason: 'pdf_render' } });
  });

  it('pauses at a budget cap and stays reading', async () => {
    const shed = await createLocation(t, db, ibrahim, 'household');
    const [cap] = await sql<{ id: string }>(
      `INSERT INTO public.ai_budgets (scope, owner_account_id, location_id, tokens_per_month, set_by)
       VALUES ('location', $1, $2, 10, $3) RETURNING id`,
      [shed.accountId, shed.id, ibrahim.userId],
    );
    const fileId = await uploaded(ibrahim, await planPng('f3-two-floors-table'), shed);
    const out = await json<View>(start(ibrahim, { fileId }, shed), 201);
    const r = await run(ibrahim, out.id);
    expect(r.status).toBe('paused_budget');
    const v = await json<View>(view(ibrahim, out.id));
    expect(v).toMatchObject({ status: 'reading', read: { status: 'paused_budget' } });
    await sql('DELETE FROM public.ai_budgets WHERE id = $1', [cap?.id]);
  });

  it('sends the evidence re-encode, turned, with no metadata; a PDF’s first page with its text', async () => {
    const fileId = await uploaded(louis, await planPng('f8-no-scale'));
    const parts = await partsFor(
      'plan',
      [{ attachmentId: 'a', fileId, locationId: home.id, mime: 'image/png' }],
      {
        blobs: files.blobs,
        textOf: async () => null,
        turn: 90,
      },
    );
    const img = parts.images[0];
    const size = sentSize(inventedPlan('f8-no-scale'));
    expect(img).toMatchObject({ mediaType: 'image/jpeg', width: size.h, height: size.w });
    const m = await sharp(Buffer.from(img?.bytes ?? [])).metadata();
    expect(m.exif).toBeUndefined();
    expect(m.xmp).toBeUndefined();
    expect(Math.max(m.width ?? 0, m.height ?? 0)).toBeLessThanOrEqual(FLOOR_PLAN_FILE.maxPx);

    const pdf = await uploaded(
      louis,
      textPdf([['Ground floor', 'Kitchen 3.40 x 2.80 m'], ['Second page']]),
      home,
      'application/pdf',
    );
    const pdfParts = await partsFor(
      'plan',
      [{ attachmentId: 'b', fileId: pdf, locationId: home.id, mime: 'application/pdf' }],
      {
        blobs: files.blobs,
        textOf: async () => null,
        renderPdf: (id) => renderPdfForPlan(files, home.id, id),
      },
    );
    expect(pdfParts.images).toHaveLength(1);
    expect(pdfParts.documentText).toContain('Kitchen 3.40 x 2.80 m');
    expect(pdfParts.documentText).not.toContain('Second page');
    const prompt = planPrompt({ languages: ['en'], documentText: pdfParts.documentText ?? '' });
    expect(prompt.text).toContain('<document>');
    expect(prompt.system).not.toMatch(/Kitchen/);
    // And the read itself goes through.
    answers[await keyOf(pdf, 'application/pdf')] = { output: { is_plan: true, rooms: [] } };
    const out = await json<View>(start(louis, { fileId: pdf }), 201);
    await run(louis, out.id);
    expect((await json<View>(view(louis, out.id))).status).toBe('ready');
  });
});

// ---- The review -------------------------------------------------------------------------------

describe('GET /api/v1/floor-plans/:id and the map’s open plans', () => {
  it('shows the review to members and up, never to a viewer or anyone outside', async () => {
    const v = await readPlan('f4-rotated-4deg');
    expect((await view(peter, v.id)).statusCode).toBe(200);
    expect((await view(talia, v.id)).statusCode).toBe(404);
    expect((await view(alfred, v.id)).statusCode).toBe(404);
    const mine = await mapOf(louis);
    expect(mine.openPlans.some((p) => p.id === v.id && p.status === 'ready')).toBe(true);
    expect((await mapOf(talia)).openPlans).toEqual([]);
    // Viewers read no floor_plans row at all (row-level security).
    const seen = await withScope(db.pools.app, { userId: talia.userId, mfa: false }, (_tx, c) =>
      c.query('SELECT 1 FROM public.floor_plans WHERE id = $1', [v.id]),
    );
    expect(seen.rowCount).toBe(0);
    // A member inserts a row only as themself.
    const code = await withScope(db.pools.app, { userId: louis.userId, mfa: false }, (_tx, c) =>
      c.query(
        `INSERT INTO public.floor_plans (location_id, status, created_by) VALUES ($1, 'reading', $2)`,
        [home.id, peter.userId],
      ),
    ).then(
      () => 'ok',
      (e: { code?: string }) => e.code,
    );
    expect(code).toBe('42501');
  });
});

// ---- Adding ----------------------------------------------------------------------------------

describe('POST /api/v1/floor-plans/:id/apply', () => {
  // catalogue: POST /api/v1/floor-plans/:id/apply
  it('makes the floor and the rooms, inserts only their map rows, and writes one undoable event', async () => {
    const loc = await createLocation(t, db, ibrahim, 'household');
    await join(db, loc.id, louis.userId, 'member');
    const old = await placeOf(loc, 'Old shed', null);
    const before = await json<{ version: string | null }>(
      call(t, `/api/v1/locations/${loc.id}/layout`, {
        as: louis,
        method: 'PUT',
        body: {
          version: null,
          rooms: [{ id: old, x: 0, z: 0, w: 400, d: 400, kind: 'room', surface: 'wood' }],
          nodes: [],
        },
      }),
    );
    const fileId = await uploaded(louis, await planPng('f1-flat-dims'), loc);
    const p = inventedPlan('f1-flat-dims');
    const size = sentSize(p);
    const parts = await partsFor(
      'plan',
      [{ attachmentId: 'a', fileId, locationId: loc.id, mime: 'image/png' }],
      {
        blobs: files.blobs,
        textOf: async () => null,
      },
    );
    answers[mockKey(parts.images[0]?.bytes ?? new Uint8Array())] = {
      output: answerFor(p, size.w, size.h, { noise: 0.01, corners: 'none' }),
    };
    const started = await json<View>(start(louis, { fileId }, loc), 201);
    await run(louis, started.id);
    const v = await json<View>(view(louis, started.id));
    const body = bodyOf(v, before.version, { id: null, name: 'Ground floor' });
    const res = await apply(louis, v.id, body);
    expect(res.statusCode, res.body).toBe(200);
    const out = res.json() as {
      version: string;
      rooms: { key: string; id: string }[];
      floors: { key: string; id: string }[];
    };
    expect(out.version).not.toBe(before.version);
    expect(out.rooms).toHaveLength(body.rooms.length);
    const eventId = String(res.headers['x-kept-audit-event']);
    expect(eventId).toMatch(/^[0-9a-f-]{36}$/);
    const floor = out.floors[0]?.id;
    const places = await sql<{
      id: string;
      name: string;
      kind_key: string;
      parent_id: string | null;
    }>(
      'SELECT id, name, kind_key, parent_id FROM public.places WHERE id = ANY ($1::uuid[]) ORDER BY name',
      [out.rooms.map((r) => r.id)],
    );
    expect(places.every((r) => r.kind_key === 'room' && r.parent_id === floor)).toBe(true);
    const [made] = await sql<{ kind_key: string; parent_id: string | null }>(
      'SELECT kind_key, parent_id FROM public.places WHERE id = $1',
      [floor],
    );
    expect(made).toEqual({ kind_key: 'floor', parent_id: null });
    const rows = await sql<{ place_id: string; x_cm: number }>(
      'SELECT place_id, x_cm FROM public.map_nodes WHERE location_id = $1',
      [loc.id],
    );
    expect(rows).toHaveLength(body.rooms.length + 1);
    expect(rows.find((r) => r.place_id === old)?.x_cm).toBe(0);
    const [ev] = await sql<{
      action: string;
      undoable_until: Date;
      diff: Record<string, { after?: unknown }>;
    }>('SELECT action, undoable_until, diff FROM public.audit_events WHERE id = $1', [eventId]);
    expect(ev?.action).toBe('floor_plan.apply');
    expect(ev?.undoable_until.getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);
    expect(ev?.diff.rooms?.after).toHaveLength(body.rooms.length);
    // The plan is closed and its upload let go.
    const [plan] = await sql<{ status: string; result: unknown; applied_event_id: string }>(
      'SELECT status, result, applied_event_id FROM public.floor_plans WHERE id = $1',
      [v.id],
    );
    expect(plan).toEqual({ status: 'applied', result: null, applied_event_id: eventId });
    expect(await sql('SELECT 1 FROM public.attachments WHERE floor_plan_id = $1', [v.id])).toEqual(
      [],
    );
    // History: one row for all of it.
    const [created] = await sql<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.audit_events
        WHERE location_id = $1 AND action = 'place.create' AND undoable_until IS NOT NULL`,
      [loc.id],
    );
    expect(created?.n).toBe(0);
    expect((await apply(louis, v.id, body)).statusCode).toBe(409);
  });

  it('keeps the plan as the location’s document when asked', async () => {
    const v = await readPlan('f5-sideways');
    const map = await mapOf(louis);
    const res = await apply(louis, v.id, bodyOf(v, map.version, null, { keepPlan: true }));
    expect(res.statusCode, res.body).toBe(200);
    const docs = await sql<{ role: string; in_review: boolean; floor_plan_id: string | null }>(
      'SELECT role, in_review, floor_plan_id FROM public.attachments WHERE file_id = $1',
      [v.file?.id],
    );
    expect(docs).toEqual([{ role: 'document', in_review: false, floor_plan_id: null }]);
  });

  it('is 409 arranged_since on a stale version and rooms_overlap over a room drawn meanwhile', async () => {
    const loc = await createLocation(t, db, ibrahim, 'household');
    await join(db, loc.id, louis.userId, 'member');
    const v = await readPlan('f7-imperial', louis, loc);
    const stale = await apply(louis, v.id, bodyOf(v, '2020-01-01T00:00:00.000Z', null));
    expect(stale.statusCode).toBe(409);
    expect((stale.json() as { reason?: string }).reason).toBe('arranged_since');
    const room = await placeOf(loc, 'Drawn meanwhile', null);
    const arranged = await json<{ version: string }>(
      call(t, `/api/v1/locations/${loc.id}/layout`, {
        as: louis,
        method: 'PUT',
        body: {
          version: null,
          rooms: [{ id: room, x: 2000, z: 0, w: 300, d: 300, kind: 'room', surface: 'wood' }],
          nodes: [],
        },
      }),
    );
    const clash = await apply(louis, v.id, bodyOf(v, arranged.version, null));
    expect(clash.statusCode, clash.body).toBe(409);
    expect((clash.json() as { reason?: string }).reason).toBe('rooms_overlap');
    // Nothing was added: the transaction is all or none.
    expect(
      await sql('SELECT 1 FROM public.places WHERE location_id = $1 AND name = $2', [
        loc.id,
        'Kitchen',
      ]),
    ).toEqual([]);
  });

  it('uses a same-name room nobody arranged, and refuses one already arranged', async () => {
    const loc = await createLocation(t, db, ibrahim, 'household');
    await join(db, loc.id, louis.userId, 'member');
    const kitchen = await placeOf(loc, 'Kitchen', null);
    const fileId = await uploaded(louis, await planPng('f2-l-shape'), loc);
    const out = await json<View>(start(louis, { fileId }, loc), 201);
    await run(louis, out.id);
    const v = await json<View>(view(louis, out.id));
    const body = bodyOf(v, null, null);
    const k = body.rooms.find((r) => r.name === 'Kitchen');
    if (!k) throw new Error('no kitchen');
    k.placeId = kitchen;
    const res = await apply(louis, v.id, body);
    expect(res.statusCode, res.body).toBe(200);
    const out2 = res.json() as { rooms: { key: string; id: string }[] };
    expect(out2.rooms.find((r) => r.key === k.key)?.id).toBe(kitchen);
    const named = await sql('SELECT 1 FROM public.places WHERE location_id = $1 AND name = $2', [
      loc.id,
      'Kitchen',
    ]);
    expect(named).toHaveLength(1);

    const again = await readPlan('f2-l-shape');
    const map = await mapOf(louis);
    const arrangedRoom = map.rooms.find((r) => r.layout);
    if (!arrangedRoom) throw new Error('nothing arranged');
    const b2 = bodyOf(again, map.version, null);
    (b2.rooms[0] as ApplyBody['rooms'][number]).placeId = arrangedRoom.id;
    const refused = await apply(louis, again.id, b2);
    expect(refused.statusCode).toBe(409);
    expect((refused.json() as { reason?: string }).reason).toBe('changed_since');
  });

  it('refuses a viewer and someone outside', async () => {
    const v = await readPlan('f6-scale-bar-doors');
    const body = bodyOf(v, (await mapOf(louis)).version, null);
    expect((await apply(talia, v.id, body)).statusCode).toBe(404);
    expect((await apply(alfred, v.id, body)).statusCode).toBe(404);
  });
});

describe('a plan under review is no document of the location', () => {
  it('is in neither document search nor the export, until it is kept', async () => {
    const loc = await createLocation(t, db, ibrahim, 'household');
    await join(db, loc.id, louis.userId, 'member');
    const pdf = await uploaded(
      louis,
      textPdf([['Ground floor', 'Larder 1.20 x 0.90 m']]),
      loc,
      'application/pdf',
    );
    // The text the pdf-text job reads from an upload.
    await sql(
      `INSERT INTO public.file_text (file_id, location_id, source, text)
       VALUES ($1, $2, 'pdf', 'Ground floor Larder 1.20 x 0.90 m') ON CONFLICT DO NOTHING`,
      [pdf, loc.id],
    );
    const out = await json<View>(start(louis, { fileId: pdf }, loc), 201);
    const found = async () => {
      const body = await json<{ documents: { items: { fileId: string }[] } }>(
        call(t, `/api/v1/search?q=larder&kind=documents&locationId=${loc.id}`, { as: louis }),
      );
      return body.documents.items.map((d) => d.fileId);
    };
    expect(await found()).toEqual([]);
    const exported = await withScope(
      db.pools.app,
      { userId: louis.userId, mfa: false },
      async (_tx, c) => {
        const ctx = {
          locationId: loc.id,
          accountId: loc.accountId,
          showMoney: true,
          ended: false,
          trashed: false,
        };
        const rows = async (entity: 'attachments' | 'files') => {
          const def = entityDef(entity);
          if (!def) throw new Error(entity);
          const out: Record<string, unknown>[] = [];
          for await (const r of readEntity(c, def, ctx)) out.push(r);
          return out;
        };
        return { attachments: await rows('attachments'), files: await rows('files') };
      },
    );
    expect(exported.attachments.some((a) => a.id === out.file?.attachmentId)).toBe(false);
    expect(exported.files.some((f) => f.id === pdf)).toBe(false);
    // Kept with the location once its rooms are added: a document like any other.
    await run(louis, out.id);
    const v = await json<View>(view(louis, out.id));
    expect(v.status).toBe('ready');
    const res = await apply(louis, v.id, bodyOf(v, null, null, { keepPlan: true }));
    expect(res.statusCode, res.body).toBe(200);
    expect(await found()).toEqual([pdf]);
  });
});

describe('who adds a plan’s rooms', () => {
  it('any member, not only the one who uploaded it', async () => {
    const loc = await createLocation(t, db, ibrahim, 'household');
    for (const p of [louis, peter]) await join(db, loc.id, p.userId, 'member');
    const v = await readPlan('f2-l-shape', louis, loc);
    const res = await apply(peter, v.id, bodyOf(v, null, null));
    expect(res.statusCode, res.body).toBe(200);
    const [ev] = await sql<{ actor_id: string }>(
      `SELECT actor_id FROM public.audit_events WHERE location_id = $1 AND action = 'floor_plan.apply'`,
      [loc.id],
    );
    expect(ev?.actor_id).toBe(peter.userId);
  });
});

// ---- Undo ------------------------------------------------------------------------------------

describe('undo of floor_plan.apply', () => {
  async function applied(as: Person = louis) {
    const loc = await createLocation(t, db, ibrahim, 'household');
    for (const p of [louis, peter]) await join(db, loc.id, p.userId, 'member');
    await join(db, loc.id, bruce.userId, 'admin');
    const fileId = await uploaded(as, await planPng('f8-no-scale'), loc);
    const out = await json<View>(start(as, { fileId }, loc), 201);
    await run(as, out.id);
    const v = await json<View>(view(as, out.id));
    const res = await apply(as, v.id, bodyOf(v, null, { id: null, name: 'Ground floor' }));
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json() as { rooms: { id: string }[]; floors: { id: string }[] };
    return { loc, eventId: String(res.headers['x-kept-audit-event']), ...body };
  }
  const undo = (as: Person, eventId: string) =>
    call(t, `/api/v1/audit/${eventId}/undo`, { as, body: {} });

  it('removes the map rows and puts the rooms and the floor in the trash as one batch', async () => {
    const a = await applied();
    const res = await undo(louis, a.eventId);
    expect(res.statusCode, res.body).toBe(200);
    expect(await sql('SELECT 1 FROM public.map_nodes WHERE location_id = $1', [a.loc.id])).toEqual(
      [],
    );
    const trashed = await sql<{ trash_batch_id: string | null }>(
      'SELECT trash_batch_id FROM public.places WHERE id = ANY ($1::uuid[])',
      [[...a.rooms.map((r) => r.id), ...a.floors.map((f) => f.id)]],
    );
    expect(trashed.every((r) => r.trash_batch_id)).toBe(true);
    expect(new Set(trashed.map((r) => r.trash_batch_id)).size).toBe(1);
    expect((await undo(louis, a.eventId)).statusCode).toBe(409);
  });

  it('is refused once a room holds a thing, was renamed, or was moved by an arrange', async () => {
    const holds = await applied();
    await sql(`INSERT INTO public.things (location_id, place_id, name) VALUES ($1, $2, 'Lamp')`, [
      holds.loc.id,
      holds.rooms[0]?.id,
    ]);
    const r1 = await undo(louis, holds.eventId);
    expect(r1.statusCode).toBe(409);
    expect((r1.json() as { reason?: string }).reason).toBe('changed_since');

    const renamed = await applied();
    const room = renamed.rooms[0]?.id as string;
    const [pv] = await sql<{ row_version: number }>(
      'SELECT row_version FROM public.places WHERE id = $1',
      [room],
    );
    const rn = await call(t, `/api/v1/places/${room}`, {
      as: louis,
      method: 'PATCH',
      body: { name: 'Studio' },
      headers: { 'if-match': `"${pv?.row_version}"` },
    });
    expect(rn.statusCode, rn.body).toBe(200);
    expect((await undo(louis, renamed.eventId)).statusCode).toBe(409);

    const moved = await applied();
    const map = await mapOf(louis, moved.loc);
    const res = await call(t, `/api/v1/locations/${moved.loc.id}/layout`, {
      as: louis,
      method: 'PUT',
      body: {
        version: map.version,
        rooms: map.rooms
          .filter((r) => r.layout)
          .map((r, i) => ({
            ...(r.layout as { x: number }),
            id: r.id,
            x: (r.layout as { x: number }).x + (i === 0 ? 5000 : 0),
          })),
        nodes: [],
      },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect((await undo(louis, moved.eventId)).statusCode).toBe(409);
  }, 60_000);

  it('by another member is refused; the owner and an admin may', async () => {
    const a = await applied(louis);
    expect((await undo(peter, a.eventId)).statusCode).toBe(403);
    expect((await undo(bruce, a.eventId)).statusCode).toBe(200);
  });
});

// ---- Discard and the sweep -------------------------------------------------------------------

describe('discarding', () => {
  // catalogue: POST /api/v1/floor-plans/:id/discard
  it('deletes the upload, clears the result and audits it, not undoably', async () => {
    const v = await readPlan('f3-two-floors-table');
    expect(
      (await call(t, `/api/v1/floor-plans/${v.id}/discard`, { as: talia, body: {} })).statusCode,
    ).toBe(404);
    const res = await call(t, `/api/v1/floor-plans/${v.id}/discard`, { as: peter, body: {} });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.headers['x-kept-audit-event']).toBeUndefined();
    const [row] = await sql<{ status: string; result: unknown }>(
      'SELECT status, result FROM public.floor_plans WHERE id = $1',
      [v.id],
    );
    expect(row).toEqual({ status: 'discarded', result: null });
    expect(await sql('SELECT 1 FROM public.attachments WHERE floor_plan_id = $1', [v.id])).toEqual(
      [],
    );
    const [ev] = await sql<{ action: string; undoable_until: Date | null }>(
      `SELECT action, undoable_until FROM public.audit_events WHERE location_id = $1
          AND action = 'floor_plan.discard' ORDER BY at DESC LIMIT 1`,
      [home.id],
    );
    expect(ev).toEqual({ action: 'floor_plan.discard', undoable_until: null });
    expect((await mapOf(louis)).openPlans.some((p) => p.id === v.id)).toBe(false);
  });

  it('discards reviews nobody finished in 30 days (the purge’s door)', async () => {
    const v = await readPlan('f1-flat-dims');
    await sql(
      `UPDATE public.floor_plans SET created_at = now() - interval '31 days' WHERE id = $1`,
      [v.id],
    );
    const { runPurge } = await import('../trash/jobs.js');
    await runPurge({ pools: db.pools, log: silent as never, blobs: files.blobs });
    const [row] = await sql<{ status: string; result: unknown }>(
      'SELECT status, result FROM public.floor_plans WHERE id = $1',
      [v.id],
    );
    expect(row).toEqual({ status: 'discarded', result: null });
    expect(await sql('SELECT 1 FROM public.attachments WHERE floor_plan_id = $1', [v.id])).toEqual(
      [],
    );
  });
});
