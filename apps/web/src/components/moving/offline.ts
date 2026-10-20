/**
 * Moving mode on a phone with no signal (1.x, D251; D17, D35). In the middle of a move the van,
 * the stairwell and the new house's basement often have none, so the board and its boxes work
 * offline:
 *
 * - **Reading.** Every board the phone opens online is remembered in its offline database (meta
 *   `moves`; a 401 clears it with the rest of the cache, wipe.ts). Offline, the board is that copy
 *   ("as of" the time it was read), with the box changes still queued on this phone laid over it.
 *   What is inside a box comes from the phone's snapshot, like the box check's (boxcheck/load.ts).
 * - **Writing.** Marking a box packed or in transit, and unpacking it into a room, are the
 *   `move_box` op; choosing the room a box goes to is the `move_box_room` op. Online they go
 *   straight to the server (with Undo from the toast for a state); offline, or when the call
 *   can't reach it, they wait in the queue, the board shows them at once (a room by its name in
 *   the phone's snapshot), and the toast's Undo takes them back out while they wait. Packing is
 *   the ordinary `move` op (the carrying tray, or Move on a thing). Starting a move, adding a box
 *   (its number comes from the server), the contents sheets and finishing a move need a
 *   connection.
 * - **Conflicts.** The server orders box states by when they happened on each phone: a change
 *   older than the box's last one changes nothing (the newer word stands, and the board shows it
 *   after the next sync). Rooms follow D35: the one the server gets last wins. A box unpacked by
 *   the time a room arrives keeps the room it was unpacked into, on the server and in the overlay
 *   here. An unpack into a room, or a room, someone trashed meanwhile is dropped with a notice and
 *   a restore, like any op (D35).
 */
import type { BoxState } from '@kept/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { isApiError } from '@/api/client';
import { movingApi, movingKeys } from '@/api/moving/queries';
import type { Move, MoveBox } from '@/api/moving/types';
import { queueItem } from '@/components/scan/resolve';
import type { OfflineStore, QueueEntry } from '@/offline/store';

/** What the board shows, and where it came from. */
export type Board = { move: Move; from: 'server' | 'phone'; asOf: string | null };

type Remembered = Record<string, { move: Move; at: string }>;

/** The store's meta table, where the phone has one (DexieStore); a page store has none. */
type MetaStore = {
  meta: (key: 'moves') => Promise<unknown>;
  setMeta: (key: 'moves', value: unknown) => Promise<void>;
};

const metaOf = (store: OfflineStore | null): MetaStore | null => {
  const m = store as Partial<Record<keyof MetaStore, unknown>> | null;
  return m && typeof m.meta === 'function' && typeof m.setMeta === 'function'
    ? (m as unknown as MetaStore)
    : null;
};

/**
 * The page's own copy: a page without an offline database (tests, a browser with none) keeps them
 * here, and so does a board read before the phone's database opened (a box page opened straight
 * from a link), so it is still there offline once the database has. Once a board is kept in the
 * database the page's copy is emptied, so the database's 401 wipe (wipe.ts) is the only copy.
 */
const inMemory: Remembered = {};

/** At most this many boards are kept: the moves in progress, newest first. */
const KEEP = 5;

const newest = (all: Remembered): Remembered =>
  Object.fromEntries(
    Object.entries(all)
      .sort(([, a], [, b]) => b.at.localeCompare(a.at))
      .slice(0, KEEP),
  );

async function readAll(store: OfflineStore | null): Promise<Remembered> {
  const m = metaOf(store);
  if (!m) return inMemory;
  let stored: Remembered = {};
  try {
    stored = ((await m.meta('moves')) as Remembered | undefined) ?? {};
  } catch {
    // Unreadable: the page's copy still serves.
  }
  const all: Remembered = { ...stored };
  for (const [id, r] of Object.entries(inMemory)) {
    const s = all[id];
    if (!s || s.at < r.at) all[id] = r;
  }
  return newest(all);
}

