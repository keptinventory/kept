/**
 * Settings → Sign-in and security (#226): the person's passkeys (add, rename, remove) and the
 * authenticator app (turn on, new backup codes, set up again, turn off). Loaded on demand
 * (./sign-in-security.tsx); it reads and writes the server only.
 *
 * Every change confirms it's you first: the password, or on an account without one a sign-in in
 * the last ten minutes (ReauthSheet). Adding a passkey asks for the password too on an account
 * with one, and always needs that recent sign-in (the browser's own ceremony runs then): its
 * sheet offers "Sign in again" when it is older.
 * The server refuses removing the last way in and turning off two-factor a location asks for; the
 * sheets only say why.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import {
  addPasskey,
  confirmPasskeyAdd,
  disableTwoFactor,
  finishSetUpAgain,
  getSignInSecurity,
  newBackupCodes,
  PasskeyCancelled,
  PasskeyExists,
  passkeysSupported,
  removePasskey,
  renamePasskey,
  startSetUpAgain,
} from '@/api/auth';
import { isApiError } from '@/api/client';
import { keys } from '@/api/queries';
import type { PasskeyView, SignInSecurity as SignInState } from '@/api/types';
import { KeyIcon, ShieldCheckIcon, ShieldIcon } from '@/components/icons';
import { ReauthSheet } from '@/components/ops/reauth-sheet';
import {
  ErrorState,
  IconTile,
  LinkButton,
  List,
  LoadingRows,
  Notice,
  Pill,
  Row,
  useErrorText,
} from '@/components/page';
import { useSignOut } from '@/components/sign-out';
import { BackupCodeList, TotpScan } from '@/components/totp-setup';
import { Button } from '@/components/ui/button';
import { Dialog, DialogFooter, Modal } from '@/components/ui/dialog';
import { PasswordField } from '@/components/ui/password-field';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { sep, useFormat } from '@/lib/format';
import { describeUserAgent } from '@/lib/user-agent';

/** Where "Sign in again" comes back to. */
const RETURN = '/settings#sign-in-security';
const NAME_MAX = 64;
const BACKUP_CODES = 10;

function useRefresh() {
  const qc = useQueryClient();
  return async () => {
    await qc.invalidateQueries({ queryKey: keys.signIn });
    await qc.invalidateQueries({ queryKey: keys.me });
    await qc.invalidateQueries({ queryKey: keys.sessions });
  };
}

export function SignInSecurity() {
  const { t } = useLingui();
  const state = useQuery({ queryKey: keys.signIn, queryFn: getSignInSecurity });
  if (state.isPending) return <LoadingRows rows={2} label={t`Loading your sign-in settings`} />;
  if (state.error) return <ErrorState error={state.error} onRetry={() => void state.refetch()} />;
  return (
    <div className="grid gap-5">
      <Passkeys state={state.data} />
      <AuthenticatorApp state={state.data} />
    </div>
  );
}

// ---- Passkeys -----------------------------------------------------------------------------------

function Passkeys({ state }: { state: SignInState }) {
  const { t } = useLingui();
  const [adding, setAdding] = useState(false);
  const supported = passkeysSupported();
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 font-semibold text-[16px]">
          <Trans>Passkeys</Trans>
        </h3>
        {supported ? (
          <Button size="small" variant="primary" onPress={() => setAdding(true)}>
            <Trans>Add a passkey</Trans>
          </Button>
        ) : null}
      </div>
      <p className="m-0 text-small text-ink-2">
        <Trans>
          Sign in with Face ID, a fingerprint or your phone's screen lock instead of typing a
          password. A passkey counts as two-factor on its own.
        </Trans>
      </p>
      {supported ? null : (
        <p className="m-0 text-small text-ink-2">
          <Trans>This browser can't add a passkey. Try another browser or device.</Trans>
        </p>
      )}
      <List aria-label={t`Passkeys`}>
        {state.passkeys.length === 0 ? (
          <li>
            <Row
              leading={
                <IconTile>
                  <KeyIcon />
                </IconTile>
              }
              title={<Trans>No passkeys yet</Trans>}
            />
          </li>
        ) : (
          state.passkeys.map((p) => (
            <li key={p.id}>
              <PasskeyRow passkey={p} hasPassword={state.password} />
            </li>
          ))
        )}
      </List>
      {adding ? (
        <AddPasskeySheet hasPassword={state.password} onClose={() => setAdding(false)} />
      ) : null}
    </div>
  );
}

