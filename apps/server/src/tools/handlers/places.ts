import type { PlaceRef, ToolOutput } from '@kept/mcp';
import { undoableEventIds } from '../../audit/audited.js';
import { conflict, pgErrorOf } from '../../http/errors.js';
import {
  convertChildren,
  reorderChild,
  type UpdatePlaceBody,
  updatePlace,
} from '../../places/service.js';
import { requirePlace } from '../../places/view.js';
import { viewOf } from '../../things/view.js';
import { placeRefOf, thingRefOf } from '../output.js';
import { locationOfRef, placeIn } from '../resolve.js';
import type { Handler, Op } from '../types.js';
import { writeResult } from './write.js';

// The place tools (#313): update_place is the app's place form (Rename: name and kind; Move: the
// place it is inside; its fields; Order of the places here: A to Z or Custom, and Move up / Move
// down) and turn_into_boxes is "Turn places into boxes". Each calls the route's own operation
// (places/service.ts), which checks the role and the row's version and writes the app's audit
// rows: `place.update` and `place.move` undoable for 7 days, `place.reorder` not (the opposite
// step is its undo, as in the app), and one undoable `place.convert_to_container` per box, which
// the app's one Undo (POST /api/v1/audit/undo) turns back together.

const locationOf = (op: Op) => {
  if (!op.location) throw new Error('a place tool always runs in one location');
  return op.location;
};

/** The trigger's refusal of a place moved under itself, said as the route says it. */
function loopRefusal(err: unknown): never {
  if (pgErrorOf(err)?.constraint === 'places_no_loop') {
    throw conflict("A place can't go inside itself or a place inside it.");
  }
  throw err;
}

export const updatePlaceTool: Handler<'update_place'> = {
  action: 'things.edit',
  subjectLocation: (client, input) => locationOfRef(client, input.place_id),
  run: async (op, input) => {
    const loc = locationOf(op);
    const id = await placeIn(op.client, loc.id, input.place_id);
    const f = input.fields ?? {};
    const body: UpdatePlaceBody = {};
    if (f.name !== undefined) body.name = f.name;
    if (f.kind !== undefined) body.kindKey = f.kind;
    if (f.child_order !== undefined) body.childOrder = f.child_order;
    if (f.custom !== undefined) body.custom = f.custom;
    if (f.parent_id !== undefined) {
      body.parentId = f.parent_id === null ? null : await placeIn(op.client, loc.id, f.parent_id);
    }
    if (Object.keys(body).length > 0) {
      // A confirmed card's If-Match is the place's version when it was proposed (D156).
      const expected = op.ifMatch ?? (await requirePlace(op.client, id)).rowVersion;
      await updatePlace(op, id, expected, body).catch(loopRefusal);
    }
    let order: string[] | undefined;
    let parentId: string | null = null;
    if (input.move) {
      parentId = (await requirePlace(op.client, id)).parentId;
      if (!parentId) {
        throw conflict(
          'The top of a location is always A to Z; only the places inside a place in Custom order move up or down.',
        );
      }
      order = (await reorderChild(op, parentId, { placeId: id, direction: input.move })).order;
      // At an edge the operation writes nothing: there was no step to take.
      const { rowCount } = await op.client.query(
        `SELECT 1 FROM public.audit_events
          WHERE request_id = $1 AND entity_id = $2 AND action = 'place.reorder'`,
        [op.requestId, parentId],
      );
      if (!rowCount) {
        throw conflict(
          input.move === 'up' ? 'It is already the first there.' : 'It is already the last there.',
        );
      }
    }
    // A field change answers its own undoable event; a step alone, the parent's reorder.
    const event =
      Object.keys(body).length > 0 || !parentId
        ? await writeResult(op, 'place', id)
        : await writeResult(op, 'place', parentId);
    return {
      data: {
        ...event,
        place: await placeRefOf(op.client, id),
        changed_fields: Object.keys(f),
        ...(order ? { order } : {}),
      },
    };
  },
};

type Refused = ToolOutput<'turn_into_boxes'>['refused'][number];

export const turnIntoBoxesTool: Handler<'turn_into_boxes'> = {
  action: 'things.edit',
  subjectLocation: (client, input) => locationOfRef(client, input.place_ids[0]),
  run: async (op, input) => {
    const loc = locationOf(op);
    // Each place as it is now (a refused one is answered as the place it stays), grouped by the
    // place it is inside: the app turns the places inside one place into boxes in one step.
    const refs = new Map<string, PlaceRef>();
    const byParent = new Map<string | null, string[]>();
    for (const raw of input.place_ids) {
      const id = await placeIn(op.client, loc.id, raw);
      if (refs.has(id)) continue;
      refs.set(id, await placeRefOf(op.client, id));
      const parent = (await requirePlace(op.client, id)).parentId;
      byParent.set(parent, [...(byParent.get(parent) ?? []), id]);
    }
    const converted = new Set<string>();
    const reasons = new Map<string, Refused['reason']>();
    for (const [parentId, placeIds] of byParent) {
      // A place at the top of the location has no place to turn it in: the app's single
      // conversion does that, and it has no Undo, so a tool leaves it to the person.
      if (parentId === null) {
        for (const id of placeIds) reasons.set(id, 'top_level');
        continue;
      }
      const { results } = await convertChildren(op, parentId, { placeIds });
      for (const r of results) {
        if (r.status === 'converted') converted.add(r.placeId);
        else reasons.set(r.placeId, r.reason);
      }
    }
    if (converted.size === 0) {
      const why = new Set(reasons.values());
      throw conflict(
        why.has('has_places') && why.size === 1
          ? 'None of them can become a box: each has places inside, and a box holds things only.'
          : 'None of them can become a box: a place at the top of a location, or one with places inside, stays a place.',
      );
    }
    const boxes = [];
    const refused: Refused[] = [];
    for (const [id, ref] of refs) {
      if (converted.has(id)) {
        boxes.push(thingRefOf(await viewOf(op.tx, op.client, op.scope, null, id), loc.name));
      } else refused.push({ place: ref, reason: reasons.get(id) ?? 'not_here' });
    }
    const first = [...converted][0] as string;
    return {
      data: {
        ...(await writeResult(op, 'place', first)),
        audit_event_ids: undoableEventIds(op.tx),
        boxes,
        refused,
      },
    };
  },
};
