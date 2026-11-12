/**
 * Counts as a module a location can turn off (#506), against the mock server: with it on, a
 * place's page has Count here and Past counts, a box's menu Count this box, a location's page its
 * Counts link, and Tools has Counts; with it off, none of them shows, and /counts says so.
 */
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { INV_IDS } from '@/api/inventory/mock/fixtures';
import { type MockState, ownerScenario } from '@/api/mock/fixtures';
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

  it('says so on /counts', async () => {
    await renderApp('/counts', { state: countsOff() });
    expect(await screen.findByText('Counts are off')).toBeInTheDocument();
    expect(
      screen.getByText("An owner or admin turns them on in a location's What to track."),
    ).toBeInTheDocument();
  });
});
