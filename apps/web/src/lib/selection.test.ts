import { describe, expect, it } from 'vitest';
import { NO_SELECTION, pickRow, selectAll, selectRange, toggleRow } from './selection';

const order = ['a', 'b', 'c', 'd', 'e'];

describe('a selection of rows (#366)', () => {
  it('ticks one row, which becomes the anchor', () => {
    const s = toggleRow(NO_SELECTION, 'b');
    expect([...s.ids]).toEqual(['b']);
    expect(s.anchor).toBe('b');
    expect(toggleRow(s, 'b').ids.size).toBe(0);
  });

  it('adds every row from the anchor to the one Shift-clicked, either way, keeping the anchor', () => {
    const s = pickRow(pickRow(NO_SELECTION, order, 'b', false), order, 'd', true);
    expect([...s.ids].sort()).toEqual(['b', 'c', 'd']);
    expect(s.anchor).toBe('b');
    const back = selectRange(s, order, 'a');
    expect([...back.ids].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('a Shift-click with nothing ticked yet is one tick', () => {
    expect([...pickRow(NO_SELECTION, order, 'c', true).ids]).toEqual(['c']);
  });

  it('a row no longer in the list is one tick, not a range', () => {
    const s = toggleRow(NO_SELECTION, 'gone');
    expect([...selectRange(s, order, 'c').ids].sort()).toEqual(['c', 'gone']);
  });

  it('selects all, the first row the anchor', () => {
    expect(selectAll(order)).toEqual({ ids: new Set(order), anchor: 'a' });
  });
});
