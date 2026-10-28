/**
 * Fitting a label's name and place into its text column: wrap at spaces (a word wider than the
 * column breaks between letters), then step the font down to the readable minimum, then report
 * the labels that still don't fit. Nothing is ever dropped: the lines always join back to the
 * whole text.
 */
import { LABEL_STOCKS, labelStock } from '@kept/shared';
import { describe, expect, it } from 'vitest';
import type { LabelCellContent } from '@/api/capture/types';
import {
  estimateWidth,
  FIT_LINE_HEIGHT,
  fitLabel,
  labelsTooLong,
  NAME_MIN,
  PATH_MIN,
  type TextMeasure,
  wrapLines,
} from './fit';
import { cellMetrics } from './layout';

/** A fixed measure for the tests: em widths per character, scaled by the font size (mm). */
const measure: TextMeasure = (text, size) => {
  let em = 0;
  for (const ch of text) {
    if (/\s/.test(ch)) em += 0.3;
    else if (/[　-鿿가-힯＀-￯]/.test(ch)) em += 1;
    else em += 0.55;
  }
  return em * size;
};

const a4 = labelStock('a4_24_70x37');
const thermal = labelStock('thermal_40x30');

/** Every line fits the column at the size it is set in. */
function expectInColumn(lines: readonly string[], size: number, width: number) {
  for (const line of lines) expect(measure(line, size)).toBeLessThanOrEqual(width + 1e-9);
}

/** The height the label's text takes, as LabelCell lays it out (the code beside it on tape). */
function heightOf(stock = a4, fit: ReturnType<typeof fitLabel>) {
  const m = cellMetrics(stock);
  const gap = m.pad * 0.6;
  let h = m.codeColumn ? 0 : m.code;
  for (const part of [fit.name, fit.path]) {
    if (part && part.lines.length > 0)
      h += (h > 0 ? gap : 0) + part.lines.length * part.size * FIT_LINE_HEIGHT;
  }
  return h;
}

describe('wrapLines', () => {
  it('breaks at spaces and keeps every word', () => {
    const text = 'Cordless stick vacuum with wall dock and spare filters';
    const lines = wrapLines(text, 15, (s) => measure(s, 2.5));
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe(text);
    expectInColumn(lines, 2.5, 15);
  });

  it('a 60-character word breaks between letters, nothing lost', () => {
    const word = 'Pneumonoultramicroscopicsilicovolcanoconiosisextraordinaires';
    expect(word).toHaveLength(60);
    const lines = wrapLines(word, 15, (s) => measure(s, 2.5));
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('')).toBe(word);
    expectInColumn(lines, 2.5, 15);
  });

  it('a CJK name with no spaces breaks between characters', () => {
    const name = '無線メカニカルキーボード茶軸日本語配列テンキーレス';
    const lines = wrapLines(name, 12, (s) => measure(s, 2.5));
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('')).toBe(name);
    expectInColumn(lines, 2.5, 12);
  });

  it('never splits a letter from its marks or an emoji sequence', () => {
    const name = '👩🏽‍🔧👩🏽‍🔧👩🏽‍🔧👩🏽‍🔧👩🏽‍🔧👩🏽‍🔧';
    const lines = wrapLines(name, 4, (s) => measure(s, 2.5));
    expect(lines.join('')).toBe(name);
    for (const line of lines) expect(line.startsWith('👩🏽‍🔧')).toBe(true);
  });
});

