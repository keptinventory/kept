/**
 * Help: Tours lists Basics and one tour per section the person has, each with its step count
 * or Done, and any of them replays; a page's Show me starts its section's tour right there;
 * Basics walks the real screens; the Get-started checklist comes back from here; install and
 * share-into notes per platform (iPhone has no share target); the diagnostics link.
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { inventoryPaths } from '@/api/inventory/paths';
import { firstRunScenario, ownerScenario } from '@/api/mock/fixtures';
import { tourRequests } from '@/components/hints/tour-request';
import { expectLogicalOnly } from '@/test/render';
import { findHeading, pathOf, renderApp } from '../app';

const key = (k: string) => fireEvent.keyDown(window, { key: k });

afterEach(() => {
  // A tour left open by a failed test must not leak into the next one.
  act(() => key('Escape'));
  for (const el of document.querySelectorAll('.driver-popover, .driver-overlay')) el.remove();
  tourRequests.reset();
});

/** Help's tour rows, by tour id. */
const tourRows = () =>
  [...document.querySelectorAll('[data-tour-row]')].map((li) => li.getAttribute('data-tour-row'));

describe('Help', () => {
  it('shows the tours, the checklist, install and share-into notes, and diagnostics', async () => {
    await renderApp('/help');
    expect(await findHeading('Help')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tours' })).toBeInTheDocument();
    expect(screen.queryByText('Show me around')).toBeNull();
    expect(screen.getByText('Get-started checklist')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show steps' })).toBeInTheDocument();
    expect(
      screen.getByText(/iPhone doesn't let web apps appear in the Share sheet/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute(
      'href',
      '/settings/diagnostics',
    );
    expect(within(screen.getByRole('main')).queryByText('Coming soon')).toBeNull();
  });

  it('lists exactly the tours this person has, each with its step count', async () => {
    await renderApp('/help');
    await findHeading('Help');
    // Moving and Fuel are off in every location of this household.
    await waitFor(() => expect(tourRows()).toHaveLength(12));
    expect(tourRows()).toEqual([
      'basics',
      'things',
      'map',
      'capture',
      'scanning',
      'search',
      'lending',
      'schedules',
      'paperwork',
      'vehicles',
      'import-export',
      'settings',
    ]);
    const basics = screen.getByText('Basics').closest('li');
    if (!basics) throw new Error('no Basics row');
    expect(basics).toHaveTextContent('6 steps');
    expect(within(basics).getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.getByText('Vehicles & fuel').closest('li')).toHaveTextContent('3 steps');
    expectLogicalOnly();
  });

  it('leaves out the tours of a viewer everywhere that only change things', async () => {
    const state = ownerScenario();
    state.locations = state.locations.map((l) => ({ ...l, role: 'viewer' as const }));
    await renderApp('/help', { state });
    await findHeading('Help');
    await waitFor(() => expect(tourRows()).toContain('lending'));
    expect(tourRows()).not.toContain('capture');
    expect(tourRows()).toContain('basics');
    // Things & places loses Add here and Actions.
    expect(screen.getByText('Things & places').closest('li')).toHaveTextContent('3 steps');
  });

  it('Basics walks the real screens, then shows Done and replays', async () => {
    const { user, mock, router } = await renderApp('/help');
    await findHeading('Help');
    const row = () => screen.getByText('Basics').closest('li') as HTMLElement;
    await user.click(within(row()).getByRole('button', { name: 'Start' }));

    const legs: { name: string; path: string }[] = [
      { name: 'Needs you', path: '/' },
      { name: 'Your locations', path: '/' },
      { name: 'Scan', path: '/' },
      { name: 'Search', path: '/search' },
      { name: 'More', path: '/more' },
      { name: 'Tours', path: '/help' },
    ];
    for (const [k, leg] of legs.entries()) {
      const dialog = await screen.findByRole('dialog', { name: leg.name });
      expect(dialog).toHaveTextContent(`${k + 1} of ${legs.length}`);
      expect(pathOf(router)).toBe(leg.path);
      await user.click(
        within(dialog).getByRole('button', { name: k < legs.length - 1 ? 'Next' : 'Done' }),
      );
    }
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() =>
      expect(mock.lastCall('PUT', inventoryPaths.hint('help.tours.basics'))?.body).toEqual({
        seen: true,
        dismissed: true,
      }),
    );
    await waitFor(() => expect(row()).toHaveTextContent('Done'));
    expectLogicalOnly();
    await user.click(within(row()).getByRole('button', { name: 'Replay' }));
    expect(await screen.findByRole('dialog', { name: 'Needs you' })).toHaveTextContent('1 of 6');
  }, 60000);

  it('Show me on a section’s page starts its tour there', async () => {
    const { user, router } = await renderApp('/lending');
    await findHeading('Lending');
    await user.click(await screen.findByRole('button', { name: 'Show me' }));
    const first = await screen.findByRole('dialog', { name: 'Loans' });
    expect(first).toHaveTextContent('1 of');
    expect(pathOf(router)).toBe('/lending');
    // While it runs, Show me stands down.
    expect(screen.getByRole('button', { name: 'Show me' })).toBeDisabled();
  }, 60000);

  it('has no Show me where the section’s tour isn’t one this person has', async () => {
    await renderApp('/lending', { state: firstRunScenario() });
    await findHeading('Lending');
    expect(screen.queryByRole('button', { name: 'Show me' })).toBeNull();
  });

  it('in Arabic the arrows follow the reading direction, and the steps use its digits', async () => {
    const { user } = await renderApp('/help', { locale: 'ar' });
    await findHeading('المساعدة');
    const basics = screen.getByText('الأساسيات').closest('li') as HTMLElement;
    await user.click(within(basics).getByRole('button', { name: 'ابدأ' }));
    const first = await screen.findByRole('dialog', { name: 'ما يحتاج إليك' });
    expect(first).toHaveTextContent('١ من ٦');
    // Forward is to the left in Arabic.
    act(() => key('ArrowLeft'));
    expect(await screen.findByRole('dialog', { name: 'مواقعك' })).toHaveTextContent('٢ من ٦');
    act(() => key('ArrowRight'));
    expect(await screen.findByRole('dialog', { name: 'ما يحتاج إليك' })).toBeInTheDocument();
    expectLogicalOnly();
  });

  it('brings a hidden Get-started checklist back to Home', async () => {
    const state = ownerScenario();
    state.inventory.checklistDismissed = true;
    state.inventory.hints.push({
      key: 'checklist',
      seenAt: null,
      dismissedAt: new Date().toISOString(),
    });
    const { user, mock } = await renderApp('/help', { state });
    await findHeading('Help');
    expect(await screen.findByText('Hidden from Home.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Bring it back' }));
    await waitFor(() =>
      expect(mock.lastCall('PUT', inventoryPaths.hint('checklist'))?.body).toEqual({
        dismissed: false,
      }),
    );
    expect(await screen.findByText('The checklist is back on Home')).toBeInTheDocument();
    expect(await screen.findByText('On Home until every step is done.')).toBeInTheDocument();
  });
});
