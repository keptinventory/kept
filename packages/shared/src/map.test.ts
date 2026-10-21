import { describe, expect, it } from 'vitest';
import {
  canBeCarried,
  canCarry,
  canHost,
  canStandOn,
  capacityOf,
  carryOf,
  EDGE_FIT,
  firstOverlap,
  fitsOn,
  footprintOf,
  guessModel,
  HANG_TOP,
  hangRange,
  isMapModel,
  isWallModel,
  levelShort,
  MAP_MODEL_KEYS,
  MAP_MODELS,
  MAP_ROOM_KINDS,
  mapModel,
  mToCm,
  nearestWall,
  offWall,
  ROOM_KIND_SURFACE,
  rectsOverlap,
  seatFor,
  seatHeight,
  snapStep,
  turnOffset,
  turnOfWall,
  unturnOffset,
  WALL_MODELS,
  WALL_T,
  wallOfTurn,
  wallSpot,
} from './map.js';

describe('the map catalogue', () => {
  it('gives every model a positive footprint', () => {
    for (const key of MAP_MODEL_KEYS) {
      const m = MAP_MODELS[key];
      expect(m.w, key).toBeGreaterThan(0);
      expect(m.d, key).toBeGreaterThan(0);
    }
  });

  it('gives every room kind a floor', () => {
    for (const k of MAP_ROOM_KINDS) expect(ROOM_KIND_SURFACE[k]).toBeTruthy();
  });

  it('knows its own keys and nothing else', () => {
    expect(isMapModel('sofa')).toBe(true);
    expect(isMapModel('toString')).toBe(false);
    expect(isMapModel('spaceship')).toBe(false);
    expect(isMapModel(3)).toBe(false);
  });

  it('swaps width and depth on a quarter turn only', () => {
    expect(footprintOf('car', 0)).toEqual({ w: 1.78, d: 4.6 });
    expect(footprintOf('car', 90)).toEqual({ w: 4.6, d: 1.78 });
    expect(footprintOf('car', 180)).toEqual({ w: 1.78, d: 4.6 });
    expect(footprintOf('car', 270)).toEqual({ w: 4.6, d: 1.78 });
  });

  it('lets small things stand on counters, desks and boxes', () => {
    expect(canHost('counter')).toBe(true);
    expect(canHost('desk')).toBe(true);
    expect(canHost('sofa')).toBe(false);
    expect(canStandOn('laptop')).toBe(true);
    expect(canStandOn('cardboard')).toBe(true);
    expect(canStandOn('wardrobe')).toBe(false);
  });
});

