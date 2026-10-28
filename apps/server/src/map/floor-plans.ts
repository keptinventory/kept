import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import {
  draftRooms,
  EXTRACTION_STATUSES,
  FLOOR_PLAN_STATUSES,
  firstOverlap,
  MAP_LIMITS,
  MAP_ROOM_KINDS,
  MAP_SURFACES,
  type MapRect,
  newId,
  PLAN_LIMITS,
  PLAN_TURNS,
  type PlanExtraction,
} from '@kept/shared';
import type pg from 'pg';
import { z } from 'zod';
import { actorOf } from '../audit/actor.js';
import { audited } from '../audit/audited.js';
import { registerUndo, type UndoArgs, undoConflict } from '../audit/undo.js';
import {
  aiCaptureState,
  dedupedFileIds,
  queueExtraction,
  requireUsableFiles,
} from '../capture/service.js';
import type { Scope, Tx } from '../db/scope.js';
import { renderPdfPage } from '../files/pdf-text.js';
import { AppError, conflict, invalid, notFound } from '../http/errors.js';
import type { JobQueue } from '../jobs/queue.js';
import { requireCan, requireMembership } from '../locations/access.js';
import { lastInCustomOrder } from '../places/order.js';
import { lockTree, NAME, requireKind } from '../places/service.js';
import { type FileStorage, originalKey } from '../storage/blob-store.js';
import { type LayoutImage, lockLayout } from './service.js';
import { mapTree, NODE_COLUMNS, type NodeRow, nodeRows, placeRows, versionOf } from './view.js';

// Floor plan to map (1.14.3, D266). A plan uploaded on the map is read once by the `plan`
// extraction (extraction/job.ts runs it, then writePlanRead below), reviewed on the map, and its
// rooms added in one request with one undo. The web's contract is apps/web/src/api/map/.
//
// POST /api/v1/locations/:id/floor-plans {fileId, sha256?, turn?} → 201 FloorPlanView
//   `things.edit`, and AI capture on or waiting for a provider (else 409 `module_off`). The file
//   becomes an attachment under review on a new `reading` row (`in_review`, so viewers and read
//   tokens never see it, 0147), one `plan` extraction is queued, `floor_plan.read` is audited.
// GET /api/v1/floor-plans/:id → FloorPlanView: members and up (row-level security, 0163).
// POST /api/v1/floor-plans/:id/retry → a failed read is read again (the next attempt).
// POST /api/v1/floor-plans/:id/discard → the upload deleted, `discarded`, `floor_plan.discard`.
// POST /api/v1/floor-plans/:id/apply {version, keepPlan, floors, rooms} → {version, rooms, floors}
//   One transaction (spec §9.1): the arrange version is checked as PUT …/layout checks it; the new
//   floors and rooms are inserted directly (not through createPlace, so History shows one row);
//   a room may instead name an existing room of that floor nobody arranged (`placeId`); every
//   rectangle is checked against all of that floor's arranged rooms; only the new map rows are
//   inserted, the rest of the layout stays; one `floor_plan.apply` on the location, undoable for
//   7 days by undoFloorPlanApply. The upload is then deleted (the file is let go, so the orphan
//   purge removes it a day later), unless `keepPlan` makes the file a location document (D155).

export type Ctx = {
  tx: Tx;
  client: pg.PoolClient;
  scope: Scope;
  requestId: string;
  jobs: JobQueue | null;
  files: FileStorage | null;
};

const Turn = z.union(PLAN_TURNS.map((t) => z.literal(t)) as unknown as [z.ZodLiteral<0>]);

export const StartBody = z.object({
  fileId: z.uuid(),
  sha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional(),
  turn: Turn.optional(),
});
export type StartBody = z.infer<typeof StartBody>;

