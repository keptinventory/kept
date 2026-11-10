/**
 * A rack on its page (#373): its elevation from the front or the rear, top to bottom, each piece of
 * gear at its units and the free units between them in runs, so a 42U rack with six pieces is a
 * handful of rows. Units are written as the rails print them (U12, Western digits, left to right)
 * in every language, in the rack's numbering (U1 at the bottom, or at the top).
 *
 * Gear is a thing directly in the rack. Under the elevation: the gear beside the rails (0U) and the
 * gear not placed yet. Members and up place a piece (Place it), or change where it is (Change):
 * its lowest unit, its height in units (in halves), its face, and full or half depth. Two pieces in
 * the same unit on a face, or a piece past the top of the rack, are refused before saving, and by
 * the server (PATCH /things/:id `rackAt`, `rackUnits`). Each change is one Undo.
 *
 * Loaded on demand (rack-lazy.tsx; vite.config.ts ON_DEMAND_ENTRIES), as furniture's compartments
 * are; the thing page and the map card use the same position sheet.
 */
import {
  elevationOf,
  firstFree,
  type Gear,
  type RackFace,
  type RackProblem,
  rackProblem,
  readLength,
  shownRange,
  shownUnit,
} from '@kept/shared';
import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { isApiError } from '@/api/client';
import { inventoryApi, usePlace } from '@/api/inventory/queries';
import type { PlaceView, RackAt, RackView } from '@/api/inventory/types';
import { mapKeys } from '@/api/map/queries';
import { useOfferUndo } from '@/components/history/undo';
import { Notice, Section, useErrorText } from '@/components/page';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Segmented } from '@/components/ui/segmented';
import { TextField } from '@/components/ui/text-field';
import { isolate } from '@/lib/bidi';
import { useOnline } from '@/lib/online';
import { formatLocale, usePrefs } from '@/lib/prefs';
import { cn } from '@/lib/utils';
import { invalidateBrowse } from './api';
import { Sheet } from './sheet';

type Numbered = Pick<RackView, 'units' | 'numbering'>;

/** The top unit a piece covers, counted from the bottom. */
const topUnit = (u: number, units: number): number => Math.floor(u + Math.max(units, 0.5) - 0.5);

/**
 * The lowest unit, counted from the bottom, of a piece whose top unit is `top` (counted from the
 * bottom). Two half-step starts share each top unit; the one with the same half-unit offset as
 * `was` (where the piece starts now) wins, so saving without a change keeps it where it is.
 */
function startUnder(top: number, units: number, was: number | null): number {
  const high = top - Math.max(units, 0.5) + 1;
  if (!Number.isInteger(top)) return high;
  const offset = was === null ? 0 : was - Math.floor(was);
  // Half a unit lower would leave the rack at its bottom: the other start fits.
  return high - Math.floor(high) === offset || high - 0.5 < 1 ? high : high - 0.5;
}

/** The units a piece covers as the rails print them: "U12", or "U11–U12". */
export function unitsLabel(rack: Numbered, u: number, units: number): string {
  const { from, to } = shownRange(rack, u, units);
  return from === to ? `U${from}` : `U${from}–U${to}`;
}

/** What the rack is, in words: "12 units, U1 at the bottom". */
export function useRackCaption() {
  return ({ units, numbering }: Numbered): string =>
    numbering === 'top'
      ? plural(units, { one: '# unit, U1 at the top', other: '# units, U1 at the top' })
      : plural(units, { one: '# unit, U1 at the bottom', other: '# units, U1 at the bottom' });
}

/** A refusal: the shared rules' problem, with the name the server gave for the gear in the way. */
type Refusal = RackProblem & { byName?: string };

