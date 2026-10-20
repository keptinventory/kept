/**
 * Help's Tours against the real server, on its own seeded `tour` instance (e2e/instances.ts):
 * one person per project, because a finished tour is remembered per person on the server.
 *
 * 1. Help → Tours → Basics walks every step in order, each pointing at its control
 *    (`data-tour`), the start of that control in view and clear of the popover (on a phone, a
 *    sheet docked above the tab bar), and the row then says Done.
 * 2. In Arabic the popover stays on screen and counts in Eastern digits.
 * 3. A tap outside the highlight reaches the page: it follows the link, and the tour ends there.
 * 4. Show me on an empty location starts Things & places there: it makes one sample thing, and
 *    Discard at the end puts exactly that in the Trash.
 * 5. The 3D map tour points at the map's own controls (WebGL runs in Chromium here, not jsdom).
 *
 * No real device is touched: before any page script, getUserMedia and getDisplayMedia reject
 * with NotAllowedError, SpeechRecognition is gone and geolocation refuses (Capture opens with the
 * camera "off"). No permission is granted.
 *
 *   KEPT_E2E_INSTANCES=tour pnpm --filter @kept/web exec playwright test tour.spec.ts
 */
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { type Browser, type BrowserContext, expect, type Page, test } from '@playwright/test';
import { INSTANCES, stateDirOf, urlOf } from './instances';

const TOUR = INSTANCES.tour;
const BASE = urlOf(TOUR);
const PASSWORD = 'kept-seed-password';
/** The seed's people (apps/server/src/seed/cast.ts): the owner on desktop, an admin on the phone. */
const PERSON = { desktop: 'ibrahim@kept.test', phone: 'bruce@kept.test' } as const;

test.use({ baseURL: BASE });
test.describe.configure({ mode: 'serial' });

/** Every device API stubbed before the app's own scripts run. */
function stubDevices() {
  const deny = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
  const media = {
    getUserMedia: deny,
    getDisplayMedia: deny,
    enumerateDevices: () => Promise.resolve([]),
    getSupportedConstraints: () => ({}),
    addEventListener() {},
    removeEventListener() {},
    ondevicechange: null,
  };
  Object.defineProperty(Navigator.prototype, 'mediaDevices', {
    configurable: true,
    get: () => media,
  });
  const w = window as unknown as Record<string, unknown>;
  for (const name of ['SpeechRecognition', 'webkitSpeechRecognition']) {
    delete w[name];
    Object.defineProperty(window, name, { configurable: true, writable: true, value: undefined });
  }
  const geo = {
    getCurrentPosition: (_ok: unknown, err?: (e: { code: number; message: string }) => void) =>
      err?.({ code: 1, message: 'denied' }),
    watchPosition: (_ok: unknown, err?: (e: { code: number; message: string }) => void) => {
      err?.({ code: 1, message: 'denied' });
      return 0;
    },
    clearWatch() {},
  };
  Object.defineProperty(Navigator.prototype, 'geolocation', { configurable: true, get: () => geo });
}

const project = () => test.info().project.name as 'phone' | 'desktop';

/** Sign-in is limited to 5 a minute: each person signs in once per run and reuses the cookie. */
async function storageFor(browser: Browser, login: string): Promise<string> {
  const dir = path.join(stateDirOf(TOUR), 'sessions');
  const file = path.join(dir, `${login}.json`);
  if (existsSync(file)) return file;
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ baseURL: BASE });
  await ctx.addInitScript(stubDevices);
  const page = await ctx.newPage();
  await page.goto('/signin');
  await page.getByLabel('Email or username', { exact: true }).fill(login);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await ctx.storageState({ path: file });
  await ctx.close();
  return file;
}

/** This project's person, signed in, shaped like the project, optionally in Arabic. */
async function person(
  browser: Browser,
  locale: 'en' | 'ar' = 'en',
): Promise<{ context: BrowserContext; page: Page }> {
  const use = test.info().project.use;
  const context = await browser.newContext({
    baseURL: BASE,
    storageState: await storageFor(browser, PERSON[project()]),
    viewport: use.viewport ?? { width: 1280, height: 800 },
    isMobile: use.isMobile ?? false,
    hasTouch: use.hasTouch ?? false,
    timezoneId: 'Africa/Cairo',
    locale: 'en-GB',
  });
  await context.addInitScript(stubDevices);
  await context.addInitScript((l) => {
    try {
      localStorage.setItem('kept.locale', l);
    } catch {}
  }, locale);
  return { context, page: await context.newPage() };
}