export const FloorPlanViewSchema = z.object({
  id: z.uuid(),
  locationId: z.uuid(),
  status: z.enum(FLOOR_PLAN_STATUSES),
  turn: z.number().int(),
  keepPlan: z.boolean(),
  createdAt: z.string(),
  /** The read's latest attempt: queued, running, paused, waiting for a provider, failed… */
  read: z
    .object({
      status: z.enum(EXTRACTION_STATUSES),
      reason: z.string().nullable(),
      pausedUntil: z.string().nullable(),
      attempt: z.number().int(),
    })
    .nullable(),
  /** The upload, for the underlay (POST /api/v1/files/:id/url) while the review is open. */
  file: z.object({ id: z.uuid(), attachmentId: z.uuid(), mime: z.string() }).nullable(),
  /** The size of the image the model read, which its boxes are fractions of. */
  image: z.object({ w: z.number().int(), h: z.number().int() }).nullable(),
  /** The checked answer (PlanExtraction), so a typed size can be drafted again on the web. */
  answer: z.unknown().nullable(),
  /** The proposed rooms (@kept/shared PlanDrafts). */
  drafts: z.unknown().nullable(),
});
export type FloorPlanView = z.infer<typeof FloorPlanViewSchema>;

/** What `floor_plans.result` holds once the read is done. */
export type PlanResult = {
  answer: PlanExtraction;
  image: { w: number; h: number };
  drafts: ReturnType<typeof draftRooms>;
  dropped: string[];
  promptVersion: string;
};

type PlanRow = {
  id: string;
  location_id: string;
  status: (typeof FLOOR_PLAN_STATUSES)[number];
  turn: number;
  keep_plan: boolean;
  result: PlanResult | null;
  created_at: Date;
  attachment_id: string | null;
  file_id: string | null;
  mime: string | null;
  read_status: (typeof EXTRACTION_STATUSES)[number] | null;
  status_reason: string | null;
  paused_until: Date | null;
  attempt: number | null;
};

const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);

async function planRow(client: pg.ClientBase, id: string, lock = false): Promise<PlanRow> {
  const { rows } = await client.query<PlanRow>(
    `SELECT f.id, f.location_id, f.status, f.turn, f.keep_plan, f.result, f.created_at,
            a.id AS attachment_id, a.file_id, fl.mime,
            e.status AS read_status, e.status_reason, e.paused_until, e.attempt
       FROM public.floor_plans f
       LEFT JOIN public.attachments a ON a.floor_plan_id = f.id
       LEFT JOIN public.files fl ON fl.id = a.file_id
       LEFT JOIN LATERAL (
         SELECT x.status, x.status_reason, x.paused_until, x.attempt FROM public.extractions x
          WHERE x.floor_plan_id = f.id ORDER BY x.attempt DESC LIMIT 1) e ON true
      WHERE f.id = $1
      ${lock ? 'FOR UPDATE OF f' : ''}`,
    [id],
  );
  const row = rows[0];
  if (!row) throw notFound();
  return row;
}

function viewOf(r: PlanRow): FloorPlanView {
  const res = r.result;
  return {
    id: r.id,
    locationId: r.location_id,
    status: r.status,
    turn: r.turn,
    keepPlan: r.keep_plan,
    createdAt: new Date(r.created_at).toISOString(),
    read:
      r.read_status !== null
        ? {
            status: r.read_status,
            reason: r.status_reason,
            pausedUntil: iso(r.paused_until),
            attempt: r.attempt ?? 1,
          }
        : null,
    file:
      r.attachment_id && r.file_id
        ? { id: r.file_id, attachmentId: r.attachment_id, mime: r.mime ?? '' }
        : null,
    image: res?.image ?? null,
    answer: res?.answer ?? null,
    drafts: res?.drafts ?? null,
  };
}

export async function floorPlanView(client: pg.ClientBase, id: string): Promise<FloorPlanView> {
  return viewOf(await planRow(client, id.toLowerCase()));
}

const moduleOff = () =>
  new AppError(
    'module_off',
    409,
    'AI capture is off in this location: an owner or admin can turn it on.',
  );

// ---- Start ----------------------------------------------------------------------------------