describe('fitLabel', () => {
  it('a short name stays at the starting size on one line', () => {
    const m = cellMetrics(a4);
    const fit = fitLabel(a4, { name: 'Webcam', path: 'Study' }, measure);
    expect(fit.fits).toBe(true);
    expect(fit.name).toEqual({ lines: ['Webcam'], size: m.name });
    expect(fit.path).toEqual({ lines: ['Study'], size: m.path });
  });

  it('a long name wraps onto as many lines as it needs, every word kept', () => {
    const name = 'Spare cables box (HDMI, USB-A to USB-C, Lightning, DisplayPort, audio)';
    const fit = fitLabel(a4, { name, path: 'Study › Tall bookshelf by the window' }, measure);
    expect(fit.fits).toBe(true);
    expect(fit.name?.lines.length).toBeGreaterThan(2);
    expect(fit.name?.lines.join(' ')).toBe(name);
    expect(fit.path?.lines.join(' ')).toBe('Study › Tall bookshelf by the window');
    expectInColumn(fit.name?.lines ?? [], fit.name?.size ?? 0, cellMetrics(a4).text);
    expect(heightOf(a4, fit)).toBeLessThanOrEqual(a4.cell.h - 2 * cellMetrics(a4).pad + 1e-9);
  });

  it('steps the font down before giving up, never below the minimum', () => {
    const name = 'Document scanner, duplex, sheet-fed, A4 size';
    const fit = fitLabel(thermal, { name, path: 'Study › Desk › Left drawer' }, measure);
    expect(fit.fits).toBe(true);
    expect(fit.name?.size).toBeLessThan(cellMetrics(thermal).name);
    expect(fit.name?.size).toBeGreaterThanOrEqual(NAME_MIN);
    expect(fit.path?.size).toBeGreaterThanOrEqual(PATH_MIN);
    expect(fit.name?.lines.join(' ')).toBe(name);
    expect(heightOf(thermal, fit)).toBeLessThanOrEqual(
      thermal.cell.h - 2 * cellMetrics(thermal).pad + 1e-9,
    );
  });

  it('an Arabic name wraps by its words and keeps them all', () => {
    const name = 'شاحن محمول عشرون ألف مللي أمبير مع كابلات مدمجة وحافظة جلدية';
    const fit = fitLabel(thermal, { name, path: 'المكتب › الدرج الأيسر' }, measure);
    expect(fit.fits).toBe(true);
    expect(fit.name?.lines.length).toBeGreaterThan(1);
    expect(fit.name?.lines.join(' ')).toBe(name);
  });

  it('a CJK name fits by breaking between characters', () => {
    const name = '無線メカニカルキーボード茶軸日本語配列テンキーレス';
    const fit = fitLabel(thermal, { name }, measure);
    expect(fit.fits).toBe(true);
    expect(fit.name?.lines.join('')).toBe(name);
    expectInColumn(fit.name?.lines ?? [], fit.name?.size ?? 0, cellMetrics(thermal).text);
  });

  it('a 60-character one-word name fits on A4 and on a 40 × 30 roll', () => {
    const word = 'Pneumonoultramicroscopicsilicovolcanoconiosisextraordinaires';
    for (const stock of [a4, thermal]) {
      const fit = fitLabel(stock, { name: word, path: 'Garage' }, measure);
      expect(fit.fits).toBe(true);
      expect(fit.name?.lines.join('')).toBe(word);
      expectInColumn(fit.name?.lines ?? [], fit.name?.size ?? 0, cellMetrics(stock).text);
    }
  });

  it('too long even at the minimum: says so, and still drops nothing', () => {
    const name = 'Very long name for a tiny label '.repeat(6).trim();
    const fit = fitLabel(thermal, { name, path: 'Garage › Shelf A › Top box' }, measure);
    expect(fit.fits).toBe(false);
    expect(fit.name?.size).toBe(NAME_MIN);
    expect(fit.path?.size).toBe(PATH_MIN);
    expect(fit.name?.lines.join(' ')).toBe(name);
  });

  it('a compact stock prints no name or place, so there is nothing to fit', () => {
    const fit = fitLabel(labelStock('a4_65_38x21'), { name: 'x '.repeat(200) }, measure);
    expect(fit).toMatchObject({ name: null, path: null, fits: true });
  });

  it('on narrow tape the name wraps beside the code, within the band, and the place never prints', () => {
    const tape = labelStock('tape_12');
    const m = cellMetrics(tape);
    const fit = fitLabel(
      tape,
      { name: 'Spare keys for the shed', path: 'Garage › Hooks' },
      measure,
    );
    expect(fit.fits).toBe(true);
    expect(fit.path).toBeNull();
    expect(fit.name?.lines.join(' ')).toBe('Spare keys for the shed');
    expectInColumn(fit.name?.lines ?? [], fit.name?.size ?? 0, m.text);
    expect(heightOf(tape, fit)).toBeLessThanOrEqual(tape.cell.h - 2 * m.pad + 1e-9);
  });

  it('a long name on tape steps down, and is listed when it still does not fit', () => {
    const tape = labelStock('tape_9');
    const name = 'Very long name for a tiny label '.repeat(3).trim();
    const fit = fitLabel(tape, { name }, measure);
    expect(fit.fits).toBe(false);
    expect(fit.name?.size).toBe(NAME_MIN);
    expect(fit.name?.lines.join(' ')).toBe(name);
  });

  it('a label with no name or place fits', () => {
    expect(fitLabel(a4, {}, measure)).toMatchObject({ name: null, path: null, fits: true });
  });
});

describe('labelsTooLong', () => {
  it('lists the labels that won’t fit, in print order', () => {
    const long = 'Very long name for a tiny label '.repeat(6).trim();
    const labels: LabelCellContent[] = [
      { code: 'AAA111', url: '/l/AAA111', kind: 'thing', name: 'Webcam', targetId: 't1' },
      { code: 'BBB222', url: '/l/BBB222', kind: 'thing', name: long, targetId: 't2' },
      { code: 'CCC333', url: '/l/CCC333', kind: 'thing', name: `${long} again`, targetId: 't3' },
    ];
    expect(labelsTooLong(thermal, labels, measure).map((l) => l.code)).toEqual([
      'BBB222',
      'CCC333',
    ]);
    expect(labelsTooLong(a4, labels, measure)).toEqual([]);
  });
});

describe('the sizes per stock', () => {
  it.each(LABEL_STOCKS.map((s) => [s.key] as const))(
    '%s: starts at or above the readable minimum',
    (key) => {
      const m = cellMetrics(labelStock(key));
      expect(m.name).toBeGreaterThanOrEqual(NAME_MIN);
      expect(m.path).toBeGreaterThanOrEqual(PATH_MIN);
      // The name never outgrows the code above it.
      expect(m.name).toBeLessThanOrEqual(m.code);
    },
  );

  it('the estimate (no canvas) measures wider letters wider', () => {
    expect(estimateWidth('WWW', 3)).toBeGreaterThan(estimateWidth('iii', 3));
    expect(estimateWidth('中文', 3)).toBeGreaterThan(estimateWidth('ab', 3));
    expect(estimateWidth('abc', 6)).toBeCloseTo(estimateWidth('abc', 3) * 2, 6);
  });
});
