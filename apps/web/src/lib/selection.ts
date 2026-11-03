/**
 * A selection of rows, shared by every list that selects (#366): a place's List and Grid, and the
 * spreadsheet (components/sheet/model.ts re-exports it). Pure, so it is tested without a screen.
 *
 * The anchor is the row ticked last: Shift-click (or Shift+Space, Shift+arrows) adds every row
 * from the anchor to the one pressed, in the list's order, and the anchor stays where it was.
 */

export type RowSelection = { ids: ReadonlySet<string>; anchor: string | null };
export const NO_SELECTION: RowSelection = { ids: new Set(), anchor: null };

/** Cmd/Ctrl-click, a plain tick and Space: one row in or out; it becomes the anchor. */
export function toggleRow(sel: RowSelection, id: string): RowSelection {
  const ids = new Set(sel.ids);
  if (ids.has(id)) ids.delete(id);
  else ids.add(id);
  return { ids, anchor: id };
}

/** Shift-click and Shift+arrows: every row from the anchor to `id` is added; the anchor stays. */
export function selectRange(sel: RowSelection, order: readonly string[], id: string): RowSelection {
  const anchor = sel.anchor ?? id;
  const a = order.indexOf(anchor);
  const b = order.indexOf(id);
  if (a < 0 || b < 0) return toggleRow(sel, id);
  const ids = new Set(sel.ids);
  for (let i = Math.min(a, b); i <= Math.max(a, b); i++) ids.add(order[i] as string);
  return { ids, anchor };
}

/** A tick with Shift held is a range; without it, one row. */
export const pickRow = (
  sel: RowSelection,
  order: readonly string[],
  id: string,
  shift: boolean,
): RowSelection => (shift && sel.anchor ? selectRange(sel, order, id) : toggleRow(sel, id));

export const selectAll = (order: readonly string[]): RowSelection => ({
  ids: new Set(order),
  anchor: order[0] ?? null,
});
