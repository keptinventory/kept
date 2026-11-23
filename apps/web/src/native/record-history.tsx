import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { inventoryPaths, qs } from '@/api/inventory/paths';
import type { HistoryEvent, Page } from '@/api/inventory/types';
import { useErrorText } from '@/components/page';
import { Button } from '@/components/ui/button';
import { isolate } from '@/lib/bidi';
import { sep } from '@/lib/format';
import { usePlatform } from './adapters';
import type { Connection } from './bridge';
import type { InventoryCache } from './inventory';
import type { Target } from './labels';
import { isAuthRefusal, isRestoreEpochMismatch } from './outbox';

export function RecordHistory({
  connection,
  cache,
  target,
  container,
  onAuthError,
}: {
  connection: Connection;
  cache: InventoryCache | undefined;
  target: Target;
  container: boolean;
  onAuthError?: (reason: 'expired' | 'restored') => void;
}) {
  const { t } = useLingui();
  const adapters = usePlatform();
  const errorText = useErrorText();
  const [page, setPage] = useState<Page<HistoryEvent>>();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  async function load(cursor?: string) {
    setBusy(true);
    setStatus('');
    try {
      const path =
        target.kind === 'thing'
          ? inventoryPaths.thingHistory(target.id) +
            qs({ kind: 'changes', contents: container ? 1 : undefined, cursor })
          : inventoryPaths.placeHistory(target.id) + qs({ cursor });
      const result = await adapters.transport.request<Page<HistoryEvent>>(connection, path);
      setPage((previous) => ({
        ...result,
        items: [...(cursor ? (previous?.items ?? []) : []), ...result.items],
      }));
    } catch (error) {
      if (isAuthRefusal(error)) onAuthError?.('expired');
      else if (isRestoreEpochMismatch(error)) onAuthError?.('restored');
      else {
        setPage(undefined);
        setStatus(errorText(error));
      }
    } finally {
      setBusy(false);
    }
  }

  function summary(event: HistoryEvent) {
    const mode = event.diff?.mode;
    if (
      event.summaryKey === 'attachment.create.photo' ||
      (event.summaryKey === 'thing.capture.attach' &&
        mode &&
        'after' in mode &&
        mode.after === 'thing')
    )
      return t`Photo added to the record. Inventory unchanged.`;
    const name = isolate(event.summaryParams.name ?? t`Item`);
    if (container && event.entity.id !== target.id) {
      const parent = event.diff?.container_id;
      if (parent && 'before' in parent && event.action === 'thing.move') {
        if (parent.before === target.id) return t`${name} moved out of this box`;
        if (parent.after === target.id) return t`${name} moved into this box`;
      }
      const removed = event.diff?.removed_from_container_id;
      if (
        event.action === 'thing.trash' &&
        removed &&
        'after' in removed &&
        removed.after === target.id
      )
        return t`${name} removed from this box`;
      const restored = event.diff?.restored_to_container_id;
      if (
        event.action === 'thing.restore' &&
        restored &&
        'after' in restored &&
        restored.after === target.id
      )
        return t`${name} restored to this box`;
      if (
        (event.action === 'thing.create' || event.action === 'thing.capture') &&
        parent &&
        'after' in parent &&
        parent.after === target.id
      )
        return t`${name} added to this box`;
    }
    return event.summary;
  }

  function recordedPath(event: HistoryEvent, side: 'before' | 'after') {
    const change = event.diff?.path;
    const locationChange = event.diff?.location_id;
    const paths = change && 'before' in change ? change[side] : null;
    if (!paths && !locationChange) return '';
    const locationId =
      locationChange && 'before' in locationChange ? locationChange[side] : event.location_id;
    const location = cache?.locations.find((entry) => entry.id === locationId)?.name;
    return [
      location,
      ...(Array.isArray(paths) ? paths.filter((step) => typeof step === 'string') : []),
    ]
      .filter(Boolean)
      .join(' › ');
  }

  return (
    <section className="grid gap-2">
      <h3 className="font-semibold">
        <Trans>History</Trans>
      </h3>
      {!page ? (
        <Button
          variant="secondary"
          className="justify-self-start"
          isPending={busy}
          onPress={() => void load()}
        >
          <Trans>View history</Trans>
        </Button>
      ) : (
        <>
          {page.items.length ? (
            <ol className="grid gap-2">
              {page.items.map((event) => {
                const before = recordedPath(event, 'before');
                const after = recordedPath(event, 'after');
                return (
                  <li
                    key={event.id}
                    className="grid gap-1 rounded-lg border border-line bg-surface p-3"
                  >
                    <p>
                      <bdi>{summary(event)}</bdi>
                    </p>
                    {event.action.endsWith('.move') && before && after && before !== after && (
                      <p className="text-small">
                        <Trans>From</Trans> <bdi>{before}</bdi>
                        <br />
                        <Trans>To</Trans> <bdi>{after}</bdi>
                      </p>
                    )}
                    <p className="text-small text-ink-2">
                      <time dateTime={event.at}>{new Date(event.at).toLocaleString()}</time>
                      {event.actor.displayName && (
                        <>
                          {sep()}
                          <bdi>{event.actor.displayName}</bdi>
                        </>
                      )}
                    </p>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p>
              <Trans>No history yet.</Trans>
            </p>
          )}
          {page.next_cursor && (
            <Button
              variant="secondary"
              isPending={busy}
              onPress={() => void load(page.next_cursor ?? undefined)}
            >
              <Trans>Load more</Trans>
            </Button>
          )}
          <Button
            variant="ghost"
            className="justify-self-start"
            isDisabled={busy}
            onPress={() => setPage(undefined)}
          >
            <Trans>Hide history</Trans>
          </Button>
        </>
      )}
      {status && <p role="alert">{status}</p>}
    </section>
  );
}
