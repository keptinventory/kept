/**
 * The graph view's tree (#207): the server's flat read made into one tree under the location,
 * with each node's kind, how many things are inside it, its pins summed up the tree, and its tags.
 * Pure, shared by the 2D focus rings (./layout2d.ts) and the 3D floors (./layout3d.ts).
 *
 * Kinds: a top-level place of the built-in `floor` kind is a floor; a place at the top or directly
 * on a floor is a room (whatever its kind, as on the map); a place deeper down is a spot (zone,
 * closet, shelf…); a container thing is a box; anything else is a thing.
 */
import type { GraphFlag, GraphTag, GraphView } from '@/api/graph/types';

export type NodeKind = 'location' | 'floor' | 'room' | 'spot' | 'box' | 'thing';
export type Depth = 'rooms' | 'boxes' | 'all';
export const FLAGS: readonly GraphFlag[] = ['low', 'lent', 'due'];

export type GNode = {
  id: string;
  kind: NodeKind;
  name: string;
  parent: GNode | null;
  children: GNode[];
  /** The place's own kind (`room`, `zone`, a custom key); null for things and the location. */
  kindKey: string | null;
  typeKey: string | null;
  typeName: string | null;
  shortCode: string | null;
  isUnplaced: boolean;
  /** Things inside it, at any depth: those past the server's cap too. Boxes are things. */
  things: number;
  /** Its own pins (a thing's, or a place's due schedule). */
  own: GraphFlag[];
  /** Pins inside it and its own, by kind. */
  flags: Record<GraphFlag, number>;
  /** A thing's tags. */
  tagIds: string[];
  /** The floor it is on (itself for a floor), or null. */
  floorId: string | null;
  depth: number;
};

export type GraphTree = {
  root: GNode;
  byId: Map<string, GNode>;
  tags: GraphTag[];
  /** The floors, in the tree's order (the first is the ground). */
  floors: GNode[];
  /** Things past the server's cap, drawn only as counts. */
  more: number;
};

const none = (): Record<GraphFlag, number> => ({ low: 0, lent: 0, due: 0 });

function node(
  id: string,
  kind: NodeKind,
  name: string,
  extra: Partial<
    Pick<GNode, 'kindKey' | 'typeKey' | 'typeName' | 'shortCode' | 'isUnplaced' | 'tagIds'>
  > = {},
): GNode {
  return {
    id,
    kind,
    name,
    parent: null,
    children: [],
    kindKey: extra.kindKey ?? null,
    typeKey: extra.typeKey ?? null,
    typeName: extra.typeName ?? null,
    shortCode: extra.shortCode ?? null,
    isUnplaced: extra.isUnplaced ?? false,
    things: 0,
    own: [],
    flags: none(),
    tagIds: extra.tagIds ?? [],
    floorId: null,
    depth: 0,
  };
}

/** The tree of `view`, under a root named for the location. */
export function buildTree(view: GraphView, location: { id: string; name: string }): GraphTree {
  const root = node(location.id, 'location', location.name, { shortCode: null });
  const byId = new Map<string, GNode>([[root.id, root]]);
  const placeById = new Map(view.places.map((p) => [p.id, p]));
  const isFloor = (id: string | null) => {
    const p = id ? placeById.get(id) : undefined;
    return !!p && p.kindKey === 'floor' && p.parentId === null && !p.isUnplaced;
  };
  for (const p of view.places) {
    const kind: NodeKind = isFloor(p.id)
      ? 'floor'
      : p.parentId === null || isFloor(p.parentId)
        ? 'room'
        : 'spot';
    byId.set(
      p.id,
      node(p.id, kind, p.name, {
        kindKey: p.kindKey,
        shortCode: p.shortCode,
        isUnplaced: p.isUnplaced,
      }),
    );
  }
  for (const t of view.things) {
    byId.set(
      t.id,
      node(t.id, t.isContainer ? 'box' : 'thing', t.name, {
        typeKey: t.typeKey,
        typeName: t.typeName,
        shortCode: t.shortCode,
        tagIds: t.tagIds,
      }),
    );
  }
  const attach = (child: GNode, parentId: string | null) => {
    const parent = (parentId && byId.get(parentId)) || null;
    // A thing whose box is past the cap has nowhere to hang: it is counted, not drawn.
    if (!parent && child.kind !== 'floor' && child.kind !== 'room' && child.kind !== 'spot')
      return false;
    const p = parent ?? root;
    child.parent = p;
    p.children.push(child);
    return true;
  };
  // Places in the server's (the tree's) order, the Unplaced area last; then boxes, then things.
  const places = [...view.places].sort((a, b) => Number(a.isUnplaced) - Number(b.isUnplaced));
  for (const p of places) attach(byId.get(p.id) as GNode, p.parentId);
  const dropped = new Set<string>();
  for (const t of view.things) {
    const n = byId.get(t.id) as GNode;
    if (!attach(n, t.containerId ?? t.placeId)) dropped.add(t.id);
  }
  for (const id of dropped) byId.delete(id);

  const direct = new Map(view.counts.map((c) => [c.holderId, c.things]));
  const visit = (n: GNode, depth: number, floorId: string | null) => {
    n.depth = depth;
    n.floorId = n.kind === 'floor' ? n.id : floorId;
    let things =
      direct.get(n.id) ?? n.children.filter((k) => k.kind === 'box' || k.kind === 'thing').length;
    for (const k of n.children) {
      visit(k, depth + 1, n.floorId);
      things += k.things;
    }
    n.things = things;
  };
  visit(root, 0, null);

  const seen = new Set<string>();
  for (const a of view.attention) {
    const key = `${a.subjectId} ${a.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const subject = byId.get(a.subjectId);
    if (subject && !subject.own.includes(a.kind)) subject.own.push(a.kind);
    let up: GNode | null = subject ?? (a.holderId ? (byId.get(a.holderId) ?? null) : null);
    while (up) {
      up.flags[a.kind]++;
      up = up.parent;
    }
  }
  const floors = root.children.filter((k) => k.kind === 'floor');
  return { root, byId, tags: view.tags, floors, more: view.more };
}

/** Its children at `depth`: places only (Rooms), places and boxes (Boxes), or everything. */
export function kidsAt(n: GNode, depth: Depth): GNode[] {
  if (depth === 'all') return n.children;
  return n.children.filter((k) => k.kind !== 'thing' && (depth === 'boxes' || k.kind !== 'box'));
}

/** From the root down to `n`, itself last. */
export function chainOf(n: GNode): GNode[] {
  const out: GNode[] = [];
  for (let c: GNode | null = n; c; c = c.parent) out.unshift(c);
  return out;
}

/** Whether `n` is `of` or inside it. */
export function within(n: GNode, of: GNode): boolean {
  for (let c: GNode | null = n; c; c = c.parent) if (c === of) return true;
  return false;
}

/** The kinds of pin it carries or holds, in the map's order. */
export const flagKinds = (n: GNode): GraphFlag[] => FLAGS.filter((k) => n.flags[k] > 0);

/** Every node under `n` (itself included) carrying tag `tagId`. */
export function taggedIn(n: GNode, tagId: string): GNode[] {
  const out: GNode[] = [];
  const walk = (c: GNode) => {
    if (c.tagIds.includes(tagId)) out.push(c);
    for (const k of c.children) walk(k);
  };
  walk(n);
  return out;
}

/** The nearest place that holds `n` (itself for a place), or null for the location. */
export function placeOf(n: GNode): GNode | null {
  for (let c: GNode | null = n; c; c = c.parent)
    if (c.kind === 'floor' || c.kind === 'room' || c.kind === 'spot') return c;
  return null;
}
