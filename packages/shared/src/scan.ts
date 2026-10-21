/**
 * What a scan says, before any lookup (D120, D137, D146). The phone's
 * scanner, the capture camera and `POST /api/v1/scan/resolve` all start here, so every entry
 * point reads a label the same way.
 *
 * - **Kept labels:** any host's `/l/<code>`, or a bare code typed or read. The host is ignored
 *   (D120), so labels keep working after a domain change. A Kept or Homebox label wins in any
 *   symbol that can carry text (QR, Data Matrix, PDF417, Aztec).
 * - **Homebox labels:** `/a/<assetId>`, `/item/<uuid>`, `/location/<uuid>` on any host (D146).
 *   Asset IDs are `%06d` shown as `000-001`; they come back in that form.
 * - **GS1 codes** (a Data Matrix or Code 128 on electronics and cartons, or brackets typed by
 *   hand): the GTIN (AI 01) is the barcode and the serial (AI 21) the serial.
 * - **Product barcodes:** EAN-8, EAN-13, UPC-A and UPC-E with a valid check digit, an ITF-14
 *   carton code, Codabar and Code 128.
 * - **Asset tags and other codes:** Code 39 and Code 93 are most often asset tags, so a serial
 *   number first; plain Data Matrix, PDF417 and Aztec text could be either, so the person picks.
 *   A code goes only where it fits: a serial holds 100 characters, a barcode 64.
 * - **Anything else** is `other`, and the scanner shows its text ("Not a Kept label").
 */

import { normaliseInputCode, SHORT_CODE } from './short-code.js';

export type ScanResult =
  | { kind: 'kept'; code: string }
  | {
      kind: 'homebox';
      path: 'a' | 'item' | 'location';
      assetId?: string;
      uuid?: string;
      /** Not carried by Homebox's label URLs; asset IDs repeat per collection, so an ambiguous
       * one is resolved by asking (D146). Reserved for a caller that knows the collection. */
      collection?: string;
    }
  | {
      kind: 'barcode';
      /** The code as a thing keeps it: a GS1 code's GTIN (shortened, `gtinShort`), else as read. */
      code: string;
      /** The BarcodeDetector format it was read in, or `gs1` for a GS1 code typed in brackets. */
      symbology: string;
      /** Where it goes on a thing: its barcode, its serial number, or either, the person's pick. */
      field: CodeField;
      /** With `either`, the likelier one, chosen first; none when there is no telling. */
      prefer?: 'barcode' | 'serial';
      /** A GS1 code's serial number (AI 21), kept with the GTIN. */
      serial?: string;
    }
  | { kind: 'other'; text: string };

export type CodeField = 'barcode' | 'serial' | 'either';

/** The longest code each field of a thing holds (things.barcode, things.serial). */
export const CODE_FIELD_MAX = { barcode: 64, serial: 100 } as const;

/** Formats (BarcodeDetector names) that carry a GTIN and so have a check digit. */
const PRODUCT_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'] as const;
/** Formats whose text is a barcode as it is. */
const BARCODE_FORMATS = ['code_128', 'codabar'] as const;
/** Formats that are mostly asset tags: a serial number first. */
const TAG_FORMATS = ['code_39', 'code_93'] as const;
/** Formats that carry any text: a Kept label first, then whatever the text is. */
const TEXT_FORMATS = ['data_matrix', 'pdf417', 'aztec'] as const;
/** Formats whose plain text may be a GS1 element string with no marker (zxing's plain text mode). */
const GS1_FORMATS = ['data_matrix', 'code_128'] as const;

const has = (list: readonly string[], format: string | undefined) => list.includes(format ?? '');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The GS1 check digit of a GTIN-8, -12, -13 or -14 (weights 3,1,3,… from the right). */
export function gtinValid(digits: string): boolean {
  if (!/^(?:\d{8}|\d{12,14})$/.test(digits)) return false;
  let sum = 0;
  for (let i = digits.length - 2, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) {
    sum += Number(digits[i]) * w;
  }
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}

/**
 * A UPC-E code (number system 0 or 1, six digits, check digit) expanded to its UPC-A, whose
 * check digit it shares. Null when it isn't an 8-digit UPC-E.
 */
