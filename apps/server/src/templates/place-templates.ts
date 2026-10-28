import {
  BUILTIN_PLACE_TEMPLATE_KEYS,
  builtinPlaceTemplate,
  type CompartmentCell,
  canTurn,
  cellsOf,
  DEFAULT_COMPARTMENT_NAMES,
  fillPattern,
  layoutProblem,
  newId,
  PATTERN_MAX,
  PLACE_ORIENTATIONS,
  type PlaceLayout,
  type PlaceOrientation,
  patternProblem,
  usesParent,
  withCount,
} from '@kept/shared';
import type pg from 'pg';
import { z } from 'zod';
import { actorOf } from '../audit/actor.js';
import { audited } from '../audit/audited.js';
import {
  lastChangedBy,
  notUndoable,
  type UndoArgs,
  undoableUntil,
  undoConflict,
} from '../audit/undo.js';
import { checkCodes } from '../codes/format-rule.js';
import { codeOf, ruleFor } from '../codes/service.js';
import { assertClientId, checkVersion } from '../http/conventions.js';
import { AppError, conflict, forbidden, invalid, notFound, pgErrorOf } from '../http/errors.js';
import { requireCan, requireMembership } from '../locations/access.js';
import { lastInCustomOrder } from '../places/order.js';
import {
  type Ctx,
  KIND_KEY,
  lockTree,
  NAME,
  requireKind,
  requireParent,
  UNDER_UNPLACED,
} from '../places/service.js';
import { type PlaceRow, requirePlace } from '../places/view.js';
import {
  auditRegistry,
  MANAGE_HINT,
  lastChangedBy as registryChangedBy,
  requireAccount,
  type WriteCtx,
} from '../registries/account.js';
import { checkLocations, EDITABLE, locationsOf } from './service.js';

// Place templates (#238): storage furniture and a place for each of its compartments, made in
// one step. The layout, the counting order and the patterns are packages/shared
// place-templates.ts; this module stores the account's own templates and builds the places.
//
// The account's templates are rows of `templates` with `applies_to = 'place'`, shared into
// locations through `template_locations` under thing templates' rules and policies (0038, D177):
// members and above of a location use one shared with it; creating one is
// `registries-types.manage` in the account plus admin of each location it is shared into;
// changing or deleting it needs admin of every location it is shared with. The payload is
// `{layout, kindKey, compartmentKindKey, compartmentName, codePattern?}`. Built-in templates
// (cube shelves, a bookcase, a chest, a shelving unit) are code, not rows.
//
// Making furniture (POST /api/v1/locations/:locationId/places/from-template, `things.edit`, as
// a single place) creates the furniture and every compartment under one tree lock, each with its
// kind and name, numbered top left to bottom right on the grid as it stands, the furniture in
// Custom order so they show in that order. Own codes: the furniture's (`code`), and each
// compartment's from the code pattern with `{parent}` = the furniture's code, all checked
// against the location's format rule and for collisions before anything is written; the first
// that fails is named (`failed: {code, reason}`): 400 `rule`, 400 `duplicate` within the unit,
// 409 `taken` by something else here.
//
// Audit: one `place.create` on the furniture, undoable for 7 days, whose diff names the template,
// the layout and every compartment. Its Undo (undoFurnitureCreate, through undo/registry.ts's
// `place.create` handler) puts the furniture and its compartments in the trash as one batch and
// frees the own codes they were given, unless something was put in one, or any of them changed
// since. Template writes are account-level rows (`template.create`, `.update`, `.delete`).

const Whole = z.number().int();
export const LayoutSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('grid'), across: Whole, up: Whole }),
    z.strictObject({ kind: z.literal('levels'), count: Whole }),
    z.strictObject({ kind: z.literal('drawers'), count: Whole }),
  ])
  .superRefine((layout, ctx) => {
    const problem = layoutProblem(layout);
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  });

