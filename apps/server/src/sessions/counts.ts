import { SCAN_SESSION_ACTIONS, type ScanSessionTarget } from '@kept/shared';
import type pg from 'pg';
import { z } from 'zod';
import { encodeCursor, type PageRequest } from '../http/conventions.js';
import { invalid, notFound } from '../http/errors.js';
import { callerMembership } from '../locations/access.js';

// Counts that keep every result (1.14, #172): the reads behind the Counts page, a count's page
// (its lists, where each thing is now, the comparison with the previous count of the same
// target), its CSV, a box check's lines, and the shared count (the open count of a target and
// its lines so far, for "Count in progress by Sam: Join"). sessions/service.ts stores them.
//
// Everyone who sees the location reads them, viewers included (a viewer's own check is never
// stored). A count from before 1.14 has no kept results: `recorded` is false and its lists hold
// only what it applied.

const Named = z.object({ id: z.uuid(), name: z.string() });
const By = z.object({ id: z.uuid().nullable(), displayName: z.string() });
const Target = z.object({
  type: z.enum(['place', 'thing', 'location']),
  id: z.uuid(),
  name: z.string(),
  inside: z.boolean().optional(),
});

export const CountsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().max(2048).optional(),
  q: z.string().trim().max(120).optional(),
  kind: z.enum(['count', 'box_check']).optional(),
  placeId: z.uuid().optional(),
  by: z.uuid().optional(),
  had: z.enum(['missing']).optional(),
  /** From this moment, and before `to` (the web's date filter: a day's start, the next day's). */
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
});
export type CountsQuery = z.infer<typeof CountsQuery>;

export const CountSummarySchema = z.object({
  id: z.uuid(),
  kind: z.enum(['count', 'box_check']),
  at: z.string(),
  by: By,
  target: Target,
  found: z.number().int(),
  expected: z.number().int().nullable(),
  missing: z.number().int().nullable(),
  notHere: z.number().int(),
  undone: z.boolean(),
});
export type CountSummary = z.infer<typeof CountSummarySchema>;

export const CountsPageSchema = z.object({
  items: z.array(CountSummarySchema),
  next_cursor: z.string().nullable(),
});

const RESULTS = SCAN_SESSION_ACTIONS;

export const ResultLineSchema = z.object({
  thing: z.object({
    id: z.uuid(),
    name: z.string().nullable(),
    shortCode: z.string().nullable(),
    trashed: z.boolean(),
  }),
  result: z.enum(RESULTS),
  was: Named.nullable(),
  now: Named.nullable(),
  area: Named.nullable(),
  foundQty: z.string().nullable(),
  expectedQty: z.string().nullable(),
  readAt: z.string(),
  readBy: By.nullable(),
});
export type ResultLine = z.infer<typeof ResultLineSchema>;

const CompareSchema = z.object({
  newlyMissing: z.array(z.uuid()),
  foundAgain: z.array(z.uuid()),
  newThings: z.array(z.uuid()),
});

export const CountResultSchema = z.object({
  session: z.object({
    id: z.uuid(),
    locationId: z.uuid(),
    target: Target,
    by: By,
    finishedBy: By.nullable(),
    startedAt: z.string(),
    finishedAt: z.string().nullable(),
    expected: z.number().int().nullable(),
    seen: z.number().int(),
    notHere: z.number().int(),
    moved: z.number().int(),
    skipped: z.number().int(),
    missing: z.number().int().nullable(),
    elsewhere: z.number().int().nullable(),
    onLoan: z.number().int().nullable(),
    inRepair: z.number().int().nullable(),
    notCounted: z.number().int().nullable(),
    recorded: z.boolean(),
    countedPlaceIds: z.array(z.uuid()).nullable(),
    schedule: Named.nullable(),
    readers: z.array(By),
    undone: z.boolean(),
  }),
  lines: z.array(ResultLineSchema),
  previous: z.object({ id: z.uuid(), finishedAt: z.string() }).nullable(),
  compare: CompareSchema.nullable(),
});
export type CountResult = z.infer<typeof CountResultSchema>;

export const BoxCheckDetailSchema = z.object({
  id: z.uuid(),
  locationId: z.uuid(),
  at: z.string(),
  by: By,
  container: Named,
  lines: z.array(
    z.object({
      thing: z.object({ id: z.uuid(), name: z.string().nullable(), trashed: z.boolean() }),
      expectedQty: z.string(),
      foundQty: z.string(),
    }),
  ),
});

