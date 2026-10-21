/**
 * Lend (D57): to a member or a contact (members first, "+ New person"), part of a
 * quantity (the lent part becomes its own row, D10, and merges back on return), an optional
 * due date, a note, the condition it goes out in and condition photos. Kept never messages the
 * person; it reminds you two days before it's due and when it's overdue.
 *
 * A box goes with everything inside it (1.14, #170): one hand-over, each thing on its own line,
 * so each keeps its own record. The sheet lists what is inside; what is already lent or in repair
 * stays here and the toast says so. A kit also lists its parts kept elsewhere, each to lend too
 * or leave. Undo takes the whole hand-over back while nothing of it has changed.
 *
 * With Lending off here, the sheet says so instead of the form.
 */

import type { Condition } from '@kept/shared';
import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { householdApi, useKit } from '@/api/household/queries';
import type { LendBody } from '@/api/household/types';
import { inventoryApi } from '@/api/inventory/queries';
import { useOfferUndo } from '@/components/history/undo';
import { useErrorText } from '@/components/page';
import { ModuleOff, useThingCtx } from '@/components/things/context';
import { westernNumber } from '@/components/things/form-model';
import { todayIn, useBlocked, useHouseholdDone } from '@/components/things/household';
import { PendingFiles, useAttachAll } from '@/components/things/pending-files';
import { useLocationAccountId } from '@/components/things/pickers';
import { Sheet } from '@/components/things/sheet';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { DialogFooter } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/text-field';
import { TickBox } from '@/components/ui/tick-box';
import { isolate } from '@/lib/bidi';
import { useFormat } from '@/lib/format';
import { ConditionPicker } from './condition-picker';
import {
  emptyPerson,
  PersonPicker,
  type PersonValue,
  personInput,
  usePersonOptions,
} from './person-picker';

export function LendSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { thing, moduleOn } = useThingCtx();
  const { t } = useLingui();
  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={t`Lend ${thing.name ?? ''}`}
    >
      {moduleOn('lending') ? (
        isOpen ? (
          <LendForm onClose={onClose} />
        ) : null
      ) : (
        <div className="grid gap-3.5">
          <ModuleOff what={<Trans>Lending</Trans>} />
          <DialogFooter>
            <Button variant="secondary" onPress={onClose}>
              <Trans>Close</Trans>
            </Button>
          </DialogFooter>
        </div>
      )}
    </Sheet>
  );
}

