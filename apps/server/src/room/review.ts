/**
 * The Room card's actions (#194), on an open `room` inbox item, as its reviewer (members and up,
 * `things.edit`; inbox/service.ts `openItem`: If-Match, 404 for anything not open or not theirs to
 * review). The drafts themselves are reviewed as any draft (Accept, Edit, Discard, bulk accept).
 *
 * - places {indexes}: storage furniture the room's photos showed becomes places inside the target
 *   (places/service.ts `createPlace`, audited `place.create`), kind `closet`. Each proposal once.
 * - seen {thingIds}: things already in Kept are marked seen (`things.mark-seen`, audited
 *   `thing.seen`). Only things the card lists.
 * - done: the card is closed (`accepted`), and the full photos are deleted (audited
 *   `attachment.delete`), unless the location keeps room photos: then they stay on the place as
 *   ordinary photos, no longer under review, so viewers see them too. The drafts' own pictures
 *   are theirs and stay.
 * - discard: the card is closed (`discarded`) and the full photos are deleted, kept or not: the
 *   person asked for them to go.
 * - retry: a capture none of whose photos could be read (`failed`), or that waited for AI capture
 *   to be on (`off`), is read again: each photo gets a new attempt, the old one `superseded`.
 */
import type pg from 'pg';
import { z } from 'zod';
import { aiCaptureState, queueExtraction } from '../capture/service.js';
import { deleteAttachment } from '../files/attachments.js';
import { AppError, conflict, invalid, notFound } from '../http/errors.js';
import { type Ctx, openItem, resolveItem } from '../inbox/service.js';
import { createPlace } from '../places/service.js';
import { markSeen } from '../things/service.js';
import type { RoomResult } from './finish.js';

export const PlacesBody = z.strictObject({
  indexes: z.array(z.number().int().min(0)).min(1).max(60),
});
export const SeenBody = z.strictObject({ thingIds: z.array(z.uuid()).min(1).max(200) });

type Room = {
  id: string;
  location_id: string;
  place_id: string | null;
  container_id: string | null;
  status: string;
  attachment_ids: string[];
  result: RoomResult | null;
};

async function roomOf(ctx: Ctx, id: string, expected: number) {
  const item = await openItem(ctx.client, id, expected);
  if (item.kind !== 'room' || !item.room_capture_id) {
    throw conflict(`This action doesn't apply to a ${item.kind.replace('_', ' ')} item.`);
  }
  const { rows } = await ctx.client.query<Room>(
    `SELECT id, location_id, place_id, container_id, status, attachment_ids, result
       FROM public.room_captures WHERE id = $1 FOR UPDATE`,
    [item.room_capture_id],
  );
  const room = rows[0];
  if (!room) throw notFound();
  return { item, room };
}

async function saveResult(client: pg.ClientBase, id: string, result: RoomResult): Promise<void> {
  await client.query('UPDATE public.room_captures SET result = $2 WHERE id = $1', [
    id,
    JSON.stringify(result),
  ]);
}

/** Bumps the item's version, so the card's next action names the state it saw. */
async function touchItem(client: pg.ClientBase, id: string): Promise<void> {
  await client.query(`UPDATE public.inbox_items SET payload = payload WHERE id = $1`, [id]);
}

export async function addPlaces(
  ctx: Ctx,
  id: string,
  expected: number,
  body: z.infer<typeof PlacesBody>,
): Promise<string[]> {
  const { item, room } = await roomOf(ctx, id, expected);
  const result = room.result;
  if (!result || !room.place_id) throw conflict('There are no places to add here.');
  const made: string[] = [];
  for (const index of new Set(body.indexes)) {
    const p = result.places.find((x) => x.index === index);
    if (!p) throw invalid(`Check indexes: nothing was proposed as ${index}.`);
    if (p.placeId) continue;
    const place = await createPlace(ctx, room.location_id, {
      parentId: room.place_id,
      name: p.name.slice(0, 200),
      kindKey: 'closet',
    });
    p.placeId = place.id;
    made.push(place.id);
  }
  await saveResult(ctx.client, room.id, result);
  await touchItem(ctx.client, item.id);
  return made;
}

