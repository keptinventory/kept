/**
 * Check the plan (1.14.3, D266, spec §5.3, §7): the review of a floor plan's proposed rooms, pure,
 * over @kept/shared's floor-plan.ts. The server drafted the rooms once (FloorPlanView.drafts);
 * here they meet this map:
 *
 * - each plan floor goes to a level (matchFloors): the one the map shows, a floor of the same
 *   name, or a new floor made on Add (`new:{i}`);
 * - each proposal on a floor where a room of the same name nobody arranged exists uses that room
 *   (matchRoom); one already arranged starts switched off ("Already on the map.");
 * - a floor's proposals sit as one block to the right of that level's rooms, a metre clear
 *   (placeBeside), and the plan image under them in the same metres (the underlay);
 * - Set a room's size drafts the plan again from that size (draftRooms' `typed`), keeping what was
 *   decided per room; Turn the rooms turns every floor's block a quarter turn, the image with it.
 *
 * Positions are the map's own metres; the Add request is whole centimetres (applyBodyOf). The
 * engine draws `proposalRooms` dashed and violet, and moves them like any room (D267's grid).
 */
import {
  draftRooms,
  type MapRect,
  type MapRoomKind,
  matchFloors,
  matchRoom,
  mToCm,
  type PlanDraft,
  type PlanDrafts,
  type PlanExtraction,
  type PlanNote,
  placeBeside,
  ROOM_KIND_SURFACE,
} from '@kept/shared';
import type { ApplyPlanBody, FloorPlanView, MapView } from '@/api/map/types';
import { type Level, NO_FLOOR, type Plan, type Room } from '../layout';

/** A level a plan floor goes to: an existing one's key, or a new floor's. */
export const newLevelKey = (index: number) => `new:${index}`;
export const isNewLevel = (key: string) => key.startsWith('new:');

export type ReviewFloor = {
  /** The plan floor's index. */
  index: number;
  /** As printed, or null. */
  label: string | null;
  levelKey: string;
};

export type Proposal = {
  key: string;
  floor: number;
  /** Switched on: added with the others. */
  on: boolean;
  name: string;
  kind: MapRoomKind;
  /** The map's metres. */
  x: number;
  z: number;
  w: number;
  d: number;
  notes: PlanNote[];
  printed: PlanDraft['printed'];
  /** Under 1 m: never added. */
  skip: boolean;
  /** An existing room of that floor nobody arranged, given this rectangle. */
  use: string | null;
  useName: string | null;
  /** A room of the same name is already on the map there: it starts switched off. */
  arranged: boolean;
};

/** The plan image under a floor's proposals, in the map's metres: its middle, its size as sent,
 * and the quarter turns Turn the rooms gave it. */
export type Underlay = {
  levelKey: string;
  cx: number;
  cz: number;
  w: number;
  h: number;
  /** Quarter turns clockwise (Turn the rooms). */
  quarter: number;
  /** The plan's straightening, degrees. */
  skewDeg: number;
};

export type Review = {
  planId: string;
  answer: PlanExtraction;
  image: { w: number; h: number };
  drafts: PlanDrafts;
  floors: ReviewFloor[];
  proposals: Proposal[];
  quarter: number;
  underlays: Underlay[];
};

export type ReviewWords = {
  /** "Room {n}". */
  room: (n: number) => string;
  /** "Floor {n}". */
  floor: (n: number) => string;
};

/** The rooms already on a level, as the map has them now (an auto-laid room included). */
const roomsOn = (plan: Plan, levelKey: string, except: ReadonlySet<string> = new Set()) =>
  plan.rooms.filter((r) => r.levelKey === levelKey && !r.proposed && !except.has(r.id));

/** Each floor's proposals in that floor's own metres, as drafted and turned. */
type Frame = { x: number; z: number; w: number; d: number };

