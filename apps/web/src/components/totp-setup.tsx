/**
 * The authenticator app's two set-up pieces, shared by Turn on (/settings/two-factor) and Set up
 * again (Settings → Sign-in and security): the QR code with the key for typing in by hand and the
 * first code, and the backup codes shown once. The secret is drawn here from the otpauth URI and
 * never leaves this page.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { isApiError } from '@/api/client';
import { useErrorText } from '@/components/page';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { QrCode } from '@/components/ui/qr-code';
import { TextField } from '@/components/ui/text-field';
import { secretOf } from '@/lib/otp';

export function TotpScan({
  uri,
  verify,
  onDone,
  submitLabel,
}: {
  uri: string;
  /** Proves the first code; rejects with a 400 or 401 when it doesn't match. */
  verify: (code: string) => Promise<unknown>;
  onDone: (result: unknown) => void;
  submitLabel: ReactNode;
}) {
  const { t } = useLingui();
  const errorText = useErrorText();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const secret = secretOf(uri);
  const run = useMutation({
    mutationFn: () => verify(code),
    onSuccess: onDone,
    onError: (e) =>
      setError(
        isApiError(e) && (e.status === 400 || e.status === 401)
          ? t`That code didn't match. Check the time on your phone, then try the newest code.`
          : errorText(e),
      ),
  });
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!/^\d{6}$/.test(code.replace(/\s/g, ''))) return setError(t`Enter the 6 digits.`);
        run.mutate();
      }}
    >
      <p className="m-0 text-ink-2">
        <Trans>Scan this with your authenticator app, then type the code it shows.</Trans>
      </p>
      <div className="flex flex-wrap items-center gap-4 rounded-[10px] border border-line bg-surface p-3.5">
        <div className="rounded-lg border border-line bg-white p-1.5">
          <QrCode value={uri} label={t`QR code for your authenticator app`} size={168} />
        </div>
        <div className="grid min-w-0 flex-1 basis-44 gap-1.5">
          <div className="eyebrow">
            <Trans>Can't scan it?</Trans>
          </div>
          <div className="text-small text-ink-2">
            <Trans>Enter this key in the app instead:</Trans>
          </div>
          <div className="ltr font-mono text-[15px] font-semibold tracking-[.06em] [overflow-wrap:anywhere]">
            {secret}
          </div>
          <CopyButton text={secret.replace(/\s/g, '')} label={t`Copy key`} size="small" />
        </div>
      </div>
      <TextField
        label={t`6-digit code`}
        value={code}
        onChange={(v) => {
          setCode(v.replace(/[^\d\s]/g, ''));
          setError(undefined);
        }}
        isInvalid={!!error}
        errorMessage={error}
        inputProps={{
          inputMode: 'numeric',
          autoComplete: 'one-time-code',
          dir: 'ltr',
        }}
        maxLength={7}
      />
      <Button type="submit" isPending={run.isPending}>
        {submitLabel}
      </Button>
    </form>
  );
}

/** Backup codes, shown once: each signs in once when the phone is gone. */
export function BackupCodeList({ codes }: { codes: string[] }) {
  const { t } = useLingui();
  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <h2 className="m-0 font-semibold text-[18px]">
          <Trans>Keep your backup codes</Trans>
        </h2>
        <p className="m-0 text-ink-2">
          <Trans>
            If you lose your phone, each of these signs you in once. Keep them somewhere other than
            this phone: a password manager or a printed page.
          </Trans>
        </p>
      </div>
      <ul
        aria-label={t`Backup codes`}
        className="ltr m-0 grid list-none grid-cols-2 gap-2 rounded-[10px] border border-line bg-sunken p-3.5 font-mono text-[15px]"
      >
        {codes.map((c) => (
          <li key={c} className="[overflow-wrap:anywhere]">
            {c}
          </li>
        ))}
      </ul>
      <CopyButton text={codes.join('\n')} label={t`Copy all codes`} className="w-full" />
    </div>
  );
}