const PATTERN_HINTS: Record<string, string> = {
  unknown: 'A pattern uses {n}, {row}, {col} and, in a code, {parent}.',
  braces: 'Check the braces: a placeholder is written like {n} or {col:02}.',
  parent: 'A name has no {parent}; use it in the code pattern.',
  empty: 'The pattern is empty.',
  indistinct: 'Use {n}, or {row} and {col}, so each compartment gets its own code.',
};

const patternHint = (pattern: string, code: boolean): string | null => {
  const problem = patternProblem(pattern, { code, distinct: code });
  return problem ? (PATTERN_HINTS[problem.reason] ?? 'Check the pattern.') : null;
};

const NamePattern = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .superRefine((p, ctx) => {
    const hint = patternHint(p, false);
    if (hint) ctx.addIssue({ code: 'custom', message: hint });
  });
const CodePattern = z
  .string()
  .trim()
  .min(1)
  .max(PATTERN_MAX)
  .superRefine((p, ctx) => {
    const hint = patternHint(p, true);
    if (hint) ctx.addIssue({ code: 'custom', message: hint });
  });

/** A place template's payload as stored. */
export const PlaceTemplatePayload = z.strictObject({
  layout: LayoutSchema,
  kindKey: KIND_KEY,
  compartmentKindKey: KIND_KEY,
  compartmentName: NamePattern,
  codePattern: CodePattern.nullable().optional(),
});
export type PlaceTemplatePayload = z.infer<typeof PlaceTemplatePayload>;

const TemplateName = z.string().trim().min(1).max(80);
const LocationIds = z.array(z.uuid()).min(1, 'Share it with a location.').max(100);

export const CreatePlaceTemplateBody = PlaceTemplatePayload.extend({
  id: z.uuid().optional(),
  name: TemplateName,
  locationIds: LocationIds,
});
export type CreatePlaceTemplateBody = z.infer<typeof CreatePlaceTemplateBody>;

export const UpdatePlaceTemplateBody = z
  .strictObject({
    name: TemplateName,
    layout: LayoutSchema,
    kindKey: KIND_KEY,
    compartmentKindKey: KIND_KEY,
    compartmentName: NamePattern,
    codePattern: CodePattern.nullable(),
    locationIds: LocationIds,
  })
  .partial()
  .refine((b) => Object.keys(b).length > 0, { message: 'Nothing to change.' });
export type UpdatePlaceTemplateBody = z.infer<typeof UpdatePlaceTemplateBody>;

const LayoutOut = z.union([
  z.object({ kind: z.literal('grid'), across: z.number(), up: z.number() }),
  z.object({ kind: z.enum(['levels', 'drawers']), count: z.number() }),
]);
export const PlaceTemplateSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  layout: LayoutOut,
  kindKey: z.string(),
  compartmentKindKey: z.string(),
  compartmentName: z.string(),
  codePattern: z.string().nullable(),
});
export const AccountPlaceTemplateSchema = PlaceTemplateSchema.extend({
  locations: z.array(z.object({ id: z.uuid(), name: z.string() })),
  rowVersion: z.number().int(),
});
export type PlaceTemplate = z.infer<typeof PlaceTemplateSchema>;
export type AccountPlaceTemplate = z.infer<typeof AccountPlaceTemplateSchema>;

type Row = {
  id: string;
  owner_account_id: string;
  name: string;
  payload: Record<string, unknown>;
  row_version: number;
};

const SELECT = `SELECT t.id, t.owner_account_id, t.name, t.payload, t.row_version
                  FROM public.templates t`;

/** A stored payload as the API shows it, or null when it no longer reads as one (written by
 * hand or an import): such a row is left out rather than failing the list. */
function viewOf(r: Row): PlaceTemplate | null {
  const parsed = PlaceTemplatePayload.safeParse(r.payload);
  if (!parsed.success) return null;
  const p = parsed.data;
  return {
    id: r.id,
    name: r.name,
    layout: p.layout,
    kindKey: p.kindKey,
    compartmentKindKey: p.compartmentKindKey,
    compartmentName: p.compartmentName,
    codePattern: p.codePattern ?? null,
  };
}

