/**
 * The location map (1.x, D237): what the server checks and the web draws agree on these.
 *
 * - A **room** is a place on a floor (or at the top of the tree) with a rectangle, a kind and a
 *   floor surface. Floors are places of the built-in `floor` kind.
 * - A **node** is a place or a thing shown in a room with a model from MAP_MODELS, a position,
 *   a quarter turn and, for something standing on a counter or shelf, the node it sits on.
 * - Layout is stored in whole centimetres (`map_nodes`); the web draws in metres.
 *
 * Footprints (`w` × `d`, metres, before a turn) and heights are the shrunk models' measured
 * bounds, or the drawn model's size. `top` is the height something can stand on; `holds` says it
 * is storage with contents. `glb` names a Poly Haven model (CC0) the web ships, `rotFix` turns it
 * to face +z, `simple` names the drawn stand-in used when detailed models are off.
 *
 * Holders (#137): a model with `top` carries small things on it (a desk, a shelf, a box); one with
 * a `mount` carries them another way, on a screen's top edge (a webcam on a monitor), on an arm
 * (monitors on a monitor arm) or hung from hooks (a drill on a tool wall, #138). The saved layout
 * only says which node something is on; how it sits there comes from the holder's model, so the
 * layout's format is the same for all of them.
 *
 * Walls (#138): a model with `wall` hangs on a room's wall (a wall TV, a shelf, a clock), its back
 * to the wall it faces away from, at a height: `wall` is where its middle hangs until someone
 * says otherwise. Which wall comes from its turn (wallOfTurn); the layout stores the height.
 *
 * Sized shapes (#240, #241): a cube shelf and a bookcase are drawn from their numbers, which a
 * node's stored model carries after the shape's key (SizedModelKey). Every other model has one
 * size, its catalogue entry's.
 */

export const MAP_ROOM_KINDS = ['room', 'balcony', 'terrace', 'garden'] as const;
export type MapRoomKind = (typeof MAP_ROOM_KINDS)[number];

export const MAP_SURFACES = ['wood', 'tile', 'concrete', 'deck', 'grass'] as const;
export type MapSurface = (typeof MAP_SURFACES)[number];

/** A room kind's floor until someone picks another. */
export const ROOM_KIND_SURFACE: Readonly<Record<MapRoomKind, MapSurface>> = {
  room: 'wood',
  balcony: 'deck',
  terrace: 'concrete',
  garden: 'grass',
};

export const MAP_TURNS = [0, 90, 180, 270] as const;
export type MapTurn = (typeof MAP_TURNS)[number];

export type MapModelKind = 'furniture' | 'storage' | 'thing';

/**
 * How a holder without a top carries things (#137), in metres from its footprint's middle before
 * a turn (`z` towards its front):
 * - `edge`: a screen's top edge at height `h`, its line `z` from the middle. Small things whose
 *   footprint fits the edge clip on along it (EDGE_FIT).
 * - `arm`: one place per `slots` entry (the offset across), each `z` forward and `h` up, for the
 *   models in `fits`.
 * - `hook` (#138): small things hang in a row along its face (`z` from the middle), their tops at
 *   the hook line `h` (HOOK_FIT): tools on a tool wall, bags on hooks.
 */
export type MapMount = Readonly<
  | { on: 'edge'; h: number; z: number }
  | { on: 'arm'; h: number; z: number; slots: readonly number[]; fits: readonly string[] }
  | { on: 'hook'; h: number; z: number }
>;

export type MapModel = Readonly<{
  w: number;
  d: number;
  h?: number;
  kind: MapModelKind;
  top?: number;
  holds?: boolean;
  small?: boolean;
  mount?: MapMount;
  /** A wall thing (#138): where its middle hangs, in metres above the floor, until changed. */
  wall?: number;
  glb?: string;
  rotFix?: number;
  simple?: string;
}>;

