/**
 * The labels screens: the labels screen and its recent batches (what each holds, printed or
 * not, confirmed or set aside from the list), the batch builder with its stock and start cell, its
 * preview (the printed label itself), names too long for a label, the offer of a sheet already
 * made for the same things, one create per print, the print view's sheets, "Printed OK?" for the
 * batch just printed with the first-print hint, Arabic names on labels, codes kept left to right,
 * nothing cut short anywhere, and a location with the module off.
 */
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LabelBatch } from '@/api/capture/types';
import { INV_IDS } from '@/api/inventory/mock/fixtures';
import { IDS, ownerScenario } from '@/api/mock/fixtures';
import { FSI, PDI } from '@/lib/bidi';
import { expectLogicalOnly } from '@/test/render';
import { findHeading, pathOf, renderApp } from '../app';

const T = INV_IDS.thing;

/** Anything that would cut text short: a truncate or line-clamp class, or an ellipsis style. */
function cutters(root: ParentNode = document.body): string[] {
  const out: string[] = [];
  for (const el of root.querySelectorAll<HTMLElement>('*')) {
    const cls = el.getAttribute('class') ?? '';
    if (/(^|\s)(truncate|line-clamp-\S+|text-ellipsis)(\s|$)/.test(cls))
      out.push(`${el.tagName}.${cls}`);
    if (el.style.textOverflow === 'ellipsis') out.push(`${el.tagName}[style]`);
  }
  return out;
}

/** The POSTs to /labels/batches the app sends from now on, real creates and dry runs apart. */
function batchPosts() {
  const spy = vi.spyOn(globalThis, 'fetch');
  return () =>
    spy.mock.calls
      .filter(
        ([url, init]) => String(url).endsWith('/api/v1/labels/batches') && init?.method === 'POST',
      )
      .map(([, init]) => (JSON.parse(String(init?.body ?? '{}')).dryRun ? 'dry run' : 'create'));
}

afterEach(() => vi.restoreAllMocks());

describe('the labels screen', () => {
  it('offers each location its unprinted labels and a blank sheet, and lists recent batches', async () => {
    await renderApp('/labels');
    expect(await findHeading('Labels')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Blank sheet \(24\)/ }).length).toBeGreaterThan(0);
    expect(
      await screen.findAllByRole('link', { name: /Label everything unprinted/ }),
    ).not.toHaveLength(0);
    expect(await screen.findByRole('heading', { name: 'Recent batches' })).toBeInTheDocument();
    expect(within(screen.getByRole('main')).queryByText('Coming soon')).toBeNull();
  });

  it('a location with Labels off says so, with Turn on for its admin', async () => {
    const state = ownerScenario();
    state.locations = state.locations.map((l) =>
      l.id === IDS.garage ? { ...l, modules: [], effectiveModules: [] } : l,
    );
    await renderApp(`/labels?loc=${IDS.garage}&blank=24`, { state });
    expect(await screen.findByText('Off in this location')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Turn on' })).toHaveAttribute(
      'href',
      `/settings/location/${IDS.garage}/track`,
    );
    expect(screen.queryByRole('button', { name: /^Print/ })).toBeNull();
  });
});

