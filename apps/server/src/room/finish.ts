/**
 * Finishing a room capture (#194), once every photo's extraction has ended. The job of the photo
 * that ends last runs it, as the capturing person:
 *
 * 1. **Claim** (one short transaction): the row, locked; still `reading` (or `merging` left behind
 *    by a crashed worker for STALE_MINUTES) and no photo still queued, running or paused → it
 *    becomes `merging` and is committed. Otherwise nothing happens: a later photo finishes it.
 * 2. **Objects**: every read photo's checked objects (objects.ts), numbered by photo. No photo read
 *    → `failed` (or `off` when AI capture was off for all of them).
 * 3. **Merge** (merge.ts): the call, or the names when it can't be had.
 * 4. **Already in Kept** (match.ts): left out of the drafts, listed on the card.
 * 5. **Drafts**: each new item or furniture becomes a draft thing in the target, in the capture's
 *    batch, with its own picture cut from the photo it was seen best in (the image the model saw,
 *    so the box fits), its name, brand, model, colour and type filled in as THING fills them
 *    (`extracted`, confirmed on Accept), its aliases, a quantity above 1 and an Arabic alias as
 *    suggestions, and the duplicate check. Each draft is its own transaction: one that fails is
 *    logged and counted, never the end of the others. Storage furniture in a place is proposed as
 *    places instead (review.ts adds them on the card).
 * 6. **Result**: `ready` with what was made, and the card reads it.
 */
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { aliasSuggestionField, newId } from '@kept/shared';
import type pg from 'pg';
import sharp from 'sharp';
import type { ImageInput } from '../ai/call.js';
import { attachFiles } from '../capture/service.js';
import { cropBox } from '../capture/split.js';
import { type Scope, withScope } from '../db/scope.js';
import { matchType, upsertInbox } from '../extraction/apply.js';
import { openDuplicate } from '../extraction/duplicates.js';
import { partsFor, type SourceFile } from '../extraction/image.js';
import type { ExtractionJobDeps } from '../extraction/job.js';
import { ingestFile } from '../files/ingest.js';
import { ImageLimiter } from '../storage/derivatives.js';
import { insertThing } from '../things/service.js';
import { type Already, candidatesOf, sortOut } from './match.js';
import { type Merged, mergeObjects } from './merge.js';
import type { Box, PhotoRead, RoomObject } from './objects.js';

/** A `merging` row untouched this long was left by a worker that stopped. */
export const STALE_MINUTES = 5;

const LIVE = ['queued', 'running', 'paused_budget', 'waiting_provider'];

export type PhotoNote = {
  attachmentId: string;
  status: 'read' | 'failed' | 'off' | 'missing';
  reason?: string;
  objects: number;
  more: boolean;
};

export type RoomResult = {
  merged: 'model' | 'names' | 'none';
  photos: PhotoNote[];
  drafts: { thingId: string; name: string; kind: 'item' | 'furniture'; photo: number }[];
  /** Storage furniture in a place, proposed as places in it; `placeId` once added. */
  places: {
    index: number;
    name: string;
    aliases: Record<string, string[]>;
    photo: number;
    bbox: Box;
    placeId: string | null;
  }[];
  /** Things already in Kept; `seen` once marked seen from the card. */
  already: (Already & { seen: boolean })[];
  /** Objects that couldn't become drafts (logged). */
  failed: number;
};

type RoomRow = {
  id: string;
  location_id: string;
  place_id: string | null;
  container_id: string | null;
  batch_id: string;
  status: string;
  codes: string[];
  attachment_ids: string[];
  stale: boolean;
};

type PhotoRow = {
  id: string;
  attachment_id: string;
  status: string;
  status_reason: string | null;
  result: { objects?: PhotoRead['objects']; more?: boolean } | null;
};

export type FinishDeps = Pick<ExtractionJobDeps, 'pools' | 'ai' | 'files' | 'log'>;

export type FinishOutcome = 'missing' | 'waiting' | 'busy' | 'done' | 'finished';

