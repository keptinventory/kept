import {
  type Condition,
  HANDOVER_LIMITS,
  type LoanDirection,
  newId,
  type ReturnLineOutcome,
} from '@kept/shared';
import type pg from 'pg';
import { z } from 'zod';
import { audited } from '../audit/audited.js';
import {
  changedSince,
  lastChangedBy,
  notUndoable,
  registerUndo,
  type UndoArgs,
  undoableUntil,
  undoConflict,
} from '../audit/undo.js';
import { assertClientId, checkVersion } from '../http/conventions.js';
import { AppError, conflict, invalid, notFound } from '../http/errors.js';
import { requireModule, todayIn } from '../schedules/service.js';
import { liveThing, requireRole, splitThing, writableThing } from '../things/service.js';
import type { ThingRow } from '../things/view.js';
import { returnLoan, thingState } from './return.js';
import {
  actor,
  type Ctx,
  loanRecord,
  type PersonInput,
  personFor,
  requireLoanVersion,
  writableLoan,
} from './service.js';
import {
  anyRowsOf,
  LOAN_FROM,
  LOAN_VIEW_COLUMNS,
  type Loan,
  LoanSchema,
  loanImage,
  loansOf,
  loanView,
} from './view.js';

// Hand-overs (1.14, #170): every item that goes out keeps its own record.
//
// Lending a thing makes one hand-over to the person with one line, a loan, per item: the thing
// itself and, a box, everything inside it at that moment, all the way down, each line saying
// where it sat ("Camera bag › Lens pouch"); a kit may take its parts kept elsewhere too. A line is
// today's loan row, so the Lending list, the person page, the thing's Loans tab and the reminders
// read it as before. Something inside that is already lent, in repair or no longer in use stays
// behind, and the answer says so ("already with Alex"). Nothing moves: a lent box keeps its
// contents, and each of them reads "with Sam".
//
// Each line closes on its own, as a loan does (return.ts): came back, with the condition it came
// back in and a note, or lost (the thing ends as lost, never deleted); part of a quantity back,
// the rest stays out on its own line. A hand-over's return is a checklist of its open lines: one
// `loan.return` or `loan.lost` event per line, undone together. A line not returned stays open.
//
// One `handover.create` event per lend, undoable for 7 days while every line is as it went (no
// line closed, nothing split or changed): the undo removes the lines and the hand-over and puts a
// split-off part back into the row it came from.

const MODULE = 'lending' as const;

export type HandoverLine = Loan & {
  thing: { id: string; name: string | null; shortCode: string | null; quantity: string };
};

export type Excluded = {
  thingId: string;
  name: string | null;
  reason: 'on_loan' | 'in_repair' | 'ended';
  /** On loan: who has it. */
  with: string | null;
};

export type Handover = {
  id: string;
  locationId: string;
  direction: LoanDirection;
  person: { id: string; name: string; isMember: boolean };
  root: { id: string; name: string | null } | null;
  startedAt: string;
  dueOn: string | null;
  leadDays: number;
  notes: string | null;
  conditionOut: Condition | null;
  rowVersion: number;
  lines: HandoverLine[];
  counts: { lines: number; open: number; returned: number; lost: number };
  createdBy: { displayName: string };
};

const LineSchema = LoanSchema.extend({
  thing: z.object({
    id: z.uuid(),
    name: z.string().nullable(),
    shortCode: z.string().nullable(),
    quantity: z.string(),
  }),
});

export const HandoverSchema = z.object({
  id: z.uuid(),
  locationId: z.uuid(),
  direction: z.enum(['out', 'in']),
  person: z.object({ id: z.uuid(), name: z.string(), isMember: z.boolean() }),
  root: z.object({ id: z.uuid(), name: z.string().nullable() }).nullable(),
  startedAt: z.string(),
  dueOn: z.string().nullable(),
  leadDays: z.number(),
  notes: z.string().nullable(),
  conditionOut: z.string().nullable(),
  rowVersion: z.number(),
  lines: z.array(LineSchema),
  counts: z.object({
    lines: z.number(),
    open: z.number(),
    returned: z.number(),
    lost: z.number(),
  }),
  createdBy: z.object({ displayName: z.string() }),
});

export const ExcludedSchema = z.object({
  thingId: z.uuid(),
  name: z.string().nullable(),
  reason: z.enum(['on_loan', 'in_repair', 'ended']),
  with: z.string().nullable(),
});

