/**
 * Counts as a module a location can turn off (#506), against the mock server: with it on, a
 * place's page has Count here and Past counts, a box's menu Count this box, a location's page its
 * Counts link, and Tools has Counts; with it off, none of them shows, and /counts says so.
 */
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { countsStore } from '@/api/counts/mock';
import { INV_IDS } from '@/api/inventory/mock/fixtures';
import { IDS, type MockState, ownerScenario } from '@/api/mock/fixtures';
import { findHeading, renderApp } from '@/test/app';

vi.setConfig({ testTimeout: 15_000 });

const P = INV_IDS.place;
const T = INV_IDS.thing;

/** The owner scenario with Counts off in every location. */
function countsOff(): MockState {
  const state = ownerScenario();
  for (const l of state.locations) {
    l.modules = l.modules.filter((m) => m !== 'counts');
    if (l.effectiveModules) l.effectiveModules = l.effectiveModules.filter((m) => m !== 'counts');
  }
  return state;
}

const mainNav = () =>
  screen
    .getAllByRole('navigation', { name: 'Main' })
    .find((n) => within(n).queryByText('Activity')) as HTMLElement;

describe('Counts on (every preset has it)', () => {
  it('shows Count here and Past counts on a place, and Counts in Tools', async () => {
    await renderApp(`/p/${P.livingRoom}`);
    await findHeading('Living room');
    expect(await screen.findByRole('button', { name: /^Count here/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Past counts/ })).toBeInTheDocument();
    expect(within(mainNav()).getByRole('link', { name: 'Counts' })).toBeInTheDocument();
  });

  it('offers Count this box in a box’s menu', async () => {
    const { user } = await renderApp(`/t/${T.cableBox}`);
    await findHeading('Cable box');
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    expect(await screen.findByRole('menuitem', { name: 'Count this box' })).toBeInTheDocument();
  });
});

describe('Counts off', () => {
  it('hides Count here, Count regularly and Past counts on a place, and Counts in Tools', async () => {
    await renderApp(`/p/${P.livingRoom}`, { state: countsOff() });
    await findHeading('Living room');
    // The page has loaded its rows: Select is one of them.
    await screen.findByRole('heading', { name: 'Living room', level: 1 });
    expect(screen.queryByRole('button', { name: /^Count here/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Count regularly/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Past counts/ })).toBeNull();
    expect(within(mainNav()).queryByRole('link', { name: 'Counts' })).toBeNull();
    expect(within(mainNav()).getByRole('link', { name: 'Labels' })).toBeInTheDocument();
  });

  it('leaves Count this box out of a box’s menu, and keeps Box check', async () => {
    const { user } = await renderApp(`/t/${T.cableBox}`, { state: countsOff() });
    await findHeading('Cable box');
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    expect(await screen.findByRole('menuitem', { name: 'Box check' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Count this box' })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Pack into this box' })).toBeInTheDocument();
  });

  it('leaves the Counts link off a location’s page', async () => {
    const state = countsOff();
    const home = state.locations.find((l) => l.name === 'Home');
    await renderApp(`/loc/${home?.id}`, { state });
    await findHeading('Home');
    await screen.findByRole('link', { name: 'Incidents' });
    expect(screen.queryByRole('link', { name: 'Counts' })).toBeNull();
  });

  it('lists the box checks on /counts, and no count, with Back from a box check landing there', async () => {
    const state = countsOff();
    const home = state.locations.find((l) => l.name === 'Home');
    countsStore(state).boxChecks.push({
      id: '01926f00-0000-7000-8000-0000000b0c01',
      locationId: home?.id ?? '',
      at: new Date(Date.now() - 3_600_000).toISOString(),
      by: { id: IDS.ibrahim, displayName: 'Ibrahim' },
      container: { id: T.box3, name: 'Box 3' },
      lines: [],
    });
    const { user } = await renderApp('/counts/box/01926f00-0000-7000-8000-0000000b0c01', {
      state,
    });
    await findHeading('Box check of Box 3');
    await user.click(screen.getByRole('link', { name: 'Back' }));
    expect(
      await screen.findByText('Counts are off here: this lists the box checks.'),
    ).toBeInTheDocument();
    const list = await screen.findByRole('list', { name: 'Counts' });
    expect(await within(list).findByText('Box 3')).toBeInTheDocument();
    // The sample's two past counts of the hallway closet aren't listed.
    expect(within(list).queryByText('Hallway closet')).toBeNull();
  });

  it('shows Counts are off on a count’s page, not an error', async () => {
    await renderApp('/counts/01926f00-0000-7000-8000-0000000c0002', { state: countsOff() });
    expect(await screen.findByText('Counts are off')).toBeInTheDocument();
    expect(screen.queryByText(/Couldn.t load/)).toBeNull();
  });
});

describe('Counts off in one location only', () => {
  it('opens /counts on a location with Counts on', async () => {
    const state = ownerScenario();
    const home = state.locations.find((l) => l.name === 'Home');
    const garage = state.locations.find((l) => l.name === 'Garage');
    if (!home || !garage) throw new Error('fixture');
    home.modules = home.modules.filter((m) => m !== 'counts');
    await renderApp('/counts', { state });
    // Home has the sample's two counts, but Counts off: the list opens on a location with it on,
    // which has none yet.
    expect(await screen.findByText('No counts yet')).toBeInTheDocument();
    expect(screen.queryByText('Counts are off here: this lists the box checks.')).toBeNull();
  });

  it('a location with Counts off, named in the address, lists its box checks without an error', async () => {
    const state = ownerScenario();
    const home = state.locations.find((l) => l.name === 'Home');
    if (!home) throw new Error('fixture');
    home.modules = home.modules.filter((m) => m !== 'counts');
    await renderApp(`/counts?f.location=${home.id}`, { state });
    expect(
      await screen.findByText('Counts are off here: this lists the box checks.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Couldn.t load/)).toBeNull();
  });
});

describe('a planned count while Counts is off', () => {
  const withPlannedCount = (state: MockState) => {
    const boiler = state.household.schedules[0];
    if (!boiler) throw new Error('fixture');
    state.household.schedules.push({
      ...boiler,
      id: '01926f00-0000-7000-8000-0000000c5c01',
      name: 'Count the kitchen',
      kind: 'count',
      everyMonths: 6,
    });
    return state;
  };

  it('offers Complete while Counts is on', async () => {
    await renderApp('/schedules', { state: withPlannedCount(ownerScenario()) });
    expect(
      await screen.findByRole('button', { name: 'Complete Count the kitchen' }),
    ).toBeInTheDocument();
  });

  it('has no Complete, Snooze or Skip once with Counts off; other schedules keep theirs', async () => {
    const { user } = await renderApp('/schedules', { state: withPlannedCount(countsOff()) });
    expect(
      await screen.findByRole('button', { name: 'Complete Boiler service' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Complete Count the kitchen' })).toBeNull();
    const row = screen.getByText('Count the kitchen').closest('article') as HTMLElement;
    const more = within(row).queryByRole('button', { name: 'More' });
    if (more) await user.click(more);
    expect(screen.queryByRole('menuitem', { name: 'Snooze' })).toBeNull();
    expect(within(row).queryByRole('button', { name: 'Snooze' })).toBeNull();
    expect(within(row).queryByRole('button', { name: 'Skip once' })).toBeNull();
  });
});