/** Keeps `move` for offline use. Never throws: a full disk only loses the copy. */
export async function rememberMove(store: OfflineStore | null, move: Move): Promise<void> {
  const kept = newest({
    ...(await readAll(store)),
    [move.id]: { move, at: new Date().toISOString() },
  });
  const m = metaOf(store);
  for (const k of Object.keys(inMemory)) delete inMemory[k];
  if (!m) {
    Object.assign(inMemory, kept);
    return;
  }
  await m.setMeta('moves', kept).catch(() => {});
}

export async function rememberedMove(
  store: OfflineStore | null,
  id: string,
): Promise<{ move: Move; at: string } | null> {
  return (await readAll(store))[id] ?? null;
}

/** The moves this phone remembers, for the list offline. */
export async function rememberedMoves(store: OfflineStore | null): Promise<Move[]> {
  return Object.values(await readAll(store)).map((r) => r.move);
}

/** The `move_box` and `move_box_room` ops still waiting on this phone, in queue order. */
async function waiting(store: OfflineStore | null): Promise<QueueEntry[]> {
  if (!store) return [];
  return (await store.pending()).filter((e) => e.op === 'move_box' || e.op === 'move_box_room');
}

type BoxPayload = { moveId: string; containerId: string; state: BoxState; placeId?: string };
type RoomPayload = { moveId: string; containerId: string; placeId: string };

/**
 * The board with this phone's queued box changes laid over it. A queued room is named from
 * `names` (the phone's snapshot of the destination's places; a room it can't name shows when it
 * syncs), and changes nothing for a box already unpacked, as on the server.
 */
export function overlay(
  move: Move,
  ops: readonly QueueEntry[],
  names: ReadonlyMap<string, string> = new Map(),
): Move {
  const destination = move.toLocationId ?? move.locationId;
  const boxes = move.boxes.map((b) => {
    let out = b;
    for (const e of ops) {
      const p = e.payload as BoxPayload | RoomPayload;
      if (p.moveId !== move.id || p.containerId !== b.containerId) continue;
      if (e.op === 'move_box_room') {
        const { placeId } = p as RoomPayload;
        const name = names.get(placeId);
        if (out.state !== 'unpacked' && name)
          out = { ...out, destination: { placeId, name, locationId: destination } };
        continue;
      }
      const s = p as BoxPayload;
      out = {
        ...out,
        state: s.state,
        stateAt: e.takenAt,
        ...(s.state === 'unpacked' && s.placeId ? { placeId: s.placeId } : {}),
      };
    }
    return out;
  });
  const counts = { packed: 0, in_transit: 0, unpacked: 0, total: boxes.length };
  for (const b of boxes) counts[b.state] += 1;
  return { ...move, boxes, counts };
}

/** The ids of the boxes with a change still waiting on this phone. */
export async function waitingBoxes(store: OfflineStore | null): Promise<Set<string>> {
  return new Set((await waiting(store)).map((e) => (e.payload as BoxPayload).containerId));
}

/** Loads a board: the server when online (and remembers it), else the phone's copy. */
export async function loadBoard(
  id: string,
  { store, online }: { store: OfflineStore | null; online: boolean },
): Promise<Board | null> {
  let board: Board | null = null;
  if (online) {
    try {
      const move = await movingApi.move(id);
      await rememberMove(store, move);
      board = { move, from: 'server', asOf: null };
    } catch (e) {
      if (!(isApiError(e) && e.code === 'offline')) throw e;
    }
  }
  if (!board) {
    const kept = await rememberedMove(store, id);
    if (!kept) return null;
    board = { move: kept.move, from: 'phone', asOf: kept.at };
  }
  const ops = await waiting(store);
  return { ...board, move: overlay(board.move, ops, await roomNames(store, board.move, ops)) };
}

