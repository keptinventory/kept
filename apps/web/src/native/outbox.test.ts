import { newId } from '@kept/shared';
import { describe, expect, it, vi } from 'vitest';
import { capturePaths } from '@/api/capture/paths';
import { ApiError } from '@/api/client';
import { inventoryPaths } from '@/api/inventory/paths';
import { capacitorAdapters, type PlatformAdapters } from './adapters';
import { type Capture, type Connection, type PendingCapture, StorageFullError } from './bridge';
import {
  discardCapture,
  draftFields,
  replayCapture,
  retargetCapture,
  retryCapture,
  saveOnPhone,
  syncOutbox,
} from './outbox';

const connection: Connection = {
  id: 'https://kept.example.com|user-1|epoch-1',
  origin: 'https://kept.example.com',
  account: 'user-1',
  epoch: 'epoch-1',
};

function makeInMemoryAdapters(
  overrides: {
    request?: PlatformAdapters['transport']['request'];
    uploadOriginal?: PlatformAdapters['transport']['uploadOriginal'];
  } = {},
) {
  const staged = new Map<string, string>();
  const captures = new Map<string, PendingCapture>();

  const adapters: PlatformAdapters = {
    ...capacitorAdapters,
    transport: {
      request: overrides.request ?? vi.fn(),
      uploadOriginal: overrides.uploadOriginal ?? vi.fn(),
    },
    outbox: {
      ...capacitorAdapters.outbox,
      async stage(_conn, input) {
        staged.set(`${input.id}:${input.file}:${input.offset}`, input.data);
      },
      async save(_conn, input) {
        const files = JSON.parse(input.files) as Capture['files'][number]['file'][];
        captures.set(input.id, {
          capture: {
            id: input.id,
            payload: input.payload,
            takenAt: input.takenAt,
            files: files.map((file) => ({ file, sha256: 'a'.repeat(64) })),
          },
        });
      },
      async abort(_conn, id) {
        for (const key of staged.keys()) {
          if (key.startsWith(`${id}:`)) staged.delete(key);
        }
      },
      async list() {
        return [...captures.values()];
      },
      async failed(_conn, id, reason) {
        const entry = captures.get(id);
        if (entry) captures.set(id, { ...entry, failure: reason });
      },
      async clearFailure(_conn, id) {
        const entry = captures.get(id);
        if (entry) captures.set(id, { capture: entry.capture });
      },
      async retarget(_conn, id, payload) {
        const entry = captures.get(id);
        if (!entry) throw new Error('missing');
        const next: Capture = { ...entry.capture, payload };
        captures.set(id, { capture: next });
        return next;
      },
      async complete(_conn, id) {
        captures.delete(id);
      },
      async stats() {
        const pendingBytes = [...captures.values()].reduce(
          (sum, entry) => sum + entry.capture.files.reduce((s, f) => s + f.file.bytes, 0),
          0,
        );
        return { pendingCount: captures.size, pendingBytes, cacheBytes: 0 };
      },
    },
  };

  return { adapters, staged, captures };
}

