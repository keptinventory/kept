/**
 * Mock handlers for counts (1.14, #172): the Counts list, a count's result (from the counts the
 * mock's scan sessions saved, and Try Kept's past ones), a box check's lines, and a shared count
 * (opened, found in progress, its lines so far). Viewers read everything.
 */
import { accessOf, livePlace, liveThing, now } from '../inventory/mock/db';
import { INV_IDS } from '../inventory/mock/fixtures';
import { IDS, type MockState } from '../mock/fixtures';
import { err, type MockRoute, notFound, route, sessionGate } from '../mock/kit';
import { countsPaths as p } from './paths';
import type {
  BoxCheckDetail,
  CountResult,
  CountSummary,
  CountTarget,
  ResultLine,
  StartCountBody,
} from './types';

/** What the mock keeps of counts, beside the capture mock's scan lines. */
export type CountsMockState = {
  results: CountResult[];
  boxChecks: BoxCheckDetail[];
};

const stores = new WeakMap<MockState, CountsMockState>();
export function countsStore(state: MockState): CountsMockState {
  let s = stores.get(state);
  if (!s) {
    s = { results: pastCounts(state), boxChecks: [] };
    stores.set(state, s);
  }
  return s;
}

const daysAgo = (days: number, minutes = 0) =>
  new Date(Date.now() - days * 86_400_000 + minutes * 60_000).toISOString();

/**
 * The sample household's two past counts of Home's hallway closet (Try Kept): five weeks ago
 * everything was there; last week the Christmas lights were missing and one of the four scarves
 * was short, counted by Ibrahim and Alfred together.
 */
function pastCounts(state: MockState): CountResult[] {
  const inv = state.inventory;
  const I = INV_IDS;
  const closet = inv.places.find((p) => p.id === I.place.hallwayCloset);
  const things = [I.thing.box3, I.thing.scarves, I.thing.lights].map((id) =>
    inv.things.find((t) => t.id === id),
  );
  if (!closet || things.some((t) => !t)) return [];
  type T = NonNullable<(typeof things)[number]>;
  const [box, scarves, lights] = things as [T, T, T];
  const ibrahim: { id: string; displayName: string } = { id: IDS.ibrahim, displayName: 'Ibrahim' };
  const alfred = { id: 'u-alfred', displayName: 'Alfred' };
  const boxWhere = { id: box.id, name: box.name ?? '' };
  const closetWhere = { id: closet.id, name: closet.name };
  const line = (
    t: T,
    result: ResultLine['result'],
    at: string,
    readBy: typeof ibrahim,
    qty?: [string, string],
  ): ResultLine => ({
    thing: { id: t.id, name: t.name, shortCode: t.shortCode, trashed: false },
    result,
    was: t.containerId ? boxWhere : closetWhere,
    now: t.containerId ? boxWhere : closetWhere,
    area: closetWhere,
    foundQty: qty?.[0] ?? null,
    expectedQty: qty?.[1] ?? null,
    readAt: at,
    readBy,
  });
  const session = (
    id: string,
    started: string,
    finished: string,
    by: typeof ibrahim,
    totals: { seen: number; missing: number },
    readers: (typeof ibrahim)[],
  ): CountResult['session'] => ({
    id,
    locationId: closet.locationId,
    target: { type: 'place', id: closet.id, name: closet.name, inside: true },
    by,
    finishedBy: by,
    startedAt: started,
    finishedAt: finished,
    expected: 3,
    seen: totals.seen,
    notHere: 0,
    moved: 0,
    skipped: 0,
    missing: totals.missing,
    elsewhere: 0,
    onLoan: 0,
    inRepair: 0,
    notCounted: 0,
    recorded: true,
    countedPlaceIds: null,
    schedule: null,
    readers,
    undone: false,
  });
  const first = daysAgo(36);
  const second = daysAgo(6);
  return [
    {
      session: session(
        '01926f00-0000-7000-8000-0000000c0001',
        first,
        daysAgo(36, 9),
        ibrahim,
        { seen: 3, missing: 0 },
        [ibrahim],
      ),
      lines: [
        line(box, 'seen', first, ibrahim),
        line(scarves, 'seen', first, ibrahim),
        line(lights, 'seen', first, ibrahim),
      ],
      previous: null,
      compare: null,
    },
    {
      session: session(
        '01926f00-0000-7000-8000-0000000c0002',
        second,
        daysAgo(6, 14),
        alfred,
        { seen: 2, missing: 1 },
        [alfred, ibrahim],
      ),
      lines: [
        line(box, 'seen', second, alfred),
        line(scarves, 'seen', second, ibrahim, ['3', String(scarves.quantity)]),
        line(lights, 'missing', daysAgo(6, 14), alfred),
      ],
      previous: null,
      compare: null,
    },
  ];
}

