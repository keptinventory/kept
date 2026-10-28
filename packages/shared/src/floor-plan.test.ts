import { describe, expect, it } from 'vitest';
import { estimateImageTokens, PROVIDER_KINDS } from './ai.js';
import { MAX_OUTPUT_TOKENS, PLAN_LIMITS, PlanExtraction, parseLenient } from './extraction.js';
import {
  type AnswerOpts,
  answerFor,
  inventedPlan,
  sentSize,
  type TruthRoom,
} from './floor-plan.fixtures.js';
import {
  draftRooms,
  findScale,
  matchFloors,
  matchRoom,
  PLAN_GUESS_LONG_SIDE,
  type PlanDraft,
  parseLength,
  parseSize,
  placeBeside,
  planEstimate,
  turnDrafts,
} from './floor-plan.js';
import { firstOverlap, MAP_LIMITS, type MapRect, mToCm } from './map.js';

const close = (a: number, b: number, tol = 0.011) => Math.abs(a - b) <= tol;
const pair = (v: [number, number] | null) => v?.map((x) => Math.round(x * 100) / 100) ?? null;

describe('parseSize', () => {
  it.each([
    ['5.20 x 4.10 m', [5.2, 4.1]],
    ['9.40m x 3.30m', [9.4, 3.3]],
    ['5,20 × 4,10 m', [5.2, 4.1]],
    ['520 x 410 cm', [5.2, 4.1]],
    ['5200 x 4100 mm', [5.2, 4.1]],
    [`12'6" x 10'9"`, [3.81, 3.28]],
    [`12' 6" x 10' 9"`, [3.81, 3.28]],
    ['12ft 6in x 10ft 9in', [3.81, 3.28]],
    ['٥٫٢٠ × ٤٫١٠ م', [5.2, 4.1]],
    ['3.4x2.8', [3.4, 2.8]],
    [`30'6" x 10'9"`, [9.3, 3.28]],
    ['3,40 m × 2,80 m', [3.4, 2.8]],
    ['1.2x0.9m', [1.2, 0.9]],
    ['11′ 4″ × 9′ 2″', [3.45, 2.79]],
    ['9.40m x 3.30m 30\'6" x 10\'9"', [9.4, 3.3]],
  ] as const)('%s', (raw, want) => {
    expect(pair(parseSize(raw))).toEqual(want);
  });

  it.each(['about 15 m²', '15 m²', '3.4 m', 'Kitchen', '', '0 x 3 m'])('refuses %j', (raw) => {
    expect(parseSize(raw)).toBeNull();
  });
});

describe('parseLength', () => {
  it.each([
    ['5 m', 5],
    ['0 1 2 3 4 5 m', 5],
    ['500 cm', 5],
    ['10 ft', 3.048],
    ['٣ م', 3],
  ] as const)('%s', (raw, want) => {
    expect(parseLength(raw)).toBeCloseTo(want, 2);
  });
  it('refuses text', () => expect(parseLength('scale')).toBeNull());
});

describe('findScale', () => {
  const rooms = [
    { wPx: 100, hPx: 50, size: [5, 2.5] as [number, number] },
    { wPx: 200, hPx: 100, size: [5, 10] as [number, number] }, // printed the other way round
    { wPx: 80, hPx: 80, size: null },
  ];

  it('typed wins over everything, paired to the box', () => {
    const s = findScale({ rooms, typed: { index: 2, w: 4, d: 4 }, bar: { px: 100, metres: 1 } });
    expect(s.from).toBe('typed');
    expect(s.mPerPx).toBeCloseTo(0.05);
  });

  it('printed sizes: orientation paired to the box, median of those within 15 %', () => {
    const s = findScale({
      rooms: [
        ...rooms,
        { wPx: 100, hPx: 100, size: [8, 8] }, // 0.08 m/px: more than 15 % off, left out
      ],
    });
    expect(s.from).toBe('sizes');
    expect(s.agree).toBe(2);
    expect(s.of).toBe(3);
    expect(s.mPerPx).toBeCloseTo(0.05);
  });

  it('then a scale bar, then doors, then a labelled guess', () => {
    const bare = rooms.map((r) => ({ ...r, size: null }));
    expect(findScale({ rooms: bare, bar: { px: 200, metres: 5 } })).toMatchObject({
      from: 'scale_bar',
      mPerPx: 0.025,
    });
    expect(findScale({ rooms: bare, doorsPx: [40, 40, 41] })).toMatchObject({ from: 'doors' });
    expect(findScale({ rooms: bare, doorsPx: [40, 40, 41] }).mPerPx).toBeCloseTo(0.02);
    // One door is not enough.
    const guess = findScale({ rooms: bare, doorsPx: [40] });
    expect(guess.from).toBe('guess');
    expect(guess.mPerPx).toBeCloseTo(PLAN_GUESS_LONG_SIDE / 200);
  });
});

