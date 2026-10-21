import { KIT_LIMITS } from '@kept/shared';
import type pg from 'pg';
import { z } from 'zod';
import { actorOf } from '../audit/actor.js';
import { audited } from '../audit/audited.js';
import {
  lastChangedBy,
  notUndoable,
  registerUndo,
  type UndoArgs,
  undoableUntil,
  undoConflict,
} from '../audit/undo.js';
import type { Scope, Tx } from '../db/scope.js';
import { checkVersion } from '../http/conventions.js';
import { AppError, conflict, invalid, notFound } from '../http/errors.js';
import { liveThing, requireRole, writableThing } from '../things/service.js';

// Kits (1.14, #170): a container with a parts list, what *should* be in it, so that moving a part
// out, lending the kit or losing a part never makes the box forget it.
//
// - Make a kit of a container (its contents ticked as parts, with quantities), or of an empty one
//   and add parts; edit the parts; dissolve it. Each is one audited event (`kit.create`,
//   `kit.update`, `kit.dissolve`), undoable for 7 days while the parts are as it left them.
// - A part is a thing of the kit's location, never the kit itself, and in at most one kit (409
//   `in_another_kit`, naming it).
// - A part's status: in the kit (inside it, at any depth), elsewhere (where it is), missing (marked
//   not here), with someone (an open loan; the kit itself lent, its parts go with it) or in the
//   Trash. The kit is complete when every part is in it.
//
// Members and above edit (`things.edit`); everyone who sees the location reads.

export type Ctx = { tx: Tx; client: pg.PoolClient; scope: Scope; requestId: string };

export const KIT_PART_STATUSES = [
  'in_kit',
  'elsewhere',
  'missing',
  'with_someone',
  'trashed',
] as const;
export type KitPartStatus = (typeof KIT_PART_STATUSES)[number];

const Lent = z.object({
  handoverId: z.uuid(),
  person: z.string(),
  since: z.string(),
  dueOn: z.string().nullable(),
});

export const KitSchema = z.object({
  thingId: z.uuid(),
  locationId: z.uuid(),
  rowVersion: z.number(),
  parts: z.array(
    z.object({
      thing: z.object({
        id: z.uuid(),
        name: z.string().nullable(),
        shortCode: z.string().nullable(),
      }),
      quantity: z.string(),
      status: z.enum(KIT_PART_STATUSES),
      where: z.object({ id: z.uuid(), name: z.string() }).nullable(),
      with: Lent.nullable(),
    }),
  ),
  summary: z.object({
    parts: z.number(),
    inKit: z.number(),
    notInKit: z.number(),
    complete: z.boolean(),
  }),
  lent: Lent.nullable(),
});
export type Kit = z.infer<typeof KitSchema>;

export const KitBody = z.strictObject({
  parts: z
    .array(
      z.strictObject({
        thingId: z.uuid(),
        quantity: z
          .string()
          .regex(/^\d{1,9}(\.\d{1,3})?$/)
          .optional(),
      }),
    )
    .max(KIT_LIMITS.parts),
});
export type KitBody = z.infer<typeof KitBody>;

type Part = { thing_id: string; quantity: string };

async function partsOf(client: pg.ClientBase, kitId: string): Promise<Part[]> {
  const { rows } = await client.query<Part>(
    `SELECT thing_id, trim_scale(quantity)::text AS quantity FROM public.kit_parts
      WHERE kit_id = $1 ORDER BY thing_id`,
    [kitId],
  );
  return rows;
}

async function kitRow(
  client: pg.ClientBase,
  id: string,
  lock = false,
): Promise<{ thing_id: string; location_id: string; row_version: number } | null> {
  const { rows } = await client.query<{
    thing_id: string;
    location_id: string;
    row_version: number;
  }>(
    `SELECT thing_id, location_id, row_version FROM public.kits WHERE thing_id = $1${lock ? ' FOR UPDATE' : ''}`,
    [id],
  );
  return rows[0] ?? null;
}

/** Bumps the kit's thing row (its change id): the snapshot carries a kit's parts. */
async function touchKit(client: pg.ClientBase, kitId: string): Promise<void> {
  await client.query('UPDATE public.things SET updated_at = now() WHERE id = $1', [kitId]);
}

