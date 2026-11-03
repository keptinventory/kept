/**
 * Furniture's compartments on its page (#238, 1.14.4): the grid as it stands, each compartment
 * where it sits (a merged one across its cells), numbered as its label is, top left first in every
 * language. Tapping one opens it. Members and up can:
 *
 * - **Turn it** (a grid that isn't square): which way its top went, as you face it, and, asked
 *   each time, Renumber (each compartment takes the number and code of where it now stands; old
 *   codes open the compartment now in their place) or Keep the codes. POST /places/:id/turn.
 * - **Merge or split**: pick compartments side by side to merge (the top left one stays, the
 *   others' codes and labels open it, their things go into it), or one merged compartment to split
 *   back into its cells. POST /places/:id/merge-compartments, /split-compartment.
 * - **Print their labels**, in counting order, with the names they have now.
 *
 * Each change is one Undo. Loaded on demand (compartments-lazy.tsx; vite.config.ts
 * ON_DEMAND_ENTRIES): every change needs a connection.
 */
import {
  type Compartment,
  mergeProblem,
  type PlaceOrientation,
  type TurnDirection,
  turnCompartments,
} from '@kept/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type ReactNode, useMemo, useState } from 'react';
import { ToggleButton } from 'react-aria-components';
import { written } from '@/api/client';
import { inventoryPaths as p } from '@/api/inventory/paths';
import type {
  FurnitureCompartment,
  FurnitureView,
  PlaceView,
  TurnBody,
} from '@/api/inventory/types';
import { mapKeys } from '@/api/map/queries';
import { useOfferUndo } from '@/components/history/undo';
import { LinkButton, Notice, Section, useErrorText } from '@/components/page';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { ChoiceCards, Segmented } from '@/components/ui/segmented';
import { isolate } from '@/lib/bidi';
import { useFormat } from '@/lib/format';
import { cn } from '@/lib/utils';
import { invalidateBrowse } from './api';
import { useFailedCodeText } from './furniture';
import { Sheet } from './sheet';

export type CompartmentsProps = {
  place: PlaceView;
  canEdit: boolean;
  /** Labels are on in this location: "Print their labels". */
  labels: boolean;
};

type Furnished = { place: PlaceView };

export const furnitureApi = {
  turn: (id: string, body: TurnBody) => written.post<Furnished>(p.placeTurn(id), body),
  merge: (id: string, compartmentIds: string[]) =>
    written.post<Furnished>(p.placeMergeCompartments(id), { compartmentIds }),
  split: (id: string, compartmentId: string) =>
    written.post<Furnished>(p.placeSplitCompartment(id), { compartmentId }),
};

/** The rules' view of the page's compartments (codes and short IDs aren't needed here). */
const asRules = (list: readonly FurnitureCompartment[]): Compartment[] =>
  list.map((c) => ({
    id: c.id,
    name: c.name,
    row: c.row,
    col: c.col,
    rows: c.rows,
    cols: c.cols,
    n: c.n,
    codes: [],
    shortIds: [],
    parts: [],
  }));

function useRefresh() {
  const qc = useQueryClient();
  return () => Promise.all([invalidateBrowse(qc), qc.invalidateQueries({ queryKey: mapKeys.all })]);
}

/** The grid of compartments as the furniture stands: a cell each, a merged one across its own. */
function Grid({
  furniture,
  cells,
  render,
  label,
}: {
  furniture: Pick<FurnitureView, 'columns' | 'rows'>;
  cells: readonly Pick<FurnitureCompartment, 'id' | 'n' | 'row' | 'col' | 'rows' | 'cols'>[];
  render: (id: string) => ReactNode;
  label: string;
}) {
  return (
    // Numbered as the furniture stands in the room, top left first, in every language.
    <ol
      dir="ltr"
      aria-label={label}
      className="m-0 grid list-none gap-1 p-0"
      style={{
        gridTemplateColumns: `repeat(${furniture.columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${furniture.rows}, minmax(2.75rem, auto))`,
      }}
    >
      {[...cells]
        .sort((a, b) => a.n - b.n)
        .map((c) => (
          <li
            key={c.id}
            className="grid min-w-0"
            style={{
              gridRow: `${c.row} / span ${c.rows}`,
              gridColumn: `${c.col} / span ${c.cols}`,
            }}
          >
            {render(c.id)}
          </li>
        ))}
    </ol>
  );
}

const CELL =
  'grid min-h-11 w-full min-w-0 place-items-center content-center gap-0.5 rounded-md border px-1 py-1 text-center text-small tabular-nums outline-none focus-visible:outline-2 focus-visible:outline-info';

