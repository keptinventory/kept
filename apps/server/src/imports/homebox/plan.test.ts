import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type HomeboxChoices, newId } from '@kept/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type TestFiles, testFiles } from '../../../test/files.js';
import { importArchiveKey } from '../../storage/blob-store.js';
import { inspectHomebox } from './inspect.js';
import type { HbLookups } from './lookups.js';
import { type HbOp, planHomebox, type ThingOp } from './plan.js';
import { type HomeboxData, openHomebox, readHomebox } from './read.js';

// The Homebox mapping over two real exports (test/fixtures/homebox/README.md),
// planned against hand-made lookups: no database, the planner is pure.

const FIXTURES = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'test',
  'fixtures',
  'homebox',
);

let files: TestFiles;
let home: HomeboxData;
let family: HomeboxData;

async function read(name: 'home' | 'family' | string): Promise<HomeboxData> {
  const runId = newId();
  const file = path.join(FIXTURES, name.endsWith('.zip') ? name : `homebox-0.26.2-${name}.zip`);
  const { stat } = await import('node:fs/promises');
  const bytes = (await stat(file)).size;
  await files.blobs.put(importArchiveKey(runId), file, { contentType: 'application/zip', bytes });
  const archive = await openHomebox(files.blobs, importArchiveKey(runId), bytes);
  try {
    return await readHomebox(archive);
  } finally {
    archive.close();
  }
}

const BOX = '00000000-0000-7000-8000-00000000b0b0';
const APPLIANCE = '00000000-0000-7000-8000-0000000000a1';
const TOOL = '00000000-0000-7000-8000-0000000000a2';
const UNPLACED = '00000000-0000-7000-8000-0000000000aa';

function lookups(over: Partial<HbLookups> = {}): HbLookups {
  return {
    locationId: '00000000-0000-7000-8000-00000000000a',
    accountId: '00000000-0000-7000-8000-00000000000b',
    today: '2026-10-07',
    showMoney: true,
    modules: new Set(['money', 'warranties', 'schedules']),
    currencies: new Set(['EGP', 'USD', 'SAR']),
    types: new Map([
      ['appliance', APPLIANCE],
      ['tool', TOOL],
    ]),
    typeInfo: new Map([
      [BOX, { builtin: true, caps: ['container'], fields: [] }],
      [APPLIANCE, { builtin: true, caps: ['warranty', 'serialized'], fields: [] }],
      [TOOL, { builtin: true, caps: ['warranty', 'serialized'], fields: [] }],
    ]),
    boxBinTypeId: BOX,
    tags: new Map(),
    brands: new Map(),
    vendors: new Map(),
    places: new Map(),
    unplacedId: UNPLACED,
    sourceIds: new Map(),
    takenCodes: new Set(),
    maxFileBytes: 25 * 1024 * 1024,
    ...over,
  };
}

const choices = (data: HomeboxData, over: Partial<HomeboxChoices> = {}): HomeboxChoices => ({
  archived: 'skip',
  currency: 'SAR',
  quantityRounding: 'keep_note',
  fields: {},
  // The web's default: a Kept type of the same name, else a new one (homebox-choices.tsx).
  types: Object.fromEntries(
    [...data.types.values()]
      .filter((t) => !t.is_location)
      .map((t) => [
        t.id,
        t.name === 'Appliance'
          ? { typeId: APPLIANCE }
          : t.name === 'Tool'
            ? { typeId: TOOL }
            : { create: t.name },
      ]),
  ),
  insured: 'field',
  seeded: 'skip_unused',
  ...over,
});

const things = (ops: HbOp[]) => ops.filter((o): o is ThingOp => o.op === 'thing');
const thing = (ops: HbOp[], name: string) => {
  const found = things(ops).find((t) => t.name === name);
  if (!found) throw new Error(`no thing ${name}`);
  return found;
};
const idOf = (data: HomeboxData, name: string) =>
  [...data.entities.values()].find((e) => e.name === name)?.id as string;
const issuesOf = (plan: ReturnType<typeof planHomebox>, id: string) =>
  plan.report.rows.find((r) => r.ref.id === id)?.issues.map((i) => i.code) ?? [];

beforeAll(async () => {
  files = await testFiles();
  home = await read('home');
  family = await read('family');
});

afterAll(async () => {
  await files?.cleanup();
});

