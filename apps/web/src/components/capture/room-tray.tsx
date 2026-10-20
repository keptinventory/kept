/**
 * ROOM mode's tray (#194): the photos of one room, taken or picked one at a time (1–5), kept on
 * the phone until Send. Above them the tip ("Stand in the doorway; one photo per wall."), below
 * them what reading them will cost at most ("About 3 photos · up to ~31,000 tokens · Groq", from
 * the location's AI status; offline, the photo count only) and Send, which queues the room as one
 * capture. When the room can't be read here, the tray says why instead and Send stays off:
 * AI capture is off in the location, no provider reads photos, or the AI budget is used up.
 */
import { type ProviderKind, ROOM_LIMITS, roomEstimate } from '@kept/shared';
import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { Button } from 'react-aria-components';
import { useProviderName } from '@/components/ai/labels';
import { XIcon } from '@/components/icons';
import { useFormat } from '@/lib/format';

export type RoomShot = { id: string; thumb: string | null };

/** Why a room can't be read here; null when it can. */
export type RoomBlock =
  | { kind: 'off'; location: string }
  | { kind: 'no_provider' }
  | { kind: 'paused'; until: string | null }
  /** The Unplaced area is chosen: a room capture goes into a room or a box. */
  | { kind: 'where' }
  | null;

/** The longest edge a room photo is sent at (PHOTO_POLICY.room); the estimate's bound. */
const SENT = { width: 2048, height: 1536 };

export function RoomTray({
  shots,
  onRemove,
  onSend,
  sending,
  block,
  provider,
  onSample,
}: {
  shots: readonly RoomShot[];
  onRemove: (id: string) => void;
  onSend: () => void;
  sending: boolean;
  block: RoomBlock;
  /** The provider that would read them; null when unknown here (offline). */
  provider: ProviderKind | null;
  /** Try Kept: add the sample room photo (there is no camera there). */
  onSample?: () => void;
}) {
  const { t } = useLingui();
  const fmt = useFormat();
  const providerName = useProviderName();
  const n = shots.length;
  const estimate = provider
    ? roomEstimate({ kind: provider, photos: shots.map(() => SENT) })
    : null;
  const line = [
    plural(n, { one: 'About # photo', other: 'About # photos' }),
    ...(estimate && n > 0 ? [t`up to ~${fmt.num(estimate.tokens)} tokens`] : []),
    ...(provider ? [providerName(provider)] : []),
  ].join(fmt.sep);

  return (
    <section
      aria-label={t`Room photos`}
      className="mx-3 mt-2 grid gap-2 rounded-[12px] bg-[#1C1A17] p-2.5 text-[13px]"
    >
      {block ? (
        <p role="status" className="m-0 text-[#F2EFE9] [overflow-wrap:anywhere]">
          {block.kind === 'off' ? (
            <Trans>
              AI capture is off in <bdi>{block.location}</bdi>. An owner or admin can turn it on.
            </Trans>
          ) : block.kind === 'where' ? (
            <Trans>Choose the room or the box these photos are of, above.</Trans>
          ) : block.kind === 'no_provider' ? (
            <Trans>No AI provider that reads photos is set up. Ask your instance admin.</Trans>
          ) : block.until ? (
            <Trans>Paused: the AI budget is used up until {fmt.dateTime(block.until)}.</Trans>
          ) : (
            <Trans>Paused: the AI budget is used up.</Trans>
          )}
        </p>
      ) : (
        <p className="m-0 text-[#BDB7AC]">
          <Trans>Stand in the doorway; one photo per wall.</Trans>
        </p>
      )}
      {n > 0 ? (
        <ul aria-label={t`Photos of this room`} className="m-0 flex list-none gap-1.5 p-0">
          {shots.map((s, i) => (
            <li
              key={s.id}
              className="relative size-14 shrink-0 overflow-hidden rounded-[8px] bg-[#2A2724]"
            >
              {s.thumb ? <img src={s.thumb} alt="" className="size-full object-cover" /> : null}
              <Button
                aria-label={t`Remove photo ${fmt.num(i + 1)}`}
                onPress={() => onRemove(s.id)}
                className="absolute end-0.5 top-0.5 grid size-6 cursor-pointer place-items-center rounded-full bg-[#0F0E0D]/80 text-[#F2EFE9] outline-none data-focus-visible:outline-2 data-focus-visible:outline-[#F2EFE9] [&_svg]:size-3.5"
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {onSample ? (
        <div className="grid gap-1.5">
          <p className="m-0 text-[#BDB7AC]">
            <Trans>In Try Kept no AI runs: every room photo gives the same sample results.</Trans>
          </p>
          <div>
            <Button
              onPress={onSample}
              isDisabled={n >= ROOM_LIMITS.photos}
              className="min-h-11 cursor-pointer rounded-full border border-[#4A463F] bg-transparent px-4 font-semibold text-[#F2EFE9] outline-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-focus-visible:outline-2 data-focus-visible:outline-[#F2EFE9]"
            >
              <Trans>Use a sample room photo</Trans>
            </Button>
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-[#BDB7AC] [overflow-wrap:anywhere]">
          {n === 0
            ? t`Take up to ${fmt.num(ROOM_LIMITS.photos)} photos of the room.`
            : block
              ? plural(n, { one: '# photo', other: '# photos' })
              : line}
        </p>
        <Button
          onPress={onSend}
          isDisabled={n === 0 || block !== null || sending}
          className="min-h-11 cursor-pointer rounded-full bg-amber px-4 font-semibold text-amber-ink outline-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-[#F2EFE9]"
        >
          {n === 0 ? t`Send` : plural(n, { one: 'Send # photo', other: 'Send # photos' })}
        </Button>
      </div>
    </section>
  );
}
