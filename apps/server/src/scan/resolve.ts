import {
  CODE_FIELD_MAX,
  can,
  isProductCode,
  parseScan,
  productCodeForms,
  SCAN_SESSION_LIMITS,
  type ScanResult,
  serialsOf,
} from '@kept/shared';
import type pg from 'pg';
import { z } from 'zod';
import { legacyCodeOf } from '../imports/csv.js';
import { callerMembership } from '../locations/access.js';

// What a scan means (D120, D137, D146, D208). The web contract is
// apps/web/src/api/capture/types.ts `ScanOutcome`; the phone answers from its snapshot first and
// asks here online (apps/web/src/components/scan/resolve.ts).
//
// `parseScan()` (@kept/shared) classifies the text, then one resolver per kind answers:
// - `kept` (a short ID, any host, D120): a live thing or place the caller sees → `open`; a blank
//   in a location where the caller may use labels → `claim`; else the code as a `kept` legacy
//   code, an imported export's label re-issued here;
// - `homebox` (`/a/<assetId>`, `/item/<uuid>`, `/location/<uuid>`, D146): the Homebox legacy
//   codes the caller sees: one live target → `open`, several (an asset ID repeats per collection)
//   → `legacy_ambiguous` with the candidates, each with its location (so the phone can queue
//   `mark_seen` for a pick offline);
// - `barcode`: the things that carry it as their serial number (a GS1 code's serial, or any code
//   that isn't a product's GTIN, such as an asset tag) or else as their barcode, one → `open`,
//   several → `legacy_ambiguous`; else `barcode` with whether lookup is on (the lookup is its own
//   call). A GS1 code's barcode is its GTIN;
// - `other`: the things whose serial number or barcode it is, as for `barcode`; else `not_kept`
//   with the text (D137: "Not a Kept label", nothing hidden).
// Before a miss is answered, the text as typed is looked up among every legacy code the caller
// sees (a CSV import's old codes; a Homebox asset ID typed by hand; own codes later, D208,
// which are `legacy_codes` rows with `source = 'own'` and so resolve here unchanged).
// A short ID always wins over a legacy code of the same text.
//
// A miss is `not_in_your_kept`, identical for a missing, retired or trashed code, another
// household's code or blank, and a blank the caller may only view (D137): every lookup runs as
// the caller under RLS, so another tenant's rows are never read, and each miss path answers the
// same body. Nothing here marks anything seen: the phone calls `POST /things/:id/seen` after
// opening (D40), or queues `mark_seen`.
//
// Every query is an equality on an indexed key (short_ids' primary key, legacy_codes(source,
// code) and its primary key, things(location_id, barcode) and things(location_id, serial)),
// which PostgreSQL treats as leakproof, so RLS keeps the index. A serial is matched exactly, as
// stored: the scanned text is what is printed on the thing. A product barcode is matched on each
// of its spellings (`productCodeForms`: a UPC-A's 12 digits and the 13 an iPhone reads, a UPC-E's
// 8), still an equality on the index (`= ANY`).

export const ResolveScanBody = z.object({
  text: z.string().max(2048),
  format: z.string().max(40).optional(),
});

const Target = z.object({
  kind: z.enum(['thing', 'place']),
  id: z.uuid(),
  locationId: z.uuid(),
});

export const ScanOutcomeSchema = z.union([
  z.object({ outcome: z.literal('open'), target: Target }),
  z.object({ outcome: z.literal('claim'), locationId: z.uuid() }),
  z.object({ outcome: z.literal('not_in_your_kept') }),
  z.object({
    outcome: z.literal('legacy_ambiguous'),
    candidates: z.array(
      z.object({
        locationName: z.string(),
        locationId: z.uuid(),
        name: z.string(),
        kind: z.enum(['thing', 'place']),
        id: z.uuid(),
      }),
    ),
  }),
  z.object({
    outcome: z.literal('barcode'),
    barcode: z.object({ code: z.string(), lookupEnabled: z.boolean() }),
  }),
  z.object({ outcome: z.literal('not_kept'), text: z.string() }),
]);
export type ScanOutcome = z.infer<typeof ScanOutcomeSchema>;

const MISS: ScanOutcome = Object.freeze({ outcome: 'not_in_your_kept' });

