/**
 * Shared by the sign-in specs (sign-in-security.spec.ts, sign-in-changes.spec.ts): a person's
 * browser context, Chromium's VIRTUAL authenticator (CDP `WebAuthn.enable` +
 * `WebAuthn.addVirtualAuthenticator`, a software stub: with the WebAuthn domain on, no ceremony
 * reaches a real authenticator), signing in from an address of its own each time (the instances
 * believe X-Forwarded-For, serve.mjs `--trust-proxy`), and the instance's database as kept_auth
 * for the few fixtures no screen makes.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  type Browser,
  type BrowserContext,
  type CDPSession,
  type Page,
  test,
} from '@playwright/test';
import { type Instance, stateDirOf, urlOf } from './instances';
import { expect, PASSWORD } from './tls-people';

/** Chromium's virtual authenticator: a platform passkey store with user verification. */
export async function virtualAuthenticator(page: Page): Promise<{ cdp: CDPSession; id: string }> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable', { enableUI: false });
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return { cdp, id: authenticatorId };
}

/** page.goto, once more when the app's own navigation (a redirect after sign-in) aborted it. */
export async function go(page: Page, url: string) {
  try {
    await page.goto(url);
  } catch (err) {
    if (!String(err).includes('ERR_ABORTED')) throw err;
    await page.waitForLoadState();
    await page.goto(url);
  }
}

export const toasts = (page: Page) => page.getByRole('region', { name: 'Notifications' });

/** The key under the QR code ("JBSW Y3DP …"), without its spaces. */
export async function keyOn(page: Page): Promise<string> {
  const text = await page
    .getByText(/^Enter this key in the app instead:$/)
    .locator('xpath=following-sibling::div[1]')
    .innerText();
  return text.replace(/\s+/g, '');
}

export async function codesOn(page: Page): Promise<string[]> {
  const list = page.getByRole('list', { name: 'Backup codes' });
  await expect(list.getByRole('listitem')).toHaveCount(10);
  return (await list.getByRole('listitem').allInnerTexts()).map((c) => c.trim());
}

export async function openSection(page: Page) {
  await go(page, '/settings');
  const section = page.locator('#sign-in-security');
  await expect(section.getByRole('heading', { name: 'Passkeys' })).toBeVisible();
  return section;
}

export function signInKit(instance: Instance, addressBase: { phone: number; desktop: number }) {
  const BASE = urlOf(instance);
  let address = 0;

  /** A documentation-range address for the next sign-in, different per project and per call. */
  function nextAddress(): string {
    address += 1;
    const base = test.info().project.name === 'phone' ? addressBase.phone : addressBase.desktop;
    return `198.51.100.${base + (address % 9)}`;
  }

  async function newPerson(
    browser: Browser,
    locale = 'en-GB',
  ): Promise<{ context: BrowserContext; page: Page }> {
    const use = test.info().project.use;
    const context = await browser.newContext({
      baseURL: BASE,
      viewport: use.viewport ?? { width: 1280, height: 800 },
      isMobile: use.isMobile ?? false,
      hasTouch: use.hasTouch ?? false,
      timezoneId: 'Africa/Cairo',
      locale,
    });
    return { context, page: await context.newPage() };
  }

  async function signInWithPassword(page: Page, login: string, password = PASSWORD) {
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': nextAddress() });
    await go(page, '/signin');
    await page.getByLabel('Email or username', { exact: true }).fill(login);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  }

  async function signOut(page: Page) {
    await go(page, '/settings');
    await page.getByRole('button', { name: 'Sign out', exact: true }).last().click();
    await expect(page).toHaveURL(/\/signin/);
  }

  function fixtureDatabase(): string {
    const log = readFileSync(`${stateDirOf(instance)}server.log`, 'utf8');
    const name = /database (kept_e2e_\w+) migrated/.exec(log)?.[1];
    const prefix = `kept_e2e_${instance.name.replaceAll('-', '_')}_`;
    if (!name?.startsWith(prefix)) throw new Error(`${instance.name}: no fixture database found`);
    return name;
  }

  const databaseUrl = (role: 'kept_app' | 'kept_auth' | 'kept_system', database: string) =>
    `postgres://${role}:${role}@localhost:5452/${database}`;

  /** One new login per attempt for journeys that leave MFA enabled on their account. */
  async function createPasswordLogin(displayName: string): Promise<string> {
    const name = fixtureDatabase();
    const load = (module: string) =>
      import(new URL(`../../server/dist/${module}`, import.meta.url).href);
    const [{ createPools, closePools }, { buildSeedApp }] = await Promise.all([
      load('db/pools.js'),
      load('seed/index.js'),
    ]);
    const pools = createPools({
      KEPT_DATABASE_URL: databaseUrl('kept_app', name),
      KEPT_AUTH_DATABASE_URL: databaseUrl('kept_auth', name),
      KEPT_SYSTEM_DATABASE_URL: databaseUrl('kept_system', name),
    });
    try {
      const seed = await buildSeedApp(
        { KEPT_PUBLIC_URL: BASE, KEPT_AUTH_SECRET: randomBytes(32).toString('base64url') },
        pools,
      );
      try {
        const email = `native-consent-${randomUUID()}@kept.test`;
        const response = await seed.inject({
          method: 'POST',
          url: '/api/v1/auth/sign-up',
          headers: { origin: BASE, 'accept-language': 'en' },
          remoteAddress: nextAddress(),
          payload: { email, displayName, password: PASSWORD },
        });
        expect(response.statusCode, 'create disposable consent account').toBe(202);
        return email;
      } finally {
        await seed.close();
      }
    } finally {
      await closePools(pools);
    }
  }

  /** The instance's database, as kept_auth, for fixtures without a corresponding UI. */
  async function asAuth<T>(
    fn: (q: (sql: string, values: unknown[]) => Promise<{ rows: unknown[] }>) => Promise<T>,
  ): Promise<T> {
    // pg is the server's dependency, not the web app's.
    const pg = createRequire(new URL('../../server/package.json', import.meta.url))('pg');
    const client = new pg.Client({
      connectionString: databaseUrl('kept_auth', fixtureDatabase()),
    });
    await client.connect();
    try {
      return await fn((sql, values) => client.query(sql, values));
    } finally {
      await client.end();
    }
  }

  return { BASE, nextAddress, newPerson, signInWithPassword, signOut, createPasswordLogin, asAuth };
}
