/**
 * How Help and a scan session's Show me ask for a tour, without loading the engine: a request goes in
 * this small store, and the one tour host the app shell mounts on the first request
 * (tour.ts `TourHost`, loaded on demand) runs it. The host reports which tour is on screen here,
 * so a button can stand down while one runs.
 */
import type { TourId } from '@kept/shared';
import { useSyncExternalStore } from 'react';
import type { TourContext } from './tour-subjects';

export type TourRequest = {
  id: TourId;
  returnFocus?: HTMLElement | null;
  context?: TourContext;
};

let pending: TourRequest | null = null;
let asked = false;
let running: TourId | null = null;
const listeners = new Set<() => void>();
const emit = () => {
  for (const fn of listeners) fn();
};
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export const tourRequests = {
  subscribe,
  /** Ask for a tour: the host starts it, replacing one already running. */
  request(req: TourRequest): void {
    pending = req;
    asked = true;
    emit();
  },
  /** The host takes the request it is about to run. */
  take(): TourRequest | null {
    const req = pending;
    pending = null;
    return req;
  },
  /** Whether any tour was asked for yet: the shell mounts the host from then on. */
  asked: () => asked,
  running: () => running,
  setRunning(id: TourId | null): void {
    if (running === id) return;
    running = id;
    emit();
  },
  /** Tests: back to a fresh app. */
  reset(): void {
    pending = null;
    asked = false;
    running = null;
    emit();
  },
};

/** The tour on screen now, or null. */
export function useRunningTour(): TourId | null {
  return useSyncExternalStore(subscribe, tourRequests.running, tourRequests.running);
}

/** Whether the shell should have the tour host mounted. */
export function useTourAsked(): boolean {
  return useSyncExternalStore(subscribe, tourRequests.asked, tourRequests.asked);
}

/** A version that changes with every request, for the host to react to. */
export function usePendingTour(): TourRequest | null {
  return useSyncExternalStore(
    subscribe,
    () => pending,
    () => pending,
  );
}
