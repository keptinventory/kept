/**
 * A scan session on the phone (#168): one walk with the camera, many labels, one mode. Pure: the
 * screen resolves each read (../resolve.ts, the phone first) and hands the answer here, which
 * says what it means, keeps it once, and in the end turns the summary into the sync ops that save
 * it. Nothing reaches the server before Save.
 *
 * **Count** a place (with the places inside it), a box, or a whole location: the expected list
 * comes from the phone's snapshot. A thing on it is *found*; one of this location elsewhere is
 * *elsewhere* ("Move here" or leave); one of another location is *other location* (moved here
 * only where both can be edited); one in a location you only view is *view only*. A viewer
 * counts too, as a check: the same totals, nothing saved.
 *
 * **Pack into** a box or **Move to** a place or a box: every thing read is added to the current
 * target, which can change mid-walk (pack: scan the next box after tapping Target).
 *
 * Each Kept code counts once per session; a product barcode matches the expected list, and the
 * same barcode again is ignored. Missing things are left alone unless chosen ("Mark not here").
 */
import {
  can,
  newId,
  parseScan,
  type QueueItem,
  type Role,
  SCAN_SESSION_LIMITS,
  type ScanSessionLine,
  type ScanSessionMode,
  type SnapThing,
} from '@kept/shared';
import { queueItem, type Resolution } from '../resolve';

export type SessionTarget = {
  kind: 'place' | 'container' | 'location';
  id: string;
  locationId: string;
  name: string | null;
  /** A place: the places inside it count too. */
  inside?: boolean;
  /** A whole location: where "Move here" puts things (its Unplaced area). */
  unplacedPlaceId?: string;
};

export type ExpectedThing = Pick<
  SnapThing,
  'id' | 'locationId' | 'name' | 'shortCode' | 'placeId' | 'containerId' | 'isContainer'
> & { barcode?: string };

export type ReadKind =
  /** On the expected list (count), or added to the target (pack, move). */
  | 'found'
  /** This code was read already. */
  | 'already'
  /** A count: a thing of this location, in another place. */
  | 'elsewhere'
  /** A count: a thing of another location you belong to. */
  | 'other_location'
  /** A thing whose location you only view (a viewer's check counts it on its list). */
  | 'view_only'
  /** A place's label: a count offers to count it instead; a pack or move refuses it. */
  | 'place'
  /** The target's own label. */
  | 'target'
  /** Blank labels, codes matching several things, barcodes on nothing here. */
  | 'unmatched'
  | 'not_in_your_kept'
  /** Offline, and not on the phone: checked once online. */
  | 'check_later'
  /** Not a Kept label, or the same product barcode again. */
  | 'ignored'
  /** The session holds as many labels as it can. */
  | 'full';

/** The kinds kept in the session's list of reads. */
const KEPT_KINDS: ReadonlySet<ReadKind> = new Set([
  'found',
  'elsewhere',
  'other_location',
  'view_only',
  'unmatched',
  'not_in_your_kept',
  'check_later',
]);

export type MoveTo = { placeId: string } | { containerId: string };

export type SessionRead = {
  key: string;
  text: string;
  format?: string;
  at: string;
  kind: ReadKind;
  thingId?: string;
  locationId?: string;
  name?: string | null;
  placeId?: string | null;
  containerId?: string | null;
  /** Pack and move: where it goes (the target when it was read). */
  to?: MoveTo;
  /** A blank label's code, to claim at the end. */
  code?: string | null;
  /** The person can change things in the thing's location. */
  editable?: boolean;
};

export type Session = {
  id: string;
  mode: ScanSessionMode;
  target: SessionTarget;
  /** The session's location: its target's. */
  locationId: string;
  role: Role;
  /** A viewer's count: everything on the phone, nothing saved. */
  checkOnly: boolean;
  /** A count's expected list. */
  expected: ExpectedThing[];
  /** A count: a box read counts what is inside it too. */
  contents: boolean;
  startedAt: string;
  /** Pack and move: the target things go to now. */
  current: SessionTarget;
  /** The targets used, by id, for the summary. */
  targets: Record<string, SessionTarget>;
  reads: SessionRead[];
  /** Every code handled, kept or not (a place, the target, a repeat barcode). */
  keys: string[];
  paused: boolean;
  /** Saved: its ops are queued, under the finish's key; the phone keeps it until they settle. */
  saving: { at: string; finishKey: string } | null;
};

