import {
  effectiveModules,
  type HomeboxChoices,
  homeboxAssetCode,
  homeboxTypeName,
  normalize,
  type Preset,
  presetModules,
} from '@kept/shared';
import type pg from 'pg';
import type { Scope, Tx } from '../../db/scope.js';
import { invalid } from '../../http/errors.js';
import { unplacedOf } from '../../places/view.js';
import { gateFor } from '../../serialize/gates.js';
import { resolvedFields, typeCapabilities } from '../../things/fields.js';
import { legacyCodeOf } from '../csv.js';
import { loadTypes } from '../dry-run.js';
import type { HomeboxData } from './read.js';

// What the Homebox planner (plan.ts) checks the archive against, read once under the importer's
// own row-level security (as imports/dry-run.ts's Lookups): the target location, its
// money gate and modules, the enabled currencies, the account's types (with their capabilities
// and fields), tags, brands and vendors by normalised name, the location's places, the Homebox
// source ids it already holds and the legacy codes the archive would add that are already taken.
// Plain data, so the planner stays a pure function the tests run on the fixtures alone.
//
// For a new location that Import will make (loadPendingLookups), the location's part is what it
// will be: its preset's modules, the caller's own account (which will own it), no places, codes or
// earlier runs. That plan only answers the check's report: the job plans again against the
// location once it exists.

export type HbTypeInfo = {
  /** A built-in (owned by no account): adding a field first copies it into the account. */
  builtin: boolean;
  caps: string[];
  fields: { key: string; label: string; kind: string; secret: boolean; archived: boolean }[];
};

export type HbLookups = {
  locationId: string;
  accountId: string;
  today: string;
  showMoney: boolean;
  modules: ReadonlySet<string>;
  currencies: ReadonlySet<string>;
  /** Type ids by normalised name: the account's own first, then the built-ins in five
   * languages (imports/dry-run.ts loadTypes). */
  types: Map<string, string>;
  typeInfo: Map<string, HbTypeInfo>;
  /** The built-in "Box / bin", for a container whose mapped type can't hold things. */
  boxBinTypeId: string | null;
  tags: Map<string, string>;
  brands: Map<string, string>;
  vendors: Map<string, string>;
  /** Live places by parent ('' for the top) and normalised name. */
  places: Map<string, Map<string, string>>;
  unplacedId: string;
  /** The location's Paperless-ngx connection (its root, as saved), or null (#347). */
  paperless?: { baseUrl: string } | null;
  /** `import_source_ids` (source `homebox`) already in the location: source id → entity id. */
  sourceIds: Map<string, string>;
  /** Legacy codes the archive would add that the location already has, under any source. */
  takenCodes: Set<string>;
  maxFileBytes: number;
};

/** Every legacy code an export could add: asset ids and entity UUIDs (legacyCodeOf). */
export function candidateCodes(data: HomeboxData): string[] {
  const out: string[] = [];
  for (const e of data.entities.values()) {
    const asset = homeboxAssetCode(e.asset_id);
    if (asset) out.push(legacyCodeOf(asset));
    out.push(legacyCodeOf(e.id));
  }
  return out;
}

export async function loadHomeboxLookups(
  tx: Tx,
  client: pg.ClientBase,
  scope: Scope,
  locationId: string,
  data: HomeboxData,
  choices: HomeboxChoices,
  maxFileBytes: number,
): Promise<HbLookups> {
  const gate = await gateFor(tx, locationId, scope);
  const { rows: locRows } = await client.query<{ owner_account_id: string; today: string }>(
    `SELECT owner_account_id, (now() AT TIME ZONE timezone)::date::text AS today
       FROM public.locations WHERE id = $1`,
    [locationId],
  );
  const loc = locRows[0];
  if (!loc) throw invalid('The location is gone.');

  const sourceIds = new Map<string, string>();
  const { rows: sourceRows } = await client.query<{ source_id: string; entity_id: string }>(
    `SELECT source_id, entity_id FROM public.import_source_ids
      WHERE location_id = $1 AND source = 'homebox'`,
    [locationId],
  );
  for (const r of sourceRows) sourceIds.set(r.source_id, r.entity_id);
  const account = await accountLookups(client, loc.owner_account_id, data, choices, sourceIds);

  const places = new Map<string, Map<string, string>>();
  const { rows: placeRows } = await client.query<{
    id: string;
    parent_id: string | null;
    name: string;
  }>(
    `SELECT id, parent_id, name FROM public.places
      WHERE location_id = $1 AND deleted_at IS NULL AND NOT is_unplaced
      ORDER BY sort, id`,
    [locationId],
  );
  for (const p of placeRows) {
    const key = p.parent_id ?? '';
    const children = places.get(key) ?? new Map<string, string>();
    if (!children.has(normalize(p.name))) children.set(normalize(p.name), p.id);
    places.set(key, children);
  }

  const takenCodes = new Set<string>();
  const codes = candidateCodes(data);
  if (codes.length > 0) {
    const { rows } = await client.query<{ code: string }>(
      `SELECT code FROM public.legacy_codes WHERE location_id = $1 AND code = ANY ($2::text[])`,
      [locationId, codes],
    );
    for (const r of rows) takenCodes.add(r.code);
  }

  // A link to one of its documents comes in as a Paperless link (#347).
  const { rows: paperless } = await client.query<{ base_url: string }>(
    'SELECT base_url FROM public.paperless_connections WHERE location_id = $1',
    [locationId],
  );

  return {
    ...account,
    locationId,
    accountId: loc.owner_account_id,
    today: loc.today,
    paperless: paperless[0] ? { baseUrl: paperless[0].base_url } : null,
    showMoney: gate.showMoney,
    modules: gate.modules,
    places,
    unplacedId: await unplacedOf(client, locationId),
    sourceIds,
    takenCodes,
    maxFileBytes,
  };
}

