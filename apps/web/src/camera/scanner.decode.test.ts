// @vitest-environment node
/**
 * The real decoder on fixture images: `barcode-detector`'s ponyfill with the installed
 * zxing-wasm reader, run in Node. The images are drawn here, pixel by pixel: a QR code with `uqr`
 * (the same encoder the label sheets use), an EAN-13 from its published module tables, and every
 * other format with zxing-wasm's own writer (its symbol, scaled up), so the test needs no image
 * files and no canvas.
 *
 * It also pins the pair: the ponyfill bundles zxing-wasm's JS glue, and the wasm we self-host must
 * be the build that glue was made for (found when testing the scanner). A bump of one without the
 * other fails here, not on a phone.
 *
 * Node has no `ImageData` or `DOMRectReadOnly`; minimal stand-ins are enough for the ponyfill,
 * which checks the former by its tag and builds boxes with the latter.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parseScan } from '@kept/shared';
import { encode } from 'uqr';
import { beforeAll, describe, expect, it } from 'vitest';
import { SCAN_FORMATS } from './scanner';

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
type Writer = typeof import('zxing-wasm/writer');
let ponyfill: Ponyfill;
let writer: Writer;

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
  writer = await import('zxing-wasm/writer');
  const write = readFileSync(require.resolve('zxing-wasm/writer/zxing_writer.wasm'));
  await writer.prepareZXingModule({
    overrides: {
      wasmBinary: write.buffer.slice(write.byteOffset, write.byteOffset + write.byteLength),
    },
    fireImmediately: true,
  });
});

/** Greyscale pixels (true = black) as RGBA ImageData. */
function image(width: number, height: number, black: (x: number, y: number) => boolean) {
  const px = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const v = black(x, y) ? 0 : 255;
      px[i] = v;
      px[i + 1] = v;
      px[i + 2] = v;
      px[i + 3] = 255;
    }
  return new ImageData(px, width, height);
}

function qrImage(text: string, scale = 6) {
  const qr = encode(text, { border: 4 });
  const side = qr.size * scale;
  return image(
    side,
    side,
    (x, y) => qr.data[Math.floor(y / scale)]?.[Math.floor(x / scale)] === true,
  );
}

// EAN-13 (ISO/IEC 15420): the first digit picks the left half's L/G pattern.
const R = [
  '1110010',
  '1100110',
  '1101100',
  '1000010',
  '1011100',
  '1001110',
  '1010000',
  '1000100',
  '1001000',
  '1110100',
];
const L = R.map((r) => [...r].map((b) => (b === '1' ? '0' : '1')).join(''));
const G = R.map((r) => [...r].reverse().join(''));
const PARITY = [
  'LLLLLL',
  'LLGLGG',
  'LLGGLG',
  'LLGGGL',
  'LGLLGG',
  'LGGLLG',
  'LGGGLL',
  'LGLGLG',
  'LGLGGL',
  'LGGLGL',
];

function ean13Image(code: string, scale = 3, height = 120) {
  const d = [...code].map(Number);
  const parity = PARITY[d[0] as number] as string;
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (parity[i - 1] === 'L' ? L : G)[d[i] as number];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R[d[i] as number];
  bits += '101';
  const quiet = '0'.repeat(11);
  const all = quiet + bits + quiet;
  return image(all.length * scale, height, (x) => all[Math.floor(x / scale)] === '1');
}

/** A code drawn by zxing-wasm's writer: its one-channel symbol, `scale` pixels a module. */
async function written(text: string, format: string, options = '') {
  const { symbol, error } = await writer.writeBarcode(text, {
    format: format as never,
    options,
    scale: 1,
  });
  if (error) throw new Error(error);
  const scale = symbol.width > 60 && symbol.height < 60 ? 3 : 6;
  const pad = 12;
  return image(symbol.width * scale + 2 * pad, symbol.height * scale + 2 * pad, (x, y) => {
    const sx = Math.floor((x - pad) / scale);
    const sy = Math.floor((y - pad) / scale);
    if (sx < 0 || sy < 0 || sx >= symbol.width || sy >= symbol.height) return false;
    return symbol.data[sy * symbol.width + sx] === 0;
  });
}

const detector = () => new ponyfill.BarcodeDetector({ formats: [...SCAN_FORMATS] });