export type ResolveDeps = {
  /** Whether barcode lookup is on (barcode.ts readBarcodeSettings). */
  lookupEnabled: () => Promise<boolean>;
};

/** A short ID: a live thing or place, or a blank the caller may claim. Null when it's none. */
async function byShortCode(client: pg.ClientBase, code: string): Promise<ScanOutcome | null> {
  const { rows } = await client.query<{
    state: string;
    location_id: string;
    thing_id: string | null;
    place_id: string | null;
  }>(
    `SELECT s.state, s.location_id,
            (SELECT t.id FROM public.things t
              WHERE t.id = s.thing_id AND t.deleted_at IS NULL) AS thing_id,
            (SELECT p.id FROM public.places p
              WHERE p.id = s.place_id AND p.deleted_at IS NULL) AS place_id
       FROM public.short_ids s WHERE s.code = $1`,
    [code],
  );
  const s = rows[0];
  if (!s) return null;
  if (s.state === 'assigned' && (s.thing_id || s.place_id)) {
    return {
      outcome: 'open',
      target: s.thing_id
        ? { kind: 'thing', id: s.thing_id, locationId: s.location_id }
        : { kind: 'place', id: s.place_id as string, locationId: s.location_id },
    };
  }
  if (s.state === 'blank') {
    const member = await callerMembership(client, s.location_id);
    if (member && can(member.role, 'labels.use')) {
      return { outcome: 'claim', locationId: s.location_id };
    }
  }
  return null;
}

type LegacyHit = {
  location_id: string;
  location_name: string | null;
  thing_id: string | null;
  place_id: string | null;
  name: string | null;
};

/** Legacy codes equal to `code` (as stored: legacyCodeOf) of `sources` (every source when null)
 * with a live target; one target once, whatever codes point at it. */
async function byLegacy(
  client: pg.ClientBase,
  code: string,
  sources: readonly string[] | null,
): Promise<ScanOutcome | null> {
  if (!code || code.length > 100) return null;
  const { rows } = await client.query<LegacyHit>(
    `SELECT DISTINCT c.location_id, l.name AS location_name, t.id AS thing_id, p.id AS place_id,
            coalesce(t.name, p.name) AS name
       FROM public.legacy_codes c
       JOIN public.locations l ON l.id = c.location_id
       LEFT JOIN public.things t ON t.id = c.thing_id AND t.deleted_at IS NULL
       LEFT JOIN public.places p ON p.id = c.place_id AND p.deleted_at IS NULL
      WHERE c.code = $1 AND ($2::text[] IS NULL OR c.source = ANY ($2::text[]))
        AND (t.id IS NOT NULL OR p.id IS NOT NULL)
      ORDER BY l.name, name`,
    [code, sources ? [...sources] : null],
  );
  const hits = rows.map((r) => ({
    kind: r.thing_id ? ('thing' as const) : ('place' as const),
    id: (r.thing_id ?? r.place_id) as string,
    locationId: r.location_id,
    locationName: r.location_name ?? '',
    name: r.name ?? '',
  }));
  const [only] = hits;
  if (!only) return null;
  if (hits.length === 1) {
    return {
      outcome: 'open',
      target: { kind: only.kind, id: only.id, locationId: only.locationId },
    };
  }
  return {
    outcome: 'legacy_ambiguous',
    candidates: hits.map((h) => ({
      locationName: h.locationName,
      locationId: h.locationId,
      name: h.name,
      kind: h.kind,
      id: h.id,
    })),
  };
}

/**
 * Things the caller sees that carry the code: as their serial number (any of `serials`) or as
 * their barcode (any of `barcodes`, one product code's spellings). A serial names one unit, so serial matches win over barcode ones; one match
 * opens it, several ask which. The stored text is compared as it is (a thing's barcode and serial
 * are what was scanned or typed for it).
 */
