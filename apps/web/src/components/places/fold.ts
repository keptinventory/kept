/**
 * Folding the places outline (#358). A place with anything under it (places, boxes or "+N
 * boxes") folds, as an accordion's sections do; the person's folded places are remembered on the
 * server (use-place-folds.ts). The path to the page you are on is always open, whatever was folded
 * before, so the marked row is never hidden. The move picker shows the whole tree and never folds.
 */
import type { BoxNode, PlaceNode } from '@/api/inventory/types';
import type { TreeEntry } from './tree';

/** A row with the rows under it: a place's child places, then its boxes, then "+N boxes". */
export type TreeItem = { entry: TreeEntry; children: TreeItem[] };

/** treeEntries' flat rows as a tree, by depth. */
export function nestEntries(entries: readonly TreeEntry[]): TreeItem[] {
  const roots: TreeItem[] = [];
  const open: TreeItem[] = [];
  for (const entry of entries) {
    const item: TreeItem = { entry, children: [] };
    while (open.length && (open.at(-1) as TreeItem).entry.depth >= entry.depth) open.pop();
    (open.at(-1)?.children ?? roots).push(item);
    if (entry.kind === 'place') open.push(item);
  }
  return roots;
}

/** The places that have a row under them, in tree order: the ones that fold. */
export function foldableIds(entries: readonly TreeEntry[]): string[] {
  const out: string[] = [];
  entries.forEach((e, i) => {
    const next = entries[i + 1];
    if (e.kind === 'place' && next && next.depth > e.depth) out.push(e.place.id);
  });
  return out;
}

/** The rows left showing when the places in `closed` are folded. */
export function visibleEntries(
  entries: readonly TreeEntry[],
  closed: ReadonlySet<string>,
): TreeEntry[] {
  const out: TreeEntry[] = [];
  let hideBelow: number | null = null;
  for (const e of entries) {
    if (hideBelow !== null && e.depth > hideBelow) continue;
    hideBelow = null;
    out.push(e);
    if (e.kind === 'place' && closed.has(e.place.id)) hideBelow = e.depth;
  }
  return out;
}

/**
 * The places kept open for the page you are on: a place's ancestors, or a box's place and its
 * ancestors. Empty on the location page (no `currentId`) and for an id the tree doesn't have.
 */
export function keptOpen(
  places: readonly PlaceNode[],
  boxes: readonly BoxNode[],
  currentId: string | undefined,
): Set<string> {
  const out = new Set<string>();
  if (!currentId) return out;
  const parentOf = new Map(places.map((p) => [p.id, p.parentId]));
  let at: string | null | undefined = parentOf.has(currentId)
    ? parentOf.get(currentId)
    : boxes.find((b) => b.id === currentId)?.placeId;
  while (at && parentOf.has(at) && !out.has(at)) {
    out.add(at);
    at = parentOf.get(at);
  }
  return out;
}

/** `folded` with `id` folded if it was open, or opened if it was folded. */
export function toggleFold(folded: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(folded);
  if (!next.delete(id)) next.add(id);
  return next;
}

/** Whether every place that folds is folded (the header then offers "Open all"). */
export const isFoldedAll = (folded: ReadonlySet<string>, foldable: readonly string[]) =>
  foldable.length > 0 && foldable.every((id) => folded.has(id));
