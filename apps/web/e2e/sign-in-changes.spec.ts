/**
 * Sign-in changes as they look from outside, on their own seeded instance (`signInMail`,
 * e2e/instances.ts), which mails through the dev Mailpit and offers Google sign-in:
 *
 * 1. Each change (a passkey added, two-factor on, new backup codes, two-factor off, Google
 *    unlinked, a passkey removed) signs the person's OTHER browser out on its next page, keeps
 *    the acting one signed in, and mails the notice with its subject. Wrong passwords in the add
 *    sheet and the turn-off sheet are refused with a plain message. Once the account has no
 *    password, unlinking its last way in is refused with the reason on screen.
 * 2. A location that asks for two-factor: turning the app off is refused while no passkey stands
 *    in; after adding one it is allowed; then that last passkey can't be removed.
 * 3. Arabic, right to left, on a phone: the section and the add sheet, with axe.
 * 4. The sign-in page reads "Sign in with Google" as one line, its words spaced as written.
 *
 * Passkeys come from Chromium's virtual authenticator (e2e/sign-in-kit.ts), codes from
 * e2e/totp.ts. Kept has no screen that makes a location require two-factor (the members page only
 * shows it), so journey 2 sets it with the location's own PATCH, as its owner. The Google account
 * row and the password taken away are database fixtures: no Google request is ever made.
 *
 *   KEPT_E2E_INSTANCES=signInMail pnpm --filter @kept/web exec playwright test sign-in-changes.spec.ts
 */
import { type Page, test } from '@playwright/test';
import { SIGN_IN_MAIL_INSTANCE } from './instances';
import {
  codesOn,
  go,
  keyOn,
  openSection,
  signInKit,
  toasts,
  virtualAuthenticator,
} from './sign-in-kit';
import { axe, expect, PASSWORD } from './tls-people';
import { freshCode } from './totp';

const { BASE, newPerson, signInWithPassword, asAuth } = signInKit(SIGN_IN_MAIL_INSTANCE, {
  phone: 30,
  desktop: 40,
});
test.use({ baseURL: BASE });

/** Seeded people (src/seed/cast.ts), per project, so the projects never share one. */
const PEOPLE = {
  phone: { changes: 'louis@kept.test', location: 'talia@kept.test' },
  desktop: { changes: 'bruce@kept.test', location: 'ibrahim@kept.test' },
} as const;
const who = () => PEOPLE[test.info().project.name as keyof typeof PEOPLE];

const MAILPIT = 'http://localhost:8025';

/** Waits for a mail to `to` with exactly `subject`, sent since `since` (Mailpit's API). */
async function expectMail(to: string, subject: string, since: number) {
  await expect
    .poll(
      async () => {
        const query = encodeURIComponent(`to:"${to}" subject:"${subject}"`);
        const res = await fetch(`${MAILPIT}/api/v1/search?query=${query}&limit=50`);
        const body = (await res.json()) as { messages: { Subject: string; Created: string }[] };
        return body.messages.filter(
          (m) => m.Subject === subject && Date.parse(m.Created) >= since - 2_000,
        ).length;
      },
      { timeout: 60_000, message: `a mail to ${to}: ${subject}` },
    )
    .toBeGreaterThan(0);
}

/** The other browser is signed out: its next page goes to the sign-in page. */
async function expectSignedOut(page: Page) {
  await go(page, '/settings');
  await expect(page).toHaveURL(/\/signin/);
}

async function expectSignedIn(page: Page) {
  await go(page, '/settings');
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
}

/** With mail on, a passkey or the app waits for a confirmed address: these people confirmed. */
async function confirmAddress(login: string) {
  await asAuth((q) => q('UPDATE auth."user" SET email_verified = true WHERE email = $1', [login]));
}