describe('reading the fixtures', () => {
  it('parses every row of both exports, and never opens notifiers.json', () => {
    expect(home.bad).toEqual([]);
    expect(family.bad).toEqual([]);
    expect(home.entities.size).toBe(21);
    expect(family.entities.size).toBe(13);
    expect(home.ignored).toBe(1); // notifiers.json
    expect(home.manifest.groupId).toBe('1d93892c-082a-4fb4-9645-b78321688b99');
  });
});

describe('planHomebox over Home', () => {
  it('counts what the import would add', () => {
    const plan = planHomebox(home, choices(home), lookups());
    expect(plan.report.summary).toEqual({
      // Home, Kitchen, Study, Top shelf (the seeded eight are empty and skipped).
      places: 4,
      // Espresso machine, Fridge, Toolbox, Cordless drill, Bits tray, Wood screws, Desk lamp,
      // Kettle (Old phone is archived and skipped).
      things: 8,
      containers: 2,
      purchases: 2,
      warranties: 2,
      services: 1,
      schedules: 1,
      // Two photos, a manual, a warranty, a receipt and fridge.jpg; the .docx and .txt refused.
      attachments: 6,
      links: 1,
      // Tech, Audio, مطبخ, Fragile (the seeded six are unused and skipped).
      tags: 4,
      // Gadget isn't used (its one item is archived); Odd icon is new.
      types: 1,
      // Appliance: Colour, Boiler size (ml), Plumbed in, Insured, Voltage, Dishwasher safe (the
      // time fields are empty, Watts has no value).
      fieldsAdded: 6,
      // 12 entities (4 places, 8 things), each its asset ID and its UUID.
      legacyCodes: 24,
      skipped: 9,
      asText: 2,
      refusedFiles: 2,
    });
  });

  it('makes the item inside an item a container, and the location inside an item a box', () => {
    const plan = planHomebox(home, choices(home), lookups());
    const toolbox = thing(plan.ops, 'Toolbox');
    // Tool can't hold things: Toolbox is a box, with its Homebox type in the notes.
    expect(toolbox.type).toEqual({ id: BOX });
    expect(toolbox.notes).toContain('Homebox type: Tool');
    expect(thing(plan.ops, 'Cordless drill').where).toEqual({
      container: { key: idOf(home, 'Toolbox') },
    });
    const tray = thing(plan.ops, 'Bits tray');
    expect(tray.type).toEqual({ id: BOX });
    expect(issuesOf(plan, idOf(home, 'Bits tray'))).toContain('hb_location_in_item');
    expect(thing(plan.ops, 'Wood screws').where).toEqual({
      container: { key: idOf(home, 'Bits tray') },
    });
  });

  it('notes the tags on a location that becomes a place: Kept tags things only', () => {
    const tag = [...home.tags.values()][0];
    const room = [...home.entities.values()].find(
      (e) => home.types.get(e.entity_type_entities)?.is_location && e.name !== 'Bits tray',
    );
    if (!tag || !room) throw new Error('the fixture has a tag and a location');
    const data = {
      ...home,
      tagEntities: [...home.tagEntities, { tag_id: tag.id, entity_id: room.id }],
    };
    const plan = planHomebox(data as HomeboxData, choices(home), lookups());
    expect(issuesOf(plan, room.id)).toContain('hb_place_tags_dropped');
    expect(issuesOf(planHomebox(home, choices(home), lookups()), room.id)).not.toContain(
      'hb_place_tags_dropped',
    );
  });

  it('keeps a fractional quantity in the notes where the type counts one by one', () => {
    const plan = planHomebox(home, choices(home), lookups());
    const screws = thing(plan.ops, 'Wood screws');
    expect(screws.quantity).toBe(1);
    expect(screws.notes).toContain('Quantity in Homebox: 2.5');
    expect(issuesOf(plan, idOf(home, 'Wood screws'))).toContain('hb_quantity_rounded');
    // A type of its own (made here, not serialized) keeps 2.5.
    const own = planHomebox(home, choices(home, { types: {} }), lookups({ types: new Map() }));
    expect(thing(own.ops, 'Wood screws').quantity).toBe(2.5);
    // Quantity 0 from an API client became 1.
    expect(issuesOf(plan, idOf(home, 'Espresso machine'))).toContain('hb_quantity_zero');
  });

  it('maps the lifetime warranty, the dated one, the purchase and the sale', () => {
    const plan = planHomebox(home, choices(home, { archived: 'in_use' }), lookups());
    const warranties = plan.ops.filter((o) => o.op === 'warranty');
    expect(warranties).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          thing: { key: idOf(home, 'Fridge') },
          body: { kind: 'manufacturer', startsOn: '2023-02-14', lifetime: true },
        }),
        expect.objectContaining({
          thing: { key: idOf(home, 'Espresso machine') },
          body: { kind: 'manufacturer', startsOn: '2024-11-03', endsOn: '2026-11-03' },
        }),
      ]),
    );
    const espresso = thing(plan.ops, 'Espresso machine');
    expect(espresso.purchase).toEqual({
      key: `${idOf(home, 'Espresso machine')}:purchase`,
      purchasedOn: '2024-11-03',
      price: '12999.99',
      currency: 'SAR',
      vendor: { create: 'Bean Bros' },
    });
    expect(espresso.brand).toEqual({ create: 'Rocket' });
    expect(espresso.notes).toBe(
      'Dual boiler\n\nDescale monthly.\nUse filtered water.\n\nQuantity in Homebox: 0\nWarranty: Two years, parts and labour',
    );
    const phone = thing(plan.ops, 'Old phone');
    expect(phone.sold).toEqual({
      endedOn: '2025-08-20',
      endedTo: 'Murdock',
      endedNotes: 'Paid in cash',
      endedPrice: '40',
      endedCurrency: 'SAR',
    });
    // Sold wins: it ends sold, not archived.
    expect(phone.archived).toBe(false);
  });

  it('skips the archived item by default', () => {
    const plan = planHomebox(home, choices(home), lookups());
    expect(things(plan.ops).map((t) => t.name)).not.toContain('Old phone');
    expect(issuesOf(plan, idOf(home, 'Old phone'))).toEqual(['hb_archived_skipped']);
  });

  it('gives a child tag its parent too', () => {
    const plan = planHomebox(home, choices(home), lookups());
    const tech = [...home.tags.values()].find((t) => t.name === 'Tech')?.id;
    const audio = [...home.tags.values()].find((t) => t.name === 'Audio')?.id;
    expect(thing(plan.ops, 'Cordless drill').tags).toEqual([
      { key: `tag:${audio}` },
      { key: `tag:${tech}` },
    ]);
    // A named colour is read as its hex.
    const fragile = plan.ops.find(
      (o) => o.op === 'tag' && 'create' in o.target && o.target.create.name === 'Fragile',
    );
    expect(fragile).toMatchObject({ target: { create: { colour: '#FF0000' } } });
  });

  it('maps custom fields onto the type, a time field read as empty, whole numbers not flagged', () => {
    const plan = planHomebox(home, choices(home), lookups());
    const espresso = thing(plan.ops, 'Espresso machine');
    expect(espresso.custom).toEqual({
      colour: 'Brushed steel',
      boiler_size_ml: 1800,
      plumbed_in: true,
      insured: true,
    });
    const codes = issuesOf(plan, idOf(home, 'Espresso machine'));
    expect(codes).toContain('hb_time_default');
    expect(codes).not.toContain('hb_number_integer');
    const appliance = plan.ops.find(
      (o) =>
        o.op === 'type' &&
        o.key.endsWith([...home.types.values()].find((t) => t.name === 'Appliance')?.id as string),
    );
    // A built-in gaining fields is customised first.
    expect(appliance).toMatchObject({ customise: true, target: { id: APPLIANCE } });
    expect((appliance as { fields: { label: string; kind: string }[] }).fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Colour', kind: 'text' }),
        expect.objectContaining({ label: 'Insured', kind: 'boolean' }),
      ]),
    );
    // "Keep in notes" for one field.
    const noted = planHomebox(home, choices(home, { fields: { Colour: 'notes' } }), lookups());
    expect(thing(noted.ops, 'Espresso machine').notes).toContain('Colour: Brushed steel');
  });

  it('archives an archived item, a sold one ends sold; In use and Leave out as chosen; no tag', async () => {
    const upgraded = await read('homebox-0.27.0-upgraded.zip');
    const archivedPlan = planHomebox(
      upgraded,
      choices(upgraded, { archived: 'archived' }),
      lookups(),
    );
    expect(thing(archivedPlan.ops, 'Spare router')).toMatchObject({ archived: true, sold: null });
    expect(thing(archivedPlan.ops, 'Old laptop')).toMatchObject({ archived: false });
    expect(thing(archivedPlan.ops, 'Old laptop').sold).not.toBeNull();
    expect(archivedPlan.ops.some((o) => o.op === 'tag' && o.key === 'tag:archived')).toBe(false);
    const inUse = planHomebox(upgraded, choices(upgraded, { archived: 'in_use' }), lookups());
    expect(thing(inUse.ops, 'Spare router')).toMatchObject({
      archived: false,
      tags: [expect.anything()],
    });
    const left = planHomebox(upgraded, choices(upgraded, { archived: 'skip' }), lookups());
    expect(left.ops.some((o) => o.op === 'thing' && o.name === 'Spare router')).toBe(false);
  });

  it('sends a file Homebox typed application/octet-stream to the job, which sniffs it', async () => {
    // Attachments made before Homebox recorded file types come out of the upgrade untyped.
    const upgraded = await read('homebox-0.27.0-upgraded.zip');
    const plan = planHomebox(upgraded, choices(upgraded), lookups());
    expect(plan.report.rows.flatMap((r) => r.issues.map((i) => i.code))).not.toContain(
      'file_type_refused',
    );
    expect(plan.ops).toContainEqual(
      expect.objectContaining({ op: 'attachment', title: 'drill.png', role: 'photo', sort: 0 }),
    );
  });

  it('refuses the .docx and the text file by name, keeps the link, skips thumbnails', () => {
    const plan = planHomebox(home, choices(home), lookups());
    const refused = plan.report.rows.filter((r) =>
      r.issues.some((i) => i.code === 'file_type_refused'),
    );
    expect(refused.map((r) => r.ref.name).sort()).toEqual([
      'espresso-notes.txt',
      'espresso-quickstart.docx',
    ]);
    const attachments = plan.ops.filter((o) => o.op === 'attachment');
    expect(attachments.some((a) => a.op === 'attachment' && a.title.endsWith('-thumb'))).toBe(
      false,
    );
    expect(attachments).toContainEqual(
      expect.objectContaining({
        url: 'https://example.com/manuals/r58?lang=en#setup',
        role: 'manual',
        file: null,
      }),
    );
    // The primary photo first; the warranty PDF on the warranty, the receipt on the purchase.
    const front = attachments.find(
      (a) => a.op === 'attachment' && a.title === 'espresso-front.jpg',
    );
    expect(front).toMatchObject({ sort: 0, role: 'photo' });
    expect(
      attachments.find((a) => a.op === 'attachment' && a.title === 'espresso-warranty.pdf'),
    ).toMatchObject({ subject: 'warranty', role: 'warranty_doc' });
    expect(
      attachments.find((a) => a.op === 'attachment' && a.title === 'espresso-receipt.jpg'),
    ).toMatchObject({ subject: 'purchase', role: 'receipt' });
  });

  it('keeps money as text where money is off, and records as text where their module is off', () => {
    const plan = planHomebox(
      home,
      choices(home),
      lookups({ showMoney: false, modules: new Set(['money']) }),
    );
    const espresso = thing(plan.ops, 'Espresso machine');
    expect(espresso.purchase).toBeNull();
    expect(espresso.notes).toContain('Price: 12999.99 SAR');
    expect(espresso.notes).toContain('Warranty until: 2026-11-03');
    expect(espresso.notes).toContain('Maintenance: Descale');
    const codes = issuesOf(plan, idOf(home, 'Espresso machine'));
    expect(codes).toContain('money_off');
    expect(codes).toContain('hb_needs_module');
    expect(plan.ops.filter((o) => o.op === 'warranty' || o.op === 'service')).toEqual([]);
  });

  it('marks a code the location already has as taken, and skips what an earlier run made', () => {
    const espresso = idOf(home, 'Espresso machine');
    const plan = planHomebox(
      home,
      choices(home),
      lookups({ takenCodes: new Set(['000-005']), sourceIds: new Map([[espresso, newId()]]) }),
    );
    expect(things(plan.ops).map((t) => t.key)).not.toContain(espresso);
    expect(issuesOf(plan, espresso)).toContain('already_imported');
    const again = planHomebox(home, choices(home), lookups({ takenCodes: new Set(['000-005']) }));
    expect(thing(again.ops, 'Espresso machine').codes).toEqual([espresso.toUpperCase()]);
    expect(issuesOf(again, espresso)).toContain('code_taken');
  });

  it('reports a malformed row and plans the rest', () => {
    const broken: HomeboxData = {
      ...home,
      bad: [{ table: 'entities', index: 3, id: 'x', name: 'Broken' }],
    };
    const plan = planHomebox(broken, choices(broken), lookups());
    expect(plan.report.rows.find((r) => r.ref.id === 'x')?.issues[0]?.code).toBe('entry_ignored');
    expect(plan.report.summary.things).toBe(8);
  });

  it('notes the notifier without reading it', () => {
    const plan = planHomebox(home, choices(home), lookups());
    expect(plan.report.rows.find((r) => r.ref.id === 'notifiers.json')?.issues[0]?.code).toBe(
      'hb_notifier_skipped',
    );
  });
});

