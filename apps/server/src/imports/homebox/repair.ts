/**
 * Repairing a Homebox import that already ran (1.13.0), from what it stored: its report
 * (`import_runs.dry_run_report`) and what it made (`import_source_ids`). Imports before 1.13.0
 * turned a quantity of 0 into 1, gave a whole created type the container capability when one of
 * its items held another, and could create a type named `global.item`; imports before 1.14.2
 * ended a thing sold on a sold date alone (#346). Four repairs, each chosen on its own:
 * - `zero`: the things whose report row says `hb_quantity_zero` (0 in Homebox, imported as 1),
 *   still in use with quantity 1, are archived; never a location that became a thing, nor a
 *   thing holding others;
 * - `containerTypes`: the types this run created (during the run, recorded under its id) that
 *   still have the container capability lose it. A thing with contents stays a container: in Kept
 *   a thing that holds things is one;
 * - `names`: the types this run created still named `global.item` or `global.location` are
 *   renamed, to the words the person reads ("Item" and "Location" in their language);
 * - `sold`: the things this run ended sold with no buyer and no price (none in the notes either,
 *   where a price went when money was off), whose lifecycle nobody has changed since, are brought
 *   back into use.
 *
 * GET  /api/v1/imports/:id/repair  → RepairPlan (what each repair would touch, by name)
 * POST /api/v1/imports/:id/repair  {zero?, containerTypes?, names?: {item, location}, sold?}
 *                                   → result
 *
 * Who: the location's owners and admins (`location.export-import`, as for the import). Undo: the
 * archived and unsold things each write an undoable `thing.lifecycle`, and the type changes one undoable
 * `import.repair` event on the run; the web undoes them together (POST /audit/undo), so the whole
 * repair has one Undo. The repair's own audit row names the things and types it changed.
 */
import { homeboxTypeName } from '@kept/shared';
import type pg from 'pg';
import { z } from 'zod';
import { audited } from '../../audit/audited.js';
import { registerUndo, type UndoArgs, undoableUntil, undoConflict } from '../../audit/undo.js';
import type { Scope, Tx } from '../../db/scope.js';
import type { KeptApp } from '../../http/app.js';
import { conflict, invalid } from '../../http/errors.js';
import type { InventoryDeps } from '../../http/routes.js';
import { scopedRead, scopedWrite } from '../../http/write.js';
import type { JobQueue } from '../../jobs/queue.js';
import type { FileStorage } from '../../storage/blob-store.js';
import { setLifecycle } from '../../things/service.js';
import { updateType } from '../../types/service.js';
import type { UpdateTypeBody } from '../../types/view.js';
import { workableRun } from '../archive.js';
import type { ArchiveRunRow } from '../archive-types.js';
import { soldNoteLines } from './plan.js';

/** A thing's notes hold at most this many characters (things/validate.ts). */
const NOTES_MAX = 5000;

export type RepairPlan = {
  zero: { thingId: string; name: string }[];
  containerTypes: { typeId: string; name: string }[];
  renames: { typeId: string; name: string; to: 'item' | 'location' }[];
  sold: { thingId: string; name: string }[];
};

const Params = z.object({ id: z.uuid() });
const Name = z.string().trim().min(1).max(80);
const RepairBody = z.strictObject({
  zero: z.boolean().optional(),
  containerTypes: z.boolean().optional(),
  names: z.strictObject({ item: Name, location: Name }).optional(),
  sold: z.boolean().optional(),
});
type RepairBody = z.infer<typeof RepairBody>;

const PlanView = z.object({
  zero: z.array(z.object({ thingId: z.uuid(), name: z.string() })),
  containerTypes: z.array(z.object({ typeId: z.uuid(), name: z.string() })),
  renames: z.array(
    z.object({ typeId: z.uuid(), name: z.string(), to: z.enum(['item', 'location']) }),
  ),
  sold: z.array(z.object({ thingId: z.uuid(), name: z.string() })),
});
const RepairResult = z.object({
  repaired: z.object({ things: z.number().int(), types: z.number().int() }),
  plan: PlanView,
});