export async function markRoomSeen(
  ctx: Ctx,
  id: string,
  expected: number,
  body: z.infer<typeof SeenBody>,
): Promise<void> {
  const { item, room } = await roomOf(ctx, id, expected);
  const result = room.result;
  if (!result) throw conflict('Nothing to mark seen yet.');
  for (const thingId of new Set(body.thingIds.map((x) => x.toLowerCase()))) {
    const a = result.already.find((x) => x.thingId === thingId);
    if (!a) throw invalid(`Check thingIds: ${thingId} isn't on this card.`);
    await markSeen(ctx, thingId);
    a.seen = true;
  }
  await saveResult(ctx.client, room.id, result);
  await touchItem(ctx.client, item.id);
}

async function deletePhotos(ctx: Ctx, room: Room): Promise<void> {
  const { rows } = await ctx.client.query<{ id: string }>(
    'SELECT id FROM public.attachments WHERE id = ANY ($1::uuid[])',
    [room.attachment_ids],
  );
  for (const r of rows) {
    await deleteAttachment(ctx.tx, ctx.client, ctx.scope.userId, r.id, ctx.requestId);
  }
}

export async function closeRoom(
  ctx: Ctx,
  id: string,
  expected: number,
  how: 'done' | 'discard',
): Promise<{ photosKept: boolean }> {
  const { item, room } = await roomOf(ctx, id, expected);
  if (how === 'done' && (room.status === 'reading' || room.status === 'merging')) {
    throw conflict('Kept is still reading these photos.');
  }
  const { rows } = await ctx.client.query<{ keep: boolean }>(
    'SELECT keep_room_photos AS keep FROM public.locations WHERE id = $1',
    [room.location_id],
  );
  const keep = how === 'done' && rows[0]?.keep === true;
  if (keep) {
    await ctx.client.query(
      'UPDATE public.attachments SET in_review = false WHERE id = ANY ($1::uuid[]) AND in_review',
      [room.attachment_ids],
    );
  } else {
    await deletePhotos(ctx, room);
  }
  await resolveItem(ctx, item, how === 'done' ? 'accepted' : 'discarded');
  return { photosKept: keep };
}

export async function retryRoom(ctx: Ctx, id: string, expected: number): Promise<void> {
  const { item, room } = await roomOf(ctx, id, expected);
  if (room.status !== 'failed' && room.status !== 'off') {
    throw conflict('Only photos that could not be read are read again.');
  }
  const role = item.role;
  const ai = await aiCaptureState(ctx.tx, ctx.client, room.location_id, role);
  if (ai === 'off') {
    throw new AppError('conflict', 409, 'AI capture is off here.', { reason: 'ai_off' });
  }
  const { rows: last } = await ctx.client.query<{ attachment_id: string; attempt: number }>(
    `SELECT attachment_id, max(attempt)::int AS attempt FROM public.extractions
      WHERE attachment_id = ANY ($1::uuid[]) GROUP BY attachment_id`,
    [room.attachment_ids],
  );
  const { rows: present } = await ctx.client.query<{ id: string }>(
    'SELECT id FROM public.attachments WHERE id = ANY ($1::uuid[])',
    [room.attachment_ids],
  );
  if (present.length === 0) throw conflict('These photos are gone.');
  await ctx.client.query(
    `UPDATE public.extractions SET status = 'superseded'
      WHERE room_capture_id = $1 AND status IN ('failed', 'no_provider')`,
    [room.id],
  );
  for (const p of present) {
    const before = last.find((x) => x.attachment_id === p.id)?.attempt ?? 0;
    if (before >= 50) throw conflict('These photos have been read too many times.');
    await queueExtraction(
      ctx,
      {
        locationId: room.location_id,
        attachmentId: p.id,
        mode: 'room',
        roomCaptureId: room.id,
        attempt: before + 1,
      },
      ai,
    );
  }
  await ctx.client.query(
    `UPDATE public.room_captures SET status = 'reading', result = NULL WHERE id = $1`,
    [room.id],
  );
  await touchItem(ctx.client, item.id);
}
