import type pg from 'pg';
import { AppError } from '../http/errors.js';

// "Locked" is a status, not a wall (1.14, #170): a thing that is with someone (an open hand-over
// line, or inside something that is) is moved, trashed or packed into only once the person says
// so. An online request without `onLoan: "confirm"` is 409 `on_loan`, naming who has it, and the
// app asks "This is with Sam — mark it returned first?". Offline ops and scan sessions are not
// asked: the phone shows the status, and the history records what happened.

/**
 * 409 `on_loan` when any of `thingIds`, anything inside them, or the box they go into (or a box
 * it is in) is with someone, unless confirmed.
 */
export async function guardOnLoan(
  client: pg.ClientBase,
  thingIds: readonly string[],
  into: string | null,
  confirmed: boolean,
): Promise<void> {
  if (confirmed || (thingIds.length === 0 && !into)) return;
  const { rows } = await client.query<{ thing_id: string; name: string | null; person: string }>(
    `WITH RECURSIVE down(id, depth) AS (
       SELECT x, 0 FROM unnest($1::uuid[]) x
       UNION ALL
       SELECT t.id, d.depth + 1 FROM public.things t JOIN down d ON t.container_id = d.id
        WHERE t.deleted_at IS NULL AND d.depth < 20),
     up(id, container_id, depth) AS (
       SELECT t.id, t.container_id, 0 FROM public.things t WHERE t.id = $2::uuid
       UNION ALL
       SELECT t.id, t.container_id, u.depth + 1 FROM public.things t JOIN up u ON t.id = u.container_id
        WHERE u.depth < 20)
     SELECT o.thing_id, t.name, coalesce(pe.display_name, '') AS person
       FROM public.loans o
       JOIN public.things t ON t.id = o.thing_id
       LEFT JOIN public.people pe ON pe.id = o.person_id
      WHERE o.returned_at IS NULL AND o.direction = 'out'
        AND (o.thing_id IN (SELECT id FROM down) OR o.thing_id IN (SELECT id FROM up))
      ORDER BY t.name NULLS LAST, o.thing_id LIMIT 1`,
    [[...thingIds], into],
  );
  const hit = rows[0];
  if (!hit) return;
  throw new AppError(
    'on_loan',
    409,
    `It is with ${hit.person}: mark it returned first, or confirm.`,
    {
      with: { person: hit.person, thingId: hit.thing_id, name: hit.name },
    },
  );
}
