import { mapModel, seatHeight, WALL_T, wallOfTurn } from '@kept/shared';
import { describe, expect, it } from 'vitest';
import type { MapView } from '@/api/map/types';
import {
  addableOn,
  baseOf,
  bodyOf,
  centreOf,
  clampIn,
  fp,
  hangOn,
  holdersFor,
  hostAt,
  type Item,
  type Plan,
  planOf,
  putOn,
  type Room,
  reshape,
  seated,
  setHang,
  takeOff,
  thingItem,
  turn,
  wallTops,
} from './layout';

// #138: things on a wall. Dragged near a wall, a wall thing turns flat against it, at the height
// its shape starts at; Height changes that; a wall shelf, a tool wall and hooks carry things.

const id = (n: number) => `01926f00-0000-7000-8000-${String(n).padStart(12, '0')}`;
const ROOM = id(10);

const room: Room = {
  id: ROOM,
  levelKey: '_',
  name: 'Living room',
  shortCode: null,
  kindKey: 'room',
  x: 0,
  z: 0,
  w: 5,
  d: 4,
  kind: 'room',
  surface: 'wood',
};
const rooms = [room];

let n = 100;
const item = (over: Partial<Item>): Item => ({
  id: id(n++),
  subject: 'thing',
  roomId: ROOM,
  name: 'x',
  shortCode: null,
  model: 'item',
  x: 1,
  z: 1,
  rot: 0,
  on: null,
  parentId: ROOM,
  isContainer: false,
  quantity: 1,
  auto: false,
  ...over,
});

describe('snapping to a wall', () => {
  it('turns a wall TV flat against the nearest wall, at eye level', () => {
    const tv = item({ model: 'wall_tv', name: 'Living room TV', x: 2, z: 1.5, rot: 90 });
    const items = [tv];
    // Dragged to just in front of the back (−z) wall.
    hangOn(items, tv, room, { x: 2.5, z: 0.4 });
    expect(tv.rot).toBe(0);
    expect(wallOfTurn(tv.rot)).toBe('-z');
    expect(tv.z).toBeCloseTo(WALL_T);
    expect(centreOf(tv).x).toBeCloseTo(2.5, 1);
    expect(tv.hang).toBe(1.2);
    expect(tv.on).toBeNull();
  });

  it('goes to whichever wall it is dragged nearest, keeping its height', () => {
    const pic = item({ model: 'picture', name: 'Seaside print' });
    const items = [pic];
    hangOn(items, pic, room, { x: 0.3, z: 2 });
    expect(wallOfTurn(pic.rot)).toBe('-x');
    setHang(pic, 1.62);
    hangOn(items, pic, room, { x: 4.8, z: 2 });
    expect(wallOfTurn(pic.rot)).toBe('+x');
    expect(pic.x + fp(pic).w).toBeCloseTo(room.w - WALL_T);
    expect(pic.hang).toBe(1.62);
    hangOn(items, pic, room, { x: 2, z: 3.9 });
    expect(wallOfTurn(pic.rot)).toBe('+z');
    expect(pic.z + fp(pic).d).toBeCloseTo(room.d - WALL_T);
  });

  it('slides along a wall by its own step, or to the centimetre with Alt', () => {
    const shelf = item({ model: 'wall_shelf', name: 'Floating shelf' });
    const items = [shelf];
    hangOn(items, shelf, room, { x: 2.437, z: 0.2 });
    // Storage moves by 10 cm, from the wall's start.
    expect(Math.round(shelf.x * 100) % 10).toBe(0);
    hangOn(items, shelf, room, { x: 2.437, z: 0.2 }, true);
    expect(centreOf(shelf).x).toBeCloseTo(2.44, 2);
    // Never past the walls at its ends.
    hangOn(items, shelf, room, { x: 9, z: 0.2 });
    expect(shelf.x + fp(shelf).w).toBeCloseTo(room.w - WALL_T);
  });

  it('carries what is on it to the other wall, turned with it', () => {
    const shelf = item({ model: 'wall_shelf', name: 'Floating shelf' });
    const plant = item({ model: 'succulent', name: 'Small cactus' });
    const items = [shelf, plant];
    hangOn(items, shelf, room, { x: 2, z: 0.2 });
    expect(putOn(items, plant, shelf)).toBe(true);
    hangOn(items, shelf, room, { x: 4.9, z: 2 });
    expect(plant.rot).toBe(shelf.rot);
    const s = centreOf(shelf);
    const p = centreOf(plant);
    expect(Math.abs(p.x - s.x)).toBeLessThan(0.12);
    expect(Math.abs(p.z - s.z)).toBeLessThan(0.41);
  });

  it('keeps a wall thing on its wall when the room is resized, and never turns it', () => {
    const clock = item({ model: 'clock', name: 'Kitchen clock' });
    const items = [clock];
    hangOn(items, clock, room, { x: 4.9, z: 1 });
    const narrower = { ...room, w: 4 };
    clampIn(clock, narrower);
    expect(clock.x + fp(clock).w).toBeCloseTo(narrower.w - WALL_T);
    expect(wallOfTurn(clock.rot)).toBe('+x');
    const before = clock.rot;
    turn(items, rooms, clock);
    expect(clock.rot).toBe(before);
  });

  it('keeps Height between the floor and the top of the wall', () => {
    const tv = item({ model: 'wall_tv', hang: 1.2 });
    setHang(tv, 0.1);
    expect(tv.hang).toBeCloseTo(0.36);
    setHang(tv, 9);
    expect(tv.hang).toBeCloseTo(2.65);
    setHang(tv, 1.234);
    expect(tv.hang).toBe(1.23);
  });
});

