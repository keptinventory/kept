import {
  decodeOffsetCursor,
  encodeOffsetCursor,
  pageSize,
  type ThingRef,
  type ToolOutput,
} from '@kept/mcp';
import { isMissing } from '@kept/shared';
import type pg from 'pg';
import { undoableEventIds } from '../../audit/audited.js';
import { decodeCursor } from '../../http/conventions.js';
import { invalid, notFound } from '../../http/errors.js';
import {
  addBox,
  createMove,
  listMoves,
  type MoveBoxView,
  type MoveRowView,
  moveView,
  packIntoBox,
  unpackBox,
  updateBox,
} from '../../moving/service.js';
import { viewOf } from '../../things/view.js';
import { thingRefOf } from '../output.js';
import { findRef, placeIn, thingIn } from '../resolve.js';
import type { Handler, Op } from '../types.js';
import { paged } from './read.js';
import { writeResult } from './write.js';

// Moving mode's tools (1.x, D251; MCP only, `doors` in TOOL_DEFS). Each calls the function its
// route calls (moving/service.ts), so a change over MCP meets the web's rules: the Moving mode
// module of the move's location (runTool's gate), `things.edit` to change anything (viewers and
// read tokens only read), the move's own checks (an open move, a room where it is going, a box of
// this move), the same audit rows and the same 7-day Undo for a box's state and an unpack.
// Packing is the ordinary move into the box's container (D45), as the web packs.

type MoveOut = ToolOutput<'get_move'>['move'];
type BoxOut = ToolOutput<'get_move'>['items'][number];

const locationOf = (op: Op) => {
  if (!op.location) throw new Error('a moving tool always runs in one location');
  return op.location;
};

/** The location of the move `id` names, as the caller sees it (runTool's subject). */
async function locationOfMove(client: pg.ClientBase, id: string): Promise<string | null> {
  const { rows } = await client.query<{ location_id: string }>(
    'SELECT location_id FROM public.moves WHERE id = $1',
    [id.toLowerCase()],
  );
  return rows[0]?.location_id ?? null;
}

/** 404 unless the move is the call's location's (a location_id naming another one). */
async function requireMoveHere(op: Op, moveId: string): Promise<void> {
  if ((await locationOfMove(op.client, moveId)) !== locationOf(op).id) throw notFound();
}

const moveOf = (op: Op, m: MoveRowView): MoveOut => ({
  id: m.id,
  location_id: m.locationId,
  to_location_id: m.toLocationId,
  status: m.status,
  created_at: m.createdAt,
  finished_at: m.finishedAt,
  counts: m.counts,
  url: op.link(`/moving/${m.id}`),
  untrusted: { name: m.name, to_location: m.toLocationName },
});

const boxOf = (op: Op, b: MoveBoxView): BoxOut => ({
  box_id: b.containerId,
  short_code: b.shortCode,
  number: b.number,
  state: b.state,
  state_at: b.stateAt,
  visible: b.visible,
  location_id: b.locationId,
  contents: b.contents,
  destination: b.destination
    ? {
        place_id: b.destination.placeId,
        location_id: b.destination.locationId,
        untrusted: { name: b.destination.name },
      }
    : null,
  url: op.link(`/moving/${b.moveId}/boxes/${b.containerId}`),
  untrusted: { name: b.name, where: b.where },
});

/** A box (a container) wherever the caller sees it: once unpacked it may be in the destination. */
async function boxIn(op: Op, raw: string): Promise<string> {
  const found = await findRef(op.client, raw);
  if (found?.kind !== 'thing') throw notFound();
  return found.id;
}

/** A room for a box, in any location the caller sees (the move's own checks say where). */
async function roomOf(op: Op, raw: string): Promise<string> {
  const found = await findRef(op.client, raw);
  if (found?.kind !== 'place') throw notFound();
  return found.id;
}

async function thingRef(op: Op, id: string): Promise<ThingRef> {
  const v = await viewOf(op.tx, op.client, op.scope, null, id);
  return thingRefOf(v, locationOf(op).name);
}

/** A write's result; when it changed nothing (the box was already so), the box's latest event. */
async function boxResult(op: Op, containerId: string, changed: boolean) {
  if (changed) return writeResult(op, 'thing', containerId);
  const { rows } = await op.client.query<{ id: string; undoable_until: Date | null }>(
    `SELECT id, undoable_until FROM public.audit_events
      WHERE entity_type = 'thing' AND entity_id = $1 ORDER BY id DESC LIMIT 1`,
    [containerId],
  );
  const r = rows[0];
  if (!r) throw notFound();
  return { audit_event_id: r.id, undo_until: r.undoable_until?.toISOString() ?? null };
}

const byMove = (client: pg.ClientBase, input: { move_id: string }) =>
  locationOfMove(client, input.move_id);

// ---------------------------------------------------------------------------------------------

