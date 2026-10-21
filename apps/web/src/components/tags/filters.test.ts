import { describe, expect, it } from 'vitest';
import { filterParams } from '@/components/filters/params';
import { passesOffline, searchPhone } from '@/components/search/offline-results';
import { fromListState, toListState } from '@/lib/url-state';
import { MemoryStore } from '@/offline/store';
import { firstPage } from '@/test/store-contract';
import { matchTags, tagsOfSnap } from './offline';

const ACCOUNT = 'acc-1';
const tags = [
  { id: 'a', accountId: ACCOUNT, name: 'Camping', colour: '#30A46C' },
  { id: 'b', accountId: ACCOUNT, name: 'beach', colour: null },
  { id: 'c', accountId: 'acc-2', name: 'Camp kitchen', colour: null },
];

describe('"has all of" in the URL (#209)', () => {
  it('round-trips, and needs values and no "none of"', () => {
    const state = toListState({ 'f.tag': ['a', 'b'], all: ['tag'] });
    expect(state.all).toEqual(['tag']);
    expect(fromListState({ all: ['tag'] })).toMatchObject({ all: ['tag'] });
    expect(toListState({ all: ['tag'] }).all).toEqual([]);
    expect(toListState({ 'f.tag': ['a'], not: ['tag'], all: ['tag'] }).all).toEqual([]);
  });

  it('sends `all` for a filter with several values only', () => {
    const two = toListState({ 'f.tag': ['a', 'b'], all: ['tag'] });
    expect(filterParams(two, { tag: 'tagId' })).toEqual({ tagId: ['a', 'b'], all: ['tagId'] });
    const one = toListState({ 'f.tag': ['a'], all: ['tag'] });
    expect(filterParams(one, { tag: 'tagId' })).toEqual({ tagId: ['a'] });
  });
});

describe('tags offline', () => {
  const row = { locationId: 'l', typeId: null, tagIds: ['a', 'b'] } as unknown as Parameters<
    ReturnType<typeof passesOffline>
  >[0];
  it('search filters by tag: any, all or none', () => {
    expect(passesOffline({ tagId: ['a', 'z'] })(row)).toBe(true);
    expect(passesOffline({ tagId: ['a', 'z'], all: ['tagId'] })(row)).toBe(false);
    expect(passesOffline({ tagId: ['a', 'b'], all: ['tagId'] })(row)).toBe(true);
    expect(passesOffline({ tagId: ['a'], not: ['tagId'] })(row)).toBe(false);
  });

  it("names a thing's tags A to Z and leaves out ones the phone doesn't know", () => {
    expect(tagsOfSnap(['a', 'b', 'gone'], tags).map((g) => g.name)).toEqual(['beach', 'Camping']);
  });

  it("matches an account's tags by part of the name, folded", () => {
    expect(matchTags(tags, ACCOUNT, 'CAMP').map((g) => g.id)).toEqual(['a']);
    expect(matchTags(tags, ACCOUNT, '').map((g) => g.id)).toEqual(['b', 'a']);
  });
});

describe('offline search by a tag alone', () => {
  it('lists the things that have it, any or all of several, with no words typed', async () => {
    const page = firstPage();
    const [drill, box] = page.changes.things;
    const store = new MemoryStore();
    await store.applySnapshot({
      ...page,
      tags: { hash: 'h', items: tags },
      changes: {
        ...page.changes,
        things: page.changes.things.map((t) =>
          t.id === drill?.id
            ? { ...t, tagIds: ['a', 'b'] }
            : t.id === box?.id
              ? { ...t, tagIds: ['a'] }
              : t,
        ),
      },
    });
    const ids = async (params: Parameters<typeof searchPhone>[1]) =>
      (await searchPhone(store, params)).rows.map((r) => r.id).sort();
    expect(await ids({ tagId: ['a'] })).toEqual([drill?.id, box?.id].sort());
    expect(await ids({ tagId: ['a', 'b'], all: ['tagId'] })).toEqual([drill?.id]);
    expect((await searchPhone(store, { tagId: ['b'] })).rows[0]?.tags.map((g) => g.name)).toEqual([
      'beach',
      'Camping',
    ]);
    // "None of" a tag needs words: the phone doesn't list everything else.
    expect(await ids({ tagId: ['a'], not: ['tagId'] })).toEqual([]);
  });
});
