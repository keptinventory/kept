/**
 * The tour's copy in English and Arabic, and the navigate-then-highlight engine against a light
 * route tree built from TOURS: Next, Back, the arrows, passing over a missing anchor, closing,
 * a chapter's end (Continue into the next, or Stop here), Done at the last chapter, a navigation
 * the tour didn't make, samples and Keep/Discard once per run, and taps that reach the page.
 * Gating is tours.test.ts's; every anchor's presence in the real screens is tour-anchors.test.ts's.
 */

import { type ModuleId, TOUR_IDS, type TourId } from '@kept/shared';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { inventoryKeys } from '@/api/inventory/queries';
import { keys } from '@/api/queries';
import type { LocationDetail } from '@/api/types';
import { AppProviders } from '@/app-providers';
import { activateLocale } from '@/i18n/i18n';
import { setDigits, setLocale } from '@/lib/prefs';
import { renderUI } from '@/test/render';
import { type HintCopy, useTourCopy, useTourStepCopy, useTourTitles } from './hint-copy';
import {
  FRESH_LIST_MS,
  findSectionAnchor,
  type TourStart,
  tourDeleter,
  useTour,
  waitForSectionAnchor,
} from './tour';
import { tourLedger } from './tour-ledger';
import { tourRequests } from './tour-request';
import { availableTours, stopFor, TOURS } from './tours';
import { hintSlot } from './use-hint';

type Copy = { steps: Record<string, HintCopy>; titles: Record<TourId, string> };

function CopyProbe({ onCopy }: { onCopy: (c: Copy) => void }) {
  onCopy({ steps: useTourStepCopy(), titles: useTourTitles() });
  return null;
}

async function copyOf(locale: 'en' | 'ar'): Promise<Copy> {
  const seen: { current: Copy | null } = { current: null };
  await renderUI(<CopyProbe onCopy={(c) => (seen.current = c)} />, { locale });
  if (!seen.current) throw new Error('no copy');
  return seen.current;
}

function LabelsProbe({ onCopy }: { onCopy: (c: ReturnType<typeof useTourCopy>) => void }) {
  onCopy(useTourCopy());
  return null;
}

describe('the tour popover labels', () => {
  for (const locale of ['en', 'ar'] as const) {
    it(`names its buttons in ${locale}`, async () => {
      const seen: { current: ReturnType<typeof useTourCopy> | null } = { current: null };
      await renderUI(<LabelsProbe onCopy={(c) => (seen.current = c)} />, { locale });
      expect(seen.current?.labels.next, 'next').toBeTruthy();
      expect(seen.current?.labels.done, 'done').toBeTruthy();
      expect(seen.current?.labels.close, 'close').toBeTruthy();
      expect(seen.current?.labels.continue, 'continue').toBeTruthy();
      expect(seen.current?.labels.stop, 'stop').toBeTruthy();
    });
  }

  for (const [locale, line, chapter, next] of [
    ['en', 'Chapter 3 of 12 · step 2 of 5', 'The 3D map', 'Next: The 3D map'],
    [
      'ar',
      'الفصل ٣ من ١٢، الخطوة ٢ من ٥',
      'الخريطة ثلاثية الأبعاد',
      'التالي: الخريطة ثلاثية الأبعاد',
    ],
  ] as const) {
    it(`reads the chapter and the step in ${locale}, in its digits and separator`, async () => {
      // The digits and the separator follow the reader's prefs, as the app sets them.
      setLocale(locale);
      setDigits('eastern');
      try {
        const seen: { current: ReturnType<typeof useTourCopy> | null } = { current: null };
        await renderUI(<LabelsProbe onCopy={(c) => (seen.current = c)} />, { locale });
        expect(seen.current?.labels.chapterProgress(3, 12, 2, 5)).toBe(line);
        expect(seen.current?.labels.upNext(chapter)).toBe(next);
      } finally {
        setLocale('en');
      }
    });
  }
});

