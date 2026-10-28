/**
 * The step-7 half of the mock server's state: archive import runs, exports, stock rules and the
 * values a field conversion previews. Kept beside the MockState (a WeakMap), not in it, so the
 * shared fixtures don't change; `pt(state)` seeds it on first use.
 *
 * Fixtures:
 * - a Homebox run, checked, whose report carries every archive and `hb_*` issue kind;
 * - a Kept run from بيت العائلة's export (Arabic), inspected, with secrets and no target yet;
 * - an export of each state: queued, running, done, expired (purged after its seven days), failed;
 * - "Keep at least 16" on the AA batteries (12 left: low);
 * - values of the AA batteries' Size field (a text field) in Home and Garage, for the conversion
 *   preview: `sizeFieldId(state)`.
 */
import { ARCHIVE_ISSUE_CODES, HB_ISSUE_CODES } from '@kept/shared';
import { INV_IDS } from '../../inventory/mock/fixtures';
import { IDS, type MockState } from '../../mock/fixtures';
import type {
  ArchiveImportRun,
  ArchiveReportRow,
  ExportOptions,
  ExportRun,
  HomeboxDryRunSummary,
  HomeboxMappingHints,
  ImportRepairPlan,
  StockRule,
} from '../types';

export type PortabilityState = {
  archiveRuns: ArchiveImportRun[];
  /** What repairing each Homebox run that ran would change (GET …/repair). */
  repairs: Record<string, ImportRepairPlan>;
  exports: ExportRun[];
  stockRules: StockRule[];
  /** Per field id, per location id: the raw values a conversion would move. */
  fieldValues: Record<string, Record<string, string[]>>;
  /** Wrong passphrase tries per run (10 an hour). */
  passphraseTries: Record<string, number>;
};

/** Stable ids for the fixtures, for tests and the demo. */
export const PORTABILITY_IDS = {
  homeboxRun: '01926f00-0000-7000-8000-0000000d7001',
  /** A Homebox import that ran before 1.13.0: quantity 0 became 1, `global.item` a box type. */
  homeboxDone: '01926f00-0000-7000-8000-0000000d7003',
  keptRun: '01926f00-0000-7000-8000-0000000d7002',
  export: {
    queued: '01926f00-0000-7000-8000-0000000d7101',
    running: '01926f00-0000-7000-8000-0000000d7102',
    done: '01926f00-0000-7000-8000-0000000d7103',
    expired: '01926f00-0000-7000-8000-0000000d7104',
    failed: '01926f00-0000-7000-8000-0000000d7105',
  },
  /** The passphrase the mock's Kept export opens with. */
  passphrase: 'correct horse battery',
} as const;

/** What a Homebox collection's choices step offers (HomeboxMappingHints): four types, three
 * custom fields (one with no value), three insured items, the seeded places and tags left empty
 * and four locations that look like boxes. */
export const HOMEBOX_MAPPING: HomeboxMappingHints = {
  types: [
    { id: '0192a000-0000-7000-8000-00000000c101', name: 'Power Tools', items: 6 },
    { id: '0192a000-0000-7000-8000-00000000c102', name: 'Electronics', items: 4 },
    { id: '0192a000-0000-7000-8000-00000000c103', name: 'Kitchen gear', items: 2 },
    { id: '0192a000-0000-7000-8000-00000000c104', name: 'global.item', items: 9 },
  ],
  fields: [
    { name: 'Voltage', kind: 'text', items: 5, filled: 5 },
    { name: 'Warranty card no.', kind: 'text', items: 1, filled: 1 },
    // Its one value is Homebox's unset date: no item has a value, so it's left out (#320).
    { name: 'Last defrosted', kind: 'time', items: 1, filled: 0 },
  ],
  insuredItems: 3,
  seededUnused: { places: ['Attic', 'Basement', 'Office'], tags: ['IOT', 'Servers'] },
  prices: 4,
  pricedItems: 4,
  warrantyItems: 2,
  maintenance: 1,
  zeroItems: 2,
  // In the backup's order, not A to Z: the choices step sorts them (#320).
  boxes: [
    { id: '0192a000-0000-7000-8000-00000000c204', name: 'Box 10', path: ['Garage'], items: 1 },
    { id: '0192a000-0000-7000-8000-00000000c201', name: 'Box 01', path: ['Garage'], items: 2 },
    {
      id: '0192a000-0000-7000-8000-00000000c203',
      name: 'Bin 1',
      path: ['Basement', 'Shelf C'],
      items: 0,
    },
    { id: '0192a000-0000-7000-8000-00000000c202', name: 'Box 2', path: ['Garage'], items: 1 },
  ],
  catchAll: '0192a000-0000-7000-8000-00000000c104',
};