describe('the batch builder', () => {
  it('prints a selection from start cell 20, then asks "Printed OK?" and shows the first-print hint', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const { user, router } = await renderApp(
      `/labels?loc=${IDS.home}&things=${T.hdmiCable},${T.box3},${T.draft}`,
    );
    expect(await findHeading('Print labels')).toBeInTheDocument();
    // What prints is the server's dry run: the draft has no ID yet, so it's left out.
    expect(await screen.findByRole('img', { name: '7KQ4MZ' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'B0X3AA' })).toBeInTheDocument();
    expect(screen.getByText('1 thing was left out: its ID is still pending.')).toBeInTheDocument();

    expect(screen.getByRole('radio', { name: /A4 sheet · 24 labels/ })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Label 20, row 7, column 2' }));
    expect(
      screen.getByText('Start at label 20 (row 7, column 2). Tap any cell to start there.'),
    ).toBeInTheDocument();
    expect(screen.getByText('19 already used')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Print 2 labels' }));
    await waitFor(() => expect(pathOf(router)).toMatch(/^\/labels\/[\w-]+$/));
    // The builder's Print opens the print dialog by itself, then asks.
    const ask = await screen.findByRole('dialog', { name: 'Printed OK?' });
    expect(print).toHaveBeenCalledTimes(1);
    const sheet = screen.getByRole('region', { name: 'Sheet 1 of 1', hidden: true });
    expect(sheet.querySelector('[data-cell="20"]')).not.toBeNull();
    expect(sheet.querySelector('[data-cell="21"]')).not.toBeNull();
    expect(sheet.querySelectorAll('[data-slot="label"]')).toHaveLength(2);
    // No app shell around the paper.
    expect(screen.queryByRole('navigation', { name: 'Main', hidden: true })).toBeNull();

    await user.click(within(ask).getByRole('button', { name: 'Yes, printed OK' }));
    const tip = await screen.findByRole('dialog', { name: 'Now stick one on and scan it' });
    await user.click(within(tip).getByRole('button', { name: 'Got it' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText(/^Printed on /)).toBeInTheDocument();
  });

  it('a batch with nothing left to label since the preview says why (400 with excluded)', async () => {
    const state = ownerScenario();
    const { user } = await renderApp(`/labels?loc=${IDS.home}&things=${T.hdmiCable},${T.draft}`, {
      state,
    });
    expect(await screen.findByRole('img', { name: '7KQ4MZ' })).toBeInTheDocument();
    // Trashed on another phone after the preview.
    const cable = state.inventory.things.find((x) => x.id === T.hdmiCable);
    if (!cable) throw new Error('no cable');
    cable.deletedAt = new Date().toISOString();
    await user.click(screen.getByRole('button', { name: 'Print 1 label' }));
    expect(await screen.findByText('Nothing here can be labelled now')).toBeInTheDocument();
    expect(screen.getByText('1 is waiting to sync: its ID is still pending.')).toBeInTheDocument();
    expect(
      screen.getByText("1 can't be labelled here: it is in the trash or in another location."),
    ).toBeInTheDocument();
    // The list is read again, as it is now.
    await waitFor(() => expect(screen.queryByRole('img', { name: '7KQ4MZ' })).toBeNull());
  });

  it('the sheet preview draws each label with what it prints: QR, name and code, or QR and code', async () => {
    const { user } = await renderApp(`/labels?loc=${IDS.home}&things=${T.hdmiCable},${T.box3}`);
    const first = await screen.findByRole('radio', {
      name: `Label 1, row 1, column 1: ${FSI}HDMI cable, 2 m${PDI}, 7KQ4MZ`,
    });
    const cell = first.closest('[data-slot="preview-cell"]') as HTMLElement;
    expect(cell.querySelector('[data-slot="label-qr"] path')).not.toBeNull();
    expect(within(cell).getByText('HDMI cable, 2 m')).toBeInTheDocument();
    expect(within(cell).getByText('7KQ‑4MZ')).toBeInTheDocument();
    expect(cell.querySelector('[data-slot="label-place"]')).not.toBeNull();
    expect(
      screen.getByText('Each label: QR code, name, where it is and short ID'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /A4 sheet · 65 labels/ }));
    const compact = screen.getByRole('radio', { name: 'Label 1, row 1, column 1: 7KQ4MZ' });
    const small = compact.closest('[data-slot="preview-cell"]') as HTMLElement;
    expect(small.querySelector('[data-slot="label-qr"] path')).not.toBeNull();
    expect(within(small).getByText('7KQ‑4MZ')).toBeInTheDocument();
    expect(small.querySelector('[data-slot="label-name"]')).toBeNull();
    expect(screen.getByText('Each label: QR code and short ID')).toBeInTheDocument();
  });

  it('a roll has no start cell, and a blank sheet counts its labels', async () => {
    const { user } = await renderApp(`/labels?loc=${IDS.home}&blank=24`);
    expect(await findHeading('Print labels')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Print 24 labels' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('button', { name: 'Print 34 labels' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /40 × 30 mm roll/ }));
    expect(screen.queryByRole('radio', { name: /^Label 1,/ })).toBeNull();
    expect(screen.getByText('Label preview')).toBeInTheDocument();
  });
});

describe('label-maker tape', () => {
  it('narrow tape previews the code large and the name beside it, with no QR', async () => {
    const { user } = await renderApp(`/labels?loc=${IDS.home}&things=${T.hdmiCable}`);
    await user.click(await screen.findByRole('radio', { name: /12 mm tape/ }));
    expect(
      screen.getByRole('radio', { name: /12 mm tape/ }).closest('label')?.textContent,
    ).toContain('Label maker · short ID large, and the name');
    expect(screen.queryByRole('radio', { name: /^Label 1,/ })).toBeNull();
    expect(screen.getByText('Label preview')).toBeInTheDocument();
    const label = document.querySelector('div[data-slot="label"]') as HTMLElement;
    expect(label.querySelector('[data-slot="label-qr"]')).toBeNull();
    expect(within(label).getByText('7KQ‑4MZ')).toBeInTheDocument();
    // The name, wrapped over as many lines as it needs beside the code.
    const name = label.querySelector('[data-slot="label-name"]');
    expect([...(name?.children ?? [])].map((l) => l.textContent).join(' ')).toBe('HDMI cable, 2 m');
    expect(label.querySelector('[data-slot="label-place"]')).toBeNull();
    // Printed size, scaled: 50 × 12 mm.
    const size = label.parentElement as HTMLElement;
    expect(size.style.inlineSize).toBe('50mm');
    expect(size.style.blockSize).toBe('12mm');
  });

  it('wide tape keeps the QR', async () => {
    const { user } = await renderApp(`/labels?loc=${IDS.home}&things=${T.hdmiCable}`);
    await user.click(await screen.findByRole('radio', { name: /24 mm tape/ }));
    expect(
      screen.getByRole('radio', { name: /24 mm tape/ }).closest('label')?.textContent,
    ).toContain('Label maker · QR code, short ID and name');
    const label = document.querySelector('div[data-slot="label"]') as HTMLElement;
    await waitFor(() => expect(label.querySelector('[data-slot="label-qr"] path')).not.toBeNull());
  });
});

describe('one batch, the right one', () => {
  it('one Print makes one batch: no second dry run after the create', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const { user, router } = await renderApp(
      `/labels?loc=${IDS.home}&things=${T.hdmiCable},${T.box3}`,
    );
    await screen.findByRole('button', { name: 'Print 2 labels' });
    const posts = batchPosts();
    await user.click(screen.getByRole('button', { name: 'Print 2 labels' }));
    await waitFor(() => expect(pathOf(router)).toMatch(/^\/labels\/[\w-]+$/));
    await screen.findByRole('dialog', { name: 'Printed OK?' });
    expect(print).toHaveBeenCalledTimes(1);
    expect(posts()).toEqual(['create']);
  });

  it('"Printed OK?" names the batch just printed and confirms that one, not an older sheet', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => {});
    const state = ownerScenario();
    const { user, router } = await renderApp(
      `/labels?loc=${IDS.home}&things=${T.hdmiCable},${T.box3}`,
      { state },
    );
    await user.click(await screen.findByRole('button', { name: 'Print 2 labels' }));
    await waitFor(() => expect(pathOf(router)).toMatch(/^\/labels\/[\w-]+$/));
    const id = pathOf(router).split('/').pop();
    const ask = await screen.findByRole('dialog', { name: 'Printed OK?' });
    expect(
      within(ask).getByText(`2 labels: ${FSI}HDMI cable, 2 m${PDI} and ${FSI}Box 3${PDI}`),
    ).toBeInTheDocument();
    await user.click(within(ask).getByRole('button', { name: 'Yes, printed OK' }));
    await waitFor(() =>
      expect(
        state.capture.labelBatches.find((b) => b.id === id)?.printedConfirmedAt,
      ).not.toBeNull(),
    );
    // The old blank sheet from the fixtures is untouched.
    const old = state.capture.labelBatches.find((b) => b.kind === 'blank');
    expect(old?.printedConfirmedAt).toBeNull();
  });

  it('answering "No" keeps asking on the page printed from, for that batch', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => {});
    const state = ownerScenario();
    const { user, router } = await renderApp(`/labels?loc=${IDS.home}&things=${T.hdmiCable}`, {
      state,
    });
    await user.click(await screen.findByRole('button', { name: 'Print 1 label' }));
    await waitFor(() => expect(pathOf(router)).toMatch(/^\/labels\/[\w-]+$/));
    const id = pathOf(router).split('/').pop();
    const ask = await screen.findByRole('dialog', { name: 'Printed OK?' });
    await user.click(within(ask).getByRole('button', { name: 'No, print again' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const bar = screen.getByRole('region', { name: 'Not confirmed as printed' });
    await user.click(within(bar).getByRole('button', { name: 'Yes, printed OK' }));
    await waitFor(() =>
      expect(
        state.capture.labelBatches.find((b) => b.id === id)?.printedConfirmedAt,
      ).not.toBeNull(),
    );
  });

  it('the same things again offer the sheet already made instead of a duplicate', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => {});
    const state = ownerScenario();
    const first = await renderApp(`/labels?loc=${IDS.home}&things=${T.hdmiCable},${T.box3}`, {
      state,
    });
    await first.user.click(await screen.findByRole('button', { name: 'Print 2 labels' }));
    await waitFor(() => expect(pathOf(first.router)).toMatch(/^\/labels\/[\w-]+$/));
    const id = pathOf(first.router).split('/').pop() as string;
    first.unmount();

    await renderApp(`/labels?loc=${IDS.home}&things=${T.box3},${T.hdmiCable}`, { state });
    const offer = await screen.findByRole('region', {
      name: 'These labels are already on a sheet that isn’t confirmed printed',
    });
    expect(within(offer).getByRole('link', { name: 'Open that sheet' })).toHaveAttribute(
      'href',
      `/labels/${id}`,
    );
    // Still possible to print a new one.
    expect(screen.getByRole('button', { name: 'Print 2 labels' })).toBeEnabled();
  });
});

