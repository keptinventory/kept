// Invented floor plans for the server's floor-plan tests (D266): the shared fixtures'
// drawings (packages/shared/src/floor-plan.fixtures.ts), rendered to PNG here with sharp. Nothing
// is traced from a real plan; each drawing says it is invented.
import { drawPlan, inventedPlan } from '@kept/shared/floor-plan.fixtures';
import sharp from 'sharp';

/** The invented plan `id` as a PNG, turned as its case says (a photo at 4°, a sideways scan). */
export async function planPng(id: string): Promise<Buffer> {
  const p = inventedPlan(id);
  const flat = await sharp(Buffer.from(drawPlan(p)))
    .png()
    .toBuffer();
  if (!p.rotate) return flat;
  return sharp(flat).rotate(p.rotate, { background: '#ffffff' }).png().toBuffer();
}

/** A PNG that is no floor plan: a photo-like block of colour. */
export function notAPlanPng(seed = 1): Promise<Buffer> {
  return sharp({
    create: {
      width: 640,
      height: 480,
      channels: 3,
      background: { r: 90 + seed, g: 140, b: 200 },
    },
  })
    .png()
    .toBuffer();
}