export const MAP_MODELS = {
  sofa: { w: 1.81, d: 0.82, h: 0.71, kind: 'furniture', glb: 'sofa_02', simple: 'sofa' },
  armchair: { w: 0.82, d: 0.99, h: 1.02, kind: 'furniture', glb: 'modern_arm_chair_01' },
  coffee_table: {
    w: 1.2,
    d: 0.6,
    h: 0.39,
    kind: 'furniture',
    top: 0.39,
    glb: 'modern_coffee_table_01',
    rotFix: 90,
    simple: 'coffee_table',
  },
  // The Poly Haven cabinet is 241 KB shrunk, over the 150 KB a model may weigh: drawn instead.
  tv_stand: { w: 2.44, d: 0.52, h: 0.68, kind: 'furniture', top: 0.68, holds: true },
  cube_shelf: {
    w: 1.08,
    d: 0.37,
    h: 1.56,
    kind: 'storage',
    holds: true,
    glb: 'wooden_display_shelves_01',
    rotFix: -90,
  },
  // The fiddle-leaf fig's model is 221 KB shrunk: drawn as a plant instead.
  tall_plant: { w: 0.59, d: 0.63, h: 1.34, kind: 'thing', simple: 'plant' },
  plant: { w: 0.7, d: 0.66, h: 0.84, kind: 'thing', glb: 'potted_plant_02', simple: 'plant' },
  succulent: { w: 0.17, d: 0.18, h: 0.27, kind: 'thing', small: true, glb: 'potted_plant_04' },
  dining_chair: {
    w: 0.43,
    d: 0.58,
    h: 0.97,
    kind: 'furniture',
    glb: 'dining_chair_02',
    simple: 'dchair',
  },
  drawers: { w: 1.14, d: 0.49, h: 1.88, kind: 'storage', holds: true, glb: 'drawer_cabinet' },
  bedside: {
    w: 0.55,
    d: 0.45,
    h: 0.55,
    kind: 'furniture',
    top: 0.55,
    holds: true,
    glb: 'side_table_01',
  },
  metal_shelf: {
    w: 0.59,
    d: 0.5,
    h: 2.14,
    kind: 'storage',
    holds: true,
    glb: 'steel_frame_shelves_02',
    simple: 'shelf_unit',
  },
  tool_cart: {
    w: 1.27,
    d: 0.75,
    h: 0.97,
    kind: 'storage',
    top: 0.96,
    holds: true,
    glb: 'tool_cart',
  },
  drill: {
    w: 0.18,
    d: 0.06,
    h: 0.19,
    kind: 'thing',
    small: true,
    glb: 'Drill_01',
    simple: 'drill',
  },
  cardboard: {
    w: 0.39,
    d: 0.52,
    h: 0.34,
    kind: 'storage',
    top: 0.34,
    holds: true,
    small: true,
    glb: 'cardboard_box_01',
    simple: 'box',
  },
  crate: {
    w: 0.51,
    d: 0.41,
    h: 0.25,
    kind: 'storage',
    holds: true,
    small: true,
    glb: 'plastic_crate_02',
  },
  basket: {
    w: 0.35,
    d: 0.25,
    h: 0.2,
    kind: 'storage',
    holds: true,
    small: true,
    glb: 'wicker_basket_02',
  },
  outdoor_set: {
    w: 1.72,
    d: 0.74,
    h: 0.86,
    kind: 'furniture',
    glb: 'outdoor_table_chair_set_01',
    rotFix: 90,
  },
  monobloc: { w: 0.64, d: 0.63, h: 0.88, kind: 'furniture', glb: 'plastic_monobloc_chair_01' },
  planter: { w: 0.91, d: 0.41, h: 0.43, kind: 'thing', glb: 'planter_box_01' },
  planter_long: { w: 1.25, d: 0.47, h: 0.45, kind: 'thing', glb: 'planter_box_02' },
  ac_unit: { w: 1.8, d: 0.37, h: 0.93, kind: 'thing', glb: 'exterior_aircon_unit' },
  watering_can: {
    w: 0.45,
    d: 0.19,
    h: 0.2,
    kind: 'thing',
    small: true,
    glb: 'watering_can_metal_01',
    rotFix: 90,
  },
  // Drawn: modern appliances and pieces the free library doesn't have.
  tv: { w: 1.24, d: 0.26, kind: 'thing', mount: { on: 'edge', h: 0.83, z: 0 } },
  bookshelf: { w: 1.2, d: 0.35, kind: 'storage', holds: true },
  // Sized shapes (#240, #241): these are their first sizes; a node's model can carry others.
  /** A cube shelf drawn from its grid: 2 cubes across and 2 up. Small things stand on top. */
  cube_grid: { w: 0.77, d: 0.39, h: 0.77, kind: 'storage', top: 0.77, holds: true },
  /** A bookcase drawn from its size, 80 × 28 × 202 cm, with 6 levels. */
  bookcase: { w: 0.8, d: 0.28, h: 2.02, kind: 'storage', holds: true },
  lamp: { w: 0.4, d: 0.4, kind: 'thing' },
  counter: { w: 1.8, d: 0.62, kind: 'furniture', top: 0.92, holds: true },
  sink: { w: 1.2, d: 0.62, kind: 'furniture', top: 0.92, holds: true },
  fridge: { w: 0.7, d: 0.7, kind: 'thing' },
  coffee_machine: { w: 0.3, d: 0.36, kind: 'thing' },
  microwave: { w: 0.5, d: 0.38, kind: 'thing' },
  dining: { w: 1.6, d: 0.9, kind: 'furniture', top: 0.75 },
  bed: { w: 1.7, d: 2.15, kind: 'furniture' },
  wardrobe: { w: 1.5, d: 0.6, kind: 'storage', holds: true },
  table_lamp: { w: 0.3, d: 0.3, kind: 'thing', small: true },
  desk: { w: 1.4, d: 0.7, kind: 'furniture', top: 0.74, holds: true },
  // A screen's top edge carries a webcam or a small speaker (#137): its height and its line, from
  // the drawn model (draw.ts).
  monitor: { w: 0.62, d: 0.22, kind: 'thing', mount: { on: 'edge', h: 0.545, z: 0.03 } },
  laptop: {
    w: 0.31,
    d: 0.22,
    kind: 'thing',
    small: true,
    mount: { on: 'edge', h: 0.215, z: -0.06 },
  },
  // Monitor arms (#137): a 10 cm clamp and a 45 cm pole on a desk; one or two monitors 22 cm in
  // front of the pole, raised 8 cm (their own stands aren't drawn there).
  monitor_arm: {
    w: 0.1,
    d: 0.1,
    h: 0.45,
    kind: 'thing',
    small: true,
    mount: { on: 'arm', h: 0.08, z: 0.22, slots: [0], fits: ['monitor'] },
  },
  dual_monitor_arm: {
    w: 0.1,
    d: 0.1,
    h: 0.45,
    kind: 'thing',
    small: true,
    mount: { on: 'arm', h: 0.08, z: 0.22, slots: [-0.32, 0.32], fits: ['monitor'] },
  },
  // Everyday electronics, drawn at their real sizes (#130).
  pc_tower: { w: 0.2, d: 0.43, h: 0.45, kind: 'thing', small: true },
  keyboard: { w: 0.44, d: 0.14, h: 0.03, kind: 'thing', small: true },
  mouse: { w: 0.065, d: 0.115, h: 0.04, kind: 'thing', small: true },
  webcam: { w: 0.1, d: 0.06, h: 0.08, kind: 'thing', small: true },
  camera: { w: 0.13, d: 0.1, h: 0.1, kind: 'thing', small: true },
  speaker: { w: 0.16, d: 0.22, h: 0.27, kind: 'thing', small: true },
  /** A Bluetooth speaker you carry about (a JBL Flip, a UE Boom). */
  portable_speaker: { w: 0.18, d: 0.07, h: 0.07, kind: 'thing', small: true },
  floor_speaker: { w: 0.2, d: 0.28, h: 1.0, kind: 'thing' },
  /** A party speaker with a handle, standing on the floor (a JBL PartyBox). */
  boombox: { w: 0.35, d: 0.2, h: 0.55, kind: 'thing' },
  smart_speaker: { w: 0.1, d: 0.1, h: 0.15, kind: 'thing', small: true },
  soundbar: { w: 0.9, d: 0.1, h: 0.07, kind: 'thing', small: true },
  headphones: { w: 0.18, d: 0.09, h: 0.2, kind: 'thing', small: true },
  /** Over-ear headphones with a boom microphone. */
  headset: { w: 0.19, d: 0.1, h: 0.21, kind: 'thing', small: true },
  /** A charging case with two buds beside it. */
  earbuds: { w: 0.08, d: 0.07, h: 0.03, kind: 'thing', small: true },
  router: { w: 0.24, d: 0.15, h: 0.2, kind: 'thing', small: true },
  printer: { w: 0.43, d: 0.36, h: 0.2, kind: 'thing', small: true },
  console: { w: 0.3, d: 0.26, h: 0.07, kind: 'thing', small: true },
  controller: { w: 0.16, d: 0.1, h: 0.05, kind: 'thing', small: true },
  phone: { w: 0.075, d: 0.155, h: 0.01, kind: 'thing', small: true },
  tablet: { w: 0.25, d: 0.18, h: 0.01, kind: 'thing', small: true },
  power_strip: { w: 0.3, d: 0.06, h: 0.04, kind: 'thing', small: true },
  external_drive: { w: 0.08, d: 0.12, h: 0.02, kind: 'thing', small: true },
  // Homelab gear (#171), drawn at typical retail sizes. A mini PC the size of a NUC; a four-bay
  // NAS; a Raspberry Pi in its case; a 19-inch 24-port switch and a patch panel, each 1U (4.4 cm)
  // high, the panel with its rack ears; a tower UPS.
  mini_pc: { w: 0.12, d: 0.12, h: 0.05, kind: 'thing', small: true },
  nas: { w: 0.2, d: 0.22, h: 0.17, kind: 'thing', small: true },
  sbc: { w: 0.09, d: 0.065, h: 0.03, kind: 'thing', small: true },
  network_switch: { w: 0.44, d: 0.18, h: 0.044, kind: 'thing', small: true },
  patch_panel: { w: 0.48, d: 0.05, h: 0.044, kind: 'thing', small: true },
  ups: { w: 0.1, d: 0.36, h: 0.24, kind: 'thing', small: true },
  /** A small gadget with no model of its own (a hub, a thermostat, a charger): D249. */
  device: { w: 0.2, d: 0.14, h: 0.1, kind: 'thing', small: true },
  chair: { w: 0.66, d: 0.66, kind: 'furniture' },
  cabinet: { w: 0.47, d: 0.62, kind: 'storage', holds: true },
  // Server racks (#171): 19-inch cabinets that hold the gear inside them, standing on the floor.
  // A 24U is a half-height rack, a 42U a full one.
  rack_24u: { w: 0.6, d: 0.8, h: 1.2, kind: 'storage', holds: true },
  rack_42u: { w: 0.6, d: 1.0, h: 2.0, kind: 'storage', holds: true },
  box: { w: 0.6, d: 0.4, kind: 'storage', holds: true, small: true, top: 0.34 },
  washer: { w: 0.6, d: 0.6, kind: 'thing' },
  workbench: { w: 1.8, d: 0.7, kind: 'furniture', top: 0.92, holds: true },
  // On a wall (#138), drawn at real sizes. The tool wall is a 1.2 × 0.6 m pegboard over a bench:
  // tools hang from its hooks, their tops 5 cm under its top edge.
  tool_wall: {
    w: 1.2,
    d: 0.03,
    h: 0.6,
    kind: 'storage',
    holds: true,
    mount: { on: 'hook', h: 0.55, z: 0.015 },
    wall: 1.3,
  },
  /** A 55-inch TV on a wall bracket: its middle at a seated person's eye level. */
  wall_tv: {
    w: 1.23,
    d: 0.06,
    h: 0.71,
    kind: 'thing',
    mount: { on: 'edge', h: 0.71, z: 0 },
    wall: 1.2,
  },
  /** A floating shelf: small things stand on it. */
  wall_shelf: { w: 0.8, d: 0.22, h: 0.04, kind: 'storage', top: 0.04, holds: true, wall: 1.5 },
  /** A kitchen wall cabinet, its bottom about 50 cm above a counter. */
  wall_cabinet: { w: 0.8, d: 0.35, h: 0.7, kind: 'storage', holds: true, wall: 1.75 },
  /** Wall-mounted 19-inch racks (#171), 6U and 12U, holding the gear inside them. */
  rack_wall_6u: { w: 0.6, d: 0.4, h: 0.37, kind: 'storage', holds: true, wall: 1.5 },
  rack_wall_12u: { w: 0.6, d: 0.4, h: 0.64, kind: 'storage', holds: true, wall: 1.4 },
  /** A framed picture or a mirror. */
  picture: { w: 0.7, d: 0.03, h: 0.5, kind: 'thing', wall: 1.5 },
  clock: { w: 0.3, d: 0.05, h: 0.3, kind: 'thing', wall: 1.8 },
  /** A coat rail of five hooks: bags and coats hang from it. */
  hooks: {
    w: 0.6,
    d: 0.08,
    h: 0.1,
    kind: 'storage',
    holds: true,
    mount: { on: 'hook', h: 0.06, z: 0.04 },
    wall: 1.7,
  },
  car: { w: 1.78, d: 4.6, kind: 'thing' },
  bike: { w: 0.6, d: 1.75, kind: 'thing' },
  water_tank: { w: 1.1, d: 1.1, kind: 'thing' },
  dish: { w: 0.9, d: 0.9, kind: 'thing' },
  stairs: { w: 1.0, d: 2.8, kind: 'furniture' },
  stairwell: { w: 1.0, d: 2.8, kind: 'furniture' },
  /** A zone of a room with nothing to draw but its floor (a corner, an area). */
  zone: { w: 1.2, d: 1.2, h: 0.02, kind: 'storage', holds: true },
  /** Anything else: a small plain block. */
  item: { w: 0.4, d: 0.3, h: 0.3, kind: 'thing', small: true },
} as const satisfies Record<string, MapModel>;

