/**
 * A location's layout, remembered (1.x, D237, M11): List, Grid, Graph (#207), Table or Map is the
 * address's `view` (D223), and Kept remembers the last one per person and location on this device,
 * so a location someone keeps as a map opens as one. A place's page remembers its own (#190): Map on one room
 * doesn't turn every other room, or the location's page, into a map. List stays the default.
 * Small and precached: the map and the graph load on demand (./lazy.tsx, graph/lazy.tsx).
 */
import { useLingui } from '@lingui/react/macro';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { type ReactNode, useEffect, useRef } from 'react';
import { useMe } from '@/api/queries';
import { GraphIcon, GridIcon, ListIcon, MapIcon, TableIcon } from '@/components/icons';
import { Segmented } from '@/components/ui/segmented';
import { SHEET, useMediaQuery } from '@/lib/media';

/** 1.x (D250): `table`, the spreadsheet view, on a screen 1024 px wide or more. #207: `graph`. */
export type LocationLayout = 'list' | 'grid' | 'graph' | 'map' | 'table';

const LAYOUTS: readonly string[] = ['grid', 'graph', 'map', 'table'];
const layoutOf = (v: unknown): LocationLayout =>
  typeof v === 'string' && LAYOUTS.includes(v) ? (v as LocationLayout) : 'list';

const keyOf = (userId: string, locationId: string, placeId?: string) =>
  placeId ? `kept.place.view.${userId}.${placeId}` : `kept.loc.view.${userId}.${locationId}`;
/** Set once a map has been opened on this device; the Map option stops shining. */
const SEEN = 'kept.map.seen';
function seen(): boolean {
  try {
    return localStorage.getItem(SEEN) === '1';
  } catch {
    return true;
  }
}
function markSeen(): void {
  try {
    localStorage.setItem(SEEN, '1');
  } catch {
    // A shine that comes back is harmless.
  }
}

function read(key: string): LocationLayout | null {
  try {
    const v = localStorage.getItem(key);
    return v && LAYOUTS.includes(v) ? (v as LocationLayout) : null;
  } catch {
    return null;
  }
}

function write(key: string, v: LocationLayout): void {
  try {
    if (v === 'list') localStorage.removeItem(key);
    else localStorage.setItem(key, v);
  } catch {
    // Remembering is a convenience: the address still says the layout.
  }
}

/** The layout in the address, after restoring the remembered one on arrival: the location's, or
 * with `placeId`, that place's page's. */
export function useRememberedLayout(locationId: string, placeId?: string): LocationLayout {
  const search = useSearch({ strict: false }) as { view?: unknown };
  const navigate = useNavigate();
  const me = useMe();
  const userId = me.data?.user.id;
  const view = layoutOf(search.view);
  const explicit = search.view !== undefined;
  // Only on arrival does a missing `view` mean "as last time"; afterwards it means List (the
  // Display menu clears `view` for its default).
  const arrived = useRef(false);
  useEffect(() => {
    if (!userId) return;
    const key = keyOf(userId, locationId, placeId);
    const first = !arrived.current;
    arrived.current = true;
    if (explicit || !first) {
      write(key, view);
      return;
    }
    const stored = read(key);
    if (stored)
      void navigate({
        to: '.',
        search: (prev: Record<string, unknown>) => ({ ...prev, view: stored }),
        replace: true,
      });
  }, [userId, locationId, placeId, view, explicit, navigate]);
  return view;
}

/** List · Grid · Graph (· Table on a wide screen) · Map, each with its icon (#207), above the
 * map, where the list's Display menu isn't. A place's page has no Table (`table={false}`). */
export function LayoutSwitch({ table = true }: { table?: boolean } = {}) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { view?: unknown };
  const wide = useMediaQuery(SHEET) && table;
  const asked = layoutOf(search.view);
  const value: LocationLayout = asked === 'table' && !wide ? 'list' : asked;
  const shine = value !== 'map' && !seen();
  useEffect(() => {
    if (value === 'map') markSeen();
  }, [value]);
  return (
    <Segmented<LocationLayout>
      aria-label={t`Layout`}
      // The guided tour points here (components/hints/tour.ts, D242).
      data-tour="location-layout"
      className={wide ? 'w-full max-w-md' : 'w-full max-w-sm'}
      oneRow
      value={value}
      onChange={(v) =>
        void navigate({
          to: '.',
          search: (prev: Record<string, unknown>) => ({ ...prev, view: v === 'list' ? 'list' : v }),
        })
      }
      options={[
        { id: 'list', label: <Option icon={<ListIcon className={ICON} />}>{t`List`}</Option> },
        { id: 'grid', label: <Option icon={<GridIcon className={ICON} />}>{t`Grid`}</Option> },
        { id: 'graph', label: <Option icon={<GraphIcon className={ICON} />}>{t`Graph`}</Option> },
        ...(wide
          ? [
              {
                id: 'table' as const,
                label: <Option icon={<TableIcon className={ICON} />}>{t`Table`}</Option>,
              },
            ]
          : []),
        {
          id: 'map',
          label: (
            <Option icon={<MapIcon className={ICON} />} shine={shine}>
              {t`Map`}
            </Option>
          ),
        },
      ]}
    />
  );
}

const ICON = 'size-4 shrink-0';

/** A layout's icon and name, side by side; Map shines until a map was first opened here. */
function Option({
  icon,
  shine = false,
  children,
}: {
  icon: ReactNode;
  shine?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-1 ${shine ? 'kept-shine' : ''}`}
    >
      {icon}
      {children}
    </span>
  );
}
