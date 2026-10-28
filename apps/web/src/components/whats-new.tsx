/**
 * What's new in Kept: after the app updates to a new version, that release's highlights as a short
 * showcase, once per version per person, and from Help any time.
 *
 * - **The release** is this build's: its version (KEPT_VERSION) and its Highlights from
 *   CHANGELOG.md, read at build time (`virtual:kept-whats-new`, whats-new-plugin.ts), so its words
 *   work offline. A version without Highlights, or a development build, has no card.
 * - **One highlight per slide:** a picture or a short clip, a bold title and one plain line. Next
 *   and Back, a dot per slide ("Slide 2 of 7"), the arrow keys and a swipe move between them in the
 *   reading direction (in Arabic the next slide comes from the left); the last slide's Got it puts
 *   it away. A sheet on a phone, a dialog from 768 px (places/sheet.tsx).
 * - **Media** are files beside the app (public/whats-new/<version>/, scripts/record-whats-new.mjs),
 *   requested only once the card opens and never precached. A clip plays muted, looped and inline
 *   while its slide is shown and the tab is visible, with Pause; with reduced motion it shows its
 *   still poster and starts only on Play. No media, a file that won't load, or no connection: the
 *   app's icon for that area, never an empty box.
 * - **Seen, per person:** the person's `whats_new.<version>` hint on the server (D138, the store
 *   the tour and the HTTP strip use), so a card dismissed on the phone doesn't come back on the
 *   laptop. The server takes only its own version's key (home/service.ts).
 * - **Never on a new account:** a person with no hint rows at all (no earlier version's card, no
 *   tour chapter, checklist or HTTP-strip record) gets this version recorded and nothing shown.
 *   Anyone with a row used Kept before, so they get this version's card once, including people
 *   from before What's new existed. Their hints are already in the cache: no extra request.
 * - **Never in the way:** not over Capture or Scan (it waits until the person leaves), not while
 *   the tour or a hint holds the screen (use-hint.ts's slot), and not until the hints are known.
 * - **Got it** (or Escape, or ×) records it. The highlights are English, as released; the card's
 *   own words are translated, and in another language it says the notes are in English.
 */

