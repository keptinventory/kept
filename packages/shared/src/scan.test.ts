import { describe, expect, it } from 'vitest';
import { gtinShort, gtinValid, parseGs1, parseScan, upcEToUpcA } from './scan.js';

describe('parseScan: Kept labels (D120, §2.4)', () => {
  it.each([
    ['https://old.example/l/ab1lo0', 'AB1100'],
    ['https://kept.example/l/AB1100', 'AB1100'],
    ['http://192.168.1.20:8080/l/AB1100/', 'AB1100'],
    ['https://example.org/kept/l/ab1100?utm=1#x', 'AB1100'],
    ['AB1100', 'AB1100'],
    [' ab-11o0 ', 'AB1100'],
    ['123456', '123456'],
  ])('%s → %s', (text, code) => {
    expect(parseScan(text)).toEqual({ kind: 'kept', code });
  });

  it('ignores the host, so a label keeps working after a domain change', () => {
    expect(parseScan('https://anything.invalid/l/ZZZZZZ')).toEqual({
      kind: 'kept',
      code: 'ZZZZZZ',
    });
  });

  it.each([
    'http://x/l/ABC', // too short
    'https://x.example/l/ABCDEFG', // too long
    'https://x.example/l/AB U100', // U is not in the alphabet
    'ftp://x.example/l/AB1100', // not http(s)
    'https://x.example/k/AB1100',
    'ABCDEFG',
  ])('%s is other', (text) => {
    expect(parseScan(text)).toEqual({ kind: 'other', text: text.trim() });
  });
});

describe('parseScan: Homebox labels (D146)', () => {
  const uuid = '8f1c2b4e-3d5a-4c6b-9e7f-0a1b2c3d4e5f';
  it.each([
    ['https://homebox.lan/a/000-001', { path: 'a', assetId: '000-001' }],
    ['https://homebox.lan/a/000001', { path: 'a', assetId: '000-001' }],
    ['http://10.0.0.5:7745/a/12', { path: 'a', assetId: '000-012' }],
    [`https://hb.example/item/${uuid}`, { path: 'item', uuid }],
    [`https://hb.example/location/${uuid.toUpperCase()}`, { path: 'location', uuid }],
  ])('%s', (text, expected) => {
    expect(parseScan(text)).toEqual({ kind: 'homebox', ...expected });
  });

  it.each([
    'https://hb.example/a/abc',
    'https://hb.example/a/1234567',
    'https://hb.example/item/not-a-uuid',
  ])('%s is other', (text) => {
    expect(parseScan(text).kind).toBe('other');
  });
});

describe('parseScan: product barcodes', () => {
  it.each([
    ['4006381333931', undefined, 'ean_13'],
    ['4006381333931', 'ean_13', 'ean_13'],
    ['96385074', undefined, 'ean_8'],
    ['036000291452', undefined, 'upc_a'],
    ['036000291452', 'upc_a', 'upc_a'],
    ['04252614', 'upc_e', 'upc_e'],
  ])('%s (%s) → %s', (code, format, symbology) => {
    expect(parseScan(code, format)).toEqual({ kind: 'barcode', code, symbology, field: 'barcode' });
  });

  it('refuses a wrong check digit', () => {
    expect(parseScan('4006381333932')).toEqual({ kind: 'other', text: '4006381333932' });
    expect(parseScan('4006381333932', 'ean_13').kind).toBe('other');
    expect(parseScan('04252615', 'upc_e').kind).toBe('other');
  });

  it('takes any other 1D format the detector names as it is', () => {
    expect(parseScan('SN-4411-A', 'code_128')).toEqual({
      kind: 'barcode',
      code: 'SN-4411-A',
      symbology: 'code_128',
      field: 'barcode',
    });
  });

  it('does not read a 6-digit product barcode as a Kept code', () => {
    expect(parseScan('123456', 'code_128')).toEqual({
      kind: 'barcode',
      code: '123456',
      symbology: 'code_128',
      field: 'barcode',
    });
  });

  it('shows any other QR text as other', () => {
    expect(parseScan('WIFI:T:WPA;S:home;P:secret;;', 'qr_code')).toEqual({
      kind: 'other',
      text: 'WIFI:T:WPA;S:home;P:secret;;',
    });
    expect(parseScan('')).toEqual({ kind: 'other', text: '' });
  });
});

describe('check digits', () => {
  it('validates GTIN-8/12/13 and expands UPC-E', () => {
    expect(gtinValid('4006381333931')).toBe(true);
    expect(gtinValid('4006381333932')).toBe(false);
    expect(gtinValid('96385074')).toBe(true);
    expect(gtinValid('abc')).toBe(false);
    expect(gtinValid('14006381333938')).toBe(true);
    expect(gtinValid('14006381333937')).toBe(false);
    expect(upcEToUpcA('04252614')).toBe('042100005264');
    expect(upcEToUpcA('01234505')).toBe('012000003455');
    expect(upcEToUpcA('21234565')).toBeNull(); // number system 2 has no UPC-E
  });
});