describe('names too long for the label', () => {
  it('the builder lists them before printing, with a link to rename each', async () => {
    const state = ownerScenario();
    const box = state.inventory.things.find((x) => x.id === T.box3);
    if (!box) throw new Error('no box');
    box.name = 'Storage box for the winter clothes '.repeat(6).trim();
    const { user } = await renderApp(`/labels?loc=${IDS.home}&things=${T.hdmiCable},${T.box3}`, {
      state,
    });
    await screen.findByRole('button', { name: 'Print 2 labels' });
    await user.click(screen.getByRole('radio', { name: /40 × 30 mm roll/ }));
    const warn = await screen.findByRole('region', { name: '1 name is too long for this label' });
    expect(within(warn).getByText(box.name)).toBeInTheDocument();
    expect(
      within(warn).getByRole('link', { name: `Rename ${FSI}${box.name}${PDI}` }),
    ).toHaveAttribute('href', `/t/${T.box3}`);
    // On the A4 sheet the same name fits.
    await user.click(screen.getByRole('radio', { name: /A4 sheet · 24 labels/ }));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: /too long for this label/ })).toBeNull(),
    );
  });
});

describe('nothing is cut short', () => {
  it('no truncate, line-clamp or ellipsis on the labels screen, the builder or the print view', async () => {
    const state = ownerScenario();
    const cable = state.inventory.things.find((x) => x.id === T.hdmiCable);
    if (!cable) throw new Error('no cable');
    cable.name = 'Spare cables box (HDMI, USB-A to USB-C, Lightning, DisplayPort, audio)';
    const list = await renderApp('/labels', { state });
    await screen.findByRole('heading', { name: 'Recent batches' });
    expect(cutters()).toEqual([]);
    list.unmount();

    vi.spyOn(window, 'print').mockImplementation(() => {});
    const builder = await renderApp(`/labels?loc=${IDS.home}&things=${T.hdmiCable},${T.box3}`, {
      state,
    });
    await screen.findByRole('button', { name: 'Print 2 labels' });
    expect(cutters()).toEqual([]);
    await builder.user.click(screen.getByRole('button', { name: 'Print 2 labels' }));
    await screen.findByRole('region', { name: 'Sheet 1 of 1', hidden: true });
    expect(cutters()).toEqual([]);
    const sheet = screen.getByRole('region', { name: 'Sheet 1 of 1', hidden: true });
    expect(sheet.textContent).not.toMatch(/…/);
  });
});

