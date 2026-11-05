/** Hide the Personal location (#392): Settings → Me, what leaves the app, and what stays. */
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { firstRunScenario, IDS, ownerScenario } from '@/api/mock/fixtures';
import { paths } from '@/api/paths';
import { defaultTarget, shownLocations } from '@/components/capture/target';
import { findHeading, renderApp } from '@/test/app';

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
    expect(screen.getByText(/is your only location, so it stays/)).toBeInTheDocument();
    expect(mock.lastCall('PATCH', paths.me)).toBeUndefined();
  });

  it('says why it is showing when it was hidden and nothing else is left', async () => {
    const state = firstRunScenario();
    state.me.profile = { ...state.me.profile, hidePersonal: true };
    await renderApp('/settings', { state });
    const toggle = await screen.findByRole('switch', { name: 'Hide Personal' });
    expect(toggle).toBeEnabled();
    expect(screen.getByText(/is showing because it's your only location/)).toBeInTheDocument();
    expect(await within(nav()).findByRole('link', { name: /Personal/ })).toBeInTheDocument();
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
