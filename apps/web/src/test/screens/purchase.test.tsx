/**
 * A thing's purchase from its page (#348): added when it has none, changed with Edit (date, shop,
 * price of one and currency, as Add a thing and the assistant's add_thing take them), a receipt
 * added to the purchase, the line on how that receipt differs from Paperwork, and the viewer and
 * Money-off variants. Against the mock server.
 */
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { INV_IDS } from '@/api/inventory/mock/fixtures';
import { inventoryPaths as p } from '@/api/inventory/paths';
import type { CreatePurchaseBody, UpdatePurchaseBody } from '@/api/inventory/types';
import { IDS, type MockState, ownerScenario } from '@/api/mock/fixtures';
import { lineTotal } from '@/components/things/purchase-sheet';
import { findHeading, renderApp } from '@/test/app';
import { expectLogicalOnly } from '@/test/render';

vi.setConfig({ testTimeout: 20_000 });

const T = INV_IDS.thing;
/** The TV's purchase (fixtures: B.TECH, 18 Jan 2025, EGP 28,999). */
const TV_PURCHASE = p.purchase('01926f00-0000-7000-8000-0000000f0060');

function withHome(patch: (home: MockState['locations'][number]) => void): MockState {
  const s = ownerScenario();
  const home = s.locations.find((l) => l.id === IDS.home);
  if (!home) throw new Error('fixture');
  patch(home);
  return s;
}

/** The section headed Purchase. */
const purchase = async () =>
  (await screen.findByRole('heading', { name: 'Purchase', level: 2 })).closest(
    'section',
  ) as HTMLElement;

