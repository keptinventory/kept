import { AMOUNT_STRING, newId } from '@kept/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'react';
import { TextField as AriaTextField, FileTrigger, Label, TextArea } from 'react-aria-components';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/field';
import { Select, SelectItem } from '@/components/ui/select';
import { TextField } from '@/components/ui/text-field';
import { sep, useBytes } from '@/lib/format';
import { usePlatform } from './adapters';
import { type CompletionState, type Connection, StorageFullError } from './bridge';
import { type Destination, DestinationPicker, defaultDestination } from './destination';
import { createBox, type InventoryCache } from './inventory';
import { mobileFileLimit, type PendingCapture, type SelectedOriginal, saveOnPhone } from './outbox';

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
  cache,
  pending = [],
  completions = {},
  syncing = false,
  onClose,
  onSave,
}: {
  connection: Connection;
  box?: Destination;
  location?: string;
  cache?: InventoryCache;
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
  const [destination, setDestination] = useState(() => box ?? (cache && defaultDestination(cache)));
  const photosOnly = destination?.kind === 'photos';
  const documentsOnly = destination?.kind === 'documents';
  const evidenceOnly = photosOnly || documentsOnly;
  const [intent, setIntent] = useState<'record' | 'add'>('record');
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

  const canSave =
    destination && (evidenceOnly ? files.length > 0 : !!name.trim() && !quantityInvalid);
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
    if (busy || !canSave || !destination) return;
    setBusy(true);
    setStatus('');
    try {
      const savedId = await saveOnPhone(
        connection,
        {
          locationId: destination.locationId,
          ...(evidenceOnly
            ? { attachToThingId: destination.id }
            : destination.kind === 'place'
              ? { placeId: destination.id }
              : { boxId: destination.id }),
          name: evidenceOnly ? destination.name : name.trim(),
          ...(!evidenceOnly ? { captureIntent: intent } : {}),
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
          {photosOnly
            ? t`Record photos`
            : documentsOnly
              ? t`Add documents`
              : box && box.kind !== 'place'
                ? t`Adding to box`
                : t`Capture inventory`}
        </p>
        {box && (
          <h2 className="text-title font-semibold">
            <bdi>{box.name}</bdi>
          </h2>
        )}
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
        {cache && !box && (
          <DestinationPicker
            cache={cache}
            value={destination}
            onChange={setDestination}
            disabled={busy}
          />
        )}
        {!evidenceOnly && (
          <>
            <Select
              label={t`Action`}
              selectedKey={intent}
              isDisabled={busy}
              items={[
                { id: 'record', label: t`Record existing contents` },
                { id: 'add', label: t`Add contents` },
              ]}
              onSelectionChange={(key) => setIntent(key === 'add' ? 'add' : 'record')}
            >
              {(option) => <SelectItem id={option.id}>{option.label}</SelectItem>}
            </Select>
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
          </>
        )}
        <div className="flex flex-wrap gap-2">
          {!documentsOnly && (
            <>
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
            </>
          )}
          {!photosOnly && (
            <FileTrigger
              acceptedFileTypes={['application/pdf', '.pdf']}
              allowsMultiple
              onSelect={(list) => choose(list, 'document')}
            >
              <Button variant="secondary" isDisabled={busy}>
                <Trans>Attach PDF</Trans>
              </Button>
            </FileTrigger>
          )}
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
                      {role === 'photo' ? t`Photo` : t`PDF document`}
                      {sep()}
                      {formatBytes(file.size)}
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
        <Button type="submit" isPending={busy} isDisabled={!canSave}>
          {photosOnly
            ? t`Save photos`
            : documentsOnly
              ? t`Save documents`
              : box && box.kind !== 'place'
                ? t`Save to box`
                : t`Save capture`}
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
  place,
  onClose,
  onCreated,
}: {
  connection: Connection;
  cache: InventoryCache;
  place?: { id: string; name: string; locationId: string };
  onClose: () => void;
  onCreated: (id: string, locationId: string) => void;
}) {
  const { t } = useLingui();
  const adapters = usePlatform();
  const [name, setName] = useState('');
  const [target, setTarget] = useState<Destination | undefined>(() =>
    place ? { ...place, kind: 'place' } : defaultDestination(cache),
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  async function submit() {
    if (!target || busy) return;
    setBusy(true);
    setStatus('');
    try {
      const result = await createBox(connection, cache, target, name.trim() || t`Box`, adapters);
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
          label={t`Box name (optional)`}
          value={name}
          onChange={setName}
          inputProps={{ maxLength: 200 }}
          isDisabled={busy}
        />
        <DestinationPicker
          cache={cache}
          value={target}
          onChange={setTarget}
          disabled={busy}
          placesOnly
        />
        <Button type="submit" isPending={busy} isDisabled={!target}>
          <Trans>Create box</Trans>
        </Button>
      </form>
      <p role="status" className="text-ink-2">
        {status}
      </p>
    </section>
  );
}
