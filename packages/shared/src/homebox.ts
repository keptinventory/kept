/**
 * The Homebox importer's contract (D146): the dry-run choices,
 * how Homebox's custom-field kinds
 * become Kept's, the canonical form of an asset ID, and the `hb_*` issue codes the dry run and the
 * summary report.
 */
import { z } from 'zod';
import { homeboxAssetId } from './scan.js';

/**
 * What the person decides before a Homebox dry run can run (D146).
 * - `archived`: an archived item comes in archived (Kept's own `archived` lifecycle; a sold one
 *   ends sold), in use, or is left out. A run saved with the older `tag` choice is asked its
 *   choices again;
 * - `currency`: the collection's currency (the ZIP has none; prefilled from the connection, else
 *   the target location's);
 * - `quantityRounding`: one value today: where D10 forces 1, the original stays in the notes;
 * - `fields`: per Homebox field name, add it to the mapped type or keep it in the notes;
 * - `types`: per Homebox entity type id, an existing Kept type, a new one by name, or no type
 *   (`{none: true}`: its things come in without one);
 * - `insured`: an "Insured" yes/no field on the mapped type, or nothing;
 * - `seeded` *(H1)*: Homebox's eight seeded places and six seeded tags, skipped when empty
 *   and unused (the default), or imported like the rest;
 * - `zeroQuantity` (from 1.13.0): an item with quantity 0 keeps 0 where its type is consumable and
 *   comes in archived otherwise (`keep_or_archive`), comes in as 1 (`one`), or is left out (`skip`).
 *   A run saved before has none, and keeps what it was checked with: 1;
 * - `boxes` (from 1.13.0): the Homebox locations to bring in as boxes (things that hold things)
 *   rather than places; only a location that holds no other location can be one.
 * Both are optional, so the choices runs saved before 1.13.0 still read.
 */
export const HomeboxChoices = z.strictObject({
  archived: z.enum(['archived', 'in_use', 'skip']),
  currency: z.string().regex(/^[A-Z]{3}$/),
  quantityRounding: z.enum(['keep_note']),
  fields: z.record(z.string().min(1).max(255), z.enum(['add_to_type', 'notes'])),
  types: z.record(
    z.uuid(),
    z.union([
      z.strictObject({ typeId: z.uuid() }),
      z.strictObject({ create: z.string().trim().min(1).max(80) }),
      z.strictObject({ none: z.literal(true) }),
    ]),
  ),
  insured: z.enum(['field', 'skip']),
  seeded: z.enum(['skip_unused', 'all']),
  zeroQuantity: z.enum(['keep_or_archive', 'one', 'skip']).optional(),
  boxes: z.array(z.uuid()).max(5000).optional(),
});
export type HomeboxChoices = z.infer<typeof HomeboxChoices>;

/**
 * The names Homebox v0.27's upgrade gives its two entity types: translation keys, stored as names,
 * that Homebox's own screens show as "Item" and "Location". Kept shows and creates them the same
 * way, never as the key.
 */
export const HB_GLOBAL_TYPE_NAMES: Readonly<Record<string, string>> = Object.freeze({
  'global.item': 'Item',
  'global.location': 'Location',
});

/** A Homebox type's name as a person reads it: `global.item` is "Item". */
export function homeboxTypeName(name: string): string {
  const trimmed = name.trim();
  return HB_GLOBAL_TYPE_NAMES[trimmed] ?? trimmed;
}

/**
 * The words that make a location's name read as a box, in Kept's five languages (en, de, fr, it,
 * ar), lower case. A name reads as a box when one of its words is one of these.
 */
export const BOX_WORDS: readonly string[] = Object.freeze([
  // English
  'box',
  'boxes',
  'bin',
  'crate',
  'tote',
  'carton',
  'container',
  'tub',
  'basket',
  // German
  'kiste',
  'karton',
  'schachtel',
  'behälter',
  'korb',
  // French
  'boîte',
  'boite',
  'caisse',
  'bac',
  'panier',
  'conteneur',
  // Italian
  'scatola',
  'scatolone',
  'cassa',
  'contenitore',
  'cesta',
  // Arabic
  'صندوق',
  'علبة',
  'كرتونة',
  'كرتون',
  'سلة',
  'حاوية',
]);
const BOX_WORD_SET = new Set(BOX_WORDS);

