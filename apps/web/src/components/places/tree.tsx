/**
 * A location's place tree: the flattening the move picker searches, and the "All places" outline
 * on the Location page, a way to jump to any depth in one tap (the locations tree).
 *
 * Boxes are leaves under their place, after its child places: a box icon, the name and how many
 * things are in it; what is inside stays on the box's page. A place shows at most 50 boxes (the
 * server's cap), then "+N boxes" to its own page, where the list has them all.
 *
 * Both outlines fold each place with something under it (#358, fold.ts): the person's folds are
 * kept on the server, and the path to the page they are on stays open. The move picker uses
 * treeEntries as it is and never folds.
 */
import { comparePlaceSiblings } from '@kept/shared';
import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { useId, useMemo, useState } from 'react';
import type { BoxNode, PlaceNode } from '@/api/inventory/types';
import { ChevronDownIcon } from '@/components/icons';
import { TypeIcon } from '@/components/type-icon';
import { Button } from '@/components/ui/button';
import { addressOf } from '@/lib/address';
import { cn } from '@/lib/utils';
import { childrenOf } from './api';
import { foldableIds, isFoldedAll, keptOpen, nestEntries, type TreeItem, toggleFold } from './fold';
import { placeIcon, usePlaceName } from './labels';
import { usePlaceFolds } from './use-place-folds';

export type TreeRow = { place: PlaceNode; depth: number };

/**
 * Depth-first, in the server's order, with the Unplaced area first. `exclude` drops a place and
 * its whole subtree (a place can't move into itself).
 */
export function flattenTree(
  places: PlaceNode[],
  { exclude, includeUnplaced = true }: { exclude?: Set<string>; includeUnplaced?: boolean } = {},
): TreeRow[] {
  const kids = childrenOf(places);
  const ids = new Set(places.map((p) => p.id));
  const out: TreeRow[] = [];
  const walk = (pl: PlaceNode, depth: number) => {
    if (exclude?.has(pl.id)) return;
    if (pl.isUnplaced && !includeUnplaced) return;
    out.push({ place: pl, depth });
    for (const c of kids.get(pl.id) ?? []) walk(c, depth + 1);
  };
  // Roots: no parent, or a parent the list doesn't have.
  const roots = places
    .filter((p) => p.parentId === null || !ids.has(p.parentId))
    .sort((a, b) => Number(b.isUnplaced) - Number(a.isUnplaced) || comparePlaceSiblings(a, b));
  for (const r of roots) walk(r, 0);
  return out;
}

export type TreeEntry =
  | { kind: 'place'; place: PlaceNode; depth: number }
  | { kind: 'box'; box: BoxNode; depth: number }
  | { kind: 'more'; place: PlaceNode; count: number; depth: number };

/**
 * flattenTree's rows with each place's boxes after everything under it (in the order given, the
 * server's A to Z), and a "+N boxes" entry when the place has more than it was given.
 */
export function treeEntries(
  places: PlaceNode[],
  boxes: readonly BoxNode[],
  options: Parameters<typeof flattenTree>[1] = {},
): TreeEntry[] {
  const byPlace = new Map<string, BoxNode[]>();
  for (const b of boxes) byPlace.set(b.placeId, [...(byPlace.get(b.placeId) ?? []), b]);
  const out: TreeEntry[] = [];
  const open: TreeRow[] = [];
  const close = (row: TreeRow) => {
    const here = byPlace.get(row.place.id) ?? [];
    for (const box of here) out.push({ kind: 'box', box, depth: row.depth + 1 });
    const more = row.place.boxCount - here.length;
    if (more > 0) out.push({ kind: 'more', place: row.place, count: more, depth: row.depth + 1 });
  };
  for (const row of flattenTree(places, options)) {
    while (open.length && (open.at(-1) as TreeRow).depth >= row.depth) close(open.pop() as TreeRow);
    out.push({ kind: 'place', ...row });
    open.push(row);
  }
  while (open.length) close(open.pop() as TreeRow);
  return out;
}

/** The indent for a tree row, in logical padding so it mirrors in Arabic. */
export const indentStyle = (depth: number) => ({
  paddingInlineStart: `${0.875 + depth * 1.25}rem`,
});

/** A row's indent: the fold button's slot starts it, so the place icons line up under it. */
const rowIndent = (depth: number) => ({ paddingInlineStart: `${0.25 + depth * 1.25}rem` });

