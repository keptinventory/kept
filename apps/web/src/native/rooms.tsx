import { newId } from '@kept/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { inventoryPaths } from '@/api/inventory/paths';
import type { CreatePlaceBody, PlaceView } from '@/api/inventory/types';
import { useErrorText } from '@/components/page';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { usePlatform } from './adapters';
import type { Connection } from './bridge';
import { LocationPicker, writableLocations } from './destination';
import { type InventoryCache, inventoryPath } from './inventory';
import type { Target } from './labels';
import { isAuthRefusal, isRestoreEpochMismatch } from './outbox';

export function Rooms({
  cache,
  connection,
  online,
  onOpen,
  onCreated,
  onClose,
  onAuthError,
}: {
  cache: InventoryCache;
  connection: Connection;
  online: boolean;
  onOpen: (target: Target) => void;
  onCreated: (target: Target) => void;
  onClose: () => void;
  onAuthError: (reason: 'expired' | 'restored') => void;
}) {
  const { t } = useLingui();
  const adapters = usePlatform();
  const errorText = useErrorText();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [id, setId] = useState(newId);
  const locations = writableLocations(cache);
  const [locationId, setLocationId] = useState(locations[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const rooms = cache.places.filter((place) => place.kindKey === 'room' && !place.isUnplaced);

  async function create() {
    if (busy || !online || !locationId || !name.trim()) return;
    setBusy(true);
    setStatus('');
    try {
      const body: CreatePlaceBody = { id, name: name.trim(), kindKey: 'room' };
      const room = await adapters.transport.request<PlaceView>(
        connection,
        inventoryPaths.locationPlaces(locationId),
        { method: 'POST', body, idempotencyKey: id },
      );
      onCreated({ kind: 'place', id: room.id, locationId: room.locationId });
    } catch (error) {
      if (isAuthRefusal(error)) onAuthError('expired');
      else if (isRestoreEpochMismatch(error)) onAuthError('restored');
      else setStatus(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-4">
      <Button variant="ghost" className="justify-self-start" onPress={onClose}>
        <Trans>Back</Trans>
      </Button>
      <h2 className="text-title font-semibold">
        <Trans>Rooms</Trans>
      </h2>
      {adding ? (
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <TextField
            label={t`Room name`}
            value={name}
            onChange={(value) => {
              setName(value);
              setId(newId());
            }}
            isDisabled={busy}
            inputProps={{ maxLength: 120 }}
          />
          <LocationPicker
            cache={cache}
            value={locationId}
            onChange={(value) => {
              setLocationId(value);
              setId(newId());
            }}
            disabled={busy}
          />
          <Button
            type="submit"
            isPending={busy}
            isDisabled={!online || !locationId || !name.trim()}
          >
            <Trans>Create room</Trans>
          </Button>
          <Button variant="ghost" isDisabled={busy} onPress={() => setAdding(false)}>
            <Trans>Cancel</Trans>
          </Button>
          {status && <p role="alert">{status}</p>}
        </form>
      ) : (
        <Button
          className="justify-self-start"
          isDisabled={!online || !locations.length}
          onPress={() => setAdding(true)}
        >
          <Trans>Create room</Trans>
        </Button>
      )}
      {rooms.length ? (
        <ul className="grid gap-2">
          {rooms.map((room) => (
            <li key={room.id}>
              <Button
                variant="secondary"
                className="kept-phone-row"
                onPress={() => onOpen({ kind: 'place', id: room.id, locationId: room.locationId })}
              >
                <bdi>{room.name}</bdi>
                <span className="text-small font-normal">
                  <bdi>{inventoryPath(cache, room).join(' › ')}</bdi>
                </span>
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          <Trans>No rooms yet.</Trans>
        </p>
      )}
    </section>
  );
}