export function upcEToUpcA(upcE: string): string | null {
  if (!/^[01]\d{7}$/.test(upcE)) return null;
  const ns = upcE[0] as string;
  const m = upcE.slice(1, 7);
  const check = upcE[7] as string;
  const last = Number(m[5]);
  let body: string;
  if (last <= 2) body = `${m.slice(0, 2)}${m[5]}0000${m.slice(2, 5)}`;
  else if (last === 3) body = `${m.slice(0, 3)}00000${m.slice(3, 5)}`;
  else if (last === 4) body = `${m.slice(0, 4)}00000${m[4]}`;
  else body = `${m.slice(0, 5)}0000${m[5]}`;
  return `${ns}${body}${check}`;
}

/**
 * A GTIN-14 in the form a product scan stores it: an EAN-8, UPC-A or EAN-13 padded with zeros
 * comes back as that code; a case code (indicator digit 1–8) stays 14 digits.
 */
export function gtinShort(gtin: string): string {
  if (!/^\d{14}$/.test(gtin)) return gtin;
  if (gtin.startsWith('000000')) return gtin.slice(6);
  if (gtin.startsWith('00')) return gtin.slice(2);
  if (gtin.startsWith('0')) return gtin.slice(1);
  return gtin;
}

// ----- GS1 element strings ----------------------------------------------------------------------

/** The separator between variable-length GS1 fields (FNC1 as decoders write it: ASCII GS). */
const GS = '\u001d';
/** Symbology identifiers a decoder or a keyboard scanner may put before a GS1 element string:
 * GS1 Data Matrix, GS1 QR, GS1-128, GS1 DataBar, GS1 Aztec. */
const GS1_MARKER = /^\](?:d2|Q3|C1|e0|z1)/;

/** How many digits an application identifier has, by its first two (the GS1 General
 * Specifications' AI table); undefined for a prefix no AI starts with. */
function aiLength(two: string): number | undefined {
  if (!/^\d\d$/.test(two)) return undefined;
  const n = Number(two);
  if (n <= 4 || (n >= 10 && n <= 22) || n === 30 || n === 37 || n >= 90) return 2;
  if ((n >= 23 && n <= 25) || (n >= 40 && n <= 42) || n === 71) return 3;
  if ((n >= 31 && n <= 36) || n === 39 || n === 43 || n === 70 || n === 72) return 4;
  if (n >= 80 && n <= 82) return 4;
  return undefined;
}

/** The data length of an AI whose length is predefined (no separator follows it), by its first
 * two digits; every other AI is variable and ends at a separator or the end. */
const FIXED: Record<string, number> = {
  '00': 18,
  '01': 14,
  '02': 14,
  '03': 14,
  '04': 16,
  '11': 6,
  '12': 6,
  '13': 6,
  '14': 6,
  '15': 6,
  '16': 6,
  '17': 6,
  '18': 6,
  '19': 6,
  '20': 2,
  '31': 6,
  '32': 6,
  '33': 6,
  '34': 6,
  '35': 6,
  '36': 6,
  '41': 13,
};

/** The longest a variable field may be (the serial and the batch: 20; 90–99: 90; else 30). */
const variableMax = (ai: string) =>
  ai === '10' || ai === '21' || ai === '22' ? 20 : ai.length === 2 && ai >= '90' ? 90 : 30;

/** Fields whose value is digits only: SSCC, GTINs, dates, variant, measures, GLNs. */
const NUMERIC = /^(?:0[0-2]|1[1-7]|20|3[1-6]\d\d|41\d)$/;

function field(values: Record<string, string>, ai: string, value: string): boolean {
  if (!value || ai in values) return false;
  if (NUMERIC.test(ai) && !/^\d+$/.test(value)) return false;
  if ((ai === '01' || ai === '02') && !gtinValid(value)) return false;
  values[ai] = value;
  return true;
}

/** `(01)04006381333931(21)K7Q2X9`, as GS1 prints it under a code and people type it. */
function bracketed(text: string): Record<string, string> | null {
  const values: Record<string, string> = {};
  const re = /\((\d{2,4})\)([^()]*)/y;
  let at = 0;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    const ai = m[1] as string;
    const value = m[2] as string;
    if (aiLength(ai.slice(0, 2)) !== ai.length) return null;
    const fixed = FIXED[ai.slice(0, 2)];
    if (fixed !== undefined ? value.length !== fixed : value.length > variableMax(ai)) return null;
    if (!field(values, ai, value)) return null;
    at = re.lastIndex;
  }
  return at === text.length && at > 0 ? values : null;
}