const popover = (page: Page) => page.locator('.driver-popover');

/** The stop on screen: its title, its progress, and what it highlights. */
async function stopOf(page: Page) {
  return page.evaluate(() => {
    const box = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height };
    };
    const pop = document.querySelector('.driver-popover');
    const target = document.querySelector('.driver-active-element');
    return {
      title: pop?.querySelector('.driver-popover-title')?.textContent ?? '',
      progress: pop?.querySelector('.driver-popover-progress-text')?.textContent ?? '',
      anchor: target?.getAttribute('data-tour') ?? null,
      target: box(target),
      popover: box(pop),
      vw: window.innerWidth,
      vh: window.innerHeight,
    };
  });
}

/** Basics for this project's person (components/hints/tours.ts). */
const BASICS = (layout: 'phone' | 'desktop') => [
  { title: 'Needs you', anchor: 'home-needs', path: /\/$/ },
  { title: 'Your locations', anchor: 'home-locations', path: /\/$/ },
  { title: 'Scan', anchor: 'scan-button', path: /\/$/ },
  { title: 'Search', anchor: 'search-field', path: /\/search$/ },
  layout === 'phone'
    ? { title: 'More', anchor: 'more-entries', path: /\/more$/ }
    : // A desktop points at the sidebar where it is: still on Search.
      { title: 'Everything else', anchor: 'nav-entries', path: /\/search$/ },
  { title: 'Tours', anchor: 'help-tours', path: /\/help$/ },
];

/** A tour's row on Help. */
const tourRow = (page: Page, id: string) => page.locator(`[data-tour-row="${id}"]`);

/** Start or replay a tour from its row on Help. */
async function fromHelp(page: Page, id: string, button = 'Start') {
  await page.goto('/help');
  await tourRow(page, id).getByRole('button', { name: button, exact: true }).click();
  await expect(popover(page)).toBeVisible();
}

const next = (page: Page, last: boolean) =>
  popover(page)
    .getByRole('button', { name: last ? 'Done' : 'Next', exact: true })
    .click();

test('Basics walks every step, each pointing at its control, and then says Done', async ({
  browser,
}) => {
  const { context, page } = await person(browser);
  const walk = BASICS(project());
  await fromHelp(page, 'basics');
  for (const [k, leg] of walk.entries()) {
    await expect(popover(page).locator('.driver-popover-title')).toHaveText(leg.title);
    await expect(popover(page)).toContainText(`${k + 1} of ${walk.length}`);
    await expect(page).toHaveURL(leg.path);
    // Let driver.js and the sheet's scroll settle before measuring.
    await expect
      .poll(async () => (await stopOf(page)).anchor, { message: leg.title })
      .toBe(leg.anchor);
    await page.waitForTimeout(500);
    const s = await stopOf(page);
    expect(s.target, leg.title).not.toBeNull();
    expect(s.popover, leg.title).not.toBeNull();
    if (!s.target || !s.popover) continue;
    // The popover is on screen.
    expect(s.popover.left, `${leg.title}: popover left`).toBeGreaterThanOrEqual(0);
    expect(s.popover.right, `${leg.title}: popover right`).toBeLessThanOrEqual(s.vw);
    expect(s.popover.top, `${leg.title}: popover top`).toBeGreaterThanOrEqual(0);
    expect(s.popover.bottom, `${leg.title}: popover bottom`).toBeLessThanOrEqual(s.vh);
    // The start of what it points at is in view and not under the popover.
    expect(s.target.top, `${leg.title}: target in view`).toBeGreaterThanOrEqual(0);
    expect(s.target.top, `${leg.title}: target in view`).toBeLessThan(s.vh);
    const under =
      s.target.top >= s.popover.top - 1 &&
      s.target.top < s.popover.bottom &&
      s.target.left < s.popover.right &&
      s.target.right > s.popover.left;
    expect(under, `${leg.title}: target's top under the popover`).toBe(false);
    if (k > 0) await expect(popover(page).getByRole('button', { name: 'Back' })).toBeVisible();
    await next(page, k === walk.length - 1);
  }
  await expect(popover(page)).toHaveCount(0);
  await expect(tourRow(page, 'basics')).toContainText('Done');
  await expect(tourRow(page, 'basics').getByRole('button', { name: 'Replay' })).toBeVisible();
  await context.close();
});

