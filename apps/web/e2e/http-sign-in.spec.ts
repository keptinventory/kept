/**
 * How long a sign-in lasts in a real browser (#404): `lan-week` (plain HTTP on a network name,
 * KEPT_HTTP_SIGN_IN_DAYS=7), `lan-off` (the same, unset), `https-off` (HTTPS, unset) and `https-week`
 * (HTTPS, set, which does nothing), none shared with another spec. Each row's expiry is read from the Set-Cookie header, the
 * browser's own cookie store and the database, time is moved by editing the session row, and a
 * sign-in that ran out lands on the sign-in page. Plain HTTP on a network name is not a secure
 * context, so no passkeys there; passkeys on a secure address are e2e/sign-in-security.spec.ts's.
 * The other lengths (1 and 30 days) and every sign-in method on every row are in
 * apps/server/src/auth/http-sign-in-days.test.ts.
 *
 * The first request after a session falls due renews it, and only that request gets the cookie. An
 * open app sends its own requests, so what asserts on a renewal runs from a page with no app code
 * (`leaveApp`), and sessions are found by the browser's own cookie, not by who signed in last.
 */
import { randomUUID } from 'node:crypto';
import {
  type Browser,
  type BrowserContext,
  expect as baseExpect,
  type Page,
  type Response,
  test,
} from '@playwright/test';
import {
  HTTPS_OFF_INSTANCE,
  HTTPS_WEEK_INSTANCE,
  type Instance,
  LAN_OFF_INSTANCE,
  LAN_WEEK_INSTANCE,
} from './instances';
import { go, signInKit } from './sign-in-kit';
import { freshCode } from './totp';

// These instances share their Postgres with every other test run on the machine: Admin → Status
// was still loading after 10 s under load. 30 s, as e2e/tls-people.ts has it.
const expect = baseExpect.configure({ timeout: 30_000 });

test.describe.configure({ mode: 'serial' });

const PASSWORD = 'kept-seed-password';
const HOUR = 3600;
const DAY = 86_400;
const SIZES = {
  phone: { width: 375, height: 780 },
  desktop: { width: 1280, height: 800 },
};
const WEEK_URL = `http://${LAN_WEEK_INSTANCE.publicHost}:${LAN_WEEK_INSTANCE.port}`;
const week = signInKit(LAN_WEEK_INSTANCE, { phone: 40, desktop: 50 });

let addresses = 0;
/**
 * An address no other sign-in here has used: every instance here believes X-Forwarded-For, so a
 * retry or --repeat-each doesn't run into the per-address limits (5 sign-ins a minute, 3 mailed
 * links an hour). Each retry and repeat is a new worker with this file loaded again, so they are
 * part of the address. 198.18.0.0/15 is reserved for testing.
 */
const nextAddress = () => {
  const { repeatEachIndex, retry } = test.info();
  addresses += 1;
  return `198.18.${repeatEachIndex * 10 + retry}.${addresses}`;
};
const MAILPIT = 'http://localhost:8025';

type Row = {
  name: string;
  instance: Instance;
  url: string;
  https: boolean;
  lifetime: number;
  /** Seconds after the last renewal a request renews it; null: never. */
  renewsAfter: number | null;
  tile: string;
  detail: string;
};

const ROWS: Row[] = [
  {
    name: 'http, set to 7',
    instance: LAN_WEEK_INSTANCE,
    url: WEEK_URL,
    https: false,
    lifetime: 7 * DAY,
    renewsAfter: DAY,
    tile: '7 days',
    detail: 'Over plain HTTP, set by KEPT_HTTP_SIGN_IN_DAYS. Renewed as it is used.',
  },
  {
    name: 'http, unset',
    instance: LAN_OFF_INSTANCE,
    url: `http://${LAN_OFF_INSTANCE.publicHost}:${LAN_OFF_INSTANCE.port}`,
    https: false,
    lifetime: 12 * HOUR,
    renewsAfter: null,
    tile: '12 hours',
    detail: 'Over plain HTTP, not renewed. KEPT_HTTP_SIGN_IN_DAYS makes it longer.',
  },
  {
    name: 'https, unset',
    instance: HTTPS_OFF_INSTANCE,
    url: `https://localhost:${HTTPS_OFF_INSTANCE.port}`,
    https: true,
    lifetime: 30 * DAY,
    renewsAfter: DAY,
    tile: '30 days',
    detail: 'Renewed as it is used.',
  },
  {
    name: 'https, set to 7',
    instance: HTTPS_WEEK_INSTANCE,
    url: `https://localhost:${HTTPS_WEEK_INSTANCE.port}`,
    https: true,
    lifetime: 30 * DAY,
    renewsAfter: DAY,
    tile: '30 days',
    detail: 'Renewed as it is used. KEPT_HTTP_SIGN_IN_DAYS has no effect over HTTPS.',
  },
];