describe('the wasm scanner on fixture images', () => {
  it('self-hosts the wasm build the ponyfill was made for', () => {
    const web = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    expect(web.dependencies['zxing-wasm']).toBe(ponyfill.ZXING_WASM_VERSION);
    const wasm = readFileSync(require.resolve('zxing-wasm/reader/zxing_reader.wasm'));
    expect(createHash('sha256').update(wasm).digest('hex')).toBe(ponyfill.ZXING_WASM_SHA256);
  });

  it('reads a Kept label from any host, as the label prints it', async () => {
    const [read] = await detector().detect(qrImage('https://old.example/l/7KQ4MZ'));
    expect(read).toMatchObject({ rawValue: 'https://old.example/l/7KQ4MZ', format: 'qr_code' });
    expect(parseScan(read?.rawValue ?? '', read?.format)).toEqual({ kind: 'kept', code: '7KQ4MZ' });
  });

  it('reads an old Homebox asset label', async () => {
    const [read] = await detector().detect(qrImage('http://homebox.local/a/000-014'));
    expect(parseScan(read?.rawValue ?? '', read?.format)).toMatchObject({
      kind: 'homebox',
      assetId: '000-014',
    });
  });

  it('reads a product barcode and names its format', async () => {
    const [read] = await detector().detect(ean13Image('4006381333931'));
    expect(read).toMatchObject({ rawValue: '4006381333931', format: 'ean_13' });
    expect(parseScan(read?.rawValue ?? '', read?.format)).toMatchObject({
      kind: 'barcode',
      code: '4006381333931',
    });
  });

  // zxing-cpp 3 writes both as 13 digits (UPC-E 01234565 as upc_e "0012345000065", UPC-A
  // 036000291452 as ean_13 "0036000291452"); a thing keeps the digits printed under the bars.
  it.each([
    ['UPCE', '01234565', 'upc_e'],
    ['UPCE', '11234562', 'upc_e'],
    ['UPCA', '036000291452', 'upc_a'],
  ])('reads a %s %s as printed', async (writeAs, code, symbology) => {
    const [read] = await detector().detect(await written(code, writeAs));
    expect(read?.rawValue).toHaveLength(13);
    expect(parseScan(read?.rawValue ?? '', read?.format)).toEqual({
      kind: 'barcode',
      code,
      symbology,
      field: 'barcode',
    });
  });

  it.each([
    ['DataMatrix', 'data_matrix', 'SN-4417-QX', { field: 'either' }],
    ['Code39', 'code_39', 'AT-00417', { field: 'either', prefer: 'serial' }],
    ['Code93', 'code_93', 'IT-2231', { field: 'either', prefer: 'serial' }],
    ['ITF', 'itf', '14006381333938', { field: 'barcode' }],
    ['Codabar', 'codabar', 'A40156B', { field: 'barcode' }],
    ['PDF417', 'pdf417', 'WARRANTY 2291-XQ', { field: 'either' }],
    ['Aztec', 'aztec', 'TICKET 0042', { field: 'either' }],
  ])('reads %s and names it', async (writeAs, format, text, place) => {
    const [read] = await detector().detect(await written(text, writeAs));
    expect(read).toMatchObject({ rawValue: text, format });
    expect(parseScan(read?.rawValue ?? '', read?.format)).toEqual({
      kind: 'barcode',
      code: text,
      symbology: format,
      ...place,
    });
  });

  it('reads a GS1 Data Matrix code as its product barcode and serial number', async () => {
    const [read] = await detector().detect(
      await written('(01)04006381333931(17)271231(10)LOT7(21)K7Q2X9', 'DataMatrix', 'gs1'),
    );
    expect(read?.format).toBe('data_matrix');
    expect(parseScan(read?.rawValue ?? '', read?.format)).toEqual({
      kind: 'barcode',
      code: '4006381333931',
      symbology: 'data_matrix',
      field: 'barcode',
      serial: 'K7Q2X9',
    });
  });

  it('still reads a Kept label printed as a Data Matrix as the label', async () => {
    const [read] = await detector().detect(
      await written('https://kept.example/l/7KQ4MZ', 'DataMatrix'),
    );
    expect(parseScan(read?.rawValue ?? '', read?.format)).toEqual({ kind: 'kept', code: '7KQ4MZ' });
  });

  it('reads nothing in a blank frame', async () => {
    expect(await detector().detect(image(200, 200, () => false))).toEqual([]);
  });
});
