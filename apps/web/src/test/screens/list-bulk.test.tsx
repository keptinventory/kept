/**
 * #366 on a location's List and Grid, against the mock server: Shift-click and Shift+Space select
 * every row from the one ticked last, the count is announced, and "Set a field…" stages one value
 * on every selected thing behind "Save N changes", saved with each row's version and undone
 * together, as the spreadsheet does.
 */
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { inventoryPaths } from '@/api/inventory/paths';
import { IDS } from '@/api/mock/fixtures';
import { renderApp } from '@/test/app';
import { expectLogicalOnly } from '@/test/render';

vi.setConfig({ testTimeout: 20_000 });

const contents = () => screen.findByRole('list', { name: 'Contents of Home' });
const boxes = () => screen.getAllByRole('checkbox', { name: /^Select / }) as HTMLInputElement[];
const ticked = () => boxes().filter((b) => b.checked);

describe('selecting a range (#366)', () => {
  it('Shift-click selects every row from the one ticked last, and the count is announced', async () => {
    const { user } = await renderApp(`/loc/${IDS.home}`);
    await contents();
    await user.click(screen.getByRole('button', { name: 'Select' }));
    const all = boxes();
    expect(all.length).toBeGreaterThan(3);
    await user.click(all[0] as HTMLInputElement);
    await user.keyboard('{Shift>}');
    await user.click(all[3] as HTMLInputElement);
    await user.keyboard('{/Shift}');
    expect(ticked()).toEqual(all.slice(0, 4));
    expect(screen.getByRole('status')).toHaveTextContent('4 selected');
    expect(screen.getByRole('toolbar', { name: 'Selection' })).toHaveTextContent('4 selected');
    // A plain tick takes one out again, and becomes the anchor.
    await user.click(all[1] as HTMLInputElement);
    expect(ticked()).toHaveLength(3);
  });

  it('Shift+Space does the same from the keyboard', async () => {
    const { user } = await renderApp(`/loc/${IDS.home}`);
    await contents();
    await user.click(screen.getByRole('button', { name: 'Select' }));
    const all = boxes();
    await user.click(all[1] as HTMLInputElement);
    (all[3] as HTMLInputElement).focus();
    await user.keyboard('{Shift>}{ }{/Shift}');
    expect(ticked()).toEqual(all.slice(1, 4));
  });

  it('works on the Grid too, which shows rows while selecting', async () => {
    const { user } = await renderApp(`/loc/${IDS.home}?view=grid`);
    await contents();
    await user.click(screen.getByRole('button', { name: 'Select' }));
    const all = boxes();
    await user.click(all[2] as HTMLInputElement);
    await user.keyboard('{Shift>}');
    await user.click(all[0] as HTMLInputElement);
    await user.keyboard('{/Shift}');
    expect(ticked()).toEqual(all.slice(0, 3));
  });
});

describe('Set a field on a List (#366)', () => {
  it('stages one value on every selected thing, saves them together and undoes them together', async () => {
    const { user, mock } = await renderApp(`/loc/${IDS.home}`);
    await contents();
    await user.click(screen.getByRole('button', { name: 'Select' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Galaxy S23' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Samsung TV, 55″' }));
    const bar = screen.getByRole('toolbar', { name: 'Selection' });
    // The spreadsheet's bar: the host's actions, then Pick up and Print labels.
    expect(within(bar).getByRole('button', { name: 'Set a field…' })).toBeEnabled();
    await user.click(within(bar).getByRole('button', { name: 'Set a field…' }));

    const dialog = await screen.findByRole('dialog', { name: 'Set a field on 2 things' });
    await user.click(within(dialog).getByRole('combobox', { name: 'Field' }));
    await user.click(await screen.findByRole('option', { name: 'Model' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Model' }), 'Gen 2');
    await user.click(within(dialog).getByRole('button', { name: 'Set' }));

    const changes = await screen.findByRole('region', { name: 'Changes' });
    expect(changes).toHaveTextContent('2 changes · on 2 things');
    // Read as sheet rows, by id, to stage them with their versions.
    expect(
      mock.calls.some((c) => c.method === 'GET' && c.path === inventoryPaths.thingsSheet),
    ).toBe(true);
    expect(screen.getAllByText('Not saved yet')).toHaveLength(2);

    await user.click(within(changes).getByRole('button', { name: 'Save 2 changes' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Changes' })).toBeNull());
    const sent = mock.lastCall('POST', inventoryPaths.thingsBulkEdit)?.body as {
      edits: { id: string; rowVersion: number; set: Record<string, unknown> }[];
    };
    expect(sent.edits).toHaveLength(2);
    for (const e of sent.edits) {
      expect(e.set).toEqual({ model: 'Gen 2' });
      expect(e.rowVersion).toEqual(expect.any(Number));
    }
    expect(screen.queryByText('Not saved yet')).toBeNull();

    expect(await screen.findByText('Saved 2 changes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(mock.lastCall('POST', inventoryPaths.undoTogether)).toBeTruthy());
    expectLogicalOnly(bar);
  });

  it('is off offline (it needs the server)', async () => {
    const { user } = await renderApp(`/loc/${IDS.home}`);
    await contents();
    await user.click(screen.getByRole('button', { name: 'Select' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Galaxy S23' }));
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    window.dispatchEvent(new Event('offline'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Set a field…' })).toBeDisabled(),
    );
    vi.restoreAllMocks();
    window.dispatchEvent(new Event('online'));
  });
});
