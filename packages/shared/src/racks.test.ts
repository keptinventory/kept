import { describe, expect, it } from 'vitest';
import {
  BUILTIN_RACK_TEMPLATES,
  elevationOf,
  firstFree,
  type Gear,
  halvesOf,
  parseRack,
  parseRackPosition,
  rackProblem,
  shownRange,
  shownUnit,
} from './racks.js';

const rack12 = { units: 12, numbering: 'bottom' as const };
const gear = (id: string, units: number | null, at: Gear['at']): Gear => ({ id, units, at });
const front = (u: number, full = false) => ({ u, face: 'front' as const, full });
const rear = (u: number, full = false) => ({ u, face: 'rear' as const, full });

describe('halvesOf', () => {
  it('counts half units from the bottom of U1', () => {
    expect(halvesOf(1, 1)).toEqual([0, 1]);
    expect(halvesOf(12, 2)).toEqual([22, 23, 24, 25]);
    expect(halvesOf(3.5, 1)).toEqual([5, 6]);
    expect(halvesOf(4, 0)).toEqual([]);
  });
});

describe('rackProblem', () => {
  const switch1 = gear('switch', 1, front(11, true));

  it('lets gear into free units', () => {
    expect(rackProblem(rack12, gear('pc', 2, front(1, true)), [switch1])).toBeNull();
  });

  it('refuses two full-depth pieces in the same unit', () => {
    expect(rackProblem(rack12, gear('pc', 1, front(11, true)), [switch1])).toEqual({
      reason: 'taken',
      by: 'switch',
      face: 'front',
      u: 11,
    });
  });

  it('refuses a piece that overlaps another by one unit', () => {
    expect(rackProblem(rack12, gear('nas', 2, front(10, true)), [switch1])).toMatchObject({
      reason: 'taken',
      u: 11,
    });
  });

  it('lets a half-depth piece on the rear share a unit with a half-depth one on the front', () => {
    const switchFront = gear('switch', 1, front(11));
    expect(rackProblem(rack12, gear('shelf', 1, rear(11)), [switchFront])).toBeNull();
    // A full-depth one is on both faces.
    expect(rackProblem(rack12, gear('shelf', 1, rear(11)), [switch1])).toMatchObject({
      reason: 'taken',
      face: 'rear',
    });
    expect(rackProblem(rack12, gear('big', 1, front(11, true)), [switchFront])).toMatchObject({
      reason: 'taken',
      face: 'front',
    });
  });

  it('refuses gear past the top of the rack, and below U1', () => {
    expect(rackProblem(rack12, gear('nas', 2, front(12, true)), [])).toEqual({
      reason: 'outside',
      top: 12,
    });
    expect(rackProblem(rack12, gear('nas', 2, front(11, true)), [])).toBeNull();
    expect(rackProblem(rack12, gear('nas', 1, front(0.5, true)), [])).toMatchObject({
      reason: 'outside',
    });
  });

  it('takes half units, and refuses anything else', () => {
    expect(rackProblem(rack12, gear('a', 1.5, front(1, true)), [])).toBeNull();
    expect(
      rackProblem(rack12, gear('b', 1, front(2.5, true)), [gear('a', 1.5, front(1, true))]),
    ).toBeNull();
    expect(
      rackProblem(rack12, gear('b', 1, front(2, true)), [gear('a', 1.5, front(1, true))]),
    ).toMatchObject({ reason: 'taken', u: 2 });
    expect(rackProblem(rack12, gear('c', 1, front(3.25, true)), [])).toEqual({ reason: 'half' });
    expect(rackProblem(rack12, gear('c', 1.2, front(3, true)), [])).toEqual({ reason: 'half' });
  });

  it('counts a height not given as 1U', () => {
    expect(rackProblem(rack12, gear('a', null, front(12, true)), [])).toBeNull();
    expect(
      rackProblem(rack12, gear('b', 1, front(12, true)), [gear('a', null, front(12, true))]),
    ).not.toBeNull();
  });

  it('gives 0U gear no unit, and ignores it in others', () => {
    expect(rackProblem(rack12, gear('pdu', 0, front(3, true)), [])).toEqual({ reason: 'zero' });
    expect(rackProblem(rack12, gear('a', 1, front(3, true)), [gear('pdu', 0, front(3))])).toBe(
      null,
    );
  });

  it('never clashes with itself, and a piece with no position is fine', () => {
    expect(rackProblem(rack12, switch1, [switch1])).toBeNull();
    expect(rackProblem(rack12, gear('x', 4, null), [switch1])).toBeNull();
  });
});

