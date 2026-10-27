import { describe, expect, it } from 'vitest';
import { comparePlaceSiblings, naturalCompare } from './order.js';

type P = {
  id: string;
  name: string;
  kindKey: string;
  sort: number;
  isUnplaced?: boolean;
  createdAt?: string;
};
const p = (name: string, extra: Partial<P> = {}): P => ({
  id: extra.id ?? name,
  name,
  kindKey: extra.kindKey ?? 'room',
  sort: extra.sort ?? 0,
  ...(extra.createdAt ? { createdAt: extra.createdAt } : {}),
});
const names = (rows: P[]) => [...rows].sort(comparePlaceSiblings).map((r) => r.name);

describe('naturalCompare', () => {
  it('reads numbers as numbers, and letters before case and accents', () => {
    expect(['Box 10', 'Box 2', 'attic', 'Ärmel', 'Basement'].sort(naturalCompare)).toEqual([
      'Ärmel',
      'attic',
      'Basement',
      'Box 2',
      'Box 10',
    ]);
  });

  it('reads Eastern Arabic digits as numbers', () => {
    expect(['رف ١٠', 'رف ٢', 'رف 3'].sort(naturalCompare)).toEqual(['رف ٢', 'رف 3', 'رف ١٠']);
  });

  it('keeps one order whatever the reader’s language: Latin letters, then Arabic', () => {
    expect(['بيت', 'Zebra', 'attic'].sort(naturalCompare)).toEqual(['attic', 'Zebra', 'بيت']);
  });
});

describe('comparePlaceSiblings', () => {
  it('puts floors first, in the order they were made, then the rest A to Z', () => {
    expect(
      names([
        p('Box 10'),
        p('Upstairs', { kindKey: 'floor', createdAt: '2026-01-02T00:00:00.000Z' }),
        p('Box 2'),
        p('Ground', { kindKey: 'floor', createdAt: '2026-01-01T00:00:00.000Z' }),
        p('attic', { kindKey: 'zone' }),
      ]),
    ).toEqual(['Ground', 'Upstairs', 'attic', 'Box 2', 'Box 10']);
  });

  it('orders floors by sort before when they were made', () => {
    expect(
      names([
        p('Ground', { kindKey: 'floor', sort: 1, createdAt: '2026-01-01T00:00:00.000Z' }),
        p('Cellar', { kindKey: 'floor', sort: 0, createdAt: '2026-01-05T00:00:00.000Z' }),
      ]),
    ).toEqual(['Cellar', 'Ground']);
  });

  it('ignores sort for every other place', () => {
    expect(names([p('Box 2', { sort: 9 }), p('Box 10', { sort: 0 })])).toEqual(['Box 2', 'Box 10']);
  });

  it('puts the Unplaced area before everything', () => {
    expect(
      names([
        p('Ground', { kindKey: 'floor' }),
        { ...p('Unplaced'), isUnplaced: true } as P,
        p('Attic'),
      ]),
    ).toEqual(['Unplaced', 'Ground', 'Attic']);
  });

  it('breaks a tie of equal names by id', () => {
    expect(
      [p('Shelf', { id: 'b' }), p('Shelf', { id: 'a' })]
        .sort(comparePlaceSiblings)
        .map((r) => r.id),
    ).toEqual(['a', 'b']);
  });
});
