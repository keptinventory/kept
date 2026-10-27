/**
 * Settings → Sign-in and security on the mock: passkeys (none, one, many; add, rename, remove) and
 * the authenticator app (off, on, codes left; new backup codes, set up again, turn off), with the
 * server's refusals put in words (a sign-in that isn't recent, an unconfirmed address, the last way
 * in, two-factor a location asks for), a passwordless account, Arabic, a phone's width; and the two
 * texts that tell the app lock apart from a passkey. The browser's WebAuthn is a stub: nothing
 * here reaches a real authenticator.
 */
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MockState, ownerScenario, signedOutScenario } from '@/api/mock/fixtures';
import { MockReply } from '@/api/mock/server';
import { MOCK_NEW_SECRET } from '@/api/mock/sign-in';
import { paths } from '@/api/paths';
import type { PasskeyView } from '@/api/types';
import { expectLogicalOnly } from '@/test/render';
import { renderApp } from '../app';

const webauthn = vi.hoisted(() => ({
  startRegistration: vi.fn(),
  startAuthentication: vi.fn(),
}));
vi.mock('@simplewebauthn/browser', () => webauthn);

/** jsdom serves the page over http:; these tests are on https unless one says plain http. */
const https = vi.hoisted(() => ({ plain: false }));
vi.mock('@/lib/https', () => ({ servedOverHttp: () => https.plain }));

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

let realAgent: PropertyDescriptor | undefined;

beforeEach(() => {
  // A browser that offers WebAuthn (the stub above answers for it).
  vi.stubGlobal('PublicKeyCredential', function PublicKeyCredential() {});
  webauthn.startRegistration.mockReset();
  webauthn.startAuthentication.mockReset();
  realAgent = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');
});

afterEach(() => {
  if (realAgent) Object.defineProperty(window.navigator, 'userAgent', realAgent);
  else delete (window.navigator as { userAgent?: string }).userAgent;
});

const key = (id: string, name: string | null, backedUp = true): PasskeyView => ({
  id: `0195f2a0-0000-7000-8000-${id.padStart(12, '0')}`,
  name,
  createdAt: '2026-10-01T10:00:00.000Z',
  backedUp,
  deviceType: backedUp ? 'multiDevice' : 'singleDevice',
});

function scenario(change: (s: MockState) => void = () => {}): MockState {
  const s = ownerScenario();
  change(s);
  return s;
}

async function section() {
  const heading = await screen.findByRole('heading', { name: 'Sign-in and security' });
  const root = heading.closest('section') ?? heading.parentElement?.parentElement;
  await within(root as HTMLElement).findByRole('heading', { name: 'Passkeys' });
  return root as HTMLElement;
}

// `hidden`: a sheet open on top hides the page from the accessibility tree.
const passkeyList = () => screen.getByRole('list', { name: 'Passkeys', hidden: true });
const passkeyRow = (name: string) =>
  within(passkeyList()).getByText(name).closest('li') as HTMLElement;
const toasts = () => screen.findByRole('region', { name: 'Notifications' });

