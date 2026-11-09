import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildInsuranceView,
  type InsuranceGathered,
  type InsuranceThing,
} from '../incidents/report.js';
import type { GatheredCondition, GatheredRoom } from './condition/gather.js';
import { buildConditionView } from './condition/view.js';
import type { Gathered, GatheredThing, ReportOptions } from './gather.js';
import { REPORT_LOCALES, type ReportLocale, reportLocaleOf } from './locale.js';
import type { GatheredMove } from './move/gather.js';
import { buildMoveView } from './move/view.js';
import { renderPdf, type TemplateKind, writeData } from './render/render.js';
import type { GatheredVehicle } from './vehicle/gather.js';
import { buildVehicleView } from './vehicle/view.js';
import { buildView } from './view.js';
import { PDF_WORDS } from './words/index.js';

// Every PDF in every language Kept speaks (#465): the tables are complete, each language counts
// with its own plural forms and writes dates, numbers and money its own way, and each kind renders
// in each language with the report font alone (no glyph falls back to another font), read back
// with poppler where it is installed.
//
// KEPT_REPORT_OUT=<dir> also writes every PDF there (<kind>-<locale>.pdf), for a look by eye.

const OTHERS = REPORT_LOCALES.filter((l) => l !== 'en');

/** Every path to a leaf of `value`: its strings, and each function called with sample input. */
function leaves(value: unknown, at = ''): [string, string][] {
  if (typeof value === 'string') return [[at, value]];
  if (typeof value === 'function') {
    const args = Array.from({ length: value.length }, (_, i) => (i === 0 ? 3 : `X${i}`));
    if (value.length === 1) args[0] = 'X0';
    return [[`${at}()`, String((value as (...a: unknown[]) => unknown)(...args))]];
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => leaves(v, at ? `${at}.${k}` : k));
  }
  return [[at, String(value)]];
}

describe('the PDF words', () => {
  it('have every key English has, in every language, and nothing English lacks', () => {
    const keysOf = (l: ReportLocale) =>
      leaves(PDF_WORDS[l])
        .map(([k]) => k)
        // A meter's unit is listed only where the language writes it differently.
        .filter((k) => !k.startsWith('vehicle.distance.'))
        .sort();
    const english = keysOf('en');
    expect(english.length).toBeGreaterThan(200);
    for (const l of OTHERS) expect(keysOf(l), l).toEqual(english);
  });

  it('are never empty, never the middle dot, and written in the language, not left in English', () => {
    const english = new Map(leaves(PDF_WORDS.en));
    // The same as the English on purpose: codes, names, units and words the languages share.
    const shared = [
      'move.id',
      'move.route()',
      'vehicle.cover.vin',
      'vehicle.sources.home_assistant',
      'vehicle.units.L',
      'vehicle.units.kWh',
      'vehicle.units.gal',
      'vehicle.moreInvoices()',
      'vehicle.per100()',
    ];
    const same: Record<ReportLocale, string[]> = {
      ar: ['vehicle.sources.home_assistant', 'vehicle.moreInvoices()'],
      de: [...shared, 'readable.name', 'insurance.converted()'].filter(
        (k) => k !== 'vehicle.cover.vin',
      ),
      en: [],
      es: [
        ...shared,
        'inventory.subtotal',
        'insurance.subtotal',
        'readable.fileRole.manual',
        'vehicle.total',
      ],
      fr: [
        ...shared,
        ...['inventory.page', 'insurance.page', 'condition.page', 'vehicle.page'],
        ...['inventory.filterTypes', 'inventory.filterTags', 'readable.type', 'readable.tags'],
        ...['readable.photo', 'readable.fileRole.photo', 'readable.fileRole.document'],
        ...['condition.photos', 'condition.notes', 'vehicle.cover.type', 'vehicle.documents'],
        ...['vehicle.date', 'vehicle.proof', 'vehicle.total', 'vehicle.name'],
        ...['vehicle.documentsCount', 'vehicle.sources.photo', 'vehicle.docKinds.licence'],
        'vehicle.docKinds.inspection',
      ],
      it: [...shared, 'insurance.converted()'],
      uk: shared.filter((k) => !k.startsWith('vehicle.units.')),
      vi: shared,
    };
    for (const l of REPORT_LOCALES) {
      const words = leaves(PDF_WORDS[l]);
      for (const [key, text] of words) {
        expect(text.trim(), `${l} ${key}`).not.toBe('');
        expect(text, `${l} ${key}`).not.toContain('\u00b7');
      }
      if (l === 'en') continue;
      const untranslated = words
        .filter(([key, text]) => text === english.get(key))
        .map(([key]) => key)
        .sort();
      expect(untranslated, l).toEqual([...same[l]].sort());
    }
  });

  it('counts things with each language’s plural forms', () => {
    const count = (l: ReportLocale, n: number) => PDF_WORDS[l].inventory.thingCount(n, String(n));
    expect([1, 2, 5, 21, 22, 25, 1.5].map((n) => count('uk', n))).toEqual([
      '1 річ',
      '2 речі',
      '5 речей',
      '21 річ',
      '22 речі',
      '25 речей',
      '1.5 речі',
    ]);
    expect([0, 1, 2, 3, 11, 100].map((n) => count('ar', n))).toEqual([
      'لا أشياء',
      'شيء واحد',
      'شيئان',
      '3 أشياء',
      '11 شيئًا',
      '100 شيء',
    ]);
    expect([1, 2].map((n) => count('de', n))).toEqual(['1 Gegenstand', '2 Gegenstände']);
    expect([0, 1, 2, 1_000_000].map((n) => count('fr', n))).toEqual([
      '0 objet',
      '1 objet',
      '2 objets',
      '1000000 d’objets',
    ]);
    expect([1, 2, 1_000_000].map((n) => count('es', n))).toEqual([
      '1 objeto',
      '2 objetos',
      '1000000 de objetos',
    ]);
    expect([1, 2].map((n) => count('it', n))).toEqual(['1 oggetto', '2 oggetti']);
    expect([1, 2].map((n) => count('vi', n))).toEqual(['1 đồ vật', '2 đồ vật']);
  });

  it('takes the language of a tag, and English for one Kept doesn’t speak', () => {
    expect(reportLocaleOf('fr-CA')).toBe('fr');
    expect(reportLocaleOf('uk_UA')).toBe('uk');
    expect(reportLocaleOf('AR-eg')).toBe('ar');
    expect(reportLocaleOf('pt-BR')).toBe('en');
    expect(reportLocaleOf(null)).toBe('en');
  });
});

