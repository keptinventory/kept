/**
 * Rooms with their real size (#372): "Room or spot" takes a room's width and length to the
 * centimetre, in the reader's own decimal mark, and the room goes on the map at that size in one
 * request, with one Undo. What can't be a room's size is said on its field and nothing is sent.
 * Against the mock server.
 */

import { newId } from '@kept/shared';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { INV_IDS } from '@/api/inventory/mock/fixtures';
import { inventoryPaths as p } from '@/api/inventory/paths';
import type { CreatePlaceBody } from '@/api/inventory/types';
import { mockMapView } from '@/api/map/mock';
import { IDS, ownerScenario } from '@/api/mock/fixtures';
import { type Locale, setLocale } from '@/lib/prefs';
import { findHeading, renderApp } from '@/test/app';
import { expectLogicalOnly } from '@/test/render';

const region = () => screen.getByRole('region', { name: 'Notifications' });

async function openAdd(user: Awaited<ReturnType<typeof renderApp>>['user'], button: string) {
  await user.click(await screen.findByRole('button', { name: button }));
  return screen.findByRole('dialog');
}

async function home(locale: Locale = 'en') {
  const app = await renderApp(`/loc/${IDS.home}`, { locale, digits: 'western' });
  await findHeading(locale === 'en' ? 'Home' : /.+/);
  return app;
}

const sent = (mock: Awaited<ReturnType<typeof renderApp>>['mock']) =>
  mock.lastCall('POST', p.locationPlaces(IDS.home))?.body as CreatePlaceBody | undefined;

