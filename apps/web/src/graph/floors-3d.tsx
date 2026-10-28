/**
 * The 3D graph (#207, the design's Floors3D v4): the location above, each floor a layer at its
 * height with its rooms on a ring, what they hold fanned out beyond. Projected by hand
 * (./layout3d.ts): no WebGL, no library. It turns slowly by itself until anything is touched (and
 * starts still when the person asked for less motion); drag turns it, the wheel or a pinch zooms,
 * and the map's controls turn, tilt, zoom and show the whole house. The floor stack brings one
 * floor forward. Few labels: the location, its rooms, the picked node and what's in it.
 *
 * The node buttons stay in the tree's order whatever the turn, so Tab moves through them in a
 * steady order; depth only sets which draws over which.
 */
import { levelShort } from '@kept/shared';
import { useLingui } from '@lingui/react/macro';
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import type { GraphTag } from '@/api/graph/types';
import { tagStyle } from '@/components/tags/palette';
import {
  DownCtl,
  Glyph,
  HouseCtl,
  PauseCtl,
  PlayCtl,
  TurnLeftCtl,
  TurnRightCtl,
  UpCtl,
  useGestures,
  useSize,
} from './canvas';
import { declutter, type LabelBox, labelSize, type Obstacle } from './declutter';
import {
  BASE_SIZE,
  type Camera,
  depthOpacity,
  FLOOR_RING,
  PITCH,
  type Projected,
  project,
  START,
  type Vec3,
  world3D,
} from './layout3d';
import { chainOf, flagKinds, type GNode, type GraphTree, taggedIn, within } from './tree';
import type { GraphWords } from './words';

/** More nodes than this, and things show only inside the picked or focused branch. */
export const MAX_3D = 450;
/** Radians a second while it turns by itself. */
const SPIN = 0.09;
const ZOOM = { min: 0.5, max: 4 };
const NO_FLOOR = '_';

const zoomFor = (n: GNode) =>
  n.kind === 'location' ? 1 : n.kind === 'floor' ? 1.15 : n.kind === 'room' ? 1.7 : 2.2;

/** The nodes drawn: every place and box, and things while they fit (else the branch's). */
export function shownIn3D(tree: GraphTree, branch: GNode | null): GNode[] {
  const all = [...tree.byId.values()];
  const fits = all.length <= MAX_3D;
  return all.filter(
    (n) =>
      n.kind !== 'thing' ||
      fits ||
      (branch !== null && branch.kind !== 'location' && within(n, branch)),
  );
}

