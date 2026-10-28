/**
 * Help's tour, in chapters: Basics, and one short chapter per section, walked one after another
 * (Continue at a chapter's end goes on into the next). Each chapter is a `Tour` here, with its own
 * `help.tours.<id>` progress key. Each step stands on a real screen and
 * points at a real control (`data-tour="<anchor>"`); its words are in hint-copy.ts under
 * `<tour>.<step>`. Data only: the engine that walks them is tour.ts.
 *
 * - A step names its route, the search it needs (a thing's tab, the location's Map), and the
 *   anchors it points at, first shown wins. The desktop's own stop goes in `wide`.
 * - `needs` names the subject a `$id` route opens (tour-subjects.ts): a location, a thing, a
 *   vehicle, a move, or a location you manage. One that can't be found is skipped, or, for a
 *   thing or a move, made as one clearly named sample the end of the tour offers to discard.
 * - `writes` marks a step about changing something: someone who only views everywhere never
 *   gets it. `modules` gates a step on any of these being on in one of the person's locations
 *   (the sidebar's rule); a tour's own `modules` gates all its steps.
 * - No step opens /scan: the camera starts there. Scan steps point at the header's Scan.
 *   /scan-session opens on its setup, with no camera, so the Scanning tour stands there.
 *
 * Every anchor here must exist in its route's source: tour-anchors.test.ts reads them.
 */
import type { ModuleId, TourId } from '@kept/shared';
import type { LocationDetail } from '@/api/types';
import type { LogicalSide } from './placement';

/** The phone's tab bar; the sidebar from 768 px (lib/media.ts WIDE); and from 1024 px
 * (SHEET), where a location's Table view is (map/remembered.tsx). */
export type TourLayout = 'phone' | 'wide' | 'sheet';

/** What a `$id` route opens. */
export type TourSubject = 'location' | 'thing' | 'vehicle' | 'move' | 'adminLocation' | 'kit';

/**
 * Where a step stands and what it points at. `to: null` stays on the page the tour is on.
 * `side` places the popover beside the target on a desktop; on a phone the popover is a sheet
 * docked at the bottom, above the tab bar, or at the top with `dock: 'top'` (hints.css).
 */
export type TourStop = {
  to: string | null;
  search?: Record<string, string>;
  anchors: readonly string[];
  side?: LogicalSide;
  dock?: 'top' | 'bottom';
  /** The copy entry when it isn't the step's own (`<tour>.<step>`). */
  copyId?: string;
  /** How long to wait for the anchor, in ms, when not the engine's own (tour.ts). */
  wait?: number;
};

export type TourStep = TourStop & {
  id: string;
  needs?: TourSubject;
  writes?: boolean;
  modules?: readonly ModuleId[];
  wide?: TourStop;
  /** The stop from 1024 px (SHEET), over `wide`: what only a computer has (the Table view). */
  sheet?: TourStop;
};

export type Tour = {
  id: TourId;
  modules?: readonly ModuleId[];
  steps: readonly TourStep[];
};

const thing = (id: string, anchor: string, more: Partial<TourStep> = {}): TourStep => ({
  id,
  to: '/t/$id',
  needs: 'thing',
  anchors: [anchor],
  ...more,
});

/**
 * How long the steps that open the Graph and the Map wait for their control. Each is a large chunk
 * loaded on demand, and its controls render only once it and the location's data are in: on a
 * slow phone that is longer than a page takes, and passing over every Map step would end the
 * chapter with nothing shown. The steps after the map's first find it already there, and keep the
 * engine's own wait: a control that is not shown (one floor, no floor picker) is passed over as
 * quickly as anywhere.
 */
export const MAP_ANCHOR_WAIT_MS = 10000;

/** A step on the location's Map (the same address again is no move at all). */
const onMap = (id: string, anchor: string, more: Partial<TourStep> = {}): TourStep => ({
  id,
  to: '/loc/$id',
  needs: 'location',
  search: { view: 'map' },
  anchors: [anchor],
  ...more,
});