const DAY = 86_400_000;
const at = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  ended: true,
  trashed: false,
  history: true,
  aiCalls: true,
  readable: true,
  pdf: true,
  locale: 'en',
  digits: 'western',
};

/** One report row per archive and Homebox issue code, each on a named entity or file. */
function everyIssueRow(): ArchiveReportRow[] {
  const codes = [...ARCHIVE_ISSUE_CODES, ...HB_ISSUE_CODES];
  return codes.map((code, i) => {
    const isFile = (ARCHIVE_ISSUE_CODES as readonly string[]).includes(code);
    const skipped = code === 'hb_archived_skipped' || code === 'hb_seeded_skipped';
    return {
      status: skipped || code === 'file_type_refused' ? 'skipped' : 'text',
      ref: isFile
        ? {
            kind: 'attachment',
            id: `01926f00-0000-7000-8000-0000000e${String(i).padStart(4, '0')}`,
            name: code === 'file_type_refused' ? 'drill-manual.docx' : `attachment-${i + 1}.jpg`,
          }
        : {
            kind: 'entity',
            id: `01926f00-0000-7000-8000-0000000e${String(i).padStart(4, '0')}`,
            name: code === 'hb_location_in_item' ? 'Toolbox drawer' : `Homebox item ${i + 1}`,
          },
      issues: [{ column: '', code, message: code }],
    };
  });
}

const HOMEBOX_SUMMARY: HomeboxDryRunSummary = {
  places: 9,
  things: 12,
  containers: 2,
  purchases: 5,
  warranties: 2,
  services: 1,
  schedules: 1,
  attachments: 8,
  links: 1,
  tags: 6,
  types: 3,
  fieldsAdded: 2,
  legacyCodes: 14,
  skipped: 3,
  asText: 4,
  refusedFiles: 1,
};