describe('the tours’ copy', () => {
  it('has a title for every tour and words for every step on both layouts, in en and ar', async () => {
    for (const locale of ['en', 'ar'] as const) {
      const copy = await copyOf(locale);
      for (const id of TOUR_IDS) expect(copy.titles[id], `${locale} ${id}`).toBeTruthy();
      for (const tour of TOURS)
        for (const step of tour.steps)
          for (const layout of ['phone', 'wide'] as const) {
            const key = stopFor(step, layout).copyId ?? `${tour.id}.${step.id}`;
            expect(copy.steps[key]?.title, `${locale} ${key} title`).toBeTruthy();
            expect(copy.steps[key]?.description, `${locale} ${key}`).toBeTruthy();
          }
    }
  });

  it('keeps every step to one or two short sentences, no exclamation marks', async () => {
    const copy = await copyOf('en');
    for (const [id, entry] of Object.entries(copy.steps)) {
      expect(entry.description.length, id).toBeLessThanOrEqual(110);
      const sentences = entry.description.split(/[.?](?:\s|$)/).filter((x) => x.trim());
      expect(sentences.length, id).toBeLessThanOrEqual(2);
      expect(`${entry.title} ${entry.description}`, id).not.toMatch(/!|simply|easily|welcome/i);
    }
  });
});

describe('step anchors', () => {
  it('finds the first anchor on screen, in order', async () => {
    document.body.innerHTML = '<div data-tour="b">b</div><div data-tour="a">a</div>';
    expect(findSectionAnchor(['a', 'b'])?.textContent).toBe('a');
    expect(findSectionAnchor(['c', 'b'])?.textContent).toBe('b');
    expect(findSectionAnchor(['c'])).toBeNull();
    document.body.innerHTML = '';
  });

  it('waits for a late anchor and gives up within its bound', async () => {
    const late = waitForSectionAnchor(['late'], 1000);
    setTimeout(() => {
      const el = document.createElement('div');
      el.dataset.tour = 'late';
      document.body.appendChild(el);
    }, 20);
    expect(await late).not.toBeNull();
    expect(await waitForSectionAnchor(['never'], 30)).toBeNull();
    document.body.innerHTML = '';
  });
});

describe('tourDeleter', () => {
  it('deletes through the existing endpoints, a move with its row version', async () => {
    const calls: { method: string; url: string; ifMatch: string | null }[] = [];
    vi.stubGlobal(
      'fetch',
      async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const headers = new Headers(init?.headers);
        const method = init?.method ?? 'GET';
        calls.push({ method, url: String(url), ifMatch: headers.get('If-Match') });
        const body = String(url).endsWith('/moves/m1') && method === 'GET' ? { rowVersion: 4 } : {};
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    );
    await tourDeleter('thing', 't1');
    await tourDeleter('place', 'p1');
    await tourDeleter('location', 'l1');
    await tourDeleter('capture', 'c1');
    await tourDeleter('move', 'm1');
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      expect.stringMatching(/^POST .*\/things\/t1\/trash$/),
      expect.stringMatching(/^POST .*\/places\/p1\/trash$/),
      expect.stringMatching(/^DELETE .*\/locations\/l1$/),
      expect.stringMatching(/^POST .*\/captures\/batches\/c1\/undo$/),
      expect.stringMatching(/^GET .*\/moves\/m1$/),
      expect.stringMatching(/^DELETE .*\/moves\/m1$/),
    ]);
    expect(calls.at(-1)?.ifMatch).toContain('4');
  });
});

// ----- the navigate-then-highlight engine, against a light route tree -----

const ENGINE_TIMEOUT = 30000;

const loc = (id: string, role: 'owner' | 'viewer', modules: ModuleId[] = [], kind = 'home') =>
  ({ id, name: 'Home', kind, role, modules }) as unknown as LocationDetail;

const OWNER_LOCS = [loc('loc-1', 'owner', ['labels'])];

const probe: {
  start: ((id: TourId, opts?: TourStart) => Promise<boolean>) | null;
  el: HTMLButtonElement | null;
} = { start: null, el: null };

function TourProbe() {
  const tour = useTour();
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    probe.start = tour.start;
    probe.el = ref.current;
  });
  return (
    <button ref={ref} type="button">
      launchpad
    </button>
  );
}

