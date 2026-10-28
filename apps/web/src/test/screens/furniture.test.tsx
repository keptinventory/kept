/**
 * Furniture from a place template (#238): "Room or spot" → "Furniture with compartments…", a
 * built-in or the account's own template, built as the unit stands with a preview numbered top
 * left to bottom right, codes from the furniture's own code, one request and one Undo; and the
 * account's own place templates in Settings → Account → Templates. Against the mock server.
 */
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { INV_IDS } from '@/api/inventory/mock/fixtures';
import { mockPlaceTemplates } from '@/api/inventory/mock/place-templates';
import { inventoryPaths as p } from '@/api/inventory/paths';
import type { FromTemplateBody } from '@/api/inventory/types';
import { IDS, ownerScenario } from '@/api/mock/fixtures';
import { err } from '@/api/mock/kit';
import { findHeading, renderApp } from '@/test/app';

const P = INV_IDS.place;
const region = () => screen.getByRole('region', { name: 'Notifications' });

async function openFurniture(user: Awaited<ReturnType<typeof renderApp>>['user']) {
  await user.click(await screen.findByRole('button', { name: 'Room or spot' }));
  const place = await screen.findByRole('dialog', { name: /^Add a room or spot to/ });
  await user.click(within(place).getByRole('button', { name: 'Furniture with compartments…' }));
  return screen.findByRole('dialog', { name: /^Add furniture to/ });
}

