import { rectsOverlap } from '@kept/shared';
import { describe, expect, it } from 'vitest';
import type { MapView } from '@/api/map/types';
import {
  allUnder,
  arrowStep,
  bodyOf,
  clampIn,
  contentsOf,
  countIn,
  defaultKind,
  flagsOf,
  fp,
  hostAt,
  type Item,
  isArrow,
  moveBy,
  moveRoom,
  overlapsRoom,
  planOf,
  rehome,
  reshape,
  roomAt,
  standingOn,
  turn,
} from './layout';

const NAMES = { noFloor: 'Not on a floor', location: 'Home' };
const id = (n: number) => `01926f00-0000-7000-8000-${String(n).padStart(12, '0')}`;

const G = id(1);
const F1 = id(2);
const LIVING = id(10);
const KITCHEN = id(11);
const BED = id(12);
const GARAGE = id(13);
const SHELF = id(20);
const BOX = id(21);
const TV = id(22);
const DESK = id(23);
const LAPTOP = id(24);
const BATT = id(30);

function view(over: Partial<MapView> = {}): MapView {
  return {
    locationId: id(99),
    canArrange: true,
    version: null,
    levels: [
      { id: null, name: null },
      { id: G, name: 'Ground floor' },
      { id: F1, name: 'First floor' },
    ],
    rooms: [
      {
        id: LIVING,
        name: 'Living room',
        shortCode: null,
        levelId: G,
        kindKey: 'room',
        layout: null,
      },
      { id: KITCHEN, name: 'Kitchen', shortCode: null, levelId: G, kindKey: 'room', layout: null },
      { id: BED, name: 'Balcony', shortCode: null, levelId: F1, kindKey: 'room', layout: null },
      { id: GARAGE, name: 'Garage', shortCode: null, levelId: null, kindKey: 'room', layout: null },
    ],
    nodes: [
      node(SHELF, 'Shelf A', LIVING, 'place', { kindKey: 'zone' }),
      node(BOX, 'Games box', LIVING, 'thing', { isContainer: true }),
      node(DESK, 'Desk', LIVING, 'thing'),
    ],
    things: [
      {
        id: BATT,
        name: 'AA batteries',
        shortCode: 'BAT123',
        quantity: 4,
        parentId: BOX,
        typeKey: null,
        typeName: null,
        isContainer: false,
      },
      {
        id: TV,
        name: 'Samsung TV',
        shortCode: 'TVX123',
        quantity: 1,
        parentId: LIVING,
        typeKey: null,
        typeName: null,
        isContainer: false,
      },
      {
        id: BOX,
        name: 'Games box',
        shortCode: null,
        quantity: 1,
        parentId: LIVING,
        typeKey: 'box_bin',
        typeName: null,
        isContainer: true,
      },
      {
        id: DESK,
        name: 'Desk',
        shortCode: null,
        quantity: 1,
        parentId: LIVING,
        typeKey: null,
        typeName: null,
        isContainer: false,
      },
      {
        id: LAPTOP,
        name: 'Laptop',
        shortCode: null,
        quantity: 1,
        parentId: LIVING,
        typeKey: null,
        typeName: null,
        isContainer: false,
      },
    ],
    more: 0,
    attention: [
      {
        subjectId: BATT,
        kind: 'low',
        title: null,
        sourceType: null,
        state: null,
        dueOn: null,
        person: null,
        quantity: 4,
        min: 6,
      },
    ],
    ...over,
  };
}

function node(
  nid: string,
  name: string,
  roomId: string,
  subject: 'place' | 'thing',
  extra: Partial<MapView['nodes'][number]> = {},
): MapView['nodes'][number] {
  return {
    id: nid,
    subject,
    name,
    shortCode: null,
    roomId,
    parentId: roomId,
    kindKey: null,
    typeKey: null,
    isContainer: false,
    quantity: 1,
    layout: null,
    ...extra,
  };
}

