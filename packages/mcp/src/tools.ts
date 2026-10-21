/**
 * The tool set (D22, D63, D124, D172, D213). One registry serves the
 * assistant and MCP: this file holds each tool's contract, `apps/server/src/tools/` its handler.
 *
 * - `scope`: a `read` tool is offered to every principal; a `write` tool only where the principal
 *   may write (a write token, a member or better, D123).
 * - `module`: the tool is offered in a location only while that module is effective there
 *   (D113); `null` is the core.
 * - `since`: the step whose service backs the tool, or `1.x` for a tool added
 *   after the plan (Moving mode's, D251). The contract lands now; the handler lands with that
 *   step, and `capabilities` never lists a tool without one.
 * - `doors`: who is offered the tool, MCP and the assistant (D22) unless it says otherwise. The
 *   moving tools are MCP's only: the assistant's confirmation card has no rows for them (D124's
 *   amendment). The assistant offers each step the tools its question is about
 *   (apps/server/src/assistant/select.ts).
 * - `input` is what the model or the MCP client sends (snake_case). Ids are UUIDs or
 *   6-character short IDs (`idOrCode`), read through `normaliseInputCode`. `location_id` is
 *   optional where the principal has one location (D179).
 * - `output` is the shape of the envelope's `data` (output.ts). Every user-written string sits
 *   under an `untrusted` key (D179).
 * - Descriptions are the question a tool answers, in English only: the model reads them, the UI
 *   never shows them.
 *
 * No tool trashes, deletes, merges, transfers ownership, reveals a secret, uploads a file or runs
 * SQL (D58, D63, D124); `tools.test.ts` walks the names.
 */

import {
  ATTACHMENT_ROLES,
  BOX_STATES,
  BUILTIN_PLACE_KINDS,
  CLAIM_STATUSES,
  CONDITIONS,
  DERIVED_STATES,
  isShortCode,
  LIFECYCLES,
  MAX_BOX_PREFIX,
  MAX_MOVE_NAME,
  MODULE_IDS,
  MOVE_STATUSES,
  type ModuleId,
  normaliseInputCode,
  ROLES,
  WARRANTY_KINDS,
} from '@kept/shared';
import { z } from 'zod';

export const TOOL_SCOPES = ['read', 'write'] as const;
export type ToolScope = (typeof TOOL_SCOPES)[number];

/** The steps whose services back a tool, and `1.x` for one added since. */
export const TOOL_SINCE = [4, 5, 6, 7, '1.x'] as const;
export type ToolSince = (typeof TOOL_SINCE)[number];

/** Who may be offered a tool: an MCP client, and the in-app assistant (D22, D63). */
export const TOOL_DOORS = ['mcp', 'assistant'] as const;
export type ToolDoor = (typeof TOOL_DOORS)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A reference a person or a model typed: a UUID, or a short ID in any spelling a person uses. */
export type ParsedRef = { kind: 'id'; id: string } | { kind: 'code'; code: string };

/** Reads an `idOrCode` value: a UUID as is (lower case), otherwise a normalised short ID. */
export function parseRef(value: string): ParsedRef | null {
  const v = value.trim();
  if (UUID.test(v)) return { kind: 'id', id: v.toLowerCase() };
  const code = normaliseInputCode(v);
  return isShortCode(code) ? { kind: 'code', code } : null;
}

/** A thing, place or container: its UUID or its short ID. */
export const idOrCode = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((v) => parseRef(v) !== null, { message: 'a UUID or a 6-character short ID' })
  .describe('An id (UUID) or a 6-character short ID such as K7D2QX');

const uuid = z.uuid();
const isoDate = z.iso.date().describe('A date, YYYY-MM-DD, in the location’s time zone');
const isoDateTime = z.iso.datetime({ offset: true });
const locationId = uuid
  .optional()
  .describe('The location. Leave it out when you have access to one location only');
