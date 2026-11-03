/**
 * Mock handlers for furniture's compartments (#238, 1.14.4; apps/server/src/templates/
 * furniture.ts): turning the unit, merging and splitting compartments, through the same rules
 * the server uses (packages/shared compartments.ts), each one undoable event. Short IDs aren't
 * moved here; the demo's labels don't need them to.
 */
import {
  type Compartment,
  canTurn,
  codesHeld,
  fillPattern,
  gridOf,
  mergeCompartments,
  mergeProblem,
  positionCode,
  type StoredCell,
  splitCompartment,
  storedCellOf,
  turnCompartments,
} from '@kept/shared';
import type { MockState } from '../../mock/fixtures';
import { err, forbidden, type MockRoute, notFound, reply, route } from '../../mock/kit';
import { inventoryPaths as p } from '../paths';
import type { TurnBody } from '../types';
import {
  accessOf,
  compartmentsOf,
  livePlace,
  newId,
  placeViewOf,
  recordEvent,
  type StoredPlace,
} from './db';

export function furnitureRoutes(state: MockState): MockRoute[] {
  const inv = () => state.inventory;
  const access = () => accessOf(state);
  const me = () => ({ id: state.me.user.id, displayName: state.me.user.displayName });

  /** The furniture, writable by the caller, or the reply that says why not. */
  const furnitureOf = (id: string) => {
    const f = livePlace(inv(), id);
    if (!f || !access().visible(f.locationId)) return { no: notFound() } as const;
    if (!access().canWrite(f.locationId)) return { no: forbidden() } as const;
    if (!f.layout) return { no: err(409, 'conflict', 'This place has no compartments.') } as const;
    const grid = gridOf(f.layout);
    const list = compartmentsOf(inv(), f.id, grid);
    return { f, grid, list } as const;
  };

  /** Everything the change may touch, copied, and an undo that puts it back. */
  const snapshot = (ids: readonly string[], things: readonly string[] = []) => {
    const places = inv()
      .places.filter((x) => ids.includes(x.id))
      .map((x) => structuredClone(x));
    const where = inv()
      .things.filter((x) => things.includes(x.id))
      .map((x) => ({ id: x.id, placeId: x.placeId }));
    const made = new Set<string>();
    const undo = () => {
      for (const was of places) {
        const i = inv().places.findIndex((x) => x.id === was.id);
        if (i >= 0) inv().places[i] = structuredClone(was);
      }
      inv().places = inv().places.filter((x) => !made.has(x.id));
      for (const w of where) {
        const t = inv().things.find((x) => x.id === w.id);
        if (t) t.placeId = w.placeId;
      }
    };
    return { undo, made };
  };

  /** Writes the rules' compartments back onto the stored places. */
  const write = (list: readonly Compartment[], renumber: boolean) => {
    for (const c of list) {
      const place = livePlace(inv(), c.id);
      if (!place) continue;
      place.name = c.name;
      place.cell = storedCellOf(c);
      if (renumber) place.sort = c.n - 1;
      place.ownCodes = [...c.codes, ...c.parts.flatMap((x) => x.codes)].sort();
    }
  };

  const done = (f: StoredPlace, action: string, undo: () => void) => {
    recordEvent(inv(), me(), {
      action,
      entity: { type: 'place', id: f.id },
      locationId: f.locationId,
      name: f.name,
      undo,
    });
    return reply(200, { place: placeViewOf(inv(), f) });
  };

  return [
    route('POST', p.placeTurn(':id'), ({ params, body }) => {
      const got = furnitureOf(params.id ?? '');
      if ('no' in got) return got.no;
      const { f, list } = got;
      const layout = f.layout;
      if (!layout || !canTurn(layout))
        return err(409, 'conflict', 'Only a grid that isn’t square can stand on its side.');
      const b = body as TurnBody;
      const { undo } = snapshot([f.id, ...list.map((x) => x.c.id)]);
      const parent = f.ownCodes?.[0] ?? null;
      const out = turnCompartments(
        list.map((x) => x.c),
        layout,
        b.direction,
        b.renumber,
        { name: layout.compartmentName, code: layout.codePattern, parent },
      );
      f.layout = { ...layout, orientation: out.orientation };
      write(out.compartments, b.renumber);
      return done(f, 'place.turn', undo);
    }),

    route('POST', p.placeMergeCompartments(':id'), ({ params, body }) => {
      const got = furnitureOf(params.id ?? '');
      if ('no' in got) return got.no;
      const { f, list } = got;
      const ids = (body as { compartmentIds: string[] }).compartmentIds ?? [];
      const all = list.map((x) => x.c);
      if (mergeProblem(all, ids))
        return err(400, 'validation', 'Choose compartments side by side that make a rectangle.');
      const { survivor, absorbed } = mergeCompartments(all, ids);
      const gone = absorbed.map((x) => x.id);
      const things = inv()
        .things.filter((x) => x.placeId && gone.includes(x.placeId) && !x.deletedAt)
        .map((x) => x.id);
      const { undo } = snapshot([survivor.id, ...gone], things);
      write([survivor], false);
      for (const x of absorbed) {
        const place = livePlace(inv(), x.id);
        if (!place) continue;
        place.deletedAt = new Date().toISOString();
        place.cell = undefined;
        place.ownCodes = [];
      }
      for (const t of inv().things) if (things.includes(t.id)) t.placeId = survivor.id;
      return done(f, 'place.merge_compartments', undo);
    }),

    route('POST', p.placeSplitCompartment(':id'), ({ params, body }) => {
      const got = furnitureOf(params.id ?? '');
      if ('no' in got) return got.no;
      const { f, grid, list } = got;
      const id = (body as { compartmentId: string }).compartmentId;
      const one = list.find((x) => x.c.id === id)?.c;
      if (!one) return notFound();
      if (one.rows * one.cols < 2)
        return err(409, 'conflict', 'This compartment is one cell already.');
      const { survivor, pieces } = splitCompartment(one, grid);
      const back = pieces.flatMap((x) => (x.part ? [x.part.placeId] : []));
      const { undo, made } = snapshot([one.id, ...back]);
      write([survivor], false);
      const held = codesHeld(list.map((x) => x.c));
      const kind = livePlace(inv(), one.id)?.kindKey ?? 'cube';
      const name = f.layout?.compartmentName ?? 'Cube {n}';
      for (const piece of pieces) {
        const cell: StoredCell = { row: piece.row, col: piece.col, n: piece.part?.n ?? piece.n };
        const codes =
          piece.part?.codes ??
          [
            positionCode(
              { name, code: f.layout?.codePattern ?? null, parent: f.ownCodes?.[0] ?? null },
              piece,
            ),
          ].filter((c): c is string => !!c && !held.has(c));
        const trashed = piece.part
          ? inv().places.find((x) => x.id === piece.part?.placeId && x.deletedAt)
          : undefined;
        if (trashed) {
          trashed.deletedAt = null;
          trashed.cell = cell;
          trashed.ownCodes = codes;
          continue;
        }
        const placeId = newId();
        made.add(placeId);
        inv().places.push({
          id: placeId,
          locationId: f.locationId,
          parentId: f.id,
          name: piece.part?.name || fillPattern(name, piece),
          kindKey: kind,
          icon: null,
          isUnplaced: false,
          shortCode: null,
          fields: [],
          custom: {},
          secrets: [],
          rowVersion: 1,
          sort: piece.n - 1,
          deletedAt: null,
          trashBatchId: null,
          deletedBy: null,
          cell,
          ownCodes: codes,
        });
      }
      return done(f, 'place.split', undo);
    }),
  ];
}
