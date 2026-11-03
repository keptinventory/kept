/**
 * The List's and Grid's "Set a field…" and "Save N changes" (#366), loaded on demand: the
 * spreadsheet's staging (components/sheet/list-bulk.tsx) reads and writes the server only, so it
 * stays out of the precache. Offline before it was ever fetched, nothing shows: the button that
 * opens it is off offline. A load that failed isn't kept: the next time the staging is needed (a
 * new selection, or the connection coming back while one is open) it is fetched again.
 */
import { type ComponentType, lazy, Suspense, useEffect, useState } from 'react';
import type { ListBulkProps } from '@/components/sheet/list-bulk';
import { useOnline } from '@/lib/online';

type Loaded = ComponentType<ListBulkProps>;

let loaded: Loaded | null = null;

/** The staging as a lazy component: the one that loaded, or a fresh attempt if the last failed. */
function attempt(): Loaded {
  if (loaded) return loaded;
  const next: Loaded = lazy(
    (): Promise<{ default: Loaded }> =>
      import('@/components/sheet/list-bulk').catch(() => {
        // Forgotten, so the next mount or reconnect asks again rather than keeping the failure.
        if (loaded === next) loaded = null;
        return { default: () => null };
      }),
  );
  loaded = next;
  return next;
}

export function ListBulkLazy(props: ListBulkProps) {
  const online = useOnline();
  const [Lazy, setLazy] = useState(attempt);
  useEffect(() => {
    if (online) setLazy(attempt);
  }, [online]);
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
