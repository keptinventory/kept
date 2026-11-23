import { createHash, randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  CreateThingPayload,
  NATIVE_CAPTURE_PAYLOAD_VERSION,
  NativeCaptureCapabilitiesSchema,
  newId,
  PAYLOAD_VERSION,
  type SyncOpsResponse,
} from '@kept/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { jar, type TestApp } from '../../test/app.js';
import { type TestDb, testDb } from '../../test/db.js';
import {
  fixture,
  sha256,
  type TestFiles,
  testFiles,
  uniqueJpeg,
  upload,
} from '../../test/files.js';
import { call, freshIp, type Person, peopleApp, person } from '../../test/people.js';
import { CLIENT_VERSION, captureOp } from '../../test/sync-ops.js';
import { builtinType, createLocation, createThing, type Loc, own } from '../../test/things.js';

const capabilityUrl = '/api/v1/native/capture-capabilities';
const syncUrl = '/api/v1/sync/ops';

let db: TestDb;
let t: TestApp;
let files: TestFiles;
let owner: Person;
let home: Loc;

beforeAll(async () => {
  db = await testDb();
  await db.reset();
  files = await testFiles();
  t = await peopleApp(db, { files });
  owner = await person(t, db, 'native-owner');
  home = await createLocation(t, db, owner, 'household');
});

afterAll(async () => {
  await t?.app.close();
  await files?.cleanup();
});

async function nativeSession() {
  const verifier = randomBytes(32).toString('base64url');
  const approval = await t.app.inject({
    method: 'POST',
    url: '/native/connect',
    headers: {
      origin: t.publicUrl,
      cookie: owner.cookie,
      'content-type': 'application/x-www-form-urlencoded',
    },
    payload: new URLSearchParams({
      challenge: createHash('sha256').update(verifier).digest('base64url'),
      state: randomBytes(32).toString('base64url'),
    }).toString(),
  });
  expect(approval.statusCode, approval.body).toBe(303);
  const code = new URL(String(approval.headers.location)).searchParams.get('code');
  const exchanged = await call(t, '/api/v1/native/exchange', { body: { code, verifier } });
  expect(exchanged.statusCode, exchanged.body).toBe(200);
  const { account, epoch } = exchanged.json<{ account: string; epoch: string }>();
  return { cookie: jar(exchanged), 'x-kept-native-account': account, 'x-kept-native-epoch': epoch };
}

const oldCreateThing = CreateThingPayload.omit({ reviewSuggestions: true });

async function rollbackServer(): Promise<FastifyInstance> {
  const build = process.env.KEPT_TEST_ROLLBACK_SERVER;
  if (build) {
    // The opt-in points at a compiled pre-native build in a separate worktree, with its own deps.
    const { buildApp } = (await import(
      pathToFileURL(build).href
    )) as typeof import('../http/app.js');
    return buildApp({ env: t.app.env, pools: t.app.pools, auth: t.auth, files });
  }
  // Focused fixture of the 8d890f96 boundaries: absent endpoint and v1-only batch guard.
  // The fixture never runs the previous revision's capture service or writes its ledger.
  const previous = Fastify();
  previous.post(syncUrl, (req, reply) => {
    const { ops } = req.body as { ops: { payloadVersion: number }[] };
    if (ops.some(({ payloadVersion }) => payloadVersion > 1)) {
      return reply.code(409).send({ code: 'server_outdated', payloadVersion: 1 });
    }
    throw new Error('The compatibility guard must reject this batch');
  });
  return previous;
}