/** A shape in the catalogue (the picker, the names, the pictures). */
export type MapModelKey = keyof typeof MAP_MODELS;
export const MAP_MODEL_KEYS = Object.keys(MAP_MODELS) as MapModelKey[];

// ---- Sized shapes (#240, #241) -----------------------------------------------------------------

/**
 * A cube shelf's grid, `across` × `up` cubes (lying down is the same unit with the numbers
 * swapped: 1 × 4 standing, 4 × 1 lying); a bookcase's width, depth and height in centimetres and
 * its levels, the spaces things stand in, the bottom one included.
 */
export type SizedShape =
  | { base: 'cube_grid'; across: number; up: number }
  | { base: 'bookcase'; w: number; d: number; h: number; levels: number };

/**
 * A sized shape as a node stores it, its numbers after its key: `cube_grid_3x2` (3 across, 2 up),
 * `bookcase_60x28x106_3` (centimetres, then levels). Its first size is the bare key. One spelling
 * per size, so the layout's format, the API and the database's check stay as they were.
 */
export type SizedModelKey =
  | `cube_grid_${number}x${number}`
  | `bookcase_${number}x${number}x${number}_${number}`;

/** What a node's model may be: a catalogue shape, or a sized shape with its numbers. */
export type MapShapeKey = MapModelKey | SizedModelKey;

