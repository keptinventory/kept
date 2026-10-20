/**
 * Where a thing on the map is, as its card says it (#161): Kept's path to it (its room, then the
 * places and things it is kept in), then what it stands on, outermost first. A holder it is kept
 * in and stands on is named once: "Open space › Desk 3", not "… › Desk 3 › Desk 3". Two holders
 * that only share a name are both named.
 */
import type { MapView } from '@/api/map/types';
import type { Item, Plan } from './layout';
import { whereOf } from './list';

export function cardPath(plan: Plan, view: Pick<MapView, 'things'>, it: Item): string[] {
  const nodes = new Map(plan.items.map((i) => [i.id, i]));
  const things = new Map(view.things.map((t) => [t.id, t]));
  const rooms = new Set(plan.rooms.map((r) => r.id));
  // What it is kept in, by id: the path already names each of these.
  const keptIn = new Set<string>();
  for (let cur: string | undefined = it.parentId, g = 0; cur && !rooms.has(cur) && g < 20; g++) {
    keptIn.add(cur);
    cur = nodes.get(cur)?.parentId ?? things.get(cur)?.parentId;
  }
  const hosts: string[] = [];
  for (let h = it.on ? nodes.get(it.on) : undefined, g = 0; h && g < 10; g++) {
    if (!keptIn.has(h.id)) hosts.unshift(h.name);
    h = h.on ? nodes.get(h.on) : undefined;
  }
  const path = whereOf(plan, view, it.id).path;
  const room = plan.rooms.find((r) => r.id === it.roomId);
  return [...(path.length ? path : room ? [room.name] : []), ...hosts];
}
