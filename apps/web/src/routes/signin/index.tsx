/**
 * Sign in (task 17, D176): email or username with a password, a magic link, a passkey, or "Sign in
 * with <name>" when the server has an OIDC provider (step 6 T22, D127; its failures come back as
 * `?error=`). A
 * password sign-in on an account with two-factor continues to the challenge. Magic links open
 * /auth/confirm with the token in the fragment. Sign-up is closed by default: the way in is an
 * invite (D33, D127).
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { getSetupStatus } from '@/api/account';
import {
  PasskeyCancelled,
  passkeysSupported,
  requestMagicLink,
  requestPasswordReset,
  signInWithPasskey,
  signInWithPassword,
} from '@/api/auth';
import { isApiError } from '@/api/client';
import { keys } from '@/api/queries';
import { AuthFrame } from '@/components/auth-frame';
import { KeyIcon, MailIcon } from '@/components/icons';
import { OidcError, OidcSignInButton, useGoogleOn, useOidcName } from '@/components/oidc-sign-in';
import { OriginMismatchNotice } from '@/components/origin-mismatch';
import { LinkButton, Notice, useErrorText } from '@/components/page';
import { Button } from '@/components/ui/button';
import { PasswordField } from '@/components/ui/password-field';
import { TextField } from '@/components/ui/text-field';
import { appHref, publicOrigin, underIngress } from '@/lib/base-path';
import { nextSearch } from '@/lib/next';
import { expectedOriginOf } from '@/lib/origin-mismatch';

/** `next`, the `error` a failed "Sign in with <name>" comes back with (step 6, T22), and `via`:
 * `google` when it was Google's (D226). */
const signInSearch = (
  search: Record<string, unknown>,
): { next?: string; error?: string; via?: 'google' } => {
  const error = typeof search.error === 'string' ? search.error.slice(0, 64) : undefined;
  return {
    ...nextSearch(search),
    ...(error ? { error } : {}),
    ...(search.via === 'google' ? { via: 'google' as const } : {}),
  };
};

export const Route = createFileRoute('/signin/')({
  validateSearch: signInSearch,
  beforeLoad: async ({ context }) => {
    const status = await context.queryClient
      .ensureQueryData({ queryKey: keys.setup, queryFn: getSetupStatus })
      .catch(() => null);
    if (status?.needed) throw redirect({ to: '/setup', replace: true });
  },
  component: SignInPage,
});

/** Better Auth's answers that mean the email or username and the password don't go together.
 * Its other INVALID_* codes (the origin, a callback URL) say nothing about the password. */
const WRONG_CREDENTIALS = new Set([
  'INVALID_EMAIL_OR_PASSWORD',
  'INVALID_USERNAME_OR_PASSWORD',
  'INVALID_PASSWORD',
  'INVALID_EMAIL',
  'INVALID_USERNAME',
]);

const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/** A passkey belongs to Kept's own host name (its rpID). Under Home Assistant ingress (D273) the
 * page is on Home Assistant's, so passkey sign-in is offered only when the two are the same. */
function passkeysHere(): boolean {
  if (!underIngress()) return true;
  try {
    return new URL(publicOrigin()).hostname === window.location.hostname;
  } catch {
    return false;
  }
}

