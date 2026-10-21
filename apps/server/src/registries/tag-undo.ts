import {
  type AccountUndoArgs,
  changedSince,
  notUndoable,
  registerAccountUndo,
  undoConflict,
} from '../audit/undo.js';
import { conflict } from '../http/errors.js';
import { lastChangedBy, reindexUses } from './account.js';

// Undo of a tag's rename or recolour (`tag.update`), merge (`tag.merge`) and delete
// (`tag.delete`): account-level events, undone by the account's owners and admins within 7 days
// (audit/undo.ts registerAccountUndo; the route checks who, the window and "not undone yet").
//
// - update: each field goes back if it still holds what the event wrote, else 409
//   `changed_since` naming who changed it; a name another tag has taken since is refused too.
// - merge: the merged tag comes back with its id, name and colour, onto the things that had it
//   (as recorded by the merge), and the tag it went into leaves the things that only got it from
//   the merge. Things the undoer can't see, or that are gone, are left as they are.
// - delete: the tag comes back with its id, name and colour (it was on nothing: a delete of a tag
//   in use is refused).
// Either recreate is refused while another tag has the name (normalised).

type Image = { name: string; colour: string | null };

const was = (args: AccountUndoArgs, field: string): unknown => args.event.diff[field]?.before;
const now = (args: AccountUndoArgs, field: string): unknown => args.event.diff[field]?.after;

async function refuseTakenName(args: AccountUndoArgs, name: string, except: string | null) {
  const { rows } = await args.client.query<{ id: string }>(
    `SELECT id FROM public.tags
      WHERE owner_account_id = $1 AND kept.normalize(name) = kept.normalize($2)
        AND ($3::uuid IS NULL OR id <> $3) LIMIT 1`,
    [args.event.ownerAccountId, name, except],
  );
  if (rows[0]) throw undoConflict(['name']);
}

/** The tag as it was before the event, from a merge's or delete's `before`. */
function imageBefore(args: AccountUndoArgs): Image {
  const name = was(args, 'name');
  if (typeof name !== 'string' || name === '') throw notUndoable();
  const colour = was(args, 'colour');
  return { name, colour: typeof colour === 'string' ? colour : null };
}

async function recreate(args: AccountUndoArgs, id: string, image: Image): Promise<void> {
  const { rowCount } = await args.client.query('SELECT 1 FROM public.tags WHERE id = $1', [id]);
  if (rowCount) throw conflict("Can't undo: that tag is back already.");
  await refuseTakenName(args, image.name, null);
  await args.client.query(
    'INSERT INTO public.tags (id, owner_account_id, name, colour) VALUES ($1, $2, $3, $4)',
    [id, args.event.ownerAccountId, image.name, image.colour],
  );
}

/** Things whose tags changed are touched, so their row version moves and phones resync them. */
async function touch(args: AccountUndoArgs, thingIds: readonly string[]): Promise<void> {
  if (thingIds.length === 0) return;
  await args.client.query(`SELECT set_config('kept.touch', 'force', true)`);
  await args.client.query(
    'UPDATE public.things SET updated_at = now() WHERE id = ANY ($1::uuid[])',
    [thingIds],
  );
  await args.client.query(`SELECT set_config('kept.touch', '', true)`);
}

async function undoTagUpdate(args: AccountUndoArgs): Promise<void> {
  const { event, client } = args;
  const id = event.entityId;
  if (event.entityType !== 'tag' || !id) throw notUndoable();
  const fields = Object.keys(event.diff);
  if (fields.length === 0 || fields.some((f) => f !== 'name' && f !== 'colour')) {
    throw notUndoable();
  }
  const { rows } = await client.query<Image>(
    'SELECT name, colour FROM public.tags WHERE id = $1 FOR UPDATE',
    [id],
  );
  const current = rows[0];
  if (!current) throw conflict("Can't undo: that tag no longer exists.");
  const conflicts = changedSince(event.diff, current);
  if (conflicts.length > 0) {
    throw undoConflict(conflicts, (await lastChangedBy(client, 'tag', id))?.displayName);
  }
  const name = typeof was(args, 'name') === 'string' ? (was(args, 'name') as string) : undefined;
  if (name !== undefined) await refuseTakenName(args, name, id);
  await client.query(
    `UPDATE public.tags SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(', ')} WHERE id = $1`,
    [id, ...fields.map((f) => was(args, f) ?? null)],
  );
  const { rows: after } = await client.query<Image>(
    'SELECT name, colour FROM public.tags WHERE id = $1',
    [id],
  );
  await args.audit({
    action: 'tag.update',
    entity: { type: 'tag', id },
    before: current,
    after: after[0] ?? null,
  });
  if (name !== undefined) await reindexUses(args.deps.jobs, client, 'tag', id);
}

async function undoTagMerge(args: AccountUndoArgs): Promise<void> {
  const { event, client } = args;
  const id = event.entityId;
  if (event.entityType !== 'tag' || !id) throw notUndoable();
  const into = now(args, 'merged_into');
  const thingIds = now(args, 'thing_ids');
  const already = now(args, 'already_tagged');
  if (typeof into !== 'string' || !Array.isArray(thingIds) || !Array.isArray(already)) {
    throw notUndoable();
  }
  const image = imageBefore(args);
  await recreate(args, id, image);
  // Back on the things that had it, where the undoer can see them (thing_tags' policies).
  const { rows: back } = await client.query<{ thing_id: string }>(
    `INSERT INTO public.thing_tags (location_id, thing_id, tag_id)
     SELECT t.location_id, t.id, $2 FROM public.things t WHERE t.id = ANY ($1::uuid[])
     ON CONFLICT (thing_id, tag_id) DO NOTHING
     RETURNING thing_id`,
    [thingIds, id],
  );
  const restored = back.map((r) => r.thing_id);
  // The target leaves the things that got it only from the merge.
  const keep = new Set(already as string[]);
  const added = restored.filter((x) => !keep.has(x));
  if (added.length > 0) {
    await client.query(
      'DELETE FROM public.thing_tags WHERE tag_id = $1 AND thing_id = ANY ($2::uuid[])',
      [into, added],
    );
  }
  await touch(args, restored);
  await args.audit({
    action: 'tag.merge',
    entity: { type: 'tag', id },
    before: { merged_into: into },
    after: { ...image, thing_ids: restored },
  });
  await reindexUses(args.deps.jobs, client, 'tag', id);
}

async function undoTagDelete(args: AccountUndoArgs): Promise<void> {
  const { event } = args;
  const id = event.entityId;
  if (event.entityType !== 'tag' || !id) throw notUndoable();
  const image = imageBefore(args);
  await recreate(args, id, image);
  await args.audit({
    action: 'tag.delete',
    entity: { type: 'tag', id },
    before: null,
    after: image,
  });
}

let registered = false;

/** Registers the tag undo handlers (idempotent; registries/routes.ts). */
export function registerTagUndo(): void {
  if (registered) return;
  registered = true;
  registerAccountUndo('tag.update', undoTagUpdate);
  registerAccountUndo('tag.merge', undoTagMerge);
  registerAccountUndo('tag.delete', undoTagDelete);
}