export const OpenCountSchema = z.object({
  session: z
    .object({
      id: z.uuid(),
      target: Target,
      startedAt: z.string(),
      lastReadAt: z.string(),
      by: By,
      readers: z.array(By),
      lines: z.number().int(),
      countedPlaceIds: z.array(z.uuid()).nullable(),
    })
    .nullable(),
});

export const SessionLinesSchema = z.object({
  finishedAt: z.string().nullable(),
  countedPlaceIds: z.array(z.uuid()).nullable(),
  lines: z.array(
    z.object({
      thingId: z.uuid(),
      action: z.enum(RESULTS),
      readAt: z.string(),
      readBy: By.nullable(),
      foundQty: z.string().nullable(),
    }),
  ),
});

/** An open count shows as "in progress" while someone read something in it this week. */
const OPEN_FOR_DAYS = 7;

const by = (id: string | null, name: string | null) => ({ id, displayName: name ?? '' });

async function requireVisible(client: pg.ClientBase, locationId: string): Promise<void> {
  if (!(await callerMembership(client, locationId))) throw notFound();
}

const UNDONE = (event: string, location: string) =>
  `EXISTS (SELECT 1 FROM public.audit_events u WHERE u.undo_of = ${event}
                AND u.location_id = ${location})`;

const TARGET_SQL = `
  CASE WHEN s.target_place_id IS NOT NULL
         THEN jsonb_build_object('type', 'place', 'id', s.target_place_id, 'name', tp.name,
                                 'inside', s.target_inside)
       WHEN s.target_container_id IS NOT NULL
         THEN jsonb_build_object('type', 'thing', 'id', s.target_container_id,
                                 'name', coalesce(tc.name, ''))
       ELSE jsonb_build_object('type', 'location', 'id', s.location_id, 'name', l.name) END`;

const TARGET_JOINS = `
  LEFT JOIN public.places tp ON tp.id = s.target_place_id
  LEFT JOIN public.things tc ON tc.id = s.target_container_id
  JOIN public.locations l ON l.id = s.location_id`;

