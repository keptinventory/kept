/**
 * `showcaseHousehold`: the showcase (the docs' screenshots, Try Kept) has the whole household from
 * the first page, so a location counts the same things whichever page asked first, and its draft
 * has a name; the fixtures the tests use keep both lazy and the draft untitled.
 */
import { describe, expect, it } from 'vitest';
import { seedKitSample } from '../household/mock/handovers';
import { INV_IDS } from '../inventory/mock/fixtures';
import { ensureVehiclesSeeded } from '../vehicles/mock/state';
import { IDS, ownerScenario } from './fixtures';
import { SHOWCASE_DRAFT_NAME, showcaseHousehold } from './showcase';

const homeThings = (state: ReturnType<typeof ownerScenario>) =>
  state.inventory.things.filter((t) => t.locationId === IDS.home && !t.deletedAt).length;

describe('showcaseHousehold', () => {
  it('adds the lazily seeded household at once, and nothing more on a later request', () => {
    const state = ownerScenario();
    const before = homeThings(state);
    showcaseHousehold(state);
    const seeded = homeThings(state);
    expect(seeded).toBeGreaterThan(before);
    expect(state.inventory.things.some((t) => t.name === 'Camera bag')).toBe(true);
    // What a kits or vehicles request would have seeded is already there.
    seedKitSample(state);
    ensureVehiclesSeeded(state);
    showcaseHousehold(state);
    expect(homeThings(state)).toBe(seeded);
  });

  it('names the draft for the showcase only', () => {
    const plain = ownerScenario();
    const draft = (s: typeof plain) => s.inventory.things.find((t) => t.id === INV_IDS.thing.draft);
    expect(draft(plain)?.name).toBeNull();
    const state = ownerScenario();
    showcaseHousehold(state);
    expect(draft(state)?.name).toBe(SHOWCASE_DRAFT_NAME);
    expect(draft(state)?.reviewState).toBe('draft');
  });

  it('types the kit parts as what they are, not as the phone they were copied from', () => {
    const state = ownerScenario();
    showcaseHousehold(state);
    const typeOf = (name: string) =>
      state.inventory.things.find((t) => t.name === name)?.type?.builtinKey ?? null;
    expect(typeOf('Camera body')).toBe('electronics');
    expect(typeOf('Spare battery')).toBe('batteries');
    expect(typeOf('Tripod')).toBeNull();
  });
});
