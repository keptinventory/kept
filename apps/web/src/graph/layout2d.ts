/**
 * The 2D focus layout (#207), ported from the agreed design (Focus2D): the focused node in the
 * middle, the level below on a ring around it, and the level below that on an outer ring when
 * it fits. Deterministic, no graph library: each child of the focus gets an arc in proportion to
 * how much it has to show, its own children share that arc, and nothing is placed at random.
 *
 * Positions are in a fixed WORLD box; the view scales and pans them (./focus-2d.tsx), so node
 * sizes and labels stay readable at any zoom.
 */
import type { GraphTag } from '@/api/graph/types';
import { type Depth, type GNode, kidsAt, within } from './tree';

export const WORLD = { w: 760, h: 680 };
/** The outer ring shows when the level below it has at most this many nodes. */
export const RING2_MAX = 22;
/** At most this many nodes around the focus; the rest fold into one "N more" node. */
export const RING1_MAX = 24;

export type Placed2D =
  | {
      type: 'node';
      id: string;
      node: GNode;
      ring: 0 | 1 | 2;
      x: number;
      y: number;
      /** The angle from the centre, for a thing's label side. */
      a: number;
      size: number;
      /** It has things inside and none of its children are drawn: its count shows. */
      folded: boolean;
    }
  | {
      type: 'more';
      id: string;
      /** The node whose children didn't all fit. */
      of: GNode;
      count: number;
      ring: 1 | 2;
      x: number;
      y: number;
      a: number;
      size: number;
    }
  | {
      type: 'tag';
      id: string;
      tag: GraphTag;
      /** How many tagged things it links to. */
      count: number;
      x: number;
      y: number;
      a: number;
      size: number;
    };

export type Edge2D = {
  from: string;
  to: string;
  kind: 'tree' | 'tag';
  /** On the way from the root to the selected node: drawn stronger. */
  onPath: boolean;
  tagColour?: string | null;
};

export type Layout2D = {
  placed: Placed2D[];
  edges: Edge2D[];
  /** Whether the outer ring is drawn. */
  ring2: boolean;
};

/** A node's diameter in world units: things are small dots; the rest grow with what's inside. */
export function sizeOf(n: GNode, isFocus: boolean): number {
  const s = n.kind === 'thing' ? 24 : Math.max(30, Math.min(68, 26 + 7 * Math.sqrt(n.things)));
  return isFocus ? Math.max(s, 62) : s;
}

/** Up to RING1_MAX of `kids`, the rest as a count. */
function capped(kids: GNode[], max: number): { shown: GNode[]; rest: number } {
  if (kids.length <= max) return { shown: kids, rest: 0 };
  return { shown: kids.slice(0, max - 1), rest: kids.length - (max - 1) };
}

