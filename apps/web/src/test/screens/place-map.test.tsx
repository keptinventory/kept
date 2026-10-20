/**
 * A place's page has List · Grid · Map like its location's (#190), and its map opens on the
 * place: a floor on that floor, a room focused, a drawn place selected in its room, a place that
 * isn't drawn on its room with a note, and a place the map doesn't have explained with a link to
 * the location's map. The 3D engine is a stand-in here (jsdom draws no WebGL): what the page asks
 * of it is what is checked.
 */
import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INV_IDS } from '@/api/inventory/mock/fixtures';
import { mockMapView } from '@/api/map/mock';
import { mapPaths } from '@/api/map/paths';
import { IDS, type MockState, ownerScenario } from '@/api/mock/fixtures';
import { findHeading, pathOf, renderApp } from '@/test/app';

type Sel = { type: 'room' | 'item'; id: string };
type State = {
  levelKey: string;
  allFloors: boolean;
  focused: string | null;
  selected: Sel | null;
  planView: boolean;
  arranging: boolean;
  tool: 'move' | 'room';
};

const { engines, FakeEngine } = vi.hoisted(() => {
  const engines: FakeEngine[] = [];
  class FakeEngine {
    s: State;
    calls: string[] = [];
    plan: unknown;
    private readonly onState: (s: State) => void;
    constructor(opts: {
      levelKey: string;
      plan: unknown;
      events: { onState: (s: State) => void };
    }) {
      this.s = {
        levelKey: opts.levelKey,
        allFloors: false,
        focused: null,
        selected: null,
        planView: false,
        arranging: false,
        tool: 'move',
      };
      this.plan = opts.plan;
      this.onState = opts.events.onState;
      engines.push(this);
      // Everything the page may call that this stand-in doesn't model does nothing.
      // biome-ignore lint/correctness/noConstructorReturn: a catch-all stand-in for the WebGL engine
      return new Proxy(this, {
        get: (t, k) => (k in t ? t[k as keyof FakeEngine] : () => {}),
      });
    }
    get state(): State {
      return { ...this.s };
    }
    private emit() {
      this.onState(this.state);
    }
    setLevel(key: string) {
      this.calls.push(`setLevel ${key}`);
      this.s = { ...this.s, levelKey: key, allFloors: false, focused: null };
      this.emit();
    }
    drill(roomId: string, animate = true) {
      this.calls.push(`drill ${roomId}${animate ? '' : ' at once'}`);
      this.s = { ...this.s, focused: roomId };
      this.emit();
    }
    select(sel: Sel | null) {
      this.calls.push(sel ? `select ${sel.type} ${sel.id}` : 'select none');
      this.s = { ...this.s, selected: sel };
      this.emit();
    }
    up() {
      this.calls.push('up');
      this.s = { ...this.s, focused: null };
      this.emit();
    }
    showAll() {
      this.calls.push('showAll');
      this.s = { ...this.s, allFloors: true, focused: null, selected: null };
      this.emit();
    }
  }
  return { engines, FakeEngine };
});
type FakeEngine = InstanceType<typeof FakeEngine>;

vi.mock('@/map/engine/engine', () => ({ MapEngine: FakeEngine }));

const P = INV_IDS.place;
const pid = (n: number) => `01926f00-0000-7000-8000-${String(900 + n).padStart(12, '0')}`;
const UPSTAIRS = pid(1);
const TRAY = pid(2);

/** Home with a floor, Upstairs, holding the Office; Kitchen stays on no floor; a tray inside the
 * desk drawer, which the map doesn't draw. */
function withFloor(): MockState {
  const state = ownerScenario();
  const places = state.inventory.places;
  const office = places.find((p) => p.id === P.office);
  if (!office) throw new Error('the fixtures have an Office');
  places.push(
    {
      ...office,
      id: UPSTAIRS,
      name: 'Upstairs',
      kindKey: 'floor',
      parentId: null,
      shortCode: null,
      sort: 0,
    },
    {
      ...office,
      id: TRAY,
      name: 'Pen tray',
      kindKey: 'zone',
      parentId: P.deskDrawer,
      shortCode: null,
      sort: 0,
    },
  );
  office.parentId = UPSTAIRS;
  return state;
}

