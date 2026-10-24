/**
 * Kept opened at another address than the one it is set up for: the server refuses with 403
 * `origin_mismatch` and names the right address. Sign-in, the sign-in link and the password reset
 * say so with a link, not "don't match"; a refused save shows one strip with the link above the app.
 */
import { renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { api } from '@/api/client';
import { inventoryPaths } from '@/api/inventory/paths';
import { signedOutScenario } from '@/api/mock/fixtures';
import { MockReply } from '@/api/mock/server';
import { paths } from '@/api/paths';
import { AppProviders } from '@/app-providers';
import { useErrorText } from '@/components/page';
import { activateLocale } from '@/i18n/i18n';
import { plainText } from '@/lib/bidi';
import { asOrigin, resetOriginMismatch } from '@/lib/origin-mismatch';
import { findHeading, renderApp } from '@/test/app';

const LAN = 'http://kept.lan:8080';
const SENTENCE = `This Kept is set up for ${LAN}. Open it there.`;
const refused = () =>
  new MockReply(403, {
    error: `This Kept is set up for ${LAN}.`,
    code: 'origin_mismatch',
    hint: 'The request did not come from this site.',
    expectedOrigin: LAN,
  });

afterEach(() => resetOriginMismatch());

async function signInPage(path: string) {
  const app = await renderApp('/signin', {
    state: signedOutScenario(),
    setup: (m) => m.on('POST', path, refused),
  });
  await findHeading('Sign in to Kept');
  return app;
}

const notice = async () => {
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent(SENTENCE);
  const link = screen.getByRole('link', { name: `Open ${LAN}` });
  expect(link.getAttribute('href')).toMatch(new RegExp(`^${LAN}/`));
  expect(screen.queryByText(/don't match/)).toBeNull();
};

describe('a Kept opened at another address', () => {
  it('sign-in names the address it is set up for, with a link', async () => {
    const { user } = await signInPage(paths.auth.signInEmail);
    await user.type(screen.getByLabelText('Email or username'), 'ibrahim@example.com');
    await user.type(screen.getByLabelText('Password'), 'kept-seed-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await notice();
  });

  it('so do the sign-in link and the password reset', async () => {
    const magic = await signInPage(paths.auth.signInMagicLink);
    await magic.user.type(screen.getByLabelText('Email or username'), 'ibrahim@example.com');
    await magic.user.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
    await notice();
    magic.unmount();

    const reset = await signInPage(paths.auth.requestPasswordReset);
    await reset.user.type(screen.getByLabelText('Email or username'), 'ibrahim@example.com');
    await reset.user.click(screen.getByRole('button', { name: 'Forgot your password?' }));
    await notice();
  });

  it("a callback URL Better Auth refuses isn't a wrong password; a wrong password still is", async () => {
    const wrongUrl = await renderApp('/signin', {
      state: signedOutScenario(),
      setup: (m) =>
        m.on(
          'POST',
          paths.auth.signInEmail,
          () =>
            new MockReply(403, { code: 'INVALID_CALLBACK_URL', message: 'Invalid callbackURL' }),
        ),
    });
    await findHeading('Sign in to Kept');
    await wrongUrl.user.type(screen.getByLabelText('Email or username'), 'ibrahim@example.com');
    await wrongUrl.user.type(screen.getByLabelText('Password'), 'x');
    await wrongUrl.user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).not.toHaveTextContent(/don't match/);
    wrongUrl.unmount();

    const wrongPassword = await renderApp('/signin', {
      state: signedOutScenario(),
      setup: (m) =>
        m.on(
          'POST',
          paths.auth.signInEmail,
          () =>
            new MockReply(401, {
              code: 'INVALID_EMAIL_OR_PASSWORD',
              message: 'Invalid email or password',
            }),
        ),
    });
    await findHeading('Sign in to Kept');
    await wrongPassword.user.type(
      screen.getByLabelText('Email or username'),
      'ibrahim@example.com',
    );
    await wrongPassword.user.type(screen.getByLabelText('Password'), 'x');
    await wrongPassword.user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(
      await screen.findByText("That email or username and password don't match."),
    ).toBeInTheDocument();
  });

  it('a refused save shows one strip above the app with the link', async () => {
    await renderApp('/', { setup: (m) => m.on('POST', inventoryPaths.things, refused) });
    await findHeading('Home');
    expect(screen.queryByRole('link', { name: `Open ${LAN}` })).toBeNull();
    await api.post(inventoryPaths.things, { name: 'HD webcam' }).catch(() => undefined);
    expect(await screen.findByRole('link', { name: `Open ${LAN}` })).toBeInTheDocument();
    expect(screen.getAllByText(/This Kept is set up for/)).toHaveLength(1);
  });

  it('the error sentence names the address; one without it still makes sense', async () => {
    await activateLocale('en');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AppProviders locale="en">{children}</AppProviders>
    );
    const { result } = renderHook(() => useErrorText(), { wrapper });
    const { ApiError } = await import('@/api/client');
    const named = new ApiError(403, 'origin_mismatch', 'x', { details: { expectedOrigin: LAN } });
    expect(plainText(result.current(named))).toBe(SENTENCE);
    const bare = new ApiError(403, 'origin_mismatch', 'x');
    expect(result.current(bare)).toMatch(/^This Kept is set up for a different address\./);
  });

  it('only an http(s) origin is ever linked', () => {
    expect(asOrigin(LAN)).toBe(LAN);
    expect(asOrigin('https://kept.example.org')).toBe('https://kept.example.org');
    expect(asOrigin('javascript:alert(1)')).toBeNull();
    expect(asOrigin('http://kept.lan:8080/path')).toBeNull();
    expect(asOrigin(42)).toBeNull();
  });
});
