/**
 * Extraction output per capture mode (D19, D20, D41, D55, D128).
 * The model returns JSON only. Every field carries a
 * confidence from 0 to 1. The model never returns IDs or URLs, so free text that looks
 * like either fails its field. What fails is dropped one field at a time (`parseLenient`),
 * never the whole answer.
 *
 * Field names are the model's (snake_case), not the API's: the extraction job maps
 * them onto thing and purchase fields (`type_hint` → type, `date` → purchased_on, …).
 */

import { z } from 'zod';
import type { ReasoningLevel } from './ai.js';
import type { ExtractionMode } from './capture.js';
import { SERVICE_LINE_KINDS } from './household.js';

/** `extractions.status` (`waiting_provider` is D206's: the provider's rate limit, an open
 * breaker or a rejected key, never a budget). The database CHECK reads this list (0037). */
export const EXTRACTION_STATUSES = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'paused_budget',
  'waiting_provider',
  'no_provider',
  'superseded',
] as const;
export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number];

/** `Conf<T>`: a value and how sure the model is of it. */
export function conf<T extends z.ZodType>(value: T) {
  return z.object({ value, confidence: z.number().min(0).max(1) });
}
export type Conf<T> = { value: T; confidence: number };

const URL_OR_ID = /(?:[a-z][a-z0-9+.-]*:\/\/|www\.)|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i;
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((s) => !URL_OR_ID.test(s), 'no URLs or ids (L51)');
const unit = z.number().min(0).max(1);
/** `[x, y, w, h]`, each 0–1, relative to the photo. */
const bbox = z.tuple([unit, unit, unit, unit]);
const isoDate = z.iso.date();
const amount = z.number().min(0).max(1e12);
const count = z.number().positive().max(1e6);
const languageCode = z.string().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/);

export const ThingObject = z.object({
  bbox: bbox.optional(),
  name: conf(text(200)),
  brand: conf(text(120)).optional(),
  model: conf(text(120)).optional(),
  colour: conf(text(60)).optional(),
  type_hint: conf(text(80)).optional(),
  quantity: conf(count).optional(),
  serial: conf(text(120)).optional(),
  /** In each of the location's languages (D41). */
  aliases: z.record(languageCode, z.array(text(80)).max(12)),
  /** 1.x (#209): tags from the household's own list that fit; Kept keeps only those that exist. */
  tags: z.array(text(60)).max(5).optional(),
});

/** THING: one object in 1.0; many objects is 1.x (D20). */
export const ThingExtraction = z.object({ objects: z.array(ThingObject).max(1) });

/** 1.4 (D20, D230): at most this many things found in one THING photo. */
export const MULTI_ITEM_MAX = 12;
/** THING when the instance finds several things in a photo (D230): each with its box. */
export const ThingManyExtraction = z.object({
  objects: z.array(ThingObject.extend({ bbox })).max(MULTI_ITEM_MAX),
});
export type ThingManyExtraction = z.infer<typeof ThingManyExtraction>;

/** Every object a person would keep track of in a room photo: what it is to the room. `storage`
 * is furniture that holds things (a shelf, a cabinet, a wardrobe, a chest of drawers), which
 * becomes a place in the room; `furniture` is any other (a sofa, a bed, a table). */
export const ROOM_OBJECT_KINDS = ['item', 'furniture', 'storage'] as const;
export type RoomObjectKind = (typeof ROOM_OBJECT_KINDS)[number];

export const RoomObject = ThingObject.extend({ bbox, kind: z.enum(ROOM_OBJECT_KINDS) });

/** ROOM: every object in one photo of a room, each with its box (at most ROOM_LIMITS.objects). */
export const RoomExtraction = z.object({
  objects: z.array(RoomObject).max(60),
  /** The photo had more objects than the list could hold. */
  more: z.boolean().optional(),
});
export type RoomExtraction = z.output<typeof RoomExtraction>;

