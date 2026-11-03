import {
  type Compartment,
  canTurn,
  codesHeld,
  compartmentOf,
  coverageProblem,
  DEFAULT_COMPARTMENT_NAMES,
  fillPattern,
  gridOf,
  mergeCompartments,
  mergeProblem,
  newId,
  type Patterns,
  parseCell,
  positionCode,
  type ShortIdHold,
  type StoredCell,
  splitCompartment,
  storedCellOf,
  TURN_DIRECTIONS,
  turnCompartments,
  usesParent,
} from '@kept/shared';
import type pg from 'pg';
import { z } from 'zod';
import { actorOf } from '../audit/actor.js';
import { audited } from '../audit/audited.js';
import {
  lastChangedBy,
  notUndoable,
  type UndoArgs,
  undoableUntil,
  undoConflict,
} from '../audit/undo.js';
import { conflict, invalid, notFound } from '../http/errors.js';
import { legacyCodeOf } from '../imports/csv.js';
import { requireCan, requireMembership } from '../locations/access.js';
import { type Ctx, lockTree } from '../places/service.js';
import { type PlaceRow, requirePlace } from '../places/view.js';
import { enqueueReindex } from '../search/jobs.js';
import { auditRelocations, type Relocation } from '../things/relocate.js';
import { layoutOf, ownCodes, type Stored } from './furniture-view.js';
import { checkAllCodes } from './place-templates.js';

// Furniture's compartments after it is made (#238, 1.14.4): turning the unit, merging and
// splitting compartments. The rules are packages/shared compartments.ts; this module reads the
// furniture and its compartments, works out what they become, and writes it, one undoable event
// each on the furniture:
//
// POST /api/v1/places/:id/turn {direction: 'right' | 'left', renumber}        → `place.turn`
// POST /api/v1/places/:id/merge-compartments {compartmentIds}                → `place.merge_compartments`
// POST /api/v1/places/:id/split-compartment {compartmentId}                  → `place.split`
//
// Each needs `things.edit` where the furniture is, under the place tree's lock. What it changes is
// held as an image of the furniture (`Image`): its layout, each compartment involved (name, sort,
// cell, live or in the trash), the own codes and short IDs they hold, and the things and places
// moved. The event's diff carries the image before and after (`furniture`); undo checks that
// everything is still as the event left it, then writes the image before back (applyImage), so
// one function writes every change and its undo.
//
// - Turning moves every compartment with the unit. Renumber also gives each the number, name and
//   code of where it now stands; an old position code resolves to the compartment now in the
//   position it named. Short IDs stay with their compartment: the printed label is on it. A new
//   code is checked against the location's rule and against codes elsewhere in the location.
// - Merging puts the other compartments in the trash (one batch, their cell cleared, so a restore
//   from the Trash brings back a plain place), moves their own codes and short IDs (not primary)
//   to the one at the top left, and their things and places into it (each thing's move audited,
//   as a trash's are). The merged compartment records each part: where it sat, the place it was,
//   its codes and short IDs.
// - Splitting brings each recorded part back: the same place out of the trash when it is still
//   there, else a new one named by the pattern, with the codes and short IDs it brought; a cell
//   nobody recorded gets the code its position gives, when that is free. Things stay where they
//   are.
// Short IDs move through kept.move_compartment_short_ids() (0167): kept_app can't write a short
// ID's place itself.

const NOT_FURNITURE = 'This place has no compartments to turn, merge or split.';

export const TurnBody = z.strictObject({
  /** As you face it: its top went to the right (clockwise) or to the left. */
  direction: z.enum(TURN_DIRECTIONS),
  /** Renumber the compartments as the unit now stands, or keep their numbers and codes. */
  renumber: z.boolean(),
});
export type TurnBody = z.infer<typeof TurnBody>;

export const MergeCompartmentsBody = z.strictObject({
  compartmentIds: z.array(z.uuid()).min(2).max(100),
});
export type MergeCompartmentsBody = z.infer<typeof MergeCompartmentsBody>;

export const SplitCompartmentBody = z.strictObject({ compartmentId: z.uuid() });
export type SplitCompartmentBody = z.infer<typeof SplitCompartmentBody>;

type Furniture = {
  place: PlaceRow;
  raw: Record<string, unknown>;
  layout: Stored;
  compartments: Compartment[];
  kinds: Map<string, string>;
  /** The furniture's own codes, sorted: `{parent}`. */
  own: string[];
};