describe('recent batches', () => {
  it('say what each holds, where, on what, when, and whether it printed, newest first', async () => {
    const state = ownerScenario();
    vi.spyOn(window, 'print').mockImplementation(() => {});
    const made = await renderApp(`/labels?loc=${IDS.home}&things=${T.hdmiCable},${T.box3}`, {
      state,
    });
    await made.user.click(await screen.findByRole('button', { name: 'Print 2 labels' }));
    await waitFor(() => expect(pathOf(made.router)).toMatch(/^\/labels\/[\w-]+$/));
    made.unmount();

    const { user } = await renderApp('/labels', { state });
    const section = (await screen.findByRole('heading', { name: 'Recent batches' })).closest(
      'section',
    ) as HTMLElement;
    const rows = within(section).getAllByRole('article');
    const newest = rows[0] as HTMLElement;
    const blank = rows[1] as HTMLElement;
    expect(
      within(newest).getByText(`2 labels: ${FSI}HDMI cable, 2 m${PDI} and ${FSI}Box 3${PDI}`),
    ).toBeInTheDocument();
    expect(newest).toHaveTextContent('Home');
    expect(newest).toHaveTextContent('A4 sheet · 24 labels');
    expect(newest).toHaveTextContent(/\d{2}:\d{2}/);
    expect(within(newest).getByText('Not confirmed')).toBeInTheDocument();
    expect(blank).toHaveTextContent(/\d+ blank labels/);

    // Confirmed from the list, the right one.
    await user.click(within(newest).getByRole('button', { name: 'Printed OK' }));
    await waitFor(() => expect(within(newest).getByText('Printed')).toBeInTheDocument());
    const newestId = state.capture.labelBatches[0]?.id;
    expect(state.capture.labelBatches[0]?.printedConfirmedAt).not.toBeNull();
    // The old blank sheet set aside, not printed.
    await user.click(within(blank).getByRole('button', { name: 'Not printed' }));
    await waitFor(() => expect(within(blank).getByText('Set aside')).toBeInTheDocument());
    const old = state.capture.labelBatches.find((b) => b.id !== newestId && b.kind === 'blank');
    expect(old?.dismissedAt).not.toBeNull();
    expect(old?.printedConfirmedAt).toBeNull();
  });
});

