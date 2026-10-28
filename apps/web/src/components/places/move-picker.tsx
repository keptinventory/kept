/**
 * The move picker (D45): recent places first, then every place you can move into, searchable,
 * grouped by location. It is also the non-drag way to move (WCAG 2.5.7): on desktop a thing can
 * be dragged onto a place, and this dialog does the same from a keyboard or a phone.
 *
 * Choosing a place in another location asks the server who would lose sight of the thing
 * (`POST /things/move/preview`) and says so before anything moves ("Alfred and 2 others will lose
 * sight of it"). Moving things can also go into a box: boxes sit under their place, as in the
 * tree (`withBoxes`); re-parenting and merging places offer places only.
 *
 * The options are a radio group, so arrow keys move through them (mirrored in Arabic) and a
 * screen reader hears "radio, 3 of 12".
 */
import { normalize, stripPrefixes } from '@kept/shared';
import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation, useQuery } from '@tanstack/react-query';
import { type ReactNode, useId, useMemo, useState } from 'react';
import { Radio, RadioGroup } from 'react-aria-components';
import { inventoryApi } from '@/api/inventory/queries';
import type { BoxNode, MovePreview, MoveTarget, PlaceNode } from '@/api/inventory/types';
import { useOfferUndo } from '@/components/history/undo';
import { SearchIcon } from '@/components/icons';
import { LoadingRows, Notice, useErrorText } from '@/components/page';
import { TypeIcon } from '@/components/type-icon';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { useLocationName } from '@/lib/labels';
import {
  type LocationTree,
  pathNames,
  recentPlaceIds,
  rememberPlace,
  useAllPlaceTrees,
  useInvalidateBrowse,
} from './api';
import { placeIcon, usePlaceName } from './labels';
import { Sheet } from './sheet';
import { indentStyle, treeEntries } from './tree';

/** Where to: a place, or a box (`containerId`, with `placeId` the place it is in). */
export type PickedPlace = {
  placeId: string;
  locationId: string;
  name: string;
  containerId?: string;
};

/** The move's target for the API. */
export const targetOfPick = (p: PickedPlace): MoveTarget =>
  p.containerId ? { containerId: p.containerId } : { placeId: p.placeId };

/** Every word of the query starts a word of the name (D42's normalisation, both forms). */
export function placeMatches(name: string, query: string): boolean {
  const q = normalize(query).split(' ').filter(Boolean);
  if (!q.length) return true;
  const n = normalize(name);
  const words = `${n} ${stripPrefixes(n)}`.split(' ');
  return q.every((w) => {
    const ws = stripPrefixes(w);
    return words.some((x) => x.startsWith(w) || x.startsWith(ws));
  });
}

type Option = {
  value: string;
  place: PlaceNode;
  /** A box under `place`, when this option is the box. */
  box?: BoxNode;
  location: LocationTree['location'];
  depth: number;
  /** Shown under the name in search results and the recent group. */
  where?: string;
};

