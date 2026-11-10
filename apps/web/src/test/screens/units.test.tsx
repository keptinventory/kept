/**
 * Metric or imperial (#385), against the mock server: chosen once in Settings and kept on the
 * profile; room sizes, a bookcase's size, a wall height and label stock sizes are shown and typed
 * in feet and inches when imperial is chosen, and saved in centimetres either way; an odometer's
 * Change unit relabels or converts, with a preview and Undo; and the Inbox says when a dashboard
 * photo showed the other unit.
 */
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CAPTURE_IDS } from '@/api/capture/mock/state';
import { INV_IDS } from '@/api/inventory/mock/fixtures';
import { inventoryPaths as p } from '@/api/inventory/paths';
import type { CreatePlaceBody } from '@/api/inventory/types';
import { IDS, type MockState, ownerScenario } from '@/api/mock/fixtures';
import { paths } from '@/api/paths';
import { ensureVehiclesSeeded } from '@/api/vehicles/mock';
import { findHeading, renderApp } from '@/test/app';
import { expectLogicalOnly } from '@/test/render';

vi.setConfig({ testTimeout: 30_000 });

const region = () => screen.getByRole('region', { name: 'Notifications' });

/** The owner's scenario, in metric or imperial. */
function scenario(units: 'metric' | 'imperial', patch?: (s: MockState) => void) {
  const state = ownerScenario();
  state.me.profile = { ...state.me.profile, units };
  patch?.(state);
  return state;
}

describe('Settings: Units', () => {
  it('keeps metric or imperial on the profile, and goes back', async () => {
    const { user, mock } = await renderApp('/settings', { state: scenario('metric') });
    await findHeading('Settings');
    const units = await screen.findByRole('radiogroup', { name: 'Units' });
    expect(within(units).getByRole('radio', { name: 'Metric' })).toBeChecked();
    await user.click(within(units).getByRole('radio', { name: 'Imperial' }));
    await waitFor(() =>
      expect(mock.lastCall('PATCH', paths.me)?.body).toEqual({ units: 'imperial' }),
    );
    expect(mock.state.me.profile.units).toBe('imperial');
    expect(within(units).getByRole('radio', { name: 'Imperial' })).toBeChecked();
    await user.click(within(units).getByRole('radio', { name: 'Metric' }));
    await waitFor(() => expect(mock.state.me.profile.units).toBe('metric'));
    expectLogicalOnly();
  });
});

describe('room sizes in either setting', () => {
  async function addRoom(units: 'metric' | 'imperial', w: string, d: string) {
    const app = await renderApp(`/loc/${IDS.home}`, {
      state: scenario(units),
      digits: 'western',
    });
    await findHeading('Home');
    await app.user.click(await screen.findByRole('button', { name: 'Room or spot' }));
    const dialog = within(await screen.findByRole('dialog'));
    await app.user.type(dialog.getByLabelText('Name'), 'Den');
    const width = dialog.getByRole('textbox', { name: 'Width' });
    const length = dialog.getByRole('textbox', { name: 'Length' });
    await app.user.type(width, w);
    await app.user.tab();
    await app.user.type(length, d);
    await app.user.tab();
    return { ...app, dialog, width, length };
  }

  it('takes feet and inches in imperial, and saves centimetres', async () => {
    const { user, mock, dialog, width, length } = await addRoom('imperial', `12'6"`, '3.8 m');
    expect(width).toHaveValue('12 ft 6 in');
    expect(length).toHaveValue('12 ft 6 in');
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await within(region()).findByText('Added Den')).toBeVisible();
    const sent = mock.lastCall('POST', p.locationPlaces(IDS.home))?.body as CreatePlaceBody;
    expect(sent.map).toEqual(expect.objectContaining({ w: 381, d: 380 }));
  });

  it('takes metres in metric, as before', async () => {
    const { user, mock, dialog, width } = await addRoom('metric', '3.81', '12 ft 6 in');
    expect(width).toHaveValue('3.81 m');
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    expect(await within(region()).findByText('Added Den')).toBeVisible();
    const sent = mock.lastCall('POST', p.locationPlaces(IDS.home))?.body as CreatePlaceBody;
    expect(sent.map).toEqual(expect.objectContaining({ w: 381, d: 381 }));
  });

  it('says what is wrong in feet and inches', async () => {
    const { user, dialog } = await addRoom('imperial', '1 ft', 'twelve');
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    expect(dialog.getByText('A room is at least 1 ft 8 in across.')).toBeVisible();
    expect(dialog.getByText('Enter feet and inches, like 11 ft 9 in.')).toBeVisible();
  });
});

describe('label stock sizes in either setting', () => {
  it.each([
    ['metric', '70 × 37 mm', '67 × 25 mm'],
    ['imperial', '2.76 × 1.46 in', '2.63 × 1 in'],
  ] as const)('in %s: A4 %s, US Letter %s', async (units, a4, letter) => {
    await renderApp(`/labels?loc=${IDS.home}&blank=24`, { state: scenario(units) });
    const a4Card = await screen.findByRole('radio', { name: /A4 sheet.*24 labels/ });
    expect(a4Card.closest('label')).toHaveTextContent(a4);
    const letterCard = screen.getByRole('radio', { name: /Letter sheet/ });
    expect(letterCard.closest('label')).toHaveTextContent(letter);
    const tape = screen.getByRole('radio', {
      name: units === 'metric' ? /12 mm tape/ : /0.47 in tape/,
    });
    expect(tape).toBeInTheDocument();
  });
});