/** How the two outlines draw a row: the collapsed one at phone size, the docked panel denser. */
const LOOKS = {
  outline: {
    row: 'flex min-h-10 items-stretch hover:bg-sunken',
    fold: 'size-10',
    link: 'flex min-h-10 min-w-0 flex-1 items-center gap-2 pe-3.5 text-[14px] text-ink-2 outline-none hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-info aria-[current=page]:font-semibold aria-[current=page]:text-ink',
  },
  panel: {
    row: 'flex min-h-9 items-stretch rounded-lg hover:bg-sunken has-[[aria-current=page]]:bg-sunken',
    fold: 'h-9 w-8',
    link: 'flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-lg pe-3.5 text-[14px] text-ink-2 outline-none hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-info aria-[current=page]:font-semibold aria-[current=page]:text-ink',
  },
} as const;
type Look = (typeof LOOKS)[keyof typeof LOOKS];

const NONE: ReadonlySet<string> = new Set();

/**
 * The outline's folds (#358): the person's, from the server, with the path to the page they are on
 * kept open. A place on that path folds only when they fold it on this page.
 */
function useFolding(
  places: PlaceNode[],
  boxes: readonly BoxNode[],
  currentId: string | undefined,
  locationId: string | undefined,
  entries: TreeEntry[],
) {
  const { folded, setFolded } = usePlaceFolds(locationId);
  const path = useMemo(() => keptOpen(places, boxes, currentId), [places, boxes, currentId]);
  const foldable = useMemo(() => foldableIds(entries), [entries]);
  const [released, setReleased] = useState<{ at: string | undefined; ids: ReadonlySet<string> }>({
    at: currentId,
    ids: NONE,
  });
  const here = released.at === currentId ? released.ids : NONE;
  const isOpen = (id: string) => !folded.has(id) || (path.has(id) && !here.has(id));
  const toggle = (id: string) => {
    if (!isOpen(id)) return setFolded(toggleFold(folded, id));
    if (path.has(id)) setReleased({ at: currentId, ids: new Set(here).add(id) });
    setFolded(new Set(folded).add(id));
  };
  const allFolded = isFoldedAll(folded, foldable);
  const foldAll = () => {
    setReleased({ at: currentId, ids: NONE });
    setFolded(allFolded ? NONE : new Set(foldable));
  };
  return { isOpen, toggle, foldable, allFolded, foldAll };
}
type Folding = ReturnType<typeof useFolding>;

/** "Fold all", or "Open all" once every place is folded (the path to this page stays open). */
function FoldAll({ folding, className }: { folding: Folding; className?: string }) {
  if (folding.foldable.length === 0) return null;
  return (
    <Button variant="ghost" size="small" onPress={folding.foldAll} className={className}>
      {folding.allFolded ? <Trans>Open all</Trans> : <Trans>Fold all</Trans>}
    </Button>
  );
}

/** The rows, nested as the places are: a place's fold button opens and closes its own list. */
function Rows({
  items,
  currentId,
  folding,
  look,
}: {
  items: TreeItem[];
  currentId: string | undefined;
  folding: Folding;
  look: Look;
}) {
  const { t } = useLingui();
  const nameOf = usePlaceName();
  const uid = useId();
  return items.map(({ entry, children }) => {
    const id = keyOf(entry);
    const folds = entry.kind === 'place' && children.length > 0;
    const open = !folds || folding.isOpen(entry.place.id);
    const groupId = `${uid}-${id}`;
    const name = entry.kind === 'place' ? nameOf(entry.place) : '';
    return (
      <li key={id}>
        <div className={look.row} style={rowIndent(entry.depth)}>
          {folds ? (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={groupId}
              aria-label={t`What's in ${name}`}
              onClick={() => folding.toggle(entry.place.id)}
              className={cn(
                'grid shrink-0 place-items-center rounded-lg text-ink-3 outline-none hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-info',
                look.fold,
              )}
            >
              <ChevronDownIcon
                aria-hidden="true"
                className={cn('size-4 transition-transform', !open && '-rotate-90 rtl:rotate-90')}
              />
            </button>
          ) : (
            <span aria-hidden="true" className={cn('shrink-0', look.fold)} />
          )}
          <EntryLink row={entry} currentId={currentId} className={look.link} />
        </div>
        {folds ? (
          <ul id={groupId} hidden={!open} className="m-0 grid list-none p-0">
            {open ? (
              <Rows items={children} currentId={currentId} folding={folding} look={look} />
            ) : null}
          </ul>
        ) : null}
      </li>
    );
  });
}