async function byThingCode(
  client: pg.ClientBase,
  barcodes: readonly string[],
  serials: readonly string[],
): Promise<ScanOutcome | null> {
  const codes = barcodes.filter((b) => b && b.length <= CODE_FIELD_MAX.barcode);
  const wanted = serials.filter((s) => s && s.length <= CODE_FIELD_MAX.serial);
  if (codes.length === 0 && wanted.length === 0) return null;
  const { rows } = await client.query<{
    id: string;
    location_id: string;
    location_name: string | null;
    name: string | null;
    by_serial: boolean;
  }>(
    `SELECT t.id, t.location_id, l.name AS location_name, t.name,
            coalesce(t.serial = ANY ($2::text[]), false) AS by_serial
       FROM public.things t
       JOIN public.locations l ON l.id = t.location_id
      WHERE (t.barcode = ANY ($1::text[]) OR t.serial = ANY ($2::text[])) AND t.deleted_at IS NULL
      ORDER BY l.name, t.name, t.id
      LIMIT 50`,
    [codes, wanted],
  );
  const hits = rows.some((r) => r.by_serial) ? rows.filter((r) => r.by_serial) : rows;
  const [only] = hits;
  if (!only) return null;
  if (hits.length === 1) {
    return {
      outcome: 'open',
      target: { kind: 'thing', id: only.id, locationId: only.location_id },
    };
  }
  return {
    outcome: 'legacy_ambiguous',
    candidates: hits.map((r) => ({
      locationName: r.location_name ?? '',
      locationId: r.location_id,
      name: r.name ?? '',
      kind: 'thing' as const,
      id: r.id,
    })),
  };
}

/** The legacy codes a scan's text may be, as typed (every source). */
const anyLegacy = (client: pg.ClientBase, text: string) =>
  byLegacy(client, legacyCodeOf(text), null);

/**
 * One resolver per scan kind; each answers or misses. T17a's own codes need no entry of their
 * own: they are legacy codes, found by `anyLegacy` for every kind.
 */
const RESOLVERS: {
  [K in ScanResult['kind']]: (
    client: pg.ClientBase,
    scan: Extract<ScanResult, { kind: K }>,
    text: string,
    deps: ResolveDeps,
    /** The reader's format, as sent (none when typed). */
    format: string | undefined,
  ) => Promise<ScanOutcome>;
} = {
  // A Kept label whose code was taken on this server when its export was imported here: the old
  // code is a `kept` legacy code on the thing it was moved to.
  kept: async (client, scan, text) =>
    (await byShortCode(client, scan.code)) ??
    (await byLegacy(client, scan.code, ['kept'])) ??
    (await anyLegacy(client, text)) ??
    MISS,
  homebox: async (client, scan) =>
    (await byLegacy(client, legacyCodeOf(scan.assetId ?? scan.uuid ?? ''), ['homebox'])) ?? MISS,
  barcode: async (client, scan, text, deps, format) =>
    (await anyLegacy(client, text)) ??
    (await byThingCode(
      client,
      isProductCode(scan) ? productCodeForms(scan.code, format) : [scan.code],
      serialsOf(scan),
    )) ?? {
      outcome: 'barcode',
      barcode: { code: scan.code, lookupEnabled: await deps.lookupEnabled() },
    },
  other: async (client, scan, text) =>
    (await anyLegacy(client, text)) ??
    (await byThingCode(client, [scan.text], [scan.text])) ?? {
      outcome: 'not_kept',
      text: scan.text,
    },
};

export const ResolveScanBatchBody = z.object({
  items: z.array(ResolveScanBody).min(1).max(SCAN_SESSION_LIMITS.resolveBatch),
});

/** POST /api/v1/scan/resolve-batch, as the caller: each item as `resolveScan`, in order. */
export async function resolveScanBatch(
  client: pg.ClientBase,
  body: z.infer<typeof ResolveScanBatchBody>,
  deps: ResolveDeps,
): Promise<{ results: ScanOutcome[] }> {
  let lookup: Promise<boolean> | null = null;
  const once: ResolveDeps = { lookupEnabled: () => (lookup ??= deps.lookupEnabled()) };
  const results: ScanOutcome[] = [];
  for (const item of body.items) results.push(await resolveScan(client, item, once));
  return { results };
}

/** POST /api/v1/scan/resolve, as the caller. */
export async function resolveScan(
  client: pg.ClientBase,
  body: z.infer<typeof ResolveScanBody>,
  deps: ResolveDeps,
): Promise<ScanOutcome> {
  const scan = parseScan(body.text, body.format);
  const text = body.text.trim();
  const resolve = RESOLVERS[scan.kind] as (
    c: pg.ClientBase,
    s: ScanResult,
    t: string,
    d: ResolveDeps,
    f: string | undefined,
  ) => Promise<ScanOutcome>;
  return resolve(client, scan, text, deps, body.format);
}
