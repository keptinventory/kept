import { describe, expect, it } from 'vitest';
import { newId } from './ids.js';
import {
  DROP_REASONS,
  MIN_PAYLOAD_VERSION,
  OP_KINDS,
  OP_SCHEMAS,
  OUTCOMES,
  PAYLOAD_VERSION,
  PayloadVersionError,
  parseOpPayload,
  payloadVersionStatus,
  QueueItemSchema,
  SCAN_SESSION_LIMITS,
  ScanSessionFinishPayload,
  SyncOpsRequestSchema,
  upgradePayload,
} from './sync.js';

const id = () => newId();

const item = (over: Record<string, unknown> = {}) => ({
  clientVersion: '0.3.0',
  payloadVersion: 1,
  clientId: id(),
  idempotencyKey: 'k-1',
  op: 'mark_seen',
  takenAt: '2026-09-26T10:00:00+03:00',
  locationId: id(),
  payload: { thingId: id() },
  ...over,
});

describe('constants', () => {
  it('match the plan and D148', () => {
    expect(PAYLOAD_VERSION).toBe(1);
    expect(MIN_PAYLOAD_VERSION).toBe(1);
    expect(OP_KINDS).toEqual([
      'create_thing',
      'move',
      'log_reading',
      'claim_label',
      'mark_seen',
      'not_here',
      'create_area',
      'box_check',
      'move_box',
      'move_box_room',
      'scan_session_lines',
      'scan_session_finish',
    ]);
    expect(OUTCOMES).toEqual(['applied', 'needs_review', 'dropped']);
    expect(DROP_REASONS).toContain('parent_dropped');
    expect(DROP_REASONS).toContain('location_revoked');
    expect(Object.keys(OP_SCHEMAS).sort()).toEqual([...OP_KINDS].sort());
  });
});

describe('QueueItemSchema', () => {
  it('accepts a well-formed item and an optional dependsOn', () => {
    expect(QueueItemSchema.safeParse(item()).success).toBe(true);
    expect(QueueItemSchema.safeParse(item({ dependsOn: ['k-0'] })).success).toBe(true);
  });

  it('rejects an unknown op, a bad takenAt and a non-uuid clientId', () => {
    expect(QueueItemSchema.safeParse(item({ op: 'delete_everything' })).success).toBe(false);
    expect(QueueItemSchema.safeParse(item({ takenAt: 'yesterday' })).success).toBe(false);
    expect(QueueItemSchema.safeParse(item({ clientId: 'abc' })).success).toBe(false);
    expect(QueueItemSchema.safeParse(item({ payloadVersion: 1.5 })).success).toBe(false);
  });

  it('bounds a batch to 1–50 ops', () => {
    const one = { clientVersion: '0.3.0', ops: [item()] };
    expect(SyncOpsRequestSchema.safeParse(one).success).toBe(true);
    expect(SyncOpsRequestSchema.safeParse({ ...one, ops: [] }).success).toBe(false);
    const many = Array.from({ length: 51 }, () => item());
    expect(SyncOpsRequestSchema.safeParse({ ...one, ops: many }).success).toBe(false);
  });
});

