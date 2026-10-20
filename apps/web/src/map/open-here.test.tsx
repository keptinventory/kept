import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MapView } from '@/api/map/types';
import { renderUI } from '@/test/render';
import { type CardProps, MapCard } from './card';
import { contentsOf, type Item, type Plan } from './layout';

// On a place's own page the map opens on that place: its card doesn't link back to the page
// you're already on, and every other place's card still does.

const id = (n: number) => `01926f00-0000-7000-8000-${String(n).padStart(12, '0')}`;
const STUDY = id(10);
const SHELF = id(11);

function study(): Plan {
  const shelf: Item = {
    id: SHELF,
    subject: 'place',
    roomId: STUDY,
    name: 'Bookshelf',
    shortCode: null,
    model: 'bookshelf',
    x: 1,
    z: 1,
    rot: 0,
    on: null,
    parentId: STUDY,
    isContainer: false,
    quantity: 1,
    auto: false,
  };
  return {
    levels: [{ key: '_', id: null, name: 'Home', short: 'H' }],
    rooms: [
      {
        id: STUDY,
        levelKey: '_',
        name: 'Study',
        shortCode: null,
        kindKey: 'room',
        x: 0,
        z: 0,
        w: 4,
        d: 3,
        kind: 'room',
        surface: 'wood',
      },
    ],
    items: [shelf],
  };
}

const view = (plan: Plan): MapView => ({
  locationId: id(99),
  canArrange: false,
  version: null,
  levels: [{ id: null, name: null }],
  rooms: [],
  nodes: plan.items.map((i) => ({
    id: i.id,
    subject: i.subject,
    name: i.name,
    shortCode: i.shortCode,
    roomId: i.roomId,
    parentId: i.parentId,
    kindKey: null,
    typeKey: null,
    isContainer: false,
    quantity: 1,
    layout: null,
  })),
  things: [],
  more: 0,
  attention: [],
});

function props(sel: CardProps['sel'], over: Partial<CardProps> = {}): CardProps {
  const plan = study();
  const v = view(plan);
  return {
    sel,
    plan,
    view: v,
    contents: contentsOf(v),
    level: plan.levels[0],
    focused: null,
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

afterEach(() => vi.unstubAllGlobals());

async function card(p: CardProps) {
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
  renderUI(<RouterProvider router={router} />);
  await screen.findByRole('heading', { name: p.sel.type === 'room' ? 'Study' : 'Bookshelf' });
}

describe('a place’s card on its own page', () => {
  it('a room’s card links to the room’s page from anywhere else', async () => {
    await card(props({ type: 'room', id: STUDY }));
    expect(screen.getByRole('link', { name: 'Open the place' })).toBeInTheDocument();
  });

  it('a room’s card has no link to the page the map is already on', async () => {
    await card(props({ type: 'room', id: STUDY }, { here: STUDY }));
    expect(screen.queryByRole('link', { name: 'Open the place' })).toBeNull();
  });

  it('a place drawn in the room drops the link on its own page, and keeps it on the room’s', async () => {
    await card(props({ type: 'item', id: SHELF }, { here: SHELF, detail: true }));
    expect(screen.queryByRole('link', { name: 'Open the place' })).toBeNull();
  });

  it('keeps the link on a drawn place’s card when the map is on its room’s page', async () => {
    await card(props({ type: 'item', id: SHELF }, { here: STUDY, detail: true }));
    expect(screen.getByRole('link', { name: 'Open the place' })).toBeInTheDocument();
  });
});