/** A cube shelf in centimetres: 33 cm cubes between 2 cm dividers in a 4.5 cm frame, 39 cm
 * deep, so n cubes measure 35n + 7 (2 × 2 is 77 × 39 × 77, 4 × 4 is 147 × 39 × 147). */
export const CUBE_GRID = {
  cube: 33,
  divider: 2,
  frame: 4.5,
  depth: 39,
  max: 8,
  start: { across: 2, up: 2 },
} as const;

/** A bookcase's limits in centimetres, and its first size. */
export const BOOKCASE = {
  w: [30, 240],
  d: [15, 60],
  h: [40, 300],
  levels: [1, 12],
  start: { w: 80, d: 28, h: 202, levels: 6 },
} as const;

/** A cube shelf's side in centimetres for `n` cubes. */
export const cubeRunCm = (n: number): number =>
  2 * CUBE_GRID.frame + n * CUBE_GRID.cube + (n - 1) * CUBE_GRID.divider;

/** How many levels a bookcase this high (cm) can have: one every 15 cm at most. */
export const bookcaseMaxLevels = (h: number): number =>
  Math.max(BOOKCASE.levels[0], Math.min(BOOKCASE.levels[1], Math.floor(h / 15)));

const within = (v: number, [lo, hi]: readonly [number, number]) =>
  Number.isInteger(v) && v >= lo && v <= hi;

