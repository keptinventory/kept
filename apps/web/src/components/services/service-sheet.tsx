/**
 * One saved service, opened from a vehicle's Services tab (#296): all of it, the notes included,
 * with **Edit** (Log a service, filled in) and **Delete** (asks, then Undo) for whoever may change
 * it: the one who logged it (`logs.edit-own`) or an admin (`logs.edit-delete-others`). A viewer
 * reads it and has neither. Both need a connection.
 *
 * Loaded on demand (vite.config.ts ON_DEMAND_ENTRIES): the tab imports it lazily, the first time
 * a service is opened.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { householdApi } from '@/api/household/queries';
import type { LocationDetail } from '@/api/types';
import type { ServiceRecordV5 } from '@/api/vehicles/types';
import { useOfferUndo } from '@/components/history/undo';
import { DocumentIcon } from '@/components/icons';
import { GatedAmount } from '@/components/money/gated';
import { useErrorText } from '@/components/page';
import { accessOf, useInvalidateHousehold } from '@/components/schedules/access';
import { Sheet } from '@/components/things/sheet';
import { KeyValues, KV } from '@/components/things/values';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm';
import { DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { useFormat } from '@/lib/format';
import { useOnline } from '@/lib/online';
import { useMeterUnit } from '@/lib/units';
import { useServiceLineLabels } from './labels';

export type ServiceSheetProps = {
  record: ServiceRecordV5;
  location: LocationDetail;
  /** The reader's display name: their own service needs only `logs.edit-own`. */
  me: string;
  onClose: () => void;
  onEdit: (record: ServiceRecordV5) => void;
};

export default function ServiceSheet({ record, location, me, onClose, onEdit }: ServiceSheetProps) {
  const { t } = useLingui();
  const fmt = useFormat();
  const unitOf = useMeterUnit();
  const kinds = useServiceLineLabels();
  const confirm = useConfirm();
  const offerUndo = useOfferUndo();
  const errorText = useErrorText();
  const invalidate = useInvalidateHousehold();
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const access = accessOf(location);
  const mine = record.loggedBy.displayName === me;
  const mayChange = access.can(mine ? 'logs.edit-own' : 'logs.edit-delete-others');

  const remove = async () => {
    const ok = await confirm({
      title: t`Delete this service?`,
      body: t`Its lines and invoice go too. Schedules it completed count from the service before. You can undo this.`,
      confirmLabel: t`Delete`,
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const { auditEvents } = await householdApi.deleteServiceRecord(record.id, record.rowVersion);
      onClose();
      offerUndo({ title: t`Service deleted` }, auditEvents);
      await invalidate();
    } catch (e) {
      toast({ title: t`Couldn't delete it`, description: errorText(e), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet isOpen onOpenChange={(o) => !o && onClose()} title={t`Service`}>
      <div className="grid gap-4">
        <KeyValues>
          <KV label={<Trans>Date</Trans>}>{fmt.day(record.servicedOn)}</KV>
          {record.reading ? (
            <KV label={<Trans>Reading</Trans>}>
              <bdi>{`${fmt.num(Number(record.reading.value))} ${unitOf(record.reading.unit)}`}</bdi>
            </KV>
          ) : null}
          {record.vendor ? (
            <KV label={<Trans>Vendor</Trans>}>
              <bdi>{record.vendor.name}</bdi>
            </KV>
          ) : null}
          {record.total ? (
            <KV label={<Trans>Total</Trans>}>
              <GatedAmount value={record.total} />
            </KV>
          ) : null}
          {record.completes.length ? (
            <KV label={<Trans>Completes</Trans>}>
              {record.completes.map((c, i) => (
                <span key={c.scheduleId}>
                  {i > 0 ? fmt.sep : null}
                  <bdi>{c.name}</bdi>
                </span>
              ))}
            </KV>
          ) : null}
          <KV label={<Trans>Logged by</Trans>}>
            <bdi>{record.loggedBy.displayName}</bdi>
          </KV>
        </KeyValues>

        {record.lines.length ? (
          <section className="grid gap-1.5">
            <h3 className="eyebrow m-0">
              <Trans>Line items</Trans>
            </h3>
            <KeyValues>
              {record.lines.map((l) => (
                <KV key={l.id} label={kinds[l.kind]}>
                  <bdi>{l.description}</bdi>
                  {l.quantity && Number(l.quantity) !== 1
                    ? ` × ${fmt.num(Number(l.quantity))}`
                    : null}
                  {l.unitCost ? (
                    <span className="block text-small text-ink-2">
                      <GatedAmount value={l.unitCost} />
                    </span>
                  ) : null}
                  {l.consumable ? (
                    <span className="block text-small text-ink-2">
                      <Trans>From stock</Trans>
                      {fmt.sep}
                      <bdi>{l.consumable.name ?? ''}</bdi>
                    </span>
                  ) : null}
                </KV>
              ))}
            </KeyValues>
          </section>
        ) : null}

        {record.invoices.length ? (
          <section className="grid gap-1.5">
            <h3 className="eyebrow m-0">
              <Trans>Invoice</Trans>
            </h3>
            <ul className="m-0 grid list-none gap-1.5 p-0">
              {record.invoices.map((a, i) => (
                <li key={a.id} className="flex items-center gap-2 text-small">
                  <DocumentIcon className="size-4 shrink-0 text-ink-2" aria-hidden="true" />
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    {t`Invoice page ${i + 1}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {record.notes ? (
          <section className="grid gap-1.5">
            <h3 className="eyebrow m-0">
              <Trans>Notes</Trans>
            </h3>
            <p className="m-0 whitespace-pre-wrap text-[15px] text-ink [overflow-wrap:anywhere]">
              <bdi>{record.notes}</bdi>
            </p>
          </section>
        ) : null}

        {mayChange ? (
          <DialogFooter>
            <Button
              variant="secondary"
              isDisabled={!online}
              isPending={busy}
              onPress={() => void remove()}
            >
              <Trans>Delete</Trans>
            </Button>
            <Button isDisabled={!online || busy} onPress={() => onEdit(record)}>
              <Trans>Edit</Trans>
            </Button>
          </DialogFooter>
        ) : null}
      </div>
    </Sheet>
  );
}
