import { describe, expect, it } from 'vitest';
import { applyGroups, groupsByNames } from './merge.js';
import type { RoomObject } from './objects.js';

const o = (
  photo: number,
  name: string,
  bbox: [number, number, number, number] = [0, 0, 0.1, 0.1],
  more: Partial<RoomObject['fields']> = {},
): RoomObject => ({
  photo,
  bbox,
  kind: 'item',
  fields: { name: { value: name, confidence: 0.9 }, aliases: {}, ...more },
});

describe('applyGroups', () => {
  it('keeps the object with the largest box, and every photo it was seen in', () => {
    const merged = applyGroups(
      [o(0, 'Lamp', [0, 0, 0.1, 0.1]), o(1, 'Lamp', [0, 0, 0.5, 0.5]), o(1, 'Rug')],
      [[0, 1]],
    );
    expect(merged.map((m) => [m.fields.name?.value, m.photo, m.photos])).toEqual([
      ['Lamp', 1, [0, 1]],
      ['Rug', 1, [1]],
    ]);
  });

  it('ignores a group with an index out of range, one used twice, or two of the same photo', () => {
    const objects = [o(0, 'A'), o(0, 'B'), o(1, 'C'), o(2, 'D')];
    expect(applyGroups(objects, [[0, 9]])).toHaveLength(4);
    expect(applyGroups(objects, [[0, 1]])).toHaveLength(4);
    expect(
      applyGroups(objects, [
        [0, 2],
        [2, 3],
      ]),
    ).toHaveLength(3);
  });

  it('carries the larger count of a merged object as a quantity to review', () => {
    const merged = applyGroups(
      [
        o(0, 'Mug', [0, 0, 0.3, 0.3]),
        o(1, 'Mug', [0, 0, 0.1, 0.1], { quantity: { value: 3, confidence: 0.8 } }),
      ],
      [[0, 1]],
    );
    expect(merged[0]?.fields.quantity).toEqual({ value: 3, confidence: 0.6 });
  });
});

describe('groupsByNames', () => {
  it('groups the same name and type across photos, never within one', () => {
    const objects = [
      o(0, 'Floor lamp', undefined, { typeHint: { value: 'lamp', confidence: 0.9 } }),
      o(0, 'floor lamp', undefined, { typeHint: { value: 'Lamp', confidence: 0.9 } }),
      o(1, 'Floor Lamp', undefined, { typeHint: { value: 'lamp', confidence: 0.9 } }),
      o(1, 'Floor lamp', undefined, { typeHint: { value: 'light', confidence: 0.9 } }),
    ];
    expect(groupsByNames(objects)).toEqual([[0, 2]]);
  });
});
