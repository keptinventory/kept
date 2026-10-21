/**
 * Kits and hand-overs on the thing page (1.14, #170), on the mock's sample: the camera bag's
 * Parts tab (a part elsewhere, Put back), the tripod case's hand-over (one line still out) and its
 * checklist, and the lend sheet listing what goes with a box.
 */
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KIT_IDS, seedKitSample } from '@/api/household/mock/handovers';
import { INV_IDS } from '@/api/inventory/mock/fixtures';
import { findHeading, renderApp } from '../app';

afterEach(() => vi.unstubAllGlobals());

describe('a kit', () => {
  it('lists its parts, says what is not in it, and puts one back', async () => {
    const { user, mock } = await renderApp(`/t/${KIT_IDS.bag}?tab=parts`, {
      setup: (m) => seedKitSample(m.state),
    });
    await findHeading('Camera bag');
    expect(await screen.findByText('1 part not in the kit')).toBeInTheDocument();
    const parts = screen.getByRole('list', { name: 'Parts' });
    const battery = within(parts).getByText('Spare battery').closest('li') as HTMLElement;
    expect(within(battery).getByText('Elsewhere')).toBeInTheDocument();
    await user.click(within(battery).getByRole('button', { name: 'Put back' }));
    await waitFor(() =>
      expect(mock.state.inventory.things.find((t) => t.id === KIT_IDS.battery)?.containerId).toBe(
        KIT_IDS.bag,
      ),
    );
    expect(await screen.findByText('Complete')).toBeInTheDocument();
  });
});

describe('a hand-over', () => {
  it('shows how many came back, and brings the last one back from the checklist', async () => {
    const { user, mock } = await renderApp(`/t/${KIT_IDS.tripodKit}?tab=loans`, {
      setup: (m) => seedKitSample(m.state),
    });
    await findHeading('Tripod case');
    expect(await screen.findByText('2 of 3 came back')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mark returned' }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText('Tripod head')).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    const head = mock.state.household.loans.find((l) => l.id === KIT_IDS.headLine);
    await waitFor(() => expect(head?.returnedAt).toBeTruthy());
  });

  it('lends a box with what is inside it', async () => {
    const { user } = await renderApp(`/t/${INV_IDS.thing.box3}?tab=loans`);
    await findHeading('Box 3');
    await user.click(await screen.findByRole('button', { name: 'Lend' }));
    const sheet = await screen.findByRole('dialog');
    expect(await within(sheet).findByText('Everything inside goes too')).toBeInTheDocument();
    expect(within(sheet).getByText('Winter scarves')).toBeInTheDocument();
  });
});
