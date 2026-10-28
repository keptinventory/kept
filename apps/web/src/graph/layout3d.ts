/**
 * The 3D graph's layout and projection (#207), ported from the agreed design (Floors3D v4): the
 * location above, each floor a layer at its own height, the rooms on a ring around their floor,
 * what is in a room fanned out beyond it and things beyond their box. Rooms on no floor share a
 * layer of their own, the lowest, as on the map; a location with no floors is one layer.
 *
 * No WebGL and no library: world positions are worked out once (`world3D`), and each frame
 * projects them with a turn (yaw) and a tilt (pitch) onto the page (`project`), where the view
 * draws positioned elements ordered by depth.
 */
import type { GraphTag } from '@/api/graph/types';
import { type GNode, type GraphTree, taggedIn } from './tree';

export type Vec3 = { x: number; y: number; z: number };

/** The gap between two layers, and the ring a floor's rooms sit on. */
export const LAYER_GAP = 175;
export const ROOM_RING = 150;
/** The ring drawn under each layer. */
export const FLOOR_RING = 300;
const RADII = [ROOM_RING, 245, 318, 372, 418];
const radiusAt = (d: number) => RADII[Math.min(d, RADII.length - 1)] as number;

export type Layer = {
  /** A floor, or null for the rooms on no floor. */
  floor: GNode | null;
  y: number;
};

export type World3D = {
  pos: Map<string, Vec3>;
  layers: Layer[];
  /** Tag chips, with where they float and what they link to. */
  tags: { tag: GraphTag; pos: Vec3; ids: string[] }[];
};

/** Each layer's rooms: a floor's places, or the rooms at the top on no floor. */
function layersOf(tree: GraphTree): { floor: GNode | null; rooms: GNode[] }[] {
  const top = tree.root.children;
  const loose = top.filter((k) => k.kind !== 'floor');
  const out: { floor: GNode | null; rooms: GNode[] }[] = [];
  if (loose.length > 0 || tree.floors.length === 0) out.push({ floor: null, rooms: loose });
  for (const f of tree.floors) out.push({ floor: f, rooms: f.children });
  return out;
}

/**
 * Where everything is, in world units (y up). Deterministic: the same tree always gives the
 * same positions, whatever was drawn before.
 */
export function world3D(tree: GraphTree, withTags: GraphTag[] | null = null): World3D {
  const pos = new Map<string, Vec3>();
  const layerList = layersOf(tree);
  const n = layerList.length;
  const layers: Layer[] = layerList.map((l, i) => ({
    floor: l.floor,
    y: (i - (n - 1) / 2) * LAYER_GAP,
  }));
  const topY = (layers[layers.length - 1]?.y ?? 0) + 110 + (n > 1 ? 0 : 175);
  pos.set(tree.root.id, { x: 0, y: topY, z: 0 });

  const fan = (k: GNode, a: number, span: number, depth: number, y: number) => {
    const r = radiusAt(depth);
    pos.set(k.id, { x: r * Math.cos(a), y, z: r * Math.sin(a) });
    const kids = k.children;
    if (!kids.length) return;
    if (depth === 0) {
      // A room's own: spread over its arc, a little above and below its floor in turn.
      kids.forEach((c, j) => {
        const ka = a - span / 2 + (span * (j + 0.5)) / kids.length;
        fan(c, ka, span / kids.length, 1, y + (j % 2 ? 22 : -18));
      });
      return;
    }
    // Deeper: a narrow fan around the parent's angle, stacked a little in height.
    const spread = Math.min(0.45, span);
    const step = Math.min(24, 160 / kids.length);
    kids.forEach((c, m) => {
      const off = m - (kids.length - 1) / 2;
      fan(
        c,
        a + (off * spread) / Math.max(1, kids.length),
        spread / kids.length,
        depth + 1,
        y + off * step,
      );
    });
  };

  layerList.forEach((l, fi) => {
    const fy = layers[fi]?.y ?? 0;
    if (l.floor) pos.set(l.floor.id, { x: 0, y: fy, z: 0 });
    const rooms = l.rooms;
    const tot = rooms.reduce((s, r) => s + Math.max(1, r.children.length), 0) || 1;
    let acc = fi * 2.1 + 0.4;
    for (const r of rooms) {
      const span = (Math.PI * 2 * Math.max(1, r.children.length)) / tot;
      fan(r, acc + span / 2, span, 0, fy);
      acc += span;
    }
  });

  const tags: World3D['tags'] = [];
  for (const tag of withTags ?? []) {
    const ids = taggedIn(tree.root, tag.id)
      .map((t) => t.id)
      .filter((id) => pos.has(id));
    if (!ids.length) continue;
    const c = ids.reduce(
      (s, id) => {
        const p = pos.get(id) as Vec3;
        return { x: s.x + p.x, y: s.y + p.y, z: s.z + p.z };
      },
      { x: 0, y: 0, z: 0 },
    );
    const x = c.x / ids.length;
    const z = c.z / ids.length;
    const d = Math.sqrt(x * x + z * z) || 1;
    tags.push({ tag, ids, pos: { x: (x / d) * 380, y: c.y / ids.length + 70, z: (z / d) * 380 } });
  }
  return { pos, layers, tags };
}

export type Camera = {
  yaw: number;
  pitch: number;
  /** The world point the view turns around (the focused node's). */
  target: Vec3;
  /** On-screen units per world unit at the target's depth. */
  scale: number;
  /** The page point the target is drawn at. */
  cx: number;
  cy: number;
};

export const START = { yaw: -0.55, pitch: 0.42 };
/** The eye's distance: nearer things grow, farther ones shrink. */
export const EYE = 1150;
export const PITCH = { min: 0.08, max: 1.05 };

export type Projected = {
  x: number;
  y: number;
  /** Toward the eye is larger. */
  z: number;
  /** Perspective: 1 at the target's depth, more when nearer. */
  f: number;
};

export function project(w: Vec3, cam: Camera): Projected {
  const px = w.x - cam.target.x;
  const py = w.y - cam.target.y;
  const pz = w.z - cam.target.z;
  const cos = Math.cos(cam.yaw);
  const sin = Math.sin(cam.yaw);
  const X = px * cos - pz * sin;
  const Z = px * sin + pz * cos;
  const Y2 = py * Math.cos(cam.pitch) - Z * Math.sin(cam.pitch);
  const Z2 = py * Math.sin(cam.pitch) + Z * Math.cos(cam.pitch);
  const f = EYE / Math.max(80, EYE - Z2);
  return { x: cam.cx + X * f * cam.scale, y: cam.cy - Y2 * f * cam.scale, z: Z2, f };
}

/** Farther fades: nothing goes below a third. */
export const depthOpacity = (z: number): number => Math.max(0.32, Math.min(1, 0.62 + z / 720));

/** Each kind's size on the page at the target's depth, before perspective. */
export const BASE_SIZE: Record<GNode['kind'], number> = {
  location: 44,
  floor: 0,
  room: 26,
  spot: 17,
  box: 17,
  thing: 8,
};

/** Ids in painting order: the farthest first, so nearer nodes draw over them. */
export function paintOrder(projected: Map<string, Projected>): string[] {
  return [...projected.keys()].sort((a, b) => {
    const d = (projected.get(a)?.z ?? 0) - (projected.get(b)?.z ?? 0);
    return d !== 0 ? d : a < b ? -1 : 1;
  });
}
