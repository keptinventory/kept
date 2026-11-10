/**
 * Metric or imperial (#385) against the real server, on the `vehicles` instance (households seed),
 * as Bruce (an admin of Home and the Garage, whom step5.spec.ts never signs in as, so switching his
 * units can't change what that spec sees). Desktop only: the setting is his, across devices, and
 * the phone project runs at the same time on this instance.
 *
 * 1. Settings → Me → Display → Units → Imperial: kept on the profile.
 * 2. The map: a room added at 12'6" by 10 ft is saved as 381 × 305 cm, and its card on the map
 *    says 12 ft 6 in × 10 ft.
 * 3. A label sheet: the stock sizes in inches.
 * 4. A vehicle: a car he adds gets an odometer in mi; its fuel use reads in mpg; Change unit
 *    converts the readings to km after a preview, and Undo puts them back.
 * 5. Back to Metric: fuel use in L/100 km, the label sizes in mm.
 *
 *   KEPT_E2E_INSTANCES=vehicles pnpm --filter @kept/web exec playwright test units.spec.ts
 */
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { type Browser, expect as baseExpect, type Page, test } from '@playwright/test';
import { stateDirOf, urlOf, VEHICLES_INSTANCE } from './instances';

const expect = baseExpect.configure({ timeout: 30_000 });

const BASE = urlOf(VEHICLES_INSTANCE);
const PASSWORD = 'kept-seed-password';
const LOGIN = 'bruce@kept.test';

test.use({ baseURL: BASE });

const stateDir = path.join(stateDirOf(VEHICLES_INSTANCE), 'sessions');

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
  await page.waitForURL((u) => !u.pathname.startsWith('/signin'));
  await ctx.storageState({ path: file });
  await ctx.close();
  return file;
}

/** The page's API with its cookie, origin and an Idempotency-Key on every write. */
function api(page: Page) {
  const json = async <T>(res: Awaited<ReturnType<Page['request']['get']>>): Promise<T> => {
    expect(res.ok(), `${res.url()}: ${res.status()} ${await res.text()}`).toBe(true);
    return (await res.json()) as T;
  };
  return {
    get: async <T>(url: string) => json<T>(await page.request.get(url)),
    post: async <T>(url: string, data: unknown = {}) =>
      json<T>(
        await page.request.fetch(url, {
          method: 'POST',
          data,
          headers: { origin: BASE, 'idempotency-key': crypto.randomUUID() },
        }),
      ),
  };
}

