/**
 * The graph view (#207): a location's places, boxes and things as a graph, the fourth layout of
 * a location's page and a place's (./lazy.tsx loads it). Loaded on demand in its own chunk, never
 * precached: like the map it needs a connection (the server's read, GET …/graph), and says so.
 *
 * One state for both pictures: the focused node (the path above goes back up to it), the picked
 * node (its card), the depth (Rooms · Boxes · All) and the Tags switch. Pick a node to see its
 * card, pick it again or Go in to focus it; Escape closes the card, then goes up. 2D (the focus
 * rings, ./focus-2d.tsx) or 3D (the floors, ./floors-3d.tsx), remembered per person.
 */
import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { type KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { api, isApiError } from '@/api/client';
import { graphPaths } from '@/api/graph/paths';
import type { GraphView as GraphData, GraphTag } from '@/api/graph/types';
import { useMe } from '@/api/queries';
import { ErrorState, LoadingRows, Notice } from '@/components/page';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { useOnline } from '@/lib/online';
import { useReducedMotion } from './canvas';
import { GraphCard, type Pick } from './card';
import { Floors3D } from './floors-3d';
import { Focus2D } from './focus-2d';
import { layout2D } from './layout2d';
import { buildTree, chainOf, type Depth, FLAGS, type GNode, type GraphTree } from './tree';
import { useGraphWords } from './words';
import './graph.css';

export const graphKey = (locationId: string) => ['graph', locationId] as const;

export type GraphProps = {
  locationId: string;
  /** The location's name, the graph's root. */
  name: string;
  /** The location's address, for its links. */
  address: string;
  /** A place's page: the graph opens focused on that place. */
  focusId?: string;
};

export default function LocationGraph(props: GraphProps) {
  const { t } = useLingui();
  const online = useOnline();
  const q = useQuery({
    queryKey: graphKey(props.locationId),
    queryFn: ({ signal }) => api.get<GraphData>(graphPaths.graph(props.locationId), signal),
  });
  const tree = useMemo(
    () => (q.data ? buildTree(q.data, { id: props.locationId, name: props.name }) : null),
    [q.data, props.locationId, props.name],
  );
  if (!tree) {
    // Like the map, the graph reads the server: offline it says so instead of a spinner.
    const offline = q.error ? !isApiError(q.error) || q.error.code === 'offline' : !online;
    if (offline)
      return (
        <Notice title={t`Needs a connection`}>
          <Trans>The graph is drawn from Kept’s server. The list has everything offline.</Trans>
        </Notice>
      );
    if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
    return <LoadingRows rows={3} />;
  }
  // Keyed by the place too: moving from one place's graph to another's opens on the new place.
  return <GraphBody key={`${props.locationId}:${props.focusId ?? ''}`} tree={tree} {...props} />;
}

/** Whether the card has room beside the graph (1200 px and wider). */
function useBeside(): boolean {
  const [wide, setWide] = useState(
    () => typeof matchMedia === 'function' && matchMedia('(min-width: 1200px)').matches,
  );
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const q = matchMedia('(min-width: 1200px)');
    const on = () => setWide(q.matches);
    q.addEventListener?.('change', on);
    return () => q.removeEventListener?.('change', on);
  }, []);
  return wide;
}

/** Controls whose Escape is their own: the graph doesn't close or go up from them. */
const OWN_KEYS =
  '[role="radiogroup"], [role="switch"], [role="menu"], [role="listbox"], [role="dialog"], input, textarea';

type Dim = '2d' | '3d';
const dimKey = (userId: string) => `kept.graph.dim.${userId}`;
function readDim(key: string | null): Dim | null {
  if (!key) return null;
  try {
    const v = localStorage.getItem(key);
    return v === '3d' || v === '2d' ? v : null;
  } catch {
    return null;
  }
}
function writeDim(key: string | null, v: Dim) {
  if (!key) return;
  try {
    if (v === '2d') localStorage.removeItem(key);
    else localStorage.setItem(key, v);
  } catch {
    // Remembering is a convenience: the address still says it.
  }
}

