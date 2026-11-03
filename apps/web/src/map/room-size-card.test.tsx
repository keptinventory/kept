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
import { setLocale } from '@/lib/prefs';
import { expectLogicalOnly, renderUI } from '@/test/render';
import { type CardProps, MapCard } from './card';
import { contentsOf, type Plan, type Room } from './layout';

// #372: a room's width and length on its card while arranging, to the centimetre, and its size
// in the card's header as typed. A size the map can't take stays in its field, said so.

const ROOM = '01926f00-0000-7000-8000-000000000010';

const balcony = (over: Partial<Room> = {}): Room => ({
  id: ROOM,
  levelKey: '_',
  name: 'Balcony',
  shortCode: null,
  kindKey: 'room',
  x: 0,
  z: 0,
  w: 0.8,
  d: 3.58,
  kind: 'balcony',
  surface: 'deck',
  ...over,
});

const view: MapView = {
  locationId: '01926f00-0000-7000-8000-000000000099',
  canArrange: true,
  version: null,
  levels: [{ id: null, name: null }],
  rooms: [],
  nodes: [],
  things: [],
  more: 0,
  attention: [],
};

function props(room: Room, arranging: boolean, over: Partial<CardProps> = {}): CardProps {
  const plan: Plan = {
    levels: [{ key: '_', id: null, name: 'Home', short: 'H' }],
    rooms: [room],
    items: [],
  };
  return {
    sel: { type: 'room', id: room.id },
    plan,
    view,
    contents: contentsOf(view),
    level: plan.levels[0],
    focused: null,
    arranging,
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
    onRoomSize: vi.fn(() => 'ok' as const),
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

const field = (name: string) => screen.getByRole('textbox', { name }) as HTMLInputElement;

describe('a room’s size on its card (#372)', () => {
  it('says its size to the centimetre, and offers no fields outside Arrange', async () => {
    await card(props(balcony(), false));
    expect(await screen.findByText('0.8 × 3.58 m')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Width' })).toBeNull();
  });

  it('takes a width and length to the centimetre while arranging', async () => {
    const p = props(balcony({ w: 4, d: 3 }), true);
    const { user } = await card(p);
    expect((await screen.findByRole('textbox', { name: 'Width' })) as HTMLInputElement).toHaveValue(
      '4.00 m',
    );
    expect(field('Length').value).toBe('3.00 m');
    await user.clear(field('Width'));
    await user.type(field('Width'), '0.8{Enter}');
    expect(p.onRoomSize).toHaveBeenLastCalledWith(ROOM, { w: 80, d: 300 });
    await user.clear(field('Length'));
    await user.type(field('Length'), '3.58{Enter}');
    expect(p.onRoomSize).toHaveBeenLastCalledWith(ROOM, { w: 400, d: 358 });
    // A centimetre a step with the arrow keys.
    await user.click(field('Length'));
    await user.keyboard('{ArrowUp}');
    expect(p.onRoomSize).toHaveBeenLastCalledWith(ROOM, { w: 400, d: 301 });
    expect(document.querySelector('.truncate, .text-ellipsis')).toBeNull();
    expectLogicalOnly();
  });

  it('keeps a size under 50 cm in its field, said so, and leaves the room as it is', async () => {
    const p = props(balcony({ w: 4, d: 3 }), true);
    const { user } = await card(p);
    await user.clear(await screen.findByRole('textbox', { name: 'Width' }));
    await user.type(field('Width'), '0.3{Enter}');
    expect(screen.getByText('A room is at least 0.5 m across.')).toBeTruthy();
    expect(field('Width').getAttribute('aria-invalid')).toBe('true');
    expect(p.onRoomSize).not.toHaveBeenCalled();
  });

  it('says so when the new size runs into another room', async () => {
    const onRoomSize = vi.fn(() => 'overlap' as const);
    const { user } = await card(props(balcony({ w: 4, d: 3 }), true, { onRoomSize }));
    await user.clear(await screen.findByRole('textbox', { name: 'Width' }));
    await user.type(field('Width'), '9{Enter}');
    expect(onRoomSize).toHaveBeenLastCalledWith(ROOM, { w: 900, d: 300 });
    expect(screen.getByText('Rooms can’t overlap.')).toBeTruthy();
  });

  it('reads in Arabic, right to left', async () => {
    setLocale('ar');
    await card(props(balcony(), true), 'ar');
    expect(await screen.findByRole('textbox', { name: 'العرض' })).toBeTruthy();
    expect(field('الطول').value).toMatch(/٣٫٥٨/);
    expect(document.documentElement.dir).toBe('rtl');
    expectLogicalOnly();
  });
});
