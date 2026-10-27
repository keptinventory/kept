/**
 * The graph view, loaded on demand (#207): its layouts, both pictures and its card are in their
 * own chunk (vite.config.ts), out of the precache, fetched the first time someone opens a graph.
 * While it loads, a skeleton; when it can't load (offline before it was ever fetched),
 * "Needs a connection", as the map says.
 */
import { useLingui } from '@lingui/react/macro';
import { lazy, Suspense } from 'react';
import { LoadingRows, Notice } from '@/components/page';

function Unavailable() {
  const { t } = useLingui();
  return <Notice title={t`Needs a connection`} />;
}

const Lazy = lazy(() => import('./graph-view').catch(() => ({ default: Unavailable })));

/** `focusId`: a place's page, whose graph opens on that place. */
export function LocationGraphLazy(props: {
  locationId: string;
  name: string;
  address: string;
  focusId?: string;
}) {
  return (
    <Suspense fallback={<LoadingRows rows={3} />}>
      <Lazy {...props} />
    </Suspense>
  );
}
