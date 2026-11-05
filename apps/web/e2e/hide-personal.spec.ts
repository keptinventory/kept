/**
 * Hide the Personal location (#392) against the real server, on the seeded `sheet` instance: in
 * Settings → Me a person hides it, it leaves Settings → Locations and Home, a direct link still
 * opens it and says so, and showing it brings everything back. On both projects, each as its own
 * person, so the two runs on one instance don't see each other: it's a per-person preference.
 *
 * No real device is touched: this spec opens neither the camera nor the assistant.
 *
 *   KEPT_E2E_INSTANCES=sheet pnpm --filter @kept/web exec playwright test hide-personal.spec.ts
 */
import { expect, type Page, test } from '@playwright/test';
import { INSTANCES, urlOf } from './instances';

const PASSWORD = 'kept-seed-password';

test.use({ baseURL: urlOf(INSTANCES.sheet) });

async function signIn(page: Page, email: string) {
  await page.goto('/signin');
  await page.getByLabel('Email or username', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}

const personalLink = (page: Page) =>
  page.getByRole('main').getByRole('link', { name: /^Personal/ });

test('Hide Personal: gone from the lists, a link still opens it, and it comes back', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  await signIn(page, info.project.name === 'phone' ? 'louis@kept.test' : 'bruce@kept.test');
  const me = await (await page.request.get('/api/v1/me')).json();
  const personalId = me.personalLocationId as string;

  await page.goto('/settings/locations');
  await expect(personalLink(page)).toBeVisible();

  await page.goto('/settings');
  const toggle = page.getByRole('switch', { name: 'Hide Personal' });
  await expect(toggle).toBeEnabled();
  await expect(toggle).not.toBeChecked();
  await toggle.click({ force: true });
  await expect(toggle).toBeChecked();

  await page.goto('/settings/locations');
  await expect(page.getByRole('main').getByRole('link', { name: /Home/ }).first()).toBeVisible();
  await expect(personalLink(page)).toHaveCount(0);

  await page.goto('/');
  await expect(page.getByRole('main').getByRole('link', { name: /Home/ }).first()).toBeVisible();
  await expect(personalLink(page)).toHaveCount(0);

  await page.goto(`/loc/${personalId}`);
  await expect(page.getByRole('heading', { name: 'Personal', level: 1 })).toBeVisible();
  await expect(page.getByText(/is hidden from your menu, Home, lists and search/)).toBeVisible();
  await page.getByRole('link', { name: 'Show it again' }).click();

  await expect(page).toHaveURL(/\/settings$/);
  const again = page.getByRole('switch', { name: 'Hide Personal' });
  await expect(again).toBeChecked();
  await again.click({ force: true });
  await expect(again).not.toBeChecked();

  await page.goto('/settings/locations');
  await expect(personalLink(page)).toBeVisible();
  // Nothing went sideways on a phone.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