/** Whether a sized shape's numbers are in range (any spelling aside). */
function sizedOk(s: SizedShape): boolean {
  if (s.base === 'cube_grid')
    return within(s.across, [1, CUBE_GRID.max]) && within(s.up, [1, CUBE_GRID.max]);
  return (
    within(s.w, BOOKCASE.w) &&
    within(s.d, BOOKCASE.d) &&
    within(s.h, BOOKCASE.h) &&
    within(s.levels, [BOOKCASE.levels[0], bookcaseMaxLevels(s.h)])
  );
}

const isStart = (s: SizedShape): boolean => {
  if (s.base === 'cube_grid')
    return s.across === CUBE_GRID.start.across && s.up === CUBE_GRID.start.up;
  const a = BOOKCASE.start;
  return s.w === a.w && s.d === a.d && s.h === a.h && s.levels === a.levels;
};

/** A sized shape's stored model: its bare key at its first size. */
export function sizedKey(s: SizedShape): MapShapeKey {
  if (isStart(s)) return s.base;
  return s.base === 'cube_grid'
    ? `cube_grid_${s.across}x${s.up}`
    : `bookcase_${s.w}x${s.d}x${s.h}_${s.levels}`;
}

const SIZED_KEY =
  /^(cube_grid|bookcase)_([1-9][0-9]{0,2})x([1-9][0-9]{0,2})(?:x([1-9][0-9]{0,2})_([1-9][0-9]?))?$/;

/** A sized shape's numbers from a stored model (a bare key gives its first size), or null for
 * any other model and for numbers out of range or spelled another way. */
export function sizedOf(key: string): SizedShape | null {
  if (key === 'cube_grid') return { base: 'cube_grid', ...CUBE_GRID.start };
  if (key === 'bookcase') return { base: 'bookcase', ...BOOKCASE.start };
  const m = SIZED_KEY.exec(key);
  if (!m) return null;
  const [, base, a, b, c, levels] = m;
  const s: SizedShape | null =
    base === 'cube_grid' && c === undefined
      ? { base, across: Number(a), up: Number(b) }
      : base === 'bookcase' && c !== undefined
        ? { base, w: Number(a), d: Number(b), h: Number(c), levels: Number(levels) }
        : null;
  return s && sizedOk(s) && sizedKey(s) === key ? s : null;
}

/** The catalogue shape a stored model is (a sized shape's key without its numbers). */
export const baseModel = (key: MapShapeKey): MapModelKey =>
  Object.hasOwn(MAP_MODELS, key) ? (key as MapModelKey) : (sizedOf(key)?.base ?? 'item');

/** A sized shape's model: its catalogue entry at its own size. */
function sizedModel(s: SizedShape): MapModel {
  if (s.base === 'bookcase')
    return { ...MAP_MODELS.bookcase, w: s.w / 100, d: s.d / 100, h: s.h / 100 };
  const h = cubeRunCm(s.up) / 100;
  return { ...MAP_MODELS.cube_grid, w: cubeRunCm(s.across) / 100, h, top: h };
}

const SIZED = new Map<string, MapModel>();
/** Keys come from requests too: the cache starts over past this, never growing with them. */
const SIZED_MAX = 256;
/** How many sized models are cached (tests). */
export const sizedCacheSize = () => SIZED.size;

export const isMapModel = (key: unknown): key is MapShapeKey =>
  typeof key === 'string' && (Object.hasOwn(MAP_MODELS, key) || sizedOf(key) !== null);

/** A model's numbers, widened (the catalogue is `as const`); a sized shape's at its size. */
export function mapModel(key: MapShapeKey): MapModel {
  if (Object.hasOwn(MAP_MODELS, key)) return MAP_MODELS[key as MapModelKey] as MapModel;
  let m = SIZED.get(key);
  if (!m) {
    const s = sizedOf(key);
    m = s ? sizedModel(s) : MAP_MODELS.item;
    if (SIZED.size >= SIZED_MAX) SIZED.clear();
    SIZED.set(key, m);
  }
  return m;
}

/** Models that lead up or down a floor: their card offers the floors next to theirs. */
export const STAIR_MODELS: ReadonlySet<MapModelKey> = new Set(['stairs', 'stairwell']);

/** Limits of one arrangement (PUT /api/v1/locations/:id/layout). */
export const MAP_LIMITS = {
  rooms: 400,
  nodes: 3000,
  /** Positions, in centimetres from the floor's corner: up to a kilometre. */
  maxCoord: 100_000,
  /** A room's side, in centimetres. */
  minRoom: 100,
  maxRoom: 10_000,
  /** How high a thing on a wall hangs, in centimetres (HANG_TOP; #138). */
  maxHeight: 300,
} as const;

/** A footprint (metres) after a quarter turn. */
export function footprintOf(key: MapShapeKey, rot: number): { w: number; d: number } {
  const m = mapModel(key);
  return rot % 180 ? { w: m.d, d: m.w } : { w: m.w, d: m.d };
}

export type MapRect = { x: number; z: number; w: number; d: number };

