import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'react';
import { appDetect } from '@/camera/scanner';
import { useErrorText } from '@/components/page';
import type { Read } from '@/components/scan/resolve';
import { ScannerView } from '@/components/scan/scanner-view';
import { Button } from '@/components/ui/button';
import { QrCode } from '@/components/ui/qr-code';
import { TextField } from '@/components/ui/text-field';
import { type Connection, native, type TagReading } from './bridge';
import type { InventoryCache } from './inventory';
import { isTarget, labelUrl, resolveLabel, type Target } from './labels';

export type LabelBox = { id: string; name: string; shortCode: string | null };

export function LabelPanel({
  connection,
  cache,
  action,
  box,
  canEnroll = false,
  onOpen,
  onClose,
}: {
  connection: Connection;
  cache: InventoryCache | undefined;
  action: 'identify' | 'find' | 'enroll';
  box?: LabelBox;
  canEnroll?: boolean;
  onOpen: (target: Target) => void;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const errorText = useErrorText();
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);
  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState('');
  const [inspection, setInspection] = useState<TagReading>();
  const [matched, setMatched] = useState(false);
  const inFlight = useRef(false);
  const alreadyAlerted = useRef(false);
  const live = useRef(true);
  const input = { context: connection.id };
  const url = box?.shortCode ? labelUrl(connection.origin, box.shortCode) : null;
  const messages = {
    scan: t`Hold the top of your iPhone near one NFC tag.`,
    multiple: t`Move other tags away and scan one tag.`,
    written: t`Kept tag verified.`,
  };

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      void native.cancelTag().catch(() => {});
    };
  }, []);

  async function run(operation: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setStatus('');
    setMatched(false);
    try {
      await operation();
    } catch (error) {
      if (live.current) setStatus(errorText(error));
    } finally {
      inFlight.current = false;
      if (live.current) setBusy(false);
    }
  }

  async function read(text: string, mode: 'qr' | 'nfc', format?: string) {
    const result = await resolveLabel(connection, cache, text, mode, format);
    if (!live.current) return;
    if (result.status === 'resolved') {
      if (action !== 'find') {
        onOpen(result.target);
        return;
      }
      if (box && isTarget(result, box.id)) {
        setMatched(true);
        const name = box.name;
        setStatus(t`Found ${name}.`);
        if (!alreadyAlerted.current) {
          alreadyAlerted.current = true;
          void native.matchFeedback(input).catch(() => {});
        }
      } else {
        setStatus(t`This is a different label. Scan another tag.`);
      }
      return;
    }
    if (result.status === 'foreign') setStatus(t`This tag belongs to a different Kept server.`);
    else if (result.status === 'malformed')
      setStatus(t`This tag does not contain a Kept label URL.`);
    else if (result.status === 'unassigned') setStatus(t`This label has not been assigned.`);
    else if (result.status === 'unresolved') setStatus(t`This label could not be checked offline.`);
    else setStatus(t`This label is unavailable in your Kept.`);
  }

  function nfcStatus(result: TagReading) {
    switch (result.status) {
      case 'unavailable':
        return t`NFC is unavailable on this device.`;
      case 'blank':
        return t`This NFC tag is blank.`;
      case 'malformed':
        return t`This tag does not contain a Kept label URL.`;
      case 'cancelled':
        return t`Scan cancelled.`;
      case 'timeout':
        return t`The scan timed out. Try again.`;
      case 'unsupported':
        return t`This tag does not support NDEF.`;
      case 'read_only':
        return t`This NFC tag is read-only. Try another tag.`;
      case 'too_small':
        return t`This NFC tag is too small for the label URL.`;
      case 'changed':
        return t`This tag has changed. Inspect it again before writing.`;
      case 'write_unverified':
        return t`Writing was interrupted. Inspect the tag again to verify what it holds.`;
      default:
        return t`The NFC scan was interrupted. Try again.`;
    }
  }

  function scan() {
    return run(async () => {
      const result = await native.scanTag({ ...input, mode: 'read', messages });
      if (!live.current) return;
      if (result.status === 'read' && result.url) await read(result.url, 'nfc');
      else setStatus(nfcStatus(result));
    });
  }

  async function checkAssignment() {
    if (!box || !url) return false;
    const result = await resolveLabel(connection, cache, url, 'nfc', undefined, true);
    if (isTarget(result, box.id)) return true;
    setStatus(t`The server could not confirm this box’s label. Reopen the box and try again.`);
    return false;
  }

  function inspect() {
    return run(async () => {
      setInspection(undefined);
      if (!url || !(await checkAssignment())) return;
      const result = await native.scanTag({ ...input, mode: 'inspect', url, messages });
      if (!live.current) return;
      if (result.status !== 'inspected') {
        setStatus(nfcStatus(result));
      } else if (result.url === url) {
        setStatus(t`This tag already contains the verified Kept label.`);
      } else if (!result.writable) {
        setStatus(nfcStatus({ status: 'read_only' }));
      } else if ((result.required ?? 1) > (result.capacity ?? 0)) {
        setStatus(nfcStatus({ status: 'too_small' }));
      } else {
        setInspection(result);
      }
    });
  }

  function write() {
    return run(async () => {
      if (!url || !inspection?.fingerprint || !(await checkAssignment())) return;
      const result = await native.scanTag({
        ...input,
        mode: 'write',
        url,
        fingerprint: inspection.fingerprint,
        messages,
      });
      if (!live.current) return;
      setInspection(undefined);
      setStatus(result.status === 'written' ? t`Kept tag verified.` : nfcStatus(result));
    });
  }

  const openCamera = (readout: Read) => {
    setCamera(false);
    void run(() => read(readout.text, 'qr', readout.format));
  };
  const heading =
    action === 'identify'
      ? t`Identify a label`
      : action === 'find'
        ? t`Find this box`
        : t`Write NFC tag`;

  return (
    <section className="grid gap-4">
      <Button className="justify-self-start" variant="ghost" onPress={onClose}>
        <Trans>Back</Trans>
      </Button>
      <h2 className="text-title font-semibold">{heading}</h2>
      {box && (
        <p className="font-semibold">
          <bdi>{box.name}</bdi>
        </p>
      )}
      {action === 'enroll' ? (
        <>
          {url && <QrCode value={url} label={t`Kept QR label`} />}
          {canEnroll && url?.startsWith('https://') && (
            <Button isPending={busy} onPress={() => void inspect()}>
              <Trans>Inspect NFC tag</Trans>
            </Button>
          )}
          {canEnroll && !url?.startsWith('https://') && (
            <p>
              <Trans>Connect to your Kept server over HTTPS to enroll NFC tags.</Trans>
            </p>
          )}
          {inspection && (
            <div className="grid gap-3 rounded-lg border border-line bg-surface p-4">
              {inspection.occupied ? (
                <p>
                  <Trans>
                    This tag already holds information. Writing will replace its contents.
                  </Trans>
                </p>
              ) : (
                <p>
                  <Trans>This tag is blank and ready to write.</Trans>
                </p>
              )}
              {inspection.url && (
                <p className="break-all">
                  <bdi>{inspection.url}</bdi>
                </p>
              )}
              <Button isPending={busy} onPress={() => void write()}>
                {inspection.occupied ? (
                  <Trans>Overwrite NFC tag</Trans>
                ) : (
                  <Trans>Write and verify</Trans>
                )}
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <p>
            <Trans>Hold the top of your iPhone close to one tag at a time.</Trans>
          </p>
          <Button isPending={busy} onPress={() => void scan()}>
            <Trans>Scan NFC tag</Trans>
          </Button>
          {action === 'identify' && (
            <>
              {camera ? (
                <div className="min-h-52 overflow-hidden rounded-lg bg-charcoal">
                  <ScannerView detect={appDetect()} paused={busy} onRead={openCamera} />
                  <Button variant="secondary" onPress={() => setCamera(false)}>
                    <Trans>Close camera</Trans>
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" onPress={() => setCamera(true)}>
                  <Trans>Scan QR code</Trans>
                </Button>
              )}
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (typed.trim()) void run(() => read(typed.trim(), 'qr'));
                }}
              >
                <TextField label={t`Type the code`} value={typed} onChange={setTyped} />
                <Button type="submit" variant="secondary" isDisabled={!typed.trim() || busy}>
                  <Trans>Open label</Trans>
                </Button>
              </form>
            </>
          )}
        </>
      )}
      <p
        role="status"
        className={
          matched
            ? 'rounded-lg border border-ok p-4 text-title font-semibold text-ok'
            : 'text-ink-2'
        }
      >
        {status}
      </p>
    </section>
  );
}