type HandoverRecord = {
  id: string;
  location_id: string;
  direction: LoanDirection;
  person_id: string;
  root_thing_id: string | null;
  started_at: Date;
  due_on: string | null;
  lead_days: number;
  notes: string | null;
  condition_out: Condition | null;
  row_version: number;
  created_by: string;
};

async function handoverRecord(
  client: pg.ClientBase,
  id: string,
  lock = false,
): Promise<HandoverRecord> {
  const { rows } = await client.query<HandoverRecord>(
    `SELECT id, location_id, direction, person_id, root_thing_id, started_at,
            due_on::text AS due_on, lead_days, notes, condition_out, row_version, created_by
       FROM public.handovers WHERE id = $1${lock ? ' FOR UPDATE' : ''}`,
    [id],
  );
  const row = rows[0];
  if (!row) throw notFound();
  return row;
}

const handoverImage = (h: HandoverRecord) => ({
  direction: h.direction,
  person_id: h.person_id,
  root_thing_id: h.root_thing_id,
  started_at: h.started_at,
  due_on: h.due_on,
  lead_days: h.lead_days,
  notes: h.notes,
  condition_out: h.condition_out,
});

/** GET /api/v1/handovers/:id: a hand-over and its lines. */
export async function handoverView(
  ctx: Pick<Ctx, 'client' | 'files'>,
  id: string,
): Promise<Handover> {
  const { client, files } = ctx;
  const { rows } = await client.query<
    HandoverRecord & {
      person_name: string | null;
      is_member: boolean;
      root_name: string | null;
      created_by_name: string | null;
    }
  >(
    `SELECT h.id, h.location_id, h.direction, h.person_id, h.root_thing_id, h.started_at,
            h.due_on::text AS due_on, h.lead_days, h.notes, h.condition_out, h.row_version,
            h.created_by, pe.display_name AS person_name,
            pe.member_user_id IS NOT NULL AS is_member, r.name AS root_name,
            up.display_name AS created_by_name
       FROM public.handovers h
       LEFT JOIN public.people pe ON pe.id = h.person_id
       LEFT JOIN public.things r ON r.id = h.root_thing_id
       LEFT JOIN public.user_profiles up ON up.user_id = h.created_by
      WHERE h.id = $1`,
    [id],
  );
  const h = rows[0];
  if (!h) throw notFound();
  const { rows: lineRows } = await client.query(
    `SELECT ${LOAN_VIEW_COLUMNS}, t.name AS line_name, sc.code AS line_code
       ${LOAN_FROM}
       LEFT JOIN public.short_ids sc
              ON sc.thing_id = t.id AND sc.is_primary AND sc.state = 'assigned'
      WHERE o.handover_id = $1
      ORDER BY (o.thing_id = $2) DESC, o.path_at_lend NULLS FIRST, t.name, o.id`,
    [id, h.root_thing_id],
  );
  const loans = await loansOf(client, files, lineRows);
  const raw = lineRows as { line_name: string | null; line_code: string | null }[];
  const lines: HandoverLine[] = loans.map((l, i) => ({
    ...l,
    thing: {
      id: l.thingId,
      name: raw[i]?.line_name ?? null,
      shortCode: raw[i]?.line_code ?? null,
      quantity: l.quantity,
    },
  }));
  return {
    id: h.id,
    locationId: h.location_id,
    direction: h.direction,
    person: { id: h.person_id, name: h.person_name ?? '', isMember: h.is_member },
    root: h.root_thing_id ? { id: h.root_thing_id, name: h.root_name } : null,
    startedAt: h.started_at.toISOString(),
    dueOn: h.due_on,
    leadDays: h.lead_days,
    notes: h.notes,
    conditionOut: h.condition_out,
    rowVersion: h.row_version,
    lines,
    counts: {
      lines: lines.length,
      open: lines.filter((l) => l.returnedAt === null).length,
      returned: lines.filter((l) => l.outcome === 'returned').length,
      lost: lines.filter((l) => l.outcome === 'lost').length,
    },
    createdBy: { displayName: h.created_by_name ?? '' },
  };
}

/** GET /api/v1/things/:id/handovers: what was handed over with this thing as its root (a box's or
 * a kit's hand-overs), newest first. */
export async function thingHandovers(
  ctx: Pick<Ctx, 'client' | 'files'>,
  thingId: string,
): Promise<{ items: Handover[] }> {
  await liveThing(ctx.client, thingId);
  const { rows } = await ctx.client.query<{ id: string }>(
    `SELECT h.id FROM public.handovers h WHERE h.root_thing_id = $1
      ORDER BY h.started_at DESC, h.id DESC LIMIT 50`,
    [thingId],
  );
  const items: Handover[] = [];
  for (const r of rows) items.push(await handoverView(ctx, r.id));
  return { items };
}

