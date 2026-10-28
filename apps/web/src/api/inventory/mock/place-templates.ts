/**
 * Mock handlers for place templates (#238; apps/server/src/templates/place-templates.ts): the
 * account's own templates, and furniture made from one with its compartments, numbered as the
 * server numbers them (packages/shared place-templates.ts) and undone in one step.
 */
import {
  builtinPlaceTemplate,
  canTurn,
  cellsOf,
  DEFAULT_COMPARTMENT_NAMES,
  fillPattern,
  layoutProblem,
  type PlaceLayout,
  withCount,
} from '@kept/shared';
import type { MockState } from '../../mock/fixtures';
import { err, forbidden, type MockRoute, notFound, reply, route } from '../../mock/kit';
import { inventoryPaths as p } from '../paths';
import type {
  AccountPlaceTemplate,
  FromTemplateBody,
  FromTemplateResult,
  PlaceTemplateBody,
} from '../types';
import {
  accessOf,
  type InventoryState,
  livePlace,
  newId,
  placeViewOf,
  recordEvent,
  type StoredPlace,
} from './db';

const STORE = new WeakMap<InventoryState, AccountPlaceTemplate[]>();

/** The mock's place templates (tests seed them through this). */
export function mockPlaceTemplates(inv: InventoryState): AccountPlaceTemplate[] {
  let list = STORE.get(inv);
  if (!list) {
    list = [];
    STORE.set(inv, list);
  }
  return list;
}

export function placeTemplatesRoutes(state: MockState): MockRoute[] {
  const inv = () => state.inventory;
  const access = () => accessOf(state);
  const me = () => ({ id: state.me.user.id, displayName: state.me.user.displayName });
  const templates = () => mockPlaceTemplates(inv());
  const usableIn = (locationId: string) =>
    templates().filter((x) => x.locations.some((l) => l.id === locationId));

  return [
    route('GET', p.placeTemplates, ({ query }) => {
      const locationId = query.get('locationId') ?? '';
      if (!access().canWrite(locationId)) return { items: [] };
      return { items: usableIn(locationId).map(({ locations: _l, rowVersion: _v, ...x }) => x) };
    }),

    route('GET', p.accountPlaceTemplates(':accountId'), ({ params }) => ({
      items: templates().filter((x) =>
        x.locations.every(
          (l) => inv().accountOf[l.id] === params.accountId && access().isAdmin(l.id),
        ),
      ),
    })),

    route('POST', p.accountPlaceTemplates(':accountId'), ({ body }) => {
      const b = body as PlaceTemplateBody;
      if (!b.locationIds?.length || b.locationIds.some((id) => !access().isAdmin(id)))
        return forbidden();
      if (layoutProblem(b.layout as PlaceLayout))
        return err(400, 'validation', 'The request is not valid.', 'Check the layout.');
      const made: AccountPlaceTemplate = {
        id: newId(),
        name: b.name,
        layout: b.layout,
        kindKey: b.kindKey,
        compartmentKindKey: b.compartmentKindKey,
        compartmentName: b.compartmentName,
        codePattern: b.codePattern ?? null,
        locations: b.locationIds.map((id) => ({
          id,
          name: state.locations.find((l) => l.id === id)?.name ?? '',
        })),
        rowVersion: 1,
      };
      templates().push(made);
      return reply(201, made);
    }),

    route('PATCH', p.placeTemplate(':id'), ({ params, body }) => {
      const x = templates().find((y) => y.id === params.id);
      if (!x) return notFound();
      const b = body as Partial<PlaceTemplateBody>;
      Object.assign(x, {
        ...(b.name ? { name: b.name } : {}),
        ...(b.layout ? { layout: b.layout } : {}),
        ...(b.kindKey ? { kindKey: b.kindKey } : {}),
        ...(b.compartmentKindKey ? { compartmentKindKey: b.compartmentKindKey } : {}),
        ...(b.compartmentName ? { compartmentName: b.compartmentName } : {}),
        ...(b.codePattern !== undefined ? { codePattern: b.codePattern } : {}),
        rowVersion: x.rowVersion + 1,
      });
      if (b.locationIds)
        x.locations = b.locationIds.map((id) => ({
          id,
          name: state.locations.find((l) => l.id === id)?.name ?? '',
        }));
      return x;
    }),

    route('DELETE', p.placeTemplate(':id'), ({ params }) => {
      const list = templates();
      const i = list.findIndex((y) => y.id === params.id);
      if (i < 0) return notFound();
      list.splice(i, 1);
      return reply(204);
    }),

    route('POST', p.placesFromTemplate(':locationId'), ({ params, body }) => {
      const locationId = params.locationId ?? '';
      if (!access().visible(locationId)) return notFound();
      if (!access().canWrite(locationId)) return forbidden();
      const b = body as FromTemplateBody;
      const own =
        'id' in b.template
          ? usableIn(locationId).find((x) => x.id === (b.template as { id: string }).id)
          : null;
      const builtin = 'builtin' in b.template ? builtinPlaceTemplate(b.template.builtin) : null;
      const source = own ?? builtin;
      if (!source) return notFound();
      const layout = withCount(source.layout as PlaceLayout, b.count);
      if (layoutProblem(layout) || (b.orientation === 'side' && !canTurn(layout)))
        return err(400, 'validation', 'The request is not valid.');
      const parentId = b.parentId ?? null;
      if (parentId && livePlace(inv(), parentId)?.locationId !== locationId) return notFound();
      const pattern =
        b.compartmentName ?? (own ? own.compartmentName : DEFAULT_COMPARTMENT_NAMES[layout.kind]);
      const codePattern = b.codePattern !== undefined ? b.codePattern : (own?.codePattern ?? null);
      const base = (over: Partial<StoredPlace>): StoredPlace => ({
        id: newId(),
        locationId,
        parentId,
        name: '',
        kindKey: source.kindKey,
        icon: null,
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
        ...over,
      });
      const furniture = base({ id: b.id ?? newId(), name: b.name.trim(), childOrder: 'custom' });
      const cells = cellsOf(layout, b.orientation ?? 'upright');
      const kids = cells.map((cell) =>
        base({
          parentId: furniture.id,
          name: fillPattern(pattern, cell),
          kindKey: source.compartmentKindKey,
          sort: cell.n - 1,
        }),
      );
      inv().places.push(furniture, ...kids);
      const ids = new Set([furniture.id, ...kids.map((k) => k.id)]);
      recordEvent(inv(), me(), {
        action: 'place.create',
        entity: { type: 'place', id: furniture.id },
        locationId,
        name: furniture.name,
        undo: () => {
          for (const pl of inv().places)
            if (ids.has(pl.id)) pl.deletedAt = new Date().toISOString();
        },
      });
      const result: FromTemplateResult = {
        place: placeViewOf(inv(), furniture),
        compartments: cells.map((cell, i) => ({
          id: kids[i]?.id as string,
          name: kids[i]?.name as string,
          n: cell.n,
          row: cell.row,
          col: cell.col,
          code: codePattern
            ? fillPattern(codePattern, { ...cell, parent: b.code ?? null }).toUpperCase()
            : null,
        })),
      };
      return reply(201, result);
    }),
  ];
}