function seed(state: MockState): PortabilityState {
  const run = (
    over: Partial<ArchiveImportRun> & Pick<ArchiveImportRun, 'id' | 'source'>,
  ): ArchiveImportRun => ({
    locationId: null,
    sourceVersion: null,
    status: 'draft',
    bytes: 138_595,
    sha256: 'a'.repeat(64),
    archiveReadyAt: at(-1),
    inspect: null,
    choices: null,
    secrets: null,
    progress: 0,
    total: null,
    createdAt: at(-1),
    startedAt: null,
    finishedAt: null,
    error: null,
    updatedAt: at(-1),
    rowVersion: 1,
    ...over,
  });
  const exportRun = (over: Partial<ExportRun> & Pick<ExportRun, 'id' | 'status'>): ExportRun => ({
    scope: 'location',
    locationId: IDS.home,
    progress: { done: 0, total: 0 },
    includesSecrets: false,
    options: DEFAULT_EXPORT_OPTIONS,
    createdAt: at(-1),
    ...over,
  });
  const E = PORTABILITY_IDS.export;
  return {
    archiveRuns: [
      run({
        id: PORTABILITY_IDS.homeboxRun,
        source: 'homebox_zip',
        sourceVersion: 'v0.26.2',
        locationId: IDS.home,
        status: 'checked',
        inspect: {
          source: 'homebox_zip',
          sourceVersion: 'v0.26.2',
          collections: [
            {
              id: '0192a000-0000-7000-8000-00000000c001',
              name: 'Home',
              counts: {
                entities: 21,
                locations: 9,
                attachments: 13,
                maintenance: 2,
                tags: 10,
                types: 7,
              },
              mapping: HOMEBOX_MAPPING,
            },
          ],
        },
        choices: {
          archived: 'skip',
          currency: 'EGP',
          quantityRounding: 'keep_note',
          fields: { Voltage: 'add_to_type' },
          types: {},
          insured: 'field',
          seeded: 'skip_unused',
        },
        total: 21,
        report: { source: 'homebox_zip', summary: HOMEBOX_SUMMARY, rows: everyIssueRow() },
        rowVersion: 3,
      }),
      run({
        id: PORTABILITY_IDS.keptRun,
        source: 'kept_zip',
        sourceVersion: '0.1.0',
        bytes: 2_412_880,
        inspect: {
          source: 'kept_zip',
          sourceVersion: '0.1.0',
          kept: {
            locationName: 'بيت العائلة',
            kind: 'home',
            exportedAt: at(-2),
            keptVersion: '0.1.0',
            counts: { places: 4, things: 5, files: 3, history: 42 },
            includesSecrets: true,
            members: [
              { name: 'بروس', role: 'owner' },
              { name: 'ألفريد', role: 'member' },
              { name: 'بيتر', role: 'viewer' },
            ],
          },
        },
        secrets: { present: true, unlocked: false },
      }),
      run({
        id: PORTABILITY_IDS.homeboxDone,
        source: 'homebox_zip',
        sourceVersion: 'v0.27.0',
        locationId: IDS.garage,
        status: 'done',
        archiveReadyAt: null,
        bytes: 0,
        sha256: '',
        inspect: {
          source: 'homebox_zip',
          sourceVersion: 'v0.27.0',
          collections: [
            {
              id: '0192a000-0000-7000-8000-00000000c002',
              counts: {
                entities: 79,
                locations: 36,
                attachments: 3,
                maintenance: 2,
                tags: 10,
                types: 2,
              },
              mapping: HOMEBOX_MAPPING,
            },
          ],
        },
        progress: 91,
        total: 91,
        startedAt: at(-3),
        finishedAt: at(-3),
        report: {
          source: 'homebox_zip',
          summary: { ...HOMEBOX_SUMMARY, things: 44, places: 31 },
          rows: [
            {
              status: 'ok',
              ref: {
                kind: 'entity',
                id: '0192a000-0000-7000-8000-00000000c301',
                name: 'AA batteries',
              },
              issues: [{ column: '', code: 'hb_quantity_zero', message: 'hb_quantity_zero' }],
            },
            {
              status: 'ok',
              ref: { kind: 'entity', id: '0192a000-0000-7000-8000-00000000c302', name: 'Candles' },
              issues: [{ column: '', code: 'hb_quantity_zero', message: 'hb_quantity_zero' }],
            },
          ],
        },
      }),
    ],
    repairs: {
      [PORTABILITY_IDS.homeboxDone]: {
        zero: [
          { thingId: INV_IDS.thing.batteries, name: 'AA batteries' },
          { thingId: '0192a000-0000-7000-8000-00000000c401', name: 'Candles' },
        ],
        containerTypes: [{ typeId: '0192a000-0000-7000-8000-00000000c501', name: 'Item' }],
        renames: [
          { typeId: '0192a000-0000-7000-8000-00000000c501', name: 'global.item', to: 'item' },
        ],
        sold: [{ thingId: '0192a000-0000-7000-8000-00000000c402', name: 'Desk lamp' }],
      },
    },
    exports: [
      exportRun({ id: E.queued, status: 'queued', createdAt: at(0) }),
      exportRun({
        id: E.running,
        status: 'running',
        locationId: IDS.garage,
        progress: { done: 7, total: 23 },
        createdAt: at(0),
      }),
      exportRun({
        id: E.done,
        status: 'done',
        includesSecrets: true,
        progress: { done: 23, total: 23 },
        bytes: 48_203_114,
        sha256: 'b'.repeat(64),
        createdAt: at(-2),
        finishedAt: at(-2),
        expiresAt: at(5),
      }),
      exportRun({
        id: E.expired,
        status: 'expired',
        scope: 'me',
        locationId: state.me.personalLocationId ?? IDS.personal,
        progress: { done: 23, total: 23 },
        bytes: 1_204_551,
        sha256: 'c'.repeat(64),
        createdAt: at(-9),
        finishedAt: at(-9),
        expiresAt: at(-2),
      }),
      exportRun({
        id: E.failed,
        status: 'failed',
        locationId: IDS.garage,
        error: 'no_space',
        createdAt: at(-3),
        finishedAt: at(-3),
      }),
    ],
    stockRules: [
      {
        thingId: INV_IDS.thing.batteries,
        locationId: IDS.home,
        minQuantity: 16,
        updatedAt: at(-4),
        rowVersion: 1,
      },
    ],
    fieldValues: {
      [sizeFieldId(state)]: {
        [IDS.home]: ['12', '4', 'about 6', '1.5'],
        [IDS.garage]: ['9', 'two'],
      },
    },
    passphraseTries: {},
  };
}

/** The AA batteries' Size field (a text field of the Batteries type), whose values the
 * conversion preview counts in Home and Garage. */
export function sizeFieldId(state: MockState): string {
  const type = state.inventory.types.find((y) => y.id === INV_IDS.type.batteries);
  const field = type?.fields.find((f) => f.key === 'size');
  if (!field) throw new Error('portability mock: the Batteries type has no Size field');
  return field.id;
}

const STATES = new WeakMap<MockState, PortabilityState>();

/** The step-7 state of this mock server, seeded on first use. */
export function pt(state: MockState): PortabilityState {
  let s = STATES.get(state);
  if (!s) {
    s = seed(state);
    STATES.set(state, s);
  }
  return s;
}
