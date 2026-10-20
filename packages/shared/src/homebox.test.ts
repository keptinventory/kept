import { describe, expect, it } from 'vitest';
import {
  HB_CSV_PRESET_COLUMNS,
  HB_FIELD_KIND,
  HB_ISSUE_CODES,
  HomeboxChoices,
  HomeboxCsvChoices,
  hbCsvLink,
  homeboxAssetCode,
  isHomeboxCsv,
} from './homebox.js';
import { parseScan } from './scan.js';

const TYPE = '0192f0a0-0000-7000-8000-000000000001';

const choices = {
  archived: 'skip',
  currency: 'EGP',
  quantityRounding: 'keep_note',
  fields: { Voltage: 'add_to_type', 'Door code': 'notes' },
  types: { [TYPE]: { create: 'Power tool' } },
  insured: 'field',
  seeded: 'skip_unused',
} as const;

describe('HomeboxChoices (D146)', () => {
  it('accepts a full set of choices', () => {
    expect(HomeboxChoices.parse(choices)).toEqual(choices);
    expect(
      HomeboxChoices.parse({ ...choices, types: { [TYPE]: { typeId: TYPE } } }).types[TYPE],
    ).toEqual({ typeId: TYPE });
  });

  it('archives archived items, keeps them in use, or leaves them out; the older tag is gone', () => {
    for (const archived of ['archived', 'in_use', 'skip'] as const) {
      expect(HomeboxChoices.parse({ ...choices, archived }).archived).toBe(archived);
    }
    expect(HomeboxChoices.safeParse({ ...choices, archived: 'tag' }).success).toBe(false);
    expect(HomeboxChoices.safeParse({ ...choices, archived: 'gone' }).success).toBe(false);
  });

  it('refuses an unknown key, a lower-case currency and a type given both ways', () => {
    expect(HomeboxChoices.safeParse({ ...choices, extra: 1 }).success).toBe(false);
    expect(HomeboxChoices.safeParse({ ...choices, currency: 'usd' }).success).toBe(false);
    expect(
      HomeboxChoices.safeParse({ ...choices, types: { [TYPE]: { typeId: TYPE, create: 'x' } } })
        .success,
    ).toBe(false);
    expect(HomeboxChoices.safeParse({ ...choices, seeded: undefined }).success).toBe(false);
  });
});

describe('homeboxAssetCode', () => {
  it.each([
    [1, '000-001'],
    [42, '000-042'],
    [123456, '123-456'],
  ])('writes %i as %s, the form a scanned label resolves to', (n, code) => {
    expect(homeboxAssetCode(n)).toBe(code);
    expect(parseScan(`https://homebox.example/a/${n}`)).toMatchObject({ assetId: code });
  });

  it('has no code for 0 (none), a fraction or more than six digits', () => {
    expect(homeboxAssetCode(0)).toBeNull();
    expect(homeboxAssetCode(1.5)).toBeNull();
    expect(homeboxAssetCode(1_000_000)).toBeNull();
  });
});

describe('Homebox field kinds and issues', () => {
  it('maps time to date and keeps the rest', () => {
    expect(HB_FIELD_KIND).toEqual({
      text: 'text',
      number: 'number',
      boolean: 'boolean',
      time: 'date',
    });
  });

  it('prefixes every issue code with hb_', () => {
    expect(HB_ISSUE_CODES.every((c) => c.startsWith('hb_'))).toBe(true);
    expect(new Set(HB_ISSUE_CODES).size).toBe(HB_ISSUE_CODES.length);
  });
});

describe('a Homebox spreadsheet export', () => {
  // The headers as each version writes them (test/fixtures/homebox in apps/server).
  const V0_10_3 = [
    'HB.import_ref',
    'HB.location',
    'HB.labels',
    'HB.asset_id',
    'HB.archived',
    'HB.name',
    'HB.quantity',
    'HB.description',
    'HB.insured',
    'HB.notes',
    'HB.purchase_price',
    'HB.purchase_from',
    'HB.purchase_time',
    'HB.manufacturer',
    'HB.model_number',
    'HB.serial_number',
    'HB.lifetime_warranty',
    'HB.warranty_expires',
    'HB.warranty_details',
    'HB.sold_to',
    'HB.sold_price',
    'HB.sold_time',
    'HB.sold_notes',
    'HB.field.Colour',
  ];
  const V0_27_0 = [
    'HB.purchase_date',
    'HB.warranty_expires',
    'HB.sold_date',
    'HB.import_ref',
    'HB.parent_import_ref',
    'HB.url',
    'HB.name',
    'HB.location',
    'HB.tags',
    'HB.asset_id',
    'HB.archived',
  ];

  it('is told apart by its headers, from v0.10.3 to v0.27.0', () => {
    expect(isHomeboxCsv(V0_10_3)).toBe(true);
    expect(isHomeboxCsv(V0_27_0)).toBe(true);
    expect(isHomeboxCsv(['Name', 'Place', 'HB.name'])).toBe(false);
    expect(isHomeboxCsv(['Name', 'Location', 'Asset ID'])).toBe(false);
  });

  it('names the columns the preset reads itself: codes, archived, insured, warranty, sale', () => {
    expect([...HB_CSV_PRESET_COLUMNS].sort()).toEqual(
      [
        'HB.archived',
        'HB.asset_id',
        'HB.insured',
        'HB.lifetime_warranty',
        'HB.sold_date',
        'HB.sold_notes',
        'HB.sold_price',
        'HB.sold_time',
        'HB.sold_to',
        'HB.url',
        'HB.warranty_details',
        'HB.warranty_expires',
      ].sort(),
    );
  });

  it('reads the item or location UUID from HB.url, relative (v0.26+) or absolute', () => {
    const id = '5af0d9a2-bbb4-44ea-8cd0-acea90d00025';
    expect(hbCsvLink(`/item/${id}`)).toEqual({ kind: 'item', uuid: id });
    expect(hbCsvLink(`https://homebox.example/item/${id.toUpperCase()}`)).toEqual({
      kind: 'item',
      uuid: id,
    });
    expect(hbCsvLink(`/location/${id}`)).toEqual({ kind: 'location', uuid: id });
    expect(hbCsvLink('')).toBeNull();
    expect(hbCsvLink('/item/not-a-uuid')).toBeNull();
  });

  it('takes one choice, what happens to archived items', () => {
    for (const archived of ['archived', 'in_use', 'skip'] as const) {
      expect(HomeboxCsvChoices.parse({ archived })).toEqual({ archived });
    }
    expect(HomeboxCsvChoices.safeParse({ archived: 'ended' }).success).toBe(false);
    expect(HomeboxCsvChoices.safeParse({ archived: 'tag' }).success).toBe(false);
    expect(HomeboxCsvChoices.safeParse({ archived: 'archived', extra: 1 }).success).toBe(false);
  });

  it('has an issue for the location rows a v0.26+ spreadsheet lists', () => {
    expect(HB_ISSUE_CODES).toContain('hb_location_row');
  });
});
