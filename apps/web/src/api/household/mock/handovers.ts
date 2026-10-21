/**
 * Mock handlers for hand-overs and kits (1.14, #170), as the server answers them: lending a box
 * makes one hand-over with a line (a loan) for it and for everything inside it; each line comes
 * back on its own (back in a condition, damaged, not returned, lost, part of a quantity); a kit is
 * a container with a parts list, each part where it is now.
 *
 * The demo's sample (Try Kept, `VITE_KEPT_DEMO`; tests ask for it with `seedKitSample`): Home's
 * camera bag is a kit with its spare battery kept in the living room; a tripod kit went to
 * Murdock: the tripod came back fair, its head is still out.
 */
import type { Condition } from '@kept/shared';
import { liveThing, now, type StoredThing } from '../../inventory/mock/db';
import { INV_IDS } from '../../inventory/mock/fixtures';
import type { MockState } from '../../mock/fixtures';
import { err, type MockRoute, notFound, reply, route } from '../../mock/kit';
import { householdPaths as p } from '../paths';
import type {
  Handover,
  HandoverReturnBody,
  Kit,
  KitBody,
  KitPartStatus,
  LendExcluded,
} from '../types';
import {
  ensureSeeded,
  gateFor,
  hh,
  loanView,
  locOf,
  newId,
  personRef,
  placeSubject,
  recordHouseholdEvent,
  repairOf,
  thingSubject,
  todayIn,
} from './db';
import type { StoredLoan } from './state';
import { HOUSEHOLD_IDS as H } from './state';

export type StoredHandover = Omit<Handover, 'lines' | 'counts' | 'person'> & { personId: string };
type StoredKit = { thingId: string; locationId: string; rowVersion: number; parts: Part[] };
type Part = { thingId: string; quantity: string };

type Store = { handovers: StoredHandover[]; kits: StoredKit[]; seeded: boolean };
const stores = new WeakMap<MockState, Store>();

const hid = (n: number) => `01926f00-0000-7000-8000-0000003${String(n).padStart(5, '0')}`;

/** Ids for the sample and tests. */
export const KIT_IDS = {
  bag: hid(1),
  body: hid(2),
  lens: hid(3),
  battery: hid(4),
  tripodKit: hid(5),
  tripod: hid(6),
  head: hid(7),
  handover: hid(10),
  tripodLine: hid(11),
  headLine: hid(12),
  kitLine: hid(13),
};

const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const DEMO = import.meta.env.VITE_KEPT_DEMO === '1';

export function storeOf(state: MockState, withSample = DEMO): Store {
  let s = stores.get(state);
  if (!s) {
    s = { handovers: [], kits: [], seeded: false };
    stores.set(state, s);
  }
  if (!s.seeded && withSample) {
    s.seeded = true;
    seed(state, s);
  }
  return s;
}

/** The sample, in a mock that isn't the demo (tests). */
export function seedKitSample(state: MockState): void {
  storeOf(state, true);
}