// ---- The pipeline on the invented plans (§14.1) ------------------------------------------------

type Case = {
  name: string;
  plan: string;
  opts: AnswerOpts;
  typed?: { room: string; w: number; d: number };
  existing?: MapRect[];
  /** The scale source expected. */
  from: string;
  /** Worst size error allowed, metres, for rectangular rooms. */
  worst: number;
};

const CASES: Case[] = [
  {
    name: 'flat, sizes on the rooms, boxes only',
    plan: 'f1-flat-dims',
    opts: { noise: 0.01, corners: 'none' },
    from: 'sizes',
    worst: 0.3,
  },
  {
    name: 'flat, sloppy boxes (±3 %)',
    plan: 'f1-flat-dims',
    opts: { noise: 0.03, corners: 'none' },
    from: 'sizes',
    worst: 0.4,
  },
  {
    name: 'flat beside an existing 4 × 4 m room',
    plan: 'f1-flat-dims',
    opts: { noise: 0.01, corners: 'none' },
    existing: [{ x: 0, z: 0, w: 4, d: 4 }],
    from: 'sizes',
    worst: 0.3,
  },
  {
    name: 'L-shaped room, with corners',
    plan: 'f2-l-shape',
    opts: { noise: 0.005, corners: 'poly-only' },
    from: 'sizes',
    worst: 0.3,
  },
  {
    name: 'two floors, sizes in a table',
    plan: 'f3-two-floors-table',
    opts: { noise: 0.01, corners: 'none' },
    from: 'sizes',
    worst: 0.3,
  },
  {
    name: 'photo at 4°, boxes only',
    plan: 'f4-rotated-4deg',
    opts: { noise: 0.005, corners: 'none' },
    from: 'sizes',
    worst: 0.3,
  },
  {
    name: 'photo at 4°, with corners',
    plan: 'f4-rotated-4deg',
    opts: { noise: 0.005, corners: 'all' },
    from: 'sizes',
    worst: 0.3,
  },
  {
    name: 'sideways (90°)',
    plan: 'f5-sideways',
    opts: { noise: 0.01, corners: 'none' },
    from: 'sizes',
    worst: 0.3,
  },
  {
    name: 'no sizes, a scale bar',
    plan: 'f6-scale-bar-doors',
    opts: {
      noise: 0.01,
      corners: 'none',
      mistakes: (a) => {
        delete a.doors;
      },
    },
    from: 'scale_bar',
    worst: 0.3,
  },
  {
    name: 'no sizes, doors only',
    plan: 'f6-scale-bar-doors',
    opts: {
      noise: 0.01,
      corners: 'none',
      mistakes: (a) => {
        delete a.scale_bar;
      },
    },
    from: 'doors',
    worst: 0.4,
  },
  {
    name: 'feet and inches',
    plan: 'f7-imperial',
    opts: { noise: 0.01, corners: 'none' },
    from: 'sizes',
    worst: 0.3,
  },
  {
    name: 'nothing to scale by: a guess',
    plan: 'f8-no-scale',
    opts: { noise: 0.01, corners: 'none' },
    from: 'guess',
    worst: 1,
  },
  {
    name: 'nothing to scale by, one room typed',
    plan: 'f8-no-scale',
    opts: { noise: 0.01, corners: 'none' },
    typed: { room: 'Living room', w: 5.2, d: 4.1 },
    from: 'typed',
    worst: 0.3,
  },
  {
    name: 'a misread size and a missed room',
    plan: 'f1-flat-dims',
    opts: {
      noise: 0.01,
      corners: 'none',
      mistakes: (a) => {
        const rooms = a.rooms ?? [];
        const b = rooms.find((r) => r.name?.value === 'Bedroom');
        if (b) b.size_text = { value: '4.00 x 8.40 m', confidence: 0.6 };
        a.rooms = rooms.filter((r) => r.name?.value !== 'Hall');
      },
    },
    from: 'sizes',
    worst: 0.3,
  },
];