function turnFrames(
  drafts: PlanDrafts,
  quarter: number,
): {
  rooms: Map<string, Frame>;
  images: Map<number, { cx: number; cz: number; w: number; h: number }>;
} {
  const rooms = new Map<string, Frame>(
    drafts.rooms.map((r) => [r.key, { x: r.x, z: r.z, w: r.w, d: r.d }]),
  );
  const images = new Map(drafts.images.map((img, i) => [i, { ...img }]));
  for (let q = 0; q < quarter % 4; q++) {
    for (const f of new Set(drafts.rooms.map((r) => r.floor))) {
      const keys = drafts.rooms.filter((r) => r.floor === f && !r.skip).map((r) => r.key);
      // A quarter turn clockwise as the plan view shows it: (x, z) → (−z, x), then the floor starts
      // at its corner again. The image's middle turns the same way.
      const turned = keys.map((k) => {
        const r = rooms.get(k) as Frame;
        return { k, x: -(r.z + r.d), z: r.x, w: r.d, d: r.w };
      });
      const mx = Math.min(...turned.map((r) => r.x));
      const mz = Math.min(...turned.map((r) => r.z));
      const g = (v: number) => Math.round(v * 10) / 10 || 0;
      for (const r of turned) rooms.set(r.k, { x: g(r.x - mx), z: g(r.z - mz), w: r.w, d: r.d });
      const img = images.get(f);
      if (img) images.set(f, { cx: -img.cz - mx, cz: img.cx - mz, w: img.h, h: img.w });
    }
  }
  return { rooms, images };
}

/** Every floor's block placed to the right of its level's rooms (rooms it uses aside). */
function place(review: Review, plan: Plan): Review {
  const { rooms: frames, images } = turnFrames(review.drafts, review.quarter);
  const used = new Set(review.proposals.flatMap((p) => (p.use ? [p.use] : [])));
  const proposals = review.proposals.map((p) => ({ ...p }));
  const underlays: Underlay[] = [];
  for (const f of review.floors) {
    const mine = proposals.filter((p) => p.floor === f.index && !p.skip);
    const rects: MapRect[] = mine.map((p) => frames.get(p.key) as Frame);
    const existing = roomsOn(plan, f.levelKey, used);
    const shift = placeBeside(rects, existing);
    for (const p of mine) {
      const r = frames.get(p.key) as Frame;
      p.x = Math.round((r.x + shift.dx) * 10) / 10;
      p.z = Math.round((r.z + shift.dz) * 10) / 10;
      p.w = r.w;
      p.d = r.d;
    }
    const img = images.get(f.index);
    const sent = review.drafts.images[f.index];
    if (img && sent) {
      underlays.push({
        levelKey: f.levelKey,
        cx: img.cx + shift.dx,
        cz: img.cz + shift.dz,
        // The image as sent, before Turn the rooms (the engine turns it by `quarter`).
        w: sent.w,
        h: sent.h,
        quarter: review.quarter % 4,
        skewDeg: review.drafts.skewDeg,
      });
    }
  }
  return { ...review, proposals, underlays };
}

/**
 * The review of `view` (a ready plan) on this map. `showing` is the level the map shows when the
 * review begins; `data` is the server's map (which rooms someone arranged).
 */