export function PlacePicker({
  label,
  locationIds,
  exclude,
  includeUnplaced = true,
  value,
  onChange,
  firstLocationId,
  withBoxes = false,
}: {
  label: string;
  /** Boxes as targets too, each under its place, except these things (what is being moved). */
  withBoxes?: boolean | { except: ReadonlySet<string> };
  /** This location's places come first (where the things are now). */
  firstLocationId?: string;
  /** Only these locations (a re-parent or merge stays in its location). Default: all writable. */
  locationIds?: string[];
  /** Places not offered, with their subtrees (a place can't move into itself). */
  exclude?: Set<string>;
  includeUnplaced?: boolean;
  value: PickedPlace | null;
  onChange: (picked: PickedPlace) => void;
}) {
  const { t } = useLingui();
  const nameOf = usePlaceName();
  const locationName = useLocationName();
  const searchId = useId();
  const { trees, isPending } = useAllPlaceTrees();
  const [q, setQ] = useState('');

  const usable = trees
    .filter((tr) =>
      locationIds ? locationIds.includes(tr.location.id) : tr.location.role !== 'viewer',
    )
    .sort(
      (a, b) =>
        Number(b.location.id === firstLocationId) - Number(a.location.id === firstLocationId),
    );
  const except = typeof withBoxes === 'object' ? withBoxes.except : null;
  const all: Option[] = usable.flatMap((tr) => {
    const byId = new Map(tr.places.map((pl) => [pl.id, pl]));
    const boxes = withBoxes ? tr.boxes.filter((b) => !except?.has(b.id)) : [];
    return treeEntries(tr.places, boxes, {
      ...(exclude ? { exclude } : {}),
      includeUnplaced,
    }).flatMap((row): Option[] => {
      if (row.kind === 'more') return [];
      const place = row.kind === 'box' ? byId.get(row.box.placeId) : row.place;
      if (!place) return [];
      const names = pathNames(tr.places, place.id);
      return [
        {
          value: row.kind === 'box' ? `box:${row.box.id}` : place.id,
          place,
          ...(row.kind === 'box' ? { box: row.box } : {}),
          location: tr.location,
          depth: row.depth,
          where: [
            locationName(tr.location),
            ...(row.kind === 'box' ? names : names.slice(0, -1)),
          ].join(' › '),
        },
      ];
    });
  });
  const optionName = (o: Option) => (o.box ? (o.box.name ?? t`Untitled`) : nameOf(o.place));
  const byId = new Map(all.map((o) => [o.value, o]));
  const recent = q
    ? []
    : recentPlaceIds()
        .map((id) => byId.get(id))
        .filter((o): o is Option => !!o)
        .map((o) => ({ ...o, value: `recent:${o.value}` }));
  const matching = q ? all.filter((o) => placeMatches(optionName(o), q)) : all;

  // The radio that was pressed: a place can be both in Recent and in its location's tree.
  const [raw, setRaw] = useState<string | null>(null);
  const pick = (v: string) => {
    const o = byId.get(v.replace(/^recent:/, ''));
    if (!o) return;
    setRaw(v);
    onChange({
      placeId: o.place.id,
      locationId: o.location.id,
      name: optionName(o),
      ...(o.box ? { containerId: o.box.id } : {}),
    });
  };
  const chosen = value ? (value.containerId ? `box:${value.containerId}` : value.placeId) : null;
  const selected = chosen && raw?.replace(/^recent:/, '') === chosen ? raw : chosen;

  const radio = (o: Option, flat: boolean) => (
    <Radio
      key={o.value}
      value={o.value}
      style={flat ? undefined : indentStyle(o.depth)}
      className="flex min-h-11 cursor-pointer items-center gap-2.5 py-1.5 pe-3 text-[15px] text-ink outline-none data-focus-visible:outline-2 data-focus-visible:-outline-offset-2 data-focus-visible:outline-info data-hovered:bg-sunken data-selected:bg-sunken data-selected:font-semibold"
    >
      {({ isSelected }) => (
        <>
          <span
            aria-hidden="true"
            className="grid size-5 shrink-0 place-items-center rounded-full border-2 border-ink-3 data-[on=true]:border-ink"
            data-on={isSelected}
          >
            {isSelected ? <span className="size-2.5 rounded-full bg-ink" /> : null}
          </span>
          <TypeIcon
            icon={o.box ? (o.box.icon ?? 'lucide:package') : placeIcon(o.place)}
            className="size-4 text-ink-3"
          />
          <span className="grid min-w-0 flex-1">
            <bdi className="[overflow-wrap:anywhere]">{optionName(o)}</bdi>
            {flat && o.where ? (
              <span className="text-small font-normal text-ink-3 [overflow-wrap:anywhere]">
                {o.where}
              </span>
            ) : null}
          </span>
        </>
      )}
    </Radio>
  );

  return (
    <div className="grid gap-3">
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
      {isPending ? (
        <LoadingRows rows={3} label={t`Loading places`} />
      ) : (
        <RadioGroup
          aria-label={label}
          value={selected}
          onChange={pick}
          className="grid max-h-[50dvh] content-start overflow-y-auto rounded-[10px] border border-line"
        >
          {recent.length ? (
            <Group title={<Trans>Recent</Trans>}>{recent.map((o) => radio(o, true))}</Group>
          ) : null}
          {q ? (
            matching.length ? (
              <Group title={<Trans>Matches</Trans>}>{matching.map((o) => radio(o, true))}</Group>
            ) : (
              <p className="m-0 px-3.5 py-4 text-small text-ink-2">
                <Trans>No place matches that.</Trans>
              </p>
            )
          ) : (
            usable.map((tr) => {
              const opts = all.filter((o) => o.location.id === tr.location.id);
              return opts.length ? (
                <Group key={tr.location.id} title={<bdi>{locationName(tr.location)}</bdi>}>
                  {opts.map((o) => radio(o, false))}
                </Group>
              ) : null;
            })
          )}
        </RadioGroup>
      )}
    </div>
  );
}

function Group({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a labelled run of radios inside one radio group
    <div role="group" aria-label={typeof title === 'string' ? title : undefined} className="grid">
      <div aria-hidden="true" className="eyebrow sticky top-0 z-10 bg-sunken px-3.5 py-1.5">
        {title}
      </div>
      {children}
    </div>
  );
}

/** "Alfred and 2 others will lose sight of it" (D45). */
export function useLosesSightText() {
  const { t } = useLingui();
  return (preview: MovePreview, count: number): string | null => {
    const people = preview.losesSight.map((p) => p.displayName);
    const first = people[0];
    if (!first) return null;
    const others = people.length - 1;
    const it = count === 1 ? t`it` : t`them`;
    if (others === 0) return t`${first} will lose sight of ${it}.`;
    return plural(others, {
      one: `${first} and # other will lose sight of ${it}.`,
      other: `${first} and # others will lose sight of ${it}.`,
    });
  };
}

