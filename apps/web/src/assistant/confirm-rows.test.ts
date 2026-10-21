import type { Proposal } from '@kept/shared';
import { describe, expect, it } from 'vitest';
import { rowsOf } from './confirm-rows';

const LOC = '0192f0c3-7c55-7000-8000-000000000001';
const CAR = '0192f0c3-7c55-7000-8000-000000000002';
const OIL = '0192f0c3-7c55-7000-8000-000000000003';

const proposal = (args: Record<string, unknown>, refs: Proposal['refs']): Proposal => ({
  id: 'p1',
  batchId: 'b1',
  turnId: 't1',
  locationId: LOC,
  tool: 'log_service',
  args,
  argsHash: '0',
  before: {},
  refs: { [LOC]: { kind: 'location', name: 'Home', path: [] }, ...refs },
  status: 'open',
  expiresAt: '2026-10-15T00:00:00Z',
});

describe('log_service rows', () => {
  it('names each line that takes stock (D236): how much, 1 unless said, of what', () => {
    const [row] = rowsOf(
      proposal(
        {
          thing_id: CAR,
          serviced_on: '2026-10-14',
          lines: [
            { description: 'Oil change', consumable_thing_id: 'k7d-2qx', consumed_quantity: 4.5 },
            { description: 'Oil filter', consumable_thing_id: 'H4M9TR' },
            { description: 'Check-up' },
          ],
        },
        {
          [CAR]: { kind: 'thing', name: 'Corolla', path: [] },
          'k7d-2qx': { kind: 'thing', name: 'Engine oil', path: [] },
          [OIL]: { kind: 'thing', name: 'Engine oil', path: [] },
        },
      ),
    );
    expect(row?.verb).toBe('service');
    expect(row?.fields.filter((f) => f.key === 'stock').map((f) => f.after)).toEqual([
      { t: 'take', n: 4.5, name: 'Engine oil' },
      // Not in refs (not found when proposed): shown without a name, never the raw id.
      { t: 'take', n: 1 },
    ]);
    expect(row?.fields.find((f) => f.key === 'lines')?.after).toEqual({
      t: 'list',
      v: ['Oil change', 'Oil filter', 'Check-up'],
    });
  });
});

describe('add_thing rows', () => {
  const SHELF = '0192f0c3-7c55-7000-8000-000000000004';
  const TYPE = '0192f0c3-7c55-7000-8000-000000000005';
  const add = (items: Record<string, unknown>[], refs: Proposal['refs'] = {}) =>
    rowsOf({ ...proposal({ items }, refs), tool: 'add_thing' });

  it('always says where: the place, a new place, or Unplaced in plain words', () => {
    const rows = add(
      [
        { name: 'Drill', place_id: SHELF },
        { name: 'Ladder', new_place: { name: 'Back wall' } },
        { name: 'Torch' },
      ],
      { [SHELF]: { kind: 'place', name: 'Shelf', path: ['Home'] } },
    );
    expect(rows.map((r) => r.fields.find((f) => f.key === 'where')?.after)).toEqual([
      { t: 'path', v: ['Home', 'Shelf'] },
      { t: 'path', v: ['Home', 'Back wall'], isNew: true },
      { t: 'unplaced' },
    ]);
    expect(rows.map((r) => r.editable?.where)).toEqual([
      { kind: 'place', id: SHELF },
      { kind: 'new' },
      { kind: 'unplaced' },
    ]);
  });

  it('shows the type Kept matched, else "not set" with the words the model used', () => {
    const rows = add(
      [{ name: 'Sofa', type: 'Furniture' }, { name: 'Drill', type: 'Drill' }, { name: 'Mug' }],
      { 'type:Furniture': { kind: 'type', id: TYPE, name: 'Furniture', path: [] } },
    );
    expect(rows.map((r) => r.fields.find((f) => f.key === 'type')?.after)).toEqual([
      { t: 'type', id: TYPE, name: 'Furniture' },
      { t: 'notSet', word: 'Drill' },
      { t: 'notSet' },
    ]);
    expect(rows.map((r) => r.editable?.typeId)).toEqual([TYPE, null, null]);
  });

  it('shows every field the item gets: colour, condition, purchase, owner, tags …', () => {
    const [row] = add([
      {
        name: 'Kettle',
        brand: 'Fieldbrand',
        model: 'FK-2',
        serial: 'FK-1',
        barcode: '501',
        colour: 'Blue',
        condition: 'good',
        notes: 'Spare lid',
        aliases: ['Travel kettle'],
        tags: ['Kitchen'],
        belongs_to: 'Murdock',
        manual_url: 'https://example.com/fk2',
        expires_on: '2030-01-31',
        keep_at_least: 2,
        purchase: {
          purchased_on: '2026-09-01',
          price: '45.5',
          currency: 'EGP',
          shop: 'Corner shop',
        },
        custom: { voltage: 230 },
      },
    ]);
    const keys = row?.fields.map((f) => f.key);
    expect(keys).toEqual([
      'where',
      'type',
      'brand',
      'model',
      'serial',
      'barcode',
      'colour',
      'condition',
      'aliases',
      'tags',
      'owner',
      'bought',
      'price',
      'shop',
      'expires',
      'keepAtLeast',
      'manual',
      'custom',
      'notes',
    ]);
    expect(row?.fields.find((f) => f.key === 'condition')?.after).toEqual({
      t: 'condition',
      v: 'good',
    });
    expect(row?.fields.find((f) => f.key === 'price')?.after).toEqual({
      t: 'money',
      amount: '45.5',
      currency: 'EGP',
    });
    expect(row?.editable).toMatchObject({ colour: 'Blue', condition: 'good' });
  });
});

describe('tag_things rows', () => {
  it('lists the tags added and taken off, and how many things', () => {
    const [row] = rowsOf({
      ...proposal({ thing_ids: [CAR, OIL], add: ['Camping'], remove: ['Old'] }, {}),
      tool: 'tag_things',
    });
    expect(row).toMatchObject({
      verb: 'change',
      target: null,
      count: { n: 2 },
      fields: [{ key: 'tags', after: { t: 'list', v: ['+ Camping', '− Old'] } }],
    });
  });
});
