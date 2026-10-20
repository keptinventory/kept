/**
 * "Count regularly" on a place (1.14, #172): a planned count is a schedule of kind `count` on
 * the place, every 1 to 24 months, with the schedules' reminders, due and overdue and Needs-you.
 * Counting the place completes it. The row says how often and when the next count is due, and
 * opens a sheet to set it, change it or stop it; "Past counts" opens Counts for this place. Only
 * with Schedules on, for those who manage schedules; everyone sees the row once one is planned.
 */
import { COUNT_EVERY_MONTHS, newId } from '@kept/shared';
import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { householdApi, useSubjectSchedules } from '@/api/household/queries';
import type { Schedule } from '@/api/household/types';
import { useOfferUndo } from '@/components/history/undo';
import { CalendarIcon } from '@/components/icons';
import { useErrorText } from '@/components/page';
import { ActionRow } from '@/components/places/action-row';
import { useInvalidateHousehold } from '@/components/schedules/access';
import { decimalOf } from '@/components/services/fields';
import { Sheet } from '@/components/things/sheet';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { useFormat } from '@/lib/format';
import { useOnline } from '@/lib/online';
import { useTypedNumber } from '@/lib/units';

export function plannedCountOf(items: readonly Schedule[] | undefined): Schedule | null {
  return items?.find((s) => s.kind === 'count' && s.active) ?? null;
}

export function CountRegularlyRow({
  placeId,
  name,
  canManage,
}: {
  placeId: string;
  name: string;
  /** Schedules on here, and the person manages schedules. */
  canManage: boolean;
}) {
  const { t } = useLingui();
  const fmt = useFormat();
  const q = useSubjectSchedules({ placeId });
  const planned = plannedCountOf(q.data?.items);
  const [open, setOpen] = useState(false);
  if (!planned && !canManage) return null;
  const months = planned?.everyMonths ?? 0;
  const next = planned?.next.dueOn ? fmt.day(planned.next.dueOn) : null;
  return (
    <>
      <ActionRow
        icon={<CalendarIcon />}
        title={
          planned ? (
            plural(months, { one: 'Counted every month', other: 'Counted every # months' })
          ) : (
            <Trans>Count regularly</Trans>
          )
        }
        subtitle={
          planned ? (
            planned.next.state === 'overdue' ? (
              <Trans>The next count is overdue</Trans>
            ) : next ? (
              <Trans>Next count due {next}</Trans>
            ) : null
          ) : (
            <Trans>A reminder to count {name} every few months</Trans>
          )
        }
        {...(canManage ? { onPress: () => setOpen(true) } : {})}
      />
      <Sheet
        isOpen={open}
        onOpenChange={setOpen}
        title={planned ? t`Planned count` : t`Count regularly`}
      >
        {({ close }) => (
          <CountRegularlyForm placeId={placeId} name={name} planned={planned} onClose={close} />
        )}
      </Sheet>
    </>
  );
}

function CountRegularlyForm({
  placeId,
  name,
  planned,
  onClose,
}: {
  placeId: string;
  name: string;
  planned: Schedule | null;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const typed = useTypedNumber();
  const errorText = useErrorText();
  const offerUndo = useOfferUndo();
  const invalidate = useInvalidateHousehold();
  const online = useOnline();
  const [months, setMonths] = useState(() => typed(planned?.everyMonths ?? 6));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const min = COUNT_EVERY_MONTHS.min;
  const max = COUNT_EVERY_MONTHS.max;

  const monthsOf = (s: string) => {
    const d = decimalOf(s);
    const n = d ? Number(d) : Number.NaN;
    return Number.isInteger(n) && n >= min && n <= max ? n : null;
  };

  const save = async () => {
    const m = monthsOf(months.trim());
    if (m === null) {
      setError(t`A whole number of months, ${min} to ${max}.`);
      return;
    }
    setBusy(true);
    try {
      if (planned) {
        const { auditEvents } = await householdApi.updateSchedule(
          planned.id,
          { everyMonths: m },
          planned.rowVersion,
        );
        offerUndo({ title: t`Saved` }, auditEvents);
      } else {
        await householdApi.createSchedule({
          id: newId(),
          subject: { placeId },
          kind: 'count',
          name: t`Count ${name}`,
          everyMonths: m,
          leadDays: 7,
        });
        toast({ title: t`Planned: count ${name} regularly`, tone: 'ok' });
      }
      await invalidate();
      onClose();
    } catch (e) {
      toast({ title: t`Couldn't save it`, description: errorText(e), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    if (!planned) return;
    setBusy(true);
    try {
      const { auditEvents } = await householdApi.deleteSchedule(planned.id, planned.rowVersion);
      offerUndo({ title: t`Stopped the planned count` }, auditEvents);
      await invalidate();
      onClose();
    } catch (e) {
      toast({ title: t`Couldn't stop it`, description: errorText(e), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      noValidate
      className="grid gap-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <p className="m-0 text-ink-2 text-small">
        <Trans>
          Counting <bdi>{name}</bdi> (and the places inside it) marks it done; you get a reminder a
          week before it's due.
        </Trans>
      </p>
      <TextField
        label={t`Every how many months`}
        value={months}
        onChange={(v) => {
          setMonths(v);
          setError(null);
        }}
        inputProps={{ inputMode: 'numeric' }}
        {...(error ? { errorMessage: error, isInvalid: true } : {})}
      />
      <DialogFooter>
        {planned ? (
          <Button variant="secondary" isDisabled={busy || !online} onPress={() => void stop()}>
            <Trans>Stop counting regularly</Trans>
          </Button>
        ) : null}
        <Button type="submit" isPending={busy} isDisabled={!online}>
          <Trans>Save</Trans>
        </Button>
      </DialogFooter>
    </form>
  );
}