function PasskeyRow({ passkey, hasPassword }: { passkey: PasskeyView; hasPassword: boolean }) {
  const { t } = useLingui();
  const f = useFormat();
  const [sheet, setSheet] = useState<'rename' | 'remove' | null>(null);
  const name = passkey.name ?? t`Passkey`;
  const added = passkey.createdAt ? f.day(passkey.createdAt) : null;
  return (
    <Row
      leading={
        <IconTile>
          <KeyIcon />
        </IconTile>
      }
      title={<bdi>{name}</bdi>}
      subtitle={
        <>
          {added ? <Trans>Added {added}</Trans> : null}
          {added ? sep() : null}
          {passkey.backedUp ? <Trans>Synced</Trans> : <Trans>This device only</Trans>}
        </>
      }
    >
      <div className="mt-1.5 flex flex-wrap gap-2">
        <Button size="small" variant="secondary" onPress={() => setSheet('rename')}>
          <Trans>Rename</Trans>
        </Button>
        <Button size="small" variant="secondary" onPress={() => setSheet('remove')}>
          <Trans>Remove</Trans>
        </Button>
      </div>
      {sheet === 'rename' ? (
        <RenamePasskeySheet
          passkey={passkey}
          hasPassword={hasPassword}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'remove' ? (
        <RemovePasskeySheet
          passkey={passkey}
          hasPassword={hasPassword}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </Row>
  );
}

type AddRefusal = 'stale' | 'unverified' | 'exists' | null;

function AddPasskeySheet({
  hasPassword,
  onClose,
}: {
  /** An account with a password confirms it before the browser's dialog. */
  hasPassword: boolean;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const errorText = useErrorText();
  const refresh = useRefresh();
  const signOut = useSignOut();
  const device =
    describeUserAgent(typeof navigator === 'undefined' ? null : navigator.userAgent).os ??
    t`Passkey`;
  const [name, setName] = useState(device);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [refusal, setRefusal] = useState<AddRefusal>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const add = useMutation({
    mutationFn: async () => {
      // The password first (the server lets this session add one passkey for five minutes),
      // then the browser's dialog.
      if (hasPassword) {
        try {
          await confirmPasskeyAdd(password);
        } finally {
          setPassword('');
        }
      }
      return addPasskey(name);
    },
    onSuccess: async () => {
      await refresh();
      toast({ title: t`Passkey added`, tone: 'ok' });
      onClose();
    },
    onError: (e) => {
      // Closing the browser's own dialog is a choice, not an error.
      if (e instanceof PasskeyCancelled) return;
      if (e instanceof PasskeyExists) return setRefusal('exists');
      if (isApiError(e) && e.authCode === 'SESSION_NOT_FRESH') return setRefusal('stale');
      if (isApiError(e) && e.authCode === 'EMAIL_UNVERIFIED') return setRefusal('unverified');
      if (isApiError(e) && e.code === 'reauth_required') {
        return setPasswordError(t`That password isn't right.`);
      }
      setFailure(e);
    },
  });
  const trimmed = name.trim();
  const nameError = trimmed.length > NAME_MAX ? t`Use ${NAME_MAX} characters or fewer.` : undefined;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed || nameError || add.isPending) return;
    if (hasPassword && !password) return setPasswordError(t`Enter your password.`);
    setRefusal(null);
    setFailure(null);
    setPasswordError(undefined);
    add.mutate();
  };
  return (
    <Modal isOpen onOpenChange={(open) => (open ? null : onClose())}>
      <Dialog title={t`Add a passkey`}>
        <form className="grid gap-4" noValidate onSubmit={submit}>
          <p className="m-0 text-ink-2">
            <Trans>
              Your browser asks for Face ID, a fingerprint or your screen lock. The passkey is kept
              by this device or your password manager; Kept never sees it.
            </Trans>
          </p>
          <TextField
            label={t`Name`}
            description={t`So you can tell your passkeys apart.`}
            value={name}
            onChange={setName}
            isInvalid={!!nameError}
            errorMessage={nameError}
            isDisabled={refusal === 'stale'}
          />
          {hasPassword && refusal !== 'stale' ? (
            <PasswordField
              label={t`Your password`}
              value={password}
              onChange={(v) => {
                setPassword(v);
                setPasswordError(undefined);
              }}
              isInvalid={!!passwordError}
              errorMessage={passwordError}
            />
          ) : null}
          {refusal === 'stale' ? (
            <Notice
              tone="warn"
              title={<Trans>Sign in again first</Trans>}
              action={
                <Button
                  size="small"
                  variant="secondary"
                  onPress={() => void signOut({ next: RETURN })}
                >
                  <Trans>Sign in again</Trans>
                </Button>
              }
            >
              <Trans>Adding a passkey needs a sign-in in the last ten minutes.</Trans>
            </Notice>
          ) : null}
          {refusal === 'unverified' ? (
            <Notice tone="warn" title={<Trans>Confirm your email address first</Trans>}>
              <Trans>
                Sign in once with a link sent to your email address, then add the passkey.
              </Trans>
            </Notice>
          ) : null}
          {refusal === 'exists' ? (
            <Notice tone="info">
              <Trans>This device already has a passkey for your account.</Trans>
            </Notice>
          ) : null}
          {failure ? <Notice tone="danger">{errorText(failure)}</Notice> : null}
          <DialogFooter>
            <Button variant="secondary" onPress={onClose}>
              <Trans>Cancel</Trans>
            </Button>
            <Button
              type="submit"
              isPending={add.isPending}
              isDisabled={!trimmed || !!nameError || refusal === 'stale'}
            >
              <Trans>Continue</Trans>
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </Modal>
  );
}

function RenamePasskeySheet({
  passkey,
  hasPassword,
  onClose,
}: {
  passkey: PasskeyView;
  hasPassword: boolean;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const refresh = useRefresh();
  const [name, setName] = useState(passkey.name ?? '');
  const trimmed = name.trim();
  const nameError = trimmed.length > NAME_MAX ? t`Use ${NAME_MAX} characters or fewer.` : undefined;
  return (
    <ReauthSheet
      title={t`Rename passkey`}
      submitLabel={<Trans>Rename</Trans>}
      returnTo={RETURN}
      hasPassword={hasPassword}
      isSubmitDisabled={!trimmed || !!nameError}
      onClose={onClose}
      onSubmit={async (password) => {
        await renamePasskey(passkey.id, trimmed, password);
        await refresh();
        toast({ title: t`Passkey renamed`, tone: 'ok' });
        onClose();
      }}
    >
      <TextField
        label={t`Name`}
        value={name}
        onChange={setName}
        isInvalid={!!nameError}
        errorMessage={nameError}
      />
    </ReauthSheet>
  );
}

function RemovePasskeySheet({
  passkey,
  hasPassword,
  onClose,
}: {
  passkey: PasskeyView;
  hasPassword: boolean;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const refresh = useRefresh();
  const name = passkey.name ?? t`Passkey`;
  return (
    <ReauthSheet
      title={
        <Trans>
          Remove <bdi>{name}</bdi>?
        </Trans>
      }
      submitLabel={<Trans>Remove</Trans>}
      submitVariant="danger"
      returnTo={RETURN}
      hasPassword={hasPassword}
      describeFailure={(e) =>
        isApiError(e) && e.code === 'two_factor_required'
          ? t`A location you belong to asks for two-factor. Turn on the authenticator app before removing your last passkey.`
          : null
      }
      onClose={onClose}
      onSubmit={async (password) => {
        await removePasskey(passkey.id, password);
        await refresh();
        toast({ title: t`Passkey removed`, tone: 'ok' });
        onClose();
      }}
    >
      <p className="m-0">
        <Trans>
          It stops signing you in, and every other device is signed out. The passkey itself stays on
          the device until you delete it there.
        </Trans>
      </p>
    </ReauthSheet>
  );
}

// ---- Authenticator app --------------------------------------------------------------------------

type AppSheet = 'codes' | 'again' | 'off' | null;

function AuthenticatorApp({ state }: { state: SignInState }) {
  const { t } = useLingui();
  const f = useFormat();
  const [sheet, setSheet] = useState<AppSheet>(null);
  const on = state.twoFactor.enabled;
  const left = state.twoFactor.backupCodesLeft ?? 0;
  const close = () => setSheet(null);
  return (
    <div className="grid gap-2">
      <h3 className="m-0 font-semibold text-[16px]">
        <Trans>Authenticator app</Trans>
      </h3>
      <List>
        <li>
          <Row
            leading={<IconTile>{on ? <ShieldCheckIcon /> : <ShieldIcon />}</IconTile>}
            title={<Trans>Two-factor with an authenticator app</Trans>}
            subtitle={
              on ? (
                <Trans>On. Signing in asks for a code from your authenticator app.</Trans>
              ) : (
                <Trans>
                  Off. Some locations ask for it; until you turn it on, or sign in with a passkey,
                  they stay hidden for you.
                </Trans>
              )
            }
            trailing={
              on ? (
                <Pill tone="ok">
                  <Trans>On</Trans>
                </Pill>
              ) : null
            }
          >
            {on ? (
              <div className="mt-1.5 grid gap-2">
                <div className={left <= 2 ? 'text-small text-warn' : 'text-small text-ink-2'}>
                  {t`${f.num(left)} of ${f.num(BACKUP_CODES)} backup codes left`}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="small" variant="secondary" onPress={() => setSheet('codes')}>
                    <Trans>New backup codes</Trans>
                  </Button>
                  <Button size="small" variant="secondary" onPress={() => setSheet('again')}>
                    <Trans>Set up again</Trans>
                  </Button>
                  <Button size="small" variant="secondary" onPress={() => setSheet('off')}>
                    <Trans>Turn off</Trans>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-1.5">
                <LinkButton to="/settings/two-factor" size="small" variant="primary">
                  <Trans>Turn on</Trans>
                </LinkButton>
              </div>
            )}
          </Row>
        </li>
      </List>
      {sheet === 'codes' ? <NewCodesSheet hasPassword={state.password} onClose={close} /> : null}
      {sheet === 'again' ? <SetUpAgainSheet hasPassword={state.password} onClose={close} /> : null}
      {sheet === 'off' ? <TurnOffSheet hasPassword={state.password} onClose={close} /> : null}
    </div>
  );
}

/** The codes, shown once, after New backup codes or Set up again. */
function CodesShown({
  title,
  codes,
  note,
  onClose,
}: {
  title: string;
  codes: string[];
  note?: string;
  onClose: () => void;
}) {
  return (
    <Modal isOpen isDismissable={false} onOpenChange={(open) => (open ? null : onClose())}>
      <Dialog title={title} showClose={false}>
        <div className="grid gap-4">
          {note ? <Notice tone="ok">{note}</Notice> : null}
          <BackupCodeList codes={codes} />
          <DialogFooter>
            <Button onPress={onClose}>
              <Trans>I've saved them</Trans>
            </Button>
          </DialogFooter>
        </div>
      </Dialog>
    </Modal>
  );
}

function NewCodesSheet({ hasPassword, onClose }: { hasPassword: boolean; onClose: () => void }) {
  const { t } = useLingui();
  const refresh = useRefresh();
  const [codes, setCodes] = useState<string[] | null>(null);
  if (codes) {
    return <CodesShown title={t`New backup codes`} codes={codes} onClose={onClose} />;
  }
  return (
    <ReauthSheet
      title={t`New backup codes`}
      submitLabel={<Trans>Make new codes</Trans>}
      returnTo={RETURN}
      hasPassword={hasPassword}
      onClose={onClose}
      onSubmit={async (password) => {
        const made = await newBackupCodes(password);
        await refresh();
        setCodes(made.backupCodes);
      }}
    >
      <p className="m-0">
        <Trans>
          Ten new codes, shown once. Your old backup codes stop working, and every other device is
          signed out.
        </Trans>
      </p>
    </ReauthSheet>
  );
}

function SetUpAgainSheet({ hasPassword, onClose }: { hasPassword: boolean; onClose: () => void }) {
  const { t } = useLingui();
  const refresh = useRefresh();
  const [uri, setUri] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  if (codes) {
    return (
      <CodesShown
        title={t`Set up again`}
        note={t`The new app is set up. Codes from the old one no longer work.`}
        codes={codes}
        onClose={onClose}
      />
    );
  }
  if (uri) {
    return (
      <Modal isOpen onOpenChange={(open) => (open ? null : onClose())}>
        <Dialog title={t`Set up again`}>
          <div className="grid gap-4">
            <p className="m-0 text-small text-ink-2">
              <Trans>
                Until you enter a code from the new app, your current app keeps working. Close this
                and nothing changes.
              </Trans>
            </p>
            <TotpScan
              uri={uri}
              verify={finishSetUpAgain}
              onDone={async (result) => {
                await refresh();
                setCodes((result as { backupCodes: string[] }).backupCodes);
              }}
              submitLabel={<Trans>Use the new app</Trans>}
            />
          </div>
        </Dialog>
      </Modal>
    );
  }
  return (
    <ReauthSheet
      title={t`Set up again`}
      submitLabel={<Trans>Continue</Trans>}
      returnTo={RETURN}
      hasPassword={hasPassword}
      onClose={onClose}
      onSubmit={async (password) => {
        const started = await startSetUpAgain(password);
        setUri(started.totpURI);
      }}
    >
      <p className="m-0">
        <Trans>
          For a new phone or another authenticator app. Your current app keeps working until the new
          one is set up; then it stops, your backup codes are replaced, and every other device is
          signed out.
        </Trans>
      </p>
    </ReauthSheet>
  );
}

function TurnOffSheet({ hasPassword, onClose }: { hasPassword: boolean; onClose: () => void }) {
  const { t } = useLingui();
  const refresh = useRefresh();
  return (
    <ReauthSheet
      title={t`Turn off two-factor?`}
      submitLabel={<Trans>Turn off</Trans>}
      submitVariant="danger"
      returnTo={RETURN}
      hasPassword={hasPassword}
      onClose={onClose}
      onSubmit={async (password) => {
        await disableTwoFactor(password);
        await refresh();
        toast({ title: t`Two-factor is off`, tone: 'ok' });
        onClose();
      }}
    >
      <p className="m-0">
        <Trans>
          Signing in stops asking for a code, your backup codes stop working, and every other device
          is signed out. Locations that ask for two-factor stay hidden until you sign in with a
          passkey or turn it on again.
        </Trans>
      </p>
    </ReauthSheet>
  );
}
