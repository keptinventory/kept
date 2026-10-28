/**
 * Floor plan to map (1.14.3, D266) against the real server, on the `capture` instance (the
 * `households` seed, every AI call answered by the mock provider). Each project makes a location of
 * its own with no rooms, turns AI capture on there and, on its map:
 *
 * 1. the empty map offers Start from a floor plan; the sheet takes the invented flat
 *    (e2e/fixtures/floor-plan-flat.png, made by make-floor-plan.mjs) and reads it;
 * 2. the mock reads it as its default plan (ai/mock.ts `kept_plan`): three rooms, the review shows
 *    them dashed with the panel "Rooms from the plan";
 * 3. Set a room's size fixes the scale from the living room (6 × 4.8 m), every room rescaled;
 * 4. the bedroom is switched off, and Add 2 rooms adds the others as places with their rectangles;
 * 5. Undo takes them off the map and puts them in the trash.
 *
 * No real device is touched: getUserMedia and getDisplayMedia reject, SpeechRecognition is gone and
 * geolocation refuses, before any page script. The file is set on the sheet's file input; no
 * picker or camera opens.
 *
 *   KEPT_E2E_INSTANCES=capture pnpm --filter @kept/web exec playwright test floor-plan.spec.ts
 */
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Browser, expect, type Page, test } from '@playwright/test';
import { CAPTURE_INSTANCE } from './camera';
import { stateDirOf, urlOf } from './instances';

const BASE = urlOf(CAPTURE_INSTANCE);
const PASSWORD = 'kept-seed-password';
/** A made-up key for the mock provider: KEPT_AI_MOCK=1 never sends it anywhere. */
const MOCK_KEY = 'gsk_e2e-mock-provider-not-a-real-key';
const SLOW = 60_000;
const PLAN = fileURLToPath(new URL('fixtures/floor-plan-flat.png', import.meta.url));

test.use({ baseURL: BASE });

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

const stateDir = path.join(stateDirOf(CAPTURE_INSTANCE), 'sessions');

async function signedIn(browser: Browser): Promise<Page> {
  const file = path.join(stateDir, 'ibrahim.json');
  if (!existsSync(file)) {
    mkdirSync(stateDir, { recursive: true });
    const ctx = await browser.newContext({ baseURL: BASE });
    const page = await ctx.newPage();
    await page.goto('/signin');
    await page.getByLabel('Email or username', { exact: true }).fill('ibrahim@kept.test');
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await ctx.storageState({ path: file });
    await ctx.close();
  }
  const use = test.info().project.use;
  const context = await browser.newContext({
    baseURL: BASE,
    storageState: file,
    viewport: use.viewport ?? { width: 1280, height: 800 },
    isMobile: use.isMobile ?? false,
    hasTouch: use.hasTouch ?? false,
    timezoneId: 'Africa/Cairo',
    locale: 'en-GB',
  });
  await context.addInitScript(stubDevices);
  return context.newPage();
}

type MapJson = {
  version: string | null;
  rooms: {
    id: string;
    name: string;
    layout: { x: number; z: number; w: number; d: number } | null;
  }[];
};

async function mapOf(page: Page, id: string): Promise<MapJson> {
  const res = await page.request.get(`/api/v1/locations/${id}/map`);
  expect(res.ok(), await res.text()).toBe(true);
  return (await res.json()) as MapJson;
}