// ---------------------------------------------------------------------------------------------
// One of each kind, in each language
// ---------------------------------------------------------------------------------------------

const NOW = new Date('2026-09-26T09:00:00Z');
const id = (i: number) => `00000000-0000-7000-8000-${String(i).padStart(12, '0')}`;
const ar = (l: ReportLocale) => l === 'ar';
const digitsOf = (l: ReportLocale) => (ar(l) ? 'eastern' : 'western');

function inventoryThing(
  i: number,
  name: string,
  path: string[],
  more: Partial<GatheredThing> = {},
): GatheredThing {
  return {
    id: id(i),
    locationId: 'loc',
    name,
    typeName: null,
    brand: null,
    model: null,
    serial: null,
    condition: null,
    lifecycle: 'in_use',
    quantity: '1',
    shortCode: null,
    trashed: false,
    thumbKey: null,
    path: path.map((p, depth) => ({
      id: `p-${path.slice(0, depth + 1).join('-')}`,
      name: p,
      kind: 'place',
      isUnplaced: false,
    })),
    money: null,
    ...more,
  };
}

function inventory(l: ReportLocale) {
  const [kitchen, shelf, hall] = ar(l)
    ? ['المطبخ', 'الخزانة العلوية', 'الممر']
    : ['Kitchen', 'Upper shelf', 'Hall'];
  const g: Gathered = {
    locations: [{ id: 'loc', name: ar(l) ? 'البيت' : 'Home' }],
    accountOwnerName: null,
    requesterName: ar(l) ? 'بروس' : 'Bruce',
    requesterTimezone: 'Africa/Cairo',
    moneyShown: true,
    moneyHidden: true,
    things: [
      inventoryThing(1, 'Television', [kitchen, shelf], {
        shortCode: '5KJJZK',
        brand: 'Samsung',
        model: 'QA55Q70D',
        serial: 'SN-TV-0001',
        condition: 'good',
        typeName: 'Electronics',
        money: { purchasedOn: '2024-03-12', unitPrice: '1250.5', value: '1250.5', currency: 'EGP' },
      }),
      inventoryThing(2, 'Espresso machine', [kitchen], {
        quantity: '2',
        condition: 'fair',
        money: {
          purchasedOn: '2025-01-05',
          unitPrice: '617283.75',
          value: '1234567.5',
          currency: 'USD',
        },
      }),
      inventoryThing(3, 'Lamp', [hall], { lifecycle: 'stolen', shortCode: '7KQ4MZ' }),
      inventoryThing(4, 'Old radio', [hall], { trashed: true, condition: 'broken' }),
    ],
    filterNames: { places: [kitchen, hall], types: ['Electronics'], tags: ['Insured'] },
  };
  const options: ReportOptions = {
    filters: {
      placeIds: ['a'],
      typeIds: ['b'],
      tagIds: ['c'],
      includeEnded: true,
      includeTrashed: true,
    },
    include: { photos: false, qr: false, money: true },
    locale: l,
    digits: digitsOf(l),
  };
  return buildView(g, options, {
    instance: 'kept.example',
    now: NOW,
    withPhoto: new Set(),
    withQr: new Set(),
  });
}

