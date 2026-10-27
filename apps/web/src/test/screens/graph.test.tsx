/**
 * The graph view (#207) on a location's page and a place's: the layout switch's order and icons,
 * then the graph itself over the mock's Home: pick a node for its card, pick it again (or Go in)
 * to focus it, the path back up, the Tags switch, pins in each node's name, the keyboard (Enter
 * picks, Enter again goes in, Escape closes the card and then goes up), 2D ↔ 3D remembered, the
 * 3D's turning (stops on a touch, still under reduced motion) and its floor stack, and the
 * "Needs a connection" state. jsdom lays nothing out, so what is checked is what the graph says.
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { graphPaths } from '@/api/graph/paths';
import { INV_IDS } from '@/api/inventory/mock/fixtures';
import { IDS, type MockState, ownerScenario } from '@/api/mock/fixtures';
import { findHeading, renderApp } from '@/test/app';

const P = INV_IDS.place;

/** jsdom has no matchMedia: a test lists the queries that match. */
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

beforeEach(() => {
  localStorage.clear();
  media([]);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const graph = () => screen.findByRole('group', { name: /^Graph of/ });
const node = async (name: RegExp) => within(await graph()).findByRole('button', { name });
const crumbs = () => screen.getByRole('navigation', { name: 'Where you are in the graph' });
const current = () =>
  within(crumbs())
    .getAllByRole('button')
    .find((b) => b.getAttribute('aria-current') === 'location')?.textContent;

/** Home with a ground floor under Kitchen and Living room, and a first floor under the office. */
function withFloors(): MockState {
  const state = ownerScenario();
  const inv = state.inventory;
  const floor = (id: string, name: string, sort: number) => ({
    ...(inv.places.find((p) => p.id === P.kitchen) as (typeof inv.places)[number]),
    id,
    name,
    kindKey: 'floor',
    parentId: null,
    shortCode: null,
    sort,
  });
  inv.places.push(
    floor('01926f00-0000-7000-8000-0000000f0001', 'Ground floor', 10),
    floor('01926f00-0000-7000-8000-0000000f0002', 'First floor', 11),
  );
  for (const p of inv.places) {
    if (p.id === P.kitchen || p.id === P.livingRoom)
      p.parentId = '01926f00-0000-7000-8000-0000000f0001';
    if (p.id === P.office) p.parentId = '01926f00-0000-7000-8000-0000000f0002';
  }
  return state;
}

describe('the layout switch', () => {
  it('reads List · Grid · Graph · Map on a phone, each with its icon', async () => {
    await renderApp(`/loc/${IDS.home}`);
    const layouts = await screen.findByRole('radiogroup', { name: 'Layout' });
    const labels = within(layouts)
      .getAllByRole('radio')
      .map((r) => r.closest('label') as HTMLElement);
    expect(labels.map((l) => l.textContent)).toEqual(['List', 'Grid', 'Graph', 'Map']);
    for (const l of labels) expect(l.querySelector('svg')).not.toBeNull();
  });

  it('adds Table before Map on a wide screen', async () => {
    media(['(min-width: 1024px)', '(min-width: 768px)']);
    await renderApp(`/loc/${IDS.home}`);
    const layouts = await screen.findByRole('radiogroup', { name: 'Layout' });
    expect(
      within(layouts)
        .getAllByRole('radio')
        .map((r) => r.closest('label')?.textContent),
    ).toEqual(['List', 'Grid', 'Graph', 'Table', 'Map']);
  });

  it('opens the graph from the switch and remembers it for the location', async () => {
    const { user, router } = await renderApp(`/loc/${IDS.home}`);
    await user.click(await screen.findByRole('radio', { name: 'Graph' }));
    await graph();
    expect(router.state.location.search).toMatchObject({ view: 'graph' });
    expect(
      Object.entries(localStorage).some(
        ([k, v]) => k.startsWith('kept.loc.view.') && v === 'graph',
      ),
    ).toBe(true);
  });
});

describe('the 2D graph', () => {
  it('draws Home and its places as named buttons, pins and counts in the names', async () => {
    await renderApp(`/loc/${IDS.home}?view=graph`);
    expect(await node(/^Home, Location, /)).toBeInTheDocument();
    // The boiler service is due: the kitchen says so.
    expect(await node(/^Kitchen, Room, .*1 due soon/)).toBeInTheDocument();
    expect(await node(/^Office, Room, 2 things/)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Pins' })).toHaveTextContent(
      /Low stock.*Lent out.*Due soon/,
    );
  });

  it('picks a node for its card, goes in on a second pick, and the path goes back', async () => {
    const { user } = await renderApp(`/loc/${IDS.home}?view=graph`);
    await user.click(await node(/^Office, Room/));
    const card = await screen.findByRole('complementary', { name: 'Selected' });
    expect(within(card).getByRole('heading', { name: 'Office' })).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Open' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/p\//),
    );
    expect(within(card).getByRole('link', { name: 'Show on the map' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/p\/[^?]+\?view=map$/),
    );
    expect(await node(/^Office, Room/)).toHaveAttribute('aria-pressed', 'true');

    await user.click(await node(/^Office, Room/));
    await waitFor(() => expect(current()).toBe('Office'));
    expect(await node(/^Desk drawer, Spot/)).toBeInTheDocument();

    await user.click(within(crumbs()).getByRole('button', { name: 'Home' }));
    await waitFor(() => expect(current()).toBe('Home'));
  });

  it('goes in with Go in, and a card lists what is inside', async () => {
    const { user } = await renderApp(`/loc/${IDS.home}?view=graph`);
    await user.click(await node(/^Hallway closet, Closet/));
    const card = await screen.findByRole('complementary', { name: 'Selected' });
    expect(within(card).getByRole('button', { name: /^Box 3/ })).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Go in' }));
    await waitFor(() => expect(current()).toBe('Hallway closet'));
  });

  it('shows tags as chips linked to what carries them', async () => {
    const { user } = await renderApp(`/loc/${IDS.home}?view=graph`);
    await graph();
    expect(within(await graph()).queryByRole('button', { name: /, Tag, / })).toBeNull();
    await user.click(screen.getByRole('switch', { name: 'Tags' }));
    const chip = await node(/^winter, Tag, 1 thing$/);
    await user.click(chip);
    const card = await screen.findByRole('complementary', { name: 'Selected' });
    expect(within(card).getByRole('button', { name: /Scarves/i })).toBeInTheDocument();
  });

  it('works by keyboard: Enter picks, Enter again goes in, Escape closes, then goes up', async () => {
    const { user } = await renderApp(`/loc/${IDS.home}?view=graph`);
    const office = await node(/^Office, Room/);
    office.focus();
    await user.keyboard('{Enter}');
    expect(office).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByRole('complementary', { name: 'Selected' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('complementary', { name: 'Selected' })).toBeNull();
    expect(current()).toBe('Home');
    await user.keyboard('{Enter}');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(current()).toBe('Office'));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(current()).toBe('Home'));
  });

  it('opens a place page’s graph on that place', async () => {
    await renderApp(`/p/${P.office}?view=graph`);
    await findHeading('Office');
    await waitFor(() => expect(current()).toBe('Office'));
    expect(screen.getByRole('radiogroup', { name: 'Layout' })).toBeInTheDocument();
  });

  it('opens on the new place when moving from one place’s graph to another’s', async () => {
    const { router } = await renderApp(`/p/${P.office}?view=graph`);
    await waitFor(() => expect(current()).toBe('Office'));
    await act(() =>
      router.navigate({ to: '/p/$id', params: { id: P.kitchen }, search: { view: 'graph' } }),
    );
    await findHeading('Kitchen');
    await waitFor(() => expect(current()).toBe('Kitchen'));
  });

  it('leaves Escape to the Rooms · Boxes · All switch', async () => {
    const { user } = await renderApp(`/p/${P.office}?view=graph`);
    await waitFor(() => expect(current()).toBe('Office'));
    const rooms = screen.getByRole('radio', { name: 'Rooms' });
    rooms.focus();
    await user.keyboard('{Escape}');
    expect(current()).toBe('Office');
    // From a node, Escape goes up.
    (await node(/^Desk drawer, Spot/)).focus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(current()).toBe('Home'));
  });

  it('has a text list of what it shows', async () => {
    await renderApp(`/loc/${IDS.home}?view=graph`);
    const list = await screen.findByRole('region', { name: 'In this graph' });
    expect(within(list).getByRole('button', { name: /^Office, Room/ })).toBeInTheDocument();
    expect(within(list).getByRole('button', { name: /^Desk drawer, Spot/ })).toBeInTheDocument();
  });

  it('says it needs a connection when the server can’t be reached', async () => {
    await renderApp(`/loc/${IDS.home}?view=graph`, {
      setup: (mock) =>
        mock.on('GET', graphPaths.graph(':id'), () => {
          throw new TypeError('Failed to fetch');
        }),
    });
    expect(await screen.findByText('Needs a connection')).toBeInTheDocument();
  });
});

