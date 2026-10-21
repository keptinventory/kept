/**
 * A scan session on the phone, without a camera or a store: what each read means in each mode,
 * once per session, the summary and its defaults, and the ops that save it.
 */
import { type Role, SCAN_SESSION_LIMITS } from '@kept/shared';
import { describe, expect, it } from 'vitest';
import type { Resolution } from '../resolve';
import {
  addRead,
  checkArea,
  counter,
  type ExpectedThing,
  finishNeedsConnection,
  linesOf,
  mergeOthers,
  newSession,
  type ReadInfo,
  readKey,
  resolveLater,
  type Session,
  type SessionTarget,
  sessionOps,
  setQuantity,
  setTarget,
  summarise,
  undoLast,
} from './model';

const HOME = 'aaaaaaaa-0000-7000-8000-000000000001';
const GARAGE = 'aaaaaaaa-0000-7000-8000-000000000002';
const COTTAGE = 'aaaaaaaa-0000-7000-8000-000000000003';
const STUDY = 'bbbbbbbb-0000-7000-8000-000000000001';
const KITCHEN = 'bbbbbbbb-0000-7000-8000-000000000002';
const BOX = 'cccccccc-0000-7000-8000-000000000099';

let n = 0;
const uuid = () => `dddddddd-0000-7000-8000-${String(++n).padStart(12, '0')}`;

function thing(over: Partial<ExpectedThing> = {}): ExpectedThing {
  const id = uuid();
  return {
    id,
    locationId: HOME,
    name: `Thing ${n}`,
    shortCode: `K${String(n).padStart(5, '0')}`.slice(0, 6),
    placeId: STUDY,
    containerId: null,
    isContainer: false,
    ...over,
  };
}

const roles =
  (map: Record<string, Role>) =>
  (locationId: string): Role | null =>
    map[locationId] ?? null;
const member = roles({ [HOME]: 'member', [GARAGE]: 'viewer', [COTTAGE]: 'owner' });

const open = (t: { id: string; locationId: string }, kind: 'thing' | 'place' = 'thing') => ({
  res: {
    outcome: 'open',
    target: { kind, id: t.id, locationId: t.locationId },
    code: null,
    legacy: null,
    from: 'phone',
  } as Resolution,
});
const answer = (res: Resolution): ReadInfo => ({ res });

const study: SessionTarget = {
  kind: 'place',
  id: STUDY,
  locationId: HOME,
  name: 'Study',
  inside: true,
};
const AT = '2026-10-20T10:00:00.000Z';

function counting(expected: ExpectedThing[], over: Partial<Parameters<typeof newSession>[0]> = {}) {
  return newSession({
    mode: 'count',
    target: study,
    role: 'member',
    expected,
    now: AT,
    ...over,
  });
}

function read(s: Session, text: string, info: ReadInfo, r = member, format?: string) {
  return addRead(s, { text, ...(format ? { format } : {}), at: AT }, info, r);
}