export type Roles = (locationId: string) => Role | null;
export type ReadInfo = {
  res: Resolution;
  /** What the phone knows of the thing the answer opens. */
  thing?: Partial<ExpectedThing> | null;
};

export function newSession(args: {
  id?: string;
  mode: ScanSessionMode;
  target: SessionTarget;
  role: Role;
  expected: ExpectedThing[];
  contents?: boolean;
  now: string;
}): Session {
  return {
    id: args.id ?? newId(),
    mode: args.mode,
    target: args.target,
    locationId: args.target.locationId,
    role: args.role,
    checkOnly: args.mode === 'count' && !can(args.role, 'things.mark-seen'),
    expected: args.expected,
    contents: args.contents ?? false,
    startedAt: args.now,
    current: args.target,
    targets: { [args.target.id]: args.target },
    reads: [],
    keys: [],
    paused: false,
    saving: null,
  };
}

/** The same label, however it was read: a Kept code by its code, any host. */
export function readKey(text: string, format?: string): string {
  const s = parseScan(text, format);
  switch (s.kind) {
    case 'kept':
      return `k:${s.code}`;
    case 'homebox':
      return `h:${s.path}:${s.assetId ?? s.uuid ?? ''}`;
    case 'barcode':
      return `b:${s.code}`;
    case 'other':
      return `t:${s.text}`;
  }
}

// ----- the expected list's indexes, made once per list ------------------------------------------

type Index = {
  byId: Map<string, ExpectedThing>;
  byBarcode: Map<string, ExpectedThing[]>;
  inside: Map<string, string[]>;
};
const INDEXES = new WeakMap<ExpectedThing[], Index>();
function indexOf(list: ExpectedThing[]): Index {
  let ix = INDEXES.get(list);
  if (ix) return ix;
  ix = { byId: new Map(), byBarcode: new Map(), inside: new Map() };
  for (const t of list) {
    ix.byId.set(t.id, t);
    if (t.barcode) ix.byBarcode.set(t.barcode, [...(ix.byBarcode.get(t.barcode) ?? []), t]);
    if (t.containerId)
      ix.inside.set(t.containerId, [...(ix.inside.get(t.containerId) ?? []), t.id]);
  }
  INDEXES.set(list, ix);
  return ix;
}

const foundIds = (s: Session) =>
  new Set(s.reads.filter((r) => r.kind === 'found' && r.thingId).map((r) => r.thingId as string));

/** What a count has found: the things read, and with `contents`, everything inside the boxes. */
function countedIds(s: Session): Set<string> {
  const found = foundIds(s);
  if (!s.contents) return found;
  const ix = indexOf(s.expected);
  const out = new Set(found);
  const stack = [...found];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    for (const child of ix.inside.get(id) ?? []) {
      if (!out.has(child)) {
        out.add(child);
        stack.push(child);
      }
    }
  }
  return out;
}

export function counter(s: Session): {
  found: number;
  expected: number | null;
  reads: number;
  nearlyFull: boolean;
} {
  const reads = s.reads.length;
  const nearlyFull = reads >= SCAN_SESSION_LIMITS.warnAt;
  if (s.mode !== 'count') {
    return { found: foundIds(s).size, expected: null, reads, nearlyFull };
  }
  const ix = indexOf(s.expected);
  let found = 0;
  for (const id of countedIds(s)) if (ix.byId.has(id)) found += 1;
  return { found, expected: s.expected.length, reads, nearlyFull };
}