const viewsOf = (rows: readonly Row[]) =>
  rows.map(viewOf).filter((v): v is PlaceTemplate => v !== null);

async function accountViewsOf(client: pg.ClientBase, rows: readonly Row[]) {
  const where = await locationsOf(
    client,
    rows.map((r) => r.id),
  );
  const out: AccountPlaceTemplate[] = [];
  for (const r of rows) {
    const v = viewOf(r);
    if (v) out.push({ ...v, locations: where.get(r.id) ?? [], rowVersion: r.row_version });
  }
  return out;
}

/** GET /api/v1/place-templates?locationId: the account's place templates usable there (members
 * and above; anyone else, and a location they can't write in, gets none). */
export async function listUsable(client: pg.ClientBase, locationId: string) {
  const { rows } = await client.query<Row>(
    `${SELECT}
      WHERE t.archived_at IS NULL AND t.applies_to = 'place'
        AND EXISTS (SELECT 1 FROM public.template_locations tl
                     WHERE tl.template_id = t.id AND tl.location_id = $1
                       AND tl.location_id IN (SELECT kept.writable_location_ids()))
      ORDER BY t.name COLLATE "und-u-kn-true", t.id`,
    [locationId],
  );
  return viewsOf(rows);
}

/** GET /api/v1/accounts/:accountId/place-templates: those the caller can change. */
export async function listAccount(client: pg.ClientBase, accountId: string) {
  await requireAccount(client, accountId);
  const { rows } = await client.query<Row>(
    `${SELECT}
      WHERE t.owner_account_id = $1 AND t.archived_at IS NULL AND t.applies_to = 'place'
        AND ${EDITABLE}
      ORDER BY t.name COLLATE "und-u-kn-true", t.id`,
    [accountId],
  );
  return accountViewsOf(client, rows);
}

async function accountView(client: pg.ClientBase, id: string): Promise<AccountPlaceTemplate> {
  const { rows } = await client.query<Row>(`${SELECT} WHERE t.id = $1`, [id]);
  const [view] = await accountViewsOf(client, rows);
  if (!view) throw notFound();
  return view;
}

/** The audited image of a place template. */
async function imageOf(client: pg.ClientBase, id: string): Promise<Record<string, unknown>> {
  const { rows } = await client.query<{
    name: string;
    payload: Record<string, unknown>;
    location_ids: string[] | null;
  }>(
    `SELECT t.name, t.payload,
            (SELECT array_agg(tl.location_id ORDER BY tl.location_id)
               FROM public.template_locations tl WHERE tl.template_id = t.id) AS location_ids
       FROM public.templates t WHERE t.id = $1`,
    [id],
  );
  const r = rows[0];
  if (!r) throw notFound();
  return {
    applies_to: 'place',
    name: r.name,
    payload: r.payload,
    location_ids: r.location_ids ?? [],
  };
}

/** 400 unless both kinds are offered in the account. */
async function checkKinds(client: pg.ClientBase, accountId: string, keys: readonly string[]) {
  for (const key of new Set(keys)) await requireKind(client, accountId, key);
}

const payloadOf = (b: PlaceTemplatePayload): PlaceTemplatePayload => ({
  layout: b.layout,
  kindKey: b.kindKey,
  compartmentKindKey: b.compartmentKindKey,
  compartmentName: b.compartmentName,
  ...(b.codePattern ? { codePattern: b.codePattern } : {}),
});