describe('a count', () => {
  it('counts a thing on the expected list once, and a second read of it softly', () => {
    const lamp = thing();
    const mug = thing();
    let s = counting([lamp, mug]);
    expect(counter(s)).toMatchObject({ found: 0, expected: 2 });
    const first = read(s, `https://kept.example/l/${lamp.shortCode}`, open(lamp));
    expect(first.kind).toBe('found');
    s = first.session;
    expect(counter(s)).toMatchObject({ found: 1, expected: 2 });
    const again = read(s, lamp.shortCode as string, open(lamp));
    expect(again.kind).toBe('already');
    expect(again.session.reads).toHaveLength(1);
  });

  it('knows a code it has read already before resolving it again', () => {
    const lamp = thing();
    const s = read(counting([lamp]), lamp.shortCode as string, open(lamp)).session;
    expect(s.keys).toContain(readKey(lamp.shortCode as string));
    expect(readKey(`https://other.example/l/${lamp.shortCode}`)).toBe(
      readKey(lamp.shortCode as string),
    );
  });

  it('marks a thing of this location found somewhere else as elsewhere, and another location’s as such', () => {
    const away = thing({ placeId: KITCHEN });
    const cottage = thing({ locationId: COTTAGE });
    let s = counting([thing()]);
    const a = read(s, 'AWAY01', open(away));
    expect(a.kind).toBe('elsewhere');
    s = a.session;
    expect(read(s, 'COTT01', open(cottage)).kind).toBe('other_location');
  });

  it('shows a thing in a location you only view as view only, and saves nothing of it', () => {
    const garage = thing({ locationId: GARAGE });
    const r = read(counting([thing()]), 'GARA01', open(garage));
    expect(r.kind).toBe('view_only');
    expect(summarise(r.session).found).toEqual([]);
  });

  it('lets a viewer check: the same totals, nothing to save', () => {
    const lamp = thing();
    let s = counting([lamp, thing()], { role: 'viewer' });
    expect(s.checkOnly).toBe(true);
    s = read(s, 'LAMP01', open(lamp), roles({ [HOME]: 'viewer' })).session;
    expect(counter(s)).toMatchObject({ found: 1, expected: 2 });
    expect(linesOf(s, summarise(s), {}, AT)).toEqual([]);
  });

  it('offers to count a place read during a count, and ignores the target’s own label', () => {
    const kitchen = { id: KITCHEN, locationId: HOME };
    const r = read(counting([thing()]), 'KITC01', open(kitchen, 'place'));
    expect(r.kind).toBe('place');
    const own = read(counting([thing()]), 'STUD01', open({ id: STUDY, locationId: HOME }, 'place'));
    expect(own.kind).toBe('target');
    expect(own.session.reads).toEqual([]);
  });

  it('counts a box as a thing; with contents counted, what is inside it is found too', () => {
    const box = thing({ id: BOX, isContainer: true });
    const inside = thing({ containerId: BOX, placeId: null, shortCode: null });
    const plain = counting([box, inside]);
    expect(counter(read(plain, 'BOX001', open(box)).session)).toMatchObject({
      found: 1,
      expected: 2,
    });
    const withContents = counting([box, inside], { contents: true });
    expect(counter(read(withContents, 'BOX001', open(box)).session)).toMatchObject({
      found: 2,
      expected: 2,
    });
  });

  it('matches a product barcode against the expected list, once; a repeat is ignored', () => {
    const kettle = thing({ barcode: '5901234123457' });
    let s = counting([kettle, thing()]);
    const bc = { outcome: 'barcode', code: '5901234123457', lookupEnabled: null } as Resolution;
    const first = read(s, '5901234123457', answer(bc), member, 'ean_13');
    expect(first.kind).toBe('found');
    s = first.session;
    expect(read(s, '5901234123457', answer(bc), member, 'ean_13').kind).toBe('ignored');
    const other = read(
      s,
      '4006381333931',
      answer({ outcome: 'barcode', code: '4006381333931', lookupEnabled: null }),
      member,
      'ean_13',
    );
    expect(other.kind).toBe('unmatched');
  });

  it('takes the candidate on the expected list when a code matches several things', () => {
    const kettle = thing();
    const res = {
      outcome: 'legacy_ambiguous',
      legacy: '5901234123457',
      candidates: [
        { kind: 'thing', id: uuid(), name: 'Spare', locationName: 'Cottage', locationId: COTTAGE },
        { kind: 'thing', id: kettle.id, name: 'Kettle', locationName: 'Home', locationId: HOME },
      ],
    } as Resolution;
    expect(read(counting([kettle]), '5901234123457', answer(res)).kind).toBe('found');
    expect(read(counting([thing()]), '5901234123457', answer(res)).kind).toBe('unmatched');
  });

  it('keeps blank labels, unknown codes and offline unknowns for the end; ignores anything else', () => {
    const s = counting([thing()]);
    const blank = {
      outcome: 'claim',
      code: 'BLNK01',
      locationId: HOME,
      from: 'phone',
    } as Resolution;
    expect(read(s, 'BLNK01', answer(blank)).kind).toBe('unmatched');
    expect(read(s, 'GONE01', answer({ outcome: 'not_in_your_kept', code: 'GONE01' })).kind).toBe(
      'not_in_your_kept',
    );
    expect(
      read(s, 'LATE01', answer({ outcome: 'not_on_phone', text: 'LATE01', code: 'LATE01' })).kind,
    ).toBe('check_later');
    expect(read(s, 'hello', answer({ outcome: 'not_kept', text: 'hello' })).kind).toBe('ignored');
  });

  it('answers a code read offline once online, in its place in the walk', () => {
    const lamp = thing();
    const mug = thing();
    let s = counting([lamp, mug]);
    s = read(
      s,
      'LATE01',
      answer({ outcome: 'not_on_phone', text: 'LATE01', code: 'LATE01' }),
    ).session;
    s = read(s, 'MUG001', open(mug)).session;
    expect(counter(s).found).toBe(1);
    const key = s.reads[0]?.key as string;
    s = resolveLater(s, key, open(lamp), member);
    expect(s.reads.map((r) => [r.kind, r.thingId])).toEqual([
      ['found', lamp.id],
      ['found', mug.id],
    ]);
    expect(counter(s).found).toBe(2);
  });

  it('undoes the last read', () => {
    const lamp = thing();
    const s = read(counting([lamp]), 'LAMP01', open(lamp)).session;
    const back = undoLast(s);
    expect(back.reads).toEqual([]);
    expect(counter(back).found).toBe(0);
    expect(read(back, 'LAMP01', open(lamp)).kind).toBe('found');
  });

  it('sums up: found, missing (left alone unless chosen), no label, elsewhere, unmatched', () => {
    const lamp = thing();
    const missing = thing();
    const noLabel = thing({ shortCode: null });
    const away = thing({ placeId: KITCHEN });
    const cottage = thing({ locationId: COTTAGE });
    let s = counting([lamp, missing, noLabel]);
    s = read(s, 'LAMP01', open(lamp)).session;
    s = read(s, 'AWAY01', open(away)).session;
    s = read(s, 'COTT01', open(cottage)).session;
    s = read(
      s,
      'BLNK01',
      answer({ outcome: 'claim', code: 'BLNK01', locationId: HOME, from: 'phone' }),
    ).session;
    const sum = summarise(s);
    expect(sum.found.map((r) => r.thingId)).toEqual([lamp.id]);
    expect(sum.missing.map((x) => x.id)).toEqual([missing.id]);
    expect(sum.noLabel.map((x) => x.id)).toEqual([noLabel.id]);
    expect(sum.elsewhere.map((r) => r.thingId)).toEqual([away.id]);
    expect(sum.otherLocation.map((r) => r.thingId)).toEqual([cottage.id]);
    expect(sum.unmatched.map((r) => r.text)).toEqual(['BLNK01']);

    // Defaults: missing and elsewhere are left alone, and kept as results.
    expect(linesOf(s, sum, {}, AT)).toEqual([
      { thingId: lamp.id, readAt: AT, action: 'seen' },
      { thingId: missing.id, readAt: AT, action: 'missing' },
      { thingId: away.id, readAt: AT, action: 'elsewhere' },
    ]);
    const chosen = linesOf(
      s,
      sum,
      { notHere: [missing.id], moveHere: [away.id, cottage.id], ticked: [noLabel.id] },
      '2026-10-20T11:00:00.000Z',
    );
    expect(chosen).toEqual([
      { thingId: lamp.id, readAt: AT, action: 'seen' },
      { thingId: noLabel.id, readAt: '2026-10-20T11:00:00.000Z', action: 'seen' },
      { thingId: away.id, readAt: AT, action: 'move', to: { placeId: STUDY } },
      { thingId: cottage.id, readAt: AT, action: 'move', to: { placeId: STUDY } },
      { thingId: missing.id, readAt: '2026-10-20T11:00:00.000Z', action: 'not_here' },
    ]);
  });

  it('moves another location’s thing here only when both can be edited', () => {
    const garage = thing({ locationId: GARAGE });
    let s = counting([thing()]);
    s = read(s, 'GAR001', open(garage), roles({ [HOME]: 'member', [GARAGE]: 'owner' })).session;
    const sum = summarise(s);
    expect(sum.otherLocation[0]?.canMove).toBe(true);
    const viewerThere = summarise(
      read(
        counting([thing()]),
        'GAR001',
        open(garage),
        roles({ [HOME]: 'member', [GARAGE]: 'member' }),
      ).session,
      roles({ [HOME]: 'member', [GARAGE]: 'viewer' }),
    );
    expect(viewerThere.otherLocation.every((r) => !r.canMove)).toBe(true);
  });
});

