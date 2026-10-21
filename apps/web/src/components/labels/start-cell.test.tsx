/**
 * The sheet preview: each cell that will print shows that label's parts at small scale (the QR,
 * the code and, on a full stock, the name), the accessible name keeps the whole name, a caption
 * says what each label holds, blanks keep their plain QR glyph, and the paper stays LTR in Arabic.
 */
import { labelStock } from '@kept/shared';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { LabelCellContent } from '@/api/capture/types';
import { FSI, PDI } from '@/lib/bidi';
import { expectLogicalOnly, renderUI } from '@/test/render';
import { StartCellPicker } from './start-cell';

const LABELS: LabelCellContent[] = [
  {
    code: '7KQ4MZ',
    url: 'https://kept.example/l/7KQ4MZ',
    kind: 'thing',
    name: 'HDMI cable, 2 m, the long one behind the TV',
    path: 'Home › Study',
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
    />
  );
}

/** The cell's visible parts, as the person sees them. */
const partsOf = (cell: HTMLElement) => ({
  qr: cell.querySelector('[data-slot="preview-qr"]') !== null,
  code: cell.querySelector('[data-slot="preview-code"]')?.textContent ?? null,
  name: cell.querySelector('[data-slot="preview-name"]')?.textContent ?? null,
});

describe('the sheet preview', () => {
  it('a full stock shows each label as it prints: QR, code and name', async () => {
    await renderUI(picker('a4_24_70x37', LABELS));
    const first = screen.getByRole('radio', {
      name: `Label 1, row 1, column 1: ${FSI}HDMI cable, 2 m, the long one behind the TV${PDI}, 7KQ4MZ`,
    });
    const cell = first.closest('label') as HTMLElement;
    expect(partsOf(cell)).toEqual({
      qr: true,
      code: '7KQ‑4MZ',
      name: 'HDMI cable, 2 m, the long one behind the TV',
    });
    // One line, cut short on the paper's thumbnail; the full name is in the accessible name.
    expect(cell.querySelector('[data-slot="preview-name"]')).toHaveClass('truncate');
    expect(
      partsOf(
        screen.getByRole('radio', { name: /^Label 2,.*Box 3/ }).closest('label') as HTMLElement,
      ),
    ).toEqual({ qr: true, code: 'B0X‑3AA', name: 'Box 3' });
    // Cells that won't print stay empty.
    const third = screen.getByRole('radio', { name: 'Label 3, row 1, column 3' });
    expect(partsOf(third.closest('label') as HTMLElement)).toEqual({
      qr: false,
      code: null,
      name: null,
    });
    expect(
      screen.getByText('Each label: QR code, name, where it is and short ID'),
    ).toBeInTheDocument();
  });

  it('a compact stock shows the QR and code only, and says so', async () => {
    await renderUI(picker('a4_65_38x21', LABELS));
    const first = screen.getByRole('radio', { name: 'Label 1, row 1, column 1: 7KQ4MZ' });
    const cell = first.closest('label') as HTMLElement;
    expect(partsOf(cell)).toEqual({ qr: true, code: '7KQ‑4MZ', name: null });
    expect(screen.queryByText(/HDMI cable/)).toBeNull();
    expect(screen.getByText('Each label: QR code and short ID')).toBeInTheDocument();
  });

  it('a blank sheet keeps its plain QR glyphs: no codes until the batch is made', async () => {
    await renderUI(picker('a4_24_70x37', [], 3));
    const first = screen.getByRole('radio', { name: 'Label 1, row 1, column 1' });
    const cell = first.closest('label') as HTMLElement;
    expect(cell.querySelector('[data-slot="preview-label"]')).toBeNull();
    expect(cell.querySelector('svg')).not.toBeNull();
    expect(screen.getByText('Each label: QR code and short ID')).toBeInTheDocument();
  });

  it('in Arabic the paper stays left to right and each name takes its own direction', async () => {
    const ar: LabelCellContent[] = [
      { code: 'AR7HDM', url: 'https://kept.example/l/AR7HDM', kind: 'thing', name: 'كابل HDMI' },
    ];
    await renderUI(picker('a4_24_70x37', ar), { locale: 'ar' });
    const group = screen.getByRole('radiogroup');
    const paper = group.querySelector('[dir="ltr"]') as HTMLElement;
    expect(paper.querySelectorAll('[role="radio"], input[type="radio"]').length).toBeGreaterThan(0);
    const cell = within(paper).getByText('كابل HDMI');
    expect(cell).toHaveAttribute('dir', 'auto');
    expect(within(paper).getByText('AR7‑HDM')).toHaveAttribute('dir', 'ltr');
    expectLogicalOnly();
  });
});