describe('planOf (auto layout, M2)', () => {
  it('names the levels and gives each a short', () => {
    const p = planOf(view(), NAMES);
    expect(p.levels.map((l) => [l.key, l.name, l.short])).toEqual([
      ['_', 'Not on a floor', 'N'],
      [G, 'Ground floor', 'G'],
      [F1, 'First floor', 'F'],
    ]);
    // A location without floors is one level named after it.
    const one = planOf(view({ levels: [{ id: null, name: null }] }), NAMES);
    expect(one.levels[0]?.name).toBe('Home');
  });

  it('puts rooms nobody arranged side by side without overlapping, per floor', () => {
    const p = planOf(view(), NAMES);
    const ground = p.rooms.filter((r) => r.levelKey === G);
    expect(ground.map((r) => r.id)).toEqual([LIVING, KITCHEN]);
    const [a, b] = ground;
    expect(a && b && rectsOverlap(a, b)).toBe(false);
    expect(b?.x).toBeGreaterThan(a?.x ?? 0);
    // Each room fits what stands in it.
    for (const it of p.items) {
      const r = p.rooms.find((x) => x.id === it.roomId);
      const f = fp(it);
      expect(it.x + f.w, it.name).toBeLessThanOrEqual(r?.w ?? 0);
      expect(it.z + f.d, it.name).toBeLessThanOrEqual(r?.d ?? 0);
    }
  });

  it('keeps arranged rooms where they are and lays the others out past them', () => {
    const v = view();
    const living = v.rooms[0];
    if (living) living.layout = { x: 0, z: 0, w: 1000, d: 600, kind: 'garden', surface: 'grass' };
    const p = planOf(v, NAMES);
    const l = p.rooms.find((r) => r.id === LIVING);
    expect(l).toMatchObject({ x: 0, z: 0, w: 10, d: 6, kind: 'garden', surface: 'grass' });
    const k = p.rooms.find((r) => r.id === KITCHEN);
    expect(k?.x).toBeGreaterThanOrEqual(11);
  });

  it('wraps a long row of rooms', () => {
    const rooms = Array.from({ length: 12 }, (_, i) => ({
      id: id(200 + i),
      name: `Room ${i}`,
      shortCode: null,
      levelId: null,
      kindKey: 'room',
      layout: null,
    }));
    const p = planOf(
      view({ levels: [{ id: null, name: null }], rooms, nodes: [], things: [] }),
      NAMES,
    );
    expect(new Set(p.rooms.map((r) => r.z)).size).toBeGreaterThan(1);
    for (let i = 0; i < p.rooms.length; i++)
      for (let j = i + 1; j < p.rooms.length; j++) {
        const a = p.rooms[i];
        const b = p.rooms[j];
        expect(a && b && rectsOverlap(a, b)).toBe(false);
      }
  });

  it('guesses a model, and keeps an arranged one', () => {
    const v = view();
    const desk = v.nodes[2];
    if (desk) desk.layout = { x: 100, z: 100, rot: 90, model: 'workbench', hostId: null };
    const p = planOf(v, NAMES);
    expect(p.items.find((i) => i.id === SHELF)?.model).toBe('metal_shelf');
    expect(p.items.find((i) => i.id === BOX)?.model).toBe('box');
    expect(p.items.find((i) => i.id === DESK)).toMatchObject({
      model: 'workbench',
      rot: 90,
      x: 1,
      z: 1,
    });
  });

  it('marks what Kept placed by itself from room photos, for Arrange to list', () => {
    const v = view();
    const desk = v.nodes[2];
    if (desk) {
      desk.layout = { x: 100, z: 100, rot: 0, model: 'desk', hostId: null, placedByKept: true };
    }
    const p = planOf(v, NAMES);
    expect(p.items.find((i) => i.id === DESK)?.placedByKept).toBe(true);
    expect(p.items.find((i) => i.id === SHELF)?.placedByKept).toBeUndefined();
  });

  it('drops a host that is gone, can’t hold it or makes a loop', () => {
    const v = view();
    const [shelf, box, desk] = v.nodes;
    if (shelf && box && desk) {
      box.layout = { x: 0, z: 0, rot: 0, model: 'box', hostId: desk.id };
      desk.layout = { x: 0, z: 0, rot: 0, model: 'laptop', hostId: box.id };
      shelf.layout = { x: 0, z: 0, rot: 0, model: 'laptop', hostId: id(777) };
    }
    const p = planOf(v, NAMES);
    expect(p.items.find((i) => i.id === SHELF)?.on).toBeNull();
    // The desk is a laptop, which can't hold the box: the box stands on the floor; the laptop on the box.
    expect(p.items.find((i) => i.id === BOX)?.on).toBeNull();
    expect(p.items.find((i) => i.id === DESK)?.on).toBe(BOX);
  });

  it('marks the nodes that are on the map because of where they are', () => {
    const p = planOf(view(), NAMES);
    expect(p.items.find((i) => i.id === SHELF)?.auto).toBe(true);
    expect(p.items.find((i) => i.id === BOX)?.auto).toBe(true);
    expect(p.items.find((i) => i.id === DESK)?.auto).toBe(false);
  });

  it('reads garden, balcony and terrace from a room’s name', () => {
    expect(defaultKind('Back garden')).toBe('garden');
    expect(defaultKind('Balcony')).toBe('balcony');
    expect(defaultKind('Roof terrace')).toBe('terrace');
    expect(defaultKind('Kitchen')).toBe('room');
    expect(planOf(view(), NAMES).rooms.find((r) => r.id === BED)?.kind).toBe('balcony');
  });
});