describe('a count keeps every result', () => {
  const SHELF = 'bbbbbbbb-0000-7000-8000-000000000003';
  const areas = [
    { id: STUDY, name: 'Study' },
    { id: SHELF, name: 'Back shelf' },
  ];

  it('never calls a thing lent out or in repair missing: their own groups', () => {
    const lamp = thing();
    const drill = thing({
      derived: ['lent'],
      loan: { direction: 'out', personName: 'Murdock', dueOn: null },
    });
    const tv = thing({ derived: ['in_repair'] });
    const gone = thing();
    let s = counting([lamp, drill, tv, gone]);
    s = read(s, 'LAMP01', open(lamp)).session;
    const sum = summarise(s);
    expect(sum.missing.map((x) => x.id)).toEqual([gone.id]);
    expect(sum.lent).toEqual([{ person: 'Murdock', things: [drill] }]);
    expect(sum.inRepair.map((x) => x.id)).toEqual([tv.id]);
    expect(linesOf(s, sum, {}, AT).map((l) => [l.thingId, l.action])).toEqual([
      [lamp.id, 'seen'],
      [gone.id, 'missing'],
      [drill.id, 'on_loan'],
      [tv.id, 'in_repair'],
    ]);
  });

  it('calls an area with no read not counted, until "I checked it"', () => {
    const lamp = thing({ placeId: STUDY });
    const book = thing({ placeId: SHELF });
    const box = thing({ placeId: SHELF, isContainer: true, shortCode: null });
    const inBox = thing({ placeId: null, containerId: box.id });
    let s = counting([lamp, book, box, inBox], { areas });
    s = read(s, 'LAMP01', open(lamp)).session;
    let sum = summarise(s);
    expect(sum.missing).toEqual([]);
    expect(sum.notCounted).toEqual([{ area: areas[1], things: [book, inBox] }]);
    expect(sum.counted).toEqual([STUDY]);
    const ops = sessionOps(s, linesOf(s, sum, {}, AT), {
      contentsSeen: false,
      counted: sum.counted,
    });
    expect(ops[0]?.payload).toMatchObject({ session: { countedPlaceIds: [STUDY] } });
    const sent = (ops[0]?.payload ?? { lines: [] }) as {
      lines: { thingId: string; action: string }[];
    };
    expect(sent.lines.filter((l) => l.action === 'not_counted').map((l) => l.thingId)).toEqual([
      book.id,
      inBox.id,
    ]);

    s = checkArea(s, SHELF);
    sum = summarise(s);
    expect(sum.notCounted).toEqual([]);
    expect(sum.missing.map((x) => x.id)).toEqual([book.id, inBox.id]);
    expect([...sum.counted].sort()).toEqual([STUDY, SHELF].sort());
  });

  it('counts a thing in number: its whole quantity once read, +/−, the rest not here when chosen', () => {
    const tins = thing({ quantity: '6' });
    let s = counting([tins]);
    s = read(s, 'TINS01', open(tins)).session;
    expect(summarise(s).short).toEqual([]);
    expect(linesOf(s, summarise(s), {}, AT)).toEqual([
      { thingId: tins.id, readAt: AT, action: 'seen' },
    ]);
    s = setQuantity(s, tins.id, 4);
    s = setQuantity(s, tins.id, 0); // never below 1
    s = setQuantity(s, tins.id, 2);
    const sum = summarise(s);
    expect(sum.short.map((x) => [x.found, x.of])).toEqual([['2', '6']]);
    expect(linesOf(s, sum, {}, AT)).toEqual([
      { thingId: tins.id, readAt: AT, action: 'seen', quantity: '2' },
    ]);
    expect(linesOf(s, sum, { restNotHere: [tins.id] }, AT)).toEqual([
      { thingId: tins.id, readAt: AT, action: 'seen', quantity: '2', short: 'not_here' },
    ]);
    // Back to all of them.
    expect(summarise(setQuantity(s, tins.id, 9)).short).toEqual([]);
  });

  it('merges what others read in a shared count, and then needs a connection to finish', () => {
    const lamp = thing({ placeId: STUDY });
    const book = thing({ placeId: SHELF });
    const pen = thing({ placeId: SHELF });
    let s = counting([lamp, book, pen], { areas });
    s = { ...s, shared: { joined: true, by: 'Louis', others: [], counted: [] } };
    expect(finishNeedsConnection(s)).toBe(true);
    s = read(s, 'LAMP01', open(lamp)).session;
    s = mergeOthers(
      s,
      [
        { thingId: book.id, action: 'seen', readBy: 'Louis', foundQty: null },
        { thingId: lamp.id, action: 'missing', readBy: 'Louis', foundQty: null },
      ],
      [SHELF],
      null,
    );
    const sum = summarise(s);
    expect(sum.byOthers.map((x) => [x.id, x.readBy])).toEqual([[book.id, 'Louis']]);
    // The shelf was counted by Louis: the pen is missing, not "not counted".
    expect(sum.missing.map((x) => x.id)).toEqual([pen.id]);
    expect(counter(s).found).toBe(2);
    // What Louis found isn't sent again.
    expect(linesOf(s, sum, {}, AT).map((l) => l.thingId)).toEqual([lamp.id, pen.id]);
  });
});

