/**
 * The scan session's camera (#168): the back camera through `camera/session.ts`, every code in
 * every frame through the decode loop (off the main thread where the browser can,
 * camera/worker-detect.ts), and a box drawn on each label as it is answered: green for a new
 * find, amber, grey. The torch where the phone has one (Android Chrome).
 *
 * Where there is no camera (a browser without one, the Try Kept demo) it says why; the demo
 * offers a recorded walk instead, which reads the sample household's labels one after another.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'react';
import { Button } from 'react-aria-components';
import type { Box, Detect, Detected } from '@/camera/label-recogniser';
import { type FrameDecoder, startScanLoop } from '@/camera/scanner';
import { type CameraEnv, type CameraProblem, cameraEnv, openCamera } from '@/camera/session';
import { workerDecoder } from '@/camera/worker-detect';
import { TRY } from '@/try/flag';
import type { Signal } from './feedback';

export type Flash = { id: number; box: Box; signal: Signal };

type Cam =
  | { state: 'opening' }
  | { state: 'live'; stream: MediaStream }
  | { state: 'problem'; problem: CameraProblem | 'no_scanner' };

type TorchTrack = {
  getCapabilities?: () => { torch?: boolean };
  applyConstraints: (c: { advanced: { torch: boolean }[] }) => Promise<void>;
};

const SIGNAL_CLASS: Record<Signal, string> = {
  ok: 'border-[#4ADE80] bg-[#4ADE80]/20',
  soft: 'border-[#F2EFE9]/60',
  amber: 'border-[#F5B83D] bg-[#F5B83D]/20',
  grey: 'border-[#9A948A] bg-[#9A948A]/20',
};

export function SessionCamera({
  detect,
  decoder,
  paused,
  onReads,
  onProblem,
  camera,
  flashes,
  demoCodes,
}: {
  detect: Detect | null;
  /** Off the main thread; by default the Worker where the browser has one. */
  decoder?: FrameDecoder | null;
  paused: boolean;
  onReads: (found: Detected[]) => void;
  onProblem?: (problem: CameraProblem | 'no_scanner') => void;
  camera?: CameraEnv;
  flashes: readonly Flash[];
  /** Try Kept: the labels its recorded walk reads. */
  demoCodes?: readonly string[];
}) {
  const { t } = useLingui();
  const video = useRef<HTMLVideoElement>(null);
  const [cam, setCam] = useState<Cam>({ state: 'opening' });
  const [torch, setTorch] = useState<{ on: boolean; track: TorchTrack } | null>(null);
  const readsRef = useRef(onReads);
  readsRef.current = onReads;
  const problemRef = useRef(onProblem);
  problemRef.current = onProblem;
  const [off] = useState<FrameDecoder | null>(() =>
    decoder === undefined ? workerDecoder() : decoder,
  );

  useEffect(() => {
    let live = true;
    let stop: (() => void) | null = null;
    void openCamera(camera ?? cameraEnv()).then((r) => {
      if (!live) {
        if (r.ok) r.stop();
        return;
      }
      if (r.ok) {
        stop = r.stop;
        setCam({ state: 'live', stream: r.stream });
        const track = r.stream.getVideoTracks?.()[0] as unknown as TorchTrack | undefined;
        if (track?.getCapabilities?.().torch) setTorch({ on: false, track });
      } else {
        setCam({ state: 'problem', problem: r.problem });
        problemRef.current?.(r.problem);
      }
    });
    return () => {
      live = false;
      stop?.();
    };
  }, [camera]);

  useEffect(() => {
    const v = video.current;
    if (!v || cam.state !== 'live') return;
    v.srcObject = cam.stream;
    void v.play?.()?.catch(() => {});
  }, [cam]);

  useEffect(() => {
    const v = video.current;
    if (!v || cam.state !== 'live' || paused) return;
    if (!detect) {
      setCam({ state: 'problem', problem: 'no_scanner' });
      problemRef.current?.('no_scanner');
      return;
    }
    return startScanLoop(v, detect, (found) => readsRef.current(found), {
      decoder: off,
      onUnavailable: () => {
        setCam({ state: 'problem', problem: 'no_scanner' });
        problemRef.current?.('no_scanner');
      },
    });
  }, [cam, detect, paused, off]);

  if (cam.state === 'problem') {
    if (TRY && cam.problem === 'demo' && demoCodes) {
      return <DemoWalk codes={demoCodes} paused={paused} onReads={onReads} />;
    }
    return (
      <div className="grid h-full content-center gap-2 p-4 text-[#F2EFE9]" role="status">
        <p className="m-0 font-semibold text-[17px]">
          <Trans>The camera isn't available</Trans>
        </p>
        <p className="m-0 text-[#BDB7AC] text-[14px]">
          {cam.problem === 'demo'
            ? t`The camera is off in this demo.`
            : cam.problem === 'denied'
              ? t`Camera access is off for Kept.`
              : t`Type codes, or use a USB or Bluetooth barcode scanner.`}
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
      {/* The video's pixels don't turn around in Arabic: the boxes are laid out left to right. */}
      <div aria-hidden="true" dir="ltr" className="pointer-events-none absolute inset-0">
        {flashes.map((f) => (
          <i
            key={f.id}
            className={`absolute rounded-md border-[3px] ${SIGNAL_CLASS[f.signal]}`}
            style={{
              insetInlineStart: `${f.box.x * 100}%`,
              top: `${f.box.y * 100}%`,
              width: `${f.box.width * 100}%`,
              height: `${f.box.height * 100}%`,
            }}
          />
        ))}
      </div>
      {torch ? (
        <Button
          aria-pressed={torch.on}
          onPress={() => {
            const on = !torch.on;
            void torch.track
              .applyConstraints({ advanced: [{ torch: on }] })
              .then(() => setTorch({ ...torch, on }))
              .catch(() => {});
          }}
          className="absolute end-3 top-3 min-h-11 cursor-pointer rounded-full bg-[#0F0E0D]/80 px-3 font-medium text-[13px] outline-none data-focus-visible:outline-2 data-focus-visible:outline-[#F2EFE9]"
        >
          {torch.on ? <Trans>Torch off</Trans> : <Trans>Torch</Trans>}
        </Button>
      ) : null}
    </>
  );
}

/** Try Kept's recorded walk: the sample household's labels, two or three at a time. */
function DemoWalk({
  codes,
  paused,
  onReads,
}: {
  codes: readonly string[];
  paused: boolean;
  onReads: (found: Detected[]) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const at = useRef(0);
  const readsRef = useRef(onReads);
  readsRef.current = onReads;
  useEffect(() => {
    if (!playing || paused) return;
    const timer = setInterval(() => {
      const next = codes.slice(at.current, at.current + 2);
      at.current += next.length;
      if (next.length === 0) {
        setPlaying(false);
        return;
      }
      readsRef.current(next.map((c) => ({ rawValue: c, format: 'qr_code' })));
    }, 900);
    return () => clearInterval(timer);
  }, [playing, paused, codes]);
  return (
    <div className="grid h-full content-center justify-items-center gap-3 p-4 text-center text-[#F2EFE9]">
      <p className="m-0 text-[#BDB7AC] text-[14px]">
        <Trans>The camera is off in this demo. Play a recorded walk past the sample labels.</Trans>
      </p>
      <Button
        onPress={() => setPlaying((p) => !p)}
        className="min-h-11 cursor-pointer rounded-[10px] border border-[#4A463F] px-4 font-semibold text-[14px] outline-none data-focus-visible:outline-2 data-focus-visible:outline-[#F2EFE9]"
      >
        {playing ? <Trans>Stop the walk</Trans> : <Trans>Play a sample walk</Trans>}
      </Button>
    </div>
  );
}