const RAW = { 'global.item': 'item', 'global.location': 'location' } as const;

/** The run, when it is a Homebox import that ran into a location the caller administers. */
async function repairableRun(client: pg.ClientBase, id: string, lock = false) {
  const run = await workableRun(client, id, lock);
  if (run.source !== 'homebox_zip' || !run.location_id || !run.started_at) {
    throw conflict('Only a Homebox import that ran can be repaired.');
  }
  return run as ArchiveRunRow & { location_id: string; started_at: Date };
}

/** The Homebox ids whose report row says quantity 0 became 1, items only: a location that
 * became a thing (inside an item, or chosen as a box) had no quantity of its own. */
function zeroIds(report: unknown): string[] {
  const rows = (report as { rows?: unknown } | null)?.rows;
  if (!Array.isArray(rows)) return [];
  const out: string[] = [];
  for (const row of rows as { ref?: { kind?: string; id?: string }; issues?: unknown }[]) {
    const issues = Array.isArray(row.issues) ? (row.issues as { code?: string }[]) : [];
    if (row.ref?.kind !== 'entity' || typeof row.ref.id !== 'string') continue;
    const location = issues.some(
      (i) => i.code === 'hb_location_in_item' || i.code === 'hb_box_from_location',
    );
    if (!location && issues.some((i) => i.code === 'hb_quantity_zero')) out.push(row.ref.id);
  }
  return out;
}

/** What each repair would change now. */
export async function repairPlanOf(
  client: pg.ClientBase,
  run: ArchiveRunRow & { location_id: string; started_at: Date },
): Promise<RepairPlan> {
  const ids = zeroIds(run.dry_run_report);
  const { rows: zero } = ids.length
    ? await client.query<{ id: string; name: string }>(
        `SELECT t.id, t.name FROM public.import_source_ids s
           JOIN public.things t ON t.id = s.entity_id
          WHERE s.location_id = $1 AND s.source = 'homebox' AND s.entity_type = 'thing'
            AND s.source_id = ANY ($2::text[])
            AND t.deleted_at IS NULL AND t.lifecycle = 'in_use' AND t.quantity = 1
            -- A thing holding others is never archived for its 0: its contents would go with it.
            AND NOT EXISTS (SELECT 1 FROM public.things c
                             WHERE c.container_id = t.id AND c.deleted_at IS NULL)
          ORDER BY t.name, t.id`,
        [run.location_id, ids],
      )
    : { rows: [] };
  // The types this run made: recorded under its id, and created while it ran.
  const { rows: types } = await client.query<{
    id: string;
    name: string;
    container: boolean;
  }>(
    `SELECT DISTINCT y.id, y.name, 'container' = ANY (y.capabilities) AS container
       FROM public.import_source_ids s
       JOIN public.import_runs r ON r.id = s.run_id
       JOIN public.types y ON y.id = s.entity_id
      WHERE s.location_id = $1 AND s.source = 'homebox' AND s.entity_type = 'type'
        AND s.run_id = $2 AND y.owner_account_id IS NOT NULL AND y.archived_at IS NULL
        AND y.created_at >= r.started_at AND y.created_at <= coalesce(r.finished_at, now())
      ORDER BY y.name, y.id`,
    [run.location_id, run.id],
  );
  // Ended sold by this run on a date alone: no buyer, no price, no "Sold to:"/"Sold for:" line the
  // run wrote to the notes instead, and no lifecycle change since but the run's own.
  const { rows: sold } = await client.query<{ id: string; name: string }>(
    `SELECT t.id, t.name FROM public.import_source_ids s
       JOIN public.things t ON t.id = s.entity_id
      WHERE s.location_id = $1 AND s.source = 'homebox' AND s.entity_type = 'thing'
        AND s.run_id = $2 AND t.deleted_at IS NULL AND t.lifecycle = 'sold'
        AND t.ended_to IS NULL AND t.ended_price IS NULL
        AND position('Sold to: ' IN coalesce(t.notes, '')) = 0
        AND position('Sold for: ' IN coalesce(t.notes, '')) = 0
        AND NOT EXISTS (SELECT 1 FROM public.audit_events e
                         WHERE e.entity_type = 'thing' AND e.entity_id = t.id
                           AND e.action = 'thing.lifecycle'
                           AND e.request_id IS DISTINCT FROM 'import:' || $2::text)
      ORDER BY t.name, t.id`,
    [run.location_id, run.id],
  );
  return {
    zero: zero.map((r) => ({ thingId: r.id, name: r.name })),
    sold: sold.map((r) => ({ thingId: r.id, name: r.name })),
    containerTypes: types
      .filter((y) => y.container)
      .map((y) => ({ typeId: y.id, name: homeboxTypeName(y.name) })),
    renames: types
      .filter((y) => y.name in RAW)
      .map((y) => ({ typeId: y.id, name: y.name, to: RAW[y.name as keyof typeof RAW] })),
  };
}

