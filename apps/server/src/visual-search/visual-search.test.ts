import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  VISUAL_IMAGE_MAX_BYTES,
  type VisualSearchCoverage,
  type VisualSearchInputResponse,
  type VisualSearchResult,
} from '@kept/shared';
import sharp from 'sharp';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import type { TestApp } from '../../test/app.js';
import { testDb } from '../../test/db.js';
import { type TestFiles, testFiles, upload } from '../../test/files.js';
import { call, join, type Person, peopleApp, person, type RecordedJob } from '../../test/people.js';
import {
  builtinType,
  createLocation,
  createThing,
  eventsOf,
  type Loc,
  ok,
  own,
} from '../../test/things.js';
import { withScope } from '../db/scope.js';
import { indexVisualAttachment } from './job.js';
import { localVisualProvider, type VisualProvider } from './provider.js';

const db = await testDb();
const sent: RecordedJob[] = [];
let app: TestApp;
let owner: Person;
let files: TestFiles;
const vector = (at: number) => Array.from({ length: 512 }, (_, n) => Number(n === at));
const fake: VisualProvider = {
  generation: 'deterministic-visual-test',
  dimensions: 512,
  encodeText: async (text) => vector(text === 'mug' ? 0 : 2),
  encodeImage: async (image) => {
    const [red = 0, blue = 0] = await sharp(image)
      .extract({ left: 0, top: 0, width: 1, height: 1 })
      .removeAlpha()
      .raw()
      .toBuffer()
      .then((b) => [b[0], b[2]]);
    return vector(red > blue ? 0 : 1);
  },
};

beforeAll(async () => {
  await db.reset();
  files = await testFiles();
  app = await peopleApp(db, { files, visualProvider: fake, sent });
  owner = await person(app, db, 'ibrahim');
});

afterAll(async () => {
  await app?.app.close();
  await files?.cleanup();
});

function search(body: object, as = owner, target = app) {
  return call(target, '/api/v1/visual-search', { as, body });
}

function status(locationId: string, as = owner, target = app) {
  return call(target, `/api/v1/visual-search/status?locationIds=${locationId}`, { as });
}

function input(bytes: Buffer, locationId?: string, as = owner, target = app) {
  return call(
    target,
    `/api/v1/visual-search/input${locationId ? `?locationIds=${locationId}` : ''}`,
    {
      as,
      headers: { 'content-type': 'image/jpeg' },
      body: Buffer.from(bytes),
    },
  );
}

async function photo(color: 'red' | 'blue', variation = 0) {
  const background =
    color === 'red' ? { r: 255 - variation, g: 15, b: 0 } : { r: 0, g: 0, b: 255 - variation };
  return sharp({ create: { width: 24 + variation, height: 24, channels: 3, background } })
    .jpeg()
    .toBuffer();
}

async function makeBox(loc: Loc, name: string, target = app, as = owner) {
  return createThing(target, as, loc, { name, typeId: await builtinType(db, 'box_bin') });
}

async function attach(
  loc: Loc,
  bytes: Buffer,
  name = 'Kitchen spares',
  boxId?: string,
  target = app,
  as = owner,
) {
  const item = await createThing(target, as, loc, {
    name,
    ...(boxId ? { containerId: boxId } : {}),
  });
  const file = ok(await upload(target, as, loc.id, bytes), 201);
  const attachment = ok(
    await call(target, '/api/v1/attachments', {
      as,
      body: { locationId: loc.id, subject: { thingId: item.id }, fileId: file.id, role: 'photo' },
    }),
    201,
  );
  return { item, file, attachment };
}

function index(attachmentId: string, as = owner, provider = fake) {
  return indexVisualAttachment(
    db.pools.app,
    { userId: as.userId, mfa: false },
    files.blobs,
    provider,
    attachmentId,
  );
}

it('keeps visual search unavailable with no explicitly configured encoder', async () => {
  const disabled = await peopleApp(db, { visualProvider: null });
  try {
    const result = await search({ text: 'mug' }, owner, disabled);
    expect(result.statusCode, result.body).toBe(200);
    expect(result.json()).toEqual({
      outcome: 'unavailable',
      coverage: { generation: null, ready: 0, pending: 0, failed: 0, paused: 0 },
      matches: [],
    });
  } finally {
    await disabled.app.close();
  }
});