describe('arranging', () => {
  const item = (over: Partial<Item>): Item => ({
    id: id(500),
    subject: 'thing',
    roomId: LIVING,
    name: 'x',
    shortCode: null,
    model: 'box',
    x: 1,
    z: 1,
    rot: 0,
    on: null,
    parentId: LIVING,
    isContainer: false,
    quantity: 1,
    auto: false,
    ...over,
  });

  it('keeps a thing inside its room', () => {
    const it = item({ x: -3, z: 50 });
    clampIn(it, { w: 4, d: 3 });
    expect(it.x).toBeCloseTo(0.12);
    expect(it.z).toBeCloseTo(3 - 0.4 - 0.08);
  });

  it('turns a thing about its middle and carries what stands on it', () => {
    const desk = item({ id: id(501), model: 'desk', x: 1, z: 1 });
    const laptop = item({ id: id(502), model: 'laptop', x: 1.5, z: 1.2, on: desk.id });
    const items = [desk, laptop];
    const rooms = planOf(view(), NAMES).rooms;
    const before = { cx: desk.x + 0.7, cz: desk.z + 0.35 };
    turn(items, rooms, desk);
    expect(desk.rot).toBe(90);
    expect(fp(desk)).toEqual({ w: 0.7, d: 1.4 });
    expect(desk.x + 0.35).toBeCloseTo(before.cx);
    expect(desk.z + 0.7).toBeCloseTo(before.cz);
    expect(laptop.rot).toBe(90);
    // #137: what stands on it keeps its place on it, turned with it (side by side stays so).
    const lc = { x: laptop.x + fp(laptop).w / 2, z: laptop.z + fp(laptop).d / 2 };
    // Before: 4.5 cm left of the desk's middle and 4 cm behind; a quarter turn sends (x, z) to
    // (−z, x).
    expect(lc.x - before.cx).toBeCloseTo(0.04);
    expect(lc.z - before.cz).toBeCloseTo(-0.045);
  });

  it('moves what stands on a thing with it', () => {
    const desk = item({ id: id(501), model: 'desk' });
    const laptop = item({ id: id(502), model: 'laptop', on: desk.id, x: 1.2 });
    const lamp = item({ id: id(503), model: 'table_lamp', on: laptop.id, x: 1.3 });
    const items = [desk, laptop, lamp];
    expect(standingOn(items, desk.id)).toEqual([laptop.id, lamp.id]);
    moveBy(items, desk, 0.5, 0.25);
    expect([desk.x, laptop.x, lamp.x]).toEqual([1.5, 1.7, 1.8]);
  });

  it('finds the room under a point, and refuses an overlapping room', () => {
    const p = planOf(view(), NAMES);
    const living = p.rooms.find((r) => r.id === LIVING);
    expect(roomAt(p.rooms, G, { x: (living?.x ?? 0) + 0.5, z: 0.5 })?.id).toBe(LIVING);
    expect(roomAt(p.rooms, F1, { x: 0.5, z: 0.5 })?.id).toBe(BED);
    expect(overlapsRoom(p.rooms, { x: 0, z: 0, w: 1, d: 1 }, null, G)).toBe(true);
    expect(overlapsRoom(p.rooms, { x: 0, z: 0, w: 1, d: 1 }, LIVING, G)).toBe(false);
    expect(overlapsRoom(p.rooms, { x: 500, z: 0, w: 1, d: 1 }, null, G)).toBe(false);
  });

  it('lets only small things stand on a counter, desk, shelf top or box', () => {
    const p = planOf(view(), NAMES);
    const box = p.items.find((i) => i.id === BOX);
    const living = p.rooms.find((r) => r.id === LIVING);
    if (!box || !living) throw new Error('fixture');
    const at = { x: living.x + box.x + 0.1, z: living.z + box.z + 0.1 };
    expect(hostAt(p, G, at, item({ model: 'laptop' }))?.id).toBe(BOX);
    expect(hostAt(p, G, at, item({ model: 'wardrobe' }))).toBeUndefined();
    // Not on itself.
    expect(hostAt(p, G, at, box)).toBeUndefined();
  });

  it('moves a thing into another room in the map’s coordinates', () => {
    const p = planOf(view(), NAMES);
    const from = p.rooms.find((r) => r.id === LIVING);
    const to = p.rooms.find((r) => r.id === KITCHEN);
    const box = p.items.find((i) => i.id === BOX);
    if (!from || !to || !box) throw new Error('fixture');
    const worldX = from.x + box.x;
    rehome(p.items, box, from, to);
    expect(box.roomId).toBe(KITCHEN);
    expect(to.x + box.x).toBeCloseTo(worldX);
  });

  it('saves whole centimetres with every floor starting at zero', () => {
    const p = planOf(view(), NAMES);
    for (const r of p.rooms) r.x -= 3;
    const body = bodyOf(p, 'v1');
    expect(body.version).toBe('v1');
    for (const r of body.rooms) {
      expect(Number.isInteger(r.x) && r.x >= 0 && r.z >= 0).toBe(true);
      expect(r.w).toBeGreaterThanOrEqual(100);
    }
    expect(
      Math.min(...body.rooms.filter((r) => r.id !== GARAGE && r.id !== BED).map((r) => r.x)),
    ).toBe(0);
    expect(body.nodes.find((n) => n.id === BOX)).toMatchObject({ model: 'box', hostId: null });
  });
});

