import {
  type Action,
  can,
  type OpPayload,
  type Role,
  type ScanSessionMode,
  type ScanSessionTarget,
} from '@kept/shared';
import type pg from 'pg';
import { z } from 'zod';
import { actorOf } from '../audit/actor.js';
import { audited } from '../audit/audited.js';
import {
  lastChangedBy,
  registerUndo,
  type UndoArgs,
  undoableUntil,
  undoConflict,
} from '../audit/undo.js';
import { forbidden, invalid, notFound, toErrorReply } from '../http/errors.js';
import { callerMembership } from '../locations/access.js';
import { moveBackForUndo, moveThings } from '../things/move.js';
import type { Ctx } from '../things/service.js';

// Scan sessions (1.12, #168): one walk with the camera, many labels, one mode.
//
// The phone holds the walk and decides, on its summary, what each label read does. Saving sends
// the lines in chunks (`scan_session_lines`, ≤500 each, the session's header on every one so the
// first to arrive makes the session) and then `scan_session_finish`, which applies them all in
// its own transaction:
//
// - a count: `seen` lines are seen at the time their label was read (a later sighting already
//   recorded is kept), `not_here` lines are marked "not here", `move` lines (found elsewhere,
//   "Move here") are moved; with `contentsSeen`, what is inside a box that was read is seen with it;
// - a pack or a move: every line is a move to its own target (the target can change mid-walk),
//   through the move service in chunks of 200 per target, its checks, definer and `thing.move`
//   rows included, without an undo window of their own.
//
// A line that can't be applied any more (its thing trashed meanwhile, a location the person no
// longer edits, a box going inside itself) is skipped, and the session's `skipped` says how many:
// the rest of the walk is saved. The finish itself is refused when the person can no longer
// change the session's location.
//
// One `scan.session` audit event in the session's location, undoable for 7 days as a whole: the
// undo checks that nothing it changed has changed since, moves the moved things back (through the
// move service's undo path) and restores every seen date and "not here".

/** Things per move call (the move service's limit). */
const MOVE_CHUNK = 200;