/** GET /api/v1/locations/:id/counts: finished counts and box checks, newest first. */
export async function listCounts(
  client: pg.ClientBase,
  locationId: string,
  query: CountsQuery,
  page: PageRequest<[string, string]>,
): Promise<z.infer<typeof CountsPageSchema>> {
  await requireVisible(client, locationId);
  const after = page.after;
  if (after && (typeof after[0] !== 'string' || typeof after[1] !== 'string'))
    throw invalid('The cursor is not valid; start again from the first page.');
  const q = query.q ? `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const { rows } = await client.query<{
    id: string;
    kind: 'count' | 'box_check';
    at: Date;
    by_id: string | null;
    by_name: string | null;
    target: z.infer<typeof Target>;
    found: number;
    expected: number | null;
    missing: number | null;
    not_here: number;
    undone: boolean;
  }>(
    `WITH c AS (
       SELECT s.id, 'count'::text AS kind, s.finished_at AS at, s.started_by AS by_id,
              ${TARGET_SQL} AS target,
              (s.seen + s.moved) AS found, s.expected, s.missing, s.not_here,
              ${UNDONE('s.audit_event_id', 's.location_id')} AS undone,
              s.target_place_id AS place_id
         FROM public.scan_sessions s ${TARGET_JOINS}
        WHERE s.location_id = $1 AND s.mode = 'count' AND s.finished_at IS NOT NULL
       UNION ALL
       SELECT b.id, 'box_check', b.checked_at, b.checked_by,
              jsonb_build_object('type', 'thing', 'id', b.container_id, 'name', coalesce(t.name, '')),
              (SELECT count(*) FROM public.box_check_lines x
                WHERE x.box_check_id = b.id AND x.expected_qty > 0 AND x.found_qty > 0)::int,
              (SELECT count(*) FROM public.box_check_lines x
                WHERE x.box_check_id = b.id AND x.expected_qty > 0)::int,
              (SELECT count(*) FROM public.box_check_lines x
                WHERE x.box_check_id = b.id AND x.expected_qty > 0
                  AND x.found_qty < x.expected_qty)::int,
              (SELECT count(*) FROM public.box_check_lines x
                WHERE x.box_check_id = b.id AND x.expected_qty > 0 AND x.found_qty = 0)::int,
              false,
              t.place_id
         FROM public.box_checks b
         LEFT JOIN public.things t ON t.id = b.container_id
        WHERE b.location_id = $1)
     SELECT c.*, up.display_name AS by_name
       FROM c LEFT JOIN public.user_profiles up ON up.user_id = c.by_id
      WHERE ($2::text IS NULL OR c.kind = $2)
        AND ($3::uuid IS NULL OR c.place_id = $3)
        AND ($4::uuid IS NULL OR c.by_id = $4)
        AND ($5::text IS NULL OR c.missing > 0)
        AND ($6::timestamptz IS NULL OR c.at >= $6::timestamptz)
        AND ($7::timestamptz IS NULL OR c.at < $7::timestamptz)
        AND ($8::text IS NULL OR c.target->>'name' ILIKE $8)
        AND ($9::timestamptz IS NULL OR (c.at, c.id) < ($9::timestamptz, $10::uuid))
      ORDER BY c.at DESC, c.id DESC
      LIMIT $11`,
    [
      locationId,
      query.kind ?? null,
      query.placeId?.toLowerCase() ?? null,
      query.by?.toLowerCase() ?? null,
      query.had ?? null,
      query.from ?? null,
      query.to ?? null,
      q,
      after?.[0] ?? null,
      after?.[1] ?? null,
      page.limit + 1,
    ],
  );
  const items = rows.slice(0, page.limit);
  const last = items.at(-1);
  return {
    items: items.map((r) => ({
      id: r.id,
      kind: r.kind,
      at: r.at.toISOString(),
      by: by(r.by_id, r.by_name),
      target: r.target,
      found: r.found,
      expected: r.expected,
      missing: r.missing,
      notHere: r.not_here,
      undone: r.undone,
    })),
    next_cursor:
      rows.length > page.limit && last ? encodeCursor([last.at.toISOString(), last.id]) : null,
  };
}

type SessionHead = {
  id: string;
  location_id: string;
  target: z.infer<typeof Target>;
  target_place_id: string | null;
  target_container_id: string | null;
  target_inside: boolean | null;
  started_by: string;
  started_name: string | null;
  finished_by: string | null;
  finished_name: string | null;
  started_at: Date;
  finished_at: Date | null;
  expected: number | null;
  seen: number;
  not_here: number;
  moved: number;
  skipped: number;
  missing: number | null;
  elsewhere: number | null;
  on_loan: number | null;
  in_repair: number | null;
  not_counted: number | null;
  counted_place_ids: string[] | null;
  schedule: { id: string; name: string } | null;
  undone: boolean;
};

async function countHead(client: pg.ClientBase, id: string): Promise<SessionHead> {
  const { rows } = await client.query<SessionHead>(
    `SELECT s.id, s.location_id, ${TARGET_SQL} AS target, s.target_place_id,
            s.target_container_id, s.target_inside, s.started_by, sp.display_name AS started_name,
            s.finished_by, fp.display_name AS finished_name, s.started_at, s.finished_at,
            s.expected, s.seen, s.not_here, s.moved, s.skipped, s.missing, s.elsewhere,
            s.on_loan, s.in_repair, s.not_counted, s.counted_place_ids,
            CASE WHEN sc.id IS NOT NULL THEN jsonb_build_object('id', sc.id, 'name', sc.name)
            END AS schedule,
            ${UNDONE('s.audit_event_id', 's.location_id')} AS undone
       FROM public.scan_sessions s ${TARGET_JOINS}
       LEFT JOIN public.user_profiles sp ON sp.user_id = s.started_by
       LEFT JOIN public.user_profiles fp ON fp.user_id = s.finished_by
       LEFT JOIN public.schedules sc ON sc.id = s.schedule_id
      WHERE s.id = $1 AND s.mode = 'count'`,
    [id],
  );
  const r = rows[0];
  if (!r) throw notFound();
  return r;
}

/** Where a thing is now, or was: its box, else its place. */
const WHERE_SQL = (place: string, box: string) => `
  CASE WHEN ${box} IS NOT NULL
         THEN (SELECT jsonb_build_object('id', b.id, 'name', coalesce(b.name, ''))
                 FROM public.things b WHERE b.id = ${box})
       WHEN ${place} IS NOT NULL
         THEN (SELECT jsonb_build_object('id', p.id, 'name', p.name)
                 FROM public.places p WHERE p.id = ${place}) END`;

async function resultLines(client: pg.ClientBase, id: string): Promise<ResultLine[]> {
  const { rows } = await client.query<{
    thing_id: string;
    name: string | null;
    short_code: string | null;
    trashed: boolean;
    action: ResultLine['result'];
    was: { id: string; name: string } | null;
    now: { id: string; name: string } | null;
    area: { id: string; name: string } | null;
    found_qty: string | null;
    expected_qty: string | null;
    read_at: Date;
    read_by: string | null;
    read_name: string | null;
  }>(
    `SELECT l.thing_id, t.name, sc.code AS short_code, t.deleted_at IS NOT NULL AS trashed,
            l.action, ${WHERE_SQL('l.was_place_id', 'l.was_container_id')} AS was,
            ${WHERE_SQL('t.place_id', 't.container_id')} AS now,
            (SELECT jsonb_build_object('id', p.id, 'name', p.name)
               FROM public.places p WHERE p.id = l.area_place_id) AS area,
            trim_scale(l.found_qty)::text AS found_qty,
            trim_scale(l.expected_qty)::text AS expected_qty, l.read_at, l.read_by,
            up.display_name AS read_name
       FROM public.scan_session_lines l
       JOIN public.things t ON t.id = l.thing_id
       LEFT JOIN public.short_ids sc
              ON sc.thing_id = t.id AND sc.is_primary AND sc.state = 'assigned'
       LEFT JOIN public.user_profiles up ON up.user_id = l.read_by
      WHERE l.session_id = $1
      ORDER BY t.name NULLS LAST, l.thing_id`,
    [id],
  );
  return rows.map((r) => ({
    thing: { id: r.thing_id, name: r.name, shortCode: r.short_code, trashed: r.trashed },
    result: r.action,
    was: r.was,
    now: r.now,
    area: r.area,
    foundQty: r.found_qty,
    expectedQty: r.expected_qty,
    readAt: r.read_at.toISOString(),
    readBy: r.read_by ? by(r.read_by, r.read_name) : null,
  }));
}

const FOUND = new Set(['seen', 'move', 'elsewhere']);
const GONE = new Set(['missing', 'not_here']);

/** The previous finished, not undone count of the same target. */
async function previousOf(
  client: pg.ClientBase,
  s: SessionHead,
): Promise<{ id: string; finished_at: Date } | null> {
  if (!s.finished_at) return null;
  const { rows } = await client.query<{ id: string; finished_at: Date }>(
    `SELECT p.id, p.finished_at FROM public.scan_sessions p
      WHERE p.location_id = $1 AND p.mode = 'count' AND p.finished_at IS NOT NULL
        AND p.target_place_id IS NOT DISTINCT FROM $2
        AND p.target_container_id IS NOT DISTINCT FROM $3
        AND p.target_inside IS NOT DISTINCT FROM $4
        AND (p.finished_at, p.id) < ($5::timestamptz, $6::uuid)
        AND NOT ${UNDONE('p.audit_event_id', 'p.location_id')}
      ORDER BY p.finished_at DESC, p.id DESC LIMIT 1`,
    [s.location_id, s.target_place_id, s.target_container_id, s.target_inside, s.finished_at, s.id],
  );
  return rows[0] ?? null;
}

/** GET /api/v1/scan-sessions/:id/result: a count, its lists, and against the previous one. */
export async function countResult(client: pg.ClientBase, id: string): Promise<CountResult> {
  const s = await countHead(client, id);
  const lines = await resultLines(client, id);
  const prev = await previousOf(client, s);
  let compare: CountResult['compare'] = null;
  if (prev) {
    const { rows } = await client.query<{ thing_id: string; action: string }>(
      'SELECT thing_id, action FROM public.scan_session_lines WHERE session_id = $1',
      [prev.id],
    );
    const before = new Map(rows.map((r) => [r.thing_id, r.action]));
    const sorted = (xs: string[]) => xs.sort();
    compare = {
      newlyMissing: sorted(
        lines
          .filter((l) => GONE.has(l.result) && FOUND.has(before.get(l.thing.id) ?? ''))
          .map((l) => l.thing.id),
      ),
      foundAgain: sorted(
        lines
          .filter((l) => FOUND.has(l.result) && GONE.has(before.get(l.thing.id) ?? ''))
          .map((l) => l.thing.id),
      ),
      newThings: sorted(lines.filter((l) => !before.has(l.thing.id)).map((l) => l.thing.id)),
    };
  }
  const readers = new Map<string, { id: string; displayName: string }>();
  for (const l of lines) if (l.readBy?.id) readers.set(l.readBy.id, l.readBy as never);
  return {
    session: {
      id: s.id,
      locationId: s.location_id,
      target: s.target,
      by: by(s.started_by, s.started_name),
      finishedBy: s.finished_by ? by(s.finished_by, s.finished_name) : null,
      startedAt: s.started_at.toISOString(),
      finishedAt: s.finished_at?.toISOString() ?? null,
      expected: s.expected,
      seen: s.seen,
      notHere: s.not_here,
      moved: s.moved,
      skipped: s.skipped,
      missing: s.missing,
      elsewhere: s.elsewhere,
      onLoan: s.on_loan,
      inRepair: s.in_repair,
      notCounted: s.not_counted,
      recorded: s.missing !== null,
      countedPlaceIds: s.counted_place_ids,
      schedule: s.schedule,
      readers: [...readers.values()],
      undone: s.undone,
    },
    lines,
    previous: prev ? { id: prev.id, finishedAt: prev.finished_at.toISOString() } : null,
    compare,
  };
}

const csvCell = (v: string | null | undefined) => {
  const s = v ?? '';
  // A cell a spreadsheet would run as a formula starts with a quote.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** GET /api/v1/scan-sessions/:id/result.csv: thing, short ID, where expected, result, where now. */
export async function countCsv(client: pg.ClientBase, id: string): Promise<string> {
  await countHead(client, id);
  const lines = await resultLines(client, id);
  const head = ['thing', 'short_id', 'where_expected', 'result', 'found', 'of', 'where_now'];
  const rows = lines.map((l) =>
    [
      l.thing.name,
      l.thing.shortCode,
      l.was?.name,
      l.thing.trashed && l.result !== 'trashed' ? `${l.result} (trashed)` : l.result,
      l.foundQty,
      l.expectedQty,
      l.now?.name,
    ]
      .map(csvCell)
      .join(','),
  );
  return `${[head.join(','), ...rows].join('\r\n')}\r\n`;
}

/** GET /api/v1/box-checks/:id: a box check and its lines. */
export async function boxCheckDetail(
  client: pg.ClientBase,
  id: string,
): Promise<z.infer<typeof BoxCheckDetailSchema>> {
  const { rows } = await client.query<{
    id: string;
    location_id: string;
    checked_at: Date;
    checked_by: string;
    display_name: string | null;
    container_id: string;
    container_name: string | null;
  }>(
    `SELECT b.id, b.location_id, b.checked_at, b.checked_by, up.display_name, b.container_id,
            c.name AS container_name
       FROM public.box_checks b
       LEFT JOIN public.things c ON c.id = b.container_id
       LEFT JOIN public.user_profiles up ON up.user_id = b.checked_by
      WHERE b.id = $1`,
    [id],
  );
  const b = rows[0];
  if (!b) throw notFound();
  const { rows: lines } = await client.query<{
    thing_id: string;
    name: string | null;
    trashed: boolean;
    expected_qty: string;
    found_qty: string;
  }>(
    `SELECT l.thing_id, t.name, t.deleted_at IS NOT NULL AS trashed,
            trim_scale(l.expected_qty)::text AS expected_qty,
            trim_scale(l.found_qty)::text AS found_qty
       FROM public.box_check_lines l JOIN public.things t ON t.id = l.thing_id
      WHERE l.box_check_id = $1
      ORDER BY t.name NULLS LAST, l.thing_id`,
    [id],
  );
  return {
    id: b.id,
    locationId: b.location_id,
    at: b.checked_at.toISOString(),
    by: by(b.checked_by, b.display_name),
    container: { id: b.container_id, name: b.container_name ?? '' },
    lines: lines.map((l) => ({
      thing: { id: l.thing_id, name: l.name, trashed: l.trashed },
      expectedQty: l.expected_qty,
      foundQty: l.found_qty,
    })),
  };
}

/**
 * GET /api/v1/scan-sessions/open?placeId|containerId|locationId: the open count of that target
 * someone read something in this week, newest first; null when there is none.
 */
export async function openCount(
  client: pg.ClientBase,
  target: ScanSessionTarget,
): Promise<z.infer<typeof OpenCountSchema>> {
  const place = 'placeId' in target ? target.placeId.toLowerCase() : null;
  const box = 'containerId' in target ? target.containerId.toLowerCase() : null;
  const loc = 'locationId' in target ? target.locationId.toLowerCase() : null;
  const { rows } = await client.query<{
    id: string;
    target: z.infer<typeof Target>;
    started_at: Date;
    last_read_at: Date;
    started_by: string;
    display_name: string | null;
    readers: { id: string; displayName: string | null }[];
    lines: number;
    counted_place_ids: string[] | null;
  }>(
    `SELECT s.id, ${TARGET_SQL} AS target, s.started_at, s.started_by, up.display_name,
            greatest(s.started_at, (SELECT max(x.read_at) FROM public.scan_session_lines x
                                     WHERE x.session_id = s.id)) AS last_read_at,
            (SELECT count(*) FROM public.scan_session_lines x WHERE x.session_id = s.id)::int
              AS lines,
            coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.read_by,
                                                          'displayName', rp.display_name)
                                       ORDER BY rp.display_name)
                        FROM (SELECT DISTINCT read_by FROM public.scan_session_lines x
                               WHERE x.session_id = s.id AND x.read_by IS NOT NULL) r
                        LEFT JOIN public.user_profiles rp ON rp.user_id = r.read_by),
                     '[]'::jsonb) AS readers,
            s.counted_place_ids
       FROM public.scan_sessions s ${TARGET_JOINS}
       LEFT JOIN public.user_profiles up ON up.user_id = s.started_by
      WHERE s.finished_at IS NULL AND s.mode = 'count'
        AND (($1::uuid IS NOT NULL AND s.target_place_id = $1)
          OR ($2::uuid IS NOT NULL AND s.target_container_id = $2)
          OR ($3::uuid IS NOT NULL AND s.location_id = $3 AND s.target_place_id IS NULL
              AND s.target_container_id IS NULL))
        AND greatest(s.started_at, (SELECT max(x.read_at) FROM public.scan_session_lines x
                                     WHERE x.session_id = s.id))
            > now() - make_interval(days => $4)
      ORDER BY last_read_at DESC, s.id DESC LIMIT 1`,
    [place, box, loc, OPEN_FOR_DAYS],
  );
  const r = rows[0];
  if (!r) return { session: null };
  return {
    session: {
      id: r.id,
      target: r.target,
      startedAt: r.started_at.toISOString(),
      lastReadAt: r.last_read_at.toISOString(),
      by: by(r.started_by, r.display_name),
      readers: r.readers.map((x) => by(x.id, x.displayName)),
      lines: r.lines,
      countedPlaceIds: r.counted_place_ids,
    },
  };
}

/** GET /api/v1/scan-sessions/:id/lines: what everyone read in a count so far, to merge. */
export async function sessionLines(
  client: pg.ClientBase,
  id: string,
): Promise<z.infer<typeof SessionLinesSchema>> {
  const { rows: head } = await client.query<{
    finished_at: Date | null;
    counted_place_ids: string[] | null;
  }>(
    `SELECT finished_at, counted_place_ids FROM public.scan_sessions
      WHERE id = $1 AND mode = 'count'`,
    [id],
  );
  const s = head[0];
  if (!s) throw notFound();
  const { rows } = await client.query<{
    thing_id: string;
    action: ResultLine['result'];
    read_at: Date;
    read_by: string | null;
    display_name: string | null;
    found_qty: string | null;
  }>(
    `SELECT l.thing_id, l.action, l.read_at, l.read_by, up.display_name,
            trim_scale(l.found_qty)::text AS found_qty
       FROM public.scan_session_lines l
       LEFT JOIN public.user_profiles up ON up.user_id = l.read_by
      WHERE l.session_id = $1 ORDER BY l.read_at, l.thing_id`,
    [id],
  );
  return {
    finishedAt: s.finished_at?.toISOString() ?? null,
    countedPlaceIds: s.counted_place_ids,
    lines: rows.map((r) => ({
      thingId: r.thing_id,
      action: r.action,
      readAt: r.read_at.toISOString(),
      readBy: r.read_by ? by(r.read_by, r.display_name) : null,
      foundQty: r.found_qty,
    })),
  };
}