/** POST /api/v1/accounts/:accountId/place-templates → 201 AccountPlaceTemplate. */
export async function createPlaceTemplate(
  ctx: WriteCtx,
  accountId: string,
  body: CreatePlaceTemplateBody,
): Promise<AccountPlaceTemplate> {
  const { client } = ctx;
  await requireAccount(client, accountId, 'registries-types.manage', MANAGE_HINT);
  const id = body.id ? assertClientId(body.id) : newId();
  const locationIds = await checkLocations(client, accountId, body.locationIds);
  await checkKinds(client, accountId, [body.kindKey, body.compartmentKindKey]);
  await client.query(
    `INSERT INTO public.templates (id, owner_account_id, name, type_id, payload, applies_to,
                                   created_by)
     VALUES ($1, $2, $3, NULL, $4, 'place', $5)`,
    [id, accountId, body.name, JSON.stringify(payloadOf(body)), ctx.userId],
  );
  await client.query(
    `INSERT INTO public.template_locations (template_id, owner_account_id, location_id)
     SELECT $1, $2, x FROM unnest($3::uuid[]) AS x`,
    [id, accountId, locationIds],
  );
  await auditRegistry(ctx.tx, {
    accountId,
    userId: ctx.userId,
    action: 'template.create',
    entity: { type: 'template', id },
    after: await imageOf(client, id),
    requestId: ctx.requestId,
  });
  return accountView(client, id);
}

/** The place template, locked, once the caller may change it (404 when invisible or a thing
 * template, 403 when they don't administer every location it is shared with). */
async function editable(client: pg.ClientBase, id: string): Promise<Row> {
  const { rows } = await client.query<Row & { can_edit: boolean }>(
    `SELECT t.id, t.owner_account_id, t.name, t.payload, t.row_version, (${EDITABLE}) AS can_edit
       FROM public.templates t
      WHERE t.id = $1 AND t.archived_at IS NULL AND t.applies_to = 'place'`,
    [id],
  );
  const seen = rows[0];
  if (!seen) throw notFound();
  await requireAccount(client, seen.owner_account_id, 'registries-types.manage', MANAGE_HINT);
  if (!seen.can_edit)
    throw forbidden('Only admins of every location it is shared with can change it.');
  const { rows: locked } = await client.query<{ row_version: number }>(
    'SELECT row_version FROM public.templates WHERE id = $1 FOR UPDATE',
    [id],
  );
  if (!locked[0]) throw notFound();
  return { ...seen, row_version: locked[0].row_version };
}

/** PATCH /api/v1/place-templates/:id (If-Match) → AccountPlaceTemplate. */
export async function updatePlaceTemplate(
  ctx: WriteCtx,
  id: string,
  expected: number,
  body: UpdatePlaceTemplateBody,
): Promise<AccountPlaceTemplate> {
  const { client } = ctx;
  const row = await editable(client, id);
  if (row.row_version !== expected) {
    checkVersion(
      { rowVersion: row.row_version },
      expected,
      Object.keys(body),
      await registryChangedBy(client, 'template', id),
    );
  }
  const accountId = row.owner_account_id;
  const before = await imageOf(client, id);
  const stored = PlaceTemplatePayload.safeParse(row.payload);
  if (!stored.success) throw conflict('This template can’t be read. Delete it and make it again.');
  const next: PlaceTemplatePayload = {
    ...stored.data,
    ...(body.layout ? { layout: body.layout } : {}),
    ...(body.kindKey ? { kindKey: body.kindKey } : {}),
    ...(body.compartmentKindKey ? { compartmentKindKey: body.compartmentKindKey } : {}),
    ...(body.compartmentName ? { compartmentName: body.compartmentName } : {}),
    ...(body.codePattern !== undefined ? { codePattern: body.codePattern } : {}),
  };
  if (body.kindKey || body.compartmentKindKey) {
    await checkKinds(client, accountId, [next.kindKey, next.compartmentKindKey]);
  }
  await client.query(
    'UPDATE public.templates SET name = coalesce($2, name), payload = $3 WHERE id = $1',
    [id, body.name ?? null, JSON.stringify(payloadOf(next))],
  );
  if (body.locationIds) {
    const locations = await checkLocations(client, accountId, body.locationIds);
    await client.query(
      `DELETE FROM public.template_locations
        WHERE template_id = $1 AND NOT (location_id = ANY ($2::uuid[]))`,
      [id, locations],
    );
    await client.query(
      `INSERT INTO public.template_locations (template_id, owner_account_id, location_id)
       SELECT $1, $2, x FROM unnest($3::uuid[]) AS x
       ON CONFLICT (template_id, location_id) DO NOTHING`,
      [id, accountId, locations],
    );
  }
  await auditRegistry(ctx.tx, {
    accountId,
    userId: ctx.userId,
    action: 'template.update',
    entity: { type: 'template', id },
    before,
    after: await imageOf(client, id),
    requestId: ctx.requestId,
  });
  return accountView(client, id);
}

