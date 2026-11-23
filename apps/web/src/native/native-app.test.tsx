import { I18nProvider } from '@lingui/react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { capturePaths } from '@/api/capture/paths';
import { ApiError } from '@/api/client';
import { paths } from '@/api/paths';
import { ConfirmProvider } from '@/components/ui/confirm';
import { activateLocale, i18n } from '@/i18n/i18n';
import { expectLogicalOnly } from '@/test/render';
import { NativePlatformProvider, type PlatformAdapters } from './adapters';
import {
  type Capture,
  type Connection,
  type FindTagEvent,
  type PendingCapture,
  StorageFullError,
  type TagReading,
} from './bridge';
import { KeptPhone } from './main';

beforeAll(async () => {
  await activateLocale('en');
});

type FakeEnvOptions = {
  initialConnection?: Connection | null;
};

function createFakeEnvironment(opts: FakeEnvOptions = {}) {
  let currentConnection: Connection | null = opts.initialConnection ?? null;
  let online = true;
  let failStorageFull = false;
  let forceDropReason: string | null = null;

  const boxId = '11111111-1111-7111-8111-111111111111';
  const spareBoxId = '22222222-2222-7222-8222-222222222222';
  const locId = '33333333-3333-7333-8333-333333333333';
  const placeId = '44444444-4444-7444-8444-444444444444';

  const outboxByContext = new Map<string, PendingCapture[]>();
  const cacheByContext = new Map<string, string>();
  const kvByContext = new Map<string, Map<string, string>>();
  const serverThings = new Map<string, Record<string, unknown>>([
    [
      boxId,
      {
        id: boxId,
        locationId: locId,
        shortCode: '7KQ4MZ',
        labelPrinted: true,
        name: 'Winter Box',
        typeId: 'type-box',
        placeId,
        containerId: null,
        quantity: 1,
        lifecycle: 'in_use',
        derivedState: [],
        path: [{ id: placeId, name: 'Garage' }],
        containerThumbUrl: null,
        thumbUrl: null,
        lastSeenAt: null,
        isContainer: true,
        tags: [],
        brand: null,
        model: null,
        serial: null,
        barcode: null,
        colour: null,
        condition: null,
        notes: 'Top shelf',
        aliases: {},
        belongsTo: null,
        manualUrl: null,
        expiresOn: null,
        expiryLeadDays: null,
        ended: null,
        acquiredFrom: null,
        provenanceNotes: null,
        locationUncertain: false,
        reviewState: 'confirmed',
        fieldStatus: {},
        fields: [],
        custom: {},
        archivedCustom: {},
        secrets: [],
        contentsCount: 0,
        purchase: null,
        photos: [],
        attachmentsCount: 0,
        meters: [],
        links: [],
      },
    ],
    [
      spareBoxId,
      {
        id: spareBoxId,
        locationId: locId,
        shortCode: '9AB2CD',
        labelPrinted: true,
        name: 'Spare Box',
        typeId: 'type-box',
        placeId,
        containerId: null,
        quantity: 1,
        lifecycle: 'in_use',
        derivedState: [],
        path: [{ id: placeId, name: 'Garage' }],
        containerThumbUrl: null,
        thumbUrl: null,
        lastSeenAt: null,
        isContainer: true,
        tags: [],
        brand: null,
        model: null,
        serial: null,
        barcode: null,
        colour: null,
        condition: null,
        notes: null,
        aliases: {},
        belongsTo: null,
        manualUrl: null,
        expiresOn: null,
        expiryLeadDays: null,
        ended: null,
        acquiredFrom: null,
        provenanceNotes: null,
        locationUncertain: false,
        reviewState: 'confirmed',
        fieldStatus: {},
        fields: [],
        custom: {},
        archivedCustom: {},
        secrets: [],
        contentsCount: 0,
        purchase: null,
        photos: [],
        attachmentsCount: 0,
        meters: [],
        links: [],
      },
    ],
  ]);
  const attachmentsByThing = new Map<string, unknown[]>();
  const uploadedFiles = new Map<string, { sha256: string; bytes: number; mime: string }>();

  let findListener: ((reading: FindTagEvent) => void) | null = null;
  let resolveFind: ((value: TagReading & { sessionId?: string }) => void) | null = null;
  let currentFindSession: string | null = null;
  const scanSequence: TagReading[] = [];
  const completionsByContext = new Map<string, Map<string, 'synced' | 'discarded'>>();
  const getCompletions = (ctx: string) => {
    const existing = completionsByContext.get(ctx);
    if (existing) return existing;
    const next = new Map<string, 'synced' | 'discarded'>();
    completionsByContext.set(ctx, next);
    return next;
  };
  const isHeld = (candidate: string, current: string) => {
    if (candidate === current) return false;
    const a = candidate.split('|');
    const b = current.split('|');
    return a.length === 3 && b.length === 3 && a[0] === b[0] && a[1] === b[1] && a[2] !== b[2];
  };

  const events = {
    matches: [] as string[],
    nonMatches: [] as string[],
    openedRemote: [] as Array<{ thing?: string; file: string; mime: string }>,
    openedPending: [] as Array<{ id: string; file: string }>,
    continueCalls: [] as Array<string | undefined>,
    continueSessions: [] as Array<string | undefined>,
    finishCalls: [] as Array<string | undefined>,
    finishSessions: [] as Array<string | undefined>,
    openedHeld: [] as Array<{ heldContext: string; id: string; file: string }>,
    disconnected: 0,
  };

  const getQueue = (ctx: string) => {
    const existing = outboxByContext.get(ctx);
    if (existing) return existing;
    const next: PendingCapture[] = [];
    outboxByContext.set(ctx, next);
    return next;
  };

  const getKv = (ctx: string) => {
    const existing = kvByContext.get(ctx);
    if (existing) return existing;
    const next = new Map<string, string>();
    kvByContext.set(ctx, next);
    return next;
  };

  const adapters: PlatformAdapters = {
    credentials: {
      async connection() {
        return currentConnection;
      },
      async connect(address) {
        const origin = address.trim().replace(/\/+$/, '');
        currentConnection = {
          id: `${origin}|ibrahim|epoch-1`,
          origin,
          account: 'ibrahim',
          epoch: 'epoch-1',
        };
        return currentConnection;
      },
      async disconnect() {
        events.disconnected += 1;
        if (currentConnection) cacheByContext.delete(currentConnection.id);
        currentConnection = null;
        return { revoked: true };
      },
    },
    transport: {
      async request<T>(
        _conn: Connection,
        path: string,
        options?: { method?: string; body?: unknown },
      ): Promise<T> {
        if (!online) throw new ApiError(0, 'offline', 'Offline');

        if (path === '/api/v1/native/capture-capabilities') {
          return {
            contractVersion: 1,
            capturePayloadVersions: [2],
            account: _conn.account,
            epoch: _conn.epoch,
          } as T;
        }
        if (path === paths.me) {
          return { id: 'ibrahim', email: 'ibrahim@kept.test' } as T;
        }
        if (path.startsWith(capturePaths.syncSnapshot)) {
          return {
            asOf: '2026-11-22T20:00:00Z',
            complete: true,
            nextCursor: null,
            locations: [
              {
                id: locId,
                ownerAccountId: 'acc-1',
                name: 'Home',
                role: 'owner',
                unplacedPlaceId: placeId,
              },
            ],
            types: {
              items: [{ id: 'type-box', builtinKey: 'box_bin', name: 'Box', isContainer: true }],
            },
            changes: {
              places: [
                {
                  id: placeId,
                  locationId: locId,
                  parentId: null,
                  name: 'Garage',
                  kindKey: 'room',
                  isUnplaced: false,
                  sortOrder: 0,
                  shortCode: null,
                  labelPrinted: false,
                  deleted: false,
                },
              ],
              things: [...serverThings.values()].map((t) => ({
                id: t.id,
                locationId: locId,
                shortCode: t.shortCode,
                labelPrinted: t.labelPrinted,
                name: t.name,
                typeId: t.typeId,
                placeId: t.placeId,
                containerId: t.containerId,
                quantity: String(t.quantity),
                aliases: {},
                lifecycle: 'in_use',
                reviewState: t.reviewState,
                locationUncertain: false,
                lastSeenAt: null,
                coverFileId: null,
                isContainer: t.isContainer,
                deleted: false,
              })),
              codes: [
                {
                  code: '7KQ4MZ',
                  locationId: locId,
                  state: 'assigned',
                  thingId: boxId,
                  placeId: null,
                  isPrimary: true,
                  printedAt: null,
                },
                {
                  code: '9AB2CD',
                  locationId: locId,
                  state: 'assigned',
                  thingId: spareBoxId,
                  placeId: null,
                  isPrimary: true,
                  printedAt: null,
                },
              ],
              legacyCodes: [],
            },
            removed: [],
            revokedLocationIds: [],
          } as T;
        }
        if (path === capturePaths.syncOps) {
          const body = options?.body as {
            ops: Array<{
              clientId: string;
              idempotencyKey: string;
              payload: {
                id: string;
                name?: string;
                note?: string;
                quantity?: string;
                target: { containerId?: string };
                files: Array<{ fileId: string; role: string }>;
              };
            }>;
          };
          const results = body.ops.map((op) => {
            if (forceDropReason) {
              return {
                clientId: op.clientId,
                idempotencyKey: op.idempotencyKey,
                outcome: 'dropped',
                reason: forceDropReason,
              };
            }
            const createdId = op.payload.id;
            serverThings.set(createdId, {
              id: createdId,
              locationId: locId,
              shortCode: '4CD5EF',
              labelPrinted: false,
              name: op.payload.name ?? null,
              typeId: null,
              placeId: null,
              containerId: op.payload.target.containerId ?? boxId,
              quantity: Number(op.payload.quantity ?? 1),
              lifecycle: 'in_use',
              derivedState: [],
              path: [
                { id: placeId, name: 'Garage' },
                { id: boxId, name: 'Winter Box' },
              ],
              containerThumbUrl: null,
              thumbUrl: null,
              lastSeenAt: null,
              isContainer: false,
              tags: [],
              brand: null,
              model: null,
              serial: null,
              barcode: null,
              colour: null,
              condition: null,
              notes: op.payload.note ?? null,
              aliases: {},
              belongsTo: null,
              manualUrl: null,
              expiresOn: null,
              expiryLeadDays: null,
              ended: null,
              acquiredFrom: null,
              provenanceNotes: null,
              locationUncertain: false,
              reviewState: 'confirmed',
              fieldStatus: {},
              fields: [],
              custom: {},
              archivedCustom: {},
              secrets: [],
              contentsCount: 0,
              purchase: null,
              photos: [],
              attachmentsCount: op.payload.files.length,
              meters: [],
              links: [],
            });
            attachmentsByThing.set(
              createdId,
              op.payload.files.map((f, index) => {
                const meta = uploadedFiles.get(f.fileId);
                return {
                  id: `att-${createdId}-${index}`,
                  role: f.role,
                  sort: index,
                  file: {
                    id: f.fileId,
                    sha256: meta?.sha256 ?? 'a'.repeat(64),
                    bytes: meta?.bytes ?? 10,
                    mime: meta?.mime ?? (f.role === 'photo' ? 'image/jpeg' : 'application/pdf'),
                    class: f.role === 'photo' ? 'evidence' : 'document',
                    hasGps: false,
                    width: null,
                    height: null,
                    derivativeState: 'ready',
                    thumbUrl: null,
                    displayUrl: null,
                  },
                  url: null,
                  subject: { thingId: createdId },
                  name: f.role === 'photo' ? 'photo.jpg' : 'manual.pdf',
                  createdBy: { displayName: 'Ibrahim' },
                  rowVersion: 1,
                };
              }),
            );
            return {
              clientId: op.clientId,
              idempotencyKey: op.idempotencyKey,
              outcome: 'applied',
              entity: { type: 'thing', id: createdId, shortCode: '4CD5EF' },
            };
          });
          return { results } as T;
        }
        if (path === capturePaths.scanResolve) {
          const text = (options?.body as { text?: string } | undefined)?.text ?? '';
          if (text.includes('7KQ4MZ') || text.trim().toUpperCase() === '7KQ4MZ') {
            return {
              outcome: 'open',
              target: { kind: 'thing', id: boxId, locationId: locId },
            } as T;
          }
          if (text.includes('9AB2CD') || text.trim().toUpperCase() === '9AB2CD') {
            return {
              outcome: 'open',
              target: { kind: 'thing', id: spareBoxId, locationId: locId },
            } as T;
          }
          if (text.includes('AMBIG1')) {
            return {
              outcome: 'legacy_ambiguous',
              candidates: [
                {
                  id: boxId,
                  kind: 'thing',
                  locationId: locId,
                  locationName: 'Home',
                  name: 'Winter Box',
                },
                {
                  id: spareBoxId,
                  kind: 'thing',
                  locationId: locId,
                  locationName: 'Home',
                  name: 'Spare Box',
                },
              ],
            } as T;
          }
          return { outcome: 'not_in_your_kept' } as T;
        }
        if (path.startsWith('/api/v1/things/')) {
          const attMatch = /^\/api\/v1\/things\/([^/]+)\/attachments/.exec(path);
          if (attMatch?.[1]) {
            return { items: attachmentsByThing.get(attMatch[1]) ?? [], next_cursor: null } as T;
          }
          const detailMatch = /^\/api\/v1\/things\/([^/?]+)$/.exec(path);
          if (detailMatch?.[1]) {
            const thing = serverThings.get(detailMatch[1]);
            if (!thing) throw new ApiError(404, 'not_found', 'Not found');
            return thing as T;
          }
        }
        if (path.startsWith(capturePaths.inbox) && !path.includes('/accept')) {
          const items = [...serverThings.values()]
            .filter((t) => t.id !== boxId && t.id !== spareBoxId)
            .map((t) => ({
              id: 'inbox-item-1',
              kind: 'draft',
              locationId: locId,
              createdAt: '2026-11-22T20:00:00Z',
              createdBy: { displayName: 'Ibrahim' },
              rowVersion: 1,
              batch: null,
              thing: t,
              suggestions: [
                {
                  field: 'name',
                  value: 'Holiday glass ornaments',
                  confidence: 0.9,
                  source: { extractionId: 'ext-1', attachmentId: 'att-1' },
                },
              ],
            }));
          return {
            items,
            next_cursor: null,
            counts: { byKind: {}, mine: items.length, everyone: items.length },
          } as T;
        }
        if (path.includes('/accept')) {
          const body = options?.body as { set?: { name?: string } };
          if (body.set?.name) {
            for (const [id, thing] of serverThings) {
              if (id !== boxId && id !== spareBoxId) {
                thing.name = body.set.name;
              }
            }
          }
          return { item: undefined } as T;
        }
        throw new Error(`Unhandled request path: ${path}`);
      },
      async uploadOriginal(conn, input) {
        if (!online) throw new ApiError(0, 'offline', 'Offline');
        const entry = getQueue(conn.id).find((q) => q.capture.id === input.id);
        const orig = entry?.capture.files.find((f) => f.file.id === input.file);
        if (!orig) throw new Error('Missing staged original');
        uploadedFiles.set(orig.file.id, {
          sha256: orig.sha256,
          bytes: orig.file.bytes,
          mime: orig.file.mime,
        });
        return {
          id: orig.file.id,
          sha256: orig.sha256,
          bytes: orig.file.bytes,
          mime: orig.file.mime,
          class: orig.file.role === 'photo' ? 'evidence' : 'document',
          hasGps: false,
          width: null,
          height: null,
          derivativeState: 'ready',
          thumbUrl: null,
          displayUrl: null,
        };
      },
    },
    outbox: {
      async stage() {},
      async save(conn, input) {
        if (failStorageFull) throw new StorageFullError();
        const files = JSON.parse(input.files) as Capture['files'][number]['file'][];
        getQueue(conn.id).push({
          capture: {
            id: input.id,
            payload: input.payload,
            takenAt: input.takenAt,
            files: files.map((file) => ({ file, sha256: 'd'.repeat(64) })),
          },
        });
      },
      async abort() {},
      async list(conn) {
        return [...getQueue(conn.id)];
      },
      async failed(conn, id, reason) {
        const list = getQueue(conn.id);
        const idx = list.findIndex((e) => e.capture.id === id);
        if (idx >= 0 && list[idx]) list[idx] = { capture: list[idx].capture, failure: reason };
      },
      async clearFailure(conn, id) {
        const list = getQueue(conn.id);
        const idx = list.findIndex((e) => e.capture.id === id);
        if (idx >= 0 && list[idx]) list[idx] = { capture: list[idx].capture };
      },
      async retarget(conn, id, payload) {
        const list = getQueue(conn.id);
        const idx = list.findIndex((e) => e.capture.id === id);
        if (idx < 0 || !list[idx]) throw new Error('missing');
        const updated: Capture = { ...list[idx].capture, payload };
        list[idx] = { capture: updated };
        return updated;
      },
      async complete(conn, id) {
        getCompletions(conn.id).set(id, 'synced');
        outboxByContext.set(
          conn.id,
          getQueue(conn.id).filter((e) => e.capture.id !== id),
        );
      },
      async discard(conn, id) {
        getCompletions(conn.id).set(id, 'discarded');
        outboxByContext.set(
          conn.id,
          getQueue(conn.id).filter((e) => e.capture.id !== id),
        );
      },
      async completions(conn) {
        return Object.fromEntries(getCompletions(conn.id));
      },
      async listHeld(conn) {
        const held: PendingCapture[] = [];
        for (const [ctx, queue] of outboxByContext) {
          if (!isHeld(ctx, conn.id)) continue;
          for (const entry of queue) {
            held.push({ ...entry, capture: { ...entry.capture, context: ctx } });
          }
        }
        return held;
      },
      async discardHeld(conn, heldContext, id) {
        if (!isHeld(heldContext, conn.id)) throw new Error('not held');
        getCompletions(heldContext).set(id, 'discarded');
        outboxByContext.set(
          heldContext,
          getQueue(heldContext).filter((e) => e.capture.id !== id),
        );
      },
      async stats(conn) {
        const list = getQueue(conn.id);
        return {
          pendingCount: list.length,
          pendingBytes: list.reduce(
            (sum, e) => sum + e.capture.files.reduce((s, f) => s + f.file.bytes, 0),
            0,
          ),
          cacheBytes: cacheByContext.get(conn.id)?.length ?? 0,
        };
      },
      async cached(conn) {
        return cacheByContext.get(conn.id);
      },
      async saveCache(conn, data) {
        cacheByContext.set(conn.id, data);
      },
      async clearCache(conn) {
        cacheByContext.delete(conn.id);
      },
      async getValue(conn, key) {
        return getKv(conn.id).get(key);
      },
      async setValue(conn, key, data) {
        getKv(conn.id).set(key, data);
      },
      async deleteValue(conn, key) {
        getKv(conn.id).delete(key);
      },
    },
    nfc: {
      async scanTag() {
        return scanSequence.shift() ?? { status: 'cancelled' };
      },
      startFind(_conn, input) {
        currentFindSession = input.sessionId;
        return new Promise<TagReading & { sessionId?: string }>((resolve) => {
          resolveFind = resolve;
        });
      },
      async continueFind(conn, sessionId, message) {
        void conn;
        events.continueCalls.push(message);
        events.continueSessions.push(sessionId);
      },
      async finishFind(conn, sessionId, message) {
        void conn;
        events.finishCalls.push(message);
        events.finishSessions.push(sessionId);
        // Native guard: a stale finish must not terminate a newer session.
        if (sessionId !== currentFindSession) return;
        resolveFind?.({ status: 'matched', sessionId });
        resolveFind = null;
      },
      async cancelTag(sessionId) {
        if (sessionId && currentFindSession && sessionId !== currentFindSession) return;
        resolveFind?.({ status: 'cancelled', sessionId: currentFindSession ?? undefined });
        resolveFind = null;
      },
      async onFindReading(callback) {
        findListener = callback;
        return () => {
          findListener = null;
        };
      },
    },
    feedback: {
      async match(_conn, announcement) {
        events.matches.push(announcement ?? '');
      },
      async nonMatch(_conn, announcement) {
        events.nonMatches.push(announcement ?? '');
      },
    },
    media: {
      async openRemote(_conn, input) {
        events.openedRemote.push(input);
      },
      async openPending(_conn, input) {
        events.openedPending.push(input);
      },
      async openHeld(_conn, input) {
        events.openedHeld.push(input);
      },
    },
    lifecycle: {
      async takeLink() {
        return undefined;
      },
      async onLink() {
        return () => {};
      },
      async onAppStateChange() {
        return () => {};
      },
    },
  };

  function renderApp() {
    return render(
      <I18nProvider i18n={i18n}>
        <NativePlatformProvider adapters={adapters}>
          <ConfirmProvider>
            <KeptPhone />
          </ConfirmProvider>
        </NativePlatformProvider>
      </I18nProvider>,
    );
  }

  return {
    adapters,
    events,
    boxId,
    spareBoxId,
    renderApp,
    setOnline: (value: boolean) => {
      online = value;
    },
    setStorageFull: (value: boolean) => {
      failStorageFull = value;
    },
    setForceDrop: (reason: string | null) => {
      forceDropReason = reason;
    },
    pushScan: (...readings: TagReading[]) => {
      scanSequence.push(...readings);
    },
    emitFindReading: (event: FindTagEvent) => {
      findListener?.({ sessionId: currentFindSession ?? undefined, ...event });
    },
    endFindSession: (status: string) => {
      resolveFind?.({ status, sessionId: currentFindSession ?? undefined });
      resolveFind = null;
    },
    seedHeld: (entry: PendingCapture, heldContext: string) => {
      getQueue(heldContext).push(entry);
    },
    seedPending: (entry: PendingCapture, ctx: string) => {
      getQueue(ctx).push(entry);
    },
    completionsFor: (ctx: string) => Object.fromEntries(getCompletions(ctx)),
    setConnection: (conn: Connection | null) => {
      currentConnection = conn;
    },
  };
}

