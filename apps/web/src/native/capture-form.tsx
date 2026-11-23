import { AMOUNT_STRING, newId } from '@kept/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { TextField as AriaTextField, FileTrigger, Label, TextArea } from 'react-aria-components';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/field';
import { Select, SelectItem } from '@/components/ui/select';
import { TextField } from '@/components/ui/text-field';
import type { Connection } from './bridge';
import { createBox, type InventoryCache, inventoryPath } from './inventory';
import { mobileFileLimit, type SelectedOriginal, saveOnPhone } from './outbox';

export type Destination = { id: string; locationId: string; name: string };
type ChosenFile = SelectedOriginal & { key: string };

export function CaptureForm({
  connection,
  box,
  location,
  onClose,
  onSave,
}: {
  connection: Connection;
  box: Destination;
  location: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const { t } = useLingui();
  const [batchId] = useState(newId);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [quantity, setQuantity] = useState('');
  const [files, setFiles] = useState<ChosenFile[]>([]);
  const [saved, setSaved] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const quantityInvalid =
    quantity !== '' && (!AMOUNT_STRING.test(quantity) || Number(quantity) <= 0);

  function choose(source: FileList | null, role: SelectedOriginal['role']) {
    if (!source) return;
    const items = Array.from(source);
    if (
      items.some((file) => file.size === 0 || file.size > mobileFileLimit) ||
      files.length + items.length > 20
    ) {
      setStatus(t`Choose up to 20 files, each no larger than 25 MB.`);
      return;
    }
    setStatus('');
    setFiles((current) => [...current, ...items.map((file) => ({ file, role, key: newId() }))]);
  }

  async function save() {
    if (busy || !name.trim() || quantityInvalid) return;
    setBusy(true);
    setStatus('');
    try {
      await saveOnPhone(
        connection,
        {
          locationId: box.locationId,
          boxId: box.id,
          name: name.trim(),
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(quantity ? { quantity } : {}),
          batchId,
        },
        files,
      );
      setSaved((count) => count + 1);
      setName('');
      setNote('');
      setQuantity('');
      setFiles([]);
      setStatus(t`Saved on device.`);
      onSave();
    } catch {
      setStatus(t`Kept could not save on this iPhone. Check available storage and try again.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-4">
      <Button className="justify-self-start" variant="ghost" isDisabled={busy} onPress={onClose}>
        <Trans>Done</Trans>
      </Button>
      <header>
        <h2 className="text-title font-semibold">
          <Trans>Add to this box</Trans>
        </h2>
        <p className="font-semibold">
          <bdi>{box.name}</bdi>
        </p>
        <p className="text-ink-2">{location}</p>
      </header>
      {saved > 0 && (
        <p className="text-small text-ink-2">{t`Entries saved in this batch: ${saved}`}</p>
      )}
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <TextField
          label={t`Description`}
          placeholder={t`Holiday decorations`}
          value={name}
          onChange={setName}
          isDisabled={busy}
          inputProps={{ maxLength: 200 }}
        />
        <AriaTextField className="grid gap-1" value={note} onChange={setNote} isDisabled={busy}>
          <Label className="text-small font-semibold">
            <Trans>Notes</Trans>
          </Label>
          <TextArea className={inputClass} maxLength={500} rows={3} />
        </AriaTextField>
        <TextField
          label={t`Quantity (optional)`}
          value={quantity}
          onChange={setQuantity}
          isDisabled={busy}
          isInvalid={quantityInvalid}
          errorMessage={quantityInvalid ? t`Enter a quantity greater than zero.` : undefined}
          inputProps={{ inputMode: 'decimal', maxLength: 17 }}
        />
        <div className="flex flex-wrap gap-2">
          <FileTrigger
            acceptedFileTypes={['image/*']}
            defaultCamera="environment"
            onSelect={(list) => choose(list, 'photo')}
          >
            <Button variant="secondary" isDisabled={busy}>
              <Trans>Take a photo</Trans>
            </Button>
          </FileTrigger>
          <FileTrigger
            acceptedFileTypes={['image/*']}
            allowsMultiple
            onSelect={(list) => choose(list, 'photo')}
          >
            <Button variant="secondary" isDisabled={busy}>
              <Trans>Choose photos</Trans>
            </Button>
          </FileTrigger>
          <FileTrigger
            acceptedFileTypes={['application/pdf', '.pdf']}
            allowsMultiple
            onSelect={(list) => choose(list, 'document')}
          >
            <Button variant="secondary" isDisabled={busy}>
              <Trans>Attach PDF</Trans>
            </Button>
          </FileTrigger>
        </div>
        {files.length > 0 && (
          <ul className="grid gap-2">
            {files.map(({ file, key }) => (
              <li className="flex items-center justify-between gap-3" key={key}>
                <bdi className="min-w-0 break-words">{file.name}</bdi>
                <Button
                  variant="ghost"
                  isDisabled={busy}
                  onPress={() => setFiles((current) => current.filter((item) => item.key !== key))}
                >
                  <Trans>Remove</Trans>
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button type="submit" isPending={busy} isDisabled={!name.trim() || quantityInvalid}>
          <Trans>Save to box</Trans>
        </Button>
      </form>
      <p role="status" className="text-ink-2">
        {status}
      </p>
    </section>
  );
}

export function NewBoxForm({
  connection,
  cache,
  onClose,
  onCreated,
}: {
  connection: Connection;
  cache: InventoryCache;
  onClose: () => void;
  onCreated: (id: string, locationId: string) => void;
}) {
  const { t } = useLingui();
  const [name, setName] = useState('');
  const [locationId, setLocation] = useState<string | null>(null);
  const [placeId, setPlace] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const locations = cache.locations.filter((location) => location.role !== 'viewer');
  const location = locations.find((entry) => entry.id === locationId) ?? locations[0];
  const places = cache.places.filter((place) => place.locationId === location?.id);
  const target = places.find((place) => place.id === (placeId ?? location?.unplacedPlaceId));

  async function submit() {
    if (!target || !name.trim() || busy) return;
    setBusy(true);
    setStatus('');
    try {
      const result = await createBox(connection, cache, target, name.trim());
      onCreated(result.id, result.locationId);
    } catch {
      setStatus(t`Could not create the box. Check your connection and selected location.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-4">
      <Button className="justify-self-start" variant="ghost" onPress={onClose} isDisabled={busy}>
        <Trans>Back</Trans>
      </Button>
      <h2 className="text-title font-semibold">
        <Trans>Create a box</Trans>
      </h2>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <TextField
          label={t`Box name`}
          value={name}
          onChange={setName}
          inputProps={{ maxLength: 200 }}
          isDisabled={busy}
        />
        <Select
          label={t`Location`}
          items={locations}
          selectedKey={location?.id ?? null}
          onSelectionChange={(key) => {
            setLocation(key === null ? null : String(key));
            setPlace(null);
          }}
          isDisabled={busy}
        >
          {(item) => (
            <SelectItem id={item.id} textValue={item.name}>
              <bdi>{item.name}</bdi>
            </SelectItem>
          )}
        </Select>
        <Select
          label={t`Place`}
          items={places}
          selectedKey={target?.id ?? null}
          onSelectionChange={(key) => setPlace(key === null ? null : String(key))}
          isDisabled={busy}
        >
          {(place) => {
            const path = [...inventoryPath(cache, place).slice(1), place.name].join(' › ');
            return (
              <SelectItem id={place.id} textValue={path}>
                <bdi>{path}</bdi>
              </SelectItem>
            );
          }}
        </Select>
        <Button type="submit" isPending={busy} isDisabled={!name.trim() || !target}>
          <Trans>Create box</Trans>
        </Button>
      </form>
      <p role="status" className="text-ink-2">
        {status}
      </p>
    </section>
  );
}
