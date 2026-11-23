import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'react';
import { capturePaths } from '@/api/capture/paths';
import type { ExtractionsResponse, InboxItem, InboxPage, Suggestion } from '@/api/capture/types';
import { ApiError } from '@/api/client';
import { qs } from '@/api/inventory/paths';
import type { AttachmentView, PlaceView, ThingView } from '@/api/inventory/types';
import { useErrorText } from '@/components/page';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { usePlatform } from './adapters';
import type { Connection } from './bridge';
import type { Destination } from './capture-form';
import {
  type InventoryCache,
  inventoryPath,
  loadDetail,
  loadPlace,
  pendingForBox,
  type RecordDetail,
} from './inventory';
import type { LabelBox } from './label-panel';
import type { Target } from './labels';
import { draftFields, isAuthRefusal, isRestoreEpochMismatch, type PendingCapture } from './outbox';

export type OpenBox = Destination & LabelBox;

function formatSuggestionValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    return value
      .map((entry) =>
        entry && typeof entry === 'object' && 'name' in entry ? String(entry.name) : String(entry),
      )
      .join(', ');
  }
  return '';
}

function SuggestionForm({
  connection,
  thing,
  onChanged,
  onAuthError,
}: {
  connection: Connection;
  thing: ThingView;
  onChanged: () => void;
  onAuthError?: (reason: 'expired' | 'restored') => void;
}) {
  const { t } = useLingui();
  const adapters = usePlatform();
  const errorText = useErrorText();
  const [review, setReview] = useState<InboxItem>();
  const [edit, setEdit] = useState('');
  const [extraSuggestions, setExtraSuggestions] = useState<Suggestion[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function check() {
    setBusy(true);
    setStatus('');
    try {
      const result = await adapters.transport.request<InboxPage>(
        connection,
        `${capturePaths.inbox}${qs({ locationId: thing.locationId, kind: 'draft', limit: 100 })}`,
      );
      const item = result.items.find(
        (entry) => entry.thing?.id === thing.id && (entry.suggestions?.length ?? 0) > 0,
      );
      const name = item?.suggestions?.find((part) => part.field === 'name')?.value;
      if (item && (typeof name === 'string' || (item.suggestions?.length ?? 0) > 0)) {
        setEdit(typeof name === 'string' ? name : (thing.name ?? ''));
        setExtraSuggestions((item.suggestions ?? []).filter((part) => part.field !== 'name'));
        setReview(item);
      } else {
        const attempts = await adapters.transport.request<ExtractionsResponse>(
          connection,
          capturePaths.thingExtractions(thing.id),
        );
        const state = attempts.items[0]?.status;
        setStatus(
          state === 'queued' ||
            state === 'running' ||
            state === 'waiting_provider' ||
            state === 'paused_budget'
            ? t`AI suggestions are still waiting. Your entry is saved.`
            : t`There are no AI suggestions to review. Your entry is saved.`,
        );
      }
    } catch (error) {
      if (isAuthRefusal(error)) {
        onAuthError?.('expired');
        return;
      }
      if (isRestoreEpochMismatch(error)) {
        onAuthError?.('restored');
        return;
      }
      setStatus(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function decide(useEdit: boolean) {
    if (!review) return;
    setBusy(true);
    setStatus('');
    try {
      const suggestionFields = (review.suggestions ?? []).map((entry) => entry.field);
      await adapters.transport.request(connection, capturePaths.inboxAccept(review.id), {
        method: 'POST',
        ifMatch: review.rowVersion,
        body: {
          reject: suggestionFields,
          ...(useEdit ? { set: { name: edit.trim() } } : {}),
        },
      });
      setReview(undefined);
      setExtraSuggestions([]);
      onChanged();
    } catch (error) {
      if (isAuthRefusal(error)) {
        onAuthError?.('expired');
        return;
      }
      if (isRestoreEpochMismatch(error)) {
        onAuthError?.('restored');
        return;
      }
      setStatus(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-3 rounded-lg border border-line bg-surface p-4">
      {review ? (
        <>
          <TextField
            label={t`Suggested description`}
            value={edit}
            onChange={setEdit}
            inputProps={{ maxLength: 200 }}
            isDisabled={busy}
          />
          {extraSuggestions.length > 0 && (
            <ul className="grid gap-1 text-small text-ink-2">
              {extraSuggestions.map((part) => {
                const formatted = formatSuggestionValue(part.value);
                if (!formatted) return null;
                return (
                  <li key={`${part.field}-${part.source.extractionId}`}>
                    <bdi>
                      {part.field}: {formatted}
                    </bdi>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button isPending={busy} isDisabled={!edit.trim()} onPress={() => void decide(true)}>
              <Trans>Use this description</Trans>
            </Button>
            <Button variant="secondary" isDisabled={busy} onPress={() => void decide(false)}>
              <Trans>Keep my description</Trans>
            </Button>
          </div>
        </>
      ) : (
        <Button variant="secondary" isPending={busy} onPress={() => void check()}>
          <Trans>Check AI suggestions</Trans>
        </Button>
      )}
      {status && (
        <p className="text-ink-2" role="status">
          {status}
        </p>
      )}
    </section>
  );
}

export function RecordScreen({
  connection,
  cache,
  target,
  pending = [],
  syncing = false,
  online = true,
  onClose,
  onOpen,
  onCapture,
  onLabel,
  onCache,
  onAuthError,
}: {
  connection: Connection;
  cache: InventoryCache | undefined;
  target: Target;
  pending?: readonly PendingCapture[];
  syncing?: boolean;
  online?: boolean;
  onClose: () => void;
  onOpen: (target: Target) => void;
  onCapture: (box: OpenBox, location: string) => void;
  onLabel: (mode: 'find' | 'enroll', box: OpenBox) => void;
  onCache: (detail: RecordDetail) => void;
  onAuthError?: (reason: 'expired' | 'restored') => void;
}) {
  const { t } = useLingui();
  const adapters = usePlatform();
  const errorText = useErrorText();
  const [detail, setDetail] = useState<{ thing: ThingView; attachments: AttachmentView[] }>();
  const [place, setPlace] = useState<PlaceView>();
  const [unavailable, setUnavailable] = useState(false);
  const [cachedNotice, setCachedNotice] = useState(false);
  const [status, setStatus] = useState('');
  const [request, setRequest] = useState(0);
  const [openingMedia, setOpeningMedia] = useState<string>();
  const describe = useRef(errorText);
  describe.current = errorText;
  const authErrorRef = useRef(onAuthError);
  authErrorRef.current = onAuthError;
  const cached =
    target.kind === 'thing'
      ? cache?.things.find((item) => item.id === target.id)
      : cache?.places.find((item) => item.id === target.id);

  // biome-ignore lint/correctness/useExhaustiveDependencies: accepting a suggestion refreshes the record.
  useEffect(() => {
    let current = true;
    setCachedNotice(false);
    if (target.kind === 'thing') {
      void loadDetail(connection, target.id, adapters)
        .then((next) => {
          if (!current) return;
          setUnavailable(false);
          setCachedNotice(false);
          setDetail(next);
          setStatus('');
          onCache({
            id: next.thing.id,
            notes: next.thing.notes,
            attachments: next.attachments.map(({ id, name, role }) =>
              name === undefined ? { id, role } : { id, name, role },
            ),
          });
        })
        .catch(failed);
    } else {
      void loadPlace(connection, target.id, adapters)
        .then((next) => {
          if (!current) return;
          setUnavailable(false);
          setCachedNotice(false);
          setPlace(next);
          setStatus('');
        })
        .catch(failed);
    }
    function failed(error: unknown) {
      if (!current) return;
      if (isAuthRefusal(error)) {
        authErrorRef.current?.('expired');
        return;
      }
      if (isRestoreEpochMismatch(error)) {
        authErrorRef.current?.('restored');
        return;
      }
      if (error instanceof ApiError) {
        if ([403, 404, 409].includes(error.status)) {
          setDetail(undefined);
          setPlace(undefined);
          setUnavailable(true);
          setStatus(describe.current(error));
          return;
        }
        if (error.status === 0 && cached) {
          setCachedNotice(true);
          setStatus('');
          return;
        }
      }
      setStatus(describe.current(error));
    }
    return () => {
      current = false;
    };
  }, [adapters, connection, onCache, request, target]);

  const thing = detail?.thing;
  const row = thing ?? place ?? cached;
  const name = row?.name ?? t`Untitled`;
  const locationName = cache?.locations.find((location) => location.id === target.locationId)?.name;
  const path =
    row && 'path' in row
      ? [locationName, ...row.path.map((step) => step.name)].filter(Boolean).join(' › ')
      : cached && cache
        ? inventoryPath(cache, cached).join(' › ')
        : '';
  const children =
    cache?.things.filter((item) =>
      target.kind === 'thing'
        ? item.containerId === target.id
        : item.placeId === target.id && !item.containerId,
    ) ?? [];
  const boxPending = target.kind === 'thing' ? pendingForBox(pending, target.id) : [];
  const canEdit = cache?.locations.some(
    (location) => location.id === target.locationId && location.role !== 'viewer',
  );
  const card = cache?.details[target.id];
  const notes = detail ? thing?.notes : card?.notes;
  const attachments = detail?.attachments ?? place?.attachments ?? card?.attachments ?? [];
  const box =
    row && 'isContainer' in row && row.isContainer
      ? { id: row.id, name, locationId: row.locationId, shortCode: row.shortCode }
      : null;

  async function openRemoteFile(attachment: Pick<AttachmentView, 'id' | 'file'>) {
    if (!attachment.file) return;
    setOpeningMedia(attachment.id);
    setStatus('');
    try {
      await adapters.media.openRemote(connection, {
        ...(target.kind === 'thing' ? { thing: target.id } : {}),
        file: attachment.file.id,
        mime: attachment.file.mime,
      });
    } catch (error) {
      if (isAuthRefusal(error)) {
        onAuthError?.('expired');
        return;
      }
      if (isRestoreEpochMismatch(error)) {
        onAuthError?.('restored');
        return;
      }
      setStatus(errorText(error));
    } finally {
      setOpeningMedia(undefined);
    }
  }

  async function openPendingFile(draftId: string, fileId: string) {
    const key = `${draftId}:${fileId}`;
    setOpeningMedia(key);
    setStatus('');
    try {
      await adapters.media.openPending(connection, { id: draftId, file: fileId });
    } catch (error) {
      setStatus(errorText(error));
    } finally {
      setOpeningMedia(undefined);
    }
  }

  return (
    <section className="grid gap-5">
      <Button className="justify-self-start" variant="ghost" onPress={onClose}>
        <Trans>Back</Trans>
      </Button>
      {unavailable || !row ? (
        <p role="status">{status || t`Opening inventory…`}</p>
      ) : (
        <>
          <header className="grid gap-1">
            <h2 className="text-display font-semibold">
              <bdi>{name}</bdi>
            </h2>
            {path && (
              <p className="text-ink-2">
                <bdi>{path}</bdi>
              </p>
            )}
            {'shortCode' in row && row.shortCode && (
              <p className="text-small text-ink-2">
                <Trans>Label code:</Trans> <bdi className="ltr">{row.shortCode}</bdi>
              </p>
            )}
            {'quantity' in row && Number(row.quantity) !== 1 && (
              <p className="text-ink-2">{t`Quantity: ${row.quantity}`}</p>
            )}
            {(cachedNotice || (!online && !detail && !place)) && cache && (
              <p className="text-small text-ink-2" role="status">
                {t`Showing cached details from ${new Date(cache.asOf).toLocaleString()}`}
              </p>
            )}
          </header>
          {box && (
            <div className="flex flex-wrap gap-2">
              {canEdit && (
                <Button onPress={() => onCapture(box, path)}>
                  <Trans>Add to this box</Trans>
                </Button>
              )}
              <Button variant="secondary" onPress={() => onLabel('find', box)}>
                <Trans>Find this box</Trans>
              </Button>
              {box.shortCode && (
                <Button variant="secondary" onPress={() => onLabel('enroll', box)}>
                  {canEdit ? <Trans>QR and NFC label</Trans> : <Trans>View QR label</Trans>}
                </Button>
              )}
            </div>
          )}
          {notes && (
            <section>
              <h3 className="font-semibold">
                <Trans>Notes</Trans>
              </h3>
              <p className="whitespace-pre-wrap break-words">
                <bdi>{notes}</bdi>
              </p>
            </section>
          )}
          {boxPending.length > 0 && (
            <section className="grid gap-2 rounded-lg border border-line bg-surface p-3">
              <h3 className="font-semibold">
                <Trans>Pending in this box</Trans>
              </h3>
              <ul className="grid gap-2">
                {boxPending.map((entry) => {
                  const fields = draftFields(entry.capture);
                  return (
                    <li key={entry.capture.id} className="grid gap-2 rounded-lg bg-sunken p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <bdi className="font-semibold">{fields.name}</bdi>
                        <span
                          className={
                            entry.failure
                              ? 'kept-badge kept-badge-danger'
                              : 'kept-badge kept-badge-warn'
                          }
                        >
                          {entry.failure
                            ? t`Needs attention`
                            : syncing
                              ? t`Syncing…`
                              : t`Saved on device`}
                        </span>
                      </div>
                      {fields.note && (
                        <p className="text-small text-ink-2">
                          <bdi>{fields.note}</bdi>
                        </p>
                      )}
                      {entry.capture.files.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {entry.capture.files.map(({ file }) => {
                            const key = `${entry.capture.id}:${file.id}`;
                            return (
                              <Button
                                key={file.id}
                                size="small"
                                variant="secondary"
                                isPending={openingMedia === key}
                                isDisabled={openingMedia !== undefined && openingMedia !== key}
                                onPress={() => void openPendingFile(entry.capture.id, file.id)}
                              >
                                <bdi>{file.name}</bdi>
                              </Button>
                            );
                          })}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {attachments.length > 0 && (
            <section>
              <h3 className="font-semibold">
                <Trans>Photographs and documents</Trans>
              </h3>
              <ul className="mt-2 grid gap-2">
                {attachments.map((attachment) => {
                  const label =
                    attachment.name ?? (attachment.role === 'photo' ? t`Photograph` : t`Document`);
                  const remoteList = detail?.attachments ?? place?.attachments;
                  const original = remoteList?.find((entry) => entry.id === attachment.id);
                  return (
                    <li key={attachment.id}>
                      {original?.file ? (
                        <Button
                          variant="secondary"
                          isPending={openingMedia === attachment.id}
                          isDisabled={openingMedia !== undefined && openingMedia !== attachment.id}
                          onPress={() => void openRemoteFile(original)}
                        >
                          <bdi>{label}</bdi>
                        </Button>
                      ) : (
                        <span className="text-ink-2">
                          <bdi>{label}</bdi>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {(box || target.kind === 'place') && (
            <section>
              <h3 className="font-semibold">
                <Trans>Contents</Trans>
              </h3>
              {children.length === 0 ? (
                <p className="text-ink-2">
                  <Trans>No cached contents.</Trans>
                </p>
              ) : (
                <ul className="mt-2 grid gap-2">
                  {children.map((child) => (
                    <li key={child.id}>
                      <Button
                        variant="secondary"
                        className="w-full justify-start text-start"
                        onPress={() =>
                          onOpen({ id: child.id, kind: 'thing', locationId: child.locationId })
                        }
                      >
                        <bdi>{child.name ?? t`Untitled`}</bdi>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {thing && canEdit && detail.attachments.some((entry) => entry.role === 'photo') && (
            <SuggestionForm
              connection={connection}
              thing={thing}
              onChanged={() => setRequest((value) => value + 1)}
              onAuthError={onAuthError}
            />
          )}
          {status && (
            <p className="text-ink-2" role="status">
              {status}
            </p>
          )}
        </>
      )}
    </section>
  );
}