/** Where the things are going, and what that costs, before the move (D45, D161). */
export function CrossLocationWarning({ thingIds, to }: { thingIds: string[]; to: PickedPlace }) {
  const losesSight = useLosesSightText();
  const preview = useQuery({
    queryKey: ['move-preview', thingIds, to.containerId ?? to.placeId],
    queryFn: () => inventoryApi.movePreview({ thingIds, to: targetOfPick(to) }),
  });
  if (!preview.data) return null;
  const d = preview.data;
  const sight = losesSight(d, thingIds.length);
  const target = d.targetLocation.name;
  return (
    <Notice tone="warn" title={<Trans>This moves it to {target}</Trans>}>
      {sight ? <p className="m-0">{sight}</p> : null}
      {d.crossAccount ? (
        <p className="m-0">
          <Trans>
            {target} belongs to someone else's account: its type, tags and purchase are copied
            there.
          </Trans>
        </p>
      ) : null}
    </Notice>
  );
}

/**
 * Move one or more things into a place, anywhere you can write (D45). Closes and toasts on
 * success; `onMoved` lets a triage flow advance.
 */
export function MoveThingsDialog({
  isOpen,
  onOpenChange,
  thingIds,
  fromLocationId,
  title,
  onMoved,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  thingIds: string[];
  fromLocationId: string;
  title?: ReactNode;
  onMoved?: (to: PickedPlace) => void;
}) {
  const { t } = useLingui();
  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      wide
      title={
        title ??
        (thingIds.length === 1
          ? t`Move to…`
          : plural(thingIds.length, { one: 'Move # thing to…', other: 'Move # things to…' }))
      }
    >
      {({ close }) => (
        <MoveThingsForm
          thingIds={thingIds}
          fromLocationId={fromLocationId}
          onCancel={close}
          onMoved={(to) => {
            close();
            onMoved?.(to);
          }}
        />
      )}
    </Sheet>
  );
}

/** The picker plus Move, without the sheet (the Unplaced triage embeds it). */
export function MoveThingsForm({
  thingIds,
  fromLocationId,
  onMoved,
  onCancel,
  cancelLabel,
  exclude,
}: {
  thingIds: string[];
  fromLocationId: string;
  /** Places not offered (the Unplaced area the triage is sorting). */
  exclude?: Set<string>;
  onMoved: (to: PickedPlace) => void;
  onCancel?: () => void;
  cancelLabel?: string;
}) {
  const { t } = useLingui();
  const errorText = useErrorText();
  const invalidate = useInvalidateBrowse();
  const offerUndo = useOfferUndo();
  const [to, setTo] = useState<PickedPlace | null>(null);
  const move = useMutation({
    mutationFn: (target: PickedPlace) => inventoryApi.move({ thingIds, to: targetOfPick(target) }),
    onSuccess: async ({ auditEvents }, target) => {
      if (!target.containerId) rememberPlace(target.placeId);
      await invalidate();
      const where = target.name;
      // A bulk move records one event per thing; Undo reverses them all (D150).
      offerUndo(
        {
          title:
            thingIds.length === 1
              ? t`Moved to ${where}`
              : plural(thingIds.length, {
                  one: `Moved # thing to ${where}`,
                  other: `Moved # things to ${where}`,
                }),
        },
        auditEvents,
      );
      onMoved(target);
    },
  });
  const cross = to !== null && to.locationId !== fromLocationId;
  const moveLabel = useMemo(
    () =>
      thingIds.length === 1
        ? t`Move here`
        : plural(thingIds.length, { one: 'Move # here', other: 'Move # here' }),
    [thingIds.length, t],
  );
  return (
    <div className="grid gap-4">
      <PlacePicker
        label={t`Where to`}
        value={to}
        onChange={setTo}
        firstLocationId={fromLocationId}
        withBoxes={{ except: new Set(thingIds) }}
        {...(exclude ? { exclude } : {})}
      />
      {to && cross ? <CrossLocationWarning thingIds={thingIds} to={to} /> : null}
      {move.error ? <Notice tone="danger">{errorText(move.error)}</Notice> : null}
      <DialogFooter>
        {onCancel ? (
          <Button variant="secondary" onPress={onCancel}>
            {cancelLabel ?? t`Cancel`}
          </Button>
        ) : null}
        <Button
          isDisabled={!to}
          isPending={move.isPending}
          onPress={() => {
            if (to) move.mutate(to);
          }}
        >
          {moveLabel}
        </Button>
      </DialogFooter>
    </div>
  );
}
