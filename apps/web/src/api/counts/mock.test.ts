/**
 * The counts mock answers its contract through the real fetchers (./queries.ts): every path in
 * ./paths.ts has a handler, the sample household has two past counts of the hallway closet (the
 * second compared with the first), and a count opened online is found in progress and its lines
 * read back.
 */
import { newId } from '@kept/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { INV_IDS } from '../inventory/mock/fixtures';
import { IDS, type MockState, ownerScenario } from '../mock/fixtures';
import { createMockApi } from '../mock/server';
import { countsMockRoutes } from './mock';
import { COUNTS_METHODS, countsPaths } from './paths';
import { countsApi as api } from './queries';

const use = (state: MockState) => {
  vi.stubGlobal('fetch', createMockApi(state).fetch);
  return state;
};
afterEach(() => vi.unstubAllGlobals());

describe('the counts mock', () => {
  it('has a handler for every path and method the web calls', () => {
    const routes = countsMockRoutes(ownerScenario());
    const matches = (template: string, path: string) =>
      new RegExp(
        `^${template
          .split('/')
          .map((part) => (part.startsWith('%3A') ? '[^/]+' : part))
          .join('/')}$`,
      ).test(path);
    const missing: string[] = [];
    for (const [key, methods] of Object.entries(COUNTS_METHODS)) {
      const v = countsPaths[key as keyof typeof countsPaths] as string | ((id: string) => string);
      const path = typeof v === 'string' ? v : v('a');
      for (const method of methods)
        if (!routes.some((r) => r.method === method && matches(r.template, path)))
          missing.push(`${method} ${path}`);
    }
    expect(missing).toEqual([]);
  });

  it('lists the two past counts, newest first, and compares the second with the first', async () => {
    use(ownerScenario());
    const page = await api.list(IDS.home);
    expect(page.items.map((c) => [c.kind, c.found, c.expected, c.missing])).toEqual([
      ['count', 2, 3, 1],
      ['count', 3, 3, 0],
    ]);
    expect((await api.list(IDS.home, { had: 'missing' })).items).toHaveLength(1);
    const latest = await api.result(page.items[0]?.id as string);
    expect(latest.previous?.id).toBe(page.items[1]?.id);
    expect(latest.compare).toEqual({
      newlyMissing: [INV_IDS.thing.lights],
      foundAgain: [],
      newThings: [],
    });
    expect(latest.session.readers.map((r) => r.displayName)).toEqual(['Alfred', 'Ibrahim']);
  });

  it('finds a count opened online in progress, and reads its lines back', async () => {
    use(ownerScenario());
    const id = newId();
    await api.start({ id, target: { placeId: INV_IDS.place.office, inside: true } });
    const open = await api.open({ placeId: INV_IDS.place.office });
    expect(open.session).toMatchObject({ id, by: { displayName: 'Ibrahim' }, lines: 0 });
    expect((await api.open({ placeId: INV_IDS.place.kitchen })).session).toBeNull();
    expect(await api.lines(id)).toMatchObject({ finishedAt: null, lines: [] });
  });
});
