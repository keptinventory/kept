/**
 * Mock handlers for the location map (1.x, D237), over the mock inventory: the same rules as
 * apps/server/src/map/view.ts (floors, rooms, nodes, things), and an arrange session that
 * replaces the location's layout. No attention pins: the mock has no stock rules or loans here.
 */
import { draftRooms, firstOverlap, newId } from '@kept/shared';
import { SAMPLE_PLAN_SIZE, sampleAnswer } from '@/map/floor-plan/sample-plan';
import { recordEvent, type StoredPlace } from '../inventory/mock/db';
import type { MockState } from '../mock/fixtures';
import { err, forbidden, type MockRoute, notFound, reply, route } from '../mock/kit';
import { mapPaths as p } from './paths';
import type {
  ApplyPlanBody,
  FloorPlanView,
  LayoutBody,
  MapNodeLayout,
  MapRoomLayout,
  MapView,
  StartPlanBody,
} from './types';

type Stored = {
  version: string | null;
  rooms: Map<string, MapRoomLayout>;
  nodes: Map<string, MapNodeLayout>;
};

/** A floor plan in the demo (D266): every upload is read as the sample plan, after a moment. */
type MockPlan = FloorPlanView & { readyAt: number };
const plansOf = new WeakMap<MockState, Map<string, MockPlan>>();
function plans(state: MockState): Map<string, MockPlan> {
  let m = plansOf.get(state);
  if (!m) {
    m = new Map();
    plansOf.set(state, m);
  }
  return m;
}
/** How long the demo "reads" a plan. */
export const MOCK_PLAN_READ_MS = 1500;

function planNow(plan: MockPlan): FloorPlanView {
  if (plan.status === 'reading' && Date.now() >= plan.readyAt) {
    const answer = sampleAnswer();
    plan.status = 'ready';
    plan.read = { status: 'succeeded', reason: null, pausedUntil: null, attempt: 1 };
    plan.answer = answer;
    plan.image = { ...SAMPLE_PLAN_SIZE };
    plan.drafts = draftRooms(answer, SAMPLE_PLAN_SIZE);
  }
  const { readyAt: _r, ...view } = plan;
  return view;
}
const stores = new WeakMap<MockState, Map<string, Stored>>();
function storeOf(state: MockState, locationId: string): Stored {
  let s = stores.get(state);
  if (!s) {
    s = new Map();
    stores.set(state, s);
  }
  let loc = s.get(locationId);
  if (!loc) {
    loc = { version: null, rooms: new Map(), nodes: new Map() };
    s.set(locationId, loc);
  }
  return loc;
}