describe('planHomebox over بيت العائلة', () => {
  it('gives its 000-005 its own code and a container for the remote inside the TV', () => {
    const plan = planHomebox(family, choices(family), lookups());
    const tv = thing(plan.ops, 'تلفزيون سامسونج');
    const remote = thing(plan.ops, 'ريموت');
    expect(remote.where).toEqual({ container: { key: tv.key } });
    expect(remote.codes).toContain('000-005');
    expect(tv.serial).toBe('٠١٢٣٤٥');
    expect(plan.report.summary).toMatchObject({ things: 3, places: 2, containers: 1, services: 1 });
  });
});

describe('planHomebox over a Homebox 0.27 upgrade (the boxes backup)', () => {
  let boxes: HomeboxData;
  let upgraded: HomeboxData;
  const CONSUMABLE = '00000000-0000-7000-8000-0000000000c1';
  const itemType = (data: HomeboxData) =>
    [...data.types.values()].find((t) => t.name === 'global.item')?.id as string;
  const located = (data: HomeboxData, name: string) =>
    [...data.entities.values()].find(
      (e) => e.name === name && data.types.get(e.entity_type_entities)?.is_location,
    )?.id as string;
  const rowOf = (plan: ReturnType<typeof planHomebox>, id: string) =>
    plan.report.rows.find((r) => r.ref.id === id);
  const typeOps = (ops: HbOp[]) =>
    ops.filter((o): o is Extract<HbOp, { op: 'type' }> => o.op === 'type');

  beforeAll(async () => {
    boxes = await read('homebox-0.27.0-boxes.zip');
    upgraded = await read('homebox-0.27.0-upgraded.zip');
  });

  it('reads every row of the backup', () => {
    expect(boxes.bad).toEqual([]);
    expect([...boxes.types.values()].map((t) => t.name).sort()).toEqual([
      'global.item',
      'global.location',
    ]);
  });

  it('never creates a type named global.item or global.location', () => {
    for (const data of [boxes, upgraded]) {
      // Even when the choice names the key itself, as an older web would.
      const plan = planHomebox(data, choices(data), lookups({ types: new Map() }));
      const names = typeOps(plan.ops).map((o) =>
        'create' in o.target ? o.target.create.name : '',
      );
      expect(names).toContain('Item');
      expect(names.join()).not.toContain('global.');
      expect(JSON.stringify(plan.report)).not.toContain('"name":"global.');
    }
  });

  it('No type: things come in without a type, a holding one as a box', () => {
    const plan = planHomebox(
      boxes,
      choices(boxes, { types: { [itemType(boxes)]: { none: true } } }),
      lookups(),
    );
    expect(typeOps(plan.ops)).toEqual([]);
    expect(thing(plan.ops, 'Hammer').type).toBeNull();
    const tackle = thing(plan.ops, 'Tackle box');
    expect(tackle.type).toEqual({ id: BOX });
    expect(issuesOf(plan, idOf(boxes, 'Tackle box'))).toContain('hb_item_holds_things');
    expect(plan.report.summary.types).toBe(0);
  });

  it('one item holding a location makes only that item a container, never its type', () => {
    const plan = planHomebox(boxes, choices(boxes), lookups({ types: new Map() }));
    const item = typeOps(plan.ops).find((o) => o.key === `type:${itemType(boxes)}`);
    expect(item).toMatchObject({ target: { create: { name: 'Item' } }, container: false });
    const tackle = thing(plan.ops, 'Tackle box');
    expect(tackle.type).toEqual({ id: BOX });
    expect(tackle.notes).toContain('Homebox type: Item');
    expect(issuesOf(plan, idOf(boxes, 'Tackle box'))).toContain('hb_item_holds_things');
    // Everything else keeps the created type.
    expect(thing(plan.ops, 'Hammer').type).toEqual({ key: `type:${itemType(boxes)}` });
    // The lure tray (a location inside the tackle box) is a box inside it, holding the lures.
    const tray = thing(plan.ops, 'Lure tray');
    expect(tray.where).toEqual({ container: { key: idOf(boxes, 'Tackle box') } });
    expect(thing(plan.ops, 'Lures').where).toEqual({ container: { key: tray.key } });
  });

  it('a type whose every item holds something becomes a container type', () => {
    // Desk lamp is the one item of Odd icon, a type this import creates; put the kettle in it.
    const lamp = idOf(home, 'Desk lamp');
    const kettle = idOf(home, 'Kettle');
    const data: HomeboxData = {
      ...home,
      entities: new Map(
        [...home.entities].map(([id, e]) => [
          id,
          id === kettle ? { ...e, entity_children: lamp } : e,
        ]),
      ),
    };
    const odd = [...home.types.values()].find((t) => t.name === 'Odd icon')?.id as string;
    const plan = planHomebox(data, choices(data), lookups());
    expect(typeOps(plan.ops).find((o) => o.key === `type:${odd}`)).toMatchObject({
      container: true,
    });
    expect(thing(plan.ops, 'Desk lamp').type).toEqual({ key: `type:${odd}` });
    expect(issuesOf(plan, lamp)).not.toContain('hb_item_holds_things');
    // Tool's Toolbox holds the drill, but the drill and the screws don't hold anything.
    expect(thing(plan.ops, 'Toolbox').type).toEqual({ id: BOX });
  });

  it('quantity 0: kept where the type is consumable, archived otherwise, with the note', () => {
    const plan = planHomebox(
      boxes,
      choices(boxes, { zeroQuantity: 'keep_or_archive' }),
      lookups({ types: new Map() }),
    );
    const batteries = thing(plan.ops, 'AA batteries');
    expect(batteries).toMatchObject({ quantity: 1, archived: true });
    expect(batteries.notes).toContain('Quantity in Homebox: 0');
    expect(batteries.notes).toContain('Used the last ones in the smoke alarm');
    expect(issuesOf(plan, idOf(boxes, 'AA batteries'))).toEqual(['hb_quantity_zero_archived']);
    const zeroes = things(plan.ops).filter((t) => t.notes?.includes('Quantity in Homebox: 0'));
    expect(zeroes.map((t) => t.name).sort()).toEqual([
      'AA batteries',
      'Candles',
      'Gas canister',
      'Grout',
      'Lures',
      'Spare light bulbs',
      'Wrapping paper',
      'Zip ties',
    ]);
    expect(zeroes.every((t) => t.archived && t.quantity === 1)).toBe(true);
    // Mapped to a consumable type, 0 stays 0 and the thing stays in use.
    const consumable = planHomebox(
      boxes,
      choices(boxes, {
        zeroQuantity: 'keep_or_archive',
        types: { [itemType(boxes)]: { typeId: CONSUMABLE } },
      }),
      lookups({
        typeInfo: new Map([
          [BOX, { builtin: true, caps: ['container'], fields: [] }],
          [CONSUMABLE, { builtin: true, caps: ['consumable'], fields: [] }],
        ]),
      }),
    );
    expect(thing(consumable.ops, 'AA batteries')).toMatchObject({ quantity: 0, archived: false });
    expect(thing(consumable.ops, 'AA batteries').notes).toContain('Quantity in Homebox: 0');
    expect(issuesOf(consumable, idOf(boxes, 'AA batteries'))).toEqual(['hb_quantity_zero_kept']);
  });

  it('quantity 0: set to 1, or left out, as chosen; an old run without the choice keeps 1', () => {
    const one = planHomebox(boxes, choices(boxes, { zeroQuantity: 'one' }), lookups());
    expect(thing(one.ops, 'Candles')).toMatchObject({ quantity: 1, archived: false });
    expect(thing(one.ops, 'Candles').notes).toContain('Quantity in Homebox: 0');
    expect(issuesOf(one, idOf(boxes, 'Candles'))).toEqual(['hb_quantity_zero']);
    const old = planHomebox(boxes, choices(boxes), lookups());
    expect(thing(old.ops, 'Candles')).toMatchObject({ quantity: 1, archived: false });
    const skip = planHomebox(boxes, choices(boxes, { zeroQuantity: 'skip' }), lookups());
    expect(things(skip.ops).map((t) => t.name)).not.toContain('Candles');
    expect(rowOf(skip, idOf(boxes, 'Candles'))).toMatchObject({
      status: 'skipped',
      issues: [expect.objectContaining({ code: 'hb_quantity_zero_skipped' })],
    });
    // What was inside a left-out item still comes in, in its place.
    expect(skip.report.summary.things).toBe(one.report.summary.things - 8);
  });

  it('whole-number note absent for whole numbers, once per field otherwise', () => {
    const plan = planHomebox(boxes, choices(boxes), lookups());
    expect(issuesOf(plan, idOf(boxes, 'Pressure washer'))).not.toContain('hb_number_integer');
    expect(issuesOf(plan, idOf(boxes, 'Dehumidifier'))).not.toContain('hb_number_integer');
    const fractional: HomeboxData = {
      ...boxes,
      fields: boxes.fields.map((f) =>
        f.name === 'Wattage' ? { ...f, number_value: (f.number_value ?? 0) + 0.5 } : f,
      ),
    };
    const flagged = planHomebox(fractional, choices(fractional), lookups());
    const rows = flagged.report.rows.filter((r) =>
      r.issues.some((i) => i.code === 'hb_number_integer'),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.issues.find((i) => i.code === 'hb_number_integer')?.column).toBe('Wattage');
  });

  it('the chosen box-like locations come in as boxes holding their items, with their tags', () => {
    const chosen = [...boxes.entities.values()]
      .filter((e) => /^Box \d\d$/.test(e.name))
      .map((e) => e.id);
    expect(chosen).toHaveLength(12);
    const plan = planHomebox(boxes, choices(boxes, { boxes: chosen }), lookups());
    const box12 = thing(plan.ops, 'Box 12');
    expect(box12).toMatchObject({
      type: { id: BOX },
      where: { place: { key: located(boxes, 'Garage') } },
    });
    expect(box12.tags).toHaveLength(1);
    expect(box12.codes.length).toBeGreaterThan(0);
    expect(thing(plan.ops, 'Photo albums').where).toEqual({ container: { key: box12.key } });
    expect(issuesOf(plan, box12.key)).toContain('hb_box_from_location');
    expect(issuesOf(plan, box12.key)).not.toContain('hb_place_tags_dropped');
    const places = plan.ops
      .filter((o) => o.op === 'place')
      .map((o) => (o as { name: string }).name);
    expect(places.some((n) => n.startsWith('Box '))).toBe(false);
    const without = planHomebox(boxes, choices(boxes), lookups());
    expect(plan.report.summary.places).toBe(without.report.summary.places - 12);
    expect(plan.report.summary.things).toBe(without.report.summary.things + 12);
    // A location that holds another location can't be a box: it stays a place.
    const shelfC = located(boxes, 'Shelf C');
    const refused = planHomebox(boxes, choices(boxes, { boxes: [shelfC] }), lookups());
    expect(refused.ops.some((o) => o.op === 'place' && o.key === shelfC)).toBe(true);
  });

  it("a location's dropped description is reported", () => {
    const shed = located(boxes, 'Shed');
    const data: HomeboxData = {
      ...boxes,
      entities: new Map(
        [...boxes.entities].map(([id, e]) => [
          id,
          id === shed ? { ...e, description: 'Behind the garage' } : e,
        ]),
      ),
    };
    const plan = planHomebox(data, choices(data), lookups());
    expect(issuesOf(plan, shed)).toEqual(['hb_place_notes_dropped']);
    expect(issuesOf(planHomebox(boxes, choices(boxes), lookups()), shed)).toEqual([]);
  });

  it('every flagged row of the boxes backup says why, and names no internal key', () => {
    const chosen = [...boxes.entities.values()]
      .filter((e) => /^Box /.test(e.name))
      .map((e) => e.id);
    const plan = planHomebox(
      boxes,
      choices(boxes, {
        zeroQuantity: 'keep_or_archive',
        boxes: chosen,
        types: { [itemType(boxes)]: { none: true } },
      }),
      lookups(),
    );
    for (const row of plan.report.rows) {
      expect(row.issues.length).toBeGreaterThan(0);
      for (const issue of row.issues) expect(issue.message).not.toBe(issue.code);
    }
    expect(JSON.stringify(plan.report)).not.toContain('global.');
  });
});

