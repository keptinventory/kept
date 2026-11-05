/**
 * The selection bar (#366): one bar for a place's List, its Grid and the spreadsheet. It says
 * how many are selected (announced to screen readers as it changes), carries the host's own
 * actions first (Move, Tags, Set a field: what the host stages or does at once), then the ones
 * that are the same everywhere: Pick up into this phone's carrying tray (D175, works offline),
 * Print labels where the Labels module is on, Add to incident and Claim pack for owners and
 * admins (D158, online), the host's Trash, and Done.
 *
 * Precached: the List's Pick up must work offline. What it opens on demand loads on demand.
 */
import { can } from '@kept/shared';
import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useNavigate } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { useAllLocations } from '@/api/queries';
import { CheckIcon } from '@/components/icons';
import { AddToIncidentSheet } from '@/components/incidents/lazy';
import { useScanStore } from '@/components/scan/use-scan-store';
import { TrayIcon } from '@/components/tray/tray-icon';
import { pickUp } from '@/components/tray/use-tray';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { useFormat } from '@/lib/format';
import { useOnline } from '@/lib/online';

export function SelectionBar({
  ids,
  locationId,
  collapsed = false,
  children,
  trash,
  doneLabel,
  onDone,
}: {
  /** The selected things, in the list's order. */
  ids: readonly string[];
  locationId: string;
  /** Nothing selected and nothing to show: only the announcement stays, so the first tick is
   * heard too (the spreadsheet shows the bar once a row is selected). */
  collapsed?: boolean;
  /** The host's own actions: Move, Tags, Set a field. */
  children?: ReactNode;
  /** The host's Send to Trash. */
  trash?: ReactNode;
  doneLabel: ReactNode;
  /** Done, and after an action that ends the selection (picked up, added to an incident). */
  onDone: () => void;
}) {
  const { t } = useLingui();
  const fmt = useFormat();
  const navigate = useNavigate();
  const online = useOnline();
  const here = useAllLocations().data?.find((l) => l.id === locationId);
  const modules = here ? (here.effectiveModules ?? here.modules) : [];
  const canLabel = !!here && modules.includes('labels') && can(here.role, 'labels.use');
  const canIncident =
    !!here && modules.includes('warranties') && can(here.role, 'incidents.manage');
  const n = ids.length;
  const none = n === 0;

  // "Pick up" (D175): into this phone's carrying tray.
  const trayStore = useScanStore();
  const [pickingUp, setPickingUp] = useState(false);
  const pickUpSelected = async () => {
    if (!trayStore || none) return;
    setPickingUp(true);
    try {
      const carried = await pickUp(trayStore, [...ids]);
      toast({
        title: plural(n, { one: 'Picked up # thing', other: 'Picked up # things' }),
        description: plural(carried.length, { one: 'Carrying #', other: 'Carrying #' }),
        tone: 'ok',
        action: {
          label: t`Scan destination`,
          onAction: () => void navigate({ to: '/scan', search: { tray: 1 } }),
        },
      });
      onDone();
    } catch {
      toast({ title: t`Couldn't pick them up on this phone.`, tone: 'danger' });
    } finally {
      setPickingUp(false);
    }
  };
  const [incidentFor, setIncidentFor] = useState<string[]>([]);

  const count = none ? (
    <Trans>Choose things</Trans>
  ) : (
    <Trans>
      <span className="tabular-nums">{fmt.num(n)}</span> selected
    </Trans>
  );
  return (
    <>
      {/* The count, announced as it changes: always here, so the first tick is announced too. */}
      <p role="status" className="sr-only">
        {collapsed ? null : count}
      </p>
      {collapsed ? null : (
        <div
          role="toolbar"
          aria-label={t`Selection`}
          className="flex flex-wrap items-center gap-2 rounded-[10px] border border-line bg-surface p-2"
        >
          <span
            aria-hidden="true"
            className="flex flex-1 items-center gap-2 ps-1 text-[14px] font-medium"
          >
            <CheckIcon className="size-4" />
            {count}
          </span>
          {children}
          {trayStore ? (
            <Button
              size="small"
              variant="secondary"
              isDisabled={none}
              isPending={pickingUp}
              onPress={() => void pickUpSelected()}
              className="[&_svg]:size-4"
            >
              <TrayIcon />
              <Trans>Pick up</Trans>
            </Button>
          ) : null}
          {canLabel ? (
            <Button
              size="small"
              variant="secondary"
              isDisabled={none}
              onPress={() =>
                void navigate({ to: '/labels', search: { loc: locationId, things: ids.join(',') } })
              }
            >
              <Trans>Print labels</Trans>
            </Button>
          ) : null}
          {canIncident ? (
            <>
              <Button
                size="small"
                variant="secondary"
                isDisabled={none || !online}
                onPress={() => setIncidentFor([...ids])}
              >
                <Trans>Add to incident</Trans>
              </Button>
              <Button
                size="small"
                variant="secondary"
                isDisabled={none || !online}
                onPress={() =>
                  void navigate({
                    to: '/reports/$kind',
                    params: { kind: 'claim-pack' },
                    search: { loc: locationId, things: ids.join(',') },
                  })
                }
              >
                <Trans>Claim pack</Trans>
              </Button>
            </>
          ) : null}
          {trash}
          <Button size="small" variant="ghost" onPress={onDone}>
            {doneLabel}
          </Button>
        </div>
      )}
      {incidentFor.length ? (
        <AddToIncidentSheet
          locationId={locationId}
          thingIds={incidentFor}
          onClose={() => setIncidentFor([])}
          onAdded={onDone}
        />
      ) : null}
    </>
  );
}