/** The merge across a room capture's photos: groups of object indexes that are the same object. */
export const RoomMerge = z.object({
  groups: z.array(z.array(z.number().int().min(0).max(299)).min(1).max(5)).max(300),
});
export type RoomMerge = z.output<typeof RoomMerge>;

/** The merge call's JSON allowance. */
export const ROOM_MERGE_MAX_OUTPUT = 1500;

const ReceiptLine = z.object({
  description: conf(text(300)),
  quantity: conf(count).optional(),
  unit_price: conf(amount).optional(),
  line_total: conf(amount).optional(),
});

export const ReceiptExtraction = z.object({
  vendor: z
    .object({
      name: conf(text(200)),
      phone: text(40).optional(),
      address: text(300).optional(),
    })
    .optional(),
  date: conf(isoDate).optional(),
  /** What was printed (`$`, `E£`, `EUR`…); `mapCurrencyMark` turns it into a code (D189). */
  currency: conf(text(12)).optional(),
  total: conf(amount).optional(),
  tax: conf(amount).optional(),
  lines: z.array(ReceiptLine).max(200),
  /** Only when printed on the receipt (D55). */
  warranty_terms_printed: conf(text(2000)).optional(),
  /** Where the paper is in the photo, so the server can re-crop the display (D196). */
  document_bbox: bbox.optional(),
});

/**
 * A service invoice: RECEIPT's fields, and each line's optional kind (step 4's
 * `service_lines.kind`). Not a capture mode: the RECEIPT path runs it on a draft service record
 * with the `service-invoice` prompt, and its output only ever becomes suggestions. Its JSON
 * allowance is RECEIPT's (`MAX_OUTPUT_TOKENS.receipt`). A kind outside the list is dropped alone
 * (`parseLenient`); the line stays.
 */
export const ServiceInvoiceExtraction = ReceiptExtraction.extend({
  lines: z
    .array(ReceiptLine.extend({ kind: conf(z.enum(SERVICE_LINE_KINDS)).optional() }))
    .max(200),
});

export const LabelExtraction = z.object({
  brand: conf(text(120)).optional(),
  model: conf(text(120)).optional(),
  serial: conf(text(120)).optional(),
  vin: conf(text(32)).optional(),
  plate: conf(text(32)).optional(),
  document_kind: conf(
    z.enum(['registration', 'insurance', 'licence', 'inspection', 'other']),
  ).optional(),
  expires_on: conf(isoDate).optional(),
  manufactured_on: conf(isoDate).optional(),
});

export const ReadingExtraction = z.object({
  value: conf(z.number().min(0).max(1e9)),
  unit: conf(z.enum(['km', 'mi', 'h'])).optional(),
  display: z.enum(['digital', 'analog']).optional(),
});

/** A plan room's kind: map.ts's MAP_ROOM_KINDS, written out here so the capture code's chunk
 * never pulls in the map's (floor-plan.test.ts checks they agree). */
export const PLAN_ROOM_KINDS = ['room', 'balcony', 'terrace', 'garden'] as const;

/** A floor plan (D266): at most this many floors, rooms, doors and corners a room. */
export const PLAN_LIMITS = Object.freeze({ floors: 6, rooms: 60, doors: 40, corners: 12 });

const point = z.tuple([unit, unit]);
/** A box with some size, inside the image. */
const planBox = bbox.refine(
  ([x, y, w, h]) => w > 0 && h > 0 && x + w <= 1.0001 && y + h <= 1.0001,
  'a box inside the image',
);

/** One room as the model reads it off a plan: it transcribes, never computes (spec §10.2). */
export const PlanRoom = z.object({
  /** The label as printed, in its own language. */
  name: conf(text(120)).optional(),
  /** An index into `floors`; one out of range is the first floor (floor-plan.ts). */
  floor: z.number().int().min(0).max(99).optional(),
  box: planBox,
  /** The inside corners in order, when the room isn't a plain rectangle or the plan is drawn
   * at an angle. */
  corners: z.array(point).min(4).max(PLAN_LIMITS.corners).optional(),
  /** The size printed for this room, copied exactly with its units. */
  size_text: conf(text(40)).optional(),
  kind: z.enum(PLAN_ROOM_KINDS).optional(),
});

