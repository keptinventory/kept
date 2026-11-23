import { createHash } from 'node:crypto';
import {
  CreateThingPayload,
  ErrorCode,
  idTimestamp,
  isV7,
  MIN_PAYLOAD_VERSION,
  NATIVE_CAPTURE_PAYLOAD_VERSION,
  NATIVE_INVENTORY_PAYLOAD_VERSION,
  type OpKind,
  type OpPayload,
  PAYLOAD_VERSION,
  PayloadVersionError,
  parseOpPayload,
  type QueueItem,
  SYNC_LIMITS,
  UPGRADERS,
  type UpgraderTable,
  upgradePayload,
} from '@kept/shared';
import { AppError } from '../http/errors.js';

// What `POST /api/v1/sync/ops` checks of an op before any handler runs (D17,
// D148): the batch's payload versions, the ledger's key and hash, the
// ops-only client-id window, and the payload itself.

const DAY_MS = 86_400_000;

/** The ordinary sync payload window and its upgraders (D148). */
export type PayloadWindow = {
  /** The oldest version still upgraded on arrival; below it the batch is `client_outdated`. */
  min: number;
  upgraders: UpgraderTable;
};

/** The build's ordinary window, ending at `PAYLOAD_VERSION`. */
export const PAYLOAD_WINDOW: PayloadWindow = Object.freeze({
  min: MIN_PAYLOAD_VERSION,
  upgraders: UPGRADERS,
});

/** Identifies the native v2 envelope. `parsedPayload` checks the required review flag. */
export function usesNativeCaptureVersion(item: Pick<QueueItem, 'op' | 'payloadVersion'>): boolean {
  return (
    item.op === 'create_thing' &&
    [NATIVE_CAPTURE_PAYLOAD_VERSION, NATIVE_INVENTORY_PAYLOAD_VERSION].includes(item.payloadVersion)
  );
}

/**
 * Refuse the entire batch if any op is too old (`client_outdated`, with `minPayloadVersion`)
 * or uses an unsupported newer version (`server_outdated`, with `payloadVersion`). The
 * separately negotiated native capture version may exceed the ordinary window. If both
 * errors apply, report `client_outdated` first. The client keeps its queue on either 409.
 */
export function batchRefusal(
  ops: readonly Pick<QueueItem, 'op' | 'payloadVersion'>[],
  window: PayloadWindow = PAYLOAD_WINDOW,
): AppError | null {
  if (ops.some((o) => o.payloadVersion < window.min)) {
    return new AppError(ErrorCode.client_outdated, 409, undefined, {
      minPayloadVersion: window.min,
    });
  }
  if (ops.some((op) => op.payloadVersion > PAYLOAD_VERSION && !usesNativeCaptureVersion(op))) {
    return new AppError(ErrorCode.server_outdated, 409, undefined, {
      payloadVersion: PAYLOAD_VERSION,
    });
  }
  return null;
}

/** Upgrade and validate an ordinary payload, or validate native capture v2 directly. */
export function parsedPayload<K extends OpKind>(
  op: K,
  payloadVersion: number,
  payload: unknown,
  window: PayloadWindow = PAYLOAD_WINDOW,
): OpPayload<K> | null {
  if (usesNativeCaptureVersion({ op, payloadVersion })) {
    const parsed = CreateThingPayload.safeParse(payload);
    const hasIntent = payloadVersion === NATIVE_INVENTORY_PAYLOAD_VERSION;
    return parsed.success &&
      parsed.data.reviewSuggestions === true &&
      (hasIntent
        ? !!parsed.data.captureIntent &&
          !parsed.data.attachToThingId &&
          parsed.data.mode === 'thing'
        : parsed.data.captureIntent === undefined)
      ? (parsed.data as OpPayload<K>)
      : null;
  }
  let current: unknown;
  try {
    current = upgradePayload(op, payloadVersion, payload, window.upgraders);
  } catch (err) {
    // A version inside the window with no upgrade step is this server's bug, never the phone's:
    // it is answered as the op being unreadable, and the step is added in the next release.
    if (err instanceof PayloadVersionError) return null;
    throw err;
  }
  const parsed = parseOpPayload(op, current);
  return parsed.success && (op !== 'create_thing' || !('captureIntent' in parsed.data))
    ? (parsed.data as OpPayload<K>)
    : null;
}

/** The ledger's key format (sync_ops_key_chk, 0035). A key outside it is answered `invalid` and
 * not recorded; the phone's keys (`cap:<uuid>`, `seen:<uuid>`, `claim:<code>`, …) all fit. */
export const LEDGER_KEY = /^[A-Za-z0-9_.:-]{8,200}$/;

/**
 * A client-made UUIDv7 inside the ops-only window: up to 90 days old and 1 day ahead. The
 * online routes keep ±7 days; a phone offline for weeks still syncs.
 */
export function inOpsWindow(id: string, now: number = Date.now()): boolean {
  if (!isV7(id)) return false;
  const at = idTimestamp(id);
  return (
    at >= now - SYNC_LIMITS.clientIdPastDays * DAY_MS &&
    at <= now + SYNC_LIMITS.clientIdFutureDays * DAY_MS
  );
}

/** The ids a payload makes rows with, which the services then take unchecked (`via: 'op'`). */
export function madeIds(op: OpKind, payload: unknown): string[] {
  const p = payload as Record<string, unknown>;
  switch (op) {
    case 'create_thing':
    case 'log_reading':
    case 'create_area':
    case 'box_check':
      return [p.id as string];
    case 'scan_session_lines':
      return [(p.session as { id: string }).id];
    case 'claim_label': {
      const target = p.target as { newContainer?: { id: string } };
      return target.newContainer ? [target.newContainer.id] : [];
    }
    default:
      return [];
  }
}

/** JSON with object keys sorted, so the same op hashes the same whatever order it was built in. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * The op's `request_hash` in the ledger: what it asks for, as sent. The client version is left
 * out (an app update between two sends of one op is still the same op), and `dependsOn` counts as
 * a set. An unchanged replay hashes to the same value. The ledger also checks whether a v2
 * native capture matches the same request previously sent in a v1 envelope.
 */
export function requestHash(item: QueueItem): string {
  return createHash('sha256')
    .update(
      canonical({
        op: item.op,
        payloadVersion: item.payloadVersion,
        clientId: item.clientId.toLowerCase(),
        locationId: item.locationId.toLowerCase(),
        takenAt: item.takenAt,
        dependsOn: [...(item.dependsOn ?? [])].sort(),
        payload: item.payload,
      }),
    )
    .digest('hex');
}