// catalogue: POST /api/v1/admin/visual-search/reindex
it('queues bounded scoped indexing, audits it once with an idempotency key, and keeps ranks evidence-linked', async () => {
  const loc = await createLocation(app, db, owner, 'household', 'Home');
  const box = await makeBox(loc, 'Blue tote');
  const evidence = await attach(loc, await photo('red'), 'Kitchen spares', box.id);
  expect(sent).toContainEqual({
    name: 'visual-index',
    data: { attachmentId: evidence.attachment.id },
  });
  expect((await search({ text: 'mug', locationIds: [loc.id] })).json()).toMatchObject({
    outcome: 'partial_coverage',
    coverage: { ready: 0, pending: 1 },
  });

  const run = () =>
    call(app, '/api/v1/admin/visual-search/reindex', {
      as: owner,
      headers: { 'idempotency-key': loc.id },
      body: { locationId: loc.id },
    });
  expect((await run()).json()).toEqual({ queued: 1 });
  expect((await run()).headers['idempotent-replayed']).toBe('true');
  const events = await eventsOf(db, loc.id, loc.id);
  expect(events.filter((event) => event.action === 'visual_search.reindex')).toHaveLength(1);
  await expect(index(evidence.attachment.id)).resolves.toBe('stored');
  await expect(index(evidence.attachment.id)).resolves.toBe('skipped');

  const lexical = await call(app, '/api/v1/search?q=mug', { as: owner });
  expect(lexical.statusCode).toBe(200);
  expect(lexical.body).not.toContain(evidence.item.id);
  const ranked = (await search({ text: 'mug', locationIds: [loc.id] })).json<VisualSearchResult>();
  expect(ranked).toMatchObject({
    outcome: 'matches',
    coverage: { ready: 1, pending: 0 },
    matches: [
      {
        thingId: evidence.item.id,
        fileId: evidence.file.id,
        attachmentId: evidence.attachment.id,
        locationId: loc.id,
        name: 'Kitchen spares',
        path: expect.arrayContaining([{ id: box.id, name: 'Blue tote' }]),
      },
    ],
  });
  expect(ranked.matches[0]?.path[0]?.id).toBe(loc.id);
  expect((await search({ text: 'ladder', locationIds: [loc.id] })).json()).toMatchObject({
    outcome: 'no_close_match',
    matches: [],
  });
  const media = await call(
    app,
    `/api/v1/files/${evidence.file.id}/url?thingId=${evidence.item.id}`,
    {
      as: owner,
      body: { variant: 'original' },
    },
  );
  expect(media.statusCode).toBe(200);
  expect((await app.app.inject({ url: media.json<{ url: string }>().url })).rawPayload).toEqual(
    await photo('red'),
  );
});

it('isolates photo inputs across principals, separates ambiguous locations, and cancels without writing inventory', async () => {
  const loc = await createLocation(app, db, owner, 'household', 'Garage');
  const a = await makeBox(loc, 'A');
  const b = await makeBox(loc, 'B');
  const first = await attach(loc, await photo('red'), 'Record one', a.id);
  const second = await attach(loc, await photo('red', 1), 'Record two', b.id);
  await index(first.attachment.id);
  await index(second.attachment.id);
  const newPhoto = await photo('red', 2);
  const uploaded = await input(newPhoto, loc.id);
  expect(uploaded.statusCode, uploaded.body).toBe(201);
  const { inputId, expiresAt } = uploaded.json<VisualSearchInputResponse>();
  expect(Date.parse(expiresAt) - Date.now()).toBeGreaterThan(14 * 60 * 1000);
  expect(Date.parse(expiresAt) - Date.now()).toBeLessThanOrEqual(15 * 60 * 1000);

  const member = await person(app, db, 'louis');
  await join(db, loc.id, member.userId, 'member');
  expect((await search({ inputId }, member)).statusCode).toBe(404);
  const separateSignIn = await call(app, '/api/v1/auth/sign-in/email', {
    body: { email: owner.email, password: 'correct horse battery' },
  });
  const header = separateSignIn.headers['set-cookie'];
  const cookie = (Array.isArray(header) ? header : [header])
    .filter(Boolean)
    .map((value) => String(value).split(';')[0])
    .join('; ');
  expect(separateSignIn.statusCode, separateSignIn.body).toBe(200);
  expect((await search({ inputId }, { ...owner, cookie })).statusCode).toBe(404);
  const found = await search({ inputId });
  expect(found.json()).toMatchObject({
    outcome: 'ambiguous',
    matches: expect.arrayContaining([
      expect.objectContaining({ thingId: first.item.id }),
      expect.objectContaining({ thingId: second.item.id }),
    ]),
  });
  const things = await own(db, 'SELECT id FROM public.things WHERE location_id = $1', [loc.id]);
  expect(things).toHaveLength(4);
  const canceled = await call(app, `/api/v1/visual-search/input/${inputId}`, {
    method: 'DELETE',
    as: owner,
  });
  expect(canceled.statusCode).toBe(204);
  expect((await search({ inputId })).statusCode).toBe(404);

  const expiring = (await input(newPhoto, loc.id)).json<VisualSearchInputResponse>();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(expiring.expiresAt) + 1);
  try {
    expect((await search({ inputId: expiring.inputId })).statusCode).toBe(404);
  } finally {
    clock.mockRestore();
  }
});