/** GET /api/v1/things/:id/kit: the kit and where each part is now; null when it isn't one. */
export async function kitView(client: pg.ClientBase, thingId: string): Promise<Kit | null> {
  await liveThing(client, thingId);
  const kit = await kitRow(client, thingId);
  if (!kit) return null;
  const { rows } = await client.query<{
    thing_id: string;
    name: string | null;
    code: string | null;
    quantity: string;
    trashed: boolean;
    uncertain: boolean;
    inside: boolean;
    where: { id: string; name: string } | null;
    lent: z.infer<typeof Lent> | null;
  }>(
    `WITH RECURSIVE inside(id, depth) AS (
       SELECT t.id, 1 FROM public.things t WHERE t.container_id = $1 AND t.deleted_at IS NULL
       UNION ALL
       SELECT t.id, i.depth + 1 FROM public.things t JOIN inside i ON t.container_id = i.id
        WHERE t.deleted_at IS NULL AND i.depth < 20)
     SELECT p.thing_id, t.name, sc.code, trim_scale(p.quantity)::text AS quantity,
            t.deleted_at IS NOT NULL AS trashed, t.location_uncertain AS uncertain,
            EXISTS (SELECT 1 FROM inside i WHERE i.id = p.thing_id) AS inside,
            CASE WHEN t.container_id IS NOT NULL
                   THEN (SELECT jsonb_build_object('id', b.id, 'name', coalesce(b.name, ''))
                           FROM public.things b WHERE b.id = t.container_id)
                 WHEN t.place_id IS NOT NULL
                   THEN (SELECT jsonb_build_object('id', pl.id, 'name', pl.name)
                           FROM public.places pl WHERE pl.id = t.place_id) END AS where,
            (SELECT jsonb_build_object('handoverId', o.handover_id,
                                       'person', coalesce(pe.display_name, ''),
                                       'since', o.started_at, 'dueOn', o.due_on)
               FROM public.loans o LEFT JOIN public.people pe ON pe.id = o.person_id
              WHERE o.thing_id = p.thing_id AND o.returned_at IS NULL AND o.direction = 'out'
              LIMIT 1) AS lent
       FROM public.kit_parts p
       JOIN public.things t ON t.id = p.thing_id
       LEFT JOIN public.short_ids sc
              ON sc.thing_id = t.id AND sc.is_primary AND sc.state = 'assigned'
      WHERE p.kit_id = $1
      ORDER BY t.name NULLS LAST, p.thing_id`,
    [thingId],
  );
  const { rows: self } = await client.query<{ lent: z.infer<typeof Lent> | null }>(
    `SELECT (SELECT jsonb_build_object('handoverId', o.handover_id,
                                       'person', coalesce(pe.display_name, ''),
                                       'since', o.started_at, 'dueOn', o.due_on)
               FROM public.loans o LEFT JOIN public.people pe ON pe.id = o.person_id
              WHERE o.thing_id = $1 AND o.returned_at IS NULL AND o.direction = 'out'
              LIMIT 1) AS lent`,
    [thingId],
  );
  const iso = (l: z.infer<typeof Lent> | null) =>
    l ? { ...l, since: new Date(l.since).toISOString() } : null;
  const parts = rows.map((r) => {
    const status: KitPartStatus = r.trashed
      ? 'trashed'
      : r.lent
        ? 'with_someone'
        : r.inside
          ? 'in_kit'
          : r.uncertain
            ? 'missing'
            : 'elsewhere';
    return {
      thing: { id: r.thing_id, name: r.name, shortCode: r.code },
      quantity: r.quantity,
      status,
      where: r.where,
      with: iso(r.lent),
    };
  });
  // Lent with the kit, a part inside it is still "in the kit".
  const kitLent = iso(self[0]?.lent ?? null);
  const inKit = parts.filter(
    (p) =>
      p.status === 'in_kit' ||
      (p.status === 'with_someone' && kitLent && p.with?.handoverId === kitLent.handoverId),
  ).length;
  return {
    thingId: kit.thing_id,
    locationId: kit.location_id,
    rowVersion: kit.row_version,
    parts,
    summary: {
      parts: parts.length,
      inKit,
      notInKit: parts.length - inKit,
      complete: parts.length > 0 && inKit === parts.length,
    },
    lent: kitLent,
  };
}

/** The parts asked for: things of the kit's location, never the kit, in no other kit. */
async function checkParts(
  client: pg.ClientBase,
  kit: { id: string; location_id: string },
  parts: KitBody['parts'],
): Promise<Part[]> {
  const ids = parts.map((p) => p.thingId.toLowerCase());
  if (new Set(ids).size !== ids.length) throw invalid('Check body.parts: each thing once.');
  if (ids.includes(kit.id)) throw invalid("Check body.parts: a kit isn't a part of itself.");
  if (ids.length === 0) return [];
  const { rows } = await client.query<{ id: string; location_id: string; deleted: boolean }>(
    `SELECT id, location_id, deleted_at IS NOT NULL AS deleted FROM public.things
      WHERE id = ANY ($1::uuid[])`,
    [ids],
  );
  const found = new Map(rows.map((r) => [r.id, r]));
  for (const id of ids) {
    const r = found.get(id);
    if (!r || r.deleted) throw notFound();
    if (r.location_id !== kit.location_id)
      throw invalid('Check body.parts: a kit’s parts are in its location.');
  }
  const { rows: taken } = await client.query<{ thing_id: string; name: string | null }>(
    `SELECT p.thing_id, k.name FROM public.kit_parts p JOIN public.things k ON k.id = p.kit_id
      WHERE p.thing_id = ANY ($1::uuid[]) AND p.kit_id <> $2`,
    [ids, kit.id],
  );
  if (taken[0]) {
    throw new AppError(
      'in_another_kit',
      409,
      `It is a part of ${taken[0].name ?? 'another kit'}.`,
      {
        thingId: taken[0].thing_id,
        kit: taken[0].name,
      },
    );
  }
  for (const p of parts) {
    if (p.quantity !== undefined && !(Number(p.quantity) > 0))
      throw invalid('Check body.parts: a quantity more than 0.');
  }
  return parts
    .map((p) => ({ thing_id: p.thingId.toLowerCase(), quantity: p.quantity ?? '1' }))
    .sort((a, b) => a.thing_id.localeCompare(b.thing_id));
}

