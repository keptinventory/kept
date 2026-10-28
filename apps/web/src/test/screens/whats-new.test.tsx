/**
 * What's new in Kept: after the app updates to a new version, that release's highlights as
 * slides, once per version per person (the person's `whats_new.<version>` hint, on the server).
 * Each slide is a picture or a short clip, a bold title and one plain line; Next and Back, dots
 * ("Slide 2 of 3"), the arrow keys and a swipe move between them, in the reading direction; the
 * last slide's Got it records the version. Clips play muted and looped while their slide is shown,
 * never with reduced motion (the still poster instead); a slide with no media, or offline, shows
 * its area's icon.
 *
 * The rules from 1.14.1 hold: never on a brand-new account (no hint rows at all: the current one is
 * recorded, nothing shown); anyone with a row used Kept before and sees it once; never over
 * Capture or Scan; Help shows it again.
 * The build's version and slides come from `virtual:kept-whats-new`, here an invented release.
 */
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inventoryPaths } from '@/api/inventory/paths';
import { ownerScenario } from '@/api/mock/fixtures';
import { hintSlot } from '@/components/hints/use-hint';
import { whatsNew } from '@/components/whats-new';
import { expectLogicalOnly } from '@/test/render';
import { findHeading, renderApp } from '../app';

vi.mock('virtual:kept-whats-new', () => ({
  default: {
    version: '9.4.2',
    slides: [
      {
        title: 'Shelf view',
        line: 'Every shelf of a room side by side.',
        icon: 'places',
        media: {
          kind: 'video',
          src: 'whats-new/9.4.2/shelves.mp4',
          webm: 'whats-new/9.4.2/shelves.webm',
          poster: 'whats-new/9.4.2/shelves.webp',
          width: 960,
          height: 600,
        },
      },
      {
        title: 'Paperwork',
        line: 'Linked documents sit with your files.',
        icon: 'paperwork',
        media: { kind: 'image', src: 'whats-new/9.4.2/paperwork.webp', width: 960, height: 600 },
      },
      {
        title: 'Small fixes',
        line: 'The search field keeps its words after Back.',
        icon: 'search',
        media: null,
      },
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

/** jsdom plays nothing: play() and pause() are spies, each call's element kept. */
let play: ReturnType<typeof vi.spyOn>;
let pause: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
  pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});

afterEach(() => {
  // A card left open must not leak into the next test: unmounted first, so no host opens it again.
  cleanup();
  whatsNew.reset();
  hintSlot.release('whats_new');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const card = () => screen.queryByRole('dialog', { name: "What's new in Kept" });
/** The slide on screen: the one group in the accessibility tree. */
const current = () => screen.getByRole('group', { name: /^Slide \d of 3$/ });
const videoOf = (el: HTMLElement) => el.querySelector('video');
/** Prefers reduced motion (and nothing else matches: the phone layout). */
function reducedMotion() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion: reduce'),
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }));
}

describe("What's new", () => {
  it('shows the release one slide at a time, and Got it on the last records the version', async () => {
    const { user, mock } = await renderApp('/', { state: updated() });
    const dialog = await screen.findByRole('dialog', { name: "What's new in Kept" });
    expect(dialog).toHaveTextContent('Version 9.4.2');
    // Slide 1: its clip, its bold title and one plain line, in English.
    const one = current();
    expect(one).toHaveAccessibleName('Slide 1 of 3');
    expect(within(one).getByRole('heading', { name: 'Shelf view' })).toHaveAttribute('lang', 'en');
    expect(one).toHaveTextContent('Every shelf of a room side by side.');
    const video = videoOf(one);
    // VP9 first, then the MP4 every browser plays.
    expect(
      [...(video?.querySelectorAll('source') ?? [])].map((x) => [x.getAttribute('src'), x.type]),
    ).toEqual([
      ['/whats-new/9.4.2/shelves.webm', 'video/webm'],
      ['/whats-new/9.4.2/shelves.mp4', 'video/mp4'],
    ]);
    expect(video).toHaveAttribute('poster', '/whats-new/9.4.2/shelves.webp');
    // Sized before it loads, so nothing jumps; muted, looped and inline.
    expect(video).toHaveAttribute('width', '960');
    expect(video).toHaveAttribute('height', '600');
    expect(video?.muted).toBe(true);
    expect(video).toHaveAttribute('loop');
    expect(video).toHaveAttribute('playsinline');
    // Only the slide on screen is in the accessibility tree.
    expect(screen.getAllByRole('group', { name: /^Slide/ })).toHaveLength(1);
    // Dots: one per slide, the current one marked.
    const dots = within(dialog).getAllByRole('button', { name: /^Slide \d of 3$/ });
    expect(dots).toHaveLength(3);
    expect(dots[0]).toHaveAttribute('aria-current', 'true');
    expect(dots[1]).not.toHaveAttribute('aria-current');
    // No Back on the first slide; Next, and no Got it yet.
    expect(within(dialog).queryByRole('button', { name: 'Back' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Got it' })).toBeNull();
    expect(within(dialog).getByRole('link', { name: /Full release notes/ })).toHaveAttribute(
      'href',
      'https://github.com/keptinventory/kept/releases/tag/v9.4.2',
    );
    expectLogicalOnly();

    // A picture on a slide not shown loads when it comes near (lazily).
    expect(document.querySelector('img[src$="paperwork.webp"]')).toHaveAttribute('loading', 'lazy');
    // Nothing announced on opening; each move says where it is, for a screen reader.
    const live = dialog.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(live).toHaveTextContent(/^$/);
    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    expect(current()).toHaveAccessibleName('Slide 2 of 3');
    expect(live).toHaveTextContent('Slide 2 of 3: Paperwork');
    expect(within(current()).getByRole('heading', { name: 'Paperwork' })).toBeInTheDocument();
    const image = current().querySelector('img');
    expect(image).toHaveAttribute('src', '/whats-new/9.4.2/paperwork.webp');
    expect(image).toHaveAttribute('width', '960');
    expect(image).toHaveAttribute('loading', 'eager');
    await user.click(within(dialog).getByRole('button', { name: 'Back' }));
    expect(current()).toHaveAccessibleName('Slide 1 of 3');

    // A dot goes straight to its slide; the last has Got it in place of Next.
    await user.click(within(dialog).getByRole('button', { name: 'Slide 3 of 3' }));
    expect(current()).toHaveAccessibleName('Slide 3 of 3');
    expect(within(dialog).queryByRole('button', { name: 'Next' })).toBeNull();
    expect(mock.lastCall('PUT', inventoryPaths.hint(KEY))).toBeUndefined();
    await user.click(within(dialog).getByRole('button', { name: 'Got it' }));
    await waitFor(() => expect(card()).toBeNull());
    await waitFor(() =>
      expect(mock.lastCall('PUT', inventoryPaths.hint(KEY))?.body).toEqual({ dismissed: true }),
    );
  });

  it('a slide without media shows its area’s icon, not an empty box', async () => {
    const { user } = await renderApp('/', { state: updated() });
    const dialog = await screen.findByRole('dialog', { name: "What's new in Kept" });
    await user.click(within(dialog).getByRole('button', { name: 'Slide 3 of 3' }));
    const three = current();
    expect(three.querySelector('video, img')).toBeNull();
    expect(three.querySelector('[data-media="fallback"] svg')).not.toBeNull();
    expect(three).toHaveTextContent('Small fixes');
  });

  it('moves with the arrow keys and a swipe', async () => {
    await renderApp('/', { state: updated() });
    const dialog = await screen.findByRole('dialog', { name: "What's new in Kept" });
    // The focus starts on the dialog itself: the keys work from there too.
    act(() => void fireEvent.keyDown(dialog, { key: 'ArrowRight' }));
    expect(current()).toHaveAccessibleName('Slide 2 of 3');
    act(() => void fireEvent.keyDown(current(), { key: 'ArrowLeft' }));
    expect(current()).toHaveAccessibleName('Slide 1 of 3');
    // A swipe towards the start: the next slide.
    const viewport = document.querySelector('[data-slides]') as HTMLElement;
    fireEvent.pointerDown(viewport, { clientX: 300, clientY: 200, pointerId: 1, button: 0 });
    fireEvent.pointerMove(viewport, { clientX: 220, clientY: 205, pointerId: 1 });
    fireEvent.pointerUp(viewport, { clientX: 150, clientY: 205, pointerId: 1 });
    expect(current()).toHaveAccessibleName('Slide 2 of 3');
    // An arrow key typed into a field is the field's.
    const field = document.createElement('input');
    dialog.append(field);
    act(() => void fireEvent.keyDown(field, { key: 'ArrowRight' }));
    expect(current()).toHaveAccessibleName('Slide 2 of 3');
    field.remove();
    // A short drag, or one that is mostly up and down, stays.
    fireEvent.pointerDown(viewport, { clientX: 300, clientY: 200, pointerId: 2, button: 0 });
    fireEvent.pointerUp(viewport, { clientX: 285, clientY: 320, pointerId: 2 });
    expect(current()).toHaveAccessibleName('Slide 2 of 3');
  });

  it('plays the shown slide’s clip, muted, and pauses it when the tab is hidden', async () => {
    const { user } = await renderApp('/', { state: updated() });
    const dialog = await screen.findByRole('dialog', { name: "What's new in Kept" });
    const video = videoOf(current()) as HTMLVideoElement;
    await waitFor(() => expect(play.mock.contexts).toContain(video));
    expect(video).toHaveAttribute('autoplay');
    // A pause button: a looping clip can be stopped (WCAG 2.2.2).
    await user.click(within(dialog).getByRole('button', { name: 'Pause' }));
    expect(pause.mock.contexts).toContain(video);
    await user.click(within(dialog).getByRole('button', { name: 'Play' }));
    pause.mockClear();
    // The tab hidden: paused.
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(pause.mock.contexts).toContain(video);
    // Its slide no longer shown: paused too.
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    pause.mockClear();
    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    expect(pause.mock.contexts).toContain(video);
  });

  it('with reduced motion shows the still poster and never starts a clip', async () => {
    reducedMotion();
    const { user } = await renderApp('/', { state: updated() });
    const dialog = await screen.findByRole('dialog', { name: "What's new in Kept" });
    const video = videoOf(current()) as HTMLVideoElement;
    expect(video).toHaveAttribute('poster', '/whats-new/9.4.2/shelves.webp');
    expect(video).not.toHaveAttribute('autoplay');
    await new Promise((r) => setTimeout(r, 200));
    expect(play).not.toHaveBeenCalled();
    // The person can still play it.
    await user.click(within(dialog).getByRole('button', { name: 'Play' }));
    expect(play.mock.contexts).toContain(video);
  });

  it('loads no media until the card opens', async () => {
    const state = updated();
    state.inventory.hints.push({ key: KEY, seenAt: at, dismissedAt: at });
    const { user } = await renderApp('/help', { state });
    await findHeading('Help');
    expect(document.querySelector('[src*="whats-new"], [poster*="whats-new"]')).toBeNull();
    await user.click(screen.getByRole('button', { name: "What's new" }));
    await screen.findByRole('dialog', { name: "What's new in Kept" });
    expect(document.querySelector('[src*="whats-new"]')).not.toBeNull();
  });

  it('offline, or when a clip fails to load, keeps the words and shows the icon', async () => {
    const { user } = await renderApp('/', { state: updated() });
    const dialog = await screen.findByRole('dialog', { name: "What's new in Kept" });
    // The last source failing: no format of it could load.
    fireEvent.error(videoOf(current())?.querySelector('source:last-of-type') as HTMLElement);
    expect(videoOf(current())).toBeNull();
    expect(current().querySelector('[data-media="fallback"] svg')).not.toBeNull();
    expect(current()).toHaveTextContent('Shelf view');
    expect(within(dialog).queryByRole('button', { name: 'Pause' })).toBeNull();
    // Offline: the next slides don't ask for theirs at all.
    const offline = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => void window.dispatchEvent(new Event('offline')));
    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    expect(current().querySelector('img')).toBeNull();
    expect(current().querySelector('[data-media="fallback"] svg')).not.toBeNull();
    expect(current()).toHaveTextContent('Linked documents sit with your files.');
    offline.mockRestore();
    act(() => void window.dispatchEvent(new Event('online')));
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
    await screen.findByRole('dialog', { name: "What's new in Kept" });
    // Escape puts it away and records it too.
    await user.keyboard('{Escape}');
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

  it('comes back from Help any time, from its first slide', async () => {
    const state = updated();
    state.inventory.hints.push({ key: KEY, seenAt: at, dismissedAt: at });
    const { user } = await renderApp('/help', { state });
    await findHeading('Help');
    expect(card()).toBeNull();
    expect(screen.getByRole('main')).toHaveTextContent('Version 9.4.2: its highlights.');
    await user.click(screen.getByRole('button', { name: "What's new" }));
    const dialog = await screen.findByRole('dialog', { name: "What's new in Kept" });
    expect(current()).toHaveAccessibleName('Slide 1 of 3');
    await user.click(within(dialog).getByRole('button', { name: 'Slide 3 of 3' }));
    await user.click(within(dialog).getByRole('button', { name: 'Got it' }));
    await waitFor(() => expect(card()).toBeNull());
    await user.click(screen.getByRole('button', { name: "What's new" }));
    await screen.findByRole('dialog', { name: "What's new in Kept" });
    expect(current()).toHaveAccessibleName('Slide 1 of 3');
  });

  it('in Arabic, its words are translated, the slides run right to left, and the highlights say they are in English', async () => {
    const { user } = await renderApp('/', { state: updated(), locale: 'ar' });
    const dialog = await screen.findByRole('dialog', { name: 'ما الجديد في Kept' });
    expect(dialog).toHaveTextContent('ملاحظات الإصدار بالإنجليزية.');
    const slide = () => screen.getByRole('group', { name: /^الشريحة/ });
    expect(slide()).toHaveAccessibleName('الشريحة ١ من ٣');
    expect(within(slide()).getByRole('heading', { name: 'Shelf view' })).toHaveAttribute(
      'dir',
      'ltr',
    );
    // Forward is towards the left in Arabic: the left arrow, and a swipe towards the right.
    act(() => void fireEvent.keyDown(slide(), { key: 'ArrowLeft' }));
    expect(slide()).toHaveAccessibleName('الشريحة ٢ من ٣');
    expect(dialog.querySelector('[aria-live="polite"]')).toHaveTextContent(
      'الشريحة ٢ من ٣: Paperwork',
    );
    act(() => void fireEvent.keyDown(slide(), { key: 'ArrowRight' }));
    expect(slide()).toHaveAccessibleName('الشريحة ١ من ٣');
    const viewport = document.querySelector('[data-slides]') as HTMLElement;
    fireEvent.pointerDown(viewport, { clientX: 150, clientY: 200, pointerId: 1, button: 0 });
    fireEvent.pointerUp(viewport, { clientX: 300, clientY: 205, pointerId: 1 });
    expect(slide()).toHaveAccessibleName('الشريحة ٢ من ٣');
    // The track moves the other way: slide 2 comes in from the left.
    const track = document.querySelector('[data-slides] > [data-track]') as HTMLElement;
    expect(track.style.transform).toBe('translateX(100%)');
    await user.click(within(dialog).getByRole('button', { name: 'الشريحة ٣ من ٣' }));
    await user.click(within(dialog).getByRole('button', { name: 'فهمت' }));
    await waitFor(() => expect(card()).toBeNull());
  });
});
