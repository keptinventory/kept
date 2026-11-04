import type pg from 'pg';
import type { Many } from '../http/list-filters.js';

// A hidden Personal location (#392), as the lists read it. kept.hidden_location_ids() (0170) says
// which location that is, worked out on every read: empty while Personal is the only location the
// session sees, and for a token, which sees what it was granted.
//
// A list that covers "all my locations" leaves it out. A list that names it (a location filter, a
// place inside it) still shows it, and every read by id still works, because a direct link stays
// good: this is a preference, not access control, and no policy reads it.

/** SQL: `column` isn't the caller's hidden location. NULL (no location) counts as not hidden. */
export const notHidden = (column: string): string =>
  `(${column} IS NULL OR ${column} NOT IN (SELECT kept.hidden_location_ids()))`;

/** SQL for an optional one-location filter in `param`: that location, else all but the hidden. */
export const namedOrShown = (column: string, param: string): string =>
  `(${column} = ${param}::uuid OR (${param}::uuid IS NULL AND ${notHidden(column)}))`;

/** The caller's hidden location, as a list of none or one. */
export async function hiddenLocationIds(client: pg.ClientBase): Promise<string[]> {
  const { rows } = await client.query<{ id: string }>(
    'SELECT id FROM kept.hidden_location_ids() AS v(id)',
  );
  return rows.map((r) => r.id);
}

/**
 * A location filter with the hidden location left out, unless the filter is "any of" (which names
 * what it wants). Undefined stays undefined when nothing is hidden.
 */
export async function shownFilter(
  client: pg.ClientBase,
  filter: Many | undefined,
): Promise<Many | undefined> {
  if (filter && !filter.not) return filter;
  const hidden = await hiddenLocationIds(client);
  if (hidden.length === 0) return filter;
  return { values: [...(filter?.values ?? []), ...hidden], not: true };
}