function insuranceThing(i: number, more: Partial<InsuranceThing>): InsuranceThing {
  return {
    id: id(i),
    name: 'Thing',
    brand: null,
    model: null,
    serial: null,
    lifecycle: 'in_use',
    trashed: false,
    quantity: '1',
    shortCode: null,
    thumbKey: null,
    path: [{ id: 'p1', name: 'Living room', kind: 'place', isUnplaced: false }],
    purchasedOn: null,
    price: null,
    priceCurrency: null,
    value: null,
    valueCurrency: null,
    valuedOn: null,
    receipts: 0,
    ...more,
  };
}

function insurance(l: ReportLocale) {
  const g: InsuranceGathered = {
    location: { id: 'loc', name: ar(l) ? 'البيت' : 'Home', ownerAccountId: 'acc' },
    ownerName: 'Ibrahim',
    requesterName: 'Bruce',
    requesterTimezone: 'Africa/Cairo',
    incident: {
      id: id(99),
      kind: 'burglary',
      occurredOn: '2026-09-21',
      policeReference: 'PR-44',
      insurerReference: 'CLM-2026-0917',
    },
    moneyShown: true,
    rates: [{ fromCcy: 'USD', toCcy: 'EGP', rate: '48.5', validFrom: '2026-09-01' }],
    things: [
      insuranceThing(1, {
        name: 'Television',
        brand: 'Samsung',
        model: 'QA55Q70D',
        serial: 'SN-TV-0001',
        lifecycle: 'stolen',
        purchasedOn: '2024-03-12',
        price: '25000',
        priceCurrency: 'EGP',
        value: '20000',
        valueCurrency: 'EGP',
        valuedOn: '2026-01-10',
        receipts: 2,
      }),
      insuranceThing(2, {
        name: 'Laptop',
        brand: 'Lenovo',
        model: 'ThinkPad X1 Carbon Gen 12',
        serial: 'PF-4X2M9Q',
        lifecycle: 'stolen',
        purchasedOn: '2025-02-02',
        price: '1200',
        priceCurrency: 'USD',
        receipts: 1,
      }),
    ],
  };
  return buildInsuranceView(
    g,
    { asOf: '2026-09-30', reportCurrency: 'EGP', locale: l, digits: digitsOf(l) },
    { publicUrl: 'https://kept.example', now: NOW, withPhoto: new Set() },
  );
}

function room(name: string, condition: GatheredRoom['condition'], note: string | null) {
  return { id: name, placeId: null, name, condition, note, photos: [], morePhotos: 2 };
}

function condition(l: ReportLocale) {
  const g: GatheredCondition = {
    locationName: ar(l) ? 'الشقة' : 'Flat 4B',
    locationTimezone: 'Africa/Cairo',
    requesterName: 'Talia',
    requesterTimezone: 'Africa/Cairo',
    sides: [
      {
        id: 'a',
        kind: 'move_in',
        heldOn: '2025-09-01',
        notes: 'Keys: 3',
        createdBy: 'Talia',
        finishedAt: new Date('2025-09-01T15:00:00Z'),
        finishedBy: 'Talia',
        rooms: [],
      },
      {
        id: 'b',
        kind: 'move_out',
        heldOn: '2026-09-20',
        notes: null,
        createdBy: 'Talia',
        finishedAt: null,
        finishedBy: null,
        rooms: [],
      },
    ],
    pairs: [
      { a: room('Kitchen', 'good', 'Oven clean'), b: room('Kitchen', 'damaged', 'Tile cracked') },
      { a: room('Bedroom', 'fair', null), b: null },
      { a: null, b: room('Balcony', null, null) },
    ],
  };
  return buildConditionView(
    g,
    {
      kind: 'condition',
      reportId: 'a',
      compareWith: 'b',
      include: { photos: true },
      locale: l,
      digits: digitsOf(l),
    },
    { instance: 'kept.example', now: NOW, withPhoto: new Set() },
  );
}

