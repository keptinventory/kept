/**
 * Names first; the amber tape means a printed label. In lists, search results and the palette a
 * thing without a printed label shows no code (its name only), one with a printed label shows the
 * tape. On a thing's or a place's own page an unlabelled code shows quietly, after the rest, and a
 * labelled one as the tape. Confirming "Printed OK?" turns the chip to tape, printing like tape.
 */
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { INV_IDS } from '@/api/inventory/mock/fixtures';
import { IDS } from '@/api/mock/fixtures';
import type { MockApi } from '@/api/mock/server';
import { findHeading, pathOf, renderApp } from '@/test/app';
import { expectLogicalOnly } from '@/test/render';

vi.setConfig({ testTimeout: 15_000 });

const T = INV_IDS.thing;
const P = INV_IDS.place;

/** Motion allowed (jsdom has no matchMedia: the chip would never print). */
function motionOk() {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: false,
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

/** In the kitchen: the kettle has a code and no printed label; the extinguisher has one. */
function kitchenCodes(mock: MockApi) {
  const things = mock.state.inventory.things;
  const kettle = things.find((x) => x.id === T.kettle);
  const extinguisher = things.find((x) => x.id === T.extinguisher);
  if (!kettle || !extinguisher) throw new Error('fixture');
  kettle.shortCode = 'K3TL7Q';
  kettle.labelPrinted = false;
  extinguisher.shortCode = 'F1R3XT';
  extinguisher.labelPrinted = true;
}

/** The TV and the office have codes but no printed label. */
function unlabelled(mock: MockApi) {
  const tv = mock.state.inventory.things.find((x) => x.id === T.tv);
  const office = mock.state.inventory.places.find((x) => x.id === P.office);
  if (!tv || !office) throw new Error('fixture');
  tv.labelPrinted = false;
  office.labelPrinted = false;
}

const rowOf = (name: RegExp) => screen.getByRole('link', { name }).closest('li') as HTMLElement;

describe('lists', () => {
  it('a row with no printed label has no code; a labelled one has the amber tape', async () => {
    await renderApp(`/p/${P.kitchen}`, { setup: kitchenCodes });
    await findHeading('Kitchen');
    await screen.findByRole('link', { name: /Old kettle/ });
    expect(within(rowOf(/Old kettle/)).queryByRole('img', { name: 'K3TL7Q' })).toBeNull();
    expect(screen.queryByText('K3T‑L7Q')).toBeNull();
    const tape = within(rowOf(/Fire extinguisher/)).getByRole('img', { name: 'F1R3XT' });
    expect(tape).toHaveAttribute('data-variant', 'tape');
  });

  it('in Arabic the tape stays left to right and the list keeps logical CSS', async () => {
    await renderApp(`/p/${P.kitchen}`, { setup: kitchenCodes, locale: 'ar' });
    const tape = await screen.findByRole('img', { name: 'F1R3XT' });
    expect(tape).toHaveAttribute('dir', 'ltr');
    expectLogicalOnly();
  });

  it('search results show the tape only on what has a printed label', async () => {
    await renderApp('/search?q=samsung', { setup: unlabelled });
    const list = await screen.findByRole('list', { name: 'Things found' }, { timeout: 3000 });
    within(list).getByRole('link', { name: /Samsung TV/ });
    // The TV's code (5MT0QD) was never printed.
    expect(within(list).queryByRole('img', { name: '5MT0QD' })).toBeNull();
  });

  it('the palette shows the tape on a labelled thing and no code on an unlabelled one', async () => {
    const { user } = await renderApp(`/loc/${IDS.home}`, { setup: kitchenCodes });
    await findHeading('Home');
    await user.keyboard('{Control>}k{/Control}');
    const dialog = await screen.findByRole('dialog', { name: 'Search or jump to' });
    const input = within(dialog).getByRole('combobox', { name: 'Search or jump to' });
    await user.type(input, 'kettle');
    const kettle = await within(dialog).findByRole('option', { name: /Old kettle/ });
    expect(within(kettle).queryByRole('img', { name: 'K3TL7Q' })).toBeNull();
    await user.clear(input);
    await user.type(input, 'extinguisher');
    const ext = await within(dialog).findByRole('option', { name: /Fire extinguisher/ });
    expect(within(ext).getByRole('img', { name: 'F1R3XT' })).toHaveAttribute(
      'data-variant',
      'tape',
    );
  });
});

describe("a thing's page", () => {
  it('shows an unlabelled code quietly, after its type, not first', async () => {
    await renderApp(`/t/${T.tv}`, { setup: unlabelled });
    await findHeading('Samsung TV, 55″');
    const code = screen.getByRole('img', { name: '5MT0QD' });
    expect(code).toHaveAttribute('data-variant', 'quiet');
    const type = screen.getAllByText('TV / display')[0] as HTMLElement;
    // The type comes before the code in the header.
    expect(type.compareDocumentPosition(code) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows a labelled one as the tape', async () => {
    await renderApp('/t/7KQ4MZ');
    await findHeading('HDMI cable, 2 m');
    expect(screen.getByRole('img', { name: '7KQ4MZ' })).toHaveAttribute('data-variant', 'tape');
  });
});

describe("a place's page", () => {
  it('shows an unlabelled code quietly, and "Your codes" after the contents', async () => {
    await renderApp(`/p/${P.office}`, { setup: unlabelled });
    await findHeading('Office');
    const codes = await screen.findAllByRole('img', { name: 'R00M4K' });
    for (const c of codes) expect(c).toHaveAttribute('data-variant', 'quiet');
    const yours = await screen.findByRole('heading', { name: 'Your codes' });
    // The contents' row (and the place tree's link) come before it.
    for (const link of await screen.findAllByRole('link', { name: /Desk drawer/ }))
      expect(link.compareDocumentPosition(yours) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('"Printed OK?"', () => {
  it('turns the code to tape, which prints like tape on the thing page once', async () => {
    motionOk();
    vi.spyOn(window, 'print').mockImplementation(() => {});
    const { user, router } = await renderApp(`/labels?loc=${IDS.home}&things=${T.tv}`, {
      setup: unlabelled,
    });
    await findHeading('Print labels');
    expect(await screen.findByRole('img', { name: '5MT0QD' })).toHaveAttribute(
      'data-variant',
      'quiet',
    );
    await user.click(screen.getByRole('button', { name: 'Print 1 label' }));
    const ask = await screen.findByRole('dialog', { name: 'Printed OK?' });
    await user.click(within(ask).getByRole('button', { name: 'Yes, printed OK' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Printed OK?' })).toBeNull());
    await router.navigate({ to: '/t/$id', params: { id: T.tv } });
    await waitFor(() => expect(pathOf(router)).toBe(`/t/${T.tv}`));
    const tape = await screen.findByRole('img', { name: '5MT0QD' });
    await waitFor(() => expect(tape).toHaveAttribute('data-variant', 'tape'));
    expect(screen.getByRole('img', { name: '5MT0QD' })).toHaveAttribute('data-printing', 'true');
  });
});
