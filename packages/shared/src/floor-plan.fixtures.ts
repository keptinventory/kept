/**
 * Invented floor plans for the floor-plan tests (D266, spec §14.1, §16.5): test data, not part of
 * the package (tsconfig.build.json leaves `*.fixtures.ts` out, and index.ts doesn't export it).
 *
 * Each plan is ground truth in metres. `drawPlan` draws it as SVG (the server's fixture script,
 * `apps/server/test/fixtures/floor-plans/generate.ts`, renders that to PNG with sharp), and
 * `answerFor` makes an "AI-like" answer in the plan-v1 schema from the truth: every box inside the
 * walls with deterministic noise, plus each case's own mistake. **These answers are not model
 * output.** Nothing here is traced from a real plan.
 */
import type { PlanExtraction } from './extraction.js';

export type TruthRoom = {
  name: string;
  x: number;
  z: number;
  w: number;
  d: number;
  floor: number;
  /** A room that isn't a rectangle: its corners, metres. */
  poly?: [number, number][];
};

export type InventedPlan = {
  id: string;
  title: string;
  floors: string[];
  rooms: TruthRoom[];
  /** Pixels per metre in the drawing. */
  ppm: number;
  dims: 'on-plan' | 'table' | 'none' | 'imperial';
  scaleBar?: boolean;
  doors?: boolean;
  /** Degrees the finished drawing is turned (a photo of paper, a sideways scan). */
  rotate?: number;
};

const M = 40;

/** One floor of a flat, metres. Walls are shared: rooms touch. */
export const FLAT: TruthRoom[] = [
  { name: 'Living room', x: 0, z: 0, w: 5.2, d: 4.1, floor: 0 },
  { name: 'Kitchen', x: 5.2, z: 0, w: 3.1, d: 4.1, floor: 0 },
  { name: 'Hall', x: 0, z: 4.1, w: 1.4, d: 3.4, floor: 0 },
  { name: 'Bedroom', x: 1.4, z: 4.1, w: 4.0, d: 3.4, floor: 0 },
  { name: 'Bathroom', x: 5.4, z: 4.1, w: 2.9, d: 2.2, floor: 0 },
  { name: 'Cupboard', x: 5.4, z: 6.3, w: 0.9, d: 0.7, floor: 0 },
  { name: 'Balcony', x: 0, z: -1.5, w: 3.0, d: 1.5, floor: 0 },
];

const L_SHAPE: TruthRoom[] = [
  {
    name: 'Living and dining',
    x: 0,
    z: 0,
    w: 7,
    d: 6.5,
    floor: 0,
    poly: [
      [0, 0],
      [7, 0],
      [7, 3.5],
      [3, 3.5],
      [3, 6.5],
      [0, 6.5],
    ],
  },
  { name: 'Kitchen', x: 3, z: 3.5, w: 4, d: 3, floor: 0 },
  { name: 'Bedroom', x: 7, z: 0, w: 3.6, d: 3.5, floor: 0 },
  { name: 'Bathroom', x: 7, z: 3.5, w: 3.6, d: 3, floor: 0 },
];

const HOUSE: TruthRoom[] = [
  { name: 'Kitchen/Dining', x: 0, z: 0, w: 9.4, d: 3.3, floor: 0 },
  { name: 'Family room', x: 0, z: 3.3, w: 3.7, d: 5.4, floor: 0 },
  { name: 'Hall', x: 3.7, z: 3.3, w: 2.2, d: 5.4, floor: 0 },
  { name: 'Study', x: 5.9, z: 3.3, w: 3.5, d: 2.0, floor: 0 },
  { name: 'Utility', x: 5.9, z: 5.3, w: 1.9, d: 2.1, floor: 0 },
  { name: 'WC', x: 7.8, z: 5.3, w: 1.6, d: 2.1, floor: 0 },
  { name: 'Main bedroom', x: 0, z: 0, w: 3.7, d: 5.0, floor: 1 },
  { name: 'Bedroom 2', x: 3.7, z: 0, w: 3.2, d: 3.9, floor: 1 },
  { name: 'Bedroom 3', x: 6.9, z: 0, w: 2.5, d: 3.7, floor: 1 },
  { name: 'Landing', x: 3.7, z: 3.9, w: 3.2, d: 4.8, floor: 1 },
  { name: 'Bathroom', x: 6.9, z: 3.7, w: 2.5, d: 2.6, floor: 1 },
  { name: 'En-suite', x: 0, z: 5.0, w: 3.7, d: 3.7, floor: 1 },
];