const FOUND = new Set(['seen', 'move', 'elsewhere']);
const GONE = new Set(['missing', 'not_here']);

/** The target as the result names it. */
export function countTarget(
  state: MockState,
  t: { placeId: string; inside?: boolean } | { containerId: string } | { locationId: string },
): CountTarget {
  const inv = state.inventory;
  if ('placeId' in t)
    return {
      type: 'place',
      id: t.placeId,
      name: livePlace(inv, t.placeId)?.name ?? '',
      inside: t.inside ?? true,
    };
  if ('containerId' in t)
    return { type: 'thing', id: t.containerId, name: liveThing(inv, t.containerId)?.name ?? '' };
  return {
    type: 'location',
    id: t.locationId,
    name: state.locations.find((l) => l.id === t.locationId)?.name ?? '',
  };
}

/** Where a thing is now (its box, else its place). */
export function whereNow(state: MockState, thingId: string) {
  const inv = state.inventory;
  const t = inv.things.find((x) => x.id === thingId);
  if (!t) return null;
  if (t.containerId) {
    const box = inv.things.find((x) => x.id === t.containerId);
    return box ? { id: box.id, name: box.name ?? '' } : null;
  }
  const pl = t.placeId ? inv.places.find((x) => x.id === t.placeId) : null;
  return pl ? { id: pl.id, name: pl.name } : null;
}

/** The previous count of the same target, and the comparison with it. */
function withCompare(all: CountResult[], r: CountResult): CountResult {
  const same = (a: CountTarget, b: CountTarget) =>
    a.type === b.type && a.id === b.id && (a.inside ?? null) === (b.inside ?? null);
  const prev = all
    .filter(
      (x) =>
        x.session.id !== r.session.id &&
        x.session.finishedAt &&
        r.session.finishedAt &&
        x.session.finishedAt < r.session.finishedAt &&
        !x.session.undone &&
        same(x.session.target, r.session.target),
    )
    .sort((a, b) => (b.session.finishedAt ?? '').localeCompare(a.session.finishedAt ?? ''))[0];
  if (!prev) return { ...r, previous: null, compare: null };
  const before = new Map(prev.lines.map((l) => [l.thing.id, l.result]));
  const ids = (f: (l: ResultLine) => boolean) =>
    r.lines
      .filter(f)
      .map((l) => l.thing.id)
      .sort();
  return {
    ...r,
    previous: { id: prev.session.id, finishedAt: prev.session.finishedAt ?? '' },
    compare: {
      newlyMissing: ids((l) => GONE.has(l.result) && FOUND.has(before.get(l.thing.id) ?? '')),
      foundAgain: ids((l) => FOUND.has(l.result) && GONE.has(before.get(l.thing.id) ?? '')),
      newThings: ids((l) => !before.has(l.thing.id)),
    },
  };
}

const summaryOf = (r: CountResult): CountSummary => ({
  id: r.session.id,
  kind: 'count',
  at: r.session.finishedAt ?? r.session.startedAt,
  by: r.session.by,
  target: r.session.target,
  found: r.session.seen + r.session.moved,
  expected: r.session.expected,
  missing: r.session.missing,
  notHere: r.session.notHere,
  undone: r.session.undone,
});

