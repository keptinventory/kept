import { createContext, createElement, type ReactNode, useContext } from 'react';
import type { FileView } from '@/api/inventory/types';
import {
  type Capture,
  type CompletionState,
  type Connection,
  type FindTagEvent,
  type NativeRequestOptions,
  native,
  nativeRequest,
  networkError,
  type PendingCapture,
  type StorageStats,
  type TagReading,
  unwrap,
} from './bridge';

export type PlatformCredentials = {
  connection(): Promise<Connection | null>;
  connect(address: string): Promise<Connection>;
  disconnect(): Promise<{ revoked: boolean }>;
};

export type PlatformTransport = {
  request<T>(connection: Connection, path: string, options?: NativeRequestOptions): Promise<T>;
  uploadOriginal(
    connection: Connection,
    input: { id: string; file: string; location: string; uploadId?: string },
  ): Promise<FileView>;
};

export type PlatformOutbox = {
  stage(
    connection: Connection,
    input: { id: string; file: string; offset: number; data: string },
  ): Promise<void>;
  save(
    connection: Connection,
    input: { id: string; takenAt: string; payload: string; files: string },
  ): Promise<void>;
  abort(connection: Connection, id: string): Promise<void>;
  list(connection: Connection): Promise<PendingCapture[]>;
  failed(connection: Connection, id: string, reason: string): Promise<void>;
  clearFailure(connection: Connection, id: string): Promise<void>;
  retarget(connection: Connection, id: string, payload: string): Promise<Capture>;
  complete(connection: Connection, id: string): Promise<void>;
  discard(connection: Connection, id: string): Promise<void>;
  completions(connection: Connection): Promise<Record<string, CompletionState>>;
  listHeld(connection: Connection): Promise<PendingCapture[]>;
  discardHeld(connection: Connection, heldContext: string, id: string): Promise<void>;
  stats(connection: Connection): Promise<StorageStats>;
  cached(connection: Connection): Promise<string | undefined>;
  saveCache(connection: Connection, data: string): Promise<void>;
  clearCache(connection: Connection): Promise<void>;
  getValue(connection: Connection, key: string): Promise<string | undefined>;
  setValue(connection: Connection, key: string, data: string): Promise<void>;
  deleteValue(connection: Connection, key: string): Promise<void>;
};

export type PlatformNfc = {
  scanTag(
    connection: Connection,
    input: {
      mode: 'read' | 'inspect' | 'write';
      url?: string;
      fingerprint?: string;
      messages: Record<string, string>;
    },
  ): Promise<TagReading>;
  startFind(
    connection: Connection,
    input: { sessionId: string; messages: Record<string, string> },
  ): Promise<TagReading & { sessionId?: string }>;
  continueFind(connection: Connection, sessionId: string, message?: string): Promise<void>;
  finishFind(connection: Connection, sessionId: string, message?: string): Promise<void>;
  cancelTag(sessionId?: string): Promise<void>;
  onFindReading(callback: (reading: FindTagEvent) => void): Promise<() => Promise<void> | void>;
};

export type PlatformFeedback = {
  match(connection: Connection, announcement?: string): Promise<void>;
  nonMatch(connection: Connection, announcement?: string): Promise<void>;
};

export type PlatformMedia = {
  openRemote(
    connection: Connection,
    input: { thing?: string; file: string; mime: string; variant?: 'display' },
  ): Promise<void>;
  openPending(connection: Connection, input: { id: string; file: string }): Promise<void>;
  shareLabelPdf(connection: Connection, input: { url: string; name: string }): Promise<void>;
  openHeld(
    connection: Connection,
    input: { heldContext: string; id: string; file: string },
  ): Promise<void>;
  exportHeld(
    connection: Connection,
    input: { heldContext: string; id: string; metadata: string },
  ): Promise<void>;
};

export type PlatformLifecycle = {
  takeLink(connection: Connection): Promise<string | undefined>;
  onLink(callback: () => void): Promise<() => Promise<void> | void>;
  onAppStateChange(
    callback: (state: { active: boolean }) => void,
  ): Promise<() => Promise<void> | void>;
};

/** Reserved integration seam for Phase 3B / MVP 2 full image-based retrieval. */
export type VisualSearchAdapter = {
  isSupported: boolean;
};

export type PlatformAdapters = {
  credentials: PlatformCredentials;
  transport: PlatformTransport;
  outbox: PlatformOutbox;
  nfc: PlatformNfc;
  feedback: PlatformFeedback;
  media: PlatformMedia;
  lifecycle: PlatformLifecycle;
  visualSearch?: VisualSearchAdapter;
};

const callOutbox = (
  connection: Connection,
  action: string,
  fields: Record<string, string | number> = {},
) => native.outbox({ context: connection.id, action, ...fields }).catch(networkError);