/** Whether a location's name reads as a box ("Box 01", "Kiste 3", "صندوق ٢"), by its words. */
export function looksLikeBox(name: string): boolean {
  for (const raw of name
    .normalize('NFC')
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{M}]+/u)) {
    if (!raw) continue;
    if (BOX_WORD_SET.has(raw)) return true;
    // Arabic's article: "الصندوق" is "صندوق".
    if (raw.startsWith('ال') && BOX_WORD_SET.has(raw.slice(2))) return true;
  }
  return false;
}

/** What a Homebox backup holds that needs a module beyond Essentials: items with a price (or a
 * sale price), items with a warranty, and maintenance entries. */
export type HomeboxUse = { pricedItems: number; warrantyItems: number; maintenance: number };

/** The modules a Homebox backup has data for, each with how many entries need it: Money for
 * prices, Warranties for warranties, Schedules for maintenance (done → service records, planned
 * → schedules). What to track ticks these on top of Essentials; one left off keeps its data in the
 * things' notes. */
export function homeboxModules(
  use: Partial<HomeboxUse>,
): { module: 'money' | 'warranties' | 'schedules'; count: number }[] {
  const out: { module: 'money' | 'warranties' | 'schedules'; count: number }[] = [];
  if ((use.pricedItems ?? 0) > 0) out.push({ module: 'money', count: use.pricedItems ?? 0 });
  if ((use.warrantyItems ?? 0) > 0)
    out.push({ module: 'warranties', count: use.warrantyItems ?? 0 });
  if ((use.maintenance ?? 0) > 0) out.push({ module: 'schedules', count: use.maintenance ?? 0 });
  return out;
}

/** Homebox's custom-field kinds and the Kept field kind each becomes (a `time` is a date). */
export const HB_FIELD_KIND = Object.freeze({
  text: 'text',
  number: 'number',
  boolean: 'boolean',
  time: 'date',
} as const);
export type HomeboxFieldKind = keyof typeof HB_FIELD_KIND;

/** An asset ID (`entities.asset_id`, an integer; 0 is none) as its label prints it: `000-001`.
 * The same function the scanner reads `/a/<assetId>` with, so they can't drift. */
export function homeboxAssetCode(n: number): string | null {
  if (!Number.isInteger(n) || n < 1) return null;
  return homeboxAssetId(String(n));
}

/** Seeded in every new Homebox collection (v0.26.2), usually left empty. */
export const HB_SEEDED_PLACES = [
  'Living Room',
  'Garage',
  'Kitchen',
  'Bedroom',
  'Bathroom',
  'Office',
  'Attic',
  'Basement',
] as const;
export const HB_SEEDED_TAGS = [
  'Appliances',
  'IOT',
  'Electronics',
  'Servers',
  'General',
  'Important',
] as const;

/**
 * Why a Homebox row maps with a loss, or doesn't map (D146). Each is translated by the
 * web from its code:
 * - `hb_archived_skipped`: archived, and the choice was to skip it;
 * - `hb_quantity_rounded`: a fractional quantity where Kept counts one (D10); the original is in
 *   the notes;
 * - `hb_quantity_zero`: quantity 0 in Homebox, which came in as 1 (the `one` choice, and every
 *   run before 1.13.0);
 * - `hb_quantity_zero_kept`: quantity 0 kept, its type being consumable;
 * - `hb_quantity_zero_archived`: quantity 0, which a non-consumable can't hold: archived, as 1;
 * - `hb_quantity_zero_skipped`: quantity 0, and the choice was to leave it out;
 * - `hb_item_holds_things`: an item holding other items, which came in as a box (its type alone
 *   doesn't become a container type);
 * - `hb_box_from_location`: a location chosen to come in as a box;
 * - `hb_place_notes_dropped`: a location's description or notes, not kept: places have none;
 * - `hb_number_integer`: Homebox stores numbers as integers, so decimals were already lost there;
 * - `hb_icon_dropped`: a type icon Homebox doesn't define; the Kept type's own icon is used;
 * - `hb_template_partial`: part of a template that a Kept template can't hold (money, secrets);
 * - `hb_currency_unsupported`: the collection's currency isn't enabled on this server;
 * - `hb_needs_module`: a warranty, service or schedule whose Kept records don't exist yet; its
 *   text is kept in the thing's notes;
 * - `hb_location_in_item`: a location inside an item, which became a box;
 * - `hb_notifier_skipped`: notifiers are never imported (their URLs are credentials);
 * - `hb_seeded_skipped`: Homebox's seeded places and tags, empty and unused, left out;
 * - `hb_time_default`: a `time` field whose value is only its row's creation time, read as empty;
 * - `hb_location_row`: a spreadsheet row that is a Homebox location (v0.26 on lists them), left
 *   out: places come from the items' location column;
 * - `hb_place_tags_dropped`: a location's tags, not kept: in Kept only things have tags (#209);
 * - `hb_sold_date_only`: a sold date with no buyer and no price, which isn't a sale (Homebox
 *   fills empty dates on some upgrades, #346): the thing stays in use, the date is in its notes.
 */
