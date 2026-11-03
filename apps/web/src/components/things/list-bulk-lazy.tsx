/**
 * The List's and Grid's "Set a field…" and "Save N changes" (#366), loaded on demand: the
 * spreadsheet's staging (components/sheet/list-bulk.tsx) reads and writes the server only, so it
 * stays out of the precache. Offline before it was ever fetched, nothing shows: the button that
 * opens it is off offline.
 */
import { lazy, type ReactNode, Suspense } from 'react';
import type { ListBulkProps } from '@/components/sheet/list-bulk';

const Lazy = lazy(
  (): Promise<{ default: (props: ListBulkProps) => ReactNode }> =>
    import('@/components/sheet/list-bulk').catch(() => ({ default: () => null })),
);

export function ListBulkLazy(props: ListBulkProps) {
  return (
    <Suspense fallback={null}>
      <Lazy {...props} />
    </Suspense>
  );
}
