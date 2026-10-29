/**
 * Adding a floor plan's rooms (D266), as the location's map page handles the server's refusals:
 * the 3D engine is a stand-in (jsdom draws no WebGL) and the API is the demo's mock. A 409
 * `arranged_since` or `changed_since` loads the map again and places the rooms on it, the review
 * staying open with its names; a 409 `not_ready` (someone else added or discarded the plan
 * meanwhile) says so and closes the review. Invented data only.
 */
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/client';
import { mapMockRoutes } from '@/api/map/mock';
import { mapApi } from '@/api/map/queries';
import type { FloorPlanView } from '@/api/map/types';
import { IDS, type MockState, ownerScenario } from '@/api/mock/fixtures';
import type { Plan } from '@/map/layout';
import { renderApp } from '@/test/app';

type State = {
  levelKey: string;
  allFloors: boolean;
  focused: string | null;
  selected: { type: 'room' | 'item'; id: string } | null;
  planView: boolean;
  arranging: boolean;
  tool: 'move' | 'room';
};

const { engines, FakeEngine } = vi.hoisted(() => {
  const engines: FakeEngine[] = [];
  class FakeEngine {
    s: State;
    plan: Plan;
    calls: string[] = [];
    events: { onState: (s: State) => void; onChange: () => void };
    constructor(opts: {
      levelKey: string;
      plan: Plan;
      events: { onState: (s: State) => void; onChange: () => void };
    }) {
      this.s = {
        levelKey: opts.levelKey,
        allFloors: false,
        focused: null,
        selected: null,
        planView: false,
        arranging: false,
        tool: 'move',
      };
      this.plan = opts.plan;
      this.events = opts.events;
      engines.push(this);
      // biome-ignore lint/correctness/noConstructorReturn: a catch-all stand-in for the WebGL engine
      return new Proxy(this, {
        get: (t, k) => (k in t ? t[k as keyof FakeEngine] : () => {}),
      });
    }
    get state(): State {
      return { ...this.s };
    }
    setArranging(on: boolean) {
      this.s = { ...this.s, arranging: on };
      this.events.onState(this.state);
    }
    setPlanView(on: boolean) {
      this.s = { ...this.s, planView: on };
      this.events.onState(this.state);
    }
    select(sel: State['selected']) {
      this.s = { ...this.s, selected: sel };
      this.events.onState(this.state);
    }
    setPlan(plan: Plan) {
      this.calls.push('setPlan');
      this.plan = plan;
    }
  }
  return { engines, FakeEngine };
});

vi.mock('@/map/engine/engine', () => ({ MapEngine: FakeEngine }));

beforeEach(() => {
  engines.length = 0;
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-28T10:00:00Z') });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** A plan of Home's, read by the mock (its sample plan), ready to check. */
async function openPlan(state: MockState): Promise<FloorPlanView> {
  const fileId = '01926f00-0000-7000-8000-0000000f1a01';
  state.inventory.files[fileId] = {
    id: fileId,
    sha256: 'a'.repeat(64),
    bytes: 10,
    mime: 'image/png',
    class: 'document',
    hasGps: false,
    width: 1,
    height: 1,
    derivativeState: 'ready',
    thumbUrl: null,
    displayUrl: null,
  };
  const start = mapMockRoutes(state).find(
    (r) => r.method === 'POST' && r.template.endsWith('/floor-plans'),
  );
  const out = (await start?.handler({
    method: 'POST',
    path: '',
    params: { id: IDS.home },
    query: new URLSearchParams(),
    headers: {},
    body: { fileId },
  })) as { body: FloorPlanView };
  vi.setSystemTime(new Date('2026-10-28T10:01:00Z'));
  return out.body;
}

const refusal = (reason: string) =>
  new ApiError(409, 'conflict', 'That conflicts with the current state.', { details: { reason } });

async function reviewing() {
  const state = ownerScenario();
  await openPlan(state);
  const app = await renderApp(`/loc/${IDS.home}?view=map`, { state });
  await waitFor(() => expect(engines.length).toBeGreaterThan(0));
  await app.user.click(
    await screen.findByRole('button', { name: 'Check it' }, { timeout: 10_000 }),
  );
  const panel = await screen.findByRole(
    'region',
    { name: 'Rooms from the plan' },
    { timeout: 5000 },
  );
  return { ...app, panel };
}

describe('adding a floor plan’s rooms, refused', () => {
  it.each(['arranged_since', 'changed_since'])(
    '409 %s: the map is loaded again, the rooms placed on it, the review kept',
    async (reason) => {
      const apply = vi.spyOn(mapApi, 'applyPlan').mockRejectedValueOnce(refusal(reason));
      const map = vi.spyOn(mapApi, 'map');
      const { user, panel } = await reviewing();
      const loads = map.mock.calls.length;
      await user.click(screen.getByRole('button', { name: /^Add \d+ rooms$/ }));
      expect(apply).toHaveBeenCalledTimes(1);
      expect(
        await within(panel).findByText(
          'Someone arranged this map since you started. Load it again; your rooms stay to add.',
          {},
          { timeout: 5000 },
        ),
      ).toBeInTheDocument();
      await waitFor(() => expect(map.mock.calls.length).toBeGreaterThan(loads), { timeout: 5000 });
      expect(screen.getByRole('region', { name: 'Rooms from the plan' })).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Add Living room' })).toBeChecked();
    },
  );

  it('409 not_ready: says someone else finished the plan, and closes the review', async () => {
    vi.spyOn(mapApi, 'applyPlan').mockRejectedValueOnce(refusal('not_ready'));
    const { user } = await reviewing();
    await user.click(screen.getByRole('button', { name: /^Add \d+ rooms$/ }));
    expect(
      await screen.findByText('Someone else added or discarded this plan.', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    await waitFor(
      () => expect(screen.queryByRole('region', { name: 'Rooms from the plan' })).toBeNull(),
      { timeout: 5000 },
    );
  });
});