function person(browser: Browser, url: string, viewport = SIZES.desktop): Promise<BrowserContext> {
  return browser.newContext({
    baseURL: url,
    viewport,
    ignoreHTTPSErrors: url.startsWith('https:'),
    // A service worker would answer leaveApp's navigation with the app.
    serviceWorkers: 'block',
    timezoneId: 'Africa/Cairo',
    locale: 'en-GB',
  });
}

const setCookieLine = async (res: Response) =>
  (await res.headersArray())
    .filter((h) => h.name.toLowerCase() === 'set-cookie' && h.value.includes('session_token='))
    .map((h) => h.value)[0] ?? '';

const sessionCookie = async (context: BrowserContext) =>
  (await context.cookies()).find((c) => c.name.endsWith('session_token'));

/** The exact Set-Cookie, and the browser's store agreeing with it to the minute. */
async function expectCookie(context: BrowserContext, line: string, row: Row) {
  expect(line).toContain(`Max-Age=${row.lifetime};`);
  expect(line).toMatch(/;\s*HttpOnly/i);
  expect(line).toMatch(/;\s*SameSite=Lax/i);
  if (row.https) {
    expect(line).toMatch(/^__Secure-/);
    expect(line).toMatch(/;\s*Secure/i);
  } else {
    expect(line).not.toMatch(/__Secure-/);
    expect(line).not.toMatch(/;\s*Secure/i);
  }
  const cookie = await sessionCookie(context);
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.secure).toBe(row.https);
  expect(cookie?.sameSite).toBe('Lax');
  expect(Math.abs((cookie?.expires ?? 0) - (Date.now() / 1000 + row.lifetime))).toBeLessThan(120);
}

type SessionRow = {
  id: string;
  lifetime: number;
  left: number;
  created: string;
  /** To the microsecond: any renewal, by any request, changes it. */
  expires: string;
};

/** The sign-in this browser holds, by the token in its cookie: its length as written, what's left,
 * and when it began. */
async function sessionOf(instance: Instance, context: BrowserContext): Promise<SessionRow> {
  const cookie = await sessionCookie(context);
  // The cookie is `<token>.<signature>`, URL-encoded.
  const token = decodeURIComponent(cookie?.value ?? '').split('.')[0];
  const { asAuth } = signInKit(instance, { phone: 0, desktop: 0 });
  return asAuth(async (q) => {
    const { rows } = await q(
      `SELECT id,
              round(extract(epoch FROM expires_at - created_at))::int AS lifetime,
              extract(epoch FROM expires_at - now())::int AS left,
              created_at::text AS created,
              expires_at::text AS expires
         FROM auth.session
        WHERE token = $1`,
      [token],
    );
    if (!rows[0]) throw new Error(`${instance.name}: no session for this browser's cookie`);
    return rows[0] as SessionRow;
  });
}

/** Moves the clock: this many seconds are left on the sign-in. */
function setLeft(instance: Instance, id: string, seconds: number) {
  const { asAuth } = signInKit(instance, { phone: 0, desktop: 0 });
  return asAuth((q) =>
    q('UPDATE auth.session SET expires_at = now() + make_interval(secs => $2) WHERE id = $1', [
      id,
      seconds,
    ]),
  );
}

