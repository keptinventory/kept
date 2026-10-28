/**
 * What's new in Kept: after the app updates to a new version, a small card with that release's
 * Highlights, once per version per person (the person's `whats_new.<version>` hint, on the
 * server). Never on a brand-new account (no hint rows at all: the current one is recorded, nothing
 * shown); anyone with a row used Kept before and sees it once. Never over Capture or Scan, Got it
 * records it, and Help shows it again.
 * The build's version and highlights come from `virtual:kept-whats-new`, here an invented release.
 */
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { inventoryPaths } from '@/api/inventory/paths';
import { ownerScenario } from '@/api/mock/fixtures';
import { hintSlot } from '@/components/hints/use-hint';
import { whatsNew } from '@/components/whats-new';
import { expectLogicalOnly } from '@/test/render';
import { findHeading, renderApp } from '../app';

vi.mock('virtual:kept-whats-new', () => ({
  default: {
    version: '9.4.2',
    highlights: [
      '**Shelf view.** Every shelf of a room side by side, with what is on it (#901).',
      '**Small fixes.** The search field keeps its words after Back.',
    ],
  },
}));

const KEY = 'whats_new.9.4.2';
const at = new Date().toISOString();

/** A person who saw an earlier version's card. */
function updated() {
  const state = ownerScenario();
  state.inventory.hints.push({ key: 'whats_new.9.4.1', seenAt: at, dismissedAt: at });
  return state;
}

afterEach(() => {
  // A card left open must not leak into the next test: unmounted first, so no host opens it again.
  cleanup();
  whatsNew.reset();
  hintSlot.release('whats_new');
});

const card = () => screen.queryByRole('dialog', { name: "What's new in Kept" });

describe("What's new", () => {
  it('shows the new version’s highlights once, and Got it records the version', async () => {
    const { user, mock } = await renderApp('/', { state: updated() });
    const dialog = await screen.findByRole('dialog', { name: "What's new in Kept" });
    expect(dialog).toHaveTextContent('Version 9.4.2');
    // The highlights as plain text, their lead in bold, in English.
    const list = within(dialog).getByRole('list');
    expect(list).toHaveAttribute('lang', 'en');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByText('Shelf view.').tagName).toBe('STRONG');
    expect(list).toHaveTextContent(
      'Every shelf of a room side by side, with what is on it (#901).',
    );
    expect(within(dialog).getByRole('link', { name: /Full release notes/ })).toHaveAttribute(
      'href',
      'https://github.com/keptinventory/kept/releases/tag/v9.4.2',
    );
    expectLogicalOnly();
    await user.click(within(dialog).getByRole('button', { name: 'Got it' }));
    await waitFor(() => expect(card()).toBeNull());
    await waitFor(() =>
      expect(mock.lastCall('PUT', inventoryPaths.hint(KEY))?.body).toEqual({ dismissed: true }),
    );
  });

  it('is not shown again once this version is recorded', async () => {
    const state = updated();
    state.inventory.hints.push({ key: KEY, seenAt: at, dismissedAt: at });
    const { mock } = await renderApp('/', { state });
    await findHeading(/Home/);
    await new Promise((r) => setTimeout(r, 300));
    expect(card()).toBeNull();
    expect(mock.lastCall('PUT', inventoryPaths.hint(KEY))).toBeUndefined();
  });

  it('shows once to someone who used Kept before What’s new existed (a tour chapter done)', async () => {
    const state = ownerScenario();
    state.inventory.hints.push({ key: 'help.tours.basics', seenAt: at, dismissedAt: at });
    const { user, mock } = await renderApp('/', { state });
    const dialog = await screen.findByRole('dialog', { name: "What's new in Kept" });
    await user.click(within(dialog).getByRole('button', { name: 'Got it' }));
    await waitFor(() => expect(card()).toBeNull());
    await waitFor(() =>
      expect(mock.lastCall('PUT', inventoryPaths.hint(KEY))?.body).toEqual({ dismissed: true }),
    );
  });

  it('on a brand-new account (no hints at all) records the version and shows nothing', async () => {
    const { mock } = await renderApp('/');
    await waitFor(() =>
      expect(mock.lastCall('PUT', inventoryPaths.hint(KEY))?.body).toEqual({ dismissed: true }),
    );
    expect(card()).toBeNull();
  });

  it('waits until the person leaves Capture', async () => {
    const { router, mock } = await renderApp('/capture', { state: updated() });
    await screen.findByRole('radiogroup', { name: 'Capture mode' });
    await new Promise((r) => setTimeout(r, 300));
    expect(card()).toBeNull();
    expect(mock.lastCall('PUT', inventoryPaths.hint(KEY))).toBeUndefined();
    await router.navigate({ to: '/' });
    expect(await screen.findByRole('dialog', { name: "What's new in Kept" })).toBeInTheDocument();
  });

  it('waits on a scan session too', async () => {
    const { mock } = await renderApp('/scan-session', { state: updated() });
    await new Promise((r) => setTimeout(r, 500));
    expect(card()).toBeNull();
    expect(mock.lastCall('PUT', inventoryPaths.hint(KEY))).toBeUndefined();
  });

  it('comes back from Help any time', async () => {
    const state = updated();
    state.inventory.hints.push({ key: KEY, seenAt: at, dismissedAt: at });
    const { user } = await renderApp('/help', { state });
    await findHeading('Help');
    expect(card()).toBeNull();
    expect(screen.getByRole('main')).toHaveTextContent('Version 9.4.2: its highlights.');
    await user.click(screen.getByRole('button', { name: "What's new" }));
    const dialog = await screen.findByRole('dialog', { name: "What's new in Kept" });
    await user.click(within(dialog).getByRole('button', { name: 'Got it' }));
    await waitFor(() => expect(card()).toBeNull());
  });

  it('in Arabic, its own words are translated and the highlights say they are in English', async () => {
    const { user } = await renderApp('/', { state: updated(), locale: 'ar' });
    const dialog = await screen.findByRole('dialog', { name: 'ما الجديد في Kept' });
    expect(within(dialog).getByRole('list')).toHaveAttribute('dir', 'ltr');
    expect(dialog).toHaveTextContent('ملاحظات الإصدار بالإنجليزية.');
    await user.click(within(dialog).getByRole('button', { name: 'فهمت' }));
    await waitFor(() => expect(card()).toBeNull());
  });
});