// ---------------------------------------------------------------------------------------------
// Lend
// ---------------------------------------------------------------------------------------------

export type LendInput = {
  loanId?: string | undefined;
  handoverId?: string | undefined;
  person: PersonInput;
  startedAt?: string | undefined;
  dueOn?: string | undefined;
  quantity?: string | undefined;
  notes?: string | undefined;
  conditionOut?: Condition | undefined;
  /** Days before the due date the due-soon reminder comes (default 2). */
  leadDays?: number | undefined;
  /** A kit's parts kept elsewhere, lent with it. */
  alsoParts?: string[] | undefined;
};

/** 409 `thing_in_repair` while a claim of the thing is in repair (no Lend). */
async function inRepair(client: pg.ClientBase, ids: readonly string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { rows } = await client.query<{ thing_id: string }>(
    `SELECT DISTINCT thing_id FROM public.claims
      WHERE thing_id = ANY ($1::uuid[]) AND status = 'in_repair'`,
    [[...ids]],
  );
  return new Set(rows.map((r) => r.thing_id));
}

async function openLoans(
  client: pg.ClientBase,
  ids: readonly string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { rows } = await client.query<{ thing_id: string; person: string | null }>(
    `SELECT o.thing_id, pe.display_name AS person
       FROM public.loans o LEFT JOIN public.people pe ON pe.id = o.person_id
      WHERE o.thing_id = ANY ($1::uuid[]) AND o.returned_at IS NULL`,
    [[...ids]],
  );
  return new Map(rows.map((r) => [r.thing_id, r.person ?? '']));
}

/** "Due ≥ start", in the location's zone. */
async function checkDue(
  client: pg.ClientBase,
  locationId: string,
  startedAt: Date,
  dueOn: string | null,
): Promise<void> {
  if (dueOn === null) return;
  const { rows } = await client.query<{ start: string }>(
    `SELECT ($2::timestamptz AT TIME ZONE l.timezone)::date::text AS start
       FROM public.locations l WHERE l.id = $1`,
    [locationId, startedAt],
  );
  if (rows[0] && dueOn < rows[0].start) {
    throw invalid('Check body.dueOn: a loan is due on or after the day it starts.');
  }
}

type Inside = {
  id: string;
  name: string | null;
  lifecycle: string;
  place_id: string | null;
  container_id: string | null;
  path: string;
};

/** Everything inside `rootId`, all the way down, with the path of boxes from the root to it. */
async function contentsOf(client: pg.ClientBase, rootId: string): Promise<Inside[]> {
  const { rows } = await client.query<Inside>(
    `WITH RECURSIVE inside(id, name, lifecycle, place_id, container_id, path, depth) AS (
       SELECT t.id, t.name, t.lifecycle, t.place_id, t.container_id,
              coalesce(r.name, ''), 1
         FROM public.things t JOIN public.things r ON r.id = t.container_id
        WHERE t.container_id = $1 AND t.deleted_at IS NULL
       UNION ALL
       SELECT t.id, t.name, t.lifecycle, t.place_id, t.container_id,
              i.path || ' › ' || coalesce(i.name, ''), i.depth + 1
         FROM public.things t JOIN inside i ON t.container_id = i.id
        WHERE t.deleted_at IS NULL AND i.depth < 20)
     SELECT id, name, lifecycle, place_id, container_id, path FROM inside
      ORDER BY path, name, id`,
    [rootId],
  );
  return rows;
}

/**
 * POST /api/v1/things/:id/lend → 201 {loan, thing, splitFrom?, handover, excluded}: one
 * hand-over, a line for the thing and for everything inside it (and a kit's parts kept elsewhere,
 * when asked). Audited `handover.create`, undoable.
 */
