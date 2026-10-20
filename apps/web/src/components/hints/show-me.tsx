/**
 * "Show me" in a page's header: starts that section's chapter of the tour right there (Help lists
 * them all); at the chapter's end Continue goes on into the next. Quiet on purpose, a small text
 * button with the help icon; it isn't there for a chapter the person doesn't have (a module
 * that's off, a viewer's write-only chapter), and stands down while the tour runs.
 */
import type { TourId } from '@kept/shared';
import { Trans } from '@lingui/react/macro';
import { lazy, Suspense, useRef } from 'react';
import { useLocations } from '@/api/queries';
import { QuestionIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { tourRequests, useRunningTour, useTourAsked } from './tour-request';
import type { TourContext } from './tour-subjects';
import { availableTours } from './tours';

/** What a page's Show me starts: the tour, and what the page is about. */
export type PageTour = TourId | { id: TourId; context?: TourContext };

export function ShowMe({ tour }: { tour: PageTour }) {
  const id = typeof tour === 'string' ? tour : tour.id;
  const context = typeof tour === 'string' ? undefined : tour.context;
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
      onPress={() =>
        tourRequests.request({ id, returnFocus: ref.current, ...(context ? { context } : {}) })
      }
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