function move(l: ReportLocale) {
  const g: GatheredMove = {
    name: 'Moving to the new flat',
    locationName: 'Home',
    toLocationName: 'Flat 4B',
    requesterName: 'Louis',
    requesterTimezone: 'Africa/Cairo',
    boxes: [
      {
        containerId: 'c1',
        number: 1,
        name: 'Kitchen books',
        shortCode: 'B0X1QQ',
        state: 'packed',
        room: 'Kitchen',
        lines: [
          { name: 'Cookbooks', quantity: '12', shortCode: null, inside: null },
          { name: 'Spice box', quantity: '1', shortCode: 'SP1CE5', inside: 14 },
        ],
        moreLines: 3,
      },
      {
        containerId: 'c2',
        number: 2,
        name: 'Fragile',
        shortCode: null,
        state: 'in_transit',
        room: null,
        lines: [],
        moreLines: 0,
      },
    ],
  };
  return buildMoveView(
    g,
    { kind: 'move', moveId: 'm', containerIds: null, locale: l, digits: digitsOf(l) },
    { instance: 'kept.example', now: NOW, withQr: new Set() },
  );
}

function vehicle(l: ReportLocale) {
  const g: GatheredVehicle = {
    thing: {
      id: id(7),
      locationId: 'loc',
      name: 'Corolla',
      typeName: 'Car',
      shortCode: 'C0R0LA',
      vin: 'JTDBR32E720123456',
      plate: 'ABC 1234',
      lifecycle: 'in_use',
      thumbKey: null,
    },
    locationName: 'Garage',
    locationTimezone: 'Africa/Cairo',
    requesterName: 'Alfred',
    requesterTimezone: 'Africa/Cairo',
    meter: { id: 'm', kind: 'distance', unit: 'km' },
    latest: { value: '84250', day: '2026-09-20' },
    readingCount: 3,
    readings: [
      {
        id: 'r1',
        day: '2026-07-01',
        value: '81000',
        source: 'manual',
        by: 'Alfred',
        proofKey: null,
      },
      { id: 'r2', day: '2026-08-01', value: '82600', source: 'fuel', by: 'Alfred', proofKey: null },
      { id: 'r3', day: '2026-09-20', value: '84250', source: 'photo', by: 'Alfred', proofKey: 'k' },
    ],
    proofs: [],
    moreProofs: 4,
    services: [
      {
        id: 's1',
        servicedOn: '2026-06-15',
        reading: '80500',
        vendor: 'Toyota Service Centre',
        notes: null,
        by: 'Alfred',
        lines: [
          { description: 'Oil and filter', quantity: '1', unitCost: '1450.5' },
          { description: 'Wiper blades', quantity: '2', unitCost: '220' },
        ],
        money: { total: '1890.5', currency: 'EGP' },
        invoices: [],
        moreInvoices: 2,
      },
    ],
    fuel: {
      summary: {
        byUnit: [
          {
            unit: 'L',
            consumption: {
              perHundred: '6.8',
              distanceUnit: 'km',
              fills: 5,
              from: '2026-05-01',
              to: '2026-09-01',
            },
            trend: [],
          },
        ],
        perDistance: [{ currency: 'EGP', amount: '1.15', distanceUnit: 'km', from: 'a', to: 'b' }],
        monthlyAverage: [{ currency: 'EGP', amount: '2450', months: 12 }],
      },
      years: [{ year: '2026', fills: 14, amounts: [{ unit: 'L', amount: '512.4' }] }],
    },
    documents: [
      {
        id: 'd1',
        kind: 'insurance',
        title: null,
        issuedOn: '2026-01-01',
        expiresOn: '2026-12-31',
        renewed: false,
        money: { cost: '9800', currency: 'EGP' },
      },
      {
        id: 'd2',
        kind: 'registration',
        title: null,
        issuedOn: '2023-03-01',
        expiresOn: '2026-03-01',
        renewed: false,
        money: null,
      },
    ],
    showMoney: true,
    moneyHidden: false,
  };
  return buildVehicleView(
    g,
    {
      kind: 'vehicle_history',
      thingId: id(7),
      from: '2026-01-01',
      to: null,
      include: { costs: true, proofPhotos: true, fuel: true, documents: true },
      locale: l,
      digits: digitsOf(l),
    },
    { instance: 'kept.example', now: NOW, withPhoto: new Set(), withQr: new Set() },
  );
}

const KINDS: { kind: TemplateKind; name: string; view: (l: ReportLocale) => unknown }[] = [
  { kind: 'inventory', name: 'inventory', view: inventory },
  { kind: 'insurance', name: 'insurance', view: insurance },
  { kind: 'condition', name: 'condition', view: condition },
  { kind: 'move', name: 'contents-sheets', view: move },
  { kind: 'vehicle_history', name: 'vehicle', view: vehicle },
];

