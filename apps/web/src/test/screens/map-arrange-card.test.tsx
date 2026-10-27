/**
 * #330: on a phone, a card opened in the map's Arrange covered the second row of Arrange's tools,
 * Cancel among them. Where the card is a sheet at the bottom (map.css, up to 899 px), the bar,
 * the tools and the card now stack in one column, the card last, so it stops below the tools.
 * jsdom lays nothing out: this holds the order and the rules that make it, and that Cancel and
 * Done work with a card open; e2e/map-arrange.spec.ts measures it in a browser at 375 px.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INV_IDS } from '@/api/inventory/mock/fixtures';
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
type Events = { onState: (s: State) => void; onChange: () => void };

const { engines, FakeEngine } = vi.hoisted(() => {
  const engines: FakeEngine[] = [];
  class FakeEngine {
    s: State;
    plan: Plan;
    events: Events;
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
    setArranging(on: boolean) {
      this.s = { ...this.s, arranging: on };
      this.events.onState(this.state);
    }
    select(sel: Sel | null) {
      this.s = { ...this.s, selected: sel };
      this.events.onState(this.state);
    }
    setPlan(plan: Plan) {
      this.plan = plan;
      this.events.onState(this.state);
    }
    moveRoom(id: string, dx: number) {
      const r = this.plan.rooms.find((x) => x.id === id);
      if (!r) throw new Error(`no room ${id}`);
      r.x += dx;
      this.events.onChange();
    }
  }
  return { engines, FakeEngine };
});
type FakeEngine = InstanceType<typeof FakeEngine>;

vi.mock('@/map/engine/engine', () => ({ MapEngine: FakeEngine }));

const KITCHEN = INV_IDS.place.kitchen;

// Read from disk: vitest hands CSS imports back empty, even with ?raw. (jsdom's URL isn't one
// node:fs takes, so the path is joined.)
const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '../../map/map.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
/** The declarations of the first rule whose selector is exactly `sel`, after `from`. */
function rule(sel: string, from = 0): string {
  const at = css.indexOf(`${sel} {`, from);
  if (at < 0) throw new Error(`no rule ${sel}`);
  return css.slice(at, css.indexOf('}', at));
}

beforeEach(() => {
  engines.length = 0;
});

async function arrangingWithCard() {
  const app = await renderApp(`/loc/${IDS.home}?view=map`, { state: ownerScenario() });
  await waitFor(() => expect(engines.length).toBeGreaterThan(0));
  const e = engines.at(-1) as FakeEngine;
  await app.user.click(await screen.findByRole('button', { name: 'Arrange' }));
  await waitFor(() => expect(e.s.arranging).toBe(true));
  act(() => e.select({ type: 'room', id: KITCHEN }));
  const card = (await screen.findByRole('heading', { name: 'Kitchen' })).closest('.kmap-panel');
  if (!card) throw new Error('a card');
  return { ...app, e, card: card as HTMLElement };
}

describe('Arrange with a card open (#330)', () => {
  it('puts Done and Cancel in the card’s column, before the card', async () => {
    const { card } = await arrangingWithCard();
    const stack = card.parentElement as HTMLElement;
    expect(stack.className).toBe('kmap-stack');
    // The card is the column's last box, so on a phone it sits below the bar and the tools.
    expect(stack.lastElementChild).toBe(card);
    for (const name of ['Done', 'Cancel']) {
      const button = screen.getByRole('button', { name });
      expect(stack.contains(button)).toBe(true);
      expect(card.contains(button)).toBe(false);
      expect(button.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('stacks them in one column where the card is a sheet, the card at the bottom', () => {
    const narrow = css.indexOf('@media (max-width: 899px)');
    expect(rule('.kmap-stack')).toMatch(/display: contents/);
    const stack = rule('.kmap-stack', narrow);
    expect(stack).toMatch(/position: absolute/);
    expect(stack).toMatch(/display: flex/);
    expect(stack).toMatch(/flex-direction: column/);
    const panel = rule('.kmap-panel', narrow);
    // In the column's flow, pushed to the bottom, and shrunk rather than laid over the tools.
    expect(panel).toMatch(/position: relative/);
    expect(panel).toMatch(/margin-block-start: auto/);
    expect(panel).toMatch(/min-height: 0/);
    expect(panel).not.toMatch(/(^|\s)(top|bottom|inset[\w-]*):/);
    expect(rule('.kmap-stage[data-card="true"] .kmap-hint', narrow)).toMatch(/display: none/);
  });

  it('wraps the tools short of the card on a wide map', () => {
    const wide = css.indexOf('@media (min-width: 900px)');
    const panel = rule('.kmap-panel', wide);
    const end = Number(/inset-inline-end: (\d+)px/.exec(panel)?.[1]);
    const width = Number(/width: (\d+)px/.exec(panel)?.[1]);
    const tools = rule('.kmap-stage[data-card="true"] .kmap-tools', wide);
    const room = Number(/max-width: calc\(100% - (\d+)px\)/.exec(tools)?.[1]);
    // The tools start 12px in; they stop at least 12px before the card.
    expect(room).toBeGreaterThanOrEqual(12 + width + end + 12);
  });

  it('cancels without closing the card first', async () => {
    const { user, e } = await arrangingWithCard();
    act(() => e.moveRoom(KITCHEN, 3));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Throw away' }));
    await waitFor(() => expect(e.s.arranging).toBe(false));
  });

  it('saves on Done with the card open', async () => {
    const { user, e } = await arrangingWithCard();
    act(() => e.moveRoom(KITCHEN, 3));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByText('Map arranged')).toBeInTheDocument();
    await waitFor(() => expect(e.s.arranging).toBe(false));
  });
});