/** PLAN (D266): the rooms of a floor plan, the floors they are on, and what gives the scale. */
export const PlanExtraction = z.object({
  is_plan: z.boolean(),
  floors: z
    .array(z.object({ label: conf(text(80)) }))
    .max(PLAN_LIMITS.floors)
    .optional(),
  rooms: z.array(PlanRoom).max(PLAN_LIMITS.rooms).optional(),
  scale_bar: z.object({ from: point, to: point, text: text(20) }).optional(),
  doors: z
    .array(z.object({ box: planBox }))
    .max(PLAN_LIMITS.doors)
    .optional(),
  /** The plan had more rooms than the list could hold. */
  more: z.boolean().optional(),
});
export type PlanExtraction = z.output<typeof PlanExtraction>;

export const EXTRACTION_SCHEMAS = Object.freeze({
  thing: ThingExtraction,
  receipt: ReceiptExtraction,
  label: LabelExtraction,
  reading: ReadingExtraction,
  room: RoomExtraction,
  plan: PlanExtraction,
} satisfies Record<ExtractionMode, z.ZodType>);

export type ThingExtraction = z.output<typeof ThingExtraction>;
export type ReceiptExtraction = z.output<typeof ReceiptExtraction>;
export type LabelExtraction = z.output<typeof LabelExtraction>;
export type ReadingExtraction = z.output<typeof ReadingExtraction>;
export type ServiceInvoiceExtraction = z.output<typeof ServiceInvoiceExtraction>;

/** Filled in without asking when confident enough (D19, D41, D128). */
export const AUTO_ACCEPT = ['name', 'brand', 'model', 'type', 'colour', 'aliases'] as const;
/** Always wait for a person (D19). A quantity of 1 is the default and doesn't wait. */
export const REVIEW_FIELDS = [
  'serial',
  'quantity',
  'price',
  'purchased_on',
  'warranty',
  'reading',
  'vendor',
  'currency',
] as const;
/** Below this, even an auto-accept field waits. Tunable. */
export const CONFIDENCE_MIN = 0.6;

/**
 * Whether an extracted field waits in the inbox. Unknown fields wait: auto-accepting is the
 * exception that has to be listed.
 */
export function needsReview(field: string, confidence: number, value?: unknown): boolean {
  if (!(confidence >= CONFIDENCE_MIN)) return true;
  if (field === 'quantity') return !(Number(value) === 1);
  return !(AUTO_ACCEPT as readonly string[]).includes(field);
}

/**
 * The inbox field an alias suggestion goes by (D214: an Arabic alias waits for review): its
 * language's base code after `alias_`, e.g. `alias_ar`. Its value is the alias.
 */
export const aliasSuggestionField = (lang: string): string => `alias_${lang}`;

/** The language of an alias suggestion's field, or null for any other field. */
export function aliasSuggestionLanguage(field: string): string | null {
  return /^alias_([a-z]{2,3})$/.exec(field)?.[1] ?? null;
}

/** The JSON allowance per mode, before reasoning. */
export const MAX_OUTPUT_TOKENS: Readonly<Record<ExtractionMode, number>> = Object.freeze({
  thing: 700,
  receipt: 2500,
  label: 600,
  reading: 200,
  room: 8000,
  // About 100 tokens a room with its corners, 60 rooms at most (spec §10.1).
  plan: 6000,
});

/** Reasoning tokens billed against `maxOutputTokens`. */
export const REASONING_ALLOWANCE: Readonly<Record<ReasoningLevel, number>> = Object.freeze({
  none: 0,
  minimal: 512,
  low: 2048,
  medium: 6144,
  high: 16384,
});

/** The `maxOutputTokens` sent: JSON allowance plus reasoning allowance. A `length` stop fails. */
export function outputTokenCap(mode: ExtractionMode, reasoning: ReasoningLevel): number {
  return MAX_OUTPUT_TOKENS[mode] + REASONING_ALLOWANCE[reasoning];
}