test('stays on screen in Arabic, counting in its digits', async ({ browser }) => {
  const { context, page } = await person(browser, 'ar');
  await page.goto('/help');
  await tourRow(page, 'basics').getByRole('button').click();
  await expect(popover(page).locator('.driver-popover-title')).toHaveText('ما يحتاج إليك');
  await expect(popover(page)).toContainText('١ من ٦');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const s = await stopOf(page);
  expect(s.popover?.left ?? -1).toBeGreaterThanOrEqual(0);
  expect(s.popover?.right ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(s.vw);
  await page.keyboard.press('Escape');
  await expect(popover(page)).toHaveCount(0);
  await context.close();
});

test('lets a tap outside the highlight through to the page', async ({ browser }) => {
  const { context, page } = await person(browser);
  await fromHelp(page, 'basics', 'Replay');
  await expect(popover(page).locator('.driver-popover-title')).toHaveText('Needs you');
  // Outside the highlight: the tab bar's Search on a phone, the sidebar's Activity on a desktop.
  const [name, url] = project() === 'phone' ? ['Search', /\/search$/] : ['Activity', /\/activity$/];
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name, exact: true })
    .click();
  await expect(page).toHaveURL(url);
  // Going somewhere the tour didn't take you ends it, where it was.
  await expect(popover(page)).toHaveCount(0);
  await context.close();
});

test('Show me on an empty location makes one sample, and Discard trashes only that', async ({
  browser,
}) => {
  const { context, page } = await person(browser);
  await page.goto('/help');
  // An empty location of this run's own, through the app's own endpoint, removed at the end.
  const name = `Tour shed ${project()}`;
  const made = await page.evaluate(async (n) => {
    const res = await fetch('/api/v1/locations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        name: n,
        kind: 'garage',
        rooms: [],
        preset: 'essentials',
        timezone: 'Africa/Cairo',
        currency: 'EGP',
      }),
    });
    return { status: res.status, body: (await res.json()) as { id: string } };
  }, name);
  expect(made.status, JSON.stringify(made.body)).toBe(201);
  const locationId = made.body.id;
  try {
    await page.goto(`/loc/${locationId}`);
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    await page.getByRole('button', { name: 'Show me', exact: true }).click();
    const seen: string[] = [];
    for (let k = 0; k < 5; k++) {
      await expect(popover(page)).toBeVisible();
      const title = (await popover(page).locator('.driver-popover-title').textContent()) ?? '';
      seen.push(title);
      const last = /(\d+) of \1/.test((await stopOf(page)).progress);
      await next(page, last);
      if (last) break;
    }
    expect(seen).toEqual(['Add here', "What's here", 'Where it is', 'Actions', 'Its sections']);
    const keep = page.getByRole('dialog', { name: 'Keep what you added?' });
    await expect(keep).toContainText('1 item');
    await keep.getByRole('button', { name: 'Discard', exact: true }).click();
    await expect(keep).toHaveCount(0);
    // The sample is in the Trash, and nothing else of this location is.
    await page.goto('/trash');
    await expect(page.getByText('Sample: Cordless drill')).toHaveCount(1);
  } finally {
    await page.evaluate(
      (id) =>
        fetch(`/api/v1/locations/${id}`, {
          method: 'DELETE',
          headers: { accept: 'application/json' },
        }),
      locationId,
    );
    await context.close();
  }
});

test('The 3D map tour points at the map’s own controls', async ({ browser }) => {
  const { context, page } = await person(browser);
  await fromHelp(page, 'map');
  const anchors: string[] = [];
  for (let k = 0; k < 6; k++) {
    await expect(popover(page)).toBeVisible();
    await expect.poll(async () => (await stopOf(page)).anchor).not.toBeNull();
    const s = await stopOf(page);
    anchors.push(s.anchor ?? '');
    const last = /(\d+) of \1/.test(s.progress);
    await next(page, last);
    if (last) break;
  }
  // Floors shows only for a location with more than one: the rest always.
  expect(anchors.filter((a) => a !== 'map-floors')).toEqual([
    'location-layout',
    'map-view',
    'map-pins',
    'map-arrange',
  ]);
  await expect(page).toHaveURL(/view=map/);
  await expect(popover(page)).toHaveCount(0);
  await context.close();
});