export const capacitorAdapters: PlatformAdapters = {
  credentials: {
    async connection() {
      const saved = await native.connection();
      return 'id' in saved && saved.id ? (saved as Connection) : null;
    },
    connect(address) {
      return native.connect({ address });
    },
    disconnect() {
      return native.disconnect();
    },
  },
  transport: {
    request: nativeRequest,
    async uploadOriginal(connection, input) {
      const answer = await native
        .uploadOriginal({
          context: connection.id,
          id: input.id,
          file: input.file,
          location: input.location,
          ...(input.uploadId ? { uploadId: input.uploadId } : {}),
        })
        .catch(networkError);
      return unwrap<FileView>(answer);
    },
  },
  outbox: {
    async stage(connection, input) {
      await callOutbox(connection, 'stage', {
        id: input.id,
        file: input.file,
        offset: input.offset,
        data: input.data,
      });
    },
    async save(connection, input) {
      await callOutbox(connection, 'save', {
        id: input.id,
        takenAt: input.takenAt,
        payload: input.payload,
        files: input.files,
      });
    },
    async abort(connection, id) {
      await callOutbox(connection, 'abort', { id });
    },
    async list(connection) {
      const { data } = await callOutbox(connection, 'list');
      return data ? (JSON.parse(data) as PendingCapture[]) : [];
    },
    async failed(connection, id, reason) {
      await callOutbox(connection, 'failed', { id, reason });
    },
    async clearFailure(connection, id) {
      await callOutbox(connection, 'clearFailure', { id });
    },
    async retarget(connection, id, payload) {
      const { data } = await callOutbox(connection, 'retarget', { id, payload });
      if (!data) throw new Error('Missing retarget response');
      return JSON.parse(data) as Capture;
    },
    async complete(connection, id) {
      await callOutbox(connection, 'complete', { id });
    },
    async discard(connection, id) {
      await callOutbox(connection, 'discard', { id });
    },
    async completions(connection) {
      const { data } = await callOutbox(connection, 'completions');
      return data ? (JSON.parse(data) as Record<string, CompletionState>) : {};
    },
    async listHeld(connection) {
      const { data } = await callOutbox(connection, 'heldList');
      return data ? (JSON.parse(data) as PendingCapture[]) : [];
    },
    async discardHeld(connection, heldContext, id) {
      await callOutbox(connection, 'heldDiscard', { heldContext, id });
    },
    async stats(connection) {
      const { data } = await callOutbox(connection, 'stats');
      return data
        ? (JSON.parse(data) as StorageStats)
        : { pendingCount: 0, pendingBytes: 0, cacheBytes: 0 };
    },
    async cached(connection) {
      const { data } = await callOutbox(connection, 'cached');
      return data;
    },
    async saveCache(connection, data) {
      await callOutbox(connection, 'saveCache', { data });
    },
    async clearCache(connection) {
      await callOutbox(connection, 'clearCache');
    },
    async getValue(connection, key) {
      const { data } = await callOutbox(connection, 'getValue', { key });
      return data;
    },
    async setValue(connection, key, data) {
      await callOutbox(connection, 'setValue', { key, data });
    },
    async deleteValue(connection, key) {
      await callOutbox(connection, 'deleteValue', { key });
    },
  },
  nfc: {
    scanTag(connection, input) {
      return native.scanTag({ context: connection.id, ...input });
    },
    startFind(connection, input) {
      return native.startFind({ context: connection.id, ...input });
    },
    continueFind(connection, sessionId, message) {
      return native.continueFind({
        context: connection.id,
        sessionId,
        ...(message ? { message } : {}),
      });
    },
    finishFind(connection, sessionId, message) {
      return native.finishFind({
        context: connection.id,
        sessionId,
        ...(message ? { message } : {}),
      });
    },
    cancelTag(sessionId) {
      return native.cancelTag(sessionId ? { sessionId } : {});
    },
    async onFindReading(callback) {
      const handle = await native.addListener('nfcFind', callback);
      return () => handle.remove();
    },
  },
  feedback: {
    match(connection, announcement) {
      return native.matchFeedback({
        context: connection.id,
        ...(announcement ? { announcement } : {}),
      });
    },
    nonMatch(connection, announcement) {
      return native.nonMatchFeedback({
        context: connection.id,
        ...(announcement ? { announcement } : {}),
      });
    },
  },
  media: {
    openRemote(connection, input) {
      return native.openMedia({ context: connection.id, ...input });
    },
    openPending(connection, input) {
      return native.openPendingMedia({ context: connection.id, ...input });
    },
    shareLabelPdf(connection, input) {
      return native.shareLabelPdf({ context: connection.id, ...input });
    },
    openHeld(connection, input) {
      return native.openHeldMedia({ context: connection.id, ...input });
    },
    exportHeld(connection, input) {
      return native.exportHeldCapture({ context: connection.id, ...input });
    },
  },
  lifecycle: {
    async takeLink(connection) {
      const result = await native.takeLink({ context: connection.id });
      return result.url;
    },
    async onLink(callback) {
      const handle = await native.addListener('keptLink', callback);
      return () => handle.remove();
    },
    async onAppStateChange(callback) {
      const handle = await native.addListener('appState', callback);
      return () => handle.remove();
    },
  },
  visualSearch: { isSupported: false },
};

const PlatformContext = createContext<PlatformAdapters>(capacitorAdapters);

export function NativePlatformProvider({
  adapters = capacitorAdapters,
  children,
}: {
  adapters?: PlatformAdapters;
  children: ReactNode;
}) {
  return createElement(PlatformContext.Provider, { value: adapters }, children);
}

export function usePlatform(): PlatformAdapters {
  return useContext(PlatformContext);
}