describe('holders (#137)', () => {
  it('carries on a top, on a screen’s edge or on an arm', () => {
    expect(carryOf('desk')).toBe('top');
    expect(carryOf('cardboard')).toBe('top');
    expect(carryOf('monitor')).toBe('edge');
    expect(carryOf('tv')).toBe('edge');
    expect(carryOf('laptop')).toBe('edge');
    expect(carryOf('monitor_arm')).toBe('arm');
    expect(carryOf('dual_monitor_arm')).toBe('arm');
    expect(carryOf('sofa')).toBeNull();
    expect(carryOf('webcam')).toBeNull();
  });

  it('clips only small, shallow, low things onto an edge', () => {
    for (const k of ['webcam', 'smart_speaker', 'external_drive', 'earbuds'] as const)
      expect(canCarry('monitor', k), k).toBe(true);
    // Too deep, too tall, too big, or a holder itself.
    for (const k of ['speaker', 'phone', 'pc_tower', 'monitor_arm', 'laptop', 'box'] as const)
      expect(canCarry('monitor', k), k).toBe(false);
    // Wider than the screen: a soundbar fits a TV's edge, not a monitor's.
    expect(canCarry('tv', 'soundbar')).toBe(true);
    expect(canCarry('monitor', 'soundbar')).toBe(false);
    for (const k of ['webcam', 'smart_speaker'] as const) {
      const m = mapModel(k);
      expect(m.d).toBeLessThanOrEqual(EDGE_FIT.d);
      expect(m.h ?? 1).toBeLessThanOrEqual(EDGE_FIT.h);
    }
  });

  it('holds monitors on an arm, one or two', () => {
    expect(canCarry('monitor_arm', 'monitor')).toBe(true);
    expect(canCarry('monitor_arm', 'tv')).toBe(false);
    expect(canCarry('monitor_arm', 'webcam')).toBe(false);
    expect(capacityOf('monitor_arm')).toBe(1);
    expect(capacityOf('dual_monitor_arm')).toBe(2);
    expect(capacityOf('desk')).toBe(Number.POSITIVE_INFINITY);
    // An arm stands on a desk; a monitor on an arm; a webcam on that monitor.
    expect(canCarry('desk', 'dual_monitor_arm')).toBe(true);
    expect(canCarry('dual_monitor_arm', 'monitor')).toBe(true);
    expect(canCarry('monitor', 'webcam')).toBe(true);
  });

  it('keeps the old rule for tops, so old layouts still load', () => {
    for (const host of ['desk', 'counter', 'box', 'tv_stand'] as const)
      for (const child of ['laptop', 'cardboard', 'tv', 'wardrobe'] as const)
        expect(canCarry(host, child), `${child} on ${host}`).toBe(canStandOn(child));
    expect(canCarry('sofa', 'webcam')).toBe(false);
  });

  it('seats what it carries at its top, its edge or its arm', () => {
    expect(seatHeight('desk')).toBe(0.74);
    expect(seatHeight('monitor')).toBeCloseTo(0.545);
    expect(seatHeight('monitor_arm')).toBeCloseTo(0.08);
    expect(seatHeight('sofa')).toBe(0);
  });

  it('lists only holders the thing fits on', () => {
    expect(fitsOn('desk', 'monitor')).toBe(true);
    expect(fitsOn('desk', 'car')).toBe(false);
    expect(fitsOn('box', 'keyboard')).toBe(true);
    expect(fitsOn('monitor', 'webcam')).toBe(true);
    expect(fitsOn('monitor_arm', 'monitor')).toBe(true);
    expect(canBeCarried('webcam')).toBe(true);
    expect(canBeCarried('monitor')).toBe(true);
    expect(canBeCarried('boombox')).toBe(false);
    expect(canBeCarried('sofa')).toBe(false);
  });

  it('turns a holder’s own offsets as the map turns the holder', () => {
    expect(turnOffset(1, 0, 0)).toEqual({ x: 1, z: 0 });
    // three.js turns about y by −rot: a quarter turn sends the front (+z) to −x.
    expect(turnOffset(0, 1, 90)).toEqual({ x: -1, z: 0 });
    expect(turnOffset(1, 0, 90)).toEqual({ x: 0, z: 1 });
    expect(turnOffset(0, 1, 180)).toEqual({ x: -0, z: -1 });
    for (const rot of [0, 90, 180, 270]) {
      const p = turnOffset(0.3, -0.1, rot);
      const back = unturnOffset(p.x, p.z, rot);
      expect(back.x).toBeCloseTo(0.3);
      expect(back.z).toBeCloseTo(-0.1);
    }
  });

  it('snaps a small thing by a centimetre, a thing by 5 cm, furniture by 10 cm', () => {
    expect(snapStep('webcam')).toBe(0.01);
    expect(snapStep('mouse')).toBe(0.01);
    expect(snapStep('laptop')).toBe(0.01);
    expect(snapStep('tv')).toBe(0.05);
    expect(snapStep('fridge')).toBe(0.05);
    expect(snapStep('desk')).toBe(0.1);
    expect(snapStep('wardrobe')).toBe(0.1);
    // Whole centimetres are what a layout stores: the finest step still saves exactly.
    expect(mToCm(1.23)).toBe(123);
  });
});