/** An element string: AIs and values run together, a separator after each variable field. */
function elements(text: string): Record<string, string> | null {
  const values: Record<string, string> = {};
  let i = 0;
  while (i < text.length) {
    if (text[i] === GS) {
      i++;
      continue;
    }
    const len = aiLength(text.slice(i, i + 2));
    if (len === undefined) return null;
    const ai = text.slice(i, i + len);
    if (!/^\d+$/.test(ai) || ai.length !== len) return null;
    i += len;
    const fixed = FIXED[ai.slice(0, 2)];
    let value: string;
    if (fixed !== undefined) {
      value = text.slice(i, i + fixed);
      if (value.length !== fixed) return null;
      i += fixed;
    } else {
      const end = text.indexOf(GS, i);
      value = text.slice(i, end === -1 ? text.length : end);
      if (value.length > variableMax(ai)) return null;
      i += value.length;
    }
    if (!field(values, ai, value)) return null;
  }
  return Object.keys(values).length > 0 ? values : null;
}

/**
 * A GS1 element string's fields by application identifier (`{'01': GTIN, '21': serial, …}`), or
 * null when the text isn't one. Reads it in brackets, after a symbology identifier (`]d2`,
 * `]Q3`, `]C1`…), or plain with a separator (ASCII GS) after each variable-length field. Plain
 * text with no marker counts only when it starts with a GTIN whose check digit passes, since
 * almost any text parses as some field.
 */
export function parseGs1(raw: string): Record<string, string> | null {
  if (raw.startsWith('(')) return bracketed(raw);
  const marked = GS1_MARKER.test(raw);
  let text = marked ? raw.slice(3) : raw;
  while (text.startsWith(GS)) text = text.slice(1);
  if (!marked && !text.startsWith('01')) return null;
  const values = elements(text);
  if (!values || (!marked && !values['01'])) return null;
  return values;
}

/** A GS1 code as a scan: the GTIN as the barcode with its serial, or the serial alone. */
function gs1Barcode(values: Record<string, string>, symbology: string): ScanResult | null {
  const gtin = values['01'];
  const serial = values['21'];
  if (gtin) {
    return {
      kind: 'barcode',
      code: gtinShort(gtin),
      symbology,
      field: 'barcode',
      ...(serial ? { serial } : {}),
    };
  }
  return serial ? { kind: 'barcode', code: serial, symbology, field: 'serial' } : null;
}

/**
 * A code that isn't a product's, where it fits: `either` (with `prefer` when one is likelier)
 * when it fits both fields, the serial when only that holds it, else nothing.
 */
function placed(
  text: string,
  symbology: string,
  want: CodeField,
  prefer?: 'barcode' | 'serial',
): ScanResult | null {
  const barcode = text.length <= CODE_FIELD_MAX.barcode;
  const serial = text.length <= CODE_FIELD_MAX.serial;
  const base = { kind: 'barcode' as const, code: text, symbology };
  if (want === 'barcode' && barcode) return { ...base, field: 'barcode' };
  if (want === 'either' && barcode)
    return { ...base, field: 'either', ...(prefer ? { prefer } : {}) };
  return serial ? { ...base, field: 'serial' } : null;
}

function productBarcode(text: string, format?: string): ScanResult | null {
  const ok = (symbology: string): ScanResult => ({
    kind: 'barcode',
    code: text,
    symbology,
    field: 'barcode',
  });
  switch (format) {
    case 'ean_13':
      return text.length === 13 && gtinValid(text) ? ok('ean_13') : null;
    case 'ean_8':
      return text.length === 8 && gtinValid(text) ? ok('ean_8') : null;
    case 'upc_a':
      return text.length === 12 && gtinValid(text) ? ok('upc_a') : null;
    case 'upc_e': {
      const a = upcEToUpcA(text);
      return a !== null && gtinValid(a) ? ok('upc_e') : null;
    }
  }
  if (!/^\d+$/.test(text)) return null;
  if (text.length === 13) return gtinValid(text) ? ok('ean_13') : null;
  if (text.length === 12) return gtinValid(text) ? ok('upc_a') : null;
  if (text.length === 8) {
    if (gtinValid(text)) return ok('ean_8');
    const a = upcEToUpcA(text);
    return a !== null && gtinValid(a) ? ok('upc_e') : null;
  }
  return null;
}