describe('a thing’s purchase', () => {
  it('adds one where there is none: date, shop and the price of one', async () => {
    const { user, mock } = await renderApp(`/t/${T.phone}`);
    await findHeading('Galaxy S23');
    const section = await purchase();
    expect(within(section).getByText(/No purchase recorded/)).toBeInTheDocument();
    await user.click(within(section).getByRole('button', { name: 'Add the purchase' }));
    const sheet = await screen.findByRole('dialog', {
      name: 'Add the purchase of Galaxy S23',
    });
    await user.type(within(sheet).getByRole('combobox', { name: 'Shop' }), 'Amazon');
    await user.click(await screen.findByRole('option', { name: 'Amazon.eg' }));
    await user.type(within(sheet).getByLabelText('Price of one'), '٣٬٤٠٠');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mock.lastCall('POST', p.purchases)).toBeDefined());
    const sent = mock.lastCall('POST', p.purchases)?.body as CreatePurchaseBody;
    expect(sent).toMatchObject({
      locationId: IDS.home,
      vendorId: INV_IDS.vendor.amazon,
      currency: 'EGP',
      total: '3400',
      lines: [{ description: 'Galaxy S23', quantity: 1, unitPrice: '3400', thingId: T.phone }],
    });
    expect(sent.purchasedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await screen.findByText('Purchase saved')).toBeInTheDocument();
    const after = await purchase();
    expect(await within(after).findByText('Amazon.eg')).toBeInTheDocument();
    expect(within(after).getByText('EGP 3,400.00')).toBeInTheDocument();
  });

  it('changes the price and date of one it has, sending every line back by id', async () => {
    const { user, mock } = await renderApp(`/t/${T.tv}`);
    await findHeading('Samsung TV, 55″');
    const section = await purchase();
    await user.click(within(section).getByRole('button', { name: 'Edit the purchase' }));
    const sheet = await screen.findByRole('dialog', { name: 'Purchase of Samsung TV, 55″' });
    const price = within(sheet).getByLabelText('Price of one');
    await waitFor(() => expect(price).toHaveValue('28999.00'));
    await user.clear(price);
    await user.type(price, '27500');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mock.lastCall('PATCH', TV_PURCHASE)).toBeDefined());
    const call = mock.lastCall('PATCH', TV_PURCHASE);
    const body = call?.body as UpdatePurchaseBody;
    expect(call?.headers?.['if-match']).toBe('1');
    expect(body.lines).toEqual([{ id: expect.any(String), unitPrice: '27500' }]);
    expect(body.total).toBe('27500');
    expect(body).not.toHaveProperty('purchasedOn');
    expect(body).not.toHaveProperty('vendorId');
    expect(await within(await purchase()).findByText('EGP 27,500.00')).toBeInTheDocument();
  });

  it('with Money off, changes the shop and date only, and never sends a price', async () => {
    const s = withHome((h) =>
      Object.assign(h, { modules: h.modules.filter((m) => m !== 'money') }),
    );
    const { user, mock } = await renderApp(`/t/${T.tv}`, { state: s });
    await findHeading('Samsung TV, 55″');
    const section = await purchase();
    await user.click(within(section).getByRole('button', { name: 'Edit the purchase' }));
    const sheet = await screen.findByRole('dialog', { name: 'Purchase of Samsung TV, 55″' });
    expect(within(sheet).queryByLabelText('Price of one')).toBeNull();
    const shop = within(sheet).getByRole('combobox', { name: 'Shop' });
    await waitFor(() => expect(shop).toHaveValue('B.TECH'));
    await user.clear(shop);
    await user.type(shop, 'Amazon');
    await user.click(await screen.findByRole('option', { name: 'Amazon.eg' }));
    await waitFor(() => expect(shop).toHaveValue('Amazon.eg'));
    await user.tab();
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mock.lastCall('PATCH', TV_PURCHASE)).toBeDefined());
    const body = mock.lastCall('PATCH', TV_PURCHASE)?.body as UpdatePurchaseBody;
    expect(body).toEqual({ vendorId: INV_IDS.vendor.amazon });
  });

  it('says how its receipts differ from a receipt under Paperwork, and adds one', async () => {
    await renderApp(`/t/${T.tv}`);
    await findHeading('Samsung TV, 55″');
    const section = await purchase();
    expect(within(section).getByText(/These are the purchase’s receipts/)).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: /Add a receipt/ })).toBeInTheDocument();
  });

  const viewer = (s: MockState = ownerScenario()) => {
    const home = s.locations.find((l) => l.id === IDS.home);
    if (home) home.role = 'viewer';
    return s;
  };

  it('a viewer reads it, with no Edit', async () => {
    await renderApp(`/t/${T.tv}`, { state: viewer() });
    await findHeading('Samsung TV, 55″');
    const section = await purchase();
    expect(within(section).getByText('B.TECH')).toBeInTheDocument();
    expect(within(section).queryByRole('button', { name: 'Edit the purchase' })).toBeNull();
  });

  it('a viewer sees no empty Purchase section', async () => {
    await renderApp(`/t/${T.phone}`, { state: viewer() });
    await findHeading('Galaxy S23');
    expect(screen.queryByRole('heading', { name: 'Purchase', level: 2 })).toBeNull();
  });

  it('reads right to left in Arabic, with logical CSS only', async () => {
    const { user } = await renderApp(`/t/${T.phone}`, { locale: 'ar' });
    await screen.findByRole('heading', { level: 1 });
    expect(document.documentElement.dir).toBe('rtl');
    const add = await screen.findByRole('button', { name: 'أضف الشراء' });
    await user.click(add);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expectLogicalOnly();
  });
});

describe('lineTotal', () => {
  it('multiplies exactly', () => {
    expect(lineTotal('1250.5', 2)).toBe('2501');
    expect(lineTotal('0.3333', 3)).toBe('0.9999');
    expect(lineTotal('28999', 1)).toBe('28999');
    expect(lineTotal('19.99', 0)).toBe('19.99');
    expect(lineTotal('12.5', 2.5)).toBe('31.25');
    expect(lineTotal('0.0001', 0.5)).toBe('0.0001');
  });
});