describe('KeptPhone mobile workflows', () => {
  it('supports login, offline capture of photo+PDF, pending preview, sync, remote open, and AI review', async () => {
    const env = createFakeEnvironment();
    const user = userEvent.setup();
    env.renderApp();

    const serverField = await screen.findByLabelText('Kept server address');
    await user.type(serverField, 'https://kept.example.com');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    const winterBoxBtn = await screen.findByRole('button', { name: /Winter Box/i });
    expect(winterBoxBtn).toHaveTextContent('Home › Garage');
    expectLogicalOnly();
    await user.click(winterBoxBtn);

    await screen.findByRole('button', { name: 'Add to this box' });
    await user.click(screen.getByRole('button', { name: 'Add to this box' }));

    // Capture offline with photo + PDF.
    env.setOnline(false);
    await user.type(screen.getByLabelText('Description'), 'Holiday decorations');
    await user.type(screen.getByLabelText('Notes'), 'Glass baubles');
    await user.type(screen.getByLabelText('Quantity (optional)'), '2');

    const photo = new File(['jpegbytes'], 'ornaments.jpg', { type: 'image/jpeg' });
    const pdf = new File(['%PDF-1.4'], 'packing-guide.pdf', { type: 'application/pdf' });
    const fileInputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
    expect(fileInputs.length).toBe(3);
    const photoInput = fileInputs.item(1);
    const pdfInput = fileInputs.item(2);
    if (!photoInput || !pdfInput) throw new Error('Expected photo and PDF file inputs');
    await user.upload(photoInput, photo);
    await user.upload(pdfInput, pdf);

    await user.click(screen.getByRole('button', { name: 'Save to box' }));
    expect(await screen.findByText('Saved on device.')).toBeInTheDocument();
    expect(screen.getByText('Entries in this batch: 1')).toBeInTheDocument();

    // Pending capture and pending original preview work inside the box before sync.
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByText('Pending in this box')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'packing-guide.pdf' }));
    expect(env.events.openedPending).toHaveLength(1);

    // Return online and retry sync.
    env.setOnline(true);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(await screen.findByRole('button', { name: 'Retry sync' }));

    await waitFor(() => {
      expect(screen.queryByLabelText('Pending captures')).not.toBeInTheDocument();
    });

    // Reopen synced item, open remote original attachment, and edit AI suggestion.
    await user.click(await screen.findByRole('button', { name: /Winter Box/i }));
    await user.click(await screen.findByRole('button', { name: 'Holiday decorations' }));

    await user.click(await screen.findByRole('button', { name: 'manual.pdf' }));
    expect(env.events.openedRemote).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Check AI suggestions' }));
    const suggestedInput = await screen.findByLabelText('Suggested description');
    expect(suggestedInput).toHaveValue('Holiday glass ornaments');
    await user.clear(suggestedInput);
    await user.type(suggestedInput, 'Holiday ornaments box');
    await user.click(screen.getByRole('button', { name: 'Use this description' }));
    expect(
      await screen.findByRole('heading', { name: 'Holiday ornaments box' }),
    ).toBeInTheDocument();
  });

  it('handles NFC enroll recovery, continuous Find nonmatch/offline/match, and target persistence', async () => {
    const conn: Connection = {
      id: 'https://kept.example.com|ibrahim|epoch-1',
      origin: 'https://kept.example.com',
      account: 'ibrahim',
      epoch: 'epoch-1',
    };
    const env = createFakeEnvironment({ initialConnection: conn });
    const user = userEvent.setup();
    const view = env.renderApp();

    await user.click(await screen.findByRole('button', { name: /Winter Box/i }));
    await user.click(await screen.findByRole('button', { name: 'QR and NFC label' }));

    // Enroll: occupied tag belonging to Spare Box + interrupted write + Verify recovery.
    env.pushScan(
      {
        status: 'inspected',
        occupied: true,
        writable: true,
        capacity: 140,
        required: 36,
        fingerprint: 'f'.repeat(64),
        url: 'https://kept.example.com/l/9AB2CD',
      },
      { status: 'write_unverified' },
      {
        status: 'inspected',
        occupied: true,
        writable: true,
        capacity: 140,
        required: 36,
        fingerprint: 'f'.repeat(64),
        url: 'https://kept.example.com/l/7KQ4MZ',
      },
    );

    await user.click(screen.getByRole('button', { name: 'Inspect NFC tag' }));
    expect(await screen.findByText(/Currently linked to:/)).toHaveTextContent('Spare Box');
    await user.click(screen.getByRole('button', { name: 'Overwrite NFC tag' }));
    expect(await screen.findByText(/Writing was interrupted/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Verify tag now' }));
    expect(
      await screen.findByText('This tag already contains the verified Kept label.'),
    ).toBeInTheDocument();

    // Find mode: continuous session handles nonmatch, repeated, offline unresolved, timeout, and match.
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(await screen.findByRole('button', { name: 'Find this box' }));

    await user.click(screen.getByRole('button', { name: 'Scan NFC tag' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Stop scanning' })).toBeInTheDocument(),
    );

    act(() => {
      env.emitFindReading({ status: 'read', url: 'https://kept.example.com/l/9AB2CD' });
    });
    expect(await screen.findByText(/not this box/)).toBeInTheDocument();
    expect(env.events.nonMatches).toHaveLength(1);
    expect(env.events.continueCalls).toHaveLength(1);

    act(() => {
      env.emitFindReading({ status: 'repeated' });
    });
    expect(
      await screen.findByText('Same tag scanned again. Move to another box.'),
    ).toBeInTheDocument();

    // Uncached offline tag is explicitly unresolved, never verified nonmatch.
    env.setOnline(false);
    act(() => {
      env.emitFindReading({ status: 'read', url: 'https://kept.example.com/l/ZZZZ99' });
    });
    expect(
      await screen.findByText(
        'This label could not be checked offline, so it is not confirmed as a different box.',
      ),
    ).toBeInTheDocument();
    expect(env.events.nonMatches).toHaveLength(1);
    env.setOnline(true);

    // A label lookup can finish after Core NFC has already timed out.
    let finishLookup = () => {};
    const lookupDelay = new Promise<void>((resolve) => {
      finishLookup = resolve;
    });
    const request = env.adapters.transport.request;
    const slowLookup = vi
      .spyOn(env.adapters.transport, 'request')
      .mockImplementation(async (connection, path, options) => {
        if (path === capturePaths.scanResolve) await lookupDelay;
        return request(connection, path, options);
      });
    act(() => {
      env.emitFindReading({ status: 'read', url: 'https://kept.example.com/l/7KQ4MZ' });
      env.endFindSession('timeout');
    });
    expect(await screen.findByRole('button', { name: 'Continue scanning' })).toBeInTheDocument();
    await act(async () => finishLookup());
    expect(env.events.matches).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Continue scanning' })).toBeInTheDocument();
    slowLookup.mockRestore();

    // Session B (restart after timeout) stays active until its own valid result:
    // A's late answer must not finish it, and a non-match keeps it scanning.
    const finishesBeforeB = env.events.finishCalls.length;
    await user.click(screen.getByRole('button', { name: 'Continue scanning' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Stop scanning' })).toBeInTheDocument(),
    );
    act(() => {
      env.emitFindReading({ status: 'read', url: 'https://kept.example.com/l/9AB2CD' });
    });
    expect(await screen.findByText(/not this box/)).toBeInTheDocument();
    expect(env.events.matches).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Stop scanning' })).toBeInTheDocument();
    act(() => {
      env.emitFindReading({ status: 'read', url: 'https://kept.example.com/l/7KQ4MZ' });
    });
    expect(await screen.findByRole('button', { name: 'Open box' })).toBeInTheDocument();
    expect(env.events.matches).toHaveLength(1);
    expect(env.events.finishCalls.length).toBe(finishesBeforeB + 1);
    // Finish and the preceding continue belong to the same (B) session, distinct
    // from session A's continue calls recorded before the timeout.
    expect(env.events.finishSessions.at(-1)).toBe(env.events.continueSessions.at(-1));
    expect(env.events.finishSessions.at(-1)).not.toBe(env.events.continueSessions[0]);

    view.unmount();
    env.renderApp();
    expect(await screen.findByText('Resumable Find target')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue finding' }));

    // Typed QR fallback in Find mode also triggers match feedback!
    await user.type(screen.getByLabelText('Type the code'), '7KQ4MZ');
    await user.click(screen.getByRole('button', { name: 'Open label' }));
    expect(await screen.findByRole('button', { name: 'Open box' })).toBeInTheDocument();
    expect(env.events.matches).toHaveLength(2);
  });

  it('handles storage exhaustion, action-required retargeting, and safe sign-out confirmation', async () => {
    const conn: Connection = {
      id: 'https://kept.example.com|ibrahim|epoch-1',
      origin: 'https://kept.example.com',
      account: 'ibrahim',
      epoch: 'epoch-1',
    };
    const env = createFakeEnvironment({ initialConnection: conn });
    const user = userEvent.setup();
    env.renderApp();

    await user.click(await screen.findByRole('button', { name: /Winter Box/i }));
    await user.click(await screen.findByRole('button', { name: 'Add to this box' }));

    env.setStorageFull(true);
    await user.type(screen.getByLabelText('Description'), 'Tools');
    await user.click(screen.getByRole('button', { name: 'Save to box' }));
    expect(
      await screen.findByText('Your iPhone storage is full. Free up space and try again.'),
    ).toBeInTheDocument();

    env.setStorageFull(false);
    env.setForceDrop('target_trashed');
    await user.click(screen.getByRole('button', { name: 'Save to box' }));
    expect(await screen.findByText('Saved on device.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Done' }));
    await user.click(await screen.findByRole('button', { name: 'Back' }));

    expect(
      await screen.findByText(/The destination box is missing or in Trash/),
    ).toBeInTheDocument();

    // Safe sign-out confirmation warns when pending captures exist.
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Stay signed in' }));
    expect(env.events.disconnected).toBe(0);

    // Move failed capture to Spare Box and retry cleanly.
    env.setForceDrop(null);
    await user.click(screen.getByRole('button', { name: 'Change box' }));
    await user.click(screen.getByRole('button', { name: 'Move and retry' }));
    await waitFor(() => {
      expect(screen.queryByLabelText('Pending captures')).not.toBeInTheDocument();
    });
  });

  it('never counts a discarded offline capture as synced, and recovers held work', async () => {
    const conn: Connection = {
      id: 'https://kept.example.com|ibrahim|epoch-1',
      origin: 'https://kept.example.com',
      account: 'ibrahim',
      epoch: 'epoch-1',
    };
    const env = createFakeEnvironment({ initialConnection: conn });
    const user = userEvent.setup();
    env.renderApp();

    await user.click(await screen.findByRole('button', { name: /Winter Box/i }));
    await user.click(await screen.findByRole('button', { name: 'Add to this box' }));
    env.setOnline(false);
    await user.type(screen.getByLabelText('Description'), 'Offline discard me');
    await user.click(screen.getByRole('button', { name: 'Save to box' }));
    expect(await screen.findByText('Saved on device.')).toBeInTheDocument();
    expect(await screen.findByText(/Saved on device: 1/)).toBeInTheDocument();

    // Discard through the pending-work panel while the capture form stays open.
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    const discardButtons = screen.getAllByRole('button', { name: 'Discard' });
    const confirmDiscard = discardButtons.at(-1);
    if (!confirmDiscard) throw new Error('Expected a discard confirmation');
    await user.click(confirmDiscard);
    expect(await screen.findByText(/Discarded: 1/)).toBeInTheDocument();
    expect(screen.queryByText(/Synced:/)).not.toBeInTheDocument();
  });

  it('shows held pre-restore work for review, preview and discard only', async () => {
    const conn: Connection = {
      id: 'https://kept.example.com|ibrahim|epoch-1',
      origin: 'https://kept.example.com',
      account: 'ibrahim',
      epoch: 'epoch-1',
    };
    const env = createFakeEnvironment({ initialConnection: conn });
    const user = userEvent.setup();
    // Held (pre-restore) work for the same origin+account is reviewable, not replayed.
    env.seedHeld(
      {
        capture: {
          id: '66666666-6666-7666-8666-666666666666',
          context: 'https://kept.example.com|ibrahim|epoch-0',
          payload: JSON.stringify({
            locationId: '33333333-3333-7333-8333-333333333333',
            boxId: env.boxId,
            name: 'Held ornaments',
            note: 'From before the restore',
            version: 1,
          }),
          takenAt: '2026-11-20T20:00:00Z',
          files: [
            {
              file: {
                id: '55555555-5555-7555-8555-555555555555',
                name: 'held.jpg',
                mime: 'image/jpeg',
                role: 'photo',
                bytes: 9,
              },
              sha256: 'f'.repeat(64),
            },
          ],
        },
      },
      'https://kept.example.com|ibrahim|epoch-0',
    );
    env.renderApp();
    expect(await screen.findByText(/Held captures: 1/)).toBeInTheDocument();
    expect(screen.getByText('Held ornaments')).toBeInTheDocument();
    expect(screen.getByText(/automatic replay is paused/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Preview/ }));
    expect(env.events.openedHeld).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    const heldDiscard = screen.getAllByRole('button', { name: 'Discard' });
    const confirmHeldDiscard = heldDiscard.at(-1);
    if (!confirmHeldDiscard) throw new Error('Expected a discard confirmation');
    await user.click(confirmHeldDiscard);
    await waitFor(() => {
      expect(screen.queryByText(/Held captures:/)).not.toBeInTheDocument();
    });
  });

  it('renders Arabic RTL with logical CSS only', async () => {
    const conn: Connection = {
      id: 'https://kept.example.com|ibrahim|epoch-1',
      origin: 'https://kept.example.com',
      account: 'ibrahim',
      epoch: 'epoch-1',
    };
    const env = createFakeEnvironment({ initialConnection: conn });
    try {
      await activateLocale('ar');
      document.documentElement.dir = 'rtl';
      env.renderApp();
      expect(await screen.findByRole('button', { name: /Winter Box/i })).toBeInTheDocument();
      expectLogicalOnly();
    } finally {
      document.documentElement.dir = 'ltr';
      await activateLocale('en');
    }
  });
});