it('keeps close evidence from another box when one box fills the result limit', async () => {
  const loc = await createLocation(app, db, owner, 'household', 'Shared shelf');
  // Distinct containers may have identical names. Their IDs decide recorded location.
  const first = await makeBox(loc, 'Spare parts');
  const other = await makeBox(loc, 'Spare parts');
  for (let n = 0; n < 21; n += 1) {
    const record = await attach(loc, await photo('red', n), `Part ${n}`, first.id);
    await expect(index(record.attachment.id)).resolves.toBe('stored');
  }
  const alternate = await attach(loc, await photo('red', 21), 'Another part', other.id);
  const nearTie = vector(0);
  nearTie[0] = 0.98;
  nearTie[1] = Math.sqrt(1 - 0.98 ** 2);
  await expect(
    index(alternate.attachment.id, owner, { ...fake, encodeImage: async () => nearTie }),
  ).resolves.toBe('stored');

  const uploaded = await input(await photo('red', 22), loc.id);
  expect(uploaded.statusCode, uploaded.body).toBe(201);
  const { inputId } = uploaded.json<VisualSearchInputResponse>();
  for (const query of [{ inputId }, { text: 'mug', locationIds: [loc.id] }]) {
    const single = await search({ ...query, limit: 1 });
    expect(single.statusCode, single.body).toBe(200);
    expect(single.json()).toMatchObject({ outcome: 'ambiguous', matches: [expect.any(Object)] });

    for (const limit of [2, 20]) {
      const response = await search({ ...query, limit });
      expect(response.statusCode, response.body).toBe(200);
      const result = response.json<VisualSearchResult>();
      expect(result.outcome).toBe('ambiguous');
      expect(result.matches).toHaveLength(limit);
      expect(result.matches[0]?.path.at(-1)?.id).toBe(first.id);
      expect(result.matches).toContainEqual(
        expect.objectContaining({
          thingId: alternate.item.id,
          fileId: alternate.file.id,
          attachmentId: alternate.attachment.id,
          path: expect.arrayContaining([{ id: other.id, name: 'Spare parts' }]),
        }),
      );
    }
  }

  const legacy = await withScope(
    db.pools.app,
    { userId: owner.userId, mfa: false },
    (_tx, client) =>
      client.query<{ thing_id: string }>(
        'SELECT thing_id FROM kept.visual_matches($1, $2, $3, 0.58, 2)',
        [[loc.id], fake.generation, JSON.stringify(vector(0))],
      ),
  );
  expect(legacy.rows).toHaveLength(2);
  expect(legacy.rows.map(({ thing_id }) => thing_id)).not.toContain(alternate.item.id);

  nearTie[0] = 0.9;
  nearTie[1] = Math.sqrt(1 - 0.9 ** 2);
  await own(db, 'UPDATE public.visual_embeddings SET embedding = $1 WHERE attachment_id = $2', [
    JSON.stringify(nearTie),
    alternate.attachment.id,
  ]);
  const clear = (await search({ inputId, limit: 2 })).json<VisualSearchResult>();
  expect(clear.outcome).toBe('matches');
  expect(clear.matches).toHaveLength(2);
  expect(clear.matches.every((match) => match.path.at(-1)?.id === first.id)).toBe(true);
});

it('refuses oversized and non-image query inputs before using inference', async () => {
  const loc = await createLocation(app, db, owner, 'household', 'Limits');
  const overBytes = await input(Buffer.alloc(VISUAL_IMAGE_MAX_BYTES + 1), loc.id);
  expect(overBytes.statusCode, overBytes.body).toBe(413);
  const bogus = await input(Buffer.from('this is not a photo'), loc.id);
  expect(bogus.statusCode, bogus.body).toBe(400);
  const overPixels = await sharp({
    create: { width: 4500, height: 4500, channels: 3, background: '#000' },
  })
    .png()
    .toBuffer();
  const oversized = await call(app, `/api/v1/visual-search/input?locationIds=${loc.id}`, {
    as: owner,
    headers: { 'content-type': 'image/png' },
    body: overPixels,
  });
  expect(oversized.statusCode, oversized.body).toBe(400);
});