export async function lend(
  ctx: Ctx,
  thingId: string,
  body: LendInput,
): Promise<{
  loan: Loan;
  thing: ThingRow;
  splitFrom?: ThingRow;
  handover: Handover;
  excluded: Excluded[];
}> {
  const { client } = ctx;
  const seen = await liveThing(client, thingId);
  await requireModule(ctx, seen.location_id, MODULE, 'write');
  const thing = await writableThing(client, thingId, 'things.edit');
  const loanId = body.loanId ? assertClientId(body.loanId) : newId();
  const handoverId = body.handoverId ? assertClientId(body.handoverId) : newId();
  if ((await openLoans(client, [thingId])).size > 0)
    throw new AppError('already_on_loan', 409, 'It is already on loan; mark it returned first.');
  if ((await inRepair(client, [thingId])).size > 0)
    throw new AppError('thing_in_repair', 409, "It's in repair; lend it once the claim is closed.");
  const { rows: life } = await client.query<{ lifecycle: string }>(
    'SELECT lifecycle FROM public.things WHERE id = $1',
    [thingId],
  );
  // Sold, given away, lost, archived…: only something in use is lent.
  if (life[0]?.lifecycle !== 'in_use')
    throw conflict('It has ended; only something in use is lent.');
  const startedAt = body.startedAt ? new Date(body.startedAt) : new Date();
  if (startedAt.getTime() > Date.now() + 60_000)
    throw invalid('Check body.startedAt: not in the future.');
  await checkDue(client, thing.location_id, startedAt, body.dueOn ?? null);
  const leadDays = body.leadDays ?? HANDOVER_LIMITS.defaultLeadDays;
  if (!Number.isInteger(leadDays) || leadDays < 0 || leadDays > HANDOVER_LIMITS.maxLeadDays)
    throw invalid(`Check body.leadDays: 0 to ${HANDOVER_LIMITS.maxLeadDays} days.`);
  const personId = await personFor(ctx, thing.location_id, body.person);

  // Part of a quantity: split it off first (D10), and lend the part.
  const total = Number(thing.quantity);
  const quantity = body.quantity === undefined ? total : Number(body.quantity);
  if (!(quantity > 0) || quantity > total) {
    throw invalid(`Check body.quantity: more than 0 and at most the ${thing.quantity} there are.`);
  }
  let lentId = thingId;
  let splitFrom: string | null = null;
  if (quantity < total) {
    const split = await splitThing(ctx, thingId, { quantity }, null);
    lentId = split.newId;
    splitFrom = thingId;
  }

  // What goes with it: everything inside it (a box), and a kit's parts kept elsewhere if asked.
  const inside = lentId === thingId ? await contentsOf(client, thingId) : [];
  let extra: Inside[] = [];
  if (body.alsoParts?.length) {
    const ids = [...new Set(body.alsoParts.map((x) => x.toLowerCase()))];
    const { rows } = await client.query<Inside>(
      `SELECT t.id, t.name, t.lifecycle, t.place_id, t.container_id, NULL AS path
         FROM public.kit_parts p JOIN public.things t ON t.id = p.thing_id
        WHERE p.kit_id = $1 AND p.thing_id = ANY ($2::uuid[]) AND t.deleted_at IS NULL`,
      [thingId, ids],
    );
    if (rows.length !== ids.length)
      throw invalid('Check body.alsoParts: the kit’s own parts only.');
    const within = new Set(inside.map((x) => x.id));
    extra = rows.filter((r) => !within.has(r.id));
  }
  const candidates = [...inside, ...extra];
  if (candidates.length + 1 > HANDOVER_LIMITS.lines)
    throw invalid(`A hand-over holds at most ${HANDOVER_LIMITS.lines} things.`);
  const ids = candidates.map((c) => c.id);
  const lent = await openLoans(client, ids);
  const repairing = await inRepair(client, ids);
  const excluded: Excluded[] = [];
  const going: Inside[] = [];
  // Inside something that stays behind, it stays behind too (it can't go without its box).
  const behind = new Set<string>();
  for (const c of candidates) {
    const reason: Excluded['reason'] | null = lent.has(c.id)
      ? 'on_loan'
      : repairing.has(c.id)
        ? 'in_repair'
        : c.lifecycle !== 'in_use'
          ? 'ended'
          : null;
    if (reason) {
      behind.add(c.id);
      excluded.push({
        thingId: c.id,
        name: c.name,
        reason,
        with: reason === 'on_loan' ? (lent.get(c.id) ?? null) : null,
      });
    } else if (c.container_id && behind.has(c.container_id)) {
      behind.add(c.id);
    } else going.push(c);
  }

  await client.query(
    `INSERT INTO public.handovers (id, location_id, direction, person_id, root_thing_id,
                                   started_at, due_on, lead_days, notes, condition_out, created_by)
     VALUES ($1, $2, 'out', $3, $4, $5, $6, $7, $8, $9, kept.current_user_id())`,
    [
      handoverId,
      thing.location_id,
      personId,
      lentId,
      startedAt,
      body.dueOn ?? null,
      leadDays,
      body.notes ?? null,
      body.conditionOut ?? null,
    ],
  );
  const { rows: at } = await client.query<{ place_id: string | null; container_id: string | null }>(
    'SELECT place_id, container_id FROM public.things WHERE id = $1',
    [lentId],
  );
  const lines = [
    {
      id: loanId,
      thing_id: lentId,
      place_id: at[0]?.place_id ?? null,
      container_id: at[0]?.container_id ?? null,
      path: null as string | null,
      split: splitFrom,
    },
    ...going.map((g) => ({
      id: newId(),
      thing_id: g.id,
      place_id: g.place_id,
      container_id: g.container_id,
      path: g.path || null,
      split: null as string | null,
    })),
  ];
  await client.query(
    `INSERT INTO public.loans (id, location_id, thing_id, direction, person_id, started_at, due_on,
                               previous_place_id, previous_container_id, split_from_thing_id,
                               notes, lead_days, created_by, handover_id, path_at_lend,
                               condition_out)
     SELECT x.id, $1, x.thing_id, 'out', $2, $3, $4, x.place_id, x.container_id, x.split, $5, $6,
            kept.current_user_id(), $7, x.path, $8
       FROM unnest($9::uuid[], $10::uuid[], $11::uuid[], $12::uuid[], $13::text[], $14::uuid[])
            x(id, thing_id, place_id, container_id, path, split)`,
    [
      thing.location_id,
      personId,
      startedAt,
      body.dueOn ?? null,
      body.notes ?? null,
      leadDays,
      handoverId,
      body.conditionOut ?? null,
      lines.map((l) => l.id),
      lines.map((l) => l.thing_id),
      lines.map((l) => l.place_id),
      lines.map((l) => l.container_id),
      lines.map((l) => l.path),
      lines.map((l) => l.split),
    ],
  );
  const record = await handoverRecord(client, handoverId);
  const { rows: who } = await client.query<{ display_name: string | null }>(
    'SELECT display_name FROM public.people WHERE id = $1',
    [personId],
  );
  await audited(ctx.tx, {
    locationId: thing.location_id,
    actor: actor(ctx.scope),
    action: 'handover.create',
    entity: { type: 'thing', id: lentId },
    before: null,
    after: {
      handover_id: handoverId,
      ...handoverImage(record),
      person_name: who[0]?.display_name ?? '',
      lines: lines.map((l) => ({ loan_id: l.id, thing_id: l.thing_id })),
      ...(splitFrom ? { split_from: splitFrom, split_quantity: String(quantity) } : {}),
    },
    subjects: [...lines.map((l) => l.thing_id), ...(splitFrom ? [splitFrom] : [])],
    rootThingId: lentId,
    requestId: ctx.requestId,
    undoableUntil: undoableUntil(),
  });
  const rows = await anyRowsOf(client, ctx.files, splitFrom ? [lentId, splitFrom] : [lentId]);
  return {
    loan: await loanView(client, ctx.files, loanId),
    thing: rows.get(lentId) as ThingRow,
    ...(splitFrom ? { splitFrom: rows.get(splitFrom) as ThingRow } : {}),
    handover: await handoverView(ctx, handoverId),
    excluded,
  };
}