describe('changing a shape', () => {
  it('hangs a thing given a wall shape, and stands it on the floor again given another', () => {
    const desk = item({ model: 'desk', name: 'Corner desk', x: 1, z: 1 });
    const it = item({ model: 'item', name: 'Mirror' });
    const items = [desk, it];
    putOn(items, it, desk);
    reshape(items, rooms, it, 'picture');
    expect(it.on).toBeNull();
    expect(it.hang).toBe(1.5);
    expect(wallOfTurn(it.rot)).toBeTruthy();
    // Another wall shape starts at its own height.
    setHang(it, 1.1);
    reshape(items, rooms, it, 'clock');
    expect(it.hang).toBe(1.8);
    reshape(items, rooms, it, 'lamp');
    expect(it.hang).toBeUndefined();
    expect(it.x).toBeGreaterThanOrEqual(0.12);
    expect(it.z).toBeGreaterThanOrEqual(0.12);
  });

  it('puts what a holder can no longer carry on the floor', () => {
    const shelf = item({ model: 'wall_shelf', name: 'Floating shelf' });
    const cactus = item({ model: 'succulent', name: 'Small cactus' });
    const items = [shelf, cactus];
    hangOn(items, shelf, room, { x: 2, z: 0.2 });
    putOn(items, cactus, shelf);
    reshape(items, rooms, shelf, 'picture');
    expect(cactus.on).toBeNull();
    expect(baseOf(items, cactus)).toBe(0);
  });
});

