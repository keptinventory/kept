import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAP_MODEL_KEYS, mapModel } from '@kept/shared';
import { describe, expect, it, vi } from 'vitest';

/** The most a detailed model may weigh: 150 KB, in the KiB the precache and the build log use. */
const MAX_GLB = 150 * 1024;

const dir = `${join(dirname(fileURLToPath(import.meta.url)), 'models')}/`;
const glbs = readdirSync(dir).filter((f) => f.endsWith('.glb'));

describe('the detailed models', () => {
  it.each(glbs)('%s weighs at most 150 KB', (file) => {
    const bytes = statSync(`${dir}${file}`).size;
    expect(bytes, `${file} is ${bytes} bytes, over ${MAX_GLB}`).toBeLessThanOrEqual(MAX_GLB);
  });

  it('ships a file for every shape that names one, and nothing else', () => {
    const named = new Set(MAP_MODEL_KEYS.map((k) => mapModel(k).glb).filter(Boolean));
    const shipped = new Set(glbs.map((f) => f.replace(/\.glb$/, '')));
    expect([...named].sort()).toEqual([...shipped].sort());
  });

  it('credits every one in NOTICE.txt', () => {
    const notice = readFileSync(`${dir}NOTICE.txt`, 'utf8');
    for (const f of glbs) expect(notice, f).toContain(f.replace(/\.glb$/, ''));
  });
});

describe('the homelab shapes (#171)', () => {
  it('are drawn in code: no download, and not a plain block', async () => {
    // jsdom has no 2D canvas: the painted textures come out blank, which is all this needs.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const { drawnModels, materials } = await import('./engine/draw');
    const BUILD = drawnModels(materials());
    for (const key of [
      'rack_wall_6u',
      'rack_wall_12u',
      'rack_24u',
      'rack_42u',
      'mini_pc',
      'nas',
      'sbc',
      'network_switch',
      'patch_panel',
      'ups',
    ] as const) {
      expect(mapModel(key).glb, key).toBeUndefined();
      expect(BUILD[key], key).toBeTypeOf('function');
    }
  });
});
