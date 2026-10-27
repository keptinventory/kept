/**
 * The order places and things are listed in, for what the app sorts itself (a location's place
 * tree, online or from the phone's copy). The server lists in the same order with the ICU
 * collation `"und-u-kn-true"` (apps/server/src/places/order.ts); both are ICU's root order with
 * numbers read as numbers, so "Box 2" comes before "Box 10" and "رف ٢" before "رف ١٠".
 *
 * English has no collation tailoring of its own, so `en` is ICU's root order: the same for every
 * reader, whatever the browser's language (a reader's own language would move Arabic names ahead
 * of Latin ones, and the list would no longer match the server's).
 */
const collator = new Intl.Collator('en', { numeric: true });

const byCodeUnits = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Names in natural order; names the collator calls equal fall back to their characters. */
export const naturalCompare = (a: string, b: string): number =>
  collator.compare(a, b) || byCodeUnits(a, b);

/** What sibling places are ordered by. `createdAt` is an ISO timestamp, when known. */
export type SiblingOrderFields = {
  id: string;
  name: string;
  kindKey: string;
  sort: number;
  isUnplaced?: boolean | undefined;
  createdAt?: string | undefined;
};

/** How a place orders the places inside it: A to Z (the default) or its own order (`sort`). */
export const CHILD_ORDERS = ['name', 'custom'] as const;
export type ChildOrder = (typeof CHILD_ORDERS)[number];

/**
 * Two places with the same parent: the Unplaced area first (it is top level), then floors, by
 * `sort` then when they were made (the map
 * stacks them in this order, the first is the ground); every other place A to Z; the id last, so
 * the order never depends on how the rows arrived.
 *
 * `order` is the parent's: in Custom order its places go by `sort` first, and places at the same
 * position fall back to the rule above. A to Z leaves `sort` as it is, so switching back to
 * Custom brings the same order back.
 */
export function comparePlaceSiblings(
  a: SiblingOrderFields,
  b: SiblingOrderFields,
  order: ChildOrder = 'name',
): number {
  if (order === 'custom' && !!a.isUnplaced === !!b.isUnplaced && a.sort !== b.sort)
    return a.sort - b.sort;
  if (!!a.isUnplaced !== !!b.isUnplaced) return a.isUnplaced ? -1 : 1;
  const floorA = a.kindKey === 'floor';
  const floorB = b.kindKey === 'floor';
  if (floorA !== floorB) return floorA ? -1 : 1;
  if (floorA)
    return (
      a.sort - b.sort ||
      byCodeUnits(a.createdAt ?? '', b.createdAt ?? '') ||
      byCodeUnits(a.id, b.id)
    );
  return naturalCompare(a.name, b.name) || byCodeUnits(a.id, b.id);
}

/** The sibling comparator for a parent's order (absent: A to Z), for `Array.sort`. */
export const siblingOrder =
  (order: ChildOrder | undefined) =>
  (a: SiblingOrderFields, b: SiblingOrderFields): number =>
    comparePlaceSiblings(a, b, order ?? 'name');