describe('heights', () => {
  it('hangs a TV above a TV stand, a webcam on its edge, a plant on a shelf, a drill on a tool wall', () => {
    const stand = item({ model: 'tv_stand', name: 'TV stand', x: 1, z: 0.12 });
    const tv = item({ model: 'wall_tv', name: 'TV' });
    const cam = item({ model: 'webcam', name: 'HD webcam' });
    const shelf = item({ model: 'wall_shelf', name: 'Floating shelf' });
    const plant = item({ model: 'succulent', name: 'Small cactus' });
    const board = item({ model: 'tool_wall', name: 'Tool wall' });
    const drill = item({ model: 'drill', name: 'Cordless drill' });
    const items = [stand, tv, cam, shelf, plant, board, drill];
    hangOn(items, tv, room, centreOf(stand));
    hangOn(items, shelf, room, { x: 0.2, z: 2 });
    hangOn(items, board, room, { x: 4.9, z: 2 });
    expect(putOn(items, cam, tv)).toBe(true);
    expect(putOn(items, plant, shelf)).toBe(true);
    expect(putOn(items, drill, board)).toBe(true);

    const tvm = mapModel('wall_tv');
    expect(baseOf(items, stand)).toBe(0);
    expect(baseOf(items, tv)).toBeCloseTo(1.2 - (tvm.h ?? 0) / 2);
    // Above the stand, with room to spare.
    expect(baseOf(items, tv)).toBeGreaterThan(seatHeight('tv_stand') + 0.1);
    expect(baseOf(items, cam)).toBeCloseTo(baseOf(items, tv) + (tvm.h ?? 0));
    expect(baseOf(items, plant)).toBeCloseTo(1.5 - 0.02 + 0.04);
    // Hung from the hooks: its top at the hook line, 5 cm under the board's top.
    const top = baseOf(items, drill) + (mapModel('drill').h ?? 0);
    expect(top).toBeCloseTo(baseOf(items, board) + 0.55);
    // A thing on hooks hangs in front of the board, facing its way, and turns with it only.
    expect(drill.rot).toBe(board.rot);
    expect(seated(items, drill)).toBe(true);
    expect(centreOf(drill).x).toBeLessThan(board.x);
    // Raised, it goes up with the board.
    setHang(board, 1.5);
    expect(baseOf(items, drill) + (mapModel('drill').h ?? 0)).toBeCloseTo(1.5 - 0.3 + 0.55);
  });

  it('tells the walls how tall to stand for what hangs on them', () => {
    const tv = item({ model: 'wall_tv' });
    const clock = item({ model: 'clock' });
    const lamp = item({ model: 'lamp' });
    const items = [tv, clock, lamp];
    hangOn(items, tv, room, { x: 2, z: 0.2 });
    hangOn(items, clock, room, { x: 4.9, z: 2 });
    const tops = wallTops(items, ROOM);
    expect(tops.get('-z')).toBeCloseTo(1.2 + 0.355);
    expect(tops.get('+x')).toBeCloseTo(1.8 + 0.15);
    expect(tops.has('-x')).toBe(false);
    expect(tops.has('+z')).toBe(false);
  });
});

describe('Put on… and Add on it for wall holders', () => {
  it('lists the tool wall and the hooks for a drill, and a shelf for a small plant only', () => {
    const board = item({ model: 'tool_wall', name: 'Tool wall' });
    const hooks = item({ model: 'hooks', name: 'Coat hooks' });
    const shelf = item({ model: 'wall_shelf', name: 'Floating shelf' });
    const drill = item({ model: 'drill', name: 'Cordless drill' });
    const cactus = item({ model: 'succulent', name: 'Small cactus' });
    const fig = item({ model: 'plant', name: 'Big plant' });
    const tv = item({ model: 'wall_tv', name: 'TV' });
    const items = [board, hooks, shelf, drill, cactus, fig, tv];
    for (const h of [board, hooks, shelf]) hangOn(items, h, room, { x: 2, z: 0.2 });
    // (A drill is small and shallow enough for a screen's top edge too, as on any TV: #137.)
    expect(holdersFor(items, drill).map((h) => h.name)).toEqual([
      'Coat hooks',
      'Floating shelf',
      'Tool wall',
      'TV',
    ]);
    expect(addableOn(items, shelf).map((c) => c.name)).toEqual(['Cordless drill', 'Small cactus']);
    expect(addableOn(items, board).map((c) => c.name)).toContain('Cordless drill');
    expect(addableOn(items, board).map((c) => c.name)).not.toContain('Big plant');
    // A wall thing is on no holder's list.
    for (const h of [board, hooks, shelf]) expect(addableOn(items, h)).not.toContain(tv);
    expect(holdersFor(items, tv)).toEqual([]);
  });

  it('takes a drill off the tool wall onto the floor under it', () => {
    const board = item({ model: 'tool_wall', name: 'Tool wall' });
    const drill = item({ model: 'drill', name: 'Cordless drill' });
    const items = [board, drill];
    hangOn(items, board, room, { x: 2.5, z: 0.2 });
    putOn(items, drill, board);
    takeOff(items, rooms, drill);
    expect(drill.on).toBeNull();
    expect(drill.hang).toBeUndefined();
    expect(baseOf(items, drill)).toBe(0);
    expect(drill.z).toBeGreaterThanOrEqual(0.12);
  });

  it('finds a wall holder from a point just in front of it, as a drag does', () => {
    const board = item({ model: 'tool_wall', name: 'Tool wall' });
    const drill = item({ model: 'drill', name: 'Cordless drill', x: 3, z: 3 });
    const plan: Plan = { levels: [], rooms, items: [board, drill] };
    hangOn(plan.items, board, room, { x: 2.5, z: 0.2 });
    // 25 cm out from the board, in front of its middle.
    expect(hostAt(plan, '_', { x: 2.5, z: WALL_T + 0.25 }, drill)?.id).toBe(board.id);
    expect(hostAt(plan, '_', { x: 2.5, z: 1.5 }, drill)).toBeUndefined();
  });
});