describe('quantity 0 applies to Homebox items only', () => {
  it('a location that becomes a thing comes in at 1, in use, with no note', () => {
    // The Bits tray is a location inside the Toolbox; locations carry quantity 0 in the export.
    const tray = idOf(home, 'Bits tray');
    expect(home.entities.get(tray)?.quantity).toBe(0);
    for (const zeroQuantity of ['keep_or_archive', 'one', 'skip'] as const) {
      const plan = planHomebox(home, choices(home, { zeroQuantity }), lookups());
      const op = thing(plan.ops, 'Bits tray');
      expect(op).toMatchObject({ quantity: 1, archived: false });
      expect(op.notes ?? '').not.toContain('Quantity in Homebox');
      expect(issuesOf(plan, tray)).toEqual(['hb_location_in_item']);
    }
  });

  it('a chosen box suggestion comes in at 1, in use, with no note', async () => {
    const boxes = await read('homebox-0.27.0-boxes.zip');
    const box = [...boxes.entities.values()].find((e) => e.name === 'Box 05');
    if (!box) throw new Error('no Box 05');
    const plan = planHomebox(
      boxes,
      choices(boxes, { zeroQuantity: 'keep_or_archive', boxes: [box.id] }),
      lookups(),
    );
    const op = thing(plan.ops, 'Box 05');
    expect(op).toMatchObject({ quantity: 1, archived: false });
    expect(op.notes ?? '').not.toContain('Quantity in Homebox');
  });

  it('an item at 0 that holds things stays in use at 1, with the note, never archived or left out', () => {
    // Toolbox holds the drill and the tray, and has quantity 0 (made through the API).
    const toolbox = idOf(home, 'Toolbox');
    expect(home.entities.get(toolbox)?.quantity).toBe(0);
    const kept = planHomebox(home, choices(home, { zeroQuantity: 'keep_or_archive' }), lookups());
    const op = thing(kept.ops, 'Toolbox');
    expect(op).toMatchObject({ quantity: 1, archived: false });
    expect(op.notes).toContain('Quantity in Homebox: 0');
    expect(issuesOf(kept, toolbox)).toContain('hb_quantity_zero');
    expect(issuesOf(kept, toolbox)).not.toContain('hb_quantity_zero_archived');
    // Its contents stay inside it (the drill, at 0 itself, is archived in its box).
    expect(thing(kept.ops, 'Cordless drill').where).toEqual({ container: { key: toolbox } });
    const skip = planHomebox(home, choices(home, { zeroQuantity: 'skip' }), lookups());
    expect(thing(skip.ops, 'Toolbox')).toMatchObject({ quantity: 1, archived: false });
    // The drill, at 0 and holding nothing, is left out; the tray stays in the Toolbox.
    expect(things(skip.ops).map((t) => t.name)).not.toContain('Cordless drill');
    expect(thing(skip.ops, 'Bits tray').where).toEqual({ container: { key: toolbox } });
  });
});

