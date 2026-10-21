/**
 * Settings → Sign-in and security against the real server, on its own seeded instance
 * (`signIn`, e2e/instances.ts):
 *
 * 1. A password account adds a passkey, signs out, signs in with it, renames it, adds a second
 *    one and removes one.
 * 2. The same account, then without its password: removing its last passkey is refused, with
 *    the reason on screen (the same test, so the browser's authenticator still holds the passkey).
 * 3. The authenticator app: turned on, a sign-in with a code, new backup codes, a sign-in with a
 *    backup code (the count drops), set up again abandoned once (the old app still signs in),
 *    then finished, then turned off.
 *
 * Passkeys come from Chromium's VIRTUAL authenticator (CDP `WebAuthn.enable` +
 * `WebAuthn.addVirtualAuthenticator`): a software stub inside the browser. With the WebAuthn
 * domain on, no ceremony reaches a real authenticator. Codes come from e2e/totp.ts. Each project
 * uses its own two people, and each sign-in its own address (the instance believes
 * X-Forwarded-For), so the two projects never share an account or Better Auth's per-address limit.
 * Every page and sheet is checked with axe (nothing above "minor").
 *
 *   KEPT_E2E_INSTANCES=signIn pnpm --filter @kept/web exec playwright test sign-in-security.spec.ts
 */
import { test } from '@playwright/test';
import { SIGN_IN_INSTANCE } from './instances';
import {
  codesOn,
  keyOn,
  openSection,
  signInKit,
  toasts,
  virtualAuthenticator,
} from './sign-in-kit';
import { axe, expect, PASSWORD } from './tls-people';
import { freshCode } from './totp';

const { BASE, nextAddress, newPerson, signInWithPassword, signOut, asAuth } = signInKit(
  SIGN_IN_INSTANCE,
  {
    phone: 10,
    desktop: 20,
  },
);
test.use({ baseURL: BASE });

/** Seeded people (src/seed/cast.ts), two per project, so the projects never share one. */
const PEOPLE = {
  phone: { passkeys: 'louis@kept.test', twoFactor: 'talia@kept.test' },
  desktop: { passkeys: 'bruce@kept.test', twoFactor: 'ibrahim@kept.test' },
} as const;
const who = () => PEOPLE[test.info().project.name as keyof typeof PEOPLE];

test.describe('passkeys', () => {
  test('a password account adds a passkey, signs in with it, renames it, adds another and removes one; without a password the last one stays', async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const login = who().passkeys;
    const { context, page } = await newPerson(browser);
    const first = await virtualAuthenticator(page);
    await signInWithPassword(page, login);
    await expect(page).toHaveURL(/\/$/);

    let section = await openSection(page);
    await expect(section.getByText('No passkeys yet')).toBeVisible();
    await axe(page, 'Sign-in and security, no passkeys');
    await section.getByRole('button', { name: 'Add a passkey' }).click();
    let sheet = page.getByRole('dialog', { name: 'Add a passkey' });
    await expect(sheet.getByLabel('Name')).not.toHaveValue('');
    await axe(page, 'the add-a-passkey sheet');
    await sheet.getByLabel('Name').fill('Laptop');
    await sheet.getByLabel('Your password').fill(PASSWORD);
    await sheet.getByRole('button', { name: 'Continue' }).click();
    await expect(toasts(page)).toContainText('Passkey added');
    const list = section.getByRole('list', { name: 'Passkeys' });
    await expect(list.getByText('Laptop', { exact: true })).toBeVisible();
    await expect(list).toContainText('This device only');
    await axe(page, 'Sign-in and security, one passkey');

    // Signed out, back in with the passkey: no password typed.
    await signOut(page);
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': nextAddress() });
    await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
    await expect(page).toHaveURL(/\/$/);

    section = await openSection(page);
    await section
      .getByRole('list', { name: 'Passkeys' })
      .getByRole('listitem')
      .filter({ hasText: 'Laptop' })
      .getByRole('button', { name: 'Rename' })
      .click();
    sheet = page.getByRole('dialog', { name: 'Rename passkey' });
    await sheet.getByLabel('Name').fill('Work laptop');
    await sheet.getByLabel('Your password').fill(PASSWORD);
    await axe(page, 'the rename sheet');
    await sheet.getByRole('button', { name: 'Rename' }).click();
    await expect(toasts(page)).toContainText('Passkey renamed');
    await expect(section.getByText('Work laptop', { exact: true })).toBeVisible();

    // A second passkey from another authenticator (a phone, say): this one already holds one.
    await first.cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: first.id });
    await virtualAuthenticator(page);
    await section.getByRole('button', { name: 'Add a passkey' }).click();
    sheet = page.getByRole('dialog', { name: 'Add a passkey' });
    await sheet.getByLabel('Name').fill('Phone');
    await sheet.getByLabel('Your password').fill(PASSWORD);
    await sheet.getByRole('button', { name: 'Continue' }).click();
    await expect(toasts(page)).toContainText('Passkey added');
    await expect(section.getByRole('list', { name: 'Passkeys' }).getByRole('listitem')).toHaveCount(
      2,
    );

    await section
      .getByRole('listitem')
      .filter({ hasText: 'Work laptop' })
      .getByRole('button', { name: 'Remove' })
      .click();
    sheet = page.getByRole('dialog', { name: 'Remove Work laptop?' });
    await expect(sheet).toContainText('It stops signing you in');
    await sheet.getByLabel('Your password').fill(PASSWORD);
    await axe(page, 'the remove sheet');
    await sheet.getByRole('button', { name: 'Remove' }).click();
    await expect(toasts(page)).toContainText('Passkey removed');
    await expect(section.getByRole('list', { name: 'Passkeys' }).getByRole('listitem')).toHaveCount(
      1,
    );
    await expect(section.getByText('Phone', { exact: true })).toBeVisible();

    // Without a password, the last passkey stays. Kept has no screen that takes a password away:
    // the fixture clears it in the database, as an account that signs in by passkey or email link
    // alone has none. The session is a passkey sign-in from minutes ago, which confirms it's you.
    await asAuth((q) =>
      q(
        `UPDATE auth.account SET password = NULL
          WHERE provider_id = 'credential'
            AND user_id = (SELECT id FROM auth."user" WHERE email = $1)`,
        [login],
      ),
    );
    section = await openSection(page);
    await section
      .getByRole('listitem')
      .filter({ hasText: 'Phone' })
      .getByRole('button', { name: 'Remove' })
      .click();
    sheet = page.getByRole('dialog', { name: 'Remove Phone?' });
    await expect(sheet.getByLabel('Your password')).toHaveCount(0);
    await sheet.getByRole('button', { name: 'Remove' }).click();
    await expect(
      sheet.getByText(
        "That's your only way to sign in. Add another passkey or link another sign-in first.",
      ),
    ).toBeVisible();
    await axe(page, 'the remove sheet, refused');
    await sheet.getByRole('button', { name: 'Cancel' }).click();
    await expect(section.getByText('Phone', { exact: true })).toBeVisible();
    await context.close();
  });
});