/** DELETE /api/v1/place-templates/:id → 204. Furniture made from it stays as it is. */
export async function deletePlaceTemplate(ctx: WriteCtx, id: string): Promise<void> {
  const { client } = ctx;
  const row = await editable(client, id);
  const before = await imageOf(client, id);
  await client.query('DELETE FROM public.templates WHERE id = $1', [id]);
  await auditRegistry(ctx.tx, {
    accountId: row.owner_account_id,
    userId: ctx.userId,
    action: 'template.delete',
    entity: { type: 'template', id },
    before,
    requestId: ctx.requestId,
  });
}

// ---------------------------------------------------------------------------------------------
// Making furniture
// ---------------------------------------------------------------------------------------------

export const FromTemplateBody = z.strictObject({
  /** The furniture's id (the web makes it, as for a place). */
  id: z.uuid().optional(),
  parentId: z.uuid().nullable().optional(),
  template: z.union([
    z.strictObject({ builtin: z.enum(BUILTIN_PLACE_TEMPLATE_KEYS) }),
    z.strictObject({ id: z.uuid() }),
  ]),
  name: NAME,
  /** How the unit stands; a grid that isn't square can lie on its side. */
  orientation: z.enum(PLACE_ORIENTATIONS).optional(),
  /** Levels or drawers: how many (the template's otherwise). */
  count: Whole.min(1).optional(),
  /** The compartments' names, e.g. "Cube {n}" (the template's, else the layout's default). */
  compartmentName: NamePattern.optional(),
  /** The furniture's own code, `{parent}` in the code pattern. */
  code: z.string().min(1).max(200).optional(),
  /** The compartments' codes (the template's when left out; null: none). */
  codePattern: CodePattern.nullable().optional(),
});
export type FromTemplateBody = z.infer<typeof FromTemplateBody>;

export const CompartmentSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  n: z.number().int(),
  row: z.number().int(),
  col: z.number().int(),
  code: z.string().nullable(),
});
export type CompartmentOut = z.infer<typeof CompartmentSchema>;

type Source = {
  ref: string;
  layout: PlaceLayout;
  kindKey: string;
  compartmentKindKey: string;
  compartmentName: string | null;
  codePattern: string | null;
};

async function sourceOf(
  client: pg.ClientBase,
  locationId: string,
  template: FromTemplateBody['template'],
): Promise<Source> {
  if ('builtin' in template) {
    const b = builtinPlaceTemplate(template.builtin);
    if (!b) throw invalid('Check body.template: there is no such built-in template.');
    return {
      ref: b.key,
      layout: b.layout,
      kindKey: b.kindKey,
      compartmentKindKey: b.compartmentKindKey,
      compartmentName: null,
      codePattern: null,
    };
  }
  const id = template.id.toLowerCase();
  const { rows } = await client.query<Row>(
    `${SELECT}
      WHERE t.id = $1 AND t.archived_at IS NULL AND t.applies_to = 'place'
        AND EXISTS (SELECT 1 FROM public.template_locations tl
                     WHERE tl.template_id = t.id AND tl.location_id = $2
                       AND tl.location_id IN (SELECT kept.writable_location_ids()))`,
    [id, locationId],
  );
  const row = rows[0];
  const view = row ? viewOf(row) : null;
  if (!view) throw notFound();
  return {
    ref: view.id,
    layout: view.layout,
    kindKey: view.kindKey,
    compartmentKindKey: view.compartmentKindKey,
    compartmentName: view.compartmentName,
    codePattern: view.codePattern,
  };
}

