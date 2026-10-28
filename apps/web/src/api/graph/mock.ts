/**
 * The graph view's read (#207) over the mock inventory, by the rules of
 * apps/server/src/graph/view.ts: every place, the live things in use (no drafts) with their tag
 * ids, containers first; every holder's count; the pins (lent out from the mock's loans, due soon
 * from its schedules due within a month; the mock keeps no stock rules) and the tags in use.
 */
import type { MockState } from '../mock/fixtures';
import { type MockRoute, notFound, route } from '../mock/kit';
import { graphPaths as p } from './paths';
import type { GraphView } from './types';

const DAY = 86_400_000;

/** A schedule's next due day in the mock: its one-off date, or its anchor plus its interval. */
function nextDue(s: { dueOn: string | null; anchorOn: string; everyMonths: number | null }) {
  if (s.dueOn) return new Date(s.dueOn).getTime();
  if (!s.everyMonths) return null;
  const d = new Date(s.anchorOn);
  d.setMonth(d.getMonth() + s.everyMonths);
  return d.getTime();
}

export function mockGraphView(state: MockState, locationId: string): GraphView | null {
  if (!state.locations.some((l) => l.id === locationId)) return null;
  const inv = state.inventory;
  const places = inv.places.filter((x) => x.locationId === locationId && !x.deletedAt);
  const things = inv.things
    .filter(
      (x) =>
        x.locationId === locationId &&
        !x.deletedAt &&
        x.lifecycle === 'in_use' &&
        x.reviewState !== 'draft',
    )
    .sort(
      (a, b) =>
        Number(b.isContainer) - Number(a.isContainer) ||
        (a.name ?? '').localeCompare(b.name ?? '') ||
        (a.id < b.id ? -1 : 1),
    );
  const counts = new Map<string, number>();
  const holder = new Map<string, string | null>();
  for (const t of things) {
    const h = t.containerId ?? t.placeId;
    holder.set(t.id, h);
    if (h) counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  const placeParent = new Map(places.map((x) => [x.id, x.parentId]));
  const attention: GraphView['attention'] = [];
  for (const l of state.household?.loans ?? []) {
    if (l.locationId !== locationId || l.returnedAt || l.direction !== 'out') continue;
    if (holder.has(l.thingId))
      attention.push({
        subjectId: l.thingId,
        holderId: holder.get(l.thingId) ?? null,
        kind: 'lent',
      });
  }
  const soon = Date.now() + 30 * DAY;
  for (const s of state.household?.schedules ?? []) {
    if (s.locationId !== locationId || !s.active) continue;
    const due = nextDue(s);
    if (due === null || due > soon) continue;
    const id = 'thingId' in s.subject ? s.subject.thingId : s.subject.placeId;
    if (holder.has(id))
      attention.push({ subjectId: id, holderId: holder.get(id) ?? null, kind: 'due' });
    else if (placeParent.has(id))
      attention.push({ subjectId: id, holderId: placeParent.get(id) ?? null, kind: 'due' });
  }
  const used = new Set(things.flatMap((t) => t.tags.map((g) => g.id)));
  return {
    locationId,
    places: [...places]
      .sort((a, b) => Number(a.isUnplaced) - Number(b.isUnplaced) || a.sort - b.sort)
      .map((x) => ({
        id: x.id,
        parentId: x.parentId,
        name: x.name,
        kindKey: x.kindKey,
        shortCode: x.shortCode,
        isUnplaced: x.isUnplaced,
      })),
    things: things.map((t) => ({
      id: t.id,
      name: t.name ?? '',
      shortCode: t.shortCode,
      placeId: t.placeId,
      containerId: t.containerId,
      isContainer: t.isContainer,
      typeKey: t.type?.builtinKey ?? null,
      typeName: t.type && !t.type.builtinKey ? t.type.name : null,
      tagIds: t.tags.map((g) => g.id),
    })),
    counts: [...counts].map(([holderId, n]) => ({ holderId, things: n })),
    more: 0,
    attention,
    tags: inv.tags
      .filter((g) => used.has(g.id))
      .map((g) => ({ id: g.id, name: g.name, colour: g.colour }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export function graphMockRoutes(state: MockState): MockRoute[] {
  return [
    route(
      'GET',
      p.graph(':id'),
      ({ params }) => mockGraphView(state, params.id as string) ?? notFound(),
    ),
  ];
}
