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
  it('names each line that takes stock: how much, 1 unless said, of what', () => {
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

  it('shows the notes the service is logged with (#296)', () => {
    const [row] = rowsOf(
      proposal(
        { thing_id: CAR, serviced_on: '2026-10-14', notes: 'Wipers squeak in the rain.' },
        { [CAR]: { kind: 'thing', name: 'Corolla', path: [] } },
      ),
    );
    expect(row?.fields.find((f) => f.key === 'notes')?.after).toEqual({
      t: 'text',
      v: 'Wipers squeak in the rain.',
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

describe('update_place rows (#313)', () => {
  const SHELF = '0192f0c3-7c55-7000-8000-000000000006';
  const HALL = '0192f0c3-7c55-7000-8000-000000000007';
  const STUDY = '0192f0c3-7c55-7000-8000-000000000008';
  const refs: Proposal['refs'] = {
    [SHELF]: { kind: 'place', name: 'Window shelf', path: ['Home', 'Study'] },
    [HALL]: { kind: 'place', name: 'Hall', path: ['Home'] },
    [STUDY]: { kind: 'place', name: 'Study', path: ['Home'] },
  };
  const change = (args: Record<string, unknown>, before: Record<string, unknown>) =>
    rowsOf({ ...proposal({ place_id: SHELF, ...args }, refs), tool: 'update_place', before });

  it('shows each field of the place form as it was and as it will be', () => {
    const [row] = change(
      {
        fields: {
          name: 'Book shelf',
          kind: 'closet',
          parent_id: HALL,
          child_order: 'custom',
          custom: { width_cm: 80 },
        },
      },
      { name: 'Window shelf', kind: 'room', parent_id: STUDY, child_order: 'name' },
    );
    expect(row).toMatchObject({
      verb: 'change',
      target: { kind: 'place', id: SHELF, name: 'Window shelf' },
    });
    expect(row?.fields).toEqual([
      {
        key: 'name',
        before: { t: 'text', v: 'Window shelf' },
        after: { t: 'text', v: 'Book shelf' },
      },
      {
        key: 'kind',
        before: { t: 'placeKind', v: 'room' },
        after: { t: 'placeKind', v: 'closet' },
      },
      {
        key: 'under',
        before: { t: 'path', v: ['Home', 'Study'] },
        after: { t: 'path', v: ['Home', 'Hall'] },
      },
      {
        key: 'order',
        before: { t: 'childOrder', v: 'name' },
        after: { t: 'childOrder', v: 'custom' },
      },
      { key: 'custom', after: { t: 'text', v: 'width_cm: 80' } },
    ]);
  });

  it('the top of the location is the location itself; a step up or down is its own row', () => {
    const [top] = change({ fields: { parent_id: null } }, { parent_id: STUDY });
    expect(top?.fields).toEqual([
      {
        key: 'under',
        before: { t: 'path', v: ['Home', 'Study'] },
        after: { t: 'path', v: ['Home'] },
      },
    ]);
    const [up] = change({ move: 'up' }, { parent_id: STUDY });
    expect(up?.fields).toEqual([{ key: 'step', after: { t: 'step', v: 'up' } }]);
    // Values Kept doesn't know are left out, never shown as the model wrote them.
    const [odd] = change({ move: 'sideways', fields: { child_order: 'newest' } }, {});
    expect(odd?.fields).toEqual([]);
  });
});

describe('turn_into_boxes rows (#313)', () => {
  const A = '0192f0c3-7c55-7000-8000-000000000009';
  const B = '0192f0c3-7c55-7000-8000-00000000000a';
  const refs: Proposal['refs'] = {
    [A]: { kind: 'place', name: 'Blue crate', path: ['Home', 'Landing'] },
    [B]: { kind: 'place', name: 'Red crate', path: ['Home', 'Landing'] },
  };
  const boxes = (ids: string[]) =>
    rowsOf({ ...proposal({ place_ids: ids }, refs), tool: 'turn_into_boxes' });

  it('one place: the place itself', () => {
    expect(boxes([A])[0]).toMatchObject({
      verb: 'box',
      target: { kind: 'place', id: A, name: 'Blue crate' },
      fields: [],
    });
  });

  it('several: how many, and each place by name', () => {
    expect(boxes([A, B])[0]).toMatchObject({
      verb: 'boxes',
      target: null,
      count: { n: 2 },
      fields: [{ key: 'places', after: { t: 'list', v: ['Blue crate', 'Red crate'] } }],
    });
  });
});
