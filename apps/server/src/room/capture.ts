/**
 * A Room capture (#194): 1–5 photos of a room, a cupboard or a shelf, into a place or a container.
 *
 * - The photos become the target's own `photo` attachments, in the order taken, listed on a new
 *   `room_captures` row whose id is the capture's. They stay there while the room is reviewed,
 *   under review (`attachments.in_review`): only the location's members and up see them, and
 *   none is a cover. Closing the Room card deletes them unless the location keeps room photos;
 *   then they become ordinary photos (review.ts).
 * - With AI capture on (or waiting for a provider), each photo gets its own `room` extraction
 *   (extraction/job.ts reads it); the last one to finish merges them (finish.ts). With it off, the
 *   row is `off`: the photos wait on the place and the card says why.
 * - One `room` inbox item opens in the capture's batch, so the drafts made later sit under it.
 * - Kept codes the phone read in the photos are kept on the row (upper case, once each).
 * - Audited `room.capture` on the target.
 */
import { ROOM_LIMITS } from '@kept/shared';
import { audited } from '../audit/audited.js';
import {
  attachFiles,
  type CaptureInput,
  type CaptureResult,
  type Common,
  openInboxItem,
  queueExtraction,
} from '../capture/service.js';
import { invalid } from '../http/errors.js';
import type { Ctx } from '../things/service.js';

/** The checks that need no database: how many photos, and a real target. */
export function checkRoomInput(input: CaptureInput, files: number): void {
  if (files < 1) throw invalid('A room capture needs a photo.');
  if (files > ROOM_LIMITS.photos) {
    throw invalid(`A room capture takes at most ${ROOM_LIMITS.photos} photos.`);
  }
  if ('unplaced' in input.target) {
    throw invalid('Choose the room or the box these photos are of.');
  }
  if (input.attachToThingId || input.pageOf || input.name || input.templateId) {
    throw invalid('A room capture is its photos and where they were taken.');
  }
}

export async function captureRoom(
  ctx: Ctx,
  input: CaptureInput,
  c: Common & { target: { placeId: string | null; containerId: string | null } },
): Promise<CaptureResult> {
  const { client, tx, scope } = ctx;
  if (c.target.placeId) {
    const { rows } = await client.query<{ is_unplaced: boolean }>(
      'SELECT is_unplaced FROM public.places WHERE id = $1',
      [c.target.placeId],
    );
    if (rows[0]?.is_unplaced) throw invalid('Choose the room or the box these photos are of.');
  }
  const codes = [...new Set((input.codes ?? []).map((code) => code.toUpperCase()))];
  const subject = c.target.containerId
    ? { thingId: c.target.containerId }
    : { placeId: c.target.placeId as string };
  const photos = await attachFiles(client, c.locationId, subject, 'photo', c.fileIds, {
    inReview: true,
  });
  const status = c.ai === 'off' ? 'off' : 'reading';
  await client.query(
    `INSERT INTO public.room_captures (id, location_id, place_id, container_id, batch_id, status,
                                       codes, attachment_ids, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, kept.current_user_id())`,
    [
      c.id,
      c.locationId,
      c.target.containerId ? null : c.target.placeId,
      c.target.containerId,
      c.batchId,
      status,
      codes,
      photos,
    ],
  );
  await audited(tx, {
    locationId: c.locationId,
    actor: { type: 'user', id: scope.userId },
    action: 'room.capture',
    entity: c.target.containerId
      ? { type: 'thing', id: c.target.containerId }
      : { type: 'place', id: c.target.placeId },
    after: { ...c.base, capture_id: c.id, attachment_ids: photos, codes },
    ...(c.target.containerId
      ? { rootThingId: c.target.containerId, subjects: [c.target.containerId] }
      : {}),
    requestId: ctx.requestId,
  });
  const result: CaptureResult = { room: { id: c.id, photos: photos.length, status } };
  if (c.ai !== 'off') {
    for (const attachmentId of photos) {
      const queued = await queueExtraction(
        ctx,
        { locationId: c.locationId, attachmentId, mode: 'room', roomCaptureId: c.id },
        c.ai,
      );
      result.extraction ??= queued;
    }
  }
  const item = await openInboxItem(client, {
    locationId: c.locationId,
    kind: 'room',
    roomCaptureId: c.id,
    batchId: c.batchId,
  });
  if (item) result.inboxItemId = item;
  return result;
}