function run(c: Case) {
  const p = inventedPlan(c.plan);
  const size = sentSize(p);
  const answer = answerFor(p, size.w, size.h, c.opts);
  const typedIndex = c.typed
    ? (answer.rooms ?? []).findIndex((r) => r.name?.value === c.typed?.room)
    : -1;
  const drafts = draftRooms(answer, size, {
    typed: c.typed ? { key: `plan:${typedIndex}`, w: c.typed.w, d: c.typed.d } : null,
  });
  return { p, drafts };
}

const truthOf = (rooms: TruthRoom[], d: PlanDraft) => rooms.find((r) => r.name === d.name);

describe('draftRooms on the invented plans', () => {
  it.each(CASES)('$name', (c) => {
    const { p, drafts } = run(c);
    expect(drafts.isPlan).toBe(true);
    expect(drafts.scale.from).toBe(c.from);
    const live = drafts.rooms.filter((d) => !d.skip);
    for (const f of new Set(live.map((d) => d.floor))) {
      const here = live.filter((d) => d.floor === f);
      expect(
        firstOverlap(
          here.map((d) => ({ x: mToCm(d.x), z: mToCm(d.z), w: mToCm(d.w), d: mToCm(d.d) })),
        ),
      ).toBeNull();
      // Measured from the floor's own corner.
      expect(Math.min(...here.map((d) => d.x))).toBeCloseTo(0, 5);
      expect(Math.min(...here.map((d) => d.z))).toBeCloseTo(0, 5);
    }
    for (const d of live) {
      expect(mToCm(d.w)).toBeGreaterThanOrEqual(MAP_LIMITS.minRoom);
      expect(mToCm(d.d)).toBeGreaterThanOrEqual(MAP_LIMITS.minRoom);
      // On the 10 cm grid (D267).
      for (const v of [d.x, d.z, d.w, d.d]) expect(mToCm(v) % 10).toBe(0);
      const t = truthOf(p.rooms, d);
      if (!t || t.poly) continue;
      const err = Math.min(
        Math.max(Math.abs(d.w - t.w), Math.abs(d.d - t.d)),
        Math.max(Math.abs(d.w - t.d), Math.abs(d.d - t.w)),
      );
      expect(err, `${d.name} ${d.w}×${d.d} vs ${t.w}×${t.d}`).toBeLessThanOrEqual(c.worst + 1e-9);
    }
    // The cupboard (0.9 × 0.7 m) is left out, said so; the others stay in.
    const cupboard = drafts.rooms.find((d) => d.name === 'Cupboard');
    if (cupboard) {
      expect(cupboard.skip).toBe(true);
      expect(cupboard.notes).toContain('too_small');
    }
    // Placed beside the existing rooms: never on them.
    if (c.existing) {
      const shift = placeBeside(
        live,
        c.existing.map((r) => ({ ...r })),
      );
      const placed = live.map((d) => ({ x: d.x + shift.dx, z: d.z + shift.dz, w: d.w, d: d.d }));
      const all = [...c.existing, ...placed].map((r) => ({
        x: mToCm(r.x),
        z: mToCm(r.z),
        w: mToCm(r.w),
        d: mToCm(r.d),
      }));
      expect(firstOverlap(all)).toBeNull();
      expect(Math.min(...placed.map((r) => r.x))).toBeCloseTo(5, 5);
    }
  });

  it('the L-shaped room is drawn as its largest part, with the note', () => {
    const { drafts } = run(CASES.find((c) => c.name.startsWith('L-shaped')) as Case);
    const l = drafts.rooms.find((d) => d.name === 'Living and dining');
    expect(l?.notes).toContain('not_rectangle');
    // Its largest part: 7 × 3.5 m (the top bar), within a grid step or two.
    expect(close(l?.w ?? 0, 7, 0.3)).toBe(true);
    expect(close(l?.d ?? 0, 3.5, 0.3)).toBe(true);
  });

  it('two floors: each from its own corner, labels as printed', () => {
    const { drafts } = run(CASES.find((c) => c.name.startsWith('two floors')) as Case);
    expect(drafts.floors.map((f) => f.label)).toEqual(['Ground floor', 'First floor']);
    expect(drafts.rooms.filter((d) => d.floor === 1)).toHaveLength(6);
  });

  it('corners straighten a plan photographed at an angle', () => {
    const { drafts } = run(CASES.find((c) => c.name === 'photo at 4°, with corners') as Case);
    expect(drafts.skewDeg).toBeGreaterThan(3.5);
    expect(drafts.skewDeg).toBeLessThan(4.5);
  });

  it('a misread size is noted on its room and does not move the scale', () => {
    const { drafts } = run(CASES.find((c) => c.name.startsWith('a misread')) as Case);
    const bed = drafts.rooms.find((d) => d.name === 'Bedroom');
    expect(bed?.notes).toContain('size_disagrees');
    expect(bed?.printed?.text).toBe('4.00 x 8.40 m');
    expect(drafts.scale.agree).toBeLessThan(drafts.scale.of);
    expect(drafts.rooms.some((d) => d.name === 'Hall')).toBe(false);
  });

  it('no scale: said to be a guess; one typed size fixes it', () => {
    const guess = run(CASES.find((c) => c.from === 'guess') as Case).drafts;
    expect(guess.scale.from).toBe('guess');
    const typed = run(CASES.find((c) => c.from === 'typed') as Case).drafts;
    expect(typed.scale.from).toBe('typed');
    expect(typed.scale.typedKey).toMatch(/^plan:\d+$/);
  });

  it('keys follow the answer, names keep their confidence, kinds come from the name', () => {
    const { drafts } = run(CASES[0] as Case);
    expect(drafts.rooms.map((d) => d.key)).toEqual(drafts.rooms.map((_, i) => `plan:${i}`));
    expect(drafts.rooms.find((d) => d.name === 'Balcony')?.kind).toBe('balcony');
    expect(drafts.rooms.find((d) => d.name === 'Kitchen')?.kind).toBe('room');
  });
});