const cursor = z.string().min(1).max(2400).optional().describe('next_cursor from the last page');
const limit = z.number().int().min(1).max(200).optional().describe('Items per page: 20 unless set');
/** A decimal amount as a string ("450.00") and its ISO 4217 currency. */
const money = z.object({
  amount: z.string().regex(/^-?\d{1,12}(\.\d{1,4})?$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
});
const shortText = (max: number) => z.string().trim().min(1).max(max);
/** A count taken off a consumable (D236): more than 0, up to 3 decimals, as the stock holds. */
const stockQuantity = z
  .number()
  .positive()
  .max(999_999_999)
  .refine((n) => /^\d{1,9}(\.\d{1,3})?$/.test(String(n)), {
    message: 'at most 3 decimals, e.g. 4.5',
  });

// ---------------------------------------------------------------------------------------------
// Output building blocks. Kept's own words (ids, codes, enums, dates, numbers) sit beside
// `untrusted`, which holds only what people wrote (D179).

/** A thing as every output cites it: ids, and its name and place path as untrusted text. */
export const thingRef = z.object({
  id: uuid,
  short_code: z.string().nullable(),
  location_id: uuid,
  untrusted: z.object({
    name: z.string(),
    aliases: z.array(z.string()).optional(),
    /** Place names from the location down to the thing's container. */
    path: z.array(z.string()),
  }),
});
export type ThingRef = z.infer<typeof thingRef>;

export const placeRef = z.object({
  id: uuid,
  short_code: z.string().nullable(),
  location_id: uuid,
  kind: z.string(),
  untrusted: z.object({ name: z.string(), path: z.array(z.string()) }),
});
export type PlaceRef = z.infer<typeof placeRef>;

const locationRef = z.object({
  id: uuid,
  role: z.enum(ROLES),
  time_zone: z.string(),
  untrusted: z.object({ name: z.string() }),
});

const loan = z.object({
  direction: z.enum(['out', 'in']),
  due_on: z.string().nullable(),
  untrusted: z.object({ person: z.string() }),
});

const thingSummary = thingRef.extend({
  quantity: z.number(),
  lifecycle: z.enum(LIFECYCLES),
  states: z.array(z.enum(DERIVED_STATES)),
  last_seen_at: z.string().nullable(),
  loan: loan.optional(),
  matched_by: z.enum(['keyword', 'meaning']).optional(),
});

/** What every write answers: the audit event, and until when it can be undone (7 days, D58). */
const writeResult = z.object({
  audit_event_id: uuid,
  undo_until: z.string().nullable(),
});

const list = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item) });

// ---------------------------------------------------------------------------------------------

export type ToolAnnotations = {
  readOnlyHint: boolean;
  destructiveHint: false;
  idempotentHint: boolean;
  openWorldHint: false;
};

export type ToolDef<I extends z.ZodType = z.ZodType, O extends z.ZodType = z.ZodType> = {
  name: string;
  title: string;
  description: string;
  scope: ToolScope;
  module: ModuleId | null;
  since: ToolSince;
  /** Who is offered it: both unless the entry names fewer. */
  doors: readonly ToolDoor[];
  input: I;
  output: O;
  annotations: ToolAnnotations;
};

const tool = <I extends z.ZodType, O extends z.ZodType>(
  d: Omit<ToolDef<I, O>, 'annotations' | 'doors'> & {
    idempotent?: boolean;
    doors?: readonly ToolDoor[];
  },
): ToolDef<I, O> => {
  const { idempotent, doors, ...rest } = d;
  return Object.freeze({
    ...rest,
    doors: Object.freeze([...(doors ?? TOOL_DOORS)]),
    annotations: Object.freeze({
      readOnlyHint: d.scope === 'read',
      destructiveHint: false as const,
      idempotentHint: d.scope === 'read' || idempotent === true,
      openWorldHint: false as const,
    }),
  });
};

// --- Moving mode (1.x, D251) ------------------------------------------------------------------

const boxCounts = z.object({
  packed: z.number().int(),
  in_transit: z.number().int(),
  unpacked: z.number().int(),
  total: z.number().int(),
});

/** A move as the moving tools cite it. Its name and its destination's name are people's words. */
const moveRef = z.object({
  id: uuid,
  location_id: uuid.describe('The location being packed'),
  to_location_id: uuid
    .nullable()
    .describe('The location the boxes go to; null: rooms of the same location'),
  status: z.enum(MOVE_STATUSES),
  created_at: z.string(),
  finished_at: z.string().nullable(),
  counts: boxCounts.describe('Boxes by state'),
  url: z.string().describe('The move’s board in Kept'),
  untrusted: z.object({
    name: z.string(),
    /** Null when it stays in one location, or you can't see the other one. */
    to_location: z.string().nullable(),
  }),
});

/** One box of a move: a container (a thing) with its number and where it is in the move. */
const moveBox = z.object({
  box_id: uuid.describe('The box’s container (a thing): pack into it, move it, open it'),
  short_code: z.string().nullable().describe('The short ID on its label'),
  number: z.number().int(),
  state: z.enum(BOX_STATES),
  state_at: z.string(),
  visible: z
    .boolean()
    .describe('False when it was unpacked into a location you can’t see: then no name or place'),
  location_id: uuid.nullable(),
  contents: z.number().int().describe('Things directly inside it'),
  destination: z
    .object({ place_id: uuid, location_id: uuid, untrusted: z.object({ name: z.string() }) })
    .nullable()
    .describe('The room it goes to, when one was chosen'),
  url: z.string().describe('The box in Kept'),
  untrusted: z.object({
    name: z.string().nullable(),
    /** Where it is now: places down to its own ("Kitchen › Shelf"). */
    where: z.string().nullable(),
  }),
});

