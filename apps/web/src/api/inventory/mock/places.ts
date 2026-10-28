/** Mock handlers for places (task 13's routes). Task 25 extends these as its screens need. */
import { comparePlaceSiblings, naturalCompare, siblingOrder } from '@kept/shared';
import type { MockState } from '../../mock/fixtures';
import {
  err,
  forbidden,
  type MockRoute,
  notFound,
  reply,
  route,
  sessionGate,
} from '../../mock/kit';
import { inventoryPaths as p } from '../paths';
import type {
  ConvertChildResult,
  ConvertChildrenBody,
  ConvertToContainerBody,
  CreatePlaceBody,
  DerivedState,
  MergePlaceBody,
  PlaceContents,
  PlaceFolds,
  PlaceView,
  ReorderBody,
  TrashBody,
  UpdatePlaceBody,
} from '../types';
import {
  accessOf,
  boxNodesOf,
  contentsOf,
  derivedStateOf,
  type InventoryState,
  livePlace,
  matches,
  newId,
  now,
  paginate,
  placeNodeOf,
  placeViewOf,
  recordEvent,
  rowOf,
  type StoredPlace,
  type StoredThing,
  tagGroupKey,
  versionError,
} from './db';
import { narrow } from './filters';

export function placesRoutes(state: MockState): MockRoute[] {
  const inv = () => state.inventory;
  const access = () => accessOf(state);
  const me = () => ({ id: state.me.user.id, displayName: state.me.user.displayName });
  /** A live place the caller can see, or null (the server's 404 for both). */
  const visiblePlace = (id: string | undefined) => {
    const pl = livePlace(inv(), id ?? null);
    return pl && access().visible(pl.locationId) ? pl : null;
  };

  /**
   * A place's fields come from its kind (task 13: `fields: ResolvedField[]`, resolved from the
   * place kind of the location's owner account), unless the stored place carries its own.
   */
  const withKindFields = (view: PlaceView): PlaceView => {
    if (view.fields.length) return view;
    const kinds = inv().placeKinds[inv().accountOf[view.locationId] ?? ''] ?? [];
    const kind = kinds.find((k) => k.key === view.kindKey);
    return kind ? { ...view, fields: kind.fields } : view;
  };

  /** The place `pl` as a box thing with the same id, what was in it inside it. */
  const toBox = (pl: StoredPlace, typeId: string | undefined) => {
    const type = inv().types.find((t) => t.id === typeId) ?? null;
    inv().things.push({
      ...contentsTemplate(),
      id: pl.id,
      locationId: pl.locationId,
      name: pl.name,
      shortCode: pl.shortCode,
      type: type
        ? { id: type.id, icon: type.icon, name: type.name, builtinKey: type.builtinKey }
        : null,
      placeId:
        pl.parentId ??
        inv().places.find((x) => x.locationId === pl.locationId && x.isUnplaced)?.id ??
        null,
      isContainer: true,
    });
    for (const t of inv().things) {
      if (t.placeId !== pl.id) continue;
      t.placeId = null;
      t.containerId = pl.id;
    }
    inv().places = inv().places.filter((x) => x.id !== pl.id);
  };

  return [
    route('GET', p.locationPlaces(':locationId'), ({ params }) => {
      const gate = sessionGate(state);
      if (gate) return gate;
      const locationId = params.locationId ?? '';
      if (!access().visible(locationId)) return notFound();
      const places = inv()
        .places.filter((pl) => pl.locationId === locationId && !pl.deletedAt)
        .map((pl) => placeNodeOf(inv(), pl))
        .sort(comparePlaceSiblings);
      return { places, boxes: boxNodesOf(inv(), locationId) };
    }),

    // #358: the outline's folds, the server's way: a member's own, and only the location's places.
    route('GET', p.placeFolds(':locationId'), ({ params }) => {
      const gate = sessionGate(state);
      if (gate) return gate;
      const locationId = params.locationId ?? '';
      if (!access().visible(locationId)) return notFound();
      return { placeIds: inv().placeFolds?.[locationId] ?? [] } satisfies PlaceFolds;
    }),
    route('PUT', p.placeFolds(':locationId'), ({ params, body }) => {
      const locationId = params.locationId ?? '';
      if (!access().visible(locationId)) return notFound();
      const ids = new Set((body as PlaceFolds).placeIds);
      const here = inv().places.filter((pl) => pl.locationId === locationId && ids.has(pl.id));
      inv().placeFolds = { ...inv().placeFolds, [locationId]: here.map((pl) => pl.id) };
      return reply(204);
    }),

    route('POST', p.locationPlaces(':locationId'), ({ params, body }) => {
      const locationId = params.locationId ?? '';
      if (!access().visible(locationId)) return notFound();
      if (!access().canWrite(locationId)) return forbidden();
      const b = body as CreatePlaceBody;
      if (!b.name?.trim() || b.name.length > 120)
        return err(400, 'validation', 'A place needs a name of 1 to 120 characters.');
      const created: StoredPlace = {
        id: b.id ?? newId(),
        locationId,
        parentId: b.parentId ?? null,
        name: b.name.trim(),
        kindKey: b.kindKey,
        icon: b.icon ?? null,
        isUnplaced: false,
        shortCode: null,
        fields: [],
        custom: {},
        secrets: [],
        rowVersion: 1,
        sort: 0,
        deletedAt: null,
        trashBatchId: null,
        deletedBy: null,
      };
      inv().places.push(created);
      return reply(201, placeViewOf(inv(), created));
    }),

    route('GET', p.place(':id'), ({ params }) => {
      const gate = sessionGate(state);
      if (gate) return gate;
      const pl = visiblePlace(params.id);
      return pl ? withKindFields(placeViewOf(inv(), pl)) : notFound();
    }),

    route('GET', p.placeContents(':id'), ({ params, query }) => {
      const pl = visiblePlace(params.id);
      if (!pl) return notFound();
      const q = query.get('q') ?? '';
      const children = inv()
        .places.filter((c) => c.parentId === pl.id && !c.deletedAt)
        .filter((c) => !q || matches(c.name, q))
        .map((c) => placeNodeOf(inv(), c))
        .sort(siblingOrder(pl.childOrder));
      let found = inv()
        .things.filter((t) => t.placeId === pl.id && !t.deletedAt)
        .filter((t) => !q || matches(t.name ?? '', q));
      found = narrow(found, query, 'type', (t, v) => t.type?.id === v);
      found = narrow(found, query, 'tag', (t, v) => t.tags.some((g) => g.id === v));
      found = narrow(found, query, 'state', (t, v) =>
        v === 'archived'
          ? t.lifecycle === 'archived'
          : derivedStateOf(t, inv()).includes(v as DerivedState),
      );
      found = narrow(found, query, 'brand', (t, v) => t.brand?.id === v);
      found = narrow(found, query, 'belongsTo', (t, v) => t.belongsTo?.id === v);
      const things = found
        .sort(contentsOrder(query.get('sort'), query.get('group'), query.get('dir'), inv()))
        .map((t) => rowOf(inv(), t));
      const out: PlaceContents = { places: children, things: paginate(things, query) };
      return out;
    }),

    route('PATCH', p.place(':id'), ({ params, body, headers }) => {
      const pl = visiblePlace(params.id);
      if (!pl) return notFound();
      if (!access().canWrite(pl.locationId)) return forbidden();
      const b = body as UpdatePlaceBody;
      const stale = versionError(headers, pl, Object.keys(b));
      if (stale) return reply(stale.status, stale.body);
      if (pl.isUnplaced && b.parentId !== undefined)
        return err(
          409,
          'conflict',
          'That conflicts with the current state.',
          'Unplaced stays at the top.',
        );
      if (b.parentId !== undefined && b.parentId !== null) {
        const target = visiblePlace(b.parentId);
        if (!target || target.locationId !== pl.locationId) return notFound();
        // The server refuses a place under the Unplaced area (T13).
        if (target.isUnplaced)
          return err(
            409,
            'conflict',
            'That conflicts with the current state.',
            'Nothing goes inside Unplaced.',
          );
      }
      const { custom, ...rest } = b;
      Object.assign(pl, rest);
      if (custom) {
        for (const [key, value] of Object.entries(custom)) {
          if (value === null) delete pl.custom[key];
          else pl.custom[key] = value;
        }
      }
      pl.rowVersion += 1;
      return placeViewOf(inv(), pl);
    }),

    route('POST', p.placeTrash(':id'), ({ params, body }) => {
      const pl = visiblePlace(params.id);
      if (!pl) return notFound();
      if (!access().canWrite(pl.locationId)) return forbidden();
      if (pl.isUnplaced)
        return err(
          409,
          'conflict',
          'That conflicts with the current state.',
          'The Unplaced area stays.',
        );
      const b = (body ?? {}) as TrashBody;
      const childPlaces = inv().places.filter((c) => c.parentId === pl.id && !c.deletedAt);
      const childThings = inv().things.filter((t) => t.placeId === pl.id && !t.deletedAt);
      if ((childPlaces.length || childThings.length) && !b.contents)
        return err(
          409,
          'contents_choice_required',
          'Choose what happens to what is inside.',
          undefined,
          {
            counts: { places: childPlaces.length, things: childThings.length },
          },
        );
      const batch = newId();
      const trashed = [pl.id];
      const moved: string[] = [];
      const stamp = { deletedAt: now(), trashBatchId: batch, deletedBy: state.me.user.displayName };
      Object.assign(pl, stamp);
      if (b.contents === 'trash') {
        for (const row of [...childPlaces, ...childThings]) {
          Object.assign(row, stamp);
          trashed.push(row.id);
        }
      } else if (b.contents === 'move' && b.moveTo) {
        const to = b.moveTo;
        for (const t of childThings) {
          if ('placeId' in to) {
            t.placeId = to.placeId;
          } else {
            t.placeId = null;
            t.containerId = to.containerId;
          }
          moved.push(t.id);
        }
        if ('placeId' in to)
          for (const c of childPlaces) {
            c.parentId = to.placeId;
            moved.push(c.id);
          }
      }
      return { trashed, moved, trashBatchId: batch };
    }),

    route('POST', p.placeRestore(':id'), ({ params }) => {
      const pl = inv().places.find((x) => x.id === params.id && x.deletedAt);
      if (!pl || !access().visible(pl.locationId)) return notFound();
      if (!access().canWrite(pl.locationId)) return forbidden();
      const batch = pl.trashBatchId;
      const restored: string[] = [];
      for (const row of [...inv().places, ...inv().things]) {
        if (batch && row.trashBatchId === batch) {
          row.deletedAt = null;
          row.trashBatchId = null;
          row.deletedBy = null;
          restored.push(row.id);
        }
      }
      return { restored };
    }),

    route('DELETE', p.place(':id'), ({ params }) => {
      const pl = inv().places.find((x) => x.id === params.id);
      if (!pl || !access().visible(pl.locationId)) return notFound();
      if (!access().isAdmin(pl.locationId)) return forbidden();
      if (!pl.deletedAt) return err(409, 'conflict', 'Only a trashed place can be deleted.');
      inv().places = inv().places.filter((x) => x.id !== pl.id);
      return reply(204);
    }),

    route('POST', p.placeMergeInto(':id'), ({ params, body, headers }) => {
      const b = body as MergePlaceBody;
      const pl = visiblePlace(params.id);
      const target = visiblePlace(b.targetId);
      if (!pl || !target || target.locationId !== pl.locationId) return notFound();
      if (!access().isAdmin(pl.locationId)) return forbidden();
      // If-Match is the target's version, `sourceRowVersion` the source's (T25 decision 5).
      const stale = versionError(headers, target);
      if (stale) return reply(stale.status, stale.body);
      if (b.sourceRowVersion !== pl.rowVersion) {
        const source = versionError({ 'if-match': String(b.sourceRowVersion) }, pl);
        if (source) return reply(source.status, source.body);
      }
      for (const t of inv().things) if (t.placeId === pl.id) t.placeId = target.id;
      for (const c of inv().places) if (c.parentId === pl.id) c.parentId = target.id;
      inv().places = inv().places.filter((x) => x.id !== pl.id);
      return placeViewOf(inv(), target);
    }),

    route('POST', p.placeConvertToContainer(':id'), ({ params, body }) => {
      const pl = visiblePlace(params.id);
      if (!pl) return notFound();
      if (!access().canWrite(pl.locationId)) return forbidden();
      toBox(pl, (body as ConvertToContainerBody | undefined)?.typeId);
      return { thingId: pl.id };
    }),

    // Places inside a place as boxes, one row each, each with an undo (the server's
    // convert-children-to-containers): the one Undo sends them all to undo-together.
    route('POST', p.placeConvertChildren(':id'), ({ params, body }) => {
      const parent = visiblePlace(params.id);
      if (!parent) return notFound();
      if (!access().canWrite(parent.locationId)) return forbidden();
      const b = body as ConvertChildrenBody;
      if (!b.placeIds?.length) return err(400, 'validation', 'Choose at least one place.');
      const results: ConvertChildResult[] = [];
      for (const id of [...new Set(b.placeIds)]) {
        const pl = visiblePlace(id);
        if (!pl || pl.parentId !== parent.id) {
          results.push({ placeId: id, status: 'refused', reason: 'not_here' });
          continue;
        }
        if (inv().places.some((c) => c.parentId === pl.id)) {
          results.push({ placeId: id, status: 'refused', reason: 'has_places' });
          continue;
        }
        const was = { ...pl };
        toBox(pl, b.typeId);
        recordEvent(inv(), me(), {
          action: 'place.convert_to_container',
          entity: { type: 'place', id: pl.id },
          locationId: pl.locationId,
          name: pl.name,
          undo: () => {
            inv().things = inv().things.filter((t) => t.id !== was.id);
            for (const t of inv().things)
              if (t.containerId === was.id)
                Object.assign(t, { containerId: null, placeId: was.id });
            inv().places.push(was);
          },
        });
        results.push({ placeId: id, status: 'converted', thingId: pl.id });
      }
      return { results };
    }),

    route('POST', p.placeReorder(':id'), ({ params, body }) => {
      const parent = visiblePlace(params.id);
      if (!parent) return notFound();
      if (!access().canWrite(parent.locationId)) return forbidden();
      const b = body as ReorderBody;
      const kids = inv()
        .places.filter((c) => c.parentId === parent.id && !c.deletedAt)
        .map((c) => placeNodeOf(inv(), c))
        .sort(siblingOrder(parent.childOrder));
      const order = kids.map((k) => k.id);
      const i = order.indexOf(b.placeId);
      if (i < 0) return notFound();
      if (parent.childOrder !== 'custom')
        return err(409, 'conflict', 'Switch the places here to Custom order first.');
      const j = b.direction === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= order.length) return { order };
      [order[i], order[j]] = [order[j] as string, order[i] as string];
      order.forEach((id, n) => {
        const pl = inv().places.find((x) => x.id === id);
        if (pl) pl.sort = n;
      });
      return { order };
    }),

    route('POST', p.placeLabel(':id'), ({ params }) => {
      const pl = visiblePlace(params.id);
      if (!pl) return notFound();
      if (!access().canWrite(pl.locationId)) return forbidden();
      pl.shortCode ??= 'P1ACE7';
      return { code: pl.shortCode };
    }),
  ];
}