/** The sample: a camera-bag kit with a part elsewhere, and a hand-over with one line still out. */
function seed(state: MockState, s: Store): void {
  ensureSeeded(state);
  const inv = state.inventory;
  const box = inv.things.find((t) => t.id === INV_IDS.thing.box3);
  const part = inv.things.find((t) => t.id === INV_IDS.thing.phone);
  if (!box || !part) return;
  const home = box.locationId;
  const office = INV_IDS.place.office;
  const living = INV_IDS.place.livingRoom;
  const make = (over: Partial<StoredThing> & { id: string; name: string }, from = part) => {
    if (inv.things.some((t) => t.id === over.id)) return;
    inv.things.push({
      ...structuredClone(from),
      serial: null,
      barcode: null,
      purchase: null,
      photos: [],
      meters: [],
      links: [],
      secrets: [],
      custom: {},
      tags: [],
      belongsTo: null,
      attachmentsCount: 0,
      quantity: 1,
      lifecycle: 'in_use',
      condition: null,
      locationId: home,
      rowVersion: 1,
      ...over,
    } as StoredThing);
  };
  make(
    {
      id: KIT_IDS.bag,
      name: 'Camera bag',
      shortCode: 'C4MBAG',
      placeId: office,
      containerId: null,
    },
    box,
  );
  make({
    id: KIT_IDS.body,
    name: 'Camera body',
    shortCode: 'B0DY7X',
    placeId: null,
    containerId: KIT_IDS.bag,
  });
  make({
    id: KIT_IDS.lens,
    name: 'Wide lens',
    shortCode: 'WDE7NS',
    placeId: null,
    containerId: KIT_IDS.bag,
  });
  make({
    id: KIT_IDS.battery,
    name: 'Spare battery',
    shortCode: 'BATT2R',
    placeId: living,
    containerId: null,
  });
  make(
    {
      id: KIT_IDS.tripodKit,
      name: 'Tripod case',
      shortCode: 'TRC4SE',
      placeId: office,
      containerId: null,
    },
    box,
  );
  make({
    id: KIT_IDS.tripod,
    name: 'Tripod',
    shortCode: 'TR1P0D',
    placeId: null,
    containerId: KIT_IDS.tripodKit,
    condition: 'fair',
  });
  make({
    id: KIT_IDS.head,
    name: 'Tripod head',
    shortCode: 'TRHEAD',
    placeId: null,
    containerId: KIT_IDS.tripodKit,
  });
  s.kits.push({
    thingId: KIT_IDS.bag,
    locationId: home,
    rowVersion: 1,
    parts: [
      { thingId: KIT_IDS.body, quantity: '1' },
      { thingId: KIT_IDS.lens, quantity: '1' },
      { thingId: KIT_IDS.battery, quantity: '1' },
    ],
  });
  const started = ago(12);
  s.handovers.push({
    id: KIT_IDS.handover,
    locationId: home,
    direction: 'out',
    personId: H.person.murdock,
    root: { id: KIT_IDS.tripodKit, name: 'Tripod case' },
    startedAt: started,
    dueOn: todayIn(state, home),
    leadDays: 2,
    notes: null,
    conditionOut: 'good',
    rowVersion: 1,
    createdBy: { displayName: 'Ibrahim' },
  });
  const box3 = (id: string) => {
    const t = inv.things.find((x) => x.id === id);
    return t ? thingSubject(state, t) : null;
  };
  const line = (id: string, thingId: string, over: Partial<StoredLoan> = {}): StoredLoan => ({
    id,
    thingId,
    locationId: home,
    direction: 'out',
    personId: H.person.murdock,
    startedAt: started,
    dueOn: todayIn(state, home),
    returnedAt: null,
    quantity: '1',
    splitFromThingId: null,
    returnPlace: null,
    previousPlace: box3(KIT_IDS.tripodKit),
    notes: null,
    conditionOut: [],
    conditionIn: [],
    rowVersion: 1,
    createdBy: { displayName: 'Ibrahim' },
    createdById: state.me.user.id,
    handoverId: KIT_IDS.handover,
    pathAtLend: 'Tripod case',
    outcome: null,
    condition: { out: 'good', in: null },
    returnNotes: null,
    with: { id: KIT_IDS.tripodKit, name: 'Tripod case' },
    ...over,
  });
  const back = ago(5);
  hh(state).loans.push(
    line(KIT_IDS.kitLine, KIT_IDS.tripodKit, {
      previousPlace: placeSubject(state, office),
      pathAtLend: null,
      with: null,
      returnedAt: back,
      outcome: 'returned',
      condition: { out: 'good', in: 'good' },
    }),
    line(KIT_IDS.tripodLine, KIT_IDS.tripod, {
      returnedAt: back,
      outcome: 'returned',
      condition: { out: 'good', in: 'fair' },
      returnNotes: 'One leg sticks a little',
    }),
    line(KIT_IDS.headLine, KIT_IDS.head),
  );
}

