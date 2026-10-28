/**
 * Log a service with the invoice read, and a vehicle's Services tab: attaching an
 * invoice makes a draft whose suggestions Confirm all takes into the lines; Completes pre-ticks
 * the schedule a line matches; Save confirms the draft with If-Match; a bare `$` asks which
 * dollars with neither chosen; a draft lists first with Finish logging and Discard draft; a saved
 * service opens to all of it (#296), with Edit (only what changed, If-Match) and Delete with Undo
 * for those who may change it, and neither for a viewer; the offline variant; RTL.
 */
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { hh } from '@/api/household/mock/db';
import { householdPaths } from '@/api/household/paths';
import { INV_IDS } from '@/api/inventory/mock/fixtures';
import { IDS, ownerScenario } from '@/api/mock/fixtures';
import { ensureVehiclesSeeded, VEHICLE_IDS } from '@/api/vehicles/mock';
import { setNextInvoiceRead } from '@/api/vehicles/mock/service-drafts';
import { vehiclePaths } from '@/api/vehicles/paths';
import { renderApp } from '@/test/app';
import { expectLogicalOnly } from '@/test/render';

// The vehicle page mounts the Services tab through its slots (components/vehicles/slots.tsx);
// this test mounts whatever that line says today.
vi.mock('@/components/vehicles/slots', async (original) => ({
  ...(await original<typeof import('@/components/vehicles/slots')>()),
  VehicleServices: (await import('@/components/vehicles/services-tab')).VehicleServices,
}));

// The vehicle tabs load on demand (components/vehicles/vehicle-lazy.tsx). Loaded once here, so a
// cold module graph on a busy machine (the full suite) isn't spent from the tests' own waits for
// the Services tab: the first two tests timed out on "Log a service" that way.
beforeAll(async () => {
  await import('@/components/vehicles/vehicle-sections');
  await import('@/components/services/service-sheet');
}, 120_000);

afterEach(() => {
  vi.restoreAllMocks();
  window.dispatchEvent(new Event('online'));
});

const CAR = INV_IDS.thing.car;
const BRAKES = VEHICLE_IDS.serviceRecord.brakePads;

/** A saved service's row on the Services tab, which opens it. */
const findService = (name: RegExp) => screen.findByRole('button', { name }, { timeout: 10_000 });

function aiState() {
  const state = ownerScenario();
  ensureVehiclesSeeded(state);
  const garage = state.locations.find((l) => l.id === IDS.garage);
  if (garage) garage.providerResolved = true;
  return state;
}

async function openLogService(state = aiState()) {
  const r = await renderApp(`/t/${CAR}?tab=services`, { state });
  const tab = await screen.findByRole('button', { name: 'Log a service' }, { timeout: 10_000 });
  await r.user.click(tab);
  const sheet = within(await screen.findByRole('dialog', { name: 'Log a service' }));
  return { ...r, sheet };
}

async function attachInvoice(
  user: Awaited<ReturnType<typeof renderApp>>['user'],
  name = 'invoice.jpg',
) {
  const inputs = document.querySelectorAll<HTMLInputElement>('[role="dialog"] input[type="file"]');
  // The invoice's picker is the one that takes PDFs.
  const input = [...inputs].find((i) => i.accept.includes('application/pdf'));
  if (!input) throw new Error('no invoice input');
  await user.upload(input, new File(['jpeg'], name, { type: 'image/jpeg' }));
}

