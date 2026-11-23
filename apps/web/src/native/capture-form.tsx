import { AMOUNT_STRING, newId } from '@kept/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'react';
import { TextField as AriaTextField, FileTrigger, Label, TextArea } from 'react-aria-components';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/field';
import { Select, SelectItem } from '@/components/ui/select';
import { TextField } from '@/components/ui/text-field';
import { useBytes } from '@/lib/format';
import { usePlatform } from './adapters';
import { type CompletionState, type Connection, StorageFullError } from './bridge';
import { createBox, type InventoryCache, inventoryPath } from './inventory';
import { mobileFileLimit, type PendingCapture, type SelectedOriginal, saveOnPhone } from './outbox';

export type Destination = { id: string; locationId: string; name: string };
type ChosenFile = SelectedOriginal & { key: string; previewUrl?: string };

function createPreviewUrl(file: File): string | undefined {
  if (typeof URL.createObjectURL !== 'function') return undefined;
  try {
    return URL.createObjectURL(file);
  } catch {
    return undefined;
  }
}

function revokePreviewUrl(url: string | undefined): void {
  if (url && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
}

export function CaptureForm({
  connection,
  box,
  location,
  pending = [],
  completions = {},
  syncing = false,
  onClose,
  onSave,
}: {
  connection: Connection;
  box: Destination;
  location: string;
  pending?: readonly PendingCapture[];
  /** Durable terminal states; only `synced` counts as synchronized. */
  completions?: Readonly<Record<string, CompletionState>>;
  syncing?: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const { t } = useLingui();
  const adapters = usePlatform();
  const formatBytes = useBytes();
  const [batchId] = useState(newId);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [quantity, setQuantity] = useState('');
  const [files, setFiles] = useState<ChosenFile[]>([]);
  const [batchEntryIds, setBatchEntryIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const previewUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      for (const url of previewUrlsRef.current) revokePreviewUrl(url);
      previewUrlsRef.current = [];
    };
  }, []);

  const quantityInvalid =
    quantity !== '' && (!AMOUNT_STRING.test(quantity) || Number(quantity) <= 0);

  const pendingById = new Map(pending.map((entry) => [entry.capture.id, entry]));
  const batchPendingCount = batchEntryIds.filter((id) => {
    const entry = pendingById.get(id);
    return Boolean(entry && !entry.failure);
  }).length;
  const batchFailedCount = batchEntryIds.filter((id) =>
    Boolean(pendingById.get(id)?.failure),
  ).length;
  // Truthful sync state: an entry counts as synced only with an explicit durable
  // `synced` completion (server confirmed record + attachments). Disappearing
  // from the pending queue — discard, failure cleanup, refresh races — never does.
  const batchSyncedCount = batchEntryIds.filter(
    (id) => !pendingById.has(id) && completions[id] === 'synced',
  ).length;
  const batchDiscardedCount = batchEntryIds.filter(
    (id) => !pendingById.has(id) && completions[id] === 'discarded',
  ).length;

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
    const next: ChosenFile[] = items.map((file) => {
      const previewUrl = role === 'photo' ? createPreviewUrl(file) : undefined;
      if (previewUrl) previewUrlsRef.current.push(previewUrl);
      return { file, role, key: newId(), ...(previewUrl ? { previewUrl } : {}) };
    });
    setFiles((current) => [...current, ...next]);
  }

  function removeFile(key: string) {
    setFiles((current) => {
      const target = current.find((item) => item.key === key);
      if (target?.previewUrl) {
        revokePreviewUrl(target.previewUrl);
        previewUrlsRef.current = previewUrlsRef.current.filter((u) => u !== target.previewUrl);
      }
      return current.filter((item) => item.key !== key);
    });
  }

  async function save() {
    if (busy || !name.trim() || quantityInvalid) return;
    setBusy(true);
    setStatus('');
    try {
      const savedId = await saveOnPhone(
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
        adapters,
      );
      for (const item of files) revokePreviewUrl(item.previewUrl);
      previewUrlsRef.current = [];
      setBatchEntryIds((ids) => [...ids, savedId]);
      setName('');
      setNote('');
      setQuantity('');
      setFiles([]);
      setStatus(t`Saved on device.`);
      onSave();
    } catch (error) {
      setStatus(
        error instanceof StorageFullError
          ? t`Your iPhone storage is full. Free up space and try again.`
          : t`Kept could not save on this iPhone. Check available storage and try again.`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-4">
      <Button className="justify-self-start" variant="ghost" isDisabled={busy} onPress={onClose}>
        <Trans>Done</Trans>
      </Button>
      <header className="grid gap-1 rounded-lg border border-line bg-surface p-3">
        <p className="text-label font-semibold uppercase tracking-wide text-ink-2">
          <Trans>Adding to box</Trans>
        </p>
        <h2 className="text-title font-semibold">
          <bdi>{box.name}</bdi>
        </h2>
        {location && (
          <p className="text-small text-ink-2">
            <bdi>{location}</bdi>
          </p>
        )}
      </header>
      {batchEntryIds.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg bg-sunken px-3 py-2 text-small"
          role="status"
        >
          <span>{t`Entries in this batch: ${batchEntryIds.length}`}</span>
          {batchSyncedCount > 0 && (
            <span className="kept-badge kept-badge-ok">{t`Synced: ${batchSyncedCount}`}</span>
          )}
          {batchPendingCount > 0 && (
            <span className="kept-badge kept-badge-warn">
              {syncing
                ? t`Syncing: ${batchPendingCount}`
                : t`Saved on device: ${batchPendingCount}`}
            </span>
          )}
          {batchFailedCount > 0 && (
            <span className="kept-badge kept-badge-danger">
              {t`Needs attention: ${batchFailedCount}`}
            </span>
          )}
          {batchDiscardedCount > 0 && (
            <span className="kept-badge">{t`Discarded: ${batchDiscardedCount}`}</span>
          )}
        </div>
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
            {files.map(({ file, key, role, previewUrl }) => (
              <li
                className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface p-2"
                key={key}
              >
                <div className="flex min-w-0 items-center gap-3">
                  {previewUrl && (
                    <img src={previewUrl} alt="" className="kept-thumb" loading="lazy" />
                  )}
                  <div className="grid min-w-0 gap-0.5">
                    <bdi className="break-words font-medium">{file.name}</bdi>
                    <span className="text-small text-ink-2">
                      {role === 'photo' ? t`Photo` : t`PDF document`} · {formatBytes(file.size)}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="small"
                  isDisabled={busy}
                  onPress={() => removeFile(key)}
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
  const adapters = usePlatform();
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
      const result = await createBox(connection, cache, target, name.trim(), adapters);
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