describe('the views', () => {
  it('write dates, numbers and money the language’s way', () => {
    const de = inventory('de');
    expect(de.lang).toBe('de');
    expect(de.dir).toBe('ltr');
    expect(de.colon).toBe(': ');
    expect(de.labels.title).toBe('Inventarbericht');
    expect(de.totals.map((t) => t.replace(/\s/g, ' '))).toEqual(['1.250,50 EGP', '1.234.567,50 $']);
    expect(de.places.flatMap((p) => p.things).find((t) => t.name === 'Television')).toMatchObject({
      purchased: '12.03.2024',
      condition: 'Gut',
    });
    expect(de.filters).toContain('Orte: Kitchen, Hall');
    const fr = inventory('fr');
    expect(fr.colon).toBe(' : ');
    expect(fr.filters).toContain('Emplacements : Kitchen, Hall');
    expect(fr.places.find((p) => p.pathText === 'Hall')?.count).toBe('2 objets');
    expect(inventory('uk').places.find((p) => p.pathText === 'Hall')?.count).toBe('2 речі');
    expect(inventory('uk').generatedLine).toMatch(/^Створено: Bruce, 26 вересня 2026/);
    const ins = insurance('es');
    expect(ins.labels.title).toBe('Reporte de seguro');
    expect(ins.incident).toEqual({
      title: 'Robo',
      lines: [
        'El 21 sept 2026',
        'Referencia policial: PR-44',
        'Referencia de la aseguradora: CLM-2026-0917',
      ],
    });
    // Arabic as before: Eastern digits, right to left, the Arabic comma.
    const a = inventory('ar');
    expect(a.dir).toBe('rtl');
    expect(a.sep).toBe('، ');
    expect(a.digits).toBe('arab');
    expect(a.pathSeparator).toBe('‹');
    expect(a.labels.title).toBe('تقرير الجرد');
  });

  it('never put the middle dot between a line’s parts', () => {
    for (const { view } of KINDS) {
      for (const l of REPORT_LOCALES) expect(JSON.stringify(view(l)), l).not.toContain('·');
    }
  });
});

let hasPoppler = true;
try {
  execFileSync('pdftotext', ['-v'], { stdio: 'ignore', timeout: 30_000 });
  execFileSync('pdffonts', ['-v'], { stdio: 'ignore', timeout: 30_000 });
} catch {
  hasPoppler = false;
}

describe.skipIf(!hasPoppler)('every PDF in every language', () => {
  let scratch: string;
  beforeAll(async () => {
    scratch = await mkdtemp(path.join(tmpdir(), 'kept-languages-'));
  });
  afterAll(async () => {
    await rm(scratch, { recursive: true, force: true });
  });

  for (const { kind, name, view } of KINDS) {
    it(`renders the ${name} PDF in each language, in the report font alone`, async () => {
      const out = process.env.KEPT_REPORT_OUT;
      for (const l of REPORT_LOCALES) {
        const dir = await mkdtemp(path.join(scratch, `${name}-${l}-`));
        await writeData(dir, view(l));
        const { file } = await renderPdf(dir, {}, kind);
        const pdf = await readFile(file);
        if (out) {
          mkdirSync(out, { recursive: true });
          writeFileSync(path.join(out, `${name}-${l}.pdf`), pdf);
        }
        // Only IBM Plex: a letter the font lacks would come from a fallback font.
        const fonts = execFileSync('pdffonts', ['-'], { input: pdf }).toString('utf8');
        const families = fonts
          .split('\n')
          .slice(2)
          .map((line) => line.split(/\s+/)[0] ?? '')
          .filter((f) => f !== '');
        expect(families.length, `${name} ${l}`).toBeGreaterThan(0);
        for (const f of families) expect(f, `${name} ${l}`).toMatch(/IBMPlex/);
        const text = execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', '-', '-'], {
          input: pdf,
        }).toString('utf8');
        // pdftotext splits some Arabic ligatures; the Latin and Cyrillic words read back whole.
        const labels = (view(l) as { labels: { title?: string; goesTo?: string } }).labels;
        const heading = labels.title ?? labels.goesTo ?? '';
        if (l !== 'ar') expect(text, `${name} ${l}`).toContain(heading);
        else expect((text.match(/[؀-ۿ]/g) ?? []).length, `${name} ${l}`).toBeGreaterThan(20);
      }
    }, 240_000);
  }
});