describe('moving a room (#301)', () => {
  const plan = () => {
    const p = planOf(view(), NAMES);
    const room = (rid: string) => {
      const r = p.rooms.find((x) => x.id === rid);
      if (!r) throw new Error('fixture');
      return r;
    };
    return { p, living: room(LIVING), kitchen: room(KITCHEN), balcony: room(BED) };
  };

  it('snaps its corner to whole metres', () => {
    const { p, living } = plan();
    // The auto layout puts the living room first, at 0, and the kitchen to its right.
    expect([living.x, living.z]).toEqual([0, 0]);
    expect(moveRoom(p.rooms, living, { x: -2.4, z: 3.6 })).toBe(true);
    expect([living.x, living.z]).toEqual([-2, 4]);
    // Less than half a metre is no move at all.
    expect(moveRoom(p.rooms, living, { x: -2.3, z: 4.4 })).toBe(false);
    expect([living.x, living.z]).toEqual([-2, 4]);
  });

  it('never goes over another room on its floor, and slides along it instead', () => {
    const { p, living, kitchen } = plan();
    // Straight onto the kitchen: refused, nothing moves.
    expect(moveRoom(p.rooms, living, { x: kitchen.x, z: kitchen.z })).toBe(false);
    expect([living.x, living.z]).toEqual([0, 0]);
    // Towards it and down: it stops against the kitchen and goes down only.
    expect(moveRoom(p.rooms, living, { x: 2, z: 2 })).toBe(true);
    expect([living.x, living.z]).toEqual([0, 2]);
    expect(overlapsRoom(p.rooms, living, living.id, living.levelKey)).toBe(false);
    // Edge to edge is not overlapping.
    expect(moveRoom(p.rooms, living, { x: -1, z: 0 })).toBe(true);
    expect(moveRoom(p.rooms, living, { x: kitchen.x - living.w, z: 0 })).toBe(true);
    expect(living.x + living.w).toBe(kitchen.x);
  });

  it('stays on its floor, where rooms of other floors are no obstacle', () => {
    const { p, living, balcony } = plan();
    // The balcony (first floor) lies over the ground floor's living room: it can still move there.
    expect(rectsOverlap(balcony, living)).toBe(true);
    expect(moveRoom(p.rooms, balcony, { x: 1, z: 1 })).toBe(true);
    expect(balcony.levelKey).toBe(F1);
    expect([balcony.x, balcony.z]).toEqual([1, 1]);
  });

  it('takes what stands in it along, things on things and all', () => {
    const { p, living } = plan();
    const box = p.items.find((i) => i.id === BOX);
    if (!box) throw new Error('fixture');
    const laptop: Item = { ...box, id: LAPTOP, model: 'laptop', on: BOX, x: box.x + 0.1 };
    p.items.push(laptop);
    const inRoom = [box, laptop].map((it) => ({ x: it.x, z: it.z }));
    const onMap = () => [box, laptop].map((it) => ({ x: living.x + it.x, z: living.z + it.z }));
    const before = onMap();
    expect(moveRoom(p.rooms, living, { x: -3, z: 2 })).toBe(true);
    for (const [i, a] of onMap().entries()) {
      expect(a.x - (before[i]?.x ?? 0)).toBeCloseTo(-3);
      expect(a.z - (before[i]?.z ?? 0)).toBeCloseTo(2);
    }
    // Their places in the room are as they were: nothing to save for them but the room.
    expect([box, laptop].map((it) => ({ x: it.x, z: it.z }))).toEqual(inRoom);
    expect(laptop.on).toBe(BOX);
    const over = { x: living.x + box.x + 0.1, z: living.z + box.z + 0.1 };
    expect(hostAt(p, G, over, { ...laptop, on: null })?.id).toBe(BOX);
  });

  it('saves only the room’s new corner; every floor still starts at zero', () => {
    const { p, living, kitchen } = plan();
    const nodesBefore = bodyOf(p, null).nodes;
    const gap = kitchen.x - living.x;
    expect(moveRoom(p.rooms, living, { x: -4, z: 0 })).toBe(true);
    const body = bodyOf(p, 'v1');
    expect(body.nodes).toEqual(nodesBefore);
    const at = (rid: string) => body.rooms.find((r) => r.id === rid);
    expect(at(LIVING)).toMatchObject({ x: 0, z: 0 });
    expect(at(KITCHEN)?.x).toBe((gap + 4) * 100);
  });

  describe('a step for each arrow key', () => {
    const all = (az: number, planView = false) =>
      (['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'] as const).map((k) => {
        const s = arrowStep(k, az, planView);
        return `${s.dx},${s.dz}`;
      });

    it('goes up the screen to the back in the plan view, whatever the turn', () => {
      expect(all(0, true)).toEqual(['0,-1', '1,0', '0,1', '-1,0']);
      expect(all(2, true)).toEqual(['0,-1', '1,0', '0,1', '-1,0']);
    });

    it('goes the same ways in the usual 3D view', () => {
      expect(all(Math.PI / 4)).toEqual(['0,-1', '1,0', '0,1', '-1,0']);
    });

    it('turns with the view, a quarter at a time', () => {
      // A quarter turn left (the Turn left button): Up goes the way Left went.
      expect(all(Math.PI / 4 + Math.PI / 2)).toEqual(['-1,0', '0,-1', '1,0', '0,1']);
      expect(all(Math.PI / 4 - Math.PI / 2)).toEqual(['1,0', '0,1', '-1,0', '0,-1']);
      expect(all(Math.PI / 4 + Math.PI)).toEqual(['0,1', '-1,0', '0,-1', '1,0']);
    });

    it('always goes four different ways, at any turn', () => {
      for (let az = -7; az < 7; az += 0.137) expect(new Set(all(az)).size).toBe(4);
    });

    it('knows the arrow keys', () => {
      expect(isArrow('ArrowLeft')).toBe(true);
      expect(isArrow('Enter')).toBe(false);
      expect(isArrow('toString')).toBe(false);
    });
  });
});

