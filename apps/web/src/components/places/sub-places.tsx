/**
 * What a place's own Manage section does with the places inside it, loaded on demand
 * (sub-places-lazy.tsx; vite.config.ts ON_DEMAND_ENTRIES): both need a connection.
 *
 * - `BoxesSheet`, "Turn places into boxes": the places directly inside, with a search and Select
 *   all; the ticked ones become boxes in one step (POST …/convert-children-to-containers), each
 *   keeping its id, label and what's in it. A place with places inside can't be ticked (a box holds
 *   things only); the server says the same per row if it changed meanwhile. The toast's one Undo
 *   brings every box back as the place it was (all or none, POST /api/v1/audit/undo).
 * - `OrderSheet`, "Order of the places here": A to Z (the default) or Custom order. In Custom
 *   order each place has Move up and Move down buttons, so the order is set with the keyboard, a
 *   screen reader or a tap, never only by dragging; focus stays on the place that moved, and a
 *   polite status says where it went. Back to A to Z keeps the order for the next time.
 *
 * The places come from the location's tree (already on the page), sorted by the shared rule.
 */
import { type ChildOrder, siblingOrder } from '@kept/shared';
import { plural } from '@lingui/core/macro';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { inventoryApi } from '@/api/inventory/queries';
import type { ConvertChildResult, PlaceNode, PlaceView } from '@/api/inventory/types';
import { useOfferUndo } from '@/components/history/undo';
import { ChevronDownIcon, SearchIcon } from '@/components/icons';
import { LoadingRows, Notice, useErrorText } from '@/components/page';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Segmented } from '@/components/ui/segmented';
import { TickBox } from '@/components/ui/tick-box';
import { toast } from '@/components/ui/toast';
import { isolate } from '@/lib/bidi';
import { useFormat } from '@/lib/format';
import { cn } from '@/lib/utils';
import { TypeIcon } from '../type-icon';
import { placeApi, useInvalidateBrowse, usePlaceTree } from './api';
import { placeIcon, usePlaceName } from './labels';
import { placeMatches } from './move-picker';
import { PlaceCounts, Tile } from './rows';
import { Sheet } from './sheet';

export type SubPlacesProps = { place: PlaceView; onClose: () => void };

/** The places directly inside `place`, in the order the server lists them. */
function useChildren(place: PlaceView) {
  const tree = usePlaceTree(place.locationId);
  const children = useMemo(
    () =>
      (tree.data?.places ?? [])
        .filter((p) => p.parentId === place.id)
        .sort(siblingOrder(place.childOrder)),
    [tree.data, place.id, place.childOrder],
  );
  return { children, isPending: tree.isPending };
}

