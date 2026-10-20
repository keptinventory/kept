/**
 * The Room card (#194), against the mock server: it heads its batch above the drafts the photos
 * made, names its sections, adds furniture as places, marks things seen (a label read in the
 * photos starts ticked), and Done asks first, saying the photos are deleted.
 */

import { newId } from '@kept/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeRoom } from '@/api/capture/mock/room';
import { capturePaths } from '@/api/capture/paths';
import { INV_IDS } from '@/api/inventory/mock/fixtures';
import { ownerScenario } from '@/api/mock/fixtures';
import { findHeading, renderApp } from '@/test/app';
import { expectLogicalOnly } from '@/test/render';

function withRoom() {
  const state = ownerScenario();
  const office = INV_IDS.place.office;
  const locationId = state.inventory.places.find((p) => p.id === office)?.locationId as string;
  const lamp = state.inventory.things.find(
    (t) => t.placeId === office && t.reviewState !== 'draft' && !t.deletedAt,
  );
  const item = makeRoom(state, {
    id: newId(),
    locationId,
    batchId: newId(),
    placeId: office,
    containerId: null,
    photos: 2,
    ...(lamp ? { codeThingIds: [lamp.id] } : {}),
  });
  return { state, item, coded: lamp };
}

describe('the Room card', () => {
  it('heads its batch, above its drafts, and says what the photos gave', async () => {
    const { state, item } = withRoom();
    await renderApp('/inbox', { state });
    await findHeading('Inbox');
    const list = await screen.findByRole('list', { name: 'Inbox' }, { timeout: 3000 });
    const card = await within(list).findByRole('article', { name: /^Photos of / });
    const articles = within(list).getAllByRole('article');
    const at = articles.indexOf(card);
    // The drafts it made come straight after it.
    expect(articles[at + 1]).toHaveAccessibleName('Floor cushion');
    expect(card.textContent).toMatch(/4 new things to review below/);
    expect(within(card).getByText('Photo 1: 5 things')).toBeInTheDocument();
    expect(
      within(card).getByRole('region', { name: 'Furniture that holds things' }),
    ).toBeInTheDocument();
    expect(item.room?.places[0]?.name).toBe('Bookcase');
  });

  it('adds furniture as a place, and marks ticked things seen', async () => {
    const { state, item, coded } = withRoom();
    const { user, mock } = await renderApp('/inbox', { state });
    const card = await screen.findByRole('article', { name: /^Photos of / }, { timeout: 3000 });
    await user.click(within(card).getByRole('button', { name: 'Add as a place' }));
    await waitFor(() =>
      expect(mock.lastCall('POST', capturePaths.inboxRoomPlaces(item.id))?.body).toEqual({
        indexes: [0],
      }),
    );
    if (coded) {
      const already = await within(card).findByRole('region', { name: 'Already in Kept' });
      // A label read in the photos: ticked already.
      expect(
        within(already).getByRole('checkbox', { name: new RegExp(coded.name ?? '') }),
      ).toBeChecked();
      await user.click(within(already).getByRole('button', { name: /^Mark \d+ seen$/ }));
      await waitFor(() =>
        expect(mock.lastCall('POST', capturePaths.inboxRoomSeen(item.id))?.body).toEqual({
          thingIds: [coded.id],
        }),
      );
    }
  });

  it('asks before Done, saying the full photos are deleted', async () => {
    const { state, item } = withRoom();
    const { user, mock } = await renderApp('/inbox', { state });
    const card = await screen.findByRole('article', { name: /^Photos of / }, { timeout: 3000 });
    await user.click(within(card).getByRole('button', { name: 'Done' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toMatch(/The full photos are deleted/);
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(mock.lastCall('POST', capturePaths.inboxRoomDone(item.id))).toBeTruthy(),
    );
  });

  it('mirrors in Arabic', async () => {
    const { state } = withRoom();
    await renderApp('/inbox', { state, locale: 'ar' });
    expect((await screen.findAllByRole('article', {}, { timeout: 3000 })).length).toBeGreaterThan(
      1,
    );
    expectLogicalOnly(document.body);
  });
});