export const ScanSessionViewSchema = z.object({
  id: z.uuid(),
  mode: z.enum(['count', 'pack', 'move']),
  locationId: z.uuid(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  expected: z.number().int().nullable(),
  seen: z.number().int(),
  notHere: z.number().int(),
  moved: z.number().int(),
  skipped: z.number().int(),
  undo: z.object({ eventId: z.uuid(), until: z.string() }).optional(),
});
export type ScanSessionView = z.infer<typeof ScanSessionViewSchema>;

type SessionRow = {
  id: string;
  location_id: string;
  mode: ScanSessionMode;
  target_place_id: string | null;
  target_container_id: string | null;
  started_by: string;
  started_at: Date;
  finished_at: Date | null;
};

const needs = (mode: ScanSessionMode): Action =>
  mode === 'count' ? 'things.mark-seen' : 'things.edit';

/** The location a session's target is in: 404 when the caller can't see it, or it is gone. */
async function targetLocation(client: pg.ClientBase, target: ScanSessionTarget): Promise<string> {
  if ('locationId' in target) {
    const m = await callerMembership(client, target.locationId.toLowerCase());
    if (!m) throw notFound();
    return target.locationId.toLowerCase();
  }
  const byPlace = 'placeId' in target;
  const { rows } = await client.query<{ location_id: string }>(
    `SELECT location_id FROM public.${byPlace ? 'places' : 'things'}
      WHERE id = $1 AND deleted_at IS NULL`,
    [(byPlace ? target.placeId : target.containerId).toLowerCase()],
  );
  if (!rows[0]) throw notFound();
  return rows[0].location_id;
}

async function requireAllowed(
  client: pg.ClientBase,
  locationId: string,
  action: Action,
): Promise<Role> {
  const m = await callerMembership(client, locationId);
  if (!m) throw notFound();
  if (!can(m.role, action)) throw forbidden('You can view this location but not change it.');
  return m.role;
}

async function sessionRow(client: pg.ClientBase, id: string, lock = false) {
  const { rows } = await client.query<SessionRow>(
    `SELECT id, location_id, mode, target_place_id, target_container_id, started_by, started_at,
            finished_at
       FROM public.scan_sessions WHERE id = $1${lock ? ' FOR UPDATE' : ''}`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * The `scan_session_lines` op: makes the session on its first chunk, and stores the lines. Lines
 * for things the caller can't see are left out; a thing already in the session keeps its first
 * line (a resend).
 */
export async function addSessionLines(
  ctx: Ctx,
  opLocationId: string,
  payload: OpPayload<'scan_session_lines'>,
  receivedAt: Date,
): Promise<{ sessionId: string; stored: number }> {
  const { client, scope } = ctx;
  const head = payload.session;
  const id = head.id.toLowerCase();
  const locationId = await targetLocation(client, head.target);
  if (locationId !== opLocationId.toLowerCase()) {
    throw invalid("The session's target is in another location.");
  }
  await requireAllowed(client, locationId, needs(head.mode));

  const found = await sessionRow(client, id, true);
  if (found) {
    if (found.started_by !== scope.userId) throw notFound();
    if (found.mode !== head.mode) throw invalid('This session is in another mode.');
    if (found.finished_at) throw invalid('This session is already saved.');
  } else {
    const t = head.target;
    await client.query(
      `INSERT INTO public.scan_sessions (id, location_id, mode, target_place_id,
                                         target_container_id, target_inside, started_by,
                                         started_at)
       VALUES ($1, $2, $3, $4, $5, $6, kept.current_user_id(), least($7::timestamptz, $8))`,
      [
        id,
        locationId,
        head.mode,
        'placeId' in t ? t.placeId.toLowerCase() : null,
        'containerId' in t ? t.containerId.toLowerCase() : null,
        'placeId' in t ? t.inside : null,
        head.startedAt,
        receivedAt,
      ],
    );
  }

  const lines = payload.lines;
  const { rowCount } = await client.query(
    `INSERT INTO public.scan_session_lines (session_id, location_id, thing_id, read_at, action,
                                            to_place_id, to_container_id)
     SELECT $1, $2, x.thing_id, least(x.read_at, $8), x.action, x.to_place, x.to_container
       FROM unnest($3::uuid[], $4::timestamptz[], $5::text[], $6::uuid[], $7::uuid[])
            x(thing_id, read_at, action, to_place, to_container)
      WHERE EXISTS (SELECT 1 FROM public.things t WHERE t.id = x.thing_id)
     ON CONFLICT (session_id, thing_id) DO NOTHING`,
    [
      id,
      locationId,
      lines.map((l) => l.thingId.toLowerCase()),
      lines.map((l) => l.readAt),
      lines.map((l) => l.action),
      lines.map((l) => (l.to && 'placeId' in l.to ? l.to.placeId.toLowerCase() : null)),
      lines.map((l) => (l.to && 'containerId' in l.to ? l.to.containerId.toLowerCase() : null)),
      receivedAt,
    ],
  );
  return { sessionId: id, stored: rowCount ?? 0 };
}

// ----- the finish ---------------------------------------------------------------------------------

/** What the undo compares and puts back, per thing. */
type State = {
  location_id: string;
  place_id: string | null;
  container_id: string | null;
  last_seen_at: string;
  location_uncertain: boolean;
};

type LineRow = {
  thing_id: string;
  read_at: Date;
  action: 'seen' | 'not_here' | 'move';
  to_place_id: string | null;
  to_container_id: string | null;
};

async function statesOf(
  client: pg.ClientBase,
  ids: readonly string[],
  lock = false,
): Promise<Map<string, State & { deleted: boolean }>> {
  if (ids.length === 0) return new Map();
  const { rows } = await client.query<
    Omit<State, 'last_seen_at'> & { id: string; last_seen_at: Date; deleted: boolean }
  >(
    `SELECT id, location_id, place_id, container_id, last_seen_at, location_uncertain,
            deleted_at IS NOT NULL AS deleted
       FROM public.things WHERE id = ANY ($1::uuid[]) ORDER BY id${lock ? ' FOR UPDATE' : ''}`,
    [[...ids]],
  );
  return new Map(
    rows.map(({ id, last_seen_at, ...r }) => [
      id,
      { ...r, last_seen_at: last_seen_at.toISOString() },
    ]),
  );
}

const stateOf = (s: State & { deleted?: boolean }): State => ({
  location_id: s.location_id,
  place_id: s.place_id,
  container_id: s.container_id,
  last_seen_at: s.last_seen_at,
  location_uncertain: s.location_uncertain,
});

/** Runs `fn` under a savepoint: true when it applied, false when it was refused (rolled back). */
async function tryApply(client: pg.ClientBase, fn: () => Promise<void>): Promise<boolean> {
  await client.query('SAVEPOINT scan_session_line');
  try {
    await fn();
    await client.query('RELEASE SAVEPOINT scan_session_line');
    return true;
  } catch (e) {
    await client.query('ROLLBACK TO SAVEPOINT scan_session_line');
    // A refusal (a 403, 404 or 409: no edit rights there any more, gone, a box into itself)
    // skips the line; anything else is a real failure.
    const { status } = toErrorReply(e);
    if (status >= 400 && status < 500 && status !== 401 && status !== 429) return false;
    throw e;
  }
}

export type FinishResult = { sessionId: string; eventId: string | null };

/** The `scan_session_finish` op: applies the session's lines, once. */
export async function finishSession(
  ctx: Ctx,
  payload: OpPayload<'scan_session_finish'>,
): Promise<FinishResult> {
  const { client, tx, scope } = ctx;
  const id = payload.sessionId.toLowerCase();
  const s = await sessionRow(client, id, true);
  if (!s || s.started_by !== scope.userId) throw notFound();
  if (s.finished_at) throw invalid('This session is already saved.');
  await requireAllowed(client, s.location_id, needs(s.mode));

  const { rows: lines } = await client.query<LineRow>(
    `SELECT thing_id, read_at, action, to_place_id, to_container_id
       FROM public.scan_session_lines WHERE session_id = $1 ORDER BY read_at, thing_id`,
    [id],
  );
  if (lines.length === 0) throw invalid('Nothing was read in this session.');

  const roles = new Map<string, Role | null>();
  const allowed = async (locationId: string, action: Action) => {
    if (!roles.has(locationId)) {
      roles.set(locationId, (await callerMembership(client, locationId))?.role ?? null);
    }
    const role = roles.get(locationId);
    return !!role && can(role, action);
  };

  const before = await statesOf(
    client,
    lines.map((l) => l.thing_id),
    true,
  );
  const live = (thingId: string) => {
    const st = before.get(thingId);
    return st && !st.deleted ? st : null;
  };
  let skipped = 0;
  const seen: LineRow[] = [];
  const notHere: string[] = [];
  const moves = new Map<
    string,
    { to: { placeId: string } | { containerId: string }; ids: string[] }
  >();
  for (const l of lines) {
    const st = live(l.thing_id);
    if (!st) {
      skipped += 1;
      continue;
    }
    if (l.action === 'move') {
      const to = l.to_container_id
        ? { containerId: l.to_container_id }
        : l.to_place_id
          ? { placeId: l.to_place_id }
          : null;
      if (!to) {
        skipped += 1;
        continue;
      }
      const key = 'containerId' in to ? `c:${to.containerId}` : `p:${to.placeId}`;
      const group = moves.get(key) ?? { to, ids: [] };
      group.ids.push(l.thing_id);
      moves.set(key, group);
    } else if (!(await allowed(st.location_id, 'things.mark-seen'))) {
      skipped += 1;
    } else if (l.action === 'seen') {
      seen.push(l);
    } else {
      notHere.push(l.thing_id);
    }
  }

  // Moves first: a moved thing is seen by its move.
  const moved: string[] = [];
  for (const { to, ids } of moves.values()) {
    for (let i = 0; i < ids.length; i += MOVE_CHUNK) {
      const chunk = ids.slice(i, i + MOVE_CHUNK);
      const move = (thingIds: string[]) => () =>
        moveThings(ctx, { thingIds, to }, null, { undoable: false }).then(() => {});
      if (await tryApply(client, move(chunk))) {
        moved.push(...chunk);
        continue;
      }
      for (const one of chunk) {
        if (await tryApply(client, move([one]))) moved.push(one);
        else skipped += 1;
      }
    }
  }

  if (seen.length > 0) {
    await client.query(
      `UPDATE public.things t
          SET last_seen_at = greatest(t.last_seen_at, x.read_at), location_uncertain = false
         FROM unnest($1::uuid[], $2::timestamptz[]) x(id, read_at)
        WHERE t.id = x.id`,
      [seen.map((l) => l.thing_id), seen.map((l) => l.read_at)],
    );
  }
  if (notHere.length > 0) {
    await client.query(
      'UPDATE public.things SET location_uncertain = true WHERE id = ANY ($1::uuid[])',
      [notHere],
    );
  }

  // With the option, what is inside a box that was read is seen with it, at the box's time.
  const inside: string[] = [];
  if (s.mode === 'count' && payload.contentsSeen && seen.length > 0) {
    const { rows } = await client.query<{ id: string; read_at: Date }>(
      `WITH RECURSIVE inside(id, read_at, depth) AS (
         SELECT t.id, x.read_at, 1
           FROM unnest($1::uuid[], $2::timestamptz[]) x(box, read_at)
           JOIN public.things t ON t.container_id = x.box AND t.deleted_at IS NULL
         UNION ALL
         SELECT t.id, i.read_at, i.depth + 1
           FROM inside i JOIN public.things t ON t.container_id = i.id AND t.deleted_at IS NULL
          WHERE i.depth < 20)
       SELECT DISTINCT ON (id) id, read_at FROM inside ORDER BY id, read_at DESC`,
      [seen.map((l) => l.thing_id), seen.map((l) => l.read_at)],
    );
    const fresh = rows.filter((r) => !before.has(r.id));
    const extra = await statesOf(
      client,
      fresh.map((r) => r.id),
      true,
    );
    const writable: { id: string; read_at: Date }[] = [];
    for (const r of fresh) {
      const st = extra.get(r.id);
      if (st && (await allowed(st.location_id, 'things.mark-seen'))) {
        before.set(r.id, st);
        writable.push(r);
      }
    }
    if (writable.length > 0) {
      await client.query(
        `UPDATE public.things t
            SET last_seen_at = greatest(t.last_seen_at, x.read_at), location_uncertain = false
           FROM unnest($1::uuid[], $2::timestamptz[]) x(id, read_at)
          WHERE t.id = x.id`,
        [writable.map((r) => r.id), writable.map((r) => r.read_at)],
      );
      inside.push(...writable.map((r) => r.id));
    }
  }

  const touched = [...new Set([...seen.map((l) => l.thing_id), ...notHere, ...moved, ...inside])];
  const after = await statesOf(client, touched);
  const until = undoableUntil();
  const counts = {
    seen: seen.length + inside.length,
    not_here: notHere.length,
    moved: moved.length,
    skipped,
  };
  const entity =
    s.target_place_id !== null
      ? { type: 'place', id: s.target_place_id }
      : s.target_container_id !== null
        ? { type: 'thing', id: s.target_container_id }
        : { type: 'location', id: s.location_id };
  const inLocation = (x: string) =>
    before.get(x)?.location_id === s.location_id || after.get(x)?.location_id === s.location_id;
  const targets = new Set([...moves.values()].map((g) => JSON.stringify(g.to)));
  const event =
    touched.length > 0
      ? await audited(tx, {
          locationId: s.location_id,
          actor: actorOf(scope),
          action: 'scan.session',
          entity,
          before: {
            state: Object.fromEntries(
              touched.map((x) => [x, stateOf(before.get(x) as State & { deleted: boolean })]),
            ),
          },
          after: {
            state: Object.fromEntries(touched.map((x) => [x, stateOf(after.get(x) as State)])),
            session_id: id,
            mode: s.mode,
            moved,
            counts: {
              ...counts,
              found: s.mode === 'count' ? seen.length + moved.length : null,
              expected: payload.expected ?? null,
              targets: targets.size,
            },
          },
          ...(entity.type === 'thing' ? { rootThingId: entity.id } : {}),
          subjects: touched.filter(inLocation),
          requestId: ctx.requestId,
          undoableUntil: until,
        })
      : null;

  await client.query(
    `UPDATE public.scan_sessions
        SET finished_at = now(), expected = $2, seen = $3, not_here = $4, moved = $5,
            skipped = $6, audit_event_id = $7
      WHERE id = $1`,
    [
      id,
      payload.expected ?? null,
      counts.seen,
      counts.not_here,
      counts.moved,
      counts.skipped,
      event?.id ?? null,
    ],
  );
  return { sessionId: id, eventId: event?.id ?? null };
}

/** GET /api/v1/scan-sessions/:id. */
export async function sessionView(client: pg.ClientBase, id: string): Promise<ScanSessionView> {
  const { rows } = await client.query<{
    id: string;
    mode: ScanSessionMode;
    location_id: string;
    started_at: Date;
    finished_at: Date | null;
    expected: number | null;
    seen: number;
    not_here: number;
    moved: number;
    skipped: number;
    event_id: string | null;
    until: Date | null;
    undone: boolean;
  }>(
    `SELECT s.id, s.mode, s.location_id, s.started_at, s.finished_at, s.expected, s.seen,
            s.not_here, s.moved, s.skipped, e.id AS event_id, e.undoable_until AS until,
            EXISTS (SELECT 1 FROM public.audit_events u
                     WHERE u.undo_of = e.id AND u.location_id = s.location_id) AS undone
       FROM public.scan_sessions s
       LEFT JOIN public.audit_events e
              ON e.id = s.audit_event_id AND e.location_id = s.location_id
      WHERE s.id = $1`,
    [id],
  );
  const r = rows[0];
  if (!r) throw notFound();
  return {
    id: r.id,
    mode: r.mode,
    locationId: r.location_id,
    startedAt: r.started_at.toISOString(),
    finishedAt: r.finished_at?.toISOString() ?? null,
    expected: r.expected,
    seen: r.seen,
    notHere: r.not_here,
    moved: r.moved,
    skipped: r.skipped,
    ...(r.event_id && r.until && !r.undone && r.until.getTime() > Date.now()
      ? { undo: { eventId: r.event_id, until: r.until.toISOString() } }
      : {}),
  };
}

// ----- undo ---------------------------------------------------------------------------------------

type Diff = {
  state?: { before?: Record<string, State> | null; after?: Record<string, State> | null };
  moved?: { after?: string[] | null };
};

const same = (a: State, b: State) =>
  a.location_id === b.location_id &&
  a.place_id === b.place_id &&
  a.container_id === b.container_id &&
  a.location_uncertain === b.location_uncertain &&
  Date.parse(a.last_seen_at) === Date.parse(b.last_seen_at);

async function undoScanSession(args: UndoArgs): Promise<void> {
  const { client, event } = args;
  const diff = event.diff as Diff;
  const was = diff.state?.before ?? {};
  const left = diff.state?.after ?? {};
  const moved = new Set(diff.moved?.after ?? []);
  const ids = Object.keys(left);
  const now = await statesOf(client, ids, true);
  const changed = ids.filter((x) => {
    const r = now.get(x);
    return !r || r.deleted || !same(stateOf(r), left[x] as State);
  });
  if (changed.length > 0) {
    const first = changed[0] as string;
    const by = await lastChangedBy(
      client,
      now.get(first)?.location_id ?? event.locationId,
      { type: 'thing', id: first },
      event.at,
    );
    throw undoConflict(['things'], by);
  }
  const ctx: Ctx = {
    tx: args.tx,
    client: args.client,
    scope: args.scope,
    requestId: args.requestId,
    jobs: args.deps.jobs,
    files: args.deps.files,
  };
  for (const x of ids) {
    if (!moved.has(x)) continue;
    const back = was[x] as State;
    await moveBackForUndo(
      ctx,
      x,
      { locationId: back.location_id, placeId: back.place_id, containerId: back.container_id },
      { locationId: event.locationId, write: (e) => audited(args.tx, e).then(() => {}) },
    );
  }
  await client.query(
    `UPDATE public.things t
        SET last_seen_at = x.seen, location_uncertain = x.uncertain
       FROM unnest($1::uuid[], $2::timestamptz[], $3::boolean[]) x(id, seen, uncertain)
      WHERE t.id = x.id`,
    [
      ids,
      ids.map((x) => (was[x] as State).last_seen_at),
      ids.map((x) => (was[x] as State).location_uncertain),
    ],
  );
  const subjects = ids.filter(
    (x) => was[x]?.location_id === event.locationId || left[x]?.location_id === event.locationId,
  );
  await args.audit({
    action: 'scan.session',
    entity: { type: event.entityType, id: event.entityId },
    before: { state: left },
    after: { state: was },
    ...(event.rootThingId ? { rootThingId: event.rootThingId } : {}),
    subjects,
  });
}

let registered = false;
/** Registers the `scan.session` undo (audit/undo.ts). Idempotent. */
export function registerScanSessionUndo(): void {
  if (registered) return;
  registered = true;
  registerUndo('scan.session', undoScanSession);
}