describe('pack and move', () => {
  const box14: SessionTarget = { kind: 'container', id: BOX, locationId: HOME, name: 'Box 14' };
  const packing = () =>
    newSession({ mode: 'pack', target: box14, role: 'member', expected: [], now: AT });

  it('adds every thing read to the current box, and switches box by scanning the next one', () => {
    const plates = thing();
    const box15 = thing({ isContainer: true, name: 'Box 15' });
    const cups = thing();
    let s = packing();
    const a = read(s, 'PLAT01', open(plates));
    expect(a.kind).toBe('found');
    s = a.session;
    s = setTarget(s, { kind: 'container', id: box15.id, locationId: HOME, name: 'Box 15' });
    s = read(s, 'CUPS01', open(cups)).session;
    expect(s.reads.map((r) => r.to)).toEqual([{ containerId: BOX }, { containerId: box15.id }]);
    expect(linesOf(s, summarise(s), {}, AT)).toEqual([
      { thingId: plates.id, readAt: AT, action: 'move', to: { containerId: BOX } },
      { thingId: cups.id, readAt: AT, action: 'move', to: { containerId: box15.id } },
    ]);
    expect(summarise(s).byTarget.map((g) => [g.target.id, g.reads.length])).toEqual([
      [BOX, 1],
      [box15.id, 1],
    ]);
  });

  it('packs a box read without choosing it as the target into the current one', () => {
    const inner = thing({ isContainer: true });
    expect(read(packing(), 'INNR01', open(inner)).kind).toBe('found');
  });

  it('refuses a place, ignores the box itself, and greys what you can’t edit', () => {
    expect(read(packing(), 'KITC01', open({ id: KITCHEN, locationId: HOME }, 'place')).kind).toBe(
      'place',
    );
    expect(read(packing(), 'BOX014', open({ id: BOX, locationId: HOME })).kind).toBe('target');
    expect(read(packing(), 'GAR001', open(thing({ locationId: GARAGE }))).kind).toBe('view_only');
  });

  it('moves to a place, across locations where both can be edited', () => {
    const s = newSession({
      mode: 'move',
      target: { kind: 'place', id: KITCHEN, locationId: HOME, name: 'Kitchen' },
      role: 'member',
      expected: [],
      now: AT,
    });
    const r = read(s, 'COTT01', open(thing({ locationId: COTTAGE })));
    expect(r.kind).toBe('found');
    expect(r.session.reads[0]?.to).toEqual({ placeId: KITCHEN });
  });
});