function PlaceLabel({ place }: { place: PlaceNode }) {
  const nameOf = usePlaceName();
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Tile>
        <TypeIcon icon={placeIcon(place)} />
      </Tile>
      <bdi className="min-w-0 font-semibold [overflow-wrap:anywhere]">{nameOf(place)}</bdi>
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
// Turn places into boxes
// ---------------------------------------------------------------------------------------------

export function BoxesSheet({ place, onClose }: SubPlacesProps) {
  const { t } = useLingui();
  const fmt = useFormat();
  const nameOf = usePlaceName();
  const errorText = useErrorText();
  const invalidate = useInvalidateBrowse();
  const offerUndo = useOfferUndo();
  const searchId = useId();
  const name = place.name;
  const { children, isPending } = useChildren(place);
  const [q, setQ] = useState('');
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [refused, setRefused] = useState<ConvertChildResult[]>([]);
  const leaves = children.filter((c) => c.childCount === 0);
  const shown = children.filter((c) => placeMatches(c.name, q));
  const shownLeaves = shown.filter((c) => c.childCount === 0);
  const allShown = shownLeaves.length > 0 && shownLeaves.every((c) => chosen.has(c.id));
  const someShown = shownLeaves.some((c) => chosen.has(c.id));
  // Only places still inside count: a search narrows what Select all ticks, not what was ticked.
  const ids = leaves.filter((c) => chosen.has(c.id)).map((c) => c.id);
  const count = ids.length;

  const convert = useMutation({
    mutationFn: () => placeApi.convertChildren(place.id, { placeIds: ids }),
    onSuccess: async ({ body, auditEvents }) => {
      await invalidate();
      const done = body.results.filter((r) => r.status === 'converted').length;
      const left = body.results.filter((r) => r.status === 'refused');
      if (done > 0)
        offerUndo(
          {
            title: plural(done, {
              one: 'Turned # place into a box',
              other: 'Turned # places into boxes',
            }),
          },
          auditEvents,
          { together: true },
        );
      setChosen(new Set());
      setRefused(left);
      if (left.length === 0) onClose();
    },
    onError: (e) => toast({ title: errorText(e), tone: 'danger' }),
  });

  const toggle = (id: string, on: boolean) =>
    setChosen((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const setShown = (on: boolean) =>
    setChosen((cur) => {
      const next = new Set(cur);
      for (const c of shownLeaves) {
        if (on) next.add(c.id);
        else next.delete(c.id);
      }
      return next;
    });
  const refusedName = (id: string) => {
    const p = children.find((c) => c.id === id);
    return p ? nameOf(p) : t`A place`;
  };

  return (
    <Sheet isOpen onOpenChange={(o) => !o && onClose()} title={t`Turn places into boxes`} wide>
      {({ close }) => (
        <div className="grid gap-4">
          <p className="m-0 text-ink-2">
            <Trans>
              Choose places inside <bdi>{name}</bdi> to turn into boxes. A box is a thing: it moves
              with everything in it. Each keeps its ID, its label and what's in it, and one Undo
              turns them all back.
            </Trans>
          </p>
          {refused.length > 0 ? (
            <Notice tone="warn" title={<Trans>Some places weren't turned into boxes</Trans>}>
              <ul className="m-0 grid gap-1 ps-5">
                {refused.map((r) => (
                  <li key={r.placeId}>
                    <bdi>{refusedName(r.placeId)}</bdi>
                    {fmt.sep}
                    {r.status === 'refused' && r.reason === 'has_places' ? (
                      <Trans>It has places inside</Trans>
                    ) : (
                      <Trans>It is no longer in {isolate(name)}</Trans>
                    )}
                  </li>
                ))}
              </ul>
            </Notice>
          ) : null}
          {isPending ? (
            <LoadingRows rows={3} label={t`Loading places`} />
          ) : (
            <>
              <div className="relative">
                <label htmlFor={searchId} className="sr-only">
                  <Trans>Search places</Trans>
                </label>
                <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-[18px] -translate-y-1/2 text-ink-3" />
                <input
                  id={searchId}
                  type="search"
                  dir="auto"
                  value={q}
                  placeholder={t`Search places`}
                  onChange={(e) => setQ(e.target.value)}
                  className="min-h-11 w-full rounded-lg border border-line bg-surface ps-10 pe-3 text-[15px] text-ink outline-none placeholder:text-ink-3 focus-visible:border-info focus-visible:outline-2 focus-visible:outline-info"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-line border-b pb-1">
                <TickBox
                  isSelected={allShown}
                  isIndeterminate={!allShown && someShown}
                  isDisabled={shownLeaves.length === 0}
                  onChange={setShown}
                >
                  <Trans>Select all</Trans>
                </TickBox>
                <span className="text-small text-ink-2" aria-live="polite">
                  <Plural value={count} one="# chosen" other="# chosen" />
                </span>
              </div>
              <ul
                aria-label={t`Places inside ${isolate(name)}`}
                className="m-0 grid max-h-[50dvh] list-none content-start overflow-y-auto p-0"
              >
                {shown.length === 0 ? (
                  <li className="py-3 text-ink-2">
                    <Trans>No places match</Trans>
                  </li>
                ) : null}
                {shown.map((c) => (
                  <li key={c.id} className="border-line border-b last:border-b-0">
                    <TickBox
                      isSelected={chosen.has(c.id)}
                      isDisabled={c.childCount > 0}
                      onChange={(on) => toggle(c.id, on)}
                      description={
                        c.childCount > 0 ? (
                          <Trans>It has places inside: move them out first</Trans>
                        ) : (
                          <PlaceCounts place={c} />
                        )
                      }
                    >
                      <bdi className="font-semibold">{nameOf(c)}</bdi>
                    </TickBox>
                  </li>
                ))}
              </ul>
            </>
          )}
          <DialogFooter>
            <Button variant="secondary" onPress={close}>
              <Trans>Cancel</Trans>
            </Button>
            <Button
              isDisabled={count === 0}
              isPending={convert.isPending}
              onPress={() => convert.mutate()}
            >
              <Plural
                value={count}
                one="Turn # place into a box"
                other="Turn # places into boxes"
              />
            </Button>
          </DialogFooter>
        </div>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------------------------
// Order of the places here
// ---------------------------------------------------------------------------------------------

type Direction = 'up' | 'down';

export function OrderSheet({ place, onClose }: SubPlacesProps) {
  const { t } = useLingui();
  const fmt = useFormat();
  const nameOf = usePlaceName();
  const errorText = useErrorText();
  const invalidate = useInvalidateBrowse();
  const { children, isPending } = useChildren(place);
  const [mode, setMode] = useState<ChildOrder>(place.childOrder);
  const [rowVersion, setRowVersion] = useState(place.rowVersion);
  // The order the server answered last; until then, the tree's.
  const [order, setOrder] = useState<string[] | null>(null);
  const [said, setSaid] = useState('');
  const buttons = useRef(new Map<string, HTMLButtonElement | null>());
  const refocus = useRef<{ id: string; direction: Direction } | null>(null);

  const byId = new Map(children.map((c) => [c.id, c]));
  const sorted =
    mode === 'custom'
      ? [...children].sort(siblingOrder('custom'))
      : [...children].sort(siblingOrder('name'));
  const rows =
    mode === 'custom' && order
      ? order.flatMap((id) => {
          const c = byId.get(id);
          return c ? [c] : [];
        })
      : sorted;

  const switchTo = useMutation({
    mutationFn: (next: ChildOrder) =>
      inventoryApi.updatePlace(place.id, { childOrder: next }, rowVersion),
    onSuccess: async ({ body: view }) => {
      setRowVersion(view.rowVersion);
      setMode(view.childOrder);
      setOrder(null);
      void invalidate();
    },
    onError: (e) => {
      setMode(place.childOrder);
      toast({ title: errorText(e), tone: 'danger' });
    },
  });

  const move = useMutation({
    mutationFn: (v: { id: string; direction: Direction }) =>
      placeApi.reorder(place.id, { placeId: v.id, direction: v.direction }),
    onSuccess: async ({ order: next }, v) => {
      setOrder(next);
      const at = next.indexOf(v.id);
      const moved = byId.get(v.id);
      if (moved)
        setSaid(
          t`${isolate(nameOf(moved))} moved to ${fmt.num(at + 1)} of ${fmt.num(next.length)}`,
        );
      // Focus stays on the place that moved: the same button, or the other one at an edge.
      const edge = v.direction === 'up' ? at === 0 : at === next.length - 1;
      refocus.current = { id: v.id, direction: edge ? flip(v.direction) : v.direction };
      void invalidate();
    },
    onError: (e) => toast({ title: errorText(e), tone: 'danger' }),
  });

  useEffect(() => {
    const want = refocus.current;
    if (!want) return;
    refocus.current = null;
    buttons.current.get(`${want.id}:${want.direction}`)?.focus();
  });

  return (
    <Sheet
      isOpen
      onOpenChange={(o) => !o && onClose()}
      title={t`Order of the places in ${isolate(place.name)}`}
      wide
    >
      {({ close }) => (
        <div className="grid gap-4">
          <Segmented<ChildOrder>
            label={t`Order`}
            value={mode}
            // Not disabled while it saves (a disabled radio loses the focus); a change made in
            // that moment is left out.
            onChange={(next) => {
              if (switchTo.isPending) return;
              setMode(next);
              switchTo.mutate(next);
            }}
            options={[
              { id: 'name', label: t`A to Z` },
              { id: 'custom', label: t`Custom order` },
            ]}
            description={
              mode === 'custom'
                ? t`Move places up or down. Back to A to Z keeps this order for next time.`
                : t`A to Z, numbers in order. Floors keep the order they were made in.`
            }
          />
          <p role="status" aria-live="polite" className="sr-only">
            {said}
          </p>
          {isPending ? (
            <LoadingRows rows={3} label={t`Loading places`} />
          ) : (
            <ol
              aria-label={t`Places inside ${isolate(place.name)}`}
              className="m-0 grid max-h-[55dvh] list-none content-start overflow-y-auto rounded-[10px] border border-line p-0"
            >
              {rows.map((c, i) => (
                <li
                  key={c.id}
                  className="flex min-h-[60px] items-center gap-2 border-line border-b px-3 py-2 last:border-b-0"
                >
                  <span className="min-w-0 flex-1">
                    <PlaceLabel place={c} />
                  </span>
                  {mode === 'custom'
                    ? (['up', 'down'] as const).map((direction) => (
                        <Button
                          key={direction}
                          ref={(el) => {
                            buttons.current.set(`${c.id}:${direction}`, el);
                          }}
                          size="icon"
                          variant="ghost"
                          aria-label={
                            direction === 'up'
                              ? t`Move ${isolate(nameOf(c))} up`
                              : t`Move ${isolate(nameOf(c))} down`
                          }
                          // Never disabled while a move is on its way: a disabled button loses
                          // the focus, and the keyboard would start again from the top.
                          isDisabled={direction === 'up' ? i === 0 : i === rows.length - 1}
                          onPress={() => {
                            if (!move.isPending) move.mutate({ id: c.id, direction });
                          }}
                        >
                          <ChevronDownIcon className={cn(direction === 'up' && 'rotate-180')} />
                        </Button>
                      ))
                    : null}
                </li>
              ))}
            </ol>
          )}
          <DialogFooter>
            <Button onPress={close}>
              <Trans>Done</Trans>
            </Button>
          </DialogFooter>
        </div>
      )}
    </Sheet>
  );
}

const flip = (d: Direction): Direction => (d === 'up' ? 'down' : 'up');
