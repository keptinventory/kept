/**
 * Folding the places outline (#358): the docked panel and the collapsed outline fold each place
 * like an accordion, remember it per person on the server, keep the path to the page you are on
 * open, and fold or open everything from the header.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BoxNode, PlaceNode } from '@/api/inventory/types';
import type { Locale } from '@/lib/prefs';
import { expectLogicalOnly, renderUI } from '@/test/render';
import { PlacesPanel, PlaceTree } from './tree';

const LOC = 'loc-home';

const place = (id: string, parentId: string | null, name: string, boxCount = 0): PlaceNode => ({
  id,
  parentId,
  name,
  kindKey: 'room',
  icon: null,
  sort: 0,
  isUnplaced: false,
  shortCode: null,
  thingCount: 0,
  childCount: 0,
  createdAt: '2026-10-01T00:00:00Z',
  boxCount,
  childOrder: 'name',
});
const box = (id: string, placeId: string, name: string): BoxNode => ({
  id,
  placeId,
  name,
  icon: null,
  shortCode: null,
  contentCount: 2,
});

// Bedroom > Under bed (two boxes here, one more on its page) and Wardrobe; Office is empty.
const PLACES = [
  place('bedroom', null, 'Bedroom'),
  place('under-bed', 'bedroom', 'Under bed', 3),
  place('wardrobe', 'bedroom', 'Wardrobe'),
  place('office', null, 'Office'),
];
const BOXES = [box('box-1', 'under-bed', 'Winter clothes'), box('box-2', 'under-bed', 'Shoes')];

type Change = { fold: string[]; open: string[] };

/**
 * The server's folds for LOC, answering GET and PUT as the server does (a PUT is a change),
 * recording each PUT. `holdGet`: the GET reads the folds at once and answers when it resolves,
 * as a slow read does. `failPuts`: every PUT is refused (a 400), once `holdPut` resolves.
 * `net.offline`: a PUT can't be sent at all, as with no connection (fetch rejects).
 */
function stubFolds(
  initial: string[] = [],
  {
    holdGet,
    holdPut,
    failPuts = false,
    net = { offline: false },
  }: {
    holdGet?: Promise<void>;
    holdPut?: Promise<void>;
    failPuts?: boolean;
    net?: { offline: boolean };
  } = {},
) {
  const stored = new Set(initial);
  const puts: Change[] = [];
  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    if (input !== `/api/v1/locations/${LOC}/place-folds`)
      return new Response(null, { status: 404 });
    if (init.method === 'PUT') {
      if (net.offline) throw new TypeError('Failed to fetch');
      const body = JSON.parse(String(init.body)) as Change;
      puts.push(body);
      await holdPut;
      if (failPuts)
        return Response.json({ code: 'validation', message: 'Not a place.' }, { status: 400 });
      for (const id of body.open) stored.delete(id);
      for (const id of body.fold) stored.add(id);
      return new Response(null, { status: 204 });
    }
    const snapshot = [...stored];
    await holdGet;
    return Response.json({ placeIds: snapshot });
  });
  return { puts, stored: () => [...stored].sort() };
}

