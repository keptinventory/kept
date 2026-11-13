/**
 * The selection's "Move to Trash" (#294), loaded on demand: it needs the server anyway, so it
 * stays out of the precache. The button is always there. While it loads it shows, off; a load
 * that failed (the connection, or Kept updated while the page was open and the old file is gone)
 * leaves it off with a Reload beside it, and isn't kept: the next selection, or the connection
 * coming back, fetches it again (as "Set a field…" does, list-bulk-lazy.tsx). Discussion #183: it
 * used to draw nothing at all after a failed load.
 */
import { Trans } from '@lingui/react/macro';
import { type ComponentType, lazy, Suspense, useEffect, useState } from 'react';
import type { BulkTrashButton } from '@/components/things/bulk-trash';
import { Button } from '@/components/ui/button';
import { useOnline } from '@/lib/online';

type Props = Parameters<typeof BulkTrashButton>[0];
type Loaded = ComponentType<Props>;

let loaded: Loaded | null = null;

/** The button, off: while it loads, and with Reload once its load has failed. */
function Unavailable({ failed }: { failed: boolean }) {
  return (
    <>
      <Button size="small" variant="secondary" isDisabled>
        <Trans>Move to Trash</Trans>
      </Button>
      {failed ? (
        <Button size="small" variant="ghost" onPress={() => window.location.reload()}>
          <Trans>Reload</Trans>
        </Button>
      ) : null}
    </>
  );
}

const Failed: Loaded = () => <Unavailable failed />;

/** The button as a lazy component: the one that loaded, or a fresh attempt if the last failed. */
function attempt(): Loaded {
  if (loaded) return loaded;
  const next: Loaded = lazy(
    (): Promise<{ default: Loaded }> =>
      import('@/components/things/bulk-trash')
        .then((m) => ({ default: m.BulkTrashButton }))
        .catch(() => {
          // Forgotten, so the next mount or reconnect asks again rather than keeping the failure.
          if (loaded === next) loaded = null;
          return { default: Failed };
        }),
  );
  loaded = next;
  return next;
}

export function BulkTrashLazy(props: Props) {
  const online = useOnline();
  const [Lazy, setLazy] = useState(attempt);
  useEffect(() => {
    if (online) setLazy(attempt);
  }, [online]);
  return (
    <Suspense fallback={<Unavailable failed={false} />}>
      <Lazy {...props} />
    </Suspense>
  );
}
