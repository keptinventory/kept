// @vitest-environment node
/**
 * The glyph templates are the label font's own: glyphs.ts is what src/test/printed-code-glyphs.ts
 * makes from @fontsource/ibm-plex-mono today (`vitest -u` rewrites it after a font bump), for
 * exactly the short-ID alphabet, and no two characters' templates are near copies.
 */
import { ALPHABET } from '@kept/shared';
import { describe, expect, it } from 'vitest';
import { glyphsModule } from '@/test/printed-code-glyphs';
import { GLYPH_CHARS } from './geometry';
import { similarity, templates } from './templates';

describe('glyph templates', () => {
  it('cover the short-ID alphabet, in its order', () => {
    expect(GLYPH_CHARS).toBe(ALPHABET);
    expect(templates()).toHaveLength(ALPHABET.length);
  });

  it('are what the label font makes', async () => {
    await expect(glyphsModule()).toMatchFileSnapshot('./glyphs.ts');
  });

  it('tell every pair of characters apart', () => {
    const t = templates();
    let closest = { pair: '', score: -1 };
    for (let i = 0; i < t.length; i++)
      for (let j = i + 1; j < t.length; j++) {
        const s = similarity(t[i] as Float32Array, t[j] as Float32Array);
        if (s > closest.score) closest = { pair: `${GLYPH_CHARS[i]}${GLYPH_CHARS[j]}`, score: s };
      }
    // The closest pair (8 and B) still differs at the template's own resolution; the reader
    // asks for a clear lead over the next-best character on top.
    expect(closest.pair).toBe('8B');
    expect(closest.score).toBeLessThan(0.95);
  });
});