export function CompartmentsSection({ place, canEdit, labels }: CompartmentsProps) {
  const { t } = useLingui();
  const fmt = useFormat();
  const furniture = place.furniture;
  const [mode, setMode] = useState<'view' | 'pick'>('view');
  const [picked, setPicked] = useState<string[]>([]);
  const [turning, setTurning] = useState(false);
  const errorText = useErrorText();
  const refresh = useRefresh();
  const offerUndo = useOfferUndo();
  const name = place.name;

  const merge = useMutation({
    mutationFn: () => furnitureApi.merge(place.id, picked),
    onSuccess: async ({ auditEvents }) => {
      await refresh();
      const into = furniture?.compartments.find((c) => picked.includes(c.id) && isTopLeft(c));
      const merged = isolate(into?.name ?? name);
      offerUndo({ title: t`Merged into ${merged}` }, auditEvents);
      setPicked([]);
      setMode('view');
    },
  });
  const split = useMutation({
    mutationFn: () => furnitureApi.split(place.id, picked[0] as string),
    onSuccess: async ({ auditEvents }) => {
      await refresh();
      const one = furniture?.compartments.find((c) => c.id === picked[0])?.name ?? name;
      offerUndo({ title: t`Split ${isolate(one)}` }, auditEvents);
      setPicked([]);
      setMode('view');
    },
  });

  if (!furniture || furniture.compartments.length === 0) return null;
  const byId = new Map(furniture.compartments.map((c) => [c.id, c]));
  const isTopLeft = (c: FurnitureCompartment) => {
    const chosen = picked.map((id) => byId.get(id)).filter((x): x is FurnitureCompartment => !!x);
    return (
      c.row === Math.min(...chosen.map((x) => x.row)) &&
      c.col === Math.min(...chosen.map((x) => x.col))
    );
  };
  const one = picked.length === 1 ? byId.get(picked[0] as string) : undefined;
  const canSplit = !!one && one.rows * one.cols > 1;
  const canMerge =
    picked.length >= 2 && mergeProblem(asRules(furniture.compartments), picked) === null;
  const across = fmt.num(furniture.columns);
  const up = fmt.num(furniture.rows);
  const busy = merge.isPending || split.isPending;
  const error = merge.error ?? split.error;
  const ordered = [...furniture.compartments].sort((a, b) => a.n - b.n);

  const cell = (id: string) => {
    const c = byId.get(id) as FurnitureCompartment;
    const number = fmt.num(c.n);
    const code = furniture.columns <= 4 && c.code ? c.code : null;
    const body = (
      <>
        <span className="font-semibold">{number}</span>
        {code ? (
          <span className="text-[11px] text-ink-3 [overflow-wrap:anywhere]">{code}</span>
        ) : null}
      </>
    );
    if (mode === 'pick') {
      const on = picked.includes(id);
      return (
        <ToggleButton
          isSelected={on}
          aria-label={c.name}
          className={cn(
            CELL,
            'h-full cursor-pointer data-focus-visible:outline-2 data-focus-visible:outline-info',
            on ? 'border-ink bg-ink text-paper' : 'border-line bg-sunken text-ink',
          )}
          onChange={(next) => setPicked((x) => (next ? [...x, id] : x.filter((y) => y !== id)))}
        >
          {body}
        </ToggleButton>
      );
    }
    return (
      <Link
        to="/p/$id"
        params={{ id: c.shortCode ?? c.id }}
        aria-label={c.name}
        className={cn(CELL, 'h-full border-line bg-sunken text-ink hover:border-ink-3')}
      >
        {body}
      </Link>
    );
  };

  return (
    <Section title={<Trans>Compartments</Trans>}>
      <div className="grid gap-3">
        <figure className="m-0 grid gap-2">
          <figcaption className="text-small text-ink-2">
            <Trans>
              {across} across, {up} up, counted from the top left, row by row
            </Trans>
          </figcaption>
          <Grid
            furniture={furniture}
            cells={furniture.compartments}
            render={cell}
            label={t`Compartments`}
          />
        </figure>
        {mode === 'pick' ? (
          <p className="m-0 text-small text-ink-2">
            <Trans>
              Choose compartments side by side to merge them, or one merged compartment to split it
              again.
            </Trans>
          </p>
        ) : null}
        {error ? <Notice tone="danger">{errorText(error)}</Notice> : null}
        <div className="flex flex-wrap gap-2">
          {canEdit && mode === 'view' ? (
            <>
              {furniture.canTurn ? (
                <Button size="small" variant="secondary" onPress={() => setTurning(true)}>
                  <Trans>Turn it…</Trans>
                </Button>
              ) : null}
              <Button
                size="small"
                variant="secondary"
                onPress={() => {
                  setMode('pick');
                  setPicked([]);
                }}
              >
                <Trans>Merge or split…</Trans>
              </Button>
            </>
          ) : null}
          {canEdit && mode === 'pick' ? (
            <>
              <Button
                size="small"
                isDisabled={!canMerge || busy}
                isPending={merge.isPending}
                onPress={() => merge.mutate()}
              >
                <Trans>Merge</Trans>
              </Button>
              <Button
                size="small"
                variant="secondary"
                isDisabled={!canSplit || busy}
                isPending={split.isPending}
                onPress={() => split.mutate()}
              >
                <Trans>Split</Trans>
              </Button>
              <Button
                size="small"
                variant="ghost"
                onPress={() => {
                  setMode('view');
                  setPicked([]);
                }}
              >
                <Trans>Done</Trans>
              </Button>
            </>
          ) : null}
          {labels && mode === 'view' ? (
            <LinkButton
              size="small"
              variant="ghost"
              to="/labels"
              search={{ loc: place.locationId, places: ordered.map((c) => c.id).join(',') }}
            >
              <Trans>Print their labels</Trans>
            </LinkButton>
          ) : null}
        </div>
      </div>
      {turning ? (
        <TurnSheet place={place} furniture={furniture} onClose={() => setTurning(false)} />
      ) : null}
    </Section>
  );
}

