/**
 * A room capture's card (#194), at the head of its batch: the drafts it made are the batch's own
 * draft items under it, reviewed as any draft (Accept, Edit, Discard; "Accept N names" on the
 * batch). The card holds the rest:
 *
 * - While the photos are read: "Reading photo 2 of 3…", or the budget it waits for.
 * - Each photo, with what it gave ("12 things", "Couldn't read photo 3", "This photo had more;
 *   take a closer one").
 * - Storage furniture as places in the room: Add as a place, or all of them.
 * - Things already in Kept: tick and Mark seen; a thing whose label was read starts ticked.
 * - Done (`a`): closes the card; the full photos are deleted, unless the location keeps room
 *   photos. Discard (`d`): the photos go. Retry, when no photo could be read or AI was off.
 */
import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { captureApi } from '@/api/capture/queries';
import type { InboxRoom } from '@/api/capture/types';
import { Pill, type PillTone } from '@/components/page';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm';
import { TickBox } from '@/components/ui/tick-box';
import { useFormat } from '@/lib/format';
import { useInboxRun } from './actions';
import type { ItemProps } from './item-card';
import { BlockedReason, ItemShell, useItemKeys } from './shell';

export function RoomReview({ item, current, blocked }: ItemProps) {
  const { t } = useLingui();
  const fmt = useFormat();
  const confirm = useConfirm();
  const { run, busy } = useInboxRun();
  const room = item.room;
  // What the person ticked or unticked; otherwise a thing whose label the phone read is ticked.
  const [choice, setChoice] = useState<ReadonlyMap<string, boolean>>(new Map());
  const isTicked = (a: InboxRoom['already'][number]) =>
    !a.seen && (choice.get(a.thingId) ?? a.matchedBy === 'code');
  const ticked = new Set((room?.already ?? []).filter(isTicked).map((a) => a.thingId));
  const reading = room?.status === 'reading' || room?.status === 'merging';
  /** "Photo 2: 12 things". */
  const photoThings = (n: number, objects: number) => {
    const photo = fmt.num(n);
    return plural(objects, { one: `Photo ${photo}: # thing`, other: `Photo ${photo}: # things` });
  };

  const done = async () => {
    if (blocked || !room || reading) return;
    const ok = await confirm({
      title: t`Close this room?`,
      body: room.keepPhotos
        ? t`The photos stay on ${room.target.name}. The drafts and their pictures stay in the inbox.`
        : t`The full photos are deleted. The drafts and their own pictures stay in the inbox.`,
      confirmLabel: t`Close`,
    });
    if (ok) void run(() => captureApi.roomDone(item.id, item.rowVersion), { done: t`Room closed` });
  };
  const discard = async () => {
    if (blocked || !room) return;
    const ok = await confirm({
      title: t`Discard these photos?`,
      body: t`The photos are deleted. Drafts already made stay in the inbox.`,
      confirmLabel: t`Discard`,
      destructive: true,
    });
    if (ok)
      void run(() => captureApi.roomDiscard(item.id, item.rowVersion), {
        done: t`Photos discarded`,
      });
  };
  const retry = () =>
    !blocked &&
    void run(() => captureApi.roomRetry(item.id, item.rowVersion), {
      done: t`Reading the photos again`,
    });
  const addPlaces = (indexes: number[]) =>
    !blocked &&
    void run(() => captureApi.roomPlaces(item.id, indexes, item.rowVersion), {
      done: (r) => plural(r.placeIds.length, { one: 'Added # place', other: 'Added # places' }),
    });
  const markSeen = () =>
    !blocked &&
    ticked.size > 0 &&
    void run(() => captureApi.roomSeen(item.id, [...ticked], item.rowVersion), {
      done: plural(ticked.size, { one: 'Marked # thing seen', other: 'Marked # things seen' }),
    });
  useItemKeys(item.id, { accept: () => void done(), drop: () => void discard() });
  if (!room) return null;

  const name = room.target.name;
  const proposed = room.places.filter((p) => p.placeId === null);
  const unseen = room.already.filter((a) => !a.seen);
  const nothing =
    room.status === 'ready' &&
    room.drafts.made === 0 &&
    room.places.length === 0 &&
    room.already.length === 0;
  const tone: PillTone =
    room.status === 'failed' || room.status === 'off' ? 'warn' : reading ? 'info' : 'ok';

  return (
    <ItemShell
      item={item}
      label={t`Photos of ${name}`}
      current={current}
      photo={
        room.photos[0]
          ? { fileId: room.photos[0].attachmentId, thumbUrl: room.photos[0].thumbUrl }
          : undefined
      }
      title={
        <Trans>
          Photos of <bdi>{name}</bdi>
        </Trans>
      }
      meta={
        <Pill tone={tone}>
          {reading ? (
            <Trans>Reading</Trans>
          ) : room.status === 'failed' ? (
            <Trans>Couldn't read</Trans>
          ) : room.status === 'off' ? (
            <Trans>AI capture is off</Trans>
          ) : (
            <Trans>Room photos</Trans>
          )}
        </Pill>
      }
      actions={
        <>
          {room.status === 'failed' || room.status === 'off' ? (
            <Button size="small" isDisabled={!!blocked} isPending={busy} onPress={retry}>
              <Trans>Retry</Trans>
            </Button>
          ) : (
            <Button
              size="small"
              isDisabled={!!blocked || reading}
              isPending={busy}
              aria-keyshortcuts="A"
              onPress={() => void done()}
            >
              <Trans>Done</Trans>
            </Button>
          )}
          <Button
            size="small"
            variant="secondary"
            isDisabled={!!blocked}
            aria-keyshortcuts="D"
            onPress={() => void discard()}
          >
            <Trans>Discard</Trans>
          </Button>
          <BlockedReason reason={blocked} />
        </>
      }
    >
      <div className="grid gap-3 text-small text-ink-2">
        <p className="m-0 [overflow-wrap:anywhere]" role="status">
          {reading ? (
            room.pausedUntil ? (
              <Trans>Waiting for the AI budget until {fmt.dateTime(room.pausedUntil)}.</Trans>
            ) : room.status === 'merging' || room.progress.done >= room.progress.total ? (
              <Trans>Listing what is in the photos…</Trans>
            ) : (
              <Trans>
                Reading photo {fmt.num(room.progress.done + 1)} of {fmt.num(room.progress.total)}…
              </Trans>
            )
          ) : room.status === 'failed' ? (
            <Trans>Kept couldn't read these photos. Retry, or take them again.</Trans>
          ) : room.status === 'off' ? (
            <Trans>
              AI capture is off here, so nothing was listed. The photos wait on <bdi>{name}</bdi>.
            </Trans>
          ) : nothing ? (
            <Trans>Nothing found in these photos.</Trans>
          ) : (
            <RoomSummary room={room} />
          )}
        </p>
        {room.photos.length > 0 ? (
          <ul aria-label={t`Photos`} className="m-0 grid list-none gap-1.5 p-0">
            {room.photos.map((p, i) => (
              <li key={p.attachmentId} className="flex min-w-0 items-center gap-2">
                <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-[8px] border border-line bg-sunken">
                  {p.thumbUrl ? (
                    <img src={p.thumbUrl} alt="" className="size-full object-cover" />
                  ) : null}
                </span>
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {p.status === 'read'
                    ? p.more
                      ? `${photoThings(i + 1, p.objects)} ${t`This photo had more; take a closer one.`}`
                      : photoThings(i + 1, p.objects)
                    : p.status === 'failed'
                      ? t`Couldn't read photo ${fmt.num(i + 1)}`
                      : p.status === 'off'
                        ? t`Photo ${fmt.num(i + 1)}: not read`
                        : p.status === 'missing'
                          ? t`Photo ${fmt.num(i + 1)} was removed`
                          : t`Photo ${fmt.num(i + 1)}: reading…`}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {room.places.length > 0 ? (
          <section aria-label={t`Furniture that holds things`} className="grid gap-1.5">
            <h3 className="m-0 font-semibold text-ink text-small">
              <Trans>Furniture that holds things</Trans>
            </h3>
            <p className="m-0">
              <Trans>
                Add them as places in <bdi>{name}</bdi>, so things can go in them.
              </Trans>
            </p>
            <ul className="m-0 grid list-none gap-1 p-0">
              {room.places.map((p) => (
                <li
                  key={p.index}
                  className="flex min-h-11 flex-wrap items-center justify-between gap-2"
                >
                  <bdi className="min-w-0 text-ink [overflow-wrap:anywhere]">{p.name}</bdi>
                  {p.placeId ? (
                    <span className="text-ok">
                      <Trans>Added</Trans>
                    </span>
                  ) : (
                    <Button
                      size="small"
                      variant="secondary"
                      isDisabled={!!blocked}
                      onPress={() => addPlaces([p.index])}
                    >
                      <Trans>Add as a place</Trans>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {proposed.length > 1 ? (
              <div>
                <Button
                  size="small"
                  isDisabled={!!blocked}
                  onPress={() => addPlaces(proposed.map((p) => p.index))}
                >
                  {plural(proposed.length, { one: 'Add # place', other: 'Add all # places' })}
                </Button>
              </div>
            ) : null}
          </section>
        ) : null}
        {room.already.length > 0 ? (
          <section aria-label={t`Already in Kept`} className="grid gap-1">
            <h3 className="m-0 font-semibold text-ink text-small">
              <Trans>Already in Kept</Trans>
            </h3>
            <ul className="m-0 grid list-none p-0">
              {room.already.map((a) => (
                <li key={a.thingId}>
                  {a.seen ? (
                    <p className="m-0 flex min-h-11 items-center gap-2">
                      <bdi className="text-ink [overflow-wrap:anywhere]">{a.name}</bdi>
                      <span className="text-ok">
                        <Trans>Seen</Trans>
                      </span>
                    </p>
                  ) : (
                    <TickBox
                      isSelected={ticked.has(a.thingId)}
                      isDisabled={!!blocked}
                      onChange={(on) => setChoice((m) => new Map(m).set(a.thingId, on))}
                      description={
                        a.matchedBy === 'code'
                          ? t`Its label is in the photos`
                          : a.matchedBy === 'brand_model'
                            ? t`Same brand and model`
                            : t`Same name`
                      }
                    >
                      <bdi>{a.name}</bdi>
                    </TickBox>
                  )}
                </li>
              ))}
            </ul>
            {unseen.length > 0 ? (
              <div>
                <Button
                  size="small"
                  variant="secondary"
                  isDisabled={!!blocked || ticked.size === 0}
                  onPress={markSeen}
                >
                  {plural(ticked.size, { one: 'Mark # seen', other: 'Mark # seen' })}
                </Button>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </ItemShell>
  );
}

function RoomSummary({ room }: { room: InboxRoom }) {
  const parts = [
    plural(room.drafts.made, {
      one: '# new thing to review below',
      other: '# new things to review below',
    }),
    ...(room.already.length > 0
      ? [plural(room.already.length, { one: '# already in Kept', other: '# already in Kept' })]
      : []),
    ...(room.places.length > 0
      ? [
          plural(room.places.length, {
            one: '# piece of furniture to add as a place',
            other: '# pieces of furniture to add as places',
          }),
        ]
      : []),
  ];
  const fmt = useFormat();
  return <>{parts.join(fmt.sep)}</>;
}