import release from 'virtual:kept-whats-new';
import { whatsNewKey } from '@kept/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import { useRouterState } from '@tanstack/react-router';
import {
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { hintSlot, useHints, useMarkHint } from '@/components/hints/use-hint';
import {
  ArchiveIcon,
  AssistantIcon,
  BoxIcon,
  CameraIcon,
  CarIcon,
  ChevronEndIcon,
  ChevronStartIcon,
  DocumentIcon,
  GearIcon,
  GraphIcon,
  HandoffIcon,
  HelpIcon,
  HomeIcon,
  InboxIcon,
  MapIcon,
  PauseIcon,
  PlayIcon,
  QrIcon,
  ScheduleIcon,
  SearchIcon,
  StarIcon,
  TagIcon,
  TruckIcon,
} from '@/components/icons';
import { Sheet } from '@/components/places/sheet';
import { Button } from '@/components/ui/button';
import { useFormat } from '@/lib/format';
import { useMediaQuery } from '@/lib/media';
import { useOnline } from '@/lib/online';
import { directionOf, usePrefs } from '@/lib/prefs';
import { cn } from '@/lib/utils';
import { isReleaseVersion, releaseNotesUrl, type Slide } from '@/whats-new/highlights';

/** This build's release, when it has a card to show. */
export const WHATS_NEW =
  isReleaseVersion(release.version) && release.slides.length > 0 ? release : null;

const SLOT = 'whats_new';
/** The version this build is (KEPT_VERSION). */
const version = release.version;

/** Capture and Scan (a scan session too) are full screens with a camera: no card over them. */
const busyRoute = (path: string) => /^\/(capture|scan)(?:[/-]|$)/.test(path);

// ----- open from anywhere (Help) --------------------------------------------------------------

let isOpen = false;
const listeners = new Set<() => void>();
const set = (v: boolean) => {
  if (isOpen === v) return;
  isOpen = v;
  for (const l of listeners) l();
};

export const whatsNew = {
  open: () => set(true),
  close: () => set(false),
  isOpen: () => isOpen,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** Tests: closed, as on a fresh start. */
  reset: () => set(false),
};

/**
 * In the app shell: records the version on a first run, opens the card once after an update,
 * and shows it whenever Help asks.
 */
export function WhatsNewHost() {
  const hints = useHints(false);
  const mark = useMarkHint();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const holder = useSyncExternalStore(hintSlot.subscribe, hintSlot.get, hintSlot.get);
  const open = useSyncExternalStore(whatsNew.subscribe, whatsNew.isOpen, whatsNew.isOpen);
  const list = hints.isSuccess ? hints.data.hints : null;

  useEffect(() => {
    if (!list || !isReleaseVersion(version)) return;
    const key = whatsNewKey(version);
    if (list.some((h) => h.key === key)) return;
    // Used Kept before: any hint row at all (an earlier version's card, a tour chapter, the
    // checklist, the HTTP strip…). A brand-new account has none when the app first reads them.
    const before = list.length > 0;
    // A first run, or a release with nothing to tell: record it, show nothing.
    if (!before || !WHATS_NEW) {
      void mark(key, { dismissed: true });
      return;
    }
    if (open || busyRoute(path) || holder !== null) return;
    if (!hintSlot.claim(SLOT)) return;
    whatsNew.open();
  }, [list, mark, open, path, holder]);

  // Closed: recorded (again, from Help: the server keeps it once), and the screen is free.
  const close = () => {
    whatsNew.close();
    hintSlot.release(SLOT);
    if (isReleaseVersion(version)) void mark(whatsNewKey(version), { dismissed: true });
  };

  if (!WHATS_NEW) return null;
  return <WhatsNewCard isOpen={open} onClose={close} />;
}

function WhatsNewCard({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useLingui();
  if (!WHATS_NEW) return null;
  const { version, slides } = WHATS_NEW;
  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={t`What's new in Kept`}
      wide
    >
      {/* Mounted while open only: each opening starts at the first slide, and no media is
          requested before it. */}
      {({ close }) => <Showcase version={version} slides={slides} onDone={close} />}
    </Sheet>
  );
}

/** How far a drag has to go to change slides (px); it must also be more across than up and down. */
const SWIPE = 40;

function Showcase({
  version,
  slides,
  onDone,
}: {
  version: string;
  slides: readonly Slide[];
  onDone: () => void;
}) {
  const { t, i18n } = useLingui();
  const { locale } = usePrefs();
  const f = useFormat();
  const rtl = directionOf(locale) === 'rtl';
  const still = useMediaQuery('(prefers-reduced-motion: reduce)');
  const online = useOnline();
  const [index, setIndex] = useState(0);
  // Paused by the person (Pause), or never started: with reduced motion, until they press Play.
  const [paused, setPaused] = useState(still);
  const [hidden, setHidden] = useState(() => document.visibilityState === 'hidden');
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ id: number; x: number; y: number } | null>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const last = index === slides.length - 1;
  const total = f.num(slides.length);

  // What a screen reader hears after each move (nothing on opening: the dialog says enough).
  const [said, setSaid] = useState('');
  const go = (to: number) => {
    const i = Math.max(0, Math.min(slides.length - 1, to));
    if (i === index) return;
    setIndex(i);
    const n = f.num(i + 1);
    const title = slides[i]?.title ?? '';
    setSaid(t`Slide ${n} of ${total}: ${title}`);
  };
  const next = () => go(index + 1);
  const back = () => {
    // Back goes away on the first slide: the focus moves on to Next, not to the page.
    if (index === 1) primary.current?.focus();
    go(index - 1);
  };

  useEffect(() => {
    if (still) setPaused(true);
  }, [still]);

  useEffect(() => {
    const sync = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  // Only the shown slide's clip plays, and only while the tab is visible and nobody paused it.
  useEffect(() => {
    videos.current.forEach((v, i) => {
      if (!v) return;
      if (i === index && !paused && !hidden) {
        // A browser that refuses to start it (no autoplay) leaves it on its poster, with Play.
        v.play()?.catch((e: unknown) => {
          if (e instanceof DOMException && e.name === 'NotAllowedError') setPaused(true);
        });
      } else v.pause();
    });
  }, [index, paused, hidden]);

  // The arrow keys, wherever the focus is in the card (it starts on the dialog itself, outside
  // this content): forward is towards the end of the line, the right arrow in English and the
  // left one in Arabic. The page behind is inert while the card is open.
  const keys = useRef({ next, back });
  keys.current = { next, back };
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      // An arrow typed into a field moves its caret, not the slides.
      const el = e.target as HTMLElement | null;
      if (
        el?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
      )
        return;
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      if ((e.key === 'ArrowRight') !== rtl) keys.current.next();
      else keys.current.back();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [rtl]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    start.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId || still) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) > Math.abs(e.clientY - s.y)) setDrag(dx);
  };
  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    start.current = null;
    setDrag(null);
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) < SWIPE || Math.abs(dx) <= Math.abs(e.clientY - s.y)) return;
    // Dragged towards the start of the line: the next slide comes in from its end.
    if (dx < 0 !== rtl) next();
    else back();
  };

  const offset = (rtl ? 1 : -1) * index * 100 || 0;
  const english = i18n.locale === 'en';

  return (
    <div className="-mt-2 grid min-w-0 gap-3">
      <p className="m-0 text-small text-ink-2">
        <Trans>
          Version <span className="ltr tabular-nums">{version}</span>
        </Trans>
      </p>
      <p className="sr-only" aria-live="polite">
        {said}
      </p>
      <section aria-label={t`Highlights`} className="grid min-w-0 gap-1">
        <div
          data-slides=""
          className="touch-pan-y overflow-hidden select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={() => {
            start.current = null;
            setDrag(null);
          }}
        >
          <div
            data-track=""
            className={cn(
              'flex',
              drag === null &&
                'transition-transform duration-300 ease-out motion-reduce:transition-none',
            )}
            style={{
              transform:
                drag === null
                  ? `translateX(${offset}%)`
                  : `translateX(calc(${offset}% + ${drag}px))`,
            }}
          >
            {slides.map((slide, i) => {
              const shown = i === index;
              const n = f.num(i + 1);
              return (
                // biome-ignore lint/a11y/useSemanticElements: a carousel's slide (the APG pattern), not a form's fieldset
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: a release's slides never move
                  key={i}
                  role="group"
                  aria-label={t`Slide ${n} of ${total}`}
                  aria-hidden={shown ? undefined : true}
                  inert={!shown}
                  className="grid w-full min-w-0 shrink-0 content-start gap-3"
                >
                  <SlideMedia
                    slide={slide}
                    online={online}
                    still={still}
                    shown={shown}
                    paused={paused}
                    onPause={setPaused}
                    videoRef={(el) => {
                      videos.current[i] = el;
                    }}
                  />
                  <div className="grid gap-1">
                    <h3
                      lang="en"
                      dir="ltr"
                      className="m-0 font-semibold text-[18px] leading-snug text-ink [overflow-wrap:anywhere]"
                    >
                      {slide.title}
                    </h3>
                    {slide.line ? (
                      <p
                        lang="en"
                        dir="ltr"
                        className="m-0 text-body text-ink-2 [overflow-wrap:anywhere]"
                      >
                        {slide.line}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {slides.length > 1 ? (
          <div className="flex flex-wrap justify-center">
            {slides.map((_, i) => {
              const n = f.num(i + 1);
              return (
                <button
                  // biome-ignore lint/suspicious/noArrayIndexKey: one dot per slide, in order
                  key={i}
                  type="button"
                  aria-label={t`Slide ${n} of ${total}`}
                  aria-current={i === index ? 'true' : undefined}
                  onClick={() => go(i)}
                  className="grid size-11 cursor-pointer place-items-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-info"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'block h-2 rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none',
                      i === index ? 'w-5 bg-ink' : 'w-2 bg-line',
                    )}
                  />
                </button>
              );
            })}
          </div>
        ) : null}
      </section>
      <div className="flex items-center justify-between gap-3">
        {index > 0 ? (
          <Button variant="secondary" className="min-h-11" onPress={back}>
            <ChevronStartIcon className="size-4" />
            <Trans>Back</Trans>
          </Button>
        ) : (
          <span />
        )}
        <Button ref={primary} className="min-h-11" onPress={last ? onDone : next}>
          {last ? (
            <Trans>Got it</Trans>
          ) : (
            <>
              <Trans>Next</Trans>
              <ChevronEndIcon className="size-4" />
            </>
          )}
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <a
          href={releaseNotesUrl(version)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center text-small text-ink underline underline-offset-2 outline-none hover:text-ink-2 focus-visible:outline-2 focus-visible:outline-info"
        >
          <Trans>Full release notes</Trans>
        </a>
        {english ? null : (
          <p className="m-0 text-small text-ink-2">
            <Trans>The release notes are in English.</Trans>
          </p>
        )}
      </div>
    </div>
  );
}

/** The app's icon for a highlight's area: the sidebar's, so the slide reads as that section. */
const AREA_ICONS: Record<string, (p: { className?: string }) => ReactNode> = {
  home: HomeIcon,
  places: BoxIcon,
  things: BoxIcon,
  map: MapIcon,
  graph: GraphIcon,
  labels: TagIcon,
  scan: QrIcon,
  capture: CameraIcon,
  inbox: InboxIcon,
  search: SearchIcon,
  import: ArchiveIcon,
  paperwork: DocumentIcon,
  vehicles: CarIcon,
  lending: HandoffIcon,
  schedules: ScheduleIcon,
  moving: TruckIcon,
  assistant: AssistantIcon,
  settings: GearIcon,
  help: HelpIcon,
};

/**
 * A slide's picture or clip in a 16:10 frame, sized before it loads; the area's icon when there is
 * none, it fails, or there's no connection and it never loaded.
 */
function SlideMedia({
  slide,
  online,
  still,
  shown,
  paused,
  onPause,
  videoRef,
}: {
  slide: Slide;
  online: boolean;
  still: boolean;
  shown: boolean;
  paused: boolean;
  onPause: (paused: boolean) => void;
  videoRef: (el: HTMLVideoElement | null) => void;
}) {
  const { t } = useLingui();
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const media = slide.media;
  const base = import.meta.env.BASE_URL;
  const Icon = (slide.icon && AREA_ICONS[slide.icon]) || StarIcon;
  const frame =
    'relative aspect-[16/10] w-full overflow-hidden rounded-[10px] border border-line bg-sunken';

  if (!media || failed || (!online && !loaded)) {
    return (
      <div
        data-media="fallback"
        aria-hidden="true"
        className={cn(frame, 'grid place-items-center')}
      >
        <span className="grid size-16 place-items-center rounded-2xl border border-line bg-surface text-ink-2">
          <Icon className="size-8" />
        </span>
      </div>
    );
  }
  return (
    <div className={frame}>
      {media.kind === 'video' ? (
        <>
          {/* The words say it: the clip is a picture of them, out of the accessibility tree. */}
          <div aria-hidden="true" className="size-full">
            <video
              ref={(el) => {
                // React sets `muted` as a property only; iOS plays a clip inline only when muted.
                if (el) el.muted = true;
                videoRef(el);
              }}
              poster={`${base}${media.poster}`}
              width={media.width}
              height={media.height}
              muted
              loop
              playsInline
              autoPlay={shown && !still && !paused}
              preload={shown ? 'auto' : 'metadata'}
              disablePictureInPicture
              onLoadedData={() => setLoaded(true)}
              className="block size-full object-cover"
            >
              {/* VP9 first (Chromium builds without H.264), then the MP4 every browser plays.
                  The last source failing means none could. */}
              {media.webm ? <source src={`${base}${media.webm}`} type="video/webm" /> : null}
              <source
                src={`${base}${media.src}`}
                type="video/mp4"
                onError={() => setFailed(true)}
              />
            </video>
          </div>
          <Button
            variant="secondary"
            size="icon"
            aria-label={paused ? t`Play` : t`Pause`}
            onPress={() => onPause(!paused)}
            className="absolute end-2 bottom-2 bg-surface/90"
          >
            {paused ? <PlayIcon /> : <PauseIcon />}
          </Button>
        </>
      ) : (
        <img
          src={`${base}${media.src}`}
          width={media.width}
          height={media.height}
          alt=""
          loading={shown ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className="block size-full object-cover"
        />
      )}
    </div>
  );
}