it('filters viewers, revocation, trashed subjects, role changes and in-flight moves before returning evidence', async () => {
  const loc = await createLocation(app, db, owner, 'household', 'Home two');
  const dest = await createLocation(app, db, owner, 'household', 'Destination');
  const a = await makeBox(loc, 'Before');
  const b = await makeBox(loc, 'After');
  const evidence = await attach(loc, await photo('red', 3), 'Record', a.id);
  const member = await person(app, db, 'bruce');
  const viewer = await person(app, db, 'talia');
  await join(db, loc.id, member.userId, 'member');
  await join(db, loc.id, viewer.userId, 'viewer');
  const noRead = vi.fn(async () => vector(0));
  await expect(
    index(evidence.attachment.id, viewer, { ...fake, encodeImage: noRead }),
  ).resolves.toBe('skipped');
  expect(noRead).not.toHaveBeenCalled();
  await index(evidence.attachment.id, member);
  expect((await status(loc.id, viewer)).json<VisualSearchCoverage>()).toMatchObject({
    ready: 0,
    pending: 0,
  });
  expect((await search({ text: 'mug', locationIds: [loc.id] }, viewer)).json()).toMatchObject({
    matches: [],
  });
  expect((await search({ text: 'mug', locationIds: [loc.id] }, member)).json()).toMatchObject({
    outcome: 'matches',
  });

  const pendingInput = (
    await input(await photo('red', 4), loc.id, member)
  ).json<VisualSearchInputResponse>();
  await own(db, 'DELETE FROM public.memberships WHERE location_id = $1 AND user_id = $2', [
    loc.id,
    member.userId,
  ]);
  expect((await search({ inputId: pendingInput.inputId }, member)).statusCode).toBe(404);
  expect((await status(loc.id, member)).json()).toMatchObject({ ready: 0, pending: 0 });

  ok(
    await call(app, '/api/v1/things/move', {
      as: owner,
      body: { thingIds: [evidence.item.id], to: { containerId: b.id } },
    }),
  );
  const moved = (await search({ text: 'mug', locationIds: [loc.id] })).json<VisualSearchResult>();
  expect(moved.matches[0]?.path.at(-1)).toEqual({ id: b.id, name: 'After' });
  ok(await call(app, `/api/v1/things/${evidence.item.id}/trash`, { as: owner, body: {} }));
  expect((await search({ text: 'mug', locationIds: [loc.id] })).json()).toMatchObject({
    matches: [],
  });

  const racing = await attach(loc, await photo('red', 7));
  const fakeWithMove = {
    ...fake,
    encodeImage: async () => {
      ok(
        await call(app, '/api/v1/things/move', {
          as: owner,
          body: { thingIds: [racing.item.id], to: { placeId: dest.unplacedId } },
        }),
      );
      return vector(0);
    },
  };
  await expect(index(racing.attachment.id, owner, fakeWithMove)).resolves.toBe('skipped');
  expect((await status(dest.id)).json()).toMatchObject({ ready: 0, pending: 1 });
  await expect(index(racing.attachment.id)).resolves.toBe('stored');
  expect((await status(dest.id)).json()).toMatchObject({ ready: 1 });
  await own(db, 'UPDATE public.attachments SET role = $2 WHERE id = $1', [
    racing.attachment.id,
    'document',
  ]);
  expect((await search({ text: 'mug', locationIds: [dest.id] })).json()).toMatchObject({
    matches: [],
  });
  expect(
    await own(db, 'SELECT 1 FROM public.visual_embeddings WHERE attachment_id = $1', [
      racing.attachment.id,
    ]),
  ).toEqual([]);
});

it('drops indexed evidence when an attachment is removed and isolates model generations', async () => {
  const loc = await createLocation(app, db, owner, 'household', 'Deletion');
  const evidence = await attach(loc, await photo('red', 12));
  await expect(index(evidence.attachment.id)).resolves.toBe('stored');
  const changed = await peopleApp(db, {
    files,
    visualProvider: { ...fake, generation: 'other-generation' },
  });
  try {
    const result = await search({ text: 'mug', locationIds: [loc.id] }, owner, changed);
    expect(result.json()).toMatchObject({
      outcome: 'partial_coverage',
      matches: [],
      coverage: { pending: 1 },
    });
  } finally {
    await changed.app.close();
  }
  const deleted = await call(app, `/api/v1/attachments/${evidence.attachment.id}`, {
    as: owner,
    method: 'DELETE',
  });
  expect(deleted.statusCode, deleted.body).toBe(204);
  expect((await status(loc.id)).json()).toMatchObject({ ready: 0, pending: 0 });
  expect(
    await own(db, 'SELECT 1 FROM public.visual_embeddings WHERE attachment_id = $1', [
      evidence.attachment.id,
    ]),
  ).toEqual([]);
});

