// @vitest-environment node
/**
 * The printed-code recogniser, part by part and then on sample photos of tape labels drawn in the
 * label's own font (src/test/tape-fixtures.ts): turned, blurred, noisy, faded, unevenly lit, dark
 * on light and light on dark. A read is either sure (the scanner may open it) or not (the person
 * confirms); the one result that must never happen is a sure read of the wrong code.
 */
import { ALPHABET, randomShortCode } from '@kept/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Font } from '@/test/font-raster';
import { loadMono, loadSans } from '@/test/printed-code-glyphs';
import { clutterPhoto, type Gray, seeded, tapePhoto } from '@/test/tape-fixtures';
import { GLYPH_CHARS } from './geometry';
import {
  type Blob,
  binarise,
  codeOf,
  components,
  findCodeLines,
  matchCell,
  readPrintedCode,
} from './recognise';
import { templates } from './templates';

let mono: Font;
let sans: Font;
beforeAll(() => {
  mono = loadMono();
  sans = loadSans();
});

/** A grey image from rows of characters: '#' ink (20), '.' paper (230). */
function sketch(rows: string[]): Gray {
  const width = rows[0]?.length ?? 0;
  const data = new Uint8ClampedArray(width * rows.length);
  rows.forEach((r, y) => {
    for (let x = 0; x < width; x++) data[y * width + x] = r[x] === '#' ? 20 : 230;
  });
  return { width, height: rows.length, data };
}

describe('binarise', () => {
  const img = sketch([
    '................',
    '................',
    '....####........',
    '....####........',
    '....####........',
    '................',
    '................',
  ]);

  it('marks dark ink on light ground, and light ink when asked', () => {
    const dark = binarise(img, 'dark');
    expect(dark[3 * 16 + 5]).toBe(1);
    expect(dark[0]).toBe(0);
    const light = binarise(img, 'light');
    expect(light[3 * 16 + 5]).toBe(0);
  });

  it('follows the local light, not one global level', () => {
    // Ink on the dim half is lighter than paper on the bright half.
    const width = 40;
    const data = new Uint8ClampedArray(width * 9);
    for (let y = 0; y < 9; y++)
      for (let x = 0; x < width; x++) {
        const paper = x < 20 ? 90 : 240;
        const ink = y >= 3 && y <= 5 && (x === 8 || x === 9 || x === 30 || x === 31);
        data[y * width + x] = ink ? paper * 0.4 : paper;
      }
    const mask = binarise({ width, height: 9, data }, 'dark');
    expect(mask[4 * width + 8]).toBe(1);
    expect(mask[4 * width + 30]).toBe(1);
    expect(mask[4 * width + 2]).toBe(0);
    expect(mask[4 * width + 22]).toBe(0);
  });
});

describe('components', () => {
  it('labels each blob of ink with its box and size', () => {
    const rows = ['##..#', '##..#', '.....', '..###'];
    const mask = Uint8Array.from(rows.join('').split(''), (c) => (c === '#' ? 1 : 0));
    const { blobs } = components(mask, 5, 4);
    const boxes = blobs
      .map((b) => [b.x0, b.y0, b.x1, b.y1, b.area])
      .sort((a, b) => (a[0] as number) - (b[0] as number) || (a[1] as number) - (b[1] as number));
    expect(boxes).toEqual([
      [0, 0, 2, 2, 4],
      [2, 3, 5, 4, 3],
      [4, 0, 5, 2, 2],
    ]);
  });

  it('joins diagonal neighbours (8-connected)', () => {
    const mask = Uint8Array.from([1, 0, 0, 1]);
    expect(components(mask, 2, 2).blobs).toHaveLength(1);
  });
});

/** A glyph-sized box centred at (cx, cy). */
const box = (cx: number, cy: number, h = 20, w = 13, label = 0): Blob => ({
  x0: Math.round(cx - w / 2),
  x1: Math.round(cx + w / 2),
  y0: Math.round(cy - h / 2),
  y1: Math.round(cy + h / 2),
  area: Math.round(w * h * 0.45),
  label,
});
/** The printed code's slots: three, the hyphen's slot, three. */
const SLOTS = [0, 1, 2, 4, 5, 6];
const hyphen = (cx: number, cy: number): Blob => ({
  x0: cx - 4,
  x1: cx + 4,
  y0: cy - 1,
  y1: cy + 2,
  area: 22,
  label: 99,
});

