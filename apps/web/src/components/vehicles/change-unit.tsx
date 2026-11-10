/**
 * Change unit on a meter (#385, `meters.manage`). An odometer goes between km and mi, either
 * relabelled (the readings were always in the new unit, so every value stays) or converted (every
 * reading, the replacement offset, the daily limit and the schedules on it, 1 mi = 1.609344 km).
 * An hours meter or a custom one is relabelled only. Before saving, the sheet shows what changes
 * (how many readings, the latest one before and after) from the server's preview; the change goes
 * in the vehicle's history and the toast offers Undo.
 */
import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useInvalidateThing } from '@/api/inventory/thing-api';
import type { ThingMeter } from '@/api/inventory/types';
import { vehicleKeys, vehiclesApi } from '@/api/vehicles/queries';
import { useOfferUndo } from '@/components/history/undo';
import { useErrorText } from '@/components/page';
import { useInvalidateHousehold } from '@/components/schedules/access';
import { Sheet } from '@/components/things/sheet';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { ChoiceCards } from '@/components/ui/segmented';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { useFormat } from '@/lib/format';
import { useMeterUnit } from '@/lib/units';

const DISTANCE = ['km', 'mi'];

type How = 'convert' | 'relabel';

export function ChangeUnitSheet({
  meter,
  thingId,
  isOpen,
  onClose,
}: {
  meter: ThingMeter;
  thingId: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useLingui();
  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={(open) => (open ? null : onClose())}
      title={t`Change unit`}
    >
      {isOpen ? <ChangeUnitForm meter={meter} thingId={thingId} onClose={onClose} /> : null}
    </Sheet>
  );
}

function ChangeUnitForm({
  meter,
  thingId,
  onClose,
}: {
  meter: ThingMeter;
  thingId: string;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const fmt = useFormat();
  const unitOf = useMeterUnit();
  const errorText = useErrorText();
  const offerUndo = useOfferUndo();
  const qc = useQueryClient();
  const invalidateThing = useInvalidateThing();
  const invalidateHousehold = useInvalidateHousehold();
  const from = meter.unit.trim().toLowerCase();
  const odometer = meter.kind === 'distance' && DISTANCE.includes(from);
  const [typed, setTyped] = useState(odometer ? '' : meter.unit);
  const [how, setHow] = useState<How>('convert');
  const [busy, setBusy] = useState(false);
  const to = odometer ? (from === 'km' ? 'mi' : 'km') : typed.trim();
  const convert = odometer && how === 'convert';
  const valid = to.length > 0 && to.length <= 12 && to !== meter.unit;
  const preview = useQuery({
    queryKey: ['meters', meter.id, 'unit-preview', to, convert],
    queryFn: () => vehiclesApi.meterUnitPreview(meter.id, { unit: to, convert }),
    enabled: valid,
    staleTime: 0,
  });
  const fromLabel = unitOf(meter.unit);
  const toLabel = unitOf(to);
  const num = (v: string) => fmt.num(Number(v));

  const save = async () => {
    setBusy(true);
    try {
      const { body, auditEvents } = await vehiclesApi.changeMeterUnit(
        meter.id,
        { unit: to, convert },
        meter.rowVersion,
      );
      await Promise.all([
        invalidateThing(thingId),
        invalidateHousehold(),
        qc.invalidateQueries({ queryKey: vehicleKeys.all }),
      ]);
      onClose();
      const n = body.changed.readings;
      offerUndo(
        {
          title: t`Unit changed to ${toLabel}`,
          ...(convert
            ? {
                description: plural(n, {
                  one: '# reading converted',
                  other: '# readings converted',
                }),
              }
            : {}),
        },
        auditEvents,
        { thingId },
      );
    } catch (e) {
      toast({ title: t`Couldn't change the unit`, description: errorText(e), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const p = preview.data;
  return (
    <div className="grid gap-4">
      {odometer ? (
        <>
          <p className="m-0 text-ink">
            <Trans>
              From {fromLabel} to {toLabel}
            </Trans>
          </p>
          <ChoiceCards<How>
            label={t`What to change`}
            value={how}
            onChange={setHow}
            options={[
              {
                id: 'convert',
                title: t`Convert the readings`,
                body: t`Every reading, the replacement offset, the daily limit and the schedules on this odometer change to ${toLabel}.`,
              },
              {
                id: 'relabel',
                title: t`Relabel only`,
                body: t`The readings were always in ${toLabel}. Every value stays as it is.`,
              },
            ]}
          />
        </>
      ) : (
        <>
          <TextField
            label={t`New unit`}
            value={typed}
            onChange={setTyped}
            maxLength={12}
            autoFocus
          />
          <p className="m-0 text-small text-ink-2">
            <Trans>Only the unit's name changes. The readings stay as they are.</Trans>
          </p>
        </>
      )}
      {valid && p ? (
        <div
          role="status"
          className="grid gap-1 rounded-[10px] border border-line bg-sunken p-3 text-small text-ink-2"
        >
          {p.example ? (
            <span className="text-ink">
              <Trans>
                Latest reading: {num(p.example.before)} {fromLabel} becomes {num(p.example.after)}{' '}
                {toLabel}
              </Trans>
            </span>
          ) : (
            <span>
              <Trans>No readings yet.</Trans>
            </span>
          )}
          {convert ? (
            <span>
              {plural(p.readings, {
                one: '# reading changes',
                other: '# readings change',
              })}
            </span>
          ) : null}
          {p.offset ? (
            <span>
              <Trans>
                Replacement offset: {num(p.offset.before)} becomes {num(p.offset.after)}
              </Trans>
            </span>
          ) : null}
          {p.maxPerDay ? (
            <span>
              <Trans>
                Daily limit: {num(p.maxPerDay.before)} becomes {num(p.maxPerDay.after)}
              </Trans>
            </span>
          ) : null}
          {p.schedules > 0 ? (
            <span>
              {plural(p.schedules, {
                one: '# schedule on it changes',
                other: '# schedules on it change',
              })}
            </span>
          ) : null}
          <span>
            <Trans>It goes in the history, and you can undo it.</Trans>
          </span>
        </div>
      ) : null}
      <DialogFooter>
        <Button variant="secondary" onPress={onClose}>
          <Trans>Cancel</Trans>
        </Button>
        <Button variant="primary" isDisabled={!valid} isPending={busy} onPress={() => void save()}>
          <Trans>Change unit</Trans>
        </Button>
      </DialogFooter>
    </div>
  );
}