// ---------------------------------------------------------------------------------------------
// Return, lost, change
// ---------------------------------------------------------------------------------------------

export type ReturnLine = {
  loanId: string;
  outcome: ReturnLineOutcome;
  conditionIn?: Condition | undefined;
  notes?: string | undefined;
  /** Part of a quantity came back. */
  quantityBack?: string | undefined;
  /** Also set the thing's condition to `conditionIn`. */
  updateCondition?: boolean | undefined;
};

/**
 * POST /api/v1/handovers/:id/return {returnedAt?, lines}: the checklist. Each listed open line
 * closes as it says (`loan.return` or `loan.lost`), "not returned" stays open, an unlisted line
 * is left as it is.
 */
export async function returnHandover(
  ctx: Ctx,
  id: string,
  body: { returnedAt?: string | undefined; lines: ReturnLine[] },
): Promise<Handover> {
  const first = await handoverRecord(ctx.client, id);
  await requireRole(ctx.client, first.location_id, 'things.edit');
  const h = await handoverRecord(ctx.client, id, true);
  const { rows } = await ctx.client.query<{ id: string; returned_at: Date | null }>(
    'SELECT id, returned_at FROM public.loans WHERE handover_id = $1',
    [id],
  );
  const mine = new Map(rows.map((r) => [r.id, r]));
  const seen = new Set<string>();
  for (const l of body.lines) {
    const loanId = l.loanId.toLowerCase();
    if (!mine.has(loanId)) throw invalid('Check body.lines: lines of this hand-over only.');
    if (seen.has(loanId)) throw invalid('Check body.lines: each line once.');
    seen.add(loanId);
  }
  for (const l of body.lines) {
    const loanId = l.loanId.toLowerCase();
    if (mine.get(loanId)?.returned_at) continue;
    if (l.outcome === 'not_returned') continue;
    const row = await loanRecord(ctx.client, loanId);
    if (l.outcome === 'lost') {
      await loseLoan(ctx, loanId, row.row_version, { notes: l.notes });
      continue;
    }
    await returnLoan(ctx, loanId, row.row_version, {
      ...(body.returnedAt ? { returnedAt: body.returnedAt } : {}),
      ...(l.notes !== undefined ? { notes: l.notes } : {}),
      ...(l.conditionIn ? { conditionIn: l.conditionIn } : {}),
      ...(l.updateCondition ? { updateCondition: true } : {}),
      ...(l.quantityBack !== undefined ? { quantityBack: l.quantityBack } : {}),
    });
  }
  return handoverView(ctx, h.id);
}