export async function startFloorPlan(
  c: Ctx,
  locationId: string,
  body: StartBody,
): Promise<FloorPlanView> {
  const me = await requireMembership(c.client, locationId);
  requireCan(me.role, 'things.edit');
  const ai = await aiCaptureState(c.tx, c.client, locationId, me.role);
  if (ai === 'off') throw moduleOff();
  const [fileId] = await dedupedFileIds(c.client, locationId, [
    { fileId: body.fileId, sha256: body.sha256 },
  ]);
  if (!fileId) throw notFound();
  await requireUsableFiles(c.client, locationId, [fileId]);
  const { rows: f } = await c.client.query<{ mime: string }>(
    'SELECT mime FROM public.files WHERE id = $1',
    [fileId],
  );
  const mime = f[0]?.mime ?? '';
  if (!(mime.startsWith('image/') || mime === 'application/pdf')) {
    throw invalid('A floor plan is an image or a PDF.');
  }
  const id = newId();
  const turn = body.turn ?? 0;
  await c.client.query(
    `INSERT INTO public.floor_plans (id, location_id, status, turn, created_by)
     VALUES ($1, $2, 'reading', $3, kept.current_user_id())`,
    [id, locationId, turn],
  );
  const attachmentId = newId();
  await c.client.query(
    `INSERT INTO public.attachments (id, location_id, file_id, floor_plan_id, role, in_review,
                                     created_by)
     VALUES ($1, $2, $3, $4, 'document', true, kept.current_user_id())`,
    [attachmentId, locationId, fileId, id],
  );
  await queueExtraction(
    { ...c, jobs: c.jobs, files: c.files },
    { locationId, attachmentId, mode: 'plan', floorPlanId: id },
    ai,
  );
  await audited(c.tx, {
    locationId,
    actor: actorOf(c.scope),
    action: 'floor_plan.read',
    entity: { type: 'location', id: locationId },
    after: { plan_id: id, attachment_id: attachmentId, turn },
    requestId: c.requestId,
  });
  return floorPlanView(c.client, id);
}

/** A plan's row as its writer must see it: the caller's role there, `things.edit`. */
async function writable(c: Ctx, id: string): Promise<PlanRow> {
  const row = await planRow(c.client, id.toLowerCase(), true);
  const me = await requireMembership(c.client, row.location_id);
  requireCan(me.role, 'things.edit');
  return row;
}

const OPEN: ReadonlySet<string> = new Set(['reading', 'ready', 'failed', 'off']);

// ---- Retry and discard ------------------------------------------------------------------------

export async function retryFloorPlan(c: Ctx, id: string): Promise<FloorPlanView> {
  const row = await writable(c, id);
  const failed = row.status === 'failed' || row.status === 'off' || row.read_status === 'failed';
  if (!OPEN.has(row.status) || !failed || !row.attachment_id) {
    throw conflict('Only a read that failed is read again.');
  }
  const me = await requireMembership(c.client, row.location_id);
  const ai = await aiCaptureState(c.tx, c.client, row.location_id, me.role);
  if (ai === 'off') throw moduleOff();
  await c.client.query(
    `UPDATE public.floor_plans SET status = 'reading', result = NULL WHERE id = $1`,
    [row.id],
  );
  const attempt = (row.attempt ?? 0) + 1;
  await queueExtraction(
    c,
    {
      locationId: row.location_id,
      attachmentId: row.attachment_id,
      mode: 'plan',
      floorPlanId: row.id,
      attempt,
    },
    ai,
  );
  await audited(c.tx, {
    locationId: row.location_id,
    actor: actorOf(c.scope),
    action: 'floor_plan.read',
    entity: { type: 'location', id: row.location_id },
    after: { plan_id: row.id, attachment_id: row.attachment_id, attempt },
    requestId: c.requestId,
  });
  return floorPlanView(c.client, row.id);
}

