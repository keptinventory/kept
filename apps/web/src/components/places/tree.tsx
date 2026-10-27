/**
 * A location's place tree: the flattening the move picker searches, and the "All places" outline
 * on the Location page, a way to jump to any depth in one tap (the locations tree).
 *
 * Boxes are leaves under their place, after its child places: a box icon, the name and how many
 * things are in it; what is inside stays on the box's page. A place shows at most 50 boxes (the
 * server's cap), then "+N boxes" to its own page, where the list has them all.
 */
import { comparePlaceSiblings } from '@kept/shared';
import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import type { BoxNode, PlaceNode } from '@/api/inventory/types';
import { ChevronDownIcon } from '@/components/icons';
import { TypeIcon } from '@/components/type-icon';
import { addressOf } from '@/lib/address';
import { childrenOf } from './api';
import { placeIcon, usePlaceName } from './labels';

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

export function PlaceTree({
  places,
  boxes = [],
  currentId,
}: {
  places: PlaceNode[];
  boxes?: readonly BoxNode[];
  currentId?: string;
}) {
  const rows = treeEntries(places, boxes);
  if (rows.length <= 1) return null;
  return (
    <details className="group rounded-[10px] border border-line bg-surface">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3.5 text-[14px] font-semibold text-ink outline-none focus-visible:outline-2 focus-visible:outline-info [&::-webkit-details-marker]:hidden">
        <ChevronDownIcon className="size-4 -rotate-90 text-ink-3 transition-transform group-open:rotate-0 rtl:rotate-90 rtl:group-open:rotate-0" />
        <Trans>All places</Trans>
      </summary>
      <ul className="m-0 grid list-none border-t border-line p-0 py-1">
        {rows.map((row) => (
          <li key={keyOf(row)}>
            <EntryLink
              row={row}
              currentId={currentId}
              className="flex min-h-10 items-center gap-2 pe-3.5 text-[14px] text-ink-2 outline-none hover:bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-info aria-[current=page]:font-semibold aria-[current=page]:text-ink"
            />
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * The location's places as a panel beside the page (1.1, the maintainer's "railing" sidebar):
 * always open, the location heading it and the current place marked. Pages show it from 1280 px
 * (`useMediaQuery(DOCKED)`), and the collapsed outline below that.
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
  const rows = treeEntries(places, boxes);
  const name = location.name;
  return (
    <nav aria-label={t`Places in ${name}`} className="grid gap-1">
      <Link
        to="/loc/$id"
        params={{ id: location.address ?? location.id }}
        aria-current={currentId === undefined ? 'page' : undefined}
        className="flex min-h-10 items-center rounded-lg px-3.5 font-semibold text-[14px] text-ink outline-none hover:bg-sunken focus-visible:outline-2 focus-visible:outline-info aria-[current=page]:bg-sunken"
      >
        <bdi className="[overflow-wrap:anywhere]">{name}</bdi>
      </Link>
      <ul className="m-0 grid list-none p-0">
        {rows.map((row) => (
          <li key={keyOf(row)}>
            <EntryLink
              row={row}
              currentId={currentId}
              className="flex min-h-9 items-center gap-2 rounded-lg pe-3.5 text-[14px] text-ink-2 outline-none hover:bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-info aria-[current=page]:bg-sunken aria-[current=page]:font-semibold aria-[current=page]:text-ink"
            />
          </li>
        ))}
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
  const style = indentStyle(row.depth);
  if (row.kind === 'box') {
    const { box } = row;
    const n = box.contentCount;
    return (
      <Link
        to="/t/$id"
        params={{ id: addressOf(box) }}
        aria-current={box.id === currentId ? 'page' : undefined}
        style={style}
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
      <Link to="/p/$id" params={{ id: addressOf(row.place) }} style={style} className={className}>
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
      style={style}
      className={className}
    >
      <TypeIcon icon={placeIcon(place)} className="size-4 shrink-0 text-ink-3" />
      <bdi className="[overflow-wrap:anywhere]">{nameOf(place)}</bdi>
    </Link>
  );
}
