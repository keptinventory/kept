import { type Condition, newId } from '@kept/shared';
import type pg from 'pg';
import { audited } from '../audit/audited.js';
import { undoableUntil } from '../audit/undo.js';
import { conflict, invalid, pgErrorOf } from '../http/errors.js';
import { todayIn } from '../schedules/service.js';
import { splitThing, targetOf } from '../things/service.js';
import type { ThingRow } from '../things/view.js';
import { actor, type Ctx, loanRecord, requireLoanVersion, writableLoan } from './service.js';
import { anyRowsOf, type Loan, loanImage, loanView } from './view.js';

// Returning a loan (D45, D56, D172).
//
// - Out: the thing comes back to where it left (its container if that is still there, else its
//   place, else the location's Unplaced area) or to where it is put, seen now. A part that was
//   split off to be lent merges back into the row it came from when that row is live, in the
//   same place and of the same type (D172, "by default"), unless `mergeBack` is false: its
//   quantity joins that row, and the part goes to the trash (its loan, returned, stays in the
//   history of both). Otherwise it stays a row of its own.
// - In: the borrowed thing goes back to its owner: lifecycle `returned_to_owner`, ended today in
//   the location's zone, so it leaves counts and totals (D56) and stays in history.
// The event (`loan.return`, undoable) holds the thing's place, lifecycle and the merge, so undo
// reopens the loan, puts the thing back and un-merges it.
//
// 1.14 (#170): a line of a hand-over. The return writes its own note (`return_notes`; the lend
// note stays), the condition it came back in and, chosen, the thing's condition with it. Part of
// a quantity back (`quantityBack`): the rest is split off first and stays out on its own open
// line of the same hand-over; undo puts it back together. `loseLoan` closes a line as lost.

export type ReturnInput = {
  returnedAt?: string | undefined;
  to?: 'previous' | { placeId: string } | { containerId: string } | undefined;
  mergeBack?: boolean | undefined;
  /** The return note (1.14: `return_notes`; the lend note is kept). */
  notes?: string | undefined;
  conditionIn?: Condition | undefined;
  /** Also set the thing's condition to `conditionIn`. */
  updateCondition?: boolean | undefined;
  /** Part of a quantity came back: the rest stays out on its own line. */
  quantityBack?: string | undefined;
};

type ThingState = {
  id: string;
  location_id: string;
  place_id: string | null;
  container_id: string | null;
  type_id: string | null;
  quantity: string;
  lifecycle: string;
  ended_on: string | null;
  deleted_at: Date | null;
  trash_batch_id: string | null;
  condition: Condition | null;
};

