// @vitest-environment node
/**
 * The phone PNG: the right pixel size per stock at 300 dpi, and a QR the app's
 * own scanner reads (the T26 wasm decoder, as in camera/scanner.decode.test.ts). `drawLabel` is
 * run against a small rasterising context: its rectangles become pixels, its text calls are
 * recorded, so no canvas is needed.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { hasQr, LABEL_STOCKS, labelStock } from '@kept/shared';
import { encode } from 'uqr';
import { beforeAll, describe, expect, it } from 'vitest';
import type { LabelCellContent } from '@/api/capture/types';
import { readPrintedCode } from '@/camera/printed-code/recognise';
import { drawText, plane } from '@/test/font-raster';
import { loadMono, loadSans } from '@/test/printed-code-glyphs';
import { drawLabel, type LabelContext, labelPixelSize } from './png';
import { qrMatrix } from './qr';

const require = createRequire(import.meta.url);

class ImageDataStandIn {
  constructor(
    readonly data: Uint8ClampedArray,
    readonly width: number,
    readonly height: number,
  ) {}
  get [Symbol.toStringTag]() {
    return 'ImageData';
  }
}
class RectStandIn {
  constructor(
    readonly x = 0,
    readonly y = 0,
    readonly width = 0,
    readonly height = 0,
  ) {}
}

type Ponyfill = typeof import('barcode-detector/ponyfill');
let ponyfill: Ponyfill;

beforeAll(async () => {
  const g = globalThis as Record<string, unknown>;
  g.ImageData ??= ImageDataStandIn;
  g.DOMRectReadOnly ??= RectStandIn;
  ponyfill = await import('barcode-detector/ponyfill');
  const wasm = readFileSync(require.resolve('zxing-wasm/reader/zxing_reader.wasm'));
  ponyfill.prepareZXingModule({
    overrides: {
      wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength),
    },
    fireImmediately: true,
  });
});

type Text = {
  text: string;
  x: number;
  y: number;
  direction: string;
  align: string;
  font: string;
};

/** A context that paints rectangles into RGBA pixels and records text. */
function raster(width: number, height: number) {
  const px = new Uint8ClampedArray(width * height * 4).fill(128);
  const texts: Text[] = [];
  const ctx = {
    fillStyle: '#000000' as string | CanvasGradient | CanvasPattern,
    font: '10px sans-serif',
    textAlign: 'start' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    direction: 'inherit' as CanvasDirection,
    fillRect(x: number, y: number, w: number, h: number) {
      const v = this.fillStyle === '#FFFFFF' ? 255 : 0;
      for (let yy = Math.max(0, y); yy < Math.min(height, y + h); yy++)
        for (let xx = Math.max(0, x); xx < Math.min(width, x + w); xx++) {
          const i = (yy * width + xx) * 4;
          px[i] = v;
          px[i + 1] = v;
          px[i + 2] = v;
          px[i + 3] = 255;
        }
    },
    fillText(text: string, x: number, y: number) {
      texts.push({ text, x, y, direction: this.direction, align: this.textAlign, font: this.font });
    },
    measureText(text: string) {
      const size = Number(/(\d+)px/.exec(this.font)?.[1] ?? 10);
      return { width: text.length * size * 0.55 } as TextMetrics;
    },
  };
  return { ctx: ctx as unknown as LabelContext, image: new ImageData(px, width, height), texts };
}

const label = (over: Partial<LabelCellContent> = {}): LabelCellContent => ({
  code: '7KQ4MZ',
  url: 'https://kept.example/l/7KQ4MZ',
  kind: 'thing',
  name: 'Ramadan decorations box',
  path: 'Garage › Shelf A',
  ...over,
});

describe('labelPixelSize', () => {
  it('is the cell at 300 dpi', () => {
    expect(Object.fromEntries(LABEL_STOCKS.map((s) => [s.key, labelPixelSize(s)]))).toEqual({
      thermal_50x30: { width: 591, height: 354 },
      thermal_40x30: { width: 472, height: 354 },
      thermal_62x29: { width: 732, height: 343 },
      tape_9: { width: 472, height: 106 },
      tape_12: { width: 591, height: 142 },
      tape_18: { width: 591, height: 213 },
      tape_24: { width: 709, height: 283 },
      a4_24_70x37: { width: 827, height: 437 },
      a4_65_38x21: { width: 450, height: 250 },
      letter_30_67x25: { width: 788, height: 300 },
    });
  });
});

