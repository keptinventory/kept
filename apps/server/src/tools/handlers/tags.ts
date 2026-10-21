import type { ToolOutput } from '@kept/mcp';
import { pageSize } from '@kept/mcp';
import { can, normalize } from '@kept/shared';
import { invalid } from '../../http/errors.js';
import { createItem, listItems } from '../../registries/service.js';
import { tagThings } from '../../things/tags.js';
import { rowsOf } from '../../things/view.js';
import { thingRefOf } from '../output.js';
import { tagsNamed, thingIn } from '../resolve.js';
import type { Handler, Op } from '../types.js';
import { paged } from './read.js';

// The tag tools (#209), MCP only: list_tags reads the location's account's tags (the registry
// list, with how many things the caller can see have each); tag_things adds tags by name, making
// the ones that don't exist yet (a member may: `tags.create`), or takes them off, through the
// bulk tag service (things/tags.ts): one undoable `thing.update` a changed thing.

const locationOf = (op: Op) => {
  if (!op.location) throw new Error('a tag tool always runs in one location');
  return op.location;
};

async function accountOf(op: Op, locationId: string): Promise<string> {
  const { rows } = await op.client.query<{ owner_account_id: string }>(
    'SELECT owner_account_id FROM public.locations WHERE id = $1',
    [locationId],
  );
  const id = rows[0]?.owner_account_id;
  if (!id) throw new Error(`no account for location ${locationId}`);
  return id;
}

/** The account's tags by normalised name. */
async function tagsByName(
  op: Op,
  accountId: string,
  names: readonly string[],
): Promise<Map<string, { id: string; name: string; colour: string | null }>> {
  if (names.length === 0) return new Map();
  const { rows } = await op.client.query<{ id: string; name: string; colour: string | null }>(
    `SELECT id, name, colour FROM public.tags
      WHERE owner_account_id = $1 AND kept.normalize(name) = ANY (
        SELECT kept.normalize(n) FROM unnest($2::text[]) AS n)`,
    [accountId, [...names]],
  );
  return new Map(rows.map((r) => [normalize(r.name), r]));
}

/**
 * The location's account's tags by name, making the ones no tag has yet where the role may
 * (`tags.create`: members and up). Names it may not make come back in `missing`.
 */
export async function ensureTags(
  op: Op,
  locationId: string,
  names: readonly string[],
): Promise<{
  ids: string[];
  missing: string[];
  created: { id: string; name: string; colour: string | null }[];
}> {
  const found = await tagsNamed(op.client, locationId, names);
  const loc = op.locations.find((l) => l.id === locationId) ?? op.location;
  if (found.missing.length === 0 || !loc || !can(loc.role, 'tags.create')) {
    return { ...found, created: [] };
  }
  const accountId = await accountOf(op, locationId);
  const ids = [...found.ids];
  const created: { id: string; name: string; colour: string | null }[] = [];
  for (const name of [...new Map(found.missing.map((n) => [normalize(n), n])).values()]) {
    const made = await createItem(writeOf(op), 'tags', accountId, { name });
    const item = made.item as { id: string; name: string; colour: string | null };
    if (!ids.includes(item.id)) ids.push(item.id);
    created.push({ id: item.id, name: item.name, colour: item.colour });
  }
  return { ids, missing: [], created };
}

const writeOf = (op: Op) => ({
  tx: op.tx,
  client: op.client,
  userId: op.scope.userId,
  tokenId: op.scope.tokenId ?? null,
  requestId: op.requestId,
  jobs: op.jobs,
});

export const listTags: Handler<'list_tags'> = {
  action: 'content.view',
  run: async (op, input) => {
    const loc = locationOf(op);
    const accountId = await accountOf(op, loc.id);
    const page = await paged(input.cursor, async (c) => {
      const res = await listItems(op.client, 'tags', accountId, {
        q: input.query || undefined,
        limit: pageSize(input.limit),
        cursor: c,
      });
      return { items: res.items, next: res.next_cursor };
    });
    return {
      ...page,
      data: {
        items: page.items.map((g) => {
          const tag = g as { id: string; name: string; colour: string | null; thingCount?: number };
          return {
            id: tag.id,
            colour: tag.colour,
            things: tag.thingCount ?? 0,
            untrusted: { name: tag.name },
          };
        }),
      },
    };
  },
};

export const tagThingsTool: Handler<'tag_things'> = {
  action: 'things.edit',
  run: async (op, input): Promise<{ data: ToolOutput<'tag_things'> }> => {
    const loc = locationOf(op);
    const accountId = await accountOf(op, loc.id);
    const thingIds: string[] = [];
    for (const ref of input.thing_ids) {
      const id = await thingIn(op.client, loc.id, ref);
      if (!thingIds.includes(id)) thingIds.push(id);
    }
    const addNames = [...new Map((input.add ?? []).map((n) => [normalize(n), n])).values()];
    const removeNames = [...new Map((input.remove ?? []).map((n) => [normalize(n), n])).values()];
    const known = await tagsByName(op, accountId, removeNames);

    const ensured = await ensureTags(op, loc.id, addNames);
    if (ensured.missing.length) throw invalid(`There is no tag called ${ensured.missing[0]}.`);
    const add = ensured.ids;
    const created: ToolOutput<'tag_things'>['created_tags'] = ensured.created.map((g) => ({
      id: g.id,
      colour: g.colour,
      untrusted: { name: g.name },
    }));
    const remove: string[] = [];
    const notFound: ToolOutput<'tag_things'>['not_found'] = [];
    for (const name of removeNames) {
      const found = known.get(normalize(name));
      if (found && !add.includes(found.id)) remove.push(found.id);
      else if (!found) notFound.push({ untrusted: { value: name } });
    }

    const result =
      add.length + remove.length > 0
        ? await tagThings(op, { thingIds, add, remove })
        : { changed: [], events: [] };
    if (result.changed.length === 0 && created.length === 0) {
      throw invalid('Nothing to change: the things already have those tags, or none of them.');
    }
    const first = result.events[0];
    const until = first
      ? (
          await op.client.query<{ undoable_until: Date | null }>(
            'SELECT undoable_until FROM public.audit_events WHERE id = $1',
            [first],
          )
        ).rows[0]?.undoable_until
      : null;
    const audit =
      first ??
      (
        await op.client.query<{ id: string }>(
          `SELECT id FROM public.audit_events WHERE request_id = $1 ORDER BY id DESC LIMIT 1`,
          [op.requestId],
        )
      ).rows[0]?.id;
    if (!audit) throw new Error('tag_things wrote no audit event');
    const rows = await rowsOf(op.client, null, result.changed);
    return {
      data: {
        audit_event_id: audit,
        undo_until: until?.toISOString() ?? null,
        audit_event_ids: result.events,
        changed: rows.map((r) => thingRefOf(r, loc.name)),
        created_tags: created,
        not_found: notFound,
      },
    };
  },
};
