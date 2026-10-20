/**
 * A `room` inbox item on the wire (#194): what the Room card shows above the capture's drafts.
 * The web contract is apps/web/src/api/capture/types.ts `InboxRoom`.
 *
 * - `status`: the room capture's (reading → merging → ready; failed; off). While reading,
 *   `progress` counts the photos that have ended; a photo waiting for the AI budget makes the
 *   card say so (`pausedUntil` and the cap's reason).
 * - `photos`: each photo's thumbnail and note (read, failed, off, missing) and its object count;
 *   `more` when it had more than one photo can list.
 * - `drafts`: how many drafts were made and how many still wait for review (they are the batch's
 *   own `draft` items, shown under the card).
 * - `places`: storage furniture proposed as places in the target; `placeId` once added.
 * - `already`: things already in Kept, with how they were matched and whether they were marked
 *   seen from the card; a code match starts ticked on the web.
 * - `keepPhotos`: the location keeps room photos after review (otherwise Done deletes them).
 */
import type pg from 'pg';
import { z } from 'zod';
import { thumbKeysOf, thumbUrlOf } from '../search/service.js';
import type { FileStorage } from '../storage/blob-store.js';
import type { RoomResult } from './finish.js';

export const RoomViewSchema = z.object({
  id: z.uuid(),
  status: z.enum(['reading', 'merging', 'ready', 'failed', 'off']),
  target: z.object({
    kind: z.enum(['place', 'container']),
    id: z.uuid(),
    name: z.string(),
  }),
  progress: z.object({ done: z.number(), total: z.number() }),
  pausedUntil: z.string().optional(),
  pausedReason: z.string().optional(),
  photos: z.array(
    z.object({
      attachmentId: z.uuid(),
      thumbUrl: z.string().nullable(),
      status: z.enum(['waiting', 'read', 'failed', 'off', 'missing']),
      objects: z.number(),
      more: z.boolean(),
    }),
  ),
  merged: z.enum(['model', 'names', 'none']).optional(),
  drafts: z.object({ made: z.number(), waiting: z.number(), failed: z.number() }),
  places: z.array(
    z.object({
      index: z.number(),
      name: z.string(),
      photo: z.number(),
      placeId: z.uuid().nullable(),
    }),
  ),
  already: z.array(
    z.object({
      thingId: z.uuid(),
      name: z.string(),
      matchedBy: z.enum(['code', 'brand_model', 'name_type']),
      seen: z.boolean(),
      thumbUrl: z.string().nullable(),
    }),
  ),
  keepPhotos: z.boolean(),
});
export type RoomView = z.infer<typeof RoomViewSchema>;

type Row = {
  id: string;
  status: RoomView['status'];
  place_id: string | null;
  container_id: string | null;
  target_name: string | null;
  attachment_ids: string[];
  result: RoomResult | null;
  keep_room_photos: boolean;
};

type PhotoRow = {
  room_capture_id: string;
  attachment_id: string;
  status: string;
  paused_until: Date | null;
  status_reason: string | null;
};

const ENDED = new Set(['succeeded', 'failed', 'no_provider', 'superseded']);

