/**
 * Furniture's compartments on its page (#238), loaded on demand: its chunk (vite.config.ts
 * ON_DEMAND_ENTRIES: ./compartments.tsx) is out of the precache, fetched the first time a
 * furniture page opens, then kept by the service worker. Offline before that, the section isn't
 * shown: the places inside are still listed below it.
 */
import { lazy, Suspense } from 'react';
import type { CompartmentsProps } from './compartments';

const Lazy = lazy(() =>
  import('./compartments')
    .then((m) => ({ default: m.CompartmentsSection }))
    .catch(() => ({ default: () => null })),
);

/** The compartments section of a furniture place; nothing for any other place. */
export function CompartmentsSection(props: CompartmentsProps) {
  if (!props.place.furniture) return null;
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