/** The furniture and its live compartments (409 when the place has no layout). */
async function readFurniture(client: pg.ClientBase, place: PlaceRow): Promise<Furniture> {
  const { rows: me } = await client.query<{ layout: Record<string, unknown> | null }>(
    'SELECT layout FROM public.places WHERE id = $1',
    [place.id],
  );
  const raw = me[0]?.layout ?? null;
  const layout = raw ? layoutOf(raw) : null;
  if (!raw || !layout) throw conflict(NOT_FURNITURE);
  const grid = gridOf(layout);
  const { rows } = await client.query<{
    id: string;
    name: string;
    kind_key: string;
    cell: unknown;
  }>(
    `SELECT id, name, kind_key, cell FROM public.places
      WHERE parent_id = $1 AND deleted_at IS NULL AND cell IS NOT NULL
      ORDER BY sort, id FOR UPDATE`,
    [place.id],
  );
  const ids = rows.map((r) => r.id);
  const codes = await ownCodes(client, ids);
  const shorts = await shortIdsOf(client, ids);
  const compartments: Compartment[] = [];
  const kinds = new Map<string, string>();
  for (const r of rows) {
    const cell = parseCell(r.cell);
    if (!cell) continue;
    kinds.set(r.id, r.kind_key);
    compartments.push(
      compartmentOf(
        { id: r.id, name: r.name, cell },
        grid,
        codes.get(r.id) ?? [],
        shorts.get(r.id) ?? [],
      ),
    );
  }
  const own = (await ownCodes(client, [place.id])).get(place.id) ?? [];
  return { place, raw, layout, compartments, kinds, own };
}

async function shortIdsOf(client: pg.ClientBase, ids: readonly string[]) {
  const { rows } = await client.query<{ code: string; place_id: string; is_primary: boolean }>(
    `SELECT code, place_id, is_primary FROM public.short_ids
      WHERE place_id = ANY ($1::uuid[]) AND state = 'assigned' ORDER BY code`,
    [ids],
  );
  const out = new Map<string, ShortIdHold[]>();
  for (const r of rows) {
    out.set(r.place_id, [...(out.get(r.place_id) ?? []), { code: r.code, primary: r.is_primary }]);
  }
  return out;
}

/** The patterns the furniture was named and coded with, and its own code for `{parent}`: the
 * one its compartments' codes were made from, else its first. */
function patternsOf(f: Furniture): Patterns {
  const name = f.layout.compartmentName ?? DEFAULT_COMPARTMENT_NAMES[f.layout.kind];
  const code = f.layout.codePattern;
  const norm = (c: string) => legacyCodeOf(c);
  if (!code || !usesParent(code)) return { name, code, parent: null, norm };
  const held = new Set(f.compartments.flatMap((c) => c.codes));
  const used = f.own.find((parent) =>
    f.compartments.some((c) => {
      const mine = positionCode({ name, code, parent, norm }, c);
      return mine !== null && held.has(mine);
    }),
  );
  return { name, code, parent: used ?? f.own[0] ?? null, norm };
}

// ---------------------------------------------------------------------------------------------
// The image: what a change writes, and its undo writes back
// ---------------------------------------------------------------------------------------------

type ImagePlace = { name: string; sort: number; cell: StoredCell | null; live: boolean };

export type Image = {
  layout: Record<string, unknown>;
  places: Record<string, ImagePlace>;
  /** Own codes on those places: code → place. */
  codes: Record<string, string>;
  /** Short IDs on those places: code → {place, primary}. */
  short_ids: Record<string, { place: string; primary: boolean }>;
  /** Things moved: id → place. */
  things: Record<string, string>;
  /** Places (not compartments) moved: id → parent. */
  children: Record<string, string>;
};

