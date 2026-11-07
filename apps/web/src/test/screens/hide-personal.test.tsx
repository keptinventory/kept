/** Hide the Personal location (#392): Settings → Me, what leaves the app, and what stays. */
import { newId } from '@kept/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { capturePaths } from '@/api/capture/paths';
import type { ImportRun } from '@/api/capture/types';
import {
  firstRunScenario,
  IDS,
  type MockState,
  memberScenario,
  ownerScenario,
} from '@/api/mock/fixtures';
import { MockReply } from '@/api/mock/server';
import { paths } from '@/api/paths';
import { PORTABILITY_IDS, pt } from '@/api/portability/mock/state';
import { defaultTarget, shownLocations } from '@/components/capture/target';
import { findHeading, renderApp } from '@/test/app';
import { openFilters } from '@/test/filters';

/** Ibrahim with Personal hidden. */
const hidden = () => {
  const state = ownerScenario();
  state.me.profile = { ...state.me.profile, hidePersonal: true };
  state.me.personalHidden = true;
  state.locations = state.locations.map((l) =>
    l.kind === 'personal' ? { ...l, hidden: true } : l,
  );
  return state;
};

const hideIn = (state: MockState) => {
  state.me.profile = { ...state.me.profile, hidePersonal: true };
  state.me.personalHidden = true;
  state.locations = state.locations.map((l) =>
    l.kind === 'personal' ? { ...l, hidden: true } : l,
  );
  return state;
};

/** A past spreadsheet import, stopped part way, in `locationId`. */
const csvRun = (locationId: string): ImportRun => ({
  id: '01926f00-0000-7000-8000-00000000e301',
  locationId,
  source: 'csv',
  status: 'failed',
  mapping: { Name: 'name' },
  choices: {
    placeSeparator: '>',
    createPlaces: true,
    dateFormat: 'YYYY-MM-DD',
    defaultTarget: { unplaced: true },
    typeByName: true,
  },
  progress: 400,
  total: 1000,
  createdAt: new Date().toISOString(),
  startedAt: new Date().toISOString(),
  finishedAt: null,
  error: 'The database went away.',
  updatedAt: new Date().toISOString(),
  rowVersion: 3,
});

const nav = () => screen.getAllByRole('navigation')[0] as HTMLElement;

describe('Settings → Me → Hide Personal', () => {
  it('hides it, and it leaves the locations in the sidebar; showing it brings it back', async () => {
    const { user, mock } = await renderApp('/settings');
    await findHeading('Settings');
    expect(await within(nav()).findByRole('link', { name: /Personal/ })).toBeInTheDocument();

    await user.click(await screen.findByRole('switch', { name: 'Hide Personal' }));
    await waitFor(() =>
      expect(within(nav()).queryByRole('link', { name: /Personal/ })).not.toBeInTheDocument(),
    );
    expect(mock.lastCall('PATCH', paths.me)?.body).toEqual({ hidePersonal: true });
    expect(screen.getByRole('switch', { name: 'Hide Personal' })).toBeChecked();

    await user.click(screen.getByRole('switch', { name: 'Hide Personal' }));
    expect(await within(nav()).findByRole('link', { name: /Personal/ })).toBeInTheDocument();
    expect(mock.lastCall('PATCH', paths.me)?.body).toEqual({ hidePersonal: false });
  });

  it("can't be turned on while Personal is the only location", async () => {
    const { mock } = await renderApp('/settings', { state: firstRunScenario() });
    const toggle = await screen.findByRole('switch', { name: 'Hide Personal' });
    expect(toggle).toBeDisabled();
    expect(await screen.findByText(/is your only location, so it stays/)).toBeInTheDocument();
    expect(mock.lastCall('PATCH', paths.me)).toBeUndefined();
  });

  it('says why it is showing when it was hidden and nothing else is left', async () => {
    const state = firstRunScenario();
    state.me.profile = { ...state.me.profile, hidePersonal: true };
    await renderApp('/settings', { state });
    const toggle = await screen.findByRole('switch', { name: 'Hide Personal' });
    expect(toggle).toBeEnabled();
    expect(
      await screen.findByText(/is showing because it's your only location/),
    ).toBeInTheDocument();
    expect(await within(nav()).findByRole('link', { name: /Personal/ })).toBeInTheDocument();
  });
});

describe('Settings → Me, before and without a Personal', () => {
  it('claims nothing about being the only location while the locations load', async () => {
    await renderApp('/settings', {
      setup: (m) => m.on('GET', paths.locations, () => new Promise(() => {})),
    });
    const toggle = await screen.findByRole('switch', { name: 'Hide Personal' });
    expect(toggle).toBeDisabled();
    expect(screen.queryByText(/your only location/)).not.toBeInTheDocument();
  });

  it('claims nothing about being the only location when the locations fail', async () => {
    await renderApp('/settings', {
      setup: (m) =>
        m.on('GET', paths.locations, () => new MockReply(500, { error: 'x', code: 'internal' })),
    });
    await screen.findByRole('switch', { name: 'Hide Personal' });
    await waitFor(() => expect(screen.queryByText(/your only location/)).not.toBeInTheDocument());
    // Give the failure time to land: the sentence must not come with it.
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText(/your only location/)).not.toBeInTheDocument();
  });

  it('has no "Your locations" heading with nothing under it', async () => {
    const state = ownerScenario();
    state.me.personalLocationId = null;
    await renderApp('/settings', { state });
    await findHeading('Settings');
    await screen.findByRole('heading', { name: 'Your data' });
    expect(screen.queryByRole('heading', { name: 'Your locations' })).not.toBeInTheDocument();
  });

  it('keeps the heading when there is a Personal to hide', async () => {
    await renderApp('/settings');
    expect(await screen.findByRole('heading', { name: 'Your locations' })).toBeInTheDocument();
  });
});

