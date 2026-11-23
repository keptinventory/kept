import { createHash, randomBytes } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { SIGN_IN_INSTANCE } from './instances';
import { codesOn, keyOn, openSection, signInKit } from './sign-in-kit';
import { PASSWORD } from './tls-people';
import { freshCode } from './totp';

const kit = signInKit(SIGN_IN_INSTANCE, { phone: 50, desktop: 60 });

test('the iPhone consent handoff preserves the browser MFA and issues a revocable session', async ({
  browser,
  playwright,
}) => {
  test.setTimeout(120_000);
  const login = test.info().project.name === 'phone' ? 'alfred@kept.test' : 'bruce@kept.test';
  const { context, page } = await kit.newPerson(browser);
  const native = await playwright.request.newContext({ baseURL: kit.BASE });
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
    const connect = `/native/connect?${new URLSearchParams({ challenge, state })}`;
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': kit.nextAddress() });
    await page.goto(connect);
    await expect(page).toHaveURL(/\/signin\?next=/);
    await page.getByLabel('Email or username', { exact: true }).fill(login);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/signin\/two-factor\?next=/);
    await page.getByLabel('6-digit code').fill(await freshCode(page, secret, login));
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Connect Kept for iPhone' })).toBeVisible();
    const response = page.waitForResponse(
      (r) => r.url() === `${kit.BASE}/native/connect` && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: `Continue as ${login}` }).click();
    const consent = await response;
    expect(consent.status()).toBe(303);
    const callback = new URL(consent.headers().location ?? '');
    expect(`${callback.protocol}//${callback.host}${callback.pathname}`).toBe(
      'kept-nfc://auth/callback',
    );
    expect(callback.searchParams.get('state')).toBe(state);

    const exchanged = await native.post('/api/v1/native/exchange', {
      headers: { origin: kit.BASE },
      data: { code: callback.searchParams.get('code'), verifier },
    });
    expect(exchanged.status()).toBe(200);
    const sessions = await native.get('/api/v1/me/sessions');
    const body = (await sessions.json()) as { sessions: Array<{ id: string; current: boolean }> };
    expect(body.sessions.find((session) => session.current)).toMatchObject({
      userAgent: 'Kept for iPhone',
      secondFactor: true,
    });
    const device = body.sessions.find((session) => session.current);
    const revoked = await context.request.delete(`/api/v1/me/sessions/${device?.id}`, {
      headers: { origin: kit.BASE },
    });
    expect(revoked.status()).toBe(204);
    expect((await native.get('/api/v1/me')).status()).toBe(401);
  } finally {
    await native.dispose();
    await context.close();
  }
});