type AccountLookups = Pick<
  HbLookups,
  'currencies' | 'types' | 'typeInfo' | 'boxBinTypeId' | 'tags' | 'brands' | 'vendors'
>;

/** What the plan reads from the account that owns (or will own) the location: the enabled
 * currencies, its types with their capabilities and fields, its tags, brands and vendors. */
async function accountLookups(
  client: pg.ClientBase,
  accountId: string,
  data: HomeboxData,
  choices: HomeboxChoices,
  sourceIds: ReadonlyMap<string, string>,
): Promise<AccountLookups> {
  const { rows: currencyRows } = await client.query<{ code: string }>(
    'SELECT code FROM public.currencies WHERE enabled',
  );

  const types = new Map<string, string>();
  await loadTypes(client, accountId, types);

  const brands = new Map<string, string>();
  const vendors = new Map<string, string>();
  const tags = new Map<string, string>();
  for (const [table, into] of [
    ['brands', brands],
    ['vendors', vendors],
    ['tags', tags],
  ] as const) {
    const { rows } = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM public.${table} WHERE owner_account_id = $1 ORDER BY created_at, id`,
      [accountId],
    );
    for (const r of rows) if (!into.has(normalize(r.name))) into.set(normalize(r.name), r.id);
  }

  const { rows: boxRows } = await client.query<{ id: string }>(
    `SELECT id FROM public.types WHERE owner_account_id IS NULL AND builtin_key = 'box_bin'`,
  );
  const boxBinTypeId = boxRows[0]?.id ?? null;

  // The capabilities and fields of every type the plan could use: chosen, matched by name,
  // mapped by an earlier run, and the box.
  const candidates = new Set<string>();
  if (boxBinTypeId) candidates.add(boxBinTypeId);
  for (const t of data.types.values()) {
    const choice = choices.types[t.id];
    if (choice && 'typeId' in choice) candidates.add(choice.typeId.toLowerCase());
    const byName = types.get(
      normalize(homeboxTypeName(choice && 'create' in choice ? choice.create : t.name)),
    );
    if (byName) candidates.add(byName);
    const earlier = sourceIds.get(`type:${t.id}`);
    if (earlier) candidates.add(earlier);
  }
  const typeInfo = new Map<string, HbTypeInfo>();
  if (candidates.size > 0) {
    const { rows } = await client.query<{ id: string; builtin: boolean }>(
      `SELECT id, owner_account_id IS NULL AS builtin FROM public.types
        WHERE id = ANY ($1::uuid[]) AND NOT is_field_group AND archived_at IS NULL
          AND (owner_account_id IS NULL OR owner_account_id = $2)`,
      [[...candidates], accountId],
    );
    for (const r of rows) {
      const fields = await resolvedFields(client, r.id);
      typeInfo.set(r.id, {
        builtin: r.builtin,
        caps: await typeCapabilities(client, r.id),
        fields: fields.map((f) => ({
          key: f.key,
          label: f.label ?? f.labelKey ?? f.key,
          kind: f.kind,
          secret: f.secret,
          archived: f.archivedAt !== null,
        })),
      });
    }
  }

  return {
    currencies: new Set(currencyRows.map((r) => r.code.trim())),
    types,
    typeInfo,
    boxBinTypeId,
    tags,
    brands,
    vendors,
  };
}

/** Never a row: a pending location has no Unplaced area yet, and its plan is never applied. */
const NOT_YET = '00000000-0000-0000-0000-000000000000';

/** The lookups for a new location Import will make: `preset` its modules, the caller's account,
 * nothing in it yet. Money shows: its creator will own it. */
export async function loadPendingLookups(
  client: pg.ClientBase,
  pending: { timezone: string; preset: Preset; modules?: readonly string[] },
  data: HomeboxData,
  choices: HomeboxChoices,
  maxFileBytes: number,
): Promise<HbLookups> {
  const { rows } = await client.query<{ account: string | null; today: string }>(
    `SELECT kept.current_owner_account_id() AS account,
            (now() AT TIME ZONE $1)::date::text AS today`,
    [pending.timezone],
  );
  const accountId = rows[0]?.account;
  if (!accountId) throw invalid('This account has no locations yet.');
  const modules = effectiveModules([...presetModules(pending.preset), ...(pending.modules ?? [])], {
    providerResolved: false,
  });
  const account = await accountLookups(client, accountId, data, choices, new Map());
  return {
    ...account,
    locationId: NOT_YET,
    accountId,
    today: rows[0]?.today as string,
    showMoney: modules.has('money'),
    modules,
    places: new Map(),
    unplacedId: NOT_YET,
    sourceIds: new Map(),
    takenCodes: new Set(),
    maxFileBytes,
  };
}
