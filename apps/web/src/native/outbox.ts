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
import type { AttachmentView, Page } from '@/api/inventory/types';
import { capacitorAdapters, type PlatformAdapters } from './adapters';
import type { Capture, Connection, OriginalMeta, PendingCapture, StorageStats } from './bridge';

export type { Capture, OriginalMeta, PendingCapture, StorageStats };

export type SelectedOriginal = { file: File; role: 'photo' | 'document' };

export type DraftFields = {
  locationId: string;
  boxId: string;
  name: string;
  note?: string;
  quantity?: string;
  batchId?: string;
};
type StoredFields = DraftFields & {
  version: number;
  attemptId?: string;
  uploadIds?: Record<string, string>;
};

const chunkBytes = 256 * 1024;
export const mobileFileLimit = 25 * 1024 * 1024;

/** Failures requiring user action (move target, discard, etc.) rather than silent auto-retry. */
export const ACTION_REQUIRED_FAILURES = new Set([
  'target_trashed',
  'target_missing',
  'not_permitted',
  'location_revoked',
  'unsupported_media_type',
  'idempotency_mismatch',
  'validation',
  'payload_too_large',
  'checksum_mismatch',
  // Older/rolled-back server that cannot accept this capture shape. Held, never
  // retried in a loop and never fixed by stripping fields such as reviewSuggestions.
  'compatibility_hold',
]);

const COMPATIBILITY_CODES = new Set([
  'unsupported_capability',
  'capability_missing',
  'capabilities_missing',
  'version_mismatch',
  'unsupported_payload',
  'unsupported_operation',
  'server_outdated',
  'client_outdated',
]);

/** Integration contract v1 (docs/mvp1/integration-contract.md). */
export const NATIVE_CONTRACT_VERSION = 1;
export const NATIVE_CAPTURE_PAYLOAD_VERSION = 2;
export const captureCapabilitiesPath = capturePaths.nativeCaptureCapabilities;

export type CaptureCapabilities = {
  contractVersion: number;
  capturePayloadVersions: number[];
  account: string;
  epoch: string;
};

/**
 * Negotiate capture compatibility before any upload or capture mutation (contract v1).
 * A missing/older endpoint is a recoverable hold: queue, identity and originals stay put.
 */
export async function ensureCaptureCompatible(
  connection: Connection,
  adapters: PlatformAdapters = capacitorAdapters,
): Promise<CaptureCapabilities> {
  let caps: unknown;
  try {
    caps = await adapters.transport.request<unknown>(connection, captureCapabilitiesPath);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 0 || error.status === 401)) throw error;
    if (error instanceof ApiError && error.status === 409 && error.hint?.includes('restored')) {
      throw error;
    }
    if (error instanceof ApiError && error.status >= 500) throw error;
    // 404/405 from an older server, or an unparseable non-contract body.
    throw new ReplayError('compatibility_hold');
  }
  const valid =
    typeof caps === 'object' &&
    caps !== null &&
    (caps as CaptureCapabilities).contractVersion === NATIVE_CONTRACT_VERSION &&
    Array.isArray((caps as CaptureCapabilities).capturePayloadVersions) &&
    (caps as CaptureCapabilities).capturePayloadVersions.includes(NATIVE_CAPTURE_PAYLOAD_VERSION) &&
    (caps as CaptureCapabilities).account === connection.account &&
    (caps as CaptureCapabilities).epoch === connection.epoch;
  if (!valid) throw new ReplayError('compatibility_hold');
  return caps as CaptureCapabilities;
}

/** True when a server response signals an older/incompatible server rather than bad data. */
export function isCompatibilityFailure(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.status === 426 || error.status === 501) return true;
  const serverCode = error.serverCode ?? '';
  if (COMPATIBILITY_CODES.has(serverCode) || COMPATIBILITY_CODES.has(error.code)) return true;
  if (error.status === 404 || error.status === 405) {
    return /capabilit|compat|negotiat/i.test(`${error.message} ${error.hint ?? ''} ${serverCode}`);
  }
  // A strict older schema rejecting the capture payload (e.g. unknown reviewSuggestions)
  // is a compatibility hold, not a terminal invalid operation: keep the payload intact.
  if (error.code === 'validation' || serverCode.includes('validation')) {
    return /reviewSuggestions|unknown|unrecognized|unsupported/i.test(
      `${error.message} ${error.hint ?? ''} ${JSON.stringify(error.details)}`,
    );
  }
  return false;
}

