import { createHash, randomBytes } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { SIGN_IN_INSTANCE } from './instances';
import { codesOn, keyOn, openSection, signInKit } from './sign-in-kit';
import { PASSWORD } from './tls-people';
import { freshCode } from './totp';

const kit = signInKit(SIGN_IN_INSTANCE, { phone: 50, desktop: 60 });

test('a browser MFA session alone cannot sign in to Kept for iPhone', async ({ browser }) => {
  test.setTimeout(120_000);
  // MFA stays enabled after this test. Use a fresh login so concurrent specs and retries start clean.
  const login = await kit.createPasswordLogin(
    test.info().project.name === 'phone' ? 'Alfred' : 'Bruce',
  );
  const { context, page } = await kit.newPerson(browser);
  try {
    await kit.signInWithPassword(page, login);
    await expect(page).toHaveURL(/\/$/);
    const settings = await openSection(page);
    await settings.getByRole('link', { name: 'Turn on' }).click();
    await page.getByLabel('Your password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Continue' }).click();
    const secret = await keyOn(page);
    await page.getByLabel('6-digit code').fill(await freshCode(page, secret, login));
    await page.getByRole('button', { name: 'Turn on two-factor' }).click();
    await codesOn(page);
    await page.getByRole('button', { name: "I've saved them" }).click();
    await kit.signOut(page);

    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const state = randomBytes(32).toString('base64url');
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': kit.nextAddress() });
    await page.goto('/signin');
    await page.getByLabel('Email or username', { exact: true }).fill(login);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/signin\/two-factor/);
    await page.getByLabel('6-digit code').fill(await freshCode(page, secret, login));
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page).toHaveURL(/\/$/);

    const approval = await context.request.post('/native/connect', {
      headers: { origin: kit.BASE },
      form: { challenge, state },
      maxRedirects: 0,
    });
    expect(approval.status()).toBe(400);
    expect(approval.headers().location).toBeUndefined();
    const sessions = await context.request.get('/api/v1/me/sessions');
    expect(sessions.ok()).toBe(true);
    expect((await sessions.json()).sessions).not.toContainEqual(
      expect.objectContaining({ userAgent: 'Kept for iPhone' }),
    );
  } finally {
    await context.close();
  }
});