async function writeResult(
  client: pg.ClientBase,
  id: string,
  status: 'ready' | 'failed' | 'off',
  result: RoomResult,
): Promise<void> {
  await client.query('UPDATE public.room_captures SET status = $2, result = $3 WHERE id = $1', [
    id,
    status,
    JSON.stringify(result),
  ]);
}

export async function finishRoom(
  deps: FinishDeps,
  scope: Scope,
  roomId: string,
  job?: { id: string },
): Promise<FinishOutcome> {
  // 1. Claim.
  const claimed = await withScope(deps.pools.app, scope, async (_tx, client) => {
    const { rows } = await client.query<RoomRow>(
      `SELECT id, location_id, place_id, container_id, batch_id, status, codes, attachment_ids,
              updated_at < now() - make_interval(mins => $2) AS stale
         FROM public.room_captures WHERE id = $1 FOR UPDATE`,
      [roomId, STALE_MINUTES],
    );
    const room = rows[0];
    if (!room) return 'missing' as const;
    if (room.status === 'merging' && !room.stale) return 'busy' as const;
    if (room.status !== 'reading' && room.status !== 'merging') return 'done' as const;
    const { rows: photos } = await client.query<PhotoRow>(
      `SELECT id, attachment_id, status, status_reason, result FROM public.extractions
        WHERE room_capture_id = $1 AND status <> 'superseded' ORDER BY created_at, id`,
      [roomId],
    );
    if (photos.some((p) => LIVE.includes(p.status))) return 'waiting' as const;
    await client.query(`UPDATE public.room_captures SET status = 'merging' WHERE id = $1`, [
      roomId,
    ]);
    return { room, photos };
  });
  if (typeof claimed === 'string') return claimed;
  const { room, photos } = claimed;

  // 2. Objects, photo by photo in the order taken.
  const notes: PhotoNote[] = [];
  const objects: RoomObject[] = [];
  room.attachment_ids.forEach((attachmentId, photo) => {
    const ex = photos.find((p) => p.attachment_id === attachmentId);
    if (!ex) {
      notes.push({ attachmentId, status: 'missing', objects: 0, more: false });
      return;
    }
    if (ex.status !== 'succeeded') {
      notes.push({
        attachmentId,
        status: ex.status === 'no_provider' ? 'off' : 'failed',
        ...(ex.status_reason ? { reason: ex.status_reason } : {}),
        objects: 0,
        more: false,
      });
      return;
    }
    const read = ex.result?.objects ?? [];
    for (const o of read) objects.push({ ...o, photo });
    notes.push({
      attachmentId,
      status: 'read',
      objects: read.length,
      more: ex.result?.more === true,
    });
  });
  const empty: RoomResult = {
    merged: 'none',
    photos: notes,
    drafts: [],
    places: [],
    already: [],
    failed: 0,
  };
  if (!notes.some((n) => n.status === 'read')) {
    const off = notes.length > 0 && notes.every((n) => n.status === 'off');
    await withScope(deps.pools.app, scope, (_tx, client) =>
      writeResult(client, room.id, off ? 'off' : 'failed', empty),
    );
    return 'finished';
  }

  // 3. Merge.
  const requestId = `room:${room.id}`;
  const merge = deps.ai
    ? await mergeObjects(await deps.ai.runtime(scope), objects, room.attachment_ids.length, {
        locationId: room.location_id,
        userId: scope.userId,
        requestId,
        jobId: job?.id ?? requestId,
      })
    : await mergeObjects(nullRuntime, objects, room.attachment_ids.length, {
        locationId: room.location_id,
        userId: scope.userId,
        requestId,
        jobId: requestId,
      });

  // 4. Already in Kept.
  const target = {
    locationId: room.location_id,
    placeId: room.place_id,
    containerId: room.container_id,
  };
  const { fresh, already } = await withScope(deps.pools.app, scope, async (_tx, client) =>
    sortOut(merge.merged, await candidatesOf(client, target, room.codes)),
  );

  // 5. Drafts and proposed places.
  const result: RoomResult = {
    ...empty,
    merged: merge.by,
    already: already.map((a) => ({ ...a, seen: false })),
  };
  const drafted = fresh.filter((o) => !(o.kind === 'storage' && room.place_id));
  fresh.forEach((o, index) => {
    if (o.kind === 'storage' && room.place_id) {
      result.places.push({
        index,
        name: o.fields.name?.value ?? '',
        aliases: o.fields.aliases,
        photo: o.photo,
        bbox: o.bbox,
        placeId: null,
      });
    }
  });
  if (drafted.length > 0) {
    const images = await photoImages(deps, scope, room);
    const files = deps.files;
    if (files) {
      const limiter = new ImageLimiter(Math.max(1, files.imageConcurrency));
      await mkdir(files.tmpDir, { recursive: true });
      const dir = await mkdtemp(path.join(files.tmpDir, 'room-'));
      try {
        for (const o of drafted) {
          const photoEx = photos.find((p) => p.attachment_id === room.attachment_ids[o.photo]);
          try {
            const id = await makeDraft(
              { ...deps, files, limiter, dir },
              scope,
              room,
              o,
              images.get(o.photo) ?? null,
              photoEx?.id ?? null,
            );
            if (id) {
              result.drafts.push({
                thingId: id,
                name: o.fields.name?.value ?? '',
                kind: o.kind === 'item' ? 'item' : 'furniture',
                photo: o.photo,
              });
            } else result.failed++;
          } catch (err) {
            result.failed++;
            deps.log.error(
              { err, roomCaptureId: room.id },
              'a room object could not become a draft',
            );
          }
        }
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    } else result.failed += drafted.length;
  }

  // 6. Result.
  await withScope(deps.pools.app, scope, (_tx, client) =>
    writeResult(client, room.id, 'ready', result),
  );
  return 'finished';
}

/** A runtime that resolves no provider: the merge falls back to names. */
const nullRuntime = {
  keys: { resolve: async () => null },
} as unknown as Parameters<typeof mergeObjects>[0];

/** The image each read photo was sent as (its display derivative), by photo index. */
async function photoImages(
  deps: FinishDeps,
  scope: Scope,
  room: RoomRow,
): Promise<Map<number, ImageInput>> {
  const out = new Map<number, ImageInput>();
  const files = deps.files;
  if (!files) return out;
  const sources = await withScope(deps.pools.app, scope, async (_tx, client) => {
    const { rows } = await client.query<{
      attachment_id: string;
      file_id: string;
      location_id: string;
      mime: string;
    }>(
      `SELECT a.id AS attachment_id, f.id AS file_id, f.location_id, f.mime
         FROM public.attachments a JOIN public.files f ON f.id = a.file_id
        WHERE a.id = ANY ($1::uuid[])`,
      [room.attachment_ids],
    );
    return rows;
  });
  for (const [photo, attachmentId] of room.attachment_ids.entries()) {
    const s = sources.find((x) => x.attachment_id === attachmentId);
    if (!s) continue;
    const source: SourceFile = {
      attachmentId,
      fileId: s.file_id,
      locationId: s.location_id,
      mime: s.mime,
    };
    const parts = await partsFor('room', [source], {
      blobs: files.blobs,
      textOf: async () => null,
    });
    const img = parts.images[0];
    if (img) out.set(photo, img);
  }
  return out;
}

type DraftDeps = FinishDeps & {
  files: NonNullable<FinishDeps['files']>;
  limiter: ImageLimiter;
  dir: string;
};

/** One draft from one merged object; its id, or null when its picture couldn't be cut. */
async function makeDraft(
  deps: DraftDeps,
  scope: Scope,
  room: RoomRow,
  o: Merged,
  image: ImageInput | null,
  extractionId: string | null,
): Promise<string | null> {
  const name = o.fields.name?.value;
  if (!name) return null;
  const box = image ? cropBox(o.bbox, image.width, image.height) : null;
  let fileId: string | null = null;
  if (image && box) {
    const bytes = await sharp(image.bytes).extract(box).jpeg({ quality: 85 }).toBuffer();
    const tmp = path.join(deps.dir, `${newId()}.jpg`);
    await writeFile(tmp, bytes);
    const upload = await ingestFile(
      { pools: deps.pools, files: deps.files, limiter: deps.limiter, log: deps.log },
      scope,
      {
        file: tmp,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        bytes: bytes.length,
        fileId: newId(),
        locationId: room.location_id,
        class: 'photo',
      },
      { requestId: null },
    );
    fileId = upload.body.id;
  }
  return withScope(deps.pools.app, scope, async (tx, client) => {
    const f = o.fields;
    const status = (v: { confidence: number } | undefined) =>
      v
        ? {
            state: 'extracted',
            confidence: v.confidence,
            ...(extractionId ? { extraction_id: extractionId } : {}),
          }
        : null;
    const { rows: acct } = await client.query<{ owner_account_id: string }>(
      'SELECT owner_account_id FROM public.locations WHERE id = $1',
      [room.location_id],
    );
    const typeId =
      f.typeHint && acct[0]
        ? await matchType(client, acct[0].owner_account_id, f.typeHint.value)
        : null;
    const brandId = f.brand
      ? ((
          await client.query<{ id: string }>('SELECT kept.ai_ensure_brand($1, $2) AS id', [
            room.location_id,
            f.brand.value,
          ])
        ).rows[0]?.id ?? null)
      : null;
    const fieldStatus: Record<string, unknown> = {};
    for (const [key, v] of [
      ['name', f.name],
      ['brand', brandId ? f.brand : undefined],
      ['model', f.model],
      ['colour', f.colour],
      ['type', typeId ? f.typeHint : undefined],
      ['aliases', Object.keys(f.aliases).length > 0 ? f.name : undefined],
    ] as const) {
      const st = status(v);
      if (st) fieldStatus[key] = st;
    }
    const thingId = await insertThing(
      {
        tx,
        client,
        scope,
        requestId: `room-${room.id}`.slice(0, 64),
        jobs: null,
        files: deps.files,
      },
      {
        id: newId(),
        locationId: room.location_id,
        ...(room.container_id
          ? { containerId: room.container_id }
          : { placeId: room.place_id as string }),
        name,
        ...(typeId ? { typeId } : {}),
        ...(brandId ? { brandId } : {}),
        ...(f.model ? { model: f.model.value } : {}),
        ...(f.colour ? { colour: f.colour.value } : {}),
        ...(Object.keys(f.aliases).length > 0 ? { aliases: f.aliases } : {}),
      },
      {
        draft: true,
        captureBatchId: room.batch_id,
        fieldStatus,
        idChecked: true,
        audit: {
          action: 'thing.capture',
          after: { mode: 'room', batch_id: room.batch_id, room_capture_id: room.id },
        },
      },
    );
    const attachmentIds = fileId
      ? await attachFiles(client, room.location_id, { thingId }, 'photo', [fileId])
      : [];
    const source = {
      extractionId: extractionId ?? room.id,
      attachmentId: attachmentIds[0] ?? room.attachment_ids[o.photo] ?? room.id,
    };
    const suggestions = [
      ...(f.quantity && f.quantity.value > 1
        ? [
            {
              field: 'quantity',
              value: String(f.quantity.value),
              confidence: f.quantity.confidence,
              source,
            },
          ]
        : []),
      ...(f.aliasSuggestions ?? []).map((a) => ({
        field: aliasSuggestionField(a.lang),
        value: a.value,
        confidence: a.confidence,
        source,
      })),
    ];
    await upsertInbox(client, {
      locationId: room.location_id,
      kind: 'draft',
      thingId,
      extractionId: null,
      batchId: room.batch_id,
      payload: { suggestions, roomCaptureId: room.id },
    });
    await openDuplicate(
      client,
      { id: thingId, locationId: room.location_id, batchId: room.batch_id },
      null,
      null,
    );
    return thingId;
  });
}
