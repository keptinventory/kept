import type { VisualSearchCoverage, VisualSearchMatch } from '@kept/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { INV_IDS } from '@/api/inventory/mock/fixtures';
import { inventoryPaths } from '@/api/inventory/paths';
import { IDS } from '@/api/mock/fixtures';
import { reply } from '@/api/mock/kit';
import { visualSearchPaths as p } from '@/api/visual-search/paths';
import { renderApp } from '@/test/app';

const id = '00000000-0000-4000-8000-000000000001';
const photo = new File(['test photograph'], 'query.png', { type: 'image/png' });
const coverage: VisualSearchCoverage = {
  generation: 'visual-test-v1',
  ready: 1,
  pending: 0,
  failed: 0,
  paused: 0,
};
const match: VisualSearchMatch = {
  thingId: INV_IDS.thing.cableBox,
  locationId: IDS.home,
  name: 'Cable box',
  path: [
    { id: IDS.home, name: 'Home' },
    { id: INV_IDS.place.office, name: 'Office' },
  ],
  attachmentId: id,
  fileId: id,
  capturedAt: '2026-11-23T12:00:00.000Z',
  score: 0.75,
};

describe('visual search in the search screen', () => {
  it('keeps the ordinary result and opens stored evidence through the authorized media API', async () => {
    const { user, mock } = await renderApp(`/search?q=hdmi&f.location=${IDS.home}`, {
      setup(mock) {
        mock.on('GET', p.status, ({ query }) => {
          expect(query.get('locationIds')).toBe(IDS.home);
          return coverage;
        });
        mock.on('POST', p.search, () => ({ outcome: 'matches', coverage, matches: [match] }));
        mock.on('POST', inventoryPaths.fileUrl(id), ({ query }) => {
          expect(query.get('thingId')).toBe(match.thingId);
          return { url: '/f/visual-test-evidence' };
        });
      },
    });
    expect(await screen.findByRole('link', { name: /HDMI cable, 2 m/ })).toBeVisible();
    await user.click(await screen.findByRole('button', { name: 'Find in photos' }));
    const results = await screen.findByRole('list', { name: 'Possible photo matches' });
    expect(within(results).getByRole('link', { name: 'Cable box' })).toHaveAttribute(
      'href',
      `/t/${match.thingId}`,
    );
    expect(results).toHaveTextContent(/Recorded location.*Home.*Office/);
    expect(mock.lastCall('POST', p.search)?.body).toEqual({
      text: 'hdmi',
      locationIds: [IDS.home],
    });
    expect(mock.lastCall('POST', inventoryPaths.fileUrl(id))).toBeUndefined();
    await user.click(within(results).getByRole('button', { name: 'View stored photo' }));
    expect(await screen.findByRole('img', { name: 'Cable box' })).toHaveAttribute(
      'src',
      '/f/visual-test-evidence',
    );
    expect(mock.lastCall('POST', inventoryPaths.fileUrl(id))?.body).toEqual({ variant: 'display' });
  });

  it('uploads a private photo, searches by its handle, and releases it after an incomplete result', async () => {
    const { user, mock, container } = await renderApp('/search', {
      setup(mock) {
        mock.on('GET', p.status, () => coverage);
        mock.on('POST', p.input, () => reply(201, { inputId: id, expiresAt: match.capturedAt }));
        mock.on('POST', p.search, () => ({
          outcome: 'partial_coverage',
          coverage: { ...coverage, pending: 2 },
          matches: [],
        }));
        mock.on('DELETE', p.inputById(id), () => reply(204));
      },
    });
    await screen.findByRole('button', { name: 'Search with a photo' });
    const chooser = container.querySelector<HTMLInputElement>('input[type="file"][accept]');
    if (!chooser) throw new Error('Expected the photo chooser');
    await user.upload(chooser, photo);
    expect(await screen.findByText('Photo indexing is incomplete.')).toBeVisible();
    expect(mock.lastCall('POST', p.input)).toMatchObject({
      body: photo,
      headers: { 'content-type': 'image/png' },
    });
    expect(mock.lastCall('POST', p.search)?.body).toEqual({ inputId: id });
    await waitFor(() => expect(mock.lastCall('DELETE', p.inputById(id))).toBeDefined());
  });
});
