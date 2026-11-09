/**
 * The live scanner (D101, D137; 7b): the back camera through
 * `camera/session.ts` (the same camera stack as capture), a viewfinder, and the decode loop
 * (`camera/scanner.ts`). Each distinct read is reported once; the same code again is ignored for
 * a moment, so holding a label in view doesn't repeat the answer. While `paused` (an answer is
 * showing) nothing is decoded, and the camera stays open.
 *
 * When the camera can't open, or the decoder can't run on this device, it says why and hands over
 * to "Type the code" (WCAG: an alternative to the camera). When the decoder gives up it lets go of
 * the camera, and where the trouble may pass (the decoder, a busy or failed camera) it offers
 * "Try again", which opens the camera and the decoder afresh (#486).
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'react';
import { Button } from 'react-aria-components';
import type { Detect, Detected } from '@/camera/label-recogniser';
import { buzz, startScanLoop } from '@/camera/scanner';
import { type CameraEnv, type CameraProblem, cameraEnv, openCamera } from '@/camera/session';
import type { Read } from './resolve';

type Cam =
  | { state: 'opening' }
  | { state: 'live'; stream: MediaStream }
  | { state: 'problem'; problem: CameraProblem | 'no_scanner' };

/** How long the same code is ignored after it was read. */
export const REPEAT_MS = 2500;

/** Problems that may pass on their own: these offer "Try again". */
const RETRYABLE: ReadonlySet<CameraProblem | 'no_scanner'> = new Set([
  'no_scanner',
  'busy',
  'failed',
]);

export function ScannerView({
  detect,
  paused,
  onRead,
  onProblem,
  onRetry,
  camera,
  now = () => Date.now(),
}: {
  detect: Detect | null;
  paused: boolean;
  onRead: (read: Read) => void;
  /** The camera or the decoder can't be used: the screen leads with "Type the code". */
  onProblem?: (problem: CameraProblem | 'no_scanner') => void;
  /** "Try again" was pressed: the camera and the decoder are starting afresh. */
  onRetry?: () => void;
  camera?: CameraEnv;
  now?: () => number;
}) {
  const { t } = useLingui();
  const video = useRef<HTMLVideoElement>(null);
  const [cam, setCam] = useState<Cam>({ state: 'opening' });
  const [attempt, setAttempt] = useState(0);
  const stopRef = useRef<(() => void) | null>(null);
  const problemRef = useRef(onProblem);
  problemRef.current = onProblem;
  const retryRef = useRef(onRetry);
  retryRef.current = onRetry;
  const readRef = useRef(onRead);
  readRef.current = onRead;
  const last = useRef<{ text: string; at: number } | null>(null);

  // `attempt` is "Try again": the camera is opened afresh.
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt reopens the camera on purpose
  useEffect(() => {
    let live = true;
    void openCamera(camera ?? cameraEnv()).then((r) => {
      if (!live) {
        if (r.ok) r.stop();
        return;
      }
      if (r.ok) {
        stopRef.current = r.stop;
        setCam({ state: 'live', stream: r.stream });
      } else {
        setCam({ state: 'problem', problem: r.problem });
        problemRef.current?.(r.problem);
      }
    });
    return () => {
      live = false;
      stopRef.current?.();
      stopRef.current = null;
    };
  }, [camera, attempt]);

  useEffect(() => {
    const v = video.current;
    if (!v || cam.state !== 'live') return;
    v.srcObject = cam.stream;
    void v.play?.()?.catch(() => {});
  }, [cam]);

  useEffect(() => {
    const v = video.current;
    if (!v || cam.state !== 'live' || paused) return;
    // Nothing can be read: the camera is let go, not held behind the message.
    const noScanner = (cause?: unknown) => {
      if (cause !== undefined) console.warn('The code reader did not start.', cause);
      stopRef.current?.();
      stopRef.current = null;
      setCam({ state: 'problem', problem: 'no_scanner' });
      problemRef.current?.('no_scanner');
    };
    if (!detect) {
      noScanner();
      return;
    }
    return startScanLoop(
      v,
      detect,
      (found: Detected[]) => {
        const [first] = found;
        if (!first) return;
        const at = now();
        const prev = last.current;
        if (prev && prev.text === first.rawValue && at - prev.at < REPEAT_MS) return;
        last.current = { text: first.rawValue, at };
        buzz();
        readRef.current({
          text: first.rawValue,
          format: first.format,
          ...(first.sure !== undefined ? { sure: first.sure } : {}),
        });
      },
      { onUnavailable: (e) => noScanner(e?.cause ?? e) },
    );
  }, [cam, detect, paused, now]);

  if (cam.state === 'problem') {
    const p = cam.problem;
    const reason =
      p === 'no_scanner'
        ? t`The scanner didn't start.`
        : p === 'demo'
          ? t`The camera is off in this demo.`
          : p === 'insecure'
            ? t`The camera needs a secure (HTTPS) address, and this page doesn't have one. Your admin can put Kept on HTTPS.`
            : p === 'denied'
              ? t`Camera access is off for Kept.`
              : p === 'no_camera'
                ? t`This device has no camera Kept can use.`
                : p === 'busy'
                  ? t`Another app is using the camera. Close it, then come back.`
                  : t`This browser can't open the camera here.`;
    return (
      <div className="grid h-full content-center gap-2 p-4 text-[#F2EFE9]" role="status">
        <p className="m-0 font-semibold text-[17px]">
          <Trans>Kept can't scan here</Trans>
        </p>
        <p className="m-0 text-[#BDB7AC] text-[14px]">{reason}</p>
        {RETRYABLE.has(p) ? (
          <Button
            onPress={() => {
              setCam({ state: 'opening' });
              setAttempt((n) => n + 1);
              retryRef.current?.();
            }}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center justify-self-start rounded-[10px] border border-[#4A463F] px-3.5 font-semibold text-[14px] outline-none data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-[#F2EFE9]"
          >
            <Trans>Try again</Trans>
          </Button>
        ) : null}
        <p className="m-0 text-[#BDB7AC] text-[14px]">
          <Trans>Type the code printed under the QR code instead.</Trans>
        </p>
      </div>
    );
  }

  return (
    <>
      <video
        ref={video}
        playsInline
        muted
        autoPlay
        aria-label={t`Camera view`}
        className="absolute inset-0 size-full object-cover"
      />
      <Viewfinder />
    </>
  );
}

/** The four corners the label goes between. */
function Viewfinder() {
  const corner = 'absolute size-9 border-[#F2EFE9]';
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute start-1/2 top-1/2 size-[min(62vw,240px)] -translate-x-1/2 -translate-y-1/2 rtl:translate-x-1/2"
    >
      <i className={`${corner} start-0 top-0 rounded-ss-xl border-s-[3px] border-t-[3px]`} />
      <i className={`${corner} end-0 top-0 rounded-se-xl border-e-[3px] border-t-[3px]`} />
      <i className={`${corner} start-0 bottom-0 rounded-es-xl border-s-[3px] border-b-[3px]`} />
      <i className={`${corner} end-0 bottom-0 rounded-ee-xl border-e-[3px] border-b-[3px]`} />
    </div>
  );
}
