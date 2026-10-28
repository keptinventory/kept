/**
 * The header photo, full screen (#295): tapping it opens the photo it showed, Next, the arrow
 * keys and a swipe go through the others (mirrored in Arabic), Zoom in shows it at full size with
 * the arrows and swipes left to looking around it, and Escape or Back close it on the photo it was
 * left at, with focus back on it.
 */
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PIXEL } from '@/api/inventory/mock/files';
import { INV_IDS } from '@/api/inventory/mock/fixtures';
import type { AttachmentView } from '@/api/inventory/types';
import { type MockState, ownerScenario } from '@/api/mock/fixtures';
import { renderThingPart } from '@/test/thing-part';
import { PhotoCarousel } from './photos';

vi.setConfig({ testTimeout: 20_000 });

const photo = (id: string): AttachmentView => ({
  id,
  role: 'photo',
  sort: 0,
  file: {
    id: `${id}-file`,
    sha256: id.padEnd(64, '0'),
    bytes: 1,
    mime: 'image/png',
    class: 'photo',
    hasGps: false,
    width: 1,
    height: 1,
    derivativeState: 'ready',
    thumbUrl: PIXEL,
    displayUrl: PIXEL,
  },
  url: null,
  subject: { thingId: INV_IDS.thing.tv },
  createdBy: { displayName: 'Ibrahim' },
  rowVersion: 1,
});

function withPhotos(count: number): MockState {
  const s = ownerScenario();
  const tv = s.inventory.things.find((t) => t.id === INV_IDS.thing.tv);
  if (!tv) throw new Error('no TV in the fixtures');
  tv.photos = Array.from({ length: count }, (_, n) => photo(`photo-${n + 1}`));
  return s;
}

const render = (locale: 'en' | 'ar' = 'en') =>
  renderThingPart(<PhotoCarousel />, {
    thingId: INV_IDS.thing.tv,
    state: withPhotos(3),
    locale,
    digits: 'western',
  });

/** The viewer's photo area, which takes the swipes and, zoomed in, focus. */
const stageOf = (viewer: HTMLElement) =>
  within(viewer).getByRole('img').parentElement as HTMLElement;

/** A finger across the photo, from `from` to `to` (px from the left). */
function swipe(el: HTMLElement, from: number, to: number) {
  fireEvent.touchStart(el, { touches: [{ clientX: from }] });
  fireEvent.touchEnd(el, { changedTouches: [{ clientX: to }] });
}

// The viewer's history entry comes back off on a later task (ui/close-on-back.tsx): let it land
// here, not in the next case.
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  window.history.replaceState(null, '');
});

describe('a photo full screen', () => {
  it('tapping the photo opens it, and Next and the arrow keys go through the others', async () => {
    const { user } = await render();
    await user.click(await screen.findByRole('button', { name: 'Photo 1 of 3' }));
    const viewer = await screen.findByRole('dialog', { name: 'Photos' });
    expect(within(viewer).getByRole('img', { name: 'Photo 1 of 3' })).toBeInTheDocument();
    await user.click(within(viewer).getByRole('button', { name: 'Next photo' }));
    expect(within(viewer).getByRole('img', { name: 'Photo 2 of 3' })).toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    expect(within(viewer).getByRole('img', { name: 'Photo 3 of 3' })).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}');
    expect(within(viewer).getByRole('img', { name: 'Photo 2 of 3' })).toBeInTheDocument();
  });

  it('a swipe to the left goes to the next photo, and to the right back', async () => {
    const { user } = await render();
    await user.click(await screen.findByRole('button', { name: 'Photo 1 of 3' }));
    const viewer = await screen.findByRole('dialog', { name: 'Photos' });
    swipe(stageOf(viewer), 300, 100);
    expect(within(viewer).getByRole('img', { name: 'Photo 2 of 3' })).toBeInTheDocument();
    swipe(stageOf(viewer), 100, 300);
    expect(within(viewer).getByRole('img', { name: 'Photo 1 of 3' })).toBeInTheDocument();
  });

  it('keys held with Alt, Ctrl or Meta are left to the browser', async () => {
    const { user } = await render();
    await user.click(await screen.findByRole('button', { name: 'Photo 1 of 3' }));
    const viewer = await screen.findByRole('dialog', { name: 'Photos' });
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}{Control>}{ArrowRight}{/Control}');
    await user.keyboard('{Meta>}{ArrowRight}{/Meta}');
    expect(within(viewer).getByRole('img', { name: 'Photo 1 of 3' })).toBeInTheDocument();
  });

  it('Zoom in shows it at full size, and Zoom out fits it again', async () => {
    const { user } = await render();
    await user.click(await screen.findByRole('button', { name: 'Photo 1 of 3' }));
    const viewer = await screen.findByRole('dialog', { name: 'Photos' });
    await user.click(within(viewer).getByRole('button', { name: 'Zoom in' }));
    expect(within(viewer).queryByRole('button', { name: 'Zoom in' })).toBeNull();
    await user.click(within(viewer).getByRole('button', { name: 'Zoom out' }));
    expect(within(viewer).getByRole('button', { name: 'Zoom in' })).toBeInTheDocument();
  });

  it('zoomed in, the photo takes focus, and the arrow keys and a swipe stay on it', async () => {
    const { user } = await render();
    await user.click(await screen.findByRole('button', { name: 'Photo 1 of 3' }));
    const viewer = await screen.findByRole('dialog', { name: 'Photos' });
    await user.click(within(viewer).getByRole('button', { name: 'Zoom in' }));
    expect(stageOf(viewer)).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    swipe(stageOf(viewer), 300, 100);
    expect(within(viewer).getByRole('img', { name: 'Photo 1 of 3' })).toBeInTheDocument();
    expect(within(viewer).getByRole('button', { name: 'Zoom out' })).toBeInTheDocument();
  });

  it('Escape closes it, and the header keeps the photo it was left at, with focus', async () => {
    const { user } = await render();
    await user.click(await screen.findByRole('button', { name: 'Photo 1 of 3' }));
    const viewer = await screen.findByRole('dialog', { name: 'Photos' });
    await user.click(within(viewer).getByRole('button', { name: 'Next photo' }));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Photo 2 of 3' })).toHaveFocus());
  });

  it('Back closes it', async () => {
    const { user } = await render();
    await user.click(await screen.findByRole('button', { name: 'Photo 1 of 3' }));
    await screen.findByRole('dialog', { name: 'Photos' });
    await act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('in Arabic the arrow keys mirror', async () => {
    const { user } = await render('ar');
    await user.click(await screen.findByRole('button', { name: /1/ }));
    const viewer = await screen.findByRole('dialog');
    const shown = () => within(viewer).getByRole('img').getAttribute('alt') ?? '';
    const first = shown();
    await user.keyboard('{ArrowLeft}');
    expect(shown()).not.toBe(first);
    await user.keyboard('{ArrowRight}');
    expect(shown()).toBe(first);
  });

  it('in Arabic a swipe mirrors', async () => {
    const { user } = await render('ar');
    await user.click(await screen.findByRole('button', { name: /1/ }));
    const viewer = await screen.findByRole('dialog');
    const shown = () => within(viewer).getByRole('img').getAttribute('alt') ?? '';
    const first = shown();
    swipe(stageOf(viewer), 300, 100);
    expect(shown()).toBe(first);
    swipe(stageOf(viewer), 100, 300);
    expect(shown()).not.toBe(first);
  });
});