const linesOf = (state: MockState, id: string) =>
  hh(state).loans.filter((l) => l.handoverId === id);

export function handoverView(state: MockState, h: StoredHandover): Handover {
  const { personId, ...own } = h;
  const lines = linesOf(state, h.id).map((l) => {
    const t = state.inventory.things.find((x) => x.id === l.thingId);
    return {
      ...loanView(state, l),
      thing: {
        id: l.thingId,
        name: t?.name ?? null,
        shortCode: t?.shortCode ?? null,
        quantity: l.quantity,
      },
    };
  });
  return {
    ...own,
    person: personRef(state, personId),
    lines,
    counts: {
      lines: lines.length,
      open: lines.filter((l) => !l.returnedAt).length,
      returned: lines.filter((l) => l.outcome === 'returned').length,
      lost: lines.filter((l) => l.outcome === 'lost').length,
    },
  };
}

/** What a lend takes with it: everything inside, all the way down, with the path of boxes. */
export function contentsOf(state: MockState, rootId: string) {
  const inv = state.inventory;
  const out: { thing: StoredThing; path: string }[] = [];
  const walk = (boxId: string, path: string, depth: number) => {
    if (depth > 20) return;
    for (const t of inv.things.filter((x) => x.containerId === boxId && !x.deletedAt)) {
      out.push({ thing: t, path });
      walk(t.id, `${path} › ${t.name ?? ''}`, depth + 1);
    }
  };
  const root = liveThing(inv, rootId);
  if (root) walk(rootId, root.name ?? '', 1);
  return out;
}

/** The hand-over of a lend, and its lines for what goes with it (lending.ts's lend calls it). */
export function lendWith(
  state: MockState,
  root: StoredLoan,
  opts: { conditionOut?: Condition; leadDays?: number; alsoParts?: string[]; handoverId?: string },
): { handover: Handover; excluded: LendExcluded[] } {
  const s = storeOf(state);
  const inv = state.inventory;
  const id = opts.handoverId ?? newId();
  const rootThing = liveThing(inv, root.thingId);
  s.handovers.push({
    id,
    locationId: root.locationId,
    direction: 'out',
    personId: root.personId,
    root: { id: root.thingId, name: rootThing?.name ?? null },
    startedAt: root.startedAt,
    dueOn: root.dueOn,
    leadDays: opts.leadDays ?? 2,
    notes: root.notes,
    conditionOut: opts.conditionOut ?? null,
    rowVersion: 1,
    createdBy: root.createdBy,
  });
  Object.assign(root, {
    handoverId: id,
    pathAtLend: null,
    outcome: null,
    condition: { out: opts.conditionOut ?? null, in: null },
    returnNotes: null,
    with: null,
  });
  const excluded: LendExcluded[] = [];
  const behind = new Set<string>();
  const kit = s.kits.find((k) => k.thingId === root.thingId);
  const extra = (opts.alsoParts ?? [])
    .filter((x) => kit?.parts.some((p) => p.thingId === x))
    .map((x) => liveThing(inv, x))
    .filter((t): t is StoredThing => !!t)
    .map((t) => ({ thing: t, path: '' }));
  for (const { thing: t, path } of [...contentsOf(state, root.thingId), ...extra]) {
    const lent = hh(state).loans.find((l) => l.thingId === t.id && !l.returnedAt);
    const reason: LendExcluded['reason'] | null = lent
      ? 'on_loan'
      : repairOf(state, t.id)
        ? 'in_repair'
        : t.lifecycle !== 'in_use'
          ? 'ended'
          : null;
    if (reason || (t.containerId && behind.has(t.containerId))) {
      behind.add(t.id);
      if (reason)
        excluded.push({
          thingId: t.id,
          name: t.name,
          reason,
          with: lent ? personRef(state, lent.personId).name : null,
        });
      continue;
    }
    const box = t.containerId ? liveThing(inv, t.containerId) : undefined;
    hh(state).loans.push({
      ...root,
      id: newId(),
      thingId: t.id,
      quantity: String(t.quantity),
      splitFromThingId: null,
      previousPlace: box
        ? thingSubject(state, box)
        : t.placeId
          ? placeSubject(state, t.placeId)
          : null,
      pathAtLend: path || null,
      with: { id: root.thingId, name: rootThing?.name ?? null },
      conditionOut: [],
      conditionIn: [],
      rowVersion: 1,
    });
  }
  const h = s.handovers.find((x) => x.id === id) as StoredHandover;
  return { handover: handoverView(state, h), excluded };
}

