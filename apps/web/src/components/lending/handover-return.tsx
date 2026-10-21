/**
 * Mark a hand-over returned (1.14, #170): a checklist of every open line, each ticked "Came back"
 * by default. Per line: came back (and the condition it came back in), came back damaged or
 * broken (a note, and "Update its condition"), not returned (it stays with them), lost (the line
 * closes and the thing is marked lost, never deleted), and for a quantity, how many came back
 * (the rest stays out on its own line). Save closes each line as chosen, one undoable event each,
 * undone together from the toast.
 */
import type { Condition, ReturnLineOutcome } from '@kept/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { householdApi, useHandover } from '@/api/household/queries';
import type { HandoverLine, HandoverReturnLine } from '@/api/household/types';
import { useOfferUndo } from '@/components/history/undo';
import { ErrorState, LoadingRows, useErrorText } from '@/components/page';
import { useInvalidateHousehold } from '@/components/schedules/access';
import { westernNumber } from '@/components/things/form-model';
import { Sheet } from '@/components/things/sheet';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { TextField } from '@/components/ui/text-field';
import { isolate } from '@/lib/bidi';
import { useFormat } from '@/lib/format';
import { ConditionPicker } from './condition-picker';

type Choice = {
  outcome: ReturnLineOutcome;
  condition: Condition | null;
  notes: string;
  updateCondition: boolean;
  back: string;
};

export function HandoverReturnSheet({
  handoverId,
  isOpen,
  onClose,
  onDone,
}: {
  handoverId: string | null;
  isOpen: boolean;
  onClose: () => void;
  /** After saving: the page's own refresh (the thing page's). */
  onDone?: () => Promise<void>;
}) {
  const { t } = useLingui();
  const q = useHandover(isOpen ? handoverId : null);
  const person = q.data?.person.name ?? '';
  return (
    <Sheet
      isOpen={isOpen && !!handoverId}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={t`Back from ${isolate(person)}`}
    >
      {q.isPending ? (
        <LoadingRows rows={3} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <Checklist
          key={q.data.id}
          handoverId={q.data.id}
          lines={q.data.lines.filter((l) => !l.returnedAt)}
          onClose={onClose}
          {...(onDone ? { onDone } : {})}
        />
      )}
    </Sheet>
  );
}

function Checklist({
  handoverId,
  lines,
  onClose,
  onDone,
}: {
  handoverId: string;
  lines: HandoverLine[];
  onClose: () => void;
  onDone?: () => Promise<void>;
}) {
  const { t } = useLingui();
  const fmt = useFormat();
  const errorText = useErrorText();
  const offerUndo = useOfferUndo();
  const invalidate = useInvalidateHousehold();
  const [choices, setChoices] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(
      lines.map((l) => [
        l.id,
        { outcome: 'back', condition: null, notes: '', updateCondition: false, back: l.quantity },
      ]),
    ),
  );
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const set = (id: string, patch: Partial<Choice>) =>
    setChoices((c) => ({ ...c, [id]: { ...(c[id] as Choice), ...patch } }));

  const save = async () => {
    const body: HandoverReturnLine[] = [];
    for (const l of lines) {
      const c = choices[l.id] as Choice;
      const line: HandoverReturnLine = { loanId: l.id, outcome: c.outcome };
      if (c.notes.trim()) line.notes = c.notes.trim();
      if ((c.outcome === 'back' || c.outcome === 'damaged') && c.condition) {
        line.conditionIn = c.condition;
        if (c.updateCondition) line.updateCondition = true;
      }
      if (c.outcome === 'back' || c.outcome === 'damaged') {
        const n = Number(westernNumber(c.back).trim());
        if (!(n > 0) || n > Number(l.quantity)) {
          setError(t`How many came back: 1 to ${fmt.num(Number(l.quantity))}.`);
          return;
        }
        if (n < Number(l.quantity)) line.quantityBack = String(n);
      }
      body.push(line);
    }
    setBusy(true);
    try {
      const { body: after, auditEvents } = await householdApi.returnHandover(handoverId, {
        lines: body,
      });
      const back = fmt.num(after.counts.returned);
      const all = fmt.num(after.counts.lines);
      offerUndo({ title: t`${back} of ${all} came back` }, auditEvents);
      await Promise.all([invalidate(), onDone?.()]);
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <ul className="m-0 grid list-none gap-4 p-0">
        {lines.map((l) => {
          const c = choices[l.id] as Choice;
          const name = l.thing.name ?? t`Unnamed`;
          return (
            <li key={l.id} className="grid gap-2 border-line border-b pb-3">
              <span className="grid gap-0.5">
                <bdi className="font-semibold" dir="auto">
                  {name}
                </bdi>
                {l.pathAtLend ? (
                  <span className="text-ink-3 text-small">
                    <Trans>
                      in <bdi>{l.pathAtLend}</bdi>
                    </Trans>
                  </span>
                ) : null}
              </span>
              <Segmented<ReturnLineOutcome>
                aria-label={name}
                value={c.outcome}
                onChange={(v) =>
                  set(l.id, {
                    outcome: v,
                    ...(v === 'damaged' && !c.condition ? { condition: 'poor' as const } : {}),
                  })
                }
                options={[
                  { id: 'back', label: t`Came back` },
                  { id: 'damaged', label: t`Damaged` },
                  { id: 'not_returned', label: t`Not returned` },
                  { id: 'lost', label: t`Lost` },
                ]}
              />
              {c.outcome === 'back' || c.outcome === 'damaged' ? (
                <>
                  {Number(l.quantity) > 1 ? (
                    <TextField
                      label={t`How many came back`}
                      description={t`Of ${fmt.num(Number(l.quantity))}. The rest stays out.`}
                      value={c.back}
                      onChange={(v) => set(l.id, { back: v })}
                      inputProps={{ inputMode: 'numeric', dir: 'ltr' }}
                    />
                  ) : null}
                  <ConditionPicker
                    label={t`Condition it came back in`}
                    value={c.condition}
                    onChange={(v) => set(l.id, { condition: v })}
                  />
                  {c.condition ? (
                    <Switch
                      isSelected={c.updateCondition}
                      onChange={(v) => set(l.id, { updateCondition: v })}
                    >
                      <Trans>Update its condition</Trans>
                    </Switch>
                  ) : null}
                </>
              ) : null}
              {c.outcome !== 'back' ? (
                <TextField
                  label={t`Note`}
                  value={c.notes}
                  onChange={(v) => set(l.id, { notes: v })}
                  inputProps={{ dir: 'auto' }}
                />
              ) : null}
              {c.outcome === 'not_returned' ? (
                <p className="m-0 text-ink-3 text-small">
                  <Trans>It stays with them; reminders go on.</Trans>
                </p>
              ) : c.outcome === 'lost' ? (
                <p className="m-0 text-ink-3 text-small">
                  <Trans>It is marked lost, never deleted: its history stays.</Trans>
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {error ? (
        <p role="alert" className="m-0 text-danger text-small">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button variant="secondary" onPress={onClose}>
          <Trans>Cancel</Trans>
        </Button>
        <Button type="submit" isPending={busy}>
          <Trans>Save</Trans>
        </Button>
      </DialogFooter>
    </form>
  );
}