describe('a room with its real size (#372)', () => {
  it('puts a 0.80 × 3.58 m balcony on the map with the room, with one Undo', async () => {
    const { user, mock } = await home();
    const dialog = await openAdd(user, 'Room or spot');
    expect(within(dialog).getByRole('heading', { name: 'Size on the map' })).toBeVisible();
    await user.type(within(dialog).getByLabelText('Name'), 'Balcony');
    const width = within(dialog).getByRole('textbox', { name: 'Width' });
    const length = within(dialog).getByRole('textbox', { name: 'Length' });
    await user.type(width, '0.8');
    await user.tab();
    expect(width).toHaveValue('0.80 m');
    await user.type(length, '3.58');
    await user.tab();
    expect(length).toHaveValue('3.58 m');
    expectLogicalOnly();
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await within(region()).findByText('Added Balcony')).toBeVisible();
    expect(within(region()).getByText('On the map at its size.')).toBeVisible();
    expect(sent(mock)).toMatchObject({ name: 'Balcony', kindKey: 'room', map: { w: 80, d: 358 } });
    const room = mock.state.inventory.places.find((x) => x.name === 'Balcony');
    const map = mockMapView(mock.state, IDS.home);
    expect(map?.rooms.find((r) => r.id === room?.id)?.layout).toMatchObject({
      w: 80,
      d: 358,
      kind: 'balcony',
      surface: 'deck',
    });
  });

  it('leaves the map alone when no size is typed', async () => {
    const { user, mock } = await home();
    const dialog = await openAdd(user, 'Room or spot');
    await user.type(within(dialog).getByLabelText('Name'), 'Hall');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(region()).findByText('Added Hall')).toBeVisible();
    expect(sent(mock)?.map).toBeUndefined();
  });

  it.each([
    ['fr', 'Pièce ou endroit', 'Largeur', 'Longueur', 'Enregistrer'],
    ['de', 'Raum oder Platz', 'Breite', 'Länge', 'Speichern'],
  ] as const)('reads a comma as the decimal mark in %s (0,80)', async (locale, add, w, d, save) => {
    try {
      const { user, mock } = await home(locale);
      const dialog = await openAdd(user, add);
      await user.type(within(dialog).getAllByRole('textbox')[0] as HTMLElement, 'Balkon');
      const width = within(dialog).getByRole('textbox', { name: w });
      await user.type(width, '0,8');
      await user.tab();
      // French writes a narrow no-break space before the unit.
      expect((width as HTMLInputElement).value.replace(/[\u00a0\u202f]/g, ' ')).toBe('0,80 m');
      await user.type(within(dialog).getByRole('textbox', { name: d }), '3,58');
      await user.tab();
      await user.click(within(dialog).getByRole('button', { name: save }));
      await expect.poll(() => sent(mock)?.map).toEqual({ w: 80, d: 358 });
    } finally {
      setLocale('en');
    }
  });

  it('says what is wrong on the field, and sends nothing', async () => {
    const { user, mock } = await home();
    const dialog = await openAdd(user, 'Room or spot');
    await user.type(within(dialog).getByLabelText('Name'), 'Nook');
    const width = within(dialog).getByRole('textbox', { name: 'Width' });
    const length = within(dialog).getByRole('textbox', { name: 'Length' });
    // Only one of the two.
    await user.type(width, '0.8');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByText('Give the width and the length, or neither.')).toBeVisible();
    expect(length).toHaveAttribute('aria-invalid', 'true');
    // Under 50 cm, and over 100 m.
    await user.clear(width);
    await user.type(width, '0.3');
    await user.type(length, '120');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByText('A room is at least 0.5 m across.')).toBeVisible();
    expect(within(dialog).getByText('A room is at most 100 m across.')).toBeVisible();
    expect(sent(mock)).toBeUndefined();
    // Fixed, it saves.
    await user.clear(width);
    await user.type(width, '0.5');
    await user.clear(length);
    await user.type(length, '1');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(region()).findByText('Added Nook')).toBeVisible();
    expect(sent(mock)?.map).toEqual({ w: 50, d: 100 });
  });

  it('sizes a room added on a floor, a room by default there', async () => {
    const state = ownerScenario();
    const floor = newId();
    state.inventory.places.push({
      id: floor,
      locationId: IDS.home,
      parentId: null,
      name: 'Ground floor',
      kindKey: 'floor',
      icon: null,
      isUnplaced: false,
      shortCode: null,
      fields: [],
      custom: {},
      secrets: [],
      rowVersion: 1,
      sort: 0,
      deletedAt: null,
      trashBatchId: null,
      deletedBy: null,
    });
    const { user, mock } = await renderApp(`/p/${floor}`, { state, digits: 'western' });
    const dialog = await openAdd(user, 'Room or spot');
    expect(within(dialog).getByRole('radio', { name: 'Room' })).toBeChecked();
    await user.type(within(dialog).getByLabelText('Name'), 'Study');
    await user.type(within(dialog).getByRole('textbox', { name: 'Width' }), '2.45');
    await user.type(within(dialog).getByRole('textbox', { name: 'Length' }), '3.1');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(region()).findByText('Added Study')).toBeVisible();
    expect(sent(mock)).toMatchObject({ parentId: floor, map: { w: 245, d: 310 } });
    const study = mock.state.inventory.places.find((x) => x.name === 'Study');
    expect(mockMapView(mock.state, IDS.home)?.rooms.find((r) => r.id === study?.id)).toMatchObject({
      levelId: floor,
      layout: { x: 0, z: 0, w: 245, d: 310 },
    });
  });

  it('offers no size for a floor', async () => {
    const { user } = await home();
    const dialog = await openAdd(user, 'Room or spot');
    expect(within(dialog).getByRole('textbox', { name: 'Width' })).toBeVisible();
    await user.click(within(dialog).getByRole('radio', { name: 'Floor' }));
    expect(within(dialog).queryByRole('textbox', { name: 'Width' })).toBeNull();
  });

  it('offers no size for a spot inside a room', async () => {
    const room = await renderApp(`/p/${INV_IDS.place.livingRoom}`, { digits: 'western' });
    const inside = await openAdd(room.user, 'Room or spot');
    expect(within(inside).queryByRole('heading', { name: 'Size on the map' })).toBeNull();
    expect(within(inside).queryByRole('textbox', { name: 'Width' })).toBeNull();
  });

  it.each([
    ['eastern', '0.8', '3.58', /٠٫٨٠/],
    ['western', '٠٫٨', '٣٫٥٨', /0\.80/],
  ] as const)(
    'in Arabic with %s digits, takes the other keyboard’s digits too',
    async (digits, w, d, shown) => {
      try {
        const { user, mock } = await renderApp(`/loc/${IDS.home}`, { locale: 'ar', digits });
        const dialog = await openAdd(user, 'غرفة أو مكان');
        await user.type(within(dialog).getByLabelText('الاسم'), 'شرفة');
        const width = within(dialog).getByRole('textbox', { name: 'العرض' });
        await user.type(width, w);
        await user.tab();
        expect((width as HTMLInputElement).value).toMatch(shown);
        await user.type(within(dialog).getByRole('textbox', { name: 'الطول' }), d);
        await user.click(within(dialog).getByRole('button', { name: 'حفظ' }));
        await expect.poll(() => sent(mock)?.map).toEqual({ w: 80, d: 358 });
      } finally {
        setLocale('en');
      }
    },
  );

  it.each([
    ['0,8', 'a comma in English'],
    ['1e3', 'an exponent'],
    ['-2', 'a sign'],
  ])('says %s (%s) isn’t a size, and sends nothing', async (typed) => {
    const { user, mock } = await home();
    const dialog = await openAdd(user, 'Room or spot');
    await user.type(within(dialog).getByLabelText('Name'), 'Nook');
    const width = within(dialog).getByRole('textbox', { name: 'Width' });
    await user.type(width, typed);
    await user.tab();
    // Kept as typed, never another number.
    expect(width).toHaveValue(typed);
    await user.type(within(dialog).getByRole('textbox', { name: 'Length' }), '2');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByText('Enter metres, like 3.58.')).toBeVisible();
    expect(width).toHaveAttribute('aria-invalid', 'true');
    expect(sent(mock)).toBeUndefined();
  });

  it('reads right to left in Arabic, in Arabic digits', async () => {
    try {
      const { user } = await renderApp(`/loc/${IDS.home}`, { locale: 'ar', digits: 'eastern' });
      const dialog = await openAdd(user, 'غرفة أو مكان');
      const width = within(dialog).getByRole('textbox', { name: 'العرض' });
      await user.type(width, '٠٫٨');
      await user.tab();
      expect((width as HTMLInputElement).value).toMatch(/٠٫٨٠/);
      expect(within(dialog).getByRole('textbox', { name: 'الطول' })).toBeVisible();
      expect(document.documentElement.dir).toBe('rtl');
      expectLogicalOnly();
    } finally {
      setLocale('en');
    }
  });
});
