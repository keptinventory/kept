/**
 * A printed code with no QR (#303), against the real server, on the `capture` instance
 * (households seed), phone project: a thing of its own gets a 12 mm tape label, which has no QR;
 * the label as the print view draws it (Chromium's own text, the real fonts) becomes the fake
 * camera's picture, lying on a table, turned and a little soft (e2e/label-video.ts). The scanner
 * reads the code from its text and opens the thing, saying what it read; then, with the
 * connection gone, it does the same from the phone's own copy.
 *
 *   KEPT_E2E_INSTANCES=capture pnpm --filter @kept/web exec playwright test scan-printed-code.spec.ts
 *
 * The camera is Chromium's fake device playing that file: no real camera is opened. Names are
 * invented.
 */
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { type Browser, chromium, expect, type Page, test } from '@playwright/test';
import { CAPTURE_INSTANCE, fakeCameraArgs } from './camera';
import { stateDirOf, urlOf } from './instances';
import { writeLabelVideo } from './label-video';

const BASE = urlOf(CAPTURE_INSTANCE);
/** A code as labels print it: 3 + 3 around a non-breaking hyphen (@kept/shared printedCode). */
const printedCode = (code: string) => `${code.slice(0, 3)}\u2011${code.slice(3)}`;
const PASSWORD = 'kept-seed-password';

test.use({ baseURL: BASE });

const stateDir = path.join(stateDirOf(CAPTURE_INSTANCE), 'sessions');

/** One sign-in per person per run (the sign-in limit), shared with step3.spec.ts. */
async function storageFor(browser: Browser, login: string): Promise<string> {
  const file = path.join(stateDir, `${login}.json`);
  if (existsSync(file)) return file;
  mkdirSync(stateDir, { recursive: true });
  const ctx = await browser.newContext({ baseURL: BASE });
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

const send = async (page: Page, url: string, data: unknown) => {
  const res = await page.request.fetch(url, { method: 'POST', data, headers: { origin: BASE } });
  expect(res.ok(), `${url}: ${await res.text()}`).toBe(true);
  return (await res.json()) as Record<string, unknown>;
};

async function homeId(page: Page): Promise<string> {
  const body = (await (await page.request.get('/api/v1/locations')).json()) as
    | { locations?: { id: string; name: string }[] }
    | { id: string; name: string }[];
  const list = Array.isArray(body) ? body : (body.locations ?? []);
  const home = list.find((l) => l.name === 'Home');
  if (!home) throw new Error('no Home location');
  return home.id;
}

test('a 12 mm tape label with no QR: the scanner reads its printed code and opens the thing, online and offline', async ({
  browser,
}) => {
  test.skip(test.info().project.name !== 'phone', 'runs in the phone project');
  test.setTimeout(240_000);
  const login = 'ibrahim@kept.test';

  // A thing of its own, and a 12 mm tape label for it, drawn by the print view.
  const setup = await browser.newContext({
    baseURL: BASE,
    storageState: await storageFor(browser, login),
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 4,
  });
  const page = await setup.newPage();
  const home = await homeId(page);
  const shelf = await send(page, `/api/v1/locations/${home}/places`, {
    name: `Key hooks ${Date.now()}`,
    kindKey: 'zone',
  });
  const thing = await send(page, '/api/v1/things', {
    locationId: home,
    placeId: shelf.id,
    name: 'Spare keys',
  });
  const code = thing.shortCode as string;
  expect(code).toMatch(/^[0-9A-Z]{6}$/);
  const made = await send(page, '/api/v1/labels/batches', {
    locationId: home,
    kind: 'things',
    thingIds: [thing.id],
    stock: 'tape_12',
  });
  const batch = made.batch as { id: string };
  await page.goto(`/labels/${batch.id}`);
  const label = page.locator('div[data-slot="label"]');
  await expect(label).toContainText(printedCode(code));
  await expect(label.locator('[data-slot="label-qr"]')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: 'print' });
  const png = await label.screenshot();
  await setup.close();
  test.info().attachments.push({ name: 'tape-label.png', contentType: 'image/png', body: png });

  const video = test.info().outputPath('camera-tape-label.y4m');
  await writeLabelVideo(video, png);
  const use = test.info().project.use;
  const camBrowser = await chromium.launch({
    ...(use.channel ? { channel: use.channel } : {}),
    args: fakeCameraArgs(video),
  });
  try {
    const context = await camBrowser.newContext({
      baseURL: BASE,
      storageState: await storageFor(browser, login),
      viewport: use.viewport ?? { width: 375, height: 780 },
      isMobile: true,
      hasTouch: true,
      timezoneId: 'Africa/Cairo',
      locale: 'en-GB',
    });
    const phone = await context.newPage();
    await phone.goto('/');
    await expect(phone.getByRole('heading', { name: 'Home', level: 1 })).toBeVisible();
    // Online once: the worker installs (the reader is precached with the app) and the phone's
    // copy syncs, with the new thing in it.
    await phone.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await expect
      .poll(() => phone.evaluate(() => navigator.serviceWorker.controller !== null))
      .toBe(true);
    await phone.waitForTimeout(3_000);

    await phone.getByRole('link', { name: 'Scan' }).first().click();
    await expect(phone).toHaveURL(new RegExp(`/t/${code}`), { timeout: 30_000 });
    await expect(phone.getByRole('heading', { name: 'Spare keys', level: 1 })).toBeVisible();
    await expect(phone.getByText(/from the printed code/)).toContainText(printedCode(code));

    // The connection gone: the scanner, cold from the worker's copy, reads it again and opens
    // it from the phone's own copy (offline, by the thing's id, as a QR read offline does).
    await context.setOffline(true);
    await phone.goto('/scan');
    await expect(phone).toHaveURL(new RegExp(`/t/(${code}|${thing.id as string})$`), {
      timeout: 30_000,
    });
    await expect(phone.getByRole('heading', { name: 'Spare keys', level: 1 })).toBeVisible();
    await context.setOffline(false);
    await context.close();
  } finally {
    await camBrowser.close();
  }
});