/** 2D or 3D: the address's `dim`, else what this person last chose on this device. */
function useDim(): [Dim, (d: Dim) => void] {
  const search = useSearch({ strict: false }) as { dim?: unknown };
  const navigate = useNavigate();
  const userId = useMe().data?.user.id ?? null;
  const key = userId ? dimKey(userId) : null;
  const asked = search.dim === '3d' || search.dim === '2d' ? (search.dim as Dim) : null;
  const dim: Dim = asked ?? readDim(key) ?? '2d';
  return [
    dim,
    (d) => {
      writeDim(key, d);
      void navigate({
        to: '.',
        search: (prev: Record<string, unknown>) => ({ ...prev, dim: d }),
        replace: true,
      });
    },
  ];
}

function GraphBody({ tree, address, focusId }: GraphProps & { tree: GraphTree }) {
  const { t } = useLingui();
  const words = useGraphWords();
  const reduced = useReducedMotion();
  const [dim, setDim] = useDim();
  const start = (focusId && tree.byId.get(focusId)) || tree.root;
  const [focusIdNow, setFocus] = useState(start.id);
  // From 1200 px the card stands beside the graph, so it opens on the focus as the design does;
  // narrower, it covers part of the graph, so it waits until something is picked.
  const beside = useBeside();
  const [pick, setPick] = useState<Pick | null>(beside ? { type: 'node', node: start } : null);
  const [depth, setDepth] = useState<Depth>('all');
  const [tagsOn, setTagsOn] = useState(false);
  const focus = tree.byId.get(focusIdNow) ?? tree.root;
  // The tree is rebuilt when the server's read changes: keep the picked node by its id.
  const selected = pick?.type === 'node' ? (tree.byId.get(pick.node.id) ?? null) : null;
  const selectedTag = pick?.type === 'tag' ? pick.tag.id : null;
  useEffect(() => {
    if (!tree.byId.has(focusIdNow)) setFocus(tree.root.id);
  }, [tree, focusIdNow]);

  const goIn = (n: GNode) => {
    setFocus(n.id);
    setPick(beside ? { type: 'node', node: n } : null);
  };
  const select = (n: GNode) => {
    if (dim === '2d' && n !== focus) {
      // Not drawn around this focus (it is further down, or elsewhere): focus what holds it.
      const drawn = layout2D({ focus, selected: null, depth, tags: null }).placed.some(
        (p) => p.id === n.id,
      );
      if (!drawn) setFocus((n.parent ?? tree.root).id);
    }
    setPick({ type: 'node', node: n });
  };
  /** Picking the picked node again goes in, when there's something inside. */
  const onPick = (n: GNode) => {
    if (n === selected && n !== focus && n.children.length > 0) goIn(n);
    else select(n);
  };
  const onPickTag = (tag: GraphTag) => setPick({ type: 'tag', tag });
  const up = () => {
    if (!focus.parent) return;
    setPick(beside ? { type: 'node', node: focus } : null);
    setFocus(focus.parent.id);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    // A control with keys of its own (the switches, a menu, a field) keeps its Escape.
    if (e.target instanceof Element && e.target.closest(OWN_KEYS)) return;
    if (pick) setPick(null);
    else if (focus.parent) up();
    else return;
    e.stopPropagation();
  };

  const card = pick ? (
    <GraphCard
      pick={pick.type === 'node' && selected ? { type: 'node', node: selected } : pick}
      tree={tree}
      words={words}
      address={address}
      focus={focus}
      onPick={select}
      onGoIn={goIn}
      onClose={() => setPick(null)}
    />
  ) : null;
  const common = {
    tree,
    focus,
    selected,
    selectedTag,
    tagsOn,
    words,
    reduced,
    onPick,
    onPickTag,
    onHome: () => {
      setFocus(tree.root.id);
      setPick(null);
    },
  };
  const path = chainOf(focus);
  const more = tree.more;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape anywhere in the graph closes the card, then goes up
    <div className="kgraph" onKeyDown={onKeyDown}>
      <div className="kgraph-bar">
        <nav className="kgraph-crumbs" aria-label={t`Where you are in the graph`}>
          {path.map((n, i) => (
            <span key={n.id} className="kgraph-crumb">
              {i > 0 ? (
                <span className="kgraph-sep" aria-hidden="true">
                  ›
                </span>
              ) : null}
              <button
                type="button"
                aria-current={n === focus ? 'location' : undefined}
                onClick={() => {
                  setFocus(n.id);
                  setPick(beside ? { type: 'node', node: n } : null);
                }}
              >
                <bdi>{words.name(n)}</bdi>
              </button>
            </span>
          ))}
        </nav>
        <div className="kgraph-tools">
          <ul className="kgraph-legend" aria-label={t`Pins`}>
            {FLAGS.map((k) => (
              <li key={k}>
                <span className={`kgraph-dot ${k}`} aria-hidden="true" />
                {words.legend[k]}
              </li>
            ))}
          </ul>
          <Switch isSelected={tagsOn} onChange={setTagsOn} isDisabled={tree.tags.length === 0}>
            <Trans>Tags</Trans>
          </Switch>
        </div>
      </div>
      <div className="kgraph-bar">
        {dim === '2d' ? (
          <Segmented<Depth>
            aria-label={t`Show`}
            className="kgraph-seg"
            oneRow
            value={depth}
            onChange={setDepth}
            options={[
              { id: 'rooms', label: t`Rooms` },
              { id: 'boxes', label: t`Boxes` },
              { id: 'all', label: t`All` },
            ]}
          />
        ) : null}
        <Segmented<Dim>
          aria-label={t`2D or 3D`}
          // The guided tour points here (components/hints/tours.ts, the Graph & 3D map chapter).
          data-tour="graph-dim"
          className="kgraph-seg dim"
          oneRow
          value={dim}
          onChange={setDim}
          // "2D" and "3D" as they are in every language: short enough for one row on a phone
          // (the map's own 3D button keeps its translated word).
          options={[
            { id: '2d', label: '2D' },
            { id: '3d', label: '3D' },
          ]}
        />
      </div>
      <div className="kgraph-main" data-card={pick ? 'true' : 'false'}>
        {dim === '2d' ? <Focus2D {...common} depth={depth} /> : <Floors3D {...common} />}
        {card}
      </div>
      <p className="kgraph-hint">
        {dim === '2d' ? (
          <Trans>
            Size shows how much is inside. Pick twice to go in; the path above takes you back.
          </Trans>
        ) : (
          <Trans>
            It turns slowly until you touch it. Drag to turn it; pick a room to bring it forward.
          </Trans>
        )}
        {more > 0
          ? ` ${plural(more, {
              one: '# more thing is counted in its place but not drawn.',
              other: '# more things are counted in their places but not drawn.',
            })}`
          : null}
      </p>
      <TextList focus={focus} words={words} onPick={select} />
    </div>
  );
}

/** M9, as the map's "Places on this level": what the graph shows, as a list for screen readers
 * and keyboards. It shows itself when focused. */
function TextList({
  focus,
  words,
  onPick,
}: {
  focus: GNode;
  words: ReturnType<typeof useGraphWords>;
  onPick: (n: GNode) => void;
}) {
  const { t } = useLingui();
  return (
    <section className="kgraph-list sr-only focus-within:not-sr-only" aria-label={t`In this graph`}>
      <h2 className="m-0 font-semibold text-[16px]">
        <Trans>
          In <bdi>{words.name(focus)}</bdi>
        </Trans>
      </h2>
      <ul>
        {focus.children.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => onPick(c)}>
              {words.label(c)}
            </button>
            {c.children.length ? (
              <ul>
                {c.children.slice(0, 50).map((k) => (
                  <li key={k.id}>
                    <button type="button" onClick={() => onPick(k)}>
                      {words.label(k)}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