const fixture = process.env.KEPT_TEST_VISUAL_FIXTURES;
it.runIf(Boolean(fixture))(
  'runs both search modes through Kept and the real pinned local encoder',
  async () => {
    const adapter = localVisualProvider();
    if (!adapter || !fixture)
      throw new Error('The real visual integration needs explicit fixtures and encoder URL.');
    const manifest = JSON.parse(await readFile(fixture, 'utf8')) as {
      gallery: { identity: number; title: string; box: string; photo: string }[];
      photos: { photo: string; expected: number[] }[];
      text: { query: string; expected: number[] }[];
    };
    const real = await peopleApp(db, { files, visualProvider: adapter, sent });
    try {
      const loc = await createLocation(real, db, owner, 'household', 'Visual smoke');
      const byId = new Map<string, number>();
      const timings: number[] = [];
      const begin = performance.now();
      for (const entry of manifest.gallery) {
        const box = await makeBox(loc, entry.box, real);
        const gallery = await attach(
          loc,
          await readFile(resolve(dirname(fixture), entry.photo)),
          entry.title,
          box.id,
          real,
        );
        byId.set(gallery.item.id, entry.identity);
        await expect(index(gallery.attachment.id, owner, adapter)).resolves.toBe('stored');
      }
      const indexMs = performance.now() - begin;
      expect((await status(loc.id, owner, real)).json()).toMatchObject({
        ready: manifest.gallery.length,
        pending: 0,
      });
      const measure = async (body: object) => {
        const started = performance.now();
        const response = await search(body, owner, real);
        expect(response.statusCode, response.body).toBe(200);
        timings.push(performance.now() - started);
        return response.json<VisualSearchResult>();
      };
      const resultFor = (output: VisualSearchResult) =>
        output.matches.map((match) => byId.get(match.thingId));
      const results = {
        textAt1: [] as number[],
        textAt5: [] as number[],
        imageAt1: [] as number[],
        imageAt5: [] as number[],
        absent: [] as number[],
      };
      for (const example of manifest.text) {
        const found = resultFor(await measure({ text: example.query, locationIds: [loc.id] }));
        if (example.expected.length) {
          const lexical = await call(
            real,
            `/api/v1/search?q=${encodeURIComponent(example.query)}`,
            { as: owner },
          );
          expect(lexical.statusCode, lexical.body).toBe(200);
          for (const [id, identity] of byId) {
            if (example.expected.includes(identity)) expect(lexical.body).not.toContain(id);
          }
          results.textAt1.push(Number(example.expected.includes(found[0] ?? -1)));
          results.textAt5.push(
            Number(found.slice(0, 5).some((id) => example.expected.includes(id ?? -1))),
          );
        } else results.absent.push(Number(found.length === 0));
      }
      for (const example of manifest.photos) {
        const started = performance.now();
        const uploaded = await input(
          await readFile(resolve(dirname(fixture), example.photo)),
          loc.id,
          owner,
          real,
        );
        expect(uploaded.statusCode, uploaded.body).toBe(201);
        const { inputId } = uploaded.json<VisualSearchInputResponse>();
        const found = resultFor(await measure({ inputId }));
        timings[timings.length - 1] = performance.now() - started;
        await call(real, `/api/v1/visual-search/input/${inputId}`, { as: owner, method: 'DELETE' });
        if (example.expected.length) {
          results.imageAt1.push(Number(example.expected.includes(found[0] ?? -1)));
          results.imageAt5.push(
            Number(found.slice(0, 5).some((id) => example.expected.includes(id ?? -1))),
          );
        } else results.absent.push(Number(found.length === 0));
      }
      // Integration smoke, not a pass threshold for household qualification.
      expect(results.textAt5).toContain(1);
      expect(results.imageAt5).toContain(1);
      process.stdout.write(
        `visual integration: ${JSON.stringify({ indexMs, timings, results })}\n`,
      );
    } finally {
      await real.app.close();
    }
  },
);