export async function thingState(client: pg.ClientBase, id: string): Promise<ThingState | null> {
  const { rows } = await client.query<ThingState>(
    `SELECT id, location_id, place_id, container_id, type_id, trim_scale(quantity)::text AS quantity,
            lifecycle, ended_on::text AS ended_on, deleted_at, trash_batch_id, condition
       FROM public.things WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/** Where "previous" is now: the container it left, else the place, else Unplaced. */
async function previousOf(
  client: pg.ClientBase,
  locationId: string,
  loan: { previous_place_id: string | null; previous_container_id: string | null },
  thingId: string,
): Promise<{ placeId: string | null; containerId: string | null }> {
  if (loan.previous_container_id && loan.previous_container_id !== thingId) {
    const { rowCount } = await client.query(
      `SELECT 1 FROM public.things WHERE id = $1 AND location_id = $2 AND deleted_at IS NULL`,
      [loan.previous_container_id, locationId],
    );
    if (rowCount) return { placeId: null, containerId: loan.previous_container_id };
  }
  if (loan.previous_place_id) {
    const { rowCount } = await client.query(
      `SELECT 1 FROM public.places WHERE id = $1 AND location_id = $2 AND deleted_at IS NULL`,
      [loan.previous_place_id, locationId],
    );
    if (rowCount) return { placeId: loan.previous_place_id, containerId: null };
  }
  const { rows } = await client.query<{ id: string }>(
    'SELECT id FROM public.places WHERE location_id = $1 AND is_unplaced',
    [locationId],
  );
  return { placeId: rows[0]?.id ?? null, containerId: null };
}

/**
 * Puts `thingId` in a place or container, seen now, and refreshes the caches of what is inside it
 * (things/move.ts's same-location move: search_tsv NULL makes kept.thing_cache() recompute the
 * place path and the search document; row_version stays).
 */
export async function placeThing(
  client: pg.ClientBase,
  thingId: string,
  where: { placeId: string | null; containerId: string | null },
): Promise<void> {
  try {
    await client.query(
      `UPDATE public.things
          SET place_id = $2, container_id = $3, last_seen_at = now(), location_uncertain = false
        WHERE id = $1`,
      [thingId, where.placeId, where.containerId],
    );
  } catch (err) {
    const pg = pgErrorOf(err);
    if (pg?.code === '23514' && pg.constraint === 'things_no_loop') {
      throw conflict("It can't go inside itself or something inside it.");
    }
    throw err;
  }
  await client.query(
    `WITH RECURSIVE inside(id) AS (
       SELECT t.id FROM public.things t WHERE t.container_id = $1
       UNION
       SELECT t.id FROM public.things t JOIN inside i ON t.container_id = i.id)
     UPDATE public.things SET search_tsv = NULL WHERE id IN (SELECT id FROM inside)`,
    [thingId],
  );
}

/** The thing's part of the audit image: where it is, its end, and a merge. */
const thingImage = (t: ThingState) => ({
  thing_place_id: t.place_id,
  thing_container_id: t.container_id,
  thing_lifecycle: t.lifecycle,
  thing_ended_on: t.ended_on,
  thing_deleted_at: t.deleted_at,
  thing_condition: t.condition,
  thing_quantity: t.quantity,
});

/** POST /api/v1/loans/:id/return (If-Match) → {loan, thing, mergedInto?}. */
export async function returnLoan(
  ctx: Ctx,
  id: string,
  expected: number,
  body: ReturnInput,
): Promise<{ loan: Loan; thing: ThingRow; mergedInto?: ThingRow }> {
  const { client } = ctx;
  const loan = await writableLoan(ctx, id, { closing: true });
  await requireLoanVersion(client, loan, expected, ['returnedAt']);
  if (loan.returned_at) throw conflict('It was already returned.');
  const returnedAt = body.returnedAt ? new Date(body.returnedAt) : new Date();
  if (returnedAt.getTime() < loan.started_at.getTime()) {
    throw invalid('Check body.returnedAt: not before the loan started.');
  }
  if (returnedAt.getTime() > Date.now() + 60_000) {
    throw invalid('Check body.returnedAt: not in the future.');
  }
  await client.query('SELECT 1 FROM public.things WHERE id = $1 FOR UPDATE', [loan.thing_id]);
  let before = (await thingState(client, loan.thing_id)) as ThingState;
  // Part of a quantity back: the rest is split off and stays out on a line of its own.
  let rest: { thing_id: string; loan_id: string; quantity: string } | null = null;
  const imageBefore = thingImage(before);
  if (body.quantityBack !== undefined && loan.direction === 'out') {
    const back = Number(body.quantityBack);
    const total = Number(before.quantity);
    if (!(back > 0) || back > total)
      throw invalid(`Check body.quantityBack: more than 0 and at most the ${before.quantity} out.`);
    if (back < total) {
      const left = String(Number((total - back).toFixed(3)));
      const part = await splitThing(ctx, loan.thing_id, { quantity: Number(left) }, null);
      const restLoan = newId();
      await client.query(
        `INSERT INTO public.loans (id, location_id, thing_id, direction, person_id, started_at,
                                   due_on, previous_place_id, previous_container_id, lead_days,
                                   notes, created_by, handover_id, path_at_lend, condition_out)
         SELECT $2, location_id, $3, direction, person_id, started_at, due_on, previous_place_id,
                previous_container_id, lead_days, notes, kept.current_user_id(), handover_id,
                path_at_lend, condition_out
           FROM public.loans WHERE id = $1`,
        [id, restLoan, part.newId],
      );
      rest = { thing_id: part.newId, loan_id: restLoan, quantity: left };
      before = (await thingState(client, loan.thing_id)) as ThingState;
    }
  }
  let returnPlaceId: string | null = null;
  let returnContainerId: string | null = null;
  let merged: { into: ThingState; batch: string } | null = null;

  if (loan.direction === 'out') {
    const to = body.to ?? 'previous';
    const where =
      to === 'previous'
        ? await previousOf(client, loan.location_id, loan, loan.thing_id)
        : await targetOf(client, loan.location_id, to);
    if (where.containerId === loan.thing_id) {
      throw invalid("Check body.to: it can't go inside itself.");
    }
    await placeThing(client, loan.thing_id, where);
    returnPlaceId = where.containerId ? null : where.placeId;
    returnContainerId = where.containerId;
    // D172: the part merges back into the row it came from.
    if (body.mergeBack !== false && loan.split_from_thing_id) {
      const original = await thingState(client, loan.split_from_thing_id);
      const { rowCount: holds } = await client.query(
        'SELECT 1 FROM public.things WHERE container_id = $1 AND deleted_at IS NULL',
        [loan.thing_id],
      );
      if (
        original &&
        original.deleted_at === null &&
        original.lifecycle === 'in_use' &&
        original.place_id === where.placeId &&
        original.container_id === where.containerId &&
        original.type_id === before.type_id &&
        !holds
      ) {
        await client.query('SELECT 1 FROM public.things WHERE id = $1 FOR UPDATE', [original.id]);
        await client.query(
          'UPDATE public.things SET quantity = quantity + $2::numeric WHERE id = $1',
          [original.id, before.quantity],
        );
        const batch = newId();
        // merged_into_id (0056): the part can't be restored from the trash on its own (only
        // this return's undo un-merges it), and its purge keeps its loans on the row it joined.
        await client.query(
          `UPDATE public.things SET deleted_at = now(), trash_batch_id = $2, merged_into_id = $3
            WHERE id = $1`,
          [loan.thing_id, batch, original.id],
        );
        merged = { into: original, batch };
      }
    }
  } else {
    // A borrowed thing goes back to its owner and leaves counts and totals (D56).
    const today = await todayIn(client, loan.location_id);
    await client.query(
      `UPDATE public.things SET lifecycle = 'returned_to_owner', ended_on = $2
        WHERE id = $1 AND lifecycle = 'in_use'`,
      [loan.thing_id, today],
    );
  }

  if (body.updateCondition && body.conditionIn) {
    await client.query('UPDATE public.things SET condition = $2 WHERE id = $1', [
      loan.thing_id,
      body.conditionIn,
    ]);
  }
  await client.query(
    `UPDATE public.loans
        SET returned_at = $2, return_place_id = $3, return_container_id = $6,
            return_notes = CASE WHEN $4 THEN $5 ELSE return_notes END, outcome = 'returned',
            condition_in = coalesce($7, condition_in)
      WHERE id = $1`,
    [
      id,
      returnedAt,
      returnPlaceId,
      body.notes !== undefined,
      body.notes ?? null,
      returnContainerId,
      body.conditionIn ?? null,
    ],
  );
  const after = await loanRecord(client, id);
  const thingAfter = (await thingState(client, loan.thing_id)) as ThingState;
  const { rows: who } = await client.query<{ display_name: string | null }>(
    'SELECT display_name FROM public.people WHERE id = $1',
    [loan.person_id],
  );
  await audited(ctx.tx, {
    locationId: loan.location_id,
    actor: actor(ctx.scope),
    action: 'loan.return',
    entity: { type: 'loan', id },
    before: {
      ...loanImage(loan),
      ...imageBefore,
      ...(rest ? { split_rest: null } : {}),
      ...(merged ? { merged_into: null, merged_into_quantity: merged.into.quantity } : {}),
    },
    after: {
      ...loanImage(after),
      ...thingImage(thingAfter),
      ...(rest ? { split_rest: rest } : {}),
      person_name: who[0]?.display_name ?? '',
      ...(merged
        ? {
            merged_into: merged.into.id,
            merged_into_quantity: (await thingState(client, merged.into.id))?.quantity ?? null,
            merged_batch: merged.batch,
          }
        : {}),
    },
    subjects: [
      loan.thing_id,
      ...(merged ? [merged.into.id] : []),
      ...(rest ? [rest.thing_id] : []),
    ],
    rootThingId: merged ? merged.into.id : loan.thing_id,
    requestId: ctx.requestId,
    undoableUntil: undoableUntil(),
  });
  const rows = await anyRowsOf(
    client,
    ctx.files,
    merged ? [loan.thing_id, merged.into.id] : [loan.thing_id],
  );
  return {
    loan: await loanView(client, ctx.files, id),
    thing: rows.get(loan.thing_id) as ThingRow,
    ...(merged ? { mergedInto: rows.get(merged.into.id) as ThingRow } : {}),
  };
}
