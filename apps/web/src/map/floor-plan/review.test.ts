import { draftRooms, firstOverlap, mToCm, type PlanExtraction } from '@kept/shared';
import { describe, expect, it } from 'vitest';
import type { FloorPlanView, MapView } from '@/api/map/types';
import { bodyOf, NO_FLOOR, planOf } from '../layout';
import {
  addCount,
  applyBodyOf,
  editProposal,
  fromEngine,
  moveFloor,
  newLevelKey,
  proposalRooms,
  proposedLevels,
  rescale,
  startReview,
  turnRooms,
} from './review';

// The review of a floor plan on the map (D266, spec §5.3, §7.4–7.5), pure: invented plans and
// invented maps only.

const id = (n: number) => `01926f00-0000-7000-8000-${String(n).padStart(12, '0')}`;
const G = id(1);
const F1 = id(2);
const KITCHEN = id(10);
const SHED = id(11);
const NAMES = { noFloor: 'Not on a floor', location: 'Home' };
const WORDS = { room: (n: number) => `Room ${n}`, floor: (n: number) => `Floor ${n}` };
const c = <T>(value: T, confidence = 0.9) => ({ value, confidence });

/** A plan of three rooms side by side on one floor, the first with its size printed. */
const ANSWER: PlanExtraction = {
  is_plan: true,
  floors: [{ label: c('Ground floor') }],
  rooms: [
    { name: c('Living room'), box: [0.1, 0.1, 0.4, 0.4], size_text: c('4.00 x 4.00 m') },
    { name: c('Kitchen'), box: [0.5, 0.1, 0.3, 0.4] },
    { box: [0.1, 0.5, 0.7, 0.3] },
  ],
};
const IMAGE = { w: 1000, h: 1000 };

const planView = (answer: PlanExtraction = ANSWER): FloorPlanView => ({
  id: 'plan-1',
  locationId: id(99),
  status: 'ready',
  turn: 0,
  keepPlan: false,
  createdAt: '2026-10-28T10:00:00.000Z',
  read: { status: 'succeeded', reason: null, pausedUntil: null, attempt: 1 },
  file: { id: id(98), attachmentId: id(97), mime: 'image/png' },
  image: IMAGE,
  answer,
  drafts: draftRooms(answer, IMAGE),
});

function mapView(over: Partial<MapView> = {}): MapView {
  return {
    locationId: id(99),
    canArrange: true,
    version: null,
    openPlans: [],
    levels: [{ id: null, name: null }],
    rooms: [],
    nodes: [],
    things: [],
    more: 0,
    attention: [],
    ...over,
  };
}

const room = (rid: string, name: string, levelId: string | null, layout: boolean) => ({
  id: rid,
  name,
  shortCode: null,
  levelId,
  kindKey: 'room',
  layout: layout
    ? { x: 0, z: 0, w: 400, d: 300, kind: 'room' as const, surface: 'wood' as const }
    : null,
});

