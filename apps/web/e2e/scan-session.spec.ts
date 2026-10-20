/**
 * Scan sessions (#168) against the real server: a count of a place, walked with a fake camera
 * whose video shows three labels in each frame (e2e/session-video.ts), one thing never shown.
 * The session saves through the sync ops: the things read are seen, the missing one is left alone,
 * and Activity has one entry for the walk. A viewer counts as a check and saves nothing.
 *
 * Runs on the `capture` instance (households seed); the phone project only. No real camera or
 * microphone: Chromium's fake device plays the generated video.
 */
import path from 'node:path';
import { type Browser, chromium, expect, type Page, test } from '@playwright/test';
import { CAPTURE_INSTANCE, fakeCameraArgs } from './camera';
import { stateDirOf, urlOf } from './instances';
import { writeSessionVideo } from './session-video';

const BASE = urlOf(CAPTURE_INSTANCE);
const PASSWORD = 'kept-seed-password';

test.use({ baseURL: BASE });

const onlyOn = (project: 'phone' | 'desktop') =>
  test.skip(test.info().project.name !== project, `runs in the ${project} project`);

const stateDir = path.join(stateDirOf(CAPTURE_INSTANCE), 'sessions');

async function storageFor(browser: Browser, login: string): Promise<string> {
  const { existsSync, mkdirSync } = await import('node:fs');
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

const send = (page: Page, url: string, data: unknown) =>
  page.request.fetch(url, { method: 'POST', data, headers: { origin: BASE } });

async function homeId(page: Page): Promise<string> {
  const res = await page.request.get('/api/v1/locations');
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { locations?: { id: string; name: string }[] } | unknown[];
  const list = (Array.isArray(body) ? body : (body.locations ?? [])) as {
    id: string;
    name: string;
  }[];
  const home = list.find((l) => l.name === 'Home');
  if (!home) throw new Error('no Home location');
  return home.id;
}

test('a count: three labels a frame, each once; the missing one left alone; one Activity entry', async ({
  browser,
}) => {
  onlyOn('phone');
  test.setTimeout(180_000);
  const use = test.info().project.use;
  const state = await storageFor(browser, 'ibrahim@kept.test');

  // The shelf and its seven things, made through the API: each gets a label code.
  const setup = await browser.newContext({ baseURL: BASE, storageState: state });
  const api = await setup.newPage();
  const home = await homeId(api);
  const shelfRes = await send(api, `/api/v1/locations/${home}/places`, {
    name: `Scan shelf ${Date.now()}`,
    kindKey: 'zone',
  });
  expect(shelfRes.status(), await shelfRes.text()).toBe(201);
  const shelf = (await shelfRes.json()) as { id: string; name: string };
  const things: { id: string; shortCode: string; name: string }[] = [];
  for (const name of [
    'Tape measure',
    'Spirit level',
    'Stud finder',
    'Box cutter',
    'Hex keys',
    'Pliers',
    'Head torch',
  ]) {
    const res = await send(api, '/api/v1/things', { locationId: home, placeId: shelf.id, name });
    expect(res.status(), await res.text()).toBe(201);
    things.push((await res.json()) as { id: string; shortCode: string; name: string });
  }
  const before = new Date().toISOString();
  const missing = things[6] as { id: string; name: string };
  const shown = things.slice(0, 6).map((t) => `https://kept.example/l/${t.shortCode}`);
  const video = test.info().outputPath('session.y4m');
  writeSessionVideo(video, [shown.slice(0, 3), shown.slice(3, 6)]);

  // The walk, in a browser whose camera plays that video.
  const camBrowser = await chromium.launch({
    ...(use.channel ? { channel: use.channel } : {}),
    args: fakeCameraArgs(video),
  });
  try {
    const context = await camBrowser.newContext({
      baseURL: BASE,
      storageState: state,
      viewport: use.viewport ?? { width: 375, height: 780 },
      isMobile: true,
      hasTouch: true,
      timezoneId: 'Africa/Cairo',
      locale: 'en-GB',
    });
    const page = await context.newPage();
    // The phone's copy first, so the expected list has the new shelf.
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Home', level: 1 })).toBeVisible();
    await page.goto(`/scan-session?mode=count&place=${shelf.id}`);
    await expect(page.getByRole('heading', { name: 'Start a session' })).toBeVisible();
    const start = page.getByRole('button', { name: 'Start' });
    await expect(start).toBeEnabled({ timeout: 30_000 });
    await start.click();
    const counter = page.getByTestId('session-counter');
    await expect(counter).toHaveText(/ of 7$/, { timeout: 30_000 });
    await expect(counter).toHaveText('6 of 7', { timeout: 60_000 });

    await page.getByRole('button', { name: 'Finish' }).click();
    await expect(page.getByRole('region', { name: 'Found (6)' })).toBeVisible();
    const gone = page.getByRole('region', { name: 'Missing (1)' });
    await expect(gone.getByText(missing.name)).toBeVisible();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved.').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Seen: 6\. Not here: 0\./)).toBeVisible();

    // The things read are seen now; the one never shown is as it was.
    for (const t of things.slice(0, 6)) {
      const res = await api.request.get(`/api/v1/things/${t.id}`);
      const view = (await res.json()) as { lastSeenAt: string; locationUncertain: boolean };
      expect(view.lastSeenAt >= before, t.name).toBe(true);
    }
    const left = (await (await api.request.get(`/api/v1/things/${missing.id}`)).json()) as {
      lastSeenAt: string;
      locationUncertain: boolean;
    };
    expect(left.lastSeenAt < before).toBe(true);
    expect(left.locationUncertain).toBe(false);

    await page.getByRole('button', { name: 'Done' }).click();
    await page.goto('/activity');
    await expect(page.getByText(`Counted ${shelf.name}: 6 of 7`).first()).toBeVisible({
      timeout: 15_000,
    });
    await context.close();
  } finally {
    await camBrowser.close();
    await setup.close();
  }
});

test('a viewer counts as a check: the banner, and no Save', async ({ browser }) => {
  onlyOn('phone');
  const state = await storageFor(browser, 'talia@kept.test');
  const use = test.info().project.use;
  const context = await browser.newContext({
    baseURL: BASE,
    storageState: state,
    viewport: use.viewport ?? { width: 375, height: 780 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const home = await homeId(page);
  await page.goto('/');
  await page.goto(`/scan-session?mode=count&location=${home}`);
  const start = page.getByRole('button', { name: 'Start' });
  await expect(start).toBeEnabled({ timeout: 30_000 });
  await start.click();
  await expect(page.getByText("You're a viewer: nothing is saved")).toBeVisible();
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
  await context.close();
});
