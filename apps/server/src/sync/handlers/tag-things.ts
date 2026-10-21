import { AppError } from '../../http/errors.js';
import { createItem } from '../../registries/service.js';
import { tagThings } from '../../things/tags.js';
import { type Dropped, goneDrop, type Handler, type Notice, presenceOf } from './common.js';

// `tag_things` → the bulk tag service (things/tags.ts), as `POST /things/tags` runs it online:
// one `thing.update` a changed thing, the latest change winning (D35). Tags made offline
// (`create`) are made first in the location's account with the phone's ids; a tag that has the
// name already (normalised) is used instead. A thing trashed meanwhile is left out, the answer's
// `notice` naming it; when none is left the op is dropped as trashed.

export const tagThingsOp: Handler<'tag_things'> = async (ctx, { locationId, payload }) => {
  const { client, scope } = ctx;
  const live: string[] = [];
  let first: Dropped | null = null;
  for (const id of new Set(payload.thingIds.map((x) => x.toLowerCase()))) {
    const p = await presenceOf(client, 'thing', id);
    if (p.state === 'live') live.push(id);
    else first ??= goneDrop('thing', id, p);
  }
  if (live.length === 0) return first ?? { outcome: 'dropped', reason: 'target_missing' };

  const ids = new Map<string, string>();
  if (payload.create.length > 0) {
    const { rows } = await client.query<{ owner_account_id: string }>(
      'SELECT owner_account_id FROM public.locations WHERE id = $1',
      [locationId],
    );
    const accountId = rows[0]?.owner_account_id;
    if (!accountId) return { outcome: 'dropped', reason: 'target_missing' };
    const write = {
      tx: ctx.tx,
      client,
      userId: scope.userId,
      tokenId: scope.tokenId ?? null,
      requestId: ctx.requestId,
      jobs: ctx.jobs,
    };
    for (const c of payload.create) {
      const id = c.id.toLowerCase();
      const { rowCount } = await client.query('SELECT 1 FROM public.tags WHERE id = $1', [id]);
      if (rowCount) continue;
      try {
        await createItem(write, 'tags', accountId, {
          id,
          name: c.name,
          ...(c.colour ? { colour: c.colour } : {}),
        });
      } catch (err) {
        const existing = err instanceof AppError ? err.extra?.existingId : undefined;
        if (typeof existing !== 'string') throw err;
        ids.set(id, existing);
      }
    }
  }
  const add = payload.add.map((x) => ids.get(x.toLowerCase()) ?? x.toLowerCase());
  await tagThings(ctx, { thingIds: live, add, remove: payload.remove });
  const notice: Notice | undefined = first?.notice;
  return { outcome: 'applied', ...(notice ? { notice } : {}) };
};