describe('starting the review', () => {
  it('on an empty map: the top level, beside nothing, every room on, an unlabelled one named', () => {
    const data = mapView();
    const plan = planOf(data, NAMES);
    const r = startReview(planView(), plan, data, NO_FLOOR, WORDS);
    if (!r) throw new Error('no review');
    expect(r.floors).toEqual([{ index: 0, label: 'Ground floor', levelKey: NO_FLOOR }]);
    expect(r.proposals.map((p) => [p.name, p.on])).toEqual([
      ['Living room', true],
      ['Kitchen', true],
      ['Room 1', true],
    ]);
    expect(Math.min(...r.proposals.map((p) => p.x))).toBe(0);
    expect(addCount(r)).toBe(3);
    const rooms = proposalRooms(r);
    expect(rooms.every((x) => x.proposed && x.levelKey === NO_FLOOR)).toBe(true);
    expect(firstOverlap(rooms)).toBeNull();
    // The image lies under them.
    expect(r.underlays).toHaveLength(1);
  });

  it('beside the rooms already there, a metre clear, never over them', () => {
    const data = mapView({ rooms: [room(SHED, 'Shed', null, true)] });
    const plan = planOf(data, NAMES);
    const r = startReview(planView(), plan, data, NO_FLOOR, WORDS);
    if (!r) throw new Error('no review');
    expect(Math.min(...r.proposals.map((p) => p.x))).toBe(5);
    expect(firstOverlap([...plan.rooms, ...proposalRooms(r)])).toBeNull();
  });

  it('uses a same-name room nobody arranged, and starts one already arranged off', () => {
    const data = mapView({
      levels: [{ id: G, name: 'Ground floor' }],
      rooms: [room(KITCHEN, 'Kitchen', G, false), room(SHED, 'Living room', G, true)],
    });
    const plan = planOf(data, NAMES);
    const r = startReview(planView(), plan, data, G, WORDS);
    if (!r) throw new Error('no review');
    const kitchen = r.proposals.find((p) => p.name === 'Kitchen');
    expect(kitchen).toMatchObject({ use: KITCHEN, useName: 'Kitchen', on: true });
    const living = r.proposals.find((p) => p.name === 'Living room');
    expect(living).toMatchObject({ arranged: true, on: false, use: null });
    expect(addCount(r)).toBe(2);
    // Placed beside the arranged room; the kitchen it uses is no obstacle (it gets a rectangle).
    expect(
      firstOverlap(plan.rooms.filter((x) => x.id !== KITCHEN).concat(proposalRooms(r))),
    ).toBeNull();
  });

  it('two plan floors: by name, else a new floor', () => {
    const answer: PlanExtraction = {
      is_plan: true,
      floors: [{ label: c('Ground floor') }, { label: c('Loft') }],
      rooms: [
        { name: c('Hall'), floor: 0, box: [0.1, 0.1, 0.3, 0.3] },
        { name: c('Attic'), floor: 1, box: [0.5, 0.1, 0.3, 0.3] },
      ],
    };
    const data = mapView({
      levels: [
        { id: G, name: 'Ground floor' },
        { id: F1, name: 'First floor' },
      ],
    });
    const plan = planOf(data, NAMES);
    const r = startReview(planView(answer), plan, data, F1, WORDS);
    if (!r) throw new Error('no review');
    expect(r.floors.map((f) => f.levelKey)).toEqual([G, newLevelKey(1)]);
    expect(proposedLevels(r, WORDS, 2)).toEqual([
      { key: newLevelKey(1), id: null, name: 'Loft', short: '3' },
    ]);
  });
});

describe('changing the review', () => {
  const base = () => {
    const data = mapView();
    const plan = planOf(data, NAMES);
    const r = startReview(planView(), plan, data, NO_FLOOR, WORDS);
    if (!r) throw new Error('no review');
    return { data, plan, r };
  };

  it('a switch off takes a room out of the count and off the map', () => {
    const { r } = base();
    const off = editProposal(r, 'plan:1', { on: false });
    expect(addCount(off)).toBe(2);
    expect(proposalRooms(off).map((x) => x.id)).toEqual(['plan:0', 'plan:2']);
  });

  it('Set a room’s size rescales every room, keeping what was decided', () => {
    const { plan, r } = base();
    const named = editProposal(r, 'plan:1', { name: 'Galley', on: false });
    const before = named.proposals.find((p) => p.key === 'plan:0');
    const twice = rescale(named, plan, 'plan:0', 8, 8);
    const after = twice.proposals.find((p) => p.key === 'plan:0');
    expect(twice.drafts.scale.from).toBe('typed');
    expect(after?.w).toBeCloseTo(2 * (before?.w ?? 0), 0);
    expect(twice.proposals.find((p) => p.key === 'plan:1')).toMatchObject({
      name: 'Galley',
      on: false,
    });
    expect(firstOverlap(proposalRooms(twice))).toBeNull();
  });

  it('Turn the rooms turns the block and the image a quarter at a time', () => {
    const { plan, r } = base();
    const once = turnRooms(r, plan);
    const a = r.proposals.find((p) => p.key === 'plan:0');
    const b = once.proposals.find((p) => p.key === 'plan:0');
    expect([b?.w, b?.d]).toEqual([a?.d, a?.w]);
    expect(once.underlays[0]?.quarter).toBe(1);
    expect(firstOverlap(proposalRooms(once))).toBeNull();
    const four = turnRooms(turnRooms(turnRooms(once, plan), plan), plan);
    expect(four.proposals.map((p) => [p.x, p.z, p.w, p.d])).toEqual(
      r.proposals.map((p) => [p.x, p.z, p.w, p.d]),
    );
  });

  it('the floor picker puts a floor’s rooms on another level, beside its rooms', () => {
    const data = mapView({
      levels: [
        { id: G, name: 'Ground floor' },
        { id: F1, name: 'First floor' },
      ],
      rooms: [room(SHED, 'Shed', F1, true)],
    });
    const plan = planOf(data, NAMES);
    const r = startReview(planView(), plan, data, G, WORDS);
    if (!r) throw new Error('no review');
    const moved = moveFloor(r, plan, 0, F1);
    expect(proposalRooms(moved).every((x) => x.levelKey === F1)).toBe(true);
    expect(Math.min(...moved.proposals.map((p) => p.x))).toBe(5);
  });

  it('takes the engine’s moves back', () => {
    const { r } = base();
    const rooms = proposalRooms(r);
    const first = rooms[0];
    if (first) first.x += 0.3;
    const back = fromEngine(r, rooms);
    expect(back.proposals[0]?.x).toBeCloseTo((r.proposals[0]?.x ?? 0) + 0.3);
    expect(fromEngine(back, rooms)).toBe(back);
  });
});