const cells = (dialog: HTMLElement) =>
  within(within(dialog).getByRole('list', { name: 'Compartments' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent);

describe('Furniture with compartments', () => {
  it('makes a cube shelf on its side, numbered as it stands, and one Undo takes it all back', async () => {
    const { user, mock } = await renderApp(`/loc/${IDS.home}`);
    await findHeading('Home');
    const dialog = await openFurniture(user);

    // The default is the 2 × 4 cube shelf, upright: 2 across, 4 up.
    expect(await within(dialog).findByLabelText('Name')).toHaveValue('Cube shelf 2 × 4');
    expect(
      within(dialog).getByText('2 across, 4 up, counted from the top left, row by row'),
    ).toBeVisible();
    expect(cells(dialog)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
    await user.click(within(dialog).getByRole('radio', { name: 'On its side' }));
    expect(
      within(dialog).getByText('4 across, 2 up, counted from the top left, row by row'),
    ).toBeVisible();
    expect(within(dialog).getByText('Cube 1')).toBeVisible();
    expect(within(dialog).getByText('Cube 8')).toBeVisible();

    await user.clear(within(dialog).getByLabelText('Name'));
    await user.type(within(dialog).getByLabelText('Name'), 'Cube shelf 01');
    await user.type(within(dialog).getByLabelText('Its own code (optional)'), 'KX01');
    await user.type(
      within(dialog).getByLabelText('Compartment codes (optional)'),
      '{{parent}-F{{col:02}{{row:02}',
    );
    expect(within(dialog).getByText('KX01-F0101 … KX01-F0402')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));

    expect(await within(region()).findByText('Added Cube shelf 01')).toBeVisible();
    expect(within(region()).getByText('With 8 places inside')).toBeVisible();
    const sent = mock.lastCall('POST', p.placesFromTemplate(IDS.home))?.body as FromTemplateBody;
    expect(sent).toMatchObject({
      template: { builtin: 'cube_2x4' },
      name: 'Cube shelf 01',
      orientation: 'side',
      compartmentName: 'Cube {n}',
      code: 'KX01',
      codePattern: '{parent}-F{col:02}{row:02}',
    });
    const furniture = mock.state.inventory.places.find((x) => x.name === 'Cube shelf 01');
    expect(furniture).toBeDefined();
    const inside = mock.state.inventory.places.filter((x) => x.parentId === furniture?.id);
    expect(inside.map((x) => x.name)).toEqual([
      'Cube 1',
      'Cube 2',
      'Cube 3',
      'Cube 4',
      'Cube 5',
      'Cube 6',
      'Cube 7',
      'Cube 8',
    ]);

    await user.click(within(region()).getByRole('button', { name: 'Undo' }));
    expect(await within(region()).findByText('Undone')).toBeVisible();
    await waitFor(() =>
      expect(
        mock.state.inventory.places
          .filter((x) => x.id === furniture?.id || x.parentId === furniture?.id)
          .every((x) => x.deletedAt),
      ).toBe(true),
    );
  });

  it('offers the count for a bookcase, no side for one, and names a refused code', async () => {
    const { user, mock } = await renderApp(`/p/${P.office}`);
    const dialog = await openFurniture(user);
    await user.click(within(dialog).getByRole('button', { name: /Template$/ }));
    await user.click(await screen.findByRole('option', { name: 'Bookcase' }));
    expect(within(dialog).queryByRole('radio', { name: 'On its side' })).toBeNull();
    const shelves = within(dialog).getByLabelText('Shelves');
    expect(shelves).toHaveValue('6');
    await user.clear(shelves);
    await user.type(shelves, '5');
    expect(cells(dialog)).toEqual(['1', '2', '3', '4', '5']);

    // A pattern that needs the furniture's own code says so before anything is sent.
    await user.type(
      within(dialog).getByLabelText('Compartment codes (optional)'),
      '{{parent}-{{n}',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(
      within(dialog).getByText('Give the furniture its own code first: these codes start with it.'),
    ).toBeVisible();
    expect(mock.lastCall('POST', p.placesFromTemplate(IDS.home))).toBeUndefined();

    // The server's refusal names the code.
    mock.on('POST', p.placesFromTemplate(IDS.home), () =>
      err(409, 'conflict', 'That conflicts with the current state.', undefined, {
        failed: { code: 'BK01-3', reason: 'taken' },
      }),
    );
    await user.type(within(dialog).getByLabelText('Its own code (optional)'), 'BK01');
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(
      await within(dialog).findByText('BK01-3 is already on something else here.'),
    ).toBeVisible();
  });

  it("lists the account's own template and uses its names and codes", async () => {
    const state = ownerScenario();
    mockPlaceTemplates(state.inventory).push({
      id: '01900000-0000-7000-8000-00000000c0be',
      name: 'Wide cube shelf',
      layout: { kind: 'grid', across: 3, up: 2 },
      kindKey: 'furniture',
      compartmentKindKey: 'cube',
      compartmentName: 'Fach {n}',
      codePattern: '{parent}-{n:02}',
      locations: [{ id: IDS.home, name: 'Home' }],
      rowVersion: 1,
    });
    const { user, mock } = await renderApp(`/loc/${IDS.home}`, { state });
    await findHeading('Home');
    const dialog = await openFurniture(user);
    await user.click(within(dialog).getByRole('button', { name: /Template$/ }));
    await user.click(await screen.findByRole('option', { name: 'Wide cube shelf' }));
    expect(within(dialog).getByLabelText('Compartment names')).toHaveValue('Fach {n}');
    expect(within(dialog).getByLabelText('Compartment codes (optional)')).toHaveValue(
      '{parent}-{n:02}',
    );
    await user.type(within(dialog).getByLabelText('Its own code (optional)'), 'kx05');
    expect(within(dialog).getByText('KX05-01 … KX05-06')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(await within(region()).findByText('Added Wide cube shelf')).toBeVisible();
    expect(mock.lastCall('POST', p.placesFromTemplate(IDS.home))?.body).toMatchObject({
      template: { id: '01900000-0000-7000-8000-00000000c0be' },
      orientation: 'upright',
      code: 'KX05',
    });
  });
});

describe('Settings → Account → Templates → Furniture', () => {
  it('adds a place template of drawers, shared with a location', async () => {
    const { user, mock } = await renderApp('/settings/account/templates?for=places');
    expect(await screen.findByText(/^Built in: Cube shelf 1 × 4/)).toBeVisible();
    expect(await screen.findByText('No place templates of your own yet')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'New place template' }));
    const dialog = await screen.findByRole('dialog', { name: 'New place template' });
    await user.type(within(dialog).getByLabelText('Name'), 'Tall chest');
    await user.click(within(dialog).getByRole('radio', { name: 'Drawers' }));
    expect(within(dialog).getByLabelText('Compartment names')).toHaveValue('Drawer {n}');
    const drawers = within(dialog).getByLabelText('How many');
    await user.clear(drawers);
    await user.type(drawers, '12');
    await user.click(within(dialog).getByRole('button', { name: /Share with$/ }));
    await user.click(await screen.findByRole('option', { name: 'Home' }));
    await user.keyboard('{Escape}');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(region()).findByText('Added Tall chest')).toBeVisible();
    const accountId = mock.state.inventory.accountOf[IDS.home] as string;
    expect(mock.lastCall('POST', p.accountPlaceTemplates(accountId))?.body).toEqual({
      name: 'Tall chest',
      layout: { kind: 'drawers', count: 12 },
      kindKey: 'furniture',
      compartmentKindKey: 'drawer',
      compartmentName: 'Drawer {n}',
      codePattern: null,
      locationIds: [IDS.home],
    });
  });
});
