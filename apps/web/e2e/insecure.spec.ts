/**
 * Kept on a home network over plain HTTP (the `insecure` project): the `lan` instance's public URL
 * is http://kept.lan:8213, which Chromium maps to 127.0.0.1, so the page is not a secure context
 * (no `crypto.subtle`, no `navigator.clipboard`), as on a home network. Uploads and Copy work there
 * all the same; the banner can be dismissed; and the same Kept opened at http://127.0.0.1:8213
 * says which address it is set up for. Runs at a phone's size and a desktop's, on the
 * `households` seed, each journey with things of its own.
 */
import { type Browser, expect, type Page, test } from '@playwright/test';
import { LAN_INSTANCE } from './instances';

const LAN = `http://${LAN_INSTANCE.publicHost}:${LAN_INSTANCE.port}`;
const BY_IP = `http://127.0.0.1:${LAN_INSTANCE.port}`;
const PASSWORD = 'kept-seed-password';
const PHOTO = new URL('./fixtures/receipt-usd.jpg', import.meta.url).pathname;
/** A small, valid PDF: one empty page. */
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
);

test.describe.configure({ mode: 'serial' });

/**
 * One sign-in per size, kept as a storage state, so the journeys stay inside Better Auth's
 * per-address sign-in limit (5 a minute).
 */
const signedIn = new Map<string, Promise<string>>();
function stateFor(browser: Browser, size: 'phone' | 'desktop', outDir: string): Promise<string> {
  let state = signedIn.get(size);
  if (!state) {
    state = (async () => {
      const context = await browser.newContext({ baseURL: LAN });
      const page = await context.newPage();
      await signIn(page);
      const path = `${outDir}/signed-in-${size}.json`;
      await context.storageState({ path });
      await context.close();
      return path;
    })();
    signedIn.set(size, state);
  }
  return state;
}