describe('parseScan: asset tags and other codes', () => {
  it.each(['code_39', 'code_93'])(
    'takes %s as a serial number, or a barcode if the person says',
    (format) => {
      expect(parseScan('AT-00417', format)).toEqual({
        kind: 'barcode',
        code: 'AT-00417',
        symbology: format,
        field: 'either',
        prefer: 'serial',
      });
    },
  );

  it('takes Codabar as a barcode', () => {
    expect(parseScan('A40156B', 'codabar')).toEqual({
      kind: 'barcode',
      code: 'A40156B',
      symbology: 'codabar',
      field: 'barcode',
    });
  });

  it('takes an ITF-14 carton code as its product barcode when the check digit passes', () => {
    expect(parseScan('14006381333938', 'itf')).toEqual({
      kind: 'barcode',
      code: '14006381333938',
      symbology: 'itf',
      field: 'barcode',
    });
    // A GTIN-14 with a leading zero is the EAN-13 inside it, as a product scan stores it.
    expect(parseScan('04006381333931', 'itf')).toMatchObject({ code: '4006381333931' });
    // Any other ITF is the person's to place.
    expect(parseScan('14006381333937', 'itf')).toEqual({
      kind: 'barcode',
      code: '14006381333937',
      symbology: 'itf',
      field: 'either',
    });
  });

  it.each(['data_matrix', 'pdf417', 'aztec'])('asks where plain %s text goes', (format) => {
    expect(parseScan('SN-4417-QX', format)).toEqual({
      kind: 'barcode',
      code: 'SN-4417-QX',
      symbology: format,
      field: 'either',
    });
  });

  it('offers only what fits: a serial up to 100 characters, a barcode up to 64', () => {
    const long = 'W'.repeat(80);
    expect(parseScan(long, 'pdf417')).toEqual({
      kind: 'barcode',
      code: long,
      symbology: 'pdf417',
      field: 'serial',
    });
    expect(parseScan('A'.repeat(70), 'code_39')).toMatchObject({ field: 'serial' });
    const huge = 'Warranty card. '.repeat(10).trim();
    expect(parseScan(huge, 'pdf417')).toEqual({ kind: 'other', text: huge });
    expect(parseScan('A'.repeat(101), 'code_128')).toMatchObject({ kind: 'other' });
  });

  it('still reads a Kept or Homebox label first, whatever symbol carries it', () => {
    expect(parseScan('https://kept.example/l/7KQ4MZ', 'data_matrix')).toEqual({
      kind: 'kept',
      code: '7KQ4MZ',
    });
    expect(parseScan('7KQ4MZ', 'aztec')).toEqual({ kind: 'kept', code: '7KQ4MZ' });
    expect(parseScan('http://homebox.local/a/000-014', 'pdf417')).toMatchObject({
      kind: 'homebox',
      assetId: '000-014',
    });
  });
});

describe('parseScan: GS1 codes', () => {
  it('keeps a GS1 Data Matrix code’s GTIN as the barcode and its serial as the serial', () => {
    expect(parseScan('010400638133393121K7Q2X9', 'data_matrix')).toEqual({
      kind: 'barcode',
      code: '4006381333931',
      symbology: 'data_matrix',
      field: 'barcode',
      serial: 'K7Q2X9',
    });
  });

  it('reads the element string with or without a symbology identifier, and in brackets', () => {
    const want = { kind: 'barcode', code: '4006381333931', serial: 'K7Q2X9', field: 'barcode' };
    expect(parseScan(`]d2010400638133393121K7Q2X9`)).toMatchObject(want);
    expect(parseScan(`]Q3010400638133393121K7Q2X9`, 'qr_code')).toMatchObject(want);
    expect(parseScan(`]C1010400638133393121K7Q2X9`, 'code_128')).toMatchObject(want);
    expect(parseScan('(01)04006381333931(21)K7Q2X9')).toMatchObject(want);
    expect(parseScan('010400638133393121K7Q2X9', 'code_128')).toMatchObject(want);
  });

  it('takes a serial-only GS1 code as the serial', () => {
    expect(parseScan('(21)K7Q2X9')).toEqual({
      kind: 'barcode',
      code: 'K7Q2X9',
      symbology: 'gs1',
      field: 'serial',
    });
  });

  it('is not GS1 when the GTIN check digit fails: the text is the person’s to place', () => {
    expect(parseScan('010400638133393721K7Q2X9', 'data_matrix')).toMatchObject({
      code: '010400638133393721K7Q2X9',
      field: 'either',
    });
  });

  it('shows a GS1 code with neither GTIN nor serial as text', () => {
    expect(parseScan('(17)271231(10)LOT7')).toEqual({ kind: 'other', text: '(17)271231(10)LOT7' });
  });
});

describe('GS1 element strings', () => {
  const GS = '\u001d';
  it.each([
    ['plain, the GTIN first', `010400638133393117271231` + `10LOT7${GS}21K7Q2X9`],
    ['with a leading separator', `${GS}010400638133393117271231` + `10LOT7${GS}21K7Q2X9`],
    ['after ]d2', `]d2010400638133393117271231` + `10LOT7${GS}21K7Q2X9`],
    ['in brackets', '(01)04006381333931(17)271231(10)LOT7(21)K7Q2X9'],
  ])('%s', (_how, text) => {
    expect(parseGs1(text)).toEqual({
      '01': '04006381333931',
      '17': '271231',
      '10': 'LOT7',
      '21': 'K7Q2X9',
    });
  });

  it.each([
    ['not an element string', 'SN-4417-QX'],
    ['a plain string that does not start with a GTIN', '21K7Q2X9'],
    ['a wrong GTIN check digit', '(01)04006381333932'],
    ['a short fixed field', '(01)0400638133'],
    ['an unknown application identifier', '(05)123'],
    ['an empty field', '(21)'],
    ['a field too long', `(21)${'A'.repeat(21)}`],
  ])('refuses %s', (_why, text) => {
    expect(parseGs1(text)).toBeNull();
  });

  it('shortens a GTIN-14 to the form a product scan stores', () => {
    expect(gtinShort('04006381333931')).toBe('4006381333931');
    expect(gtinShort('00036000291452')).toBe('036000291452');
    expect(gtinShort('00000096385074')).toBe('96385074');
    expect(gtinShort('14006381333938')).toBe('14006381333938');
  });
});