test('a floor plan: read, checked, rescaled, one room left out, added, undone', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const project = test.info().project.name;
  const page = await signedIn(browser);
  // The account's provider, with the mock key.
  const providers = await page.request.get('/api/v1/ai/providers');
  const { providers: list } = (await providers.json()) as { providers: { scope: string }[] };
  if (!list.some((p) => p.scope === 'account')) {
    const put = await page.request.fetch('/api/v1/ai/providers/account', {
      method: 'PUT',
      data: { apiKey: MOCK_KEY },
      headers: { origin: BASE },
    });
    // The other project may have set it a moment ago (409): either way there is one.
    expect([200, 409], await put.text()).toContain(put.status());
  }
  await page.goto('/');
  const name = `Plan flat ${project} ${test.info().retry}`;
  const made = await page.evaluate(async (n) => {
    const res = await fetch('/api/v1/locations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        name: n,
        kind: 'home',
        rooms: [],
        preset: 'essentials',
        timezone: 'Africa/Cairo',
        currency: 'EGP',
      }),
    });
    return { status: res.status, body: (await res.json()) as { id: string } };
  }, name);
  expect(made.status, JSON.stringify(made.body)).toBe(201);
  const id = made.body.id;
  const on = await page.request.fetch(`/api/v1/locations/${id}/modules`, {
    method: 'POST',
    data: { module: 'ai_capture', enabled: true },
    headers: { origin: BASE },
  });
  expect(on.ok(), await on.text()).toBe(true);

  // Nothing downloaded: the drawn shapes are enough here.
  await page.addInitScript(() => localStorage.setItem('kept.map.quality', 'simple'));
  await page.goto(`/loc/${id}?view=map`);
  const stage = page.getByRole('region', { name: `Map of ${name}` });
  await expect(stage.getByRole('heading', { name: 'No rooms on the map yet' })).toBeVisible({
    timeout: SLOW,
  });

  // 1. The sheet: the invented flat, read.
  await stage.getByRole('button', { name: 'Start from a floor plan' }).click();
  const sheet = page.getByRole('dialog', { name: 'Start from a floor plan' });
  await expect(sheet.getByText(/Kept sends the plan, without its location data/)).toBeVisible();
  await sheet.locator('input[type="file"]').first().setInputFiles(PLAN);
  await expect(sheet.getByRole('img', { name: 'The plan you chose' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Read the plan' }).click();
  await expect(sheet).toBeHidden({ timeout: SLOW });

  // 2. Read by the mock (the worker runs in this server), then checked on the map.
  await expect(stage.getByText('A floor plan is ready to check.')).toBeVisible({ timeout: SLOW });
  await stage.getByRole('button', { name: 'Check it' }).click();
  const panel = stage.getByRole('region', { name: 'Rooms from the plan' });
  await expect(panel).toBeVisible();
  // The plan itself under the rooms: its display, through the file's signed URL.
  await expect(stage.getByRole('switch', { name: 'Show the plan' })).toBeChecked();
  await expect(panel.getByText('Sizes from the plan: 1 of 1 rooms agree')).toBeVisible();
  for (const room of ['Living room', 'Kitchen', 'Bedroom']) {
    await expect(panel.getByRole('switch', { name: `Add ${room}` })).toBeChecked();
  }
  await expect(stage.getByRole('button', { name: 'Add 3 rooms' })).toBeEnabled();

  // 3. The living room is 6 × 4.8 m: every room rescaled from it.
  await panel.getByRole('button', { name: 'Living room', exact: true }).click();
  await panel.getByRole('button', { name: 'Set a room’s size' }).click();
  const size = page.getByRole('dialog', { name: 'Living room is…' });
  await size.getByRole('textbox', { name: 'Width (m)' }).fill('6');
  await size.getByRole('textbox', { name: 'Width (m)' }).press('Tab');
  await size.getByRole('textbox', { name: 'Depth (m)' }).fill('4.8');
  await size.getByRole('textbox', { name: 'Depth (m)' }).press('Tab');
  await size.getByRole('button', { name: 'Rescale' }).click();
  await expect(panel.getByText('Scale from Living room’s size')).toBeVisible();
  await expect(panel.getByRole('button', { name: '6 × 4.8 m', exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: '3.6 × 4.8 m', exact: true })).toBeVisible();

  // 4. The bedroom left out; the others added, with one Undo.
  await panel
    .locator('li', { has: page.getByRole('switch', { name: 'Add Bedroom' }) })
    .locator('[data-slot="switch"]')
    .click();
  await expect(panel.getByRole('switch', { name: 'Add Bedroom' })).not.toBeChecked();
  await stage.getByRole('button', { name: 'Add 2 rooms' }).click();
  const toast = page.getByText('Added 2 rooms from the plan');
  await expect(toast).toBeVisible({ timeout: SLOW });
  const after = await mapOf(page, id);
  const byName = new Map(after.rooms.map((r) => [r.name, r.layout]));
  expect(byName.get('Living room')).toMatchObject({ w: 600, d: 480 });
  expect(byName.get('Kitchen')).toMatchObject({ w: 360, d: 480 });
  expect(byName.has('Bedroom')).toBe(false);
  const places = await page.request.get(`/api/v1/locations/${id}/places`);
  expect(await places.text()).toContain('Living room');

  // 5. Undo: off the map, and the rooms it made in the trash.
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await mapOf(page, id)).rooms.length, { timeout: SLOW }).toBe(0);
  await expect(stage.getByRole('heading', { name: 'No rooms on the map yet' })).toBeVisible({
    timeout: SLOW,
  });
  await page.context().close();
});
