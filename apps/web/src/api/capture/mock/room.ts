/**
 * Room photos in the mock server (#194): what Try Kept shows for a Room capture, and the Room
 * card's actions. There is no AI here: every room photo reads the same invented room, canned
 * below, so the feature can be tried and filmed. A room capture makes its drafts (each a draft
 * thing in the room, with an inbox draft item in the capture's batch), proposes the bookcase as a
 * place, lists a thing already in that place as already in Kept, and opens one Room card.
 */

import {
  accessOf,
  liveThing,
  newId,
  now,
  type StoredThing,
  versionError,
} from '../../inventory/mock/db';
import { contentsTemplate } from '../../inventory/mock/places';
import type { MockState } from '../../mock/fixtures';
import {
  err,
  forbidden,
  type MockRoute,
  notFound,
  reply,
  route,
  sessionGate,
} from '../../mock/kit';
import { capturePaths as p } from '../paths';
import type { InboxRoom } from '../types';
import type { StoredInboxItem } from './state';

/** What every room photo shows in the demo: invented objects of each kind. */
export const DEMO_ROOM = {
  things: [
    { name: 'Desk lamp', kind: 'item' as const },
    { name: 'Armchair', kind: 'furniture' as const },
    { name: 'Wall clock', kind: 'item' as const },
    { name: 'Floor cushion', kind: 'item' as const },
  ],
  places: ['Bookcase'],
};

type RoomInput = {
  id: string;
  locationId: string;
  batchId: string;
  placeId: string | null;
  containerId: string | null;
  photos: number;
  codeThingIds?: string[];
};

/** Makes a room capture's drafts and its card, as the server would once the photos are read. */
export function makeRoom(state: MockState, b: RoomInput): StoredInboxItem {
  const inv = state.inventory;
  const cap = state.capture;
  const target = b.containerId
    ? liveThing(inv, b.containerId)?.name
    : inv.places.find((x) => x.id === b.placeId)?.name;
  // Already in Kept: the first reviewed thing standing in the room.
  const there = inv.things.find(
    (t) =>
      !t.deletedAt &&
      t.reviewState !== 'draft' &&
      (b.containerId ? t.containerId === b.containerId : t.placeId === b.placeId),
  );
  let batch = cap.batches.find((x) => x.batchId === b.batchId);
  if (!batch) {
    batch = {
      batchId: b.batchId,
      locationId: b.locationId,
      placeId: b.placeId ?? '',
      capturedAt: now(),
      createdById: state.me.user.id,
      thingIds: [],
    };
    cap.batches.unshift(batch);
  }
  const drafts: string[] = [];
  for (const d of DEMO_ROOM.things) {
    const t = {
      ...contentsTemplate(),
      id: newId(),
      locationId: b.locationId,
      shortCode: null,
      name: d.name,
      type: null,
      placeId: b.containerId ? null : b.placeId,
      containerId: b.containerId,
      isContainer: false,
      reviewState: 'draft',
      fieldStatus: { name: { state: 'extracted', confidence: 0.9 } },
    } as StoredThing;
    inv.things.push(t);
    batch.thingIds.push(t.id);
    drafts.push(t.id);
    cap.inbox.unshift({
      id: newId(),
      kind: 'draft',
      locationId: b.locationId,
      createdAt: now(),
      createdById: state.me.user.id,
      createdByName: null,
      rowVersion: 1,
      batchId: b.batchId,
      thingId: t.id,
      photos: [],
      fieldStatus: { name: { state: 'extracted', confidence: 0.9 } },
      suggestions: [],
      resolvedAt: null,
      resolution: null,
    });
  }
  const coded = (b.codeThingIds ?? []).map((id) => liveThing(inv, id)).filter((t) => !!t);
  const room: InboxRoom = {
    id: b.id,
    status: 'ready',
    target: {
      kind: b.containerId ? 'container' : 'place',
      id: (b.containerId ?? b.placeId) as string,
      name: target ?? '',
    },
    progress: { done: b.photos, total: b.photos },
    photos: Array.from({ length: b.photos }, (_, i) => ({
      attachmentId: newId(),
      thumbUrl: null,
      status: 'read' as const,
      objects: i === 0 ? DEMO_ROOM.things.length + DEMO_ROOM.places.length : 0,
      more: false,
    })),
    merged: b.photos > 1 ? 'model' : 'none',
    drafts: { made: drafts.length, waiting: drafts.length, failed: 0 },
    places: b.containerId
      ? []
      : DEMO_ROOM.places.map((name, index) => ({ index, name, photo: 0, placeId: null })),
    already: [
      ...coded.map((t) => ({
        thingId: t.id,
        name: t.name ?? '',
        matchedBy: 'code' as const,
        seen: false,
        thumbUrl: null,
      })),
      ...(there && !coded.some((t) => t.id === there.id)
        ? [
            {
              thingId: there.id,
              name: there.name ?? '',
              matchedBy: 'name_type' as const,
              seen: false,
              thumbUrl: null,
            },
          ]
        : []),
    ],
    keepPhotos: false,
  };
  const item: StoredInboxItem = {
    id: newId(),
    kind: 'room',
    locationId: b.locationId,
    // Before its drafts, as the server opens it at capture time.
    createdAt: new Date(Date.now() - 1000).toISOString(),
    createdById: state.me.user.id,
    createdByName: null,
    rowVersion: 1,
    batchId: b.batchId,
    room,
    resolvedAt: null,
    resolution: null,
  };
  cap.inbox.unshift(item);
  return item;
}