/** A route body with its anchors, which a button can redraw as new elements. */
function Body({ anchors }: { anchors: string[] }) {
  const [round, setRound] = useState(0);
  return (
    <div>
      {anchors.map((a) => (
        <div key={`${a}-${round}`} data-tour={a}>
          {a} {round}
        </div>
      ))}
      <button type="button" onClick={() => setRound((r) => r + 1)}>
        redraw
      </button>
    </div>
  );
}

/** Every route the tours open, with every anchor they point at there, less `missing`. */
function tourTree(missing: readonly string[]) {
  const rootRoute = createRootRoute({
    component: () => (
      <AppProviders locale="en">
        <TourProbe />
        <Outlet />
      </AppProviders>
    ),
  });
  const byPath = new Map<string, Set<string>>([['/lending', new Set()]]);
  for (const tour of TOURS)
    for (const step of tour.steps) {
      if (step.to === null) continue;
      const set = byPath.get(step.to) ?? new Set<string>();
      for (const a of step.anchors) if (!missing.includes(a)) set.add(a);
      byPath.set(step.to, set);
    }
  const routes = [...byPath].map(([path, anchors]) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => <Body anchors={[...anchors]} />,
    }),
  );
  return createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: ['/help'] }),
  });
}

type FetchCall = { method: string; url: string; body: unknown };
type Api = (method: string, url: string) => unknown;