/** The names of the rooms queued for a move's boxes, from the phone's snapshot. */
async function roomNames(
  store: OfflineStore | null,
  move: Move,
  ops: readonly QueueEntry[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (!store || !ops.some((e) => e.op === 'move_box_room')) return names;
  try {
    for (const p of await store.placesOf(move.toLocationId ?? move.locationId)) {
      if (!p.deleted) names.set(p.id, p.name);
    }
  } catch {
    // No snapshot: the room shows when it syncs.
  }
  return names;
}

export function useBoard(
  id: string,
  { store, online }: { store: OfflineStore | null; online: boolean },
) {
  return useQuery({
    // Read again once the phone's database opens, so the board is kept there too.
    queryKey: [...movingKeys.one(id), online ? 'online' : 'offline', store ? 'store' : 'page'],
    queryFn: () => loadBoard(id, { store, online }),
    retry: false,
    // It reads the phone's copy itself when there is no signal: never paused for one.
    networkMode: 'always',
  });
}

export type BoxWritten =
  | { via: 'server'; box: MoveBox; auditEvents: string[] }
  /** The op's idempotency key: Undo takes it back out of the queue while it is unsent. */
  | { via: 'queue'; key: string };

/**
 * A box's new state (and, to unpack, its room): to the server when it can be reached, else the
 * `move_box` op in the queue.
 */
export async function setBoxState({
  store,
  online,
  move,
  box,
  state,
  placeId,
}: {
  store: OfflineStore | null;
  online: boolean;
  move: Pick<Move, 'id' | 'locationId'>;
  box: Pick<MoveBox, 'containerId'>;
  state: BoxState;
  placeId?: string | undefined;
}): Promise<BoxWritten> {
  if (online) {
    try {
      const w =
        state === 'unpacked'
          ? await movingApi.unpack(move.id, box.containerId, placeId ? { placeId } : {})
          : await movingApi.updateBox(move.id, box.containerId, { state });
      return { via: 'server', box: w.body, auditEvents: w.auditEvents };
    } catch (e) {
      if (!(isApiError(e) && e.code === 'offline') || !store) throw e;
    }
  }
  if (!store) throw new Error('No offline store to queue the change in.');
  const item = queueItem('move_box', move.locationId, {
    moveId: move.id,
    containerId: box.containerId,
    state,
    ...(placeId ? { placeId } : {}),
  });
  await store.enqueue(item, []);
  return { via: 'queue', key: item.idempotencyKey };
}

export type RoomWritten =
  | { via: 'server'; box: MoveBox }
  /** The op's idempotency key: Undo takes it back out of the queue while it is unsent. */
  | { via: 'queue'; key: string };

/**
 * The room a box goes to: to the server when it can be reached, else the `move_box_room` op in
 * the queue. Online a room is simply chosen again (no undo window, D251).
 */
export async function setBoxRoom({
  store,
  online,
  move,
  box,
  placeId,
}: {
  store: OfflineStore | null;
  online: boolean;
  move: Pick<Move, 'id' | 'locationId'>;
  box: Pick<MoveBox, 'containerId'>;
  placeId: string;
}): Promise<RoomWritten> {
  if (online) {
    try {
      const w = await movingApi.updateBox(move.id, box.containerId, {
        destinationPlaceId: placeId,
      });
      return { via: 'server', box: w.body };
    } catch (e) {
      if (!(isApiError(e) && e.code === 'offline') || !store) throw e;
    }
  }
  if (!store) throw new Error('No offline store to queue the change in.');
  const item = queueItem('move_box_room', move.locationId, {
    moveId: move.id,
    containerId: box.containerId,
    placeId,
  });
  await store.enqueue(item, []);
  return { via: 'queue', key: item.idempotencyKey };
}

/** After a box change: the board and the box's contents read again. */
export function useRefreshBoard() {
  const qc = useQueryClient();
  return useCallback(
    (moveId: string) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: movingKeys.one(moveId) }),
        qc.invalidateQueries({ queryKey: movingKeys.all }),
      ]),
    [qc],
  );
}
