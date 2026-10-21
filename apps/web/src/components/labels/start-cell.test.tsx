/**
 * The sheet preview is the print, smaller: each cell that will print holds the same `LabelCell`
 * the print sheet draws (the real QR, the code, the whole name and place, broken into the same
 * lines), on the same cells, scaled. Blank sheets show a sample label; a compact stock the QR and
 * code only; the paper stays LTR in Arabic.
 */
import { labelStock } from '@kept/shared';
import { screen, within } from '@testing-library/react';
import { encode } from 'uqr';
import { describe, expect, it } from 'vitest';
import type { LabelCellContent } from '@/api/capture/types';
import { FSI, PDI } from '@/lib/bidi';
import { expectLogicalOnly, renderUI } from '@/test/render';
import { canvasMeasure } from './fit';
import { LabelSheets } from './sheet';
import { StartCellPicker } from './start-cell';

const LONG = 'Spare cables box (HDMI, USB-A to USB-C, Lightning, DisplayPort, audio)';
const LABELS: LabelCellContent[] = [
  {
    code: '7KQ4MZ',
    url: 'https://kept.example/l/7KQ4MZ',
    kind: 'thing',
    name: LONG,
    path: 'Study › Tall bookshelf by the window, second shelf',
  },
  { code: 'B0X3AA', url: 'https://kept.example/l/B0X3AA', kind: 'thing', name: 'Box 3' },
];

function picker(stockKey: string, labels: readonly LabelCellContent[], count = labels.length) {
  return (
    <StartCellPicker
      stock={labelStock(stockKey)}
      value={1}
      onChange={() => {}}
      labels={labels}
      count={count}
      encode={encode}
      measure={canvasMeasure}
    />
  );
}

const cellOf = (name: string | RegExp) =>
  screen.getByRole('radio', { name }).closest('[data-slot="preview-cell"]') as HTMLElement;

/** A label's text as the paper shows it: its lines, in order. */
const linesOf = (label: Element) =>
  Array.from(
    label.querySelectorAll('[data-slot="label-name"] span, [data-slot="label-place"] span'),
  ).map((s) => s.textContent);

describe('the sheet preview', () => {
  it('each cell is the printed label: same code, same lines, a real QR', async () => {
    const stock = labelStock('a4_24_70x37');
    await renderUI(
      <>
        {picker('a4_24_70x37', LABELS)}
        <LabelSheets
          stock={stock}
          labels={LABELS}
          startCell={1}
          encode={encode}
          measure={canvasMeasure}
        />
      </>,
    );
    const cell = cellOf(`Label 1, row 1, column 1: ${FSI}${LONG}${PDI}, 7KQ4MZ`);
    const preview = cell.querySelector('[data-slot="label"]') as HTMLElement;
    const sheet = screen.getByRole('region', { name: 'Sheet 1 of 1' });
    const printed = sheet.querySelectorAll('[data-slot="label"]');
    expect(printed).toHaveLength(2);
    // The same DOM text, line for line.
    expect(preview.textContent).toBe(printed[0]?.textContent);
    expect(linesOf(preview)).toEqual(linesOf(printed[0] as Element));
    // Every word of the name and place is there; nothing ends in "…".
    const nameLines = Array.from(preview.querySelectorAll('[data-slot="label-name"] span')).map(
      (s) => s.textContent,
    );
    expect(nameLines.length).toBeGreaterThan(1);
    expect(nameLines.join(' ')).toBe(LONG);
    expect(preview.textContent).not.toMatch(/…/);
    expect(within(preview).getByText('7KQ‑4MZ')).toBeInTheDocument();
    // A real QR: modules drawn, not an icon.
    expect(preview.querySelector('[data-slot="label-qr"] path')?.getAttribute('d')).toMatch(/^M/);
    // The cell is the stock's own size, on the paper at the print's position.
    expect(cell.style.inlineSize).toBe('70mm');
    expect(cell.style.blockSize).toBe('37mm');
    expect(cell.style.insetBlockStart).toBe('0.5mm');
    expect(
      screen.getByText('Each label: QR code, name, where it is and short ID'),
    ).toBeInTheDocument();
    // Cells that won't print stay empty.
    expect(cellOf('Label 3, row 1, column 3').querySelector('[data-slot="label"]')).toBeNull();
  });

  it('a compact stock shows the QR and code only, and says so', async () => {
    await renderUI(picker('a4_65_38x21', LABELS));
    const cell = cellOf('Label 1, row 1, column 1: 7KQ4MZ');
    expect(within(cell).getByText('7KQ‑4MZ')).toBeInTheDocument();
    expect(cell.querySelector('[data-slot="label-qr"] path')).not.toBeNull();
    expect(cell.querySelector('[data-slot="label-name"]')).toBeNull();
    expect(screen.queryByText(/Spare cables/)).toBeNull();
    expect(screen.getByText('Each label: QR code and short ID')).toBeInTheDocument();
  });

  it('a blank sheet shows a sample label in each cell that will print', async () => {
    await renderUI(picker('a4_24_70x37', [], 3));
    for (const n of [1, 2, 3]) {
      const cell = cellOf(`Label ${n}, row 1, column ${n}`);
      expect(cell.querySelector('[data-slot="label-qr"] path')).not.toBeNull();
      expect(cell.querySelector('[data-slot="label-code"]')).not.toBeNull();
    }
    expect(cellOf('Label 4, row 2, column 1').querySelector('[data-slot="label"]')).toBeNull();
    expect(
      screen.getByText('Each label: QR code and short ID. The codes are made when you print.'),
    ).toBeInTheDocument();
  });

  it('in Arabic the paper stays left to right and each name takes its own direction', async () => {
    const ar: LabelCellContent[] = [
      { code: 'AR7HDM', url: 'https://kept.example/l/AR7HDM', kind: 'thing', name: 'كابل HDMI' },
    ];
    await renderUI(picker('a4_24_70x37', ar), { locale: 'ar' });
    const paper = document.querySelector('[data-slot="sheet-preview"]') as HTMLElement;
    expect(paper).toHaveAttribute('dir', 'ltr');
    expect(paper.querySelectorAll('input[type="radio"]').length).toBe(24);
    const line = within(paper).getByText('كابل HDMI');
    expect(line.closest('p')).toHaveAttribute('dir', 'auto');
    expect(within(paper).getByText('AR7‑HDM')).toHaveAttribute('dir', 'ltr');
    expectLogicalOnly();
  });
});