async function mount(ui: ReactNode, locale: Locale = 'en') {
  const root = createRootRoute({ component: Outlet });
  const page = createRoute({ getParentRoute: () => root, path: '/', component: () => ui });
  const others = ['/p/$id', '/t/$id', '/loc/$id'].map((path) =>
    createRoute({ getParentRoute: () => root, path, component: () => null }),
  );
  const router = createRouter({
    routeTree: root.addChildren([page, ...others]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const out = await renderUI(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
    { locale },
  );
  await screen.findAllByRole('link', { name: /Bedroom/ });
  return out;
}

const panel = (currentId?: string) => (
  <PlacesPanel
    places={PLACES}
    boxes={BOXES}
    {...(currentId ? { currentId } : {})}
    location={{ id: LOC, name: 'Home' }}
  />
);

const foldOf = (name: string) => screen.getByRole('button', { name: `Contents of ${name}` });
const shown = (name: RegExp | string) => screen.queryByRole('link', { name });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the docked places panel folds each place', () => {
  it('gives a fold button to each place with something under it, and none to an empty one', async () => {
    stubFolds();
    await mount(panel());
    for (const name of ['Bedroom', 'Under bed']) {
      const button = foldOf(name);
      expect(button).toHaveAttribute('aria-expanded', 'true');
      const controls = button.getAttribute('aria-controls') ?? '';
      expect(document.getElementById(controls)).not.toBeNull();
    }
    expect(screen.queryByRole('button', { name: 'Contents of Office' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Contents of Wardrobe' })).toBeNull();
    expectLogicalOnly();
  });

  it("folds a place's boxes and its '+N boxes' away, remembers it, and opens again from the keyboard", async () => {
    const server = stubFolds();
    const { user } = await mount(panel());
    const group = document.getElementById(
      foldOf('Under bed').getAttribute('aria-controls') ?? '',
    ) as HTMLElement;
    expect(within(group).getByRole('link', { name: /Winter clothes/ })).toBeInTheDocument();
    expect(within(group).getByRole('link', { name: '+1 box' })).toBeInTheDocument();

    await user.click(foldOf('Under bed'));
    expect(foldOf('Under bed')).toHaveAttribute('aria-expanded', 'false');
    expect(shown(/Winter clothes/)).toBeNull();
    expect(shown('+1 box')).toBeNull();
    // Its siblings and parent stay.
    expect(shown('Wardrobe')).toBeInTheDocument();
    // Sent as a change: only Under bed, never the whole set.
    await waitFor(() => expect(server.puts).toEqual([{ fold: ['under-bed'], open: [] }]));

    foldOf('Under bed').focus();
    await user.keyboard('{Enter}');
    expect(foldOf('Under bed')).toHaveAttribute('aria-expanded', 'true');
    expect(shown(/Winter clothes/)).toBeInTheDocument();
    await waitFor(() => expect(server.stored()).toEqual([]));
    expect(server.puts.at(-1)).toEqual({ fold: [], open: ['under-bed'] });
  });

  it("a fold made before the server's folds arrive keeps them, and shows them when they do", async () => {
    let release = () => {};
    const holdGet = new Promise<void>((done) => {
      release = done;
    });
    const server = stubFolds(['wardrobe-shelf', 'bedroom'], { holdGet });
    const { user } = await mount(panel('box-1'));
    // Bedroom is on the path to Box 1, so it is open; the server's folds haven't come yet.
    await user.click(foldOf('Under bed'));
    await waitFor(() =>
      expect(server.stored()).toEqual(['bedroom', 'under-bed', 'wardrobe-shelf']),
    );
    release();
    // The read began before the fold landed; the fold stays on top of what it says.
    await waitFor(() => expect(foldOf('Under bed')).toHaveAttribute('aria-expanded', 'false'));
    expect(foldOf('Bedroom')).toHaveAttribute('aria-expanded', 'true');
  });

  it('two quick folds are both kept', async () => {
    const server = stubFolds();
    const { user } = await mount(panel());
    await user.click(foldOf('Under bed'));
    await user.click(foldOf('Bedroom'));
    await waitFor(() => expect(server.stored()).toEqual(['bedroom', 'under-bed']));
    expect(server.puts).toEqual([
      { fold: ['under-bed'], open: [] },
      { fold: ['bedroom'], open: [] },
    ]);
  });

  it('a fold the server refuses (a 4xx) is undone on the page', async () => {
    let refuse = () => {};
    const holdPut = new Promise<void>((done) => {
      refuse = done;
    });
    const server = stubFolds([], { failPuts: true, holdPut });
    const { user } = await mount(panel());
    await user.click(foldOf('Under bed'));
    // Folded at once, before the server answers.
    expect(foldOf('Under bed')).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(server.puts).toHaveLength(1));
    refuse();
    await waitFor(() => expect(foldOf('Under bed')).toHaveAttribute('aria-expanded', 'true'));
    expect(shown(/Winter clothes/)).toBeInTheDocument();
  });

  it('a fold made offline stays on the page, and goes to the server, in order, once back online', async () => {
    const net = { offline: true };
    const server = stubFolds([], { net });
    const { user } = await mount(panel());
    await user.click(foldOf('Under bed'));
    await user.click(foldOf('Bedroom'));
    await user.click(foldOf('Bedroom'));
    // Nothing reached the server, and the page keeps the folds.
    await new Promise((done) => setTimeout(done, 50));
    expect(server.puts).toEqual([]);
    expect(foldOf('Under bed')).toHaveAttribute('aria-expanded', 'false');
    expect(foldOf('Bedroom')).toHaveAttribute('aria-expanded', 'true');

    net.offline = false;
    window.dispatchEvent(new Event('online'));
    await waitFor(() =>
      expect(server.puts).toEqual([
        { fold: ['under-bed'], open: [] },
        { fold: ['bedroom'], open: [] },
        { fold: [], open: ['bedroom'] },
      ]),
    );
    expect(server.stored()).toEqual(['under-bed']);
    // Sent once: another online event sends nothing more.
    window.dispatchEvent(new Event('online'));
    await new Promise((done) => setTimeout(done, 50));
    expect(server.puts).toHaveLength(3);
    expect(foldOf('Under bed')).toHaveAttribute('aria-expanded', 'false');
  });

  it('gives a coarse pointer 40 px targets, as an iPad at 1280 px', async () => {
    stubFolds();
    await mount(panel());
    expect(foldOf('Under bed')).toHaveClass('pointer-coarse:size-10');
    expect(screen.getByRole('button', { name: 'Fold all' })).toHaveClass('pointer-coarse:min-h-10');
  });

  it('folding a parent hides everything under it, however deep', async () => {
    stubFolds();
    const { user } = await mount(panel());
    await user.click(foldOf('Bedroom'));
    expect(shown('Under bed')).toBeNull();
    expect(shown('Wardrobe')).toBeNull();
    expect(shown(/Shoes/)).toBeNull();
    expect(shown('Office')).toBeInTheDocument();
  });

  it('opens folded the way the server remembers it', async () => {
    stubFolds(['under-bed']);
    await mount(panel());
    await waitFor(() => expect(foldOf('Under bed')).toHaveAttribute('aria-expanded', 'false'));
    expect(shown(/Winter clothes/)).toBeNull();
  });

  it('keeps the path to the page you are on open, even when a place on it was folded', async () => {
    stubFolds(['bedroom', 'under-bed']);
    const { user } = await mount(panel('box-2'));
    await waitFor(() =>
      expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('Shoes'),
    );
    expect(foldOf('Bedroom')).toHaveAttribute('aria-expanded', 'true');
    expect(foldOf('Under bed')).toHaveAttribute('aria-expanded', 'true');
    // On this page you can still fold it yourself.
    await user.click(foldOf('Bedroom'));
    expect(foldOf('Bedroom')).toHaveAttribute('aria-expanded', 'false');
    expect(shown('Under bed')).toBeNull();
  });

  it('folds and opens everything from the header, keeping the path open', async () => {
    const server = stubFolds();
    const { user } = await mount(panel('wardrobe'));
    await user.click(screen.getByRole('button', { name: 'Fold all' }));
    await waitFor(() =>
      expect(server.puts.at(-1)).toEqual({ fold: ['bedroom', 'under-bed'], open: [] }),
    );
    // Bedroom holds the page you're on, so it stays open; Under bed folds.
    expect(shown('Wardrobe')).toBeInTheDocument();
    expect(shown(/Winter clothes/)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Open all' }));
    await waitFor(() => expect(server.stored()).toEqual([]));
    expect(server.puts.at(-1)?.fold).toEqual([]);
    expect(shown(/Winter clothes/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fold all' })).toBeInTheDocument();
  });
});

describe('the collapsed outline folds the same way', () => {
  it('has the fold buttons, a Fold all, and 40 px tap targets', async () => {
    const server = stubFolds();
    const { user } = await mount(
      <PlaceTree places={PLACES} boxes={BOXES} locationId={LOC} currentId="office" />,
    );
    await user.click(screen.getByText('All places'));
    expect(foldOf('Under bed')).toHaveClass('size-10');
    expect(screen.getByRole('button', { name: 'Fold all' })).toHaveClass('min-h-10');
    await user.click(foldOf('Under bed'));
    expect(shown(/Winter clothes/)).toBeNull();
    await waitFor(() => expect(server.stored()).toEqual(['under-bed']));
    expectLogicalOnly();
  });

  it('mirrors the folded chevron in Arabic', async () => {
    stubFolds(['under-bed']);
    await mount(
      <PlaceTree places={PLACES} boxes={BOXES} locationId={LOC} currentId="office" />,
      'ar',
    );
    const button = await screen.findByRole('button', { name: /Under bed/, expanded: false });
    const chevron = button.querySelector('svg');
    expect(chevron).toHaveClass('-rotate-90', 'rtl:rotate-90');
    expectLogicalOnly();
  });
});
