/**
 * A place's Manage section and the places inside it: "Turn places into boxes…" (Select all, one
 * step, one Undo that sends every event together) and "Order of the places here" (A to Z or Custom
 * order, Move up / Move down from the keyboard), against the mock server.
 */
import { newId } from '@kept/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { INV_IDS } from '@/api/inventory/mock/fixtures';
import { inventoryPaths as p } from '@/api/inventory/paths';
import { type MockState, ownerScenario } from '@/api/mock/fixtures';
import { findHeading, renderApp } from '@/test/app';

const P = INV_IDS.place;

/** Places named `names` inside `parentId`, cloned from the fixture's Shelves. */
function addPlaces(state: MockState, parentId: string, names: string[]): Record<string, string> {
  const base = state.inventory.places.find((x) => x.id === P.shelves);
  if (!base) throw new Error('fixture');
  const ids: Record<string, string> = {};
  for (const name of names) {
    const id = newId();
    ids[name] = id;
    state.inventory.places.push({ ...base, id, name, parentId, shortCode: null, sort: 0 });
  }
  return ids;
}

function scenario() {
  const state = ownerScenario();
  const ids = addPlaces(state, P.toolWall, ['Bin 10', 'Bin 2', 'Rack', 'Bin 1']);
  addPlaces(state, ids.Rack as string, ['Rack shelf']);
  return { state, ids };
}

/** "Move Bin 1 down", the name isolated as user text. */
const moveName = (name: string, direction: 'up' | 'down') =>
  new RegExp(`^Move \\W?${name}\\W? ${direction}$`);

const region = () => screen.getByRole('region', { name: 'Notifications' });

describe('Turn places into boxes', () => {
  it('turns every place without places inside into a box in one step, and one Undo brings them back', async () => {
    const { state, ids } = scenario();
    const { user, mock } = await renderApp(`/p/${P.toolWall}`, { state });
    await findHeading('Tool wall');
    // A place with places inside isn't one box: its own "Turn into a box" is not offered.
    expect(screen.queryByRole('button', { name: /^Turn into a box/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: /^Turn places into boxes…/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Turn places into boxes' });

    const rows = within(dialog).getByRole('list', { name: /^Places inside \W?Tool wall\W?$/ });
    const names = within(rows)
      .getAllByRole('checkbox')
      .map((c) => c.closest('label')?.querySelector('bdi')?.textContent);
    expect(names).toEqual(['Bin 1', 'Bin 2', 'Bin 10', 'Rack']);
    expect(within(rows).getByRole('checkbox', { name: /^Rack/ })).toBeDisabled();
    expect(within(dialog).getByText('It has places inside: move them out first')).toBeVisible();

    await user.click(within(dialog).getByRole('checkbox', { name: 'Select all' }));
    expect(within(dialog).getByText('3 chosen')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Turn 3 places into boxes' }));

    expect(await within(region()).findByText('Turned 3 places into boxes')).toBeVisible();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const placeIds = mock.state.inventory.places.map((x) => x.id);
    for (const n of ['Bin 1', 'Bin 2', 'Bin 10']) {
      expect(placeIds).not.toContain(ids[n]);
      expect(mock.state.inventory.things.find((x) => x.id === ids[n])?.isContainer).toBe(true);
    }
    expect(placeIds).toContain(ids.Rack);
    const sent = mock.calls.find((c) => c.path === p.placeConvertChildren(P.toolWall));
    expect((sent?.body as { placeIds?: string[] } | undefined)?.placeIds?.sort()).toEqual(
      [ids['Bin 1'], ids['Bin 2'], ids['Bin 10']].sort(),
    );

    await user.click(within(region()).getByRole('button', { name: 'Undo' }));
    expect(await within(region()).findByText('Undone')).toBeVisible();
    const together = mock.calls.filter((c) => c.path === p.undoTogether);
    expect(together).toHaveLength(1);
    expect((together[0]?.body as { eventIds?: string[] } | undefined)?.eventIds).toHaveLength(3);
    for (const n of ['Bin 1', 'Bin 2', 'Bin 10'])
      expect(mock.state.inventory.places.some((x) => x.id === ids[n])).toBe(true);
    expect(mock.state.inventory.things.some((x) => x.id === ids['Bin 1'])).toBe(false);
  });

  it('a search narrows what Select all ticks', async () => {
    const { state } = scenario();
    const { user } = await renderApp(`/p/${P.toolWall}`, { state });
    await findHeading('Tool wall');
    await user.click(screen.getByRole('button', { name: /^Turn places into boxes…/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Turn places into boxes' });
    await user.type(within(dialog).getByRole('searchbox', { name: 'Search places' }), 'Bin 1');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Select all' }));
    expect(within(dialog).getByRole('button', { name: 'Turn 2 places into boxes' })).toBeEnabled();
  });
});

describe('Order of the places here', () => {
  it('switches to Custom order and moves a place with the keyboard; A to Z keeps the order', async () => {
    const { state, ids } = scenario();
    const { user, mock } = await renderApp(`/p/${P.toolWall}`, { state });
    await findHeading('Tool wall');
    await user.click(screen.getByRole('button', { name: /^Order of the places here\s*A to Z/ }));
    const dialog = await screen.findByRole('dialog', {
      name: /^Order of the places in \W?Tool wall\W?$/,
    });
    const order = () =>
      within(within(dialog).getByRole('list', { name: /^Places inside \W?Tool wall\W?$/ }))
        .getAllByRole('listitem')
        .map((li) => li.querySelector('bdi')?.textContent);
    expect(order()).toEqual(['Bin 1', 'Bin 2', 'Bin 10', 'Rack']);
    expect(within(dialog).queryByRole('button', { name: /^Move / })).toBeNull();

    // The keyboard only: the radio group, then Tab to a row's Move down.
    within(dialog).getByRole('radio', { name: 'A to Z' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(
      await within(dialog).findByRole('button', { name: moveName('Bin 1', 'down') }),
    ).toBeVisible();
    expect(mock.state.inventory.places.find((x) => x.id === P.toolWall)?.childOrder).toBe('custom');
    expect(within(dialog).getByRole('button', { name: moveName('Bin 1', 'up') })).toBeDisabled();
    within(dialog)
      .getByRole('button', { name: moveName('Bin 1', 'down') })
      .focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(order()).toEqual(['Bin 2', 'Bin 1', 'Bin 10', 'Rack']));
    // Focus stays on the place that moved, and where it went is said.
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(dialog).getByRole('button', { name: moveName('Bin 1', 'down') }),
      ),
    );
    expect(within(dialog).getByRole('status')).toHaveTextContent(/Bin 1\W? moved to 2 of 4/);
    await user.keyboard('{Enter}');
    await waitFor(() => expect(order()).toEqual(['Bin 2', 'Bin 10', 'Bin 1', 'Rack']));

    // Back to A to Z: the order is kept, and Custom order brings it back.
    within(dialog).getByRole('radio', { name: 'Custom order' }).focus();
    await user.keyboard('{ArrowLeft}');
    await waitFor(() => expect(order()).toEqual(['Bin 1', 'Bin 2', 'Bin 10', 'Rack']));
    const sortOf = (n: string) => mock.state.inventory.places.find((x) => x.id === ids[n])?.sort;
    expect([sortOf('Bin 2'), sortOf('Bin 10'), sortOf('Bin 1'), sortOf('Rack')]).toEqual([
      0, 1, 2, 3,
    ]);
    within(dialog).getByRole('radio', { name: 'A to Z' }).focus();
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(order()).toEqual(['Bin 2', 'Bin 10', 'Bin 1', 'Rack']));
  });
});