const engine = async () => {
  await waitFor(() => expect(engines.length).toBeGreaterThan(0));
  return engines.at(-1) as FakeEngine;
};
/** The innermost element whose whole text matches: a sentence split by `<bdi>` names. */
const findSentence = (re: RegExp) =>
  screen.findByText(
    (_, el) =>
      !!el &&
      re.test(el.textContent ?? '') &&
      ![...el.children].some((c) => re.test(c.textContent ?? '')),
  );
const mapCrumb = () => screen.findByRole('navigation', { name: 'Where you are on the map' });

beforeEach(() => {
  engines.length = 0;
});

describe("a place's layouts", () => {
  it('offers List, Grid and Map on a room, and no Table', async () => {
    await renderApp(`/p/${P.kitchen}`);
    await findHeading('Kitchen');
    const layouts = await screen.findByRole('radiogroup', { name: 'Layout' });
    expect(
      within(layouts)
        .getAllByRole('radio')
        .map((r) => r.closest('label')?.textContent),
    ).toEqual(['List', 'Grid', 'Map']);
    expect(screen.queryByRole('region', { name: /^Map of/ })).not.toBeInTheDocument();
  });

  it('has no Map on the Unplaced area', async () => {
    await renderApp(`/p/${P.homeUnplaced}?view=map`);
    await findHeading('Unplaced');
    expect(screen.queryByRole('radiogroup', { name: 'Layout' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /^Map of/ })).not.toBeInTheDocument();
    expect(engines).toHaveLength(0);
  });

  it('opens the map from the switch, in place of the list', async () => {
    const { user, router } = await renderApp(`/p/${P.kitchen}`);
    await findHeading('Kitchen');
    await user.click(await screen.findByRole('radio', { name: /Map/ }));
    expect(await screen.findByRole('region', { name: 'Map of Home' })).toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ view: 'map' });
    expect(screen.queryByRole('list', { name: 'Contents of Kitchen' })).not.toBeInTheDocument();
  });

  it('remembers Map for that place, not for its location or other places', async () => {
    const first = await renderApp(`/p/${P.kitchen}?view=map`);
    await findHeading('Kitchen');
    await screen.findByRole('region', { name: 'Map of Home' });
    first.unmount();

    const again = await renderApp(`/p/${P.kitchen}`, { state: ownerScenario() });
    await findHeading('Kitchen');
    expect(await screen.findByRole('region', { name: 'Map of Home' })).toBeInTheDocument();
    expect(again.router.state.location.search).toMatchObject({ view: 'map' });
    again.unmount();

    const other = await renderApp(`/p/${P.bedroom}`, { state: ownerScenario() });
    await findHeading('Bedroom');
    await screen.findByRole('radiogroup', { name: 'Layout' });
    expect(screen.queryByRole('region', { name: /^Map of/ })).not.toBeInTheDocument();
    other.unmount();

    await renderApp(`/loc/${IDS.home}`, { state: ownerScenario() });
    await findHeading('Home');
    await screen.findByRole('radiogroup', { name: 'Layout' });
    expect(screen.queryByRole('region', { name: /^Map of/ })).not.toBeInTheDocument();
  });
});

