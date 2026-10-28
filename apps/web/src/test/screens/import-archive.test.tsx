/**
 * The import stepper for archives: a Homebox export uploaded,
 * inspected, connected, targeted, chosen, checked and imported, with "See what was imported" and
 * the enrichment offer; a Kept export's passphrase and its new-location-only target; a 5 GB + 1
 * file refused before anything is sent; an upload that fails starts again cleanly; leaving
 * mid-upload asks with Kept's own confirm; a refused archive says why; offline, it needs a
 * connection; and the report's every archive and Homebox reason is translated.
 */
import { ARCHIVE_ISSUE_CODES, HB_ISSUE_CODES } from '@kept/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { capturePaths as cp } from '@/api/capture/paths';
import { IDS, ownerScenario } from '@/api/mock/fixtures';
import { err, PASS } from '@/api/mock/kit';
import { PORTABILITY_IDS, pt } from '@/api/portability/mock/state';
import { portabilityPaths as p } from '@/api/portability/paths';
import type { CreateArchiveImportBody, HomeboxConnectBody } from '@/api/portability/types';
import { findHeading, renderApp } from '@/test/app';
import { expectLogicalOnly } from '@/test/render';

vi.setConfig({ testTimeout: 30_000 });
afterEach(() => vi.restoreAllMocks());

/** jsdom serves the page over http:; these tests are on https unless one says plain http. */
const https = vi.hoisted(() => ({ plain: false }));
vi.mock('@/lib/https', () => ({ servedOverHttp: () => https.plain }));
afterEach(() => {
  https.plain = false;
});

const zip = (name = 'homebox-export-3f2a.zip', bytes = 2048) =>
  new File([new Uint8Array(bytes).fill(7)], name, { type: 'application/zip' });
const fileInput = () => document.querySelector<HTMLInputElement>('input[type="file"]');

async function chooseSource(
  label: 'A Homebox export' | 'A Kept export',
  state: ReturnType<typeof ownerScenario> = ownerScenario(),
) {
  const app = await renderApp(`/settings/import?location=${IDS.home}`, { state });
  await findHeading('Choose the file');
  await app.user.click(await screen.findByRole('radio', { name: new RegExp(label) }));
  await findHeading(label === 'A Homebox export' ? 'The Homebox export' : 'The Kept export');
  await waitFor(() => expect(fileInput()).not.toBeNull());
  return app;
}

