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
import { contentsOf, hangOn, type Item, type Plan, putOn } from './layout';

// #138: a thing on a wall's card. While arranging: Height, no Turn; a wall holder adds things on
// it and what hangs on it goes elsewhere with Put on…. A viewer only reads where it hangs.

const id = (n: number) => `01926f00-0000-7000-8000-${String(n).padStart(12, '0')}`;
const ROOM = id(10);
let n = 100;
const item = (over: Partial<Item>): Item => ({
  id: id(n++),
  subject: 'thing',
  roomId: ROOM,
  name: 'x',
  shortCode: null,
  model: 'item',
  x: 1,
  z: 1,
  rot: 0,
  on: null,
  parentId: ROOM,
  isContainer: false,
  quantity: 1,
  auto: false,
  ...over,
});

function garage() {
  const room = {
    id: ROOM,
    levelKey: '_',
    name: 'Garage',
    shortCode: null,
    kindKey: 'room',
    x: 0,
    z: 0,
    w: 5,
    d: 4,
    kind: 'room' as const,
    surface: 'concrete' as const,
  };
  const tv = item({ model: 'wall_tv', name: 'Workshop TV' });
  const board = item({ model: 'tool_wall', name: 'Tool wall' });
  const drill = item({ model: 'drill', name: 'Cordless drill', x: 3, z: 3 });
  const bench = item({ model: 'workbench', name: 'Workbench', x: 1, z: 2 });
  const plan: Plan = {
    levels: [{ key: '_', id: null, name: 'Home', short: 'H' }],
    rooms: [room],
    items: [tv, board, drill, bench],
  };
  hangOn(plan.items, tv, room, { x: 2.5, z: 0.2 });
  hangOn(plan.items, board, room, { x: 4.9, z: 2 });
  putOn(plan.items, drill, board);
  return { plan, tv, board, drill };
}

const view = (plan: Plan): MapView => ({
  locationId: id(99),
  canArrange: true,
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

function props(plan: Plan, it: Item, arranging: boolean, over: Partial<CardProps> = {}) {
  const v = view(plan);
  return {
    sel: { type: 'item' as const, id: it.id },
    plan,
    view: v,
    contents: contentsOf(v),
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
    onTurn: vi.fn(),
    onShape: () => {},
    onRemove: () => {},
    onRoomKind: () => {},
    onSurface: () => {},
    onAdd: () => {},
    onPutOn: vi.fn(),
    onTakeOff: vi.fn(),
    onAddOn: vi.fn(),
    onHeight: vi.fn(),
    ...over,
  } satisfies CardProps;
}

afterEach(() => {
  setLocale('en');
  vi.unstubAllGlobals();
});

/** The card inside a router (its details link to Kept's pages) and a query client (they read
 * the thing's facts, which never arrive here). */
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

describe('a thing on a wall’s card (#138)', () => {
  it('sets Height while arranging, by the keyboard, and has no Turn', async () => {
    const { plan, tv } = garage();
    const p = props(plan, tv, true);
    const { user } = await card(p);
    const field = await screen.findByRole('textbox', { name: 'Height' });
    expect((field as HTMLInputElement).value).toBe('1.2 m');
    expect(screen.queryByRole('button', { name: 'Turn' })).toBeNull();
    await user.click(field);
    await user.keyboard('{ArrowUp}');
    expect(p.onHeight).toHaveBeenLastCalledWith(tv.id, 1.25);
    // Nothing on a phone is cut short with an ellipsis.
    expect(document.querySelector('.truncate, .text-ellipsis')).toBeNull();
    expectLogicalOnly();
  });

  it('adds things on a tool wall, and moves a drill off it with Put on…', async () => {
    const { plan, board } = garage();
    await card(props(plan, board, true));
    expect(await screen.findByRole('button', { name: 'Add on it' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Height' })).toBeTruthy();
  });

  it('lets a drill on hooks go elsewhere, and turns it only with the board', async () => {
    const { plan, drill } = garage();
    await card(props(plan, drill, true));
    expect(await screen.findByRole('button', { name: 'Put on…' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Turn' })).toBeNull();
    // What hangs on a holder has no height of its own.
    expect(screen.queryByRole('textbox', { name: 'Height' })).toBeNull();
  });

  it('shows a viewer where it hangs and nothing to change', async () => {
    const { plan, tv } = garage();
    await card(props(plan, tv, false, { detail: true }));
    expect(await screen.findByText('On the wall, 1.2 m up')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Height' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Turn' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Put on…' })).toBeNull();
  });

  it('reads right to left in Arabic', async () => {
    const { plan, tv } = garage();
    setLocale('ar');
    await card(props(plan, tv, true), 'ar');
    const field = (await screen.findByRole('textbox', { name: 'الارتفاع' })) as HTMLInputElement;
    expect(field.value).toMatch(/١٫٢/);
    expect(document.documentElement.dir).toBe('rtl');
    expectLogicalOnly();
  });
});