describe('draftRooms on odd answers', () => {
  const box = (x: number, y: number, w: number, h: number) =>
    [x, y, w, h] as [number, number, number, number];

  it('not a plan: no rooms', () => {
    const d = draftRooms(
      { is_plan: false, rooms: [{ box: box(0, 0, 0.5, 0.5) }] },
      { w: 1000, h: 800 },
    );
    expect(d.isPlan).toBe(false);
    expect(d.rooms).toEqual([]);
  });

  it('an unlabelled room has no name; an unclear name is noted', () => {
    const d = draftRooms(
      {
        is_plan: true,
        rooms: [
          { box: box(0.1, 0.1, 0.4, 0.4) },
          { box: box(0.5, 0.1, 0.4, 0.4), name: { value: 'Ktchn', confidence: 0.3 } },
        ],
      },
      { w: 1000, h: 1000 },
    );
    expect(d.rooms[0]?.name).toBeNull();
    expect(d.rooms[1]?.notes).toContain('name_unclear');
    expect(d.floors).toHaveLength(1);
  });

  it('a room on a floor the answer does not have goes on the first', () => {
    const d = draftRooms(
      {
        is_plan: true,
        floors: [{ label: { value: 'Ground', confidence: 0.9 } }],
        rooms: [{ box: box(0.1, 0.1, 0.4, 0.4), floor: 3 }],
      },
      { w: 1000, h: 1000 },
    );
    expect(d.rooms[0]?.floor).toBe(0);
  });

  it('the model’s kind wins over the name', () => {
    const d = draftRooms(
      {
        is_plan: true,
        rooms: [
          {
            box: box(0.1, 0.1, 0.4, 0.4),
            name: { value: 'Room', confidence: 0.9 },
            kind: 'terrace',
          },
        ],
      },
      { w: 1000, h: 1000 },
    );
    expect(d.rooms[0]?.kind).toBe('terrace');
  });
});