export const TOURS: readonly Tour[] = [
  {
    id: 'basics',
    steps: [
      { id: 'needs', to: '/', anchors: ['home-needs'] },
      { id: 'locations', to: '/', anchors: ['home-locations'] },
      { id: 'scan', to: '/', anchors: ['scan-button'] },
      { id: 'search', to: '/search', anchors: ['search-field'] },
      {
        id: 'more',
        to: '/more',
        anchors: ['more-entries'],
        // A desktop has no More: the same entries are the sidebar, beside whatever page is open.
        wide: { to: null, anchors: ['nav-entries'], side: 'end', copyId: 'basics.more-wide' },
      },
      { id: 'tours', to: '/help', anchors: ['help-tours'] },
    ],
  },
  {
    id: 'things',
    steps: [
      { id: 'add', to: '/loc/$id', needs: 'location', anchors: ['location-add'], writes: true },
      {
        id: 'contents',
        to: '/loc/$id',
        needs: 'location',
        search: { view: 'list' },
        anchors: ['location-contents'],
      },
      thing('where', 'thing-where'),
      thing('actions', 'thing-actions', { writes: true }),
      // 1.14 (#170): a kit's parts, where there is one (skipped where there is none).
      {
        id: 'kits',
        to: '/t/$id',
        needs: 'kit',
        search: { tab: 'parts' },
        anchors: ['kit-parts'],
      },
      thing('tabs', 'thing-tabs'),
    ],
  },
  {
    // Graph & 3D map: the view switch (List · Grid · Graph · Table · Map, #207; Table only from
    // 1024 px, so that width's stop says so), the graph, then the map.
    id: 'map',
    steps: [
      {
        id: 'layout',
        to: '/loc/$id',
        needs: 'location',
        anchors: ['location-layout'],
        // Table is in the switch only from 1024 px: a tablet's sidebar layout gets the phone's words.
        sheet: { to: '/loc/$id', anchors: ['location-layout'], copyId: 'map.layout-table' },
      },
      {
        id: 'graph',
        to: '/loc/$id',
        needs: 'location',
        search: { view: 'graph' },
        anchors: ['graph-dim'],
        wait: MAP_ANCHOR_WAIT_MS,
      },
      onMap('view', 'map-view', { wait: MAP_ANCHOR_WAIT_MS }),
      onMap('pins', 'map-pins'),
      onMap('floors', 'map-floors'),
      onMap('arrange', 'map-arrange', { writes: true }),
    ],
  },
  {
    id: 'capture',
    steps: [
      // Capture is a full screen with its controls at the bottom: the sheet docks at the top.
      { id: 'mode', to: '/capture', anchors: ['capture-mode'], dock: 'top', writes: true },
      { id: 'shutter', to: '/capture', anchors: ['capture-shutter'], dock: 'top', writes: true },
      // #194: Room mode, where AI capture can run.
      {
        id: 'room',
        to: '/capture',
        anchors: ['capture-room'],
        dock: 'top',
        writes: true,
        modules: ['ai_capture'],
      },
      { id: 'whose', to: '/inbox', anchors: ['inbox-whose'], writes: true },
      { id: 'review', to: '/inbox', anchors: ['inbox-items'], writes: true },
    ],
  },
  {
    // Scan sessions (#168). The session screen opens on its setup, never the camera, so its steps
    // stand there; the camera only starts on Start or "Scan its label".
    id: 'scanning',
    steps: [
      { id: 'start', to: '/', anchors: ['scan-button'] },
      { id: 'modes', to: '/scan-session', anchors: ['session-modes'] },
      { id: 'target', to: '/scan-session', anchors: ['session-target'] },
      { id: 'finish', to: '/scan-session', anchors: ['session-finish'] },
      // 1.14 (#172): every count is kept, with what was missing.
      { id: 'counts', to: '/counts', anchors: ['counts-list'] },
    ],
  },
  {
    id: 'search',
    steps: [
      { id: 'field', to: '/search', anchors: ['search-field'] },
      { id: 'views', to: '/search', anchors: ['list-views'] },
      // #294: Select in a place's list: Move, Print labels, Move to Trash with one Undo.
      {
        id: 'select',
        to: '/loc/$id',
        needs: 'location',
        search: { view: 'list' },
        anchors: ['contents-select'],
        writes: true,
      },
      { id: 'labels', to: '/labels', anchors: ['labels-print'], modules: ['labels'], writes: true },
      { id: 'scan', to: '/search', anchors: ['scan-button'] },
    ],
  },
  {
    id: 'moving',
    modules: ['moving'],
    steps: [
      { id: 'start', to: '/moving', anchors: ['moving-start'], writes: true },
      { id: 'list', to: '/moving', anchors: ['moving-list'] },
      { id: 'pack', to: '/moving/$id', needs: 'move', anchors: ['move-actions'], writes: true },
      { id: 'counts', to: '/moving/$id', needs: 'move', anchors: ['move-counts'] },
    ],
  },
  {
    id: 'lending',
    modules: ['lending'],
    steps: [
      { id: 'list', to: '/lending', anchors: ['lending-list'] },
      { id: 'return', to: '/lending', anchors: ['loan-return'], writes: true },
      thing('lend', 'thing-lend', { search: { tab: 'loans' }, writes: true }),
    ],
  },
  {
    id: 'schedules',
    modules: ['schedules'],
    steps: [
      { id: 'new', to: '/schedules', anchors: ['schedules-new'], writes: true },
      { id: 'list', to: '/schedules', anchors: ['schedules-list'] },
      { id: 'complete', to: '/schedules', anchors: ['schedule-complete'], writes: true },
      { id: 'reminders', to: '/settings', anchors: ['settings-notifications'] },
    ],
  },
  {
    id: 'paperwork',
    modules: ['paperwork', 'warranties'],
    steps: [
      { id: 'list', to: '/paperwork', anchors: ['paperwork-list'] },
      { id: 'expiring', to: '/paperwork', anchors: ['paperwork-expiring'] },
      thing('add', 'thing-paperwork-add', { search: { tab: 'paperwork' }, writes: true }),
      thing('claim', 'thing-claim', {
        search: { tab: 'claims' },
        modules: ['warranties'],
        writes: true,
      }),
    ],
  },
  {
    id: 'vehicles',
    modules: ['vehicles'],
    steps: [
      { id: 'list', to: '/vehicles', anchors: ['vehicles-list'] },
      { id: 'add', to: '/vehicles', anchors: ['vehicles-add'], writes: true },
      {
        id: 'log',
        to: '/t/$id',
        needs: 'vehicle',
        anchors: ['thing-actions'],
        writes: true,
      },
      // #296: a saved service opens, all of it.
      {
        id: 'services',
        to: '/t/$id',
        needs: 'vehicle',
        search: { tab: 'services' },
        anchors: ['vehicle-services'],
      },
      {
        id: 'fuel',
        to: '/t/$id',
        needs: 'vehicle',
        search: { tab: 'fuel' },
        anchors: ['vehicle-fuel'],
        modules: ['fuel'],
      },
    ],
  },
  {
    id: 'import-export',
    steps: [
      { id: 'source', to: '/settings/import', anchors: ['import-source'], writes: true },
      { id: 'file', to: '/settings/import', anchors: ['import-file'], writes: true },
      { id: 'export', to: '/settings/export', anchors: ['export-actions'] },
    ],
  },
  {
    id: 'settings',
    steps: [
      { id: 'notifications', to: '/settings', anchors: ['settings-notifications'] },
      { id: 'locations', to: '/settings/locations', anchors: ['settings-locations'] },
      {
        id: 'invite',
        to: '/settings/location/$id/members',
        needs: 'adminLocation',
        anchors: ['members-invite'],
        writes: true,
      },
      {
        id: 'track',
        to: '/settings/location/$id/track',
        needs: 'adminLocation',
        anchors: ['location-track'],
      },
    ],
  },
];

