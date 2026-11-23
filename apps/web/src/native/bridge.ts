import { type PluginListenerHandle, registerPlugin } from '@capacitor/core';
import { ApiError, toApiError } from '@/api/client';

export type Connection = { id: string; origin: string; account: string; epoch: string };

export type OriginalMeta = {
  id: string;
  name: string;
  mime: string;
  role: 'photo' | 'document';
  bytes: number;
};

export type Capture = {
  id: string;
  payload: string;
  takenAt: string;
  /** Native context (`origin|account|epoch`) that owns this capture, when reported. */
  context?: string;
  files: { file: OriginalMeta; sha256: string }[];
};

export type PendingCapture = { capture: Capture; failure?: string };

/** Only `synced` means server-confirmed; disappearance alone proves nothing. */
export type CompletionState = 'synced' | 'discarded';

export type StorageStats = {
  pendingCount: number;
  pendingBytes: number;
  cacheBytes: number;
};

export type TagReading = {
  status: string;
  url?: string;
  fingerprint?: string;
  occupied?: boolean;
  writable?: boolean;
  capacity?: number;
  required?: number;
};

export type FindTagEvent = {
  status: 'read' | 'blank' | 'malformed' | 'unsupported' | 'repeated';
  /** Scan-session identity minted by React for one Find run; stale sessions must be ignored. */
  sessionId?: string;
  url?: string;
  fingerprint?: string;
  occupied?: boolean;
  writable?: boolean;
  capacity?: number;
};

export class StorageFullError extends Error {
  constructor(message = 'Your iPhone storage is full. Free up space and try again.') {
    super(message);
    this.name = 'StorageFullError';
  }
}

type NativeResponse = { status: number; body: string };
type NativeKept = {
  connection(): Promise<Connection | Record<string, never>>;
  connect(input: { address: string }): Promise<Connection>;
  disconnect(): Promise<{ revoked: boolean }>;
  request(input: {
    context: string;
    path: string;
    method: string;
    body?: string;
    ifMatch?: string;
    idempotencyKey?: string;
  }): Promise<NativeResponse>;
  outbox(input: { context: string; action: string } & Record<string, string | number>): Promise<{
    data?: string;
  }>;
  uploadOriginal(input: {
    context: string;
    id: string;
    file: string;
    location: string;
    uploadId?: string;
  }): Promise<NativeResponse>;
  scanTag(input: {
    context: string;
    mode: 'read' | 'inspect' | 'write';
    url?: string;
    fingerprint?: string;
    messages: Record<string, string>;
  }): Promise<TagReading>;
  startFind(input: {
    context: string;
    sessionId: string;
    messages: Record<string, string>;
  }): Promise<TagReading & { sessionId?: string }>;
  continueFind(input: { context: string; sessionId: string; message?: string }): Promise<void>;
  finishFind(input: { context: string; sessionId: string; message?: string }): Promise<void>;
  cancelTag(input?: { sessionId?: string }): Promise<void>;
  matchFeedback(input: { context: string; announcement?: string }): Promise<void>;
  nonMatchFeedback(input: { context: string; announcement?: string }): Promise<void>;
  takeLink(input: { context: string }): Promise<{ url?: string }>;
  openMedia(input: {
    context: string;
    thing?: string;
    file: string;
    mime: string;
    variant?: 'display';
  }): Promise<void>;
  shareLabelPdf(input: { context: string; url: string; name: string }): Promise<void>;
  openPendingMedia(input: { context: string; id: string; file: string }): Promise<void>;
  openHeldMedia(input: {
    context: string;
    heldContext: string;
    id: string;
    file: string;
  }): Promise<void>;
  exportHeldCapture(input: {
    context: string;
    heldContext: string;
    id: string;
    metadata: string;
  }): Promise<void>;
  addListener(event: 'keptLink', callback: () => void): Promise<PluginListenerHandle>;
  addListener(
    event: 'nfcFind',
    callback: (reading: FindTagEvent) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: 'appState',
    callback: (state: { active: boolean }) => void,
  ): Promise<PluginListenerHandle>;
};

export const native = registerPlugin<NativeKept>('KeptNative');

export function nativeErrorCode(error: unknown): unknown {
  return error && typeof error === 'object' && 'code' in error ? error.code : undefined;
}

export function networkError(error: unknown): never {
  if (error && typeof error === 'object' && 'code' in error) {
    if (error.code === 'network') {
      throw new ApiError(0, 'offline', 'Needs a connection');
    }
    if (error.code === 'storage_full') {
      const message =
        'message' in error && typeof error.message === 'string' ? error.message : undefined;
      throw new StorageFullError(message);
    }
  }
  throw error;
}

export async function unwrap<T>(answer: NativeResponse): Promise<T> {
  if (answer.status < 200 || answer.status >= 300) {
    throw await toApiError(new Response(answer.body, { status: answer.status }));
  }
  return (answer.body ? JSON.parse(answer.body) : undefined) as T;
}

export type NativeRequestOptions = {
  method?: string;
  body?: unknown;
  ifMatch?: number;
  idempotencyKey?: string;
};

export async function nativeRequest<T>(
  connection: Connection,
  path: string,
  options: NativeRequestOptions = {},
): Promise<T> {
  const answer = await native
    .request({
      context: connection.id,
      path,
      method: options.method ?? 'GET',
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      ...(options.ifMatch === undefined ? {} : { ifMatch: String(options.ifMatch) }),
      ...(options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
    })
    .catch(networkError);
  return unwrap<T>(answer);
}
