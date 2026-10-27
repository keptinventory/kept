/**
 * The place tree in A to Z order with boxes as leaves, the pickers that find boxes, and Move into a
 * box, against the mock server.
 */
import { newId } from '@kept/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { INV_IDS } from '@/api/inventory/mock/fixtures';
import { inventoryPaths } from '@/api/inventory/paths';
import { IDS, type MockState, ownerScenario } from '@/api/mock/fixtures';
import { findHeading, renderApp } from '@/test/app';

const P = INV_IDS.place;
const T = INV_IDS.thing;

/** `count` boxes named `prefix N` in `placeId`, cloned from a fixture thing. */
function addBoxes(state: MockState, placeId: string, prefix: string, count: number) {
  const base = state.inventory.things.find((x) => x.id === T.tv);
  if (!base) throw new Error('fixture');
  for (let i = 1; i <= count; i++)
    state.inventory.things.push({
      ...base,
      id: newId(),
      shortCode: null,
      name: `${prefix} ${i}`,
      placeId,
      containerId: null,
      isContainer: true,
    });
}

describe('the place tree', () => {
  it('shows a box under its place, after its places, with what is inside counted', async () => {
    await renderApp(`/p/${P.deskDrawer}`);
    await findHeading('Desk drawer');
    const box = await screen.findByRole('link', { name: /^Cable box\s*1 thing$/ });
    expect(box).toHaveAttribute('href', expect.stringMatching(/^\/t\//));
    const links = screen
      .getAllByRole('link')
      .map((l) => l.textContent ?? '')
      .filter((n) => /^(Office|Desk drawer|Cable box)/.test(n));
    expect(links.indexOf('Desk drawer')).toBeLessThan(links.findIndex((n) => /^Cable box/.test(n)));
  });

  it('reads A to Z with numbers in order, and shows at most 50 boxes, then "+N boxes"', async () => {
    const state = ownerScenario();
    addBoxes(state, P.shelves, 'Crate', 52);
    await renderApp(`/p/${P.shelves}`, { state });
    await findHeading('Shelves');
    const crates = (await screen.findAllByRole('link', { name: /^Crate \d+/ })).filter((l) =>
      (l.getAttribute('href') ?? '').startsWith('/t/'),
    );
    const names = [...new Set(crates.map((l) => l.querySelector('bdi')?.textContent ?? ''))];
    expect(names.slice(0, 11)).toEqual([
      'Crate 1',
      'Crate 2',
      'Crate 3',
      'Crate 4',
      'Crate 5',
      'Crate 6',
      'Crate 7',
      'Crate 8',
      'Crate 9',
      'Crate 10',
      'Crate 11',
    ]);
    expect(names).toHaveLength(50);
    const more = screen.getAllByRole('link', { name: '+2 boxes' })[0];
    expect(more).toHaveAttribute('href', `/p/${P.shelves}`);
  });
});

describe('pickers find boxes', () => {
  it('Move offers a box however many things come before it', async () => {
    const state = ownerScenario();
    const base = state.inventory.things.find((x) => x.id === T.phone);
    if (!base) throw new Error('fixture');
    for (let i = 0; i < 230; i++)
      state.inventory.things.push({
        ...base,
        id: newId(),
        shortCode: null,
        name: `Aa spare ${i}`,
        placeId: P.kitchen,
        containerId: null,
        isContainer: false,
      });
    addBoxes(state, P.kitchen, 'Zz crate', 1);
    const { user } = await renderApp(`/t/${T.tv}`, { state });
    await findHeading('Samsung TV, 55″');
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move' }));
    const dialog = await screen.findByRole('dialog');
    const where = within(dialog).getByRole('combobox', { name: 'Room, spot or box' });
    await waitFor(() => expect(where).toBeEnabled());
    await user.clear(where);
    await user.type(where, 'Zz crate');
    // Past the first 200 things by name: found through the server's container filter.
    expect(await screen.findByRole('option', { name: /^Zz crate 1/ })).toBeInTheDocument();
  });

  it('Select → Move can put things into a box', async () => {
    const { user, mock } = await renderApp(`/loc/${IDS.home}`);
    await screen.findByRole('list', { name: 'Contents of Home' });
    await user.click(screen.getByRole('button', { name: 'Select' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Galaxy S23' }));
    await user.click(screen.getByRole('button', { name: 'Move' }));
    const dialog = await screen.findByRole('dialog', { name: 'Move to…' });
    await user.type(within(dialog).getByRole('searchbox', { name: 'Search places' }), 'cable');
    await user.click(await within(dialog).findByRole('radio', { name: /Cable box/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Move here' }));
    await waitFor(() =>
      expect(mock.lastCall('POST', inventoryPaths.move)?.body).toEqual({
        thingIds: [T.phone],
        to: { containerId: T.cableBox },
      }),
    );
    expect(await screen.findByText('Moved to Cable box')).toBeInTheDocument();
  });
});

describe('the Display menu of a place', () => {
  it('says the sort is for things', async () => {
    const { user } = await renderApp(`/p/${P.office}`);
    await findHeading('Office');
    await user.click(await screen.findByRole('button', { name: /^Display options/ }));
    const menu = await screen.findByRole('menu', { name: 'Display options' });
    expect(within(menu).getByText('Things: sort by')).toBeInTheDocument();
  });
});
