import type {
  BoxState,
  Condition,
  ConditionReportKind,
  IncidentKind,
  Lifecycle,
  RoomCondition,
} from '@kept/shared';

// The shape of every PDF's words (#465), one table per language in words/<locale>.ts, gathered
// in words/index.ts as a Record over every report language: a language missing a key, or a key
// missing from a language, fails the build. The PDFs are rendered by the server, so these live
// here rather than in Lingui; each language follows the web catalogue
// (apps/web/src/locales/<locale>/messages.po) and the mail tables for the terms the app already
// uses. A count arrives twice, as a number for the plural form and formatted for the page.

/** The inventory report's template labels (`d.labels` in template/report.typ). */
export type ReportLabels = {
  title: string;
  things: string;
  places: string;
  photos: string;
  totals: string;
  contents: string;
  page: string;
  of: string;
  serial: string;
  subtotal: string;
  bought: string;
  confidential: string;
  empty: string;
};

/** The inventory report (reports/view.ts); its lifecycle, condition and place words serve the
 * other PDFs too. */
export type InventoryWords = ReportLabels & {
  unplaced: string;
  trashed: string;
  allLocations: string;
  /** "{location}" for an account report's cover: which locations it covers. */
  locationsList: (names: string) => string;
  generated: (who: string, when: string) => string;
  moneyPartial: string;
  thingCount: (n: number, formatted: string) => string;
  filterPlaces: string;
  filterTypes: string;
  filterTags: string;
  withEnded: string;
  withTrashed: string;
  condition: Record<Condition, string>;
  lifecycle: Record<Exclude<Lifecycle, 'in_use'>, string>;
};

/** The readable copy (exports/readable/), besides what it shares with the inventory report. */
export type ReadableOwnWords = {
  title: string;
  intro: string;
  exported: (when: string) => string;
  places: string;
  things: string;
  photo: string;
  name: string;
  shortId: string;
  type: string;
  brandModel: string;
  quantity: string;
  condition: string;
  tags: string;
  lastSeen: string;
  files: string;
  inside: string;
  ownPage: string;
  spreadsheets: string;
  pdf: string;
  /** The inventory report was left out: it holds at most `max` things. */
  pdfLeftOut: (n: number, max: string) => string;
  pdfFailed: string;
  moneyHidden: string;
  secretsWithheld: string;
  empty: string;
  fileRole: Record<string, string>;
  conditions: Record<Condition, string>;
  lifecycles: Record<Exclude<Lifecycle, 'in_use'>, string>;
};

/** The insurance report (incidents/report.ts), which a claim pack carries. */
export type InsuranceWords = {
  title: string;
  totals: string;
  converted: (ccy: string) => string;
  subtotal: string;
  thing: string;
  purchase: string;
  value: string;
  receipts: string;
  serial: string;
  page: string;
  of: string;
  empty: string;
  asOf: (day: string) => string;
  owner: (name: string) => string;
  generated: (who: string, when: string) => string;
  ratesOf: (days: string) => string;
  purchaseFallback: string;
  noMoney: string;
  incident: Record<IncidentKind, string>;
  police: (ref: string) => string;
  insurer: (ref: string) => string;
  occurred: (day: string) => string;
};

/** The condition report (reports/condition/view.ts). */
export type ConditionWords = {
  title: string;
  kinds: Record<ConditionReportKind, string>;
  conditions: Record<RoomCondition, string>;
  notRecorded: string;
  rooms: string;
  photos: string;
  notes: string;
  page: string;
  of: string;
  contents: string;
  confidential: string;
  empty: string;
  notInReport: string;
  photoNote: string;
  draft: string;
  started: (who: string) => string;
  finished: (who: string, when: string) => string;
  generated: (who: string, when: string) => string;
  more: (n: string) => string;
};

/** A move's contents sheets (reports/move/view.ts). */
export type MoveWords = {
  title: string;
  box: (n: string) => string;
  goesTo: string;
  noRoom: string;
  contents: (n: string) => string;
  empty: string;
  quantity: string;
  id: string;
  holds: (n: string) => string;
  more: (n: string) => string;
  states: Record<BoxState, string>;
  route: (from: string, to: string) => string;
  scan: string;
  generated: (who: string, when: string) => string;
  none: string;
};

/** The vehicle history report (reports/vehicle/view.ts). */
export type VehicleWords = {
  title: string;
  cover: {
    type: string;
    shortId: string;
    vin: string;
    plate: string;
    location: string;
    odometer: string;
  };
  readings: string;
  proofs: string;
  services: string;
  fuel: string;
  documents: string;
  date: string;
  reading: string;
  source: string;
  by: string;
  proof: string;
  item: string;
  qty: string;
  amount: string;
  total: string;
  year: string;
  fills: string;
  fuelAmount: string;
  name: string;
  issued: string;
  expires: string;
  state: string;
  cost: string;
  page: string;
  of: string;
  contents: string;
  confidential: string;
  none: string;
  readingsCount: string;
  servicesCount: string;
  proofsCount: string;
  documentsCount: string;
  consumption: string;
  perDistance: (unit: string) => string;
  monthly: string;
  noConsumption: string;
  readingsNote: string;
  sources: Record<string, string>;
  docKinds: Record<string, string>;
  docStates: { current: string; expired: string; renewed: string };
  /** Fuel units in the report's language. */
  units: Record<string, string>;
  /** A meter's unit in the report's language (the stored unit is never converted, D76); a unit
   * not listed prints as stored. */
  distance: Record<string, string>;
  generated: (who: string, when: string) => string;
  asOf: (day: string) => string;
  range: (from: string, to: string) => string;
  more: (n: string) => string;
  moreInvoices: (n: string) => string;
  moneyHidden: string;
  per100: (fuel: string, distance: string) => string;
};

/** Every PDF's words in one language. */
export type PdfWords = {
  inventory: InventoryWords;
  readable: ReadableOwnWords;
  insurance: InsuranceWords;
  condition: ConditionWords;
  move: MoveWords;
  vehicle: VehicleWords;
};
