/**
 * The same object seen in two photos of one room is one draft (#194). A short text-only call
 * (`extract_room_merge`) names the groups; when it can't be had (failed, paused, no provider),
 * objects with the same name and type in different photos are merged instead. Either way the
 * groups are checked here: indexes in range, each object in one group, never two objects of
 * the same photo together (two identical chairs in one photo are two chairs, or a quantity).
 */
import { normalize, parseLenient, ROOM_MERGE_MAX_OUTPUT, RoomMerge } from '@kept/shared';
import type { AiRuntime } from '../ai/call.js';
import { callModel } from '../ai/call.js';
import { EXTRACTION_TASK } from '../ai/extract.js';
import { ROOM_MERGE_NAME, roomMergeWire } from '../ai/wire.js';
import { type MergeLine, mergePrompt } from '../extraction/prompts/room.js';
import type { RoomObject } from './objects.js';

/** A merged object: the one with the largest box stands for it (its crop is the clearest), and
 * `photos` lists every photo it was seen in. */
export type Merged = RoomObject & { photos: number[] };

const area = (o: RoomObject) => o.bbox[2] * o.bbox[3];

/** The objects merged by `groups`; everything outside a valid group stands alone, in order. */
export function applyGroups(objects: readonly RoomObject[], groups: readonly number[][]): Merged[] {
  const groupOf = new Map<number, number[]>();
  for (const g of groups) {
    const members = [...new Set(g)].filter((i) => i >= 0 && i < objects.length);
    if (members.length < 2 || members.some((i) => groupOf.has(i))) continue;
    const photos = members.map((i) => (objects[i] as RoomObject).photo);
    if (new Set(photos).size !== photos.length) continue;
    for (const i of members) groupOf.set(i, members);
  }
  const out: Merged[] = [];
  const done = new Set<number>();
  objects.forEach((_, i) => {
    if (done.has(i)) return;
    const members = groupOf.get(i) ?? [i];
    for (const m of members) done.add(m);
    const all = members.map((m) => objects[m] as RoomObject);
    const best = all.reduce((a, b) => (area(b) > area(a) ? b : a));
    const quantity = all.reduce<number>((n, x) => Math.max(n, x.fields.quantity?.value ?? 1), 1);
    out.push({
      ...best,
      fields:
        quantity > 1 && !best.fields.quantity
          ? { ...best.fields, quantity: { value: quantity, confidence: 0.6 } }
          : best.fields,
      photos: [...new Set(all.map((x) => x.photo))].sort((a, b) => a - b),
    });
  });
  return out;
}

const keyOf = (o: RoomObject) =>
  `${normalize(o.fields.name?.value ?? '')}|${normalize(o.fields.typeHint?.value ?? '')}`;

/** Groups by the same normalised name and type, across photos only. */
export function groupsByNames(objects: readonly RoomObject[]): number[][] {
  const groups: number[][] = [];
  objects.forEach((o, i) => {
    const key = keyOf(o);
    const g = groups.find(
      (x) =>
        keyOf(objects[x[0] as number] as RoomObject) === key &&
        !x.some((j) => (objects[j] as RoomObject).photo === o.photo),
    );
    if (g) g.push(i);
    else groups.push([i]);
  });
  return groups.filter((g) => g.length > 1);
}

export type MergeOutcome = { merged: Merged[]; by: 'model' | 'names' | 'none'; callId?: string };

/** The merge for a room capture's objects: the call when it can be had, else names. */
export async function mergeObjects(
  rt: AiRuntime,
  objects: readonly RoomObject[],
  photos: number,
  req: { locationId: string; userId: string; requestId: string; jobId: string },
): Promise<MergeOutcome> {
  const seen = new Set(objects.map((o) => o.photo));
  if (seen.size < 2) return { merged: applyGroups(objects, []), by: 'none' };
  const lines: MergeLine[] = objects.map((o, index) => ({
    index,
    photo: o.photo,
    name: o.fields.name?.value ?? '',
    ...(o.fields.typeHint ? { type: o.fields.typeHint.value } : {}),
    ...(o.fields.brand ? { brand: o.fields.brand.value } : {}),
    ...(o.fields.model ? { model: o.fields.model.value } : {}),
    ...(o.fields.colour ? { colour: o.fields.colour.value } : {}),
  }));
  try {
    const resolved = await rt.keys.resolve({
      locationId: req.locationId,
      userId: req.userId,
      task: EXTRACTION_TASK,
    });
    if (resolved) {
      const prompt = mergePrompt(lines, photos);
      const result = await callModel<{ groups: number[][] }>(rt, {
        resolved,
        task: 'extract_room_merge',
        locationId: req.locationId,
        userId: req.userId,
        links: {},
        instructions: prompt.system,
        text: prompt.text,
        images: [],
        output: {
          name: ROOM_MERGE_NAME,
          schema: roomMergeWire(),
          parse: (raw) => parseLenient(RoomMerge, raw)?.value ?? null,
        },
        maxOutputTokens: ROOM_MERGE_MAX_OUTPUT,
        expectedOutputTokens: Math.min(ROOM_MERGE_MAX_OUTPUT, 40 + objects.length * 4),
        promptVersion: prompt.version,
        requestId: req.requestId.slice(0, 64),
        attempt: 1,
        jobId: req.jobId,
      });
      if (result.status === 'ok') {
        return {
          merged: applyGroups(objects, result.value.groups),
          by: 'model',
          callId: result.callId,
        };
      }
    }
  } catch {
    // The names below are the merge then.
  }
  return { merged: applyGroups(objects, groupsByNames(objects)), by: 'names' };
}