describe('the invoice read by AI', () => {
  it('makes a draft, Confirm all fills the lines, Completes pre-ticks by the line, Save confirms', async () => {
    const { user, mock, sheet } = await openLogService();
    await attachInvoice(user);
    expect(
      await sheet.findByText('Read by AI: 3 lines, total matches', {}, { timeout: 10_000 }),
    ).toBeInTheDocument();
    const draftCall = mock.lastCall('POST', vehiclePaths.serviceDrafts);
    expect(draftCall?.headers?.['idempotency-key']).toMatch(/^draft:/);
    const group = within(
      sheet.getByRole('group', { name: 'Suggested line items from the invoice' }),
    );
    expect(group.getByText('Oil filter')).toBeInTheDocument();
    // A suggested line already matches the schedule: pre-ticked, and it says which line.
    const oil = sheet.getByRole('checkbox', { name: /Oil & filter/ });
    expect(oil).toBeChecked();
    expect(sheet.getByText(/Matches “Oil filter”/)).toBeInTheDocument();
    await user.click(group.getByRole('button', { name: 'Confirm all' }));
    expect(
      sheet.getAllByRole('textbox', { name: 'What' }).map((x) => (x as HTMLInputElement).value),
    ).toEqual(['Engine oil 5W-30', 'Oil filter', 'Labour']);
    await user.click(sheet.getByRole('button', { name: 'Save' }));
    // The toast, and its Undo of the confirm (the write's audit event).
    expect((await screen.findAllByText('Service logged')).length).toBeGreaterThan(0);
    expect(await screen.findByRole('button', { name: 'Undo' })).toBeInTheDocument();
    const id = (draftCall?.body as { id: string } | undefined)?.id ?? '';
    const confirm = mock.lastCall('POST', vehiclePaths.serviceRecordConfirm(id));
    expect(confirm?.headers?.['if-match']).toBeTruthy();
    expect(confirm?.body).toMatchObject({
      total: '2250',
      currency: 'EGP',
      completes: [VEHICLE_IDS.schedule.oilFilter],
    });
    expect((confirm?.body as { lines?: unknown[] } | undefined)?.lines).toHaveLength(3);
  });

  it('a bare $ asks USD or CAD, with neither chosen', async () => {
    const state = aiState();
    setNextInvoiceRead(state, 'dollar');
    const { user, mock, sheet } = await openLogService(state);
    await attachInvoice(user);
    expect(
      await sheet.findByText(
        'The invoice shows $. Is it US dollars or Canadian dollars?',
        {},
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument();
    const usd = sheet.getByRole('button', { name: 'US dollars (USD)' });
    const cad = sheet.getByRole('button', { name: 'Canadian dollars (CAD)' });
    expect(usd).toHaveAttribute('aria-pressed', 'false');
    expect(cad).toHaveAttribute('aria-pressed', 'false');
    await user.click(sheet.getByRole('button', { name: 'Confirm all' }));
    await user.click(sheet.getByRole('button', { name: 'Save' }));
    expect(await sheet.findByText('A price needs a currency.')).toBeInTheDocument();
    await user.click(usd);
    await user.click(sheet.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(
        mock.calls.find((c) => c.method === 'POST' && c.path.endsWith('/confirm'))?.body,
      ).toMatchObject({ currency: 'USD' }),
    );
  });

  it('says it is reading while the extraction runs', async () => {
    const state = aiState();
    setNextInvoiceRead(state, 'reading');
    const { user, sheet } = await openLogService(state);
    await attachInvoice(user);
    expect(
      await sheet.findByText('Reading the invoice…', {}, { timeout: 10_000 }),
    ).toBeInTheDocument();
  });
});

describe('the Services tab', () => {
  it('lists a draft first, with Finish logging and Discard draft', async () => {
    const state = aiState();
    const first = await openLogService(state);
    await attachInvoice(first.user);
    await first.sheet.findByText('Read by AI: 3 lines, total matches', {}, { timeout: 10_000 });
    await first.user.click(first.sheet.getByRole('button', { name: 'Cancel' }));
    // The tab's list is the one with the drafts' actions (the Overview's card lists services too).
    const finish = await screen.findByRole(
      'button',
      { name: 'Finish logging' },
      { timeout: 10_000 },
    );
    const list = finish.closest('ul') as HTMLElement;
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('Draft');
    const row = within(within(list).getAllByRole('listitem')[0] as HTMLElement);
    expect(row.getByRole('button', { name: 'Discard draft' })).toBeInTheDocument();
    await first.user.click(row.getByRole('button', { name: 'Finish logging' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Log a service' }));
    expect(await sheet.findByText('Read by AI: 3 lines, total matches')).toBeInTheDocument();
  });

  it('opens a saved service: all of it, notes included', async () => {
    const state = aiState();
    const pads = hh(state).serviceRecords.find((r) => r.id === BRAKES);
    if (pads) pads.notes = 'The left pad squeaked before.';
    const { user } = await renderApp(`/t/${CAR}?tab=services`, { state });
    await user.click(await findService(/Front brake pads/));
    const sheet = within(await screen.findByRole('dialog', { name: 'Service' }));
    expect(await sheet.findByText('The left pad squeaked before.')).toBeInTheDocument();
    for (const text of ['Front brake pads', 'Brake disc skim', 'City Service Centre', 'Bruce'])
      expect(sheet.getAllByText(text, { exact: false }).length).toBeGreaterThan(0);
    expect(sheet.getByText(/51,392/)).toBeInTheDocument();
    expect(sheet.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(sheet.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('edits a saved service: the form is filled in, Save sends what changed with If-Match', async () => {
    const state = aiState();
    const pads = hh(state).serviceRecords.find((r) => r.id === BRAKES);
    if (pads) pads.notes = 'Squeaked.';
    const { user, mock } = await renderApp(`/t/${CAR}?tab=services`, { state });
    await user.click(await findService(/Front brake pads/));
    const view = within(await screen.findByRole('dialog', { name: 'Service' }));
    await user.click(view.getByRole('button', { name: 'Edit' }));
    const form = within(await screen.findByRole('dialog', { name: 'Edit the service' }));
    expect(
      form.getAllByRole('textbox', { name: 'What' }).map((x) => (x as HTMLInputElement).value),
    ).toEqual(['Front brake pads', 'Brake disc skim', 'Labour']);
    const notes = form.getByRole('textbox', { name: 'Notes' });
    expect(notes).toHaveValue('Squeaked.');
    await user.clear(notes);
    await user.type(notes, 'Squeaked, now quiet.');
    await user.click(form.getByRole('button', { name: 'Save' }));
    expect((await screen.findAllByText('Service changed')).length).toBeGreaterThan(0);
    expect(await screen.findByRole('button', { name: 'Undo' })).toBeInTheDocument();
    const call = mock.lastCall('PATCH', householdPaths.serviceRecord(BRAKES));
    expect(call?.headers?.['if-match']).toBeTruthy();
    // Only what changed: the lines, the total and the rest stay as they were.
    expect(call?.body).toEqual({ notes: 'Squeaked, now quiet.' });
    expect(mock.lastCall('POST', householdPaths.serviceRecords)).toBeUndefined();
  });

  it('where money is hidden, an edit keeps the priced lines as they are', async () => {
    const state = aiState();
    const garage = state.locations.find((l) => l.id === IDS.garage);
    if (garage) {
      garage.modules = garage.modules.filter((m) => m !== 'money');
      if (garage.effectiveModules)
        garage.effectiveModules = garage.effectiveModules.filter((m) => m !== 'money');
    }
    const { user, mock } = await renderApp(`/t/${CAR}?tab=services`, { state });
    await user.click(await findService(/Front brake pads/));
    const view = within(await screen.findByRole('dialog', { name: 'Service' }));
    await user.click(view.getByRole('button', { name: 'Edit' }));
    const form = within(await screen.findByRole('dialog', { name: 'Edit the service' }));
    expect(
      form.getByText("They have prices you can't see, so they stay as they are."),
    ).toBeInTheDocument();
    expect(form.getAllByRole('textbox', { name: 'What' })[0]).toBeDisabled();
    await user.type(form.getByRole('textbox', { name: 'Notes' }), 'Checked.');
    await user.click(form.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(mock.lastCall('PATCH', householdPaths.serviceRecord(BRAKES))?.body).toEqual({
        notes: 'Checked.',
      }),
    );
  });

  it('deletes a saved service after asking, with Undo bringing it back', async () => {
    const { user, mock } = await renderApp(`/t/${CAR}?tab=services`, { state: aiState() });
    await user.click(await findService(/Front brake pads/));
    const view = within(await screen.findByRole('dialog', { name: 'Service' }));
    await user.click(view.getByRole('button', { name: 'Delete' }));
    const ask = within(await screen.findByRole('alertdialog'));
    expect(ask.getByText('Delete this service?')).toBeInTheDocument();
    await user.click(ask.getByRole('button', { name: 'Delete' }));
    expect((await screen.findAllByText('Service deleted')).length).toBeGreaterThan(0);
    const call = mock.lastCall('DELETE', householdPaths.serviceRecord(BRAKES));
    expect(call?.headers?.['if-match']).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Service' })).toBeNull());
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Front brake pads/ })).toBeNull(),
    );
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(await findService(/Front brake pads/)).toBeInTheDocument();
  });

  it('a viewer opens a service but cannot edit or delete it', async () => {
    const state = aiState();
    const garage = state.locations.find((l) => l.id === IDS.garage);
    if (garage) garage.role = 'viewer';
    const { user } = await renderApp(`/t/${CAR}?tab=services`, { state });
    await user.click(await findService(/Front brake pads/));
    const sheet = within(await screen.findByRole('dialog', { name: 'Service' }));
    expect(await sheet.findByText('Brake disc skim', { exact: false })).toBeInTheDocument();
    expect(sheet.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(sheet.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('offline: Log a service says it needs a connection and cannot save', async () => {
    const { sheet } = await openLogService();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    window.dispatchEvent(new Event('offline'));
    expect(
      await sheet.findByText(
        'Needs a connection: it has money. A reading alone can be logged offline.',
      ),
    ).toBeInTheDocument();
    expect(sheet.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('mirrors in Arabic', async () => {
    await renderApp(`/t/${CAR}?tab=services`, { state: aiState(), locale: 'ar' });
    await screen.findByRole('button', { name: 'سجّل صيانة' }, { timeout: 10_000 });
    expect(document.documentElement.dir).toBe('rtl');
    expectLogicalOnly();
  });
});
