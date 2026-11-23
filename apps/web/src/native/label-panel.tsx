import { newId } from '@kept/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { appDetect } from '@/camera/scanner';
import { useErrorText } from '@/components/page';
import type { Read } from '@/components/scan/resolve';
import { ScannerView } from '@/components/scan/scanner-view';
import { Button } from '@/components/ui/button';
import { QrCode } from '@/components/ui/qr-code';
import { TextField } from '@/components/ui/text-field';
import { isolate } from '@/lib/bidi';
import { usePlatform } from './adapters';
import type { Connection, FindTagEvent, TagReading } from './bridge';
import type { InventoryCache } from './inventory';
import {
  describeTargetFromCache,
  inspectTagOwner,
  isTarget,
  labelUrl,
  type ReadResult,
  resolveLabel,
  type ScanCandidate,
  type Target,
} from './labels';

export type LabelBox = {
  id: string;
  name: string;
  locationId: string;
  shortCode: string | null;
};

export const FIND_TARGET_KEY = 'findTarget';

export function LabelPanel({
  connection,
  cache,
  action,
  box,
  canEnroll = false,
  onOpen,
  onClose,
  onClearFindTarget,
  onAuthError,
}: {
  connection: Connection;
  cache: InventoryCache | undefined;
  action: 'identify' | 'find' | 'enroll';
  box?: LabelBox;
  canEnroll?: boolean;
  onOpen: (target: Target) => void;
  onClose: () => void;
  onClearFindTarget?: () => void;
  onAuthError?: (reason: 'expired' | 'restored') => void;
}) {
  const { t } = useLingui();
  const adapters = usePlatform();
  const errorText = useErrorText();
  const [busy, setBusy] = useState(false);
  const [finding, setFinding] = useState(false);
  const [findPausedState, setFindPausedState] = useState<'timeout' | 'interrupted' | null>(null);
  const [camera, setCamera] = useState(false);
  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState('');
  const [candidates, setCandidates] = useState<ScanCandidate[]>([]);
  const [inspection, setInspection] = useState<TagReading>();
  const [existingOwner, setExistingOwner] = useState<string | null>(null);
  const [unverifiedWrite, setUnverifiedWrite] = useState(false);
  const [matched, setMatched] = useState(false);
  const inFlight = useRef(false);
  const alreadyAlerted = useRef(false);
  const live = useRef(true);
  const findSessionId = useRef<string | null>(null);
  const findGeneration = useRef(0);
  const invalidateFindSession = useCallback(() => {
    findGeneration.current += 1;
    findSessionId.current = null;
  }, []);
  const isCurrentFindSession = useCallback(
    (sessionId: string) => live.current && findSessionId.current === sessionId,
    [],
  );
  const url = box?.shortCode ? labelUrl(connection.origin, box.shortCode) : null;
  const messages = {
    scan: t`Hold the top of your iPhone near one NFC tag.`,
    multiple: t`Move other tags away and scan one tag.`,
    written: t`Kept tag verified.`,
    matched: box ? t`Found ${isolate(box.name)}.` : t`Found box.`,
    retry: t`Hold steady against the tag and try again.`,
  };

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      const sessionId = findSessionId.current ?? undefined;
      invalidateFindSession();
      void adapters.nfc.cancelTag(sessionId).catch(() => {});
    };
  }, [adapters, invalidateFindSession]);

  // Backgrounding ends the native reader; drop the React generation so a late
  // resolution or native event from that run cannot act on a later session.
  useEffect(() => {
    let remove: (() => Promise<void> | void) | undefined;
    let cancelled = false;
    void adapters.lifecycle
      .onAppStateChange(({ active }) => {
        if (active || !findSessionId.current) return;
        const sessionId = findSessionId.current;
        invalidateFindSession();
        setFinding(false);
        setFindPausedState('interrupted');
        void adapters.nfc.cancelTag(sessionId).catch(() => {});
      })
      .then((fn) => {
        if (cancelled) void fn();
        else remove = fn;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      void remove?.();
    };
  }, [adapters, invalidateFindSession]);

  // Persist the active Find target across restarts so timeouts/relaunch keep the selected target.
  useEffect(() => {
    if (action !== 'find' || !box) return;
    void adapters.outbox
      .setValue(
        connection,
        FIND_TARGET_KEY,
        JSON.stringify({
          id: box.id,
          name: box.name,
          locationId: box.locationId,
          shortCode: box.shortCode,
        }),
      )
      .catch(() => {});
  }, [action, adapters, box, connection]);

  const nfcStatus = useCallback(
    (result: Pick<TagReading, 'status'>) => {
      switch (result.status) {
        case 'unavailable':
          return t`NFC is unavailable on this device.`;
        case 'busy':
          return t`Finish the current NFC scan and try again.`;
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
    },
    [t],
  );

  const nonMatchText = useCallback(
    (result: ReadResult): { text: string; verifyDifferent: boolean } => {
      switch (result.status) {
        case 'resolved': {
          const other = describeTargetFromCache(cache, result.target);
          return {
            text: other
              ? t`That is ${isolate(other)}, not this box. Scan another tag.`
              : t`This is a different label. Scan another tag.`,
            verifyDifferent: true,
          };
        }
        case 'ambiguous':
          return {
            text: t`That code matches more than one item, so Kept cannot confirm whether it is this box. Scan another tag.`,
            verifyDifferent: false,
          };
        case 'foreign':
          return { text: t`This tag belongs to a different Kept server.`, verifyDifferent: false };
        case 'malformed':
          return { text: t`This tag does not contain a Kept label URL.`, verifyDifferent: false };
        case 'unassigned':
          return { text: t`This label has not been assigned.`, verifyDifferent: true };
        case 'not_kept':
          return { text: t`Not a Kept label.`, verifyDifferent: false };
        case 'unresolved':
          return {
            text: t`This label could not be checked offline, so it is not confirmed as a different box.`,
            verifyDifferent: false,
          };
        default:
          return { text: t`This label is unavailable in your Kept.`, verifyDifferent: false };
      }
    },
    [cache, t],
  );

  async function run(operation: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setStatus('');
    setCandidates([]);
    setMatched(false);
    try {
      await operation();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthError?.('expired');
        return;
      }
      if (live.current) setStatus(errorText(error));
    } finally {
      inFlight.current = false;
      if (live.current) setBusy(false);
    }
  }

  const handleFindResult = useCallback(
    async (result: ReadResult, continuousNfc: boolean, sessionId?: string) => {
      if (!live.current) return;
      if (continuousNfc && (!sessionId || !isCurrentFindSession(sessionId))) return;
      if (box && isTarget(result, box.id)) {
        setMatched(true);
        setFindPausedState(null);
        const announcement = t`Found ${isolate(box.name)}.`;
        setStatus(announcement);
        if (!alreadyAlerted.current) {
          alreadyAlerted.current = true;
          void adapters.feedback.match(connection, announcement).catch(() => {});
        }
        if (continuousNfc && sessionId) {
          if (!isCurrentFindSession(sessionId)) return;
          await adapters.nfc.finishFind(connection, sessionId, announcement).catch(() => {});
        }
        return;
      }
      // Unknown, inaccessible and ambiguous results are never target matches and
      // must not be presented as a definitively different box.
      const { text, verifyDifferent } = nonMatchText(result);
      if (continuousNfc && sessionId && !isCurrentFindSession(sessionId)) return;
      setStatus(text);
      if (verifyDifferent || (result.status !== 'unresolved' && result.status !== 'ambiguous')) {
        void adapters.feedback.nonMatch(connection, text).catch(() => {});
      }
      if (continuousNfc && sessionId) {
        if (!isCurrentFindSession(sessionId)) return;
        await adapters.nfc.continueFind(connection, sessionId, text).catch(() => {});
      }
    },
    [adapters, box, connection, isCurrentFindSession, nonMatchText, t],
  );

  async function read(text: string, mode: 'qr' | 'nfc', format?: string) {
    const result = await resolveLabel(connection, cache, text, mode, format, false, adapters);
    if (!live.current) return;
    if (action === 'find') {
      await handleFindResult(result, false);
      return;
    }
    if (result.status === 'resolved') {
      onOpen(result.target);
      return;
    }
    if (result.status === 'ambiguous') {
      setCandidates(result.candidates);
      setStatus(t`Multiple records match this code. Choose one to open.`);
      return;
    }
    if (result.status === 'foreign') setStatus(t`This tag belongs to a different Kept server.`);
    else if (result.status === 'malformed')
      setStatus(t`This tag does not contain a Kept label URL.`);
    else if (result.status === 'unassigned') setStatus(t`This label has not been assigned.`);
    else if (result.status === 'not_kept') setStatus(t`Not a Kept label.`);
    else if (result.status === 'unresolved') setStatus(t`This label could not be checked offline.`);
    else setStatus(t`This label is unavailable in your Kept.`);
  }

  function scanIdentify() {
    return run(async () => {
      const result = await adapters.nfc.scanTag(connection, { mode: 'read', messages });
      if (!live.current) return;
      if (result.status === 'read' && result.url) await read(result.url, 'nfc');
      else setStatus(nfcStatus(result));
    });
  }

  function startContinuousFind() {
    return run(async () => {
      alreadyAlerted.current = false;
      setFindPausedState(null);
      // Mint a fresh scan-session identity for this run and invalidate any prior one.
      invalidateFindSession();
      const sessionId = newId();
      findSessionId.current = sessionId;
      const generation = findGeneration.current;
      const isCurrent = () =>
        live.current &&
        findSessionId.current === sessionId &&
        findGeneration.current === generation;
      const remove = await adapters.nfc.onFindReading((event: FindTagEvent) => {
        if (!isCurrent()) return;
        if (event.sessionId && event.sessionId !== sessionId) return;
        if (event.status === 'repeated') {
          setStatus(t`Same tag scanned again. Move to another box.`);
          return;
        }
        if (
          event.status === 'blank' ||
          event.status === 'malformed' ||
          event.status === 'unsupported'
        ) {
          const message = nfcStatus(event);
          setStatus(message);
          void adapters.feedback.nonMatch(connection, message).catch(() => {});
          void adapters.nfc.continueFind(connection, sessionId, message).catch(() => {});
          return;
        }
        if (event.status === 'read' && event.url) {
          void resolveLabel(connection, cache, event.url, 'nfc', undefined, false, adapters)
            .then((resolved) => {
              // The server may answer after this session ends or another starts:
              // only the still-current session may act on the result.
              if (isCurrent()) return handleFindResult(resolved, true, sessionId);
            })
            .catch((error: unknown) => {
              if (!isCurrent()) return;
              if (error instanceof ApiError && error.status === 401) {
                onAuthError?.('expired');
                void adapters.nfc.cancelTag(sessionId).catch(() => {});
                return;
              }
              const message = errorText(error);
              setStatus(message);
              void adapters.nfc.continueFind(connection, sessionId, message).catch(() => {});
            });
        }
      });

      try {
        if (!isCurrent()) return;
        setFinding(true);
        const terminal = await adapters.nfc.startFind(connection, { sessionId, messages });
        if (!live.current) return;
        if (terminal.sessionId && terminal.sessionId !== sessionId) return;
        if (findSessionId.current !== sessionId) return;
        // This session has terminated natively; invalidate before surfacing state
        // so no in-flight resolution from it can act afterwards.
        invalidateFindSession();
        if (terminal.status === 'matched') {
          setMatched(true);
        } else if (terminal.status === 'timeout' || terminal.status === 'interrupted') {
          setFindPausedState(terminal.status);
          setStatus(
            terminal.status === 'timeout'
              ? t`The scan timed out. Tap Continue scanning to keep looking for this box.`
              : t`The NFC scan was interrupted. Tap Continue scanning to keep looking.`,
          );
        } else {
          setStatus(nfcStatus(terminal));
        }
      } finally {
        if (findSessionId.current === sessionId) invalidateFindSession();
        if (live.current) setFinding(false);
        await remove();
      }
    });
  }

  async function checkAssignment() {
    if (!box || !url) return false;
    const result = await resolveLabel(connection, cache, url, 'nfc', undefined, true, adapters);
    if (isTarget(result, box.id)) return true;
    setStatus(t`The server could not confirm this box’s label. Reopen the box and try again.`);
    return false;
  }

  function inspect() {
    return run(async () => {
      setInspection(undefined);
      setExistingOwner(null);
      if (!url || !(await checkAssignment())) return;
      const result = await adapters.nfc.scanTag(connection, { mode: 'inspect', url, messages });
      if (!live.current) return;
      if (result.status !== 'inspected') {
        setStatus(nfcStatus(result));
      } else if (result.url === url) {
        setUnverifiedWrite(false);
        setStatus(t`This tag already contains the verified Kept label.`);
      } else if (!result.writable) {
        setStatus(nfcStatus({ status: 'read_only' }));
      } else if ((result.required ?? 1) > (result.capacity ?? 0)) {
        setStatus(nfcStatus({ status: 'too_small' }));
      } else {
        setUnverifiedWrite(false);
        setInspection(result);
        if (result.url) {
          const owner = await inspectTagOwner(connection, cache, result.url, adapters);
          if (live.current && owner) setExistingOwner(owner);
        }
      }
    });
  }

  function write() {
    return run(async () => {
      if (!url || !inspection?.fingerprint || !(await checkAssignment())) return;
      const result = await adapters.nfc.scanTag(connection, {
        mode: 'write',
        url,
        fingerprint: inspection.fingerprint,
        messages,
      });
      if (!live.current) return;
      setInspection(undefined);
      setExistingOwner(null);
      if (result.status === 'written') {
        setUnverifiedWrite(false);
        setStatus(t`Kept tag verified.`);
      } else {
        if (result.status === 'write_unverified') setUnverifiedWrite(true);
        setStatus(nfcStatus(result));
      }
    });
  }

  function openMatchedBox() {
    if (!box) return;
    void adapters.outbox.deleteValue(connection, FIND_TARGET_KEY).catch(() => {});
    onClearFindTarget?.();
    onOpen({ id: box.id, kind: 'thing', locationId: box.locationId });
  }

  function clearTarget() {
    void adapters.outbox.deleteValue(connection, FIND_TARGET_KEY).catch(() => {});
    onClearFindTarget?.();
    onClose();
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button className="justify-self-start" variant="ghost" onPress={onClose}>
          <Trans>Back</Trans>
        </Button>
        {action === 'find' && box && (
          <Button variant="ghost" size="small" onPress={clearTarget}>
            <Trans>Clear target</Trans>
          </Button>
        )}
      </div>
      <h2 className="text-title font-semibold">{heading}</h2>
      {box && (
        <div className="grid gap-1 rounded-lg border border-line bg-surface p-3">
          <p className="font-semibold">
            <bdi>{box.name}</bdi>
          </p>
          {box.shortCode && (
            <p className="text-small text-ink-2">
              <Trans>Label code:</Trans> <bdi className="ltr">{box.shortCode}</bdi>
            </p>
          )}
        </div>
      )}
      {action === 'enroll' ? (
        <>
          {url && <QrCode value={url} label={t`Kept QR label`} />}
          {canEnroll && url?.startsWith('https://') && (
            <div className="flex flex-wrap gap-2">
              <Button isPending={busy} onPress={() => void inspect()}>
                {unverifiedWrite ? <Trans>Verify tag now</Trans> : <Trans>Inspect NFC tag</Trans>}
              </Button>
            </div>
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
              {existingOwner && (
                <p className="font-semibold">{t`Currently linked to: ${isolate(existingOwner)}`}</p>
              )}
              {inspection.url && (
                <p className="break-all text-small text-ink-2">
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
          <div className="flex flex-wrap gap-2">
            {action === 'find' ? (
              <Button isPending={busy} onPress={() => void startContinuousFind()}>
                {finding ? (
                  <Trans>Scanning…</Trans>
                ) : findPausedState ? (
                  <Trans>Continue scanning</Trans>
                ) : (
                  <Trans>Scan NFC tag</Trans>
                )}
              </Button>
            ) : (
              <Button isPending={busy} onPress={() => void scanIdentify()}>
                <Trans>Scan NFC tag</Trans>
              </Button>
            )}
            {finding && (
              <Button
                variant="secondary"
                onPress={() => {
                  const sessionId = findSessionId.current ?? undefined;
                  invalidateFindSession();
                  void adapters.nfc.cancelTag(sessionId).catch(() => {});
                }}
              >
                <Trans>Stop scanning</Trans>
              </Button>
            )}
          </div>
          {matched && box && (
            <div className="kept-match-card grid gap-3" role="status">
              <p className="text-title font-semibold text-ok">{t`Found ${isolate(box.name)}.`}</p>
              <div className="flex flex-wrap gap-2">
                <Button onPress={openMatchedBox}>
                  <Trans>Open box</Trans>
                </Button>
              </div>
            </div>
          )}
          {camera ? (
            <div className="relative min-h-52 overflow-hidden rounded-lg bg-charcoal">
              <ScannerView detect={appDetect()} paused={busy} onRead={openCamera} />
              <div className="relative z-10 p-2">
                <Button variant="secondary" onPress={() => setCamera(false)}>
                  <Trans>Close camera</Trans>
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" isDisabled={busy} onPress={() => setCamera(true)}>
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
      {candidates.length > 0 && (
        <ul className="grid gap-2">
          {candidates.map((candidate) => (
            <li key={`${candidate.kind}:${candidate.id}`}>
              <Button
                variant="secondary"
                className="kept-phone-row"
                onPress={() =>
                  onOpen({
                    id: candidate.id,
                    kind: candidate.kind,
                    locationId: candidate.locationId,
                  })
                }
              >
                <bdi>{candidate.name || t`Untitled`}</bdi>
                <bdi className="text-small font-normal text-ink-2">{candidate.locationName}</bdi>
              </Button>
            </li>
          ))}
        </ul>
      )}
      {!matched && status && (
        <p role="status" className="text-ink-2">
          {status}
        </p>
      )}
    </section>
  );
}