function SignInPage() {
  const { t } = useLingui();
  const { next, error: oidcError, via } = Route.useSearch();
  const oidcName = useOidcName();
  const googleOn = useGoogleOn();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const errorText = useErrorText();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** The address this Kept is set up for, when it was opened at another one. */
  const [mismatch, setMismatch] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ id?: string; password?: string }>({});
  const [linkSentTo, setLinkSentTo] = useState<{ to: string; kind: 'sign-in' | 'reset' } | null>(
    null,
  );

  const router = useRouter();
  const done = async () => {
    await qc.invalidateQueries({ queryKey: keys.me });
    // `next` may carry a #fragment (an invite link), so it goes to history as a whole href.
    // The browser's history knows no basepath: under Home Assistant ingress, the prefix (D273).
    router.history.push(appHref(next ?? '/'));
  };
  const describe = (e: unknown) => {
    setMismatch(expectedOriginOf(e));
    if (isApiError(e) && e.code === 'rate_limited') {
      const wait = e.retryAfter;
      return wait
        ? t`Too many attempts. Try again in ${wait} seconds.`
        : t`Too many attempts. Wait a minute and try again.`;
    }
    if (
      isApiError(e) &&
      e.code !== 'origin_mismatch' &&
      (e.status === 401 || (e.authCode !== undefined && WRONG_CREDENTIALS.has(e.authCode)))
    )
      return t`That email or username and password don't match.`;
    return errorText(e);
  };

  const password$ = useMutation({
    mutationFn: () => signInWithPassword(identifier, password),
    onSuccess: async (r) => {
      if ('twoFactorRedirect' in r && r.twoFactorRedirect) {
        void navigate({ to: '/signin/two-factor', search: next ? { next } : {} });
        return;
      }
      await done();
    },
    onError: (e) => setError(describe(e)),
  });
  const magic$ = useMutation({
    mutationFn: () => requestMagicLink(identifier),
    onSuccess: () => setLinkSentTo({ to: identifier.trim(), kind: 'sign-in' }),
    onError: (e) => setError(describe(e)),
  });
  const reset$ = useMutation({
    mutationFn: () => requestPasswordReset(identifier),
    onSuccess: () => setLinkSentTo({ to: identifier.trim(), kind: 'reset' }),
    onError: (e) => setError(describe(e)),
  });
  const passkey$ = useMutation({
    mutationFn: signInWithPasskey,
    onSuccess: done,
    onError: (e) => {
      setMismatch(expectedOriginOf(e));
      if (expectedOriginOf(e)) return setError(describe(e));
      if (e instanceof PasskeyCancelled) return setError(t`Passkey sign-in was cancelled.`);
      if (isApiError(e) && e.code === 'mfa_required') {
        void navigate({ to: '/signin/two-factor', search: next ? { next } : {} });
        return;
      }
      setError(
        t`That passkey isn't one this account signs in with. A device's app lock can't sign you in. Sign in another way, then add a passkey in Settings → Sign-in and security.`,
      );
    },
  });

  if (linkSentTo) {
    const to = linkSentTo.to;
    return (
      <AuthFrame
        title={t`Check your email`}
        intro={
          linkSentTo.kind === 'reset' ? (
            <Trans>
              If <strong className="ltr text-ink">{to}</strong> has an account here, a link to set a
              new password is on its way. It works once, for an hour.
            </Trans>
          ) : (
            <Trans>
              If <strong className="ltr text-ink">{to}</strong> has an account here, a sign-in link
              is on its way. It works once, for 5 minutes.
            </Trans>
          )
        }
        footer={
          <Button variant="secondary" onPress={() => setLinkSentTo(null)}>
            <Trans>Use a different way</Trans>
          </Button>
        }
      >
        <Notice tone="info">
          <Trans>
            Open the link on this device. Nothing arrived? Check spam, or ask your admin whether
            email is set up.
          </Trans>
        </Notice>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title={t`Sign in to Kept`}>
      {oidcError ? (
        <OidcError code={oidcError} name={via === 'google' ? 'Google' : oidcName} />
      ) : null}
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const errs = {
            ...(identifier.trim() ? {} : { id: t`Enter your email or username.` }),
            ...(password ? {} : { password: t`Enter your password.` }),
          };
          setFieldErrors(errs);
          if (errs.id || errs.password) return;
          password$.mutate();
        }}
      >
        <TextField
          label={t`Email or username`}
          value={identifier}
          onChange={(v) => {
            setIdentifier(v);
            setFieldErrors({});
          }}
          isInvalid={!!fieldErrors.id}
          errorMessage={fieldErrors.id}
          autoComplete="username"
          autoFocus
          inputProps={{ dir: 'ltr', autoCapitalize: 'none', spellCheck: false }}
        />
        <PasswordField
          label={t`Password`}
          value={password}
          onChange={(v) => {
            setPassword(v);
            setFieldErrors({});
          }}
          isInvalid={!!fieldErrors.password}
          errorMessage={fieldErrors.password}
        />
        {error && mismatch ? (
          <OriginMismatchNotice expected={mismatch} />
        ) : error ? (
          <Notice tone="danger">{error}</Notice>
        ) : null}
        <Button type="submit" isPending={password$.isPending}>
          <Trans>Sign in</Trans>
        </Button>
        <Button
          variant="ghost"
          size="small"
          isPending={reset$.isPending}
          onPress={() => {
            setError(null);
            if (!looksLikeEmail(identifier)) {
              setFieldErrors({ id: t`Enter your email address to reset your password.` });
              return;
            }
            reset$.mutate();
          }}
        >
          <Trans>Forgot your password?</Trans>
        </Button>
      </form>
      <div className="flex items-center gap-3 text-small text-ink-3">
        <span className="h-px flex-1 bg-line" />
        <Trans>or</Trans>
        <span className="h-px flex-1 bg-line" />
      </div>
      <div className="grid gap-2">
        <Button
          variant="secondary"
          isPending={magic$.isPending}
          onPress={() => {
            setError(null);
            if (!looksLikeEmail(identifier)) {
              setFieldErrors({ id: t`Enter your email address to get a sign-in link.` });
              return;
            }
            magic$.mutate();
          }}
        >
          <MailIcon />
          <Trans>Email me a sign-in link</Trans>
        </Button>
        {passkeysSupported() && passkeysHere() ? (
          <Button
            variant="secondary"
            isPending={passkey$.isPending}
            onPress={() => {
              setError(null);
              passkey$.mutate();
            }}
          >
            <KeyIcon />
            <Trans>Sign in with a passkey</Trans>
          </Button>
        ) : null}
        {oidcName ? <OidcSignInButton name={oidcName} {...(next ? { next } : {})} /> : null}
        {googleOn ? (
          <OidcSignInButton provider="google" name="Google" {...(next ? { next } : {})} />
        ) : null}
      </div>
      <LinkButton to="/signin/code" variant="ghost">
        <Trans>I have a one-time code</Trans>
      </LinkButton>
      <p className="m-0 text-small text-ink-3">
        <Trans>
          No account yet? Ask someone who uses this Kept to invite you. The invite link creates your
          account.
        </Trans>
      </p>
    </AuthFrame>
  );
}
