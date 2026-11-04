/**
 * One Kept on several addresses in a real browser (#405, D275): `lan-extra`, whose main address is
 * http://kept.lan:8218, with http://kept-ts.lan:8218 and http://kept-ts.localhost:8218 in
 * KEPT_EXTRA_ADDRESSES. The browser's own `Origin` is what's compared, so each name is opened for
 * real; `kept-other.lan` isn't listed and `kept-ts.lan.example.com` only looks it. Listed vs
 * unlisted at every level, the whole sign-in length table and Home Assistant ingress are in
 * apps/server/src/auth/extra-addresses.test.ts and http-sign-in-days.test.ts.
 */
import { randomUUID } from 'node:crypto';
import { type Browser, type BrowserContext, expect, type Page, test } from '@playwright/test';
import { LAN_EXTRA_INSTANCE } from './instances';
import { go, signInKit } from './sign-in-kit';

test.describe.configure({ mode: 'serial' });

const PORT = LAN_EXTRA_INSTANCE.port;
const MAIN = `http://kept.lan:${PORT}`;
const EXTRA = `http://kept-ts.lan:${PORT}`;
/** Listed too, and a secure context, so the browser would offer a passkey here. */
const EXTRA_SECURE = `http://kept-ts.localhost:${PORT}`;
const UNLISTED = `http://kept-other.lan:${PORT}`;
const LOOKALIKE = `http://kept-ts.lan.example.com:${PORT}`;
const PASSWORD = 'kept-seed-password';
const IBRAHIM = 'ibrahim@kept.test';
const LOUIS = 'louis@kept.test';
const SEEDED_THING = 'HDMI cable, 2 m';
const MAILPIT = 'http://localhost:8025';
const DAY = 86_400;
const kit = signInKit(LAN_EXTRA_INSTANCE, { phone: 60, desktop: 70 });

const sizes = {
  phone: { width: 375, height: 780 },
  desktop: { width: 1280, height: 800 },
};

async function open(browser: Browser, url: string, viewport = sizes.desktop) {
  const context = await browser.newContext({
    baseURL: url,
    viewport,
    timezoneId: 'Africa/Cairo',
    locale: 'en-GB',
  });
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': kit.nextAddress() });
  return { context, page };
}

async function signIn(page: Page, login = IBRAHIM) {
  await go(page, '/signin');
  await page.getByLabel('Email or username', { exact: true }).fill(login);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  const answered = page.waitForResponse((r) => r.url().includes('/api/v1/auth/sign-in/'));
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  return answered;
}

/** A write from the page itself, Origin and all: only the browser maps these names here. */
function fetchIn(page: Page, url: string, body: unknown) {
  return page.evaluate(
    async ([u, b, key]) => {
      const res = await fetch(u as string, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'idempotency-key': key as string },
        body: JSON.stringify(b),
      });
      return { status: res.status, json: await res.json().catch(() => null) };
    },
    [url, body, randomUUID()] as const,
  );
}

const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

const sessionCookie = async (context: BrowserContext, url: string) =>
  (await context.cookies(url)).find((c) => c.name.endsWith('session_token'));

