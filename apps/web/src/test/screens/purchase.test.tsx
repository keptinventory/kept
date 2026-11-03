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
import { err } from '@/api/mock/kit';
import { lineTotal } from '@/components/things/purchase-sheet';
import { nameOfFile } from '@/components/things/upload';
import { findHeading, renderApp } from '@/test/app';
import { expectLogicalOnly } from '@/test/render';

vi.setConfig({ testTimeout: 20_000 });

/** From `md` up the thing page uses tabs; jsdom has no matchMedia, so a test opts in. */
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

const T = INV_IDS.thing;
/** The TV's purchase (fixtures: B.TECH, 18 Jan 2025, EGP 28,999). */
const TV_PURCHASE = p.purchase('01926f00-0000-7000-8000-0000000f0060');
/** The editor's title: the thing's name isolated (lib/bidi.ts), so an Arabic name keeps its place. */
const TV_SHEET = 'Purchase of \u2068Samsung TV, 55″\u2069';

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
      name: 'Add the purchase of \u2068Galaxy S23\u2069',
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
    const sheet = await screen.findByRole('dialog', { name: TV_SHEET });
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
    const sheet = await screen.findByRole('dialog', { name: TV_SHEET });
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

/** The TV's purchase with a named receipt, which is also under the TV's Paperwork. */
function withReceipt(also = true): MockState {
  const s = ownerScenario();
  const tv = s.inventory.things.find((x) => x.id === T.tv);
  if (!tv?.purchase) throw new Error('fixture');
  const receipt = {
    id: '0190a000-0000-7000-8000-0000000f3480',
    role: 'receipt' as const,
    sort: 0,
    file: null,
    url: 'https://example.com/btech.pdf',
    subject: { purchaseId: tv.purchase.purchaseId ?? '' },
    name: 'B.TECH invoice 4471',
    createdBy: { displayName: 'Bruce' },
    rowVersion: 1,
    ...(also ? { alsoInPaperwork: true as const } : {}),
  };
  tv.purchase.receipts = [receipt];
  s.inventory.attachments.push({ ...receipt, locationId: IDS.home });
  return s;
}

describe('the purchase editor, everything the purchase routes allow (#348)', () => {
  it('in the thing’s Edit mode the purchase is editable too: its line on the receipt', async () => {
    desktop();
    const { user, mock } = await renderApp(`/t/${T.tv}?tab=details`);
    await findHeading('Samsung TV, 55″');
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await screen.findByRole('form', { name: 'Edit Samsung TV, 55″' });
    await user.click(within(await purchase()).getByRole('button', { name: 'Edit the purchase' }));
    const sheet = await screen.findByRole('dialog', { name: TV_SHEET });
    const onReceipt = within(sheet).getByLabelText('On the receipt');
    expect(onReceipt).toHaveValue('Samsung 55" QLED');
    await user.clear(onReceipt);
    await user.type(onReceipt, 'QE55Q60B, 55 inch');
    await user.type(within(sheet).getByLabelText('Tax'), '3500');
    await user.type(within(sheet).getByLabelText('Purchase notes'), 'Delivered free');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mock.lastCall('PATCH', TV_PURCHASE)).toBeDefined());
    expect(mock.lastCall('PATCH', TV_PURCHASE)?.body).toEqual({
      notes: 'Delivered free',
      lines: [{ id: expect.any(String), description: 'QE55Q60B, 55 inch' }],
      tax: '3500',
    });
    expect(await within(await purchase()).findByText('QE55Q60B, 55 inch')).toBeInTheDocument();
  });

  it('shows a receipt by its name, says when it is also in Paperwork, and why', async () => {
    await renderApp(`/t/${T.tv}`, { state: withReceipt() });
    await findHeading('Samsung TV, 55″');
    const section = await purchase();
    expect(
      within(section).getByRole('button', { name: /B.TECH invoice 4471/ }),
    ).toBeInTheDocument();
    expect(within(section).queryByText('Receipt 1')).toBeNull();
    expect(within(section).getByText('Also in Paperwork')).toBeInTheDocument();
    expect(within(section).getByText(/These are the purchase’s receipts/)).toBeInTheDocument();
  });

  it('removes a receipt from the purchase in the editor', async () => {
    const { user, mock } = await renderApp(`/t/${T.tv}`, { state: withReceipt(false) });
    await findHeading('Samsung TV, 55″');
    await user.click(within(await purchase()).getByRole('button', { name: 'Edit the purchase' }));
    const sheet = await screen.findByRole('dialog', { name: TV_SHEET });
    const receipts = await within(sheet).findByRole('group', { name: 'Receipts' });
    expect(within(receipts).getByText('B.TECH invoice 4471')).toBeInTheDocument();
    expect(within(receipts).getByRole('button', { name: 'Replace' })).toBeInTheDocument();
    expect(within(receipts).getByRole('button', { name: /Add a receipt/ })).toBeInTheDocument();
    await user.click(within(receipts).getByRole('button', { name: 'Remove B.TECH invoice 4471' }));
    const ask = await screen.findByRole('alertdialog');
    await user.click(within(ask).getByRole('button', { name: 'Remove' }));
    await waitFor(() =>
      expect(
        mock.calls.some(
          (c) =>
            c.method === 'DELETE' &&
            c.path === p.attachment('0190a000-0000-7000-8000-0000000f3480'),
        ),
      ).toBe(true),
    );
  });

  it('removes a purchase that is the thing’s alone', async () => {
    const { user, mock } = await renderApp(`/t/${T.tv}`);
    await findHeading('Samsung TV, 55″');
    await user.click(within(await purchase()).getByRole('button', { name: 'Edit the purchase' }));
    const sheet = await screen.findByRole('dialog', { name: TV_SHEET });
    await within(sheet).findByLabelText('On the receipt');
    await user.click(within(sheet).getByRole('button', { name: 'Remove' }));
    const ask = await screen.findByRole('alertdialog', { name: 'Remove this purchase?' });
    await user.click(within(ask).getByRole('button', { name: 'Remove' }));
    await waitFor(() =>
      expect(mock.calls.some((c) => c.method === 'DELETE' && c.path === TV_PURCHASE)).toBe(true),
    );
    expect(
      await within(await purchase()).findByRole('button', { name: 'Add the purchase' }),
    ).toBeInTheDocument();
  });

  it('offers no empty Purchase section where the Money module is off', async () => {
    const s = withHome((h) =>
      Object.assign(h, { modules: h.modules.filter((m) => m !== 'money') }),
    );
    await renderApp(`/t/${T.phone}`, { state: s });
    await findHeading('Galaxy S23');
    expect(screen.queryByRole('heading', { name: 'Purchase', level: 2 })).toBeNull();
  });
});