/** A request from the page itself: only the browser maps kept.lan to 127.0.0.1. */
function fetchIn(page: Page, url: string, body?: unknown) {
  return page.evaluate(
    async ([u, b, key]) => {
      const res = await fetch(u as string, {
        method: b === undefined ? 'GET' : 'POST',
        credentials: 'include',
        headers: {
          ...(b === undefined ? {} : { 'content-type': 'application/json' }),
          'idempotency-key': key as string,
        },
        ...(b === undefined ? {} : { body: JSON.stringify(b) }),
      });
      const text = await res.text();
      let json: Record<string, unknown> | null = null;
      try {
        json = JSON.parse(text);
      } catch {}
      return { status: res.status, json };
    },
    // Made here: crypto.randomUUID is secure-context only, and this page may not be one.
    [url, body, randomUUID()] as const,
  );
}

/**
 * Takes the page out of the app, onto Kept's own /readyz (JSON, so no app code), so the requests
 * that follow are the only ones this browser sends. A blank page made up in the test won't do:
 * Chromium then counts it as public and refuses its requests to a loopback address. The session
 * must not be due yet: the request at the end sees out anything the app had already sent, which
 * then can't renew it.
 */
async function leaveApp(page: Page) {
  await page.goto('/readyz');
  expect((await fetchIn(page, '/api/v1/me/sessions')).status).toBe(200);
}

/** The next API request's response, with the Set-Cookie it carried, if any. From `leaveApp`'s page:
 * in the app, another request may have taken the renewal first. */
async function nextRequest(page: Page) {
  const response = page.waitForResponse((r) => r.url().endsWith('/api/v1/me/sessions'));
  const { status } = await fetchIn(page, '/api/v1/me/sessions');
  expect(status).toBe(200);
  return setCookieLine(await response);
}

async function signIn(page: Page, login: string, password = PASSWORD) {
  await go(page, '/signin');
  await page.getByLabel('Email or username', { exact: true }).fill(login);
  await page.getByLabel('Password', { exact: true }).fill(password);
  const response = page.waitForResponse((r) => r.url().includes('/api/v1/auth/sign-in/'));
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  return response;
}

const IBRAHIM = 'ibrahim@kept.test';

for (const row of ROWS) {
  for (const [size, viewport] of Object.entries(SIZES)) {
    test(`${row.name}, at a ${size}'s size: expiry, renewal, running out, and Admin → Status`, async ({
      browser,
    }) => {
      test.setTimeout(180_000);
      const context = await person(browser, row.url, viewport);
      const page = await context.newPage();
      await page.setExtraHTTPHeaders({ 'x-forwarded-for': nextAddress() });

      const line = await setCookieLine(await signIn(page, IBRAHIM));
      await expect(page).toHaveURL(/\/$/);
      await expectCookie(context, line, row);
      const first = await sessionOf(row.instance, context);
      expect(first.lifetime).toBe(row.lifetime);

      await go(page, '/admin/status');
      const tile = page.getByText('Sign-in length', { exact: true }).locator('..');
      await expect(tile.getByText(row.tile, { exact: true })).toBeVisible();
      await expect(tile).toContainText(row.detail);
      await leaveApp(page);

      // None where none is due: no cookie, on a request the session answered, and the row untouched.
      await setLeft(
        row.instance,
        first.id,
        row.renewsAfter === null ? HOUR : row.lifetime - row.renewsAfter + 60,
      );
      const before = await sessionOf(row.instance, context);
      expect(await nextRequest(page)).toBe('');
      expect((await sessionOf(row.instance, context)).expires).toBe(before.expires);

      if (row.renewsAfter !== null) {
        // Renewal once it is due: the whole length again, and the sign-in's age kept.
        await setLeft(row.instance, first.id, row.lifetime - row.renewsAfter - 60);
        await expectCookie(context, await nextRequest(page), row);
        const renewed = await sessionOf(row.instance, context);
        expect(renewed.id).toBe(first.id);
        expect(renewed.left).toBeGreaterThan(row.lifetime - 120);
        expect(renewed.created).toBe(first.created);
        expect(await nextRequest(page)).toBe('');
        expect((await sessionOf(row.instance, context)).expires).toBe(renewed.expires);
      }

      // Run out: the next page is the sign-in page, and the API says so.
      await setLeft(row.instance, first.id, -1);
      await go(page, '/settings');
      await expect(page).toHaveURL(/\/signin/);
      await expect(page.getByRole('heading', { name: 'Sign in to Kept' })).toBeVisible();
      expect((await fetchIn(page, '/api/v1/me/sessions')).status).toBe(401);
      expect(await sessionCookie(context)).toBeUndefined();
      await context.close();
    });
  }
}

