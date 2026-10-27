/**
 * The graph view (#207) against the real server, on the seeded `sheet` instance (e2e/instances.ts;
 * this spec only reads, and only Home, while sheet.spec.ts edits the Garage): the owner opens
 * Home's Graph from the layout switch, goes into the Living room with a second pick, comes back by
 * the path, opens a thing's card and follows Show on the map to the map's layout of its place;
 * then 3D draws the same places and stops turning when touched. On both projects (phone and
 * desktop).
 *
 * No real device is touched: getUserMedia and getDisplayMedia reject, SpeechRecognition is gone
 * and geolocation refuses, before any page script. No permission is granted.
 *
 *   KEPT_E2E_INSTANCES=sheet pnpm --filter @kept/web exec playwright test graph.spec.ts
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import { INSTANCES, stateDirOf, urlOf } from './instances';

const SHEET = INSTANCES.sheet;
const PASSWORD = 'kept-seed-password';

test.use({ baseURL: urlOf(SHEET) });

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

/** The owner, signed in; the run's first sign-in keeps its cookie, as sheet.spec.ts does. */
async function signIn(page: Page) {
  const context = page.context();
  await context.addInitScript(stubDevices);
  const file = path.join(stateDirOf(SHEET), 'sessions', 'ibrahim.json');
  if (existsSync(file)) {
    const state = JSON.parse(readFileSync(file, 'utf8')) as {
      cookies: Parameters<BrowserContext['addCookies']>[0];
    };
    await context.addCookies(state.cookies);
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    return;
  }
  await page.goto('/signin');
  await page.getByLabel('Email or username', { exact: true }).fill('ibrahim@kept.test');
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  mkdirSync(path.dirname(file), { recursive: true });
  await context.storageState({ path: file });
}

/** Home's page, by its id from the server. */
async function openHome(page: Page) {
  const res = await page.request.get('/api/v1/locations');
  expect(res.ok()).toBe(true);
  const { locations: list } = (await res.json()) as { locations: { id: string; name: string }[] };
  const home = list.find((l) => l.name === 'Home');
  expect(home, 'the seed has a Home').toBeTruthy();
  await page.goto(`/loc/${home?.id}`);
  await expect(page.getByRole('heading', { name: 'Home', level: 1 })).toBeVisible();
}

const graph = (page: Page) => page.getByRole('group', { name: /^Graph of / });
const crumbs = (page: Page) => page.getByRole('navigation', { name: 'Where you are in the graph' });

test('Graph: go in, come back, a thing’s card, Show on the map, and 3D', async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page);
  await openHome(page);

  await page
    .getByRole('radiogroup', { name: 'Layout' })
    .getByText('Graph', { exact: true })
    .click();
  await expect(page).toHaveURL(/view=graph/);
  const living = graph(page).getByRole('button', { name: /^Living room, Room, / });
  await expect(living).toBeVisible();

  // A pick shows its card; a second pick (Enter, the node keeps the focus) goes in.
  await living.click();
  await page.keyboard.press('Enter');
  await expect(crumbs(page).getByRole('button', { name: 'Living room' })).toHaveAttribute(
    'aria-current',
    'location',
  );
  await expect(graph(page).getByRole('button', { name: /^TV unit, / })).toBeVisible();

  // The path goes back.
  await crumbs(page).getByRole('button', { name: 'Home' }).click();
  await expect(crumbs(page).getByRole('button', { name: 'Home' })).toHaveAttribute(
    'aria-current',
    'location',
  );

  // Into the TV unit through the Living room, then the TV's card.
  await living.click();
  await page.keyboard.press('Enter');
  const unit = graph(page).getByRole('button', { name: /^TV unit, / });
  await unit.click();
  await page.keyboard.press('Enter');
  await expect(crumbs(page).getByRole('button', { name: 'TV unit' })).toHaveAttribute(
    'aria-current',
    'location',
  );
  const tv = graph(page).getByRole('button', { name: /^Samsung TV, 55″, / });
  await tv.click();
  const card = page.getByRole('complementary', { name: 'Selected' });
  await expect(card.getByRole('heading', { name: 'Samsung TV, 55″' })).toBeVisible();
  await expect(card.getByRole('link', { name: 'Open' })).toBeVisible();

  // Show on the map: the map's layout of the place that holds it.
  await card.getByRole('link', { name: 'Show on the map' }).click();
  await expect(page).toHaveURL(/\/p\/[^?]+\?view=map$/);
  await expect(page.getByRole('radio', { name: 'Map' })).toBeChecked();

  // 3D: the same places, turning until touched.
  await openHome(page);
  await page
    .getByRole('radiogroup', { name: 'Layout' })
    .getByText('Graph', { exact: true })
    .click();
  await page.getByRole('radiogroup', { name: '2D or 3D' }).getByText('3D', { exact: true }).click();
  await expect(page).toHaveURL(/dim=3d/);
  await expect(graph(page).getByRole('button', { name: /^Kitchen, Room, / })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stop turning' })).toBeVisible();
  // A touch on the empty canvas stops it; then the nodes hold still to be picked.
  const box = await page.locator('.kgraph-stage').boundingBox();
  if (!box) throw new Error('no graph canvas');
  await page.mouse.click(box.x + 12, box.y + 12);
  await expect(page.getByRole('button', { name: 'Turn slowly' })).toBeVisible();
  // In 3D a nearer node can sit over a farther one: pick by keyboard, as Tab and Enter do.
  await graph(page)
    .getByRole('button', { name: /^Kitchen, Room, / })
    .focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('complementary', { name: 'Selected' }).getByRole('heading', { name: 'Kitchen' }),
  ).toBeVisible();
});
