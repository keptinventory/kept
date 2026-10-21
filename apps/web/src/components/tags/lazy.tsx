/**
 * The tag picker and editors, loaded on demand (#209): their chunks (vite.config.ts
 * ON_DEMAND_ENTRIES: ./picker.tsx and ./editors.tsx) are out of the precache, fetched the first
 * time one shows, then kept by the service worker. Offline before that, the picker says it needs
 * a connection and the editors show nothing more than their fallback.
 */
import { useLingui } from '@lingui/react/macro';
import { type ComponentProps, type ComponentType, lazy, type ReactNode, Suspense } from 'react';
import { Notice } from '@/components/page';
import { Sheet } from '@/components/things/sheet';
import type * as Editors from './editors';
import type { TagPicker as Picker } from './picker';

type PickerProps = ComponentProps<typeof Picker>;

function Unavailable({ onClose, title }: PickerProps) {
  const { t } = useLingui();
  return (
    <Sheet isOpen onOpenChange={(o) => !o && onClose()} title={title}>
      <Notice title={t`Needs a connection`} />
    </Sheet>
  );
}

const LazyPicker = lazy(() =>
  import('./picker')
    .then((m) => ({ default: m.TagPicker }))
    .catch(() => ({ default: Unavailable })),
);

/** The picker (./picker.tsx), mounted while open. */
export function TagPicker(props: PickerProps) {
  if (!props.isOpen) return null;
  return (
    <Suspense fallback={null}>
      <LazyPicker {...props} />
    </Suspense>
  );
}

const nothing = () => null;

/** One of ./editors.tsx, on demand, with `fallback` while it loads (or can't). */
function onDemand<K extends 'TagsEditor' | 'TagsField' | 'BulkTagButtons' | 'CaptureTags'>(key: K) {
  type P = ComponentProps<(typeof Editors)[K]>;
  const L = lazy(() =>
    import('./editors')
      .then((m) => ({ default: m[key] as unknown as ComponentType<P> }))
      .catch(() => ({ default: nothing as ComponentType<P> })),
  );
  return function OnDemand(all: P & { fallback?: ReactNode }) {
    const { fallback = null, ...props } = all as { fallback?: ReactNode } & Record<string, unknown>;
    return (
      <Suspense fallback={fallback}>
        <L {...(props as P & Record<string, unknown>)} />
      </Suspense>
    );
  };
}

export const TagsEditor = onDemand('TagsEditor');
export const TagsField = onDemand('TagsField');
export const BulkTagButtons = onDemand('BulkTagButtons');
export const CaptureTags = onDemand('CaptureTags');
