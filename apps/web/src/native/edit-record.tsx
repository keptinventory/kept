import { CONDITIONS } from '@kept/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { ApiError } from '@/api/client';
import { inventoryPaths } from '@/api/inventory/paths';
import type {
  Condition,
  MoveBody,
  MovePreview,
  PlaceView,
  ThingView,
  TrashBody,
} from '@/api/inventory/types';
import { useErrorText } from '@/components/page';
import { formValues, isEmptyPatch, toPatch, validate } from '@/components/things/form-model';
import { useConditionLabels } from '@/components/things/labels';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm';
import { inputClass } from '@/components/ui/field';
import { TextField } from '@/components/ui/text-field';
import { usePlatform } from './adapters';
import type { Connection } from './bridge';
import { type Destination, DestinationPicker } from './destination';
import type { InventoryCache } from './inventory';
import { isAuthRefusal, isRestoreEpochMismatch } from './outbox';

export function EditRecord({
  connection,
  cache,
  thing,
  place,
  mode,
  onClose,
  onChanged,
  onMoved,
  onTrashed,
  onAuthError,
}: {
  connection: Connection;
  cache: InventoryCache;
  thing?: ThingView;
  place?: PlaceView;
  mode: 'edit' | 'move' | 'actions';
  onClose: () => void;
  onChanged: () => void;
  onMoved: (destination: Destination) => void;
  onTrashed: () => void;
  onAuthError?: (reason: 'expired' | 'restored') => void;
}) {
  const { t } = useLingui();
  const adapters = usePlatform();
  const confirm = useConfirm();
  const errorText = useErrorText();
  const conditions = useConditionLabels();
  const [base] = useState(() => thing && formValues(thing));
  const [values, setValues] = useState(base);
  const [roomName, setRoomName] = useState(place?.name ?? '');
  const row = thing ?? place;
  const [rowVersion] = useState(row?.rowVersion);
  const [destination, setDestination] = useState<Destination>();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  if (!row) return null;

  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setStatus('');
    try {
      await work();
    } catch (error) {
      if (isAuthRefusal(error)) onAuthError?.('expired');
      else if (isRestoreEpochMismatch(error)) onAuthError?.('restored');
      else if (error instanceof ApiError && error.status === 412) {
        setStatus(
          t`This record changed while you were editing. Close and reopen it to see the latest version.`,
        );
      } else setStatus(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  function edit() {
    return run(async () => {
      if (thing && base && values) {
        const errors = validate(base, values, thing.fields, {
          nameRequired: t`This needs a value.`,
          tooLong: (max) => t`At most ${max} characters.`,
          number: t`Enter a number.`,
          quantity: t`Enter a whole number, 0 or more.`,
          url: t`Enter a web address starting with https://.`,
          amount: t`Enter an amount, like 1250 or 1250.50.`,
        });
        const message = Object.values(errors)[0];
        if (message) {
          setStatus(message);
          return;
        }
        const body = toPatch(base, values, thing.fields);
        if (!isEmptyPatch(body)) {
          await adapters.transport.request(connection, inventoryPaths.thing(thing.id), {
            method: 'PATCH',
            ifMatch: rowVersion,
            body,
          });
        }
      } else if (place && roomName.trim() && roomName.trim() !== place.name) {
        await adapters.transport.request(connection, inventoryPaths.place(place.id), {
          method: 'PATCH',
          ifMatch: rowVersion,
          body: { name: roomName.trim() },
        });
      }
      onChanged();
    });
  }

  function move() {
    if (!thing || !destination) return;
    const to = destination;
    return run(async () => {
      const body: MoveBody = {
        thingIds: [thing.id],
        to: to.kind === 'box' ? { containerId: to.id } : { placeId: to.id },
      };
      const preview = await adapters.transport.request<MovePreview>(
        connection,
        inventoryPaths.movePreview,
        { method: 'POST', body },
      );
      if (preview.crossLocation || thing.loanLine) {
        const warning = preview.losesSight.length
          ? t`${preview.losesSight.length} people will lose access to this record after the move.`
          : '';
        const loan = thing.loanLine ? t`This item is currently on loan.` : '';
        if (
          !(await confirm({
            title: t`Move to ${to.name}?`,
            body: [preview.targetLocation.name, warning, loan].filter(Boolean).join('\n'),
            confirmLabel: t`Move`,
            cancelLabel: t`Cancel`,
          }))
        )
          return;
      }
      await adapters.transport.request(connection, inventoryPaths.move, {
        method: 'POST',
        body: thing.loanLine ? { ...body, onLoan: 'confirm' } : body,
      });
      onMoved(to);
    });
  }

  function trash() {
    if (!thing) return;
    return run(async () => {
      if (
        !(await confirm({
          title: t`Move to Trash?`,
          body: t`Any contents will stay in inventory and move to this box’s current location.`,
          confirmLabel: t`Move to Trash`,
          cancelLabel: t`Cancel`,
          destructive: true,
        }))
      )
        return;
      const body: TrashBody = { contents: 'move' };
      await adapters.transport.request(connection, inventoryPaths.thingTrash(thing.id), {
        method: 'POST',
        body,
      });
      onTrashed();
    });
  }

  function mark(seen: boolean) {
    if (!thing) return;
    return run(async () => {
      await adapters.transport.request(
        connection,
        seen ? inventoryPaths.thingSeen(thing.id) : inventoryPaths.thingNotHere(thing.id),
        {
          method: 'POST',
          body: {},
          ...(seen ? {} : { ifMatch: rowVersion }),
        },
      );
      onChanged();
    });
  }

  return (
    <section className="grid gap-3 rounded-lg border border-line bg-surface p-3">
      {mode === 'edit' && (
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void edit();
          }}
        >
          {values ? (
            <>
              {(
                [
                  ['name', t`Name`, 200],
                  ['quantity', t`Quantity`, 17],
                  ['model', t`Model`, 200],
                  ['serial', t`Serial number`, 100],
                  ['barcode', t`Barcode`, 64],
                  ['colour', t`Colour`, 80],
                  ['manualUrl', t`Manual URL`, 2048],
                ] as const
              ).map(([key, label, maxLength]) => (
                <TextField
                  key={key}
                  label={label}
                  value={values[key]}
                  isDisabled={busy}
                  onChange={(value) => setValues({ ...values, [key]: value })}
                  inputProps={{
                    maxLength,
                    inputMode:
                      key === 'quantity' ? 'decimal' : key === 'manualUrl' ? 'url' : 'text',
                  }}
                />
              ))}
              <label className="grid gap-1 text-small font-semibold">
                <Trans>Notes</Trans>
                <textarea
                  className={inputClass}
                  value={values.notes}
                  maxLength={5000}
                  rows={4}
                  disabled={busy}
                  onChange={(event) => setValues({ ...values, notes: event.currentTarget.value })}
                />
              </label>
              <label className="grid gap-1 text-small font-semibold">
                <Trans>Type</Trans>
                <select
                  className={inputClass}
                  value={values.typeId ?? ''}
                  disabled={busy}
                  onChange={(event) =>
                    setValues({ ...values, typeId: event.currentTarget.value || null })
                  }
                >
                  <option value="">
                    <Trans>No type</Trans>
                  </option>
                  {cache.types.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-small font-semibold">
                <Trans>Condition</Trans>
                <select
                  className={inputClass}
                  value={values.condition ?? ''}
                  disabled={busy}
                  onChange={(event) =>
                    setValues({
                      ...values,
                      condition: (event.currentTarget.value as Condition) || null,
                    })
                  }
                >
                  <option value="">
                    <Trans>Unspecified</Trans>
                  </option>
                  {CONDITIONS.map((condition) => (
                    <option key={condition} value={condition}>
                      {conditions[condition]}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <TextField
              label={t`Room name`}
              value={roomName}
              onChange={setRoomName}
              inputProps={{ maxLength: 120 }}
              isDisabled={busy}
            />
          )}
          <Button type="submit" isPending={busy} isDisabled={!(values?.name ?? roomName).trim()}>
            <Trans>Save</Trans>
          </Button>
        </form>
      )}
      {mode === 'move' && (
        <div className="grid gap-3">
          <DestinationPicker
            cache={cache}
            value={destination}
            onChange={setDestination}
            disabled={busy}
            exclude={thing?.id}
          />
          <Button
            isDisabled={!destination || destination.id === (thing?.containerId ?? thing?.placeId)}
            isPending={busy}
            onPress={() => void move()}
          >
            <Trans>Move</Trans>
          </Button>
        </div>
      )}
      {mode === 'actions' && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" isDisabled={busy} onPress={() => void mark(true)}>
            <Trans>Seen here</Trans>
          </Button>
          <Button variant="secondary" isDisabled={busy} onPress={() => void mark(false)}>
            <Trans>Not here</Trans>
          </Button>
          <Button variant="secondary" isDisabled={busy} onPress={() => void trash()}>
            <Trans>Move to Trash</Trans>
          </Button>
        </div>
      )}
      <Button variant="ghost" isDisabled={busy} onPress={onClose}>
        <Trans>Cancel</Trans>
      </Button>
      {status && <p role="alert">{status}</p>}
    </section>
  );
}
