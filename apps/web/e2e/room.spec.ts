/**
 * Room photos (#194) against the real server, on the `capture` instance (the `households` seed,
 * every AI call answered by the mock provider, a fake camera: e2e/camera.ts). The mock reads every
 * room photo as the same invented room (ai/mock.ts `kept_room`): a bookcase, an armchair, a floor
 * lamp and a desk fan.
 *
 *   KEPT_E2E_INSTANCES=capture pnpm --filter @kept/web exec playwright test room.spec.ts
 *
 * One flow, on the phone: Capture → Room into Garage › Shelf A, one photo from the fake camera,
 * Send; the Inbox shows one Room card heading the batch, the bookcase proposed as a place, the
 * other three as drafts under it; the bookcase is added as a place; Done asks first and closes
 * the card.
 */
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { type Browser, expect, type Page, test } from '@playwright/test';
import { CAPTURE_INSTANCE } from './camera';
import { stateDirOf, urlOf } from './instances';

const BASE = urlOf(CAPTURE_INSTANCE);
const PASSWORD = 'kept-seed-password';
/** A made-up key for the mock provider: KEPT_AI_MOCK=1 never sends it anywhere. */
const MOCK_KEY = 'gsk_e2e-mock-provider-not-a-real-key';

test.use({ baseURL: BASE });

const stateDir = path.join(stateDirOf(CAPTURE_INSTANCE), 'sessions');

async function signedIn(browser: Browser, login: string): Promise<Page> {
  const file = path.join(stateDir, `${login}.json`);
  if (!existsSync(file)) {
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
  return context.newPage();
}

async function axe(page: Page, where: string) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations
    .filter((v) => v.impact && v.impact !== 'minor')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0]?.target.join(' ')}`);
  expect.soft(serious, `axe on ${where}`).toEqual([]);
}

test('a room photo: sent from Capture, listed in the Inbox under one Room card, closed with Done', async ({
  browser,
}) => {
  test.skip(test.info().project.name !== 'phone', 'runs in the phone project');
  const page = await signedIn(browser, 'ibrahim');
  // The account's provider, with the mock key (Garage is paid by the account).
  const providers = await page.request.get('/api/v1/ai/providers');
  const { providers: list } = (await providers.json()) as { providers: { scope: string }[] };
  if (!list.some((p) => p.scope === 'account')) {
    const put = await page.request.fetch('/api/v1/ai/providers/account', {
      method: 'PUT',
      data: { apiKey: MOCK_KEY },
      headers: { origin: BASE },
    });
    expect(put.status(), await put.text()).toBe(200);
  }

  await page.goto('/capture');
  await page.getByRole('button', { name: /^Capturing into / }).click();
  await page
    .getByRole('dialog', { name: 'Capture into' })
    .getByText('Shelf A', { exact: true })
    .click();
  await page
    .getByRole('radiogroup', { name: 'Capture mode' })
    .getByRole('radio', { name: 'Room' })
    .check({ force: true });
  await expect(page.getByText('Stand in the doorway; one photo per wall.')).toBeVisible();
  const shutter = page.getByRole('button', { name: 'Take photo: room' });
  await expect(shutter).toBeEnabled({ timeout: 15_000 });
  await shutter.click();
  const tray = page.getByRole('list', { name: 'Photos of this room' });
  await expect(tray.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByText(/^About 1 photo · up to ~[\d,]+ tokens · Groq$/)).toBeVisible();
  await axe(page, 'Capture (Room)');
  await page.getByRole('button', { name: 'Send 1 photo' }).click();
  await expect(page.getByText('1 captured', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByText(/waiting to sync/)).toHaveCount(0, { timeout: 60_000 });

  // The job reads the photo with the mock and lists the room.
  await page.goto('/inbox');
  const card = page.getByRole('article', { name: 'Photos of Shelf A' });
  await expect(async () => {
    await page.reload();
    await expect(card.getByText(/3 new things to review below/)).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.getByRole('article', { name: 'Floor lamp' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Armchair' })).toBeVisible();
  await axe(page, 'Inbox (Room card)');

  await card.getByRole('button', { name: 'Add as a place' }).click();
  await expect(card.getByText('Added', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Done', exact: true }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('The full photos are deleted');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(card).toHaveCount(0);
  // The drafts stay to review.
  await expect(page.getByRole('article', { name: 'Floor lamp' })).toBeVisible();
  await page.context().close();
});