const moveId = uuid.describe('The move (list_moves lists them)');
const boxId = idOrCode.describe('The box: its id, or the short ID on its label');

/** A thing's own fields, as add_thing sets them and update_thing changes them: every field the
 * app's create and edit forms set (fields-parity.test.ts in apps/server checks the two stay
 * together). Each detail goes in its own field, never in `notes`. */
const thingFields = {
  type: z.string().max(120).describe('Its type, by name ("Drill", "Car")'),
  type_id: uuid.describe('Its type, by id (instead of `type`)'),
  brand: z.string().max(120),
  model: z.string().max(120),
  serial: z.string().max(100).describe('As printed on it'),
  barcode: z.string().max(64),
  colour: z.string().max(60),
  condition: z.enum(CONDITIONS),
  notes: z.string().max(2000).describe('Only what no other field holds'),
  aliases: z.array(shortText(200)).max(20).describe('Other names for it'),
  tags: z.array(shortText(80)).max(20).describe('Tag names; only tags that exist'),
  belongs_to: shortText(200).describe('Whose it is: a person’s name'),
  manual_url: z.url({ protocol: /^https?$/ }).max(2000),
  expires_on: isoDate,
  expiry_lead_days: z.number().int().min(0).max(3650).describe('Days before expiry to remind'),
  keep_at_least: z.number().min(0).max(999_999).describe('A consumable’s minimum stock'),
  custom: z.record(z.string().max(64), z.unknown()).describe('Its type’s own fields, by key'),
};

/** Each field of a shape, nullable (update_thing: null clears it). */
const nullable = <T extends Record<string, z.ZodType>>(shape: T) =>
  Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, v.nullable()])) as {
    [K in keyof T]: z.ZodNullable<T[K]>;
  };

const { aliases, tags, custom, ...clearable } = thingFields;

/** One item of `add_thing` (D213: a spoken list is one call with several items). */
export const addThingItem = z
  .object({
    name: shortText(200),
    quantity: z.number().int().min(1).max(100_000).optional(),
    place_id: idOrCode.optional().describe('An existing place or container'),
    new_place: z
      .object({
        name: shortText(120),
        parent_id: idOrCode.optional(),
        kind: z.string().max(40).optional(),
      })
      .optional()
      .describe('A place that does not exist yet; it is proposed with the thing (D213)'),
    purchase: z
      .object({
        purchased_on: isoDate.optional(),
        price: money.shape.amount.describe('The price of one'),
        currency: money.shape.currency,
        shop: shortText(200).optional(),
      })
      .optional(),
  })
  .extend(z.object(thingFields).partial().shape);

/** update_thing's fields: each of a thing's fields; `null` clears one. */
const updateFields = z
  .object({
    name: shortText(200),
    quantity: z.number().min(0).max(999_999_999),
    aliases,
    tags,
    custom,
    ...nullable(clearable),
    acquired_from: z.string().max(200).nullable().describe('Where it came from'),
    provenance_notes: z.string().max(2000).nullable(),
  })
  .partial()
  .refine((f) => Object.keys(f).length > 0, { message: 'at least one field' });