describe('rectangles', () => {
  it('overlap only when they share area', () => {
    const a = { x: 0, z: 0, w: 4, d: 4 };
    expect(rectsOverlap(a, { x: 4, z: 0, w: 2, d: 2 })).toBe(false);
    expect(rectsOverlap(a, { x: 3.9, z: 3.9, w: 2, d: 2 })).toBe(true);
    expect(firstOverlap([a, { x: 5, z: 0, w: 1, d: 1 }, { x: 5.5, z: 0.5, w: 1, d: 1 }])).toEqual([
      1, 2,
    ]);
    expect(firstOverlap([a, { x: 4, z: 0, w: 1, d: 1 }])).toBeNull();
  });
});

describe('guessModel', () => {
  it('reads the name first', () => {
    expect(guessModel({ name: 'Samsung TV', subject: 'thing' })).toBe('tv');
    expect(guessModel({ name: 'Shelf A', subject: 'place', kindKey: 'zone' })).toBe('metal_shelf');
    expect(guessModel({ name: 'Games box', subject: 'thing', isContainer: true })).toBe('box');
    expect(guessModel({ name: 'Stairs up', subject: 'place' })).toBe('stairs');
  });

  it('then the type or the place kind', () => {
    expect(guessModel({ name: 'Corolla', subject: 'thing', typeKey: 'car' })).toBe('car');
    expect(guessModel({ name: 'Hall cupboard', subject: 'place', kindKey: 'closet' })).toBe(
      'wardrobe',
    );
    expect(guessModel({ name: 'By the door', subject: 'place', kindKey: 'zone' })).toBe('zone');
  });

  it('falls back to storage, a box or a plain block', () => {
    expect(guessModel({ name: 'Under the stairs', subject: 'place', kindKey: 'custom' })).toBe(
      'stairs',
    );
    expect(guessModel({ name: 'Spot', subject: 'place', kindKey: 'custom' })).toBe('metal_shelf');
    expect(guessModel({ name: 'Mystery', subject: 'thing', isContainer: true })).toBe('box');
    expect(guessModel({ name: 'Mystery', subject: 'thing' })).toBe('item');
    expect(guessModel({ name: null, subject: 'thing' })).toBe('item');
  });
});

describe('levelShort', () => {
  it('takes a number, else the first letter, else the position', () => {
    expect(levelShort('Floor 2', 2)).toBe('2');
    expect(levelShort('Ground floor', 0)).toBe('G');
    expect(levelShort('Roof', 3)).toBe('R');
    expect(levelShort('', 4)).toBe('4');
    expect(levelShort(null, 0)).toBe('0');
    expect(levelShort('  basement  ', 0)).toBe('B');
    expect(levelShort('Level 12', 5)).toBe('12');
  });

  it('skips the Arabic article ال, so the floors do not all read ا', () => {
    expect(levelShort('الطابق الأرضي', 0)).toBe('ط');
    expect(levelShort('السطح', 3)).toBe('س');
    expect(levelShort('بدروم', 0)).toBe('ب');
    // a two-letter word is not an article plus a word
    expect(levelShort('ال', 2)).toBe('ا');
  });

  it('takes the number in an Arabic name, in its own digits', () => {
    expect(levelShort('الطابق 1', 1)).toBe('1');
    expect(levelShort('الطابق ٢', 2)).toBe('٢');
    expect(levelShort('الطابق ١٢', 12)).toBe('١٢');
    expect(levelShort('Floor ٣', 3)).toBe('٣');
  });
});

describe('centimetres', () => {
  it('round to whole centimetres', () => {
    expect(mToCm(1.234)).toBe(123);
    expect(mToCm(0.005)).toBe(1);
  });
});