/**
 * POST /api/v1/loans/:id/lost (If-Match) {notes?}: the line closes as lost, and the thing ends as
 * lost today (never deleted). Audited `loan.lost`, undoable.
 */
export async function loseLoan(
  ctx: Ctx,
  id: string,
  expected: number,
  body: { notes?: string | undefined },
): Promise<{ loan: Loan }> {
  const { client } = ctx;
  const loan = await writableLoan(ctx, id, { closing: true });
  await requireLoanVersion(client, loan, expected, ['returnedAt']);
  if (loan.returned_at) throw conflict('It was already returned.');
  if (loan.direction !== 'out') throw invalid('Only something lent out is lost by its borrower.');
  await client.query('SELECT 1 FROM public.things WHERE id = $1 FOR UPDATE', [loan.thing_id]);
  const before = await thingState(client, loan.thing_id);
  if (!before) throw notFound();
  const today = await todayIn(client, loan.location_id);
  await client.query(
    `UPDATE public.things SET lifecycle = 'lost', ended_on = $2 WHERE id = $1 AND lifecycle = 'in_use'`,
    [loan.thing_id, today],
  );
  await client.query(
    `UPDATE public.loans
        SET returned_at = now(), outcome = 'lost',
            return_notes = CASE WHEN $2 THEN $3 ELSE return_notes END
      WHERE id = $1`,
    [id, body.notes !== undefined, body.notes ?? null],
  );
  const after = await loanRecord(client, id);
  const thingAfter = await thingState(client, loan.thing_id);
  const { rows: who } = await client.query<{ display_name: string | null }>(
    'SELECT display_name FROM public.people WHERE id = $1',
    [loan.person_id],
  );
  await audited(ctx.tx, {
    locationId: loan.location_id,
    actor: actor(ctx.scope),
    action: 'loan.lost',
    entity: { type: 'loan', id },
    before: {
      ...loanImage(loan),
      thing_lifecycle: before.lifecycle,
      thing_ended_on: before.ended_on,
    },
    after: {
      ...loanImage(after),
      thing_lifecycle: thingAfter?.lifecycle ?? null,
      thing_ended_on: thingAfter?.ended_on ?? null,
      person_name: who[0]?.display_name ?? '',
    },
    subjects: [loan.thing_id],
    rootThingId: loan.thing_id,
    requestId: ctx.requestId,
    undoableUntil: undoableUntil(),
  });
  return { loan: await loanView(client, ctx.files, id) };
}

export type UpdateHandoverInput = {
  dueOn?: string | null | undefined;
  leadDays?: number | undefined;
  notes?: string | null | undefined;
};

/**
 * PATCH /api/v1/handovers/:id (If-Match) {dueOn?, leadDays?, notes?}: the due date and the
 * due-soon lead go to its open lines too. Audited `handover.update`, undoable.
 */
