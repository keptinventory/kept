/**
 * A thing's photo full screen (#295), opened by tapping the header's photo. `React.lazy`
 * (./photos), so it loads only when someone opens it (D80); it's a precached chunk all the same,
 * so it opens offline, on the same image the header shows. Fitted to the screen, or its full size
 * to pan around, centred, after Zoom in or a double-click; zoomed in, the photo takes focus and the
 * arrow keys scroll it. A pinch on a phone is the browser's own zoom.
 * The header's moves step through the photos, and Escape or Back (CloseOnBack) close it.
 */
import { useLingui } from '@lingui/react/macro';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Button as ButtonPrimitive,
  Dialog as DialogPrimitive,
  ModalOverlay,
  Modal as ModalPrimitive,
} from 'react-aria-components';
import type { AttachmentView } from '@/api/inventory/types';
import { XIcon } from '@/components/icons';
import { CloseOnBack } from '@/components/ui/close-on-back';
import { useFormat } from '@/lib/format';
import { cn } from '@/lib/utils';
import { photoSrc, StepButtons, Unavailable, useSteps } from './photos';

export default function PhotoViewer({
  photos,
  index,
  go,
  rtl,
  onClose,
}: {
  photos: AttachmentView[];
  index: number;
  go: (delta: number) => void;
  rtl: boolean;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const fmt = useFormat();
  const [zoomed, setZoomed] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const step = (delta: number) => {
    setZoomed(false);
    go(delta);
  };
  const steps = useSteps(step, rtl);
  // Focus starts on the dialog itself, above any child's onKeyDown, so the keys are read here.
  // Zoomed in, the arrows are left to scroll the photo.
  const onKey = useRef(steps.onKey);
  onKey.current = zoomed ? () => {} : steps.onKey;
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey.current(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
  // Zooming in starts in the middle of the photo (scrollLeft runs negative in Arabic), with focus.
  useLayoutEffect(() => {
    const el = stage.current;
    if (!zoomed || !el) return;
    el.scrollLeft = ((rtl ? -1 : 1) * (el.scrollWidth - el.clientWidth)) / 2;
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
    el.focus({ preventScroll: true });
  }, [zoomed, rtl]);
  const src = photoSrc(photos[index] as AttachmentView);
  const label = t`Photo ${fmt.num(index + 1)} of ${fmt.num(photos.length)}`;
  const control =
    'grid size-11 cursor-pointer place-items-center rounded-full bg-black/45 text-white outline-none focus-visible:outline-2 focus-visible:outline-info data-focus-visible:outline-2 data-focus-visible:outline-info';

  return (
    <ModalOverlay
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      isDismissable
      className="fixed inset-0 z-50 bg-black"
    >
      <ModalPrimitive className="size-full text-white outline-none">
        <CloseOnBack />
        <DialogPrimitive
          aria-label={t`Photos`}
          className="relative size-full pt-[env(safe-area-inset-top)] outline-none"
        >
          {/* biome-ignore lint/a11y/noStaticElementInteractions: swipe and double-click are pointer enhancements; Previous, Next and Zoom in are the accessible path */}
          <div
            ref={stage}
            tabIndex={zoomed ? 0 : -1}
            onTouchStart={zoomed ? undefined : steps.onTouchStart}
            onTouchEnd={zoomed ? undefined : steps.onTouchEnd}
            onDoubleClick={() => setZoomed((z) => !z && !!src)}
            className={cn(
              'size-full outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-info',
              zoomed
                ? 'flex cursor-zoom-out overflow-auto'
                : 'grid place-items-center overflow-hidden',
              src && !zoomed && 'cursor-zoom-in',
            )}
          >
            {src ? (
              <img
                src={src}
                alt={label}
                className={zoomed ? 'm-auto max-w-none shrink-0' : 'size-full object-contain'}
              />
            ) : (
              <div className="rounded-xl bg-surface p-4">
                <Unavailable />
              </div>
            )}
          </div>
          <div className="absolute inset-x-0 top-[env(safe-area-inset-top)] flex items-center gap-2 p-2">
            {photos.length > 1 ? (
              <span
                aria-hidden="true"
                className="rounded-full bg-black/55 px-2 py-0.5 text-[12px] tabular-nums"
              >
                {fmt.num(index + 1)} / {fmt.num(photos.length)}
              </span>
            ) : null}
            <span className="flex-1" />
            {src ? (
              // "+" and "−", like the map's zoom.
              <button
                type="button"
                aria-label={zoomed ? t`Zoom out` : t`Zoom in`}
                onClick={() => setZoomed((z) => !z)}
                className={cn(control, 'text-title')}
              >
                <span aria-hidden="true">{zoomed ? '−' : '+'}</span>
              </button>
            ) : null}
            <ButtonPrimitive slot="close" aria-label={t`Close`} className={control}>
              <XIcon />
            </ButtonPrimitive>
          </div>
          {photos.length > 1 ? <StepButtons index={index} count={photos.length} go={step} /> : null}
        </DialogPrimitive>
      </ModalPrimitive>
    </ModalOverlay>
  );
}
