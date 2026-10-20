/**
 * A session survives a reload, a crash or closing the app: every read is written to the phone
 * as it happens (one small row each, never the whole session), and the next start finds it.
 * One session per phone; a 401 clears it with the rest of the cache.
 */
import { newId } from '@kept/shared';
import { describe, expect, it } from 'vitest';
import { KeptDb } from '@/offline/db';
import { clearCache } from '@/offline/wipe';
import { fakeIdb } from '@/test/dexie';
import type { Resolution } from '../resolve';
import {
  addRead,
  type ExpectedThing,
  newSession,
  type Session,
  setTarget,
  undoLast,
} from './model';
import { dexiePersist, memoryPersist, type SessionPersist } from './persist';

const HOME = '01926f00-0000-7000-8000-00000000b002';
const STUDY = '01926f00-0000-7000-8000-00000000c001';
const AT = '2026-10-20T10:00:00.000Z';
const member = () => 'member' as const;

function thing(i: number): ExpectedThing {
  return {
    id: `01926f00-0000-7000-8000-${String(i).padStart(12, '0')}`,
    locationId: HOME,
    name: `Jar ${i}`,
    shortCode: null,
    placeId: STUDY,
    containerId: null,
    isContainer: false,
  };
}
const open = (t: ExpectedThing) => ({
  res: {
    outcome: 'open',
    target: { kind: 'thing', id: t.id, locationId: HOME },
    code: null,
    legacy: null,
    from: 'phone',
  } as Resolution,
});

function walk(n: number) {
  const expected = Array.from({ length: n + 1 }, (_, i) => thing(i + 1));
  let s = newSession({
    mode: 'count',
    target: { kind: 'place', id: STUDY, locationId: HOME, name: 'Study', inside: true },
    role: 'member',
    expected,
    now: AT,
  });
  const steps: Session[] = [s];
  for (const t of expected.slice(0, n)) {
    s = addRead(s, { text: `CODE${t.id.slice(-4)}`, at: AT }, open(t), member).session;
    steps.push(s);
  }
  return steps;
}

async function replay(p: SessionPersist, steps: Session[]) {
  let prev: Session | null = null;
  for (const s of steps) {
    await p.save(prev, s);
    prev = s;
  }
}

function contract(
  name: string,
  make: () => { persist: SessionPersist; reopen: () => SessionPersist },
) {
  describe(name, () => {
    it('finds the session again, reads in order, after a reload', async () => {
      const { persist, reopen } = make();
      const steps = walk(5);
      await replay(persist, steps);
      const back = await reopen().load();
      expect(back).toEqual(steps.at(-1));
    });

    it('keeps an undone read undone, and a target switch', async () => {
      const { persist, reopen } = make();
      const steps = walk(3);
      await replay(persist, steps);
      const last = steps.at(-1) as Session;
      const undone = undoLast(last);
      await persist.save(last, undone);
      const switched = setTarget(
        { ...undone, paused: true },
        {
          kind: 'place',
          id: STUDY,
          locationId: HOME,
          name: 'Study',
        },
      );
      await persist.save(undone, switched);
      expect(await reopen().load()).toEqual(switched);
    });

    it("keeps a count's summary choices: an area checked, a found count, the shared count", async () => {
      const { persist, reopen } = make();
      const steps = walk(2);
      await replay(persist, steps);
      const last = steps.at(-1) as Session;
      const chosen: Session = {
        ...last,
        checked: [STUDY],
        qty: { a: '2' },
        shared: { joined: true, by: 'Louis', others: [], counted: [STUDY] },
      };
      await persist.save(last, chosen);
      expect(await reopen().load()).toEqual(chosen);
    });

    it('holds one session: a new one replaces it, and clear removes it', async () => {
      const { persist, reopen } = make();
      await replay(persist, walk(2));
      const other = walk(1);
      await replay(persist, other);
      expect((await reopen().load())?.id).toBe(other[0]?.id);
      await persist.clear(other[0]?.id as string);
      expect(await reopen().load()).toBeNull();
    });
  });
}

contract('memoryPersist', () => {
  const p = memoryPersist();
  return { persist: p, reopen: () => p };
});

contract('dexiePersist (fake-indexeddb)', () => {
  const idb = fakeIdb();
  const userId = newId();
  return {
    persist: dexiePersist(new KeptDb(userId, idb)),
    reopen: () => dexiePersist(new KeptDb(userId, idb)),
  };
});

describe('dexiePersist', () => {
  it('writes one row per read, not the whole session each time', async () => {
    const db = new KeptDb(newId(), fakeIdb());
    const persist = dexiePersist(db);
    await replay(persist, walk(40));
    expect(await db.table('scanReads').count()).toBe(40);
    expect(await db.table('scanSessions').count()).toBe(1);
  });

  it('goes with the cache on a 401', async () => {
    const db = new KeptDb(newId(), fakeIdb());
    await replay(dexiePersist(db), walk(2));
    await clearCache(db);
    expect(await dexiePersist(db).load()).toBeNull();
  });
});
