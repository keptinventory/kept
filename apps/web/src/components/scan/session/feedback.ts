/**
 * How a scan session answers each read without being looked at (#168): a short tone, different
 * for a new find, a repeat, amber (elsewhere) and grey (view only, unknown); a buzz on phones
 * that can (Android Chrome; iPhones have no vibration on the web, so the tone and the coloured
 * flash carry it there); the counter read aloud at most every 2 seconds; the screen kept awake.
 */
import { useEffect } from 'react';
import type { ReadKind } from './model';

export type Signal = 'ok' | 'soft' | 'amber' | 'grey';

export function signalOf(kind: ReadKind): Signal | null {
  switch (kind) {
    case 'found':
      return 'ok';
    case 'already':
    case 'target':
      return 'soft';
    case 'elsewhere':
    case 'other_location':
    case 'place':
      return 'amber';
    case 'view_only':
    case 'unmatched':
    case 'not_in_your_kept':
    case 'check_later':
    case 'full':
      return 'grey';
    case 'ignored':
      return null;
  }
}

const TONES: Record<Signal, { hz: number; ms: number; gain: number }> = {
  ok: { hz: 1320, ms: 90, gain: 0.25 },
  soft: { hz: 880, ms: 40, gain: 0.08 },
  amber: { hz: 660, ms: 140, gain: 0.2 },
  grey: { hz: 330, ms: 160, gain: 0.15 },
};
const BUZZ: Record<Signal, number | number[]> = { ok: 30, soft: 0, amber: [30, 60, 30], grey: 80 };

type Devices = { audio: AudioContext | null; vibrate: ((p: number | number[]) => void) | null };

let shared: AudioContext | null | undefined;
/** The page's audio, started on the first tap (browsers allow sound only after one). */
export function pageAudio(): AudioContext | null {
  if (shared !== undefined) return shared;
  const Ctor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
  try {
    shared = Ctor ? new Ctor() : null;
  } catch {
    shared = null;
  }
  return shared;
}

export function pageDevices(): Devices {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  return {
    audio: pageAudio(),
    vibrate: nav && typeof nav.vibrate === 'function' ? (p) => nav.vibrate(p) : null,
  };
}

/** One read's tone and buzz. A nicety: nothing here ever throws. */
export function feel(signal: Signal, { audio, vibrate }: Devices = pageDevices()): void {
  try {
    if (audio) {
      const tone = TONES[signal];
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = tone.hz;
      gain.gain.setValueAtTime(tone.gain, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + tone.ms / 1000);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + tone.ms / 1000);
    }
    const buzz = BUZZ[signal];
    if (vibrate && buzz !== 0) vibrate(buzz);
  } catch {
    // A nicety only.
  }
}

/** Says `text` now, then at most once per `ms`: the last text asked for is said at the end.
 * `cancel()` drops what is waiting, for when the screen closes. */
export function announceEvery(
  ms: number,
  say: (text: string) => void,
): ((text: string) => void) & { cancel: () => void } {
  let last = Number.NEGATIVE_INFINITY;
  let waiting: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const announce = (text: string) => {
    const now = Date.now();
    if (now - last >= ms && !timer) {
      last = now;
      say(text);
      return;
    }
    waiting = text;
    timer ??= setTimeout(
      () => {
        timer = null;
        last = Date.now();
        if (waiting !== null) say(waiting);
        waiting = null;
      },
      Math.max(0, ms - (now - last)),
    );
  };
  return Object.assign(announce, {
    cancel: () => {
      if (timer) clearTimeout(timer);
      timer = null;
      waiting = null;
    },
  });
}

type WakeLockSentinelLike = { release: () => Promise<void> };
type WakeLockLike = { request: (type: 'screen') => Promise<WakeLockSentinelLike> };

/**
 * The screen stays on while `active` (Screen Wake Lock, where the browser has it; the installed
 * iPhone app may not). Asked again when the page comes back into view.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    const lock = (navigator as { wakeLock?: WakeLockLike }).wakeLock;
    if (!active || !lock) return;
    let held: WakeLockSentinelLike | null = null;
    let live = true;
    const take = () => {
      if (document.visibilityState !== 'visible') return;
      void lock
        .request('screen')
        .then((s) => {
          if (live) held = s;
          else void s.release();
        })
        .catch(() => {});
    };
    take();
    document.addEventListener('visibilitychange', take);
    return () => {
      live = false;
      document.removeEventListener('visibilitychange', take);
      void held?.release().catch(() => {});
    };
  }, [active]);
}