/** The Room cards of these room captures, by id. */
export async function roomViews(
  client: pg.ClientBase,
  files: FileStorage | null,
  ids: readonly string[],
): Promise<Map<string, RoomView>> {
  const out = new Map<string, RoomView>();
  if (ids.length === 0) return out;
  const { rows } = await client.query<Row>(
    `SELECT r.id, r.status, r.place_id, r.container_id, r.attachment_ids, r.result,
            l.keep_room_photos,
            coalesce((SELECT p.name FROM public.places p WHERE p.id = r.place_id),
                     (SELECT t.name FROM public.things t WHERE t.id = r.container_id))
              AS target_name
       FROM public.room_captures r JOIN public.locations l ON l.id = r.location_id
      WHERE r.id = ANY ($1::uuid[])`,
    [[...ids]],
  );
  const { rows: photos } = await client.query<PhotoRow>(
    `SELECT room_capture_id, attachment_id, status, paused_until, status_reason
       FROM public.extractions WHERE room_capture_id = ANY ($1::uuid[])
      ORDER BY created_at, id`,
    [[...ids]],
  );
  const { rows: files_ } = await client.query<{ id: string; file_id: string }>(
    `SELECT a.id, a.file_id FROM public.attachments a
      WHERE a.id = ANY ($1::uuid[]) AND a.file_id IS NOT NULL`,
    [rows.flatMap((r) => r.attachment_ids)],
  );
  const draftIds = rows.flatMap((r) => (r.result?.drafts ?? []).map((d) => d.thingId));
  const alreadyIds = rows.flatMap((r) => (r.result?.already ?? []).map((a) => a.thingId));
  const { rows: live } = await client.query<{ id: string; review_state: string }>(
    `SELECT id, review_state FROM public.things
      WHERE id = ANY ($1::uuid[]) AND deleted_at IS NULL`,
    [draftIds],
  );
  const { rows: covers } = await client.query<{ thing_id: string; file_id: string }>(
    `SELECT DISTINCT ON (a.thing_id) a.thing_id, a.file_id FROM public.attachments a
      WHERE a.thing_id = ANY ($1::uuid[]) AND a.role = 'photo' AND a.file_id IS NOT NULL
      ORDER BY a.thing_id, a.sort, a.created_at, a.id`,
    [alreadyIds],
  );
  const keys = await thumbKeysOf(client, [
    ...files_.map((f) => f.file_id),
    ...covers.map((c) => c.file_id),
  ]);
  const fileOf = new Map(files_.map((f) => [f.id, f.file_id]));
  const coverOf = new Map(covers.map((c) => [c.thing_id, c.file_id]));
  const stateOf = new Map(live.map((t) => [t.id, t.review_state]));

  for (const r of rows) {
    const mine = photos.filter((p) => p.room_capture_id === r.id);
    const notes = r.result?.photos ?? [];
    const paused = mine.find((p) => p.status === 'paused_budget');
    const list: RoomView['photos'] = [];
    for (const attachmentId of r.attachment_ids) {
      const note = notes.find((n) => n.attachmentId === attachmentId);
      const ex = mine.find((p) => p.attachment_id === attachmentId);
      const status: RoomView['photos'][number]['status'] = note
        ? note.status
        : !ex
          ? r.status === 'off'
            ? 'off'
            : 'missing'
          : ex.status === 'failed'
            ? 'failed'
            : ex.status === 'no_provider'
              ? 'off'
              : 'waiting';
      list.push({
        attachmentId,
        thumbUrl: await thumbUrlOf(files, keys, fileOf.get(attachmentId) ?? null),
        status,
        objects: note?.objects ?? 0,
        more: note?.more ?? false,
      });
    }
    const drafts = r.result?.drafts ?? [];
    const already: RoomView['already'] = [];
    for (const a of r.result?.already ?? []) {
      already.push({
        thingId: a.thingId,
        name: a.name,
        matchedBy: a.matchedBy,
        seen: a.seen,
        thumbUrl: await thumbUrlOf(files, keys, coverOf.get(a.thingId) ?? null),
      });
    }
    out.set(r.id, {
      id: r.id,
      status: r.status,
      target: r.container_id
        ? { kind: 'container', id: r.container_id, name: r.target_name ?? '' }
        : { kind: 'place', id: r.place_id as string, name: r.target_name ?? '' },
      progress: {
        done: mine.filter((p) => ENDED.has(p.status)).length,
        total: r.attachment_ids.length,
      },
      ...(paused?.paused_until instanceof Date && Number.isFinite(paused.paused_until.getTime())
        ? { pausedUntil: paused.paused_until.toISOString() }
        : {}),
      ...(paused?.status_reason ? { pausedReason: paused.status_reason } : {}),
      photos: list,
      ...(r.result ? { merged: r.result.merged } : {}),
      drafts: {
        made: drafts.length,
        waiting: drafts.filter((d) => stateOf.get(d.thingId) === 'draft').length,
        failed: r.result?.failed ?? 0,
      },
      places: (r.result?.places ?? []).map((p) => ({
        index: p.index,
        name: p.name,
        photo: p.photo,
        placeId: p.placeId,
      })),
      already,
      keepPhotos: r.keep_room_photos,
    });
  }
  return out;
}