describe('op payloads (v1)', () => {
  const ok = (op: (typeof OP_KINDS)[number], payload: unknown) =>
    expect(parseOpPayload(op, payload).success, JSON.stringify(payload)).toBe(true);
  const bad = (op: (typeof OP_KINDS)[number], payload: unknown) =>
    expect(parseOpPayload(op, payload).success, JSON.stringify(payload)).toBe(false);

  it('create_thing: a room capture carries the Kept codes read in its photos', () => {
    const base = {
      id: id(),
      mode: 'room',
      batchId: id(),
      target: { placeId: id() },
      files: [1, 2, 3].map(() => ({ fileId: id(), role: 'photo' })),
    };
    ok('create_thing', base);
    ok('create_thing', { ...base, codes: ['K7D2QX', 'AB1100'] });
    bad('create_thing', { ...base, codes: ['nope'] });
    bad('create_thing', { ...base, codes: Array.from({ length: 61 }, () => 'K7D2QX') });
  });

  it('create_thing: one of three targets, files, and optional fields', () => {
    const base = {
      id: id(),
      mode: 'thing',
      batchId: id(),
      files: [{ fileId: id(), role: 'photo' }],
    };
    ok('create_thing', { ...base, target: { placeId: id() } });
    ok('create_thing', { ...base, target: { containerId: id() } });
    ok('create_thing', { ...base, target: { unplaced: true }, name: 'Drill', quantity: '2' });
    ok('create_thing', {
      ...base,
      target: { placeId: id() },
      mode: 'label',
      files: [{ fileId: id(), role: 'photo', displayFileId: id() }],
      attachToThingId: id(),
      barcode: '4006381333931',
      claimCode: 'AB1100',
    });
    ok('create_thing', {
      ...base,
      target: { placeId: id() },
      mode: 'receipt',
      files: [{ fileId: id(), role: 'receipt', displayFileId: id() }],
      pageOf: id(),
      note: 'Paid in cash',
    });
    ok('create_thing', {
      ...base,
      target: { placeId: id() },
      files: [{ fileId: id(), role: 'photo', sha256: 'a'.repeat(64) }],
    });
    bad('create_thing', {
      ...base,
      target: { placeId: id() },
      files: [{ fileId: id(), role: 'photo', sha256: 'A'.repeat(64) }],
    });
    bad('create_thing', { ...base, target: { placeId: id() }, pageOf: 'not-a-uuid' });
    bad('create_thing', { ...base, target: { placeId: id() }, note: '   ' });
    bad('create_thing', { ...base, target: { placeId: id(), containerId: id() } });
    bad('create_thing', { ...base, target: { unplaced: false } });
    bad('create_thing', { ...base, target: { placeId: id() }, mode: 'video' });
    bad('create_thing', { ...base, target: { placeId: id() }, quantity: '-1' });
    bad('create_thing', { ...base, target: { placeId: id() }, claimCode: 'ABC' });
    bad('create_thing', {
      ...base,
      target: { placeId: id() },
      files: [{ fileId: id(), role: 'selfie' }],
    });
  });

  it('move: at most 200 things, to a place or container', () => {
    ok('move', { thingIds: [id()], to: { placeId: id() } });
    ok('move', { thingIds: [id()], to: { containerId: id() }, quantity: '1.5' });
    bad('move', { thingIds: [], to: { placeId: id() } });
    bad('move', { thingIds: Array.from({ length: 201 }, id), to: { placeId: id() } });
    bad('move', { thingIds: [id()], to: { unplaced: true } });
    bad('move', { thingIds: [id()], to: { placeId: id() }, quantity: '0' });
  });

  it('log_reading: a decimal string value and a takenAt', () => {
    ok('log_reading', { id: id(), meterId: id(), value: '10500', takenAt: '2026-09-25T08:00:00Z' });
    ok('log_reading', {
      id: id(),
      meterId: id(),
      value: '10500.4',
      takenAt: '2026-09-25T08:00:00Z',
      note: 'after the trip',
      proofFileId: id(),
    });
    bad('log_reading', { id: id(), meterId: id(), value: 10500, takenAt: '2026-09-25T08:00:00Z' });
    bad('log_reading', { id: id(), meterId: id(), value: '1e4', takenAt: '2026-09-25T08:00:00Z' });
  });

  it('claim_label: a thing, a place or a new container', () => {
    ok('claim_label', { code: 'AB1100', target: { thingId: id() } });
    ok('claim_label', { code: 'AB1100', target: { placeId: id() } });
    ok('claim_label', {
      code: 'AB1100',
      target: { newContainer: { id: id(), name: 'Camping box', placeId: id() } },
    });
    ok('claim_label', {
      code: 'AB1100',
      target: { newContainer: { id: id(), name: 'Camping box', containerId: id() } },
    });
    bad('claim_label', {
      code: 'AB1100',
      target: { newContainer: { id: id(), name: 'Box', placeId: id(), containerId: id() } },
    });
    bad('claim_label', { code: 'ab1lo0', target: { thingId: id() } });
    bad('claim_label', { code: 'AB1100', target: { newContainer: { id: id(), name: '' } } });
  });

  it('mark_seen, not_here, create_area, box_check', () => {
    ok('mark_seen', { thingId: id() });
    ok('not_here', { thingId: id() });
    bad('mark_seen', {});
    ok('create_area', { id: id(), parentId: null, name: 'Garage', kindKey: 'room' });
    ok('create_area', { id: id(), parentId: id(), name: 'Shelf A', kindKey: 'zone' });
    bad('create_area', { id: id(), parentId: null, name: 'Garage', kindKey: 'Room!' });
    bad('create_area', { id: id(), name: 'Garage', kindKey: 'room' });
    ok('box_check', {
      id: id(),
      containerId: id(),
      lines: [{ thingId: id(), expectedQty: '3', foundQty: '2' }],
      foundElsewhereIds: [id()],
    });
    ok('box_check', {
      id: id(),
      containerId: id(),
      lines: [{ thingId: id(), expectedQty: '1', foundQty: '0' }],
    });
    bad('box_check', {
      id: id(),
      containerId: id(),
      lines: [{ thingId: id(), expectedQty: '1', foundQty: '-1' }],
    });
  });

  it('move_box (D251): a state, and a room only to unpack into', () => {
    ok('move_box', { moveId: id(), containerId: id(), state: 'in_transit' });
    ok('move_box', { moveId: id(), containerId: id(), state: 'unpacked', placeId: id() });
    ok('move_box', { moveId: id(), containerId: id(), state: 'packed' });
    bad('move_box', { moveId: id(), containerId: id(), state: 'lost' });
    bad('move_box', { moveId: id(), state: 'packed' });
  });

  it('move_box_room (D251): the room a box goes to, never none', () => {
    ok('move_box_room', { moveId: id(), containerId: id(), placeId: id() });
    bad('move_box_room', { moveId: id(), containerId: id(), placeId: null });
    bad('move_box_room', { moveId: id(), containerId: id() });
    bad('move_box_room', { moveId: id(), containerId: id(), placeId: id(), state: 'packed' });
  });

  it('refuses unknown keys, so a typo is invalid rather than ignored', () => {
    bad('mark_seen', { thingId: id(), extra: 1 });
  });
});

