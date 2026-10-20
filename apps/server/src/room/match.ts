/**
 * Already in Kept (#194): an object a room photo shows that the room already holds is not drafted
 * again. Candidates are the live, reviewed things in the target (a place and every place inside
 * it, or a container), and in their containers, all the way down, plus the things whose Kept
 * label the phone read in the photos, wherever they are in the location.
 *
 * - `code`: the phone read the thing's label in a photo. Certain: Mark seen starts ticked.
 * - `brand_model`: the same brand and model (normalised).
 * - `name_type`: the same name, and the same type when both have one (the object's type hint
 *   against the thing's type name or built-in key, normalised).
 *
 * Read as the capturing person under row-level security: only what they can see matches.
 */
import { normalize } from '@kept/shared';
import type pg from 'pg';
import type { Merged } from './merge.js';

export type MatchReason = 'code' | 'brand_model' | 'name_type';

export type Candidate = {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  type: string | null;
  builtin: string | null;
  byCode: boolean;
};

export type Already = {
  thingId: string;
  name: string;
  matchedBy: MatchReason;
  photo: number | null;
};

/** The things a room capture is compared with. */
export async function candidatesOf(
  client: pg.ClientBase,
  target: { locationId: string; placeId: string | null; containerId: string | null },
  codes: readonly string[],
): Promise<Candidate[]> {
  const { rows } = await client.query<Candidate & { by_code: boolean }>(
    `WITH RECURSIVE pl AS (
       SELECT p.id FROM public.places p
        WHERE p.id = $2::uuid AND p.deleted_at IS NULL
       UNION
       SELECT c.id FROM public.places c JOIN pl ON c.parent_id = pl.id
        WHERE c.deleted_at IS NULL),
     inside AS (
       SELECT t.id FROM public.things t
        WHERE t.location_id = $1 AND t.deleted_at IS NULL
          AND (t.place_id IN (SELECT id FROM pl) OR t.container_id = $3::uuid)
       UNION
       SELECT t.id FROM public.things t JOIN inside ON t.container_id = inside.id
        WHERE t.deleted_at IS NULL),
     coded AS (
       SELECT s.thing_id AS id FROM public.short_ids s
        WHERE s.code = ANY ($4::text[]) AND s.state = 'assigned' AND s.thing_id IS NOT NULL
          AND s.location_id = $1)
     SELECT t.id, coalesce(t.name, '') AS name, b.name AS brand, t.model,
            ty.name AS type, coalesce(ty.builtin_key, pt.builtin_key) AS builtin,
            t.id IN (SELECT id FROM coded) AS by_code
       FROM public.things t
       LEFT JOIN public.brands b ON b.id = t.brand_id
       LEFT JOIN public.types ty ON ty.id = t.type_id
       LEFT JOIN public.types pt ON pt.id = ty.parent_id
      WHERE (t.id IN (SELECT id FROM inside) OR t.id IN (SELECT id FROM coded))
        AND t.deleted_at IS NULL AND t.review_state <> 'draft'
      ORDER BY t.created_at, t.id`,
    [target.locationId, target.placeId, target.containerId, [...codes]],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    brand: r.brand,
    model: r.model,
    type: r.type,
    builtin: r.builtin,
    byCode: r.by_code,
  }));
}

const n = (s: string | null | undefined) => normalize(s ?? '');

function typeAgrees(hint: string | undefined, c: Candidate): boolean {
  const h = n(hint);
  if (!h) return true;
  const own = [n(c.type), n(c.builtin?.replace(/_/g, ' '))].filter(Boolean);
  if (own.length === 0) return true;
  return own.some((t) => t === h || t.includes(h) || h.includes(t));
}

/** Which candidate an object already is, if any, and why. */
export function matchOf(
  o: Merged,
  candidates: readonly Candidate[],
): (Candidate & { why: MatchReason }) | null {
  const brand = n(o.fields.brand?.value);
  const model = n(o.fields.model?.value);
  const name = n(o.fields.name?.value);
  if (brand && model) {
    const c = candidates.find((x) => n(x.brand) === brand && n(x.model) === model);
    if (c) return { ...c, why: c.byCode ? 'code' : 'brand_model' };
  }
  const c = candidates.find((x) => n(x.name) === name && typeAgrees(o.fields.typeHint?.value, x));
  return c ? { ...c, why: c.byCode ? 'code' : 'name_type' } : null;
}

/** Splits the merged objects into those already in Kept and the rest, and lists every thing whose
 * label was read, matched to an object or not. */
export function sortOut(
  merged: readonly Merged[],
  candidates: readonly Candidate[],
): { fresh: Merged[]; already: Already[] } {
  const fresh: Merged[] = [];
  const already = new Map<string, Already>();
  for (const o of merged) {
    const hit = matchOf(o, candidates);
    if (!hit) {
      fresh.push(o);
      continue;
    }
    if (!already.has(hit.id)) {
      already.set(hit.id, { thingId: hit.id, name: hit.name, matchedBy: hit.why, photo: o.photo });
    }
  }
  for (const c of candidates) {
    if (c.byCode && !already.has(c.id)) {
      already.set(c.id, { thingId: c.id, name: c.name, matchedBy: 'code', photo: null });
    }
  }
  return { fresh, already: [...already.values()] };
}