export const INVENTED_PLANS: InventedPlan[] = [
  {
    id: 'f1-flat-dims',
    title: 'Flat 12',
    floors: ['Floor plan'],
    rooms: FLAT,
    ppm: 90,
    dims: 'on-plan',
    doors: true,
  },
  {
    id: 'f2-l-shape',
    title: 'Ground floor',
    floors: ['Ground floor'],
    rooms: L_SHAPE,
    ppm: 80,
    dims: 'on-plan',
  },
  {
    id: 'f3-two-floors-table',
    title: 'The house',
    floors: ['Ground floor', 'First floor'],
    rooms: HOUSE,
    ppm: 60,
    dims: 'table',
  },
  {
    id: 'f4-rotated-4deg',
    title: 'Flat 12 (photo)',
    floors: ['Floor plan'],
    rooms: FLAT,
    ppm: 90,
    dims: 'on-plan',
    rotate: 4,
  },
  {
    id: 'f5-sideways',
    title: 'Flat 12 (sideways)',
    floors: ['Floor plan'],
    rooms: FLAT,
    ppm: 90,
    dims: 'on-plan',
    rotate: 90,
  },
  {
    id: 'f6-scale-bar-doors',
    title: 'Sketch',
    floors: ['Floor plan'],
    rooms: FLAT,
    ppm: 70,
    dims: 'none',
    scaleBar: true,
    doors: true,
  },
  {
    id: 'f7-imperial',
    title: 'Apartment 4B',
    floors: ['Floor plan'],
    rooms: FLAT,
    ppm: 90,
    dims: 'imperial',
  },
  {
    id: 'f8-no-scale',
    title: 'Hand sketch',
    floors: ['Floor plan'],
    rooms: FLAT,
    ppm: 75,
    dims: 'none',
  },
];

export const inventedPlan = (id: string): InventedPlan => {
  const p = INVENTED_PLANS.find((x) => x.id === id);
  if (!p) throw new Error(`no invented plan ${id}`);
  return p;
};

const ft = (m: number) => {
  const inches = Math.round(m / 0.0254);
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
};
/** A room's size as the plan prints it. */
export const dimText = (r: TruthRoom, imperial: boolean) =>
  imperial ? `${ft(r.w)} x ${ft(r.d)}` : `${r.w.toFixed(2)} x ${r.d.toFixed(2)} m`;

const GAP = 120;

function extents(p: InventedPlan) {
  return p.floors.map((_, f) => {
    const rs = p.rooms.filter((r) => r.floor === f);
    return {
      minX: Math.min(...rs.map((r) => r.x)),
      minZ: Math.min(...rs.map((r) => r.z)),
      maxX: Math.max(...rs.map((r) => r.x + r.w)),
      maxZ: Math.max(...rs.map((r) => r.z + r.d)),
    };
  });
}

