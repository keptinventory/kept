/**
 * Re-authentication before a sensitive action (D176; step-8 T22): the recovery kit's download,
 * deleting the account (D225), and every change in Settings → Sign-in and security.
 * The password again, or, for an account without one (passkey or magic link only) whose sign-in
 * is over ten minutes old, "Sign in again". The server says which (403 `reauth_required` with
 * `details.reauth`: `password` or `sign_in`); a wrong password keeps the sheet open with the
 * message. The password lives in this component's state only, and is cleared after each try.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { type FormEvent, type ReactNode, useState } from 'react';
import { isApiError } from '@/api/client';
import { Notice, useErrorText } from '@/components/page';
import { useSignOut } from '@/components/sign-out';
import { Button, type ButtonVariant } from '@/components/ui/button';
import { Dialog, DialogFooter, Modal } from '@/components/ui/dialog';
import { PasswordField } from '@/components/ui/password-field';

type Refusal = 'missing' | 'wrong' | 'sign_in';

export type ReauthSheetProps = {
  title: ReactNode;
  /** What the action does and what it hands out; extra choices (a format) go here too. */
  children: ReactNode;
  submitLabel: ReactNode;
  /** `danger` for an action that destroys something (deleting the account, D225). */
  submitVariant?: ButtonVariant;
  /** Runs with the typed password (undefined when the field is empty). Throws to refuse. */
  onSubmit: (password: string | undefined) => Promise<void>;
  onClose: () => void;
  /** The page the sign-in returns to after "Sign in again". */
  returnTo: string;
  /** Whether the account has a password, when the screen knows: true shows the field alone,
   * false none (a recent sign-in is what confirms). Unknown (undefined, the default): the field,
   * with a line saying an account without a password leaves it empty. */
  hasPassword?: boolean;
  /** Keeps the submit button off (a required field of the sheet's own is empty). */
  isSubmitDisabled?: boolean;
  /** The action's own words for a refusal, when the general ones don't fit; null: those. */
  describeFailure?: (err: unknown) => string | null;
};

export function ReauthSheet({
  title,
  children,
  submitLabel,
  submitVariant = 'primary',
  onSubmit,
  onClose,
  returnTo,
  hasPassword,
  isSubmitDisabled = false,
  describeFailure,
}: ReauthSheetProps) {
  const { t } = useLingui();
  const errorText = useErrorText();
  const signOut = useSignOut();
  const [password, setPassword] = useState('');
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setRefusal(null);
    setFailure(null);
    const typed = password === '' ? undefined : password;
    try {
      await onSubmit(typed);
    } catch (err) {
      if (isApiError(err) && err.code === 'reauth_required') {
        setRefusal(err.details.reauth === 'sign_in' ? 'sign_in' : typed ? 'wrong' : 'missing');
      } else {
        setFailure(err);
      }
    } finally {
      setPassword('');
      setPending(false);
    }
  };

  const passwordError =
    refusal === 'wrong'
      ? t`That password isn't right.`
      : refusal === 'missing'
        ? t`Enter your password.`
        : undefined;

  return (
    <Modal isOpen onOpenChange={(open) => (open ? null : onClose())}>
      <Dialog title={title}>
        <form className="grid gap-4" noValidate onSubmit={submit}>
          {children}
          {refusal === 'sign_in' ? (
            <Notice
              tone="warn"
              title={<Trans>Sign in again</Trans>}
              action={
                <Button
                  size="small"
                  variant="secondary"
                  onPress={() => void signOut({ next: returnTo })}
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
          ) : hasPassword === false ? null : (
            <PasswordField
              label={t`Your password`}
              description={
                hasPassword === undefined
                  ? t`No password on your account? Leave this empty: a sign-in in the last ten minutes is enough.`
                  : undefined
              }
              value={password}
              onChange={setPassword}
              isInvalid={!!passwordError}
              errorMessage={passwordError}
              autoFocus
            />
          )}
          {failure ? (
            <Notice tone="danger">{describeFailure?.(failure) ?? errorText(failure)}</Notice>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" onPress={onClose}>
              <Trans>Cancel</Trans>
            </Button>
            <Button
              type="submit"
              variant={submitVariant}
              isPending={pending}
              isDisabled={refusal === 'sign_in' || isSubmitDisabled}
            >
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </Modal>
  );
}