describe('contents and pins', () => {
  it('counts what is in a room or node at any depth, and lifts the flags up', () => {
    const v = view();
    const c = contentsOf(v);
    expect(
      allUnder(c, LIVING)
        .map((t) => t.id)
        .sort(),
    ).toEqual([BATT, BOX, DESK, LAPTOP, TV].sort());
    expect(countIn(c, { id: BOX, subject: 'thing', isContainer: true, model: 'box' })).toBe(1);
    expect(countIn(c, { id: TV, subject: 'thing', isContainer: false, model: 'tv' })).toBeNull();
    expect(
      countIn(c, { id: SHELF, subject: 'place', isContainer: false, model: 'metal_shelf' }),
    ).toBe(0);
    expect(flagsOf(c, BOX)).toEqual(['low']);
    expect(flagsOf(c, LIVING)).toEqual(['low']);
    expect(flagsOf(c, SHELF)).toEqual([]);
  });
});

describe('sized shapes (#240, #241)', () => {
  it('saves a new grid or size as the model, and reads it back the same size', () => {
    const p = planOf(view(), NAMES);
    const shelf = p.items.find((i) => i.id === SHELF);
    const desk = p.items.find((i) => i.id === DESK);
    if (!shelf || !desk) throw new Error('fixture');
    reshape(p.items, p.rooms, shelf, 'cube_grid_4x2');
    reshape(p.items, p.rooms, desk, 'bookcase_60x30x150_4');
    expect(fp(shelf)).toEqual({ w: 1.47, d: 0.39 });
    const body = bodyOf(p, 'v1');
    const saved = (nid: string) => body.nodes.find((x) => x.id === nid);
    expect(saved(SHELF)?.model).toBe('cube_grid_4x2');
    expect(saved(DESK)?.model).toBe('bookcase_60x30x150_4');
    // The map reads the saved layout back: the same models, the same footprints.
    const layout = (nid: string) => {
      const s = saved(nid);
      if (!s) throw new Error(nid);
      return { x: s.x, z: s.z, rot: s.rot, model: s.model, hostId: s.hostId, height: null };
    };
    const back = planOf(
      view({
        nodes: view().nodes.map((x) =>
          x.id === SHELF || x.id === DESK ? { ...x, layout: layout(x.id) } : x,
        ),
      }),
      NAMES,
    );
    const again = (nid: string) => back.items.find((i) => i.id === nid);
    expect(again(SHELF)?.model).toBe('cube_grid_4x2');
    expect(fp(again(DESK) as Item)).toEqual({ w: 0.6, d: 0.3 });
  });

  it('keeps a grown shelf inside its room, and what stands on it on top', () => {
    const p = planOf(view(), NAMES);
    const room = p.rooms.find((r) => r.id === LIVING);
    const shelf = p.items.find((i) => i.id === SHELF);
    if (!room || !shelf) throw new Error('fixture');
    shelf.x = room.w - 1;
    reshape(p.items, p.rooms, shelf, 'cube_grid_8x1');
    expect(shelf.x + fp(shelf).w).toBeLessThanOrEqual(room.w);
  });
});
