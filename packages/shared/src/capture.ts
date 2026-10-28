/**
 * Capture and inbox vocabulary (D34, D175, D191).
 * The database CHECKs (0027's `extractions.mode`, `inbox_items.kind` and `.resolution`), the
 * zod schemas and the web read these lists.
 */

/** The camera's mode strip, THING · RECEIPT · LABEL · READING · ROOM (ROOM: several photos of
 * one room, every object in them listed by AI). */
export const CAPTURE_MODES = ['thing', 'receipt', 'label', 'reading', 'room'] as const;
export type CaptureMode = (typeof CAPTURE_MODES)[number];

/** What the `extract` job reads (`extractions.mode`): the camera's modes, and a floor plan
 * (D266), which is read on the map, never from the strip. */
export const EXTRACTION_MODES = [...CAPTURE_MODES, 'plan'] as const;
export type ExtractionMode = (typeof EXTRACTION_MODES)[number];

export type PhotoPolicy =
  | { readonly keepOriginal: false; readonly shrinkTo: number }
  | { readonly keepOriginal: true; readonly displayTo: number };

/**
 * What the phone does with a captured photo (D34). THING photos are
 * shrunk on the phone and the original is not kept; the evidence modes keep the original
 * byte-identical (D117) and add a display derivative.
 */
export const PHOTO_POLICY: Readonly<Record<CaptureMode, PhotoPolicy>> = Object.freeze({
  thing: { shrinkTo: 2048, keepOriginal: false },
  receipt: { keepOriginal: true, displayTo: 2048 },
  label: { keepOriginal: true, displayTo: 2048 },
  reading: { keepOriginal: true, displayTo: 2048 },
  room: { shrinkTo: 2048, keepOriginal: false },
});

/** A room capture: at most this many photos, objects read from each photo, and Kept codes the
 * phone read in them. */
export const ROOM_LIMITS = Object.freeze({ photos: 5, objects: 60, codes: 60 });

/**
 * `room_captures.status`: `reading` while its photos are read, `merging` while the last one's job
 * merges them into drafts, `ready` with the result, `failed` when no photo could be read, `off`
 * when AI capture was off for it (the photos wait on the place).
 */
export const ROOM_CAPTURE_STATUSES = ['reading', 'merging', 'ready', 'failed', 'off'] as const;
export type RoomCaptureStatus = (typeof ROOM_CAPTURE_STATUSES)[number];

/** `inbox_items.kind`. */
export const INBOX_KINDS = [
  'draft',
  'reading',
  'label_claim',
  'currency',
  'duplicate',
  'receipt',
  'sync_drop',
  'room',
] as const;
export type InboxKind = (typeof INBOX_KINDS)[number];

/** `inbox_items.resolution`: how an item left the inbox. */
export const INBOX_RESOLUTIONS = [
  'accepted',
  'edited',
  'discarded',
  'merged',
  'linked',
  'restored',
  'dismissed',
] as const;
export type InboxResolution = (typeof INBOX_RESOLUTIONS)[number];

/**
 * The inbox's fixed keyboard map (D175). Keys are
 * written the way the web's key handler compares them: lower case, `shift+` for the modifier.
 */
export const INBOX_KEYMAP = Object.freeze({
  j: 'next',
  k: 'previous',
  a: 'accept',
  e: 'edit',
  m: 'move',
  t: 'set_type',
  x: 'select',
  'shift+a': 'accept_selected',
  l: 'link_receipt_line',
  s: 'split',
  g: 'merge',
  d: 'drop',
  y: 'confirm_field',
  n: 'reject_field',
} as const);
export type InboxKey = keyof typeof INBOX_KEYMAP;
export type InboxAction = (typeof INBOX_KEYMAP)[InboxKey];
