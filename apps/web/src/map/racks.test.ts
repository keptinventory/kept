import { describe, expect, it } from 'vitest';
import type { MapRack } from '@/api/map/types';
import { compartmentAt, compartmentBoxes } from './compartments';
import { rackModel, rackParts } from './layout';

// #373: a rack on the map: its gear as parts of its front, half a unit to a row, top row first,
// so the engine outlines each piece at its unit and a tap picks it.

const rack: MapRack = {
  units: 12,
  numbering: 'bottom',
  mount: 'wall',
  gear: [
    { id: 'switch', name: 'Switch', u: 11, units: 1, face: 'front', full: true },
    { id: 'server', name: 'Server', u: 1, units: 2, face: 'front', full: false },
    { id: 'shelf', name: 'Shelf', u: 5, units: 1, face: 'rear', full: false },
  ],
};

describe('a rack on the map', () => {
  it('puts each piece on the front at its units, top row first; rear-only gear is not there', () => {
    const { grid, compartments } = rackParts(rack);
    expect(grid).toEqual({ columns: 1, rows: 24, kind: 'rack' });
    expect(compartments.map((c) => [c.id, c.row, c.rows])).toEqual([
      ['switch', 3, 2],
      ['server', 21, 4],
    ]);
  });

  it('picks the piece a tap hits on the rack’s front', () => {
    const { grid, compartments } = rackParts(rack);
    const boxes = compartmentBoxes(rackModel(rack), grid, compartments);
    const sw = boxes.get('switch');
    if (!sw) throw new Error('no box');
    expect(compartmentAt(boxes, { x: sw.x, y: sw.y })).toBe('switch');
    // The switch is higher up than the server.
    expect(sw.y).toBeGreaterThan(boxes.get('server')?.y ?? Number.POSITIVE_INFINITY);
  });

  it('is drawn as the catalogue rack nearest above its units', () => {
    expect(rackModel({ units: 6, mount: 'wall' })).toBe('rack_wall_6u');
    expect(rackModel({ units: 12, mount: 'wall' })).toBe('rack_wall_12u');
    expect(rackModel({ units: 24, mount: 'floor' })).toBe('rack_24u');
    expect(rackModel({ units: 42, mount: 'floor' })).toBe('rack_42u');
  });
});