export function draftFields(capture: Capture): StoredFields {
  return JSON.parse(capture.payload) as StoredFields;
}

export function canRetarget(entry: PendingCapture): boolean {
  return entry.failure === 'target_trashed' || entry.failure === 'target_missing';
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
  adapters: PlatformAdapters = capacitorAdapters,
): Promise<string> {
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
        await adapters.outbox.stage(connection, { id, file: fileId, offset, data: base64(bytes) });
      }
      originals.push({
        id: fileId,
        mime: file.type || 'application/octet-stream',
        name: file.name.slice(0, 120),
        role,
        bytes: file.size,
      });
    }
    await adapters.outbox.save(connection, {
      id,
      takenAt,
      payload,
      files: JSON.stringify(originals),
    });
    return id;
  } catch (error) {
    await adapters.outbox.abort(connection, id).catch(() => {});
    throw error;
  }
}

export class ReplayError extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

export async function replayCapture(
  connection: Connection,
  capture: Capture,
  adapters: PlatformAdapters = capacitorAdapters,
): Promise<void> {
  // Contract v1: negotiate before uploading files or submitting capture mutations.
  await ensureCaptureCompatible(connection, adapters);
  const fields = draftFields(capture);
  const uploadedFiles: { fileId: string; role: 'photo' | 'document'; sha256: string }[] = [];

  for (const { file, sha256 } of capture.files) {
    const uploaded = await adapters.transport.uploadOriginal(connection, {
      id: capture.id,
      file: file.id,
      location: fields.locationId,
      ...(fields.uploadIds?.[file.id] ? { uploadId: fields.uploadIds[file.id] } : {}),
    });
    if (uploaded.sha256 !== sha256 || uploaded.bytes !== file.bytes) {
      throw new ReplayError('checksum_mismatch');
    }
    // On a per-location dedupe hit (`deduplicatedFrom`), `uploaded.id` is the canonical server file id.
    if (!uploadedFiles.some((entry) => entry.fileId === uploaded.id && entry.role === file.role)) {
      uploadedFiles.push({ fileId: uploaded.id, role: file.role, sha256 });
    }
  }

  const payload = CreateThingPayload.parse({
    id: capture.id,
    batchId: fields.batchId,
    target: { containerId: fields.boxId },
    mode: 'thing',
    reviewSuggestions: true,
    name: fields.name,
    note: fields.note,
    quantity: fields.quantity,
    files: uploadedFiles,
  });

  const response = await adapters.transport.request<SyncOpsResponse>(
    connection,
    capturePaths.syncOps,
    {
      method: 'POST',
      body: {
        clientVersion: KEPT_VERSION,
        ops: [
          {
            clientVersion: KEPT_VERSION,
            // Contract v1: native review captures are payload v2; a stored v1 draft
            // sends the same body and identifiers as v2 (server handles exact replays).
            payloadVersion: NATIVE_CAPTURE_PAYLOAD_VERSION,
            clientId: capture.id,
            idempotencyKey: fields.attemptId ?? capture.id,
            op: 'create_thing',
            takenAt: capture.takenAt,
            locationId: fields.locationId,
            payload,
          },
        ],
      },
    },
  );
  const result = response.results[0];
  const expectedKey = fields.attemptId ?? capture.id;
  if (
    result?.outcome !== 'applied' ||
    result.clientId !== capture.id ||
    result.idempotencyKey !== expectedKey ||
    result.entity?.type !== 'thing' ||
    result.entity?.id !== capture.id
  ) {
    throw new ReplayError(result?.reason ?? 'needs_review');
  }

  if (capture.files.length) {
    const attached = await adapters.transport.request<Page<AttachmentView>>(
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

  await adapters.outbox.complete(connection, capture.id);
}

function classifyFailure(error: unknown): string {
  if (isCompatibilityFailure(error)) return 'compatibility_hold';
  if (error instanceof ReplayError) return error.reason;
  if (error instanceof ApiError) return error.code;
  return 'retry';
}

export async function syncOutbox(
  connection: Connection,
  adapters: PlatformAdapters = capacitorAdapters,
  options: { includeFailed?: boolean } = {},
): Promise<number> {
  const queue = await adapters.outbox.list(connection);
  let count = 0;
  for (const entry of queue) {
    if (!options.includeFailed && entry.failure && ACTION_REQUIRED_FAILURES.has(entry.failure)) {
      continue;
    }
    try {
      await replayCapture(connection, entry.capture, adapters);
      count++;
    } catch (error) {
      if (error instanceof ApiError && (error.status === 0 || error.status === 401)) throw error;
      if (error instanceof ApiError && error.status === 409 && error.hint?.includes('restored')) {
        throw error;
      }
      const reason = classifyFailure(error);
      await adapters.outbox.failed(connection, entry.capture.id, reason);
      if (error instanceof ApiError && (error.status >= 500 || error.status === 429)) {
        throw error;
      }
    }
  }
  return count;
}

export async function retryCapture(
  connection: Connection,
  id: string,
  adapters: PlatformAdapters = capacitorAdapters,
): Promise<boolean> {
  const queue = await adapters.outbox.list(connection);
  const entry = queue.find((item) => item.capture.id === id);
  if (!entry) return false;
  try {
    await adapters.outbox.clearFailure(connection, id);
    await replayCapture(connection, entry.capture, adapters);
    return true;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 0 || error.status === 401)) throw error;
    if (error instanceof ApiError && error.status === 409 && error.hint?.includes('restored')) {
      throw error;
    }
    await adapters.outbox.failed(connection, id, classifyFailure(error));
    return false;
  }
}