const toOf = (t: SessionTarget): MoveTo | null =>
  t.kind === 'place'
    ? { placeId: t.id }
    : t.kind === 'container'
      ? { containerId: t.id }
      : t.unplacedPlaceId
        ? { placeId: t.unplacedPlaceId }
        : null;

// ----- one read -----------------------------------------------------------------------------------

export type AddResult = { session: Session; kind: ReadKind; read: SessionRead | null };

function classifyThing(
  s: Session,
  t: Partial<ExpectedThing> & { id: string; locationId: string },
  roles: Roles,
): { kind: ReadKind; editable: boolean } {
  const role = roles(t.locationId);
  const editAction = s.mode === 'count' ? 'things.mark-seen' : 'things.edit';
  const editable = !!role && can(role, editAction);
  if (t.id === s.current.id || t.id === s.target.id) return { kind: 'target', editable };
  if (s.mode !== 'count') {
    const targetRole = roles(s.current.locationId);
    const ok = editable && !!targetRole && can(targetRole, 'things.edit');
    return { kind: ok ? 'found' : 'view_only', editable };
  }
  const listed = indexOf(s.expected).byId.has(t.id);
  if (listed && (editable || s.checkOnly)) return { kind: 'found', editable };
  if (!editable && !(s.checkOnly && t.locationId === s.locationId)) {
    return { kind: 'view_only', editable };
  }
  if (t.locationId === s.locationId) return { kind: 'elsewhere', editable };
  return { kind: 'other_location', editable };
}

/**
 * What a read means in this session, and the session with it. `info` is the read's answer
 * (../resolve.ts) and what the phone knows of the thing it opens.
 */
export function addRead(
  s: Session,
  input: { text: string; format?: string; at: string },
  info: ReadInfo,
  roles: Roles,
): AddResult {
  const key = readKey(input.text, input.format);
  const same = (kind: ReadKind): AddResult => ({ session: s, kind, read: null });
  if (s.keys.includes(key)) {
    return same(
      s.reads.some((r) => r.key === key) && !key.startsWith('b:') ? 'already' : 'ignored',
    );
  }
  if (s.reads.length >= SCAN_SESSION_LIMITS.labels) return same('full');

  const base: SessionRead = {
    key,
    text: input.text,
    ...(input.format ? { format: input.format } : {}),
    at: input.at,
    kind: 'ignored',
  };
  const keep = (read: SessionRead): AddResult => {
    const kept = KEPT_KINDS.has(read.kind);
    const session: Session = {
      ...s,
      keys: [...s.keys, key],
      reads: kept ? [...s.reads, read] : s.reads,
    };
    return { session, kind: read.kind, read: kept ? read : null };
  };
  const ofThing = (t: Partial<ExpectedThing> & { id: string; locationId: string }): AddResult => {
    if (s.reads.some((r) => r.thingId === t.id && KEPT_KINDS.has(r.kind))) {
      return { session: { ...s, keys: [...s.keys, key] }, kind: 'already', read: null };
    }
    const known = indexOf(s.expected).byId.get(t.id) ?? info.thing ?? null;
    const { kind, editable } = classifyThing(s, t, roles);
    const to = s.mode === 'count' ? undefined : (toOf(s.current) ?? undefined);
    return keep({
      ...base,
      kind,
      thingId: t.id,
      locationId: t.locationId,
      name: known?.name ?? null,
      placeId: known?.placeId ?? null,
      containerId: known?.containerId ?? null,
      editable,
      ...(to && kind === 'found' ? { to } : {}),
    });
  };

  // A product barcode: the expected list first (a count), once.
  const scan = parseScan(input.text, input.format);
  if (scan.kind === 'barcode' && s.mode === 'count') {
    const found = foundIds(s);
    const match = (indexOf(s.expected).byBarcode.get(scan.code) ?? []).find(
      (t) => !found.has(t.id),
    );
    if (match) return ofThing(match);
  }

  const res = info.res;
  switch (res.outcome) {
    case 'open': {
      const tgt = res.target;
      if (tgt.kind === 'place') {
        if (tgt.id === s.target.id || tgt.id === s.current.id)
          return keep({ ...base, kind: 'target' });
        return keep({ ...base, kind: 'place', placeId: tgt.id, locationId: tgt.locationId });
      }
      return ofThing({ ...(info.thing ?? {}), id: tgt.id, locationId: tgt.locationId });
    }
    case 'legacy_ambiguous': {
      const ix = indexOf(s.expected);
      const listed = res.candidates.find((c) => c.kind === 'thing' && ix.byId.has(c.id));
      if (listed) return ofThing(ix.byId.get(listed.id) as ExpectedThing);
      return keep({ ...base, kind: 'unmatched' });
    }
    case 'claim':
      return keep({ ...base, kind: 'unmatched', code: res.code, locationId: res.locationId });
    case 'barcode':
      return keep({ ...base, kind: 'unmatched' });
    case 'not_in_your_kept':
      return keep({ ...base, kind: 'not_in_your_kept', code: res.code });
    case 'not_on_phone':
      return keep({ ...base, kind: 'check_later', code: res.code });
    case 'not_kept':
      return keep({ ...base, kind: 'ignored' });
  }
}