/** On `lan-week`: a person's browser, signing in from an address of their own. */
async function weekPerson(browser: Browser) {
  const context = await person(browser, WEEK_URL);
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': nextAddress() });
  return { context, page };
}

const WEEK_ROW = ROWS[0] as Row;

test('the setting on 7: an email link gives the same week', async ({ browser }) => {
  const { context, page } = await weekPerson(browser);
  const since = Date.now();
  let mailed = '';
  await go(page, '/signin');
  await page.getByLabel('Email or username', { exact: true }).fill('louis@kept.test');
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
  await expect
    .poll(
      async () => {
        const query = encodeURIComponent('to:"louis@kept.test"');
        const found = (await (
          await fetch(`${MAILPIT}/api/v1/search?query=${query}&limit=20`)
        ).json()) as { messages: { ID: string; Created: string }[] };
        for (const m of found.messages) {
          if (Date.parse(m.Created) < since - 2_000) continue;
          const mail = (await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json()) as {
            Text: string;
          };
          const url = mail.Text.match(/http:\/\/kept\.lan:8214\/auth\/confirm#token=\S+/)?.[0];
          if (url) {
            mailed = url;
            return true;
          }
        }
        return false;
      },
      { timeout: 60_000, message: 'the sign-in link in Mailpit' },
    )
    .toBe(true);
  await page.goto(mailed);
  const response = page.waitForResponse((r) => r.url().includes('/magic-link/verify'));
  await page.getByRole('button', { name: 'Continue' }).click();
  await expectCookie(context, await setCookieLine(await response), WEEK_ROW);
  await expect(page).toHaveURL(/\/$/);
  expect((await sessionOf(LAN_WEEK_INSTANCE, context)).lifetime).toBe(7 * DAY);
  await context.close();
});

test('the setting on 7: a password and a 2FA code give the same week', async ({ browser }) => {
  test.setTimeout(180_000);
  const login = 'bruce@kept.test';
  // With mail on, an unverified address may not turn two-factor on (D197). And off to begin with,
  // the last code forgotten too: a retry runs this again on the same instance, from a new worker
  // that doesn't know which 30-second step that code used (e2e/totp.ts).
  await week.asAuth(async (q) => {
    const { rows } = await q(`SELECT id FROM auth."user" WHERE email = $1`, [login]);
    const id = (rows[0] as { id: string }).id;
    await q('DELETE FROM auth.two_factor WHERE user_id = $1', [id]);
    await q('DELETE FROM auth.verification WHERE identifier = $1', [`totp-step:${id}`]);
    await q(
      'UPDATE auth."user" SET email_verified = true, two_factor_enabled = false WHERE id = $1',
      [id],
    );
  });
  const { context, page } = await weekPerson(browser);
  await signIn(page, login);
  await expect(page).toHaveURL(/\/$/);
  const enabled = await fetchIn(page, '/api/v1/me/two-factor/enable', { password: PASSWORD });
  expect(enabled.status).toBe(200);
  const secret = new URL(enabled.json?.totpURI as string).searchParams.get('secret') as string;
  const verified = await fetchIn(page, '/api/v1/auth/two-factor/verify-totp', {
    code: await freshCode(page, secret, login),
  });
  expect(verified.status).toBe(200);
  await context.clearCookies();

  await page.setExtraHTTPHeaders({ 'x-forwarded-for': nextAddress() });
  await signIn(page, login);
  await expect(page).toHaveURL(/\/signin\/two-factor/);
  await page.getByLabel('6-digit code').fill(await freshCode(page, secret, login));
  const response = page.waitForResponse((r) => r.url().includes('/two-factor/verify-totp'));
  await page.getByRole('button', { name: 'Continue' }).click();
  await expectCookie(context, await setCookieLine(await response), WEEK_ROW);
  await expect(page).toHaveURL(/\/$/);
  expect((await sessionOf(LAN_WEEK_INSTANCE, context)).lifetime).toBe(7 * DAY);
  await context.close();
});

test("the setting on 7: a managed account's admin code gives the same week", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const admin = await weekPerson(browser);
  await signIn(admin.page, IBRAHIM);
  await expect(admin.page).toHaveURL(/\/$/);
  const id = await week.asAuth(async (q) => {
    const { rows } = await q(`SELECT id FROM auth."user" WHERE username = $1`, ['peter']);
    return (rows[0] as { id: string }).id;
  });
  const issued = await fetchIn(admin.page, `/api/v1/managed-accounts/${id}/reset-code`, {});
  expect(issued.status).toBe(200);
  await admin.context.close();

  const { context, page } = await weekPerson(browser);
  await go(page, '/signin/code');
  await page.getByLabel('Username', { exact: true }).fill('peter');
  await page.getByLabel('One-time code', { exact: true }).fill(issued.json?.code as string);
  await page.getByLabel('New password', { exact: true }).fill('a password of his own');
  const response = page.waitForResponse((r) => r.url().includes('/api/v1/auth/sign-in/'));
  await page.getByRole('button', { name: 'Set password and sign in' }).click();
  await expectCookie(context, await setCookieLine(await response), WEEK_ROW);
  expect((await sessionOf(LAN_WEEK_INSTANCE, context)).lifetime).toBe(7 * DAY);
  await context.close();
});

