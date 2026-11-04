/**
 * #427: the place tree beside a page gets a width you can change and can fold to a rail. Page owns
 * the column, so what's asserted here is what a person feels: the separator's value and keys, the
 * same control as the main navigation, the choice remembered, the direction in Arabic, and the
 * page's own state untouched by any of it (#336). The real drag, widths and reload are in
 * e2e/place-tree-width.spec.ts: jsdom has no layout.
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
import { fireEvent, screen } from '@testing-library/react';
import { type ReactNode, useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type Locale,
  PLACE_TREE_DEFAULT,
  PLACE_TREE_KEY,
  PLACE_TREE_MAX,
  PLACE_TREE_MIN,
  PLACE_TREE_WIDTH_KEY,
  setPlaceTreeCollapsed,
  setPlaceTreeWidth,
} from '@/lib/prefs';
import { expectLogicalOnly, renderUI } from '@/test/render';
import { Page } from './page';

let mounts = 0;
function Body() {
  useEffect(() => {
    mounts += 1;
  }, []);
  return <input aria-label="Typed search" />;
}

async function mount(ui: ReactNode, locale: Locale = 'en') {
  const root = createRootRoute({ component: Outlet });
  const page = createRoute({ getParentRoute: () => root, path: '/', component: () => ui });
  const router = createRouter({
    routeTree: root.addChildren([page]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const out = await renderUI(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
    { locale },
  );
  await screen.findByRole('heading', { name: 'Hall' });
  return out;
}

const withAside = (
  <Page title="Hall" aside={<nav aria-label="Places in Home">The tree</nav>}>
    <Body />
  </Page>
);
const withoutAside = (
  <Page title="Hall">
    <Body />
  </Page>
);

const separator = () => screen.getByRole('separator', { name: 'Resize places' });
const value = () => Number(separator().getAttribute('aria-valuenow'));
const root = () => document.documentElement;

beforeEach(() => {
  mounts = 0;
  vi.stubGlobal('fetch', async () => new Response(null, { status: 404 }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  setPlaceTreeCollapsed(false);
  setPlaceTreeWidth(PLACE_TREE_DEFAULT);
  localStorage.clear();
});

describe('the separator', () => {
  it('is a focusable vertical separator with a value and its bounds', async () => {
    await mount(withAside);
    const edge = separator();
    expect(edge).toHaveAttribute('tabindex', '0');
    expect(edge).toHaveAttribute('aria-orientation', 'vertical');
    expect(edge).toHaveAttribute('aria-valuemin', String(PLACE_TREE_MIN));
    expect(edge).toHaveAttribute('aria-valuemax', String(PLACE_TREE_MAX));
    expect(value()).toBe(PLACE_TREE_DEFAULT);
    expect(document.getElementById(edge.getAttribute('aria-controls') ?? '')).toHaveTextContent(
      'The tree',
    );
    expectLogicalOnly();
  });

  it('arrow keys change the width, a held Shift by more, and each press is remembered', async () => {
    await mount(withAside);
    const edge = separator();
    fireEvent.keyDown(edge, { key: 'ArrowRight' });
    expect(value()).toBe(PLACE_TREE_DEFAULT + 16);
    expect(localStorage.getItem(PLACE_TREE_WIDTH_KEY)).toBe(String(PLACE_TREE_DEFAULT + 16));
    expect(root().style.getPropertyValue('--place-tree-width')).toBe(
      `${PLACE_TREE_DEFAULT + 16}px`,
    );
    fireEvent.keyDown(edge, { key: 'ArrowLeft' });
    expect(value()).toBe(PLACE_TREE_DEFAULT);
    fireEvent.keyDown(edge, { key: 'ArrowRight', shiftKey: true });
    expect(value()).toBe(PLACE_TREE_DEFAULT + 48);
    // Up and Down belong to a horizontal separator: nothing happens.
    fireEvent.keyDown(edge, { key: 'ArrowUp' });
    expect(value()).toBe(PLACE_TREE_DEFAULT + 48);
  });

  it('Home and End go to the bounds, and the keys stop there', async () => {
    await mount(withAside);
    const edge = separator();
    fireEvent.keyDown(edge, { key: 'End' });
    expect(value()).toBe(PLACE_TREE_MAX);
    fireEvent.keyDown(edge, { key: 'ArrowRight' });
    expect(value()).toBe(PLACE_TREE_MAX);
    fireEvent.keyDown(edge, { key: 'Home' });
    expect(value()).toBe(PLACE_TREE_MIN);
    fireEvent.keyDown(edge, { key: 'ArrowLeft' });
    expect(value()).toBe(PLACE_TREE_MIN);
    expect(localStorage.getItem(PLACE_TREE_WIDTH_KEY)).toBe(String(PLACE_TREE_MIN));
  });

  it('in Arabic the edge is on the left, so the left arrow widens the tree', async () => {
    await mount(withAside, 'ar');
    const edge = screen.getByRole('separator');
    fireEvent.keyDown(edge, { key: 'ArrowLeft' });
    expect(Number(edge.getAttribute('aria-valuenow'))).toBe(PLACE_TREE_DEFAULT + 16);
    fireEvent.keyDown(edge, { key: 'ArrowRight' });
    expect(Number(edge.getAttribute('aria-valuenow'))).toBe(PLACE_TREE_DEFAULT);
    expectLogicalOnly();
  });

  it('there is no separator or toggle without a panel (phones and tablets)', async () => {
    await mount(withoutAside);
    expect(screen.queryByRole('separator')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Collapse places' })).toBeNull();
  });
});

describe('collapsing', () => {
  it("is the main navigation's control: a named button that says its state, remembered", async () => {
    const { user } = await mount(withAside);
    const collapse = screen.getByRole('button', { name: 'Collapse places' });
    expect(collapse).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById(collapse.getAttribute('aria-controls') ?? '');
    expect(panel).toHaveTextContent('The tree');
    expect(root().getAttribute('data-place-tree')).toBe('expanded');

    await user.click(collapse);
    const expand = screen.getByRole('button', { name: 'Expand places' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    expect(root().getAttribute('data-place-tree')).toBe('collapsed');
    expect(localStorage.getItem(PLACE_TREE_KEY)).toBe('collapsed');
    // The rail has no edge to drag.
    expect(screen.queryByRole('separator')).toBeNull();
    // One control in both states, so focus stays on it.
    expect(expand).toBe(collapse);
    expect(expand).toHaveFocus();

    await user.click(expand);
    expect(screen.getByRole('button', { name: 'Collapse places' })).toHaveFocus();
    expect(root().getAttribute('data-place-tree')).toBe('expanded');
    expect(localStorage.getItem(PLACE_TREE_KEY)).toBeNull();
  });

  it('keeps what is in the page: no remount, the typed search still there (#336)', async () => {
    const { user } = await mount(withAside);
    const field = screen.getByRole('textbox', { name: 'Typed search' });
    await user.type(field, 'ladder');
    expect(mounts).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Collapse places' }));
    await user.click(screen.getByRole('button', { name: 'Expand places' }));
    fireEvent.keyDown(separator(), { key: 'ArrowRight' });
    fireEvent.keyDown(separator(), { key: 'End' });

    expect(mounts).toBe(1);
    expect(screen.getByRole('textbox', { name: 'Typed search' })).toBe(field);
    expect(field).toHaveValue('ladder');
  });

  it('keeps the tree mounted too, hidden: its own state survives the fold', async () => {
    const { user } = await mount(withAside);
    const tree = screen.getByText('The tree');
    await user.click(screen.getByRole('button', { name: 'Collapse places' }));
    expect(screen.getByText('The tree')).toBe(tree);
  });
});
