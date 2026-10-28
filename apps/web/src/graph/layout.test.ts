/**
 * The graph's pure parts (#207): the tree from the server's read (kinds, counts past the cap,
 * pins summed up the tree), the 2D focus rings (deterministic positions, sizes, the outer ring
 * and the "N more" fold), the 3D world and its projection (deterministic, depth order), and the
 * labels' declutter.
 */
import { describe, expect, it } from 'vitest';
import type { GraphView } from '@/api/graph/types';
import { declutter, labelSize } from './declutter';
import { layout2D, RING1_MAX, RING2_MAX, sizeOf, WORLD } from './layout2d';
import {
  type Camera,
  depthOpacity,
  LAYER_GAP,
  paintOrder,
  project,
  START,
  world3D,
} from './layout3d';
import { buildTree, chainOf, kidsAt, placeOf, taggedIn } from './tree';

const LOC = { id: 'loc', name: 'Home' };

type P = GraphView['places'][number];
type T = GraphView['things'][number];
const place = (id: string, parentId: string | null, name: string, kindKey = 'room'): P => ({
  id,
  parentId,
  name,
  kindKey,
  shortCode: null,
  isUnplaced: false,
});
const thing = (
  id: string,
  where: { placeId?: string; containerId?: string },
  extra: Partial<T> = {},
): T => ({
  id,
  name: id,
  shortCode: null,
  placeId: where.placeId ?? null,
  containerId: where.containerId ?? null,
  isContainer: false,
  typeKey: null,
  typeName: null,
  tagIds: [],
  ...extra,
});

