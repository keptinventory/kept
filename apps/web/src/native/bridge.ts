import { type PluginListenerHandle, registerPlugin } from '@capacitor/core';
import { ApiError, toApiError } from '@/api/client';

export type Connection = { id: string; origin: string; account: string; epoch: string };

export type TagReading = {
  status: string;
  url?: string;
  fingerprint?: string;
  occupied?: boolean;
  writable?: boolean;
  capacity?: number;
  required?: number;
};

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
  }): Promise<NativeResponse>;
  outbox(input: { context: string; action: string } & Record<string, string | number>): Promise<{
    data?: string;
  }>;
  uploadOriginal(input: {
    context: string;
    id: string;
    file: string;
    location: string;
  }): Promise<NativeResponse>;
  scanTag(input: {
    context: string;
    mode: 'read' | 'inspect' | 'write';
    url?: string;
    fingerprint?: string;
    messages: Record<string, string>;
  }): Promise<TagReading>;
  cancelTag(): Promise<void>;
  matchFeedback(input: { context: string }): Promise<void>;
  takeLink(input: { context: string }): Promise<{ url?: string }>;
  openMedia(input: { context: string; thing: string; file: string; mime: string }): Promise<void>;
  addListener(event: 'keptLink', callback: () => void): Promise<PluginListenerHandle>;
};

export const native = registerPlugin<NativeKept>('KeptNative');

export function networkError(error: unknown): never {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'network') {
    throw new ApiError(0, 'offline', 'Needs a connection');
  }
  throw error;
}

export async function unwrap<T>(answer: NativeResponse): Promise<T> {
  if (answer.status < 200 || answer.status >= 300) {
    throw await toApiError(new Response(answer.body, { status: answer.status }));
  }
  return (answer.body ? JSON.parse(answer.body) : undefined) as T;
}

export async function nativeRequest<T>(
  connection: Connection,
  path: string,
  options: { method?: string; body?: unknown; ifMatch?: number } = {},
): Promise<T> {
  const answer = await native
    .request({
      context: connection.id,
      path,
      method: options.method ?? 'GET',
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      ...(options.ifMatch === undefined ? {} : { ifMatch: String(options.ifMatch) }),
    })
    .catch(networkError);
  return unwrap<T>(answer);
}