describe('the saved layout', () => {
  const nodeView = (
    nid: string,
    model: string,
    layout: Partial<NonNullable<MapView['nodes'][number]['layout']>> | null,
  ): MapView['nodes'][number] => ({
    id: nid,
    subject: 'thing',
    name: model,
    shortCode: null,
    roomId: ROOM,
    parentId: ROOM,
    kindKey: null,
    typeKey: null,
    isContainer: false,
    quantity: 1,
    layout: layout ? { x: 0, z: 0, rot: 0, model, hostId: null, height: null, ...layout } : null,
  });
  const view = (nodes: MapView['nodes']): MapView => ({
    locationId: id(99),
    canArrange: true,
    version: null,
    levels: [{ id: null, name: null }],
    rooms: [
      {
        id: ROOM,
        name: 'Living room',
        shortCode: null,
        levelId: null,
        kindKey: 'room',
        layout: { x: 0, z: 0, w: 500, d: 400, kind: 'room', surface: 'wood' },
      },
    ],
    nodes,
    things: [],
    more: 0,
    attention: [],
  });
  const NAMES = { noFloor: 'Not on a floor', location: 'Home' };

  it('hangs an older map’s tool wall on its nearest wall, at its starting height', () => {
    // Saved before #138: no height, standing in the room, unturned.
    const old = nodeView(id(1), 'tool_wall', { x: 450, z: 200 });
    delete (old.layout as { height?: unknown }).height;
    const p = planOf(view([old]), NAMES);
    const board = p.items[0] as Item;
    expect(wallOfTurn(board.rot)).toBe('+x');
    expect(board.hang).toBe(1.3);
    expect(board.x + fp(board).w).toBeCloseTo(5 - WALL_T);
  });

  it('reads a height back, sends it in centimetres, and nothing for what stands', () => {
    const p = planOf(
      view([
        nodeView(id(1), 'wall_tv', { x: 200, z: 10, rot: 0, height: 125 }),
        nodeView(id(2), 'tv_stand', { x: 180, z: 12 }),
        nodeView(id(3), 'webcam', { x: 250, z: 12, hostId: id(1) }),
      ]),
      NAMES,
    );
    const tv = p.items.find((i) => i.id === id(1)) as Item;
    expect(tv.hang).toBe(1.25);
    expect(p.items.find((i) => i.id === id(3))?.on).toBe(id(1));
    const body = bodyOf(p, null);
    const byId = new Map(body.nodes.map((x) => [x.id, x]));
    expect(byId.get(id(1))).toMatchObject({ x: 200, z: 10, rot: 0, height: 125 });
    expect(byId.get(id(2))?.height).toBeNull();
    expect(byId.get(id(3))?.height).toBeNull();
    // And back again, unchanged.
    const again = planOf(
      view(
        body.nodes.map((x) =>
          nodeView(x.id, x.model, {
            x: x.x,
            z: x.z,
            rot: x.rot,
            hostId: x.hostId,
            height: x.height,
          }),
        ),
      ),
      NAMES,
    );
    expect(bodyOf(again, null).nodes).toEqual(body.nodes);
  });

  it('puts a thing given a wall shape on a wall as it goes on the map', () => {
    const it = thingItem(
      {
        id: id(7),
        name: 'Hall mirror',
        shortCode: null,
        quantity: 1,
        parentId: ROOM,
        typeKey: null,
        typeName: null,
        isContainer: false,
      },
      room,
    );
    expect(it.model).toBe('picture');
    expect(it.hang).toBe(1.5);
    expect(it.z).toBeCloseTo(WALL_T);
  });
});
