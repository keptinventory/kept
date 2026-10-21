import { parseRef } from '@kept/mcp';
import { normalize } from '@kept/shared';
import type pg from 'pg';
import { matchType } from '../extraction/apply.js';
import { notFound } from '../http/errors.js';
import type { PersonInput } from '../lending/service.js';

// References a model or an MCP client typed (a UUID or a short ID in any spelling, D137, D208),
// resolved as the caller: a row they can't see, one in the trash, and one in another location
// than the call's are all the same 404, as the routes answer them.

export type Resolved = { kind: 'thing' | 'place'; id: string; locationId: string };

/** A live thing or place `raw` names, wherever the caller can see it; null when none. */
export async function findRef(client: pg.ClientBase, raw: string): Promise<Resolved | null> {
  const ref = parseRef(raw);
  if (!ref) return null;
  if (ref.kind === 'id') {
    const { rows } = await client.query<{ kind: 'thing' | 'place'; location_id: string }>(
      `SELECT 'thing' AS kind, location_id FROM public.things WHERE id = $1 AND deleted_at IS NULL
       UNION ALL
       SELECT 'place', location_id FROM public.places WHERE id = $1 AND deleted_at IS NULL`,
      [ref.id],
    );
    const r = rows[0];
    return r ? { kind: r.kind, id: ref.id, locationId: r.location_id } : null;
  }
  const { rows } = await client.query<{ kind: 'thing' | 'place'; id: string; location_id: string }>(
    `SELECT CASE WHEN s.thing_id IS NOT NULL THEN 'thing' ELSE 'place' END AS kind,
            coalesce(t.id, p.id) AS id, coalesce(t.location_id, p.location_id) AS location_id
       FROM public.short_ids s
       LEFT JOIN public.things t ON t.id = s.thing_id AND t.deleted_at IS NULL
       LEFT JOIN public.places p ON p.id = s.place_id AND p.deleted_at IS NULL
      WHERE s.code = $1 AND s.state = 'assigned' AND coalesce(t.id, p.id) IS NOT NULL`,
    [ref.code],
  );
  const r = rows[0];
  return r ? { kind: r.kind, id: r.id, locationId: r.location_id } : null;
}

/** The location of the row `raw` names, for a handler's `subjectLocation`. */
export async function locationOfRef(
  client: pg.ClientBase,
  raw: string | undefined,
): Promise<string | null> {
  if (!raw) return null;
  return (await findRef(client, raw))?.locationId ?? null;
}

/** A live thing in `locationId`: its id, else 404. */
export async function thingIn(client: pg.ClientBase, locationId: string, raw: string) {
  const found = await findRef(client, raw);
  if (found?.kind !== 'thing' || found.locationId !== locationId) throw notFound();
  return found.id;
}

/** A live place in `locationId`: its id, else 404. */
export async function placeIn(client: pg.ClientBase, locationId: string, raw: string) {
  const found = await findRef(client, raw);
  if (found?.kind !== 'place' || found.locationId !== locationId) throw notFound();
  return found.id;
}

/** A place or a container (a thing) in `locationId`, as the operations' MoveTarget. */
export async function targetIn(
  client: pg.ClientBase,
  locationId: string,
  raw: string,
): Promise<{ placeId: string } | { containerId: string }> {
  const found = await findRef(client, raw);
  if (!found || found.locationId !== locationId) throw notFound();
  return found.kind === 'place' ? { placeId: found.id } : { containerId: found.id };
}

/**
 * The type a person named ("Drill"): a built-in by its English or Arabic name (D154), else one
 * of the location's account's own types by name, compared after kept.normalize()'s twin. Null
 * when none matches; the caller says so rather than guessing (add_thing's `not_set`).
 */
/**
 * The type a name says, in the location's account: matched as capture's type hint is (the
 * account's own types by name, then the built-in library by its English or Arabic name or a part
 * of it, "Box / bin" → "bin", the account's copy of a built-in first). Null when none matches.
 */
export async function typeNamed(
  client: pg.ClientBase,
  locationId: string,
  name: string,
): Promise<string | null> {
  const { rows } = await client.query<{ owner_account_id: string }>(
    'SELECT owner_account_id FROM public.locations WHERE id = $1',
    [locationId],
  );
  const account = rows[0]?.owner_account_id;
  return account ? matchType(client, account, name) : null;
}

/** A brand of the location's account by name: the one there is, or a new one (as capture
 * makes a brand it reads). */
export async function brandEnsured(
  client: pg.ClientBase,
  locationId: string,
  name: string,
): Promise<string> {
  const { rows } = await client.query<{ id: string }>('SELECT kept.ai_ensure_brand($1, $2) AS id', [
    locationId,
    name.trim(),
  ]);
  return (rows[0] as { id: string }).id;
}

/** The location account's tags by name; the names no tag has come back in `missing`. */
export async function tagsNamed(
  client: pg.ClientBase,
  locationId: string,
  names: readonly string[],
): Promise<{ ids: string[]; missing: string[] }> {
  const { rows } = await client.query<{ id: string; key: string }>(
    `SELECT g.id, kept.normalize(g.name) AS key FROM public.tags g
       JOIN public.locations l ON l.owner_account_id = g.owner_account_id
      WHERE l.id = $1 AND kept.normalize(g.name) = ANY (
        SELECT kept.normalize(n) FROM unnest($2::text[]) AS n)`,
    [locationId, names],
  );
  const byKey = new Map(rows.map((r) => [r.key, r.id]));
  const ids: string[] = [];
  const missing: string[] = [];
  for (const n of names) {
    const id = byKey.get(normalize(n));
    if (id) {
      if (!ids.includes(id)) ids.push(id);
    } else missing.push(n);
  }
  return { ids, missing };
}

/** A vendor of the location's account by name, or null. */
export async function vendorNamed(
  client: pg.ClientBase,
  locationId: string,
  name: string,
): Promise<string | null> {
  const { rows } = await client.query<{ id: string }>(
    `SELECT v.id FROM public.vendors v
       JOIN public.locations l ON l.owner_account_id = v.owner_account_id
      WHERE l.id = $1 AND kept.normalize(v.name) = kept.normalize($2)
      ORDER BY v.id LIMIT 1`,
    [locationId, name],
  );
  return rows[0]?.id ?? null;
}

/** A person as the model names them: an id, else a person of the location's account with that
 * name (so "Murdock" twice is one person), else a new one by name. */
export async function personOf(
  client: pg.ClientBase,
  locationId: string,
  raw: string,
): Promise<PersonInput> {
  const ref = parseRef(raw);
  if (ref?.kind === 'id') return { id: ref.id };
  const { rows } = await client.query<{ id: string }>(
    `SELECT pe.id FROM public.people pe
       JOIN public.locations l ON l.owner_account_id = pe.owner_account_id
      WHERE l.id = $1 AND kept.normalize(pe.display_name) = kept.normalize($2)
      ORDER BY pe.created_at, pe.id LIMIT 1`,
    [locationId, raw],
  );
  return rows[0] ? { id: rows[0].id } : { name: raw };
}

export async function brandNamed(
  client: pg.ClientBase,
  locationId: string,
  name: string,
): Promise<string | null> {
  const { rows } = await client.query<{ id: string }>(
    `SELECT b.id FROM public.brands b
       JOIN public.locations l ON l.owner_account_id = b.owner_account_id
      WHERE l.id = $1 AND kept.normalize(b.name) = kept.normalize($2)
      LIMIT 1`,
    [locationId, name],
  );
  return rows[0]?.id ?? null;
}