export function startReview(
  view: FloorPlanView,
  plan: Plan,
  data: Pick<MapView, 'rooms'>,
  showing: string,
  words: ReviewWords,
): Review | null {
  if (!view.answer || !view.image || !view.drafts) return null;
  const drafts = view.drafts;
  const existing = plan.levels.filter((l): l is Level & { id: string } => l.id !== null);
  const showingId = plan.levels.find((l) => l.key === showing)?.id ?? null;
  const matched = matchFloors(
    drafts.floors,
    existing.map((l) => ({ id: l.id, name: l.name })),
    showingId,
  );
  const floors: ReviewFloor[] = drafts.floors.map((f, i) => {
    const m = matched[i];
    return {
      index: i,
      label: f.label,
      levelKey: m?.create ? newLevelKey(i) : m?.id ? m.id : NO_FLOOR,
    };
  });
  const arrangedIds = new Set(data.rooms.filter((r) => r.layout).map((r) => r.id));
  const levelIdOf = (key: string) => (isNewLevel(key) || key === NO_FLOOR ? null : key);
  const candidates = plan.rooms.map((r) => ({
    id: r.id,
    name: r.name,
    levelId: r.levelKey === NO_FLOOR ? null : r.levelKey,
    arranged: arrangedIds.has(r.id),
  }));
  const taken = new Set<string>();
  const counters = new Map<string, number>();
  const proposals: Proposal[] = drafts.rooms.map((r) => {
    const f = floors[r.floor] ?? floors[0];
    const levelKey = f?.levelKey ?? NO_FLOOR;
    const level = isNewLevel(levelKey) ? undefined : levelIdOf(levelKey);
    const m =
      level === undefined
        ? {}
        : matchRoom(
            r.name,
            level,
            candidates.filter((c) => !taken.has(c.id)),
          );
    if (m.use) taken.add(m.use);
    let name = r.name;
    if (!name) {
      const n = (counters.get(levelKey) ?? roomsOn(plan, levelKey).length) + 1;
      counters.set(levelKey, n);
      name = words.room(n);
    }
    const notes: PlanNote[] = [...r.notes];
    return {
      key: r.key,
      floor: r.floor,
      on: !r.skip && !m.arranged,
      name,
      kind: r.kind,
      x: r.x,
      z: r.z,
      w: r.w,
      d: r.d,
      notes,
      printed: r.printed,
      skip: r.skip,
      use: m.use ?? null,
      useName: m.use ? (plan.rooms.find((x) => x.id === m.use)?.name ?? null) : null,
      arranged: !!m.arranged,
    };
  });
  return place(
    {
      planId: view.id,
      answer: view.answer,
      image: view.image,
      drafts,
      floors,
      proposals,
      quarter: 0,
      underlays: [],
    },
    plan,
  );
}

/** The plan drafted again from one room's typed size: every room rescaled and placed again,
 * what was decided per room (on, name, kind, a room to use) kept. */
export function rescale(review: Review, plan: Plan, key: string, w: number, d: number): Review {
  const drafts = draftRooms(review.answer, review.image, { typed: { key, w, d } });
  const byKey = new Map(drafts.rooms.map((r) => [r.key, r]));
  const proposals = review.proposals.map((p) => {
    const r = byKey.get(p.key);
    if (!r) return p;
    return {
      ...p,
      notes: [
        ...r.notes.filter((n) => n !== 'too_small'),
        ...(r.skip ? (['too_small'] as const) : []),
      ],
      printed: r.printed,
      skip: r.skip,
      on: r.skip ? false : p.skip ? !p.arranged : p.on,
    };
  });
  return place({ ...review, drafts, proposals }, plan);
}

/** Every floor's rooms a quarter turn clockwise, the image with them. */
export function turnRooms(review: Review, plan: Plan): Review {
  return place({ ...review, quarter: (review.quarter + 1) % 4 }, plan);
}

/** Puts one floor's proposals on another level (the floor picker), beside its rooms. */
export function moveFloor(review: Review, plan: Plan, index: number, levelKey: string): Review {
  const floors = review.floors.map((f) => (f.index === index ? { ...f, levelKey } : f));
  // A room to use was matched on the old level: on another, nothing is used.
  const proposals = review.proposals.map((p) =>
    p.floor === index ? { ...p, use: null, useName: null, arranged: false, on: !p.skip } : p,
  );
  return place({ ...review, floors, proposals }, plan);
}

/** A change to one proposal (its switch, name, kind, a room to use, its size). */
export function editProposal(review: Review, key: string, change: Partial<Proposal>): Review {
  return {
    ...review,
    proposals: review.proposals.map((p) => (p.key === key ? { ...p, ...change } : p)),
  };
}