async function writeParts(
  client: pg.ClientBase,
  kitId: string,
  locationId: string,
  parts: readonly Part[],
): Promise<void> {
  // The kit's own row changes too, so the phones' snapshot sends its parts again.
  await touchKit(client, kitId);
  await client.query('DELETE FROM public.kit_parts WHERE kit_id = $1', [kitId]);
  if (parts.length === 0) return;
  await client.query(
    `INSERT INTO public.kit_parts (kit_id, location_id, thing_id, quantity)
     SELECT $1, $2, x.thing_id, x.quantity
       FROM unnest($3::uuid[], $4::numeric[]) x(thing_id, quantity)`,
    [kitId, locationId, parts.map((p) => p.thing_id), parts.map((p) => p.quantity)],
  );
}

async function auditKit(
  ctx: Ctx,
  action: 'kit.create' | 'kit.update' | 'kit.dissolve',
  kit: { id: string; location_id: string },
  before: Part[] | null,
  after: Part[] | null,
): Promise<void> {
  const ids = new Set([...(before ?? []), ...(after ?? [])].map((p) => p.thing_id));
  await audited(ctx.tx, {
    locationId: kit.location_id,
    actor: actorOf(ctx.scope),
    action,
    entity: { type: 'thing', id: kit.id },
    before: before ? { kit: true, parts: before } : null,
    after: after ? { kit: true, parts: after } : null,
    subjects: [kit.id, ...ids],
    rootThingId: kit.id,
    requestId: ctx.requestId,
    undoableUntil: undoableUntil(),
  });
}

/** POST /api/v1/things/:id/kit {parts} → 201 Kit: makes the container a kit. */
export async function makeKit(ctx: Ctx, thingId: string, body: KitBody): Promise<Kit> {
  const { client } = ctx;
  const thing = await writableThing(client, thingId, 'things.edit');
  if (await kitRow(client, thingId)) throw conflict('It is a kit already.');
  const { rowCount } = await client.query('SELECT 1 FROM public.kit_parts WHERE thing_id = $1', [
    thingId,
  ]);
  if (rowCount) throw new AppError('in_another_kit', 409, 'It is a part of another kit.');
  const kit = { id: thingId, location_id: thing.location_id };
  const parts = await checkParts(client, kit, body.parts);
  await client.query(
    `INSERT INTO public.kits (thing_id, location_id, created_by)
     VALUES ($1, $2, kept.current_user_id())`,
    [thingId, thing.location_id],
  );
  await writeParts(client, thingId, thing.location_id, parts);
  await auditKit(ctx, 'kit.create', kit, null, parts);
  return (await kitView(client, thingId)) as Kit;
}

async function writableKit(ctx: Ctx, thingId: string, expected: number | null) {
  const thing = await liveThing(ctx.client, thingId);
  await requireRole(ctx.client, thing.location_id, 'things.edit');
  const kit = await kitRow(ctx.client, thingId, true);
  if (!kit) throw notFound();
  if (expected !== null && kit.row_version !== expected) {
    const by = await lastChangedBy(ctx.client, kit.location_id, { type: 'thing', id: thingId });
    checkVersion(
      { rowVersion: kit.row_version },
      expected,
      ['parts'],
      by ? { displayName: by } : null,
    );
  }
  return { id: thingId, location_id: kit.location_id };
}

/** PUT /api/v1/things/:id/kit (If-Match) {parts} → Kit: its parts, all of them. */
export async function updateKit(
  ctx: Ctx,
  thingId: string,
  expected: number,
  body: KitBody,
): Promise<Kit> {
  const kit = await writableKit(ctx, thingId, expected);
  const before = await partsOf(ctx.client, thingId);
  const parts = await checkParts(ctx.client, kit, body.parts);
  await writeParts(ctx.client, thingId, kit.location_id, parts);
  await ctx.client.query('UPDATE public.kits SET updated_at = now() WHERE thing_id = $1', [
    thingId,
  ]);
  await auditKit(ctx, 'kit.update', kit, before, parts);
  return (await kitView(ctx.client, thingId)) as Kit;
}