describe('the 3D graph', () => {
  it('switches from 2D to 3D and back, remembered', async () => {
    const { user, router } = await renderApp(`/loc/${IDS.home}?view=graph`);
    await graph();
    await user.click(screen.getByRole('radio', { name: '3D' }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ dim: '3d' }));
    expect(await node(/^Kitchen, Room/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Turn left' })).toBeInTheDocument();
    expect(Object.values(localStorage)).toContain('3d');
    await user.click(screen.getByRole('radio', { name: '2D' }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ dim: '2d' }));
    expect(screen.queryByRole('button', { name: 'Turn left' })).toBeNull();
  });

  it('turns by itself until touched', async () => {
    await renderApp(`/loc/${IDS.home}?view=graph&dim=3d`);
    const stop = await screen.findByRole('button', { name: 'Stop turning' });
    const stage = stop.closest('.kgraph-stage') as HTMLElement;
    const kitchen = await node(/^Kitchen, Room/);
    const before = kitchen.style.transform;
    await waitFor(() => expect(kitchen.style.transform).not.toBe(before), { timeout: 2000 });
    act(() => {
      fireEvent.pointerDown(stage, { pointerId: 1, clientX: 10, clientY: 10 });
    });
    expect(await screen.findByRole('button', { name: 'Turn slowly' })).toBeInTheDocument();
  });

  it('starts still when the person asked for less motion', async () => {
    media(['(prefers-reduced-motion: reduce)']);
    await renderApp(`/loc/${IDS.home}?view=graph&dim=3d`);
    expect(await screen.findByRole('button', { name: 'Turn slowly' })).toBeInTheDocument();
  });

  it('brings one floor forward from the floor stack, and names floors as nodes', async () => {
    const { user } = await renderApp(`/loc/${IDS.home}?view=graph&dim=3d`, { state: withFloors() });
    const stack = await screen.findByRole('group', { name: 'Floor' });
    const ground = within(stack).getByRole('button', { name: 'Ground floor' });
    await user.click(ground);
    expect(ground).toHaveAttribute('aria-pressed', 'true');
    expect(within(stack).getByRole('button', { name: 'All floors' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Turn slowly' })).toBeInTheDocument();
    expect(await node(/^Ground floor, Floor, /)).toBeInTheDocument();
  });

  it('shows the tags in 3D too, and picks like 2D', async () => {
    const { user } = await renderApp(`/loc/${IDS.home}?view=graph&dim=3d`);
    await user.click(await screen.findByRole('switch', { name: 'Tags' }));
    expect(await node(/^cables, Tag, 1 thing$/)).toBeInTheDocument();
    await user.click(await node(/^Office, Room/));
    const card = await screen.findByRole('complementary', { name: 'Selected' });
    expect(within(card).getByRole('heading', { name: 'Office' })).toBeInTheDocument();
  });
});