describe('a Homebox export', () => {
  it("names Homebox's own menu for the export, and keeps v0.26's restart note folded", async () => {
    const app = await renderApp(`/settings/import?location=${IDS.home}`);
    await findHeading('Choose the file');
    const card = await screen.findByRole('radio', { name: /A Homebox export/ });
    expect(card.closest('label') ?? card.parentElement).toHaveTextContent(
      'Collection → Tools → Backup & Restore → Create Backup → Download',
    );
    await app.user.click(card);
    await findHeading('The Homebox export');
    expect(
      screen.getByText(/In Homebox, open Collection → Tools → Backup & Restore/),
    ).toBeInTheDocument();
    // The restart note is behind its title until opened.
    const note = screen.getByRole('button', { name: 'If Homebox says "Topic has been Shutdown"' });
    expect(note).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText(/v0.26 exports once each time it starts/)).not.toBeVisible();
    await app.user.click(note);
    expect(await screen.findByText(/v0.26 exports once each time it starts/)).toBeVisible();
  });

  it('uploads, inspects, connects, targets, chooses, checks and imports', async () => {
    // AI capture on in the Garage, so the done screen offers search words.
    const state = ownerScenario();
    const garage = state.locations.find((l) => l.id === IDS.garage);
    if (!garage) throw new Error('no garage');
    garage.modules = [...garage.modules, 'ai_capture'];
    garage.providerResolved = true;
    const app = await chooseSource('A Homebox export', state);
    const { user, mock } = app;
    await user.upload(fileInput() as HTMLInputElement, zip());

    expect(await findHeading("What's in it")).toBeInTheDocument();
    const declared = mock.lastCall('POST', p.importsArchive)?.body as CreateArchiveImportBody;
    expect(declared).toMatchObject({ source: 'homebox_zip', bytes: 2048 });
    expect(declared.sha256).toMatch(/^[0-9a-f]{64}$/);
    const put = [...mock.calls].reverse().find((c) => c.method === 'PUT');
    expect(put?.headers['x-kept-sha256']).toBe(declared.sha256);
    expect(screen.getByText('items and locations')).toBeInTheDocument();
    expect(screen.getByText(/version unknown/)).toBeInTheDocument();

    // The optional connection: the key goes in the body once, and the version shows.
    await user.click(screen.getByRole('button', { name: 'Connect' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Homebox address' }),
      'https://hb.example.com',
    );
    await user.type(
      screen.getByLabelText('API key', { selector: 'input[type=password]' }),
      'hb_secret',
    );
    await user.click(screen.getByRole('button', { name: 'Connect' }));
    expect(await screen.findByText('Connected to Homebox')).toBeInTheDocument();
    const connect = mock.lastCall('POST', p.importHomeboxConnect(declared.id))
      ?.body as HomeboxConnectBody;
    expect(connect).toEqual({ baseUrl: 'https://hb.example.com', apiKey: 'hb_secret' });
    expect(screen.queryByDisplayValue('hb_secret')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await findHeading('Where it goes')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Home');
    await user.click(screen.getByRole('radio', { name: /A location you run/ }));
    const where = screen.getByRole('combobox', { name: 'Location' });
    await user.type(where, 'Gar');
    await user.click(await screen.findByRole('option', { name: 'Garage' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(mock.lastCall('POST', p.importTarget(declared.id))?.body).toEqual({
      locationId: IDS.garage,
    });

    expect(await findHeading('A few choices, before the check')).toBeInTheDocument();
    // The connection's currency, the types matched by name or created, the fields kept.
    const types = await screen.findByRole('list', { name: 'Homebox types' });
    expect(within(types).getByText('Kitchen gear')).toBeInTheDocument();
    // A new type reads with its name in the picker (#320).
    expect(screen.getByRole('combobox', { name: 'Kept type for Kitchen gear' })).toHaveValue(
      'New type "Kitchen gear"',
    );
    expect(screen.getAllByRole('textbox', { name: 'Name of the new type' })[0]).toHaveValue(
      'Power Tools',
    );
    // Homebox's catch-all, global.item, reads as Item and comes in without a type.
    expect(within(types).queryByText('global.item')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Kept type for Item' })).toHaveValue('No type');
    expect(screen.getByText('3 items are marked insured.')).toBeInTheDocument();
    // Archived items come in archived unless you say otherwise.
    expect(screen.getByRole('radio', { name: 'Archived' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'In use' }));
    await user.click(screen.getByRole('button', { name: 'Check the import' }));

    expect(await findHeading('What the import will do')).toBeInTheDocument();
    const choices = mock.lastCall('POST', p.importChoices(declared.id));
    expect(choices?.headers['if-match']).toBeDefined();
    expect(choices?.body).toMatchObject({
      choices: {
        archived: 'in_use',
        currency: 'USD',
        insured: 'field',
        seeded: 'skip_unused',
        fields: { Voltage: 'add_to_type', 'Warranty card no.': 'add_to_type' },
      },
    });
    // People to invite come from the connection, with their emails.
    const people = screen.getByRole('list', { name: 'People to invite' });
    expect(within(people).getByText('louis@example.com')).toBeInTheDocument();
    expectLogicalOnly();

    await user.click(screen.getByRole('button', { name: 'Import 5 things' }));
    expect(
      await screen.findByRole('heading', { name: 'Done' }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See what was imported' })).toHaveAttribute(
      'href',
      expect.stringContaining(`/loc/${IDS.garage}?f.importRun=`),
    );
    // The rooms are laid out on the map already: one step to see them there.
    expect(screen.getByRole('link', { name: 'Open the map' })).toHaveAttribute(
      'href',
      `/loc/${IDS.garage}?view=map`,
    );
    // The enrichment offer: its cost first, nothing started until asked.
    expect(await screen.findByText(/about 2,000 tokens/)).toBeInTheDocument();
    expect(screen.getByText(/USD/)).toBeInTheDocument();
    expect(mock.lastCall('POST', p.importEnrich(declared.id))).toBeUndefined();
    await user.click(screen.getByRole('button', { name: 'Add search words' }));
    expect(await screen.findByText('Adding search words')).toBeInTheDocument();
  });

  it('lists only the entries with an issue, each row saying why in words', async () => {
    const { user } = await renderApp(`/settings/import?run=${PORTABILITY_IDS.homeboxRun}`);
    expect(await findHeading('What the import will do')).toBeInTheDocument();
    const rows = await screen.findByRole('list', { name: 'Needs a look' });
    // The row's subtitle is its reason, never "An item or location".
    expect(rows).not.toHaveTextContent('An item or location');
    const toolbox = within(rows).getByText('Toolbox drawer').closest('li') as HTMLElement;
    // Before anything is imported, it says what will happen (#320), never what did.
    expect(toolbox).toHaveTextContent('A location inside an item becomes a box.');
    expect(rows).toHaveTextContent('Quantity 0 in Homebox; it comes in as 1.');
    expect(rows).toHaveTextContent('Quantity 0 in Homebox; it comes in archived.');
    expect(rows).toHaveTextContent('It holds other items, so it comes in as a box.');
    expect(rows).toHaveTextContent('A location that comes in as a box, as chosen.');
    expect(rows).not.toHaveTextContent(/came in|became|Imported, with a note/);
    expect(rows).toHaveTextContent('drill-manual.docx');
    for (const code of [...ARCHIVE_ISSUE_CODES, ...HB_ISSUE_CODES])
      expect(rows.textContent).not.toContain(code);
    await user.type(screen.getByRole('searchbox', { name: 'Search the report' }), 'Toolbox');
    await waitFor(() =>
      expect(screen.getByRole('list', { name: 'Needs a look' })).not.toHaveTextContent(
        'drill-manual.docx',
      ),
    );
  });

  it('says why an archive was refused, and offers another file', async () => {
    const state = ownerScenario();
    const run = pt(state).archiveRuns[0];
    if (!run) throw new Error('no run');
    pt(state).archiveRuns.unshift({
      ...run,
      id: '01926f00-0000-7000-8000-0000000d70ff',
      locationId: null,
      status: 'failed',
      error: 'archive_invalid',
      reason: 'encrypted',
      inspect: null,
      report: undefined,
    } as never);
    const { user, router } = await renderApp(
      '/settings/import?run=01926f00-0000-7000-8000-0000000d70ff',
      {
        state,
      },
    );
    expect(await findHeading("Kept can't read this archive")).toBeInTheDocument();
    expect(
      screen.getByText(
        "It's protected with a ZIP password, which Kept can't open. Export it again without one.",
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Choose another file' }));
    expect(await findHeading('The Homebox export')).toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ source: 'homebox_zip' });
  });
});

describe('a Homebox export, from 1.13.0', () => {
  it('asks what a new location tracks, Essentials and what the backup uses, and makes it only when the import runs', async () => {
    const state = ownerScenario();
    const { user, mock } = await chooseSource('A Homebox export', state);
    const before = state.locations.length;
    await user.upload(fileInput() as HTMLInputElement, zip());
    expect(await findHeading("What's in it")).toBeInTheDocument();
    const declared = mock.lastCall('POST', p.importsArchive)?.body as CreateArchiveImportBody;
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await findHeading('Where it goes')).toBeInTheDocument();
    await user.clear(screen.getByRole('textbox', { name: 'Name' }));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Maple Street');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(await findHeading('What to track')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Essentials/ })).toBeChecked();
    // What the backup uses, ticked on top of Essentials, with how much.
    const prices = screen.getByRole('checkbox', { name: /Prices on 4 things/ });
    const warranties = screen.getByRole('checkbox', { name: /2 warranties/ });
    expect(prices).toBeChecked();
    expect(warranties).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /1 maintenance entry/ })).toBeChecked();
    expect(screen.queryByText(/Notes can't become records later/)).toBeNull();
    await user.click(warranties);
    expect(screen.getByText(/Notes can't become records later/)).toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: 'Also for Personal' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(mock.lastCall('POST', p.importTarget(declared.id))?.body).toMatchObject({
      newLocation: {
        name: 'Maple Street',
        preset: 'essentials',
        modules: ['money', 'schedules'],
        alsoPersonal: true,
      },
    });
    // Not made yet: an import left here leaves nothing behind.
    expect(await findHeading('A few choices, before the check')).toBeInTheDocument();
    expect(state.locations).toHaveLength(before);

    // The choices: quantity 0, the boxes, a new type with its own name.
    expect(screen.getByRole('radio', { name: 'Keep 0 or archive' })).toBeChecked();
    expect(screen.getByText(/2 items have quantity 0/)).toBeInTheDocument();
    const boxes = screen.getByRole('list', { name: 'Locations that look like boxes' });
    expect(within(boxes).getByText('Box 01')).toBeInTheDocument();
    expect(
      within(boxes)
        .getAllByRole('checkbox')
        .every((c) => !(c as HTMLInputElement).checked),
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Choose all' }));
    expect(screen.getByText('4 of 4 as boxes')).toBeInTheDocument();
    const name = screen.getAllByRole('textbox', { name: 'Name of the new type' })[1] as HTMLElement;
    await user.clear(name);
    expect(screen.getByRole('button', { name: 'Check the import' })).toBeDisabled();
    await user.type(name, 'Gadgets');
    await user.click(screen.getByRole('button', { name: 'Check the import' }));
    expect(await findHeading('What the import will do')).toBeInTheDocument();
    expect(mock.lastCall('POST', p.importChoices(declared.id))?.body).toMatchObject({
      choices: {
        zeroQuantity: 'keep_or_archive',
        boxes: [
          '0192a000-0000-7000-8000-00000000c204',
          '0192a000-0000-7000-8000-00000000c201',
          '0192a000-0000-7000-8000-00000000c203',
          '0192a000-0000-7000-8000-00000000c202',
        ],
        types: {
          '0192a000-0000-7000-8000-00000000c103': { create: 'Gadgets' },
          '0192a000-0000-7000-8000-00000000c104': { none: true },
        },
      },
    });

    await user.click(screen.getByRole('button', { name: /^Import \d+ things$/ }));
    expect(
      await screen.findByRole('heading', { name: 'Done' }, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Imported into Maple Street' }),
    ).toBeVisible();
    const made = state.locations.find((l) => l.name === 'Maple Street');
    expect(made).toMatchObject({ preset: 'essentials' });
    expect(state.locations.find((l) => l.kind === 'personal')).toMatchObject({
      preset: 'essentials',
    });
    expect(state.locations.find((l) => l.kind === 'personal')?.modules).toEqual(
      expect.arrayContaining(['money', 'schedules']),
    );
    expect(made?.modules).not.toContain('warranties');
  });

  it('keeps what needed a look on the import’s page, and repairs a past import with one Undo', async () => {
    const { user, mock } = await renderApp(`/settings/import?run=${PORTABILITY_IDS.homeboxDone}`);
    expect(await findHeading('Done')).toBeInTheDocument();
    const looked = await screen.findByRole('list', { name: 'Needs a look' });
    // After the import the report says what happened.
    expect(within(looked).getByText('Candles').closest('li')).toHaveTextContent(
      'Quantity 0 in Homebox; it came in as 1.',
    );
    expect(looked).toHaveTextContent('Imported, with a note');
    expect(screen.getByRole('heading', { name: /^What needed a look/ })).toBeInTheDocument();

    expect(await screen.findByRole('heading', { name: 'Repair this import' })).toBeInTheDocument();
    const zero = screen.getByRole('checkbox', {
      name: /Archive the 2 things that had quantity 0 in Homebox/,
    });
    expect(zero).toBeChecked();
    expect(screen.getByText('AA batteries and Candles')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /Make 1 type an ordinary type again/ }),
    ).toBeChecked();
    // #346: a sold date alone ended things sold before 1.14.1.
    expect(
      screen.getByRole('checkbox', {
        name: /Put the 1 thing marked sold on a date alone back in use/,
      }),
    ).toBeChecked();
    expect(screen.getByText('Desk lamp')).toBeInTheDocument();
    const rename = screen.getByRole('checkbox', { name: /Rename .?global\.item.? to .?Item/ });
    await user.click(rename);
    await user.click(rename);
    await user.click(screen.getByRole('button', { name: 'Repair' }));
    await waitFor(() =>
      expect(mock.lastCall('POST', p.importRepair(PORTABILITY_IDS.homeboxDone))?.body).toEqual({
        zero: true,
        containerTypes: true,
        names: { item: 'Item', location: 'Location' },
        sold: true,
      }),
    );
    const toast = await screen.findByText('Repaired the import');
    expect(toast).toBeInTheDocument();
    // Nothing left to repair: the section goes.
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Repair this import' })).toBeNull(),
    );
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(
      await screen.findByRole('heading', { name: 'Repair this import' }, { timeout: 10_000 }),
    ).toBeInTheDocument();
  });
});

describe('a Homebox export, from 1.13.1 (#320)', () => {
  async function adjust() {
    const app = await renderApp(`/settings/import?run=${PORTABILITY_IDS.homeboxRun}`);
    expect(await findHeading('What the import will do')).toBeInTheDocument();
    await app.user.click(screen.getByRole('button', { name: 'Adjust' }));
    expect(await findHeading('A few choices, before the check')).toBeInTheDocument();
    return app;
  }

  it('lists the locations that look like boxes A to Z, numbers in order', async () => {
    await adjust();
    const boxes = screen.getByRole('list', { name: 'Locations that look like boxes' });
    const names = within(boxes)
      .getAllByRole('checkbox')
      .map((c) => c.closest('label')?.querySelector('bdi.font-medium')?.textContent);
    expect(names).toEqual(['Bin 1', 'Box 01', 'Box 2', 'Box 10']);
  });

  it('offers a typed name as a new type, as New type… does', async () => {
    const { user, mock } = await adjust();
    const picker = screen.getByRole('combobox', { name: 'Kept type for Item' });
    await user.clear(picker);
    await user.type(picker, 'Gadgets');
    expect(screen.queryByText('No matches')).toBeNull();
    await user.click(await screen.findByRole('option', { name: 'New type "Gadgets"' }));
    expect(picker).toHaveValue('New type "Gadgets"');
    await waitFor(() =>
      expect(
        screen
          .getAllByRole('textbox', { name: 'Name of the new type' })
          .map((x) => (x as HTMLInputElement).value),
      ).toContain('Gadgets'),
    );
    // A name a Kept type already has is that type, not a new one.
    await user.clear(picker);
    await user.type(picker, 'No type');
    expect(screen.queryByRole('option', { name: /^New type "/ })).toBeNull();
    await user.click(screen.getByRole('option', { name: 'No type' }));
    await user.clear(picker);
    await user.type(picker, 'Gadgets');
    await user.click(await screen.findByRole('option', { name: 'New type "Gadgets"' }));
    await user.click(screen.getByRole('button', { name: 'Check the import' }));
    await waitFor(() =>
      expect(
        mock.lastCall('POST', p.importChoices(PORTABILITY_IDS.homeboxRun))?.body,
      ).toMatchObject({
        choices: { types: { '0192a000-0000-7000-8000-00000000c104': { create: 'Gadgets' } } },
      }),
    );
  });

  it('matches what was typed with spaces around it, never "No matches"', async () => {
    const { user } = await adjust();
    const picker = screen.getByRole('combobox', { name: 'Kept type for Item' });
    for (const text of ['Appliance  ', '  APPLIANCE']) {
      await user.clear(picker);
      await user.type(picker, text);
      expect(await screen.findByRole('option', { name: 'Appliance' })).toBeInTheDocument();
      expect(screen.queryByText('No matches')).toBeNull();
      expect(screen.queryByRole('option', { name: /^New type "/ })).toBeNull();
    }
  });

  it('says a custom field no item has a value for is left out', async () => {
    await adjust();
    const fields = screen.getByRole('list', { name: 'Custom fields' });
    const empty = within(fields).getByText('Last defrosted').closest('li') as HTMLElement;
    expect(empty).toHaveTextContent('Left out: no item has a value for it.');
    expect(within(empty).queryByRole('radio')).toBeNull();
    const voltage = within(fields).getByText('Voltage').closest('li') as HTMLElement;
    expect(voltage).not.toHaveTextContent('Left out');
    expect(within(voltage).getByRole('radio', { name: 'Add to the type' })).toBeChecked();
  });

  it("doesn't ask for the AI estimate where AI is off, and offers it where it's on", async () => {
    const off = await renderApp(`/settings/import?run=${PORTABILITY_IDS.homeboxDone}`);
    expect(await findHeading('Done')).toBeInTheDocument();
    expect(await screen.findByRole('list', { name: 'Needs a look' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See what was imported' })).toBeInTheDocument();
    expect(
      off.mock.lastCall('GET', p.importEnrichEstimate(PORTABILITY_IDS.homeboxDone)),
    ).toBeUndefined();
    expect(screen.queryByText('Add search words with AI?')).toBeNull();
    off.unmount();

    const state = ownerScenario();
    const garage = state.locations.find((l) => l.id === IDS.garage);
    if (!garage) throw new Error('no garage');
    garage.modules = [...garage.modules, 'ai_capture'];
    garage.providerResolved = true;
    const on = await renderApp(`/settings/import?run=${PORTABILITY_IDS.homeboxDone}`, { state });
    expect(await findHeading('Done')).toBeInTheDocument();
    expect(await screen.findByText('Add search words with AI?')).toBeInTheDocument();
    expect(
      on.mock.lastCall('GET', p.importEnrichEstimate(PORTABILITY_IDS.homeboxDone)),
    ).toBeDefined();
  });
});

describe('the upload', () => {
  it('refuses a file over 5 GB before anything is sent', async () => {
    const { user, mock } = await chooseSource('A Homebox export');
    const big = zip('huge.zip', 1);
    Object.defineProperty(big, 'size', { value: 5 * 1024 ** 3 + 1 });
    await user.upload(fileInput() as HTMLInputElement, big);
    expect(
      await screen.findByText('This file is 5.4 GB; an import takes at most 5 GB.'),
    ).toBeInTheDocument();
    expect(mock.lastCall('POST', p.importsArchive)).toBeUndefined();
  });

  it('starts again cleanly after an upload fails', async () => {
    let fail = true;
    const { user, mock } = await chooseSource('A Kept export');
    mock.on('PUT', p.importArchive(':id'), () => {
      if (!fail) return PASS;
      fail = false;
      return err(500, 'internal', 'The disk is full.');
    });
    await user.upload(fileInput() as HTMLInputElement, zip('home.zip'));
    expect(await screen.findByText("The upload didn't finish")).toBeInTheDocument();
    const first = (
      mock.lastCall('POST', p.importsArchive)?.body as CreateArchiveImportBody | undefined
    )?.id;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await findHeading("What's in it")).toBeInTheDocument();
    const second = (
      mock.lastCall('POST', p.importsArchive)?.body as CreateArchiveImportBody | undefined
    )?.id;
    expect(second).not.toBe(first);
  });

  it('asks with its own confirm before leaving mid-upload', async () => {
    const { user, mock } = await chooseSource('A Homebox export');
    mock.hang('PUT', p.importArchive(':id'));
    await user.upload(fileInput() as HTMLInputElement, zip());
    expect(await screen.findByRole('progressbar', { name: 'Uploading' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Stop the upload?')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Keep uploading' }));
    expect(screen.getByRole('heading', { name: 'The Homebox export' })).toBeInTheDocument();
  });

  it('names the version text, and explains a spreadsheet chosen as the Homebox export', async () => {
    const app = await renderApp(`/settings/import?location=${IDS.home}`);
    await findHeading('Choose the file');
    expect(
      screen.getByText(/Homebox v0\.26\.1 or newer \(v0\.27\.0 recommended\)/),
    ).toBeInTheDocument();
    await app.user.click(await screen.findByRole('radio', { name: /A Homebox export/ }));
    await findHeading('The Homebox export');
    await waitFor(() => expect(fileInput()).not.toBeNull());
    await app.user.upload(
      fileInput() as HTMLInputElement,
      new File(['HB.name\tHB.location\nKettle\tKitchen\n'], 'homebox-items.tsv', {
        type: 'text/tab-separated-values',
      }),
    );
    expect(await screen.findByText(/This is Homebox's spreadsheet export/)).toBeInTheDocument();
    expect(app.mock.lastCall('POST', p.importsArchive)).toBeUndefined();
    await app.user.click(screen.getByRole('button', { name: 'Import it as a spreadsheet' }));
    expect(await findHeading('Choose the file')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose a CSV file' })).toBeInTheDocument();
  });

  it('needs a connection', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await chooseSource('A Homebox export');
    expect(screen.getByRole('button', { name: 'Choose the .zip file' })).toBeDisabled();
    expect(screen.getByText('Needs a connection')).toBeInTheDocument();
  });
});

describe('a Kept export', () => {
  it('opens its secrets with the passphrase and goes only into a new location', async () => {
    const { user, mock } = await renderApp(`/settings/import?run=${PORTABILITY_IDS.keptRun}`);
    expect(await findHeading("What's in it")).toBeInTheDocument();
    expect(screen.getAllByText('بيت العائلة').length).toBeGreaterThan(0);
    const field = screen.getByLabelText('Passphrase');
    await user.type(field, 'not the right one');
    await user.click(screen.getByRole('button', { name: 'Open the secrets' }));
    expect(
      await screen.findByText("That passphrase doesn't open this export's secrets."),
    ).toBeInTheDocument();
    await user.clear(field);
    await user.type(field, PORTABILITY_IDS.passphrase);
    await user.click(screen.getByRole('button', { name: 'Open the secrets' }));
    expect(await screen.findByText('The secrets will be imported')).toBeInTheDocument();
    expect(screen.queryByDisplayValue(PORTABILITY_IDS.passphrase)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await findHeading('Where it goes')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /A location you run/ })).toBeNull();
    expect(
      screen.getByText('A Kept export always comes in as a new location.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('بيت العائلة');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(mock.lastCall('POST', p.importTarget(PORTABILITY_IDS.keptRun))?.body).toMatchObject({
      newLocation: { name: 'بيت العائلة', kind: 'home' },
    });

    expect(await findHeading('Check the import')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Check the import' }));
    expect(await findHeading('What the import will do')).toBeInTheDocument();
    expect(mock.lastCall('POST', cp.importDryRun(PORTABILITY_IDS.keptRun))).toBeDefined();
    expect(screen.getByText(/labels kept as printed/)).toBeInTheDocument();
    const people = screen.getByRole('list', { name: 'People to invite' });
    expect(within(people).getByText('Bruce')).toBeInTheDocument();
    expect(within(people).getByRole('link', { name: 'Invite' })).toBeInTheDocument();
  });
});

describe('a private address', () => {
  async function connectTo(state: ReturnType<typeof ownerScenario>) {
    const app = await chooseSource('A Homebox export', state);
    await app.user.upload(fileInput() as HTMLInputElement, zip());
    expect(await findHeading("What's in it")).toBeInTheDocument();
    await app.user.click(screen.getByRole('button', { name: 'Connect' }));
    await app.user.type(
      screen.getByRole('textbox', { name: 'Homebox address' }),
      'http://192.168.1.20:7745',
    );
    await app.user.type(
      screen.getByLabelText('API key', { selector: 'input[type=password]' }),
      'hb_secret',
    );
    await app.user.click(screen.getByRole('button', { name: 'Connect' }));
    expect(await screen.findByText(/That address is on a private network/)).toBeInTheDocument();
    return app;
  }

  it('links an instance admin to the switch that allows it', async () => {
    await connectTo(ownerScenario());
    const link = screen.getByRole('link', { name: 'Allow private addresses in Admin → Settings' });
    expect(link).toHaveAttribute('href', '/admin/settings#private-addresses');
  });

  it("doesn't offer anyone else a link to Admin", async () => {
    const state = ownerScenario();
    state.me.user.instanceAdmin = false;
    await connectTo(state);
    expect(screen.queryByRole('link', { name: /Allow private addresses/ })).toBeNull();
  });
});

describe('a Kept export with secrets, over plain HTTP', () => {
  it('says the secrets need HTTPS, asks for no passphrase, and imports the rest', async () => {
    https.plain = true;
    const { user, mock } = await renderApp(`/settings/import?run=${PORTABILITY_IDS.keptRun}`);
    expect(await findHeading("What's in it")).toBeInTheDocument();
    expect(screen.getByText('It holds encrypted secrets')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Opening them needs HTTPS. Over plain HTTP everything else is imported without them; to bring them over too, import this file at Kept’s HTTPS address.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Passphrase')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open the secrets' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await findHeading('Where it goes')).toBeInTheDocument();
    expect(mock.lastCall('POST', p.importPassphrase(PORTABILITY_IDS.keptRun))).toBeUndefined();
  });
});

describe('a Kept export made without its secrets', () => {
  it('says how many secret values it left out', async () => {
    const { user } = await renderApp(`/settings/import?run=${PORTABILITY_IDS.keptRun}`, {
      setup: (m) => {
        const run = pt(m.state).archiveRuns.find((r) => r.id === PORTABILITY_IDS.keptRun);
        if (run) run.secrets = null;
      },
    });
    expect(await findHeading("What's in it")).toBeInTheDocument();
    expect(screen.queryByLabelText('Passphrase')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await findHeading('Where it goes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(await screen.findByRole('button', { name: 'Check the import' }));
    expect(await findHeading('What the import will do')).toBeInTheDocument();
    expect(screen.getByText('secret values left out of the export')).toBeInTheDocument();
    expect(screen.queryByText(/secrets? to bring over/)).toBeNull();
  });
});

describe('in Arabic', () => {
  it('reads a Kept export right to left, with its words translated', async () => {
    await renderApp(`/settings/import?run=${PORTABILITY_IDS.keptRun}`, { locale: 'ar' });
    expect(await findHeading('ما في الملف')).toBeInTheDocument();
    expect(document.documentElement.dir).toBe('rtl');
    expect(screen.getByText('فيه أسرار مشفّرة')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'التالي' })).toBeInTheDocument();
    expectLogicalOnly();
  });
});
