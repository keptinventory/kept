import { MAP_MODEL_KEYS, mapModel, SHAPE_GROUPS } from '@kept/shared';
import { describe, expect, it } from 'vitest';
import { THUMB_HEIGHTS_CM } from '../../../../web/src/map/thumbs/sprite';
import { shapeLibrary } from './library';

describe('the shape library (#171)', () => {
  const groups = shapeLibrary();
  const all = groups.flatMap((g) => g.shapes);

  it('lists every shape once, in the picker’s groups and order', () => {
    expect(all.map((s) => s.key).sort()).toEqual([...MAP_MODEL_KEYS].sort());
    expect(groups.map((g) => g.id)).toEqual(
      SHAPE_GROUPS.filter((g) => groups.some((x) => x.id === g)),
    );
    for (const g of groups) expect(g.label, g.id).toMatch(/\S/);
    const electronics = groups.find((g) => g.id === 'electronics')?.shapes.map((s) => s.key) ?? [];
    expect(electronics.indexOf('mini_pc')).toBeGreaterThan(electronics.indexOf('router'));
  });

  it('gives each its English name, its sprite cell and its size in centimetres', () => {
    const ups = all.find((s) => s.key === 'ups');
    expect(ups).toMatchObject({ name: 'UPS', size: { w: 10, d: 36, h: 24 } });
    expect(Number.isInteger(ups?.cell)).toBe(true);
    // A shape with no height in the catalogue takes the one it is drawn at.
    const tv = all.find((s) => s.key === 'tv');
    expect(mapModel('tv').h).toBeUndefined();
    expect(tv?.size.h).toBe(Math.round(THUMB_HEIGHTS_CM.tv));
    expect(tv?.size).toMatchObject({ w: 124, d: 26 });
    for (const s of all) for (const v of Object.values(s.size)) expect(v, s.key).toBeGreaterThan(0);
  });

  it('formats a size as w × d × h, small ones to the millimetre', () => {
    const sbc = all.find((s) => s.key === 'sbc');
    expect(sbc?.sizeText).toBe('9 × 6.5 × 3 cm');
    expect(all.find((s) => s.key === 'rack_42u')?.sizeText).toBe('60 × 100 × 200 cm');
  });

  it('lists the words in each of the five languages', () => {
    const ups = all.find((s) => s.key === 'ups');
    expect(ups?.words.map((w) => w.lang)).toEqual(['en', 'ar', 'fr', 'de', 'it']);
    expect(ups?.words.find((w) => w.lang === 'de')?.words).toContain('usv');
    // A language with no words of its own is left out, not shown empty.
    for (const s of all) for (const w of s.words) expect(w.words.length, s.key).toBeGreaterThan(0);
  });
});