const json = (body: unknown) =>
  new Response(JSON.stringify(body ?? {}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

/** A household with one thing in it. */
const withThing: Api = (method, url) => {
  if (method === 'GET' && /\/things\?/.test(url))
    return { items: [{ id: 't-1', shortCode: 'K7D2QX' }], next_cursor: null };
  return {};
};

/** A household with no things yet: a sample is made in Unplaced. */
const empty: Api = (method, url) => {
  if (method === 'GET' && /\/things\?/.test(url)) return { items: [], next_cursor: null };
  if (method === 'GET' && /\/places$/.test(url))
    return { places: [{ id: 'u-1', isUnplaced: true }] };
  if (method === 'POST' && /\/things$/.test(url)) return { id: 't-new', shortCode: 'S4MPL3' };
  return {};
};

async function renderTour({
  locations = OWNER_LOCS,
  server = locations,
  missing = [],
  api = withThing,
}: {
  /** The list in the query cache when the tour starts. */
  locations?: LocationDetail[];
  /** The list GET /locations answers, or `hang` for a server that never does. */
  server?: LocationDetail[] | 'hang';
  missing?: string[];
  api?: Api;
} = {}) {
  await activateLocale('en');
  document.documentElement.lang = 'en';
  document.documentElement.dir = 'ltr';
  const calls: FetchCall[] = [];
  vi.stubGlobal('fetch', async (url: string | URL | Request, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    let body: unknown;
    try {
      body = init?.body ? JSON.parse(String(init.body)) : undefined;
    } catch {
      body = undefined;
    }
    calls.push({ method, url: String(url), body });
    if (method === 'GET' && /\/locations\?/.test(String(url)))
      return server === 'hang'
        ? new Promise<Response>(() => {})
        : json({ locations: server, nextCursor: null });
    return json(api(method, String(url)));
  });
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
  qc.setQueryData(keys.locations, locations);
  qc.setQueryData(inventoryKeys.hints, { hints: [] });
  const router = tourTree(missing);
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  const copy = await copyOf('en');
  return { user, router, calls, copy };
}

const pathOf = (router: { state: { location: { pathname: string } } }) =>
  router.state.location.pathname;

function startTour(id: TourId, context?: TourStart['context']): Promise<boolean> {
  if (!probe.start || !probe.el) throw new Error('tour probe missing');
  const start = probe.start;
  const el = probe.el;
  return act(async () => start(id, { returnFocus: el, ...(context ? { context } : {}) }));
}

const stepDialog = (copy: Copy, key: string) =>
  screen.findByRole('dialog', { name: copy.steps[key]?.title ?? key });

const putsTo = (calls: FetchCall[], key: string) =>
  calls.filter((c) => c.method === 'PUT' && c.url.endsWith(`me/hints/${key}`)).map((c) => c.body);

afterEach(() => {
  vi.unstubAllGlobals();
  tourLedger.clear();
  hintSlot.release('tour');
  tourRequests.reset();
  act(() => {
    fireEvent.keyDown(window, { key: 'Escape' });
  });
  for (const el of document.querySelectorAll(
    '.driver-popover, .driver-overlay, [data-guided-keep-host]',
  ))
    el.remove();
  document.body.className = '';
});

const BASICS = ['needs', 'locations', 'scan', 'search', 'more', 'tours'];
/** OWNER_LOCS's chapters: Basics, Things & places, The 3D map, Capture & Inbox, Scanning,
 * Search & labels, Import & export and Settings & sharing (no module tours but Labels' step). */
const CHAPTERS = 8;
const BASICS_PATHS = ['/', '/', '/', '/search', '/more', '/help'];

describe('useTour', () => {
  it(
    'walks Basics step by step, counts them, and records it done on Stop here',
    async () => {
      const { user, router, calls, copy } = await renderTour();
      expect(await startTour('basics')).toBe(true);
      expect(hintSlot.get()).toBe('tour');
      expect(tourRequests.running()).toBe('basics');
      for (const [k, id] of BASICS.entries()) {
        const dialog = await stepDialog(copy, `basics.${id}`);
        expect(dialog).toHaveTextContent(
          `Chapter 1 of ${CHAPTERS} · step ${k + 1} of ${BASICS.length}`,
        );
        expect(pathOf(router)).toBe(BASICS_PATHS[k]);
        const last = k === BASICS.length - 1;
        if (last) expect(dialog).toHaveTextContent('Next: Things & places');
        else expect(within(dialog).queryByRole('button', { name: 'Stop here' })).toBeNull();
        await user.click(within(dialog).getByRole('button', { name: last ? 'Stop here' : 'Next' }));
      }
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(putsTo(calls, 'help.tours.basics')).toEqual([{ seen: true, dismissed: true }]);
      expect(hintSlot.get()).toBeNull();
      expect(tourRequests.running()).toBeNull();
      expect(document.activeElement).toBe(probe.el);
      // Nothing was made: no write but the hint.
      expect(calls.filter((c) => c.method !== 'GET' && c.method !== 'PUT')).toEqual([]);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'goes on into the next chapter with Continue, recording the one it finished',
    async () => {
      const { user, router, calls, copy } = await renderTour();
      await startTour('basics');
      for (const id of BASICS.slice(0, -1)) {
        const d = await stepDialog(copy, `basics.${id}`);
        await user.click(within(d).getByRole('button', { name: 'Next' }));
      }
      const end = await stepDialog(copy, 'basics.tours');
      await user.click(within(end).getByRole('button', { name: 'Continue' }));
      const first = await stepDialog(copy, 'things.add');
      expect(first).toHaveTextContent(`Chapter 2 of ${CHAPTERS} · step 1 of 6`);
      expect(pathOf(router)).toMatch(/^\/loc\/[^/]+$/);
      // The first step of a chapter has nothing before it in the chapter: no Back.
      expect(within(first).queryByRole('button', { name: 'Back' })).toBeNull();
      expect(putsTo(calls, 'help.tours.basics')).toEqual([{ seen: true, dismissed: true }]);
      expect(putsTo(calls, 'help.tours.things')).toEqual([]);
      expect(tourRequests.running()).toBe('things');
      expect(hintSlot.get()).toBe('tour');
      // Closing part-way through this chapter leaves it unfinished, for Continue the tour.
      act(() => {
        fireEvent.keyDown(window, { key: 'Escape' });
      });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(putsTo(calls, 'help.tours.things')).toEqual([]);
      expect(tourRequests.running()).toBeNull();
    },
    ENGINE_TIMEOUT,
  );

  it(
    'ends the last chapter with Done, offering nothing after it',
    async () => {
      const { user, calls, copy } = await renderTour();
      await startTour('settings');
      const ids = ['notifications', 'locations', 'invite', 'track'];
      for (const [k, id] of ids.entries()) {
        const d = await stepDialog(copy, `settings.${id}`);
        expect(d).toHaveTextContent(`Chapter ${CHAPTERS} of ${CHAPTERS} · step ${k + 1} of 4`);
        if (k < ids.length - 1) {
          await user.click(within(d).getByRole('button', { name: 'Next' }));
          continue;
        }
        expect(d).not.toHaveTextContent('Next:');
        expect(within(d).queryByRole('button', { name: 'Stop here' })).toBeNull();
        await user.click(within(d).getByRole('button', { name: 'Done' }));
      }
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(putsTo(calls, 'help.tours.settings')).toEqual([{ seen: true, dismissed: true }]);
      expect(tourRequests.running()).toBeNull();
    },
    ENGINE_TIMEOUT,
  );

  it(
    'offers Keep or Discard once, at the end of the run, for a sample made chapters before',
    async () => {
      const { user, calls, copy } = await renderTour({ api: empty });
      await startTour('things');
      for (const id of ['add', 'contents', 'where', 'actions']) {
        const d = await stepDialog(copy, `things.${id}`);
        await user.click(within(d).getByRole('button', { name: 'Next' }));
      }
      const tabs = await stepDialog(copy, 'things.tabs');
      expect(tabs).toHaveTextContent('Next: The 3D map');
      await user.click(within(tabs).getByRole('button', { name: 'Continue' }));
      // No Keep/Discard between chapters: the run goes on, the sample still in its ledger.
      expect(await stepDialog(copy, 'map.layout')).toHaveTextContent(
        `Chapter 3 of ${CHAPTERS} · step 1 of 5`,
      );
      expect(screen.queryByRole('dialog', { name: 'Keep what you added?' })).toBeNull();
      expect(tourLedger.list()).toEqual([{ kind: 'thing', id: 't-new' }]);
      expect(putsTo(calls, 'help.tours.things')).toEqual([{ seen: true, dismissed: true }]);
      act(() => {
        fireEvent.keyDown(window, { key: 'Escape' });
      });
      const keep = await screen.findByRole('dialog', { name: 'Keep what you added?' });
      expect(keep).toHaveTextContent('1 item');
      await user.click(within(keep).getByRole('button', { name: 'Keep' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(calls.filter((c) => /trash$/.test(c.url))).toEqual([]);
      expect(putsTo(calls, 'help.tours.map')).toEqual([]);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'keeps going on a location whose id has letters a URL escapes',
    async () => {
      // An Arabic location name makes an Arabic slug: the tour's own move there isn't a walk-away.
      const { user, router, copy } = await renderTour({
        locations: [loc('المنزل-0000b002', 'owner', ['labels'])],
      });
      await startTour('things');
      const add = await stepDialog(copy, 'things.add');
      expect(decodeURIComponent(pathOf(router))).toBe('/loc/المنزل-0000b002');
      await user.click(within(add).getByRole('button', { name: 'Next' }));
      expect(await stepDialog(copy, 'things.contents')).toHaveTextContent('step 2 of 6');
      expect(tourRequests.running()).toBe('things');
    },
    ENGINE_TIMEOUT,
  );

  it(
    'goes back from the button and the arrows',
    async () => {
      const { user, copy } = await renderTour();
      await startTour('basics');
      const first = await stepDialog(copy, 'basics.needs');
      // Nothing comes before the first step: no Back there.
      expect(within(first).queryByRole('button', { name: 'Back' })).toBeNull();
      await user.click(within(first).getByRole('button', { name: 'Next' }));
      const second = await stepDialog(copy, 'basics.locations');
      await user.click(within(second).getByRole('button', { name: 'Back' }));
      expect(await stepDialog(copy, 'basics.needs')).toHaveTextContent('1 of 6');
      act(() => {
        fireEvent.keyDown(window, { key: 'ArrowRight' });
      });
      await stepDialog(copy, 'basics.locations');
      act(() => {
        fireEvent.keyDown(window, { key: 'ArrowLeft' });
      });
      expect(await stepDialog(copy, 'basics.needs')).toBeInTheDocument();
    },
    ENGINE_TIMEOUT,
  );

  it(
    'passes over a step whose anchor never appears, and leaves it out of the count',
    async () => {
      const { user, copy } = await renderTour({ missing: ['scan-button'] });
      await startTour('basics');
      const first = await stepDialog(copy, 'basics.needs');
      expect(first).toHaveTextContent('1 of 6');
      await user.click(within(first).getByRole('button', { name: 'Next' }));
      const second = await stepDialog(copy, 'basics.locations');
      await user.click(within(second).getByRole('button', { name: 'Next' }));
      // Scan never shows: Search is third, of five.
      expect(await stepDialog(copy, 'basics.search')).toHaveTextContent('3 of 5');
    },
    ENGINE_TIMEOUT,
  );

  it(
    'closes early without recording it done, and closing at the last step counts',
    async () => {
      const { user, calls, copy } = await renderTour();
      await startTour('basics');
      await stepDialog(copy, 'basics.needs');
      act(() => {
        fireEvent.keyDown(window, { key: 'Escape' });
      });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(putsTo(calls, 'help.tours.basics')).toEqual([]);
      expect(hintSlot.get()).toBeNull();
      expect(document.body.classList.contains('kept-tour-open')).toBe(false);

      await startTour('basics');
      for (const id of BASICS.slice(0, -1)) {
        const d = await stepDialog(copy, `basics.${id}`);
        await user.click(within(d).getByRole('button', { name: 'Next' }));
      }
      await stepDialog(copy, 'basics.tours');
      act(() => {
        fireEvent.keyDown(window, { key: 'Escape' });
      });
      await waitFor(() =>
        expect(putsTo(calls, 'help.tours.basics')).toEqual([{ seen: true, dismissed: true }]),
      );
    },
    ENGINE_TIMEOUT,
  );

  it(
    'ends where it is when the person goes somewhere else',
    async () => {
      const { router, calls, copy } = await renderTour();
      await startTour('basics');
      await stepDialog(copy, 'basics.needs');
      await act(async () => {
        await router.navigate({ to: '/lending' as never });
      });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(pathOf(router)).toBe('/lending');
      expect(tourRequests.running()).toBeNull();
      expect(putsTo(calls, 'help.tours.basics')).toEqual([]);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'leaves taps outside the highlight to the page, and points at a redrawn control',
    async () => {
      const { user, copy } = await renderTour();
      await startTour('basics');
      await stepDialog(copy, 'basics.needs');
      // driver.css blocks every tap under body.driver-active; the tour takes the class off.
      expect(document.body.classList.contains('driver-active')).toBe(false);
      expect(document.body.classList.contains('kept-tour-open')).toBe(true);
      const before = document.querySelector('[data-tour="home-needs"]');
      await waitFor(() => expect(before?.classList.contains('driver-active-element')).toBe(true));
      await user.click(screen.getByRole('button', { name: 'redraw' }));
      await waitFor(() => {
        const now = document.querySelector('[data-tour="home-needs"]');
        expect(now).not.toBe(before);
        expect(now?.classList.contains('driver-active-element')).toBe(true);
      });
      expect(await stepDialog(copy, 'basics.needs')).toHaveTextContent('1 of 6');
    },
    ENGINE_TIMEOUT,
  );

  it(
    'opens an existing thing, and makes no sample',
    async () => {
      const { user, router, calls, copy } = await renderTour();
      await startTour('things');
      const add = await stepDialog(copy, 'things.add');
      expect(pathOf(router)).toMatch(/^\/loc\/[^/]+$/);
      await user.click(within(add).getByRole('button', { name: 'Next' }));
      const contents = await stepDialog(copy, 'things.contents');
      expect(router.state.location.search).toMatchObject({ view: 'list' });
      await user.click(within(contents).getByRole('button', { name: 'Next' }));
      await stepDialog(copy, 'things.where');
      expect(pathOf(router)).toBe('/t/K7D2QX');
      expect(calls.some((c) => c.method === 'POST')).toBe(false);
      expect(tourLedger.list()).toEqual([]);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'makes one sample in an empty location, and Discard trashes only that',
    async () => {
      const { user, router, calls, copy } = await renderTour({ api: empty });
      await startTour('things');
      for (const id of ['add', 'contents']) {
        const d = await stepDialog(copy, `things.${id}`);
        await user.click(within(d).getByRole('button', { name: 'Next' }));
      }
      for (const id of ['where', 'actions']) {
        const d = await stepDialog(copy, `things.${id}`);
        expect(pathOf(router)).toBe('/t/S4MPL3');
        await user.click(within(d).getByRole('button', { name: 'Next' }));
      }
      const last = await stepDialog(copy, 'things.tabs');
      // One sample, made once, in the location's Unplaced, with its sample name.
      const made = calls.filter((c) => c.method === 'POST' && /\/things$/.test(c.url));
      expect(made.map((c) => c.body)).toEqual([
        { locationId: 'loc-1', placeId: 'u-1', name: 'Sample: Cordless drill' },
      ]);
      expect(tourLedger.list()).toEqual([{ kind: 'thing', id: 't-new' }]);
      await user.click(within(last).getByRole('button', { name: 'Stop here' }));
      const keep = await screen.findByRole('dialog', { name: 'Keep what you added?' });
      expect(keep).toHaveTextContent('1 item');
      expect(tourRequests.running()).toBe('things');
      await user.click(within(keep).getByRole('button', { name: 'Discard' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(
        calls.filter((c) => c.method === 'POST' && /trash$/.test(c.url)).map((c) => c.url),
      ).toEqual([expect.stringMatching(/\/things\/t-new\/trash$/)]);
      expect(putsTo(calls, 'help.tours.things')).toEqual([{ seen: true, dismissed: true }]);
      expect(tourRequests.running()).toBeNull();
    },
    ENGINE_TIMEOUT,
  );

  it(
    'keeps the Keep/Discard dialog open when Discard fails, and Keep still finishes',
    async () => {
      const { user, copy } = await renderTour({ api: empty });
      await startTour('things');
      // Close at the first thing step: the sample exists, so Keep/Discard asks.
      for (const id of ['add', 'contents']) {
        const d = await stepDialog(copy, `things.${id}`);
        await user.click(within(d).getByRole('button', { name: 'Next' }));
      }
      await stepDialog(copy, 'things.where');
      vi.stubGlobal('fetch', async () => {
        throw new Error('offline');
      });
      act(() => {
        fireEvent.keyDown(window, { key: 'Escape' });
      });
      const keep = await screen.findByRole('dialog', { name: 'Keep what you added?' });
      await user.click(within(keep).getByRole('button', { name: 'Discard' }));
      expect(await screen.findByRole('alert')).toBeInTheDocument();
      await user.click(within(keep).getByRole('button', { name: 'Keep' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(hintSlot.get()).toBeNull();
      expect(tourLedger.list()).toEqual([]);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'makes no sample for a viewer, and skips the steps that change things',
    async () => {
      const { router, calls, copy } = await renderTour({
        api: empty,
        locations: [loc('loc-1', 'viewer')],
      });
      await startTour('things');
      // Add here and Actions are gone; with no thing to open, the thing steps pass over.
      expect(await stepDialog(copy, 'things.contents')).toHaveTextContent('1 of');
      expect(pathOf(router)).toMatch(/^\/loc\//);
      expect(calls.some((c) => c.method === 'POST')).toBe(false);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'opens the page’s own thing when started from it',
    async () => {
      const { user, router, calls, copy } = await renderTour({ api: empty });
      await startTour('things', { locationId: 'loc-1', thing: 'HERE01' });
      for (const id of ['add', 'contents']) {
        const d = await stepDialog(copy, `things.${id}`);
        await user.click(within(d).getByRole('button', { name: 'Next' }));
      }
      await stepDialog(copy, 'things.where');
      expect(pathOf(router)).toBe('/t/HERE01');
      expect(calls.some((c) => c.method === 'POST')).toBe(false);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'counts the chapters from the server’s list, not a cached one from before a module change',
    async () => {
      // The cache still has every module on; the server's list has only Labels (#314).
      const all: ModuleId[] = ['moving', 'lending', 'schedules', 'paperwork', 'warranties'];
      const { copy, calls } = await renderTour({
        locations: [loc('loc-1', 'owner', ['labels', ...all])],
        server: OWNER_LOCS,
      });
      expect(await startTour('basics')).toBe(true);
      expect(await stepDialog(copy, 'basics.needs')).toHaveTextContent(
        `Chapter 1 of ${CHAPTERS} · step 1 of ${BASICS.length}`,
      );
      expect(calls.filter((c) => c.method === 'GET' && /\/locations\?/.test(c.url))).toHaveLength(
        1,
      );
    },
    ENGINE_TIMEOUT,
  );

  it(
    'runs only the later of two starts asked for while the list was loading',
    async () => {
      const { copy, user, router } = await renderTour();
      const start = probe.start;
      if (!start) throw new Error('tour probe missing');
      const [first, second] = await act(async () =>
        Promise.all([start('basics'), start('settings')]),
      );
      expect([first, second]).toEqual([false, true]);
      const d = await stepDialog(copy, 'settings.notifications');
      expect(d).toHaveTextContent(`Chapter ${CHAPTERS} of ${CHAPTERS} · step 1 of`);
      // Both waited on one fetch of the list; the first is not left running beside the second,
      // whose own navigation doesn't end it.
      await user.click(within(d).getByRole('button', { name: 'Next' }));
      await stepDialog(copy, 'settings.locations');
      expect(pathOf(router)).toBe('/settings/locations');
      expect(tourRequests.running()).toBe('settings');
    },
    ENGINE_TIMEOUT,
  );

  it(
    'runs one Basics when it is asked for twice while the list was loading',
    async () => {
      const { copy, user, router } = await renderTour();
      const start = probe.start;
      if (!start) throw new Error('tour probe missing');
      const [first, second] = await act(async () =>
        Promise.all([start('basics'), start('basics')]),
      );
      expect([first, second]).toEqual([false, true]);
      await stepDialog(copy, 'basics.needs');
      expect(document.querySelectorAll('.driver-popover')).toHaveLength(1);
      // One run: Next moves one step, an arrow one more, and Escape leaves nothing open.
      await user.click(screen.getByRole('button', { name: 'Next' }));
      await stepDialog(copy, 'basics.locations');
      act(() => {
        fireEvent.keyDown(window, { key: 'ArrowRight' });
      });
      expect(await stepDialog(copy, 'basics.scan')).toHaveTextContent('step 3 of');
      expect(pathOf(router)).toBe('/');
      act(() => {
        fireEvent.keyDown(window, { key: 'Escape' });
      });
      await waitFor(() => expect(document.querySelector('.driver-popover')).toBeNull());
      expect(tourRequests.running()).toBeNull();
      expect(hintSlot.get()).toBeNull();
    },
    ENGINE_TIMEOUT,
  );

  it(
    'starts from the cached list when the server doesn’t answer in time',
    async () => {
      const cached = [loc('loc-1', 'owner', ['labels', 'moving'])];
      const { copy } = await renderTour({ locations: cached, server: 'hang' });
      const t0 = performance.now();
      expect(await startTour('basics')).toBe(true);
      expect(performance.now() - t0).toBeLessThan(FRESH_LIST_MS + 2_000);
      expect(await stepDialog(copy, 'basics.needs')).toHaveTextContent(
        `Chapter 1 of ${availableTours(cached).length} · step 1 of`,
      );
      expect(availableTours(cached).length).toBe(CHAPTERS + 1);
    },
    ENGINE_TIMEOUT,
  );

  it(
    'offline, counts the chapters from the cached list without asking the server',
    async () => {
      const { copy, calls } = await renderTour({ server: [] });
      onlineManager.setOnline(false);
      try {
        expect(await startTour('basics')).toBe(true);
        expect(await stepDialog(copy, 'basics.needs')).toHaveTextContent(
          `Chapter 1 of ${CHAPTERS} · step 1 of ${BASICS.length}`,
        );
        expect(calls.some((c) => /\/locations\?/.test(c.url))).toBe(false);
      } finally {
        onlineManager.setOnline(true);
      }
    },
    ENGINE_TIMEOUT,
  );

  it(
    'starts nothing for a tour this person doesn’t have',
    async () => {
      await renderTour({ locations: [loc('loc-1', 'viewer')] });
      expect(await startTour('capture')).toBe(false);
      expect(await startTour('moving')).toBe(false);
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(hintSlot.get()).toBeNull();
    },
    ENGINE_TIMEOUT,
  );
});