/** Whether two rectangles overlap (touching edges don't). */
export function rectsOverlap(a: MapRect, b: MapRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.z < b.z + b.d && a.z + a.d > b.z;
}

/** The first pair of rectangles in `rects` that overlap, by index, or null. */
export function firstOverlap(rects: readonly MapRect[]): [number, number] | null {
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      if (a && b && rectsOverlap(a, b)) return [i, j];
    }
  }
  return null;
}

/** A model something small can stand on (a counter, a desk, a shelf top, a box). */
export const canHost = (key: MapShapeKey): boolean => mapModel(key).top !== undefined;

/** Only things and small storage go on top of something; never a wall thing,
 * which hangs on its wall (#138). */
export const canStandOn = (key: MapShapeKey): boolean => {
  const m = mapModel(key);
  return m.wall === undefined && (m.kind === 'thing' || m.small === true);
};

export type MapCarry = 'top' | 'edge' | 'arm' | 'hook';

/** How a model carries things (#137, #138): on its top, on a screen's edge, on an arm, from its
 * hooks, or not at all. */
export function carryOf(key: MapShapeKey): MapCarry | null {
  const m = mapModel(key);
  if (m.top !== undefined) return 'top';
  return m.mount?.on ?? null;
}

/** What clips onto a screen's top edge: a small thing at most this deep and high (a webcam, a
 * smart speaker, a light), no wider than the screen, and no holder itself. */
export const EDGE_FIT = { d: 0.12, h: 0.2 } as const;

/** What hangs from a hook (#138): a small thing at most this high (a drill, headphones, a bag),
 * no wider than the board, and no holder itself. A thing with no height counts as `h`. */
export const HOOK_FIT = { h: 0.6, unknown: 0.3 } as const;

/** Whether `host` can carry `child` (the server's check and the web's). */
export function canCarry(host: MapShapeKey, child: MapShapeKey): boolean {
  const h = mapModel(host);
  const c = mapModel(child);
  if (h.top !== undefined) return canStandOn(child);
  if (h.mount?.on === 'edge') {
    return (
      c.kind === 'thing' &&
      c.small === true &&
      !c.mount &&
      c.d <= EDGE_FIT.d &&
      c.h !== undefined &&
      c.h <= EDGE_FIT.h &&
      c.w <= h.w
    );
  }
  if (h.mount?.on === 'arm') return h.mount.fits.includes(child);
  if (h.mount?.on === 'hook') {
    return (
      c.kind === 'thing' &&
      c.small === true &&
      !c.mount &&
      c.top === undefined &&
      c.wall === undefined &&
      (c.h ?? HOOK_FIT.unknown) <= HOOK_FIT.h &&
      c.w <= h.w
    );
  }
  return false;
}

/** How many things a holder carries at most: an arm one per place, anything else no limit. */
export function capacityOf(key: MapShapeKey): number {
  const m = mapModel(key).mount;
  return m?.on === 'arm' ? m.slots.length : Number.POSITIVE_INFINITY;
}

/** The height what a holder carries stands at, above the holder's own base. */
export function seatHeight(key: MapShapeKey): number {
  const m = mapModel(key);
  return m.top ?? m.mount?.h ?? 0;
}

/** Where a carried thing's base is, above its holder's base: at the holder's seat, or, hung from
 * a hook (#138), so that its top is at the hook line. */
export function seatFor(host: MapShapeKey, child: MapShapeKey): number {
  const m = mapModel(host).mount;
  if (m?.on === 'hook') return Math.max(0, m.h - (mapModel(child).h ?? HOOK_FIT.unknown));
  return seatHeight(host);
}

/**
 * Whether `child` belongs on `host` when someone picks a holder from a list (Put on…, Add on it):
 * it can carry it, and on a top it fits inside the top's footprint either way round. Dragging
 * keeps the looser canCarry, as before.
 */
export function fitsOn(host: MapShapeKey, child: MapShapeKey): boolean {
  if (!canCarry(host, child)) return false;
  if (carryOf(host) !== 'top') return true;
  const h = mapModel(host);
  const c = mapModel(child);
  return (c.w <= h.w && c.d <= h.d) || (c.d <= h.w && c.w <= h.d);
}

/** Whether a model could be carried by some holder from a list (it gets Put on…). */
export const canBeCarried = (key: MapShapeKey): boolean =>
  mapModel(key).small === true ||
  MAP_MODEL_KEYS.some((h) => carryOf(h) === 'arm' && canCarry(h, key));

/**
 * A point in a holder's own frame (`x` across, `z` towards its front, from its footprint's middle)
 * turned as the holder is: the map turns a model by `rot` degrees the way three.js turns about y
 * by −rot (engine.ts placeItem).
 */
export function turnOffset(x: number, z: number, rot: number): { x: number; z: number } {
  const a = (-rot * Math.PI) / 180;
  const c = Math.round(Math.cos(a));
  const s = Math.round(Math.sin(a));
  return { x: x * c + z * s, z: -x * s + z * c };
}

/** The other way: a point near a turned holder back in the holder's own frame. */
export function unturnOffset(x: number, z: number, rot: number): { x: number; z: number } {
  return turnOffset(x, z, (360 - (rot % 360)) % 360);
}

