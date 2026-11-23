import {
  CreateThingPayload,
  KEPT_VERSION,
  newId,
  PAYLOAD_VERSION,
  type SyncOpsResponse,
} from '@kept/shared';
import { capturePaths } from '@/api/capture/paths';
import { ApiError } from '@/api/client';
import { inventoryPaths, qs } from '@/api/inventory/paths';
import type { AttachmentView, FileView, Page } from '@/api/inventory/types';
import { type Connection, native, nativeRequest, networkError, unwrap } from './bridge';

export type SelectedOriginal = { file: File; role: 'photo' | 'document' };
type OriginalMeta = {
  id: string;
  name: string;
  mime: string;
  role: SelectedOriginal['role'];
  bytes: number;
};
type DraftFields = {
  locationId: string;
  boxId: string;
  name: string;
  note?: string;
  quantity?: string;
  batchId?: string;
};
type StoredFields = DraftFields & { version: number };
type Capture = {
  id: string;
  payload: string;
  takenAt: string;
  files: { file: OriginalMeta; sha256: string }[];
};
export type PendingCapture = { capture: Capture; failure?: string };
const chunkBytes = 256 * 1024;
export const mobileFileLimit = 25 * 1024 * 1024;

export const storage = (
  connection: Connection,
  action: string,
  fields: Record<string, string | number> = {},
) => native.outbox({ context: connection.id, action, ...fields });

export async function readStored<T>(
  connection: Connection,
  action: 'list' | 'cached',
): Promise<T | undefined> {
  const { data } = await storage(connection, action);
  return data === undefined ? undefined : (JSON.parse(data) as T);
}

export function draftFields(capture: Capture): StoredFields {
  return JSON.parse(capture.payload) as StoredFields;
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

export async function saveOnPhone(
  connection: Connection,
  fields: DraftFields,
  files: SelectedOriginal[],
): Promise<void> {
  if (
    files.length > 20 ||
    files.some(({ file }) => file.size <= 0 || file.size > mobileFileLimit)
  ) {
    throw new Error('Invalid file size');
  }
  const id = newId();
  const takenAt = new Date().toISOString();
  const originals: OriginalMeta[] = [];
  const payload = JSON.stringify({
    ...fields,
    batchId: fields.batchId ?? id,
    version: PAYLOAD_VERSION,
  });
  try {
    for (const { file, role } of files) {
      const fileId = newId();
      for (let offset = 0; offset < file.size; offset += chunkBytes) {
        const bytes = new Uint8Array(await file.slice(offset, offset + chunkBytes).arrayBuffer());
        await storage(connection, 'stage', { id, file: fileId, offset, data: base64(bytes) });
      }
      originals.push({
        id: fileId,
        mime: file.type || 'application/octet-stream',
        name: file.name.slice(0, 120),
        role,
        bytes: file.size,
      });
    }
    await storage(connection, 'save', { id, takenAt, payload, files: JSON.stringify(originals) });
  } catch (error) {
    await storage(connection, 'abort', { id }).catch(() => {});
    throw error;
  }
}

export class ReplayError extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

export async function replayCapture(connection: Connection, capture: Capture): Promise<void> {
  const fields = draftFields(capture);
  const payload = CreateThingPayload.parse({
    id: capture.id,
    batchId: fields.batchId,
    target: { containerId: fields.boxId },
    mode: 'thing',
    reviewSuggestions: true,
    name: fields.name,
    note: fields.note,
    quantity: fields.quantity,
    files: capture.files.map(({ file, sha256 }) => ({ fileId: file.id, role: file.role, sha256 })),
  });

  for (const { file, sha256 } of capture.files) {
    const uploaded = await native
      .uploadOriginal({
        context: connection.id,
        id: capture.id,
        file: file.id,
        location: fields.locationId,
      })
      .catch(networkError)
      .then((answer) => unwrap<FileView>(answer));
    if (uploaded.sha256 !== sha256 || uploaded.bytes !== file.bytes) {
      throw new ReplayError('checksum_mismatch');
    }
  }

  const response = await nativeRequest<SyncOpsResponse>(connection, capturePaths.syncOps, {
    method: 'POST',
    body: {
      clientVersion: KEPT_VERSION,
      ops: [
        {
          clientVersion: KEPT_VERSION,
          payloadVersion: fields.version,
          clientId: capture.id,
          idempotencyKey: capture.id,
          op: 'create_thing',
          takenAt: capture.takenAt,
          locationId: fields.locationId,
          payload,
        },
      ],
    },
  });
  const result = response.results[0];
  if (result?.outcome !== 'applied' || result.entity?.id !== capture.id) {
    throw new ReplayError(result?.reason ?? 'needs_review');
  }

  if (capture.files.length) {
    const attached = await nativeRequest<Page<AttachmentView>>(
      connection,
      `${inventoryPaths.thingAttachments(capture.id)}${qs({ limit: 100 })}`,
    );
    for (const { file, sha256 } of capture.files) {
      if (
        !attached.items.some(
          (entry) =>
            entry.role === file.role &&
            entry.file?.sha256 === sha256 &&
            entry.file.bytes === file.bytes,
        )
      ) {
        throw new ReplayError('attachments_unconfirmed');
      }
    }
  }

  await storage(connection, 'complete', { id: capture.id });
}

export async function syncOutbox(connection: Connection): Promise<number> {
  const queue = await readStored<PendingCapture[]>(connection, 'list');
  let count = 0;
  for (const entry of queue ?? []) {
    try {
      await replayCapture(connection, entry.capture);
      count++;
    } catch (error) {
      if (error instanceof ApiError && (error.status === 0 || error.status === 401)) throw error;
      const reason =
        error instanceof ReplayError
          ? error.reason
          : error instanceof ApiError
            ? error.code
            : 'retry';
      await storage(connection, 'failed', { id: entry.capture.id, reason });
      if (
        error instanceof ApiError &&
        (error.status >= 500 || error.status === 429 || error.status === 409)
      ) {
        throw error;
      }
    }
  }
  return count;
}