type Failed = { code: string; reason: 'rule' | 'duplicate' | 'taken' };

const refuse = (
  status: 400 | 409,
  hint: string,
  failed: Failed,
  extra: Record<string, unknown> = {},
) => new AppError(status === 400 ? 'validation' : 'conflict', status, hint, { failed, ...extra });

/**
 * The own codes in order (the furniture's first, if any), each as stored, checked against the
 * location's rule, against each other and against the location's codes: the first that fails
 * is refused by name.
 */
async function checkAllCodes(
  client: pg.ClientBase,
  locationId: string,
  codes: readonly string[],
): Promise<void> {
  if (codes.length === 0) return;
  const rule = await ruleFor(client, locationId);
  if (rule) {
    const verdicts = checkCodes(rule, codes);
    const i = verdicts.findIndex((v) => v !== 'ok');
    if (i >= 0) {
      const code = codes[i] as string;
      const why =
        verdicts[i] === 'slow' ? 'the format rule took too long to check it.' : rule.message;
      throw refuse(
        400,
        `${code}: ${why}`,
        { code, reason: 'rule' },
        { rule: { message: rule.message, example: rule.example } },
      );
    }
  }
  const seen = new Set<string>();
  for (const code of codes) {
    if (seen.has(code)) {
      throw refuse(400, `${code} would be on two places here. Change the code pattern.`, {
        code,
        reason: 'duplicate',
      });
    }
    seen.add(code);
  }
  const { rows } = await client.query<{ code: string }>(
    'SELECT code FROM public.legacy_codes WHERE location_id = $1 AND code = ANY ($2::text[])',
    [locationId, codes],
  );
  if (rows.length > 0) {
    const taken = new Set(rows.map((r) => r.code));
    const code = codes.find((c) => taken.has(c)) as string;
    throw refuse(409, `${code} is already on something else here.`, { code, reason: 'taken' });
  }
}

export type MadeFurniture = { place: PlaceRow; compartments: CompartmentOut[] };