type BarcodeScan = Extract<ScanResult, { kind: 'barcode' }>;

/** Whether a barcode scan is a product's GTIN: looked up in the product databases, and never a
 * thing's serial number. */
export function isProductCode(scan: BarcodeScan): boolean {
  return (
    scan.field === 'barcode' &&
    /^\d+$/.test(scan.code) &&
    (has(PRODUCT_FORMATS, scan.symbology) || gtinValid(scan.code))
  );
}

/** What a scan may be a thing's serial number as: a GS1 code's serial, and the code itself unless
 * it is a product's GTIN. */
export function serialsOf(scan: BarcodeScan): string[] {
  const out = scan.serial ? [scan.serial] : [];
  if (!isProductCode(scan) && scan.code.length <= CODE_FIELD_MAX.serial) out.push(scan.code);
  return out;
}

/** A Homebox asset ID in its canonical `000-001` form (as `/a/<assetId>` carries it, padded or
 * not), or null when it isn't one. The Homebox importer writes legacy codes in this form too
 * (homebox.ts homeboxAssetCode()), so a printed label and an imported code always match. */
export function homeboxAssetId(raw: string): string | null {
  const m = /^(\d{3})-(\d{3})$/.exec(raw);
  if (m) return `${m[1]}-${m[2]}`;
  if (!/^\d{1,6}$/.test(raw)) return null;
  const padded = raw.padStart(6, '0');
  return `${padded.slice(0, 3)}-${padded.slice(3)}`;
}

function fromUrl(text: string): ScanResult | null {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  let path: string;
  try {
    path = decodeURIComponent(url.pathname).replace(/\/+$/, '');
  } catch {
    return null;
  }

  const kept = /\/l\/([^/]+)$/.exec(path);
  if (kept) {
    const code = normaliseInputCode(kept[1] as string);
    return SHORT_CODE.test(code) ? { kind: 'kept', code } : null;
  }

  const hb = /\/(a|item|location)\/([^/]+)$/.exec(path);
  if (hb) {
    const kind = hb[1] as 'a' | 'item' | 'location';
    const value = hb[2] as string;
    if (kind === 'a') {
      const assetId = homeboxAssetId(value);
      return assetId ? { kind: 'homebox', path: 'a', assetId } : null;
    }
    return UUID.test(value) ? { kind: 'homebox', path: kind, uuid: value.toLowerCase() } : null;
  }
  return null;
}

/**
 * Classifies scanned or typed text. `format` is the BarcodeDetector format name when the
 * detector gave one (`qr_code`, `ean_13`, `code_128`…). A product format is only read as a
 * product barcode, never as a Kept code.
 */
export function parseScan(input: string, format?: string): ScanResult {
  // trim() keeps a GS1 separator: ASCII GS is not white space.
  const text = input.trim();
  const other: ScanResult = { kind: 'other', text };
  if (!text) return other;

  if (has(PRODUCT_FORMATS, format)) {
    return productBarcode(text, format) ?? other;
  }

  // A GS1 element string, marked as one or, in a symbol that carries them, plain.
  if (GS1_MARKER.test(text) || text.startsWith('(') || has(GS1_FORMATS, format)) {
    const gs1 = parseGs1(text);
    if (gs1) return gs1Barcode(gs1, format ?? 'gs1') ?? other;
  }

  if (has(BARCODE_FORMATS, format)) return placed(text, format as string, 'barcode') ?? other;
  if (has(TAG_FORMATS, format)) return placed(text, format as string, 'either', 'serial') ?? other;
  if (format === 'itf') {
    return gtinValid(text) && text.length === 14
      ? { kind: 'barcode', code: gtinShort(text), symbology: 'itf', field: 'barcode' }
      : (placed(text, 'itf', 'either') ?? other);
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
    const label = fromUrl(text);
    if (label) return label;
    if (!has(TEXT_FORMATS, format)) return other;
  } else {
    const code = normaliseInputCode(text);
    if (SHORT_CODE.test(code)) return { kind: 'kept', code };
  }
  if (has(TEXT_FORMATS, format)) return placed(text, format as string, 'either') ?? other;
  return productBarcode(text) ?? other;
}