/** Takes back the last read kept ("Undo last read"). */
export function undoLast(s: Session): Session {
  const last = s.reads.at(-1);
  if (!last) return s;
  return {
    ...s,
    reads: s.reads.slice(0, -1),
    keys: s.keys.filter((k) => k !== last.key),
  };
}

/** Pack and move: where the next things go. */
export function setTarget(s: Session, target: SessionTarget): Session {
  return { ...s, current: target, targets: { ...s.targets, [target.id]: target } };
}

/** A check-later read, answered once online. */
export function resolveLater(s: Session, key: string, info: ReadInfo, roles: Roles): Session {
  const was = s.reads.find((r) => r.key === key && r.kind === 'check_later');
  if (!was) return s;
  const without: Session = {
    ...s,
    reads: s.reads.filter((r) => r !== was),
    keys: s.keys.filter((k) => k !== key),
  };
  const out = addRead(
    without,
    { text: was.text, ...(was.format ? { format: was.format } : {}), at: was.at },
    info,
    roles,
  );
  // Keep the read in its place in the walk.
  if (!out.read) return out.session;
  const reads = [...s.reads];
  reads[reads.indexOf(was)] = out.read;
  return { ...out.session, reads };
}

// ----- the summary --------------------------------------------------------------------------------

export type Summary = {
  found: SessionRead[];
  /** Labelled things on the expected list not read. */
  missing: ExpectedThing[];
  /** Things on the expected list without a label: ticked by hand, never missing. */
  noLabel: ExpectedThing[];
  elsewhere: SessionRead[];
  otherLocation: (SessionRead & { canMove: boolean })[];
  viewOnly: SessionRead[];
  unmatched: SessionRead[];
  notInYourKept: SessionRead[];
  checkLater: SessionRead[];
  /** Pack and move: what goes where. */
  byTarget: { target: SessionTarget; reads: SessionRead[] }[];
};

export function summarise(s: Session, roles?: Roles): Summary {
  const of = (kind: ReadKind) => s.reads.filter((r) => r.kind === kind);
  const counted = countedIds(s);
  const labelled = (t: ExpectedThing) => !!t.shortCode || !!t.barcode;
  const missing = s.mode === 'count' ? s.expected.filter((t) => !counted.has(t.id)) : [];
  const editsHere = (() => {
    const role = roles ? roles(s.locationId) : s.role;
    return !!role && can(role, 'things.edit');
  })();
  const byTarget = new Map<string, SessionRead[]>();
  for (const r of of('found')) {
    if (!r.to) continue;
    const id = 'placeId' in r.to ? r.to.placeId : r.to.containerId;
    byTarget.set(id, [...(byTarget.get(id) ?? []), r]);
  }
  return {
    found: of('found'),
    missing: missing.filter(labelled),
    noLabel: missing.filter((t) => !labelled(t)),
    elsewhere: of('elsewhere'),
    otherLocation: of('other_location').map((r) => {
      const role = roles && r.locationId ? roles(r.locationId) : null;
      const there = roles ? !!role && can(role, 'things.edit') : r.editable === true;
      return { ...r, canMove: there && editsHere };
    }),
    viewOnly: of('view_only'),
    unmatched: of('unmatched'),
    notInYourKept: of('not_in_your_kept'),
    checkLater: of('check_later'),
    byTarget: [...byTarget].map(([id, reads]) => ({
      target: s.targets[id] ?? { kind: 'container', id, locationId: s.locationId, name: null },
      reads,
    })),
  };
}