/** POST /api/v1/locations/:locationId/places/from-template → the furniture and its compartments. */
export async function createFromTemplate(
  c: Ctx,
  locationId: string,
  body: FromTemplateBody,
): Promise<MadeFurniture> {
  const me = await requireMembership(c.client, locationId);
  requireCan(me.role, 'things.edit');
  const { rows: loc } = await c.client.query<{ owner_account_id: string }>(
    'SELECT owner_account_id FROM public.locations WHERE id = $1',
    [locationId],
  );
  const accountId = loc[0]?.owner_account_id;
  if (!accountId) throw notFound();
  const source = await sourceOf(c.client, locationId, body.template);

  if (body.count !== undefined && source.layout.kind === 'grid') {
    throw invalid('Check body.count: only levels and drawers take a count.');
  }
  const layout = withCount(source.layout, body.count);
  const problem = layoutProblem(layout);
  if (problem) throw invalid(`Check body.count: ${problem}`);
  const orientation: PlaceOrientation = body.orientation ?? 'upright';
  if (orientation === 'side' && !canTurn(layout)) {
    throw invalid('Check body.orientation: only a grid that isn’t square can lie on its side.');
  }
  const namePattern =
    body.compartmentName ?? source.compartmentName ?? DEFAULT_COMPARTMENT_NAMES[layout.kind];
  const codePattern = body.codePattern !== undefined ? body.codePattern : source.codePattern;
  const parentCode = body.code === undefined ? null : codeOf(body.code);
  if (codePattern && usesParent(codePattern) && !parentCode) {
    throw invalid('Give the furniture its own code: the compartments’ codes start with it.');
  }
  await checkKinds(c.client, accountId, [source.kindKey, source.compartmentKindKey]);

  const id = body.id ? assertClientId(body.id) : newId();
  const parentId = body.parentId ? body.parentId.toLowerCase() : null;
  await lockTree(c.client, locationId);
  if (parentId) {
    const parent = await requireParent(c.client, locationId, parentId);
    if (parent.isUnplaced) throw conflict(UNDER_UNPLACED);
  }

  const cells: (CompartmentCell & { id: string; name: string; code: string | null })[] = cellsOf(
    layout,
    orientation,
  ).map((cell) => {
    const name = fillPattern(namePattern, cell).trim();
    if (name.length === 0 || name.length > 120) {
      throw invalid('Check body.compartmentName: each name is 1 to 120 characters.');
    }
    const code = codePattern
      ? codeOf(fillPattern(codePattern, { ...cell, parent: parentCode }), 'derived code')
      : null;
    return { ...cell, id: newId(), name, code };
  });
  const codes = [
    ...(parentCode ? [parentCode] : []),
    ...cells.flatMap((x) => (x.code ? [x.code] : [])),
  ];
  await checkAllCodes(c.client, locationId, codes);

  // What it was made with, so turning it later can renumber it the same way (#238 point 3).
  const stands: Record<string, unknown> = {
    ...layout,
    orientation,
    compartmentName: namePattern,
    codePattern: codePattern ?? null,
  };
  await c.client.query(
    `INSERT INTO public.places (id, location_id, parent_id, name, kind_key, sort, child_order,
                                layout, created_by)
     VALUES ($1, $2, $3, $4, $5, 0, 'custom', $6, $7)`,
    [id, locationId, parentId, body.name, source.kindKey, JSON.stringify(stands), c.scope.userId],
  );
  await lastInCustomOrder(c.client, id);
  await c.client.query(
    `INSERT INTO public.places (id, location_id, parent_id, name, kind_key, sort, cell,
                                created_by)
     SELECT x.id, $1, $2, x.name, $3, x.sort, x.cell, $4
       FROM unnest($5::uuid[], $6::text[], $7::int[], $8::jsonb[]) AS x(id, name, sort, cell)`,
    [
      locationId,
      id,
      source.compartmentKindKey,
      c.scope.userId,
      cells.map((x) => x.id),
      cells.map((x) => x.name),
      cells.map((x) => x.n - 1),
      cells.map((x) => JSON.stringify({ row: x.row, col: x.col })),
    ],
  );
  const owned = [
    ...(parentCode ? [{ code: parentCode, placeId: id }] : []),
    ...cells.flatMap((x) => (x.code ? [{ code: x.code, placeId: x.id }] : [])),
  ];
  if (owned.length > 0) {
    await c.client.query('SAVEPOINT furniture_codes');
    try {
      await c.client.query(
        `INSERT INTO public.legacy_codes (location_id, source, source_collection, code, place_id)
         SELECT $1, 'own', '', x.code, x.place_id
           FROM unnest($2::text[], $3::uuid[]) AS x(code, place_id)`,
        [locationId, owned.map((o) => o.code), owned.map((o) => o.placeId)],
      );
      await c.client.query('RELEASE SAVEPOINT furniture_codes');
    } catch (err) {
      await c.client.query('ROLLBACK TO SAVEPOINT furniture_codes');
      if (pgErrorOf(err)?.code === '23505') {
        throw conflict('One of these codes was just given to something else here. Try again.');
      }
      throw err;
    }
  }

  const created = await requirePlace(c.client, id);
  await audited(c.tx, {
    locationId,
    actor: actorOf(c.scope),
    action: 'place.create',
    entity: { type: 'place', id },
    after: {
      name: created.name,
      parent_id: created.parentId,
      kind_key: created.kindKey,
      icon: created.icon,
      template: source.ref,
      layout: stands,
      compartments: cells.map((x) => x.id),
      own_codes: owned.map((o) => o.code),
    },
    requestId: c.requestId,
    undoableUntil: undoableUntil(),
  });
  return {
    place: created,
    compartments: cells.map((x) => ({
      id: x.id,
      name: x.name,
      n: x.n,
      row: x.row,
      col: x.col,
      code: x.code,
    })),
  };
}