describe('where printing starts', () => {
  it("a place's page prints its label, and everything unprinted inside it", async () => {
    const { user, router } = await renderApp(`/p/${INV_IDS.place.office}`);
    await findHeading('Office');
    await user.click(screen.getByRole('button', { name: /^Print its label/ }));
    await waitFor(() => expect(pathOf(router)).toBe('/labels'));
    expect(router.state.location.search).toMatchObject({
      loc: IDS.home,
      places: INV_IDS.place.office,
    });
    expect(await screen.findByRole('img', { name: 'R00M4K' })).toBeInTheDocument();
  });

  it("a place's Add a label code opens the scanner for that place (#329)", async () => {
    const { user, router } = await renderApp(`/p/${INV_IDS.place.office}`);
    await findHeading('Office');
    await user.click(screen.getByRole('button', { name: /^Add a label code/ }));
    await waitFor(() => expect(pathOf(router)).toBe('/scan'));
    expect(router.state.location.search).toEqual({ place: INV_IDS.place.office });
  });

  it('"Label everything here" offers things or places; places lists every place inside, never-labelled ones too', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => {});
    const office = INV_IDS.place.office;
    const state = ownerScenario();
    const { user, router } = await renderApp(`/p/${office}`, { state });
    await findHeading('Office');
    await user.click(screen.getByRole('button', { name: /^Label everything here/ }));
    await waitFor(() => expect(pathOf(router)).toBe('/labels'));
    const what = await screen.findByRole('radiogroup', { name: 'What to label' });
    expect(within(what).getByRole('radio', { name: 'Things' })).toBeChecked();
    await user.click(within(what).getByRole('radio', { name: 'Places' }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        loc: IDS.home,
        unprinted: 1,
        place: office,
        kind: 'places',
      }),
    );
    // The office has its code; its desk drawer never had one, and is given one to print with.
    expect(await screen.findByRole('img', { name: 'R00M4K' })).toBeInTheDocument();
    const drawer = state.inventory.places.find((x) => x.id === INV_IDS.place.deskDrawer);
    expect(drawer?.shortCode).toMatch(/^[0-9A-Z]{6}$/);
    expect(screen.getByRole('img', { name: drawer?.shortCode as string })).toBeInTheDocument();
    expect(screen.getAllByText('Desk drawer').length).toBeGreaterThan(0);
    const posts = batchPosts();
    await user.click(screen.getByRole('button', { name: 'Print 2 labels' }));
    await waitFor(() => expect(pathOf(router)).toMatch(/^\/labels\/[\w-]+$/));
    expect(posts()).toEqual(['create']);
    const create = vi
      .mocked(globalThis.fetch)
      .mock.calls.find(([url]) => String(url).endsWith('/api/v1/labels/batches'));
    expect(JSON.parse(String(create?.[1]?.body))).toMatchObject({
      kind: 'places',
      unprinted: { placeId: office },
    });
  });

  it('a list of chosen things has no things-or-places choice', async () => {
    await renderApp(`/labels?loc=${IDS.home}&things=${T.hdmiCable}`);
    expect(await screen.findByRole('img', { name: '7KQ4MZ' })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'What to label' })).toBeNull();
  });

  it("a thing's Label sheet opens the builder for that thing", async () => {
    const { user, router } = await renderApp(`/t/${T.box3}`);
    await findHeading('Box 3');
    await user.click(await screen.findByRole('button', { name: 'Actions' }));
    await user.click(await screen.findByRole('menuitem', { name: /^Label/ }));
    await user.click(await screen.findByRole('link', { name: 'Print its label' }));
    await waitFor(() => expect(pathOf(router)).toBe('/labels'));
    expect(router.state.location.search).toMatchObject({ loc: IDS.home, things: T.box3 });
  });
});