/** The map of a mock location, as the server builds it. */
export function mockMapView(state: MockState, locationId: string): MapView | null {
  const loc = state.locations.find((l) => l.id === locationId);
  if (!loc) return null;
  const stored = storeOf(state, locationId);
  const places = state.inventory.places.filter((x) => x.locationId === locationId && !x.deletedAt);
  const byId = new Map(places.map((x) => [x.id, x]));
  const floors = places.filter((x) => x.kindKey === 'floor' && !x.parentId && !x.isUnplaced);
  const floorIds = new Set(floors.map((f) => f.id));
  const rooms = new Map<string, string | null>();
  for (const x of places) {
    if (x.isUnplaced || floorIds.has(x.id)) continue;
    if (!x.parentId) rooms.set(x.id, null);
    else if (floorIds.has(x.parentId)) rooms.set(x.id, x.parentId);
  }
  const roomOfPlace = (id: string | null): string | null => {
    let cur = id;
    for (let i = 0; cur && i < 50; i++) {
      if (rooms.has(cur)) return cur;
      cur = byId.get(cur)?.parentId ?? null;
    }
    return null;
  };
  const things = state.inventory.things.filter(
    (x) =>
      x.locationId === locationId &&
      !x.deletedAt &&
      x.lifecycle === 'in_use' &&
      x.reviewState !== 'draft',
  );
  const thingById = new Map(things.map((x) => [x.id, x]));
  const roomOfThing = (id: string): string | null => {
    let cur = thingById.get(id);
    for (let i = 0; cur && i < 50; i++) {
      if (cur.placeId) return roomOfPlace(cur.placeId);
      cur = cur.containerId ? thingById.get(cur.containerId) : undefined;
    }
    return null;
  };
  const nodeIds = new Set<string>();
  for (const x of places) {
    if (rooms.has(x.id) || x.isUnplaced || !x.parentId) continue;
    if (rooms.has(x.parentId) || (stored.nodes.has(x.id) && roomOfPlace(x.id))) nodeIds.add(x.id);
  }
  for (const x of things) {
    const direct = x.placeId !== null && rooms.has(x.placeId) && x.isContainer;
    if (direct || (stored.nodes.has(x.id) && roomOfThing(x.id))) nodeIds.add(x.id);
  }
  const parentOf = (id: string, subject: 'place' | 'thing'): string | null => {
    let kind = subject;
    let cur: string | null = id;
    for (let i = 0; cur && i < 50; i++) {
      let next: string | null;
      if (kind === 'thing') {
        const x = thingById.get(cur);
        next = x?.containerId ?? x?.placeId ?? null;
        kind = x?.containerId ? 'thing' : 'place';
      } else next = byId.get(cur)?.parentId ?? null;
      if (next && (nodeIds.has(next) || rooms.has(next))) return next;
      cur = next;
    }
    return null;
  };
  const view: MapView = {
    locationId,
    canArrange: loc.role !== 'viewer',
    version: stored.version,
    openPlans:
      loc.role === 'viewer'
        ? []
        : [...plans(state).values()]
            .filter((x) => x.locationId === locationId && ['reading', 'ready'].includes(x.status))
            .map((x) => ({ id: x.id, status: planNow(x).status }))
            .reverse(),
    levels: [
      ...([...rooms.values()].some((v) => v === null) || floors.length === 0
        ? [{ id: null, name: null }]
        : []),
      ...floors.map((f) => ({ id: f.id, name: f.name })),
    ],
    rooms: [...rooms.entries()].map(([id, levelId]) => {
      const x = byId.get(id);
      return {
        id,
        name: x?.name ?? '',
        shortCode: x?.shortCode ?? null,
        labelPrinted: x?.labelPrinted === true,
        levelId,
        kindKey: x?.kindKey ?? 'room',
        layout: stored.rooms.get(id) ?? null,
      };
    }),
    nodes: [],
    things: [],
    more: 0,
    attention: [],
  };
  for (const x of places) {
    const roomId = roomOfPlace(x.id);
    const parentId = parentOf(x.id, 'place');
    if (!nodeIds.has(x.id) || !roomId || !parentId) continue;
    view.nodes.push({
      id: x.id,
      subject: 'place',
      name: x.name,
      shortCode: x.shortCode,
      labelPrinted: x.labelPrinted === true,
      roomId,
      parentId,
      kindKey: x.kindKey,
      typeKey: null,
      isContainer: false,
      quantity: 1,
      layout: stored.nodes.get(x.id) ?? null,
    });
  }
  for (const x of things) {
    const roomId = roomOfThing(x.id);
    const parentId = parentOf(x.id, 'thing');
    if (!roomId || !parentId) continue;
    if (nodeIds.has(x.id)) {
      view.nodes.push({
        id: x.id,
        subject: 'thing',
        name: x.name ?? '',
        shortCode: x.shortCode,
        labelPrinted: x.labelPrinted === true,
        roomId,
        parentId,
        kindKey: null,
        typeKey: x.type?.builtinKey ?? null,
        isContainer: x.isContainer,
        quantity: x.quantity,
        layout: stored.nodes.get(x.id) ?? null,
      });
    }
    view.things.push({
      id: x.id,
      name: x.name ?? '',
      shortCode: x.shortCode,
      labelPrinted: x.labelPrinted === true,
      quantity: x.quantity,
      parentId,
      typeKey: x.type?.builtinKey ?? null,
      typeName: x.type && !x.type.builtinKey ? x.type.name : null,
      isContainer: x.isContainer,
    });
  }
  return view;
}