test('the authenticator app: on, a code, new backup codes, a backup code, set up again, off', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const login = who().twoFactor;
  const { context, page } = await newPerson(browser);
  await signInWithPassword(page, login);
  await expect(page).toHaveURL(/\/$/);

  // On.
  const section = await openSection(page);
  await axe(page, 'Sign-in and security, the app off');
  await section.getByRole('link', { name: 'Turn on' }).click();
  await expect(page.getByRole('heading', { name: 'Turn on two-factor' })).toBeVisible();
  await page.getByLabel('Your password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Continue' }).click();
  const secret = await keyOn(page);
  await axe(page, 'Turn on two-factor, the QR step');
  await page.getByLabel('6-digit code').fill(await freshCode(page, secret, login));
  await page.getByRole('button', { name: 'Turn on two-factor' }).click();
  await codesOn(page);
  await page.getByRole('button', { name: "I've saved them" }).click();
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();

  // A sign-in asks for a code.
  await signOut(page);
  await signInWithPassword(page, login);
  await expect(page).toHaveURL(/\/signin\/two-factor/);
  await page.getByLabel('6-digit code').fill(await freshCode(page, secret, login));
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/$/);

  // New backup codes, shown once.
  let s = await openSection(page);
  await expect(s).toContainText('10 of 10 backup codes left');
  await s.getByRole('button', { name: 'New backup codes' }).click();
  let sheet = page.getByRole('dialog', { name: 'New backup codes' });
  await sheet.getByLabel('Your password').fill(PASSWORD);
  await axe(page, 'the new backup codes sheet');
  await sheet.getByRole('button', { name: 'Make new codes' }).click();
  const codes = await codesOn(page);
  await axe(page, 'the new backup codes, shown once');
  await page.getByRole('button', { name: "I've saved them" }).click();

  // A backup code signs in once; the count drops.
  await signOut(page);
  await signInWithPassword(page, login);
  await expect(page).toHaveURL(/\/signin\/two-factor/);
  await page.getByRole('button', { name: 'Use a backup code instead' }).click();
  await page.getByLabel('Backup code').fill(codes[0] ?? '');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/$/);
  s = await openSection(page);
  await expect(s).toContainText('9 of 10 backup codes left');

  // Set up again, abandoned half-way: the old app still signs in.
  await s.getByRole('button', { name: 'Set up again' }).click();
  sheet = page.getByRole('dialog', { name: 'Set up again' });
  await sheet.getByLabel('Your password').fill(PASSWORD);
  await sheet.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText(/Until you enter a code from the new app/)).toBeVisible();
  const abandoned = await keyOn(page);
  expect(abandoned).not.toBe(secret);
  await axe(page, 'set up again, the QR step');
  await page
    .getByRole('dialog', { name: 'Set up again' })
    .getByRole('button', { name: 'Close' })
    .click();
  await signOut(page);
  await signInWithPassword(page, login);
  await expect(page).toHaveURL(/\/signin\/two-factor/);
  await page.getByLabel('6-digit code').fill(await freshCode(page, secret, login));
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/$/);

  // Set up again, finished: the new app's code; new backup codes.
  s = await openSection(page);
  await s.getByRole('button', { name: 'Set up again' }).click();
  sheet = page.getByRole('dialog', { name: 'Set up again' });
  await sheet.getByLabel('Your password').fill(PASSWORD);
  await sheet.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText(/Until you enter a code from the new app/)).toBeVisible();
  const replacement = await keyOn(page);
  await page.getByLabel('6-digit code').fill(await freshCode(page, replacement, login));
  await page.getByRole('button', { name: 'Use the new app' }).click();
  await expect(
    page.getByText('The new app is set up. Codes from the old one no longer work.'),
  ).toBeVisible();
  await codesOn(page);
  await page.getByRole('button', { name: "I've saved them" }).click();
  await expect(s).toContainText('10 of 10 backup codes left');

  // Off.
  await s.getByRole('button', { name: 'Turn off' }).click();
  sheet = page.getByRole('dialog', { name: 'Turn off two-factor?' });
  await sheet.getByLabel('Your password').fill(PASSWORD);
  await axe(page, 'the turn-off sheet');
  await sheet.getByRole('button', { name: 'Turn off' }).click();
  await expect(toasts(page)).toContainText('Two-factor is off');
  await expect(s.getByRole('link', { name: 'Turn on' })).toBeVisible();
  await context.close();
});