async function signIn(page: Page) {
  await page.goto('/signin');
  await expect(page.getByRole('heading', { name: 'Sign in to Kept' })).toBeVisible();
  await page.getByLabel('Email or username', { exact: true }).fill('ibrahim@kept.test');
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** A GET from the page itself: only the browser maps kept.lan to 127.0.0.1, not Node. */
async function getJson(page: Page, path: string): Promise<unknown> {
  return page.evaluate(async (url) => {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    return res.json();
  }, path);
}

/** The seed's Home, by its id. */
async function homeId(page: Page): Promise<string> {
  const body = (await getJson(page, '/api/v1/locations')) as {
    locations: { id: string; name: string }[];
  };
  const home = body.locations.find((l) => l.name === 'Home');
  if (!home) throw new Error('no location named Home');
  return home.id;
}

async function thingId(page: Page, name: string): Promise<string> {
  const body = (await getJson(
    page,
    `/api/v1/search?q=${encodeURIComponent(name)}&kind=things`,
  )) as { things: { items: { id: string; name: string }[] } };
  const found = body.things.items.find((x) => x.name === name);
  if (!found) throw new Error(`no thing named ${name}`);
  return found.id;
}

/** A thing page action: a header button where there is one, else the Actions menu. */
async function thingAction(page: Page, name: string) {
  const direct = page.getByRole('button', { name, exact: true }).filter({ visible: true });
  if (await direct.count()) {
    await direct.first().click();
    return;
  }
  await page
    .getByRole('button', { name: /^(Actions|More actions)$/ })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}

/** Picks `files` in the chooser that pressing `button` opens. */
async function choose(
  page: Page,
  button: string,
  files: Parameters<import('@playwright/test').FileChooser['setFiles']>[0],
) {
  const chooser = page.waitForEvent('filechooser');
  await page
    .getByRole('button', { name: button, exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await (await chooser).setFiles(files);
}

const toast = (page: Page, text: string | RegExp) =>
  page.getByRole('region', { name: 'Notifications' }).getByText(text);

for (const size of ['phone', 'desktop'] as const) {
  test.describe(`at a ${size}'s size`, () => {
    test.use(
      size === 'phone'
        ? { viewport: { width: 375, height: 780 }, isMobile: true, hasTouch: true }
        : { viewport: { width: 1280, height: 800 } },
    );
    test.use({
      storageState: async ({ browser }, use, info) =>
        use(await stateFor(browser, size, info.project.outputDir)),
    });

    test('the page is plain HTTP on a network name: not a secure context', async ({ page }) => {
      await page.goto('/signin');
      expect(page.url().startsWith(LAN)).toBe(true);
      const facts = await page.evaluate(() => ({
        secure: window.isSecureContext,
        subtle: typeof globalThis.crypto?.subtle,
        clipboard: typeof navigator.clipboard,
      }));
      expect(facts).toEqual({ secure: false, subtle: 'undefined', clipboard: 'undefined' });
    });

    test('the HTTPS banner can be dismissed, and stays dismissed', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Home', level: 1 })).toBeVisible();
      const banner = page.getByRole('status').filter({ hasText: 'need HTTPS' });
      await expect(banner).toBeVisible();
      await banner.getByRole('button', { name: 'Dismiss' }).click();
      await expect(banner).toHaveCount(0);
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Home', level: 1 })).toBeVisible();
      await expect(page.getByRole('status').filter({ hasText: 'need HTTPS' })).toHaveCount(0);
    });

    test('a thing added with a photo has the photo; a PDF attached is listed', async ({ page }) => {
      await page.goto('/');
      const name = `HD webcam (${size})`;
      await page.goto(`/loc/${await homeId(page)}`);
      await page
        .getByRole('region', { name: 'Add here' })
        .or(page.locator('section', { hasText: 'Add here' }))
        .first()
        .getByRole('button', { name: 'Thing', exact: true })
        .click();
      const sheet = page.getByRole('dialog', { name: 'Add a thing' });
      await expect(sheet).toBeVisible();
      await sheet.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
      await choose(page, 'Add a photo', PHOTO);
      await expect(sheet.getByText('receipt-usd.jpg')).toBeVisible();
      await sheet.getByRole('button', { name: 'Add', exact: true }).click();
      await expect(toast(page, `Added ${name}`)).toBeVisible();
      await expect(toast(page, "Saved, but the photo didn't upload")).toHaveCount(0);

      const id = await thingId(page, name);
      await page.goto(`/t/${id}`);
      const photo = page.getByRole('img', { name: 'Photo 1 of 1' }).filter({ visible: true });
      await expect(photo.first()).toBeVisible();
      await expect
        .poll(() => photo.first().evaluate((img) => (img as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);

      await page.goto(`/t/${id}?tab=paperwork`);
      // The photo is listed with the files: one row with Open, then a second for the PDF.
      const open = page
        .getByRole('button', { name: 'Open', exact: true })
        .filter({ visible: true });
      await expect(open).toHaveCount(1);
      await choose(page, 'Add a file', {
        name: 'webcam-manual.pdf',
        mimeType: 'application/pdf',
        buffer: PDF,
      });
      await expect(open).toHaveCount(2);
      await expect(toast(page, /Couldn't upload/)).toHaveCount(0);
    });

    test("Copy link copies the thing's address", async ({ page }) => {
      await page.goto('/');
      const id = await thingId(page, `HD webcam (${size})`);
      await page.goto(`/t/${id}`);
      await expect(
        page.getByRole('heading', { name: `HD webcam (${size})`, level: 1 }),
      ).toBeVisible();
      // Read what the page copies, and keep it off this machine's clipboard.
      await page.evaluate(() => {
        const w = window as unknown as { copied: string[] };
        w.copied = [];
        document.addEventListener(
          'copy',
          (e) => {
            const el = document.activeElement as HTMLTextAreaElement | null;
            if (el?.tagName === 'TEXTAREA')
              w.copied.push(el.value.slice(el.selectionStart, el.selectionEnd));
            e.preventDefault();
          },
          true,
        );
      });
      await thingAction(page, 'Copy link');
      await expect(toast(page, 'Link copied')).toBeVisible();
      const copied = await page.evaluate(() => (window as unknown as { copied: string[] }).copied);
      expect(copied).toHaveLength(1);
      expect(copied[0]).toMatch(new RegExp(`^${LAN.replaceAll('.', '\\.')}/t/[0-9A-Z]{6}$`));
    });

    test('Homebox import names Backup & Restore', async ({ page }) => {
      await page.goto('/');
      await page.goto('/settings/import');
      await expect(page.getByRole('radio', { name: /A Homebox export/ })).toBeVisible();
      await expect(
        page.getByText(/Collection → Tools → Backup & Restore → Create Backup → Download/),
      ).toBeVisible();
    });

    if (size === 'desktop') {
      test('the sidebar reads Home, Inbox, the locations, Tracking, Tools, then the rest', async ({
        page,
      }) => {
        await page.goto('/');
        const nav = page.getByRole('navigation', { name: 'Main' }).filter({ visible: true });
        const locations = nav.getByRole('navigation', { name: 'Locations' });
        await expect(locations.getByRole('link', { name: 'Garage' })).toBeVisible();
        const order = await nav.evaluate((el) =>
          [...el.querySelectorAll('[data-nav], [data-nav-heading]')].map((n) =>
            n.hasAttribute('data-nav-heading')
              ? `# ${n.textContent?.trim()}`
              : (n.getAttribute('data-nav') ?? ''),
          ),
        );
        const loc = order.indexOf('# Locations');
        expect(order.slice(0, loc)).toEqual(['home', 'inbox']);
        expect(order.indexOf('# Tracking')).toBeGreaterThan(order.indexOf('new-location'));
        expect(order.indexOf('# Tools')).toBeGreaterThan(order.indexOf('# Tracking'));
        expect(order.slice(-5)).toEqual(['activity', 'trash', 'notifications', 'settings', 'help']);
      });
    }

    test(`opened at ${BY_IP}, sign-in names the address it is set up for`, async ({ browser }) => {
      const context = await browser.newContext({
        baseURL: BY_IP,
        viewport: size === 'phone' ? { width: 375, height: 780 } : { width: 1280, height: 800 },
        timezoneId: 'Africa/Cairo',
        locale: 'en-GB',
      });
      const page = await context.newPage();
      try {
        await page.goto('/signin');
        await expect(page.getByRole('heading', { name: 'Sign in to Kept' })).toBeVisible();
        await page.getByLabel('Email or username', { exact: true }).fill('ibrahim@kept.test');
        await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
        await page.getByRole('button', { name: 'Sign in', exact: true }).click();
        await expect(page.getByRole('alert')).toContainText(
          `This Kept is set up for ${LAN}. Open it there.`,
        );
        await expect(page.getByText(/don't match/)).toHaveCount(0);
        const link = page.getByRole('link', { name: `Open ${LAN}` });
        await expect(link).toHaveAttribute('href', `${LAN}/signin`);
      } finally {
        await context.close();
      }
    });
  });
}