function kitView(state: MockState, k: StoredKit): Kit {
  const inv = state.inventory;
  const inside = new Set(contentsOf(state, k.thingId).map((c) => c.thing.id));
  const lentOf = (thingId: string) => {
    const l = hh(state).loans.find(
      (x) => x.thingId === thingId && !x.returnedAt && x.direction === 'out',
    );
    return l
      ? {
          handoverId: l.handoverId ?? l.id,
          person: personRef(state, l.personId).name,
          since: l.startedAt,
          dueOn: l.dueOn,
        }
      : null;
  };
  const kitLent = lentOf(k.thingId);
  const parts = k.parts.map((p) => {
    const t = inv.things.find((x) => x.id === p.thingId);
    const lent = lentOf(p.thingId);
    const status: KitPartStatus =
      !t || t.deletedAt
        ? 'trashed'
        : lent
          ? 'with_someone'
          : inside.has(p.thingId)
            ? 'in_kit'
            : t.locationUncertain
              ? 'missing'
              : 'elsewhere';
    const box = t?.containerId ? liveThing(inv, t.containerId) : undefined;
    const place = t?.placeId ? placeSubject(state, t.placeId) : null;
    return {
      thing: { id: p.thingId, name: t?.name ?? null, shortCode: t?.shortCode ?? null },
      quantity: p.quantity,
      status,
      where: box
        ? { id: box.id, name: box.name ?? '' }
        : place
          ? { id: place.id, name: place.name }
          : null,
      with: lent,
    };
  });
  const inKit = parts.filter(
    (p) =>
      p.status === 'in_kit' ||
      (p.status === 'with_someone' && kitLent && p.with?.handoverId === kitLent.handoverId),
  ).length;
  return {
    thingId: k.thingId,
    locationId: k.locationId,
    rowVersion: k.rowVersion,
    parts,
    summary: {
      parts: parts.length,
      inKit,
      notInKit: parts.length - inKit,
      complete: parts.length > 0 && inKit === parts.length,
    },
    lent: kitLent,
  };
}