/** A refused position in words, from the shared rules or the server's answer. */
export function useRackProblemText() {
  const { t } = useLingui();
  return (problem: Refusal, rack: Numbered, nameOf: (id: string) => string): string => {
    if (problem.reason === 'taken') {
      const u = `U${problem.u}`;
      // The server names gear this page may not know yet (moved in since it loaded).
      const name = isolate(problem.byName || nameOf(problem.by));
      return problem.face === 'rear'
        ? t`${u} is taken by ${name} at the rear.`
        : t`${u} is taken by ${name} at the front.`;
    }
    if (problem.reason === 'outside') {
      const units = rack.units;
      return plural(units, {
        one: "It doesn't fit: the rack is # unit high.",
        other: "It doesn't fit: the rack is # units high.",
      });
    }
    if (problem.reason === 'zero') return t`Gear with no height sits beside the rails.`;
    return t`Half units only: 1, 1.5, 2 …`;
  };
}

/** The server's refusal (`rack` in the error body) as the shared rules' problem, if it is one. */
function problemOf(error: unknown): Refusal | null {
  if (!isApiError(error)) return null;
  const r = error.details.rack as
    | {
        reason?: string;
        u?: number;
        face?: RackFace;
        top?: number;
        by?: { id: string; name: string };
      }
    | undefined;
  if (!r?.reason) return null;
  if (r.reason === 'taken' && r.by && r.face && r.u !== undefined) {
    return { reason: 'taken', by: r.by.id, byName: r.by.name, face: r.face, u: r.u };
  }
  if (r.reason === 'outside') return { reason: 'outside', top: r.top ?? 0 };
  if (r.reason === 'zero') return { reason: 'zero' };
  if (r.reason === 'half') return { reason: 'half' };
  return null;
}

type GearRow = RackView['gear'][number];

const ROW =
  'grid min-h-11 grid-cols-[minmax(4.5rem,auto)_minmax(0,1fr)_auto] items-center gap-3 rounded-md border px-3 py-1.5 text-small';

export type RackSectionProps = { place: PlaceView; canEdit: boolean };