export function layout2D(opts: {
  focus: GNode;
  selected: GNode | null;
  depth: Depth;
  tags: GraphTag[] | null;
}): Layout2D {
  const { focus, depth } = opts;
  const cx = WORLD.w / 2;
  const cy = WORLD.h / 2;
  const base = Math.min(WORLD.w, WORLD.h) / 2 - 74;
  const placed: Placed2D[] = [];
  const edges: Edge2D[] = [];
  const pos = new Map<string, { x: number; y: number }>();
  const visible = new Set<string>();

  const add = (p: Placed2D) => {
    placed.push(p);
    pos.set(p.id, { x: p.x, y: p.y });
    if (p.type === 'node') visible.add(p.id);
  };

  const ring1 = capped(kidsAt(focus, depth), RING1_MAX);
  const ring2Kids = ring1.shown.map((c) => capped(kidsAt(c, depth), RING1_MAX));
  const ring2Count = ring2Kids.reduce((s, k) => s + k.shown.length + (k.rest ? 1 : 0), 0);
  const showRing2 = ring2Count <= RING2_MAX;
  const r1 = showRing2 ? base * 0.5 : base * 0.72;
  const r2 = base;

  add({
    type: 'node',
    id: focus.id,
    node: focus,
    ring: 0,
    x: cx,
    y: cy,
    a: 0,
    size: sizeOf(focus, true),
    folded: false,
  });

  type Slot =
    | { kind: 'node'; node: GNode; kids: { shown: GNode[]; rest: number } }
    | {
        kind: 'more';
        count: number;
      };
  const slots: Slot[] = ring1.shown.map((node, i) => ({
    kind: 'node' as const,
    node,
    kids: ring2Kids[i] ?? { shown: [], rest: 0 },
  }));
  if (ring1.rest) slots.push({ kind: 'more', count: ring1.rest });
  const weight = (s: Slot) =>
    showRing2 && s.kind === 'node' ? Math.max(1, s.kids.shown.length + (s.kids.rest ? 1 : 0)) : 1;
  const total = slots.reduce((s, x) => s + weight(x), 0) || 1;
  let acc = -Math.PI / 2;
  for (const slot of slots) {
    const span = (Math.PI * 2 * weight(slot)) / total;
    const a = acc + span / 2;
    const x = cx + r1 * Math.cos(a);
    const y = cy + r1 * Math.sin(a);
    if (slot.kind === 'more') {
      const id = `more:${focus.id}`;
      add({ type: 'more', id, of: focus, count: slot.count, ring: 1, x, y, a, size: 30 });
      edges.push({ from: focus.id, to: id, kind: 'tree', onPath: false });
    } else {
      const c = slot.node;
      const kids = slot.kids;
      add({
        type: 'node',
        id: c.id,
        node: c,
        ring: 1,
        x,
        y,
        a,
        size: sizeOf(c, false),
        folded: !(showRing2 && kids.shown.length > 0) && c.kind !== 'thing' && c.things > 0,
      });
      edges.push({ from: focus.id, to: c.id, kind: 'tree', onPath: false });
      if (showRing2) {
        const n = kids.shown.length + (kids.rest ? 1 : 0);
        kids.shown.forEach((k, j) => {
          const ka = acc + (span * (j + 0.5)) / n;
          add({
            type: 'node',
            id: k.id,
            node: k,
            ring: 2,
            x: cx + r2 * Math.cos(ka),
            y: cy + r2 * Math.sin(ka),
            a: ka,
            size: sizeOf(k, false),
            folded: k.kind !== 'thing' && k.things > 0,
          });
          edges.push({ from: c.id, to: k.id, kind: 'tree', onPath: false });
        });
        if (kids.rest) {
          const ka = acc + (span * (n - 0.5)) / n;
          const id = `more:${c.id}`;
          add({
            type: 'more',
            id,
            of: c,
            count: kids.rest,
            ring: 2,
            x: cx + r2 * Math.cos(ka),
            y: cy + r2 * Math.sin(ka),
            a: ka,
            size: 26,
          });
          edges.push({ from: c.id, to: id, kind: 'tree', onPath: false });
        }
      }
    }
    acc += span;
  }

  // Tags (the Tags switch): one chip per tag on something under the focus, linked to the nearest
  // drawn node that holds each tagged thing, pulled toward the middle of those nodes.
  if (opts.tags) {
    const nearest = (n: GNode): GNode | null => {
      for (let c: GNode | null = n; c; c = c.parent) if (visible.has(c.id)) return c;
      return null;
    };
    const byTag = new Map<string, Map<string, number>>();
    const walk = (n: GNode) => {
      for (const tagId of n.tagIds) {
        const v = nearest(n);
        if (!v || v === focus) continue;
        const m = byTag.get(tagId) ?? new Map<string, number>();
        m.set(v.id, (m.get(v.id) ?? 0) + 1);
        byTag.set(tagId, m);
      }
      for (const k of n.children) walk(k);
    };
    walk(focus);
    // The focus, its label below and its pins above are taken: a chip never sits on them.
    const used: { x: number; y: number }[] = [
      { x: cx, y: cy },
      { x: cx, y: cy + 48 },
      { x: cx + 34, y: cy - 34 },
    ];
    for (const tag of opts.tags) {
      const targets = byTag.get(tag.id);
      if (!targets?.size) continue;
      const ids = [...targets.keys()];
      const mx = ids.reduce((s, id) => s + (pos.get(id)?.x ?? cx), 0) / ids.length;
      const my = ids.reduce((s, id) => s + (pos.get(id)?.y ?? cy), 0) / ids.length;
      const dx = mx - cx;
      const dy = my - cy;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const toward = d < 1 ? -Math.PI / 2 : Math.atan2(dy, dx);
      // Toward its things, between the focus and the first ring; a chip that would sit on another
      // (or on the focus) turns a little either way, then moves out, so none hides another.
      const free = (x: number, y: number) =>
        !used.some((u) => Math.abs(u.x - x) < 78 && Math.abs(u.y - y) < 28);
      let x = cx + r1 * 0.55 * Math.cos(toward);
      let y = cy + r1 * 0.55 * Math.sin(toward);
      search: for (const reach of [0.55, 0.8, 1.05, 1.3]) {
        for (const turn of [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9]) {
          const tx = cx + r1 * reach * Math.cos(toward + turn);
          const ty = cy + r1 * reach * Math.sin(toward + turn);
          if (free(tx, ty)) {
            x = tx;
            y = ty;
            break search;
          }
        }
      }
      const a = Math.atan2(y - cy, x - cx);
      used.push({ x, y });
      const id = `tag:${tag.id}`;
      const count = [...targets.values()].reduce((s, n) => s + n, 0);
      add({ type: 'tag', id, tag, count, x, y, a, size: 28 });
      for (const to of ids)
        edges.push({ from: id, to, kind: 'tag', onPath: false, tagColour: tag.colour });
    }
  }

  // The path from the focus to the selected node draws stronger.
  const sel = opts.selected && within(opts.selected, focus) ? opts.selected : null;
  if (sel) {
    const onPath = new Set<string>();
    for (let c: GNode | null = sel; c && c !== focus.parent; c = c.parent) onPath.add(c.id);
    for (const e of edges) if (e.kind === 'tree' && onPath.has(e.to)) e.onPath = true;
  }
  return { placed, edges, ring2: showRing2 };
}
