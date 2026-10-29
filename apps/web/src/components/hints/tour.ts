/**
 * The tour engine for Help's tour (tours.ts): one tour in chapters, started from Help (Take the
 * tour, Continue the tour, a chapter's row) or a scan session's Show me, never on launch. One run
 * at a time, whichever button started it.
 *
 * - A run starts at a chapter and walks on through the chapters after it that the person has.
 *   A chapter's last step names the next ("Next: Graph & 3D map"): Continue goes straight into
 *   its first step, Stop here ends the run. The last chapter ends with Done.
 * - The popover counts both: "Chapter 3 of 12 · step 2 of 5". Back stays inside the chapter.
 * - Each step names the route it opens and the `data-tour="<anchor>"` it points at, per layout
 *   where they differ. The first anchor on screen wins; a step whose anchor never shows (a
 *   module that is off, an empty page) is passed over, and drops out of the count.
 * - A step that needs a subject (a thing, a move, …) finds it first (tour-subjects.ts); a sample
 *   it had to make is in the ledger, offered for Keep or Discard at the end (tour-keep.tsx).
 * - **Never in the way:** taps outside the highlighted element reach the page (driver-kit.ts).
 *   Going somewhere the tour didn't take you ends it, where you are.
 * - **Done:** going past a chapter's last step (Continue, Stop here, Done), or closing there,
 *   records `help.tours.<chapter>` on the server (@kept/shared `tourKey`), so Help shows it as
 *   Done on every device and Continue the tour picks up at the first chapter not done. A chapter
 *   doesn't resume part-way: it starts from its top.
 * - Samples are offered for Keep or Discard once, when the run ends, whatever chapters it crossed.
 * - While it runs no hint shows.
 */

