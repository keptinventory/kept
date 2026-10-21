/**
 * Mark returned (D56, D57, Q14, Q15). A thing lent out goes back where it was, or to a place you
 * choose; a part that was split off merges back into the row it came from, unless you switch that
 * off (the switch shows only for a split). Condition photos at return are optional. A thing
 * borrowed in goes back to its owner: it ends as "returned to owner" and leaves your counts, and
 * stays in its history. Undoable: the Undo toast reopens the loan and moves it back (T10).
 *
 * 1.14 (#170): the condition it came back in (and "Update its condition"), part of a quantity
 * back (the rest stays out on its own line), or Lost: the loan closes as lost and the thing is
 * marked lost, never deleted. The note is the return's own; the lend note stays.
 */
import type { Condition } from '@kept/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { householdApi } from '@/api/household/queries';
import type { Loan, ReturnBody } from '@/api/household/types';
import { useOfferUndo } from '@/components/history/undo';
import { useErrorText } from '@/components/page';
import { useThingCtx } from '@/components/things/context';
import { westernNumber } from '@/components/things/form-model';
import { useBlocked, useHouseholdDone } from '@/components/things/household';
import { PendingFiles, useAttachAll } from '@/components/things/pending-files';
import { isChosen, WherePicker, type WhereValue } from '@/components/things/pickers';
import { Sheet } from '@/components/things/sheet';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { TextField } from '@/components/ui/text-field';
import { bdi, isolate } from '@/lib/bidi';
import { useFormat } from '@/lib/format';
import { ConditionPicker } from './condition-picker';

/** "Garage › Tool wall": a subject's path with its own name at the end, once. */
export function subjectText(s: { name: string; path: string }): string {
  if (!s.path) return s.name;
  return s.path === s.name || s.path.endsWith(` › ${s.name}`) ? s.path : `${s.path} › ${s.name}`;
}