describe('the Add request', () => {
  it('whole centimetres, new floors named, a used room by its id; Arrange’s Done never saves a proposal', () => {
    const data = mapView({
      levels: [{ id: G, name: 'Ground floor' }],
      rooms: [room(KITCHEN, 'Kitchen', G, false)],
    });
    const plan = planOf(data, NAMES);
    const r = startReview(planView(), plan, data, G, WORDS);
    if (!r) throw new Error('no review');
    const body = applyBodyOf(r, 'v1', true, WORDS, 1, (k) => (k === G ? 'Ground floor' : k));
    expect(body).toMatchObject({ version: 'v1', keepPlan: true });
    expect(body.floors).toEqual([{ key: `f:${G}`, id: G, name: 'Ground floor' }]);
    expect(body.rooms.find((x) => x.name === 'Kitchen')).toMatchObject({
      placeId: KITCHEN,
      floorKey: `f:${G}`,
    });
    for (const x of body.rooms) {
      for (const v of [x.x, x.z, x.w, x.d]) expect(Number.isInteger(v)).toBe(true);
      expect(x.x).toBeGreaterThanOrEqual(0);
    }
    expect(body.rooms.find((x) => x.key === 'plan:0')?.w).toBe(mToCm(r.proposals[0]?.w ?? 0));
    const withProposals = { ...plan, rooms: [...plan.rooms, ...proposalRooms(r)] };
    expect(bodyOf(withProposals, null).rooms.map((x) => x.id)).toEqual(plan.rooms.map((x) => x.id));
  });

  it('a new floor’s name is as printed, or "Floor n"; a block left of the corner moves back', () => {
    const answer: PlanExtraction = {
      is_plan: true,
      floors: [{ label: c('Ground floor') }, { label: c('First floor') }],
      rooms: [
        { name: c('Hall'), floor: 0, box: [0.1, 0.1, 0.3, 0.3] },
        { name: c('Study'), floor: 1, box: [0.5, 0.1, 0.3, 0.3] },
      ],
    };
    const data = mapView();
    const plan = planOf(data, NAMES);
    const r = startReview(planView(answer), plan, data, NO_FLOOR, WORDS);
    if (!r) throw new Error('no review');
    const left = editProposal(r, 'plan:0', { x: -2 });
    const body = applyBodyOf(left, null, false, WORDS, 0, (k) => k);
    expect(body.floors.map((f) => [f.id, f.name])).toEqual([
      [null, 'Ground floor'],
      [null, 'First floor'],
    ]);
    expect(body.rooms.find((x) => x.key === 'plan:0')?.x).toBe(0);
  });
});