import { type TourId, tourKey } from '@kept/shared';
import { useLingui } from '@lingui/react/macro';
import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { createElement, useCallback, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { captureApi } from '@/api/capture/queries';
import { inventoryApi } from '@/api/inventory/queries';
import { deleteLocation, listLocations } from '@/api/locations';
import { movingApi } from '@/api/moving/queries';
import { keys } from '@/api/queries';
import type { LocationDetail } from '@/api/types';
import { SHEET, WIDE } from '@/lib/media';
import type { Shown } from './driver-kit';
import { useTourCopy, useTourStepCopy, useTourTitles } from './hint-copy';
import { pageIsRtl, prefersReducedMotion } from './placement';
import { tourFooterButton } from './tour-button';
import { TourKeepHost } from './tour-keep';
import { type TourDeleter, tourLedger } from './tour-ledger';
import { tourRequests, usePendingTour, useRunningTour } from './tour-request';
import { resolveSubject, type TourContext } from './tour-subjects';
import {
  type AvailableTour,
  availableTours,
  stopFor,
  type TourLayout,
  type TourStep,
  type TourStop,
  type TourSubject,
} from './tours';
import { hintSlot, useMarkHint } from './use-hint';

/** The layout on screen now (jsdom has no matchMedia: the phone's). */
export function currentLayout(): TourLayout {
  try {
    if (window.matchMedia(SHEET).matches) return 'sheet';
    return window.matchMedia(WIDE).matches ? 'wide' : 'phone';
  } catch {
    return 'phone';
  }
}

// ----- the navigate-then-highlight engine -----

/** How long a section waits for its anchor before passing over it. */
export const GUIDED_ANCHOR_WAIT_MS = 3000;

/** A section's target: the first `[data-tour]` match, in `anchors` order, that has a box. */
export function findSectionAnchor(
  anchors: string | readonly string[],
  root: ParentNode = document,
): Element | null {
  const list = typeof anchors === 'string' ? [anchors] : anchors;
  // A document without layout (jsdom) has no boxes at all: take the first match.
  const layout = document.body.getClientRects().length > 0;
  for (const anchor of list) {
    const all = [...root.querySelectorAll(`[data-tour="${CSS.escape(anchor)}"]`)];
    const shown = layout ? all.find(hasBox) : all[0];
    if (shown) return shown;
  }
  return null;
}

/** Laid out with an area: an empty wrapper (0 px tall) is nothing to point at. */
function hasBox(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return el.getClientRects().length > 0 && r.width > 0 && r.height > 0;
}

/**
 * The anchor once the route renders it: a MutationObserver plus an animation-frame poll,
 * bounded by `timeout`, never a fixed sleep.
 */
export function waitForSectionAnchor(
  anchors: string | readonly string[],
  timeout = GUIDED_ANCHOR_WAIT_MS,
): Promise<Element | null> {
  const hit = () => findSectionAnchor(anchors);
  const now = hit();
  if (now) return Promise.resolve(now);
  return new Promise((resolve) => {
    let done = false;
    let timer: number | undefined;
    const finish = (el: Element | null) => {
      if (done) return;
      done = true;
      mo.disconnect();
      // The bound must not outlive the wait: a late timer reads `document` after the page is gone.
      window.clearTimeout(timer);
      resolve(el);
    };
    const mo = new MutationObserver(() => {
      const el = hit();
      if (el) finish(el);
    });
    mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    const tick = () => {
      if (done) return;
      const el = hit();
      if (el) finish(el);
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    timer = window.setTimeout(() => {
      if (!done) finish(hit());
    }, timeout);
  });
}

/** The pathname a stop navigates to, for telling the tour's own moves apart. */
function stopPath(stop: TourStop, params: Record<string, string> | undefined): string | null {
  if (stop.to === null) return null;
  let path = stop.to;
  for (const [key, value] of Object.entries(params ?? {}))
    path = path.replace(`$${key}`, encodeURIComponent(value));
  return path;
}

/**
 * Whether two pathnames are the same page. The tour's own path is percent-escaped
 * (`encodeURIComponent`), the router's may not be (a location named in Arabic has an Arabic
 * slug), so both are compared decoded.
 */
function samePath(a: string, b: string): boolean {
  const decoded = (p: string) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  };
  return a === b || decoded(a) === decoded(b);
}

/**
 * Discard through the existing endpoints only: Trash-move for things and places, the location
 * delete, the capture batch undo (the batch's synced drafts go to the trash), and a sample move's
 * delete (it has no boxes; the row version is read first, as the delete asks for it).
 */
export const tourDeleter: TourDeleter = async (kind, id) => {
  switch (kind) {
    case 'thing':
      await inventoryApi.trashThing(id);
      return;
    case 'place':
      await inventoryApi.trashPlace(id, { contents: 'trash' });
      return;
    case 'location':
      await deleteLocation(id);
      return;
    case 'capture':
      await captureApi.undoBatch(id);
      return;
    case 'move': {
      const move = await movingApi.move(id);
      await movingApi.remove(id, move.rowVersion);
      return;
    }
  }
};

type Run = {
  alive: boolean;
  /** The chapter on screen. */
  tourId: TourId;
  /** Every chapter this person has, in order, and the index of the one on screen. */
  chapters: AvailableTour[];
  chapter: number;
  /** Bumps on every move: stale async continuations stand down. */
  seq: number;
  /** The steps of the chapter on screen. */
  steps: TourStep[];
  context: TourContext;
  /** Each subject once per run: a sample is made at most once. */
  subjects: Map<TourSubject, Promise<string | null>>;
  shownAny: boolean;
  /** A step of the chapter on screen has shown: going past its end counts it as done. */
  shownInChapter: boolean;
  /** The chapter's last step is on screen: closing it now counts as done. */
  atLast: boolean;
  /** Passed over in this chapter for a missing anchor or subject: Back and Next jump these; they
   * leave the count. */
  skipped: Set<number>;
  highlight: Shown | null;
  /** A programmatic destroy is coming: its onEnd is the engine's own echo, not the person. */
  muteOnEnd: boolean;
  dialog: { root: Root; el: HTMLDivElement } | null;
  dialogOpen: boolean;
  /** The route the tour itself put the person on; anything else ends the run. */
  expectPath: string | null;
  stopWatching: (() => void) | null;
  stopArrows: (() => void) | null;
  /** The step's Back watcher and the target watcher: dropped on every move. */
  stepObserver: MutationObserver | null;
  stepTimer: number | null;
  targetObserver: MutationObserver | null;
  returnFocus: HTMLElement | null;
};

// One run at a time, whichever Help row or Show me started it.
let current: Run | null = null;
/** Counts starts: of two asked for while the locations list loads, the later one runs. */
let starts = 0;

/** How long a start waits for a fresh locations list when it has a cached one to fall back on. */
export const FRESH_LIST_MS = 2_500;

/**
 * driver.js, once its chunk has loaded. Every later step uses it at once: a fresh `import()` of a
 * loaded chunk still settles on a later turn, which waited behind a busy page (the map starting
 * WebGL) for seconds after the step's anchor was there.
 */
let driverKit: typeof import('./driver-kit') | null = null;

/** Drop the per-step watchers: their popover and target are gone on every move. */
function clearStepWatchers(run: Run): void {
  run.stepObserver?.disconnect();
  run.stepObserver = null;
  if (run.stepTimer !== null) {
    window.clearTimeout(run.stepTimer);
    run.stepTimer = null;
  }
  run.targetObserver?.disconnect();
  run.targetObserver = null;
}

/** The nearest step before `i` that wasn't passed over. */
function backTo(run: Run, i: number): number {
  let j = i - 1;
  while (j > 0 && run.skipped.has(j)) j -= 1;
  return j;
}

/** Whether a step before `i` showed, or can: Back has somewhere to go. */
function hasBefore(run: Run, i: number): boolean {
  for (let k = 0; k < i; k++) if (!run.skipped.has(k)) return true;
  return false;
}

/** The nearest step after `i` that wasn't passed over. */
function forwardTo(run: Run, i: number): number {
  let j = i + 1;
  while (j < run.steps.length && run.skipped.has(j)) j += 1;
  return j;
}

/**
 * The step's Back button. driver.js only knows Next/Previous/Close, and a single-step highlight
 * shows only its done button and Close, so the engine adds Back beside it once there is a step
 * to go back to. It wears only the popover's generic footer-button class: the prev/next classes
 * would also match driver.js's own delegated click handler, hijacking the click.
 */
function injectBackButton(run: Run, seq: number, label: string, onBack: () => void): void {
  const fresh = () => run.alive && run.seq === seq;
  const place = () => {
    if (!fresh()) return true;
    const bar = document.querySelector('.driver-popover .driver-popover-navigation-btns');
    if (!bar) return false;
    if (bar.querySelector('[data-tour-btn="back"]')) return true;
    bar.prepend(tourFooterButton('back', label, onBack));
    return true;
  };
  if (place()) return;
  // The popover animates in: watch for it briefly, then give up (Next and Close still work).
  const mo = new MutationObserver(() => {
    if (!place()) return;
    mo.disconnect();
    if (run.stepObserver === mo) run.stepObserver = null;
    if (run.stepTimer !== null) {
      window.clearTimeout(run.stepTimer);
      run.stepTimer = null;
    }
  });
  run.stepObserver = mo;
  mo.observe(document.body, { childList: true, subtree: true });
  run.stepTimer = window.setTimeout(() => {
    run.stepTimer = null;
    mo.disconnect();
    if (run.stepObserver === mo) run.stepObserver = null;
  }, 1500);
}

/** How a tour starts: where focus goes back to, and what the page it was started on is about. */
export type TourStart = { returnFocus?: HTMLElement | null; context?: TourContext };

/** `start(id)` runs the tour from that chapter's first step, on through the chapters after it. */
export function useTour() {
  const copy = useTourStepCopy();
  const labels = useTourCopy().labels;
  const titles = useTourTitles();
  const mark = useMarkHint();
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useLingui();
  const running = useRunningTour();

  const destroyHighlight = (run: Run) => {
    clearStepWatchers(run);
    if (!run.highlight) return;
    run.muteOnEnd = true;
    try {
      run.highlight.destroy();
    } finally {
      run.muteOnEnd = false;
      run.highlight = null;
    }
  };

  const unmountKeepDialog = (run: Run) => {
    run.dialog?.root.unmount();
    run.dialog?.el.remove();
    run.dialog = null;
    run.dialogOpen = false;
  };

  /** Silent teardown: put everything back. */
  const abandon = (run: Run) => {
    run.alive = false;
    destroyHighlight(run);
    unmountKeepDialog(run);
    run.stopWatching?.();
    run.stopWatching = null;
    run.stopArrows?.();
    run.stopArrows = null;
    hintSlot.release('tour');
    tourLedger.clear();
    if (current === run) {
      current = null;
      tourRequests.setRunning(null);
    }
  };

  /** The run is over: put everything back, hand focus home. */
  const finalize = (run: Run) => {
    abandon(run);
    const back = run.returnFocus;
    if (back?.isConnected) back.focus();
  };

  /** Stopped, past the last chapter, closed early, or walked away: the chapter is done once it got
   * to its last step, then Keep/Discard when the run added something, otherwise straight to done. */
  const endTour = (run: Run) => {
    if (!run.alive) return;
    if (run.atLast) void mark(tourKey(run.tourId), { seen: true, dismissed: true });
    if (!run.shownAny && tourLedger.list().length === 0) {
      abandon(run);
      return;
    }
    run.alive = false;
    destroyHighlight(run);
    // INVARIANT: the dialog shows exactly this tick's list, and nothing mutates the ledger
    // between here and its Keep/Discard — display set and delete set cannot diverge.
    const ids = tourLedger.list();
    if (ids.length === 0) {
      finalize(run);
      return;
    }
    run.dialogOpen = true;
    const el = document.createElement('div');
    el.setAttribute('data-guided-keep-host', '');
    document.body.appendChild(el);
    const root = createRoot(el);
    run.dialog = { root, el };
    root.render(
      createElement(TourKeepHost, {
        ids,
        onDiscard: tourDeleter,
        onKeep: () => finalize(run),
      }),
    );
  };

  /** The step's `$id`, found once per run; null when there is nothing to open. */
  const subjectOf = (run: Run, kind: TourSubject, locations: readonly LocationDetail[]) => {
    let found = run.subjects.get(kind);
    if (!found) {
      found = resolveSubject(kind, {
        locations,
        context: run.context,
        names: { thing: t`Sample: Cordless drill`, move: t`Sample: Move` },
      }).catch(() => null);
      run.subjects.set(kind, found);
    }
    return found;
  };

  /** Chapter `k` is on screen from its first step. */
  const enterChapter = (run: Run, k: number) => {
    const next = run.chapters[k];
    if (!next) return;
    run.chapter = k;
    run.tourId = next.tour.id;
    run.steps = next.steps;
    run.skipped = new Set<number>();
    run.atLast = false;
    run.shownInChapter = false;
    tourRequests.setRunning(next.tour.id);
  };

  /** Past a chapter's last step: it's done, and the next one starts; after the last, the end. */
  const pastChapter = (run: Run, locations: readonly LocationDetail[]) => {
    if (run.shownInChapter) void mark(tourKey(run.tourId), { seen: true, dismissed: true });
    // Recorded here: the end of the run mustn't record it again.
    run.atLast = false;
    if (run.chapter + 1 >= run.chapters.length) {
      endTour(run);
      return Promise.resolve<'shown' | 'ended'>('ended');
    }
    enterChapter(run, run.chapter + 1);
    return step(run, locations, 0);
  };

  /**
   * Show step `i` of the chapter on screen: find its subject, navigate (unless `stay`), wait for
   * its anchor, highlight it. Past the chapter's end, the next chapter. `stay` re-points at the
   * same step after its target re-rendered.
   */
  const step = async (
    run: Run,
    locations: readonly LocationDetail[],
    i: number,
    stay = false,
  ): Promise<'shown' | 'ended'> => {
    const seq = ++run.seq;
    const live = () => run.alive && run.seq === seq;
    const skip = () => {
      run.skipped.add(i);
      return step(run, locations, i + 1);
    };
    if (!run.alive) return 'ended';
    if (i >= run.steps.length) return pastChapter(run, locations);
    // Known to have nothing to show: jump it without another navigate and anchor wait.
    if (run.skipped.has(i)) return step(run, locations, i + 1);
    const here = run.steps[i];
    // Unreachable (callers stay in range), but a skip beats a crash.
    if (!here) return step(run, locations, i + 1);
    const stop = stopFor(here, currentLayout());
    destroyHighlight(run);
    let params: Record<string, string> | undefined;
    if (here.needs && stop.to !== null) {
      const id = await subjectOf(run, here.needs, locations);
      if (!live()) return 'ended';
      if (!id) return skip();
      params = { id };
    }
    if (!stay) {
      const path = stopPath(stop, params);
      run.expectPath = path ?? router.state.location.pathname;
      if (path !== null) {
        try {
          await navigate({
            to: stop.to as never,
            params: params as never,
            ...(stop.search
              ? {
                  search: ((prev: Record<string, unknown>) =>
                    samePath(path, router.state.location.pathname)
                      ? { ...prev, ...stop.search }
                      : stop.search) as never,
                }
              : {}),
          });
        } catch {
          if (live()) return skip();
          return 'ended';
        }
      }
    }
    const el = await waitForSectionAnchor(stop.anchors, stop.wait);
    if (!live()) return 'ended';
    if (!el) return skip();
    const entry = copy[stop.copyId ?? `${run.tourId}.${here.id}`];
    if (!entry) return skip();
    run.shownAny = true;
    run.shownInChapter = true;
    // "n of m" counts the steps that can show: one passed over leaves the total, so the last
    // one reads "m of m".
    const before = [...run.skipped].filter((k) => k < i).length;
    const position = i + 1 - before;
    const total = run.steps.length - run.skipped.size;
    const isLast = forwardTo(run, i) >= run.steps.length;
    // At a chapter's last step, the chapter Continue opens; none after the last chapter.
    const upNext = isLast ? run.chapters[run.chapter + 1] : undefined;
    const chapterNo = run.chapter + 1;
    const chapters = run.chapters.length;
    driverKit ??= await import('./driver-kit');
    const kit = driverKit;
    if (!live()) return 'ended';
    destroyHighlight(run);
    run.atLast = isLast;
    run.highlight = kit.runTour({
      steps: [{ element: el, title: entry.title, description: entry.description }],
      rtl: pageIsRtl(),
      reducedMotion: prefersReducedMotion(),
      side: stop.side ?? 'bottom',
      dock: stop.dock ?? 'bottom',
      labels: {
        ...labels,
        // A single step always renders the done label: Next until the chapter's last step, then
        // Continue into the next chapter, or Done after the last one.
        done: isLast ? (upNext ? labels.continue : labels.done) : labels.next,
        // Progress counts the chapter's steps, not this one-element step list.
        progress: () => labels.chapterProgress(chapterNo, chapters, position, total),
      },
      ...(upNext
        ? {
            upNext: labels.upNext(titles[upNext.tour.id]),
            stop: {
              label: labels.stop,
              onPress: () => {
                if (run.alive && run.seq === seq) endTour(run);
              },
            },
          }
        : {}),
      returnFocus: run.returnFocus,
      onEnd: (completed) => {
        run.highlight = null;
        if (run.muteOnEnd || !run.alive) return;
        if (completed) void step(run, locations, forwardTo(run, i));
        else endTour(run);
      },
    });
    if (hasBefore(run, i))
      injectBackButton(run, seq, t`Back`, () => {
        if (run.alive) void step(run, locations, backTo(run, i));
      });
    watchArrows(run, locations, i);
    watchTarget(run, locations, seq, i, el);
    return 'shown';
  };

  /**
   * The highlighted control can be re-rendered under the tour (the location's switch moves when
   * Map is chosen): point at the new one rather than at nothing.
   */
  const watchTarget = (
    run: Run,
    locations: readonly LocationDetail[],
    seq: number,
    i: number,
    el: Element,
  ) => {
    const mo = new MutationObserver(() => {
      if (el.isConnected || !run.alive || run.seq !== seq) return;
      mo.disconnect();
      if (run.targetObserver === mo) run.targetObserver = null;
      void step(run, locations, i, true);
    });
    run.targetObserver = mo;
    mo.observe(document.body, { childList: true, subtree: true });
  };

  /** Arrows move between steps, by reading direction; Escape stays driver-kit's. */
  const watchArrows = (run: Run, locations: readonly LocationDetail[], i: number) => {
    run.stopArrows?.();
    const onKey = (e: KeyboardEvent) => {
      if (!run.alive || run.dialogOpen || !run.highlight) return;
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      // An arrow in a field moves the caret, not the tour.
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [contenteditable]'))
        return;
      const ahead = (e.key === 'ArrowRight') !== pageIsRtl();
      if (!ahead && !hasBefore(run, i)) return;
      e.preventDefault();
      if (ahead) void step(run, locations, forwardTo(run, i));
      else void step(run, locations, backTo(run, i));
    };
    window.addEventListener('keydown', onKey);
    run.stopArrows = () => window.removeEventListener('keydown', onKey);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: the run helpers close over this render by design; the tour outlives the page that started it.
  const start = useCallback(
    async (tourId: TourId, { returnFocus, context = {} }: TourStart = {}): Promise<boolean> => {
      if (current) abandon(current);
      const ticket = ++starts;
      // The chapters come from the server's list as it is now, the one Help shows once it has
      // loaded: a cached list can predate a module change (the phone's last-known copy, another
      // device), and its chapters would not be Help's (#314). A fetch on its way is shared.
      // Offline, when the server can't be reached, or when it hasn't answered within
      // FRESH_LIST_MS, the cached list (the fetch goes on and refreshes it); with none, what the
      // routes show, with nothing writable and no modules.
      const cached = qc.getQueryData<LocationDetail[]>(keys.locations);
      let known = cached ?? [];
      if (onlineManager.isOnline()) {
        const fresh = qc.fetchQuery({
          queryKey: keys.locations,
          queryFn: listLocations,
          staleTime: 0,
          ...(cached ? { retry: false } : {}),
        });
        let timer: ReturnType<typeof setTimeout> | undefined;
        const late = new Promise<LocationDetail[]>((resolve) => {
          if (cached) timer = setTimeout(() => resolve(cached), FRESH_LIST_MS);
        });
        try {
          known = await Promise.race([fresh, late]);
        } catch {
          // Keep `known`.
        } finally {
          clearTimeout(timer);
        }
        // A start asked for while this one waited takes over; nothing of this one was shown.
        if (ticket !== starts) return false;
        if (current) abandon(current);
      }
      const chapters = availableTours(known);
      const at = chapters.findIndex((x) => x.tour.id === tourId);
      const first = chapters[at];
      if (!first) return false;
      const run: Run = {
        alive: true,
        tourId,
        chapters,
        chapter: at,
        seq: 0,
        steps: first.steps,
        context,
        subjects: new Map(),
        shownAny: false,
        shownInChapter: false,
        atLast: false,
        skipped: new Set<number>(),
        highlight: null,
        muteOnEnd: false,
        dialog: null,
        dialogOpen: false,
        expectPath: router.state.location.pathname,
        stopWatching: null,
        stopArrows: null,
        stepObserver: null,
        stepTimer: null,
        targetObserver: null,
        returnFocus: returnFocus ?? null,
      };
      // The person's own moves end the run where it is: only the tour's navigations, recorded
      // in `expectPath` before each one, keep it going. A change of search (List to Map, a
      // thing's tab) stays on the page and keeps it.
      run.stopWatching = router.subscribe('onResolved', ({ toLocation }) => {
        if (!run.alive || run.dialogOpen) return;
        if (run.expectPath !== null && !samePath(toLocation.pathname, run.expectPath)) endTour(run);
      });
      hintSlot.take('tour');
      tourLedger.clear();
      current = run;
      tourRequests.setRunning(tourId);
      try {
        return (await step(run, known, 0)) === 'shown' || run.shownAny;
      } catch {
        abandon(run);
        return false;
      }
    },
    [copy, labels, titles, mark, navigate, router, qc, t],
  );
  return { start, running };
}

/**
 * The one tour host: the app shell mounts it (loaded on demand) once Help or a Show me asked for
 * a tour, and it runs each request (tour-request.ts).
 */
export function TourHost(): null {
  const { start } = useTour();
  const pending = usePendingTour();
  useEffect(() => {
    if (!pending) return;
    const req = tourRequests.take();
    if (req)
      void start(req.id, {
        returnFocus: req.returnFocus ?? null,
        ...(req.context ? { context: req.context } : {}),
      });
  }, [pending, start]);
  return null;
}
