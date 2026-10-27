/**
 * Kept on a home network over plain HTTP (the `insecure` project): the `lan` instance's public URL
 * is http://kept.lan:8213, which Chromium maps to 127.0.0.1, so the page is not a secure context
 * (no `crypto.subtle`, no `navigator.clipboard`), as on a home network. Uploads and Copy work there
 * all the same; the banner can be dismissed; and the same Kept opened at http://127.0.0.1:8213
 * says which address it is set up for. Your own data works there too: Get started takes "Staying
 * on my home network", Home exports without its secret values (each marked as left out, read back
 * from the ZIP itself) and imports again; and what shows a secret or hands out a key says it needs
 * HTTPS. Runs at a phone's size and a desktop's, on the `households` seed, each journey with
 * things of its own.
 */
import { readFile } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
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

/** The households seed's two secret values (its router's Wi-Fi password, its safe's combination). */
const SEED_SECRETS = ['olive-kettle-42', '17-42-08'];
const HTTPS_NEEDED = 'This needs a secure (HTTPS) connection to Kept.';

/** Every entry of a small ZIP, inflated: the central directory, then each local entry. */
function unzip(zip: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  let end = zip.length - 22;
  while (end >= 0 && zip.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error('not a ZIP');
  let at = zip.readUInt32LE(end + 16);
  const entries = zip.readUInt16LE(end + 10);
  for (let i = 0; i < entries; i++) {
    if (zip.readUInt32LE(at) !== 0x02014b50) throw new Error('bad central directory');
    const method = zip.readUInt16LE(at + 10);
    const size = zip.readUInt32LE(at + 20);
    const nameLength = zip.readUInt16LE(at + 28);
    const skip = zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32);
    const local = zip.readUInt32LE(at + 42);
    const name = zip.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const data = zip.subarray(start, start + size);
    out.set(name, method === 0 ? Buffer.from(data) : inflateRawSync(data));
    at += 46 + nameLength + skip;
  }
  return out;
}

/** A thing of a location by its name, through the API. */
async function thingIn(page: Page, locationId: string, name: string): Promise<string> {
  const body = (await getJson(page, `/api/v1/things?locationId=${locationId}&limit=200`)) as {
    items: { id: string; name: string }[];
  };
  const found = body.items.find((x) => x.name === name);
  if (!found) throw new Error(`no thing named ${name} in ${locationId}`);
  return found.id;
}