test('the setting on 7: no passkeys on a plain-HTTP address', async ({ browser }) => {
  const { context, page } = await weekPerson(browser);
  await go(page, '/signin');
  await expect(page.getByRole('heading', { name: 'Sign in to Kept' })).toBeVisible();
  const secure = await page.evaluate(() => ({
    context: window.isSecureContext,
    webauthn: typeof window.PublicKeyCredential,
  }));
  expect(secure).toEqual({ context: false, webauthn: 'undefined' });
  await expect(page.getByRole('button', { name: 'Sign in with a passkey' })).toHaveCount(0);
  await context.close();
});

test('the setting on 7: secrets stay refused, recent sign-in stays, sign out everywhere still ends it', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const admin = await weekPerson(browser);
  await signIn(admin.page, IBRAHIM);
  await expect(admin.page).toHaveURL(/\/$/);
  await leaveApp(admin.page);

  const places = await fetchIn(admin.page, '/api/v1/locations');
  const homes = places.json?.locations as { id: string; name: string }[];
  const homeId = homes.find((l) => l.name === 'Home')?.id as string;
  for (const [url, body] of [
    ['/api/v1/tokens', { name: 'Home Assistant', scope: 'read', locationIds: [homeId] }],
    ['/api/v1/admin/recovery-kit/download', { password: PASSWORD, format: 'text' }],
    ['/api/v1/admin/backup/test', {}],
    [
      '/api/v1/exports',
      {
        scope: { locationId: homeId },
        includeSecrets: true,
        passphrase: PASSWORD,
        passphraseAgain: PASSWORD,
      },
    ],
  ] as const) {
    const refused = await fetchIn(admin.page, url, body);
    expect([url, refused.status, refused.json?.code]).toEqual([url, 403, 'https_required']);
  }

  // The password is asked for, however new the sign-in, and a renewal doesn't change that.
  const session = await sessionOf(LAN_WEEK_INSTANCE, admin.context);
  await setLeft(LAN_WEEK_INSTANCE, session.id, 7 * DAY - DAY - 60);
  await expectCookie(admin.context, await nextRequest(admin.page), WEEK_ROW);
  const change = await fetchIn(admin.page, '/api/v1/me/email-change', {
    newEmail: 'someone-else@kept.test',
  });
  expect([change.status, change.json?.code]).toEqual([403, 'reauth_required']);

  // Talia, on another browser, is signed out by the admin.
  const talia = await weekPerson(browser);
  await signIn(talia.page, 'talia@kept.test');
  await expect(talia.page).toHaveURL(/\/$/);
  const id = await week.asAuth(async (q) => {
    const { rows } = await q(`SELECT id FROM auth."user" WHERE email = $1`, ['talia@kept.test']);
    return (rows[0] as { id: string }).id;
  });
  const out = await fetchIn(admin.page, `/api/v1/admin/users/${id}/sign-out-everywhere`, {});
  expect(out.status).toBeLessThan(300);
  await go(talia.page, '/settings');
  await expect(talia.page).toHaveURL(/\/signin/);
  await admin.context.close();
  await talia.context.close();
});