export const HB_ISSUE_CODES = [
  'hb_archived_skipped',
  'hb_quantity_rounded',
  'hb_quantity_zero',
  'hb_number_integer',
  'hb_icon_dropped',
  'hb_template_partial',
  'hb_currency_unsupported',
  'hb_needs_module',
  'hb_location_in_item',
  'hb_notifier_skipped',
  'hb_seeded_skipped',
  'hb_time_default',
  'hb_location_row',
  'hb_place_tags_dropped',
  // 1.13.0: appended, never renamed, so the reports runs stored before still read.
  'hb_quantity_zero_kept',
  'hb_quantity_zero_archived',
  'hb_quantity_zero_skipped',
  'hb_item_holds_things',
  'hb_box_from_location',
  'hb_place_notes_dropped',
  // 1.14.1
  'hb_sold_date_only',
] as const;
export type HomeboxIssueCode = (typeof HB_ISSUE_CODES)[number];

// ---------------------------------------------------------------------------------------------
// Homebox's spreadsheet export, read by the CSV import
// ---------------------------------------------------------------------------------------------

/**
 * What a Homebox spreadsheet's preset decides on the CSV import, as the ZIP import does: an
 * archived item comes in archived (`archived`; a sold one ends sold), in use (`in_use`), or is
 * left out (`skip`).
 */
export const HomeboxCsvChoices = z.strictObject({
  archived: z.enum(['archived', 'in_use', 'skip']),
});
export type HomeboxCsvChoices = z.infer<typeof HomeboxCsvChoices>;

/**
 * The columns the preset reads itself, so they're never mapped: the asset ID and the item's
 * link (old labels), archived, insured, the warranty and the sale. Homebox v0.26 renamed
 * `HB.sold_time` to `HB.sold_date`; both are read.
 */
export const HB_CSV_PRESET_COLUMNS = [
  'HB.asset_id',
  'HB.url',
  'HB.archived',
  'HB.insured',
  'HB.lifetime_warranty',
  'HB.warranty_expires',
  'HB.warranty_details',
  'HB.sold_to',
  'HB.sold_price',
  'HB.sold_time',
  'HB.sold_date',
  'HB.sold_notes',
] as const;

/**
 * Whether these headers are a Homebox spreadsheet export: "Export Inventory" up to v0.25 (a TSV
 * in v0.10.3 and v0.11.0), `GET /entities/export` from v0.26. Every version writes `HB.name`
 * and `HB.location`.
 */
export function isHomeboxCsv(columns: readonly string[]): boolean {
  return columns.includes('HB.name') && columns.includes('HB.location');
}

const HB_LINK =
  /\/(item|location)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;

/** The item or location an `HB.url` cell names: `<base>/item/<uuid>` (v0.13 to v0.25), or
 * `/item/<uuid>` and `/location/<uuid>` (v0.26 on). Null when it names neither. */
export function hbCsvLink(url: string): { kind: 'item' | 'location'; uuid: string } | null {
  const m = HB_LINK.exec(url.trim());
  if (!m) return null;
  return { kind: m[1]?.toLowerCase() as 'item' | 'location', uuid: (m[2] as string).toLowerCase() };
}