/** DELETE /api/v1/things/:id/kit → 204: no longer a kit (the things stay as they are). */
export async function dissolveKit(ctx: Ctx, thingId: string): Promise<void> {
  const kit = await writableKit(ctx, thingId, null);
  const before = await partsOf(ctx.client, thingId);
  await ctx.client.query('DELETE FROM public.kits WHERE thing_id = $1', [thingId]);
  await touchKit(ctx.client, thingId);
  await auditKit(ctx, 'kit.dissolve', kit, before, null);
}

/** GET /api/v1/locations/:id/kits?incomplete: the location's kits, with how complete each is. */
export async function listKits(
  client: pg.ClientBase,
  locationId: string,
  incomplete: boolean,
): Promise<{ items: { thing: { id: string; name: string | null }; summary: Kit['summary'] }[] }> {
  const { rows } = await client.query<{ thing_id: string; name: string | null }>(
    `SELECT k.thing_id, t.name FROM public.kits k JOIN public.things t ON t.id = k.thing_id
      WHERE k.location_id = $1 AND t.deleted_at IS NULL ORDER BY t.name NULLS LAST, k.thing_id`,
    [locationId],
  );
  const items = [];
  for (const r of rows) {
    const kit = await kitView(client, r.thing_id);
    if (!kit || (incomplete && kit.summary.complete)) continue;
    items.push({ thing: { id: r.thing_id, name: r.name }, summary: kit.summary });
  }
  return { items };
}

// ----- undo --------------------------------------------------------------------------------------

type Diff = UndoArgs['event']['diff'];
const side = (diff: Diff, k: 'before' | 'after') =>
  (diff.parts?.[k] as Part[] | null | undefined) ?? null;

const same = (a: readonly Part[], b: readonly Part[]) =>
  a.length === b.length &&
  a.every((p, i) => p.thing_id === b[i]?.thing_id && Number(p.quantity) === Number(b[i]?.quantity));

async function undoKit(args: UndoArgs): Promise<void> {
  const { client, event } = args;
  const id = event.entityId;
  if (event.entityType !== 'thing' || !id) throw notUndoable();
  const before = side(event.diff, 'before');
  const after = side(event.diff, 'after');
  const kit = await kitRow(client, id, true);
  const now = kit ? await partsOf(client, id) : null;
  // As the event left it: a kit with exactly these parts, or (dissolved) none.
  const intact = after === null ? kit === null : !!now && same(now, after);
  if (!intact) {
    const who = await lastChangedBy(client, event.locationId, { type: 'thing', id }, event.at);
    throw undoConflict(['parts'], who);
  }
  if (before === null) {
    await client.query('DELETE FROM public.kits WHERE thing_id = $1', [id]);
    await touchKit(client, id);
  } else {
    if (!kit) {
      const { rows: t } = await client.query<{ location_id: string }>(
        'SELECT location_id FROM public.things WHERE id = $1 AND deleted_at IS NULL',
        [id],
      );
      if (!t[0] || t[0].location_id !== event.locationId)
        throw conflict("Can't undo: the kit is gone.");
      await client.query(
        `INSERT INTO public.kits (thing_id, location_id, created_by)
         VALUES ($1, $2, kept.current_user_id())`,
        [id, event.locationId],
      );
    }
    const { rows: taken } = await client.query<{ thing_id: string }>(
      `SELECT thing_id FROM public.kit_parts WHERE thing_id = ANY ($1::uuid[]) AND kit_id <> $2`,
      [before.map((p) => p.thing_id), id],
    );
    if (taken.length > 0) throw conflict("Can't undo: a part is in another kit now.");
    const { rows: gone } = await client.query<{ id: string }>(
      'SELECT id FROM public.things WHERE id = ANY ($1::uuid[])',
      [before.map((p) => p.thing_id)],
    );
    const live = new Set(gone.map((g) => g.id));
    await writeParts(
      client,
      id,
      event.locationId,
      before.filter((p) => live.has(p.thing_id)),
    );
  }
  await args.audit({
    action: event.action as 'kit.create',
    entity: { type: 'thing', id },
    before: after ? { kit: true, parts: after } : null,
    after: before ? { kit: true, parts: before } : null,
    subjects: [id],
    rootThingId: id,
  });
}

let registered = false;

export function registerKitUndo(): void {
  if (registered) return;
  registered = true;
  registerUndo('kit.create', undoKit);
  registerUndo('kit.update', undoKit);
  registerUndo('kit.dissolve', undoKit);
}