async function locationNamed(page: Page, name: string): Promise<string> {
  const body = (await getJson(page, '/api/v1/locations')) as {
    locations: { id: string; name: string }[];
  };
  const found = body.locations.find((l) => l.name === name);
  if (!found) throw new Error(`no location named ${name}`);
  return found.id;
}

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

    test('Get started: "Staying on my home network" completes the HTTPS step', async ({ page }) => {
      await page.goto('/');
      const started = page.getByRole('region', { name: 'Get started' });
      await expect(started).toBeVisible();
      await started.getByRole('button', { name: /^Get started/ }).click();
      const stay = started.getByRole('button', { name: 'Staying on my home network' });
      // The phone's run chooses it; the desktop's finds it chosen already (the server keeps it).
      if (size === 'phone') await stay.click();
      await expect(stay).toHaveCount(0);
      await expect(
        started.getByRole('listitem').filter({ hasText: 'Staying on my home network' }),
      ).toBeVisible();
      await expect(
        started.getByRole('listitem').filter({ hasText: 'Put Kept on HTTPS' }),
      ).toHaveCount(0);
    });

    test('what shows a secret or hands out a key says it needs HTTPS', async ({ page }) => {
      await page.goto('/');
      const home = await homeId(page);
      // Revealing a secret value.
      await page.goto(`/t/${await thingIn(page, home, 'Wi-Fi router')}`);
      const secret = page.locator('li[aria-label="Wi-Fi password"]').filter({ visible: true });
      await expect(secret).toBeVisible();
      await secret.getByRole('button', { name: 'Reveal' }).click();
      await expect(toast(page, "Couldn't reveal Wi-Fi password")).toBeVisible();
      await expect(toast(page, HTTPS_NEEDED)).toBeVisible();
      for (const value of SEED_SECRETS) await expect(page.getByText(value)).toHaveCount(0);

      // Opening an export's secrets on import: refused before the passphrase is looked at.
      const opened = await page.evaluate(async () => {
        const res = await fetch('/api/v1/imports/0b7e2c4a-5d1f-4e8a-9c3b-2a6f8d0e1b47/passphrase', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ passphrase: 'an e2e passphrase, never sent on' }),
        });
        return { status: res.status, code: ((await res.json()) as { code?: string }).code };
      });
      expect(opened).toEqual({ status: 403, code: 'https_required' });

      // Making a token in the browser: the server's command line can.
      await page.goto('/settings/connections');
      await page.getByRole('button', { name: 'New token' }).first().click();
      const sheet = page.getByRole('dialog', { name: 'New token' });
      await sheet.getByRole('textbox', { name: 'Name' }).fill(`Home Assistant (${size})`);
      await sheet.getByRole('button', { name: 'Make token' }).click();
      await expect(sheet.getByText(/kept admin token create/)).toBeVisible();
      await expect(sheet.getByText(HTTPS_NEEDED, { exact: false })).toBeVisible();
      // The sheet goes back in history as it closes; wait for that before going elsewhere.
      await page.keyboard.press('Escape');
      await expect(sheet).toHaveCount(0);
      await expect(page).toHaveURL(/\/settings\/connections/);

      // Backup settings: said up front, and Save stays off.
      await page.goto('/admin/backups');
      await expect(
        page.getByText('Backup settings and the recovery kit can only be changed over HTTPS.'),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();

      // The recovery kit's download from the browser (the server's command line can).
      await page.goto('/admin/status');
      await page
        .getByRole('button', { name: /^Download (recovery kit|again)$/ })
        .filter({ visible: true })
        .last()
        .click();
      const kit = page.getByRole('dialog', { name: 'Download the recovery kit' });
      await kit.getByLabel('Your password', { exact: true }).fill(PASSWORD);
      await kit.getByRole('button', { name: 'Download', exact: true }).click();
      await expect(kit.getByText(HTTPS_NEEDED)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(kit).toHaveCount(0);

      // Passkeys: the browser offers none on a plain-HTTP address, and the page says why.
      await page.goto('/settings');
      await expect(page.getByText(/^Passkeys need HTTPS\./)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add a passkey' })).toHaveCount(0);
    });

    test('Home exports without its secret values, each marked, and imports again', async ({
      page,
    }, info) => {
      test.setTimeout(420_000);
      await page.goto('/settings/export?sheet=location');
      const sheet = page.getByRole('dialog', { name: 'Export a location' });
      await expect(sheet).toBeVisible();
      const location = sheet.getByRole('combobox', { name: 'Location' });
      if ((await location.inputValue()) !== 'Home') {
        await location.fill('Home');
        await page.getByRole('option', { name: 'Home', exact: true }).click();
      }
      await expect(sheet.getByRole('switch', { name: 'Include secrets' })).toBeDisabled();
      await expect(
        sheet.getByText(/^Over plain HTTP, secret values stay out of the export\./),
      ).toBeVisible();
      await sheet.getByRole('button', { name: 'Export Home', exact: true }).click();

      const download = page.getByRole('button', { name: 'Download the export of Home' }).first();
      await expect(download).toBeEnabled({ timeout: 240_000 });
      const waiting = page.waitForEvent('download');
      await download.click();
      const zipPath = info.outputPath(`home-${size}.zip`);
      await (await waiting).saveAs(zipPath);

      // The ZIP itself: no secret value in any entry, the router marked, the manifest counting.
      const entries = unzip(await readFile(zipPath));
      expect(entries.has('secrets.json')).toBe(false);
      for (const [name, bytes] of entries) {
        for (const value of SEED_SECRETS) expect(bytes.includes(value), name).toBe(false);
      }
      const manifest = JSON.parse(entries.get('manifest.json')?.toString('utf8') ?? '{}') as {
        includesSecrets: boolean;
        secretsWithheld?: number;
      };
      expect(manifest.includesSecrets).toBe(false);
      expect(manifest.secretsWithheld ?? 0).toBeGreaterThan(0);
      const things = (entries.get('data/things.ndjson')?.toString('utf8') ?? '')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as { name: string; secretsWithheld?: string[] });
      expect(things.find((x) => x.name === 'Wi-Fi router')?.secretsWithheld).toEqual([
        'wifi_password',
      ]);

      // And it imports into a new location, the router without its password.
      const copy = `Home copy (${size})`;
      await page.goto('/settings/import?source=kept_zip');
      await expect(page.getByRole('heading', { name: 'The Kept export' })).toBeVisible();
      await page.locator('input[type="file"]').setInputFiles(zipPath);
      await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByRole('heading', { name: 'It holds encrypted secrets' })).toHaveCount(
        0,
      );
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      const target = page.getByRole('textbox', { name: 'Name', exact: true });
      await expect(target).toBeVisible();
      await target.fill(copy);
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await page.getByRole('button', { name: 'Check the import', exact: true }).click();
      await expect(page.getByText(/secret values? left out of the export/)).toBeVisible({
        timeout: 60_000,
      });
      const go = page.getByRole('button', { name: /^Import \d+ things?$/ });
      await expect(go).toBeVisible({ timeout: 60_000 });
      await go.click();
      await expect(page.getByRole('heading', { name: `Imported into ${copy}` })).toBeVisible({
        timeout: 180_000,
      });
      const router = await thingIn(page, await locationNamed(page, copy), 'Wi-Fi router');
      const view = (await getJson(page, `/api/v1/things/${router}`)) as {
        secrets?: { fieldKey: string; set: boolean }[];
      };
      expect(view.secrets?.find((x) => x.fieldKey === 'wifi_password')?.set ?? false).toBe(false);
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