export function handoverRoutes(state: MockState): MockRoute[] {
  const inv = () => state.inventory;
  const s = () => storeOf(state);
  const writable = (locationId: string) => {
    const role = locOf(state, locationId)?.role;
    return role && role !== 'viewer';
  };

  const closeLine = (
    l: StoredLoan,
    how: { outcome: 'returned' | 'lost'; condition?: Condition; notes?: string; update?: boolean },
  ) => {
    const t = inv().things.find((x) => x.id === l.thingId);
    const before = { loan: { ...l }, thing: t ? structuredClone(t) : null };
    l.returnedAt = now();
    l.outcome = how.outcome;
    l.condition = { out: l.condition?.out ?? null, in: how.condition ?? null };
    if (how.notes !== undefined) l.returnNotes = how.notes;
    l.rowVersion += 1;
    if (t && how.outcome === 'lost') {
      t.lifecycle = 'lost';
      t.ended = { on: todayIn(state, l.locationId), to: null, notes: null };
    }
    if (t && how.update && how.condition) t.condition = how.condition;
    recordHouseholdEvent(state, {
      action: how.outcome === 'lost' ? 'loan.lost' : 'loan.return',
      entity: { type: 'loan', id: l.id },
      locationId: l.locationId,
      rootThingId: l.thingId,
      name: t?.name ?? '',
      undo: () => {
        Object.assign(l, before.loan, { rowVersion: l.rowVersion + 1 });
        if (t && before.thing) Object.assign(t, before.thing, { rowVersion: t.rowVersion + 1 });
      },
    });
  };

  return [
    route('GET', p.handover(':id'), ({ params }) => {
      const h = s().handovers.find((x) => x.id === params.id);
      if (!h || !locOf(state, h.locationId)) return notFound();
      return handoverView(state, h);
    }),

    route('PATCH', p.handover(':id'), ({ params, body }) => {
      const h = s().handovers.find((x) => x.id === params.id);
      if (!h || !locOf(state, h.locationId)) return notFound();
      if (!writable(h.locationId)) return err(403, 'forbidden', "You don't have permission.");
      const b = body as { dueOn?: string | null; leadDays?: number; notes?: string | null };
      const before = { ...h };
      if (b.dueOn !== undefined) h.dueOn = b.dueOn;
      if (b.leadDays !== undefined) h.leadDays = b.leadDays;
      if (b.notes !== undefined) h.notes = b.notes;
      h.rowVersion += 1;
      for (const l of linesOf(state, h.id)) if (!l.returnedAt) l.dueOn = h.dueOn;
      recordHouseholdEvent(state, {
        action: 'handover.update',
        entity: { type: 'handover', id: h.id },
        locationId: h.locationId,
        rootThingId: h.root?.id ?? null,
        name: h.root?.name ?? '',
        undo: () => Object.assign(h, before, { rowVersion: h.rowVersion + 1 }),
      });
      return handoverView(state, h);
    }),

    route('POST', p.handoverReturn(':id'), ({ params, body }) => {
      const h = s().handovers.find((x) => x.id === params.id);
      if (!h || !locOf(state, h.locationId)) return notFound();
      if (!writable(h.locationId)) return err(403, 'forbidden', "You don't have permission.");
      const b = body as HandoverReturnBody;
      for (const line of b.lines) {
        const l = hh(state).loans.find((x) => x.id === line.loanId && x.handoverId === h.id);
        if (!l)
          return err(400, 'validation', 'The request is not valid.', 'lines of this hand-over');
        if (l.returnedAt || line.outcome === 'not_returned') continue;
        const t = liveThing(inv(), l.thingId);
        if (line.quantityBack && t && Number(line.quantityBack) < t.quantity) {
          // The rest is split off and stays out on its own line.
          const rest = t.quantity - Number(line.quantityBack);
          const part: StoredThing = {
            ...structuredClone(t),
            id: newId(),
            shortCode: null,
            quantity: rest,
            rowVersion: 1,
          };
          t.quantity = Number(line.quantityBack);
          inv().things.push(part);
          hh(state).loans.push({
            ...l,
            id: newId(),
            thingId: part.id,
            quantity: String(rest),
            rowVersion: 1,
          });
          l.quantity = line.quantityBack;
        }
        closeLine(l, {
          outcome: line.outcome === 'lost' ? 'lost' : 'returned',
          ...(line.conditionIn ? { condition: line.conditionIn } : {}),
          ...(line.notes !== undefined ? { notes: line.notes } : {}),
          ...(line.updateCondition ? { update: true } : {}),
        });
      }
      return handoverView(state, h);
    }),

    route('POST', p.loanLost(':id'), ({ params, body }) => {
      const l = hh(state).loans.find((x) => x.id === params.id);
      if (!l || !locOf(state, l.locationId)) return notFound();
      if (!writable(l.locationId)) return err(403, 'forbidden', "You don't have permission.");
      if (l.returnedAt) return err(409, 'conflict', 'This was already returned.');
      const b = (body ?? {}) as { notes?: string };
      closeLine(l, { outcome: 'lost', ...(b.notes !== undefined ? { notes: b.notes } : {}) });
      return { loan: loanView(state, l) };
    }),

    route('GET', p.thingHandovers(':id'), ({ params }) => {
      s();
      const t = liveThing(inv(), params.id ?? null);
      if (!t) return notFound();
      return {
        items: s()
          .handovers.filter((h) => h.root?.id === t.id)
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
          .map((h) => handoverView(state, h)),
      };
    }),

    route('GET', p.thingKit(':id'), ({ params }) => {
      s();
      const t = liveThing(inv(), params.id ?? null);
      if (!t) return notFound();
      const k = s().kits.find((x) => x.thingId === t.id);
      return { kit: k ? kitView(state, k) : null };
    }),

    route('POST', p.thingKit(':id'), ({ params, body }) => {
      s();
      const t = liveThing(inv(), params.id ?? null);
      if (!t) return notFound();
      if (!writable(t.locationId)) return err(403, 'forbidden', "You don't have permission.");
      if (s().kits.some((x) => x.thingId === t.id))
        return err(409, 'conflict', 'It is a kit already.');
      const b = body as KitBody;
      const taken = b.parts.find((p) =>
        s().kits.some((k) => k.parts.some((x) => x.thingId === p.thingId)),
      );
      if (taken) return err(409, 'in_another_kit', 'It is a part of another kit.');
      const k: StoredKit = {
        thingId: t.id,
        locationId: t.locationId,
        rowVersion: 1,
        parts: b.parts.map((p) => ({ thingId: p.thingId, quantity: p.quantity ?? '1' })),
      };
      s().kits.push(k);
      recordHouseholdEvent(state, {
        action: 'kit.create',
        entity: { type: 'thing', id: t.id },
        locationId: t.locationId,
        rootThingId: t.id,
        name: t.name ?? '',
        undo: () => {
          s().kits = s().kits.filter((x) => x !== k);
        },
      });
      return reply(201, kitView(state, k));
    }),

    route('PUT', p.thingKit(':id'), ({ params, body }) => {
      const k = s().kits.find((x) => x.thingId === params.id);
      const t = liveThing(inv(), params.id ?? null);
      if (!k || !t) return notFound();
      if (!writable(t.locationId)) return err(403, 'forbidden', "You don't have permission.");
      const before = structuredClone(k.parts);
      k.parts = (body as KitBody).parts.map((p) => ({
        thingId: p.thingId,
        quantity: p.quantity ?? '1',
      }));
      k.rowVersion += 1;
      recordHouseholdEvent(state, {
        action: 'kit.update',
        entity: { type: 'thing', id: t.id },
        locationId: t.locationId,
        rootThingId: t.id,
        name: t.name ?? '',
        undo: () => {
          k.parts = before;
          k.rowVersion += 1;
        },
      });
      return kitView(state, k);
    }),

    route('DELETE', p.thingKit(':id'), ({ params }) => {
      const k = s().kits.find((x) => x.thingId === params.id);
      const t = liveThing(inv(), params.id ?? null);
      if (!k || !t) return notFound();
      if (!writable(t.locationId)) return err(403, 'forbidden', "You don't have permission.");
      s().kits = s().kits.filter((x) => x !== k);
      recordHouseholdEvent(state, {
        action: 'kit.dissolve',
        entity: { type: 'thing', id: t.id },
        locationId: t.locationId,
        rootThingId: t.id,
        name: t.name ?? '',
        undo: () => {
          s().kits.push(k);
        },
      });
      return reply(204);
    }),

    route('GET', p.locationKits(':id'), ({ params, query }) => {
      if (!locOf(state, params.id ?? null) || !gateFor) return notFound();
      const incomplete = query.get('incomplete') !== null;
      return {
        items: s()
          .kits.filter((k) => k.locationId === params.id)
          .map((k) => ({ k, v: kitView(state, k) }))
          .filter(({ v }) => !incomplete || !v.summary.complete)
          .map(({ k, v }) => ({
            thing: { id: k.thingId, name: liveThing(inv(), k.thingId)?.name ?? null },
            summary: v.summary,
          })),
      };
    }),
  ];
}
