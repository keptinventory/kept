/**
 * A rack on its page, and a piece of gear's position sheet (#373), loaded on demand: the chunk
 * (vite.config.ts ON_DEMAND_ENTRIES: ./rack.tsx) is out of the precache, fetched the first time a
 * rack's page or a piece of gear's position opens, then kept by the service worker. Offline before
 * that, the section isn't shown: the things in the rack are still listed below it.
 */
import { type ComponentType, lazy, Suspense } from 'react';
import type { GearSheetProps, RackSectionProps } from './rack';

const LazySection = lazy(() =>
  import('./rack').then((m) => ({ default: m.RackSection })).catch(() => ({ default: () => null })),
);

const LazySheet = lazy<ComponentType<GearSheetProps>>(() =>
  import('./rack').then((m) => ({ default: m.GearSheet })).catch(() => ({ default: () => null })),
);

/** A rack's elevation; nothing for any other place. */
export function RackSection(props: RackSectionProps) {
  if (!props.place.rack) return null;
  return (
    <Suspense fallback={null}>
      <LazySection {...props} />
    </Suspense>
  );
}

/** Where a piece of gear sits in its rack (the thing page, the map card). */
export function GearSheet(props: GearSheetProps) {
  return (
    <Suspense fallback={null}>
      <LazySheet {...props} />
    </Suspense>
  );
}