export async function updateHandover(
  ctx: Ctx,
  id: string,
  expected: number,
  body: UpdateHandoverInput,
): Promise<Handover> {
  const { client } = ctx;
  const seen = await handoverRecord(client, id);
  await requireModule(ctx, seen.location_id, MODULE, 'write');
  await requireRole(client, seen.location_id, 'things.edit');
  const before = await handoverRecord(client, id, true);
  if (before.row_version !== expected) {
    const by = await lastChangedBy(client, before.location_id, { type: 'handover', id });
    checkVersion(
      { rowVersion: before.row_version },
      expected,
      Object.keys(body),
      by ? { displayName: by } : null,
    );
  }
  if (body.leadDays !== undefined) {
    if (
      !Number.isInteger(body.leadDays) ||
      body.leadDays < 0 ||
      body.leadDays > HANDOVER_LIMITS.maxLeadDays
    )
      throw invalid(`Check body.leadDays: 0 to ${HANDOVER_LIMITS.maxLeadDays} days.`);
  }
  if (body.dueOn) await checkDue(client, before.location_id, before.started_at, body.dueOn);
  await client.query(
    `UPDATE public.handovers
        SET due_on = CASE WHEN $2 THEN $3::date ELSE due_on END,
            lead_days = coalesce($4, lead_days),
            notes = CASE WHEN $5 THEN $6 ELSE notes END
      WHERE id = $1`,
    [
      id,
      body.dueOn !== undefined,
      body.dueOn ?? null,
      body.leadDays ?? null,
      body.notes !== undefined,
      body.notes ?? null,
    ],
  );
  const after = await handoverRecord(client, id);
  const { rows: open } = await client.query<{
    id: string;
    due_on: string | null;
    lead_days: number;
  }>(
    `UPDATE public.loans o SET due_on = $2, lead_days = $3
       FROM public.loans was
      WHERE o.id = was.id AND o.handover_id = $1 AND o.returned_at IS NULL
        AND (o.due_on IS DISTINCT FROM $2::date OR o.lead_days <> $3)
     RETURNING o.id, was.due_on::text AS due_on, was.lead_days`,
    [id, after.due_on, after.lead_days],
  );
  await audited(ctx.tx, {
    locationId: before.location_id,
    actor: actor(ctx.scope),
    action: 'handover.update',
    entity: { type: 'handover', id },
    before: {
      ...handoverImage(before),
      lines: open.map((l) => ({ loan_id: l.id, due_on: l.due_on, lead_days: l.lead_days })),
    },
    after: {
      ...handoverImage(after),
      lines: open.map((l) => ({ loan_id: l.id, due_on: after.due_on, lead_days: after.lead_days })),
    },
    subjects: (
      await client.query<{ thing_id: string }>(
        'SELECT thing_id FROM public.loans WHERE handover_id = $1',
        [id],
      )
    ).rows.map((r) => r.thing_id),
    ...(before.root_thing_id ? { rootThingId: before.root_thing_id } : {}),
    requestId: ctx.requestId,
    undoableUntil: undoableUntil(),
  });
  return handoverView(ctx, id);
}

// ---------------------------------------------------------------------------------------------
// Undo
// ---------------------------------------------------------------------------------------------

type Diff = UndoArgs['event']['diff'];
const afterOf = (diff: Diff): Record<string, unknown> =>
  Object.fromEntries(Object.entries(diff).map(([k, c]) => [k, c.after ?? null]));
const beforeOf = (diff: Diff): Record<string, unknown> =>
  Object.fromEntries(Object.entries(diff).map(([k, c]) => [k, c.before ?? null]));

/** handover.create: refused once any line closed or changed; removes the lines and the hand-over
 * and puts a split-off part back into the row it came from. */
async function undoHandoverCreate(args: UndoArgs): Promise<void> {
  const { client, event } = args;
  const a = afterOf(event.diff);
  const id = a.handover_id;
  if (typeof id !== 'string') throw notUndoable();
  const lines = (a.lines as { loan_id: string; thing_id: string }[] | null) ?? [];
  const { rows } = await client.query<{
    id: string;
    returned_at: Date | null;
    row_version: number;
  }>('SELECT id, returned_at, row_version FROM public.loans WHERE handover_id = $1 FOR UPDATE', [
    id,
  ]);
  const now = new Map(rows.map((r) => [r.id, r]));
  const changed = lines.filter((l) => {
    const r = now.get(l.loan_id);
    return !r || r.returned_at !== null || r.row_version !== 1;
  });
  if (changed.length > 0 || rows.length !== lines.length) {
    const who = await lastChangedBy(
      client,
      event.locationId,
      { type: 'loan', id: changed[0]?.loan_id ?? lines[0]?.loan_id ?? id },
      event.at,
    );
    throw undoConflict(['lines'], who);
  }
  await client.query('DELETE FROM public.handovers WHERE id = $1', [id]);
  const from = a.split_from;
  const lentId = event.entityId;
  if (typeof from === 'string' && lentId) {
    const part = await thingState(client, lentId);
    const original = await thingState(client, from);
    if (part && original && !part.deleted_at && !original.deleted_at) {
      await client.query(
        'UPDATE public.things SET quantity = quantity + $2::numeric WHERE id = $1',
        [from, part.quantity],
      );
      await client.query(
        `UPDATE public.things SET deleted_at = now(), trash_batch_id = uuidv7(), merged_into_id = $2
          WHERE id = $1`,
        [lentId, from],
      );
    }
  }
  await args.audit({
    action: 'handover.create',
    entity: { type: event.entityType, id: event.entityId },
    before: { handover_id: id, lines },
    after: null,
    subjects: [...lines.map((l) => l.thing_id), ...(typeof from === 'string' ? [from] : [])],
    ...(event.rootThingId ? { rootThingId: event.rootThingId } : {}),
  });
}