export const listMovesTool: Handler<'list_moves'> = {
  action: 'content.view',
  global: true,
  run: async (op, input) => {
    const size = pageSize(input.limit);
    // Without a location_id, every location where the tool may run; the route's own list.
    const here = new Set(op.locations.map((l) => l.id));
    const page = await paged(input.cursor, async (c) => {
      const res = await listMoves(
        op.client,
        {
          ...(op.location ? { locationId: op.location.id } : {}),
          ...(input.status ? { status: input.status } : {}),
          limit: size,
        },
        c ? decodeCursor(c) : null,
      );
      return { items: res.items.filter((m) => here.has(m.locationId)), next: res.next_cursor };
    });
    return {
      nextCursor: page.nextCursor,
      cursorAt: page.cursorAt,
      data: { items: page.items.map((m) => moveOf(op, m)) },
    };
  },
};

export const getMoveTool: Handler<'get_move'> = {
  action: 'content.view',
  subjectLocation: byMove,
  run: async (op, input) => {
    await requireMoveHere(op, input.move_id);
    const view = await moveView(op.client, input.move_id);
    const offset = input.cursor ? decodeOffsetCursor(input.cursor) : 0;
    if (offset === null) throw invalid('The cursor is not valid; start again without one.');
    const size = pageSize(input.limit);
    const end = offset + size;
    return {
      nextCursor: end < view.boxes.length ? encodeOffsetCursor(end) : null,
      cursorAt: (kept) => encodeOffsetCursor(offset + kept),
      data: {
        move: moveOf(op, view),
        items: view.boxes.slice(offset, end).map((b) => boxOf(op, b)),
        missing: view.boxes.filter((b) => isMissing(b.state)).map((b) => b.number),
      },
    };
  },
};

export const startMoveTool: Handler<'start_move'> = {
  action: 'things.edit',
  run: async (op, input) => {
    const loc = locationOf(op);
    const view = await createMove(op, loc.id, {
      name: input.name,
      ...(input.to_location_id ? { toLocationId: input.to_location_id } : {}),
    });
    return { data: { ...(await writeResult(op, 'move', view.id)), move: moveOf(op, view) } };
  },
};

export const addBoxTool: Handler<'add_box'> = {
  action: 'things.edit',
  subjectLocation: byMove,
  run: async (op, input) => {
    const loc = locationOf(op);
    await requireMoveHere(op, input.move_id);
    if (input.container_id && (input.prefix !== undefined || input.place_id !== undefined)) {
      throw invalid('prefix and place_id are for a new box; leave them out with container_id.');
    }
    const destination = input.destination_place_id
      ? { destinationPlaceId: await roomOf(op, input.destination_place_id) }
      : {};
    const box = input.container_id
      ? await addBox(op, input.move_id, {
          containerId: await thingIn(op.client, loc.id, input.container_id),
          ...destination,
        })
      : await addBox(op, input.move_id, {
          new: {
            ...(input.prefix ? { prefix: input.prefix } : {}),
            ...(input.place_id
              ? { placeId: await placeIn(op.client, loc.id, input.place_id) }
              : {}),
          },
          ...destination,
        });
    return {
      data: { ...(await writeResult(op, 'thing', box.containerId)), box: boxOf(op, box) },
    };
  },
};

export const packIntoBoxTool: Handler<'pack_into_box'> = {
  action: 'things.edit',
  subjectLocation: byMove,
  run: async (op, input) => {
    const loc = locationOf(op);
    await requireMoveHere(op, input.move_id);
    const containerId = await boxIn(op, input.box_id);
    const ids: string[] = [];
    for (const raw of input.thing_ids) ids.push(await thingIn(op.client, loc.id, raw));
    const { box, moved } = await packIntoBox(op, input.move_id, containerId, ids);
    const things: ThingRef[] = [];
    for (const id of moved) things.push(await thingRef(op, id));
    return {
      data: {
        ...(await writeResult(op, 'thing', moved[0] as string)),
        audit_event_ids: undoableEventIds(op.tx),
        box: boxOf(op, box),
        things,
      },
    };
  },
};

export const setBoxStatusTool: Handler<'set_box_status'> = {
  action: 'things.edit',
  subjectLocation: byMove,
  run: async (op, input) => {
    await requireMoveHere(op, input.move_id);
    const containerId = await boxIn(op, input.box_id);
    const { box, changed } = await updateBox(op, input.move_id, containerId, {
      ...(input.state ? { state: input.state } : {}),
      ...(input.destination_place_id
        ? { destinationPlaceId: await roomOf(op, input.destination_place_id) }
        : {}),
    });
    return {
      data: { ...(await boxResult(op, containerId, changed)), box: boxOf(op, box), changed },
    };
  },
};

export const unpackBoxTool: Handler<'unpack_box'> = {
  action: 'things.edit',
  subjectLocation: byMove,
  run: async (op, input) => {
    await requireMoveHere(op, input.move_id);
    const containerId = await boxIn(op, input.box_id);
    const { box, changed } = await unpackBox(op, input.move_id, containerId, {
      ...(input.place_id ? { placeId: await roomOf(op, input.place_id) } : {}),
    });
    return {
      data: { ...(await boxResult(op, containerId, changed)), box: boxOf(op, box), changed },
    };
  },
};