export function Floors3D({
  tree,
  focus,
  selected,
  selectedTag,
  tagsOn,
  words,
  reduced,
  onPick,
  onPickTag,
  onHome,
}: {
  tree: GraphTree;
  focus: GNode;
  selected: GNode | null;
  selectedTag: string | null;
  tagsOn: boolean;
  words: GraphWords;
  reduced: boolean;
  onPick: (n: GNode) => void;
  onPickTag: (tag: GraphTag) => void;
  onHome: () => void;
}) {
  const { t } = useLingui();
  const stage = useRef<HTMLDivElement>(null);
  const { w, h } = useSize(stage);
  const [yaw, setYaw] = useState(START.yaw);
  const [pitch, setPitch] = useState(START.pitch);
  const [zoom, setZoom] = useState(() => zoomFor(focus));
  const [spinning, setSpinning] = useState(!reduced);
  const [floor, setFloor] = useState<string>('all');
  const stop = () => setSpinning(false);

  useEffect(() => {
    if (reduced) setSpinning(false);
  }, [reduced]);
  useEffect(() => {
    if (!spinning) return;
    const id = setInterval(() => setYaw((y) => y + SPIN * 0.05), 50);
    return () => clearInterval(id);
  }, [spinning]);
  // Going in (or up) frames that node.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reframe on a change of focus only
  useEffect(() => setZoom(zoomFor(focus)), [focus.id]);

  const world = useMemo(() => world3D(tree, tagsOn ? tree.tags : null), [tree, tagsOn]);
  const branch = selected ?? (focus.kind === 'location' ? null : focus);
  const nodes = useMemo(() => shownIn3D(tree, branch), [tree, branch]);
  const shownIds = new Set(nodes.map((n) => n.id));

  const fit = w && h ? Math.min(w / 700, h / 636) : 1;
  const target: Vec3 =
    focus.kind === 'location'
      ? { x: 0, y: 0, z: 0 }
      : (world.pos.get(focus.id) ?? { x: 0, y: 0, z: 0 });
  const cam: Camera = { yaw, pitch, target, scale: fit * zoom * 0.84, cx: w / 2, cy: h / 2 };
  const sizeK = Math.max(0.7, Math.min(1.4, fit * zoom));

  const P = new Map<string, Projected>();
  for (const n of nodes) {
    const wp = world.pos.get(n.id);
    if (wp) P.set(n.id, project(wp, cam));
  }
  const tagP = new Map<string, Projected>();
  for (const g of world.tags) tagP.set(g.tag.id, project(g.pos, cam));

  // What is brought forward: the picked branch (its way up and all it holds), or a tag's things.
  const focusSet = new Set<string>();
  const anyFocus = !!selectedTag || (!!selected && selected.kind !== 'location');
  if (selectedTag) {
    for (const n of taggedIn(tree.root, selectedTag))
      for (const c of chainOf(n)) focusSet.add(c.id);
  } else if (selected && selected.kind !== 'location') {
    for (const c of chainOf(selected)) focusSet.add(c.id);
    const down = (n: GNode) => {
      focusSet.add(n.id);
      for (const k of n.children) down(k);
    };
    down(selected);
  }
  const floorOf = (n: GNode) => n.floorId ?? NO_FLOOR;
  const offFloor = (n: GNode) => floor !== 'all' && n.kind !== 'location' && floorOf(n) !== floor;
  const dimmed = (n: GNode) => (anyFocus && !focusSet.has(n.id)) || offFloor(n);

  const layers = world.layers.map((l) => {
    const c = project({ x: target.x * 0, y: l.y, z: 0 }, cam);
    const key = l.floor ? l.floor.id : NO_FLOOR;
    return {
      ...l,
      key,
      c,
      rw: FLOOR_RING * 2 * c.f * cam.scale,
      rh: FLOOR_RING * 2 * c.f * cam.scale * Math.sin(pitch),
    };
  });
  /** A floor's chip ends just before its ring, but never past the canvas's edge (phones). */
  const chipX = (l: { c: Projected; rw: number }, name: string) =>
    Math.max(labelSize(name, 13).w + 40, l.c.x - l.rw / 2 - 10);

  const zoomAt = (factor: number) =>
    setZoom((z) => Math.max(ZOOM.min, Math.min(ZOOM.max, z * factor)));
  const { dragging, handlers } = useGestures(stage, {
    onDrag: (dx, dy) => {
      setYaw((y) => y - dx * 0.008);
      setPitch((p) => Math.max(PITCH.min, Math.min(PITCH.max, p + dy * 0.006)));
    },
    onZoom: (factor) => zoomAt(factor),
    onInteract: stop,
  });

  // Labels: the picked node, the location, what the picked node holds, the rooms.
  const boxes: LabelBox[] = [];
  const labelAt = new Map<string, { x: number; y: number }>();
  const sizeOf = (n: GNode, p: Projected) =>
    Math.max(n.kind === 'thing' ? 10 : 16, Math.round(BASE_SIZE[n.kind] * p.f * sizeK));
  for (const n of nodes) {
    const p = P.get(n.id);
    if (!p || n.kind === 'floor' || dimmed(n)) continue;
    const tagged = !!selectedTag && n.tagIds.includes(selectedTag);
    const labelled =
      n.kind === 'location' ||
      n.kind === 'room' ||
      n === selected ||
      (selected !== null && n.parent === selected) ||
      tagged;
    if (!labelled) continue;
    const big = n.kind === 'location' || n.kind === 'room' || n === selected;
    const size = labelSize(words.name(n), big ? 12.5 : 11.5);
    const s = sizeOf(n, p);
    const x = p.x + s / 2 + 7;
    const y = p.y - size.h / 2;
    labelAt.set(n.id, { x, y });
    boxes.push({
      id: n.id,
      x,
      y,
      ...size,
      priority:
        n === selected ? 0 : n.kind === 'location' ? 1 : n.parent === selected || tagged ? 2 : 3,
    });
  }
  // Nodes (not things' dots), floor chips and tag chips are never written over by a label.
  const obstacles: Obstacle[] = [];
  for (const n of nodes) {
    const p = P.get(n.id);
    if (!p || n.kind === 'thing' || n.kind === 'floor' || dimmed(n)) continue;
    const s = sizeOf(n, p);
    obstacles.push({ id: n.id, x: p.x - s / 2, y: p.y - s / 2, w: s, h: s });
  }
  for (const l of layers) {
    if (!l.floor) continue;
    const cw = labelSize(l.floor.name, 13).w + 40;
    const x = chipX(l, l.floor.name);
    obstacles.push({ id: l.floor.id, x: x - cw, y: l.c.y - 16, w: cw, h: 32 });
  }
  if (tagsOn)
    for (const g of world.tags) {
      const p = tagP.get(g.tag.id);
      if (!p) continue;
      const cw = labelSize(g.tag.name, 12.5).w + 18;
      obstacles.push({ id: g.tag.id, x: p.x - cw / 2, y: p.y - 12, w: cw, h: 24 });
    }
  const shownLabels = declutter(boxes, { w, h }, 2, obstacles);

  const edges: { a: string; b: string; tag?: string; colour?: string | null }[] = [];
  for (const n of nodes)
    if (n.parent && shownIds.has(n.parent.id)) edges.push({ a: n.parent.id, b: n.id });
  if (tagsOn)
    for (const g of world.tags)
      for (const id of g.ids)
        if (shownIds.has(id))
          edges.push({ a: g.tag.id, b: id, tag: g.tag.id, colour: g.tag.colour });

  const floorIndex = new Map(tree.floors.map((fl, i) => [fl.id, i]));

  const nodeStyle = (n: GNode, p: Projected, s: number): CSSProperties => ({
    width: s,
    height: s,
    transform: `translate(${p.x - s / 2}px, ${p.y - s / 2}px)`,
    zIndex: Math.round(1000 + p.z),
    opacity: depthOpacity(p.z) * (dimmed(n) ? 0.3 : 1),
  });

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: focus inside stops the turning; the nodes are the controls
    <div
      ref={stage}
      className="kgraph-stage"
      data-dragging={dragging ? 'true' : 'false'}
      data-spinning={spinning ? 'true' : 'false'}
      onFocus={stop}
      onKeyDown={stop}
      {...handlers}
    >
      <svg className="kgraph-edges" aria-hidden="true">
        {layers.map((l) => (
          <ellipse
            key={l.key}
            cx={l.c.x}
            cy={l.c.y}
            rx={l.rw / 2}
            ry={Math.max(1, l.rh / 2)}
            className={floor === l.key ? 'on' : undefined}
            opacity={floor !== 'all' && floor !== l.key ? 0.35 : 1}
          />
        ))}
        {edges.map((e) => {
          const p = e.tag ? tagP.get(e.a) : P.get(e.a);
          const q = P.get(e.b);
          if (!p || !q) return null;
          const na = tree.byId.get(e.a);
          const nb = tree.byId.get(e.b) as GNode;
          const inFocus = focusSet.has(e.a) && focusSet.has(e.b);
          const off = (na ? offFloor(na) : false) || offFloor(nb);
          const op =
            depthOpacity((p.z + q.z) / 2) * (anyFocus && !inFocus ? 0.4 : 1) * (off ? 0.25 : 1);
          return (
            <line
              key={`${e.a}>${e.b}`}
              x1={p.x}
              y1={p.y}
              x2={q.x}
              y2={q.y}
              opacity={op}
              className={e.tag ? 'tag' : anyFocus && inFocus ? 'path' : undefined}
              style={e.tag ? tagStyle(e.colour) : undefined}
            />
          );
        })}
      </svg>
      <fieldset className="kgraph-layer" aria-label={t`Graph of ${words.name(tree.root)}`}>
        {nodes.map((n) => {
          const p = P.get(n.id);
          if (!p) return null;
          if (n.kind === 'floor') {
            const l = layers.find((x) => x.key === n.id);
            if (!l) return null;
            const on = floor === n.id;
            return (
              <button
                key={n.id}
                type="button"
                className="kgraph-node kgraph-level"
                data-on={on ? 'true' : 'false'}
                aria-pressed={n === selected}
                aria-label={words.label(n)}
                style={{
                  transform: `translate(${chipX(l, words.name(n))}px, ${l.c.y}px) translate(-100%, -50%)`,
                  zIndex: 3000,
                  opacity: floor !== 'all' && !on ? 0.5 : 1,
                }}
                onClick={() => onPick(n)}
              >
                <b>{levelShort(n.name, floorIndex.get(n.id) ?? 0)}</b>
                <bdi>{words.name(n)}</bdi>
              </button>
            );
          }
          const s = sizeOf(n, p);
          const flags = dimmed(n) ? [] : flagKinds(n);
          const label = labelAt.get(n.id);
          const z = Math.round(1000 + p.z);
          return (
            <Bits key={n.id}>
              <button
                type="button"
                className="kgraph-node"
                data-kind={n.kind === 'thing' ? 'thing3d' : n.kind}
                aria-pressed={n === selected}
                aria-label={words.label(n)}
                style={nodeStyle(n, p, s)}
                onClick={() => onPick(n)}
              >
                <Glyph node={n} short="" small={s < 18} />
              </button>
              {flags.length ? (
                <span
                  className="kgraph-flags"
                  aria-hidden="true"
                  style={{
                    transform: `translate(${p.x + s / 2 - 1}px, ${p.y - s / 2 - 5}px)`,
                    zIndex: z + 2,
                  }}
                >
                  {flags.map((k) => (
                    <span key={k} className={`kgraph-dot ${k}`} />
                  ))}
                </span>
              ) : null}
              {label && shownLabels.has(n.id) ? (
                <span
                  className={`kgraph-label${n.kind === 'location' || n.kind === 'room' || n === selected ? '' : ' small'}`}
                  aria-hidden="true"
                  style={{ transform: `translate(${label.x}px, ${label.y}px)`, zIndex: z + 1 }}
                >
                  <bdi>{words.name(n)}</bdi>
                </span>
              ) : null}
            </Bits>
          );
        })}
        {tagsOn
          ? world.tags.map((g) => {
              const p = tagP.get(g.tag.id);
              if (!p) return null;
              return (
                <button
                  key={g.tag.id}
                  type="button"
                  className="kgraph-node kgraph-tag"
                  aria-pressed={selectedTag === g.tag.id}
                  aria-label={words.tag(g.tag, g.ids.length)}
                  style={{
                    ...tagStyle(g.tag.colour),
                    transform: `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`,
                    zIndex: Math.round(1000 + p.z),
                    opacity: depthOpacity(p.z),
                  }}
                  onClick={() => onPickTag(g.tag)}
                >
                  <span className="kgraph-dot" aria-hidden="true" />
                  <bdi>{g.tag.name}</bdi>
                </button>
              );
            })
          : null}
      </fieldset>
      <div className="kgraph-ctl">
        {world.layers.length > 1 ? (
          <fieldset className="kgraph-floors" aria-label={t`Floor`}>
            {[...world.layers].reverse().map((l, i) => {
              const key = l.floor ? l.floor.id : NO_FLOOR;
              const name = l.floor ? words.name(l.floor) : t`Rooms on no floor`;
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={name}
                  title={name}
                  aria-pressed={floor === key}
                  onClick={() => {
                    stop();
                    setFloor(floor === key ? 'all' : key);
                  }}
                >
                  {l.floor ? levelShort(l.floor.name, floorIndex.get(l.floor.id) ?? i) : '–'}
                </button>
              );
            })}
            <button
              type="button"
              className="all"
              aria-label={t`All floors`}
              title={t`All floors`}
              aria-pressed={floor === 'all'}
              onClick={() => {
                stop();
                setFloor('all');
              }}
            >
              {t`All`}
            </button>
          </fieldset>
        ) : null}
        <button
          type="button"
          aria-label={spinning ? t`Stop turning` : t`Turn slowly`}
          onClick={() => setSpinning((s) => !s)}
        >
          {spinning ? <PauseCtl /> : <PlayCtl />}
        </button>
        <button
          type="button"
          aria-label={t`Turn left`}
          onClick={() => {
            stop();
            setYaw((y) => y - 0.45);
          }}
        >
          <TurnLeftCtl />
        </button>
        <button
          type="button"
          aria-label={t`Turn right`}
          onClick={() => {
            stop();
            setYaw((y) => y + 0.45);
          }}
        >
          <TurnRightCtl />
        </button>
        <button
          type="button"
          aria-label={t`Look from higher`}
          onClick={() => {
            stop();
            setPitch((p) => Math.min(PITCH.max, p + 0.14));
          }}
        >
          <UpCtl />
        </button>
        <button
          type="button"
          aria-label={t`Look from lower`}
          onClick={() => {
            stop();
            setPitch((p) => Math.max(PITCH.min, p - 0.14));
          }}
        >
          <DownCtl />
        </button>
        <button
          type="button"
          aria-label={t`Zoom in`}
          onClick={() => {
            stop();
            zoomAt(1.4);
          }}
        >
          +
        </button>
        <button
          type="button"
          aria-label={t`Zoom out`}
          onClick={() => {
            stop();
            zoomAt(1 / 1.4);
          }}
        >
          −
        </button>
        <button
          type="button"
          aria-label={t`Show the whole house`}
          onClick={() => {
            stop();
            setYaw(START.yaw);
            setPitch(START.pitch);
            setFloor('all');
            setZoom(1);
            onHome();
          }}
        >
          <HouseCtl />
        </button>
      </div>
    </div>
  );
}

function Bits({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
