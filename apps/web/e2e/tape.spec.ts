/**
 * Names first; the amber tape means a printed label. Against the real server, on the `labels`
 * instance (households seed), phone and desktop:
 *
 * 1. Two new things on a shelf: the shelf's list shows both by name and neither code.
 * 2. One label printed and confirmed ("Yes, printed OK"): that row shows the amber tape, the other
 *    still no code; its page shows the tape, the other's page a quiet code.
 * 3. Offline, from the phone's copy: the labelled thing's page still shows the tape, the other a
 *    quiet code.
 *
 *   KEPT_E2E_INSTANCES=labels pnpm --filter @kept/web exec playwright test tape.spec.ts
 *
 * Names are invented; the print dialog is the browser's, so `window.print` is stubbed.
 */
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { type Browser, expect, type Page, test } from '@playwright/test';
import { INSTANCES, stateDirOf, urlOf } from './instances';

const INSTANCE = INSTANCES.labels;
const BASE = urlOf(INSTANCE);
const PASSWORD = 'kept-seed-password';

test.use({ baseURL: BASE });

const stateDir = path.join(stateDirOf(INSTANCE), 'sessions');

/** One sign-in per person per run (the sign-in limit), shared with labels-print.spec.ts. */
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

async function person(browser: Browser) {
  const use = test.info().project.use;
  const context = await browser.newContext({
    baseURL: BASE,
    storageState: await storageFor(browser, 'ibrahim@kept.test'),
    viewport: use.viewport ?? { width: 1280, height: 800 },
    isMobile: use.isMobile ?? false,
    hasTouch: use.hasTouch ?? false,
    timezoneId: 'Africa/Cairo',
    locale: 'en-GB',
  });
  await context.addInitScript(() => {
    window.print = () => {};
  });
  return { context, page: await context.newPage() };
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

/** Whether the phone's copy (IndexedDB) has `code` marked printed. */
const printedOnPhone = (page: Page, userId: string, code: string) =>
  page.evaluate(
    ([db, c]) =>
      new Promise<boolean>((resolve) => {
        const open = indexedDB.open(db as string);
        open.onerror = () => resolve(false);
        open.onsuccess = () => {
          const idb = open.result;
          if (!idb.objectStoreNames.contains('codes')) {
            idb.close();
            resolve(false);
            return;
          }
          const get = idb
            .transaction('codes')
            .objectStore('codes')
            .get(c as string);
          get.onsuccess = () => {
            idb.close();
            resolve(!!(get.result as { printedAt?: string } | undefined)?.printedAt);
          };
          get.onerror = () => {
            idb.close();
            resolve(false);
          };
        };
      }),
    [`kept-${userId}`, code],
  );

test('names first: the amber tape only once a label is printed, online and offline', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const { context, page } = await person(browser);
  const home = await homeId(page);
  const me = (await (await page.request.get('/api/v1/me')).json()) as { user: { id: string } };
  const tag = `${test.info().project.name} ${Date.now()}`;
  const shelf = await send(page, `/api/v1/locations/${home}/places`, {
    name: `Hall shelf ${tag}`,
    kindKey: 'zone',
  });
  const made: { id: string; name: string; code: string }[] = [];
  for (const name of ['Desk fan', 'Paper tray']) {
    const t = await send(page, '/api/v1/things', { locationId: home, placeId: shelf.id, name });
    made.push({ id: t.id as string, name, code: t.shortCode as string });
  }
  const [fan, tray] = made as [(typeof made)[0], (typeof made)[0]];
  const row = (name: string) => page.getByRole('link', { name: new RegExp(`^${name}`) });

  // 1. Nothing printed: names only.
  await page.goto(`/p/${shelf.id as string}`);
  await expect(row(fan.name)).toBeVisible();
  await expect(row(tray.name)).toBeVisible();
  await expect(page.getByRole('img', { name: fan.code })).toHaveCount(0);
  await expect(page.getByRole('img', { name: tray.code })).toHaveCount(0);

  // 2. The fan's label, printed and confirmed.
  await page.goto(`/labels?loc=${home}&things=${fan.id}`);
  await expect(page.getByRole('img', { name: fan.code })).toHaveAttribute('data-variant', 'quiet');
  await page.getByRole('button', { name: 'Print 1 label' }).click();
  const ask = page.getByRole('dialog', { name: 'Printed OK?' });
  await expect(ask).toBeVisible();
  await ask.getByRole('button', { name: 'Yes, printed OK' }).click();
  await expect(ask).toBeHidden();

  await page.goto(`/p/${shelf.id as string}`);
  await expect(row(fan.name).getByRole('img', { name: fan.code })).toHaveAttribute(
    'data-variant',
    'tape',
  );
  await expect(page.getByRole('img', { name: tray.code })).toHaveCount(0);

  await page.goto(`/t/${fan.code}`);
  await expect(page.getByRole('heading', { name: fan.name, level: 1 })).toBeVisible();
  await expect(page.getByRole('img', { name: fan.code }).first()).toHaveAttribute(
    'data-variant',
    'tape',
  );
  await page.goto(`/t/${tray.code}`);
  await expect(page.getByRole('heading', { name: tray.name, level: 1 })).toBeVisible();
  await expect(page.getByRole('img', { name: tray.code }).first()).toHaveAttribute(
    'data-variant',
    'quiet',
  );

  // 3. Offline: the phone's copy knows which label is printed.
  await page.goto(`/p/${shelf.id as string}`);
  await expect(row(fan.name)).toBeVisible();
  await expect
    .poll(() => printedOnPhone(page, me.user.id, fan.code), { timeout: 60_000 })
    .toBe(true);
  await context.setOffline(true);
  await row(fan.name).click();
  await expect(page.getByText(/^On this phone · as of last sync, /)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole('img', { name: fan.code })).toHaveAttribute('data-variant', 'tape');
  await page.goBack();
  await row(tray.name).click();
  await expect(page.getByText(/^On this phone · as of last sync, /)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole('img', { name: tray.code })).toHaveAttribute('data-variant', 'quiet');
  await context.setOffline(false);
  await context.close();
});