export function mapMockRoutes(state: MockState): MockRoute[] {
  return [
    route(
      'GET',
      p.map(':id'),
      ({ params }) => mockMapView(state, params.id as string) ?? notFound(),
    ),
    route('PUT', p.layout(':id'), ({ params, body }) => {
      const id = params.id as string;
      const loc = state.locations.find((l) => l.id === id);
      if (!loc) return notFound();
      if (loc.role === 'viewer') return forbidden();
      const b = body as LayoutBody;
      const stored = storeOf(state, id);
      if ((b?.version ?? null) !== stored.version)
        return err(409, 'conflict', 'Conflict.', 'Someone arranged this map since you opened it.', {
          reason: 'arranged_since',
        });
      stored.rooms = new Map(b.rooms.map(({ id: rid, ...r }) => [rid, r]));
      stored.nodes = new Map(b.nodes.map(({ id: nid, ...n }) => [nid, n]));
      stored.version = new Date().toISOString();
      return { version: stored.version };
    }),

    // ---- Floor plan to map (D266) ------------------------------------------------------------
    route('POST', p.floorPlans(':id'), ({ params, body }) => {
      const locationId = params.id as string;
      const loc = state.locations.find((l) => l.id === locationId);
      if (!loc) return notFound();
      if (loc.role === 'viewer') return forbidden();
      const b = body as StartPlanBody;
      const file = state.inventory.files[b.fileId];
      if (!file) return notFound();
      const plan: MockPlan = {
        id: newId(),
        locationId,
        status: 'reading',
        turn: b.turn ?? 0,
        keepPlan: false,
        createdAt: new Date().toISOString(),
        read: { status: 'queued', reason: null, pausedUntil: null, attempt: 1 },
        file: { id: file.id, attachmentId: newId(), mime: file.mime },
        image: null,
        answer: null,
        drafts: null,
        readyAt: Date.now() + MOCK_PLAN_READ_MS,
      };
      plans(state).set(plan.id, plan);
      return reply(201, planNow(plan));
    }),
    route('GET', p.floorPlan(':id'), ({ params }) => {
      const plan = plans(state).get(params.id as string);
      if (!plan || !['reading', 'ready', 'failed'].includes(plan.status)) return notFound();
      return planNow(plan);
    }),
    route('POST', p.floorPlanDiscard(':id'), ({ params }) => {
      const plan = plans(state).get(params.id as string);
      if (!plan) return notFound();
      plan.status = 'discarded';
      return { status: 'discarded' };
    }),
    route('POST', p.floorPlanRetry(':id'), ({ params }) => {
      const plan = plans(state).get(params.id as string);
      if (!plan) return notFound();
      plan.status = 'reading';
      plan.readyAt = Date.now() + MOCK_PLAN_READ_MS;
      return planNow(plan);
    }),
    route('POST', p.floorPlanApply(':id'), ({ params, body }) => {
      const plan = plans(state).get(params.id as string);
      if (!plan) return notFound();
      if (planNow(plan).status !== 'ready')
        return err(409, 'conflict', 'Conflict.', 'This plan isn’t ready to add.', {
          reason: 'not_ready',
        });
      const b = body as ApplyPlanBody;
      const stored = storeOf(state, plan.locationId);
      if ((b.version ?? null) !== stored.version)
        return err(409, 'conflict', 'Conflict.', 'Someone arranged this map since you started.', {
          reason: 'arranged_since',
        });
      const view = mockMapView(state, plan.locationId);
      const levelOf = new Map(view?.rooms.map((r) => [r.id, r.levelId]) ?? []);
      const floorIds = new Map<string, string>();
      const made: string[] = [];
      const place = (over: Partial<StoredPlace>): StoredPlace => ({
        id: newId(),
        locationId: plan.locationId,
        parentId: null,
        name: '',
        kindKey: 'room',
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
      for (const f of b.floors) {
        if (f.id) {
          floorIds.set(f.key, f.id);
          continue;
        }
        const floor = place({ name: f.name, kindKey: 'floor' });
        state.inventory.places.push(floor);
        floorIds.set(f.key, floor.id);
        made.push(floor.id);
      }
      const out: { key: string; id: string }[] = [];
      const rects = new Map<string | null, { x: number; z: number; w: number; d: number }[]>();
      for (const [rid, layout] of stored.rooms) {
        const level = levelOf.get(rid) ?? null;
        rects.set(level, [...(rects.get(level) ?? []), layout]);
      }
      for (const r of b.rooms) {
        const level = r.floorKey ? (floorIds.get(r.floorKey) ?? null) : null;
        rects.set(level, [...(rects.get(level) ?? []), r]);
      }
      for (const list of rects.values())
        if (firstOverlap(list))
          return err(409, 'conflict', 'Conflict.', 'Rooms can’t overlap.', {
            reason: 'rooms_overlap',
          });
      for (const r of b.rooms) {
        const parentId = r.floorKey ? (floorIds.get(r.floorKey) ?? null) : null;
        let rid = r.placeId;
        if (!rid) {
          const room = place({ name: r.name, parentId });
          state.inventory.places.push(room);
          rid = room.id;
          made.push(rid);
        }
        stored.rooms.set(rid, { x: r.x, z: r.z, w: r.w, d: r.d, kind: r.kind, surface: r.surface });
        out.push({ key: r.key, id: rid });
      }
      stored.version = new Date().toISOString();
      plan.status = 'applied';
      const added = out.map((r) => r.id);
      recordEvent(
        state.inventory,
        { id: state.me.user.id, displayName: state.me.user.displayName },
        {
          action: 'floor_plan.apply',
          entity: { type: 'place', id: added[0] ?? plan.locationId },
          locationId: plan.locationId,
          name: '',
          undo: () => {
            for (const rid of added) stored.rooms.delete(rid);
            const at = new Date().toISOString();
            for (const x of state.inventory.places) if (made.includes(x.id)) x.deletedAt = at;
            stored.version = new Date().toISOString();
          },
        },
      );
      return {
        version: stored.version,
        rooms: out,
        floors: [...floorIds].map(([key, id]) => ({ key, id })),
      };
    }),
  ];
}
