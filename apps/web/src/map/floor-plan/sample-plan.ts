/**
 * Try Kept's sample floor plan (D266, spec §10.6): there is no AI in the demo, so the map offers a
 * plan drawn here, an invented flat of five rooms with their sizes printed, and the mock answers
 * it with the rooms as a model would read them. Never a real home's plan. Drawn on a canvas and
 * encoded as a PNG, as a screenshot of a plan would arrive.
 */
import type { PlanExtraction } from '@kept/shared';

/** Pixels per metre, the margin, and the rooms in metres (walls shared: rooms touch). */
const PPM = 110;
const M = 60;
const ROOMS = [
  { name: 'Living room', x: 0, z: 0, w: 5.2, d: 4.1 },
  { name: 'Kitchen', x: 5.2, z: 0, w: 3.1, d: 4.1 },
  { name: 'Hall', x: 0, z: 4.1, w: 1.4, d: 3.4 },
  { name: 'Bedroom', x: 1.4, z: 4.1, w: 4.0, d: 3.4 },
  { name: 'Bathroom', x: 5.4, z: 4.1, w: 2.9, d: 2.2 },
] as const;

export const SAMPLE_PLAN_SIZE = {
  w: Math.round(8.3 * PPM + 2 * M),
  h: Math.round(7.5 * PPM + 2 * M + 40),
};

const size = (r: (typeof ROOMS)[number]) => `${r.w.toFixed(2)} x ${r.d.toFixed(2)} m`;

/** The sample plan as a model would read it: each room's box inside its walls, its label, its
 * printed size. */
export function sampleAnswer(): PlanExtraction {
  const { w: W, h: H } = SAMPLE_PLAN_SIZE;
  const inset = 0.06;
  return {
    is_plan: true,
    floors: [{ label: { value: 'Flat 12', confidence: 0.9 } }],
    rooms: ROOMS.map((r) => ({
      name: { value: r.name, confidence: 0.92 },
      floor: 0,
      box: [
        (M + (r.x + inset) * PPM) / W,
        (M + (r.z + inset) * PPM) / H,
        ((r.w - 2 * inset) * PPM) / W,
        ((r.d - 2 * inset) * PPM) / H,
      ] as [number, number, number, number],
      size_text: { value: size(r), confidence: 0.86 },
    })),
  };
}

export async function samplePlanImage(): Promise<Blob> {
  const { w: W, h: H } = SAMPLE_PLAN_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('no 2d canvas');
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, W, H);
  c.strokeStyle = '#222222';
  c.lineWidth = 12;
  c.fillStyle = '#222222';
  c.textAlign = 'center';
  for (const r of ROOMS) {
    c.strokeRect(M + r.x * PPM, M + r.z * PPM, r.w * PPM, r.d * PPM);
  }
  for (const r of ROOMS) {
    const cx = M + (r.x + r.w / 2) * PPM;
    const cy = M + (r.z + r.d / 2) * PPM;
    c.font = '600 22px Arial, sans-serif';
    c.fillText(r.name, cx, cy);
    c.font = '18px Arial, sans-serif';
    c.fillText(size(r), cx, cy + 26);
  }
  c.font = '15px Arial, sans-serif';
  c.textAlign = 'end';
  c.fillStyle = '#666666';
  c.fillText('Invented sample plan for Try Kept. Not a real home.', W - M, H - 24);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no PNG'))), 'image/png'),
  );
}
