/**
 * Kept inside Home Assistant (D273), through the ingress mimic (e2e-ha/Caddyfile): the kept-ha
 * image, framed by Home Assistant's page, every request under the ingress prefix. Two apps:
 * `fresh` for first-run setup, `demo` with the households data (KEPT_HA_DEMO).
 *
 * For every page: no request outside the prefix, no response of 400 or more (a signed-out GET's
 * 401 aside), no console error, no service worker.
 */
import { type BrowserContext, expect, type Page, test } from '@playwright/test';

const FRESH = `/api/hassio_ingress/${process.env.KEPT_HA_FRESH_TOKEN}`;
const DEMO = `/api/hassio_ingress/${process.env.KEPT_HA_DEMO_TOKEN}`;
const HA_PAGES = new Set(['/fresh', '/demo', '/favicon.ico']);

type Watch = { outside: string[]; bad: string[]; errors: string[] };

/** Records what the page does that ingress forbids. */
function watch(page: Page, prefix: string): Watch {
  const w: Watch = { outside: [], bad: [], errors: [] };
  const origin = new URL(test.info().project.use.baseURL as string).origin;
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.origin !== origin || HA_PAGES.has(u.pathname)) return;
    if (u.pathname !== prefix && !u.pathname.startsWith(`${prefix}/`)) w.outside.push(u.pathname);
  });
  page.on('response', (r) => {
    const u = new URL(r.url());
    if (u.origin !== origin || r.status() < 400) return;
    // Signed out, the app asks who is there; that is a 401 by design.
    if (r.status() === 401 && r.request().method() === 'GET') return;
    w.bad.push(`${r.status()} ${r.request().method()} ${u.pathname}`);
  });
  page.on('console', (m) => {
    // A failed request also logs "Failed to load resource"; the response check above judges it.
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) {
      w.errors.push(m.text());
    }
  });
  page.on('pageerror', (e) => w.errors.push(e.message));
  return w;
}

function expectClean(w: Watch) {
  expect(w.outside, 'requests outside the ingress prefix').toEqual([]);
  expect(w.bad, 'responses of 400 or more').toEqual([]);
  expect(w.errors, 'console errors').toEqual([]);
}

async function expectNoServiceWorker(page: Page, context: BrowserContext) {
  expect(context.serviceWorkers()).toEqual([]);
  const regs = await page.evaluate(async () =>
    navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : 0,
  );
  expect(regs).toBe(0);
}

const heading = (page: Page, name: string | RegExp) => page.getByRole('heading', { name }).first();

test.describe
  .serial('first-run setup inside Home Assistant (the fresh app)', () => {
    test('anyone but a Home Assistant administrator still needs the code from the Log tab', async ({
      page,
      context,
    }) => {
      await page.setExtraHTTPHeaders({
        'x-test-ha-user': 'member',
        'x-test-client': '198.51.100.21',
      });
      const w = watch(page, FRESH);
      await page.goto(`${FRESH}/setup`);
      await expect(heading(page, 'Enter the setup code')).toBeVisible();
      await expect(
        page.getByText("Your setup code is on the app's Log tab in Home Assistant."),
      ).toBeVisible();
      await expectNoServiceWorker(page, context);
      expectClean(w);
    });

    test('a Home Assistant administrator sets Kept up without the code, in Home Assistant’s frame', async ({
      page,
      context,
    }) => {
      await page.setExtraHTTPHeaders({ 'x-test-client': '198.51.100.22' });
      const w = watch(page, FRESH);
      // Home Assistant's own page, which frames Kept from the same origin.
      await page.goto('/fresh');
      const kept = page.frameLocator('iframe#kept');
      await expect(kept.getByRole('heading', { name: 'Create the first account' })).toBeVisible();
      await expect(kept.getByText('Set up by a Home Assistant administrator')).toBeVisible();
      await kept.getByLabel('Your name').fill('Owner');
      await kept.getByLabel('Email').fill('owner@example.com');
      await kept.getByLabel('Password', { exact: true }).fill('correct horse battery');
      await kept.getByRole('button', { name: 'Create account' }).click();
      await expect(kept.getByRole('heading', { name: 'How should this Kept work?' })).toBeVisible();
      await kept.getByRole('button', { name: 'Finish setup' }).click();
      await expect(kept.getByRole('heading', { name: 'Welcome, Owner' })).toBeVisible();

      // The session cookie is Kept's alone: scoped to the prefix, not the rest of Home Assistant.
      const cookies = await context.cookies();
      expect(cookies.length).toBeGreaterThan(0);
      for (const c of cookies) expect(c.path, c.name).toBe(`${FRESH}/`);
      await expectNoServiceWorker(page, context);
      expectClean(w);
    });
  });