it('keeps a native capture out of a rolled-back ledger and replays it with all originals on upgrade', async () => {
  const headers = { ...(await nativeSession()), origin: t.publicUrl };
  const original = [
    { bytes: await uniqueJpeg(), id: newId(), role: 'photo', cls: 'evidence', mime: 'image/jpeg' },
    { bytes: await uniqueJpeg(), id: newId(), role: 'photo', cls: 'evidence', mime: 'image/jpeg' },
    {
      bytes: await fixture('doc.pdf'),
      id: newId(),
      role: 'document',
      cls: 'document',
      mime: 'application/pdf',
    },
  ];
  const box = await createThing(t, owner, home, {
    name: 'Holiday box',
    typeId: await builtinType(db, 'box_bin'),
  });
  const item = captureOp(
    home.id,
    { containerId: box.id },
    {
      reviewSuggestions: true,
      files: original.map(({ id, role, bytes }) => ({ fileId: id, role, sha256: sha256(bytes) })),
    },
    { payloadVersion: NATIVE_CAPTURE_PAYLOAD_VERSION },
  );
  const send = (app: FastifyInstance, op = item) =>
    app.inject({
      method: 'POST',
      url: syncUrl,
      headers,
      remoteAddress: freshIp(),
      payload: { clientVersion: CLIENT_VERSION, ops: [op] },
    });
  const rows = () =>
    own(db, 'SELECT outcome FROM public.sync_ops WHERE idempotency_key = $1', [
      item.idempotencyKey,
    ]);

  // Before the rollback the phone already acquired its session and saved this operation locally.
  expect((await t.app.inject({ url: capabilityUrl, headers })).statusCode).toBe(200);
  const old = await rollbackServer();
  try {
    if (process.env.KEPT_TEST_ROLLBACK_SERVER) {
      expect((await old.inject({ url: '/api/v1/me', headers })).statusCode).toBe(200);
    }
    const incompatible = await old.inject({ url: capabilityUrl, headers });
    // Pre-native builds return 404. Builds with the old context hook can mask the route as 401
    // even though /me verifies that the original session and context are still valid.
    const hasNativeAuth = old.hasRoute({ method: 'POST', url: '/api/v1/native/exchange' });
    expect(incompatible.statusCode, incompatible.body).toBe(hasNativeAuth ? 401 : 404);
    expect(NativeCaptureCapabilitiesSchema.safeParse(incompatible.json()).success).toBe(false);

    // The prior strict schema accepts an ordinary v1 capture and rejects the added flag.
    const { reviewSuggestions: _flag, ...ordinary } = {
      ...item.payload,
      reviewSuggestions: true,
      files: [],
    };
    expect(oldCreateThing.safeParse(ordinary).success).toBe(true);
    expect(oldCreateThing.safeParse({ ...ordinary, reviewSuggestions: true }).success).toBe(false);

    // If rollover happens after negotiation, the old server's version guard is the second line
    // of defense. Exercise it without sending originals or changing the queued operation.
    const refusal = await send(old);
    expect(refusal.statusCode, refusal.body).toBe(409);
    expect(refusal.json()).toMatchObject({ code: 'server_outdated', payloadVersion: 1 });
    expect(await rows()).toEqual([]);
    expect(await own(db, 'SELECT id FROM public.things WHERE id = $1', [item.clientId])).toEqual(
      [],
    );
    expect(
      await own(db, 'SELECT id FROM public.files WHERE id = ANY($1::uuid[])', [
        original.map(({ id }) => id),
      ]),
    ).toEqual([]);
  } finally {
    await old.close();
  }

  const current = await t.app.inject({ url: capabilityUrl, headers });
  expect(current.statusCode, current.body).toBe(200);
  expect(NativeCaptureCapabilitiesSchema.parse(current.json()).capturePayloadVersions).toContain(
    item.payloadVersion,
  );
  const { cookie, origin: _origin, ...context } = headers;
  for (const { id, cls, mime, bytes } of original) {
    const res = await upload(t, { cookie }, home.id, bytes, {
      id,
      cls,
      contentType: mime,
      headers: context,
    });
    expect(res.statusCode, res.body).toBe(201);
    expect(res.json()).toMatchObject({ id, sha256: sha256(bytes), bytes: bytes.length });
  }

  const first = await send(t.app);
  expect(first.statusCode, first.body).toBe(200);
  expect(first.json<SyncOpsResponse>()).toMatchObject({
    results: [
      {
        clientId: item.clientId,
        idempotencyKey: item.idempotencyKey,
        outcome: 'applied',
        entity: { type: 'thing', id: item.clientId },
      },
    ],
  });
  expect((await send(t.app)).json()).toEqual(first.json());
  expect(await rows()).toEqual([{ outcome: 'applied' }]);
  expect(
    await own(db, 'SELECT container_id FROM public.things WHERE id = $1', [item.clientId]),
  ).toEqual([{ container_id: box.id }]);
  const attachments = await t.app.inject({
    url: `/api/v1/things/${item.clientId}/attachments?limit=100`,
    headers,
  });
  expect(attachments.statusCode, attachments.body).toBe(200);
  expect(attachments.json().items).toEqual(
    original.map(({ id, role, bytes }) =>
      expect.objectContaining({
        role,
        file: expect.objectContaining({ id, bytes: bytes.length, sha256: sha256(bytes) }),
      }),
    ),
  );

  // Pending work already acknowledged by the pre-negotiation server can still recover the exact
  // old result after the phone updates. A different body carrying that key remains a conflict.
  const legacy = captureOp(home.id, { containerId: box.id }, { reviewSuggestions: true });
  expect(legacy.payloadVersion).toBe(PAYLOAD_VERSION);
  const prior = await send(t.app, legacy);
  expect(prior.json()).toMatchObject({ results: [{ outcome: 'applied' }] });
  const legacyV2 = { ...legacy, payloadVersion: NATIVE_CAPTURE_PAYLOAD_VERSION };
  expect((await send(t.app, legacyV2)).json()).toEqual(prior.json());
  const altered = { ...legacyV2, payload: { ...legacyV2.payload, name: 'Different' } };
  expect((await send(t.app, altered)).json()).toMatchObject({
    results: [{ outcome: 'dropped', reason: 'idempotency_mismatch' }],
  });
});