/** Turn it: which way, and Renumber or Keep the codes, chosen each time. */
export function TurnSheet({
  place,
  furniture,
  onClose,
}: {
  place: PlaceView;
  furniture: FurnitureView;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const fmt = useFormat();
  const refresh = useRefresh();
  const offerUndo = useOfferUndo();
  const failedText = useFailedCodeText();
  const [direction, setDirection] = useState<TurnDirection | null>(null);
  const [mode, setMode] = useState<'renumber' | 'keep' | null>(null);
  const unit = isolate(place.name);

  // What it will look like: each compartment moved with the unit, numbered as it will be.
  const preview = useMemo(() => {
    if (!direction) return null;
    const layout = {
      ...furniture.layout,
      orientation: furniture.layout.orientation as PlaceOrientation,
    };
    return turnCompartments(
      asRules(furniture.compartments),
      layout,
      direction,
      mode === 'renumber',
      {
        name: null,
        code: null,
        parent: null,
      },
    );
  }, [direction, mode, furniture]);

  const turn = useMutation({
    mutationFn: () =>
      furnitureApi.turn(place.id, {
        direction: direction as TurnDirection,
        renumber: mode === 'renumber',
      }),
    onSuccess: async ({ auditEvents }) => {
      await refresh();
      offerUndo(
        {
          title: t`Turned ${unit}`,
          description:
            mode === 'renumber'
              ? t`Renumbered. Print their labels again for the new names.`
              : t`The numbers and codes are as they were.`,
        },
        auditEvents,
      );
      onClose();
    },
  });

  const across = preview ? fmt.num(preview.grid.columns) : '';
  const up = preview ? fmt.num(preview.grid.rows) : '';
  return (
    <Sheet isOpen onOpenChange={(o) => !o && onClose()} title={t`Turn ${unit}`}>
      {({ close }) => (
        <div className="grid gap-4">
          <Segmented<TurnDirection>
            label={t`Its top went`}
            description={t`As you face it.`}
            value={direction}
            onChange={setDirection}
            options={[
              { id: 'right', label: t`To the right` },
              { id: 'left', label: t`To the left` },
            ]}
          />
          <ChoiceCards<'renumber' | 'keep'>
            label={t`Its compartments`}
            value={mode}
            onChange={setMode}
            options={[
              {
                id: 'renumber',
                title: t`Renumber`,
                body: t`Each gets the number and code of where it now stands, top left first. An old code opens the compartment now in its place; printed labels stay with theirs.`,
              },
              {
                id: 'keep',
                title: t`Keep the codes`,
                body: t`Only how it stands changes: each keeps its number, name and codes.`,
              },
            ]}
          />
          {preview ? (
            <figure className="m-0 grid gap-2">
              <figcaption className="text-small text-ink-2">
                <Trans>
                  {across} across, {up} up, counted from the top left, row by row
                </Trans>
              </figcaption>
              <Grid
                furniture={preview.grid}
                cells={preview.compartments}
                label={t`Compartments after turning`}
                render={(id) => {
                  const c = preview.compartments.find((x) => x.id === id);
                  return (
                    <span className={cn(CELL, 'h-full border-line bg-sunken')}>
                      {fmt.num(c?.n ?? 0)}
                    </span>
                  );
                }}
              />
            </figure>
          ) : null}
          {turn.error ? <Notice tone="danger">{failedText(turn.error)}</Notice> : null}
          <DialogFooter>
            <Button variant="secondary" onPress={close}>
              <Trans>Cancel</Trans>
            </Button>
            <Button
              isDisabled={!direction || !mode}
              isPending={turn.isPending}
              onPress={() => turn.mutate()}
            >
              <Trans>Turn</Trans>
            </Button>
          </DialogFooter>
        </div>
      )}
    </Sheet>
  );
}
