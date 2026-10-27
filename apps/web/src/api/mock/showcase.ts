/**
 * The showcase's household (`?demo=…&showcase=1`, src/demo.ts; Try Kept is always the showcase):
 * whole from the first page. The fixtures add Murdock and the borrowed ladder, the vehicles and
 * the camera-bag and tripod kits on the first request that needs them, so the tests' counts stay
 * put; in the showcase a location then said 12 things or 19 depending on the page opened first,
 * and the docs' screenshots changed with the order they were taken in.
 *
 * Its draft has a name too: an untitled draft sorts first in every list by name (as on the server),
 * so the Home list the README shows opened on "Untitled draft". The tests keep the untitled one.
 */
import { ensureSeeded } from '../household/mock/db';
import { seedKitSample } from '../household/mock/handovers';
import { INV_IDS } from '../inventory/mock/fixtures';
import { ensureVehiclesSeeded } from '../vehicles/mock/state';
import type { MockState } from './fixtures';

export const SHOWCASE_DRAFT_NAME = 'Desk lamp';

export function showcaseHousehold(state: MockState): void {
  ensureSeeded(state);
  ensureVehiclesSeeded(state);
  seedKitSample(state);
  const draft = state.inventory.things.find((t) => t.id === INV_IDS.thing.draft);
  if (draft && draft.name === null) draft.name = SHOWCASE_DRAFT_NAME;
}
