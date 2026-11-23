import { labelStock, newId } from '@kept/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { capturePaths } from '@/api/capture/paths';
import type { CreateLabelBatchBody, CreateLabelBatchResult, LabelBatch } from '@/api/capture/types';
import { qs } from '@/api/inventory/paths';
import type { Page } from '@/api/inventory/types';
import { useErrorText } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Select, SelectItem } from '@/components/ui/select';
import { usePlatform } from './adapters';
import type { Connection } from './bridge';
import { LocationPicker, writableLocations } from './destination';
import type { InventoryCache } from './inventory';
import { approvedLabel, labelUrl } from './labels';
import { isAuthRefusal, isRestoreEpochMismatch } from './outbox';

const counts = [8, 12, 24];

export function LabelSheets({
  connection,
  cache,
  onClose,
  onAuthError,
}: {
  connection: Connection;
  cache: InventoryCache;
  onClose: () => void;
  onAuthError: (reason: 'expired' | 'restored') => void;
}) {
  const { t } = useLingui();
  const adapters = usePlatform();
  const errorText = useErrorText();
  const [location, setLocation] = useState(writableLocations(cache)[0]?.id ?? null);
  const [count, setCount] = useState(12);
  const [id, setId] = useState(newId);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [batches, setBatches] = useState<LabelBatch[]>([]);

  useEffect(() => {
    let current = true;
    setBatches([]);
    if (location)
      void adapters.transport
        .request<Page<LabelBatch>>(
          connection,
          capturePaths.labelBatches + qs({ locationId: location }),
        )
        .then((page) => {
          if (current)
            setBatches(page.items.filter((batch) => batch.stock.startsWith('letter_writable_')));
        })
        .catch((error: unknown) => {
          if (!current) return;
          if (isAuthRefusal(error)) onAuthError('expired');
          else if (isRestoreEpochMismatch(error)) onAuthError('restored');
        });
    return () => {
      current = false;
    };
  }, [adapters, connection, location, onAuthError]);

  async function share(batch?: LabelBatch) {
    if (!location || !adapters.media.shareLabelSheet) return;
    setBusy(true);
    setStatus('');
    try {
      let sheet = batch;
      if (!sheet) {
        const body: CreateLabelBatchBody = {
          id,
          locationId: location,
          kind: 'blank',
          stock: `letter_writable_${count}`,
          blankCount: count,
        };
        const response = await adapters.transport.request<CreateLabelBatchResult>(
          connection,
          capturePaths.labelBatches,
          {
            method: 'POST',
            body,
            idempotencyKey: id,
          },
        );
        sheet = response.batch;
        setBatches((previous) => [
          response.batch,
          ...previous.filter((entry) => entry.id !== response.batch.id),
        ]);
        setId(newId());
      } else {
        sheet = await adapters.transport.request<LabelBatch>(
          connection,
          capturePaths.labelBatch(sheet.id),
        );
      }
      const stock = labelStock(sheet.stock);
      const labels = sheet.labels.map((label) => {
        const url = labelUrl(connection.origin, label.code);
        if (approvedLabel(url, connection.origin).status !== 'approved')
          throw new Error('Invalid label');
        return { url, ...(label.name ? { name: label.name } : {}) };
      });
      await adapters.media.shareLabelSheet(connection, {
        columns: stock.cols,
        rows: stock.rows,
        labels,
      });
    } catch (error) {
      if (isAuthRefusal(error)) onAuthError('expired');
      else if (isRestoreEpochMismatch(error)) onAuthError('restored');
      else setStatus(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-4">
      <Button variant="ghost" className="justify-self-start" onPress={onClose}>
        <Trans>Back</Trans>
      </Button>
      <h2 className="text-title font-semibold">
        <Trans>Print label sheets</Trans>
      </h2>
      <LocationPicker
        cache={cache}
        value={location}
        onChange={(value) => {
          setLocation(value);
          setId(newId());
        }}
        disabled={busy}
      />
      <Select
        label={t`Labels per US Letter sheet`}
        items={counts.map((value) => ({ id: value }))}
        selectedKey={count}
        onSelectionChange={(key) => {
          if (key != null) setCount(Number(key));
          setId(newId());
        }}
        isDisabled={busy}
      >
        {(option) => <SelectItem id={option.id}>{String(option.id)}</SelectItem>}
      </Select>
      <Button
        isDisabled={!location || !adapters.media.shareLabelSheet}
        isPending={busy}
        onPress={() => void share()}
      >
        <Trans>Create blank labels</Trans>
      </Button>
      {batches.length > 0 && (
        <ul className="grid gap-2">
          {batches.map((batch) => (
            <li key={batch.id}>
              <Button
                variant="secondary"
                className="kept-phone-row"
                isDisabled={busy}
                onPress={() => void share(batch)}
              >
                <Trans>Reprint label sheet</Trans>
                <span className="text-small">
                  <time dateTime={batch.createdAt}>
                    {new Date(batch.createdAt).toLocaleString()}
                  </time>
                </span>
                <bdi className="text-small">{batch.labels[0]?.code}</bdi>
              </Button>
            </li>
          ))}
        </ul>
      )}
      {status && <p role="alert">{status}</p>}
    </section>
  );
}