// ---------------------------------------------------------------------------------------------
// Undo
// ---------------------------------------------------------------------------------------------

/**
 * Undo of furniture made from a template (`place.create` naming `compartments`): the furniture
 * and its compartments go to the trash as one batch, so restoring the furniture brings them all
 * back, and the own codes they were given are freed, so the same codes can be used again.
 * Refused (409, nothing changed) while any of them holds a thing or a place it didn't come with,
 * is in the trash, or has an event after this one (renamed, moved, labelled, coded).
 */
export async function undoFurnitureCreate(args: UndoArgs): Promise<void> {
  const { client, event } = args;
  const id = event.entityId;
  const made = event.diff.compartments?.after;
  if (event.entityType !== 'place' || !id || !Array.isArray(made)) throw notUndoable();
  const ids = [id, ...made.filter((x): x is string => typeof x === 'string')];
  requireCan(args.role, 'things.edit');
  await lockTree(client, event.locationId);
  const { rows } = await client.query<{ id: string; deleted: boolean }>(
    `SELECT p.id, p.deleted_at IS NOT NULL AS deleted FROM public.places p
      WHERE p.id = ANY ($1::uuid[]) AND p.location_id = $2 FOR UPDATE OF p`,
    [ids, event.locationId],
  );
  if (rows.length !== ids.length)
    throw conflict("Can't undo: some of those places no longer exist.");
  if (rows.some((r) => r.deleted)) throw undoConflict(['deleted_at']);
  const { rows: holds } = await client.query<{ n: number }>(
    `SELECT ((SELECT count(*) FROM public.things t
               WHERE t.place_id = ANY ($1::uuid[]) AND t.deleted_at IS NULL)
           + (SELECT count(*) FROM public.places k
               WHERE k.parent_id = ANY ($1::uuid[]) AND k.deleted_at IS NULL
                 AND NOT (k.id = ANY ($1::uuid[]))))::int AS n`,
    [ids],
  );
  if ((holds[0]?.n ?? 0) > 0) throw undoConflict(['contents']);
  const { rows: later } = await client.query<{ entity_id: string }>(
    `SELECT e.entity_id FROM public.audit_events e
      WHERE e.location_id = $1 AND e.entity_type = 'place' AND e.entity_id = ANY ($2::uuid[])
        AND e.at > $3
      ORDER BY e.at LIMIT 1`,
    [event.locationId, ids, event.at],
  );
  const changed = later[0]?.entity_id;
  if (changed) {
    throw undoConflict(
      ['place'],
      await lastChangedBy(client, event.locationId, { type: 'place', id: changed }, event.at),
    );
  }
  const { rows: freed } = await client.query<{ code: string }>(
    `DELETE FROM public.legacy_codes
      WHERE place_id = ANY ($1::uuid[]) AND source = 'own' AND source_collection = ''
      RETURNING code`,
    [ids],
  );
  const trashBatchId = newId();
  await client.query(
    `UPDATE public.places SET deleted_at = now(), trash_batch_id = $2 WHERE id = ANY ($1::uuid[])`,
    [ids, trashBatchId],
  );
  const { rows: stamped } = await client.query<{ deleted_at: Date }>(
    'SELECT deleted_at FROM public.places WHERE id = $1',
    [id],
  );
  await args.audit({
    action: 'place.trash',
    entity: { type: 'place', id },
    before: { deleted_at: null, trash_batch_id: null, own_codes: freed.map((r) => r.code).sort() },
    after: {
      deleted_at: stamped[0]?.deleted_at ?? new Date(),
      trash_batch_id: trashBatchId,
      own_codes: [],
    },
  });
}
