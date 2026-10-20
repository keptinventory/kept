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
 *
 * A count keeps every result (#172): Save also sends what was missing, found elsewhere and left
 * there, lent out or in repair (never missing: their own groups, "With Murdock (3)"), and what
 * is in an area nobody counted: a count of a place with places inside it (or of a location) has
 * areas, and an area with no read is **Not counted** until someone taps "I checked it". A thing
 * counted in number has a found count (+/−, its whole quantity once read); short, "Mark the rest
 * not here" splits the rest off. A count opened online is shared: others join it, and what they
 * read is merged into this summary (`shared`), found by them and their areas counted.
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
> & {
  barcode?: string;
  /** Counted in number when more than 1 (a decimal string). */
  quantity?: string;
  /** Lent out or in repair: never missing. */
  derived?: SnapThing['derived'];
  loan?: SnapThing['loan'];
};

/** A place a count covers, for "Not counted: Back shelf". */
export type CountArea = { id: string; name: string | null };

/** What someone else read in a shared count. */
export type OtherLine = {
  thingId: string;
  action: string;
  readBy: string | null;
  foundQty: string | null;
};

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
  /** A count of a place with places inside it, or of a location: the places it covers. */
  areas?: CountArea[];
  /** Areas ticked "I checked it" (counted, nothing read there). */
  checked?: string[];
  /** Found counts of things counted in number (thing id → how many); else all of them. */
  qty?: Record<string, string>;
  /** Opened on the server: others may join. `joined`: this phone joined someone else's. */
  shared?: { joined: boolean; by: string | null; others: OtherLine[]; counted: string[] };
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
  areas?: CountArea[];
  now: string;
}): Session {
  return {
    ...(args.areas && args.areas.length > 1 ? { areas: args.areas } : {}),
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

const OTHERS_FOUND = new Set(['seen', 'move']);
/** Found by someone else in a shared count, and not by this phone. */
const othersFound = (s: Session) =>
  new Set((s.shared?.others ?? []).filter((l) => OTHERS_FOUND.has(l.action)).map((l) => l.thingId));

/** What a count has found: the things read, and with `contents`, everything inside the boxes. */
function countedIds(s: Session, withOthers = false): Set<string> {
  const found = foundIds(s);
  if (withOthers) for (const id of othersFound(s)) found.add(id);
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
  for (const id of countedIds(s, true)) if (ix.byId.has(id)) found += 1;
  return { found, expected: s.expected.length, reads, nearlyFull };
}

/** The area (place) a thing on the list is in, through its boxes; null when unknown. */
export function areaOf(
  s: Session,
  t: Pick<ExpectedThing, 'placeId' | 'containerId'>,
): string | null {
  const ix = indexOf(s.expected);
  let cur: Pick<ExpectedThing, 'placeId' | 'containerId'> | undefined = t;
  for (let depth = 0; cur && depth < 20; depth++) {
    if (cur.placeId) return cur.placeId;
    cur = cur.containerId ? ix.byId.get(cur.containerId) : undefined;
  }
  return null;
}

/** The areas counted: a read in each (by anyone in a shared count), or "I checked it". */
export function countedAreas(s: Session): Set<string> {
  const out = new Set<string>([...(s.checked ?? []), ...(s.shared?.counted ?? [])]);
  if (!s.areas) return out;
  const ix = indexOf(s.expected);
  for (const id of countedIds(s, true)) {
    const t = ix.byId.get(id);
    const a = t ? areaOf(s, t) : null;
    if (a) out.add(a);
  }
  for (const r of s.reads) {
    if (r.kind === 'found' && r.placeId) out.add(r.placeId);
  }
  return out;
}

/** "I checked it": an area counted with nothing read there. */
export function checkArea(s: Session, areaId: string, on = true): Session {
  const was = s.checked ?? [];
  const checked = on ? [...new Set([...was, areaId])] : was.filter((x) => x !== areaId);
  return { ...s, checked };
}

/** A thing counted in number: how many were found (its whole quantity once read). */
export function quantityOf(s: Session, thingId: string): { found: string; of: string } | null {
  const t = indexOf(s.expected).byId.get(thingId);
  const of = t?.quantity;
  if (!of || !(Number(of) > 1)) return null;
  return { found: s.qty?.[thingId] ?? of, of };
}

/** +/− on a found row: at least 1, at most its quantity. */
export function setQuantity(s: Session, thingId: string, found: number): Session {
  const q = quantityOf(s, thingId);
  if (!q) return s;
  const n = Math.min(Math.max(1, Math.round(found)), Number(q.of));
  const qty = { ...(s.qty ?? {}) };
  if (String(n) === q.of || n === Number(q.of)) delete qty[thingId];
  else qty[thingId] = String(n);
  return { ...s, qty };
}

/** Joins what others read so far in a shared count (the server's lines, merged). */
export function mergeOthers(
  s: Session,
  lines: readonly (OtherLine & { readById?: string | null })[],
  counted: readonly string[] | null,
  me: string | null,
): Session {
  const mine = new Set(s.reads.flatMap((r) => (r.thingId ? [r.thingId] : [])));
  const others = lines.filter(
    (l) => !mine.has(l.thingId) && (me === null || (l.readById ?? null) !== me),
  );
  return {
    ...s,
    shared: {
      joined: s.shared?.joined ?? false,
      by: s.shared?.by ?? null,
      others: others.map(({ thingId, action, readBy, foundQty }) => ({
        thingId,
        action,
        readBy,
        foundQty,
      })),
      counted: [...(counted ?? [])],
    },
  };
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
  /** Labelled things on the expected list not read, in an area that was counted. */
  missing: ExpectedThing[];
  /** On the list, not read here, lent out: by person. Never missing. */
  lent: { person: string; things: ExpectedThing[] }[];
  /** On the list, not read here, in repair. Never missing. */
  inRepair: ExpectedThing[];
  /** Labelled things in an area nobody counted: by area. Never missing until "I checked it". */
  notCounted: { area: CountArea; things: ExpectedThing[] }[];
  /** Found by others in a shared count. */
  byOthers: (ExpectedThing & { readBy: string | null })[];
  /** Found rows counted in number and short: "2 of 6". */
  short: { read: SessionRead; found: string; of: string }[];
  /** The areas counted (a count with areas). */
  counted: string[];
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
  const counted = countedIds(s, true);
  const labelled = (t: ExpectedThing) => !!t.shortCode || !!t.barcode;
  const unread = s.mode === 'count' ? s.expected.filter((t) => !counted.has(t.id)) : [];
  // Lent out or in repair: their own groups, never missing.
  const lentBy = new Map<string, ExpectedThing[]>();
  const inRepair: ExpectedThing[] = [];
  const others: ExpectedThing[] = [];
  for (const t of unread) {
    if (t.loan?.direction === 'out' || t.derived?.includes('lent')) {
      const who = t.loan?.personName ?? '';
      lentBy.set(who, [...(lentBy.get(who) ?? []), t]);
    } else if (t.derived?.includes('in_repair')) inRepair.push(t);
    else others.push(t);
  }
  // In an area nobody counted: not counted, never missing.
  const areasCounted = countedAreas(s);
  const byArea = new Map<string, ExpectedThing[]>();
  const missing: ExpectedThing[] = [];
  for (const t of others) {
    const a = s.areas ? areaOf(s, t) : null;
    if (a && labelled(t) && !areasCounted.has(a) && s.areas?.some((x) => x.id === a)) {
      byArea.set(a, [...(byArea.get(a) ?? []), t]);
    } else missing.push(t);
  }
  const ix = indexOf(s.expected);
  const mineFound = foundIds(s);
  const byOthers = (s.shared?.others ?? []).flatMap((l) => {
    const t = ix.byId.get(l.thingId);
    return t && OTHERS_FOUND.has(l.action) && !mineFound.has(t.id)
      ? [{ ...t, readBy: l.readBy }]
      : [];
  });
  const short = of('found').flatMap((r) => {
    const q = r.thingId ? quantityOf(s, r.thingId) : null;
    return q && Number(q.found) < Number(q.of) ? [{ read: r, ...q }] : [];
  });
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
    lent: [...lentBy].map(([person, things]) => ({ person, things })),
    inRepair,
    notCounted: (s.areas ?? []).flatMap((area) => {
      const things = byArea.get(area.id);
      return things ? [{ area, things }] : [];
    }),
    byOthers,
    short,
    counted: s.areas ? [...areasCounted].filter((a) => s.areas?.some((x) => x.id === a)) : [],
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
  /** Found short (counted in number): the rest marked not here, split off. */
  restNotHere?: readonly string[];
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
  const rest = new Set(choices.restNotHere ?? []);
  for (const r of sum.found) {
    if (!r.thingId) continue;
    const q = quantityOf(s, r.thingId);
    const short = q && Number(q.found) < Number(q.of);
    lines.push({
      thingId: r.thingId,
      readAt: r.at,
      action: 'seen',
      ...(short ? { quantity: q.found } : {}),
      ...(short && rest.has(r.thingId) ? { short: 'not_here' as const } : {}),
    });
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
  // What the count found and left as it is: kept, never applied.
  const kept = (thingId: string, action: ScanSessionLine['action'], at = now) =>
    lines.push({ thingId, readAt: at, action });
  for (const t of sum.missing) if (!gone.has(t.id)) kept(t.id, 'missing');
  for (const r of sum.elsewhere) {
    if (r.thingId && !move.has(r.thingId) && r.locationId === s.locationId)
      kept(r.thingId, 'elsewhere', r.at);
  }
  for (const g of sum.lent) for (const t of g.things) kept(t.id, 'on_loan');
  for (const t of sum.inRepair) kept(t.id, 'in_repair');
  for (const g of sum.notCounted) for (const t of g.things) kept(t.id, 'not_counted');
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

/** A shared count's finish needs a connection: others' lines are on the server. */
export const finishNeedsConnection = (s: Session) =>
  !!s.shared && (s.shared.joined || s.shared.others.length > 0);

/** The ops that save the session: its lines in chunks of 500, then the finish. */
export function sessionOps(
  s: Session,
  lines: readonly ScanSessionLine[],
  { contentsSeen, counted }: { contentsSeen: boolean; counted?: readonly string[] },
): QueueInput[] {
  const session = {
    id: s.id,
    mode: s.mode,
    target: headerTarget(s.target),
    startedAt: s.startedAt,
    ...(s.mode === 'count' && s.areas && counted ? { countedPlaceIds: [...counted] } : {}),
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