/** The stop a step makes on `layout`: from 1024 px its `sheet` stop, else its `wide` one. */
export function stopFor(step: TourStep, layout: TourLayout): TourStop {
  if (layout === 'sheet' && step.sheet) return step.sheet;
  return layout !== 'phone' && step.wide ? step.wide : step;
}

/** What gating needs: the modules on anywhere, and whether anything is writable. */
export type TourGating = { modulesOn: ReadonlySet<ModuleId>; canWrite: boolean };

/** The gating for `locations` (the shell's own rules: useNavEntries, useHasInbox). */
export function gatingOf(locations: readonly LocationDetail[]): TourGating {
  return {
    modulesOn: new Set(locations.flatMap((l) => l.modules)),
    canWrite: locations.some((l) => l.role !== 'viewer'),
  };
}

const anyOn = (modules: readonly ModuleId[] | undefined, on: ReadonlySet<ModuleId>) =>
  !modules || modules.some((m) => on.has(m));

/** The steps of `tour` this person gets, in order; none when the tour's modules are all off. */
export function stepsFor(tour: Tour, gating: TourGating): TourStep[] {
  if (!anyOn(tour.modules, gating.modulesOn)) return [];
  return tour.steps.filter(
    (s) => (!s.writes || gating.canWrite) && anyOn(s.modules, gating.modulesOn),
  );
}

/** A chapter this person has, with the steps they get. */
export type AvailableTour = { tour: Tour; steps: TourStep[] };

/** The chapters this person has, in the tour's order: one with no steps left isn't one. */
export function availableTours(locations: readonly LocationDetail[]): AvailableTour[] {
  const gating = gatingOf(locations);
  return TOURS.map((tour) => ({ tour, steps: stepsFor(tour, gating) })).filter(
    (t) => t.steps.length > 0,
  );
}

export function tourById(id: TourId): Tour {
  const tour = TOURS.find((t) => t.id === id);
  if (!tour) throw new Error(`no tour ${id}`);
  return tour;
}

/**
 * Where Continue the tour picks up: the first of `chapters` not done, in order; the first when
 * every one is done (the tour starts again), or null with none.
 */
export function resumeAt(
  chapters: readonly AvailableTour[],
  done: (id: TourId) => boolean,
): TourId | null {
  return (chapters.find((c) => !done(c.tour.id)) ?? chapters[0])?.tour.id ?? null;
}
