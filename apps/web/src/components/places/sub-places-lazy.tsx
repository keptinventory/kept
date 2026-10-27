/**
 * "Turn places into boxes" and "Order of the places here", loaded on demand (#270): their chunk
 * (vite.config.ts ON_DEMAND_ENTRIES: ./sub-places.tsx) is out of the precache, fetched the first
 * time one opens, then kept by the service worker. Both need a connection anyway; offline before
 * that, the sheet says so.
 */
import { useLingui } from '@lingui/react/macro';
import { lazy, Suspense } from 'react';
import { Notice } from '@/components/page';
import { Sheet } from './sheet';
import type { SubPlacesProps } from './sub-places';

function Unavailable({ onClose }: SubPlacesProps) {
  const { t } = useLingui();
  return (
    <Sheet isOpen onOpenChange={(o) => !o && onClose()} title={t`Places inside`}>
      <Notice title={t`Needs a connection`} />
    </Sheet>
  );
}

const LazyBoxes = lazy(() =>
  import('./sub-places')
    .then((m) => ({ default: m.BoxesSheet }))
    .catch(() => ({ default: Unavailable })),
);
const LazyOrder = lazy(() =>
  import('./sub-places')
    .then((m) => ({ default: m.OrderSheet }))
    .catch(() => ({ default: Unavailable })),
);

/** "Turn places into boxes", mounted while open. */
export function BoxesSheet({ isOpen, ...props }: SubPlacesProps & { isOpen: boolean }) {
  if (!isOpen) return null;
  return (
    <Suspense fallback={null}>
      <LazyBoxes {...props} />
    </Suspense>
  );
}

/** "Order of the places here", mounted while open. */
export function OrderSheet({ isOpen, ...props }: SubPlacesProps & { isOpen: boolean }) {
  if (!isOpen) return null;
  return (
    <Suspense fallback={null}>
      <LazyOrder {...props} />
    </Suspense>
  );
}