describe('scan session ops', () => {
  const ok = (op: (typeof OP_KINDS)[number], payload: unknown) =>
    expect(parseOpPayload(op, payload).success, JSON.stringify(payload)).toBe(true);
  const bad = (op: (typeof OP_KINDS)[number], payload: unknown) =>
    expect(parseOpPayload(op, payload).success, JSON.stringify(payload)).toBe(false);
  const at = '2026-10-20T10:00:00+03:00';
  const header = (mode: 'count' | 'pack' | 'move', target: Record<string, unknown>) => ({
    id: id(),
    mode,
    target,
    startedAt: at,
  });
  const lines = (n: number, line: (i: number) => Record<string, unknown>) =>
    Array.from({ length: n }, (_, i) => line(i));
  const lineOk = (mode: 'count' | 'pack' | 'move', target: Record<string, unknown>, l: unknown[]) =>
    parseOpPayload('scan_session_lines', { session: header(mode, target), lines: l }).success;

  it('a count: seen, not here, or moved here, for a place, a box or the whole location', () => {
    const seen = { thingId: id(), readAt: at, action: 'seen' };
    expect(lineOk('count', { placeId: id(), inside: true }, [seen])).toBe(true);
    expect(lineOk('count', { containerId: id() }, [seen])).toBe(true);
    expect(lineOk('count', { locationId: id() }, [seen])).toBe(true);
    expect(
      lineOk('count', { placeId: id(), inside: false }, [
        { thingId: id(), readAt: at, action: 'not_here' },
        { thingId: id(), readAt: at, action: 'move', to: { placeId: id() } },
      ]),
    ).toBe(true);
  });

  it('at most 500 lines an op, at least one, each thing once', () => {
    const line = () => ({ thingId: id(), readAt: at, action: 'seen' });
    expect(SCAN_SESSION_LIMITS.linesPerOp).toBe(500);
    expect(lineOk('count', { containerId: id() }, lines(500, line))).toBe(true);
    expect(lineOk('count', { containerId: id() }, lines(501, line))).toBe(false);
    expect(lineOk('count', { containerId: id() }, [])).toBe(false);
    const twice = id();
    expect(
      lineOk('count', { containerId: id() }, [
        { thingId: twice, readAt: at, action: 'seen' },
        { thingId: twice, readAt: at, action: 'not_here' },
      ]),
    ).toBe(false);
  });

  it('a move line names where it goes, and only a move line does', () => {
    expect(
      lineOk('count', { containerId: id() }, [{ thingId: id(), readAt: at, action: 'move' }]),
    ).toBe(false);
    expect(
      lineOk('count', { containerId: id() }, [
        { thingId: id(), readAt: at, action: 'seen', to: { placeId: id() } },
      ]),
    ).toBe(false);
  });

  it('pack and move only move; pack goes into boxes, and the whole location is a count only', () => {
    const into = { thingId: id(), readAt: at, action: 'move', to: { containerId: id() } };
    expect(lineOk('pack', { containerId: id() }, [into])).toBe(true);
    expect(lineOk('move', { placeId: id() }, [into])).toBe(true);
    expect(
      lineOk('pack', { containerId: id() }, [{ thingId: id(), readAt: at, action: 'seen' }]),
    ).toBe(false);
    expect(
      lineOk('pack', { containerId: id() }, [
        { thingId: id(), readAt: at, action: 'move', to: { placeId: id() } },
      ]),
    ).toBe(false);
    expect(lineOk('pack', { placeId: id() }, [into])).toBe(false);
    expect(lineOk('move', { locationId: id() }, [into])).toBe(false);
  });

  it('a count keeps what it found missing, elsewhere, away or not counted, applying none of it', () => {
    const informational = [
      'missing',
      'elsewhere',
      'on_loan',
      'in_repair',
      'trashed',
      'not_counted',
    ];
    for (const action of informational) {
      expect(
        lineOk('count', { placeId: id(), inside: true }, [{ thingId: id(), readAt: at, action }]),
      ).toBe(true);
      // Results of a count only, and never with a place to go.
      expect(
        lineOk('move', { placeId: id() }, [
          { thingId: id(), readAt: at, action, to: { placeId: id() } },
        ]),
      ).toBe(false);
    }
  });

  it('a seen line may say how many were found, and that the rest are not here', () => {
    const seen = (extra: Record<string, unknown>) =>
      lineOk('count', { containerId: id() }, [
        { thingId: id(), readAt: at, action: 'seen', ...extra },
      ]);
    expect(seen({ quantity: '4' })).toBe(true);
    expect(seen({ quantity: '4', short: 'not_here' })).toBe(true);
    expect(seen({ quantity: '0' })).toBe(false);
    expect(seen({ quantity: 'x' })).toBe(false);
    expect(seen({ short: 'not_here' })).toBe(false);
    expect(
      lineOk('count', { containerId: id() }, [
        { thingId: id(), readAt: at, action: 'missing', quantity: '2' },
      ]),
    ).toBe(false);
  });

  it('a count header may name the areas that were counted', () => {
    const h = {
      ...header('count', { placeId: id(), inside: true }),
      countedPlaceIds: [id(), id()],
    };
    expect(
      parseOpPayload('scan_session_lines', {
        session: h,
        lines: [{ thingId: id(), readAt: at, action: 'seen' }],
      }).success,
    ).toBe(true);
    const pack = { ...header('pack', { containerId: id() }), countedPlaceIds: [id()] };
    expect(
      parseOpPayload('scan_session_lines', {
        session: pack,
        lines: [{ thingId: id(), readAt: at, action: 'move', to: { containerId: id() } }],
      }).success,
    ).toBe(false);
  });

  it('finish: the session, how many were expected, and whether a box’s contents count too', () => {
    ok('scan_session_finish', { sessionId: id(), expected: 340, contentsSeen: false });
    ok('scan_session_finish', { sessionId: id() });
    expect(ScanSessionFinishPayload.parse({ sessionId: id() }).contentsSeen).toBe(false);
    bad('scan_session_finish', { sessionId: id(), expected: -1 });
    bad('scan_session_finish', { sessionId: id(), expected: 1.5 });
  });

  it('a session holds at most 5,000 labels, with a warning from 4,500', () => {
    expect(SCAN_SESSION_LIMITS.labels).toBe(5000);
    expect(SCAN_SESSION_LIMITS.warnAt).toBe(4500);
    expect(SCAN_SESSION_LIMITS.resolveBatch).toBe(100);
  });
});

