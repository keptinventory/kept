/**
 * Moving a room in Arrange (#301), as the location's map page handles it: the engine moves the
 * room in its copy of the plan (a pointer drag, or an arrow key with the room selected); Done
 * saves the room's new corner in the session's one PUT, its things where they stand in it; Cancel
 * puts the map back; the arrow keys move only a selected room, only while arranging, never from
 * a control with arrow keys of its own, and say where it went. The 3D engine is a stand-in here
 * (jsdom draws no WebGL); the room-move rules themselves are map/layout.test.ts's.
 */
import { act, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INV_IDS } from '@/api/inventory/mock/fixtures';
import { mockMapView } from '@/api/map/mock';
import { IDS, ownerScenario } from '@/api/mock/fixtures';
import type { Plan } from '@/map/layout';
import { renderApp } from '@/test/app';

type Sel = { type: 'room' | 'item'; id: string };
type State = {
  levelKey: string;
  allFloors: boolean;
  focused: string | null;
  selected: Sel | null;
  planView: boolean;
  arranging: boolean;
  tool: 'move' | 'room';
};
type Events = {
  onState: (s: State) => void;
  onChange: () => void;
  onHint: (h: string) => void;
};

const { engines, FakeEngine } = vi.hoisted(() => {
  const engines: FakeEngine[] = [];
  class FakeEngine {
    s: State;
    plan: Plan;
    calls: string[] = [];
    events: Events;
    /** What the next arrow key finds: room for the step, or another room in the way. */
    room = true;
    constructor(opts: { levelKey: string; plan: Plan; events: Events }) {
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
    private emit() {
      this.events.onState(this.state);
    }
    setArranging(on: boolean) {
      this.calls.push(`arranging ${on}`);
      this.s = { ...this.s, arranging: on };
      this.emit();
    }
    select(sel: Sel | null) {
      this.s = { ...this.s, selected: sel };
      this.emit();
    }
    setPlan(plan: Plan) {
      this.calls.push('setPlan');
      this.plan = plan;
      this.emit();
    }
    /** A pointer drag of a room by its floor, as the real engine ends one. */
    dragRoom(id: string, dx: number, dz: number) {
      const r = this.plan.rooms.find((x) => x.id === id);
      if (!r) throw new Error(`no room ${id}`);
      r.x += dx;
      r.z += dz;
      this.events.onChange();
    }
    nudgeRoom(key: string) {
      this.calls.push(`nudge ${key}`);
      const sel = this.s.selected;
      const r = sel?.type === 'room' ? this.plan.rooms.find((x) => x.id === sel.id) : undefined;
      if (!this.s.arranging || !r) return null;
      if (!this.room) return { room: r, moved: false };
      r.x += 1;
      this.events.onChange();
      return { room: r, moved: true };
    }
  }
  return { engines, FakeEngine };
});
type FakeEngine = InstanceType<typeof FakeEngine>;

vi.mock('@/map/engine/engine', () => ({ MapEngine: FakeEngine }));

const P = INV_IDS.place;

const engine = async () => {
  await waitFor(() => expect(engines.length).toBeGreaterThan(0));
  return engines.at(-1) as FakeEngine;
};
const roomOf = (e: FakeEngine, id: string) => {
  const r = e.plan.rooms.find((x) => x.id === id);
  if (!r) throw new Error(`no room ${id}`);
  return r;
};
const status = () => screen.getByRole('status', { name: '' });
const said = () =>
  (
    screen
      .getAllByRole('status')
      .find((el) => el.closest('[aria-label="Map of Home"]'))
      ?.textContent?.replace(/[ ⁦-⁩]/g, '') ?? ''
  ).trim();

beforeEach(() => {
  engines.length = 0;
});

async function arranging() {
  const state = ownerScenario();
  const app = await renderApp(`/loc/${IDS.home}?view=map`, { state });
  const e = await engine();
  await app.user.click(await screen.findByRole('button', { name: 'Arrange' }));
  await waitFor(() => expect(e.s.arranging).toBe(true));
  return { ...app, state, e };
}

describe('moving a room in Arrange (#301)', () => {
  it('says how in the hint, and that rooms can’t overlap when one stops against another', async () => {
    const { e } = await arranging();
    expect(
      await screen.findByText(/To move a room, hold its floor, then drag\. Drag its amber corner/),
    ).toBeInTheDocument();
    act(() => e.events.onHint('blocked'));
    expect(await screen.findByText('Rooms can’t overlap.')).toBeInTheDocument();
  });

  it('saves the room’s new corner on Done, with its things where they stand in it', async () => {
    const { user, state, e } = await arranging();
    const before = mockMapView(state, IDS.home);
    const kitchen = roomOf(e, P.kitchen);
    const z = kitchen.z;
    const inKitchen = e.plan.items.filter((i) => i.roomId === P.kitchen).map((i) => [i.x, i.z]);
    act(() => e.dragRoom(P.kitchen, 0, 30));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByText('Map arranged')).toBeInTheDocument();
    await waitFor(() => expect(e.s.arranging).toBe(false));

    const after = mockMapView(state, IDS.home);
    expect(before?.rooms.find((r) => r.id === P.kitchen)?.layout).toBeNull();
    expect(after?.rooms.find((r) => r.id === P.kitchen)?.layout).toMatchObject({
      z: Math.round((z + 30) * 100),
    });
    // The things in it are saved in the room's own centimetres, as they were before the move.
    const saved = (after?.nodes ?? [])
      .filter((n) => n.roomId === P.kitchen)
      .map((n) => [(n.layout?.x ?? 0) / 100, (n.layout?.z ?? 0) / 100]);
    expect(saved).toHaveLength(inKitchen.length);
    for (const [i, [x, zz]] of inKitchen.entries()) {
      expect(saved[i]?.[0]).toBeCloseTo(x ?? 0, 2);
      expect(saved[i]?.[1]).toBeCloseTo(zz ?? 0, 2);
    }
  });

  it('puts the room back on Cancel, after asking', async () => {
    const { user, state, e } = await arranging();
    const x = roomOf(e, P.kitchen).x;
    act(() => e.dragRoom(P.kitchen, 4, 0));
    expect(roomOf(e, P.kitchen).x).toBe(x + 4);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Throw away' }));
    await waitFor(() => expect(e.s.arranging).toBe(false));
    expect(e.calls).toContain('setPlan');
    expect(roomOf(e, P.kitchen).x).toBe(x);
    expect(mockMapView(state, IDS.home)?.rooms.every((r) => r.layout === null)).toBe(true);
  });

  it('moves a selected room with the arrow keys and says where it went', async () => {
    const { user, e } = await arranging();
    const x = roomOf(e, P.kitchen).x;
    act(() => e.select({ type: 'room', id: P.kitchen }));
    await user.keyboard('{ArrowRight}');
    expect(e.calls.at(-1)).toBe('nudge ArrowRight');
    expect(roomOf(e, P.kitchen).x).toBe(x + 1);
    await waitFor(() => expect(said()).toBe('Moved Kitchen right.'));
    // The same step again is said again.
    const first = status().textContent;
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(status().textContent).not.toBe(first));
    expect(said()).toBe('Moved Kitchen right.');
    await user.keyboard('{ArrowUp}');
    await waitFor(() => expect(said()).toBe('Moved Kitchen up.'));
    // Another room in the way.
    e.room = false;
    await user.keyboard('{ArrowLeft}');
    await waitFor(() => expect(said()).toBe('Rooms can’t overlap.'));
    // Saved with the rest on Done.
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByText('Map arranged')).toBeInTheDocument();
  });

  it('leaves the arrow keys alone without a room selected, outside Arrange and in a field', async () => {
    const { user, e } = await arranging();
    await user.keyboard('{ArrowRight}');
    act(() => e.select({ type: 'item', id: P.deskDrawer }));
    await user.keyboard('{ArrowRight}');
    expect(e.calls.filter((c) => c.startsWith('nudge'))).toEqual([]);

    act(() => e.select({ type: 'room', id: P.kitchen }));
    const find = screen.getByRole('searchbox', { name: 'Find a thing' });
    await user.click(find);
    await user.keyboard('{ArrowLeft}');
    expect(e.calls.filter((c) => c.startsWith('nudge'))).toEqual([]);
    // Modified keys are the browser's.
    find.blur();
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(e.calls.filter((c) => c.startsWith('nudge'))).toEqual([]);

    act(() => e.setArranging(false));
    await user.keyboard('{ArrowLeft}');
    expect(e.calls.filter((c) => c.startsWith('nudge'))).toEqual([]);
    expect(said()).toBe('');
  });
});