// ---------------------------------------------------------------------------------------------

type Lenient = { ok: true; value: unknown; dropped: string[] } | { ok: false };
const FAIL: Lenient = { ok: false };

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** The array's max length when that is the only reason `items` failed. */
function tooBigMax(schema: z.ZodType, items: unknown[]): number | null {
  const r = schema.safeParse(items);
  if (r.success) return null;
  const issue = r.error.issues[0];
  return r.error.issues.length === 1 && issue?.code === 'too_big' && issue.path.length === 0
    ? Number(issue.maximum)
    : null;
}

function lenient(schema: z.ZodType, raw: unknown, path: string): Lenient {
  const direct = schema.safeParse(raw);
  if (direct.success) return { ok: true, value: direct.data, dropped: [] };

  if (schema instanceof z.ZodOptional) {
    return raw === undefined
      ? { ok: true, value: undefined, dropped: [] }
      : lenient(schema.unwrap() as z.ZodType, raw, path);
  }
  const at = (key: string | number) => (path ? `${path}.${key}` : String(key));

  if (schema instanceof z.ZodObject && isPlainObject(raw)) {
    const out: Record<string, unknown> = {};
    const dropped: string[] = [];
    for (const [key, field] of Object.entries(schema.shape as Record<string, z.ZodType>)) {
      const r = lenient(field, raw[key], at(key));
      if (r.ok) {
        if (r.value !== undefined) out[key] = r.value;
        dropped.push(...r.dropped);
      } else if (field instanceof z.ZodOptional) {
        dropped.push(at(key));
      } else {
        return FAIL;
      }
    }
    const check = schema.safeParse(out);
    return check.success ? { ok: true, value: check.data, dropped } : FAIL;
  }

  if (schema instanceof z.ZodArray && Array.isArray(raw)) {
    let items: unknown[] = [];
    const dropped: string[] = [];
    raw.forEach((item, i) => {
      const r = lenient(schema.element as z.ZodType, item, at(i));
      if (r.ok) {
        items.push(r.value);
        dropped.push(...r.dropped);
      } else dropped.push(at(i));
    });
    const max = tooBigMax(schema, items);
    if (max !== null) {
      // Cut from the end; the paths name the original indexes that were kept up to `max`.
      const keptIndexes = raw.map((_, i) => i).filter((i) => !dropped.includes(at(i)));
      for (const i of keptIndexes.slice(max)) dropped.push(at(i));
      items = items.slice(0, max);
      dropped.sort();
    }
    const check = schema.safeParse(items);
    return check.success ? { ok: true, value: check.data, dropped } : FAIL;
  }

  if (schema instanceof z.ZodRecord && isPlainObject(raw)) {
    const out: Record<string, unknown> = {};
    const dropped: string[] = [];
    for (const [key, value] of Object.entries(raw)) {
      const k = (schema.keyType as z.ZodType).safeParse(key);
      const r = k.success ? lenient(schema.valueType as z.ZodType, value, at(key)) : FAIL;
      if (r.ok) {
        out[key] = r.value;
        dropped.push(...r.dropped);
      } else dropped.push(at(key));
    }
    const check = schema.safeParse(out);
    return check.success ? { ok: true, value: check.data, dropped } : FAIL;
  }

  return FAIL;
}

/**
 * Parses a model's answer, dropping each field that fails instead of failing the whole object:
 * an optional field that fails is left out, a list item that fails is removed, a list
 * over its maximum is cut to it, and unknown keys are ignored. Null when what is left can't
 * satisfy the schema (a required field failed, or it isn't an object at all). `dropped` lists
 * the dotted paths removed, for the call log and the evaluation harness.
 */
export function parseLenient<S extends z.ZodType>(
  schema: S,
  raw: unknown,
): { value: z.output<S>; dropped: string[] } | null {
  const r = lenient(schema, raw, '');
  return r.ok ? { value: r.value as z.output<S>, dropped: r.dropped } : null;
}
