import { newId } from '@kept/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { capturePaths } from '@/api/capture/paths';
import type { ClaimBody, ClaimResult, LabelClaimedDetails } from '@/api/capture/types';
import { ApiError } from '@/api/client';
import { useErrorText } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Select, SelectItem } from '@/components/ui/select';
import { TextField } from '@/components/ui/text-field';
import { usePlatform } from './adapters';
import type { Connection } from './bridge';
import { type Destination, DestinationPicker } from './destination';
import type { InventoryCache } from './inventory';
import type { Target } from './labels';
import { isAuthRefusal, isRestoreEpochMismatch } from './outbox';

export function ClaimBinLabel({
  connection,
  cache,
  locationId,
  code,
  onOpen,
  onAuthError,
}: {
  connection: Connection;
  cache: InventoryCache;
  locationId: string;
  code: string;
  onOpen: (target: Target) => void;
  onAuthError?: (reason: 'expired' | 'restored') => void;
}) {
  const { t } = useLingui();
  const adapters = usePlatform();
  const errorText = useErrorText();
  const [existingId, setExistingId] = useState<string>();
  const [destination, setDestination] = useState<Destination>();
  const [name, setName] = useState('');
  const [id, setId] = useState(newId);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [claimed, setClaimed] = useState<LabelClaimedDetails['claimedFor']>();
  const boxes = cache.things.filter(
    (thing) => thing.locationId === locationId && thing.isContainer,
  );

  async function submit() {
    if (busy) return;
    let body: ClaimBody;
    if (existingId) body = { thingId: existingId };
    else if (destination)
      body = { newContainer: { id, name: name.trim() || t`Box`, placeId: destination.id } };
    else return;
    setBusy(true);
    setStatus('');
    try {
      const result = await adapters.transport.request<ClaimResult>(
        connection,
        capturePaths.codeClaim(code),
        {
          method: 'POST',
          body,
          idempotencyKey: id,
        },
      );
      onOpen({ ...result.target, locationId });
    } catch (error) {
      if (isAuthRefusal(error)) onAuthError?.('expired');
      else if (isRestoreEpochMismatch(error)) onAuthError?.('restored');
      else {
        setStatus(errorText(error));
        if (
          error instanceof ApiError &&
          (error.code === 'label_claimed' || error.serverCode === 'label_claimed')
        ) {
          setClaimed(error.details.claimedFor as LabelClaimedDetails['claimedFor'] | undefined);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-3 rounded-lg border border-line p-3">
      <h3 className="font-semibold">
        <Trans>Assign label</Trans> <bdi>{code}</bdi>
      </h3>
      {claimed ? (
        <Button variant="secondary" onPress={() => onOpen({ ...claimed, locationId })}>
          <Trans>Open</Trans> <bdi>{claimed.name}</bdi>
        </Button>
      ) : (
        <>
          <Select
            label={t`Box`}
            items={[{ id: 'new', name: t`Create box` }, ...boxes]}
            selectedKey={existingId ?? 'new'}
            isDisabled={busy}
            onSelectionChange={(key) => {
              setExistingId(key && key !== 'new' ? String(key) : undefined);
              setId(newId());
            }}
          >
            {(option) => (
              <SelectItem id={option.id}>
                <bdi>{option.name ?? t`Untitled`}</bdi>
              </SelectItem>
            )}
          </Select>
          {!existingId && (
            <>
              <TextField
                label={t`Box name (optional)`}
                value={name}
                isDisabled={busy}
                inputProps={{ maxLength: 200 }}
                onChange={(value) => {
                  setName(value);
                  setId(newId());
                }}
              />
              <DestinationPicker
                cache={cache}
                value={destination}
                placesOnly
                onlyLocation={locationId}
                disabled={busy}
                onChange={(value) => {
                  setDestination(value);
                  setId(newId());
                }}
              />
            </>
          )}
          <Button
            isPending={busy}
            isDisabled={!existingId && !destination}
            onPress={() => void submit()}
          >
            <Trans>Assign label</Trans>
          </Button>
        </>
      )}
      {status && <p role="alert">{status}</p>}
    </section>
  );
}
