/**
 * Furniture's compartments on its page (#238, 1.14.4): the grid as it stands, Turn it (which way,
 * then Renumber or Keep the codes, asked every time), Merge or split, each one Undo. Against the
 * mock server, which runs the same rules (packages/shared compartments.ts).
 */
import { cellsOf } from '@kept/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { StoredPlace } from '@/api/inventory/mock/db';
import { INV_IDS } from '@/api/inventory/mock/fixtures';
import { inventoryPaths as p } from '@/api/inventory/paths';
import { ownerScenario } from '@/api/mock/fixtures';
import { plainText } from '@/lib/bidi';
import { findHeading, renderApp } from '@/test/app';

const region = () => screen.getByRole('region', { name: 'Notifications' });
/** A toast's sentence, its names' isolate marks aside. */
const said = (sentence: string) => (content: string) => plainText(content) === sentence;

/** A 2 × 4 cube shelf in the office, upright, coded KX01-F{col}{row}. */
function withShelf() {
  const state = ownerScenario();
  const office = state.inventory.places.find((x) => x.id === INV_IDS.place.office) as StoredPlace;
  const blank = (over: Partial<StoredPlace>): StoredPlace => ({
    id: '',
    locationId: office.locationId,
    parentId: office.id,
    name: '',
    kindKey: 'cube',
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
    ...over,
  });
  const id = '01970000-0000-7000-8000-00000000f001';
  state.inventory.places.push(
    blank({
      id,
      name: 'Cube shelf 01',
      kindKey: 'furniture',
      childOrder: 'custom',
      layout: {
        kind: 'grid',
        across: 2,
        up: 4,
        orientation: 'upright',
        compartmentName: 'Cube {n}',
        codePattern: '{parent}-F{col:02}{row:02}',
      },
      ownCodes: ['KX01'],
    }),
    ...cellsOf({ kind: 'grid', across: 2, up: 4 }).map((c) =>
      blank({
        id: `01970000-0000-7000-8000-00000000f1${String(c.n).padStart(2, '0')}`,
        parentId: id,
        name: `Cube ${c.n}`,
        sort: c.n - 1,
        cell: { row: c.row, col: c.col, n: c.n },
        ownCodes: [`KX01-F0${c.col}0${c.row}`],
      }),
    ),
  );
  return { state, id };
}

const grid = () => {
  const list = screen.getByRole('list', { name: 'Compartments' });
  return within(list)
    .getAllByRole('listitem')
    .map(
      (li) =>
        `${li.textContent}@${li.style.gridRow.split(' ')[0]},${li.style.gridColumn.split(' ')[0]}`,
    );
};

