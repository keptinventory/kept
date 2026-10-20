/**
 * Help's Tours: Basics, and one short tour per section. Each step stands on a real screen and
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
 *
 * Every anchor here must exist in its route's source: tour-anchors.test.ts reads them.
 */
import type { ModuleId, TourId } from '@kept/shared';
import type { LocationDetail } from '@/api/types';
import type { LogicalSide } from './placement';

/** The two shells: the phone's tab bar, or the sidebar from 768 px (lib/media.ts WIDE). */
export type TourLayout = 'phone' | 'wide';

/** What a `$id` route opens. */
export type TourSubject = 'location' | 'thing' | 'vehicle' | 'move' | 'adminLocation';

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
};

export type TourStep = TourStop & {
  id: string;
  needs?: TourSubject;
  writes?: boolean;
  modules?: readonly ModuleId[];
  wide?: TourStop;
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
      thing('tabs', 'thing-tabs'),
    ],
  },
  {
    id: 'map',
    steps: [
      { id: 'layout', to: '/loc/$id', needs: 'location', anchors: ['location-layout'] },
      onMap('view', 'map-view'),
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
    id: 'search',
    steps: [
      { id: 'field', to: '/search', anchors: ['search-field'] },
      { id: 'views', to: '/search', anchors: ['list-views'] },
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

/** The stop a step makes on `layout`. */
export function stopFor(step: TourStep, layout: TourLayout): TourStop {
  return layout === 'wide' && step.wide ? step.wide : step;
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

/** A tour this person has, with the steps they get. */
export type AvailableTour = { tour: Tour; steps: TourStep[] };

/** The tours this person has, in Help's order: one with no steps left isn't one. */
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