describe("a place's map", () => {
  it('opens a room focused on it, with its card', async () => {
    await renderApp(`/p/${P.kitchen}?view=map`);
    await findHeading('Kitchen');
    const e = await engine();
    await waitFor(() =>
      expect(e.calls).toEqual([`drill ${P.kitchen} at once`, `select room ${P.kitchen}`]),
    );
    expect(within(await mapCrumb()).getByText('Kitchen')).toBeInTheDocument();
    expect(screen.queryByText(/isn’t/)).not.toBeInTheDocument();
  });

  it('opens a floor on that floor', async () => {
    await renderApp(`/p/${UPSTAIRS}?view=map`, { state: withFloor() });
    await findHeading('Upstairs');
    const e = await engine();
    expect(e.s.levelKey).toBe(UPSTAIRS);
    expect(e.calls).toEqual([]);
  });

  it('opens a room on its floor', async () => {
    await renderApp(`/p/${P.office}?view=map`, { state: withFloor() });
    await findHeading('Office');
    const e = await engine();
    expect(e.s.levelKey).toBe(UPSTAIRS);
    await waitFor(() => expect(e.calls[0]).toBe(`drill ${P.office} at once`));
  });

  it('opens a place drawn on the map in its room, selected', async () => {
    await renderApp(`/p/${P.deskDrawer}?view=map`);
    await findHeading('Desk drawer');
    const e = await engine();
    await waitFor(() =>
      expect(e.calls).toEqual([`drill ${P.office} at once`, `select item ${P.deskDrawer}`]),
    );
  });

  it("opens a place the map doesn't draw on its holder in the room, and says so", async () => {
    await renderApp(`/p/${TRAY}?view=map`, { state: withFloor() });
    await findHeading('Pen tray');
    const e = await engine();
    await waitFor(() =>
      expect(e.calls).toEqual([`drill ${P.office} at once`, `select item ${P.deskDrawer}`]),
    );
    expect(
      await findSentence(/^Pen tray isn’t drawn on the map\. It’s in Desk drawer\.$/),
    ).toBeInTheDocument();
  });

  it('says how to put a room on no floor on one', async () => {
    await renderApp(`/p/${P.kitchen}?view=map`, { state: withFloor() });
    await findHeading('Kitchen');
    const e = await engine();
    expect(e.s.levelKey).toBe('_');
    expect(
      await findSentence(
        /^Kitchen isn’t on a floor yet\. Move it into a floor to put it on one\.$/,
      ),
    ).toBeInTheDocument();
  });

  it("explains a place the map doesn't have, with a link to the location's map", async () => {
    const state = ownerScenario();
    await renderApp(`/p/${P.bedroom}?view=map`, {
      state,
      setup: (mock) =>
        mock.on('GET', mapPaths.map(':id'), () => {
          const v = mockMapView(state, IDS.home);
          if (!v) throw new Error('Home has a map');
          return { ...v, rooms: v.rooms.filter((r) => r.id !== P.bedroom) };
        }),
    });
    await findHeading('Bedroom');
    expect(await findSentence(/^Bedroom isn’t on the map$/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Open the map of Home' });
    expect(link.getAttribute('href')).toMatch(/^\/loc\/[^?]+\?view=map$/);
    expect(engines).toHaveLength(0);
    expect(screen.queryByRole('region', { name: /^Map of/ })).not.toBeInTheDocument();
  });

  it('keeps the page the place’s own when the map goes up to the floor or the location', async () => {
    const { user, router } = await renderApp(`/p/${P.kitchen}?view=map`);
    await findHeading('Kitchen');
    const e = await engine();
    await waitFor(() => expect(e.s.focused).toBe(P.kitchen));
    await user.click(within(await mapCrumb()).getByRole('button', { name: 'Home' }));
    expect(e.calls.at(-1)).toBe('showAll');
    expect(pathOf(router)).toBe(`/p/${P.kitchen}`);
    await findHeading('Kitchen');
    expect(screen.getByRole('link', { name: /Back to \W?Home/ })).toBeInTheDocument();
  });

  it('is read-only for a viewer', async () => {
    const state = ownerScenario();
    const home = state.locations.find((l) => l.id === IDS.home);
    if (home) home.role = 'viewer';
    await renderApp(`/p/${P.kitchen}?view=map`, { state });
    await findHeading('Kitchen');
    await screen.findByRole('region', { name: 'Map of Home' });
    expect(screen.queryByRole('button', { name: 'Arrange' })).not.toBeInTheDocument();
  });
});