describe('inspectHomebox: what the choices step offers', () => {
  it('counts the prices, lists the locations that look like boxes and names the catch-all type', async () => {
    const boxes = await read('homebox-0.27.0-boxes.zip');
    const mapping = inspectHomebox(boxes, null).collections[0]?.mapping;
    // Twelve items with a price (the rowing machine sold, too) and one service with a cost.
    expect(mapping?.prices).toBe(13);
    expect(mapping?.zeroItems).toBe(8);
    // What needs a module beyond Essentials: priced items, items with a warranty, maintenance.
    expect(mapping?.pricedItems).toBe(12);
    expect(mapping?.warrantyItems).toBe(5);
    expect(mapping?.maintenance).toBe(2);
    const found = mapping?.boxes ?? [];
    expect(found.map((b) => b.name).sort()).toEqual([
      'Bin 1',
      'Bin 2',
      ...Array.from({ length: 12 }, (_, i) => `Box ${String(i + 1).padStart(2, '0')}`),
    ]);
    expect(found.find((b) => b.name === 'Box 01')).toMatchObject({ path: ['Garage'], items: 2 });
    expect(found.find((b) => b.name === 'Bin 2')).toMatchObject({
      path: ['Basement', 'Shelf C'],
      items: 1,
    });
    // Shelf C holds Bin 1 and 2, so it's no box; the lure tray is inside an item already.
    expect(found.map((b) => b.name)).not.toContain('Lure tray');
    const item = [...boxes.types.values()].find((t) => t.name === 'global.item')?.id;
    expect(mapping?.catchAll).toBe(item);
  });

  it('names no catch-all for a backup whose types are its own, and no prices when there are none', async () => {
    const family = await read('family');
    const mapping = inspectHomebox(family, null).collections[0]?.mapping;
    expect(mapping?.boxes).toEqual([]);
    expect(mapping?.catchAll).toBeNull();
    const free: HomeboxData = {
      ...family,
      entities: new Map(
        [...family.entities].map(([id, e]) => [id, { ...e, purchase_price: 0, sold_price: 0 }]),
      ),
      maintenance: family.maintenance.map((m) => ({ ...m, cost: 0 })),
    };
    expect(inspectHomebox(free, null).collections[0]?.mapping?.prices).toBe(0);
    const homeMapping = inspectHomebox(home, null).collections[0]?.mapping;
    // Appliance holds the most items, but it is a real type: only Homebox's own `global.item` is one.
    expect(homeMapping?.catchAll).toBeNull();
  });
});
