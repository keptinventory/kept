/**
 * "Show me" beside a panel's heading: starts that chapter of the tour right there (Help lists them
 * all); at the chapter's end Continue goes on into the next. Only a scan session's Start a session
 * has one (1.14.3: the page headers' Show me went, the top bar keeps to the page's own tools; Help
 * is where the tour starts). Quiet on purpose, a small text button with the help icon; it isn't
 * there for a chapter the person doesn't have, and stands down while the tour runs.
 */
import type { TourId } from '@kept/shared';
import { Trans } from '@lingui/react/macro';
import { lazy, Suspense, useRef } from 'react';
import { useLocations } from '@/api/queries';
import { QuestionIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { tourRequests, useRunningTour, useTourAsked } from './tour-request';
import { availableTours } from './tours';

export function ShowMe({ tour: id }: { tour: TourId }) {
  const locations = useLocations();
  const running = useRunningTour();
  const ref = useRef<HTMLButtonElement>(null);
  if (!availableTours(locations.data ?? []).some((x) => x.tour.id === id)) return null;
  return (
    <Button
      ref={ref}
      size="small"
      variant="ghost"
      data-show-me={id}
      isDisabled={running !== null}
      onPress={() => tourRequests.request({ id, returnFocus: ref.current })}
    >
      <QuestionIcon className="size-4" />
      <Trans>Show me</Trans>
    </Button>
  );
}

const LazyTourHost = lazy(() => import('./tour').then((m) => ({ default: m.TourHost })));

/** The app shell's one tour host, loaded the first time a tour is asked for. */
export function TourHostMount() {
  const asked = useTourAsked();
  if (!asked) return null;
  return (
    <Suspense fallback={null}>
      <LazyTourHost />
    </Suspense>
  );
}
