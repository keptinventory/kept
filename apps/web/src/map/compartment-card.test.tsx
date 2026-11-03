import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MapView } from '@/api/map/types';
import { setLocale } from '@/lib/prefs';
import { renderUI } from '@/test/render';
import { type CardProps, MapCard } from './card';
import { contentsOf, type Item, type Plan } from './layout';

// #238 (1.14.4): furniture's compartments on the map's card. The card shows them as the unit
// stands; picking one (here or on the map) opens its own card: its name, where it is, what is in
// it, and a link to the place.

const id = (n: number) => `01926f00-0000-7000-8000-${String(n).padStart(12, '0')}`;
const ROOM = id(10);
const SHELF = id(20);
const compartments = [1, 2, 3, 4].map((n) => ({
  id: id(30 + n),
  name: `Cube ${n}`,
  shortCode: n === 2 ? 'K7D2QX' : null,
  labelPrinted: n === 2,
  n,
  row: Math.ceil(n / 2),
  col: ((n - 1) % 2) + 1,
  rows: 1,
  cols: 1,
}));
const shelf: Item = {
  id: SHELF,
  subject: 'place',
  roomId: ROOM,
  name: 'Cube shelf 01',
  shortCode: null,
  model: 'cube_grid',
  x: 1,
  z: 1,
  rot: 0,
  on: null,
  parentId: ROOM,
  isContainer: false,
  quantity: 1,
  auto: true,
  grid: { columns: 2, rows: 2, kind: 'grid' },
  compartments,
};
const plan: Plan = {
  levels: [{ key: '_', id: null, name: 'Home', short: 'H' }],
  rooms: [
    {
      id: ROOM,
      levelKey: '_',
      name: 'Office',
      shortCode: null,
      kindKey: 'room',
      x: 0,
      z: 0,
      w: 4,
      d: 4,
      kind: 'room',
      surface: 'wood',
    },
  ],
  items: [shelf],
};
const thing = (n: number, name: string, compartmentId: string | null) => ({
  id: id(50 + n),
  name,
  shortCode: null,
  labelPrinted: false,
  quantity: 1,
  parentId: SHELF,
  typeKey: null,
  typeName: null,
  isContainer: false,
  compartmentId,
});
const view: MapView = {
  locationId: id(99),
  canArrange: true,
  version: null,
  levels: [{ id: null, name: null }],
  rooms: [],
  nodes: [
    {
      id: SHELF,
      subject: 'place',
      name: shelf.name,
      shortCode: null,
      roomId: ROOM,
      parentId: ROOM,
      kindKey: 'furniture',
      typeKey: null,
      isContainer: false,
      quantity: 1,
      layout: null,
      grid: shelf.grid ?? null,
      compartments,
    },
  ],
  things: [
    thing(1, 'HDMI cables', id(32)),
    thing(2, 'Board games', id(33)),
    thing(3, 'Torch', null),
  ],
  more: 0,
  attention: [],
};

function props(over: Partial<CardProps> = {}): CardProps {
  return {
    sel: { type: 'item', id: SHELF },
    plan,
    view,
    contents: contentsOf(view),
    level: plan.levels[0],
    focused: ROOM,
    arranging: false,
    inner: null,
    setInner: () => {},
    detail: false,
    setDetail: () => {},
    onClose: () => {},
    onSelect: () => {},
    onOpenRoom: () => {},
    onGoLevel: () => {},
    onTurn: () => {},
    onShape: () => {},
    onRemove: () => {},
    onRoomKind: () => {},
    onSurface: () => {},
    onAdd: () => {},
    onPutOn: () => {},
    onTakeOff: () => {},
    onAddOn: () => {},
    onHeight: () => {},
    ...over,
  };
}

afterEach(() => {
  setLocale('en');
  vi.unstubAllGlobals();
});

async function card(p: CardProps, locale: 'en' | 'ar' = 'en') {
  vi.stubGlobal('fetch', () => new Promise(() => {}));
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRootRoute({
    component: () => (
      <QueryClientProvider client={qc}>
        <MapCard {...p} />
      </QueryClientProvider>
    ),
  });
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  return renderUI(<RouterProvider router={router} />, { locale });
}

describe('furniture’s compartments on the map card (#238)', () => {
  it('shows them as the unit stands and picks one', async () => {
    const setPart = vi.fn();
    const { user } = await card(props({ setPart }));
    const list = await screen.findByRole('list', { name: 'Compartments' });
    const cells = within(list).getAllByRole('button');
    expect(cells.map((b) => b.textContent)).toEqual(['1', '2', '3', '4']);
    // Laid out top left first, whatever the language.
    expect(list).toHaveAttribute('dir', 'ltr');
    await user.click(within(list).getByRole('button', { name: 'Cube 2' }));
    expect(setPart).toHaveBeenCalledWith(id(32));
  });

  it('opens a picked compartment’s card: what is in it, its label and its place', async () => {
    const setPart = vi.fn();
    const setInner = vi.fn();
    const { user } = await card(props({ part: id(32), setPart, setInner }));
    expect(await screen.findByRole('heading', { name: 'Cube 2' })).toBeVisible();
    expect(screen.getByText('Inside · 1')).toBeVisible();
    expect(screen.getByRole('button', { name: /HDMI cables/ })).toBeVisible();
    expect(screen.queryByText('Torch')).toBeNull();
    expect(screen.getByRole('link', { name: 'Open the place' })).toHaveAttribute(
      'href',
      `/p/${id(32)}`,
    );
    const list = screen.getByRole('list', { name: 'Compartments' });
    expect(within(list).getByRole('button', { name: 'Cube 2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Back to the furniture.
    await user.click(screen.getByRole('button', { name: /Cube shelf 01/ }));
    expect(setPart).toHaveBeenCalledWith(null);
    // A thing in it opens its own card.
    await user.click(screen.getByRole('button', { name: /HDMI cables/ }));
    expect(setInner).toHaveBeenCalledWith(id(51));
  });

  it('keeps out of the way while arranging', async () => {
    await card(props({ arranging: true }));
    await screen.findByRole('heading', { name: 'Cube shelf 01' });
    expect(screen.queryByRole('list', { name: 'Compartments' })).toBeNull();
  });

  it('reads right to left in Arabic, the grid as it stands', async () => {
    setLocale('ar');
    await card(props({ part: id(33) }), 'ar');
    const list = await screen.findByRole('list', { name: 'الخانات' });
    expect(list).toHaveAttribute('dir', 'ltr');
    expect(
      within(list)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['١', '٢', '٣', '٤']);
  });
});