describe('what the section shows', () => {
  it('one synced passkey, and the app on with backup codes left', async () => {
    await renderApp('/settings', { digits: 'western' });
    const root = await section();
    const row = passkeyRow('Laptop');
    expect(row).toHaveTextContent('Synced');
    expect(row).toHaveTextContent(/Added/);
    expect(within(row).getByRole('button', { name: 'Rename' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    expect(root).toHaveTextContent('On. Signing in asks for a code from your authenticator app.');
    expect(root).toHaveTextContent('8 of 10 backup codes left');
    for (const name of ['New backup codes', 'Set up again', 'Turn off']) {
      expect(within(root).getByRole('button', { name })).toBeInTheDocument();
    }
    // The old Two-factor row is gone; this section replaces it.
    expect(screen.queryByText('Two-factor', { exact: true })).not.toBeInTheDocument();
  });

  it('no passkeys yet', async () => {
    await renderApp('/settings', { state: scenario((s) => (s.signIn.passkeys = [])) });
    await section();
    expect(within(passkeyList()).getByText('No passkeys yet')).toBeInTheDocument();
    expect(within(passkeyList()).queryByRole('button', { name: 'Remove' })).toBeNull();
  });

  it('many passkeys, each with its own state, and an unnamed one', async () => {
    await renderApp('/settings', {
      state: scenario((s) => {
        s.signIn.passkeys = [key('a1', 'Laptop'), key('a2', 'Phone', false), key('a3', null)];
      }),
    });
    await section();
    expect(within(passkeyList()).getAllByRole('listitem')).toHaveLength(3);
    expect(passkeyRow('Phone')).toHaveTextContent('This device only');
    expect(passkeyRow('Passkey')).toHaveTextContent('Synced');
  });

  it('the app off: says what that means and offers Turn on', async () => {
    const { user, router } = await renderApp('/settings', {
      state: scenario((s) => (s.me.user.twoFactorEnabled = false)),
    });
    const root = await section();
    expect(root).toHaveTextContent(/Off\. Some locations ask for it/);
    expect(root).not.toHaveTextContent('backup codes left');
    await user.click(within(root).getByRole('link', { name: 'Turn on' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/settings/two-factor'));
  });

  it.each([
    [0, '0 of 10 backup codes left', true],
    [1, '1 of 10 backup codes left', true],
    [10, '10 of 10 backup codes left', false],
  ])('%i backup codes left', async (left, text, warn) => {
    await renderApp('/settings', {
      digits: 'western',
      state: scenario((s) => (s.signIn.backupCodesLeft = left)),
    });
    const root = await section();
    const line = within(root).getByText(text);
    expect(line.className.includes('text-warn')).toBe(warn);
  });
});

describe('adding a passkey', () => {
  it('names it after the device, runs the browser ceremony and lists it', async () => {
    Object.defineProperty(window.navigator, 'userAgent', { value: IPHONE, configurable: true });
    webauthn.startRegistration.mockResolvedValue({
      id: 'cred',
      rawId: 'cred',
      type: 'public-key',
      response: { clientDataJSON: 'x', attestationObject: 'y', transports: ['internal'] },
      clientExtensionResults: {},
    });
    const { user, mock } = await renderApp('/settings', {
      state: scenario((s) => (s.freshSignIn = true)),
    });
    await section();
    await user.click(screen.getByRole('button', { name: 'Add a passkey' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a passkey' });
    const name = within(dialog).getByLabelText('Name');
    expect(name).toHaveValue('iPhone');
    await user.clear(name);
    await user.type(name, 'Work phone');
    await user.type(within(dialog).getByLabelText('Your password'), 'correct horse battery');
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(await within(await toasts()).findByText('Passkey added')).toBeInTheDocument();
    expect(webauthn.startRegistration).toHaveBeenCalledTimes(1);
    // The password was confirmed before the browser's dialog.
    expect(mock.lastCall('POST', paths.myPasskeyConfirm)?.body).toEqual({
      password: 'correct horse battery',
    });
    expect(mock.lastCall('POST', paths.auth.passkeyVerifyRegistration)?.body).toMatchObject({
      name: 'Work phone',
      response: { id: 'cred' },
    });
    expect(await within(passkeyList()).findByText('Work phone')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Add a passkey' })).not.toBeInTheDocument();
  });

  it("closing the browser's dialog is quiet: no error, nothing added, the sheet stays", async () => {
    webauthn.startRegistration.mockRejectedValue(
      Object.assign(new Error('The operation either timed out or was not allowed.'), {
        name: 'NotAllowedError',
      }),
    );
    const { user, mock } = await renderApp('/settings', {
      state: scenario((s) => (s.freshSignIn = true)),
    });
    await section();
    await user.click(screen.getByRole('button', { name: 'Add a passkey' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a passkey' });
    await user.type(within(dialog).getByLabelText('Your password'), 'correct horse battery');
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(webauthn.startRegistration).toHaveBeenCalled());
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeEnabled(),
    );
    expect(within(dialog).queryByRole('alert')).toBeNull();
    expect(dialog).not.toHaveTextContent(/went wrong|didn't work/);
    expect(mock.lastCall('POST', paths.auth.passkeyVerifyRegistration)).toBeUndefined();
    expect(within(passkeyList()).getAllByRole('listitem', { hidden: true })).toHaveLength(1);
  });

  it('a sign-in over ten minutes old: the sheet offers Sign in again', async () => {
    const { user } = await renderApp('/settings');
    await section();
    await user.click(screen.getByRole('button', { name: 'Add a passkey' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a passkey' });
    await user.type(within(dialog).getByLabelText('Your password'), 'correct horse battery');
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(await within(dialog).findByText('Sign in again first')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Sign in again' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(webauthn.startRegistration).not.toHaveBeenCalled();
  });

  it('an address to confirm first: says how', async () => {
    const { user } = await renderApp('/settings', {
      setup: (m) =>
        m.on(
          'GET',
          paths.auth.passkeyRegisterOptions,
          () =>
            new MockReply(403, {
              code: 'EMAIL_UNVERIFIED',
              message: 'Confirm your email address first',
            }),
        ),
    });
    await section();
    await user.click(screen.getByRole('button', { name: 'Add a passkey' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a passkey' });
    await user.type(within(dialog).getByLabelText('Your password'), 'correct horse battery');
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(await within(dialog).findByText('Confirm your email address first')).toBeVisible();
    expect(webauthn.startRegistration).not.toHaveBeenCalled();
  });

  it('a password account types its password first; a wrong one stays in the sheet', async () => {
    const { user } = await renderApp('/settings', {
      state: scenario((s) => (s.freshSignIn = true)),
    });
    await section();
    await user.click(screen.getByRole('button', { name: 'Add a passkey' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a passkey' });
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(await within(dialog).findByText('Enter your password.')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Your password'), 'not it');
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(await within(dialog).findByText("That password isn't right.")).toBeInTheDocument();
    expect(webauthn.startRegistration).not.toHaveBeenCalled();
  });

  it('a passwordless account adds one with no password field', async () => {
    webauthn.startRegistration.mockResolvedValue({
      id: 'cred',
      rawId: 'cred',
      type: 'public-key',
      response: { clientDataJSON: 'x', attestationObject: 'y', transports: ['internal'] },
      clientExtensionResults: {},
    });
    const { user, mock } = await renderApp('/settings', {
      state: scenario((s) => {
        s.signIn.hasPassword = false;
        s.freshSignIn = true;
      }),
    });
    await section();
    await user.click(screen.getByRole('button', { name: 'Add a passkey' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a passkey' });
    expect(within(dialog).queryByLabelText('Your password')).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(await within(await toasts()).findByText('Passkey added')).toBeInTheDocument();
    expect(mock.lastCall('POST', paths.myPasskeyConfirm)).toBeUndefined();
  });

  it('over plain HTTP says passkeys need HTTPS, and offers none', async () => {
    https.plain = true;
    vi.stubGlobal('PublicKeyCredential', undefined);
    try {
      await renderApp('/settings');
      await section();
      expect(screen.queryByRole('button', { name: 'Add a passkey' })).toBeNull();
      expect(
        screen.getByText(
          "Passkeys need HTTPS. On a plain-HTTP address browsers don't offer them; put Kept on HTTPS to add one.",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText(/This browser can't add a passkey/)).toBeNull();
    } finally {
      https.plain = false;
    }
  });

  it('is not offered in a browser without passkeys', async () => {
    vi.stubGlobal('PublicKeyCredential', undefined);
    await renderApp('/settings');
    await section();
    expect(screen.queryByRole('button', { name: 'Add a passkey' })).toBeNull();
    expect(screen.getByText(/This browser can't add a passkey/)).toBeInTheDocument();
  });
});

describe('renaming and removing a passkey', () => {
  it('renames after the password; a wrong one keeps the sheet open', async () => {
    const { user, mock } = await renderApp('/settings');
    await section();
    await user.click(within(passkeyRow('Laptop')).getByRole('button', { name: 'Rename' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rename passkey' });
    // The account has a password: the sheet doesn't suggest leaving it empty.
    expect(dialog).not.toHaveTextContent(/No password on your account/);
    const name = within(dialog).getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Desk laptop');
    await user.type(within(dialog).getByLabelText('Your password'), 'not it');
    await user.click(within(dialog).getByRole('button', { name: 'Rename' }));
    expect(await within(dialog).findByText("That password isn't right.")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Your password'), 'correct horse battery');
    await user.click(within(dialog).getByRole('button', { name: 'Rename' }));
    expect(await within(await toasts()).findByText('Passkey renamed')).toBeInTheDocument();
    expect(mock.lastCall('PATCH', paths.myPasskey(key('a001', null).id))?.body).toEqual({
      name: 'Desk laptop',
      password: 'correct horse battery',
    });
    expect(await within(passkeyList()).findByText('Desk laptop')).toBeInTheDocument();
  });

  it('removes after a confirm sheet with the password', async () => {
    const { user } = await renderApp('/settings', {
      state: scenario((s) => (s.signIn.passkeys = [key('a1', 'Laptop'), key('a2', 'Phone')])),
    });
    await section();
    await user.click(within(passkeyRow('Phone')).getByRole('button', { name: 'Remove' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove Phone?' });
    expect(dialog).toHaveTextContent(/stops signing you in/);
    await user.type(within(dialog).getByLabelText('Your password'), 'correct horse battery');
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(await within(await toasts()).findByText('Passkey removed')).toBeInTheDocument();
    await waitFor(() => expect(within(passkeyList()).queryByText('Phone')).toBeNull());
  });

  it('the last way in: says why it stays', async () => {
    const { user } = await renderApp('/settings', {
      state: scenario((s) => {
        s.signIn.hasPassword = false;
        s.freshSignIn = true;
      }),
    });
    await section();
    await user.click(within(passkeyRow('Laptop')).getByRole('button', { name: 'Remove' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove Laptop?' });
    // No password on this account: nothing to type.
    expect(within(dialog).queryByLabelText('Your password')).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(
      await within(dialog).findByText(
        "That's your only way to sign in. Add another passkey or link another sign-in first.",
      ),
    ).toBeInTheDocument();
    expect(within(passkeyList()).getByText('Laptop')).toBeInTheDocument();
  });

  it('the last passkey while a location asks for two-factor and the app is off: says why', async () => {
    const { user } = await renderApp('/settings', {
      state: scenario((s) => {
        s.me.user.twoFactorEnabled = false;
        s.signIn.locationRequiresTwoFactor = true;
      }),
    });
    await section();
    await user.click(within(passkeyRow('Laptop')).getByRole('button', { name: 'Remove' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove Laptop?' });
    await user.type(within(dialog).getByLabelText('Your password'), 'correct horse battery');
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(
      await within(dialog).findByText(
        'A location you belong to asks for two-factor. Turn on the authenticator app before removing your last passkey.',
      ),
    ).toBeInTheDocument();
    expect(within(passkeyList()).getByText('Laptop')).toBeInTheDocument();
  });

  it('a passwordless account signed in long ago is asked to sign in again', async () => {
    const { user } = await renderApp('/settings', {
      state: scenario((s) => (s.signIn.hasPassword = false)),
    });
    await section();
    await user.click(within(passkeyRow('Laptop')).getByRole('button', { name: 'Rename' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rename passkey' });
    await user.click(within(dialog).getByRole('button', { name: 'Rename' }));
    expect(await within(dialog).findByText(/signed in over ten minutes ago/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Sign in again' })).toBeInTheDocument();
  });
});

describe('the authenticator app', () => {
  it('new backup codes: shown once with Copy all, and gone once saved', async () => {
    const { user } = await renderApp('/settings', { digits: 'western' });
    const root = await section();
    await user.click(within(root).getByRole('button', { name: 'New backup codes' }));
    const sheet = await screen.findByRole('dialog', { name: 'New backup codes' });
    expect(sheet).toHaveTextContent(/old backup codes stop working/);
    await user.type(within(sheet).getByLabelText('Your password'), 'correct horse battery');
    await user.click(within(sheet).getByRole('button', { name: 'Make new codes' }));
    const codes = await screen.findByRole('list', { name: 'Backup codes' });
    expect(within(codes).getAllByRole('listitem')).toHaveLength(10);
    expect(within(codes).getByText('h2k4m-n6p8q')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy all codes' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: "I've saved them" }));
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Backup codes' })).toBeNull());
    expect(await within(root).findByText('10 of 10 backup codes left')).toBeInTheDocument();
  });

  it('set up again: closing half-way changes nothing; finishing shows the new codes', async () => {
    const { user, mock } = await renderApp('/settings', { digits: 'western' });
    const root = await section();
    await user.click(within(root).getByRole('button', { name: 'Set up again' }));
    let sheet = await screen.findByRole('dialog', { name: 'Set up again' });
    expect(sheet).toHaveTextContent(/current app keeps working/);
    await user.type(within(sheet).getByLabelText('Your password'), 'correct horse battery');
    await user.click(within(sheet).getByRole('button', { name: 'Continue' }));
    sheet = await screen.findByRole('dialog', { name: 'Set up again' });
    expect(
      await within(sheet).findByText(/until you enter a code from the new app/i),
    ).toBeInTheDocument();
    expect(sheet).toHaveTextContent(MOCK_NEW_SECRET.slice(0, 4));
    // Abandon: close the sheet. The app stays on with the same codes.
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mock.lastCall('POST', paths.myTwoFactor.setUpAgainVerify)).toBeUndefined();
    expect(root).toHaveTextContent('8 of 10 backup codes left');
    expect(root).toHaveTextContent('On. Signing in asks for a code');

    // Again, and finish with a code from the new app.
    await user.click(within(root).getByRole('button', { name: 'Set up again' }));
    sheet = await screen.findByRole('dialog', { name: 'Set up again' });
    await user.type(within(sheet).getByLabelText('Your password'), 'correct horse battery');
    await user.click(within(sheet).getByRole('button', { name: 'Continue' }));
    sheet = await screen.findByRole('dialog', { name: 'Set up again' });
    const code = await within(sheet).findByLabelText('6-digit code');
    await user.type(code, '000000');
    await user.click(within(sheet).getByRole('button', { name: 'Use the new app' }));
    expect(await within(sheet).findByText(/That code didn't match/)).toBeInTheDocument();
    await user.clear(code);
    await user.type(code, '123456');
    await user.click(within(sheet).getByRole('button', { name: 'Use the new app' }));
    expect(
      await screen.findByText('The new app is set up. Codes from the old one no longer work.'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Backup codes' })).getAllByRole('listitem'),
    ).toHaveLength(10);
    await user.click(screen.getByRole('button', { name: "I've saved them" }));
    expect(await within(root).findByText('10 of 10 backup codes left')).toBeInTheDocument();
  });

  it('turn off: a confirm sheet, then off', async () => {
    const { user } = await renderApp('/settings');
    const root = await section();
    await user.click(within(root).getByRole('button', { name: 'Turn off' }));
    const sheet = await screen.findByRole('dialog', { name: 'Turn off two-factor?' });
    await user.type(within(sheet).getByLabelText('Your password'), 'correct horse battery');
    await user.click(within(sheet).getByRole('button', { name: 'Turn off' }));
    expect(await within(await toasts()).findByText('Two-factor is off')).toBeInTheDocument();
    expect(await within(root).findByRole('link', { name: 'Turn on' })).toBeInTheDocument();
  });

  it('turn off while a location asks for it and no passkey can stand in: says why', async () => {
    const { user } = await renderApp('/settings', {
      state: scenario((s) => {
        s.signIn.passkeys = [];
        s.signIn.locationRequiresTwoFactor = true;
      }),
    });
    const root = await section();
    await user.click(within(root).getByRole('button', { name: 'Turn off' }));
    const sheet = await screen.findByRole('dialog', { name: 'Turn off two-factor?' });
    await user.type(within(sheet).getByLabelText('Your password'), 'correct horse battery');
    await user.click(within(sheet).getByRole('button', { name: 'Turn off' }));
    expect(
      await within(sheet).findByText(
        'A location you belong to asks for two-factor. Add a passkey first, then turn the authenticator app off.',
      ),
    ).toBeInTheDocument();
    expect(root).toHaveTextContent('On. Signing in asks for a code');
  });

  it('turning it on without a password: no password field, and a stale sign-in is asked to sign in again', async () => {
    const { user } = await renderApp('/settings/two-factor', {
      state: scenario((s) => {
        s.me.user.twoFactorEnabled = false;
        s.signIn.hasPassword = false;
      }),
    });
    await screen.findByRole('heading', { name: 'Turn on two-factor' });
    await screen.findByText(/signing in with a sign-in link or Google also asks/);
    expect(screen.queryByLabelText('Your password')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText(/signed in over ten minutes ago/)).toBeInTheDocument();
  });

  it('turning it on without a password after a fresh sign-in goes straight to the QR code', async () => {
    const { user, mock } = await renderApp('/settings/two-factor', {
      state: scenario((s) => {
        s.me.user.twoFactorEnabled = false;
        s.signIn.hasPassword = false;
        s.freshSignIn = true;
      }),
    });
    await screen.findByRole('heading', { name: 'Turn on two-factor' });
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByLabelText('6-digit code')).toBeInTheDocument();
    expect(mock.lastCall('POST', paths.myTwoFactor.enable)?.body).toEqual({});
  });
});

describe('in Arabic, and at a phone width', () => {
  it('draws the section right to left with logical CSS only and Eastern digits', async () => {
    await renderApp('/settings', { locale: 'ar' });
    const heading = await screen.findByRole('heading', { name: 'تسجيل الدخول والأمان' });
    const root = heading.closest('section') as HTMLElement;
    expect(await within(root).findByText('Laptop')).toBeInTheDocument();
    expect(root).toHaveTextContent('٨');
    expect(document.documentElement.dir).toBe('rtl');
    expectLogicalOnly(root);
  });

  it('cuts nothing off with an ellipsis', async () => {
    window.innerWidth = 375;
    const { container } = await renderApp('/settings', {
      state: scenario((s) => {
        s.signIn.passkeys = [
          key('a1', 'A passkey with a long name that has to wrap on a phone screen'),
          key('a2', 'Phone', false),
        ];
      }),
    });
    await section();
    const clipped = [...container.querySelectorAll<HTMLElement>('[class]')].filter((el) =>
      /(^|\s)(truncate|text-ellipsis|line-clamp-\d)(\s|$)/.test(el.getAttribute('class') ?? ''),
    );
    expect(clipped.map((el) => el.textContent)).toEqual([]);
    window.innerWidth = 1024;
  });
});

describe('a passkey is not the app lock', () => {
  it("the sign-in page says a passkey isn't this account's, and that the app lock can't sign in", async () => {
    webauthn.startAuthentication.mockResolvedValue({
      id: 'cred',
      rawId: 'cred',
      type: 'public-key',
      response: { clientDataJSON: 'x', authenticatorData: 'y', signature: 'z' },
      clientExtensionResults: {},
    });
    const { user } = await renderApp('/signin', {
      state: signedOutScenario(),
      setup: (m) => m.on('GET', paths.auth.passkeyAuthenticateOptions, () => ({ challenge: 'c' })),
    });
    await user.click(await screen.findByRole('button', { name: /passkey/i }));
    expect(
      await screen.findByText(
        "That passkey isn't one this account signs in with. A device's app lock can't sign you in. Sign in another way, then add a passkey in Settings → Sign-in and security.",
      ),
    ).toBeInTheDocument();
  });
});