// ---- Property test (§16.1) ----------------------------------------------------------------------

function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    return s / 2 ** 31;
  };
}

/** A random rectilinear layout: a grid of rooms with random column and row sizes. */
function randomLayout(rnd: () => number): TruthRoom[] {
  const cols = 1 + Math.floor(rnd() * 4);
  const rows = 1 + Math.floor(rnd() * 3);
  const cw = Array.from({ length: cols }, () => 1.2 + rnd() * 5);
  const rh = Array.from({ length: rows }, () => 1.2 + rnd() * 4);
  const out: TruthRoom[] = [];
  let z = 0;
  for (let r = 0; r < rows; r++) {
    let x = 0;
    for (let c = 0; c < cols; c++) {
      // Some cells merge with the next one across.
      const span = c < cols - 1 && rnd() < 0.25 ? 2 : 1;
      const w = cw.slice(c, c + span).reduce((a, b) => a + b, 0);
      out.push({ name: `Room ${out.length + 1}`, x, z, w, d: rh[r] as number, floor: 0 });
      x += w;
      c += span - 1;
    }
    z += rh[r] as number;
  }
  return out;
}

describe('property: 200 random layouts', () => {
  it('never overlap, stay inside the limits, sit on the 10 cm grid, and place beside anything', () => {
    const rnd = lcg(20261028);
    for (let n = 0; n < 200; n++) {
      const rooms = randomLayout(rnd);
      const ppm = 40 + rnd() * 80;
      const W = Math.ceil(Math.max(...rooms.map((r) => r.x + r.w)) * ppm + 80);
      const H = Math.ceil(Math.max(...rooms.map((r) => r.z + r.d)) * ppm + 80);
      const skew = (rnd() * 2 - 1) * 5 * (Math.PI / 180);
      const noise = rnd() * 0.02;
      let seed = n + 1;
      const jitter = () => {
        seed = (seed * 1103515245 + 12345) % 2 ** 31;
        return ((seed / 2 ** 31) * 2 - 1) * noise;
      };
      const turn = (x: number, y: number): [number, number] => {
        const dx = x - W / 2;
        const dy = y - H / 2;
        const c = Math.cos(skew);
        const s = Math.sin(skew);
        const u = (dx * c - dy * s + W / 2) / W + jitter();
        const v = (dx * s + dy * c + H / 2) / H + jitter();
        return [Math.min(1, Math.max(0, u)), Math.min(1, Math.max(0, v))];
      };
      const withCorners = rnd() < 0.5;
      const answer = {
        is_plan: true,
        rooms: rooms.map((r) => {
          const pts = [
            [r.x, r.z],
            [r.x + r.w, r.z],
            [r.x + r.w, r.z + r.d],
            [r.x, r.z + r.d],
          ].map(([x, z]) => turn(40 + (x as number) * ppm, 40 + (z as number) * ppm));
          const xs = pts.map((p) => p[0]);
          const ys = pts.map((p) => p[1]);
          return {
            name: { value: r.name, confidence: 0.9 },
            box: [
              Math.min(...xs),
              Math.min(...ys),
              Math.max(...xs) - Math.min(...xs),
              Math.max(...ys) - Math.min(...ys),
            ] as [number, number, number, number],
            ...(withCorners ? { corners: pts } : {}),
            ...(rnd() < 0.6
              ? { size_text: { value: `${r.w.toFixed(2)} x ${r.d.toFixed(2)} m`, confidence: 0.8 } }
              : {}),
          };
        }),
      };
      const drafts = draftRooms(answer, { w: W, h: H });
      const live = drafts.rooms.filter((d) => !d.skip);
      const cm = live.map((d) => ({ x: mToCm(d.x), z: mToCm(d.z), w: mToCm(d.w), d: mToCm(d.d) }));
      expect(firstOverlap(cm), `layout ${n}`).toBeNull();
      for (const r of cm) {
        expect(r.w).toBeGreaterThanOrEqual(MAP_LIMITS.minRoom);
        expect(r.d).toBeGreaterThanOrEqual(MAP_LIMITS.minRoom);
        expect(r.w).toBeLessThanOrEqual(MAP_LIMITS.maxRoom);
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.x).toBeLessThanOrEqual(MAP_LIMITS.maxCoord);
        for (const v of [r.x, r.z, r.w, r.d]) expect(v % 10).toBe(0);
      }
      // Beside random existing rooms.
      const existing = Array.from({ length: Math.floor(rnd() * 4) }, (_, i) => ({
        x: i * 6 + Math.round(rnd() * 9) / 10,
        z: Math.round(rnd() * 50) / 10,
        w: 1 + Math.round(rnd() * 40) / 10,
        d: 1 + Math.round(rnd() * 40) / 10,
      }));
      const shift = placeBeside(live, existing);
      const placed = live.map((d) => ({
        x: mToCm(d.x + shift.dx),
        z: mToCm(d.z + shift.dz),
        w: mToCm(d.w),
        d: mToCm(d.d),
      }));
      const ex = existing.map((r) => ({
        x: mToCm(r.x),
        z: mToCm(r.z),
        w: mToCm(r.w),
        d: mToCm(r.d),
      }));
      expect(firstOverlap([...ex, ...placed]), `placed ${n}`).toBeNull();
      for (const r of placed) expect(r.x % 10).toBe(0);
    }
  });
});

