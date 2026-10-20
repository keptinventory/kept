import { describe, expect, it } from 'vitest';
import type { Item, Plan, Room } from './layout';
import { cardPath } from './where';

// #161: the card's path names a holder once when a thing is kept in it and stands on it.

const ROOM: Room = {
  id: 'open',
  levelKey: '_',
  name: 'Open space',
  shortCode: null,
  kindKey: 'room',
  x: 0,
  z: 0,
  w: 8,
  d: 6,
  kind: 'room',
  surface: 'wood',
};
const item = (over: Partial<Item> & Pick<Item, 'id' | 'name'>): Item => ({
  subject: 'thing',
  roomId: ROOM.id,
  shortCode: null,
  model: 'item',
  x: 1,
  z: 1,
  rot: 0,
  on: null,
  parentId: ROOM.id,
  isContainer: false,
  quantity: 1,
  auto: false,
  ...over,
});
const plan = (items: Item[]): Plan => ({
  levels: [{ key: '_', id: null, name: 'Floor', short: 'F' }],
  rooms: [ROOM],
  items,
});
const NO_THINGS = { things: [] };

describe('cardPath', () => {
  it('names a holder once when the thing is kept in it and stands on it', () => {
    const desk = item({ id: 'desk', name: 'Desk 3', model: 'desk', isContainer: true });
    const laptop = item({
      id: 'lap',
      name: 'Laptop 03',
      model: 'laptop',
      on: 'desk',
      parentId: 'desk',
    });
    expect(cardPath(plan([desk, laptop]), NO_THINGS, laptop)).toEqual(['Open space', 'Desk 3']);
  });

  it('still names a holder it only stands on', () => {
    const desk = item({ id: 'desk', name: 'Desk 3', model: 'desk' });
    const laptop = item({ id: 'lap', name: 'Laptop 03', model: 'laptop', on: 'desk' });
    expect(cardPath(plan([desk, laptop]), NO_THINGS, laptop)).toEqual(['Open space', 'Desk 3']);
  });

  it('keeps the holders above the one it is kept in, outermost first', () => {
    const bench = item({ id: 'bench', name: 'Bench 3', model: 'workbench', isContainer: true });
    const shelf = item({ id: 'shelf', name: 'Top shelf', model: 'metal_shelf', on: 'bench' });
    const meter = item({
      id: 'ph',
      name: 'pH meter',
      on: 'shelf',
      parentId: 'bench',
    });
    expect(cardPath(plan([bench, shelf, meter]), NO_THINGS, meter)).toEqual([
      'Open space',
      'Bench 3',
      'Top shelf',
    ]);
  });

  it('keeps two different holders that share a name', () => {
    const a = item({ id: 'a', name: 'Desk', model: 'desk', isContainer: true });
    const b = item({ id: 'b', name: 'Desk', model: 'desk', x: 4 });
    const lamp = item({ id: 'lamp', name: 'Lamp', on: 'b', parentId: 'a' });
    expect(cardPath(plan([a, b, lamp]), NO_THINGS, lamp)).toEqual(['Open space', 'Desk', 'Desk']);
  });

  it('names a holder once when it is kept in a thing that is not on the map', () => {
    const desk = item({ id: 'desk', name: 'Desk 3', model: 'desk', parentId: 'drawers' });
    const pen = item({ id: 'pen', name: 'Pen', on: 'desk', parentId: 'desk' });
    const view = {
      things: [
        {
          id: 'drawers',
          name: 'Drawers',
          shortCode: null,
          quantity: 1,
          parentId: ROOM.id,
          typeKey: null,
          typeName: null,
          isContainer: true,
        },
      ],
    };
    expect(cardPath(plan([desk, pen]), view, pen)).toEqual(['Open space', 'Drawers', 'Desk 3']);
  });

  it('is the room alone for a thing standing on the floor', () => {
    const chair = item({ id: 'chair', name: 'Chair', model: 'chair' });
    expect(cardPath(plan([chair]), NO_THINGS, chair)).toEqual(['Open space']);
  });
});