/** The contents sort (`name` A to Z by default, `updated`, `lastSeen` newest first), grouped by
 * type first; `dir` turns the sort around (D211). */
function contentsOrder(
  sort: string | null,
  group: string | null,
  dir: string | null,
  inv: InventoryState,
) {
  const typeKey = (t: StoredThing) => t.type?.builtinKey ?? t.type?.name ?? '~';
  const date = sort === 'updated' || sort === 'lastSeen';
  const flip = dir === (date ? 'asc' : 'desc') ? -1 : 1;
  return (a: StoredThing, b: StoredThing) =>
    (group === 'type' ? typeKey(a).localeCompare(typeKey(b)) : 0) ||
    (group === 'tag' ? tagGroupKey(inv, a).localeCompare(tagGroupKey(inv, b)) : 0) ||
    flip *
      (sort === 'updated'
        ? b.updatedAt.localeCompare(a.updatedAt)
        : sort === 'lastSeen'
          ? (b.lastSeenAt ?? '').localeCompare(a.lastSeenAt ?? '')
          : naturalCompare(a.name ?? '', b.name ?? ''));
}

/** Defaults for a thing the mock creates from a place (convert-to-container). */
function contentsTemplate() {
  return {
    quantity: 1,
    lifecycle: 'in_use' as const,
    containerThumbUrl: null,
    thumbUrl: null,
    lastSeenAt: now(),
    brand: null,
    model: null,
    serial: null,
    barcode: null,
    colour: null,
    condition: null,
    notes: null,
    aliases: {},
    tags: [],
    belongsTo: null,
    manualUrl: null,
    expiresOn: null,
    expiryLeadDays: null,
    ended: null,
    acquiredFrom: null,
    provenanceNotes: null,
    locationUncertain: false,
    reviewState: 'confirmed' as const,
    fieldStatus: {},
    fields: [],
    custom: {},
    archivedCustom: {},
    secrets: [],
    containerId: null,
    purchase: null,
    photos: [],
    attachmentsCount: 0,
    meters: [],
    links: [],
    rowVersion: 1,
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
    trashBatchId: null,
    deletedBy: null,
  };
}

export { contentsOf, contentsTemplate };
