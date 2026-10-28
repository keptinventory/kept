/**
 * "Furniture from a template" (#238), loaded on demand: its chunk (vite.config.ts
 * ON_DEMAND_ENTRIES: ./furniture.tsx) is out of the precache, fetched the first time the sheet
 * opens, then kept by the service worker. Making furniture needs a connection anyway; offline
 * before that, the sheet says so.
 */
import { useLingui } from '@lingui/react/macro';
import { lazy, Suspense } from 'react';
import { Notice } from '@/components/page';
import type { FurnitureFormProps } from './furniture';

function Unavailable() {
  const { t } = useLingui();
  return <Notice title={t`Needs a connection`} />;
}

const LazyForm = lazy(() =>
  import('./furniture')
    .then((m) => ({ default: m.FurnitureForm }))
    .catch(() => ({ default: Unavailable })),
);

/** The furniture form, mounted while its sheet is open. */
export function FurnitureForm(props: FurnitureFormProps) {
  return (
    <Suspense fallback={null}>
      <LazyForm {...props} />
    </Suspense>
  );
}