describe('turnDrafts', () => {
  it('turns every room a quarter turn about the floor’s corner, no overlaps', () => {
    const rooms = [
      { x: 0, z: 0, w: 4, d: 2, floor: 0 },
      { x: 4, z: 0, w: 2, d: 3, floor: 0 },
    ];
    const turned = turnDrafts(rooms);
    expect(turned).toEqual([
      { x: 1, z: 0, w: 2, d: 4, floor: 0 },
      { x: 0, z: 4, w: 3, d: 2, floor: 0 },
    ]);
    // Four turns come back.
    expect(turnDrafts(turnDrafts(turnDrafts(turned)))).toEqual(rooms);
  });
});

describe('matching floors and rooms (§7.4, §7.5)', () => {
  const floors = [
    { id: 'g', name: 'Ground floor' },
    { id: 'f', name: 'First floor' },
  ];
  it('no floors and one plan floor: the top level, no floor made', () => {
    expect(matchFloors([{ label: 'Plan' }], [], null)).toEqual([
      { id: null, name: null, create: false },
    ]);
  });
  it('no floors and two plan floors: two new floors, as printed or "Floor n"', () => {
    expect(matchFloors([{ label: 'Ground floor' }, { label: null }], [], null)).toEqual([
      { id: null, name: 'Ground floor', create: true },
      { id: null, name: null, create: true },
    ]);
  });
  it('floors and one plan floor: the one the map shows', () => {
    expect(matchFloors([{ label: 'Upstairs' }], floors, 'f')).toEqual([
      { id: 'f', name: 'First floor', create: false },
    ]);
  });
  it('floors and two plan floors: by name, else a new floor', () => {
    expect(matchFloors([{ label: 'ground FLOOR' }, { label: 'Loft' }], floors, 'g')).toEqual([
      { id: 'g', name: 'Ground floor', create: false },
      { id: null, name: 'Loft', create: true },
    ]);
  });

  const rooms = [
    { id: 'k', name: 'Kitchen', levelId: 'g', arranged: false },
    { id: 'b', name: 'Bedroom', levelId: 'g', arranged: true },
    { id: 'k2', name: 'Kitchen', levelId: 'f', arranged: false },
  ];
  it('uses a same-name room nobody arranged, on that floor only', () => {
    expect(matchRoom('kitchen', 'g', rooms)).toEqual({ use: 'k' });
    expect(matchRoom('Kitchen', 'f', rooms)).toEqual({ use: 'k2' });
    expect(matchRoom('Bedroom', 'g', rooms)).toEqual({ arranged: 'b' });
    expect(matchRoom('Study', 'g', rooms)).toEqual({});
    expect(matchRoom(null, 'g', rooms)).toEqual({});
  });
});