async function axe(page: Page, where: string) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations
    .filter((v) => v.impact && v.impact !== 'minor')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0]?.target.join(' ')}`);
  expect.soft(serious, `axe on ${where}`).toEqual([]);
}

/** A UUIDv7 (the server takes client ids only as current v7s): the time, then random bits. */
function uuidv7(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  const ms = Date.now();
  for (let i = 0; i < 6; i++) b[i] = Math.floor(ms / 2 ** (8 * (5 - i))) % 256;
  b[6] = ((b[6] as number) & 0x0f) | 0x70;
  b[8] = ((b[8] as number) & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

type Located = { id: string; name: string };
type Thing = Located & {
  type: { id: string } | null;
  placeId: string | null;
  meters: { id: string; unit: string }[];
};

async function chooseUnits(page: Page, units: 'Metric' | 'Imperial') {
  await page.goto('/settings');
  const group = page.getByRole('radiogroup', { name: 'Units' });
  await group.getByText(units, { exact: true }).click();
  await expect(group.getByRole('radio', { name: units })).toBeChecked();
  await expect
    .poll(
      async () => (await api(page).get<{ profile: { units: string } }>('/api/v1/me')).profile.units,
    )
    .toBe(units.toLowerCase());
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

test('metric or imperial: the map, a label sheet, a vehicle and its fuel, and back', async ({
  browser,
}) => {
  test.skip(test.info().project.name !== 'desktop', 'runs in the desktop project');
  test.setTimeout(300_000);
  const context = await browser.newContext({
    baseURL: BASE,
    storageState: await storageFor(browser),
    viewport: { width: 1280, height: 800 },
    timezoneId: 'Africa/Cairo',
    locale: 'en-GB',
  });
  await context.addInitScript(() => localStorage.setItem('kept.map.quality', 'simple'));
  const page = await context.newPage();

  // 1. Imperial, from Settings.
  await chooseUnits(page, 'Imperial');
  await axe(page, 'Settings with Units');

  // 2. The map: a room typed in feet and inches, kept in centimetres.
  const name = `Units home ${Date.now()}`;
  const home = await api(page).post<Located>('/api/v1/locations', {
    name,
    kind: 'home',
    rooms: ['Hall'],
    preset: 'essentials',
    timezone: 'Africa/Cairo',
    currency: 'EGP',
  });
  await page.goto(`/loc/${home.id}`);
  await page.getByRole('button', { name: 'Room or spot' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill('Den');
  const width = dialog.getByRole('textbox', { name: 'Width' });
  await width.fill(`12'6"`);
  await width.blur();
  await expect(width).toHaveValue('12 ft 6 in');
  const length = dialog.getByRole('textbox', { name: 'Length' });
  await length.fill('10 ft');
  await length.blur();
  await expect(length).toHaveValue('10 ft');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Added Den').first()).toBeVisible();
  const map = await api(page).get<{
    rooms: { name: string; layout: { w: number; d: number } | null }[];
  }>(`/api/v1/locations/${home.id}/map`);
  expect(map.rooms.find((r) => r.name === 'Den')?.layout).toMatchObject({ w: 381, d: 305 });
  await page.goto(`/loc/${home.id}?view=map`);
  const stage = page.getByRole('region', { name: `Map of ${name}` });
  await expect(stage.locator('.map-label', { hasText: 'Den' })).toHaveCount(1, {
    timeout: 60_000,
  });
  const places = page.getByRole('region', { name: 'Places on this level' });
  await places.getByRole('button', { name: 'Den', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(stage.getByRole('heading', { name: 'Den' })).toBeVisible();
  await expect(stage.getByText('12 ft 6 in × 10 ft')).toBeVisible();

  // 3. A label sheet: stock sizes in inches.
  await page.goto(`/labels?loc=${home.id}&blank=24`);
  await expect(
    page
      .getByRole('radio', { name: /A4 sheet/ })
      .first()
      .locator('xpath=ancestor::label'),
  ).toContainText('2.76 × 1.46 in');
  await expect(
    page.getByRole('radio', { name: /Letter sheet/ }).locator('xpath=ancestor::label'),
  ).toContainText('2.63 × 1 in');
  await axe(page, 'Labels in inches');

  // 4. A car he adds counts in miles; its fuel use reads in mpg.
  const locations = await api(page).get<{ locations?: Located[] } | Located[]>('/api/v1/locations');
  const list = Array.isArray(locations) ? locations : (locations.locations ?? []);
  const garage = list.find((l) => l.name === 'Garage');
  if (!garage) throw new Error('no Garage');
  const { items } = await api(page).get<{ items: Located[] }>(
    `/api/v1/things?locationId=${garage.id}&q=${encodeURIComponent('Toyota Corolla')}`,
  );
  const corollaId = items.find((t) => t.name === 'Toyota Corolla')?.id;
  const corolla = await api(page).get<Thing>(`/api/v1/things/${corollaId}`);
  const carName = `Units car ${Date.now()}`;
  const car = await api(page).post<Thing>('/api/v1/things', {
    locationId: garage.id,
    placeId: corolla.placeId,
    name: carName,
    typeId: corolla.type?.id,
  });
  const meter = car.meters[0];
  expect(meter?.unit).toBe('mi');
  for (const [odometer, amount, at] of [
    ['20000', '40', daysAgo(10)],
    ['20400', '30', daysAgo(2)],
  ] as const) {
    await api(page).post(`/api/v1/things/${car.id}/fuel`, {
      id: uuidv7(),
      takenAt: at,
      amount,
      unit: 'L',
      isFull: true,
      reading: { meterId: meter?.id, value: odometer },
    });
  }
  // 30 L over 400 mi: 7.5 L per 100 mi, 50.5 US mpg.
  await page.goto(`/t/${car.id}?tab=fuel`);
  await expect(page.getByRole('region', { name: 'Fuel' }).getByText('50.5 mpg')).toBeVisible();

  // Change unit: converted to km after a preview, then Undo.
  await page.goto(`/t/${car.id}`);
  const odometer = page.getByRole('region', { name: 'Odometer' });
  await expect(odometer).toContainText('20,400 mi');
  await odometer.getByRole('button', { name: 'Change unit' }).click();
  const sheet = page.getByRole('dialog', { name: 'Change unit' });
  await expect(sheet.getByText('From mi to km')).toBeVisible();
  await expect(sheet.getByRole('status')).toContainText(
    'Latest reading: 20,400 mi becomes 32,830.618 km',
  );
  await expect(sheet.getByRole('status')).toContainText('2 readings change');
  await axe(page, 'Change unit');
  await sheet.getByRole('button', { name: 'Change unit', exact: true }).click();
  await expect(page.getByText('Unit changed to km').first()).toBeVisible();
  await expect(odometer).toContainText('32,830.618 km');
  await page.getByRole('button', { name: 'Undo', exact: true }).last().click();
  await expect(odometer).toContainText('20,400 mi');
  expect((await api(page).get<Thing>(`/api/v1/things/${car.id}`)).meters[0]?.unit).toBe('mi');

  // 5. Back to metric: the same fuel use in L/100 km, the label sizes in mm.
  await chooseUnits(page, 'Metric');
  await page.goto(`/t/${car.id}?tab=fuel`);
  await expect(page.getByRole('region', { name: 'Fuel' }).getByText('4.7 L/100 km')).toBeVisible();
  await page.goto(`/labels?loc=${home.id}&blank=24`);
  await expect(
    page.getByRole('radio', { name: /Letter sheet/ }).locator('xpath=ancestor::label'),
  ).toContainText('67 × 25 mm');
  await context.close();
});