test('each change signs the other device out, keeps this one, and mails a notice; the last way in stays', async ({
  browser,
}) => {
  test.setTimeout(420_000);
  const login = who().changes;
  const since = Date.now();
  await confirmAddress(login);
  const google = await asAuth(async (q) => {
    const { rows } = await q(
      `INSERT INTO auth.account (account_id, provider_id, user_id, created_at, updated_at)
       SELECT 'g-' || id, 'google', id, now(), now() FROM auth."user" WHERE email = $1
       RETURNING id`,
      [login],
    );
    return (rows[0] as { id: string }).id;
  });
  const a = await newPerson(browser);
  const b = await newPerson(browser);
  await virtualAuthenticator(a.page);
  await signInWithPassword(a.page, login);
  await expect(a.page).toHaveURL(/\/$/);
  const signInB = async (code?: () => Promise<{ backup?: string; totp?: string }>) => {
    await signInWithPassword(b.page, login);
    if (code) {
      await expect(b.page).toHaveURL(/\/signin\/two-factor/);
      const { backup, totp } = await code();
      if (backup) {
        await b.page.getByRole('button', { name: 'Use a backup code instead' }).click();
        await b.page.getByLabel('Backup code').fill(backup);
      } else {
        await b.page.getByLabel('6-digit code').fill(totp ?? '');
      }
      await b.page.getByRole('button', { name: 'Continue' }).click();
    }
    await expect(b.page).toHaveURL(/\/$/);
  };

  await test.step('a passkey added (a wrong password first)', async () => {
    await signInB();
    const section = await openSection(a.page);
    await section.getByRole('button', { name: 'Add a passkey' }).click();
    const sheet = a.page.getByRole('dialog', { name: 'Add a passkey' });
    await sheet.getByLabel('Name').fill('Laptop');
    await sheet.getByLabel('Your password').fill('not the password');
    await sheet.getByRole('button', { name: 'Continue' }).click();
    await expect(sheet.getByText("That password isn't right.")).toBeVisible();
    await sheet.getByLabel('Your password').fill(PASSWORD);
    await sheet.getByRole('button', { name: 'Continue' }).click();
    await expect(toasts(a.page)).toContainText('Passkey added');
    await expectSignedOut(b.page);
    await expectSignedIn(a.page);
    await expectMail(login, 'A passkey was added to your Kept account', since);
  });

  let secret = '';
  await test.step('two-factor turned on', async () => {
    await signInB();
    const section = await openSection(a.page);
    await section.getByRole('link', { name: 'Turn on' }).click();
    await a.page.getByLabel('Your password').fill(PASSWORD);
    await a.page.getByRole('button', { name: 'Continue' }).click();
    secret = await keyOn(a.page);
    await a.page.getByLabel('6-digit code').fill(await freshCode(a.page, secret, login));
    await a.page.getByRole('button', { name: 'Turn on two-factor' }).click();
    await codesOn(a.page);
    await a.page.getByRole('button', { name: "I've saved them" }).click();
    await expectSignedOut(b.page);
    await expectSignedIn(a.page);
    await expectMail(login, 'Two-factor sign-in was turned on', since);
  });

  let codes: string[] = [];
  await test.step('new backup codes', async () => {
    await signInB(async () => ({ totp: await freshCode(b.page, secret, login) }));
    const section = await openSection(a.page);
    await section.getByRole('button', { name: 'New backup codes' }).click();
    const sheet = a.page.getByRole('dialog', { name: 'New backup codes' });
    await sheet.getByLabel('Your password').fill(PASSWORD);
    await sheet.getByRole('button', { name: 'Make new codes' }).click();
    codes = await codesOn(a.page);
    await a.page.getByRole('button', { name: "I've saved them" }).click();
    await expectSignedOut(b.page);
    await expectSignedIn(a.page);
    await expectMail(login, 'New backup codes were made for your Kept account', since);
  });

  await test.step('two-factor turned off (a wrong password first)', async () => {
    await signInB(async () => ({ backup: codes[0] ?? '' }));
    const section = await openSection(a.page);
    await section.getByRole('button', { name: 'Turn off' }).click();
    const sheet = a.page.getByRole('dialog', { name: 'Turn off two-factor?' });
    await sheet.getByLabel('Your password').fill('not the password');
    await sheet.getByRole('button', { name: 'Turn off' }).click();
    await expect(sheet.getByText("That password isn't right.")).toBeVisible();
    await sheet.getByLabel('Your password').fill(PASSWORD);
    await sheet.getByRole('button', { name: 'Turn off' }).click();
    await expect(toasts(a.page)).toContainText('Two-factor is off');
    await expectSignedOut(b.page);
    await expectSignedIn(a.page);
    await expectMail(login, 'Two-factor sign-in was turned off', since);
  });

  await test.step('Google unlinked with the password', async () => {
    await signInB();
    await go(a.page, '/settings');
    const methods = a.page.locator('section').filter({
      has: a.page.getByRole('heading', { name: 'Sign-in methods' }),
    });
    const row = methods.getByRole('listitem').filter({ hasText: 'Sign in with Google' });
    await expect(row.getByText('Linked')).toBeVisible();
    await row.getByRole('button', { name: 'Unlink' }).click();
    const sheet = a.page.getByRole('dialog', { name: 'Unlink Google?' });
    await sheet.getByLabel('Your password').fill(PASSWORD);
    await axe(a.page, 'the unlink sheet');
    await sheet.getByRole('button', { name: 'Unlink' }).click();
    await expect(toasts(a.page)).toContainText('Unlinked');
    await expect(row.getByText('Not linked')).toBeVisible();
    await expectSignedOut(b.page);
    await expectSignedIn(a.page);
    await expectMail(login, 'A sign-in was unlinked from your Kept account', since);
    const left = await asAuth((q) => q('SELECT 1 FROM auth.account WHERE id = $1', [google]));
    expect(left.rows).toHaveLength(0);
  });

  await test.step('a passkey removed', async () => {
    await signInB();
    const section = await openSection(a.page);
    await section
      .getByRole('listitem')
      .filter({ hasText: 'Laptop' })
      .getByRole('button', { name: 'Remove' })
      .click();
    const sheet = a.page.getByRole('dialog', { name: 'Remove Laptop?' });
    await sheet.getByLabel('Your password').fill(PASSWORD);
    await sheet.getByRole('button', { name: 'Remove' }).click();
    await expect(toasts(a.page)).toContainText('Passkey removed');
    await expectSignedOut(b.page);
    await expectSignedIn(a.page);
    await expectMail(login, 'A passkey was removed from your Kept account', since);
  });

  await test.step('without a password, unlinking the last way in is refused with the reason', async () => {
    // Kept has no screen that takes a password away: the fixture clears it, and links Google
    // again. The address is unconfirmed, so no email link signs in either: Google is all there is.
    await asAuth(async (q) => {
      await q(
        `UPDATE auth.account SET password = NULL
          WHERE provider_id = 'credential'
            AND user_id = (SELECT id FROM auth."user" WHERE email = $1)`,
        [login],
      );
      await q('UPDATE auth."user" SET email_verified = false WHERE email = $1', [login]);
      await q(
        `INSERT INTO auth.account (account_id, provider_id, user_id, created_at, updated_at)
         SELECT 'g2-' || id, 'google', id, now(), now() FROM auth."user" WHERE email = $1`,
        [login],
      );
    });
    await go(a.page, '/settings');
    const methods = a.page.locator('section').filter({
      has: a.page.getByRole('heading', { name: 'Sign-in methods' }),
    });
    const row = methods.getByRole('listitem').filter({ hasText: 'Sign in with Google' });
    await row.getByRole('button', { name: 'Unlink' }).click();
    const sheet = a.page.getByRole('dialog', { name: 'Unlink Google?' });
    await expect(sheet.getByLabel('Your password')).toHaveCount(0);
    await sheet.getByRole('button', { name: 'Unlink' }).click();
    await expect(
      sheet.getByText(
        "That's your only way to sign in. Add another passkey or link another sign-in first.",
      ),
    ).toBeVisible();
    await axe(a.page, 'the unlink sheet, refused');
    await sheet.getByRole('button', { name: 'Cancel' }).click();
    await expect(row.getByText('Linked')).toBeVisible();
  });
  await a.context.close();
  await b.context.close();
});