describe('a furniture place’s compartments', () => {
  it('shows them as it stands, numbered top left first', async () => {
    const { state, id } = withShelf();
    await renderApp(`/p/${id}`, { state, digits: 'western' });
    await findHeading('Cube shelf 01');
    expect(
      await screen.findByText('2 across, 4 up, counted from the top left, row by row'),
    ).toBeVisible();
    expect(grid()).toEqual([
      '1KX01-F0101@1,1',
      '2KX01-F0201@1,2',
      '3KX01-F0102@2,1',
      '4KX01-F0202@2,2',
      '5KX01-F0103@3,1',
      '6KX01-F0203@3,2',
      '7KX01-F0104@4,1',
      '8KX01-F0204@4,2',
    ]);
    // A compartment opens its own page.
    const list = screen.getByRole('list', { name: 'Compartments' });
    expect(within(list).getByRole('link', { name: 'Cube 3' })).toHaveAttribute(
      'href',
      expect.stringContaining('/p/01970000-0000-7000-8000-00000000f103'),
    );
  });

  it('asks which way it turned and whether to renumber, every time, then one Undo', async () => {
    const { state, id } = withShelf();
    const { user, mock } = await renderApp(`/p/${id}`, { state, digits: 'western' });
    await findHeading('Cube shelf 01');
    await user.click(await screen.findByRole('button', { name: 'Turn it…' }));
    const sheet = await screen.findByRole('dialog', { name: /^Turn/ });
    const go = within(sheet).getByRole('button', { name: 'Turn' });
    // Nothing is chosen for them: both choices are explicit.
    expect(go).toBeDisabled();
    await user.click(within(sheet).getByRole('radio', { name: 'To the right' }));
    expect(go).toBeDisabled();
    // The preview counts the grid as it will stand.
    expect(
      within(sheet).getByText('4 across, 2 up, counted from the top left, row by row'),
    ).toBeVisible();
    await user.click(within(sheet).getByRole('radio', { name: /^Renumber/ }));
    expect(go).toBeEnabled();
    await user.click(go);

    expect(await within(region()).findByText(said('Turned Cube shelf 01'))).toBeVisible();
    expect(mock.lastCall('POST', p.placeTurn(id))?.body).toEqual({
      direction: 'right',
      renumber: true,
    });
    await waitFor(() =>
      expect(
        screen.getByText('4 across, 2 up, counted from the top left, row by row'),
      ).toBeVisible(),
    );
    // Renumbered as it now stands: the old Cube 7 (bottom left upright) is the top left.
    const seven = mock.state.inventory.places.find((x) => x.id.endsWith('f107'));
    expect(seven).toMatchObject({ name: 'Cube 1', cell: { row: 1, col: 1, n: 1 } });
    expect(seven?.ownCodes).toContain('KX01-F0101');

    await user.click(within(region()).getByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(mock.state.inventory.places.find((x) => x.id.endsWith('f107'))?.name).toBe('Cube 7'),
    );
  });

  it('Keep the codes changes only how it stands', async () => {
    const { state, id } = withShelf();
    const { user, mock } = await renderApp(`/p/${id}`, { state, digits: 'western' });
    await findHeading('Cube shelf 01');
    await user.click(await screen.findByRole('button', { name: 'Turn it…' }));
    const sheet = await screen.findByRole('dialog', { name: /^Turn/ });
    await user.click(within(sheet).getByRole('radio', { name: 'To the left' }));
    await user.click(within(sheet).getByRole('radio', { name: /^Keep the codes/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Turn' }));
    expect(
      await within(region()).findByText('The numbers and codes are as they were.'),
    ).toBeVisible();
    const one = mock.state.inventory.places.find((x) => x.id.endsWith('f101'));
    // The top went left: the old top left is the bottom left now, still Cube 1.
    expect(one).toMatchObject({ name: 'Cube 1', cell: { row: 2, col: 1, n: 1 } });
  });

  it('merges compartments side by side into the top left one, and splits them back', async () => {
    const { state, id } = withShelf();
    const { user, mock } = await renderApp(`/p/${id}`, { state, digits: 'western' });
    await findHeading('Cube shelf 01');
    await user.click(await screen.findByRole('button', { name: 'Merge or split…' }));
    const merge = screen.getByRole('button', { name: 'Merge' });
    expect(merge).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Cube 2' }));
    await user.click(screen.getByRole('button', { name: 'Cube 1' }));
    expect(screen.getByRole('button', { name: 'Cube 1' })).toHaveAttribute('aria-pressed', 'true');
    // Cube 1 and Cube 4 aren't side by side: no merge.
    await user.click(screen.getByRole('button', { name: 'Cube 2' }));
    await user.click(screen.getByRole('button', { name: 'Cube 4' }));
    expect(merge).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Cube 4' }));
    await user.click(screen.getByRole('button', { name: 'Cube 2' }));
    expect(merge).toBeEnabled();
    await user.click(merge);

    expect(await within(region()).findByText(said('Merged into Cube 1'))).toBeVisible();
    expect(mock.lastCall('POST', p.placeMergeCompartments(id))?.body).toEqual({
      compartmentIds: [
        '01970000-0000-7000-8000-00000000f101',
        '01970000-0000-7000-8000-00000000f102',
      ],
    });
    await waitFor(() => expect(grid()).toHaveLength(7));
    expect(grid()[0]).toBe('1KX01-F0101@1,1');

    // Split the merged one again.
    await user.click(screen.getByRole('button', { name: 'Merge or split…' }));
    await user.click(screen.getByRole('button', { name: 'Cube 1' }));
    await user.click(screen.getByRole('button', { name: 'Split' }));
    expect(await within(region()).findByText(said('Split Cube 1'))).toBeVisible();
    await waitFor(() => expect(grid()).toHaveLength(8));
  });

  it('prints their labels in counting order', async () => {
    const { state, id } = withShelf();
    await renderApp(`/p/${id}`, { state, digits: 'western' });
    await findHeading('Cube shelf 01');
    const link = await screen.findByRole('link', { name: 'Print their labels' });
    expect(link.getAttribute('href')).toContain('f101%2C01970000-0000-7000-8000-00000000f102');
  });
});
