/**
 * Settings → Sign-in and security: the section and its anchor (`/settings#sign-in-security`,
 * where invites and a location's two-factor note send people). What it shows,
 * ./sign-in-security.household.tsx, loads on demand: it reads and writes the server only, so it
 * stays out of the precache. Offline before its first load, the section says "Needs a connection".
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { lazy, Suspense } from 'react';
import { LoadingRows, Notice, Section } from '@/components/page';

/** The section's id on the Settings page. */
export const SIGN_IN_SECURITY_ANCHOR = 'sign-in-security';

function Offline() {
  const { t } = useLingui();
  return <Notice tone="warn" title={t`Needs a connection`} />;
}

const Body = lazy(() =>
  import('./sign-in-security.household')
    .then((m) => ({ default: m.SignInSecurity }))
    .catch(() => ({ default: Offline })),
);

export function SignInSecuritySection() {
  const { t } = useLingui();
  return (
    <Section title={<Trans>Sign-in and security</Trans>} id={SIGN_IN_SECURITY_ANCHOR}>
      <Suspense fallback={<LoadingRows rows={2} label={t`Loading your sign-in settings`} />}>
        <Body />
      </Suspense>
    </Section>
  );
}
