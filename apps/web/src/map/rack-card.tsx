/**
 * #373: a rack on the map's card: its gear top to bottom, each at its units as the rails print them
 * (U12, Western digits, left to right, in the rack's numbering), the free units between them in
 * runs, and the gear mounted on the rear only after it. A tap on a piece opens its card, as a tap on
 * the piece in the rack does.
 */
import { elevationOf, type Gear } from '@kept/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import { unitsLabel, useRackCaption } from '@/components/places/rack';
import type { Item } from './layout';

export function RackList({
  it,
  part,
  onPick,
}: {
  it: Item;
  part: string | null;
  onPick: (id: string) => void;
}) {
  const { t } = useLingui();
  const caption = useRackCaption();
  const rack = it.rack;
  if (!rack) return null;
  const gear: Gear[] = rack.gear.map((g) => ({
    id: g.id,
    units: g.units,
    at: { u: g.u, face: g.face, full: g.full },
  }));
  const byId = new Map(rack.gear.map((g) => [g.id, g]));
  const rows = elevationOf(rack, gear, 'front');
  const rear = rack.gear.filter((g) => !g.full && g.face === 'rear');
  const button = (id: string, u: number, units: number) => (
    <button type="button" aria-pressed={part === id} onClick={() => onPick(id)}>
      <span dir="auto">{byId.get(id)?.name}</span>
      <small dir="ltr">{unitsLabel(rack, u, units)}</small>
    </button>
  );
  return (
    <>
      <div className="kmap-sub">
        <Trans>Rack</Trans>
      </div>
      <p className="kmap-empty">{caption(rack)}</p>
      <ul className="kmap-inv" aria-label={t`Front`}>
        {rows.map((row) =>
          row.kind === 'gear' ? (
            <li key={row.id}>{button(row.id, row.u, row.units)}</li>
          ) : (
            <li key={`e${row.from}`} className="kmap-rack-empty">
              <span>
                <Trans>Empty</Trans>
              </span>
              <small dir="ltr">{unitsLabel(rack, row.from, row.to - row.from + 1)}</small>
            </li>
          ),
        )}
      </ul>
      {rear.length ? (
        <>
          <div className="kmap-sub">
            <Trans>Rear</Trans>
          </div>
          <ul className="kmap-inv" aria-label={t`Rear`}>
            {rear.map((g) => (
              <li key={g.id}>{button(g.id, g.u, g.units)}</li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
