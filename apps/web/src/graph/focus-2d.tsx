/**
 * The 2D focus graph (#207, the default): the focused node in the middle and two levels around
 * it (./layout2d.ts), drawn as positioned buttons over one SVG of links. Drag to pan, wheel or
 * pinch to zoom; the map's controls zoom and show the whole house. Node sizes and labels keep
 * their size at any zoom; labels that would collide wait (./declutter.ts).
 */
import { levelShort } from '@kept/shared';
import { useLingui } from '@lingui/react/macro';
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import type { GraphTag } from '@/api/graph/types';
import { tagStyle } from '@/components/tags/palette';
import { useFormat } from '@/lib/format';
import { Glyph, HouseCtl, useGestures, useSize } from './canvas';
import { declutter, type LabelBox, labelSize } from './declutter';
import { layout2D, type Placed2D, WORLD } from './layout2d';
import { type Depth, flagKinds, type GNode, type GraphTree } from './tree';
import type { GraphWords } from './words';

const ZOOM = { min: 0.4, max: 4 };

export function Focus2D({
  tree,
  focus,
  selected,
  selectedTag,
  depth,
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
  depth: Depth;
  tagsOn: boolean;
  words: GraphWords;
  reduced: boolean;
  onPick: (n: GNode) => void;
  onPickTag: (tag: GraphTag) => void;
  onHome: () => void;
}) {
  const { t } = useLingui();
  const f = useFormat();
  const stage = useRef<HTMLDivElement>(null);
  const { w, h } = useSize(stage);
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  // A new focus starts centred.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on a change of focus only
  useEffect(() => setView({ zoom: 1, x: 0, y: 0 }), [focus.id]);

  const layout = useMemo(
    () => layout2D({ focus, selected, depth, tags: tagsOn ? tree.tags : null }),
    [focus, selected, depth, tagsOn, tree.tags],
  );
  const fit = w && h ? Math.min(w / WORLD.w, h / WORLD.h) : 1;
  const k = fit * view.zoom;
  // Nodes keep a size a finger can hit (24 px at least) whatever the zoom.
  const nodeK = Math.max(0.8, Math.min(1.15, k));
  const sx = (x: number) => (x - WORLD.w / 2) * k + w / 2 + view.x;
  // A tall canvas (a phone) stretches the rings into ovals, so the nodes use its height.
  const tall = w && h ? Math.max(1, Math.min(1.6, (h / w) * (WORLD.w / WORLD.h))) : 1;
  const sy = (y: number) => (y - WORLD.h / 2) * k * tall + h / 2 + view.y;

  const zoomAt = (factor: number, px: number, py: number) =>
    setView((v) => {
      const zoom = Math.max(ZOOM.min, Math.min(ZOOM.max, v.zoom * factor));
      const r = zoom / v.zoom;
      // The point under the pointer stays where it is.
      return {
        zoom,
        x: px - w / 2 - (px - w / 2 - v.x) * r,
        y: py - h / 2 - (py - h / 2 - v.y) * r,
      };
    });
  const { dragging, handlers } = useGestures(stage, {
    onDrag: (dx, dy) => setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy })),
    onZoom: zoomAt,
  });

  const floorIndex = new Map(tree.floors.map((fl, i) => [fl.id, i]));
  const at = new Map(layout.placed.map((p) => [p.id, p]));
  const px = (p: Placed2D) => Math.max(24, p.size * nodeK);

  // Labels: the focus, the picked node and the nearer ring first.
  const boxes: LabelBox[] = [];
  const anchors = new Map<string, { x: number; y: number; side: 'below' | 'start' | 'end' }>();
  for (const p of layout.placed) {
    if (p.type !== 'node') continue;
    const s = px(p);
    const x = sx(p.x);
    const y = sy(p.y);
    const text = words.name(p.node);
    const isThing = p.node.kind === 'thing';
    const size = labelSize(text, p.ring === 0 ? 15 : isThing ? 11 : 12.5);
    let box: LabelBox;
    if (isThing) {
      const end = Math.cos(p.a) >= -0.05;
      const lx = end ? x + s / 2 + 4 : x - s / 2 - 4 - size.w;
      box = { id: p.id, x: lx, y: y - size.h / 2, ...size, priority: 0 };
      anchors.set(p.id, {
        x: end ? x + s / 2 + 4 : x - s / 2 - 4,
        y: y - size.h / 2,
        side: end ? 'end' : 'start',
      });
    } else {
      box = { id: p.id, x: x - size.w / 2, y: y + s / 2 + 4, ...size, priority: 0 };
      anchors.set(p.id, { x, y: y + s / 2 + 4, side: 'below' });
    }
    box.priority =
      p.ring === 0 ? 0 : p.node === selected ? 1 : p.ring === 1 ? 2 + (68 - p.size) / 100 : 4;
    boxes.push(box);
  }
  const shown = declutter(boxes, { w, h });

  const nodeStyle = (p: Placed2D): CSSProperties => {
    const s = px(p);
    return p.type === 'tag'
      ? { transform: `translate(${sx(p.x)}px, ${sy(p.y)}px) translate(-50%, -50%)`, zIndex: 3 }
      : {
          width: s,
          height: s,
          transform: `translate(${sx(p.x) - s / 2}px, ${sy(p.y) - s / 2}px)`,
          zIndex: p.ring === 0 ? 4 : 2,
        };
  };

  return (
    <div
      ref={stage}
      className={`kgraph-stage ${reduced ? '' : 'kgraph-motion'}`}
      data-dragging={dragging ? 'true' : 'false'}
      {...handlers}
    >
      <svg className="kgraph-edges" aria-hidden="true">
        {layout.edges.map((e) => {
          const a = at.get(e.from);
          const b = at.get(e.to);
          if (!a || !b) return null;
          return (
            <line
              key={`${e.from}>${e.to}`}
              x1={sx(a.x)}
              y1={sy(a.y)}
              x2={sx(b.x)}
              y2={sy(b.y)}
              className={e.kind === 'tag' ? 'tag' : e.onPath ? 'path' : undefined}
              style={e.kind === 'tag' ? tagStyle(e.tagColour) : undefined}
            />
          );
        })}
      </svg>
      <fieldset className="kgraph-layer" aria-label={t`Graph of ${words.name(focus)}`}>
        {layout.placed.map((p) => {
          if (p.type === 'tag')
            return (
              <button
                key={p.id}
                type="button"
                className="kgraph-node kgraph-tag"
                aria-pressed={selectedTag === p.tag.id}
                aria-label={words.tag(p.tag, p.count)}
                style={{ ...nodeStyle(p), ...tagStyle(p.tag.colour) }}
                onClick={() => onPickTag(p.tag)}
              >
                <span className="kgraph-dot" aria-hidden="true" />
                <bdi>{p.tag.name}</bdi>
              </button>
            );
          if (p.type === 'more')
            return (
              <button
                key={p.id}
                type="button"
                className="kgraph-node"
                data-kind="more"
                aria-label={words.more(p.count, p.of)}
                style={nodeStyle(p)}
                onClick={() => onPick(p.of)}
              >
                +{f.num(p.count)}
              </button>
            );
          const n = p.node;
          const s = px(p);
          const x = sx(p.x);
          const y = sy(p.y);
          const label = anchors.get(p.id);
          const flags = flagKinds(n);
          return (
            <NodeBits key={p.id}>
              <button
                type="button"
                className="kgraph-node"
                data-kind={n.kind}
                data-focus={p.ring === 0 ? 'true' : undefined}
                aria-pressed={n === selected}
                aria-label={words.label(n)}
                style={nodeStyle(p)}
                onClick={() => onPick(n)}
              >
                <Glyph
                  node={n}
                  short={levelShort(n.name, floorIndex.get(n.id) ?? 0)}
                  small={s < 26}
                />
              </button>
              {p.folded ? (
                <span
                  className="kgraph-badge"
                  aria-hidden="true"
                  style={{
                    transform: `translate(${x + s / 2 - 8}px, ${y + s / 2 - 12}px)`,
                    zIndex: 5,
                  }}
                >
                  {f.num(n.things)}
                </span>
              ) : null}
              {flags.length ? (
                <span
                  className="kgraph-flags"
                  aria-hidden="true"
                  style={{
                    transform: `translate(${x + s / 2 - 4}px, ${y - s / 2 - 4}px)`,
                    zIndex: 5,
                  }}
                >
                  {flags.map((k) => (
                    <span key={k} className={`kgraph-dot ${k}`} />
                  ))}
                </span>
              ) : null}
              {label && shown.has(p.id) ? (
                <span
                  className={`kgraph-label${n.kind === 'thing' ? ' small' : ''}${p.ring === 0 ? ' big' : ''}`}
                  aria-hidden="true"
                  style={{
                    transform: `translate(${label.x}px, ${label.y}px)${
                      label.side === 'below'
                        ? ' translateX(-50%)'
                        : label.side === 'start'
                          ? ' translateX(-100%)'
                          : ''
                    }`,
                    zIndex: 6,
                  }}
                >
                  <bdi>{words.name(n)}</bdi>
                </span>
              ) : null}
            </NodeBits>
          );
        })}
      </fieldset>
      <div className="kgraph-ctl">
        <button type="button" aria-label={t`Zoom in`} onClick={() => zoomAt(1.4, w / 2, h / 2)}>
          +
        </button>
        <button
          type="button"
          aria-label={t`Zoom out`}
          onClick={() => zoomAt(1 / 1.4, w / 2, h / 2)}
        >
          −
        </button>
        <button
          type="button"
          aria-label={t`Show the whole house`}
          onClick={() => {
            setView({ zoom: 1, x: 0, y: 0 });
            onHome();
          }}
        >
          <HouseCtl />
        </button>
      </div>
    </div>
  );
}

/** A node's button and the bits drawn with it, side by side in the canvas. */
function NodeBits({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
