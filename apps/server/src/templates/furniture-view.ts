import {
  canTurn,
  compartmentOf,
  type FurnitureLayout,
  gridOf,
  PLACE_LAYOUT_KINDS,
  PLACE_ORIENTATIONS,
  parseCell,
} from '@kept/shared';
import type pg from 'pg';
import { z } from 'zod';

// What a furniture place's page shows of its compartments (#238; PlaceView.furniture), the
// stored layout read back, and which places are its compartments (a trash takes them, #445). Apart from furniture.ts, which writes them, so places/view.ts can use
// it without importing the places service back.

/** Furniture's layout as stored (place-templates.ts `stands`). */
export type Stored = FurnitureLayout & {
  compartmentName: string | null;
  codePattern: string | null;
};

const Layout = z
  .object({
    kind: z.enum(PLACE_LAYOUT_KINDS),
    across: z.number().int().optional(),
    up: z.number().int().optional(),
    count: z.number().int().optional(),
    orientation: z.enum(PLACE_ORIENTATIONS).optional(),
    compartmentName: z.string().nullable().optional(),
    codePattern: z.string().nullable().optional(),
  })
  .passthrough();

/** A stored layout read back, or null. */
export function layoutOf(raw: unknown): Stored | null {
  const p = Layout.safeParse(raw);
  if (!p.success) return null;
  const v = p.data;
  const orientation = v.orientation ?? 'upright';
  const names = { compartmentName: v.compartmentName ?? null, codePattern: v.codePattern ?? null };
  if (v.kind === 'grid') {
    if (!v.across || !v.up) return null;
    return { kind: 'grid', across: v.across, up: v.up, orientation, ...names };
  }
  if (!v.count) return null;
  return { kind: v.kind, count: v.count, orientation, ...names };
}

/**
 * The ids of a place's live compartments, as its page shows them (furnitureViewOf): its child
 * places with a cell, when it has a layout. A place added to the furniture by hand has no cell,
 * so it isn't one. Empty for a place that isn't furniture.
 */
export async function compartmentIdsOf(client: pg.ClientBase, placeId: string): Promise<string[]> {
  const { rows: me } = await client.query<{ layout: unknown }>(
    'SELECT layout FROM public.places WHERE id = $1',
    [placeId],
  );
  if (!layoutOf(me[0]?.layout ?? null)) return [];
  const { rows } = await client.query<{ id: string; cell: unknown }>(
    `SELECT id, cell FROM public.places
      WHERE parent_id = $1 AND deleted_at IS NULL AND cell IS NOT NULL`,
    [placeId],
  );
  return rows.filter((r) => parseCell(r.cell)).map((r) => r.id);
}

/** The own codes on these places, sorted, by place. */
export async function ownCodes(client: pg.ClientBase, ids: readonly string[]) {
  const { rows } = await client.query<{ code: string; place_id: string }>(
    `SELECT code, place_id FROM public.legacy_codes
      WHERE place_id = ANY ($1::uuid[]) AND source = 'own' AND source_collection = ''
      ORDER BY code`,
    [ids],
  );
  const out = new Map<string, string[]>();
  for (const r of rows) out.set(r.place_id, [...(out.get(r.place_id) ?? []), r.code]);
  return out;
}

export const FurnitureViewSchema = z.object({
  layout: z.object({
    kind: z.enum(PLACE_LAYOUT_KINDS),
    across: z.number().int().optional(),
    up: z.number().int().optional(),
    count: z.number().int().optional(),
    orientation: z.enum(PLACE_ORIENTATIONS),
  }),
  /** The grid as it stands. */
  columns: z.number().int(),
  rows: z.number().int(),
  canTurn: z.boolean(),
  compartmentName: z.string().nullable(),
  codePattern: z.string().nullable(),
  compartments: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      n: z.number().int(),
      row: z.number().int(),
      col: z.number().int(),
      rows: z.number().int(),
      cols: z.number().int(),
      shortCode: z.string().nullable(),
      /** Its first own code, if any. */
      code: z.string().nullable(),
      things: z.number().int(),
    }),
  ),
});
export type FurnitureView = z.infer<typeof FurnitureViewSchema>;

/** A place's compartments as its page shows them, or null for a place with no layout. */
export async function furnitureViewOf(
  client: pg.ClientBase,
  placeId: string,
): Promise<FurnitureView | null> {
  const { rows: me } = await client.query<{ layout: unknown }>(
    'SELECT layout FROM public.places WHERE id = $1',
    [placeId],
  );
  const layout = layoutOf(me[0]?.layout ?? null);
  if (!layout) return null;
  const grid = gridOf(layout);
  const { rows } = await client.query<{
    id: string;
    name: string;
    cell: unknown;
    short_code: string | null;
    things: number;
  }>(
    `SELECT p.id, p.name, p.cell,
            (SELECT s.code FROM public.short_ids s
              WHERE s.place_id = p.id AND s.is_primary AND s.state = 'assigned' LIMIT 1)
              AS short_code,
            (SELECT count(*) FROM public.things t
              WHERE t.place_id = p.id AND t.deleted_at IS NULL)::int AS things
       FROM public.places p
      WHERE p.parent_id = $1 AND p.deleted_at IS NULL AND p.cell IS NOT NULL
      ORDER BY p.sort, p.id`,
    [placeId],
  );
  const codes = await ownCodes(
    client,
    rows.map((r) => r.id),
  );
  const compartments: FurnitureView['compartments'] = [];
  for (const r of rows) {
    const cell = parseCell(r.cell);
    if (!cell) continue;
    const c = compartmentOf({ id: r.id, name: r.name, cell }, grid, codes.get(r.id) ?? [], []);
    compartments.push({
      id: r.id,
      name: r.name,
      n: c.n,
      row: c.row,
      col: c.col,
      rows: c.rows,
      cols: c.cols,
      shortCode: r.short_code,
      code: c.codes[0] ?? null,
      things: r.things,
    });
  }
  const { compartmentName, codePattern, orientation, ...size } = layout;
  return {
    layout: { ...size, orientation },
    columns: grid.columns,
    rows: grid.rows,
    canTurn: canTurn(layout),
    compartmentName,
    codePattern,
    compartments: compartments.sort((a, b) => a.n - b.n),
  };
}