describe('the purchase editor, from the 1.14.4 review', () => {
  it('renaming a receipt with Enter saves the name only, and the purchase stays open unsaved', async () => {
    const { user, mock } = await renderApp(`/t/${T.tv}`, { state: withReceipt(false) });
    await findHeading('Samsung TV, 55″');
    await user.click(within(await purchase()).getByRole('button', { name: 'Edit the purchase' }));
    const sheet = await screen.findByRole('dialog', { name: TV_SHEET });
    const price = within(sheet).getByLabelText('Price of one');
    await waitFor(() => expect(price).toHaveValue('28999.00'));
    await user.clear(price);
    await user.type(price, '27500');
    const receipts = await within(sheet).findByRole('group', { name: 'Receipts' });
    await user.click(within(receipts).getByRole('button', { name: 'Name B.TECH invoice 4471' }));
    const rename = await screen.findByRole('dialog', { name: 'Name B.TECH invoice 4471' });
    const name = within(rename).getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'TV invoice{Enter}');
    await waitFor(() =>
      expect(
        mock.lastCall('PATCH', p.attachment('0190a000-0000-7000-8000-0000000f3480')),
      ).toBeDefined(),
    );
    expect(await screen.findByText(/^Named/)).toBeInTheDocument();
    expect(mock.lastCall('PATCH', TV_PURCHASE)).toBeUndefined();
    const still = screen.getByRole('dialog', { name: TV_SHEET });
    expect(within(still).getByLabelText('Price of one')).toHaveValue('27500');
  });

  it('after someone else saved first (412), reads the purchase again so the next Save works', async () => {
    const { user, mock } = await renderApp(`/t/${T.tv}`);
    await findHeading('Samsung TV, 55″');
    await user.click(within(await purchase()).getByRole('button', { name: 'Edit the purchase' }));
    const sheet = await screen.findByRole('dialog', { name: TV_SHEET });
    const price = within(sheet).getByLabelText('Price of one');
    await waitFor(() => expect(price).toHaveValue('28999.00'));
    // Alfred saves the purchase while mine is open.
    const theirs = mock.state.inventory.purchases.find((x) => p.purchase(x.id) === TV_PURCHASE);
    if (!theirs) throw new Error('fixture');
    theirs.rowVersion += 1;
    await user.clear(price);
    await user.type(price, '27500');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await within(sheet).findByText(/changed since you opened it/)).toBeInTheDocument();
    expect(mock.lastCall('PATCH', TV_PURCHASE)?.headers?.['if-match']).toBe('1');
    await waitFor(() =>
      expect(mock.calls.filter((c) => c.method === 'GET' && c.path === TV_PURCHASE)).toHaveLength(
        2,
      ),
    );
    expect(price).toHaveValue('27500');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Purchase saved')).toBeInTheDocument();
    expect(mock.lastCall('PATCH', TV_PURCHASE)?.headers?.['if-match']).toBe('2');
  });

  it('says why Remove failed when the purchase can’t be read', async () => {
    const { user } = await renderApp(`/t/${T.tv}`, {
      setup: (mock) =>
        mock.on('GET', p.purchase(':id'), () => err(500, 'internal', 'The disk is full.')),
    });
    await findHeading('Samsung TV, 55″');
    await user.click(within(await purchase()).getByRole('button', { name: 'Edit the purchase' }));
    const sheet = await screen.findByRole('dialog', { name: TV_SHEET });
    await user.click(within(sheet).getByRole('button', { name: 'Remove' }));
    expect(await within(sheet).findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('isolates the thing’s name in the sheet’s title', async () => {
    const { user } = await renderApp(`/t/${T.tv}`);
    await findHeading('Samsung TV, 55″');
    await user.click(within(await purchase()).getByRole('button', { name: 'Edit the purchase' }));
    const sheet = await screen.findByRole('dialog', { name: TV_SHEET });
    expect(within(sheet).getByRole('heading', { name: TV_SHEET }).textContent).toBe(TV_SHEET);
  });
});

describe('nameOfFile', () => {
  it('keeps a file’s own name, without its extension', () => {
    expect(nameOfFile({ name: 'Insurance 2026.pdf' })).toBe('Insurance 2026');
    expect(nameOfFile({ name: 'scan.2026.10.jpeg' })).toBe('scan.2026.10');
    expect(nameOfFile({ name: '.pdf' })).toBeUndefined();
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