/** POST /inbox/:id/room/{places,seen,done,discard,retry}. */
export function roomRoutes(state: MockState): MockRoute[] {
  const access = () => accessOf(state);
  const act = (
    path: (id: string) => string,
    fn: (item: StoredInboxItem & { room: InboxRoom }, body: Record<string, unknown>) => unknown,
  ) =>
    route('POST', path(':id'), (req) => {
      const gate = sessionGate(state);
      if (gate) return gate;
      const item = state.capture.inbox.find(
        (i) => i.id === req.params.id && i.resolvedAt === null && i.kind === 'room',
      );
      if (!item?.room || !access().visible(item.locationId)) return notFound();
      if (!access().canWrite(item.locationId)) return forbidden();
      const stale = versionError(req.headers, item, [], 'Alfred');
      if (stale) return reply(stale.status, stale.body);
      const out = fn(
        item as StoredInboxItem & { room: InboxRoom },
        (req.body ?? {}) as Record<string, unknown>,
      );
      item.rowVersion += 1;
      return out;
    });
  return [
    act(p.inboxRoomPlaces, (item, body) => {
      const made: string[] = [];
      for (const index of (body.indexes as number[]) ?? []) {
        const proposal = item.room.places.find((x) => x.index === index);
        if (!proposal)
          return err(400, 'validation', `Check indexes: nothing was proposed as ${index}.`);
        if (proposal.placeId) continue;
        const parent = state.inventory.places.find((x) => x.id === item.room.target.id);
        const id = newId();
        if (parent) {
          state.inventory.places.push({
            ...structuredClone(parent),
            id,
            parentId: parent.id,
            name: proposal.name,
            kindKey: 'closet',
            isUnplaced: false,
          });
        }
        proposal.placeId = id;
        made.push(id);
      }
      return { placeIds: made };
    }),
    act(p.inboxRoomSeen, (item, body) => {
      for (const id of (body.thingIds as string[]) ?? []) {
        const a = item.room.already.find((x) => x.thingId === id);
        if (!a) return err(400, 'validation', `Check thingIds: ${id} isn't on this card.`);
        a.seen = true;
      }
      return {};
    }),
    act(p.inboxRoomDone, (item) => {
      item.resolvedAt = now();
      item.resolution = 'accepted';
      return { photosKept: item.room.keepPhotos };
    }),
    act(p.inboxRoomDiscard, (item) => {
      item.resolvedAt = now();
      item.resolution = 'discarded';
      return { photosKept: false };
    }),
    act(p.inboxRoomRetry, () =>
      err(409, 'conflict', 'Only photos that could not be read are read again.'),
    ),
  ];
}