describe('saving', () => {
  it('saves 1,201 lines as three line ops and a finish that depends on them', () => {
    const things = Array.from({ length: 1201 }, () => thing());
    let s = counting(things);
    for (const t of things) s = read(s, t.shortCode as string, open(t)).session;
    const sum = summarise(s);
    const lines = linesOf(s, sum, {}, AT);
    const ops = sessionOps(s, lines, { contentsSeen: false });
    expect(ops.map((o) => [o.op, (o.payload as { lines?: unknown[] }).lines?.length])).toEqual([
      ['scan_session_lines', 500],
      ['scan_session_lines', 500],
      ['scan_session_lines', 201],
      ['scan_session_finish', undefined],
    ]);
    const finish = ops.at(-1);
    expect(finish?.dependsOn).toEqual(ops.slice(0, 3).map((o) => o.idempotencyKey));
    expect(finish?.payload).toEqual({ sessionId: s.id, expected: 1201, contentsSeen: false });
    expect(ops.every((o) => o.locationId === HOME)).toBe(true);
    expect(ops[0]).toMatchObject({
      payload: {
        session: {
          id: s.id,
          mode: 'count',
          target: { placeId: STUDY, inside: true },
          startedAt: AT,
        },
      },
    });
  });

  it('refuses a read past 5,000 labels, and says so from 4,500', () => {
    let s = counting([]);
    const many = Array.from({ length: SCAN_SESSION_LIMITS.labels }, () =>
      thing({ locationId: HOME, placeId: KITCHEN }),
    );
    s = {
      ...s,
      reads: many.slice(0, SCAN_SESSION_LIMITS.warnAt - 1).map((t) => ({
        key: `k:${t.id}`,
        text: t.id,
        at: AT,
        kind: 'elsewhere' as const,
        thingId: t.id,
        locationId: HOME,
      })),
    };
    expect(counter(s).nearlyFull).toBe(false);
    s = read(s, 'NEAR01', open(many[SCAN_SESSION_LIMITS.warnAt] as ExpectedThing)).session;
    expect(counter(s).nearlyFull).toBe(true);
    s = {
      ...s,
      reads: many.map((t) => ({
        key: `k:${t.id}`,
        text: t.id,
        at: AT,
        kind: 'elsewhere' as const,
        thingId: t.id,
        locationId: HOME,
      })),
    };
    expect(read(s, 'FULL01', open(thing())).kind).toBe('full');
  });
});
