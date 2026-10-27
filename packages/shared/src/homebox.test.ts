import { describe, expect, it } from 'vitest';
import {
  HB_CSV_PRESET_COLUMNS,
  HB_FIELD_KIND,
  HB_ISSUE_CODES,
  HomeboxChoices,
  HomeboxCsvChoices,
  hbCsvLink,
  homeboxAssetCode,
  homeboxModules,
  homeboxTypeName,
  isHomeboxCsv,
  looksLikeBox,
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

describe('HomeboxChoices', () => {
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

describe('HomeboxChoices from 1.13.0', () => {
  it('still reads choices saved before: no quantity-0 choice, no boxes', () => {
    const old = HomeboxChoices.parse(choices);
    expect(old.zeroQuantity).toBeUndefined();
    expect(old.boxes).toBeUndefined();
  });

  it('takes No type, the quantity-0 choice and the locations to bring in as boxes', () => {
    const parsed = HomeboxChoices.parse({
      ...choices,
      types: { [TYPE]: { none: true } },
      zeroQuantity: 'keep_or_archive',
      boxes: [TYPE],
    });
    expect(parsed.types[TYPE]).toEqual({ none: true });
    for (const zeroQuantity of ['keep_or_archive', 'one', 'skip'] as const) {
      expect(HomeboxChoices.parse({ ...choices, zeroQuantity }).zeroQuantity).toBe(zeroQuantity);
    }
    expect(HomeboxChoices.safeParse({ ...choices, zeroQuantity: 'zero' }).success).toBe(false);
    expect(
      HomeboxChoices.safeParse({ ...choices, types: { [TYPE]: { none: false } } }).success,
    ).toBe(false);
    expect(HomeboxChoices.safeParse({ ...choices, boxes: ['Box 01'] }).success).toBe(false);
  });
});

describe('homeboxTypeName', () => {
  it("reads Homebox's own names for its two types, and leaves every other name as it is", () => {
    expect(homeboxTypeName('global.item')).toBe('Item');
    expect(homeboxTypeName('global.location')).toBe('Location');
    expect(homeboxTypeName(' global.item ')).toBe('Item');
    expect(homeboxTypeName('Power tool')).toBe('Power tool');
    expect(homeboxTypeName('global.items')).toBe('global.items');
  });
});

describe('homeboxModules', () => {
  it('names the modules a backup has data for, with how many entries', () => {
    expect(homeboxModules({ pricedItems: 10, warrantyItems: 5, maintenance: 1 })).toEqual([
      { module: 'money', count: 10 },
      { module: 'warranties', count: 5 },
      { module: 'schedules', count: 1 },
    ]);
    expect(homeboxModules({ pricedItems: 0, warrantyItems: 2 })).toEqual([
      { module: 'warranties', count: 2 },
    ]);
    // A backup with none of that data (or an inspection before 1.13.0): Essentials alone.
    expect(homeboxModules({})).toEqual([]);
  });
});

describe('looksLikeBox', () => {
  it.each([
    'Box 01',
    'box',
    'Bin 2',
    'Crate A',
    'Tote #3',
    'Storage box', // a box word anywhere, as its own word
    'Kiste 3',
    'Karton Keller',
    'Boîte à outils',
    'Caisse 2',
    'Scatola 4',
    'Contenitore blu',
    'صندوق ٢',
    'علبة الأدوات',
  ])('reads %s as a box', (name) => {
    expect(looksLikeBox(name)).toBe(true);
  });

  it.each(['Boxing gloves', 'Kitchen', 'Bedroom', 'Shelf A', 'Toolbench', 'Inbox', ''])(
    'reads %s as a place',
    (name) => {
      expect(looksLikeBox(name)).toBe(false);
    },
  );
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