export async function retargetCapture(
  connection: Connection,
  entry: PendingCapture,
  destination: { id: string; locationId: string },
  adapters: PlatformAdapters = capacitorAdapters,
): Promise<Capture> {
  if (!canRetarget(entry)) throw new ReplayError('needs_review');
  const { capture } = entry;
  const fields = draftFields(capture);
  // Kept keeps the rejected request under its old key. Reuse the record ID to prevent duplicates.
  // Uploads use location-specific IDs but the device still reads the same protected originals.
  const uploadIds =
    destination.locationId === fields.locationId
      ? fields.uploadIds
      : Object.fromEntries(capture.files.map(({ file }) => [file.id, newId()]));
  const next = JSON.stringify({
    ...fields,
    boxId: destination.id,
    locationId: destination.locationId,
    attemptId: newId(),
    uploadIds,
  });
  return adapters.outbox.retarget(connection, capture.id, next);
}

export async function discardCapture(
  connection: Connection,
  id: string,
  adapters: PlatformAdapters = capacitorAdapters,
): Promise<void> {
  // Distinct durable state from a server-confirmed sync; never reuse `complete`.
  await adapters.outbox.discard(connection, id);
}

export function getCompletions(
  connection: Connection,
  adapters: PlatformAdapters = capacitorAdapters,
): Promise<Record<string, import('./bridge').CompletionState>> {
  return adapters.outbox.completions(connection);
}

export function listHeldCaptures(
  connection: Connection,
  adapters: PlatformAdapters = capacitorAdapters,
): Promise<PendingCapture[]> {
  return adapters.outbox.listHeld(connection);
}

export async function discardHeldCapture(
  connection: Connection,
  entry: PendingCapture,
  adapters: PlatformAdapters = capacitorAdapters,
): Promise<void> {
  const heldContext = entry.capture.context;
  if (!heldContext) throw new ReplayError('needs_review');
  await adapters.outbox.discardHeld(connection, heldContext, entry.capture.id);
}

/** Metadata + integrity hashes for one held capture, safe to share for manual recovery. */
export function heldCaptureExport(entry: PendingCapture) {
  const fields = draftFields(entry.capture);
  return {
    captureId: entry.capture.id,
    takenAt: entry.capture.takenAt,
    heldContext: entry.capture.context ?? null,
    destination: { boxId: fields.boxId, locationId: fields.locationId },
    name: fields.name,
    ...(fields.note ? { note: fields.note } : {}),
    ...(fields.quantity ? { quantity: fields.quantity } : {}),
    ...(fields.batchId ? { batchId: fields.batchId } : {}),
    failure: entry.failure ?? null,
    files: entry.capture.files.map(({ file, sha256 }) => ({
      fileId: file.id,
      name: file.name,
      mime: file.mime,
      role: file.role,
      bytes: file.bytes,
      sha256,
    })),
    note: 'Automatic replay is paused because this capture predates a server restore. Verify the SHA-256 hashes before importing the originals elsewhere.',
  };
}

export function getOutboxStats(
  connection: Connection,
  adapters: PlatformAdapters = capacitorAdapters,
): Promise<StorageStats> {
  return adapters.outbox.stats(connection);
}