/** The design's house: two floors and an attic, rooms, a spot, boxes and things. */
function house(): GraphView {
  const things: T[] = [
    thing('box01', { placeId: 'garage' }, { isContainer: true, typeKey: 'box_bin' }),
    thing('box02', { placeId: 'garage' }, { isContainer: true, typeKey: 'box_bin' }),
    thing('lights', { containerId: 'box01' }, { tagIds: ['xmas'] }),
    thing('stand', { containerId: 'box01' }, { tagIds: ['xmas'] }),
    thing('stove', { containerId: 'box02' }, { tagIds: ['camping'] }),
    thing('lantern', { containerId: 'box02' }, { tagIds: ['camping'] }),
    thing('drill', { placeId: 'shelf' }),
    thing('bike', { placeId: 'garage' }),
    thing('rice', { placeId: 'pantry' }),
    thing('coffee', { placeId: 'pantry' }),
    thing('tv', { placeId: 'living' }),
    thing('desk', { placeId: 'office' }),
    thing('tent', { placeId: 'bedroom' }, { tagIds: ['camping'] }),
    thing('books', { placeId: 'attic' }),
  ];
  const counts = new Map<string, number>();
  for (const t of things) {
    const h = (t.containerId ?? t.placeId) as string;
    counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  return {
    locationId: LOC.id,
    places: [
      place('gf', null, 'Ground floor', 'floor'),
      place('ff', null, 'First floor', 'floor'),
      place('attic', null, 'Attic', 'floor'),
      place('kitchen', 'gf', 'Kitchen'),
      place('pantry', 'kitchen', 'Pantry', 'closet'),
      place('living', 'gf', 'Living room'),
      place('garage', 'gf', 'Garage'),
      place('shelf', 'garage', 'Tool shelf', 'zone'),
      place('office', 'ff', 'Office'),
      place('bedroom', 'ff', 'Bedroom'),
    ],
    things,
    counts: [...counts].map(([holderId, n]) => ({ holderId, things: n })),
    more: 0,
    attention: [
      { subjectId: 'coffee', holderId: 'pantry', kind: 'low' },
      { subjectId: 'drill', holderId: 'shelf', kind: 'lent' },
      { subjectId: 'drill', holderId: 'shelf', kind: 'lent' },
      { subjectId: 'bike', holderId: 'garage', kind: 'due' },
      // A thing past the cap: its pin shows on what holds it.
      { subjectId: 'not-drawn', holderId: 'office', kind: 'due' },
    ],
    tags: [
      { id: 'camping', name: 'Camping', colour: '#30A46C' },
      { id: 'xmas', name: 'Christmas', colour: '#E5484D' },
    ],
  };
}

describe('buildTree', () => {
  it('gives each node its kind, from floors down to things', () => {
    const t = buildTree(house(), LOC);
    const kind = (id: string) => t.byId.get(id)?.kind;
    expect(kind('loc')).toBe('location');
    expect(kind('gf')).toBe('floor');
    expect(kind('kitchen')).toBe('room');
    expect(kind('pantry')).toBe('spot');
    expect(kind('box01')).toBe('box');
    expect(kind('lights')).toBe('thing');
    expect(t.floors.map((f) => f.id)).toEqual(['gf', 'ff', 'attic']);
    expect(t.byId.get('lights')?.floorId).toBe('gf');
    expect(chainOf(t.byId.get('lights') as never).map((n) => n.id)).toEqual([
      'loc',
      'gf',
      'garage',
      'box01',
      'lights',
    ]);
  });

  it('counts the things inside each node, boxes included, and those past the cap', () => {
    const view = house();
    // The server counted 40 more books in the attic than it sent.
    view.counts = view.counts.map((c) => (c.holderId === 'attic' ? { ...c, things: 41 } : c));
    const t = buildTree(view, LOC);
    expect(t.byId.get('box01')?.things).toBe(2);
    // Garage: two boxes, the bike, the drill on the shelf, and four things in the boxes.
    expect(t.byId.get('garage')?.things).toBe(8);
    expect(t.byId.get('attic')?.things).toBe(41);
    expect(t.root.things).toBe(14 - 1 + 41);
  });

  it('sums the pins up the tree, once per thing and kind', () => {
    const t = buildTree(house(), LOC);
    expect(t.byId.get('drill')?.own).toEqual(['lent']);
    expect(t.byId.get('garage')?.flags).toEqual({ low: 0, lent: 1, due: 1 });
    expect(t.byId.get('office')?.flags.due).toBe(1);
    expect(t.root.flags).toEqual({ low: 1, lent: 1, due: 2 });
  });

  it('keeps places first, then boxes, then things; filters by depth', () => {
    const t = buildTree(house(), LOC);
    const garage = t.byId.get('garage') as never;
    expect(kidsAt(garage, 'all').map((n) => n.id)).toEqual(['shelf', 'box01', 'box02', 'bike']);
    expect(kidsAt(garage, 'boxes').map((n) => n.id)).toEqual(['shelf', 'box01', 'box02']);
    expect(kidsAt(garage, 'rooms').map((n) => n.id)).toEqual(['shelf']);
    expect(taggedIn(t.root, 'camping').map((n) => n.id)).toEqual(['stove', 'lantern', 'tent']);
    expect(placeOf(t.byId.get('lights') as never)?.id).toBe('garage');
  });
});

describe('layout2D', () => {
  const tree = buildTree(house(), LOC);
  const at = (l: ReturnType<typeof layout2D>, id: string) => l.placed.find((p) => p.id === id);

  it('is deterministic: the same focus gives the same positions', () => {
    const a = layout2D({ focus: tree.root, selected: null, depth: 'all', tags: null });
    const b = layout2D({ focus: tree.root, selected: null, depth: 'all', tags: null });
    expect(a).toEqual(b);
    const focus = at(a, 'loc');
    expect(focus).toMatchObject({ x: WORLD.w / 2, y: WORLD.h / 2, ring: 0 });
    // The first child's arc starts at the top and the ring goes round clockwise: the ground
    // floor (three of the six nodes on the outer ring) has the right half.
    const gf = at(a, 'gf');
    expect(gf).toMatchObject({ ring: 1 });
    expect(gf?.x).toBeGreaterThan(WORLD.w / 2);
    expect(gf?.y).toBeCloseTo(WORLD.h / 2, 5);
  });

  it('draws the level below on an outer ring when it fits, folded nodes counting', () => {
    const l = layout2D({ focus: tree.root, selected: null, depth: 'all', tags: null });
    expect(l.ring2).toBe(true);
    expect(at(l, 'kitchen')).toMatchObject({ ring: 2 });
    const kitchen = at(l, 'kitchen');
    expect(kitchen?.type === 'node' && kitchen.folded).toBe(true);
    // Three levels down isn't drawn.
    expect(at(l, 'pantry')).toBeUndefined();
  });

  it('sizes nodes by what is inside', () => {
    const garage = tree.byId.get('garage') as never;
    const office = tree.byId.get('office') as never;
    expect(sizeOf(garage, false)).toBeGreaterThan(sizeOf(office, false));
    expect(sizeOf(tree.byId.get('tv') as never, false)).toBe(24);
    expect(sizeOf(office, true)).toBe(62);
    expect(sizeOf(tree.root, false)).toBeLessThanOrEqual(68);
  });

  it('drops the outer ring when the level below is too big, and folds a crowded ring', () => {
    const view = house();
    for (let i = 0; i < RING2_MAX + 5; i++) view.things.push(thing(`t${i}`, { placeId: 'living' }));
    for (let i = 0; i < RING1_MAX + 3; i++)
      view.things.push(thing(`k${i}`, { placeId: 'kitchen' }));
    const t = buildTree(view, LOC);
    const gf = t.byId.get('gf') as never;
    const l = layout2D({ focus: gf, selected: null, depth: 'all', tags: null });
    expect(l.ring2).toBe(false);
    const kitchen = t.byId.get('kitchen') as never;
    const k = layout2D({ focus: kitchen, selected: null, depth: 'all', tags: null });
    const more = k.placed.find((p) => p.type === 'more');
    expect(more).toMatchObject({ type: 'more', ring: 1 });
    // The pantry, the rice and coffee are in it, the 27 new things beyond: 24 shown with the fold.
    expect(k.placed.filter((p) => 'ring' in p && p.ring === 1)).toHaveLength(RING1_MAX);
  });

  it('links each tag to the nearest drawn node of its things, in the tag colour', () => {
    const l = layout2D({ focus: tree.root, selected: null, depth: 'all', tags: tree.tags });
    const tagEdges = l.edges.filter((e) => e.kind === 'tag');
    expect(tagEdges).toContainEqual(
      expect.objectContaining({ from: 'tag:camping', to: 'garage', tagColour: '#30A46C' }),
    );
    expect(tagEdges).toContainEqual(
      expect.objectContaining({ from: 'tag:camping', to: 'bedroom' }),
    );
    expect(l.placed.filter((p) => p.type === 'tag')).toHaveLength(2);
  });

  it('draws the way to the picked node stronger', () => {
    const lights = tree.byId.get('garage') ?? null;
    const l = layout2D({ focus: tree.root, selected: lights, depth: 'all', tags: null });
    expect(l.edges.filter((e) => e.onPath).map((e) => e.to)).toEqual(['gf', 'garage']);
  });
});

describe('world3D and project', () => {
  const tree = buildTree(house(), LOC);
  const cam: Camera = { ...START, target: { x: 0, y: 0, z: 0 }, scale: 1, cx: 400, cy: 300 };

  it('puts each floor on its own layer, the location above, rooms on a ring', () => {
    const w = world3D(tree);
    expect(w.layers.map((l) => l.floor?.id)).toEqual(['gf', 'ff', 'attic']);
    expect(w.layers.map((l) => l.y)).toEqual([-LAYER_GAP, 0, LAYER_GAP]);
    expect((w.pos.get('loc')?.y ?? 0) > LAYER_GAP).toBe(true);
    const k = w.pos.get('kitchen');
    expect(k?.y).toBe(-LAYER_GAP);
    expect(Math.hypot(k?.x ?? 0, k?.z ?? 0)).toBeCloseTo(150, 5);
    expect(world3D(tree)).toEqual(w);
  });

  it('works with one layer for a location with no floors', () => {
    const view = house();
    view.places = view.places
      .filter((p) => p.kindKey !== 'floor')
      .map((p) =>
        ['gf', 'ff', 'attic'].includes(p.parentId ?? '') ? { ...p, parentId: null } : p,
      );
    view.things = view.things.filter((t) => t.placeId !== 'attic');
    const w = world3D(buildTree(view, LOC));
    expect(w.layers).toEqual([{ floor: null, y: 0 }]);
    expect(w.pos.get('kitchen')?.y).toBe(0);
  });

  it('projects deterministically and paints the farthest first', () => {
    const w = world3D(tree);
    const P = new Map([...w.pos].map(([id, p]) => [id, project(p, cam)]));
    expect(project(w.pos.get('garage') as never, cam)).toEqual(P.get('garage'));
    const order = paintOrder(P);
    const z = order.map((id) => P.get(id)?.z ?? 0);
    expect([...z].sort((a, b) => a - b)).toEqual(z);
    // Nearer is bigger and less faded.
    const near = P.get(order[order.length - 1] as string);
    const far = P.get(order[0] as string);
    expect((near?.f ?? 0) > (far?.f ?? 0)).toBe(true);
    expect(depthOpacity(near?.z ?? 0)).toBeGreaterThanOrEqual(depthOpacity(far?.z ?? 0));
  });

  it('turns: a quarter turn moves a node round the target', () => {
    const p = { x: 100, y: 0, z: 0 };
    const a = project(p, { ...cam, yaw: 0, pitch: 0 });
    const b = project(p, { ...cam, yaw: Math.PI / 2, pitch: 0 });
    expect(a.x).toBeCloseTo(500, 5);
    expect(b.x).toBeCloseTo(400, 5);
  });

  it('floats each tag beyond the middle of its things', () => {
    const w = world3D(tree, tree.tags);
    const camping = w.tags.find((g) => g.tag.id === 'camping');
    expect(camping?.ids).toEqual(['stove', 'lantern', 'tent']);
    expect(Math.hypot(camping?.pos.x ?? 0, camping?.pos.z ?? 0)).toBeCloseTo(380, 5);
  });
});

describe('declutter', () => {
  it('keeps the most important label and drops one that would overlap it', () => {
    const a = { id: 'a', x: 10, y: 10, w: 60, h: 18, priority: 1 };
    const b = { id: 'b', x: 30, y: 15, w: 60, h: 18, priority: 0 };
    const c = { id: 'c', x: 200, y: 10, w: 60, h: 18, priority: 2 };
    expect([...declutter([a, b, c], { w: 400, h: 300 })].sort()).toEqual(['b', 'c']);
  });

  it('never shows a label that would be cut off at the edge', () => {
    const edge = { id: 'edge', x: 360, y: 10, w: 60, h: 18, priority: 0 };
    expect(declutter([edge], { w: 400, h: 300 }).size).toBe(0);
  });

  it('wraps a long name rather than growing past the widest label', () => {
    const long = labelSize('A very long name for a cupboard in the hallway', 12.5);
    expect(long.w).toBeLessThanOrEqual(150);
    expect(long.h).toBeGreaterThan(labelSize('Desk', 12.5).h);
  });
});