test('a location that asks for two-factor: the app stays on until a passkey stands in, and the last passkey stays', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const login = who().location;
  await confirmAddress(login);
  const { context, page } = await newPerson(browser);
  await virtualAuthenticator(page);
  await signInWithPassword(page, login);
  await expect(page).toHaveURL(/\/$/);

  // The app on (from the screen), so this session has proved a second factor.
  let section = await openSection(page);
  await section.getByRole('link', { name: 'Turn on' }).click();
  await page.getByLabel('Your password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Continue' }).click();
  const secret = await keyOn(page);
  await page.getByLabel('6-digit code').fill(await freshCode(page, secret, login));
  await page.getByRole('button', { name: 'Turn on two-factor' }).click();
  await codesOn(page);
  await page.getByRole('button', { name: "I've saved them" }).click();
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();

  // A location of theirs that asks everyone for two-factor (its owner's PATCH; no screen sets
  // it yet).
  const write = { origin: BASE, 'idempotency-key': crypto.randomUUID() };
  const created = await page.request.post('/api/v1/locations', {
    headers: write,
    data: { name: 'Workshop', kind: 'home', timezone: 'Africa/Cairo', currency: 'EGP' },
  });
  expect(created.status(), await created.text()).toBe(201);
  const location = (await created.json()) as { id: string; rowVersion: number };
  const required = await page.request.patch(`/api/v1/locations/${location.id}`, {
    headers: {
      origin: BASE,
      'idempotency-key': crypto.randomUUID(),
      'if-match': String(location.rowVersion),
    },
    data: { require2fa: true },
  });
  expect(required.status(), await required.text()).toBe(200);

  section = await openSection(page);
  await section.getByRole('button', { name: 'Turn off' }).click();
  let sheet = page.getByRole('dialog', { name: 'Turn off two-factor?' });
  await sheet.getByLabel('Your password').fill(PASSWORD);
  await sheet.getByRole('button', { name: 'Turn off' }).click();
  await expect(
    sheet.getByText(
      'A location you belong to asks for two-factor. Add a passkey first, then turn the authenticator app off.',
    ),
  ).toBeVisible();
  await axe(page, 'the turn-off sheet, refused by a location');
  await sheet.getByRole('button', { name: 'Cancel' }).click();

  // A passkey stands in: now it can go off.
  await section.getByRole('button', { name: 'Add a passkey' }).click();
  sheet = page.getByRole('dialog', { name: 'Add a passkey' });
  await sheet.getByLabel('Name').fill('Phone');
  await sheet.getByLabel('Your password').fill(PASSWORD);
  await sheet.getByRole('button', { name: 'Continue' }).click();
  await expect(toasts(page)).toContainText('Passkey added');
  await section.getByRole('button', { name: 'Turn off' }).click();
  sheet = page.getByRole('dialog', { name: 'Turn off two-factor?' });
  await sheet.getByLabel('Your password').fill(PASSWORD);
  await sheet.getByRole('button', { name: 'Turn off' }).click();
  await expect(toasts(page)).toContainText('Two-factor is off');

  // With the app off, that last passkey is what the location's two-factor rests on.
  await section
    .getByRole('listitem')
    .filter({ hasText: 'Phone' })
    .getByRole('button', { name: 'Remove' })
    .click();
  sheet = page.getByRole('dialog', { name: 'Remove Phone?' });
  await sheet.getByLabel('Your password').fill(PASSWORD);
  await sheet.getByRole('button', { name: 'Remove' }).click();
  await expect(
    sheet.getByText(
      'A location you belong to asks for two-factor. Turn on the authenticator app before removing your last passkey.',
    ),
  ).toBeVisible();
  await axe(page, 'the remove sheet, refused by a location');
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  await expect(section.getByText('Phone', { exact: true })).toBeVisible();
  await context.close();
});