export async function discardFloorPlan(c: Ctx, id: string): Promise<{ status: 'discarded' }> {
  const row = await writable(c, id);
  if (!OPEN.has(row.status)) throw conflict('This plan is closed already.');
  // The extraction goes with its attachment (its foreign key cascades); the file is let go.
  await c.client.query('DELETE FROM public.attachments WHERE floor_plan_id = $1', [row.id]);
  await c.client.query(
    `UPDATE public.floor_plans SET status = 'discarded', result = NULL WHERE id = $1`,
    [row.id],
  );
  await audited(c.tx, {
    locationId: row.location_id,
    actor: actorOf(c.scope),
    action: 'floor_plan.discard',
    entity: { type: 'location', id: row.location_id },
    before: { plan_id: row.id, status: row.status },
    requestId: c.requestId,
  });
  return { status: 'discarded' };
}

// ---- Apply ----------------------------------------------------------------------------------

const Cm = z.number().int();
const ApplyRoom = z.object({
  key: z.string().min(1).max(40),
  floorKey: z.string().min(1).max(40).nullable(),
  placeId: z.uuid().nullable(),
  name: NAME,
  kind: z.enum(MAP_ROOM_KINDS),
  surface: z.enum(MAP_SURFACES),
  x: Cm.min(0).max(MAP_LIMITS.maxCoord),
  z: Cm.min(0).max(MAP_LIMITS.maxCoord),
  w: Cm.min(MAP_LIMITS.minRoom).max(MAP_LIMITS.maxRoom),
  d: Cm.min(MAP_LIMITS.minRoom).max(MAP_LIMITS.maxRoom),
});
const ApplyFloor = z.object({
  key: z.string().min(1).max(40),
  id: z.uuid().nullable(),
  name: NAME,
});
export const ApplyBody = z.object({
  version: z.string().max(40).nullable(),
  keepPlan: z.boolean(),
  floors: z.array(ApplyFloor).max(PLAN_LIMITS.floors),
  rooms: z.array(ApplyRoom).min(1).max(PLAN_LIMITS.rooms),
});
export type ApplyBody = z.infer<typeof ApplyBody>;

export const ApplyResultSchema = z.object({
  version: z.string().nullable(),
  rooms: z.array(z.object({ key: z.string(), id: z.uuid() })),
  floors: z.array(z.object({ key: z.string(), id: z.uuid() })),
});
export type ApplyResult = z.infer<typeof ApplyResultSchema>;

/** A floor plan's rooms are undoable for seven days (D150), a minute inside the audit's limit. */
const APPLY_UNDO_MS = 7 * 24 * 3600_000 - 60_000;

const changedSince = (hint: string) =>
  new AppError('conflict', 409, hint, { reason: 'changed_since' });