/** The image of the furniture as it is now, for `places`, `things` and `children`. */
async function imageNow(
  client: pg.ClientBase,
  furnitureId: string,
  places: readonly string[],
  things: readonly string[] = [],
  children: readonly string[] = [],
): Promise<Image> {
  const { rows: f } = await client.query<{ layout: Record<string, unknown> | null }>(
    'SELECT layout FROM public.places WHERE id = $1',
    [furnitureId],
  );
  const { rows: ps } = await client.query<{
    id: string;
    name: string;
    sort: number;
    cell: StoredCell | null;
    live: boolean;
    parent_id: string | null;
  }>(
    `SELECT id, name, sort, cell, deleted_at IS NULL AS live, parent_id FROM public.places
      WHERE id = ANY ($1::uuid[])`,
    [places],
  );
  const image: Image = {
    layout: f[0]?.layout ?? {},
    places: {},
    codes: {},
    short_ids: {},
    things: {},
    children: {},
  };
  for (const p of ps) {
    if (p.parent_id !== furnitureId) continue;
    image.places[p.id] = { name: p.name, sort: p.sort, cell: p.cell, live: p.live };
  }
  const ids = Object.keys(image.places);
  for (const [place, codes] of await ownCodes(client, ids)) {
    for (const code of codes) image.codes[code] = place;
  }
  for (const [place, held] of await shortIdsOf(client, ids)) {
    for (const s of held) image.short_ids[s.code] = { place, primary: s.primary };
  }
  if (things.length > 0) {
    const { rows } = await client.query<{ id: string; place_id: string | null }>(
      'SELECT id, place_id FROM public.things WHERE id = ANY ($1::uuid[]) AND deleted_at IS NULL',
      [things],
    );
    for (const r of rows) if (r.place_id) image.things[r.id] = r.place_id;
  }
  if (children.length > 0) {
    const { rows } = await client.query<{ id: string; parent_id: string | null }>(
      'SELECT id, parent_id FROM public.places WHERE id = ANY ($1::uuid[]) AND deleted_at IS NULL',
      [children],
    );
    for (const r of rows) if (r.parent_id) image.children[r.id] = r.parent_id;
  }
  return image;
}

const same = (a: unknown, b: unknown) =>
  JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

type Writer = {
  client: pg.ClientBase;
  locationId: string;
  furnitureId: string;
  userId: string | null;
  /** The kind a place the image makes gets (a split's new compartment). */
  kindOf: (id: string) => string;
};

/**
 * Writes `target` over `now` (both images of the same furniture): places brought back or made
 * first, then things and places moved, then places put in the trash, then codes and short IDs.
 * Returns the things it moved, for their `thing.move` rows.
 */
