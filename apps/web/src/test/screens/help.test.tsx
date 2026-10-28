/**
 * Help: the page fills the width like the list pages; one tour in chapters (Basics and one per
 * section the person has), listed compactly under the progress and Take the tour or Continue the
 * tour (the first unfinished chapter): each row, with its number and step count, starts its
 * chapter, and the chapters done fold away under Done (N); a chapter's last step offers the next
 * one; a page's Show me starts its chapter right there; the Get-started checklist comes back from
 * here; install and share-into notes per platform (iPhone has no share target); the diagnostics
 * link.
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { inventoryPaths } from '@/api/inventory/paths';
import { firstRunScenario, ownerScenario } from '@/api/mock/fixtures';
import { paths } from '@/api/paths';
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
    expect(screen.getByRole('heading', { name: 'The tour' })).toBeInTheDocument();
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

  it('uses the page width like the list pages, its text keeping a readable measure', async () => {
    await renderApp('/help');
    await findHeading('Help');
    const body = document.querySelector('[data-slot="page-body"]');
    // The list pages' column (Page `wide`), and it fills under Full width (styles/index.css).
    expect(body).toHaveClass('max-w-6xl');
    expect(body).toHaveClass('page-fill');
    expect(body).not.toHaveClass('max-w-3xl');
  });

  it('lists the chapters compactly, under the progress and Take the tour', async () => {
    await renderApp('/help');
    await findHeading('Help');
    expect(screen.getByRole('heading', { name: 'The tour' })).toBeInTheDocument();
    // Moving is off in every location of this household.
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
    expect(screen.getByRole('button', { name: 'Take the tour' })).toBeInTheDocument();
    expect(screen.getByText('12 chapters')).toBeInTheDocument();
    // No big row per chapter with its own button: the whole row starts it.
    expect(screen.queryByRole('button', { name: 'Start here' })).toBeNull();
    const basics = screen.getByRole('button', { name: 'Basics' });
    expect(basics).toHaveAccessibleDescription('6 steps');
    expect(basics).toHaveTextContent('1');
    // A 44 px target, one tight line: no tile, no subtitle row.
    expect(basics).toHaveClass('min-h-11');
    expect(basics.querySelector('.size-10')).toBeNull();
    // A saved service opens: Vehicles & fuel has a Services step (fuel is off here).
    expect(screen.getByRole('button', { name: 'Vehicles & fuel' })).toHaveAccessibleDescription(
      '4 steps',
    );
    expect(screen.getByRole('button', { name: 'Graph & 3D map' })).toHaveAccessibleDescription(
      '6 steps',
    );
    // Nothing done yet: no Done group.
    expect(screen.queryByRole('button', { name: /^Done/ })).toBeNull();
    expectLogicalOnly();
  });

  it('starts a chapter from its row', async () => {
    const { user, router } = await renderApp('/help');
    await findHeading('Help');
    await user.click(await screen.findByRole('button', { name: 'Lending' }));
    const first = await screen.findByRole('dialog', { name: 'Loans' });
    expect(first).toHaveTextContent('Chapter 7 of 12 · step 1 of');
    expect(pathOf(router)).toBe('/lending');
  }, 60000);

  it('lists no chapters until the locations have loaded', async () => {
    // Before, it listed the 7 chapters of no location at all, and the tour started from one of
    // them counted the person's 12 (#314).
    await renderApp('/help', { setup: (m) => m.hang('GET', paths.locations) });
    await findHeading('Help');
    expect(screen.getByRole('heading', { name: 'The tour' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('main')).getByRole('status', { name: 'Loading' }),
    ).toBeInTheDocument();
    expect(tourRows()).toEqual([]);
  });

  it('lists no chapters until it knows which are done, so none jumps into Done (N)', async () => {
    const state = ownerScenario();
    const at = new Date().toISOString();
    state.inventory.hints.push({ key: 'help.tours.basics', seenAt: at, dismissedAt: at });
    await renderApp('/help', { state, setup: (m) => m.hang('GET', inventoryPaths.hints) });
    await findHeading('Help');
    expect(screen.getByRole('heading', { name: 'The tour' })).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 200));
    expect(tourRows()).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Basics' })).toBeNull();
  });

  it('folds the chapters done away, and continues at the first one not done', async () => {
    const state = ownerScenario();
    const at = new Date().toISOString();
    for (const id of ['basics', 'things', 'scanning'])
      state.inventory.hints.push({ key: `help.tours.${id}`, seenAt: at, dismissedAt: at });
    const { user, router } = await renderApp('/help', { state });
    await findHeading('Help');
    await waitFor(() => expect(screen.getByText('3 of 12 done')).toBeInTheDocument());
    const bar = screen.getByRole('progressbar', { name: 'Chapters done' });
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemax', '12');
    // Done chapters are under a closed Done (3); the rest keep their numbers.
    const fold = screen.getByRole('button', { name: 'Done (3)' });
    expect(fold).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Basics' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Graph & 3D map' })).toHaveTextContent('3');
    await user.click(fold);
    // Opened, each still starts from its row, and says Done.
    expect(screen.getByRole('button', { name: 'Basics' })).toHaveAccessibleDescription('Done');
    await user.click(screen.getByRole('button', { name: 'Continue the tour' }));
    const first = await screen.findByRole('dialog', { name: /^List, Grid, Graph/ });
    expect(first).toHaveTextContent('Chapter 3 of 12 · step 1 of');
    expect(pathOf(router)).toMatch(/^\/loc\//);
  }, 60000);

  it('leaves out the chapters of a viewer everywhere that only change things', async () => {
    const state = ownerScenario();
    state.locations = state.locations.map((l) => ({ ...l, role: 'viewer' as const }));
    await renderApp('/help', { state });
    await findHeading('Help');
    await waitFor(() => expect(tourRows()).toContain('lending'));
    expect(tourRows()).not.toContain('capture');
    expect(tourRows()).toContain('basics');
    // Things & places loses Add here and Actions (it keeps Kits, a read).
    expect(screen.getByRole('button', { name: 'Things & places' })).toHaveAccessibleDescription(
      '4 steps',
    );
  });

  it('Basics walks the real screens, then offers the next chapter or stops there', async () => {
    const { user, mock, router } = await renderApp('/help');
    await findHeading('Help');
    await user.click(await screen.findByRole('button', { name: 'Basics' }));

    const legs: { name: string; path: string }[] = [
      { name: 'Needs you', path: '/' },
      { name: 'Your locations', path: '/' },
      { name: 'Scan', path: '/' },
      { name: 'Search', path: '/search' },
      { name: 'More', path: '/more' },
      { name: 'The tour', path: '/help' },
    ];
    for (const [k, leg] of legs.entries()) {
      const dialog = await screen.findByRole('dialog', { name: leg.name });
      expect(dialog).toHaveTextContent(`Chapter 1 of 12 · step ${k + 1} of ${legs.length}`);
      expect(pathOf(router)).toBe(leg.path);
      if (k < legs.length - 1)
        await user.click(within(dialog).getByRole('button', { name: 'Next' }));
      else {
        // The chapter's last step names the next one: Continue goes on, Stop here ends it.
        expect(dialog).toHaveTextContent('Next: Things & places');
        expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeInTheDocument();
        await user.click(within(dialog).getByRole('button', { name: 'Stop here' }));
      }
    }
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() =>
      expect(mock.lastCall('PUT', inventoryPaths.hint('help.tours.basics'))?.body).toEqual({
        seen: true,
        dismissed: true,
      }),
    );
    // Done, Basics folds away under Done (1); it still starts from there.
    await user.click(await screen.findByRole('button', { name: 'Done (1)' }));
    expect(screen.getByRole('button', { name: 'Basics' })).toHaveAccessibleDescription('Done');
    expect(screen.getByRole('button', { name: 'Continue the tour' })).toBeInTheDocument();
    expectLogicalOnly();
    await user.click(screen.getByRole('button', { name: 'Basics' }));
    expect(await screen.findByRole('dialog', { name: 'Needs you' })).toHaveTextContent(
      'step 1 of 6',
    );
  }, 60000);

  it('Show me on a section’s page starts its chapter there, and offers the next at its end', async () => {
    const { user, router } = await renderApp('/lending');
    await findHeading('Lending');
    await user.click(await screen.findByRole('button', { name: 'Show me' }));
    const first = await screen.findByRole('dialog', { name: 'Loans' });
    expect(first).toHaveTextContent('Chapter 7 of 12 · step 1 of');
    expect(pathOf(router)).toBe('/lending');
    // While it runs, Show me stands down.
    expect(screen.getByRole('button', { name: 'Show me' })).toBeDisabled();
    // Next through the chapter: its last step has Continue in place of Next.
    for (let k = 1; k <= 5; k++) {
      const d = screen.getByRole('dialog');
      if (within(d).queryByRole('button', { name: 'Continue' })) break;
      await user.click(within(d).getByRole('button', { name: 'Next' }));
      await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent(`step ${k + 1} of`));
    }
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Next: Schedules & reminders');
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('dialog', { name: 'New schedule' })).toHaveTextContent(
      'Chapter 8 of 12 · step 1 of',
    );
  }, 60000);

  it('has no Show me where the section’s tour isn’t one this person has', async () => {
    await renderApp('/lending', { state: firstRunScenario() });
    await findHeading('Lending');
    expect(screen.queryByRole('button', { name: 'Show me' })).toBeNull();
  });

  it('in Arabic the arrows follow the reading direction, and the steps use its digits', async () => {
    const { user } = await renderApp('/help', { locale: 'ar' });
    await findHeading('المساعدة');
    await user.click(await screen.findByRole('button', { name: 'الأساسيات' }));
    const first = await screen.findByRole('dialog', { name: 'ما يحتاج إليك' });
    expect(first).toHaveTextContent('الفصل ١ من ١٢، الخطوة ١ من ٦');
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