const boxSummary = (b: BoxCheckDetail): CountSummary => {
  const listed = b.lines.filter((l) => Number(l.expectedQty) > 0);
  return {
    id: b.id,
    kind: 'box_check',
    at: b.at,
    by: b.by,
    target: { type: 'thing', id: b.container.id, name: b.container.name },
    found: listed.filter((l) => Number(l.foundQty) > 0).length,
    expected: listed.length,
    missing: listed.filter((l) => Number(l.foundQty) < Number(l.expectedQty)).length,
    notHere: listed.filter((l) => Number(l.foundQty) === 0).length,
    undone: false,
  };
};

export function countsMockRoutes(state: MockState): MockRoute[] {
  const access = () => accessOf(state);
  const store = () => countsStore(state);
  const me = () => ({ id: state.me.user.id, displayName: state.me.user.displayName });
  const scan = () => (state.capture.scanLines ??= {});

  return [
    route('GET', p.locationCounts(':id'), ({ params, query }) => {
      const gate = sessionGate(state);
      if (gate) return gate;
      const id = params.id ?? '';
      if (!access().visible(id)) return notFound();
      const q = (query.get('q') ?? '').toLocaleLowerCase();
      const kind = query.get('kind');
      const had = query.get('had');
      const by = query.get('by');
      const placeId = query.get('placeId');
      const limit = Number(query.get('limit') ?? 50) || 50;
      const from = Number(query.get('cursor') ?? 0) || 0;
      const items = [
        ...store()
          .results.filter((r) => r.session.locationId === id && r.session.finishedAt)
          .map(summaryOf),
        ...store()
          .boxChecks.filter((b) => b.locationId === id)
          .map(boxSummary),
      ]
        .filter(
          (c) =>
            (!kind || c.kind === kind) &&
            (!had || (c.missing ?? 0) > 0) &&
            (!by || c.by.id === by) &&
            (!placeId || c.target.id === placeId) &&
            (!q || c.target.name.toLocaleLowerCase().includes(q)),
        )
        .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
      const page = items.slice(from, from + limit);
      return {
        items: page,
        next_cursor: from + limit < items.length ? String(from + limit) : null,
      };
    }),

    route('GET', p.countResult(':id'), ({ params }) => {
      const gate = sessionGate(state);
      if (gate) return gate;
      const r = store().results.find((x) => x.session.id === params.id);
      if (!r || !access().visible(r.session.locationId)) return notFound();
      return withCompare(store().results, r);
    }),

    route('GET', p.countCsv(':id'), ({ params }) => {
      const r = store().results.find((x) => x.session.id === params.id);
      if (!r || !access().visible(r.session.locationId)) return notFound();
      return 'thing,short_id,where_expected,result,found,of,where_now\r\n';
    }),

    route('GET', p.boxCheck(':id'), ({ params }) => {
      const gate = sessionGate(state);
      if (gate) return gate;
      const b = store().boxChecks.find((x) => x.id === params.id);
      if (!b || !access().visible(b.locationId)) return notFound();
      return b;
    }),

    route('POST', p.startCount, ({ body }) => {
      const gate = sessionGate(state);
      if (gate) return gate;
      const b = body as StartCountBody;
      const target = countTarget(state, b.target);
      const locationId =
        'locationId' in b.target
          ? b.target.locationId
          : 'placeId' in b.target
            ? livePlace(state.inventory, b.target.placeId)?.locationId
            : liveThing(state.inventory, b.target.containerId)?.locationId;
      if (!locationId || !access().visible(locationId)) return notFound();
      if (!access().canWrite(locationId)) return err(403, 'forbidden', "You can't count here.");
      const held = scan()[b.id];
      if (held && held.by?.id !== me().id) return notFound();
      scan()[b.id] = held ?? {
        mode: 'count',
        locationId,
        lines: [],
        target,
        startedAt: b.startedAt ?? now(),
        by: me(),
        counted: b.countedPlaceIds ?? [],
      };
      return { id: b.id };
    }),

    route('GET', p.openCount, ({ query }) => {
      const gate = sessionGate(state);
      if (gate) return gate;
      const id = query.get('placeId') ?? query.get('containerId') ?? query.get('locationId');
      const found = Object.entries(scan()).find(
        ([, s]) => s.mode === 'count' && !s.finished && s.target?.id === id,
      );
      if (!found) return { session: null };
      const [sid, s] = found;
      const readers = new Map<string, { id: string; displayName: string }>();
      for (const l of s.lines) if (l.by) readers.set(l.by.id, l.by);
      return {
        session: {
          id: sid,
          target: s.target,
          startedAt: s.startedAt,
          lastReadAt: s.lines.at(-1)?.readAt ?? s.startedAt,
          by: s.by,
          readers: [...readers.values()],
          lines: s.lines.length,
          countedPlaceIds: s.counted ?? null,
        },
      };
    }),

    route('GET', p.countLines(':id'), ({ params }) => {
      const gate = sessionGate(state);
      if (gate) return gate;
      const s = scan()[params.id ?? ''];
      if (s?.mode !== 'count') return notFound();
      return {
        finishedAt: s.finished ? now() : null,
        countedPlaceIds: s.counted ?? null,
        lines: s.lines.map((l) => ({
          thingId: l.thingId,
          action: l.action,
          readAt: l.readAt,
          readBy: l.by ?? null,
          foundQty: l.quantity ?? null,
        })),
      };
    }),
  ];
}