/**
 * The drag's grid (#137): about a centimetre for small things (a webcam moves a centimetre, not a
 * webcam), 5 cm for things, 10 cm for furniture and storage, as before. In metres.
 */
export function snapStep(key: MapShapeKey): number {
  const m = mapModel(key);
  if (m.small || Math.max(m.w, m.d) < 0.3) return 0.01;
  return m.kind === 'thing' ? 0.05 : 0.1;
}

// ---- Walls (#138) ------------------------------------------------------------------------------

/** The shapes that hang on a wall. */
export const WALL_MODELS: readonly MapModelKey[] = MAP_MODEL_KEYS.filter(
  (k) => mapModel(k).wall !== undefined,
);

export const isWallModel = (key: MapShapeKey): boolean => mapModel(key).wall !== undefined;

/** A room's four walls: the side of the room each stands on. */
export type MapWall = '-x' | '+x' | '-z' | '+z';
export const MAP_WALLS: readonly MapWall[] = ['-z', '+x', '+z', '-x'];

/** A wall's thickness inside its room, in metres: what a wall thing hangs flat against. */
export const WALL_T = 0.1;

/** Nothing hangs higher than this (metres): a room's usual height. */
export const HANG_TOP = 3;

/** Where a wall thing's middle may hang: its bottom on the floor at the lowest, its top at
 * HANG_TOP at the highest. Metres. */
export function hangRange(key: MapShapeKey): { min: number; max: number } {
  const half = (mapModel(key).h ?? 0.3) / 2;
  return { min: half, max: HANG_TOP - half };
}

/** A height in the range, to the centimetre. */
export function clampHang(key: MapShapeKey, h: number): number {
  const r = hangRange(key);
  return Math.round(Math.min(r.max, Math.max(r.min, h)) * 100) / 100;
}

/** The wall at a thing's back, from its turn: a thing on a wall faces into the room. */
export function wallOfTurn(rot: number): MapWall {
  const r = (((Math.round(rot / 90) * 90) % 360) + 360) % 360;
  return r === 90 ? '+x' : r === 180 ? '+z' : r === 270 ? '-x' : '-z';
}

/** The turn of a thing on `wall`. */
export function turnOfWall(wall: MapWall): MapTurn {
  return wall === '+x' ? 90 : wall === '+z' ? 180 : wall === '-x' ? 270 : 0;
}

/** The wall nearest a point of a room (metres from its corner); outside, the one it is beyond. */
export function nearestWall(room: { w: number; d: number }, p: { x: number; z: number }): MapWall {
  const gaps: [MapWall, number][] = [
    ['-z', p.z],
    ['+x', room.w - p.x],
    ['+z', room.d - p.z],
    ['-x', p.x],
  ];
  let best = gaps[0] as [MapWall, number];
  for (const g of gaps) if (g[1] < best[1]) best = g;
  return best[0];
}

/**
 * Where a wall thing's footprint corner goes (metres from the room's corner): flat against
 * `wall`, `along` metres along it (the footprint's start, x on a −z or +z wall, z on the others),
 * kept inside the walls at its ends. Its width runs along the wall, its depth into the room.
 */
export function wallSpot(
  room: { w: number; d: number },
  key: MapShapeKey,
  wall: MapWall,
  along: number,
): { x: number; z: number } {
  const m = mapModel(key);
  const length = wall === '-z' || wall === '+z' ? room.w : room.d;
  const a = Math.max(WALL_T, Math.min(length - WALL_T - m.w, along));
  if (wall === '-z') return { x: a, z: WALL_T };
  if (wall === '+z') return { x: a, z: room.d - WALL_T - m.d };
  if (wall === '-x') return { x: WALL_T, z: a };
  return { x: room.w - WALL_T - m.d, z: a };
}

/** How far a node is from where it would hang on the wall its turn puts at its back (metres):
 * the server's check of a thing on a wall. */
export function offWall(
  room: { w: number; d: number },
  key: MapShapeKey,
  node: { x: number; z: number; rot: number },
): number {
  const wall = wallOfTurn(node.rot);
  const at = wallSpot(room, key, wall, wall === '-z' || wall === '+z' ? node.x : node.z);
  return Math.hypot(node.x - at.x, node.z - at.z);
}