export function PlaceTree({
  places,
  boxes = [],
  currentId,
  locationId,
}: {
  places: PlaceNode[];
  boxes?: readonly BoxNode[];
  currentId?: string;
  /** Whose folds to read and keep (#358). */
  locationId: string;
}) {
  const rows = useMemo(() => treeEntries(places, boxes), [places, boxes]);
  const folding = useFolding(places, boxes, currentId, locationId, rows);
  if (rows.length <= 1) return null;
  return (
    <details className="group rounded-[10px] border border-line bg-surface">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3.5 text-[14px] font-semibold text-ink outline-none focus-visible:outline-2 focus-visible:outline-info [&::-webkit-details-marker]:hidden">
        <ChevronDownIcon className="size-4 -rotate-90 text-ink-3 transition-transform group-open:rotate-0 rtl:rotate-90 rtl:group-open:rotate-0" />
        <Trans>All places</Trans>
      </summary>
      <div className="border-t border-line py-1">
        <div className="flex justify-end px-1.5">
          <FoldAll folding={folding} className="min-h-10" />
        </div>
        <ul className="m-0 grid list-none p-0">
          <Rows
            items={nestEntries(rows)}
            currentId={currentId}
            folding={folding}
            look={LOOKS.outline}
          />
        </ul>
      </div>
    </details>
  );
}

/**
 * The location's places as a panel beside the page (1.1, the maintainer's "railing" sidebar):
 * always open, the location heading it and the current place marked. Pages show it from 1280 px
 * (`useMediaQuery(DOCKED)`), and the collapsed outline below that. Each place folds (#358), and
 * the header folds or opens them all.
 */
export function PlacesPanel({
  places,
  boxes = [],
  currentId,
  location,
}: {
  places: PlaceNode[];
  boxes?: readonly BoxNode[];
  currentId?: string;
  location: { id: string; name: string; address?: string };
}) {
  const { t } = useLingui();
  const rows = useMemo(() => treeEntries(places, boxes), [places, boxes]);
  const folding = useFolding(places, boxes, currentId, location.id, rows);
  const name = location.name;
  return (
    <nav aria-label={t`Places in ${name}`} className="grid gap-1">
      <div className="flex items-center gap-1">
        <Link
          to="/loc/$id"
          params={{ id: location.address ?? location.id }}
          aria-current={currentId === undefined ? 'page' : undefined}
          className="flex min-h-10 min-w-0 flex-1 items-center rounded-lg px-3.5 font-semibold text-[14px] text-ink outline-none hover:bg-sunken focus-visible:outline-2 focus-visible:outline-info aria-[current=page]:bg-sunken"
        >
          <bdi className="[overflow-wrap:anywhere]">{name}</bdi>
        </Link>
        <FoldAll folding={folding} className="shrink-0" />
      </div>
      <ul className="m-0 grid list-none p-0">
        <Rows
          items={nestEntries(rows)}
          currentId={currentId}
          folding={folding}
          look={LOOKS.panel}
        />
      </ul>
    </nav>
  );
}

const keyOf = (row: TreeEntry) =>
  row.kind === 'box' ? `b:${row.box.id}` : row.kind === 'more' ? `m:${row.place.id}` : row.place.id;

/** One line of the tree: a place, a box (with its count), or the "+N boxes" link. */
function EntryLink({
  row,
  currentId,
  className,
}: {
  row: TreeEntry;
  currentId: string | undefined;
  className: string;
}) {
  const { t } = useLingui();
  const nameOf = usePlaceName();
  if (row.kind === 'box') {
    const { box } = row;
    const n = box.contentCount;
    return (
      <Link
        to="/t/$id"
        params={{ id: addressOf(box) }}
        aria-current={box.id === currentId ? 'page' : undefined}
        className={className}
      >
        <TypeIcon icon={box.icon ?? 'lucide:package'} className="size-4 shrink-0 text-ink-3" />
        <bdi className="min-w-0 [overflow-wrap:anywhere]">{box.name ?? t`Untitled`}</bdi>
        <span className="ms-auto shrink-0 ps-2 text-small text-ink-3">
          {plural(n, { one: '# thing', other: '# things' })}
        </span>
      </Link>
    );
  }
  if (row.kind === 'more') {
    const count = row.count;
    return (
      <Link to="/p/$id" params={{ id: addressOf(row.place) }} className={className}>
        <span className="text-small text-ink-3">
          {plural(count, { one: '+# box', other: '+# boxes' })}
        </span>
      </Link>
    );
  }
  const { place } = row;
  return (
    <Link
      to="/p/$id"
      params={{ id: addressOf(place) }}
      aria-current={place.id === currentId ? 'page' : undefined}
      className={className}
    >
      <TypeIcon icon={placeIcon(place)} className="size-4 shrink-0 text-ink-3" />
      <bdi className="[overflow-wrap:anywhere]">{nameOf(place)}</bdi>
    </Link>
  );
}
