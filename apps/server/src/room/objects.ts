/**
 * A room photo's answer, checked (#194): each object as THING's code checks see one object
 * (extraction/checks.ts `checkThing`: confidence, placeholders, column limits, aliases in the
 * location's languages and scripts), with its box, its kind and the photo it is in. An object
 * whose name didn't survive the checks is left out: nothing could be drafted from it.
 */
import { ROOM_LIMITS, type RoomExtraction, type RoomObjectKind } from '@kept/shared';
import { type CheckContext, checkThing, type ThingFields } from '../extraction/checks.js';

export type Box = [number, number, number, number];

/** One object read in one photo. `photo` indexes the capture's photos, in the order taken. */
export type RoomObject = { photo: number; bbox: Box; kind: RoomObjectKind; fields: ThingFields };

/** What a photo's extraction stores as its `result.objects`. */
export type PhotoRead = { objects: Omit<RoomObject, 'photo'>[]; more: boolean; skipped: number };

/** `dropped` is what the lenient parse removed: a list cut at the cap removes `objects.60` on. */
export function checkRoom(
  value: RoomExtraction,
  ctx: CheckContext,
  dropped: readonly string[] = [],
): PhotoRead {
  const out: PhotoRead['objects'] = [];
  let skipped = 0;
  for (const o of value.objects.slice(0, ROOM_LIMITS.objects)) {
    const checked = checkThing({ objects: [o] }, ctx);
    if (!checked.fields.name) {
      skipped++;
      continue;
    }
    out.push({ bbox: o.bbox as Box, kind: o.kind, fields: checked.fields });
  }
  return {
    objects: out,
    more:
      value.more === true ||
      value.objects.length > ROOM_LIMITS.objects ||
      dropped.some((p) => Number(/^objects\.(\d+)$/.exec(p)?.[1] ?? -1) >= ROOM_LIMITS.objects),
    skipped,
  };
}
