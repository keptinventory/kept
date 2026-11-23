import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'react';
import { capturePaths } from '@/api/capture/paths';
import type { ExtractionsResponse, InboxItem, InboxPage } from '@/api/capture/types';
import { ApiError } from '@/api/client';
import { qs } from '@/api/inventory/paths';
import type { AttachmentView, PlaceView, ThingView } from '@/api/inventory/types';
import { useErrorText } from '@/components/page';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { type Connection, native, nativeRequest } from './bridge';
import type { Destination } from './capture-form';
import {
  type InventoryCache,
  inventoryPath,
  loadDetail,
  loadPlace,
  type RecordDetail,
} from './inventory';
import type { LabelBox } from './label-panel';
import type { Target } from './labels';

export type OpenBox = Destination & LabelBox;

function SuggestionForm({
  connection,
  thing,
  onChanged,
}: {
  connection: Connection;
  thing: ThingView;
  onChanged: () => void;
}) {
  const { t } = useLingui();
  const errorText = useErrorText();
  const [review, setReview] = useState<InboxItem>();
  const [edit, setEdit] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function check() {
    setBusy(true);
    setStatus('');
    try {
      const result = await nativeRequest<InboxPage>(
        connection,
        `${capturePaths.inbox}${qs({ locationId: thing.locationId, q: thing.name ?? undefined, kind: 'draft', limit: 100 })}`,
      );
      const item = result.items.find(
        (entry) =>
          entry.thing?.id === thing.id &&
          entry.suggestions?.some(
            (part) => part.field === 'name' && typeof part.value === 'string',
          ),
      );
      const name = item?.suggestions?.find((part) => part.field === 'name')?.value;
      if (item && typeof name === 'string') {
        setEdit(name);
        setReview(item);
      } else {
        const attempts = await nativeRequest<ExtractionsResponse>(
          connection,
          capturePaths.thingExtractions(thing.id),
        );
        const status = attempts.items[0]?.status;
        setStatus(
          status === 'queued' ||
            status === 'running' ||
            status === 'waiting_provider' ||
            status === 'paused_budget'
            ? t`AI suggestions are still waiting. Your entry is saved.`
            : t`There are no AI suggestions to review. Your entry is saved.`,
        );
      }
    } catch (error) {
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
      await nativeRequest(connection, capturePaths.inboxAccept(review.id), {
        method: 'POST',
        ifMatch: review.rowVersion,
        body: { reject: ['name'], ...(useEdit ? { set: { name: edit.trim() } } : {}) },
      });
      setReview(undefined);
      onChanged();
    } catch (error) {
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
  onClose,
  onOpen,
  onCapture,
  onLabel,
  onCache,
}: {
  connection: Connection;
  cache: InventoryCache | undefined;
  target: Target;
  onClose: () => void;
  onOpen: (target: Target) => void;
  onCapture: (box: OpenBox, location: string) => void;
  onLabel: (mode: 'find' | 'enroll', box: OpenBox) => void;
  onCache: (detail: RecordDetail) => void;
}) {
  const { t } = useLingui();
  const errorText = useErrorText();
  const [detail, setDetail] = useState<{ thing: ThingView; attachments: AttachmentView[] }>();
  const [place, setPlace] = useState<PlaceView>();
  const [unavailable, setUnavailable] = useState(false);
  const [status, setStatus] = useState('');
  const [request, setRequest] = useState(0);
  const [openingMedia, setOpeningMedia] = useState<string>();
  const describe = useRef(errorText);
  describe.current = errorText;
  const cached =
    target.kind === 'thing'
      ? cache?.things.find((item) => item.id === target.id)
      : cache?.places.find((item) => item.id === target.id);

  // biome-ignore lint/correctness/useExhaustiveDependencies: accepting a suggestion refreshes the record.
  useEffect(() => {
    let current = true;
    if (target.kind === 'thing') {
      void loadDetail(connection, target.id)
        .then((next) => {
          if (!current) return;
          setUnavailable(false);
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
      void loadPlace(connection, target.id)
        .then((next) => {
          if (!current) return;
          setUnavailable(false);
          setPlace(next);
          setStatus('');
        })
        .catch(failed);
    }
    function failed(error: unknown) {
      if (!current) return;
      if (error instanceof ApiError && [401, 403, 404, 409].includes(error.status)) {
        setDetail(undefined);
        setPlace(undefined);
        setUnavailable(true);
      }
      setStatus(describe.current(error));
    }
    return () => {
      current = false;
    };
  }, [connection, onCache, request, target]);

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
  const canEdit = cache?.locations.some(
    (location) => location.id === target.locationId && location.role !== 'viewer',
  );
  const card = cache?.details[target.id];
  const notes = detail ? thing?.notes : card?.notes;
  const attachments = detail?.attachments ?? card?.attachments ?? [];
  const box =
    row && 'isContainer' in row && row.isContainer
      ? { id: row.id, name, locationId: row.locationId, shortCode: row.shortCode }
      : null;

  async function openFile(attachment: Pick<AttachmentView, 'id' | 'file'>) {
    if (!attachment.file) return;
    setOpeningMedia(attachment.id);
    setStatus('');
    try {
      await native.openMedia({
        context: connection.id,
        thing: target.id,
        file: attachment.file.id,
        mime: attachment.file.mime,
      });
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
          <header>
            <h2 className="text-display font-semibold">
              <bdi>{name}</bdi>
            </h2>
            {path && (
              <p className="text-ink-2">
                <bdi>{path}</bdi>
              </p>
            )}
            {'quantity' in row && Number(row.quantity) !== 1 && (
              <p className="text-ink-2">{t`Quantity: ${row.quantity}`}</p>
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
          {attachments.length > 0 && (
            <section>
              <h3 className="font-semibold">
                <Trans>Photographs and documents</Trans>
              </h3>
              <ul className="mt-2 grid gap-2">
                {attachments.map((attachment) => {
                  const label =
                    attachment.name ?? (attachment.role === 'photo' ? t`Photograph` : t`Document`);
                  const original = detail?.attachments.find((entry) => entry.id === attachment.id);
                  return (
                    <li key={attachment.id}>
                      {original?.file ? (
                        <Button
                          variant="secondary"
                          isPending={openingMedia === attachment.id}
                          isDisabled={openingMedia !== undefined && openingMedia !== attachment.id}
                          onPress={() => void openFile(original)}
                        >
                          <bdi>{label}</bdi>
                        </Button>
                      ) : (
                        <bdi>{label}</bdi>
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
          {thing &&
            canEdit &&
            !box &&
            detail.attachments.some((entry) => entry.role === 'photo') && (
              <SuggestionForm
                connection={connection}
                thing={thing}
                onChanged={() => setRequest((value) => value + 1)}
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
