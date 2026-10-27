/**
 * The collapsible sidebar: the foot button and ⌘\ / Ctrl+\ fold it to an icon rail, the
 * choice is kept per device, tablets start on the rail, every rail entry keeps its name and shows
 * it in a tooltip, and counts become badges.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ownerScenario } from '@/api/mock/fixtures';
import { createMockApi } from '@/api/mock/server';
import { closeAssistant, openAssistant } from '@/assistant/store';
import { isSidebarShortcut, MainShell } from '@/components/app-shell';
import { NAV_FOLDS_KEY, resetNavFolds } from '@/lib/nav-folds';
import { SIDEBAR_KEY, setSidebarPref } from '@/lib/prefs';
import { findHeading, renderApp } from '@/test/app';
import { expectLogicalOnly, renderUI } from '@/test/render';

vi.setConfig({ testTimeout: 15_000 });

const TABLET = ['(min-width: 768px)'];
const DESKTOP = ['(min-width: 768px)', '(min-width: 1024px)'];
/** Where the assistant's panel docks beside the page (lib/media.ts DOCKED). */
const WIDEST = [...DESKTOP, '(min-width: 1280px)'];

/** jsdom has no matchMedia: list the queries that match. */
function media(matching: string[]) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: matching.includes(q),
    media: q,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }));
}

const stored = () => localStorage.getItem(SIDEBAR_KEY);
const sidebarState = () => document.documentElement.getAttribute('data-sidebar');
const mainNav = () =>
  screen
    .getAllByRole('navigation', { name: 'Main' })
    .find((n) => within(n).queryByText('Activity')) as HTMLElement;

afterEach(() => {
  // prefs.ts keeps the resolved state in memory across renders in one file.
  setSidebarPref('auto');
});

