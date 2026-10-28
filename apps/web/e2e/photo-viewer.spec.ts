/**
 * A thing's photo full screen (#295) against the real server, on the seeded `household` instance
 * (e2e/instances.ts), at both sizes. The seed's TV has one photo: tapping it opens the photo full
 * screen, Zoom in and Zoom out switch between its full size and the screen, and Escape and Back
 * each close it on the TV's page. Offline, with the page and its photo already loaded, it opens
 * all the same: the viewer's chunk is precached, and its image is the one the header shows.
 *
 *   KEPT_E2E_INSTANCES=household pnpm --filter @kept/web exec playwright test photo-viewer.spec.ts
 */
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { type Browser, expect, type Page, test } from '@playwright/test';
import { INSTANCES, stateDirOf, urlOf } from './instances';

const HOUSEHOLD = INSTANCES.household;
const BASE = urlOf(HOUSEHOLD);
const PASSWORD = 'kept-seed-password';
const LOGIN = 'ibrahim@kept.test';
/** The seed's TV (apps/server/src/seed/inventory.ts), with one photo. */
const TV = { name: 'Samsung TV, 55″', code: '5MT0QD' };

test.use({ baseURL: BASE });

// Sign-in is limited to 5 a minute: the owner signs in once per run, into the session file
// step4.spec.ts keeps for them on this instance, and every later context reuses it.
const stateDir = path.join(stateDirOf(HOUSEHOLD), 'sessions');

async function storageFor(browser: Browser): Promise<string> {
  const file = path.join(stateDir, `${LOGIN}.json`);
  if (existsSync(file)) return file;
  mkdirSync(stateDir, { recursive: true });
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage();
  await page.goto('/signin');
  await page.getByLabel('Email or username', { exact: true }).fill(LOGIN);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await ctx.storageState({ path: file });
  await ctx.close();
  return file;
}

/** The TV's page, signed in, in a context shaped like the running project. */
async function tvPage(browser: Browser): Promise<Page> {
  const use = test.info().project.use;
  const context = await browser.newContext({
    baseURL: BASE,
    storageState: await storageFor(browser),
    viewport: use.viewport ?? { width: 1280, height: 800 },
    isMobile: use.isMobile ?? false,
    hasTouch: use.hasTouch ?? false,
    timezoneId: 'Africa/Cairo',
    locale: 'en-GB',
  });
  const page = await context.newPage();
  await page.goto(`/t/${TV.code}`);
  await expect(page.getByRole('heading', { name: TV.name, level: 1 })).toBeVisible();
  return page;
}

/** The service worker controls the page, so its precache (the viewer's chunk) is in place. */
async function controlled(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), {
      timeout: 30_000,
    })
    .toBe(true);
}

test('the photo opens full screen, zooms, and Escape and Back close it', async ({ browser }) => {
  const page = await tvPage(browser);
  const address = page.url();
  const photo = page.getByRole('button', { name: 'Photo 1 of 1' });
  await photo.click();
  const viewer = page.getByRole('dialog', { name: 'Photos' });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByRole('img', { name: 'Photo 1 of 1' })).toBeVisible();
  // Full screen: the viewer covers the whole viewport.
  const box = await viewer.boundingBox();
  const size = page.viewportSize();
  expect(box && size && Math.round(box.width) === size.width).toBe(true);
  expect(box && size && Math.round(box.height) === size.height).toBe(true);

  await viewer.getByRole('button', { name: 'Zoom in' }).click();
  await expect(viewer.getByRole('button', { name: 'Zoom out' })).toBeVisible();
  await viewer.getByRole('button', { name: 'Zoom out' }).click();
  await expect(viewer.getByRole('button', { name: 'Zoom in' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
  await expect(page).toHaveURL(address);

  await photo.click();
  await expect(viewer).toBeVisible();
  await page.goBack();
  await expect(viewer).toBeHidden();
  await expect(page).toHaveURL(address);
  await expect(page.getByRole('heading', { name: TV.name, level: 1 })).toBeVisible();
  await page.context().close();
});

test('offline, the photo already on the page opens full screen', async ({ browser }) => {
  const page = await tvPage(browser);
  await controlled(page);
  const photo = page.getByRole('button', { name: 'Photo 1 of 1' });
  await expect
    .poll(() =>
      photo.getByRole('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth),
    )
    .toBeGreaterThan(0);

  await page.context().setOffline(true);
  try {
    await photo.click();
    const viewer = page.getByRole('dialog', { name: 'Photos' });
    await expect(viewer).toBeVisible();
    const image = viewer.getByRole('img', { name: 'Photo 1 of 1' });
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
      .toBeGreaterThan(0);
  } finally {
    await page.context().setOffline(false);
    await page.context().close();
  }
});