// ---- The schema (§10.4) -------------------------------------------------------------------------

describe('PlanExtraction with parseLenient', () => {
  const room = (over: object = {}) => ({
    box: [0.1, 0.1, 0.2, 0.2],
    name: { value: 'Kitchen', confidence: 0.9 },
    ...over,
  });

  it('drops a bad room alone', () => {
    const r = parseLenient(PlanExtraction, {
      is_plan: true,
      rooms: [room(), room({ box: [0.1, 1.4, 0.2, 0.2] }), room()],
    });
    expect(r?.value.rooms).toHaveLength(2);
    expect(r?.dropped).toContain('rooms.1');
  });
  it('cuts 61 rooms to 60', () => {
    const r = parseLenient(PlanExtraction, {
      is_plan: true,
      rooms: Array.from({ length: 61 }, () => room()),
    });
    expect(r?.value.rooms).toHaveLength(PLAN_LIMITS.rooms);
  });
  it('refuses a URL in a name, keeping the room', () => {
    const r = parseLenient(PlanExtraction, {
      is_plan: true,
      rooms: [room({ name: { value: 'see https://example.com', confidence: 0.9 } })],
    });
    expect(r?.value.rooms?.[0]?.name).toBeUndefined();
    expect(r?.value.rooms).toHaveLength(1);
  });
  it('fails without is_plan', () => {
    expect(parseLenient(PlanExtraction, { rooms: [room()] })).toBeNull();
  });
  it('keeps corners, sizes, a scale bar and doors', () => {
    const r = parseLenient(PlanExtraction, {
      is_plan: true,
      floors: [{ label: { value: 'Ground floor', confidence: 0.9 } }],
      rooms: [
        room({
          floor: 0,
          size_text: { value: '3.40 x 2.80 m', confidence: 0.8 },
          corners: [
            [0.1, 0.1],
            [0.3, 0.1],
            [0.3, 0.3],
            [0.1, 0.3],
          ],
          kind: 'room',
        }),
      ],
      scale_bar: { from: [0.1, 0.9], to: [0.3, 0.9], text: '5 m' },
      doors: [{ box: [0.2, 0.2, 0.05, 0.05] }],
      more: false,
    });
    expect(r?.dropped).toEqual([]);
    expect(r?.value.rooms?.[0]?.corners).toHaveLength(4);
  });
});

describe('planEstimate (§10.5)', () => {
  it('is an upper bound from the image tokens, the prompt and the allowance', () => {
    for (const kind of PROVIDER_KINDS) {
      const e = planEstimate({ kind, width: 3072, height: 2172 });
      expect(e).toBe(estimateImageTokens(kind, 3072, 2172) + 900 + MAX_OUTPUT_TOKENS.plan + 2048);
    }
    expect(planEstimate({ kind: 'groq', width: 3072, height: 2172 })).toBe(10996);
  });
  it('sizes a larger image down as the server sends it', () => {
    expect(planEstimate({ kind: 'openai', width: 6144, height: 4344 })).toBe(
      planEstimate({ kind: 'openai', width: 3072, height: 2172 }),
    );
  });
});
