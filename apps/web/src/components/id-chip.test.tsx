import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app-providers';
import { expectLogicalOnly, renderUI } from '@/test/render';
import { IdChip, LabelTape } from './id-chip';
import { markJustPrinted } from './labels/just-printed';
import { StatusPill } from './status-pill';

function reducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: reduce && query.includes('reduce'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}
afterEach(() => vi.unstubAllGlobals());

describe('IdChip', () => {
  it('shows the code as printed, 3 + 3, with the full code as its name', async () => {
    reducedMotion(false);
    await renderUI(<IdChip code="7KQ4MZ" />);
    const chip = screen.getByRole('img', { name: '7KQ4MZ' });
    expect(chip).toHaveTextContent('7KQ‑4MZ');
    expect(chip).toHaveAttribute('dir', 'ltr');
    expect(chip.tagName).toBe('BDI');
    expect(chip).toHaveClass('font-mono');
  });

  it('stays left to right inside Arabic', async () => {
    reducedMotion(false);
    await renderUI(<IdChip code="K7Q3FM" />, { locale: 'ar' });
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('img', { name: 'K7Q3FM' })).toHaveAttribute('dir', 'ltr');
    expectLogicalOnly();
  });

  it('renders nothing until a code is allocated, unless asked to show it pending', async () => {
    reducedMotion(false);
    const { container } = await renderUI(<IdChip code={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('"ID pending": a dashed chip, announced as "ID pending"', async () => {
    reducedMotion(false);
    await renderUI(<IdChip code={null} pending />);
    const chip = screen.getByRole('img', { name: 'ID pending' });
    expect(chip).toHaveTextContent('ID pending');
    expect(chip).toHaveAttribute('data-pending', 'true');
    expect(chip).toHaveClass('border-dashed');
    expect(chip).not.toHaveClass('font-mono');
  });

  it('"ID pending" in Arabic keeps logical CSS; the code that arrives is not printed yet', async () => {
    reducedMotion(false);
    const { rerender } = await renderUI(<IdChip code={null} pending />, { locale: 'ar' });
    expectLogicalOnly();
    rerender(
      <AppProviders locale="ar">
        <IdChip code="7KQ4MZ" variant="quiet" pending />
      </AppProviders>,
    );
    const chip = screen.getByRole('img', { name: '7KQ4MZ' });
    expect(chip).not.toHaveAttribute('data-printing');
  });

  it('does not animate a code that was already there, or under reduced motion', async () => {
    reducedMotion(false);
    const { unmount } = await renderUI(<IdChip code="7KQ4MZ" />);
    expect(screen.getByRole('img')).not.toHaveAttribute('data-printing');
    unmount();
    reducedMotion(true);
    await renderUI(<IdChip code="7KQ4MZ" fresh />);
    expect(screen.getByRole('img')).not.toHaveAttribute('data-printing');
  });

  it('animates a fresh code on mount', async () => {
    reducedMotion(false);
    await renderUI(<IdChip code="7KQ4MZ" fresh />);
    expect(screen.getByRole('img')).toHaveAttribute('data-printing', 'true');
  });
});

describe('IdChip quiet: a code with no printed label', () => {
  it('is small neutral mono, no amber, still named by the code and left to right', async () => {
    reducedMotion(false);
    await renderUI(<IdChip code="7KQ4MZ" variant="quiet" />, { locale: 'ar' });
    const chip = screen.getByRole('img', { name: '7KQ4MZ' });
    expect(chip).toHaveTextContent('7KQ‑4MZ');
    expect(chip).toHaveAttribute('dir', 'ltr');
    expect(chip).toHaveAttribute('data-variant', 'quiet');
    expect(chip).toHaveClass('font-mono', 'text-ink-2');
    expect(chip.className).not.toMatch(/amber|F0B03A/);
    expectLogicalOnly();
  });

  it('the tape is amber, marked as the tape', async () => {
    reducedMotion(false);
    await renderUI(<IdChip code="7KQ4MZ" />);
    expect(screen.getByRole('img')).toHaveAttribute('data-variant', 'tape');
  });

  it('prints like tape when it turns from quiet to tape on screen (a label just printed)', async () => {
    reducedMotion(false);
    const { rerender } = await renderUI(<IdChip code="7KQ4MZ" variant="quiet" />);
    expect(screen.getByRole('img')).not.toHaveAttribute('data-printing');
    rerender(
      <AppProviders locale="en">
        <IdChip code="7KQ4MZ" variant="tape" />
      </AppProviders>,
    );
    expect(screen.getByRole('img')).toHaveAttribute('data-printing', 'true');
  });

  it('prints once on its next appearance after its label was confirmed printed', async () => {
    reducedMotion(false);
    markJustPrinted(['2HX9RB']);
    const first = await renderUI(<IdChip code="2HX9RB" />);
    expect(screen.getByRole('img')).toHaveAttribute('data-printing', 'true');
    first.unmount();
    await renderUI(<IdChip code="2HX9RB" />);
    expect(screen.getByRole('img')).not.toHaveAttribute('data-printing');
  });

  it('a code arriving (an offline thing synced) does not print: printing is for labels', async () => {
    reducedMotion(false);
    const { rerender } = await renderUI(<IdChip code={null} pending />);
    rerender(
      <AppProviders locale="en">
        <IdChip code="9KW4RP" pending />
      </AppProviders>,
    );
    expect(screen.getByRole('img', { name: '9KW4RP' })).not.toHaveAttribute('data-printing');
  });

  it('a quiet code just printed elsewhere does not print (only the tape does)', async () => {
    reducedMotion(false);
    markJustPrinted(['K7Q3FM']);
    await renderUI(<IdChip code="K7Q3FM" variant="quiet" />);
    expect(screen.getByRole('img')).not.toHaveAttribute('data-printing');
  });
});

describe('LabelTape: the code in a list, only when it has a printed label', () => {
  it('shows nothing for a code with no printed label', async () => {
    reducedMotion(false);
    const { container } = await renderUI(<LabelTape code="7KQ4MZ" printed={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the tape for a printed one', async () => {
    reducedMotion(false);
    await renderUI(<LabelTape code="7KQ4MZ" printed />);
    expect(screen.getByRole('img', { name: '7KQ4MZ' })).toHaveAttribute('data-variant', 'tape');
  });

  it('shows "ID pending" for a thing that has no code yet, when asked', async () => {
    reducedMotion(false);
    await renderUI(<LabelTape code={null} printed={false} pending />);
    expect(screen.getByRole('img', { name: 'ID pending' })).toBeInTheDocument();
  });
});

describe('StatusPill (never colour alone)', () => {
  it.each([
    ['uncertain', 'Not sure where'],
    ['draft', 'Draft'],
    ['ended', 'Ended'],
    ['needs_review', 'Needs review'],
  ] as const)('%s has an icon and a word', async (state, word) => {
    await renderUI(<StatusPill state={state} />);
    const pill = screen.getByText(word).closest('[data-status]') as HTMLElement;
    expect(pill).toHaveAttribute('data-status', state);
    expect(pill.querySelector('svg')).not.toBeNull();
  });

  it('an ended pill can name the lifecycle', async () => {
    await renderUI(<StatusPill state="ended" label="Given away" />);
    expect(screen.getByText('Given away')).toBeInTheDocument();
  });

  it('in Arabic', async () => {
    await renderUI(<StatusPill state="draft" />, { locale: 'ar' });
    expectLogicalOnly();
  });
});