export function ReturnSheet({
  loan,
  isOpen,
  onClose,
}: {
  loan: Loan | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useLingui();
  return (
    <Sheet
      isOpen={isOpen && !!loan}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={
        loan?.direction === 'in'
          ? t`Give it back to ${isolate(loan.person.name)}`
          : t`Back from ${isolate(loan?.person.name ?? '')}`
      }
    >
      {loan && isOpen ? <ReturnForm key={loan.id} loan={loan} onClose={onClose} /> : null}
    </Sheet>
  );
}

function ReturnForm({ loan, onClose }: { loan: Loan; onClose: () => void }) {
  const { thing, can } = useThingCtx();
  const { t } = useLingui();
  const navigate = useNavigate();
  const errorText = useErrorText();
  const offerUndo = useOfferUndo();
  const done = useHouseholdDone();
  const attachAll = useAttachAll();
  const blocked = useBlocked();
  const out = loan.direction === 'out';
  const [to, setTo] = useState<'previous' | 'elsewhere'>(
    loan.previousPlace ? 'previous' : 'elsewhere',
  );
  const [where, setWhere] = useState<WhereValue>({
    locationId: thing.locationId,
    target: { placeId: '' },
  });
  const [mergeBack, setMergeBack] = useState(true);
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState<'back' | 'lost'>('back');
  const [condition, setCondition] = useState<Condition | null>(null);
  const [updateCondition, setUpdateCondition] = useState(false);
  const [back, setBack] = useState(loan.quantity);
  const fmt = useFormat();
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (out && outcome === 'lost') {
      setBusy(true);
      try {
        const r = await householdApi.loseLoan(
          loan.id,
          notes.trim() ? { notes: notes.trim() } : {},
          loan.rowVersion,
        );
        offerUndo({ title: t`Marked lost` }, r.auditEvents, { thingId: thing.id });
        await done();
        onClose();
      } catch (e) {
        setError(errorText(e));
      } finally {
        setBusy(false);
      }
      return;
    }
    const body: ReturnBody = {};
    if (condition) {
      body.conditionIn = condition;
      if (updateCondition) body.updateCondition = true;
    }
    if (out && Number(loan.quantity) > 1) {
      const n = Number(westernNumber(back).trim());
      if (!(n > 0) || n > Number(loan.quantity)) {
        setError(t`How many came back: 1 to ${fmt.num(Number(loan.quantity))}.`);
        return;
      }
      if (n < Number(loan.quantity)) body.quantityBack = String(n);
    }
    if (out) {
      if (to === 'elsewhere') {
        if (!isChosen(where.target)) {
          setError(t`Choose where it goes.`);
          return;
        }
        body.to = where.target;
      } else body.to = 'previous';
      if (loan.splitFromThingId) body.mergeBack = mergeBack;
    }
    if (notes.trim()) body.notes = notes.trim();
    setBusy(true);
    try {
      const r = await householdApi.returnLoan(loan.id, body, loan.rowVersion);
      await attachAll(files, thing.locationId, { loanId: loan.id }, 'condition_in');
      offerUndo(
        { title: out ? t`Returned` : t`Given back to ${isolate(loan.person.name)}` },
        r.auditEvents,
        { thingId: thing.id },
      );
      await done();
      onClose();
      // Merged back: this row is gone, so show the one it joined.
      if (r.body.mergedInto) await navigate({ to: '/t/$id', params: { id: r.body.mergedInto.id } });
    } catch (e) {
      setError(errorText(e));
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
      {out ? (
        <Segmented<'back' | 'lost'>
          label={t`What happened`}
          value={outcome}
          onChange={setOutcome}
          options={[
            { id: 'back', label: t`Came back` },
            { id: 'lost', label: t`Lost` },
          ]}
        />
      ) : null}
      {out && outcome === 'lost' ? (
        <p className="m-0 text-small text-ink-2">
          <Trans>It is marked lost, never deleted: its history stays.</Trans>
        </p>
      ) : out ? (
        <>
          {Number(loan.quantity) > 1 ? (
            <TextField
              label={t`How many came back`}
              description={t`Of ${fmt.num(Number(loan.quantity))}. The rest stays out.`}
              value={back}
              onChange={setBack}
              inputProps={{ inputMode: 'numeric', dir: 'ltr' }}
            />
          ) : null}
          <ConditionPicker
            label={t`Condition it came back in`}
            value={condition}
            onChange={setCondition}
          />
          {condition ? (
            <Switch isSelected={updateCondition} onChange={setUpdateCondition}>
              <Trans>Update its condition</Trans>
            </Switch>
          ) : null}
          {loan.previousPlace ? (
            <Segmented<'previous' | 'elsewhere'>
              label={t`Where it goes`}
              value={to}
              onChange={setTo}
              options={[
                { id: 'previous', label: t`Where it was` },
                { id: 'elsewhere', label: t`Somewhere else` },
              ]}
            />
          ) : null}
          {to === 'previous' && loan.previousPlace ? (
            <p className="m-0 text-small text-ink-2">
              <bdi dir="auto">{subjectText(loan.previousPlace)}</bdi>
            </p>
          ) : (
            <WherePicker
              value={where}
              onChange={setWhere}
              allowOtherLocations={false}
              exclude={thing.id}
            />
          )}
          {loan.splitFromThingId ? (
            <Switch isSelected={mergeBack} onChange={setMergeBack}>
              <Trans>Put them back with the rest</Trans>
            </Switch>
          ) : null}
        </>
      ) : (
        <p className="m-0 text-small text-ink-2">
          <Trans>
            It belongs to {bdi(loan.person.name)}: it leaves your counts and totals, and stays in
            its history.
          </Trans>
        </p>
      )}
      <TextField label={t`Note`} value={notes} onChange={setNotes} inputProps={{ dir: 'auto' }} />
      {out && can('attachments.add') ? (
        <PendingFiles
          files={files}
          onChange={setFiles}
          label={t`Condition photos`}
          accept={['image/*']}
        />
      ) : null}
      {error ? (
        <p role="alert" className="m-0 text-small text-danger">
          {error}
        </p>
      ) : null}
      {blocked ? <p className="m-0 text-small text-ink-3">{blocked}</p> : null}
      <DialogFooter>
        <Button variant="secondary" onPress={onClose}>
          <Trans>Cancel</Trans>
        </Button>
        <Button type="submit" isPending={busy} isDisabled={!!blocked}>
          {out && outcome === 'lost' ? <Trans>Mark lost</Trans> : <Trans>Mark returned</Trans>}
        </Button>
      </DialogFooter>
    </form>
  );
}