/** The newest mail to `to` since `since` holding a link of `path`, as written in the mail. */
async function mailedLink(to: string, since: number, path: string): Promise<string> {
  let link = '';
  await expect
    .poll(
      async () => {
        const query = encodeURIComponent(`to:"${to}"`);
        const found = (await (
          await fetch(`${MAILPIT}/api/v1/search?query=${query}&limit=20`)
        ).json()) as { messages: { ID: string; Created: string }[] };
        for (const m of found.messages) {
          if (Date.parse(m.Created) < since - 2_000) continue;
          const mail = (await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json()) as {
            Text: string;
          };
          const url = mail.Text.match(new RegExp(`https?://\\S+${path}#token=\\S+`))?.[0];
          if (url) {
            link = url;
            return true;
          }
        }
        return false;
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  return link;
}

test.describe('a listed address', () => {
  test('signs in and writes, for the sign-in length set, and on that address alone', async ({
    browser,
  }) => {
    const { context, page } = await open(browser, EXTRA);
    const answered = await signIn(page);
    expect(answered.status()).toBe(200);
    await expect(page).toHaveURL(`${EXTRA}/`);

    // KEPT_HTTP_SIGN_IN_DAYS on this address as on the main one.
    const line = (await answered.headersArray()).find(
      (h) => h.name.toLowerCase() === 'set-cookie' && h.value.includes('session_token='),
    )?.value;
    expect(line).toContain(`Max-Age=${7 * DAY};`);
    expect(line).not.toMatch(/;\s*Domain=/i);

    const made = await fetchIn(page, '/api/v1/locations', {
      name: `Tailnet ${randomUUID().slice(0, 8)}`,
      kind: 'home',
      preset: 'essentials',
      timezone: 'Africa/Cairo',
      currency: 'EGP',
      rooms: [],
    });
    expect(made.status, JSON.stringify(made.json)).toBe(201);
    await go(page, '/settings');
    await expect(page).toHaveURL(`${EXTRA}/settings`);

    // Browsers keep cookies per address: the main one, in this same browser, isn't signed in.
    expect(await sessionCookie(context, EXTRA)).toBeDefined();
    expect(await sessionCookie(context, MAIN)).toBeUndefined();
    const there = await context.newPage();
    await there.setExtraHTTPHeaders({ 'x-forwarded-for': kit.nextAddress() });
    await there.goto(`${MAIN}/settings`);
    await expect(there).toHaveURL(/\/signin/);
    await context.close();
  });

  test('Admin → Status shows the addresses in force', async ({ browser }) => {
    const { context, page } = await open(browser, EXTRA);
    await signIn(page);
    await expect(page).toHaveURL(`${EXTRA}/`);
    await go(page, '/admin/status');
    const tile = page.getByText('Addresses', { exact: true }).locator('..');
    await expect(tile.getByText(MAIN, { exact: true })).toBeVisible();
    await expect(tile.getByText(EXTRA, { exact: true })).toBeVisible();
    await expect(tile.getByText(EXTRA_SECURE, { exact: true })).toBeVisible();
    await expect(tile).toContainText('set by KEPT_EXTRA_ADDRESSES');
    await context.close();
  });

  test('a link copied here is on the main address', async ({ browser }) => {
    const { context, page } = await open(browser, EXTRA);
    await signIn(page);
    await expect(page).toHaveURL(`${EXTRA}/`);
    const found = await page.evaluate(async (q) => {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}&kind=things`);
      return (await res.json()) as { things: { items: { id: string; name: string }[] } };
    }, SEEDED_THING);
    const thing = found.things.items.find((x) => x.name === SEEDED_THING);
    expect(thing, JSON.stringify(found)).toBeDefined();
    await go(page, `/t/${thing?.id}`);
    await expect(page.getByRole('heading', { name: SEEDED_THING, level: 1 })).toBeVisible();
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
    const direct = page.getByRole('button', { name: 'Copy link', exact: true }).filter({
      visible: true,
    });
    if (await direct.count()) {
      await direct.first().click();
    } else {
      await page
        .getByRole('button', { name: /^(Actions|More actions)$/ })
        .filter({ visible: true })
        .first()
        .click();
      await page.getByRole('menuitem', { name: 'Copy link', exact: true }).click();
    }
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { copied: string[] }).copied))
      .toEqual([expect.stringMatching(new RegExp(`^${MAIN.replaceAll('.', '\\.')}/t/`))]);
    await context.close();
  });
});

test.describe('an address not on the list', () => {
  for (const url of [UNLISTED, LOOKALIKE]) {
    test(`${url} is told the main address, and nothing of the list`, async ({ browser }) => {
      const { context, page } = await open(browser, url);
      const answered = await signIn(page);
      expect(answered.status()).toBe(403);
      await expect(
        page.getByText(`This Kept is set up for ${MAIN}. Open it there.`).first(),
      ).toBeVisible();
      await expect(page.getByRole('link', { name: `Open ${MAIN}` })).toBeVisible();
      expect(await answered.text()).not.toContain('kept-ts');
      expect(await page.content()).not.toContain('kept-ts.lan:');
      expect(await sessionCookie(context, url)).toBeUndefined();
      await context.close();
    });
  }
});

test.describe('passkeys: the main address only', () => {
  test('where the browser would offer one, the listed address doesn’t, and says why', async ({
    browser,
  }) => {
    const { context, page } = await open(browser, EXTRA_SECURE);
    await go(page, '/signin');
    expect(await page.evaluate(() => window.isSecureContext)).toBe(true);
    expect(await page.evaluate(() => typeof window.PublicKeyCredential)).toBe('function');
    await expect(page.getByRole('heading', { name: 'Sign in to Kept' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in with a passkey' })).toHaveCount(0);
    await expect(
      page.getByText(
        `Passkeys work only at ${MAIN}, because browsers tie a passkey to one address. Here, use your password or an email link.`,
      ),
    ).toBeVisible();

    await signIn(page);
    await expect(page).toHaveURL(`${EXTRA_SECURE}/`);
    await go(page, '/settings');
    await expect(page.getByRole('heading', { name: 'Passkeys' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add a passkey' })).toHaveCount(0);
    await expect(page.getByText(/Passkeys work only at .* Add one there\./)).toBeVisible();

    // The server's own refusal, should a page ask anyway.
    const refused = await fetchIn(page, '/api/v1/me/passkeys/confirm', { password: PASSWORD });
    expect(refused.status).toBe(403);
    expect(refused.json).toMatchObject({ code: 'origin_mismatch', expectedOrigin: MAIN });
    await context.close();
  });

  test('the main address says nothing of it', async ({ browser }) => {
    const { context, page } = await open(browser, MAIN);
    await go(page, '/signin');
    await expect(page.getByRole('heading', { name: 'Sign in to Kept' })).toBeVisible();
    await expect(page.getByText(/Passkeys work only at/)).toHaveCount(0);
    await context.close();
  });
});

test.describe('email', () => {
  for (const [size, viewport] of Object.entries(sizes)) {
    test(`an email link asked for here lands on the main address, at a ${size}'s size`, async ({
      browser,
    }) => {
      const { context, page } = await open(browser, EXTRA, viewport);
      await go(page, '/signin');
      await expect(page.getByText(/Passkeys work only at/)).toBeVisible();
      expect(await noOverflow(page)).toBe(true);

      const since = Date.now();
      await page.getByLabel('Email or username', { exact: true }).fill(LOUIS);
      await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
      await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
      await expect(
        page.getByText(
          `The link opens at ${MAIN} and signs you in there, not on this address. Can't reach it from here? Use your password.`,
        ),
      ).toBeVisible();
      expect(await noOverflow(page)).toBe(true);

      const link = await mailedLink(LOUIS, since, '/auth/confirm');
      expect(new URL(link).origin).toBe(MAIN);
      await page.goto(link);
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page).toHaveURL(new RegExp(`^${MAIN}/`));
      await expect(page).not.toHaveURL(/\/auth\/confirm/);

      // Signed in there, and not where it was asked for.
      expect(await sessionCookie(context, MAIN)).toBeDefined();
      expect(await sessionCookie(context, EXTRA)).toBeUndefined();
      await context.close();
    });
  }

  test('a password reset asked for here is set at the main address', async ({ browser }) => {
    const { context, page } = await open(browser, EXTRA);
    await go(page, '/signin');
    const since = Date.now();
    await page.getByLabel('Email or username', { exact: true }).fill(IBRAHIM);
    await page.getByRole('button', { name: 'Forgot your password?' }).click();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    await expect(
      page.getByText(
        `The link opens at ${MAIN}. Set the new password there, then sign in here with it.`,
      ),
    ).toBeVisible();
    const link = await mailedLink(IBRAHIM, since, '/auth/reset');
    expect(new URL(link).origin).toBe(MAIN);
    await context.close();
  });
});