describe('findCodeLines (segmentation)', () => {
  const pitch = 18;
  const code = (angle = 0, x = 40, y = 50) => {
    const r = (angle * Math.PI) / 180;
    const at = (k: number) => ({ x: x + k * pitch * Math.cos(r), y: y + k * pitch * Math.sin(r) });
    return {
      glyphs: SLOTS.map((k, i) => box(at(k).x, at(k).y, 20, 13, i + 1)),
      dash: hyphen(Math.round(at(3).x), Math.round(at(3).y)),
    };
  };

  it('finds three glyphs, a hyphen and three, at one pitch, in reading order', () => {
    const { glyphs, dash } = code();
    const lines = findCodeLines([...glyphs].reverse().concat(dash));
    expect(lines).toHaveLength(1);
    expect(lines[0]?.map((b) => b.label)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('finds a code turned a few degrees', () => {
    const { glyphs, dash } = code(7);
    expect(findCodeLines([...glyphs, dash])).toHaveLength(1);
  });

  it('refuses a run with no hyphen gap, or with a seventh glyph', () => {
    const plain = [0, 1, 2, 3, 4, 5].map((k) => box(40 + k * pitch, 50));
    expect(findCodeLines(plain)).toHaveLength(0);
    const { glyphs, dash } = code();
    expect(findCodeLines([...glyphs, dash, box(40 + 7 * pitch, 50)])).toHaveLength(0);
    expect(findCodeLines([box(40 - pitch, 50), ...glyphs, dash])).toHaveLength(0);
  });

  it('refuses a glyph standing in the hyphen gap', () => {
    const { glyphs, dash } = code();
    expect(findCodeLines([...glyphs, dash, box(40 + 3 * pitch, 50)])).toHaveLength(0);
  });

  it('refuses glyphs of mixed heights and a gap with no hyphen in it', () => {
    const { glyphs, dash } = code();
    const mixed = glyphs.map((g, i) => (i === 4 ? box((g.x0 + g.x1) / 2, 50, 34, 13) : g));
    expect(findCodeLines([...mixed, dash])).toHaveLength(0);
    expect(findCodeLines(glyphs)).toHaveLength(0);
  });

  it('keeps smaller text beside the code out of it', () => {
    const { glyphs, dash } = code();
    const name = [0, 1, 2, 3].map((k) => box(170 + k * 8, 52, 10, 6));
    expect(findCodeLines([...glyphs, dash, ...name])[0]).toHaveLength(6);
  });
});

describe('matchCell', () => {
  it('names each template as its own character', () => {
    templates().forEach((t, i) => {
      const m = matchCell(t);
      expect(m.char).toBe(GLYPH_CHARS[i]);
      expect(m.score).toBeGreaterThan(0.99);
      expect(m.margin).toBeGreaterThan(0.05);
    });
  });
});

describe('codeOf (format)', () => {
  it('takes six characters of the alphabet, nothing else', () => {
    expect(codeOf(['K', '7', 'D', '2', 'Q', 'X'])).toBe('K7D2QX');
    expect(codeOf(['K', '7', 'D', '2', 'Q'])).toBeNull();
    expect(codeOf(['K', '7', 'D', '2', 'Q', 'O'])).toBeNull();
    expect(codeOf(['K', '7', 'D', '2', 'Q', 'X', '1'])).toBeNull();
  });
});

describe('readPrintedCode', () => {
  it('reads a clean tape label', () => {
    const read = readPrintedCode(tapePhoto(mono, sans, { text: 'K7D2QX', capPx: 28, seed: 3 }));
    expect(read).toMatchObject({ code: 'K7D2QX', sure: true });
  });

  it('reads light print on dark tape, and a label with its name beside the code', () => {
    const dark = tapePhoto(mono, sans, { text: 'ZW3HJ8', capPx: 30, inverted: true, seed: 4 });
    expect(readPrintedCode(dark)).toMatchObject({ code: 'ZW3HJ8', sure: true });
    const named = tapePhoto(mono, sans, { text: 'M4X9B0', capPx: 24, name: 'Spare keys', seed: 5 });
    expect(readPrintedCode(named)).toMatchObject({ code: 'M4X9B0', sure: true });
  });

  it('reads nothing where there is no code', () => {
    for (const [i, kind] of (['words', 'bars', 'table'] as const).entries())
      expect(readPrintedCode(clutterPhoto(mono, sans, kind, i + 1))).toBeNull();
  });

  it('every character of the alphabet reads', () => {
    for (let i = 0; i < ALPHABET.length; i += 6) {
      const code = ALPHABET.slice(i, i + 6).padEnd(6, '7');
      const read = readPrintedCode(tapePhoto(mono, sans, { text: code, capPx: 22, seed: i }));
      expect(read?.code).toBe(code);
    }
  });
});

/**
 * Accuracy on sample photos. Each draws a random code with random conditions from its seed. A
 * hit is a sure read of the right code; an unsure read goes to the person, so a wrong one is
 * caught there; a sure read of the wrong code would open the wrong thing and must not happen.
 */
describe('accuracy on sample tape photos', () => {
  const N = 160;
  type Tally = {
    hit: number;
    unsureRight: number;
    unsureWrong: number;
    sureWrong: number;
    miss: number;
  };

  function conditions(seed: number) {
    const r = seeded(seed * 7919);
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)] as T;
    return {
      capPx: 13 + r() * 40,
      angle: (r() - 0.5) * 16,
      blur: pick([0, 0, 0.6, 1, 1.5]),
      noise: r() * 14,
      contrast: 0.3 + r() * 0.7,
      light: r() * 0.6,
      inverted: r() < 0.3,
      spacing: r() < 0.8 ? 0.06 : 0,
      hyphen: pick(['plex', 'wide', 'thin'] as const),
      ...(r() < 0.5 ? { name: pick(['Spare keys', 'HDMI cable', 'Drill bits', 'Passport']) } : {}),
    };
  }

  it(`reads at least 85% of ${N} photos sure and right, and none sure and wrong`, () => {
    const t: Tally = { hit: 0, unsureRight: 0, unsureWrong: 0, sureWrong: 0, miss: 0 };
    const wrong: string[] = [];
    for (let seed = 1; seed <= N; seed++) {
      const r = seeded(seed);
      let code = '';
      for (let k = 0; k < 6; k++) code += ALPHABET[Math.floor(r() * 32)];
      const c = conditions(seed);
      const read = readPrintedCode(tapePhoto(mono, sans, { text: code, seed, ...c }));
      if (!read) t.miss++;
      else if (read.code === code) read.sure ? t.hit++ : t.unsureRight++;
      else {
        read.sure ? t.sureWrong++ : t.unsureWrong++;
        wrong.push(`${seed}: ${code} read ${read.code}${read.sure ? ' (sure)' : ''}`);
      }
    }
    console.info(`printed-code accuracy over ${N} photos:`, t, wrong);
    expect(t.sureWrong).toBe(0);
    expect(t.hit / N).toBeGreaterThanOrEqual(0.85);
  });

  it('never reads a code sure from text that is not one', () => {
    let sure = 0;
    const reads: string[] = [];
    const near = ['OIL-LUX', 'K7D2Q', 'K7D2QXA', 'BOX-12'];
    for (let seed = 1; seed <= 40; seed++) {
      const text = near[seed % near.length] as string;
      const photo =
        seed % 2
          ? tapePhoto(mono, sans, {
              text: text.replace('-', ''),
              asCode: text.includes('-') || text.length === 6,
              capPx: 18 + (seed % 5) * 6,
              angle: (seed % 7) - 3,
              seed,
            })
          : clutterPhoto(
              mono,
              sans,
              (['words', 'bars', 'table'] as const)[seed % 3] ?? 'table',
              seed,
            );
      const read = readPrintedCode(photo);
      if (read?.sure) sure++;
      if (read) reads.push(`${seed}: ${read.code}${read.sure ? ' (sure)' : ''}`);
    }
    console.info('printed-code reads on photos with no code:', reads);
    expect(sure).toBe(0);
  });

  it('a random code, read back as it was drawn', () => {
    const code = randomShortCode();
    expect(
      readPrintedCode(tapePhoto(mono, sans, { text: code, capPx: 26, angle: 2, seed: 9 }))?.code,
    ).toBe(code);
  });
});
