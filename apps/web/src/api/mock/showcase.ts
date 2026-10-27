/**
 * The showcase's household (`?demo=…&showcase=1`, src/demo.ts; Try Kept is always the showcase):
 * whole from the first page. The fixtures add Murdock and the borrowed ladder, the vehicles and
 * the camera-bag and tripod kits on the first request that needs them, so the tests' counts stay
 * put; in the showcase a location then said 12 things or 19 depending on the page opened first,
 * and the docs' screenshots changed with the order they were taken in.
 *
 * Its draft has a name too: an untitled draft sorts first in every list by name (as on the server),
 * so the Home list the README shows opened on "Untitled draft". The tests keep the untitled one.
 *
 * Home is on two floors, so the map and the graph show floors as a house has them: the living
 * room, kitchen and hallway closet on the ground floor, the bedroom and the office upstairs. The
 * tests' Home has no floors.
 */
import { ensureSeeded } from '../household/mock/db';
import { seedKitSample } from '../household/mock/handovers';
import type { StoredPlace } from '../inventory/mock/db';
import { INV_IDS } from '../inventory/mock/fixtures';
import { ensureVehiclesSeeded } from '../vehicles/mock/state';
import type { MockState } from './fixtures';

export const SHOWCASE_DRAFT_NAME = 'Desk lamp';

/** Home's floors in the showcase. */
export const SHOWCASE_FLOORS = {
  ground: '01926f00-0000-7000-8000-0000000c0040',
  upstairs: '01926f00-0000-7000-8000-0000000c0041',
} as const;

function homeOnTwoFloors(state: MockState): void {
  const places = state.inventory.places;
  if (places.some((p) => p.id === SHOWCASE_FLOORS.ground)) return;
  const P = INV_IDS.place;
  const kitchen = places.find((p) => p.id === P.kitchen);
  if (!kitchen) return;
  const floor = (id: string, name: string, sort: number): StoredPlace => ({
    ...kitchen,
    id,
    name,
    kindKey: 'floor',
    parentId: null,
    shortCode: null,
    labelPrinted: false,
    fields: [],
    custom: {},
    secrets: [],
    sort,
  });
  places.push(
    floor(SHOWCASE_FLOORS.ground, 'Ground floor', 0),
    floor(SHOWCASE_FLOORS.upstairs, 'Upstairs', 1),
  );
  const on: Record<string, string> = {
    [P.livingRoom]: SHOWCASE_FLOORS.ground,
    [P.kitchen]: SHOWCASE_FLOORS.ground,
    [P.hallwayCloset]: SHOWCASE_FLOORS.ground,
    [P.bedroom]: SHOWCASE_FLOORS.upstairs,
    [P.office]: SHOWCASE_FLOORS.upstairs,
  };
  for (const p of places) {
    const parent = on[p.id];
    if (parent) p.parentId = parent;
  }
}

export function showcaseHousehold(state: MockState): void {
  ensureSeeded(state);
  ensureVehiclesSeeded(state);
  seedKitSample(state);
  const draft = state.inventory.things.find((t) => t.id === INV_IDS.thing.draft);
  if (draft && draft.name === null) draft.name = SHOWCASE_DRAFT_NAME;
  homeOnTwoFloors(state);
}