describe('folding the sidebar', () => {
  it('the foot button folds it to the rail and back, and remembers the choice', async () => {
    media(DESKTOP);
    const { user } = await renderApp('/');
    await findHeading('Home');
    const collapse = screen.getByRole('button', { name: 'Collapse sidebar' });
    expect(collapse).toHaveAttribute('aria-expanded', 'true');
    expect(collapse).toHaveAttribute('aria-controls', 'kept-sidebar');
    expect(sidebarState()).toBe('expanded');

    await user.click(collapse);
    const expand = screen.getByRole('button', { name: 'Expand sidebar' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    expect(sidebarState()).toBe('collapsed');
    expect(stored()).toBe('collapsed');
    // The rail swaps the lockup for the square mark.
    expect(
      within(document.getElementById('kept-sidebar') as HTMLElement).getByRole('img', {
        name: 'Kept',
      }),
    ).toBeInTheDocument();

    await user.click(expand);
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(stored()).toBe('expanded');
  });

  it('⌘\\ and Ctrl+\\ toggle it, and keep focus on the entry that had it', async () => {
    media(DESKTOP);
    const { user } = await renderApp('/');
    await findHeading('Home');
    const settings = within(mainNav()).getByRole('link', { name: 'Settings' });
    settings.focus();

    await user.keyboard('{Meta>}\\{/Meta}');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
    // The rail re-renders its entries inside tooltips; focus comes back to the same one.
    expect(document.activeElement).toHaveAttribute('data-nav', 'settings');

    await user.keyboard('{Control>}\\{/Control}');
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(document.activeElement).toHaveAttribute('data-nav', 'settings');
  });

  it('the shortcut does nothing while typing in a field', async () => {
    media(DESKTOP);
    const { user } = await renderApp('/');
    await findHeading('Home');
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    await user.keyboard('{Control>}\\{/Control}');
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(stored()).toBeNull();
    input.remove();
  });

  it('matches ⌘\\ and Ctrl+\\ only, by key or by the physical key', () => {
    const e = {
      key: '\\',
      code: 'Backslash',
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
    };
    expect(isSidebarShortcut({ ...e, metaKey: true })).toBe(true);
    expect(isSidebarShortcut({ ...e, ctrlKey: true })).toBe(true);
    // An Arabic layout sends another character from the same key.
    expect(isSidebarShortcut({ ...e, key: 'ذ', ctrlKey: true })).toBe(true);
    expect(isSidebarShortcut(e)).toBe(false);
    expect(isSidebarShortcut({ ...e, ctrlKey: true, shiftKey: true })).toBe(false);
  });
});

describe('where it starts', () => {
  it('a stored choice wins', async () => {
    media(DESKTOP);
    localStorage.setItem(SIDEBAR_KEY, 'collapsed');
    await renderApp('/');
    await findHeading('Home');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
  });

  it('tablets (768–1023 px) start on the rail, without storing anything', async () => {
    media(TABLET);
    await renderApp('/');
    await findHeading('Home');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
    expect(sidebarState()).toBe('collapsed');
    expect(stored()).toBeNull();
  });

  it('1024 px and up start expanded', async () => {
    media(DESKTOP);
    await renderApp('/');
    await findHeading('Home');
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
  });

  it('tablets get the search and Capture icon buttons in the top bar', async () => {
    media(TABLET);
    const { user } = await renderApp('/');
    await findHeading('Home');
    // The icon link is named by aria-label; the phone tab bar and the full button have text.
    const capture = screen.getAllByRole('link', { name: 'Capture' });
    expect(capture.some((l) => l.getAttribute('aria-label') === 'Capture')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByRole('dialog', { name: 'Search or jump to' })).toBeInTheDocument();
  });
});

describe('the groups', () => {
  afterEach(() => {
    localStorage.removeItem(NAV_FOLDS_KEY);
    resetNavFolds();
  });

  const group = (name: string) => within(mainNav()).queryByRole('group', { name });

  it('read Home and Inbox, Locations, Tracking, Tools, then the rest', async () => {
    media(DESKTOP);
    await renderApp('/');
    await findHeading('Home');
    await within(mainNav()).findByRole('link', { name: 'Labels' });
    const nav = mainNav();
    const headings = [...nav.querySelectorAll('[data-nav-heading]')].map((h) => h.textContent);
    expect(headings).toEqual(['Locations', 'Tracking', 'Tools']);
    const names = (g: HTMLElement | null) =>
      within(g as HTMLElement)
        .getAllByRole('link')
        .map((l) => l.textContent);
    expect(names(group('Tracking'))).toEqual([
      'Schedules',
      'Lending',
      'Paperwork',
      'Consumables',
      'Vehicles',
      'Insights',
    ]);
    expect(names(group('Tools'))).toEqual(['Labels', 'Counts']);
    expect(names(group('Everything else'))).toEqual([
      'Activity',
      'Trash',
      expect.stringMatching(/^Notifications/),
      'Settings',
      'Help',
    ]);
    // In the page's order: Inbox, then the locations' nav, then Tracking.
    const inbox = within(nav).getByRole('link', { name: /^Inbox/ });
    const locations = screen.getByRole('navigation', { name: 'Locations' });
    expect(
      inbox.compareDocumentPosition(locations) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      locations.compareDocumentPosition(group('Tracking') as HTMLElement) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('Tracking and Tools fold, and stay folded on this device', async () => {
    media(DESKTOP);
    const first = await renderApp('/');
    await findHeading('Home');
    const fold = await within(mainNav()).findByRole('button', { name: 'Tracking' });
    expect(fold).toHaveAttribute('aria-expanded', 'true');
    await first.user.click(fold);
    expect(fold).toHaveAttribute('aria-expanded', 'false');
    expect(within(mainNav()).queryByRole('link', { name: 'Schedules' })).toBeNull();
    expect(within(mainNav()).getByRole('link', { name: 'Counts' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(NAV_FOLDS_KEY) ?? '[]')).toEqual(['tracking']);
    first.unmount();

    resetNavFolds();
    const again = await renderApp('/');
    await findHeading('Home');
    expect(await within(mainNav()).findByRole('button', { name: 'Tracking' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(within(mainNav()).queryByRole('link', { name: 'Schedules' })).toBeNull();
    await again.user.click(within(mainNav()).getByRole('button', { name: 'Tracking' }));
    expect(await within(mainNav()).findByRole('link', { name: 'Schedules' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(NAV_FOLDS_KEY) ?? '[]')).toEqual([]);
  });

  it('start unfolded, and still fold, when storage is unavailable', async () => {
    media(DESKTOP);
    localStorage.setItem(NAV_FOLDS_KEY, JSON.stringify(['tools']));
    resetNavFolds();
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    try {
      const { user } = await renderApp('/');
      await findHeading('Home');
      const tools = await within(mainNav()).findByRole('button', { name: 'Tools' });
      expect(tools).toHaveAttribute('aria-expanded', 'true');
      await user.click(tools);
      expect(tools).toHaveAttribute('aria-expanded', 'false');
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });

  it("More on a phone lists the same groups, in the sidebar's order", async () => {
    media([]);
    await renderApp('/more');
    await findHeading('More');
    const list = async (name: string) =>
      within(await screen.findByRole('list', { name }))
        .getAllByRole('link')
        .map((l) => l.textContent);
    await screen.findByRole('list', { name: 'Tools' });
    const sections = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent)
      .filter((h) => ['Locations', 'Tracking', 'Tools'].includes(h ?? ''));
    expect(sections).toEqual(['Locations', 'Tracking', 'Tools']);
    expect(await list('Tracking')).toEqual([
      'Schedules',
      'Lending',
      'Paperwork',
      'Consumables',
      'Vehicles',
      'Insights',
    ]);
    expect(await list('Tools')).toEqual(['Labels', 'Counts']);
    expect(await list('Everything else')).toEqual([
      'Activity',
      'Trash',
      'Notifications',
      'Settings',
      'Help',
    ]);
  });

  it('Tracking is left out when no tracking module is on anywhere', async () => {
    media(DESKTOP);
    const state = ownerScenario();
    state.locations = state.locations.map((l) => ({
      ...l,
      modules: l.modules.filter((m) => m === 'labels'),
    }));
    await renderApp('/', { state });
    await findHeading('Home');
    await within(mainNav()).findByRole('link', { name: 'Labels' });
    expect(group('Tracking')).toBeNull();
    expect(within(mainNav()).queryByRole('button', { name: 'Tracking' })).toBeNull();
    expect(group('Tools')).not.toBeNull();
  });
});

describe('the rail', () => {
  it('every entry keeps its accessible name, and shows it in a tooltip on keyboard focus', async () => {
    media(TABLET);
    const { user } = await renderApp('/');
    await findHeading('Home');
    // Labels shows once the locations say the module is on somewhere, and the
    // Inbox's count once Home's counts arrive.
    await within(mainNav()).findByRole('link', { name: 'Labels' });
    await within(mainNav()).findByRole('link', { name: /^Inbox \d+$/ });
    // And the notifications' unread count.
    await within(mainNav()).findByRole('link', { name: /^Notifications \d+$/ });
    // Home and Inbox, the locations, then Tracking, Tools and the rest; the entries of each
    // group in order (the locations' own links are checked below).
    const entries = within(mainNav())
      .getAllByRole('link')
      .filter((l) => !l.closest('nav[aria-label="Locations"]'));
    expect(entries.map((l) => l.textContent)).toEqual([
      'Home',
      expect.stringMatching(/^Inbox ?\d+$/),
      'Schedules',
      'Lending',
      'Paperwork',
      // The mock's Home has Consumables on since step 7 (T23's fixture).
      'Consumables',
      'Vehicles',
      'Insights',
      'Labels',
      'Counts',
      'Activity',
      'Trash',
      expect.stringMatching(/^Notifications ?\d+$/),
      'Settings',
      'Help',
    ]);
    const locations = screen.getByRole('navigation', { name: 'Locations' });
    expect(await within(locations).findByRole('link', { name: 'Garage' })).toBeInTheDocument();
    // The rail has rules between the groups, not headings, and nothing to fold.
    expect(within(mainNav()).queryByRole('button', { name: 'Tracking' })).toBeNull();
    // On the footer, the rail's last entry is a full 44 px target (UI review steps 6–8).
    expect(within(mainNav()).getByRole('link', { name: 'Help' })).toHaveClass('h-11', 'min-h-11');

    // Tab from the start: the square mark, Home, then Inbox.
    await user.tab();
    await user.tab();
    await user.tab();
    const inbox = within(mainNav()).getByRole('link', { name: /^Inbox/ });
    expect(inbox).toHaveFocus();
    const tip = await screen.findByRole('tooltip');
    expect(tip).toHaveTextContent('Inbox');
    expect(inbox).toHaveAttribute('aria-describedby', tip.id);

    // Then the locations, in the order they're listed, and New location.
    const locationLinks = within(locations).getAllByRole('link');
    for (const link of locationLinks) {
      await user.tab();
      expect(link).toHaveFocus();
    }

    // Schedules opens Tracking: a plain link with its name in the tooltip.
    await user.tab();
    const schedules = within(mainNav()).getByRole('link', { name: 'Schedules' });
    expect(schedules).toHaveFocus();
    expect(schedules).not.toHaveAttribute('aria-disabled');
    await waitFor(() => expect(screen.getByRole('tooltip')).toHaveTextContent(/^Schedules$/));

    // Insights ends it, after Lending, Paperwork, Consumables and Vehicles.
    for (let i = 0; i < 5; i++) await user.tab();
    const insights = within(mainNav()).getByRole('link', { name: 'Insights' });
    expect(insights).toHaveFocus();
    expect(insights).not.toHaveAttribute('aria-disabled');
    await waitFor(() => expect(screen.getByRole('tooltip')).toHaveTextContent(/^Insights$/));
  });

  it('the source code link stays, as an icon with the version in its tooltip', async () => {
    media(TABLET);
    const { user } = await renderApp('/');
    await findHeading('Home');
    // Let the entries settle first: Labels arrives with the locations, the Inbox's
    // count with Home's counts, the notifications' with their own.
    await within(mainNav()).findByRole('link', { name: 'Labels' });
    await within(mainNav()).findByRole('link', { name: /^Inbox \d+$/ });
    await within(mainNav()).findByRole('link', { name: /^Notifications \d+$/ });
    const source = await screen.findByRole('link', { name: 'Source code' });
    // Keyboard focus (React Aria opens tooltips on focus when the last input was a key).
    await user.keyboard('{Shift}');
    act(() => source.focus());
    expect(await screen.findByRole('tooltip')).toHaveTextContent('v0.1.0');
  });

  it('renders mirrored in Arabic with logical CSS only', async () => {
    media(TABLET);
    await renderApp('/', { locale: 'ar' });
    await findHeading('الرئيسية');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    const toggle = screen.getByRole('button', { name: 'توسيع الشريط الجانبي' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expectLogicalOnly(document.getElementById('kept-sidebar') as HTMLElement);
  });
});

describe('with the assistant docked (1280 px and up)', () => {
  const panel = () => screen.findByRole('complementary', { name: 'Assistant' }, { timeout: 4000 });
  const sidebar = () => document.getElementById('kept-sidebar') as HTMLElement;

  it('the panel puts the sidebar on its rail, and Expand still expands it: the panel floats', async () => {
    media(WIDEST);
    const { user } = await renderApp('/');
    await findHeading('Home');
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();

    act(() => openAssistant());
    const docked = await panel();
    // Docked beside the page, with the sidebar as its rail; the stored choice is untouched.
    expect(docked).not.toHaveClass('xl:fixed');
    expect(sidebar()).toHaveClass('w-16');
    const expand = screen.getByRole('button', { name: 'Expand sidebar' });
    expect(stored()).toBeNull();

    await user.click(expand);
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(sidebar()).not.toHaveClass('w-16');
    // The assistant stays open, floating over the page's end as it does below 1280 px. Nothing
    // is stored: the person's own choice is left alone.
    expect(await panel()).toHaveClass('xl:fixed');
    expect(stored()).toBeNull();

    // Collapsing docks it again, still storing nothing.
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
    expect(await panel()).not.toHaveClass('xl:fixed');
    expect(stored()).toBeNull();

    // Closed, the sidebar is back to the person's choice (expanded, by width).
    act(() => closeAssistant());
    await waitFor(() =>
      expect(screen.queryByRole('complementary', { name: 'Assistant' })).toBeNull(),
    );
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(stored()).toBeNull();
  });

  it('⌘\\ expands a stored rail while docked without changing it; closing brings the rail back', async () => {
    media(WIDEST);
    localStorage.setItem(SIDEBAR_KEY, 'collapsed');
    const { user } = await renderApp('/');
    await findHeading('Home');
    act(() => openAssistant());
    await panel();
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();

    // Opening the panel focuses its composer (after 60 ms), where the shortcut is ignored: wait
    // for that, then leave the field.
    const composer = screen.getByRole('textbox', { name: 'Ask about your things' });
    await waitFor(() => expect(composer).toHaveFocus());
    composer.blur();
    await user.keyboard('{Meta>}\\{/Meta}');
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(await panel()).toHaveClass('xl:fixed');
    expect(stored()).toBe('collapsed');

    // Closed, the sidebar is the person's choice again: the rail they stored.
    act(() => closeAssistant());
    await waitFor(() =>
      expect(screen.queryByRole('complementary', { name: 'Assistant' })).toBeNull(),
    );
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
    expect(stored()).toBe('collapsed');
    // Opened again, the panel docks on the rail.
    act(() => openAssistant());
    expect(await panel()).not.toHaveClass('xl:fixed');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
  });
});

describe('counts', () => {
  async function renderShell() {
    const mock = createMockApi(ownerScenario());
    vi.stubGlobal('fetch', mock.fetch);
    const rootRoute = createRootRoute({
      component: () => (
        <MainShell locations={[]} counts={{ inbox: 4, trash: 120 }}>
          <p>page</p>
        </MainShell>
      ),
    });
    const router = createRouter({
      routeTree: rootRoute,
      history: createMemoryHistory({ initialEntries: ['/'] }),
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const result = await renderUI(
      <QueryClientProvider client={client}>
        <RouterProvider router={router as never} />
      </QueryClientProvider>,
    );
    await screen.findByText('page');
    return result;
  }

  it('show after the label, then as a badge on the rail icon', async () => {
    media(DESKTOP);
    const { user } = await renderShell();
    expect(within(mainNav()).getByRole('link', { name: 'Inbox 4' })).toBeInTheDocument();
    expect(within(mainNav()).getByRole('link', { name: 'Trash 99+' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    const inbox = within(mainNav()).getByRole('link', { name: 'Inbox 4' });
    const badge = within(inbox).getByText('4');
    expect(badge.className).toMatch(/rounded-full/);
    expect(within(inbox).getByText('Inbox')).toHaveClass('sr-only');
  });
});