/** loan.lost: the line reopens and the thing is in use again. */
async function undoLoanLost(args: UndoArgs): Promise<void> {
  const { client, event } = args;
  const id = event.entityId;
  if (event.entityType !== 'loan' || !id) throw notUndoable();
  const row = await loanRecord(client, id, true).catch(() => {
    throw conflict("Can't undo: that loan no longer exists.");
  });
  const thing = await thingState(client, row.thing_id);
  if (!thing) throw conflict("Can't undo: what was lent is gone.");
  const current = {
    ...JSON.parse(JSON.stringify(loanImage(row))),
    thing_lifecycle: thing.lifecycle,
    thing_ended_on: thing.ended_on,
  };
  const { person_name: _p, ...diff } = event.diff;
  const conflicts = changedSince(diff, current);
  if (conflicts.length > 0) {
    const who = await lastChangedBy(client, event.locationId, { type: 'loan', id }, event.at);
    throw undoConflict(conflicts, who);
  }
  const b = { ...current, ...beforeOf(diff) };
  await client.query('UPDATE public.things SET lifecycle = $2, ended_on = $3 WHERE id = $1', [
    row.thing_id,
    b.thing_lifecycle,
    b.thing_ended_on,
  ]);
  await client.query(
    'UPDATE public.loans SET returned_at = NULL, return_notes = $2 WHERE id = $1',
    [id, b.return_notes ?? null],
  );
  await args.audit({
    action: 'loan.lost',
    entity: { type: 'loan', id },
    before: loanImage(row),
    after: loanImage(await loanRecord(client, id)),
    subjects: [row.thing_id],
    rootThingId: row.thing_id,
  });
}

/** handover.update: the due date, lead and notes go back, on the hand-over and its lines. */
async function undoHandoverUpdate(args: UndoArgs): Promise<void> {
  const { client, event } = args;
  const id = event.entityId;
  if (event.entityType !== 'handover' || !id) throw notUndoable();
  const h = await handoverRecord(client, id, true).catch(() => {
    throw conflict("Can't undo: that hand-over no longer exists.");
  });
  const { lines: _l, ...diff } = event.diff;
  const conflicts = changedSince(diff, JSON.parse(JSON.stringify(handoverImage(h))));
  if (conflicts.length > 0) {
    const who = await lastChangedBy(client, event.locationId, { type: 'handover', id }, event.at);
    throw undoConflict(conflicts, who);
  }
  const b = { ...handoverImage(h), ...beforeOf(diff) };
  await client.query(
    'UPDATE public.handovers SET due_on = $2, lead_days = $3, notes = $4 WHERE id = $1',
    [id, b.due_on, b.lead_days, b.notes],
  );
  const lines =
    (beforeOf(event.diff).lines as
      | { loan_id: string; due_on: string | null; lead_days: number }[]
      | null) ?? [];
  for (const l of lines) {
    await client.query(
      `UPDATE public.loans SET due_on = $2, lead_days = $3
        WHERE id = $1 AND returned_at IS NULL`,
      [l.loan_id, l.due_on, l.lead_days],
    );
  }
  await args.audit({
    action: 'handover.update',
    entity: { type: 'handover', id },
    before: handoverImage(h),
    after: handoverImage(await handoverRecord(client, id)),
    subjects: [],
    ...(h.root_thing_id ? { rootThingId: h.root_thing_id } : {}),
  });
}

let registered = false;

export function registerHandoverUndo(): void {
  if (registered) return;
  registered = true;
  registerUndo('handover.create', undoHandoverCreate);
  registerUndo('handover.update', undoHandoverUpdate);
  registerUndo('loan.lost', undoLoanLost);
}
