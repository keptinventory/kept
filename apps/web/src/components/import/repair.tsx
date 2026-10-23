/**
 * "Repair this import": a Homebox import that already ran, put right from what it stored (GET
 * /imports/:id/repair). Imports before 1.13.0 turned a quantity of 0 into 1, made a whole type a
 * box type when one of its items held another, and could name a type `global.item`. Each repair
 * is ticked on its own, the things and types it touches are named, and the whole repair has one
 * Undo (its events undone together). Shown on the import's own page, which Activity links to.
 */
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { portabilityApi, portabilityKeys, useImportRepair } from '@/api/portability/queries';
import type { ImportRepairBody, ImportRepairPlan } from '@/api/portability/types';
import { useOfferUndo } from '@/components/history/undo';
import { Notice, useErrorText } from '@/components/page';
import { Button } from '@/components/ui/button';
import { TickBox } from '@/components/ui/tick-box';
import { toast } from '@/components/ui/toast';
import { useOnline } from '@/lib/online';
import { useHomeboxTypeName } from './homebox-choices';

/** At most this many names are listed under a repair; the count says the rest. */
const NAMES_SHOWN = 8;

export function ImportRepair({ runId }: { runId: string }) {
  const plan = useImportRepair(runId, true);
  if (!plan.data) return null;
  const p = plan.data;
  if (p.zero.length + p.containerTypes.length + p.renames.length === 0) return null;
  return <RepairForm runId={runId} plan={p} />;
}

function RepairForm({ runId, plan }: { runId: string; plan: ImportRepairPlan }) {
  const { t, i18n } = useLingui();
  const qc = useQueryClient();
  const online = useOnline();
  const offerUndo = useOfferUndo();
  const errorText = useErrorText();
  const typeName = useHomeboxTypeName();
  const [zero, setZero] = useState(plan.zero.length > 0);
  const [boxTypes, setBoxTypes] = useState(plan.containerTypes.length > 0);
  const [rename, setRename] = useState(plan.renames.length > 0);
  const names = (list: string[]) => {
    const shown = list.slice(0, NAMES_SHOWN);
    const more = list.length - shown.length;
    const joined = new Intl.ListFormat(i18n.locale || 'en', { type: 'conjunction' }).format(shown);
    return more > 0 ? t`${joined}, and ${more} more` : joined;
  };
  const repair = useMutation({
    mutationFn: () => {
      const body: ImportRepairBody = {
        ...(zero && plan.zero.length ? { zero: true } : {}),
        ...(boxTypes && plan.containerTypes.length ? { containerTypes: true } : {}),
        ...(rename && plan.renames.length
          ? { names: { item: typeName('global.item'), location: typeName('global.location') } }
          : {}),
      };
      return portabilityApi.repair(runId, body);
    },
    onSuccess: ({ body, auditEvents }) => {
      qc.setQueryData(portabilityKeys.repair(runId), body.plan);
      void qc.invalidateQueries();
      offerUndo({ title: t`Repaired the import` }, auditEvents, { together: true });
    },
    onError: (e) => toast({ title: errorText(e), tone: 'danger' }),
  });
  const chosen =
    (zero && plan.zero.length > 0) ||
    (boxTypes && plan.containerTypes.length > 0) ||
    (rename && plan.renames.length > 0);

  return (
    <section
      className="grid gap-3 rounded-[10px] border border-line bg-surface p-4"
      aria-labelledby="import-repair"
    >
      <h3 id="import-repair" className="m-0 font-semibold text-[17px]">
        <Trans>Repair this import</Trans>
      </h3>
      <p className="m-0 text-small text-ink-2">
        <Trans>
          It was imported before Kept read Homebox the way it does now. Choose what to put right;
          one Undo takes it all back.
        </Trans>
      </p>
      <div className="grid gap-1">
        {plan.zero.length > 0 ? (
          <TickBox
            isSelected={zero}
            onChange={setZero}
            description={<bdi>{names(plan.zero.map((x) => x.name))}</bdi>}
          >
            <Plural
              value={plan.zero.length}
              one="Archive the # thing that had quantity 0 in Homebox"
              other="Archive the # things that had quantity 0 in Homebox"
            />
          </TickBox>
        ) : null}
        {plan.containerTypes.length > 0 ? (
          <TickBox
            isSelected={boxTypes}
            onChange={setBoxTypes}
            description={
              <Trans>
                <bdi>{names(plan.containerTypes.map((y) => typeName(y.name)))}</bdi>: its things
                stop opening on an empty Contents tab. One that holds things stays a box.
              </Trans>
            }
          >
            <Plural
              value={plan.containerTypes.length}
              one="Make # type an ordinary type again"
              other="Make # types ordinary types again"
            />
          </TickBox>
        ) : null}
        {plan.renames.map((y) => {
          const to = typeName(y.name);
          return (
            <TickBox key={y.typeId} isSelected={rename} onChange={setRename}>
              <Trans>
                Rename <bdi dir="ltr">{y.name}</bdi> to <bdi>{to}</bdi>
              </Trans>
            </TickBox>
          );
        })}
      </div>
      {!online ? <Notice tone="warn" title={<Trans>Needs a connection</Trans>} /> : null}
      <Button
        className="justify-self-start"
        isDisabled={!chosen || !online}
        isPending={repair.isPending}
        onPress={() => repair.mutate()}
      >
        <Trans>Repair</Trans>
      </Button>
    </section>
  );
}