describe('payload versions', () => {
  it('classifies a version against the window', () => {
    expect(payloadVersionStatus(PAYLOAD_VERSION)).toBe('ok');
    expect(payloadVersionStatus(MIN_PAYLOAD_VERSION - 1)).toBe('client_outdated');
    expect(payloadVersionStatus(PAYLOAD_VERSION + 1)).toBe('server_outdated');
  });

  it('passes a current payload through untouched', () => {
    const p = { thingId: id() };
    expect(upgradePayload('mark_seen', PAYLOAD_VERSION, p)).toBe(p);
  });

  it('runs a registered v0 → v1 upgrader', () => {
    const table = {
      move: {
        0: (p: unknown) => {
          const { placeId, ...rest } = p as { placeId: string; thingIds: string[] };
          return { ...rest, to: { placeId } };
        },
      },
    };
    const thingId = id();
    const placeId = id();
    const upgraded = upgradePayload('move', 0, { thingIds: [thingId], placeId }, table);
    expect(upgraded).toEqual({ thingIds: [thingId], to: { placeId } });
    expect(parseOpPayload('move', upgraded).success).toBe(true);
  });

  it('throws when a step is missing or the version is ahead of this build', () => {
    expect(() => upgradePayload('move', 0, {})).toThrow(PayloadVersionError);
    expect(() => upgradePayload('move', PAYLOAD_VERSION + 1, {})).toThrow(PayloadVersionError);
  });
});
