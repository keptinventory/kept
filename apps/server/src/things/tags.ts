import { can, TAG_LIMITS } from '@kept/shared';
import { z } from 'zod';
import { undoableMark, undoableSince } from '../audit/audited.js';
import { AppError, forbidden, invalid, notFound } from '../http/errors.js';
import { callerMembership } from '../locations/access.js';
import { type BatchUpdate, type Ctx, liveThings, writeThingUpdates } from './service.js';

// POST /api/v1/things/tags {thingIds (≤ 200), add?, remove?} → {changed, events}
//
// Adds tags to many things, or takes them off, in one request: a search's results, a place's
// contents, a tag's page. Each thing whose tags change gets the `thing.update` an edit would write
// (its tag_ids before and after), so `events` undo together through POST /api/v1/audit/undo, and
// a thing that already had them (or had none of the removed ones) is left alone.
//
// All or nothing: a thing the caller can't see, or a tag that isn't of the things' account, is a
// 404; a location where their role can't edit things a 403; things of two accounts, or a thing
// that would have more than 50 tags, a 400.

const Ids = (max: number) => z.array(z.uuid()).max(max);

export const TagThingsBody = z
  .strictObject({
    thingIds: Ids(TAG_LIMITS.bulkThings).min(1),
    add: Ids(TAG_LIMITS.perThing).optional(),
    remove: Ids(TAG_LIMITS.perThing).optional(),
  })
  .refine((b) => (b.add?.length ?? 0) + (b.remove?.length ?? 0) > 0, {
    message: 'Name tags to add or remove.',
  });
export type TagThingsBody = z.infer<typeof TagThingsBody>;

export const TagThingsResult = z.object({
  /** The things whose tags changed. */
  changed: z.array(z.uuid()),
  /** Their undoable events, for POST /api/v1/audit/undo. */
  events: z.array(z.uuid()),
});
export type TagThingsResult = z.infer<typeof TagThingsResult>;

const lower = (ids: readonly string[] | undefined) => [
  ...new Set((ids ?? []).map((x) => x.toLowerCase())),
];

export async function tagThings(ctx: Ctx, body: TagThingsBody): Promise<TagThingsResult> {
  const { client, tx } = ctx;
  const ids = lower(body.thingIds);
  const add = lower(body.add);
  const remove = lower(body.remove).filter((x) => !add.includes(x));

  const seen = await liveThings(client, ids);
  if (seen.size !== ids.length) throw notFound();
  const locations = [...new Set([...seen.values()].map((t) => t.location_id))];
  for (const locationId of locations) {
    const me = await callerMembership(client, locationId);
    if (!me) throw notFound();
    if (!can(me.role, 'things.edit')) throw forbidden();
  }
  const { rows: accounts } = await client.query<{ owner_account_id: string }>(
    'SELECT DISTINCT owner_account_id FROM public.locations WHERE id = ANY ($1::uuid[])',
    [locations],
  );
  if (accounts.length !== 1) throw invalid('Pick things from one account: tags belong to one.');
  const accountId = accounts[0]?.owner_account_id as string;
  const named = [...add, ...remove];
  const { rows: tags } = await client.query<{ id: string }>(
    'SELECT id FROM public.tags WHERE id = ANY ($1::uuid[]) AND owner_account_id = $2',
    [named, accountId],
  );
  if (tags.length !== named.length) throw notFound();

  const locked = await liveThings(client, ids, { lock: true });
  if (locked.size !== ids.length) throw notFound();
  const { rows: current } = await client.query<{ thing_id: string; tag_ids: string[] }>(
    `SELECT thing_id, array_agg(tag_id::text ORDER BY tag_id) AS tag_ids
       FROM public.thing_tags WHERE thing_id = ANY ($1::uuid[]) GROUP BY thing_id`,
    [ids],
  );
  const had = new Map(current.map((r) => [r.thing_id, r.tag_ids]));
  const updates: BatchUpdate[] = [];
  for (const id of ids) {
    const before = had.get(id) ?? [];
    const next = [...new Set([...before, ...add])].filter((x) => !remove.includes(x));
    const same = next.length === before.length && next.every((x) => before.includes(x));
    if (same) continue;
    if (next.length > TAG_LIMITS.perThing) {
      throw new AppError('validation', 400, `A thing has at most ${TAG_LIMITS.perThing} tags.`, {
        thingId: id,
      });
    }
    const thing = locked.get(id);
    if (thing) updates.push({ thing, body: { tagIds: next } });
  }
  const mark = undoableMark(tx);
  await writeThingUpdates(ctx, updates);
  return { changed: updates.map((u) => u.thing.id), events: undoableSince(tx, mark) };
}
