/**
 * The header's photo carousel ("the photo, swipe through photos").
 * One photo at a time with "1 / 4", Previous and Next buttons, arrow keys, and a swipe on touch.
 * In Arabic the buttons and the swipe mirror. Tapping the photo opens it full screen on the same
 * photo (./photo-viewer, #295). Without photos it shows the type's icon, and a writer gets
 * "Add photo". A HEIC photo has no preview yet (D36): it says so, never an error.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { lazy, Suspense, type TouchEvent, useRef, useState } from 'react';
import type { AttachmentView } from '@/api/inventory/types';
import { ChevronEndIcon, ChevronStartIcon } from '@/components/icons';
import { TypeIcon } from '@/components/type-icon';
import { useFormat } from '@/lib/format';
import { usePrefs } from '@/lib/prefs';
import { cn } from '@/lib/utils';
import { useThingCtx } from './context';
import { UploadButton } from './upload';

const PhotoViewer = lazy(() => import('./photo-viewer'));

/** The image the header and the full-screen view show: the display size, else the thumb. */
export const photoSrc = (photo: AttachmentView): string | null =>
  photo.file?.displayUrl ?? photo.file?.thumbUrl ?? null;

/**
 * Arrow keys and a swipe step through the photos; in Arabic both mirror. Keys held with Alt, Ctrl
 * or Meta are the browser's (Alt+Left is Back in some).
 */
export function useSteps(go: (delta: number) => void, rtl: boolean) {
  const touch = useRef<number | null>(null);
  return {
    onKey: (e: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey'>) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowLeft') go(rtl ? 1 : -1);
      if (e.key === 'ArrowRight') go(rtl ? -1 : 1);
    },
    onTouchStart: (e: TouchEvent) => {
      touch.current = e.touches[0]?.clientX ?? null;
    },
    onTouchEnd: (e: TouchEvent) => {
      const start = touch.current;
      const end = e.changedTouches[0]?.clientX;
      touch.current = null;
      if (start === null || end === undefined || Math.abs(end - start) < 40) return;
      const forward = end < start ? !rtl : rtl;
      go(forward ? 1 : -1);
    },
  };
}

export function PhotoCarousel({ className }: { className?: string }) {
  const { thing, can, refresh } = useThingCtx();
  const { t } = useLingui();
  const fmt = useFormat();
  const { locale } = usePrefs();
  const photos = thing.photos;
  const [index, setIndex] = useState(0);
  const [fullScreen, setFullScreen] = useState(false);
  const i = Math.min(index, Math.max(0, photos.length - 1));
  const go = (delta: number) =>
    setIndex((n) => Math.max(0, Math.min(photos.length - 1, n + delta)));
  const rtl = locale === 'ar';
  const steps = useSteps(go, rtl);

  return (
    <div className={cn('grid gap-2', className)}>
      <section
        aria-roledescription={t`carousel`}
        aria-label={t`Photos`}
        tabIndex={photos.length > 1 ? 0 : -1}
        onKeyDown={steps.onKey}
        onTouchStart={steps.onTouchStart}
        onTouchEnd={steps.onTouchEnd}
        className={cn(
          'relative grid place-items-center overflow-hidden rounded-[10px] bg-sunken outline-none focus-visible:outline-2 focus-visible:outline-info',
          photos.length ? 'aspect-[4/3] max-h-80 md:aspect-square md:max-h-none' : 'h-32 md:h-40',
        )}
      >
        {photos.length === 0 ? (
          <TypeIcon icon={thing.type?.icon} className="size-14 text-ink-3" />
        ) : (
          <Slide
            photo={photos[i] as AttachmentView}
            label={t`Photo ${fmt.num(i + 1)} of ${fmt.num(photos.length)}`}
            onOpen={() => setFullScreen(true)}
          />
        )}
        {photos.length > 1 ? (
          <>
            <span
              aria-hidden="true"
              className="absolute end-2 bottom-2 rounded-full bg-black/55 px-2 py-0.5 text-[12px] text-white tabular-nums"
            >
              {fmt.num(i + 1)} / {fmt.num(photos.length)}
            </span>
            <StepButtons index={i} count={photos.length} go={go} />
          </>
        ) : null}
      </section>
      {fullScreen && photos.length ? (
        <Suspense fallback={null}>
          <PhotoViewer
            photos={photos}
            index={i}
            go={go}
            rtl={rtl}
            onClose={() => setFullScreen(false)}
          />
        </Suspense>
      ) : null}
      {can('attachments.add') ? (
        <UploadButton
          locationId={thing.locationId}
          subject={{ thingId: thing.id }}
          attachAs="photo"
          accept={['image/*']}
          label={photos.length ? t`Add a photo` : t`Add the first photo`}
          onUploaded={() => void refresh()}
        />
      ) : null}
    </div>
  );
}

export function StepButtons({
  index,
  count,
  go,
}: {
  index: number;
  count: number;
  go: (delta: number) => void;
}) {
  const { t } = useLingui();
  return (
    <>
      <button
        type="button"
        aria-label={t`Previous photo`}
        disabled={index === 0}
        onClick={() => go(-1)}
        className="absolute start-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white outline-none disabled:opacity-0 focus-visible:outline-2 focus-visible:outline-info"
      >
        <ChevronStartIcon />
      </button>
      <button
        type="button"
        aria-label={t`Next photo`}
        disabled={index === count - 1}
        onClick={() => go(1)}
        className="absolute end-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white outline-none disabled:opacity-0 focus-visible:outline-2 focus-visible:outline-info"
      >
        <ChevronEndIcon />
      </button>
    </>
  );
}

function Slide({
  photo,
  label,
  onOpen,
}: {
  photo: AttachmentView;
  label: string;
  onOpen: () => void;
}) {
  const src = photoSrc(photo);
  if (!src) return <Unavailable />;
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={onOpen}
      className="size-full cursor-zoom-in outline-none focus-visible:outline-2 focus-visible:outline-info"
    >
      <img src={src} alt={label} className="size-full object-cover" />
    </button>
  );
}

export function Unavailable() {
  return (
    <div className="grid justify-items-center gap-1 px-4 text-center text-small text-ink-2">
      <span className="font-semibold text-ink">
        <Trans>Preview unavailable</Trans>
      </span>
      <span>
        <Trans>The original is kept. This format can't be previewed yet.</Trans>
      </span>
    </div>
  );
}