export type Choices = {
  /** Missing things to mark "not here". */
  notHere?: readonly string[];
  /** Things found elsewhere, or in another location, to move here. */
  moveHere?: readonly string[];
  /** Things without a label, ticked as here. */
  ticked?: readonly string[];
};

/** The lines Save sends. A viewer's check sends none. */
export function linesOf(
  s: Session,
  sum: Summary,
  choices: Choices,
  now: string,
): ScanSessionLine[] {
  if (s.checkOnly) return [];
  if (s.mode !== 'count') {
    return sum.found
      .filter((r) => r.thingId && r.to)
      .map((r) => ({
        thingId: r.thingId as string,
        readAt: r.at,
        action: 'move' as const,
        to: r.to as MoveTo,
      }));
  }
  const lines: ScanSessionLine[] = [];
  for (const r of sum.found) {
    if (r.thingId) lines.push({ thingId: r.thingId, readAt: r.at, action: 'seen' });
  }
  const ticked = new Set(choices.ticked ?? []);
  for (const t of sum.noLabel) {
    if (ticked.has(t.id)) lines.push({ thingId: t.id, readAt: now, action: 'seen' });
  }
  const here = toOf(s.target);
  const move = new Set(choices.moveHere ?? []);
  if (here) {
    for (const r of [...sum.elsewhere, ...sum.otherLocation.filter((x) => x.canMove)]) {
      if (r.thingId && move.has(r.thingId)) {
        lines.push({ thingId: r.thingId, readAt: r.at, action: 'move', to: here });
      }
    }
  }
  const gone = new Set(choices.notHere ?? []);
  for (const t of sum.missing) {
    if (gone.has(t.id)) lines.push({ thingId: t.id, readAt: now, action: 'not_here' });
  }
  return lines;
}

type QueueInput = Omit<QueueItem, 'clientVersion' | 'payloadVersion'>;

const headerTarget = (t: SessionTarget) =>
  t.kind === 'place'
    ? { placeId: t.id, inside: t.inside ?? true }
    : t.kind === 'container'
      ? { containerId: t.id }
      : { locationId: t.id };

export const finishKey = (s: Pick<Session, 'id'>) => `scan-finish:${s.id}`;

/** The ops that save the session: its lines in chunks of 500, then the finish. */
export function sessionOps(
  s: Session,
  lines: readonly ScanSessionLine[],
  { contentsSeen }: { contentsSeen: boolean },
): QueueInput[] {
  const session = {
    id: s.id,
    mode: s.mode,
    target: headerTarget(s.target),
    startedAt: s.startedAt,
  };
  const ops: QueueInput[] = [];
  const size = SCAN_SESSION_LIMITS.linesPerOp;
  for (let i = 0; i < lines.length; i += size) {
    ops.push(
      queueItem(
        'scan_session_lines',
        s.locationId,
        { session, lines: lines.slice(i, i + size) },
        { key: `scan-lines:${s.id}:${i / size}` },
      ),
    );
  }
  ops.push(
    queueItem(
      'scan_session_finish',
      s.locationId,
      {
        sessionId: s.id,
        ...(s.mode === 'count' ? { expected: s.expected.length } : {}),
        contentsSeen,
      },
      { key: finishKey(s), dependsOn: ops.map((o) => o.idempotencyKey) },
    ),
  );
  return ops;
}
