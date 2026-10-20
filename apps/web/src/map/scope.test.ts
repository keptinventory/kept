import { describe, expect, it } from 'vitest';
import type { MapNodeView, MapView } from '@/api/map/types';
import { scopeOn } from './scope';

// Where a place's page opens the map: its floor, its room, its node, or the room it is in.

const id = (n: number) => `01926f00-0000-7000-8000-${String(n).padStart(12, '0')}`;
const GROUND = id(1);
const UPSTAIRS = id(2);
const STUDY = id(10);
const HALL = id(11);
const PORCH = id(12);
const BOOKCASE = id(20);
const TOP_SHELF = id(21);
const CORNER = id(22);
const PANTRY = id(30);

const node = (over: Partial<MapNodeView>): MapNodeView => ({
  id: id(99),
  subject: 'place',
  name: 'x',
  shortCode: null,
  roomId: STUDY,
  parentId: STUDY,
  kindKey: 'zone',
  typeKey: null,
  isContainer: false,
  quantity: 1,
  layout: null,
  ...over,
});

function view(floors = true): MapView {
  return {
    locationId: id(100),
    canArrange: true,
    version: null,
    levels: floors
      ? [
          { id: null, name: null },
          { id: GROUND, name: 'Ground floor' },
          { id: UPSTAIRS, name: 'Upstairs' },
        ]
      : [{ id: null, name: null }],
    rooms: [
      {
        id: STUDY,
        name: 'Study',
        shortCode: null,
        levelId: floors ? UPSTAIRS : null,
        kindKey: 'room',
        layout: null,
      },
      {
        id: HALL,
        name: 'Hall',
        shortCode: null,
        levelId: floors ? GROUND : null,
        kindKey: 'room',
        layout: null,
      },
      { id: PORCH, name: 'Porch', shortCode: null, levelId: null, kindKey: 'room', layout: null },
    ],
    nodes: [node({ id: BOOKCASE, name: 'Bookcase' })],
    things: [],
    more: 0,
    attention: [],
  };
}

describe('scopeOn', () => {
  it('opens a floor on that floor', () => {
    expect(scopeOn(view(), { placeId: UPSTAIRS, path: [UPSTAIRS] })).toEqual({
      at: 'floor',
      levelKey: UPSTAIRS,
    });
  });

  it('focuses a room on its floor', () => {
    expect(scopeOn(view(), { placeId: STUDY, path: [UPSTAIRS, STUDY] })).toEqual({
      at: 'room',
      levelKey: UPSTAIRS,
      roomId: STUDY,
      noFloor: false,
    });
  });

  it('opens a place drawn on the map in its room, that node selected', () => {
    expect(scopeOn(view(), { placeId: BOOKCASE, path: [UPSTAIRS, STUDY, BOOKCASE] })).toEqual({
      at: 'node',
      levelKey: UPSTAIRS,
      roomId: STUDY,
      nodeId: BOOKCASE,
      noFloor: false,
    });
  });

  it('opens a place not drawn on the map in its room, on the nearest node that holds it', () => {
    expect(
      scopeOn(view(), { placeId: TOP_SHELF, path: [UPSTAIRS, STUDY, BOOKCASE, TOP_SHELF] }),
    ).toEqual({
      at: 'inside',
      levelKey: UPSTAIRS,
      roomId: STUDY,
      holderId: BOOKCASE,
      noFloor: false,
    });
  });

  it('opens a place in a room with no drawn holder on the room itself', () => {
    // A place deeper in the room whose own parent isn't on the map either.
    const v = view();
    v.nodes = [];
    expect(scopeOn(v, { placeId: CORNER, path: [GROUND, HALL, CORNER] })).toEqual({
      at: 'inside',
      levelKey: GROUND,
      roomId: HALL,
      holderId: null,
      noFloor: false,
    });
  });

  it('says when a room is on no floor while the location has floors', () => {
    expect(scopeOn(view(), { placeId: PORCH, path: [PORCH] })).toEqual({
      at: 'room',
      levelKey: '_',
      roomId: PORCH,
      noFloor: true,
    });
  });

  it('never calls a room "on no floor" in a location without floors', () => {
    expect(scopeOn(view(false), { placeId: STUDY, path: [STUDY] })).toEqual({
      at: 'room',
      levelKey: '_',
      roomId: STUDY,
      noFloor: false,
    });
  });

  it('is off the map for a place the map does not have', () => {
    expect(scopeOn(view(), { placeId: PANTRY, path: [PANTRY] })).toEqual({ at: 'off' });
  });

  it('is off the map for a place whose ancestors are not on it either', () => {
    expect(scopeOn(view(), { placeId: TOP_SHELF, path: [PANTRY, TOP_SHELF] })).toEqual({
      at: 'off',
    });
  });
});