export const TOOL_DEFS = Object.freeze({
  // --- read, core ----------------------------------------------------------------------------
  capabilities: tool({
    name: 'capabilities',
    title: 'What can I do here?',
    description:
      'What can I do in each location? Lists every location you can reach, its modules and the tools you may call there.',
    scope: 'read',
    module: null,
    since: 6,
    input: z.object({}),
    output: z.object({
      scope: z.enum(TOOL_SCOPES),
      locations: z.array(
        locationRef.extend({ modules: z.array(z.enum(MODULE_IDS)), tools: z.array(z.string()) }),
      ),
    }),
  }),
  list_locations: tool({
    name: 'list_locations',
    title: 'Locations',
    description: 'Which locations can I see? Lists them with your role and their time zone.',
    scope: 'read',
    module: null,
    since: 6,
    input: z.object({}),
    output: list(locationRef),
  }),
  search_things: tool({
    name: 'search_things',
    title: 'Search things',
    description:
      'Which things match these words? Searches names, aliases, types, brands and notes, with filters.',
    scope: 'read',
    module: null,
    since: 6,
    input: z.object({
      location_id: locationId,
      query: z.string().trim().max(200),
      filters: z
        .object({
          type: z.string().max(120).optional(),
          place_id: idOrCode.optional(),
          status: z.enum([...LIFECYCLES, ...DERIVED_STATES]).optional(),
          tag: z.string().max(80).optional(),
        })
        .optional(),
      cursor,
      limit,
    }),
    output: list(thingSummary),
  }),
  where_is: tool({
    name: 'where_is',
    title: 'Where is it?',
    description:
      'Where is a thing? Give a name or words from it; answers the best matches with their full place path.',
    scope: 'read',
    module: null,
    since: 6,
    input: z.object({ location_id: locationId, query: shortText(200) }),
    output: list(thingSummary.extend({ uncertain: z.boolean() })),
  }),
  get_thing: tool({
    name: 'get_thing',
    title: 'A thing',
    description: 'What do we know about this thing? Give its id or short ID.',
    scope: 'read',
    module: null,
    since: 6,
    input: z.object({ location_id: locationId, thing_id: idOrCode }),
    output: z.object({
      thing: thingSummary.extend({
        type_id: uuid.nullable(),
        condition: z.enum(CONDITIONS).nullable(),
        container: z.boolean(),
        untrusted: thingRef.shape.untrusted.extend({
          type: z.string().nullable(),
          brand: z.string().nullable(),
          model: z.string().nullable(),
          notes: z.string().nullable(),
          fields: z.record(z.string(), z.unknown()).optional(),
        }),
        purchase: z
          .object({ purchased_on: z.string().nullable(), price: money.optional() })
          .optional(),
        meters: z
          .array(
            z.object({
              id: uuid,
              unit: z.string(),
              last_value: z.number().nullable(),
              last_taken_at: z.string().nullable(),
              untrusted: z.object({ name: z.string() }),
            }),
          )
          .optional(),
        // 1.x (D248): documents linked from the location's Paperless-ngx, as Kept cached them.
        paperless_documents: z
          .array(
            z.object({
              document_id: z.number().int().describe('The document’s id in Paperless-ngx'),
              kind: z.enum(['receipt', 'invoice', 'manual', 'warranty_doc', 'document']),
              date: z.string().nullable(),
              copied: z.boolean().describe('A copy is also attached in Kept'),
              untrusted: z.object({ title: z.string(), type: z.string().nullable() }),
            }),
          )
          .optional()
          .describe('Receipts, manuals and other documents linked from Paperless-ngx'),
        // 1.14 (#170): who has it (its open hand-over line), and a kit's parts.
        with: z
          .object({
            handover_id: uuid,
            since: z.string(),
            due_on: z.string().nullable(),
            in_box: z.string().nullable().describe('Lent inside this, when it went in a box'),
            untrusted: z.object({ person: z.string() }),
          })
          .optional()
          .describe('Lent out: to whom, since when'),
        kit: z
          .object({
            complete: z.boolean(),
            parts: z.array(
              z.object({
                thing_id: uuid,
                status: z.enum(['in_kit', 'elsewhere', 'missing', 'with_someone', 'trashed']),
                untrusted: z.object({ name: z.string().nullable() }),
              }),
            ),
          })
          .optional()
          .describe('A kit: its parts and where each is'),
        url: z.string().describe('The thing’s page in Kept'),
      }),
    }),
  }),
  list_contents: tool({
    name: 'list_contents',
    title: 'What is in it?',
    description:
      'What is in this place or container? Lists places and things below it, 1 to 3 levels deep.',
    scope: 'read',
    module: null,
    since: 6,
    input: z.object({
      location_id: locationId,
      place_id: idOrCode.optional(),
      container_id: idOrCode.optional(),
      depth: z.number().int().min(1).max(3).optional(),
      cursor,
      limit,
    }),
    output: z.object({
      parent: z.union([placeRef, thingRef]),
      items: z.array(
        z.object({
          depth: z.number().int().min(1).max(3),
          place: placeRef.optional(),
          thing: thingSummary.optional(),
        }),
      ),
    }),
  }),
  thing_history: tool({
    name: 'thing_history',
    title: 'History',
    description:
      'What happened to this thing? Its history, newest first: who did what and when (values hidden where your role hides them).',
    scope: 'read',
    module: null,
    since: 6,
    input: z.object({ location_id: locationId, thing_id: idOrCode, cursor, limit }),
    output: list(
      z.object({
        id: uuid,
        at: z.string(),
        action: z.string(),
        actor_type: z.enum(['user', 'token', 'system']),
        untrusted: z.object({ actor: z.string().nullable(), summary: z.string() }),
      }),
    ),
  }),
  find_documents: tool({
    name: 'find_documents',
    title: 'Documents',
    description:
      'Where is the receipt, manual or warranty for something? Lists attachments with what they belong to; open them in Kept.',
    scope: 'read',
    module: null,
    since: 6,
    input: z.object({
      location_id: locationId,
      thing_id: idOrCode.optional(),
      query: z.string().trim().max(200).optional(),
      roles: z.array(z.enum(ATTACHMENT_ROLES)).max(ATTACHMENT_ROLES.length).optional(),
      cursor,
      limit,
    }),
    output: list(
      z.object({
        attachment_id: uuid,
        role: z.enum(ATTACHMENT_ROLES),
        subject: z.object({
          type: z.enum(['thing', 'place', 'purchase', 'location', 'meter_reading', 'incident']),
          id: uuid,
        }),
        mime: z.string(),
        bytes: z.number().int(),
        added_at: z.string(),
        url: z.string().describe('The subject’s page in Kept; no file bytes over MCP'),
        untrusted: z.object({ title: z.string().nullable(), subject: z.string() }),
      }),
    ),
  }),

  // --- read, modules -------------------------------------------------------------------------
  upcoming: tool({
    name: 'upcoming',
    title: 'What is coming up?',
    description:
      'What is due, overdue or expiring soon? Schedules, warranties, loans and low stock within some days.',
    scope: 'read',
    module: 'schedules',
    since: 4,
    input: z.object({
      location_id: locationId,
      within_days: z.number().int().min(1).max(366).optional(),
      kinds: z
        .array(z.enum(['due', 'overdue', 'expiring', 'low_stock', 'loans']))
        .max(5)
        .optional(),
      cursor,
      limit,
    }),
    output: list(
      z.object({
        kind: z.enum(['due', 'overdue', 'expiring', 'low_stock', 'loans']),
        source_type: z.string(),
        source_id: uuid,
        due_on: z.string().nullable(),
        thing: thingRef.optional(),
        untrusted: z.object({ title: z.string() }),
      }),
    ),
  }),

  // --- write, core ---------------------------------------------------------------------------
  add_thing: tool({
    name: 'add_thing',
    title: 'Add things',
    description:
      'Add things: every one the person listed goes in `items`, in one call. Each detail in its own field (type, colour, condition, purchase …), never in notes. `new_place`: a place not made yet.',
    scope: 'write',
    module: null,
    since: 6,
    input: z.object({ location_id: locationId, items: z.array(addThingItem).min(1).max(20) }),
    output: writeResult.extend({
      /** One undoable event per thing and per new place, in write order (one Undo undoes all). */
      audit_event_ids: z.array(uuid),
      things: z.array(thingRef),
      places: z.array(placeRef),
      /** Per item, where it landed: `status` says whether its place already existed, was
       * just made, or is the default Unplaced bucket; `place` is its index in `places` (null
       * for Unplaced, or when it went into a container: then `container_id` says which).
       * `item` is the index in `items`. */
      placed: z.array(
        z.object({
          item: z.number().int().min(0),
          status: z.enum(['found', 'created', 'unplaced']),
          place: z.number().int().min(0).nullable(),
          container_id: uuid.optional(),
        }),
      ),
      attach_link: z.string().optional(),
      /** A type or brand named for an item that Kept doesn't know; the thing was added without
       * it. `item` is the index in `items`. */
      not_set: z
        .array(
          z.object({
            item: z.number().int().min(0),
            field: z.enum(['type', 'brand', 'tag']),
            untrusted: z.object({ value: z.string() }),
          }),
        )
        .optional(),
    }),
  }),
  update_thing: tool({
    name: 'update_thing',
    title: 'Change a thing',
    description:
      'Change a thing’s fields: each detail in its own field (type, colour, condition …), never in notes; null clears one. Secret fields and prices only where allowed.',
    scope: 'write',
    module: null,
    since: 6,
    idempotent: true,
    input: z.object({
      location_id: locationId,
      thing_id: idOrCode,
      fields: updateFields,
    }),
    output: writeResult.extend({ thing: thingRef, changed_fields: z.array(z.string()) }),
  }),
  move_thing: tool({
    name: 'move_thing',
    title: 'Move a thing',
    description:
      'Move a thing to another place or container. Give a quantity to move only some of them (the rest stay).',
    scope: 'write',
    module: null,
    since: 6,
    input: z.object({
      location_id: locationId,
      thing_id: idOrCode,
      to_place_id: idOrCode.optional(),
      to_container_id: idOrCode.optional(),
      quantity: z.number().int().min(1).optional(),
    }),
    output: writeResult.extend({ thing: thingRef, split_from: uuid.optional() }),
  }),
  mark_seen: tool({
    name: 'mark_seen',
    title: 'Seen it',
    description: 'I just saw this thing where Kept says it is. Give its id or short ID.',
    scope: 'write',
    module: null,
    since: 6,
    idempotent: true,
    input: z.object({ location_id: locationId, thing_id: idOrCode }),
    output: writeResult.extend({ thing: thingRef, last_seen_at: z.string() }),
  }),
  create_place: tool({
    name: 'create_place',
    title: 'Add a place',
    description:
      'Add a place (a room, a shelf, a zone) under another place, or at the top of the location.',
    scope: 'write',
    module: null,
    since: 6,
    input: z.object({
      location_id: locationId,
      parent_id: idOrCode.optional(),
      name: shortText(120),
      kind: z
        .string()
        .max(40)
        .optional()
        .describe(`A place kind: ${BUILTIN_PLACE_KINDS.join(', ')} or the account’s own`),
    }),
    output: writeResult.extend({ place: placeRef }),
  }),
  attach_link: tool({
    name: 'attach_link',
    title: 'Add a photo or document',
    description:
      'A link that opens Kept’s capture sheet for this thing or place, so the person can add a photo, receipt or document.',
    scope: 'write',
    module: null,
    since: 6,
    idempotent: true,
    input: z.object({
      location_id: locationId,
      subject_type: z.enum(['thing', 'place']),
      subject_id: idOrCode,
      role: z.enum(ATTACHMENT_ROLES).optional(),
    }),
    output: z.object({ url: z.string() }),
  }),
  log_reading: tool({
    name: 'log_reading',
    title: 'Log a reading',
    description:
      'Record a meter reading (odometer, hours, electricity). Give the thing or the meter, the value and when.',
    scope: 'write',
    module: null,
    since: 6,
    input: z.object({
      location_id: locationId,
      thing_id: idOrCode.optional(),
      meter_id: uuid.optional(),
      value: z.number().finite().nonnegative(),
      taken_at: isoDateTime.optional(),
    }),
    output: writeResult.extend({
      reading: z.object({
        id: uuid,
        meter_id: uuid,
        value: z.number(),
        unit: z.string(),
        taken_at: z.string(),
      }),
      to_inbox: z.boolean().describe('True when the reading needs a look and went to the Inbox'),
    }),
  }),

  // --- write, lending ------------------------------------------------------------------------
  lend_thing: tool({
    name: 'lend_thing',
    title: 'Lend',
    description:
      'Lend a thing to someone, with an optional due date. A box or a kit goes with everything in it, each on its own line.',
    scope: 'write',
    module: 'lending',
    since: 4,
    input: z.object({
      location_id: locationId,
      thing_id: idOrCode,
      person: shortText(120).describe('A person’s name or id'),
      due_on: isoDate.optional(),
      quantity: z.number().int().min(1).optional(),
      with_parts_elsewhere: z
        .boolean()
        .optional()
        .describe('A kit: lend its parts kept elsewhere with it too'),
    }),
    output: writeResult.extend({
      thing: thingRef,
      loan_id: uuid,
      handover_id: uuid,
      lines: z.number().int().describe('How many things went'),
      left_behind: z
        .array(
          z.object({
            thing_id: uuid,
            reason: z.enum(['on_loan', 'in_repair', 'ended']),
          }),
        )
        .describe('Inside it, but not lent: already lent, in repair or no longer in use'),
    }),
  }),
  return_thing: tool({
    name: 'return_thing',
    title: 'Returned',
    description:
      'A lent or borrowed thing came back (all of it, or a quantity). A box or kit brings back what is still out with it.',
    scope: 'write',
    module: 'lending',
    since: 4,
    input: z.object({
      location_id: locationId,
      thing_id: idOrCode,
      quantity: z.number().int().min(1).optional(),
      condition: z.enum(CONDITIONS).optional().describe('The condition it came back in'),
    }),
    output: writeResult.extend({
      thing: thingRef,
      loan_id: uuid,
      lines_returned: z.number().int(),
    }),
  }),
  borrow_thing: tool({
    name: 'borrow_thing',
    title: 'Borrow',
    description:
      'Record a thing borrowed from someone: it is added as theirs, where you put it, with an optional due date.',
    scope: 'write',
    module: 'lending',
    since: 4,
    // A borrowed thing is added as the lender's (step 4's borrow, D56), so it takes a name and a
    // place, not an existing thing.
    input: z.object({
      location_id: locationId,
      name: shortText(200),
      place_id: idOrCode.optional().describe('Where you put it; the Unplaced area when left out'),
      person: shortText(120).describe('A person’s name or id'),
      due_on: isoDate.optional(),
    }),
    output: writeResult.extend({ thing: thingRef, loan_id: uuid }),
  }),

  // --- write, schedules ----------------------------------------------------------------------
  complete_schedule: tool({
    name: 'complete_schedule',
    title: 'Done',
    description: 'A scheduled task was done (on a date, or at a meter value).',
    scope: 'write',
    module: 'schedules',
    since: 4,
    input: z.object({
      location_id: locationId,
      schedule_id: uuid,
      done_on: isoDate.optional(),
      value: z.number().finite().nonnegative().optional(),
    }),
    output: writeResult.extend({ schedule_id: uuid, next_due_on: z.string().nullable() }),
  }),
  snooze_schedule: tool({
    name: 'snooze_schedule',
    title: 'Snooze',
    description: 'Put off a scheduled task until a date or a meter value.',
    scope: 'write',
    module: 'schedules',
    since: 4,
    input: z.object({
      location_id: locationId,
      schedule_id: uuid,
      until_date: isoDate.optional(),
      until_value: z.number().finite().nonnegative().optional(),
    }),
    output: writeResult.extend({ schedule_id: uuid }),
  }),

  // --- write, warranties ---------------------------------------------------------------------
  add_warranty: tool({
    name: 'add_warranty',
    title: 'Add a warranty',
    description: 'Record a warranty on a thing: its kind, and when it ends or how many months.',
    scope: 'write',
    module: 'warranties',
    since: 4,
    input: z.object({
      location_id: locationId,
      thing_id: idOrCode,
      kind: z.enum(WARRANTY_KINDS),
      ends_on: isoDate.optional(),
      term_months: z.number().int().min(1).max(600).optional(),
      provider: z.string().max(120).optional(),
    }),
    output: writeResult.extend({ warranty_id: uuid, ends_on: z.string().nullable() }),
  }),
  open_claim: tool({
    name: 'open_claim',
    title: 'Open a claim',
    description: 'Open a warranty claim for a thing.',
    scope: 'write',
    module: 'warranties',
    since: 4,
    input: z.object({
      location_id: locationId,
      thing_id: idOrCode,
      warranty_id: uuid.optional(),
      reference: z.string().max(120).optional(),
    }),
    output: writeResult.extend({ claim_id: uuid, status: z.enum(CLAIM_STATUSES) }),
  }),
  update_claim: tool({
    name: 'update_claim',
    title: 'Update a claim',
    description: 'Change a warranty claim’s status or reference.',
    scope: 'write',
    module: 'warranties',
    since: 4,
    input: z.object({
      location_id: locationId,
      thing_id: idOrCode,
      warranty_id: uuid.optional(),
      reference: z.string().max(120).optional(),
      status: z.enum(CLAIM_STATUSES).optional(),
    }),
    output: writeResult.extend({ claim_id: uuid, status: z.enum(CLAIM_STATUSES) }),
  }),

  // --- write, services and fuel --------------------------------------------------------------
  log_service: tool({
    name: 'log_service',
    title: 'Log a service',
    description:
      'Record a service done on a thing or a place: the date, who did it, the total, the lines (each may use stock from a consumable), and which schedules it completes.',
    scope: 'write',
    module: null,
    since: 5,
    input: z.object({
      location_id: locationId,
      thing_id: idOrCode.optional(),
      place_id: idOrCode.optional(),
      serviced_on: isoDate,
      vendor: z.string().max(120).optional(),
      total: money.optional(),
      lines: z
        .array(
          z
            .object({
              description: shortText(200),
              amount: money.optional(),
              // D236: the line used stock from a consumable of the same location.
              consumable_thing_id: idOrCode
                .optional()
                .describe(
                  'A consumable this line used from stock, such as the oil filter on the shelf. Its count goes down',
                ),
              consumed_quantity: stockQuantity
                .optional()
                .describe(
                  'How much it used, when not 1 (4.5 litres of oil). Needs consumable_thing_id',
                ),
            })
            .refine(
              (l) => l.consumed_quantity === undefined || l.consumable_thing_id !== undefined,
              {
                message: 'consumed_quantity needs consumable_thing_id',
                path: ['consumed_quantity'],
              },
            ),
        )
        .max(50)
        .optional(),
      completes: z.array(uuid).max(20).optional(),
    }),
    output: writeResult.extend({ service_id: uuid }),
  }),
  log_fuel: tool({
    name: 'log_fuel',
    title: 'Log fuel',
    description:
      'Record a fill-up: the amount, its unit, the cost, whether it was full, and the odometer.',
    scope: 'write',
    module: 'fuel',
    since: 5,
    input: z.object({
      location_id: locationId,
      thing_id: idOrCode,
      amount: z.number().finite().positive(),
      unit: z.string().max(10),
      cost: money.optional(),
      full: z.boolean().optional(),
      reading: z.number().finite().nonnegative().optional(),
    }),
    output: writeResult.extend({ fill_id: uuid }),
  }),

  // --- write, consumables --------------------------------------------------------------------
  adjust_stock: tool({
    name: 'adjust_stock',
    title: 'Adjust stock',
    description: 'Add to or take from a consumable’s stock (a positive or negative delta).',
    scope: 'write',
    module: 'consumables',
    since: 7,
    input: z.object({
      location_id: locationId,
      thing_id: idOrCode,
      delta: z
        .number()
        .int()
        .refine((n) => n !== 0, { message: 'not zero' }),
    }),
    output: writeResult.extend({ thing: thingRef, quantity: z.number() }),
  }),

  // --- Moving mode (1.x, D251), MCP only ---------------------------------------------------------
  list_moves: tool({
    name: 'list_moves',
    title: 'Moves',
    description:
      'Which moves are there? Lists them, open ones first, with how many boxes are packed, in transit and unpacked.',
    scope: 'read',
    module: 'moving',
    since: '1.x',
    doors: ['mcp'],
    input: z.object({
      location_id: locationId,
      status: z.enum(MOVE_STATUSES).optional().describe('active (still open) or done'),
      cursor,
      limit,
    }),
    output: list(moveRef),
  }),
  get_move: tool({
    name: 'get_move',
    title: 'A move',
    description:
      'Where is each box of this move? Its boxes in number order with their state and room, and the numbers still missing (not unpacked).',
    scope: 'read',
    module: 'moving',
    since: '1.x',
    doors: ['mcp'],
    input: z.object({ location_id: locationId, move_id: moveId, cursor, limit }),
    output: z.object({
      move: moveRef,
      items: z.array(moveBox),
      missing: z.array(z.number().int()).describe('Numbers of the boxes not unpacked yet'),
    }),
  }),
  start_move: tool({
    name: 'start_move',
    title: 'Start a move',
    description:
      'Start a move: name it, and give the location the boxes go to when it is another one.',
    scope: 'write',
    module: 'moving',
    since: '1.x',
    doors: ['mcp'],
    input: z.object({
      location_id: locationId.describe('The location being packed'),
      name: shortText(MAX_MOVE_NAME),
      to_location_id: uuid
        .optional()
        .describe('Where the boxes go; leave it out when they stay in this location'),
    }),
    output: writeResult.extend({ move: moveRef }),
  }),
  add_box: tool({
    name: 'add_box',
    title: 'Add a box',
    description:
      'Add the next numbered box to a move: a new box ("Box 4"), or a container that exists. Optionally the room it goes to.',
    scope: 'write',
    module: 'moving',
    since: '1.x',
    doors: ['mcp'],
    input: z.object({
      location_id: locationId,
      move_id: moveId,
      container_id: idOrCode
        .optional()
        .describe('A container that exists, to number as a box; leave it out for a new box'),
      prefix: z
        .string()
        .trim()
        .min(1)
        .max(MAX_BOX_PREFIX)
        .optional()
        .describe('A new box’s word before its number, in the person’s language: "Box" unless set'),
      place_id: idOrCode
        .optional()
        .describe('Where a new box is being packed; the Unplaced area when left out'),
      destination_place_id: idOrCode
        .optional()
        .describe('The room it goes to, in the location the move goes to'),
    }),
    output: writeResult.extend({ box: moveBox }),
  }),
  pack_into_box: tool({
    name: 'pack_into_box',
    title: 'Pack',
    description:
      'Pack things into a box of a move: they move into it, as an ordinary move (each can be undone).',
    scope: 'write',
    module: 'moving',
    since: '1.x',
    doors: ['mcp'],
    input: z.object({
      location_id: locationId,
      move_id: moveId,
      box_id: boxId,
      thing_ids: z.array(idOrCode).min(1).max(20),
    }),
    output: writeResult.extend({
      audit_event_ids: z.array(uuid),
      box: moveBox,
      things: z.array(thingRef),
    }),
  }),
  set_box_status: tool({
    name: 'set_box_status',
    title: 'Box status',
    description:
      'Mark a box packed or in transit, or choose the room it goes to. To unpack it, call unpack_box.',
    scope: 'write',
    module: 'moving',
    since: '1.x',
    doors: ['mcp'],
    idempotent: true,
    input: z
      .object({
        location_id: locationId,
        move_id: moveId,
        box_id: boxId,
        state: z.enum(['packed', 'in_transit']).optional(),
        destination_place_id: idOrCode
          .optional()
          .describe('The room it goes to, in the location the move goes to'),
      })
      .refine((b) => b.state !== undefined || b.destination_place_id !== undefined, {
        message: 'a state or a room',
        path: ['state'],
      }),
    output: writeResult.extend({ box: moveBox, changed: z.boolean() }),
  }),
  unpack_box: tool({
    name: 'unpack_box',
    title: 'Unpack',
    description:
      'Unpack a box into a room: the box and everything in it move there, and it is marked unpacked.',
    scope: 'write',
    module: 'moving',
    since: '1.x',
    doors: ['mcp'],
    input: z.object({
      location_id: locationId,
      move_id: moveId,
      box_id: boxId,
      place_id: idOrCode.optional().describe('The room; the one chosen for the box when left out'),
    }),
    output: writeResult.extend({ box: moveBox, changed: z.boolean() }),
  }),
});

export type ToolName = keyof typeof TOOL_DEFS;
export const TOOL_NAMES = Object.freeze(Object.keys(TOOL_DEFS) as ToolName[]);

export type ToolInput<N extends ToolName> = z.infer<(typeof TOOL_DEFS)[N]['input']>;
export type ToolOutput<N extends ToolName> = z.infer<(typeof TOOL_DEFS)[N]['output']>;

export function isToolName(name: string): name is ToolName {
  return Object.hasOwn(TOOL_DEFS, name);
}

/** Names no tool may carry (D58, D63, D124): nothing destructive, no secrets, files or SQL. */
export const FORBIDDEN_TOOL_NAME = /trash|delete|merge|transfer|reveal|upload|sql/;