type Ctx = {
  tx: Tx;
  client: pg.PoolClient;
  scope: Scope;
  requestId: string;
  jobs: JobQueue | null;
  files: FileStorage | null;
};

type TypeImage = { id: string; name: string; capabilities: string[] };

async function typeImages(client: pg.ClientBase, ids: string[]): Promise<Map<string, TypeImage>> {
  const { rows } = await client.query<TypeImage & { row_version: number }>(
    'SELECT id, name, capabilities, row_version FROM public.types WHERE id = ANY ($1::uuid[])',
    [ids],
  );
  return new Map(rows.map((r) => [r.id, r]));
}

const versionOf = async (client: pg.ClientBase, table: 'things' | 'types', id: string) => {
  const { rows } = await client.query<{ row_version: number }>(
    `SELECT row_version FROM public.${table} WHERE id = $1`,
    [id],
  );
  return rows[0]?.row_version ?? 1;
};

/** Applies the chosen repairs. Nothing chosen, or nothing left to repair, is a 400. */
export async function applyRepair(
  c: Ctx,
  run: ArchiveRunRow & { location_id: string; started_at: Date },
  body: RepairBody,
): Promise<{ things: number; types: number }> {
  const plan = await repairPlanOf(c.client, run);
  const things = body.zero ? plan.zero : [];
  const unsold = body.sold ? plan.sold : [];
  const patches = new Map<string, UpdateTypeBody>();
  if (body.containerTypes) {
    const images = await typeImages(
      c.client,
      plan.containerTypes.map((y) => y.typeId),
    );
    for (const y of plan.containerTypes) {
      const caps = images.get(y.typeId)?.capabilities ?? [];
      patches.set(y.typeId, {
        capabilities: caps.filter((x) => x !== 'container') as UpdateTypeBody['capabilities'],
      });
    }
  }
  if (body.names) {
    for (const y of plan.renames) {
      patches.set(y.typeId, {
        ...patches.get(y.typeId),
        name: y.to === 'item' ? body.names.item : body.names.location,
      });
    }
  }
  if (things.length === 0 && unsold.length === 0 && patches.size === 0) {
    throw invalid('There is nothing to repair.');
  }

  const ctx = { ...c };
  for (const t of things) {
    await setLifecycle(ctx, t.thingId, await versionOf(c.client, 'things', t.thingId), {
      lifecycle: 'archived',
    });
  }
  for (const t of unsold) {
    // Back in use clears the end, so its date and notes go into the notes in the same write, as
    // an import now writes them; the one thing.lifecycle event's Undo puts both back.
    const { rows } = await c.client.query<{
      ended_on: string | null;
      ended_notes: string | null;
      notes: string | null;
    }>('SELECT ended_on::text, ended_notes, notes FROM public.things WHERE id = $1', [t.thingId]);
    const was = rows[0];
    const lines = soldNoteLines(was?.ended_on ?? null, was?.ended_notes);
    const notes =
      lines.length > 0
        ? [was?.notes, lines.join('\n')].filter(Boolean).join('\n\n').slice(0, NOTES_MAX)
        : undefined;
    await setLifecycle(
      ctx,
      t.thingId,
      await versionOf(c.client, 'things', t.thingId),
      { lifecycle: 'in_use' },
      notes,
    );
  }
  const changed = [...things, ...unsold].map((t) => t.thingId);
  const before = await typeImages(c.client, [...patches.keys()]);
  const writeCtx = {
    tx: c.tx,
    client: c.client,
    userId: c.scope.userId,
    requestId: c.requestId,
    jobs: c.jobs,
  };
  for (const [typeId, patch] of patches) {
    await updateType(writeCtx, typeId, await versionOf(c.client, 'types', typeId), patch);
  }
  const after = await typeImages(c.client, [...patches.keys()]);
  const image = (m: Map<string, TypeImage>) =>
    [...patches.keys()].map((id) => {
      const y = m.get(id);
      return { id, name: y?.name ?? '', capabilities: y?.capabilities ?? [] };
    });
  await audited(c.tx, {
    locationId: run.location_id,
    actor: { type: 'user', id: c.scope.userId },
    action: 'import.repair',
    entity: { type: 'import_run', id: run.id },
    before: { types: image(before), things: null },
    after: { types: image(after), things: changed },
    subjects: changed,
    requestId: c.requestId,
    // Only type changes are this event's to undo; the things have their own events.
    undoableUntil: patches.size > 0 ? undoableUntil() : null,
  });
  return { things: changed.length, types: patches.size };
}

