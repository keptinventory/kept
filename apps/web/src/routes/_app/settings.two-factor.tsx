/**
 * Turning on the authenticator app (D176): confirm it's you (the password, or on an account
 * without one a sign-in in the last ten minutes), scan the QR code, prove one code, then keep the
 * backup codes. Two-factor is on only after the code is proven. Kept never offers "trust this
 * device" (S2).
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { enableTwoFactor, getSignInSecurity, requestMagicLink, verifyTotp } from '@/api/auth';
import { isApiError } from '@/api/client';
import { keys, useMe } from '@/api/queries';
import type { TwoFactorEnableResult } from '@/api/types';
import { StepCounter } from '@/components/auth-frame';
import { TwoFactorRouteError } from '@/components/on-demand-route-error';
import { ErrorState, LoadingRows, Notice, Page, useErrorText } from '@/components/page';
import { useSignOut } from '@/components/sign-out';
import { BackupCodeList, TotpScan } from '@/components/totp-setup';
import { Button } from '@/components/ui/button';
import { PasswordField } from '@/components/ui/password-field';
import { toast } from '@/components/ui/toast';

export const Route = createFileRoute('/_app/settings/two-factor')({
  component: EnrolPage,
  errorComponent: TwoFactorRouteError,
});

function EnrolPage() {
  const { t } = useLingui();
  const [step, setStep] = useState(1);
  const [enrol, setEnrol] = useState<TwoFactorEnableResult | null>(null);
  return (
    <Page
      title={t`Turn on two-factor`}
      back="/settings"
      actions={
        <span className="eyebrow whitespace-nowrap">
          <StepCounter current={step} total={3} />
        </span>
      }
    >
      {step === 1 ? (
        <PasswordStep
          onDone={(r) => {
            setEnrol(r);
            setStep(2);
          }}
        />
      ) : null}
      {step === 2 && enrol ? (
        <TotpScan
          uri={enrol.totpURI}
          verify={verifyTotp}
          onDone={() => setStep(3)}
          submitLabel={<Trans>Turn on two-factor</Trans>}
        />
      ) : null}
      {step === 3 && enrol ? <BackupCodes codes={enrol.backupCodes} /> : null}
    </Page>
  );
}

/**
 * D197: with mail configured, an account whose address isn't confirmed can't enrol a second
 * factor (403 EMAIL_UNVERIFIED). Confirming it is a magic link, which claims the account: the
 * server removes its password, passkeys and other sessions, so whoever set them up before the
 * owner arrived keeps nothing. Two-factor needs a password, so the person then sets a new one.
 */
function ConfirmAddressFirst() {
  const { t } = useLingui();
  const errorText = useErrorText();
  const me = useMe();
  const email = me.data?.user.email ?? null;
  const send = useMutation({
    mutationFn: () => requestMagicLink(email ?? ''),
    onSuccess: () =>
      toast({ title: t`Sign-in link sent. It works once, for 5 minutes.`, tone: 'ok' }),
    onError: (e) => toast({ title: errorText(e), tone: 'danger' }),
  });
  return (
    <Notice tone="warn" title={<Trans>Confirm your email address first</Trans>}>
      <div className="grid gap-3">
        <p className="m-0">
          <Trans>
            Kept emails you a sign-in link; opening it confirms the address. Opening it also removes
            this account's password, passkeys and other sessions, so nobody who set them up before
            you keeps a way in. Then come back here within ten minutes.
          </Trans>
        </p>
        {email ? (
          <div>
            <Button
              size="small"
              variant="secondary"
              isPending={send.isPending}
              isDisabled={send.isSuccess}
              onPress={() => send.mutate()}
            >
              {send.isSuccess ? <Trans>Link sent</Trans> : <Trans>Email me a sign-in link</Trans>}
            </Button>
          </div>
        ) : null}
      </div>
    </Notice>
  );
}

function PasswordStep({ onDone }: { onDone: (r: TwoFactorEnableResult) => void }) {
  const { t } = useLingui();
  const errorText = useErrorText();
  const signOut = useSignOut();
  const account = useQuery({ queryKey: keys.signIn, queryFn: getSignInSecurity });
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [unverified, setUnverified] = useState(false);
  const [signInAgain, setSignInAgain] = useState(false);
  const hasPassword = account.data?.password !== false;
  const start = useMutation({
    mutationFn: () => enableTwoFactor(hasPassword ? password : undefined),
    onSuccess: onDone,
    onError: (e) => {
      if (isApiError(e) && e.authCode === 'EMAIL_UNVERIFIED') return setUnverified(true);
      if (isApiError(e) && e.code === 'reauth_required') {
        if (e.details.reauth === 'sign_in') return setSignInAgain(true);
        return setError(password ? t`That password isn't right.` : t`Enter your password.`);
      }
      setError(errorText(e));
    },
  });
  if (unverified) return <ConfirmAddressFirst />;
  if (account.isPending) return <LoadingRows rows={1} label={t`Loading`} />;
  if (account.error) {
    return <ErrorState error={account.error} onRetry={() => void account.refetch()} />;
  }
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (hasPassword && !password) return setError(t`Enter your password.`);
        start.mutate();
      }}
    >
      <p className="m-0 text-ink-2">
        {hasPassword ? (
          <Trans>
            After this, signing in asks for a 6-digit code from an authenticator app (1Password,
            Google Authenticator, Aegis…) as well as your password or sign-in link.
          </Trans>
        ) : (
          <Trans>
            After this, signing in with a sign-in link or Google also asks for a 6-digit code from
            an authenticator app (1Password, Google Authenticator, Aegis…).
          </Trans>
        )}
      </p>
      {signInAgain ? (
        <Notice
          tone="warn"
          title={<Trans>Sign in again</Trans>}
          action={
            <Button
              size="small"
              variant="secondary"
              onPress={() => void signOut({ next: '/settings/two-factor' })}
            >
              <Trans>Sign in again</Trans>
            </Button>
          }
        >
          <Trans>
            Your account has no password, and you signed in over ten minutes ago. Sign in again,
            then come back here.
          </Trans>
        </Notice>
      ) : null}
      {hasPassword ? (
        <PasswordField
          label={t`Your password`}
          value={password}
          onChange={(v) => {
            setPassword(v);
            setError(undefined);
          }}
          isInvalid={!!error}
          errorMessage={error}
          autoFocus
        />
      ) : error ? (
        <Notice tone="danger">{error}</Notice>
      ) : null}
      <Button type="submit" isPending={start.isPending} isDisabled={signInAgain}>
        <Trans>Continue</Trans>
      </Button>
    </form>
  );
}

function BackupCodes({ codes }: { codes: string[] }) {
  const { t } = useLingui();
  const qc = useQueryClient();
  const navigate = useNavigate();
  return (
    <div className="grid gap-4">
      <Notice tone="ok" title={<Trans>Two-factor is on</Trans>}>
        <Trans>Next time you sign in, Kept asks for a code from your app.</Trans>
      </Notice>
      <BackupCodeList codes={codes} />
      <Button
        onPress={async () => {
          await qc.invalidateQueries({ queryKey: keys.me });
          await qc.invalidateQueries({ queryKey: keys.signIn });
          toast({ title: t`Two-factor is on`, tone: 'ok' });
          void navigate({ to: '/settings' });
        }}
      >
        <Trans>I've saved them</Trans>
      </Button>
    </div>
  );
}
