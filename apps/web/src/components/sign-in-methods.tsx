/**
 * Settings → Me → Sign-in methods (1.2, D176, D226): link or unlink the instance's OIDC provider
 * and Google. Shown only when one of them is configured. Linking leaves for the provider and comes
 * back to Settings (`?via=…&error=…` when it failed, put in words by OidcError); it needs a
 * sign-in in the last ten minutes (`SESSION_NOT_FRESH`): the section then offers "Sign in again".
 * Unlinking is Kept's DELETE /api/v1/me/linked/:id behind confirm-it's-you (ReauthSheet: the
 * password, or a recent sign-in on an account without one); the server never removes the last
 * way in (409 `last_sign_in_method`, which the sheet puts in words).
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  GOOGLE_PROVIDER_ID,
  getSignInSecurity,
  listSignInMethods,
  OIDC_PROVIDER_ID,
  type OutsideProvider,
  startLinkSignIn,
  unlinkSignInMethod,
} from '@/api/auth';
import { isApiError } from '@/api/client';
import { keys } from '@/api/queries';
import { KeyIcon } from '@/components/icons';
import { OidcError, useGoogleOn, useOidcName } from '@/components/oidc-sign-in';
import { ReauthSheet } from '@/components/ops/reauth-sheet';
import { IconTile, List, LoadingRows, Notice, Pill, Row, Section } from '@/components/page';
import { useSignOut } from '@/components/sign-out';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { leave } from '@/lib/leave';

const methodsKey = ['me', 'sign-in-methods'] as const;

/** Where a link comes back to, and where it comes back to when it failed. */
const RETURN = '/settings';
const errorReturn = (provider: OutsideProvider) => `${RETURN}?via=${provider}`;

export function SignInMethods({ error, via }: { error?: string; via?: OutsideProvider }) {
  const { t } = useLingui();
  const qc = useQueryClient();
  const signOut = useSignOut();
  const [unlinking, setUnlinking] = useState<{ id: string; name: string } | null>(null);
  const oidcName = useOidcName();
  const googleOn = useGoogleOn();
  const [stale, setStale] = useState(false);
  const outside: { provider: OutsideProvider; name: string }[] = [];
  if (oidcName) outside.push({ provider: OIDC_PROVIDER_ID, name: oidcName });
  if (googleOn) outside.push({ provider: GOOGLE_PROVIDER_ID, name: 'Google' });
  const methods = useQuery({
    queryKey: methodsKey,
    queryFn: listSignInMethods,
    enabled: outside.length > 0,
  });
  // Whether the account has a password: the unlink sheet asks for it then.
  const security = useQuery({
    queryKey: keys.signIn,
    queryFn: getSignInSecurity,
    enabled: outside.length > 0,
  });

  const refused = (e: unknown) => {
    if (isApiError(e) && e.authCode === 'SESSION_NOT_FRESH') {
      setStale(true);
      return;
    }
    toast({ title: t`That didn't work. Try again.`, tone: 'danger' });
  };

  const link = useMutation({
    mutationFn: (provider: OutsideProvider) =>
      startLinkSignIn(provider, { callbackURL: RETURN, errorCallbackURL: errorReturn(provider) }),
    onSuccess: ({ url }) => leave.to(url),
    onError: refused,
  });
  if (outside.length === 0) return null;
  const failedName =
    via === GOOGLE_PROVIDER_ID ? 'Google' : via === OIDC_PROVIDER_ID ? oidcName : null;

  return (
    <Section title={<Trans>Sign-in methods</Trans>}>
      {error ? <OidcError code={error} name={failedName} /> : null}
      {stale ? (
        <Notice
          tone="warn"
          title={<Trans>Sign in again first</Trans>}
          action={
            <Button size="small" variant="secondary" onPress={() => void signOut({ next: RETURN })}>
              <Trans>Sign in again</Trans>
            </Button>
          }
        >
          <Trans>Linking or unlinking a sign-in needs a sign-in in the last ten minutes.</Trans>
        </Notice>
      ) : null}
      {methods.isPending ? (
        <LoadingRows rows={outside.length} label={t`Loading your sign-in methods`} />
      ) : (
        <List>
          {outside.map(({ provider, name }) => {
            const linked = methods.data?.find((m) => m.providerId === provider);
            return (
              <li key={provider}>
                <Row
                  leading={
                    <IconTile>
                      <KeyIcon />
                    </IconTile>
                  }
                  title={
                    <Trans>
                      Sign in with <bdi>{name}</bdi>
                    </Trans>
                  }
                  subtitle={
                    linked ? (
                      <Pill tone="ok">
                        <Trans>Linked</Trans>
                      </Pill>
                    ) : (
                      <Trans>Not linked</Trans>
                    )
                  }
                  trailing={
                    linked ? (
                      <Button
                        size="small"
                        variant="secondary"
                        onPress={() => setUnlinking({ id: linked.id, name })}
                      >
                        <Trans>Unlink</Trans>
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        variant="secondary"
                        isPending={link.isPending && link.variables === provider}
                        onPress={() => link.mutate(provider)}
                      >
                        <Trans>Link</Trans>
                      </Button>
                    )
                  }
                />
              </li>
            );
          })}
        </List>
      )}
      {unlinking ? (
        <UnlinkSheet
          name={unlinking.name}
          hasPassword={security.data?.password !== false}
          onClose={() => setUnlinking(null)}
          onUnlink={async (password) => {
            await unlinkSignInMethod(unlinking.id, password);
            await qc.invalidateQueries({ queryKey: methodsKey });
            await qc.invalidateQueries({ queryKey: keys.signIn });
            await qc.invalidateQueries({ queryKey: keys.sessions });
            toast({ title: t`Unlinked`, tone: 'ok' });
            setUnlinking(null);
          }}
        />
      ) : null}
      <p className="m-0 text-small text-ink-3">
        <Trans>
          Once linked, that account signs you in here. Kept never links one because the email
          matches.
        </Trans>
      </p>
    </Section>
  );
}

/** "Unlink Google?": confirm-it's-you first, as every sign-in change (ReauthSheet). */
function UnlinkSheet({
  name,
  hasPassword,
  onClose,
  onUnlink,
}: {
  name: string;
  hasPassword: boolean;
  onClose: () => void;
  onUnlink: (password: string | undefined) => Promise<void>;
}) {
  const { t } = useLingui();
  return (
    <ReauthSheet
      title={t`Unlink ${name}?`}
      submitLabel={<Trans>Unlink</Trans>}
      submitVariant="danger"
      returnTo={RETURN}
      hasPassword={hasPassword}
      onClose={onClose}
      onSubmit={onUnlink}
    >
      <p className="m-0">
        {t`You won't be able to sign in with ${name} until you link it again. Your password and passkeys still work.`}
      </p>
    </ReauthSheet>
  );
}