test.describe
  .serial('the demo app’s screens through ingress', () => {
    let page: Page;
    let context: BrowserContext;
    let w: Watch;

    test.beforeAll(async ({ browser }) => {
      context = await browser.newContext({
        extraHTTPHeaders: { 'x-test-client': '198.51.100.31' },
      });
      page = await context.newPage();
      w = watch(page, DEMO);
      await page.goto(`${DEMO}/signin`);
      await page.getByLabel('Email or username', { exact: true }).fill('ibrahim@kept.test');
      await page.getByLabel('Password', { exact: true }).fill('kept-seed-password');
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`^[^?]*${DEMO}/?(\\?.*)?$`));
    });

    test.afterAll(async () => {
      await context.close();
    });

    test('Home, a location, a thing with its photo, search, places', async () => {
      await expect(page.getByRole('navigation').first()).toBeVisible();
      // A location from Home, then a thing in it: real data under the prefix.
      await page.goto(`${DEMO}/search?q=drill`);
      const first = page.getByRole('link', { name: /drill/i }).first();
      await expect(first).toBeVisible();
      await first.click();
      await expect(page).toHaveURL(new RegExp(`${DEMO}/`));
      // A section tab is an in-page link: it stays on this thing, under the prefix (not the home
      // page <base href> points at).
      const thingPath = new URL(page.url()).pathname;
      const tab = page.getByRole('navigation', { name: 'Sections' }).getByRole('link').last();
      if (await tab.count()) {
        await tab.click();
        expect(new URL(page.url()).pathname).toBe(thingPath);
        expect(new URL(page.url()).hash).toMatch(/^#thing-/);
      }
      // The thing's images came from under the prefix and loaded (the server's /f/ URLs).
      await page.waitForLoadState('networkidle');
      const images = await page.evaluate(() =>
        [...document.images]
          .filter((i) => i.src.startsWith(location.origin))
          .map((i) => ({ path: new URL(i.src).pathname, ok: i.complete && i.naturalWidth > 0 })),
      );
      for (const img of images) {
        expect(img.path.startsWith(`${DEMO}/`), img.path).toBe(true);
        expect(img.ok, img.path).toBe(true);
      }
      for (const path of ['/', '/places', '/settings', '/labels', '/graph']) {
        await page.goto(`${DEMO}${path}`);
        await page.waitForLoadState('networkidle');
      }
      expectClean(w);
    });

    test('Admin → Status says Kept runs as a Home Assistant app', async () => {
      await page.goto(`${DEMO}/admin/status`);
      await expect(page.getByText('Running as a Home Assistant app')).toBeVisible();
      expectClean(w);
    });

    test('no service worker, no web app manifest', async () => {
      await page.goto(`${DEMO}/`);
      await expectNoServiceWorker(page, context);
      expect(await page.locator('link[rel="manifest"]').count()).toBe(0);
      expect(await page.locator('base').getAttribute('href')).toBe(`${DEMO}/`);
    });

    test('a write from another site is refused, one from Home Assistant’s page is not', async () => {
      const evil = await page.request.post(`${DEMO}/api/v1/me/email-change`, {
        headers: { origin: 'https://evil.example' },
        data: { newEmail: 'moved@example.com' },
      });
      expect(evil.status()).toBe(403);
      expect(await evil.json()).toMatchObject({ code: 'origin_mismatch' });
      const own = await page.request.patch(`${DEMO}/api/v1/me`, {
        headers: { origin: new URL(page.url()).origin },
        data: {},
      });
      expect((await own.json().catch(() => ({}))) as { code?: string }).not.toMatchObject({
        code: 'origin_mismatch',
      });
    });
  });