/** The proposals the engine draws: switched on and big enough, on their level. */
export function proposalRooms(review: Review): Room[] {
  return review.proposals
    .filter((p) => p.on && !p.skip)
    .map((p) => ({
      id: p.key,
      levelKey: review.floors[p.floor]?.levelKey ?? NO_FLOOR,
      name: p.name,
      shortCode: null,
      kindKey: 'room',
      x: p.x,
      z: p.z,
      w: p.w,
      d: p.d,
      kind: p.kind,
      surface: ROOM_KIND_SURFACE[p.kind],
      proposed: true,
    }));
}

/** The new floors the review would make, as levels the map can show while it lasts. */
export function proposedLevels(review: Review, words: ReviewWords, existing: number): Level[] {
  return review.floors
    .filter((f) => isNewLevel(f.levelKey))
    .map((f, i) => {
      const name = f.label ?? words.floor(existing + i + 1);
      return { key: f.levelKey, id: null, name, short: String(existing + i + 1) };
    });
}

/** Positions the engine moved proposals to, back into the review. */
export function fromEngine(review: Review, rooms: readonly Room[]): Review {
  const byId = new Map(rooms.filter((r) => r.proposed).map((r) => [r.id, r]));
  let changed = false;
  const proposals = review.proposals.map((p) => {
    const r = byId.get(p.key);
    if (!r || (r.x === p.x && r.z === p.z && r.w === p.w && r.d === p.d)) return p;
    changed = true;
    return { ...p, x: r.x, z: r.z, w: r.w, d: r.d };
  });
  return changed ? { ...review, proposals } : review;
}

/** How many rooms Add would add. */
export const addCount = (review: Review) => review.proposals.filter((p) => p.on && !p.skip).length;

/** The Add request: new floors in the plan's order, each room in whole centimetres. A level's
 * rooms that went left of or above the map's corner move back onto it as one block. */
export function applyBodyOf(
  review: Review,
  version: string | null,
  keepPlan: boolean,
  words: ReviewWords,
  existingFloors: number,
  /** An existing floor's name, by its level key. */
  levelName: (key: string) => string,
): ApplyPlanBody {
  const live = review.proposals.filter((p) => p.on && !p.skip);
  const levels = [...new Set(live.map((p) => review.floors[p.floor]?.levelKey ?? NO_FLOOR))];
  const floorKeyOf = (levelKey: string) => (levelKey === NO_FLOOR ? null : `f:${levelKey}`);
  let made = 0;
  const floors = levels
    .filter((k) => k !== NO_FLOOR)
    .map((k) => {
      const f = review.floors.find((x) => x.levelKey === k);
      const name = isNewLevel(k)
        ? (f?.label ?? words.floor(existingFloors + ++made))
        : levelName(k);
      return { key: `f:${k}`, id: isNewLevel(k) ? null : k, name };
    });
  const shift = new Map<string, { x: number; z: number }>();
  for (const k of levels) {
    const here = live.filter((p) => (review.floors[p.floor]?.levelKey ?? NO_FLOOR) === k);
    shift.set(k, {
      x: Math.max(0, -Math.min(...here.map((p) => p.x))),
      z: Math.max(0, -Math.min(...here.map((p) => p.z))),
    });
  }
  return {
    version,
    keepPlan,
    floors,
    rooms: live.map((p) => {
      const k = review.floors[p.floor]?.levelKey ?? NO_FLOOR;
      const s = shift.get(k) ?? { x: 0, z: 0 };
      return {
        key: p.key,
        floorKey: floorKeyOf(k),
        placeId: p.use,
        name: p.name.trim() || words.room(1),
        kind: p.kind,
        surface: ROOM_KIND_SURFACE[p.kind],
        x: mToCm(p.x + s.x),
        z: mToCm(p.z + s.z),
        w: mToCm(p.w),
        d: mToCm(p.d),
      };
    }),
  };
}