describe('an odometer: Change unit', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('min-width: 768px'),
      media: q,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  const vehicle = () =>
    scenario('metric', (s) => {
      ensureVehiclesSeeded(s);
    });

  it('converts the readings to mi after a preview, and Undo puts them back', async () => {
    const { user, mock } = await renderApp(`/t/${INV_IDS.thing.car}`, {
      state: vehicle(),
      digits: 'western',
    });
    await findHeading('Toyota Corolla');
    const odometer = await screen.findByRole('region', { name: 'Odometer' });
    expect(odometer).toHaveTextContent(/52,340 km/);
    await user.click(within(odometer).getByRole('button', { name: 'Change unit' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Change unit' }));
    expect(sheet.getByText('From km to mi')).toBeVisible();
    expect(sheet.getByRole('radio', { name: /Convert the readings/ })).toBeChecked();
    const preview = await sheet.findByRole('status');
    expect(preview).toHaveTextContent('Latest reading: 52,340 km becomes 32,522.568 mi');
    expect(preview).toHaveTextContent(/\d+ readings change/);
    expect(mock.lastCall('POST', p.meterUnitPreview(INV_IDS.meter.carOdometer))?.body).toEqual({
      unit: 'mi',
      convert: true,
    });
    await user.click(sheet.getByRole('button', { name: 'Change unit' }));
    expect(await within(region()).findByText('Unit changed to mi')).toBeVisible();
    expect(mock.lastCall('POST', p.meterUnit(INV_IDS.meter.carOdometer))?.body).toEqual({
      unit: 'mi',
      convert: true,
    });
    await waitFor(() => expect(odometer).toHaveTextContent(/32,522\.568 mi/));
    await user.click(within(region()).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(odometer).toHaveTextContent(/52,340 km/));
  });

  it('relabels only, leaving every value', async () => {
    const { user, mock } = await renderApp(`/t/${INV_IDS.thing.car}`, {
      state: vehicle(),
      digits: 'western',
    });
    await findHeading('Toyota Corolla');
    const odometer = await screen.findByRole('region', { name: 'Odometer' });
    await user.click(within(odometer).getByRole('button', { name: 'Change unit' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Change unit' }));
    await user.click(sheet.getByRole('radio', { name: /Relabel only/ }));
    expect(await sheet.findByRole('status')).toHaveTextContent(
      'Latest reading: 52,340 km becomes 52,340 mi',
    );
    await user.click(sheet.getByRole('button', { name: 'Change unit' }));
    expect(await within(region()).findByText('Unit changed to mi')).toBeVisible();
    expect(mock.lastCall('POST', p.meterUnit(INV_IDS.meter.carOdometer))?.body).toEqual({
      unit: 'mi',
      convert: false,
    });
    await waitFor(() => expect(odometer).toHaveTextContent(/52,340 mi/));
  });
});

describe('a dashboard photo read in the other unit', () => {
  it.each([
    ['km', 'mi', true],
    ['mi', 'km', true],
    ['km', 'km', false],
    ['mi', 'mi', false],
  ] as const)('a %s odometer, the photo in %s', async (meterUnit, seen, warned) => {
    const state = ownerScenario();
    const item = state.capture.inbox.find((i) => i.id === CAPTURE_IDS.inbox.reading);
    if (!item?.reading) throw new Error('no reading in the inbox');
    item.reading = {
      ...item.reading,
      meter: { ...item.reading.meter, unit: meterUnit },
      value: '31000',
      unitSeen: seen,
    };
    const { user, mock } = await renderApp('/inbox?f.kind=reading&mine=0', {
      state,
      digits: 'western',
    });
    await findHeading('Inbox');
    const note = await screen.findAllByText(
      /doesn't fit the readings|is lower than|is higher than/,
    );
    expect(note.length).toBeGreaterThan(0);
    const warning = screen.queryByText(/The photo shows/);
    if (!warned) {
      expect(warning).toBeNull();
      return;
    }
    const converted = meterUnit === 'km' ? '49,889.664' : '19,262.507';
    expect(warning).toHaveTextContent(
      `The photo shows ${seen}, and this odometer counts ${meterUnit}. 31,000 ${seen} is ${converted} ${meterUnit}.`,
    );
    await user.click(screen.getByRole('button', { name: `Use ${converted} ${meterUnit}` }));
    await waitFor(() =>
      expect(
        mock.lastCall('POST', `/api/v1/inbox/${CAPTURE_IDS.inbox.reading}/reading`)?.body,
      ).toEqual({ action: 'edit', value: meterUnit === 'km' ? '49889.664' : '19262.507' }),
    );
  });
});