describe('Import with Personal hidden', () => {
  it('someone who can import nowhere else imports into Personal, not a dead end', async () => {
    await renderApp('/settings/import', { state: hideIn(memberScenario()) });
    await findHeading('Choose the file');
    expect(screen.queryByText('Only owners and admins can import')).not.toBeInTheDocument();
    const box = screen.getByRole('combobox', { name: 'Import into' });
    await waitFor(() => expect(box).toHaveValue('Personal'));
  });

  it('with somewhere else to import, Personal is still left out', async () => {
    await renderApp('/settings/import', { state: hidden() });
    await findHeading('Choose the file');
    const box = screen.getByRole('combobox', { name: 'Import into' });
    expect(box).not.toHaveValue('Personal');
  });

  it('their own past import from Activity opens, naming Personal', async () => {
    const state = hideIn(memberScenario());
    const run = pt(state).archiveRuns.find((r) => r.id === PORTABILITY_IDS.homeboxDone);
    if (!run) throw new Error('no run');
    run.locationId = IDS.alfredPersonal;
    await renderApp(`/settings/import?run=${run.id}`, { state });
    expect(await findHeading('Done')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Imported into Personal' })).toBeVisible();
    expect(screen.queryByText('Only owners and admins can import')).not.toBeInTheDocument();
  });

  it('someone who adminned elsewhere sees a past archive import named, not blank', async () => {
    const state = hidden();
    const run = pt(state).archiveRuns.find((r) => r.id === PORTABILITY_IDS.homeboxDone);
    if (!run) throw new Error('no run');
    run.locationId = IDS.personal;
    await renderApp(`/settings/import?run=${run.id}`, { state });
    expect(await screen.findByRole('heading', { name: 'Imported into Personal' })).toBeVisible();
  });

  it('a past spreadsheet import names its own location, whatever else the person adminned', async () => {
    const state = hidden();
    const run = csvRun(IDS.personal);
    state.capture.imports.unshift(run);
    await renderApp(`/settings/import?run=${run.id}`, { state });
    expect(await findHeading('Importing into Personal')).toBeInTheDocument();
  });

  it('a run opens before the check for somewhere to import', async () => {
    // Nothing of theirs takes an import any more; the run they could read still opens.
    const state = memberScenario();
    state.locations = state.locations.filter((l) => l.kind !== 'personal');
    const run = csvRun(IDS.home);
    await renderApp(`/settings/import?run=${run.id}`, {
      state,
      setup: (m) => m.on('GET', capturePaths.importRun(':id'), () => run),
    });
    expect(await findHeading('Importing into Home')).toBeInTheDocument();
    expect(screen.queryByText('Only owners and admins can import')).not.toBeInTheDocument();
  });

  it('with no run and nowhere to import, it says who can', async () => {
    const state = memberScenario();
    state.locations = state.locations.filter((l) => l.kind !== 'personal');
    await renderApp('/settings/import', { state });
    expect(await screen.findByText('Only owners and admins can import')).toBeInTheDocument();
  });
});

describe('with Personal hidden', () => {
  it("leaves Settings → Locations and the location filter's reach", async () => {
    await renderApp('/settings/locations', { state: hidden() });
    await screen.findAllByRole('link', { name: /Home/ });
    expect(screen.queryByRole('link', { name: /^Personal/ })).not.toBeInTheDocument();
  });

  it('a direct link still opens it, and says so', async () => {
    await renderApp(`/loc/${IDS.personal}`, { state: hidden() });
    await findHeading('Personal');
    expect(
      await screen.findByText(/is hidden from your menu, Home, lists and search/),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Show it again' })).toHaveAttribute(
      'href',
      '/settings',
    );
  });

  it('"Export my data" names the location that takes over, and that Personal is not in it', async () => {
    await renderApp('/settings/export?sheet=me', { state: hidden() });
    const sheet = await screen.findByRole('dialog', { name: 'Export my data' });
    expect(sheet).toHaveTextContent('Home with its files');
    expect(sheet).toHaveTextContent("Personal is hidden, so it isn't in this file");
  });

  it('"Export a location" still offers Personal, so it can be exported', async () => {
    const { user } = await renderApp('/settings/export?sheet=location', { state: hidden() });
    const sheet = await screen.findByRole('dialog', { name: 'Export a location' });
    await user.click(within(sheet).getByRole('button', { name: /Location/ }));
    expect(await screen.findByRole('option', { name: 'Personal' })).toBeInTheDocument();
  });

  it('the export list filters Personal by its name, beside one My data (#459)', async () => {
    const state = hidden();
    const me = pt(state).exports.find((r) => r.scope === 'me');
    if (!me) throw new Error('the mock has no My data export');
    pt(state).exports.push({ ...me, id: newId(), scope: 'location', locationId: IDS.personal });
    const { user } = await renderApp('/settings/export', { state });
    await screen.findByRole('button', { name: /^Filters/ });
    const sheet = await openFilters(user, 'Location');
    const grid = within(sheet).getByRole('grid', { name: 'Location' });
    expect(within(grid).getAllByRole('row', { name: /^My data/ })).toHaveLength(1);
    expect(within(grid).getByRole('row', { name: /^Personal/ })).toBeInTheDocument();
  });

  it('a template sheet keeps a hidden Personal it was shared with, once deselected (#459)', async () => {
    const state = hidden();
    const box = state.capture.templates[0];
    if (!box) throw new Error('the mock has no template');
    box.locations = [
      { id: IDS.personal, name: 'Personal' },
      { id: IDS.home, name: 'Home' },
    ];
    const { user } = await renderApp('/settings/account/templates', { state });
    await screen.findByRole('list', { name: 'Templates' });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const sheet = await screen.findByRole('dialog', { name: 'Edit template' });
    await user.click(within(sheet).getByRole('button', { name: /Share with/ }));
    await user.click(await screen.findByRole('option', { name: 'Personal' }));
    // Deselected, and still there to choose again.
    const personal = await screen.findByRole('option', { name: 'Personal' });
    expect(personal).toHaveAttribute('aria-selected', 'false');
    await user.click(personal);
    expect(screen.getByRole('option', { name: 'Personal' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('the personal AI key says what it is for', async () => {
    await renderApp('/settings/me/ai', { state: hidden() });
    expect(
      await screen.findByText(/a location you own and use alone that has no account key/),
    ).toBeInTheDocument();
  });

  it('keeps Export my data on Personal without it hidden', async () => {
    await renderApp('/settings/export?sheet=me');
    const sheet = await screen.findByRole('dialog', { name: 'Export my data' });
    expect(sheet).toHaveTextContent('Personal with its files');
    expect(sheet).not.toHaveTextContent('is hidden');
  });
});

describe('where capture starts', () => {
  const loc = (id: string, role: 'owner' | 'viewer' = 'owner') =>
    ({ id, name: id, kind: 'home', role, unplacedPlaceId: `${id}-u` }) as never;
  const base = {
    placesOf: () => [],
    personalLocationId: 'personal',
    hiddenLocationId: 'personal',
  };

  it('starts in the other location', () => {
    localStorage.clear();
    const t = defaultTarget({ ...base, locations: [loc('personal'), loc('home')] });
    expect(t?.locationId).toBe('home');
  });

  it('ignores a remembered hidden location', () => {
    localStorage.setItem('kept.capture.last', JSON.stringify({ locationId: 'personal' }));
    const t = defaultTarget({ ...base, locations: [loc('personal'), loc('home')] });
    expect(t?.locationId).toBe('home');
    localStorage.clear();
  });

  it('ignores a remembered location that has gone', () => {
    localStorage.setItem('kept.capture.last', JSON.stringify({ locationId: 'gone' }));
    const t = defaultTarget({ ...base, locations: [loc('personal'), loc('home')] });
    expect(t?.locationId).toBe('home');
    localStorage.clear();
  });

  it('uses Personal if you can write nowhere else', () => {
    localStorage.clear();
    const t = defaultTarget({
      ...base,
      locations: [loc('personal'), loc('home', 'viewer')],
    });
    expect(t?.locationId).toBe('personal');
  });

  it('still goes into a box in it when asked', () => {
    localStorage.clear();
    const t = defaultTarget({
      ...base,
      locations: [loc('personal'), loc('home')],
      into: { id: 'box', name: 'Box', locationId: 'personal' } as never,
    });
    expect(t).toMatchObject({ locationId: 'personal', containerId: 'box' });
  });

  it('offers the rest, and everything when there is nothing else', () => {
    const a = { id: 'personal' };
    const b = { id: 'home' };
    expect(shownLocations([a, b], 'personal')).toEqual([b]);
    expect(shownLocations([a], 'personal')).toEqual([a]);
    expect(shownLocations([a, b], null)).toEqual([a, b]);
  });
});