/** Words in a name that pick a model (lower case, whole words or word starts). First match wins. */
const NAME_MODELS: readonly (readonly [RegExp, MapModelKey])[] = [
  [/\b(stair|stairs|staircase)\b/, 'stairs'],
  [/\b(tv|television)\b/, 'tv'],
  [/\b(sofa|couch|settee)\b/, 'sofa'],
  [/\barm ?chair\b/, 'armchair'],
  [/\bcoffee table\b/, 'coffee_table'],
  [/\b(tv stand|tv unit|sideboard|media unit)\b/, 'tv_stand'],
  [/\b(bookshelf|bookcase)\b/, 'bookshelf'],
  [/\b(cube shelf|display shelf)\b/, 'cube_shelf'],
  [/\b(shelf|shelves|shelving|rack)\b/, 'metal_shelf'],
  [/\b(wardrobe|closet|pantry|cupboard)\b/, 'wardrobe'],
  [/\b(drawers|dresser|chest)\b/, 'drawers'],
  [/\b(bedside|nightstand|night stand)\b/, 'bedside'],
  [/\bbed\b/, 'bed'],
  [/\b(desk)\b/, 'desk'],
  [/\b(workbench|work bench)\b/, 'workbench'],
  [/\b(tool wall|pegboard)\b/, 'tool_wall'],
  [/\btool (cart|trolley|chest)\b/, 'tool_cart'],
  [/\b(filing cabinet|cabinet)\b/, 'cabinet'],
  [/\b(sink)\b/, 'sink'],
  [/\b(counter|worktop|kitchen unit)\b/, 'counter'],
  [/\b(fridge|refrigerator|freezer)\b/, 'fridge'],
  [/\b(washing machine|washer|dryer)\b/, 'washer'],
  [/\b(microwave|oven)\b/, 'microwave'],
  [/\b(coffee machine|espresso|coffee maker)\b/, 'coffee_machine'],
  [/\b(dining table|table)\b/, 'dining'],
  [/\b(desk chair|office chair)\b/, 'chair'],
  [/\b(plastic chair|garden chair)\b/, 'monobloc'],
  [/\bchair\b/, 'dining_chair'],
  [/\b(monitor|screen|display)\b/, 'monitor'],
  [/\b(laptop|macbook|notebook computer)\b/, 'laptop'],
  [/\b(table lamp|desk lamp|bedside lamp)\b/, 'table_lamp'],
  [/\blamp\b/, 'lamp'],
  [/\b(drill|driver)\b/, 'drill'],
  [/\b(bike|bicycle)\b/, 'bike'],
  [/\b(car|van|truck|suv)\b/, 'car'],
  [/\b(water tank|tank)\b/, 'water_tank'],
  [/\b(satellite|dish)\b/, 'dish'],
  [/\b(ac|air ?con|air conditioner|condenser)\b/, 'ac_unit'],
  [/\bplanter\b/, 'planter'],
  [/\b(succulent|cactus)\b/, 'succulent'],
  [/\b(tree|fig|palm)\b/, 'tall_plant'],
  [/\bplant\b/, 'plant'],
  [/\bwatering can\b/, 'watering_can'],
  [/\b(crate|bin|tub)\b/, 'crate'],
  [/\bbasket\b/, 'basket'],
  [/\b(moving box|carton|cardboard)\b/, 'cardboard'],
  [/\bbox\b/, 'box'],
];

/** A built-in type's model when the name says nothing. */
const TYPE_MODELS: Readonly<Record<string, MapModelKey>> = {
  car: 'car',
  vehicle: 'car',
  motorbike: 'bike',
  bicycle: 'bike',
  tv_display: 'tv',
  computer: 'laptop',
  large_appliance: 'fridge',
  small_appliance: 'microwave',
  power_tool: 'drill',
  tool: 'tool_cart',
  box_bin: 'box',
  safe: 'cabinet',
  furniture: 'cabinet',
  generator: 'ac_unit',
};

/** A place kind's model when the name says nothing. */
const KIND_MODELS: Readonly<Record<string, MapModelKey>> = {
  closet: 'wardrobe',
  zone: 'zone',
  room: 'zone',
};

export type GuessInput = {
  name: string | null;
  subject: 'place' | 'thing';
  /** A place's kind key. */
  kindKey?: string | null;
  /** A thing's built-in type key (its own or its type's ancestor's). */
  typeKey?: string | null;
  isContainer?: boolean;
};

/**
 * The model a place or thing gets until someone picks one: from words in its name, then its
 * type or place kind, then storage for places and containers, a box for anything else.
 */
export function guessModel(input: GuessInput): MapModelKey {
  const name = (input.name ?? '').toLowerCase();
  for (const [re, key] of NAME_MODELS) if (re.test(name)) return key;
  if (input.subject === 'thing' && input.typeKey && TYPE_MODELS[input.typeKey]) {
    return TYPE_MODELS[input.typeKey] as MapModelKey;
  }
  if (input.subject === 'place') return KIND_MODELS[input.kindKey ?? ''] ?? 'metal_shelf';
  return input.isContainer ? 'box' : 'item';
}

/**
 * A floor's button: the first number in its name, in the digits it was written in ("Floor 2" →
 * "2", "الطابق ٢" → "٢"), else the first letter of its first word ("Ground floor" → "G",
 * "Roof" → "R"), else its position from the ground. An Arabic word's article ال is skipped:
 * nearly every Arabic floor name starts with it, so every button would read ا ("الطابق الأرضي"
 * → "ط", "السطح" → "س").
 */
export function levelShort(name: string | null, index: number): string {
  const n = (name ?? '').trim();
  const digits = /\p{Nd}+/u.exec(n);
  if (digits) return [...digits[0]].slice(0, 3).join('');
  const word = /\p{L}+/u.exec(n)?.[0] ?? '';
  const letter = word.length > 2 && word.startsWith('ال') ? word[2] : word[0];
  return letter ? letter.toLocaleUpperCase() : String(index);
}

/** Centimetres → metres, and back (layout is stored in whole centimetres). */
export const cmToM = (cm: number): number => cm / 100;
export const mToCm = (m: number): number => Math.round(m * 100);