export async function applyFloorPlan(c: Ctx, id: string, body: ApplyBody): Promise<ApplyResult> {
  const row = await writable(c, id);
  if (row.status !== 'ready') {
    throw new AppError('conflict', 409, 'This plan isn’t ready to add.', { reason: 'not_ready' });
  }
  const locationId = row.location_id;
  await lockLayout(c.client, locationId);
  await lockTree(c.client, locationId);
  const before = await nodeRows(c.client, locationId);
  if (versionOf(before) !== body.version) {
    throw new AppError(
      'conflict',
      409,
      'Someone arranged this map since you started. Load it again; your rooms stay to add.',
      { reason: 'arranged_since' },
    );
  }

  const keys = new Set<string>();
  for (const k of [
    ...body.floors.map((f) => `f:${f.key}`),
    ...body.rooms.map((r) => `r:${r.key}`),
  ]) {
    if (keys.has(k)) throw invalid(`Check the plan: ${k.slice(2)} is in it twice.`);
    keys.add(k);
  }
  const tree = mapTree(await placeRows(c.client, locationId));
  const arranged = new Set(before.map((n) => n.place_id).filter((x): x is string => !!x));

  // Floors: existing ones are checked, new ones made in the order given (after the others).
  const { rows: loc } = await c.client.query<{ owner_account_id: string }>(
    'SELECT owner_account_id FROM public.locations WHERE id = $1',
    [locationId],
  );
  const account = loc[0]?.owner_account_id;
  if (!account) throw notFound();
  await requireKind(c.client, account, 'room');
  const floorIds = new Map<string, string>();
  const madeFloors: string[] = [];
  for (const f of body.floors) {
    if (f.id) {
      const fid = f.id.toLowerCase();
      if (!tree.floors.includes(fid))
        throw changedSince(`Check floors: ${fid} isn’t a floor here.`);
      floorIds.set(f.key, fid);
      continue;
    }
    if (madeFloors.length === 0) await requireKind(c.client, account, 'floor');
    const fid = newId();
    await c.client.query(
      `INSERT INTO public.places (id, location_id, parent_id, name, kind_key, sort, created_by)
       VALUES ($1, $2, NULL, $3, 'floor',
               (SELECT coalesce(max(s.sort) + 1, 0) FROM public.places s
                 WHERE s.location_id = $2 AND s.parent_id IS NULL AND s.kind_key = 'floor'
                   AND s.deleted_at IS NULL),
               $4)`,
      [fid, locationId, f.name, c.scope.userId],
    );
    await lastInCustomOrder(c.client, fid);
    floorIds.set(f.key, fid);
    madeFloors.push(fid);
  }

  // Rooms: an existing room of that floor nobody arranged, or a new room place.
  const used = new Set<string>();
  const out: { key: string; id: string; made: boolean; levelId: string | null }[] = [];
  for (const r of body.rooms) {
    const levelId = r.floorKey === null ? null : floorIds.get(r.floorKey);
    if (levelId === undefined)
      throw invalid(`Check rooms: ${r.key} is on a floor not in the plan.`);
    if (r.placeId) {
      const pid = r.placeId.toLowerCase();
      if (
        used.has(pid) ||
        !tree.rooms.has(pid) ||
        tree.rooms.get(pid) !== levelId ||
        arranged.has(pid)
      ) {
        throw changedSince(`Check rooms: ${r.name} is already on the map, or not on that floor.`);
      }
      used.add(pid);
      out.push({ key: r.key, id: pid, made: false, levelId });
      continue;
    }
    const pid = newId();
    await c.client.query(
      `INSERT INTO public.places (id, location_id, parent_id, name, kind_key, sort, created_by)
       VALUES ($1, $2, $3, $4, 'room', 0, $5)`,
      [pid, locationId, levelId, r.name, c.scope.userId],
    );
    await lastInCustomOrder(c.client, pid);
    out.push({ key: r.key, id: pid, made: true, levelId });
  }

  // The layout, as checkedImage checks rooms: no overlap on a floor, all its arranged rooms
  // counted.
  const levelOfRow = (n: NodeRow) => (n.place_id ? tree.rooms.get(n.place_id) : undefined);
  const roomRows = before.filter((n) => n.place_id && tree.rooms.has(n.place_id) && n.w !== null);
  if (roomRows.length + out.length > MAP_LIMITS.rooms)
    throw invalid('The map holds 400 rooms at most.');
  const byLevel = new Map<string | null, MapRect[]>();
  for (const n of roomRows) {
    const level = levelOfRow(n) ?? null;
    byLevel.set(level, [
      ...(byLevel.get(level) ?? []),
      { x: n.x, z: n.z, w: n.w ?? 0, d: n.d ?? 0 },
    ]);
  }
  body.rooms.forEach((r, i) => {
    const level = out[i]?.levelId ?? null;
    byLevel.set(level, [...(byLevel.get(level) ?? []), { x: r.x, z: r.z, w: r.w, d: r.d }]);
  });
  for (const rects of byLevel.values()) {
    if (firstOverlap(rects)) {
      throw new AppError('conflict', 409, 'Rooms can’t overlap.', { reason: 'rooms_overlap' });
    }
  }

  const added: LayoutImage[] = body.rooms
    .map((r, i) => ({
      id: out[i]?.id as string,
      s: 'place' as const,
      x: r.x,
      z: r.z,
      w: r.w,
      d: r.d,
      rot: 0,
      model: null,
      kind: r.kind,
      surface: r.surface,
      host: null,
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  await c.client.query(
    `INSERT INTO public.map_nodes (location_id, place_id, x_cm, z_cm, w_cm, d_cm, rot, room_kind,
                                   surface, created_by)
     SELECT $1, r.id, r.x, r.z, r.w, r.d, 0, r.kind, r.surface, kept.current_user_id()
       FROM jsonb_to_recordset($2::jsonb)
         AS r(id uuid, x int, z int, w int, d int, kind text, surface text)
     RETURNING ${NODE_COLUMNS}`,
    [locationId, JSON.stringify(added)],
  );

  const event = await audited(c.tx, {
    locationId,
    actor: actorOf(c.scope),
    action: 'floor_plan.apply',
    entity: { type: 'location', id: locationId },
    after: {
      plan_id: row.id,
      floors: madeFloors,
      rooms: out.map((r, i) => ({ id: r.id, made: r.made, name: body.rooms[i]?.name ?? '' })),
      layout: added,
    },
    requestId: c.requestId,
    undoableUntil: new Date(Date.now() + APPLY_UNDO_MS),
  });

  // The plan file: kept as the location's own document when asked; the upload let go either way.
  if (body.keepPlan && row.file_id) {
    await c.client.query(
      `INSERT INTO public.attachments (location_id, file_id, role, created_by)
       VALUES ($1, $2, 'document', kept.current_user_id())`,
      [locationId, row.file_id],
    );
  }
  await c.client.query('DELETE FROM public.attachments WHERE floor_plan_id = $1', [row.id]);
  await c.client.query(
    `UPDATE public.floor_plans
        SET status = 'applied', result = NULL, keep_plan = $2, applied_event_id = $3
      WHERE id = $1`,
    [row.id, body.keepPlan, event.id],
  );
  return {
    version: versionOf(await nodeRows(c.client, locationId)),
    rooms: out.map((r) => ({ key: r.key, id: r.id })),
    floors: [...floorIds].map(([key, fid]) => ({ key, id: fid })),
  };
}

// ---- Undo ----------------------------------------------------------------------------------

type AppliedRoom = { id: string; made: boolean; name?: string };

/**
 * Undo of `floor_plan.apply` (spec §9.2): refused (`changed_since`) when a room or floor it made
 * holds a place or a thing, or changed since (renamed, moved: any later event on it), or when an
 * added room's rectangle is no longer on the map as it was (compared by value: an arrange
 * rewrites every row). Otherwise the added map rows go (a room it used goes back to the auto
 * layout), and the rooms and floors it made go to the trash as one batch.
 */
async function undoFloorPlanApply(args: UndoArgs): Promise<void> {
  requireCan(args.role, 'things.edit');
  const { client, event } = args;
  const locationId = event.locationId;
  await lockLayout(client, locationId);
  await lockTree(client, locationId);
  const rooms = (event.diff.rooms?.after ?? []) as AppliedRoom[];
  const floors = (event.diff.floors?.after ?? []) as string[];
  const added = (event.diff.layout?.after ?? []) as LayoutImage[];
  const made = [...rooms.filter((r) => r.made).map((r) => r.id), ...floors];

  const { rows: live } = await client.query<{ id: string; deleted: boolean }>(
    `SELECT p.id, p.deleted_at IS NOT NULL AS deleted FROM public.places p
      WHERE p.id = ANY ($1::uuid[]) AND p.location_id = $2 FOR UPDATE OF p`,
    [made, locationId],
  );
  if (live.length !== made.length || live.some((r) => r.deleted)) {
    throw undoConflict(['deleted_at']);
  }
  const { rows: holds } = await client.query<{ n: number }>(
    `SELECT ((SELECT count(*) FROM public.things t
               WHERE t.place_id = ANY ($1::uuid[]) AND t.deleted_at IS NULL)
           + (SELECT count(*) FROM public.places k
               WHERE k.parent_id = ANY ($1::uuid[]) AND k.deleted_at IS NULL
                 AND NOT (k.id = ANY ($1::uuid[]))))::int AS n`,
    [made],
  );
  if ((holds[0]?.n ?? 0) > 0) throw undoConflict(['contents']);
  const { rows: later } = await client.query<{ entity_id: string }>(
    `SELECT e.entity_id FROM public.audit_events e
      WHERE e.location_id = $1 AND e.entity_type = 'place' AND e.entity_id = ANY ($2::uuid[])
        AND e.at > $3
      LIMIT 1`,
    [locationId, made, event.at],
  );
  if (later[0]) throw undoConflict(['place']);
  const now = await nodeRows(client, locationId);
  const byPlace = new Map(now.filter((n) => n.place_id).map((n) => [n.place_id as string, n]));
  for (const r of added) {
    const n = byPlace.get(r.id);
    if (!n || n.x !== r.x || n.z !== r.z || n.w !== r.w || n.d !== r.d) {
      throw undoConflict(['layout']);
    }
  }
  await client.query(
    'DELETE FROM public.map_nodes WHERE location_id = $1 AND place_id = ANY ($2::uuid[])',
    [locationId, added.map((r) => r.id)],
  );
  const trashBatchId = newId();
  if (made.length > 0) {
    await client.query(
      `UPDATE public.places SET deleted_at = now(), trash_batch_id = $2 WHERE id = ANY ($1::uuid[])`,
      [made, trashBatchId],
    );
  }
  await args.audit({
    action: 'floor_plan.apply',
    entity: { type: 'location', id: locationId },
    before: { floors, rooms, layout: added },
    after: { floors: [], rooms: [], layout: [], trash_batch_id: made.length ? trashBatchId : null },
  });
}

export function registerFloorPlanUndo(): void {
  registerUndo('floor_plan.apply', undoFloorPlanApply);
}

// ---- The read (extraction/job.ts) -------------------------------------------------------------

/** A PDF plan's first page and its text, drawn in the sandboxed worker; null when it can't be. */
export async function renderPdfForPlan(
  files: FileStorage | null,
  locationId: string,
  fileId: string,
): Promise<{ png: Buffer; text: string } | null> {
  if (!files) return null;
  await mkdir(files.tmpDir, { recursive: true });
  const dir = await mkdtemp(path.join(files.tmpDir, 'plan-'));
  try {
    const local = path.join(dir, 'plan.pdf');
    await pipeline(
      await files.blobs.stream(originalKey(locationId, fileId)),
      createWriteStream(local),
    );
    const r = await renderPdfPage(local);
    return r.status === 'rendered' ? { png: r.png, text: r.text } : null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** The quarter turn a plan's extraction reads it at. */
export async function planTurnOf(client: pg.ClientBase, planId: string): Promise<number> {
  const { rows } = await client.query<{ turn: number }>(
    'SELECT turn FROM public.floor_plans WHERE id = $1',
    [planId],
  );
  return rows[0]?.turn ?? 0;
}

/** A finished read: the drafts worked out once (everyone opening the plan sees the same), and
 * the plan ready to review, unless it was closed meanwhile. */
export async function writePlanRead(
  client: pg.ClientBase,
  planId: string,
  read: {
    answer: PlanExtraction;
    image: { w: number; h: number };
    dropped: string[];
    promptVersion: string;
  },
): Promise<PlanResult> {
  const result: PlanResult = { ...read, drafts: draftRooms(read.answer, read.image) };
  await client.query(
    `UPDATE public.floor_plans SET status = 'ready', result = $2::jsonb
      WHERE id = $1 AND status = 'reading'`,
    [planId, JSON.stringify(result)],
  );
  return result;
}

/** A read that ended without a result: `failed`, or `off` when AI capture was off for it. */
export async function endPlanRead(
  client: pg.ClientBase,
  planId: string,
  status: 'failed' | 'off',
): Promise<void> {
  await client.query(
    `UPDATE public.floor_plans SET status = $2 WHERE id = $1 AND status = 'reading'`,
    [planId, status],
  );
}
