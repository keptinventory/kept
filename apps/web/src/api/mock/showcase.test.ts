/**
 * `showcaseHousehold`: the showcase (the docs' screenshots, Try Kept) has the whole household from
 * the first page, so a location counts the same things whichever page asked first, and its draft
 * has a name; the fixtures the tests use keep both lazy and the draft untitled.
 */
import { describe, expect, it } from 'vitest';
import { seedKitSample } from '../household/mock/handovers';
import { INV_IDS } from '../inventory/mock/fixtures';
import { paperlessPaths } from '../paperless/paths';
import { ensureVehiclesSeeded } from '../vehicles/mock/state';
import { IDS, ownerScenario } from './fixtures';
import { SHOWCASE_DRAFT_NAME, SHOWCASE_FLOORS, showcaseHousehold } from './showcase';

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

  it('puts Home on two floors for the showcase only, once', () => {
    const P = INV_IDS.place;
    const parentOf = (s: ReturnType<typeof ownerScenario>, id: string) =>
      s.inventory.places.find((p) => p.id === id)?.parentId;
    const plain = ownerScenario();
    expect(plain.inventory.places.some((p) => p.kindKey === 'floor')).toBe(false);
    const state = ownerScenario();
    showcaseHousehold(state);
    showcaseHousehold(state);
    const floors = state.inventory.places.filter((p) => p.kindKey === 'floor');
    expect(floors.map((f) => f.name)).toEqual(['Ground floor', 'Upstairs']);
    for (const id of [P.livingRoom, P.kitchen, P.hallwayCloset])
      expect(parentOf(state, id)).toBe(SHOWCASE_FLOORS.ground);
    for (const id of [P.bedroom, P.office])
      expect(parentOf(state, id)).toBe(SHOWCASE_FLOORS.upstairs);
    // What sits inside a room stays in it.
    expect(parentOf(state, P.deskDrawer)).toBe(P.office);
  });

  it('connects the Garage to Paperless once, with the drill’s two documents', async () => {
    const state = ownerScenario();
    showcaseHousehold(state);
    showcaseHousehold(state);
    const { createMockApi } = await import('./server');
    const api = createMockApi(state);
    const res = await api.fetch(
      `${paperlessPaths.links()}?thingId=${encodeURIComponent(INV_IDS.thing.drill)}`,
    );
    const body = (await res.json()) as { connected: boolean; items: { title: string }[] };
    expect(body.connected).toBe(true);
    expect(body.items.map((l) => l.title)).toEqual(['Bosch drill receipt', 'Bosch GSB 18V manual']);
  });
});