/** The mock's finish of a count: its result, kept for the Counts page. */
export function recordCount(
  state: MockState,
  sessionId: string,
  expected: number | null,
  totals: { seen: number; notHere: number; moved: number; skipped: number },
): void {
  const s = state.capture.scanLines?.[sessionId];
  if (s?.mode !== 'count') return;
  const by = s.by ?? { id: state.me.user.id, displayName: state.me.user.displayName };
  const kept = (a: string) => s.lines.filter((l) => l.action === a).length;
  const inv = state.inventory;
  const lines: ResultLine[] = s.lines.map((l) => {
    const t = inv.things.find((x) => x.id === l.thingId);
    return {
      thing: {
        id: l.thingId,
        name: t?.name ?? null,
        shortCode: t?.shortCode ?? null,
        trashed: !!t?.deletedAt,
      },
      result: l.action,
      was: l.was ?? null,
      now: whereNow(state, l.thingId),
      area: null,
      foundQty: l.quantity ?? null,
      expectedQty: l.quantity && t ? String(t.quantity) : null,
      readAt: l.readAt,
      readBy: l.by ?? by,
    };
  });
  const result: CountResult = {
    session: {
      id: sessionId,
      locationId: s.locationId,
      target: s.target ?? { type: 'location', id: s.locationId, name: '' },
      by,
      finishedBy: { id: state.me.user.id, displayName: state.me.user.displayName },
      startedAt: s.startedAt ?? now(),
      finishedAt: now(),
      expected,
      ...totals,
      missing: kept('missing'),
      elsewhere: kept('elsewhere'),
      onLoan: kept('on_loan'),
      inRepair: kept('in_repair'),
      notCounted: kept('not_counted'),
      recorded: true,
      countedPlaceIds: s.counted?.length ? s.counted : null,
      schedule: null,
      readers: [by],
      undone: false,
    },
    lines,
    previous: null,
    compare: null,
  };
  const store = countsStore(state);
  store.results = [...store.results.filter((x) => x.session.id !== sessionId), result];
  s.finished = true;
}

/** For Try Kept and tests: a past count, as the server would have saved it. */
export function seedCount(state: MockState, r: CountResult): void {
  countsStore(state).results.push(r);
}
