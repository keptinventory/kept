/**
 * First-use hint keys, remembered per user on the server (D138; `user_hints`, `PUT
 * /api/v1/me/hints/:key`). `installed_standalone` is shared with step 2's Home checklist, which
 * reads it to tick "Install on your phone".
 *
 * Help's Tours (#189): one key per tour, `help.tours.<tour>`, dismissed once the person finished
 * that tour (or closed it at its last step). Help shows it as Done; any tour replays.
 *
 * The keys of the single guided walk that came before (`help.tour.<section>`, `help.tour_seen`)
 * stay accepted, so a tab still open on an older build can write them.
 */
export const TOUR_IDS = [
  'basics',
  'things',
  'map',
  'capture',
  'scanning',
  'search',
  'moving',
  'lending',
  'schedules',
  'paperwork',
  'vehicles',
  'import-export',
  'settings',
] as const;
export type TourId = (typeof TOUR_IDS)[number];

/** The hint key that remembers a tour was finished. */
export const tourKey = <T extends TourId>(tour: T): `help.tours.${T}` => `help.tours.${tour}`;

export function isTourId(value: string): value is TourId {
  return (TOUR_IDS as readonly string[]).includes(value);
}

/** The sections of the older single walk: their progress keys stay accepted. */
export const TOUR_SECTION_IDS = [
  'home',
  'capture',
  'inbox',
  'location',
  'search',
  'labels',
  'more',
  'settings',
  'finish',
] as const;
export type TourSectionId = (typeof TOUR_SECTION_IDS)[number];

/** The older walk's per-section progress key (still accepted, no longer written). */
export const tourProgressKey = <S extends TourSectionId>(section: S): `help.tour.${S}` =>
  `help.tour.${section}`;

export const HINT_KEYS = [
  'capture.mode_strip',
  'inbox.suggested',
  'labels.first_print',
  'scan.first_open',
  'help.tour_seen',
  'ai_settings_opened',
  'installed_standalone',
  ...TOUR_SECTION_IDS.map(tourProgressKey),
  ...TOUR_IDS.map(tourKey),
] as const;
export type HintKey = (typeof HINT_KEYS)[number];

export function isHintKey(value: string): value is HintKey {
  return (HINT_KEYS as readonly string[]).includes(value);
}