describe('the print view', () => {
  const batch = (over: Partial<LabelBatch> = {}): LabelBatch => ({
    id: '01926f00-0000-7000-8000-000000100099',
    locationId: IDS.family,
    kind: 'things',
    stock: 'thermal_50x30',
    startCell: 1,
    createdAt: '2026-10-06T08:00:00Z',
    printedConfirmedAt: null,
    dismissedAt: null,
    labels: [
      {
        code: 'AR7HDM',
        url: 'https://kept.example/l/AR7HDM',
        kind: 'thing',
        name: 'كابل HDMI',
        path: 'غرفة المعيشة',
        targetId: T.arHdmi,
      },
    ],
    ...over,
  });

  it('keeps an Arabic name in its own direction and the code left to right, in Arabic', async () => {
    const state = ownerScenario();
    state.capture.labelBatches.unshift(batch());
    await renderApp('/labels/01926f00-0000-7000-8000-000000100099', { state, locale: 'ar' });
    const sheet = await screen.findByRole('region', { name: 'الورقة ١ من ١' });
    const name = within(sheet).getByText('كابل HDMI');
    expect(name.closest('p')).toHaveAttribute('dir', 'auto');
    const code = within(sheet).getByText('AR7‑HDM');
    expect(code.tagName).toBe('BDI');
    expect(code).toHaveAttribute('dir', 'ltr');
    // The paper is laid out left to right like the maker's sheet, whatever the page's direction.
    expect(sheet).toHaveAttribute('dir', 'ltr');
    expectLogicalOnly();
  });

  it('puts the title on its own row on a phone, the actions under it, Print first', async () => {
    const state = ownerScenario();
    state.capture.labelBatches.unshift(batch());
    await renderApp('/labels/01926f00-0000-7000-8000-000000100099', { state });
    const title = await screen.findByRole('heading', { level: 1, name: '1 label' });
    const actions = document.querySelector('[data-slot="label-actions"]') as HTMLElement;
    // Not in the title's row: the actions are a sibling of the row holding the back link.
    expect(actions.contains(title)).toBe(false);
    expect(title.closest('div.flex')?.contains(actions)).toBe(false);
    expect(
      within(actions)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Print', 'Share as images']);
    expect(actions).toHaveClass('grid-cols-2', 'md:flex-row-reverse');
    expect(screen.getByRole('link', { name: 'Back to labels' })).toBeInTheDocument();
  });

  it('prints tape one label a page at its size, the code with no QR', async () => {
    const state = ownerScenario();
    state.capture.labelBatches.unshift(batch({ stock: 'tape_12' }));
    await renderApp('/labels/01926f00-0000-7000-8000-000000100099', { state });
    const sheet = await screen.findByRole('region', { name: 'Sheet 1 of 1' });
    expect(sheet.style.inlineSize).toBe('50mm');
    expect(sheet.style.blockSize).toBe('11.9mm');
    expect(within(sheet).getByText('AR7‑HDM')).toBeInTheDocument();
    expect(within(sheet).getByText('كابل HDMI')).toBeInTheDocument();
    expect(sheet.querySelector('[data-slot="label-qr"]')).toBeNull();
    expect(screen.getByText('12 mm tape')).toBeInTheDocument();
    expect(
      screen.getByText('In the print dialog choose your label printer and this label size.'),
    ).toBeInTheDocument();
  });

  it('on a compact stock prints only the QR and the code', async () => {
    const state = ownerScenario();
    state.capture.labelBatches.unshift(batch({ stock: 'a4_65_38x21', startCell: 3 }));
    await renderApp('/labels/01926f00-0000-7000-8000-000000100099', { state });
    const sheet = await screen.findByRole('region', { name: 'Sheet 1 of 1' });
    expect(within(sheet).getByText('AR7‑HDM')).toBeInTheDocument();
    expect(within(sheet).queryByText('كابل HDMI')).toBeNull();
    expect(sheet.querySelector('[data-cell="3"]')).not.toBeNull();
  });
});
