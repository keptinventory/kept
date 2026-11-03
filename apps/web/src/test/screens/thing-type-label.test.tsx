/**
 * #366 on a thing's page, against the mock server: the type chip opens the type picker, Edit
 * changes the type (a thing with no type just takes one; another type names what will be
 * archived before Save), and the label as it prints, with Print and Download, as a card beside
 * the details from md and behind a Label row on a phone.
 */
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { INV_IDS } from '@/api/inventory/mock/fixtures';
import { inventoryPaths as p } from '@/api/inventory/paths';
import { IDS, type MockState, ownerScenario } from '@/api/mock/fixtures';
import { findHeading, renderApp } from '@/test/app';
import { expectLogicalOnly } from '@/test/render';

vi.setConfig({ testTimeout: 20_000 });

const T = INV_IDS.thing;

/** From `md` up the screen uses tabs; jsdom has no matchMedia, so a test opts in. */
function desktop() {
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
}
afterEach(() => vi.unstubAllGlobals());

/** The kettle with no type at all. */
function untyped(): MockState {
  const s = ownerScenario();
  const kettle = s.inventory.things.find((x) => x.id === T.kettle);
  if (!kettle) throw new Error('fixture');
  Object.assign(kettle, { type: null, fields: [], custom: {} });
  return s;
}

describe('the type chip (#366)', () => {
  it('"No type" opens the type picker, and a type just saves', async () => {
    const { user, mock } = await renderApp(`/t/${T.kettle}`, { state: untyped() });
    await findHeading('Old kettle');
    await user.click(screen.getByRole('button', { name: 'No type, change the type' }));
    const dialog = await screen.findByRole('dialog', { name: 'Choose a type' });
    await user.type(within(dialog).getByRole('combobox', { name: 'Type' }), 'Charg');
    await user.click(await screen.findByRole('option', { name: /^Charger/ }));
    // Nothing to archive: nothing to say.
    expect(within(dialog).queryByText('These values will be archived')).toBeNull();
    expect(within(dialog).queryByText('Every value carries over.')).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(mock.lastCall('POST', p.thingRetype(T.kettle))?.body).toEqual({
        typeId: INV_IDS.type.charger,
      }),
    );
  });

  it('a typed thing opens Change the type', async () => {
    const { user } = await renderApp(`/t/${T.drill}`);
    await findHeading('Bosch drill, 18 V');
    await user.click(screen.getByRole('button', { name: /, change the type$/ }));
    expect(await screen.findByRole('dialog', { name: 'Change the type' })).toBeInTheDocument();
  });

  it('is not a button for a viewer', async () => {
    const s = ownerScenario();
    const home = s.locations.find((l) => l.id === IDS.home);
    if (home) home.role = 'viewer';
    await renderApp(`/t/${T.tv}`, { state: s });
    await findHeading('Samsung TV, 55″');
    expect(screen.getAllByText('TV / display').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /change the type$/ })).toBeNull();
  });
});

describe('the type in Edit (#366)', () => {
  it('names the values another type archives before Save, and saves the type', async () => {
    const { user, mock } = await renderApp(`/t/${T.drill}`);
    await findHeading('Bosch drill, 18 V');
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const form = await screen.findByRole('form', { name: 'Edit Bosch drill, 18 V' });
    const type = within(form).getByRole('combobox', { name: 'Type' });
    await user.clear(type);
    await user.type(type, 'Charg');
    await user.click(await screen.findByRole('option', { name: /^Charger/ }));
    expect(await within(form).findByText('These values will be archived')).toBeInTheDocument();
    expect(within(form).getByText('Voltage, Battery platform')).toBeInTheDocument();
    // The old type's fields leave the form until the new type's arrive.
    expect(within(form).getByText("The new type's own fields show after you save.")).toBeVisible();
    expect(within(form).queryByRole('textbox', { name: /^Voltage/ })).toBeNull();
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(mock.lastCall('PATCH', p.thing(T.drill))?.body).toEqual({
        typeId: INV_IDS.type.charger,
      }),
    );
  });

  it('a thing with no type just takes one, with nothing to say first', async () => {
    const { user, mock } = await renderApp(`/t/${T.kettle}`, { state: untyped() });
    await findHeading('Old kettle');
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const form = await screen.findByRole('form', { name: 'Edit Old kettle' });
    await user.type(within(form).getByRole('combobox', { name: 'Type' }), 'Charg');
    await user.click(await screen.findByRole('option', { name: /^Charger/ }));
    expect(within(form).queryByText('These values will be archived')).toBeNull();
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(mock.lastCall('PATCH', p.thing(T.kettle))?.body).toEqual({
        typeId: INV_IDS.type.charger,
      }),
    );
  });
});

describe('the label as it prints (#366)', () => {
  it('is a card beside the details from md, with Print and Download', async () => {
    desktop();
    await renderApp(`/t/${T.tv}`);
    await findHeading('Samsung TV, 55″');
    const label = await screen.findByRole('img', { name: 'The label as it prints: 5MT0QD' });
    // The print sheet's own cell: the code as it prints, and the name.
    expect(label.querySelector('[data-slot="label-code"]')).toHaveTextContent('5MT‑0QD');
    expect(label.querySelector('[data-slot="label-name"]')).toHaveTextContent('Samsung TV');
    const card = label.closest('section') as HTMLElement;
    const print = within(card).getByRole('link', { name: 'Print' });
    const url = new URL(print.getAttribute('href') ?? '', 'http://x');
    expect(url.pathname).toBe('/labels');
    expect(Object.fromEntries(url.searchParams)).toEqual({ loc: IDS.home, things: T.tv });
    expect(within(card).getByRole('button', { name: 'Download' })).toBeInTheDocument();
    // No Label row in the details: the card is it.
    expect(screen.queryByRole('button', { name: 'Show the label' })).toBeNull();
    expectLogicalOnly(card);
  });

  it('on a phone, a Label row in Details opens the same preview', async () => {
    const { user } = await renderApp(`/t/${T.tv}`);
    await findHeading('Samsung TV, 55″');
    expect(screen.queryByRole('img', { name: /^The label as it prints/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Show the label' }));
    const dialog = await screen.findByRole('dialog', { name: 'Label' });
    expect(
      await within(dialog).findByRole('img', { name: 'The label as it prints: 5MT0QD' }),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Print' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Download' })).toBeInTheDocument();
  });

  it('is not offered where Labels is off', async () => {
    desktop();
    const s = ownerScenario();
    const home = s.locations.find((l) => l.id === IDS.home);
    if (home) Object.assign(home, { preset: 'essentials', modules: [] });
    await renderApp(`/t/${T.tv}`, { state: s });
    await findHeading('Samsung TV, 55″');
    expect(screen.queryByRole('img', { name: /^The label as it prints/ })).toBeNull();
  });
});