describe('drawLabel', () => {
  it.each(LABEL_STOCKS.filter(hasQr).map((s) => [s.key] as const))(
    '%s: the scanner reads the QR back',
    async (key) => {
      const stock = labelStock(key);
      const { width, height } = labelPixelSize(stock);
      const { ctx, image } = raster(width, height);
      const l = label();
      drawLabel(ctx, stock, l, qrMatrix(encode, l.url));
      const [read] = await new ponyfill.BarcodeDetector({ formats: ['qr_code'] }).detect(image);
      expect(read?.rawValue).toBe(l.url);
    },
  );

  it('writes the code as printed, then an Arabic name set from the far edge of its column', () => {
    const stock = labelStock('thermal_50x30');
    const { width, height } = labelPixelSize(stock);
    const { ctx, texts } = raster(width, height);
    const l = label({ name: 'زينة رمضان', path: 'الجراج › الرف أ' });
    drawLabel(ctx, stock, l, qrMatrix(encode, l.url));
    expect(texts[0]).toMatchObject({ text: '7KQ‑4MZ', direction: 'ltr', align: 'left' });
    const name = texts.find((t) => t.text === 'زينة رمضان');
    expect(name).toMatchObject({ direction: 'rtl', align: 'right' });
    expect(name?.x).toBeGreaterThan(texts[0]?.x ?? 0);
  });

  it('prints only the QR and the code on the compact stock', () => {
    const stock = labelStock('a4_65_38x21');
    const { width, height } = labelPixelSize(stock);
    const { ctx, texts } = raster(width, height);
    drawLabel(ctx, stock, label(), qrMatrix(encode, label().url));
    expect(texts.map((t) => t.text)).toEqual(['7KQ‑4MZ']);
  });
});

describe('tape', () => {
  it('narrow tape prints no QR: the code first, large, then the name beside it', () => {
    const stock = labelStock('tape_12');
    const { width, height } = labelPixelSize(stock);
    const { ctx, image, texts } = raster(width, height);
    drawLabel(ctx, stock, label({ name: 'Spare keys' }), qrMatrix(encode, label().url));
    expect(image.data.some((v, i) => i % 4 === 0 && v === 0)).toBe(false);
    expect(texts.map((t) => t.text)).toEqual(['7KQ‑4MZ', 'Spare keys']);
    const [code, name] = texts as [Text, Text];
    expect(Number(/(\d+)px/.exec(code.font)?.[1])).toBeGreaterThanOrEqual(60);
    expect(name.x).toBeGreaterThan(code.x + 7 * 0.6 * Number(/(\d+)px/.exec(code.font)?.[1]));
  });

  it("the phone's scanner reads a narrow tape label back by its printed code", () => {
    // The PNG's text drawn in the label's own faces; the non-breaking hyphen comes from a
    // fallback face (Plex Mono has none), drawn here as Plex Mono's hyphen.
    const mono = loadMono();
    const sans = loadSans();
    for (const key of ['tape_9', 'tape_12'] as const) {
      const stock = labelStock(key);
      const { width, height } = labelPixelSize(stock);
      const { ctx, texts } = raster(width, height);
      drawLabel(ctx, stock, label({ code: 'K7D2QX', name: 'Spare keys' }), []);
      // The label as a photo would hold it: on a table, with room around it.
      const margin = 60;
      const ink = plane(width + 2 * margin, height + 2 * margin);
      for (const t of texts) {
        const size = Number(/(\d+)px/.exec(t.font)?.[1]);
        const face = t.font.includes('Mono') ? mono : sans;
        // `top` baseline: the em box's top; Plex's ascender is 1.025 em.
        drawText(ink, face, {
          text: t.text.replace('\u2011', '-'),
          size,
          x: t.x + margin,
          y: t.y + margin + size * 1.025,
        });
      }
      const data = new Uint8ClampedArray(ink.width * ink.height);
      for (let i = 0; i < data.length; i++)
        data[i] = 235 - 215 * Math.min(1, ink.data[i] as number);
      const read = readPrintedCode({ width: ink.width, height: ink.height, data });
      expect(read).toMatchObject({ code: 'K7D2QX', sure: true });
    }
  });
});

describe('the name and place are never cut', () => {
  it('draws every word of a long name and its place, over as many lines as they need', () => {
    const stock = labelStock('a4_24_70x37');
    const { width, height } = labelPixelSize(stock);
    const { ctx, texts } = raster(width, height);
    const name = 'Spare cables box (HDMI, USB-A to USB-C, Lightning, DisplayPort, audio)';
    const path = 'Study › Tall bookshelf by the window, second shelf';
    const l = label({ name, path });
    drawLabel(ctx, stock, l, qrMatrix(encode, l.url));
    const lines = texts.slice(1).map((t) => t.text);
    expect(lines.length).toBeGreaterThan(4);
    expect(lines.join(' ')).toBe(`${name} ${path}`);
    expect(lines.join('')).not.toMatch(/…/);
  });
});