async function applyImage(w: Writer, now: Image, target: Image): Promise<Relocation[]> {
  const { client } = w;
  if (!same(now.layout, target.layout)) {
    await client.query('UPDATE public.places SET layout = $2 WHERE id = $1', [
      w.furnitureId,
      JSON.stringify(target.layout),
    ]);
  }
  // Places that are live in the target: made, brought back, or changed.
  for (const [id, p] of Object.entries(target.places)) {
    const was = now.places[id];
    if (!was) {
      await client.query(
        `INSERT INTO public.places (id, location_id, parent_id, name, kind_key, sort, cell,
                                    created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          w.locationId,
          w.furnitureId,
          p.name,
          w.kindOf(id),
          p.sort,
          p.cell ? JSON.stringify(p.cell) : null,
          w.userId,
        ],
      );
      continue;
    }
    if (!p.live) continue;
    if (same(was, p)) continue;
    await client.query(
      `UPDATE public.places SET name = $2, sort = $3, cell = $4,
              deleted_at = NULL, trash_batch_id = NULL
        WHERE id = $1`,
      [id, p.name, p.sort, p.cell ? JSON.stringify(p.cell) : null],
    );
  }
  // Things and places moved.
  const moved: Relocation[] = [];
  const thingIds = Object.keys({ ...now.things, ...target.things });
  if (thingIds.length > 0) {
    const { rows } = await client.query<{
      id: string;
      place_id: string | null;
      container_id: string | null;
    }>(
      'SELECT id, place_id, container_id FROM public.things WHERE id = ANY ($1::uuid[]) FOR UPDATE',
      [thingIds],
    );
    for (const r of rows) {
      const to = target.things[r.id];
      if (!to || to === r.place_id) continue;
      await client.query('UPDATE public.things SET place_id = $2 WHERE id = $1', [r.id, to]);
      moved.push({
        id: r.id,
        before: { place_id: r.place_id, container_id: r.container_id },
        after: { place_id: to, container_id: r.container_id },
      });
    }
  }
  for (const [id, parent] of Object.entries(target.children)) {
    if (now.children[id] === parent) continue;
    await client.query('UPDATE public.places SET parent_id = $2 WHERE id = $1', [id, parent]);
  }
  // Places the target has in the trash, or not at all (made by what is undone): one batch.
  const away = [
    ...Object.entries(target.places)
      .filter(([id, p]) => !p.live && now.places[id]?.live)
      .map(([id]) => id),
    ...Object.keys(now.places).filter((id) => !target.places[id] && now.places[id]?.live),
  ];
  if (away.length > 0) {
    await client.query(
      `UPDATE public.places SET deleted_at = now(), trash_batch_id = $2, cell = NULL
        WHERE id = ANY ($1::uuid[])`,
      [away, newId()],
    );
  }
  for (const [id, p] of Object.entries(target.places)) {
    const was = now.places[id];
    if (!was || p.live || was.live || same(was, p)) continue;
    await client.query('UPDATE public.places SET name = $2, sort = $3, cell = $4 WHERE id = $1', [
      id,
      p.name,
      p.sort,
      p.cell ? JSON.stringify(p.cell) : null,
    ]);
  }
  // Own codes: gone, moved or new.
  const gone = Object.keys(now.codes).filter((code) => !(code in target.codes));
  if (gone.length > 0) {
    await client.query(
      `DELETE FROM public.legacy_codes
        WHERE location_id = $1 AND source = 'own' AND source_collection = ''
          AND code = ANY ($2::text[])`,
      [w.locationId, gone],
    );
  }
  for (const [code, place] of Object.entries(target.codes)) {
    const was = now.codes[code];
    if (was === place) continue;
    if (was) {
      await client.query(
        `UPDATE public.legacy_codes SET place_id = $3
          WHERE location_id = $1 AND source = 'own' AND source_collection = '' AND code = $2`,
        [w.locationId, code, place],
      );
    } else {
      await client.query(
        `INSERT INTO public.legacy_codes (location_id, source, source_collection, code, place_id)
         VALUES ($1, 'own', '', $2, $3)`,
        [w.locationId, code, place],
      );
    }
  }
  // Short IDs, through their door.
  const shortMoves = Object.entries(target.short_ids)
    .filter(([code, s]) => !same(now.short_ids[code] ?? null, s))
    .map(([code, s]) => ({ code, place_id: s.place, is_primary: s.primary }));
  if (shortMoves.length > 0) {
    await client.query('SELECT kept.move_compartment_short_ids($1, $2::jsonb)', [
      w.furnitureId,
      JSON.stringify(shortMoves),
    ]);
  }
  return moved;
}

/** 409 unless the image now is still the one an event left (the furniture's undo). */
function changedFields(now: Image, left: Image): string[] {
  const fields: string[] = [];
  if (!same(now.layout, left.layout)) fields.push('layout');
  for (const [id, p] of Object.entries(left.places)) {
    if (!same(now.places[id] ?? null, p)) fields.push('compartments');
  }
  if (!same(now.codes, left.codes)) fields.push('codes');
  if (!same(now.short_ids, left.short_ids)) fields.push('labels');
  for (const [id, place] of Object.entries(left.things)) {
    if (now.things[id] !== place) fields.push('contents');
  }
  for (const [id, parent] of Object.entries(left.children)) {
    if (now.children[id] !== parent) fields.push('contents');
  }
  return [...new Set(fields)];
}

// ---------------------------------------------------------------------------------------------
// The three changes
// ---------------------------------------------------------------------------------------------

type Action = 'place.turn' | 'place.merge_compartments' | 'place.split';

async function begin(c: Ctx, id: string) {
  const seen = await requirePlace(c.client, id);
  const me = await requireMembership(c.client, seen.locationId);
  requireCan(me.role, 'things.edit');
  await lockTree(c.client, seen.locationId);
  const place = await requirePlace(c.client, id, { lock: true });
  const f = await readFurniture(c.client, place);
  const problem = coverageProblem(f.compartments, gridOf(f.layout));
  if (problem) {
    throw conflict('Its compartments no longer fill its grid: check the places inside it.');
  }
  return f;
}

/** The image of `list` (compartments after a change) written over `now`. */
function imageAfter(now: Image, list: readonly Compartment[], renumber: boolean): Image {
  const target: Image = structuredClone(now);
  for (const c of list) {
    const was = now.places[c.id];
    if (!was) continue;
    target.places[c.id] = {
      name: c.name,
      sort: renumber ? c.n - 1 : was.sort,
      cell: storedCellOf(c),
      live: true,
    };
  }
  const held = codesHeld(list);
  for (const code of Object.keys(target.codes)) if (!held.has(code)) delete target.codes[code];
  for (const [code, place] of held) target.codes[code] = place;
  return target;
}

async function record(
  c: Ctx,
  f: Furniture,
  action: Action,
  before: Image,
  after: Image,
  what: Record<string, unknown>,
  moved: Relocation[],
) {
  const actor = actorOf(c.scope);
  await auditRelocations(
    c.tx,
    { locationId: f.place.locationId, actor, requestId: c.requestId },
    moved,
  );
  await audited(c.tx, {
    locationId: f.place.locationId,
    actor,
    action,
    entity: { type: 'place', id: f.place.id },
    before: { furniture: before },
    after: { furniture: after, ...what },
    ...(moved.length > 0 ? { subjects: moved.map((m) => m.id) } : {}),
    requestId: c.requestId,
    undoableUntil: undoableUntil(),
  });
}

const writer = (c: Ctx, f: Furniture, kind: string): Writer => ({
  client: c.client,
  locationId: f.place.locationId,
  furnitureId: f.place.id,
  userId: c.scope.userId,
  kindOf: (id) => f.kinds.get(id) ?? kind,
});

/** POST /api/v1/places/:id/turn → the furniture. */
export async function turnFurniture(c: Ctx, id: string, body: TurnBody): Promise<PlaceRow> {
  const f = await begin(c, id);
  if (!canTurn(f.layout)) {
    throw conflict('Only a grid that isn’t square can stand on its side.');
  }
  const patterns = patternsOf(f);
  const out = turnCompartments(f.compartments, f.layout, body.direction, body.renumber, patterns);
  const ids = f.compartments.map((x) => x.id);
  const now = await imageNow(c.client, f.place.id, ids);
  const target = imageAfter(now, out.compartments, body.renumber);
  target.layout = { ...f.raw, orientation: out.orientation };
  const fresh = Object.keys(target.codes).filter((code) => !(code in now.codes));
  await checkAllCodes(c.client, f.place.locationId, fresh, ids);
  const moved = await applyImage(writer(c, f, 'cube'), now, target);
  await record(
    c,
    f,
    'place.turn',
    now,
    target,
    { turned: body.direction, renumbered: body.renumber },
    moved,
  );
  // Compartments renamed or moved: the things in them search and read by the new path.
  await enqueueReindex(c.jobs, c.client, f.place.locationId);
  return requirePlace(c.client, f.place.id);
}

const MERGE_HINTS: Record<string, string> = {
  fewer: 'Choose two or more compartments to merge.',
  unknown: 'Choose compartments of this furniture.',
  not_rectangle: 'Choose compartments side by side that make a rectangle.',
};

/** POST /api/v1/places/:id/merge-compartments → the furniture. */
export async function mergeFurnitureCompartments(
  c: Ctx,
  id: string,
  body: MergeCompartmentsBody,
): Promise<PlaceRow> {
  const f = await begin(c, id);
  const ids = [...new Set(body.compartmentIds.map((x) => x.toLowerCase()))];
  const problem = mergeProblem(f.compartments, ids);
  if (problem) throw invalid(MERGE_HINTS[problem] ?? MERGE_HINTS.unknown);
  const { survivor, absorbed } = mergeCompartments(f.compartments, ids);
  const gone = absorbed.map((x) => x.id);
  const { rows: things } = await c.client.query<{ id: string }>(
    `SELECT id FROM public.things WHERE place_id = ANY ($1::uuid[]) AND deleted_at IS NULL
      ORDER BY id FOR UPDATE`,
    [gone],
  );
  const { rows: children } = await c.client.query<{ id: string }>(
    `SELECT id FROM public.places
      WHERE parent_id = ANY ($1::uuid[]) AND deleted_at IS NULL ORDER BY id FOR UPDATE`,
    [gone],
  );
  const now = await imageNow(
    c.client,
    f.place.id,
    [survivor.id, ...gone],
    things.map((r) => r.id),
    children.map((r) => r.id),
  );
  const target = imageAfter(now, [survivor], false);
  for (const x of absorbed) {
    const was = now.places[x.id] as ImagePlace;
    target.places[x.id] = { ...was, cell: null, live: false };
    for (const s of x.shortIds) target.short_ids[s.code] = { place: survivor.id, primary: false };
    for (const p of x.parts) {
      for (const s of p.shortIds) target.short_ids[s.code] = { place: survivor.id, primary: false };
    }
  }
  for (const t of things) target.things[t.id] = survivor.id;
  for (const k of children) target.children[k.id] = survivor.id;
  const moved = await applyImage(writer(c, f, 'cube'), now, target);
  await record(
    c,
    f,
    'place.merge_compartments',
    now,
    target,
    { merged: [survivor.id, ...gone] },
    moved,
  );
  // Compartments renamed or moved: the things in them search and read by the new path.
  await enqueueReindex(c.jobs, c.client, f.place.locationId);
  return requirePlace(c.client, f.place.id);
}

/** POST /api/v1/places/:id/split-compartment → the furniture. */
export async function splitFurnitureCompartment(
  c: Ctx,
  id: string,
  body: SplitCompartmentBody,
): Promise<PlaceRow> {
  const f = await begin(c, id);
  const cid = body.compartmentId.toLowerCase();
  const one = f.compartments.find((x) => x.id === cid);
  if (!one) throw notFound();
  if (one.rows * one.cols < 2) throw conflict('This compartment is one cell already.');
  const grid = gridOf(f.layout);
  const { survivor, pieces } = splitCompartment(one, grid);
  const patterns = patternsOf(f);
  // A recorded part comes back as the same place while it is still in the trash here.
  const wanted = pieces.flatMap((p) => (p.part ? [p.part.placeId] : []));
  const { rows: trashed } = await c.client.query<{ id: string }>(
    `SELECT id FROM public.places
      WHERE id = ANY ($1::uuid[]) AND parent_id = $2 AND deleted_at IS NOT NULL FOR UPDATE`,
    [wanted, f.place.id],
  );
  const back = new Set(trashed.map((r) => r.id));
  const now = await imageNow(c.client, f.place.id, [one.id, ...back]);
  const target = imageAfter(now, [survivor], false);
  // The survivor keeps its own codes and short IDs; each piece takes its own back.
  for (const code of one.parts.flatMap((p) => p.codes)) delete target.codes[code];
  const fresh: { code: string; placeId: string }[] = [];
  const made = new Set<string>();
  for (const piece of pieces) {
    const part = piece.part;
    const placeId = part && back.has(part.placeId) ? part.placeId : newId();
    if (!back.has(placeId)) made.add(placeId);
    const name =
      (part?.name ?? '').trim() || fillPattern(patterns.name ?? 'Cube {n}', piece).trim();
    target.places[placeId] = {
      name,
      sort: now.places[placeId]?.sort ?? piece.n - 1,
      cell: { row: piece.row, col: piece.col, n: part?.n ?? piece.n },
      live: true,
    };
    // What it brought, as far as the merged compartment still holds it (a code removed since, or
    // an import's new short IDs, stay where they are).
    for (const code of part?.codes ?? [])
      if (now.codes[code] === one.id) target.codes[code] = placeId;
    if (!part) {
      const code = positionCode(patterns, piece);
      if (code && !(code in target.codes)) fresh.push({ code, placeId });
    }
    const held = (part?.shortIds ?? []).filter((s) => now.short_ids[s.code]?.place === one.id);
    held.forEach((s, i) => {
      target.short_ids[s.code] = {
        place: placeId,
        primary: back.has(placeId) ? s.primary : i === 0,
      };
    });
  }
  // A cell nobody recorded gets its position's code only when that is free here and follows
  // the rule; otherwise none.
  for (const { code, placeId } of fresh) {
    const ok = await checkAllCodes(c.client, f.place.locationId, [code], [one.id]).then(
      () => true,
      () => false,
    );
    if (ok) target.codes[code] = placeId;
  }
  const kind = f.kinds.get(one.id) ?? 'cube';
  const moved = await applyImage(writer(c, f, kind), now, target);
  await record(c, f, 'place.split', now, target, { split: one.id, made: [...made] }, moved);
  // Compartments renamed or moved: the things in them search and read by the new path.
  await enqueueReindex(c.jobs, c.client, f.place.locationId);
  return requirePlace(c.client, f.place.id);
}

// ---------------------------------------------------------------------------------------------
// Undo
// ---------------------------------------------------------------------------------------------

const isImage = (v: unknown): v is Image =>
  !!v &&
  typeof v === 'object' &&
  'places' in v &&
  'codes' in v &&
  'short_ids' in v &&
  'layout' in v;

/**
 * Undo of a turn, a merge or a split: refused (409 `changed_since`) unless the furniture, the
 * compartments it changed, their codes and short IDs and the things it moved are all still as it
 * left them; then the image before is written back, with the reverse audited under the same
 * action. A split's new places go to the trash.
 */
export async function undoFurniture(args: UndoArgs): Promise<void> {
  const { client, event } = args;
  const id = event.entityId;
  const change = event.diff.furniture;
  if (event.entityType !== 'place' || !id || !change) throw notUndoable();
  const before = change.before;
  const after = change.after;
  if (!isImage(before) || !isImage(after)) throw notUndoable();
  requireCan(args.role, 'things.edit');
  await lockTree(client, event.locationId);
  const place = await requirePlace(client, id, { trashed: 'any', lock: true }).catch(() => null);
  if (!place || place.locationId !== event.locationId) {
    throw conflict("Can't undo: that furniture no longer exists.");
  }
  if (place.deletedAt) throw undoConflict(['deleted_at']);
  const ids = [...new Set([...Object.keys(before.places), ...Object.keys(after.places)])];
  const things = [...new Set([...Object.keys(before.things), ...Object.keys(after.things)])];
  const children = [...new Set([...Object.keys(before.children), ...Object.keys(after.children)])];
  const now = await imageNow(client, id, ids, things, children);
  const changed = changedFields(now, after);
  if (changed.length > 0) {
    throw undoConflict(
      changed,
      await lastChangedBy(client, event.locationId, { type: 'place', id }, event.at),
    );
  }
  // What it put back must be free again: a code given to something else here since.
  const back = Object.keys(before.codes).filter((code) => !(code in now.codes));
  if (back.length > 0) {
    const { rows } = await client.query<{ code: string }>(
      `SELECT code FROM public.legacy_codes WHERE location_id = $1 AND code = ANY ($2::text[])`,
      [event.locationId, back],
    );
    if (rows.length > 0) throw undoConflict(['codes']);
  }
  // A place the undo puts in the trash must hold nothing it didn't bring: a thing or a place put
  // in a split's piece since would be left live inside the trash (as undoFurnitureCreate refuses).
  const away = ids.filter((x) => now.places[x]?.live && !before.places[x]?.live);
  if (away.length > 0) {
    const { rows: holds } = await client.query<{ n: number }>(
      `SELECT ((SELECT count(*) FROM public.things t
                 WHERE t.place_id = ANY ($1::uuid[]) AND t.deleted_at IS NULL
                   AND NOT (t.id = ANY ($2::uuid[])))
             + (SELECT count(*) FROM public.places k
                 WHERE k.parent_id = ANY ($1::uuid[]) AND k.deleted_at IS NULL
                   AND NOT (k.id = ANY ($1::uuid[])) AND NOT (k.id = ANY ($3::uuid[]))))::int AS n`,
      [away, Object.keys(before.things), Object.keys(before.children)],
    );
    if ((holds[0]?.n ?? 0) > 0) throw undoConflict(['contents']);
  }
  const { rows: kinds } = await client.query<{ id: string; kind_key: string }>(
    'SELECT id, kind_key FROM public.places WHERE id = ANY ($1::uuid[])',
    [ids],
  );
  const kindOf = new Map(kinds.map((k) => [k.id, k.kind_key]));
  const moved = await applyImage(
    {
      client,
      locationId: event.locationId,
      furnitureId: id,
      userId: args.scope.userId,
      kindOf: (x) => kindOf.get(x) ?? 'cube',
    },
    now,
    before,
  );
  await auditRelocations(
    args.tx,
    { locationId: event.locationId, actor: actorOf(args.scope), requestId: args.requestId },
    moved,
  );
  await args.audit({
    action: event.action,
    entity: { type: 'place', id },
    before: { furniture: now },
    after: { furniture: before },
    ...(moved.length > 0 ? { subjects: moved.map((m) => m.id) } : {}),
  });
  await enqueueReindex(args.deps.jobs, client, event.locationId);
}