test('the sign-in page reads "Sign in with Google" as one line, beside its icon', async ({
  browser,
}) => {
  const { context, page } = await newPerson(browser);
  await go(page, '/signin');
  const google = page.getByRole('button', { name: 'Sign in with Google' });
  await expect(google).toBeVisible();
  // innerText as laid out: the words and the name apart in the button's flex row read
  // "Sign in with" and "Google" on two lines, with the row's gap between them on screen.
  await expect(google).toHaveText('Sign in with Google', { useInnerText: true });
  expect(await google.innerText()).toBe('Sign in with Google');
  await context.close();
});

test('in Arabic on a phone: the section reads right to left, and the add sheet too', async ({
  browser,
}) => {
  test.skip(test.info().project.name !== 'phone', 'runs in the phone project');
  test.setTimeout(120_000);
  // Alfred (src/seed/cast.ts) reads Kept in Arabic: chosen per device, in Settings → Display.
  const login = 'alfred@kept.test';
  const { context, page } = await newPerson(browser);
  await signInWithPassword(page, login);
  await expect(page).toHaveURL(/\/$/);
  await go(page, '/settings');
  await page.getByRole('button', { name: /Language/ }).click();
  await page.getByRole('option', { name: /العربية/ }).click();
  const section = page.locator('#sign-in-security');
  await expect(section.getByRole('heading', { name: 'تسجيل الدخول والأمان' })).toBeVisible();
  await expect(section.getByRole('heading', { name: 'مفاتيح المرور' })).toBeVisible();
  await expect(section.getByText('لا مفاتيح مرور بعد')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
  // Nothing cut off with an ellipsis.
  const clipped = await section.evaluate((root) =>
    [...root.querySelectorAll<HTMLElement>('*')]
      .filter((el) => getComputedStyle(el).textOverflow === 'ellipsis')
      .map((el) => el.textContent),
  );
  expect(clipped).toEqual([]);
  await axe(page, 'Sign-in and security in Arabic');
  await section.getByRole('button', { name: 'أضِف مفتاح مرور' }).click();
  const sheet = page.getByRole('dialog', { name: 'أضِف مفتاح مرور' });
  await expect(sheet).toBeVisible();
  expect(await sheet.evaluate((el) => getComputedStyle(el).direction)).toBe('rtl');
  await axe(page, 'the add-a-passkey sheet in Arabic');
  await context.close();
});