function LendForm({ onClose }: { onClose: () => void }) {
  const { thing, location, can } = useThingCtx();
  const { t } = useLingui();
  const fmt = useFormat();
  const errorText = useErrorText();
  const done = useHouseholdDone();
  const attachAll = useAttachAll();
  const blocked = useBlocked();
  const accountId = useLocationAccountId(location);
  const options = usePersonOptions(location.id, accountId);
  const today = todayIn(location.timezone);
  const [person, setPerson] = useState<PersonValue>(emptyPerson);
  const [count, setCount] = useState(String(thing.quantity));
  const [dueOn, setDueOn] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [condition, setCondition] = useState<Condition | null>(null);
  const [alsoParts, setAlsoParts] = useState<Set<string>>(new Set());
  const [files, setFiles] = useState<File[]>([]);
  const offerUndo = useOfferUndo();
  // What goes with it: a box's contents, and a kit's parts kept elsewhere.
  const inside = useQuery({
    queryKey: ['lend', 'inside', thing.id],
    queryFn: () => inventoryApi.things({ containerId: thing.id, limit: 50 }),
    enabled: thing.isContainer,
  });
  const contents = inside.data?.items ?? [];
  const kit = useKit(thing.isContainer ? thing.id : '').data?.kit ?? null;
  const elsewhere = (kit?.parts ?? []).filter(
    (p) => p.status === 'elsewhere' || p.status === 'missing',
  );
  const [error, setError] = useState<{ field: 'person' | 'count' | 'form'; text: string }>();
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const who = personInput(person, options);
    if (!who) {
      setError({ field: 'person', text: t`Who is it going to?` });
      return;
    }
    const body: LendBody = { person: who };
    if (thing.quantity > 1) {
      const n = Number(westernNumber(count).trim());
      if (!Number.isInteger(n) || n < 1 || n > thing.quantity) {
        setError({ field: 'count', text: t`Between 1 and ${fmt.num(thing.quantity)}.` });
        return;
      }
      if (n < thing.quantity) body.quantity = String(n);
    }
    if (dueOn) body.dueOn = dueOn;
    if (notes.trim()) body.notes = notes.trim();
    if (condition) body.conditionOut = condition;
    if (alsoParts.size) body.alsoParts = [...alsoParts];
    setBusy(true);
    try {
      const { body: r, auditEvents } = await householdApi.lend(thing.id, body);
      await attachAll(files, thing.locationId, { loanId: r.loan.id }, 'condition_out');
      const lines = r.handover?.counts.lines ?? 1;
      const stayed = r.excluded ?? [];
      offerUndo(
        {
          title:
            lines > 1
              ? plural(lines, {
                  one: `Lent to ${isolate(r.loan.person.name)}`,
                  other: `Lent to ${isolate(r.loan.person.name)}: # things`,
                })
              : t`Lent to ${isolate(r.loan.person.name)}`,
          ...(stayed.length
            ? {
                description: t`Stayed here: ${stayed.map((x) => isolate(x.name ?? '')).join(', ')}`,
              }
            : {}),
        },
        auditEvents,
        { thingId: thing.id },
      );
      await done();
      onClose();
    } catch (e) {
      setError({ field: 'form', text: errorText(e) });
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
      <PersonPicker
        label={t`Lend to`}
        options={options}
        value={person}
        onChange={(v) => {
          setPerson(v);
          setError(undefined);
        }}
        errorMessage={error?.field === 'person' ? error.text : undefined}
      />
      {thing.quantity > 1 ? (
        <TextField
          label={t`How many`}
          description={t`Of ${fmt.num(thing.quantity)}. Lending some splits them off; they merge back when returned.`}
          value={count}
          onChange={(v) => {
            setCount(v);
            setError(undefined);
          }}
          inputProps={{ inputMode: 'numeric', dir: 'ltr' }}
          {...(error?.field === 'count' ? { errorMessage: error.text, isInvalid: true } : {})}
        />
      ) : null}
      <DatePicker
        label={t`Due back`}
        description={t`Optional. Kept reminds you, never them, two days before and when it's overdue.`}
        value={dueOn}
        onChange={setDueOn}
        minValue={today}
      />
      {contents.length ? (
        <section aria-label={t`What goes with it`} className="grid gap-1.5">
          <span className="eyebrow">
            <Trans>Everything inside goes too</Trans>
          </span>
          <ul className="m-0 grid list-none gap-1 p-0 text-small text-ink-2">
            {contents.map((c) => (
              <li key={c.id} className="[overflow-wrap:anywhere]">
                <bdi dir="auto">{c.name ?? t`Unnamed`}</bdi>
                {c.isContainer ? (
                  <span className="text-ink-3">
                    {' '}
                    <Trans>and what is inside it</Trans>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="m-0 text-small text-ink-3">
            <Trans>
              Each keeps its own record. Something already lent or in repair stays here.
            </Trans>
          </p>
        </section>
      ) : null}
      {elsewhere.length ? (
        <section aria-label={t`Parts kept elsewhere`} className="grid gap-1.5">
          <span className="eyebrow">
            <Trans>Parts not in the kit</Trans>
          </span>
          {elsewhere.map((p) => (
            <TickBox
              key={p.thing.id}
              isSelected={alsoParts.has(p.thing.id)}
              onChange={(on) =>
                setAlsoParts((s) => {
                  const next = new Set(s);
                  if (on) next.add(p.thing.id);
                  else next.delete(p.thing.id);
                  return next;
                })
              }
            >
              {p.where ? (
                <Trans>
                  Lend <bdi>{p.thing.name ?? t`Unnamed`}</bdi> too (in <bdi>{p.where.name}</bdi>)
                </Trans>
              ) : (
                <Trans>
                  Lend <bdi>{p.thing.name ?? t`Unnamed`}</bdi> too
                </Trans>
              )}
            </TickBox>
          ))}
        </section>
      ) : null}
      <ConditionPicker label={t`Condition going out`} value={condition} onChange={setCondition} />
      <TextField label={t`Note`} value={notes} onChange={setNotes} inputProps={{ dir: 'auto' }} />
      {can('attachments.add') ? (
        <PendingFiles
          files={files}
          onChange={setFiles}
          label={t`Condition photos`}
          accept={['image/*']}
        />
      ) : null}
      {error?.field === 'form' ? (
        <p role="alert" className="m-0 text-small text-danger">
          {error.text}
        </p>
      ) : null}
      {blocked ? <p className="m-0 text-small text-ink-3">{blocked}</p> : null}
      <DialogFooter>
        <Button variant="secondary" onPress={onClose}>
          <Trans>Cancel</Trans>
        </Button>
        <Button type="submit" isPending={busy} isDisabled={!!blocked}>
          <Trans>Lend</Trans>
        </Button>
      </DialogFooter>
    </form>
  );
}