describe('firstFree', () => {
  it('finds the lowest whole unit where the height fits', () => {
    const others = [gear('a', 2, front(1, true)), gear('b', 1, front(4, true))];
    expect(firstFree(rack12, others, 1, 'front', true)).toBe(3);
    expect(firstFree(rack12, others, 2, 'front', true)).toBe(5);
    expect(firstFree({ units: 2 }, [gear('a', 2, front(1, true))], 1, 'front', true)).toBeNull();
  });
});

describe('numbering', () => {
  it('shows units from the bottom, or from the top', () => {
    expect(shownUnit(rack12, 1)).toBe(1);
    expect(shownUnit({ units: 12, numbering: 'top' }, 1)).toBe(12);
    expect(shownRange(rack12, 11, 2)).toEqual({ from: 11, to: 12 });
    expect(shownRange(rack12, 5, 1)).toEqual({ from: 5, to: 5 });
    expect(shownRange(rack12, 12.5, 1)).toEqual({ from: 12.5, to: 13 });
    expect(shownRange({ units: 12, numbering: 'top' }, 11, 2)).toEqual({ from: 1, to: 2 });
    expect(shownRange({ units: 12, numbering: 'top' }, 1, 1)).toEqual({ from: 12, to: 12 });
  });
});

describe('elevationOf', () => {
  it('lists the rack top to bottom: gear once, free units in runs', () => {
    const all = [
      gear('switch', 1, front(11, true)),
      gear('server', 2, front(5, true)),
      gear('shelf', 1, rear(8)),
      gear('pdu', 0, null),
    ];
    expect(elevationOf(rack12, all, 'front')).toEqual([
      { kind: 'empty', from: 12, to: 12 },
      { kind: 'gear', id: 'switch', u: 11, units: 1 },
      { kind: 'empty', from: 7, to: 10 },
      { kind: 'gear', id: 'server', u: 5, units: 2 },
      { kind: 'empty', from: 1, to: 4 },
    ]);
    expect(elevationOf(rack12, all, 'rear')).toEqual([
      { kind: 'empty', from: 12, to: 12 },
      { kind: 'gear', id: 'switch', u: 11, units: 1 },
      { kind: 'empty', from: 9, to: 10 },
      { kind: 'gear', id: 'shelf', u: 8, units: 1 },
      { kind: 'empty', from: 7, to: 7 },
      { kind: 'gear', id: 'server', u: 5, units: 2 },
      { kind: 'empty', from: 1, to: 4 },
    ]);
  });

  it('is one free run for an empty rack', () => {
    expect(elevationOf({ units: 42 }, [], 'front')).toEqual([{ kind: 'empty', from: 1, to: 42 }]);
  });
});

describe('reading stored values', () => {
  it('reads a rack layout, and nothing else', () => {
    expect(
      parseRack({ kind: 'rack', units: 12, width: 19, numbering: 'top', mount: 'wall' }),
    ).toEqual({ kind: 'rack', units: 12, width: 19, numbering: 'top', mount: 'wall' });
    expect(parseRack({ kind: 'rack', units: 8 })).toEqual({
      kind: 'rack',
      units: 8,
      width: 19,
      numbering: 'bottom',
      mount: 'floor',
    });
    expect(parseRack({ kind: 'grid', across: 2, up: 4 })).toBeNull();
    expect(parseRack({ kind: 'rack', units: 0 })).toBeNull();
    expect(parseRack({ kind: 'rack', units: 61 })).toBeNull();
    expect(parseRack(null)).toBeNull();
  });

  it('reads a stored position, and refuses a broken one', () => {
    expect(parseRackPosition({ rackId: 'r', u: 3.5, face: 'rear', full: false })).toEqual({
      rackId: 'r',
      u: 3.5,
      face: 'rear',
      full: false,
    });
    expect(parseRackPosition({ rackId: 'r', u: 3.3, face: 'rear' })).toBeNull();
    expect(parseRackPosition({ u: 3, face: 'front' })).toBeNull();
    expect(parseRackPosition({ rackId: 'r', u: 3, face: 'side' })).toBeNull();
  });
});

describe('built-in rack templates', () => {
  it('has unique keys and racks it can build', () => {
    const keys = BUILTIN_RACK_TEMPLATES.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const b of BUILTIN_RACK_TEMPLATES) expect(parseRack(b.layout)).toEqual(b.layout);
  });
});