export function RackSection({ place, canEdit }: RackSectionProps) {
  const { t } = useLingui();
  const online = useOnline();
  const caption = useRackCaption();
  const [face, setFace] = useState<RackFace>('front');
  const [editing, setEditing] = useState<GearRow | null>(null);
  const rack = place.rack;
  if (!rack) return null;
  const gear: Gear[] = rack.gear.map((g) => ({ id: g.id, units: g.units, at: g.at }));
  const byId = new Map(rack.gear.map((g) => [g.id, g]));
  const rows = elevationOf(rack, gear, face);
  const beside = rack.gear.filter((g) => g.units === 0);
  const unplaced = rack.gear.filter((g) => !g.at && g.units !== 0);
  const change = (g: GearRow) =>
    canEdit ? (
      <Button size="small" variant="ghost" isDisabled={!online} onPress={() => setEditing(g)}>
        {g.at ? <Trans>Change</Trans> : <Trans>Place it</Trans>}
      </Button>
    ) : null;
  const link = (g: GearRow) => (
    <Link
      to="/t/$id"
      params={{ id: g.shortCode ?? g.id }}
      className="min-w-0 font-medium text-ink [overflow-wrap:anywhere] hover:underline"
    >
      <bdi dir="auto">{g.name}</bdi>
    </Link>
  );

  return (
    <Section title={<Trans>Rack</Trans>}>
      <div className="grid gap-3">
        <p className="m-0 text-small text-ink-2">{caption(rack)}</p>
        <Segmented<RackFace>
          label={t`Seen from`}
          value={face}
          onChange={setFace}
          oneRow
          options={[
            { id: 'front', label: t`Front` },
            { id: 'rear', label: t`Rear` },
          ]}
        />
        {/* The rack's front as it stands, top first: physical, never mirrored. */}
        <ol dir="ltr" aria-label={t`Rack`} className="m-0 grid list-none gap-1 p-0">
          {rows.map((row) => {
            if (row.kind === 'empty') {
              const label = unitsLabel(rack, row.from, row.to - row.from + 1);
              return (
                <li key={`e${row.from}`} className={cn(ROW, 'border-line bg-sunken text-ink-3')}>
                  <span className="tabular-nums">{label}</span>
                  <span dir="auto">
                    <Trans>Empty</Trans>
                  </span>
                  <span />
                </li>
              );
            }
            const g = byId.get(row.id) as GearRow;
            return (
              <li key={row.id} className={cn(ROW, 'border-ink-3 bg-surface')}>
                <span className="tabular-nums text-ink-2">
                  {unitsLabel(rack, row.u, row.units)}
                </span>
                <span dir="auto" className="min-w-0">
                  {link(g)}
                  {g.at && !g.at.full ? (
                    <span className="block text-[12.5px] text-ink-3">
                      <Trans>Half depth</Trans>
                    </span>
                  ) : null}
                </span>
                {change(g)}
              </li>
            );
          })}
        </ol>
        {beside.length ? (
          <GearList title={t`Beside the rails (0U)`} gear={beside} link={link} change={change} />
        ) : null}
        {unplaced.length ? (
          <GearList title={t`Not placed yet`} gear={unplaced} link={link} change={change} />
        ) : null}
      </div>
      {editing ? (
        <PositionSheet
          rack={{ id: place.id, name: place.name, units: rack.units, numbering: rack.numbering }}
          thing={editing}
          others={gear}
          nameOf={(id) => byId.get(id)?.name ?? ''}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Section>
  );
}

function GearList({
  title,
  gear,
  link,
  change,
}: {
  title: string;
  gear: GearRow[];
  link: (g: GearRow) => ReactNode;
  change: (g: GearRow) => ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <h3 className="m-0 text-small font-semibold text-ink-2">{title}</h3>
      <ul className="m-0 grid list-none gap-1 p-0">
        {gear.map((g) => (
          <li
            key={g.id}
            className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-md border border-line px-3 py-1.5 text-small"
          >
            <span dir="auto" className="min-w-0">
              {link(g)}
            </span>
            {change(g)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export type PositionSheetProps = {
  rack: { id: string; name: string; units: number; numbering: 'bottom' | 'top' };
  thing: { id: string; name: string; units: number | null; at: RackAt | null; rowVersion: number };
  /** Every piece in the rack, this one among them (skipped). */
  others: readonly Gear[];
  nameOf: (id: string) => string;
  onClose: () => void;
};

/** Where a piece of gear sits: its lowest unit, its height, its face and depth. */
export function PositionSheet({ rack, thing, others, nameOf, onClose }: PositionSheetProps) {
  const { t } = useLingui();
  const online = useOnline();
  const qc = useQueryClient();
  const offerUndo = useOfferUndo();
  const errorText = useErrorText();
  const problemText = useRackProblemText();
  const { locale, digits } = usePrefs();
  const tag = formatLocale(locale, digits);
  const startUnits = thing.units ?? 1;
  const free = firstFree(rack, others, startUnits, 'front', true);
  const was = thing.at?.u ?? free;
  const [startText, setStartText] = useState(() => {
    const u = was;
    if (u === null) return '';
    // From the top, the unit a person names is the piece's top one.
    return String(rack.numbering === 'top' ? shownUnit(rack, topUnit(u, startUnits)) : u);
  });
  const [heightText, setHeightText] = useState(String(startUnits));
  const [face, setFace] = useState<RackFace>(thing.at?.face ?? 'front');
  const [depth, setDepth] = useState<'full' | 'half'>(thing.at?.full === false ? 'half' : 'full');
  const name = isolate(thing.name);
  const rackName = isolate(rack.name);

  const height = readLength(heightText, tag, null);
  const start = readLength(startText, tag, null);
  const heightOk = typeof height === 'number' && height <= 60;
  // The unit typed is in the rack's numbering; the rules count from the bottom. From the top,
  // the unit typed is the piece's top one, and the piece keeps its half-unit offset.
  const u =
    typeof start === 'number' && heightOk
      ? rack.numbering === 'top'
        ? startUnder(shownUnit(rack, start), height, was)
        : start
      : null;
  const at: RackAt | null = u === null ? null : { u, face, full: depth === 'full' };
  const local: RackProblem | null =
    heightOk && height !== 0 && at
      ? rackProblem(rack, { id: thing.id, units: height, at }, others)
      : null;
  const missing = heightOk && height !== 0 && at === null;

  const refresh = () =>
    Promise.all([invalidateBrowse(qc), qc.invalidateQueries({ queryKey: mapKeys.all })]);
  const save = useMutation({
    mutationFn: (body: { rackUnits?: number | null; rackAt: RackAt | null }) =>
      inventoryApi.updateThing(thing.id, body, thing.rowVersion),
    onSuccess: async ({ auditEvents }, body) => {
      await refresh();
      offerUndo(
        { title: body.rackAt ? t`Placed ${name}` : t`Took ${name} off its unit` },
        auditEvents,
      );
      onClose();
    },
  });
  const serverProblem = problemOf(save.error);

  return (
    <Sheet isOpen onOpenChange={(o) => !o && onClose()} title={t`${name} in ${rackName}`}>
      {({ close }) => (
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!heightOk || local || missing) return;
            save.mutate({ rackUnits: height, rackAt: height === 0 ? null : at });
          }}
        >
          <TextField
            label={t`Starts at`}
            description={
              rack.numbering === 'top'
                ? t`Its top unit, as the rack numbers them.`
                : t`Its lowest unit, as the rack numbers them.`
            }
            value={startText}
            onChange={(v) => {
              setStartText(v);
              save.reset();
            }}
            isInvalid={missing && startText.trim() !== ''}
            inputProps={{ inputMode: 'decimal', dir: 'ltr' }}
          />
          <TextField
            label={t`Height`}
            description={t`In rack units, halves allowed. 0 sits beside the rails.`}
            value={heightText}
            onChange={(v) => {
              setHeightText(v);
              save.reset();
            }}
            isInvalid={!heightOk}
            errorMessage={heightOk ? undefined : t`Half units only: 1, 1.5, 2 …`}
            inputProps={{ inputMode: 'decimal', dir: 'ltr' }}
          />
          <Segmented<RackFace>
            label={t`Faces`}
            value={face}
            onChange={setFace}
            oneRow
            options={[
              { id: 'front', label: t`Front` },
              { id: 'rear', label: t`Rear` },
            ]}
          />
          <Segmented<'full' | 'half'>
            label={t`Depth`}
            value={depth}
            onChange={setDepth}
            oneRow
            options={[
              { id: 'full', label: t`Full depth` },
              { id: 'half', label: t`Half depth` },
            ]}
          />
          {local || serverProblem ? (
            <Notice tone="danger">
              {problemText((local ?? serverProblem) as Refusal, rack, nameOf)}
            </Notice>
          ) : save.error ? (
            <Notice tone="danger">{errorText(save.error)}</Notice>
          ) : null}
          <DialogFooter>
            {thing.at ? (
              <Button
                variant="ghost"
                isDisabled={!online || save.isPending}
                onPress={() => save.mutate({ rackAt: null })}
              >
                <Trans>Take it off its unit</Trans>
              </Button>
            ) : null}
            <Button variant="secondary" onPress={close}>
              <Trans>Cancel</Trans>
            </Button>
            <Button
              type="submit"
              isDisabled={!online || !heightOk || !!local || missing}
              isPending={save.isPending}
            >
              <Trans>Save</Trans>
            </Button>
          </DialogFooter>
        </form>
      )}
    </Sheet>
  );
}

export type GearSheetProps = { rackId: string; thingId: string; onClose: () => void };

/** The position sheet for one piece of gear, from its rack's page as the server has it now. */
export function GearSheet({ rackId, thingId, onClose }: GearSheetProps) {
  const place = usePlace(rackId);
  const rack = place.data?.rack;
  const thing = rack?.gear.find((g) => g.id === thingId);
  if (!place.data || !rack || !thing) return null;
  const byId = new Map(rack.gear.map((g) => [g.id, g.name]));
  return (
    <PositionSheet
      rack={{ id: rackId, name: place.data.name, units: rack.units, numbering: rack.numbering }}
      thing={thing}
      others={rack.gear.map((g) => ({ id: g.id, units: g.units, at: g.at }))}
      nameOf={(id) => byId.get(id) ?? ''}
      onClose={onClose}
    />
  );
}