describe('things on a wall (#138)', () => {
  const room = { w: 4, d: 3 };

  it('has the wall shapes, at real sizes, each with where its middle hangs', () => {
    expect([...WALL_MODELS].sort()).toEqual(
      [
        'clock',
        'hooks',
        'picture',
        'rack_wall_12u',
        'rack_wall_6u',
        'tool_wall',
        'wall_cabinet',
        'wall_shelf',
        'wall_tv',
      ].sort(),
    );
    for (const k of WALL_MODELS) {
      const m = mapModel(k);
      expect(isWallModel(k), k).toBe(true);
      expect(m.h, k).toBeGreaterThan(0);
      // Shallow: a wall thing stands out from its wall, never into the room.
      expect(m.d, k).toBeLessThanOrEqual(0.4);
      const r = hangRange(k);
      expect(m.wall, k).toBeGreaterThanOrEqual(r.min);
      expect(m.wall, k).toBeLessThanOrEqual(r.max);
    }
    // A 55-inch TV, a floating shelf, a kitchen wall cabinet.
    expect(mapModel('wall_tv')).toMatchObject({ w: 1.23, h: 0.71 });
    expect(mapModel('wall_cabinet')).toMatchObject({ w: 0.8, d: 0.35, h: 0.7 });
    for (const k of ['tv', 'tv_stand', 'bookshelf', 'desk', 'item'] as const)
      expect(isWallModel(k), k).toBe(false);
  });

  it('starts a TV at eye level, a shelf and a picture at 1.5 m, a clock at 1.8 m', () => {
    expect(mapModel('wall_tv').wall).toBe(1.2);
    expect(mapModel('wall_shelf').wall).toBe(1.5);
    expect(mapModel('picture').wall).toBe(1.5);
    expect(mapModel('clock').wall).toBe(1.8);
    // A wall TV hangs clear above a TV stand.
    const tv = mapModel('wall_tv');
    expect((tv.wall ?? 0) - (tv.h ?? 0) / 2).toBeGreaterThan(seatHeight('tv_stand') + 0.1);
  });

  it('keeps a thing between the floor and the top of the wall', () => {
    const r = hangRange('wall_tv');
    expect(r.min).toBeCloseTo(0.355);
    expect(r.max).toBeCloseTo(HANG_TOP - 0.355);
    expect(hangRange('clock').min).toBeCloseTo(0.15);
  });

  it('turns a thing on a wall to face into the room, its back to the wall', () => {
    expect(wallOfTurn(0)).toBe('-z');
    expect(wallOfTurn(90)).toBe('+x');
    expect(wallOfTurn(180)).toBe('+z');
    expect(wallOfTurn(270)).toBe('-x');
    expect(wallOfTurn(-90)).toBe('-x');
    expect(wallOfTurn(450)).toBe('+x');
    for (const w of ['-z', '+x', '+z', '-x'] as const) {
      expect(wallOfTurn(turnOfWall(w))).toBe(w);
      // Its front (+z in its own frame) points away from the wall.
      const front = turnOffset(0, 1, turnOfWall(w));
      const axis = w[1] === 'x' ? front.x : front.z;
      expect(Math.sign(axis)).toBe(w[0] === '-' ? 1 : -1);
    }
  });

  it('finds the nearest wall to a point in the room', () => {
    expect(nearestWall(room, { x: 2, z: 0.2 })).toBe('-z');
    expect(nearestWall(room, { x: 2, z: 2.9 })).toBe('+z');
    expect(nearestWall(room, { x: 0.3, z: 1.5 })).toBe('-x');
    expect(nearestWall(room, { x: 3.8, z: 1.5 })).toBe('+x');
    // Outside the room, the wall it is beyond.
    expect(nearestWall(room, { x: 2, z: -1 })).toBe('-z');
    expect(nearestWall(room, { x: 9, z: 1 })).toBe('+x');
  });

  it('puts a thing flat against its wall, inside the walls at its ends', () => {
    const w = mapModel('wall_tv').w;
    const d = mapModel('wall_tv').d;
    expect(wallSpot(room, 'wall_tv', '-z', 1)).toEqual({ x: 1, z: WALL_T });
    expect(wallSpot(room, 'wall_tv', '+z', 1).z).toBeCloseTo(room.d - WALL_T - d);
    // Along a wall of the room's depth, its width runs along z once turned.
    expect(wallSpot(room, 'wall_tv', '-x', 1)).toEqual({ x: WALL_T, z: 1 });
    expect(wallSpot(room, 'wall_tv', '+x', 1).x).toBeCloseTo(room.w - WALL_T - d);
    // Never past the wall's ends.
    expect(wallSpot(room, 'wall_tv', '-z', -5).x).toBe(WALL_T);
    expect(wallSpot(room, 'wall_tv', '-z', 99).x).toBeCloseTo(room.w - WALL_T - w);
    expect(wallSpot(room, 'wall_tv', '-x', 99).z).toBeCloseTo(room.d - WALL_T - w);
    // A wall shorter than the thing: from its start.
    expect(wallSpot({ w: 1, d: 1 }, 'wall_tv', '-z', 0.5).x).toBe(WALL_T);
  });

  it('measures how far a thing is from the wall at its back', () => {
    const at = wallSpot(room, 'picture', '+x', 1.2);
    expect(offWall(room, 'picture', { ...at, rot: 90 })).toBeCloseTo(0);
    // Turned away from that wall, it is off it.
    expect(offWall(room, 'picture', { ...at, rot: 270 })).toBeGreaterThan(3);
    expect(offWall(room, 'picture', { x: at.x - 0.5, z: at.z, rot: 90 })).toBeCloseTo(0.5);
  });

  it('never stands a wall thing on something, nor hangs one on a hook', () => {
    for (const k of WALL_MODELS) {
      expect(canStandOn(k), k).toBe(false);
      expect(canBeCarried(k), k).toBe(false);
      for (const host of ['desk', 'wall_shelf', 'tool_wall', 'hooks', 'wall_tv'] as const)
        expect(canCarry(host, k), `${k} on ${host}`).toBe(false);
    }
  });

  it('carries small things on a wall shelf and hangs tools and bags on a tool wall or hooks', () => {
    expect(carryOf('wall_shelf')).toBe('top');
    expect(carryOf('tool_wall')).toBe('hook');
    expect(carryOf('hooks')).toBe('hook');
    expect(carryOf('wall_tv')).toBe('edge');
    expect(carryOf('picture')).toBeNull();
    expect(carryOf('clock')).toBeNull();
    expect(fitsOn('wall_shelf', 'succulent')).toBe(true);
    expect(fitsOn('wall_shelf', 'plant')).toBe(false);
    for (const k of ['drill', 'headphones', 'item', 'watering_can'] as const) {
      expect(canCarry('tool_wall', k), k).toBe(true);
      expect(fitsOn('hooks', k), k).toBe(true);
    }
    // Holders themselves, and big things, don't hang on a hook.
    for (const k of ['laptop', 'monitor_arm', 'box', 'boombox', 'sofa', 'bike'] as const)
      expect(canCarry('tool_wall', k), k).toBe(false);
    expect(capacityOf('tool_wall')).toBe(Number.POSITIVE_INFINITY);
  });

  it('hangs a thing from a hook by its top, and stands one on a shelf on its base', () => {
    const peg = mapModel('tool_wall').mount;
    expect(peg?.on).toBe('hook');
    const line = peg?.h ?? 0;
    expect(seatFor('tool_wall', 'drill') + (mapModel('drill').h ?? 0)).toBeCloseTo(line);
    expect(seatFor('hooks', 'item')).toBeGreaterThanOrEqual(0);
    expect(seatFor('wall_shelf', 'succulent')).toBe(seatHeight('wall_shelf'));
    expect(seatFor('desk', 'laptop')).toBe(0.74);
  });
});