/** Undo of a repair's type changes: each type back to its name and capabilities, unless it was
 * changed since. */
async function undoRepair(args: UndoArgs): Promise<void> {
  const { event, client } = args;
  const was = (event.diff.types?.before ?? []) as TypeImage[];
  const now = (event.diff.types?.after ?? []) as TypeImage[];
  if (!Array.isArray(was) || !Array.isArray(now) || was.length === 0) {
    throw conflict("This change can't be undone.");
  }
  const current = await typeImages(
    client,
    now.map((y) => y.id),
  );
  const same = (a: string[], b: string[]) => [...a].sort().join() === [...b].sort().join();
  for (const y of now) {
    const cur = current.get(y.id);
    if (!cur || cur.name !== y.name || !same(cur.capabilities, y.capabilities)) {
      throw undoConflict(['types']);
    }
  }
  const writeCtx = {
    tx: args.tx,
    client,
    userId: args.scope.userId,
    requestId: args.requestId,
    jobs: args.deps.jobs,
  };
  for (const y of was) {
    await updateType(writeCtx, y.id, await versionOf(client, 'types', y.id), {
      name: y.name,
      capabilities: y.capabilities as UpdateTypeBody['capabilities'],
    });
  }
  await args.audit({
    action: 'import.repair',
    entity: { type: 'import_run', id: event.entityId },
    before: { types: now },
    after: { types: was },
  });
}

let registered = false;

/** Registers the repair's undo handler (idempotent). */
export function registerRepairUndo(): void {
  if (registered) return;
  registered = true;
  registerUndo('import.repair', undoRepair);
}

export async function homeboxRepairRoutes(app: KeptApp, deps: InventoryDeps): Promise<void> {
  registerRepairUndo();
  const { pools } = deps;
  app.get(
    '/api/v1/imports/:id/repair',
    { schema: { params: Params, response: { 200: PlanView } } },
    (req) =>
      scopedRead(pools, req, async (_tx, client) =>
        repairPlanOf(client, await repairableRun(client, req.params.id.toLowerCase())),
      ),
  );
  app.post(
    '/api/v1/imports/:id/repair',
    { schema: { params: Params, body: RepairBody, response: { 200: RepairResult } } },
    (req, reply) =>
      scopedWrite(pools, req, reply, async (tx, client, scope) => {
        const run = await repairableRun(client, req.params.id.toLowerCase(), true);
        const c: Ctx = {
          tx,
          client,
          scope,
          requestId: req.id,
          jobs: deps.jobs ?? null,
          files: deps.files ?? null,
        };
        const repaired = await applyRepair(c, run, req.body);
        return { status: 200, body: { repaired, plan: await repairPlanOf(client, run) } };
      }),
  );
}