describe('native outbox staging and replay', () => {
  it('chunks files durably, aborts cleanly on error, and surfaces StorageFullError', async () => {
    const { adapters, staged, captures } = makeInMemoryAdapters();
    const bigBytes = new Uint8Array(300_000);
    bigBytes.fill(65);
    const bigFile = new File([bigBytes], 'manual.pdf', { type: 'application/pdf' });

    const id = await saveOnPhone(
      connection,
      {
        locationId: newId(),
        boxId: newId(),
        name: 'Decorations',
        note: 'Top shelf',
        quantity: '2',
      },
      [{ file: bigFile, role: 'document' }],
      adapters,
    );
    expect(captures.has(id)).toBe(true);
    expect([...staged.keys()].filter((k) => k.startsWith(`${id}:`)).length).toBe(2);

    const abortSpy = vi.spyOn(adapters.outbox, 'abort');
    vi.spyOn(adapters.outbox, 'save').mockRejectedValueOnce(new StorageFullError());
    await expect(
      saveOnPhone(
        connection,
        { locationId: newId(), boxId: newId(), name: 'Failed' },
        [{ file: new File(['abc'], 'a.jpg', { type: 'image/jpeg' }), role: 'photo' }],
        adapters,
      ),
    ).rejects.toBeInstanceOf(StorageFullError);
    expect(abortSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps local files when changing locations and attaches identical photos once', async () => {
    const dedupFileId = newId();
    const locId = newId();
    const boxId = newId();
    const captureId = newId();
    const localFileId = newId();
    const sha = 'b'.repeat(64);
    const capture: Capture = {
      id: captureId,
      takenAt: '2026-11-22T20:00:00Z',
      payload: JSON.stringify({
        locationId: locId,
        boxId,
        name: 'Winter ornaments',
        batchId: newId(),
        version: 1,
      }),
      files: [
        {
          file: {
            id: localFileId,
            name: 'photo.jpg',
            mime: 'image/jpeg',
            role: 'photo',
            bytes: 12,
          },
          sha256: sha,
        },
        {
          file: {
            id: newId(),
            name: 'photo-copy.jpg',
            mime: 'image/jpeg',
            role: 'photo',
            bytes: 12,
          },
          sha256: sha,
        },
      ],
    };

    const uploadOriginal = vi.fn().mockResolvedValue({
      id: dedupFileId,
      deduplicatedFrom: dedupFileId,
      sha256: sha,
      bytes: 12,
      mime: 'image/jpeg',
      class: 'evidence',
      hasGps: false,
      width: 100,
      height: 100,
      derivativeState: 'pending',
      thumbUrl: null,
      displayUrl: null,
    });
    const request = vi.fn().mockImplementation(async (_conn, path, opts) => {
      if (path === capturePaths.syncOps) {
        const op = (
          opts?.body as
            | {
                ops?: Array<{
                  payload: { files: Array<{ fileId: string }>; reviewSuggestions?: boolean };
                }>;
              }
            | undefined
        )?.ops?.[0];
        expect(op?.payload.files).toEqual([{ fileId: dedupFileId, role: 'photo', sha256: sha }]);
        expect(op?.payload.reviewSuggestions).toBe(true);
        return {
          results: [
            {
              clientId: captureId,
              idempotencyKey: captureId,
              outcome: 'applied',
              entity: { type: 'thing', id: captureId },
            },
          ],
        };
      }
      if (path.startsWith(inventoryPaths.thingAttachments(captureId))) {
        return {
          items: [
            {
              id: newId(),
              role: 'photo',
              sort: 0,
              file: {
                id: dedupFileId,
                sha256: sha,
                bytes: 12,
                mime: 'image/jpeg',
                class: 'evidence',
                hasGps: false,
                width: 100,
                height: 100,
                derivativeState: 'ready',
                thumbUrl: null,
                displayUrl: null,
              },
              url: null,
              subject: { thingId: captureId },
              createdBy: { displayName: 'Ibrahim' },
              rowVersion: 1,
            },
          ],
          next_cursor: null,
        };
      }
      throw new Error(`Unexpected path ${path}`);
    });

    const { adapters, captures } = makeInMemoryAdapters({ uploadOriginal, request });
    const failed = { capture, failure: 'target_missing' };
    captures.set(captureId, failed);
    const nextLocation = newId();
    const moved = await retargetCapture(
      connection,
      failed,
      { id: newId(), locationId: nextLocation },
      adapters,
    );
    expect(moved.files).toEqual(capture.files);
    const { uploadIds } = draftFields(moved);
    expect(new Set(Object.values(uploadIds ?? {})).size).toBe(2);

    await replayCapture(connection, moved, adapters);
    for (const { file } of capture.files) {
      expect(uploadIds?.[file.id]).not.toBe(file.id);
      expect(uploadOriginal).toHaveBeenCalledWith(connection, {
        id: captureId,
        file: file.id,
        location: nextLocation,
        uploadId: uploadIds?.[file.id],
      });
    }
    expect(captures.has(captureId)).toBe(false);
  });

  it('preserves pending capture on checksum mismatch or unconfirmed attachment', async () => {
    const locId = newId();
    const boxId = newId();
    const captureId = newId();
    const fileId = newId();
    const sha = 'c'.repeat(64);
    const capture: Capture = {
      id: captureId,
      takenAt: '2026-11-22T20:00:00Z',
      payload: JSON.stringify({
        locationId: locId,
        boxId,
        name: 'Manual',
        batchId: newId(),
        version: 1,
      }),
      files: [
        {
          file: {
            id: fileId,
            name: 'doc.pdf',
            mime: 'application/pdf',
            role: 'document',
            bytes: 8,
          },
          sha256: sha,
        },
      ],
    };
    const { adapters, captures } = makeInMemoryAdapters({
      uploadOriginal: vi.fn().mockResolvedValue({
        id: fileId,
        sha256: sha,
        bytes: 8,
        mime: 'application/pdf',
        class: 'document',
        hasGps: false,
        width: null,
        height: null,
        derivativeState: 'not_applicable',
        thumbUrl: null,
        displayUrl: null,
      }),
      request: vi
        .fn()
        .mockResolvedValueOnce({
          results: [
            {
              clientId: captureId,
              idempotencyKey: captureId,
              outcome: 'applied',
              entity: { type: 'thing', id: captureId },
            },
          ],
        })
        .mockResolvedValueOnce({ items: [], next_cursor: null }),
    });
    captures.set(captureId, { capture });

    await expect(syncOutbox(connection, adapters)).resolves.toBe(0);
    expect(captures.get(captureId)?.failure).toBe('attachments_unconfirmed');
  });

  it('preserves queue on 401/offline/restored-409 and handles retarget and discard', async () => {
    const locId = newId();
    const oldBoxId = newId();
    const newBoxId = newId();
    const captureId = newId();
    const capture: Capture = {
      id: captureId,
      takenAt: '2026-11-22T20:00:00Z',
      payload: JSON.stringify({
        locationId: locId,
        boxId: oldBoxId,
        name: 'Cables',
        batchId: newId(),
        version: 1,
      }),
      files: [],
    };
    const request = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(401, 'unauthenticated', 'Expired'))
      .mockRejectedValueOnce(
        new ApiError(409, 'conflict', 'Conflict', { hint: 'This Kept was restored or replaced.' }),
      )
      .mockResolvedValueOnce({
        results: [
          {
            clientId: captureId,
            idempotencyKey: captureId,
            outcome: 'dropped',
            reason: 'target_trashed',
          },
        ],
      })
      .mockResolvedValueOnce({
        results: [
          {
            clientId: captureId,
            idempotencyKey: captureId,
            outcome: 'applied',
            entity: { type: 'thing', id: captureId },
          },
        ],
      });

    const { adapters, captures } = makeInMemoryAdapters({ request });
    captures.set(captureId, { capture });

    await expect(syncOutbox(connection, adapters)).rejects.toMatchObject({ status: 401 });
    expect(captures.get(captureId)?.failure).toBeUndefined();

    await expect(syncOutbox(connection, adapters)).rejects.toMatchObject({ status: 409 });
    expect(captures.get(captureId)?.failure).toBeUndefined();

    expect(await syncOutbox(connection, adapters)).toBe(0);
    expect(captures.get(captureId)?.failure).toBe('target_trashed');

    // Passive sync skips action-required failures; retarget + retry resolves and completes.
    expect(await syncOutbox(connection, adapters)).toBe(0);
    expect(request).toHaveBeenCalledTimes(3);

    const destination = { id: newBoxId, locationId: locId };
    await expect(
      retargetCapture(connection, { capture }, destination, adapters),
    ).rejects.toMatchObject({
      reason: 'needs_review',
    });
    const failed = captures.get(captureId);
    if (!failed) throw new Error('Expected the failed capture to stay on the device');
    const retargeted = await retargetCapture(connection, failed, destination, adapters);
    const next = draftFields(retargeted);
    expect(next.attemptId).toEqual(expect.any(String));
    expect(next.attemptId).not.toBe(captureId);
    expect(await retryCapture(connection, captureId, adapters)).toBe(true);
    expect(request.mock.lastCall?.[2]).toMatchObject({
      body: {
        ops: [
          {
            clientId: captureId,
            idempotencyKey: next.attemptId,
            payload: { id: captureId, target: { containerId: newBoxId } },
          },
        ],
      },
    });
    expect(captures.has(captureId)).toBe(false);

    // Discard removes pending item.
    captures.set(captureId, { capture, failure: 'target_missing' });
    await discardCapture(connection, captureId, adapters);
    expect(captures.has(captureId)).toBe(false);
  });
});