/** The drawing's size and where each floor's metres start, in pixels, before any turn. */
export function planGeometry(p: InventedPlan): {
  width: number;
  height: number;
  origin: (floor: number) => { x: number; y: number };
} {
  const ext = extents(p);
  let x = M;
  const origins: { x: number; y: number }[] = [];
  for (const e of ext) {
    origins.push({ x: x - e.minX * p.ppm, y: M + 50 - e.minZ * p.ppm });
    x += (e.maxX - e.minX) * p.ppm + GAP;
  }
  const width = Math.round(x - GAP + M);
  const tableH = p.dims === 'table' ? 22 * p.rooms.length + 60 : 0;
  const drawH = Math.max(...ext.map((e) => (e.maxZ - e.minZ) * p.ppm));
  const height = Math.round(M + 50 + drawH + (p.scaleBar ? 90 : 40) + tableH);
  return {
    width,
    height,
    origin: (f) => origins[f] ?? { x: M, y: M },
  };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** The plan as SVG, every floor side by side, labelled as invented. */
export function drawPlan(p: InventedPlan): string {
  const g = planGeometry(p);
  const ext = extents(p);
  const parts: string[] = ['<rect width="100%" height="100%" fill="#fff"/>'];
  p.floors.forEach((label, f) => {
    const o = g.origin(f);
    const e = ext[f];
    if (!e) return;
    parts.push(
      `<text x="${o.x + e.minX * p.ppm}" y="${M + 20}" font-family="Arial" font-size="22" font-weight="bold">${esc(label)}</text>`,
    );
    for (const r of p.rooms.filter((x) => x.floor === f)) {
      const corners = r.poly ?? [
        [r.x, r.z],
        [r.x + r.w, r.z],
        [r.x + r.w, r.z + r.d],
        [r.x, r.z + r.d],
      ];
      const pts = corners.map(([a, b]) => `${o.x + a * p.ppm},${o.y + b * p.ppm}`).join(' ');
      const wall = Math.max(4, 0.12 * p.ppm);
      parts.push(`<polygon points="${pts}" fill="none" stroke="#222" stroke-width="${wall}"/>`);
      const cx = o.x + (r.x + (r.poly ? 3.5 : r.w / 2)) * p.ppm;
      const cy = o.y + (r.z + (r.poly ? 1.75 : r.d / 2)) * p.ppm;
      const small = r.w < 1.2 || r.d < 1.2;
      parts.push(
        `<text x="${cx}" y="${cy}" text-anchor="middle" font-family="Arial" font-size="${small ? 11 : 16}">${esc(r.name)}</text>`,
      );
      if (p.dims === 'on-plan' || p.dims === 'imperial') {
        parts.push(
          `<text x="${cx}" y="${cy + 18}" text-anchor="middle" font-family="Arial" font-size="${small ? 9 : 13}">${esc(dimText(r, p.dims === 'imperial'))}</text>`,
        );
      }
      if (p.doors && !small) {
        const dx = o.x + (r.x + 0.3) * p.ppm;
        const dy = o.y + (r.z + r.d) * p.ppm;
        const s = 0.8 * p.ppm;
        parts.push(
          `<path d="M ${dx} ${dy} L ${dx} ${dy - s} A ${s} ${s} 0 0 1 ${dx + s} ${dy}" fill="none" stroke="#555" stroke-width="2"/>`,
        );
        parts.push(
          `<line x1="${dx}" y1="${dy}" x2="${dx + s}" y2="${dy}" stroke="#fff" stroke-width="${wall + 1}"/>`,
        );
      }
    }
  });
  const drawH = Math.max(...ext.map((e) => (e.maxZ - e.minZ) * p.ppm));
  let y = M + 50 + drawH + 30;
  if (p.scaleBar) {
    const s = 5 * p.ppm;
    parts.push(
      `<line x1="${M}" y1="${y}" x2="${M + s}" y2="${y}" stroke="#000" stroke-width="4"/>`,
    );
    for (let i = 0; i <= 5; i++) {
      parts.push(
        `<line x1="${M + i * p.ppm}" y1="${y - 8}" x2="${M + i * p.ppm}" y2="${y + 8}" stroke="#000" stroke-width="2"/>`,
      );
      parts.push(
        `<text x="${M + i * p.ppm}" y="${y + 26}" text-anchor="middle" font-family="Arial" font-size="14">${i}${i === 5 ? ' m' : ''}</text>`,
      );
    }
    y += 50;
  }
  if (p.dims === 'table') {
    y += 10;
    for (const [f, name] of p.floors.entries()) {
      parts.push(
        `<text x="${M}" y="${y}" font-family="Arial" font-size="15" font-weight="bold">${esc(name.toUpperCase())}</text>`,
      );
      y += 22;
      for (const r of p.rooms.filter((x) => x.floor === f)) {
        parts.push(
          `<text x="${M}" y="${y}" font-family="Arial" font-size="14">${esc(r.name)}</text>`,
        );
        parts.push(
          `<text x="${M + 200}" y="${y}" font-family="Arial" font-size="14">${r.w.toFixed(2)}m x ${r.d.toFixed(2)}m</text>`,
        );
        y += 20;
      }
    }
  }
  parts.push(
    `<text x="${g.width - M}" y="${g.height - 12}" text-anchor="end" font-family="Arial" font-size="11" fill="#666">Invented plan for Kept's tests. Not a real home.</text>`,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}">${parts.join('')}</svg>`;
}

/** The size of a drawing turned by `deg` (sharp grows the canvas to fit). */
export function turnedSize(w: number, h: number, deg: number): { width: number; height: number } {
  const th = (deg * Math.PI) / 180;
  const c = Math.abs(Math.cos(th));
  const s = Math.abs(Math.sin(th));
  return { width: Math.round(w * c + h * s), height: Math.round(w * s + h * c) };
}

export type AnswerOpts = {
  /** Each corner off by up to this fraction of the image. */
  noise: number;
  corners: 'all' | 'none' | 'poly-only';
  seed?: number;
  mistakes?: (a: PlanExtraction) => void;
};

/**
 * An AI-like answer for `p` drawn at W0 × H0 and sent at W × H (after its turn), with
 * deterministic noise and the case's own mistakes.
 */
export function answerFor(p: InventedPlan, W: number, H: number, o: AnswerOpts): PlanExtraction {
  const g = planGeometry(p);
  const W0 = g.width;
  const H0 = g.height;
  let seed = o.seed ?? 7;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return (seed / 2 ** 31) * 2 - 1;
  };
  const th = ((p.rotate ?? 0) * Math.PI) / 180;
  const c = Math.cos(th);
  const s = Math.sin(th);
  // sharp turns about the middle, clockwise for a positive angle, and grows the canvas.
  const turn = (x: number, y: number): [number, number] => {
    const dx = x - W0 / 2;
    const dy = y - H0 / 2;
    return [(dx * c - dy * s + W / 2) / W, (dx * s + dy * c + H / 2) / H];
  };
  const inset = 0.06;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const rooms = p.rooms.map((r) => {
    const og = g.origin(r.floor);
    const poly =
      r.poly ??
      ([
        [r.x, r.z],
        [r.x + r.w, r.z],
        [r.x + r.w, r.z + r.d],
        [r.x, r.z + r.d],
      ] as [number, number][]);
    const cx = r.x + r.w / 2;
    const cz = r.z + r.d / 2;
    const n = () => o.noise * rnd();
    const pts = poly.map(([x, z]) => {
      const ix = x + Math.sign(cx - x) * inset;
      const iz = z + Math.sign(cz - z) * inset;
      const [u, v] = turn(og.x + ix * p.ppm, og.y + iz * p.ppm);
      return [clamp(u + n()), clamp(v + n())] as [number, number];
    });
    const xs = pts.map((q) => q[0]);
    const ys = pts.map((q) => q[1]);
    const box: [number, number, number, number] = [
      Math.min(...xs),
      Math.min(...ys),
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
    ];
    const withCorners = o.corners === 'all' || (o.corners === 'poly-only' && r.poly);
    return {
      name: { value: r.name, confidence: 0.9 },
      floor: r.floor,
      box,
      ...(withCorners ? { corners: pts } : {}),
      ...(p.dims !== 'none'
        ? { size_text: { value: dimText(r, p.dims === 'imperial'), confidence: 0.85 } }
        : {}),
    };
  });
  const a: PlanExtraction = {
    is_plan: true,
    floors: p.floors.map((f) => ({ label: { value: f, confidence: 0.9 } })),
    rooms,
  };
  if (p.scaleBar) {
    const ext = Math.max(...p.rooms.map((r) => r.z + r.d)) - Math.min(...p.rooms.map((r) => r.z));
    const y = M + 50 + ext * p.ppm + 30;
    a.scale_bar = { from: turn(M, y), to: turn(M + 5 * p.ppm, y), text: '5 m' };
  }
  if (p.doors) {
    a.doors = p.rooms
      .filter((r) => r.w >= 1.2 && r.d >= 1.2)
      .map((r) => {
        const og = g.origin(r.floor);
        const [u, v] = turn(og.x + (r.x + 0.3) * p.ppm, og.y + (r.z + r.d - 0.8) * p.ppm);
        return {
          box: [
            clamp(u),
            clamp(v),
            ((0.8 * p.ppm) / W) * (1 + 0.1 * rnd()),
            ((0.8 * p.ppm) / H) * (1 + 0.1 * rnd()),
          ] as [number, number, number, number],
        };
      });
  }
  o.mistakes?.(a);
  return a;
}

/** The invented plan's sent size: its drawing, turned. */
export function sentSize(p: InventedPlan): { w: number; h: number } {
  const g = planGeometry(p);
  const t = turnedSize(g.width, g.height, p.rotate ?? 0);
  return { w: t.width, h: t.height };
}
