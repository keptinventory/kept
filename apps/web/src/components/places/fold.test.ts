/**
 * Folding the places outline (#358): which rows fold, what a fold hides, and the path to the page
 * you are on, which is always open.
 */
import { describe, expect, it } from 'vitest';
import type { BoxNode, PlaceNode } from '@/api/inventory/types';
import {
  foldableIds,
  isFoldedAll,
  keptOpen,
  nestEntries,
  toggleFold,
  visibleEntries,
} from './fold';
import { type TreeEntry, treeEntries } from './tree';

const place = (id: string, parentId: string | null, extra: Partial<PlaceNode> = {}): PlaceNode => ({
  id,
  parentId,
  name: id,
  kindKey: 'room',
  icon: null,
  sort: 0,
  isUnplaced: false,
  shortCode: null,
  thingCount: 0,
  childCount: 0,
  createdAt: '2026-10-01T00:00:00Z',
  boxCount: 0,
  childOrder: 'name',
  ...extra,
});
const box = (id: string, placeId: string): BoxNode => ({
  id,
  placeId,
  name: id,
  icon: null,
  shortCode: null,
  contentCount: 1,
});

// Unplaced; Bedroom > Under bed (2 boxes, 3 more on its page); Bedroom > Wardrobe; Office (empty).
const places = [
  place('unplaced', null, { isUnplaced: true, name: 'Unplaced' }),
  place('bedroom', null, { name: 'Bedroom' }),
  place('under-bed', 'bedroom', { name: 'Under bed', boxCount: 5 }),
  place('wardrobe', 'bedroom', { name: 'Wardrobe' }),
  place('office', null, { name: 'Office' }),
];
const boxes = [box('box-1', 'under-bed'), box('box-2', 'under-bed')];
const entries = treeEntries(places, boxes);

const label = (e: TreeEntry) =>
  e.kind === 'box' ? e.box.id : e.kind === 'more' ? `more:${e.place.id}` : e.place.id;

describe('foldableIds', () => {
  it('is every place with a place, a box or a "+N boxes" row under it, in tree order', () => {
    expect(foldableIds(entries)).toEqual(['bedroom', 'under-bed']);
  });

  it('counts a place whose only row under it is "+N boxes"', () => {
    const only = treeEntries([place('shelf', null, { boxCount: 3 })], []);
    expect(foldableIds(only)).toEqual(['shelf']);
  });
});

describe('visibleEntries', () => {
  it('shows every row when nothing is folded', () => {
    expect(visibleEntries(entries, new Set()).map(label)).toEqual(entries.map(label));
  });

  it("hides a folded place's boxes and its '+N boxes' row, and keeps the place", () => {
    expect(visibleEntries(entries, new Set(['under-bed'])).map(label)).toEqual([
      'unplaced',
      'bedroom',
      'under-bed',
      'wardrobe',
      'office',
    ]);
  });

  it('hides everything under a folded place, however deep', () => {
    expect(visibleEntries(entries, new Set(['bedroom'])).map(label)).toEqual([
      'unplaced',
      'bedroom',
      'office',
    ]);
  });
});

describe('nestEntries', () => {
  it('puts each row under its place: child places first, then its boxes, then "+N boxes"', () => {
    const tree = nestEntries(entries);
    expect(tree.map((n) => label(n.entry))).toEqual(['unplaced', 'bedroom', 'office']);
    const bedroom = tree[1];
    expect(bedroom?.children.map((n) => label(n.entry))).toEqual(['under-bed', 'wardrobe']);
    expect(bedroom?.children[0]?.children.map((n) => label(n.entry))).toEqual([
      'box-1',
      'box-2',
      'more:under-bed',
    ]);
    expect(tree[2]?.children).toEqual([]);
  });
});

describe('keptOpen: the path to the page you are on', () => {
  it("is a place's ancestors, not the place itself", () => {
    const deep = [...places, place('drawer', 'wardrobe')];
    expect([...keptOpen(deep, boxes, 'drawer')].sort()).toEqual(['bedroom', 'wardrobe']);
  });

  it("is a box's place and that place's ancestors", () => {
    expect([...keptOpen(places, boxes, 'box-2')].sort()).toEqual(['bedroom', 'under-bed']);
  });

  it('is nothing on the location page, or for an id the tree does not have', () => {
    expect(keptOpen(places, boxes, undefined).size).toBe(0);
    expect(keptOpen(places, boxes, 'elsewhere').size).toBe(0);
  });

  it('survives a parent loop without hanging', () => {
    const loop = [place('a', 'b'), place('b', 'a')];
    expect([...keptOpen(loop, [], 'a')].sort()).toEqual(['a', 'b']);
  });
});

describe('toggleFold and isFoldedAll', () => {
  it('folds an open place and opens a folded one, without changing the set it was given', () => {
    const before = new Set(['bedroom']);
    expect([...toggleFold(before, 'under-bed')].sort()).toEqual(['bedroom', 'under-bed']);
    expect([...toggleFold(before, 'bedroom')]).toEqual([]);
    expect([...before]).toEqual(['bedroom']);
  });

  it('is all folded only when every foldable place is', () => {
    expect(isFoldedAll(new Set(['bedroom']), ['bedroom', 'under-bed'])).toBe(false);
    expect(isFoldedAll(new Set(['bedroom', 'under-bed', 'gone']), ['bedroom', 'under-bed'])).toBe(
      true,
    );
    expect(isFoldedAll(new Set(), [])).toBe(false);
  });
});
