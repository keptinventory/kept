// @vitest-environment jsdom
/**
 * Try the map shows what the app shows (#301): What's in under the map, names first, the card's
 * type, tags, photo, label QR and links, Cancel's question and Done's Undo, and the shape picker's
 * footer. The 3D engine is a stand-in here (jsdom draws no WebGL): what the demo asks of it, and
 * what it draws around it, is what is checked. The sample itself is sample.test.ts's.
 */
import { builtinTypeName, printedCode } from '@kept/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SHAPE_LIBRARY_URL, SHAPE_REQUEST_URL } from '../../../../web/src/map/shape-links';

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
type Plan = {
  levels: { key: string }[];
  rooms: { id: string; x: number; z: number }[];
  items: { id: string }[];
};
type Events = { onState: (s: State) => void; onChange: () => void };

const { engines, FakeEngine } = vi.hoisted(() => {
  const engines: FakeEngine[] = [];
  class FakeEngine {
    s: State;
    plan: Plan;
    calls: string[] = [];
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
    select(sel: Sel | null, emit = true) {
      this.s = { ...this.s, selected: sel };
      if (emit) this.events.onState(this.state);
    }
    setLevel(key: string) {
      this.s = { ...this.s, levelKey: key, allFloors: false, focused: null };
      this.events.onState(this.state);
    }
    setPlan(plan: Plan) {
      this.calls.push('setPlan');
      this.plan = plan;
      this.events.onState(this.state);
    }
    /** A room dragged a few metres, as the real engine reports a change. */
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

vi.mock('../../../../web/src/map/engine/engine', () => ({ MapEngine: FakeEngine }));
vi.mock('../../../../web/src/map/engine/models', () => ({
  modelStats: () => ({ count: 0, bytes: 0, loading: 0, failed: 0 }),
}));

const INSTALL = '/install/compose/';
let root: HTMLElement;
let unmount: () => void;

beforeEach(async () => {
  engines.length = 0;
  // jsdom has no modal dialogs, scrolling or CSS.escape: enough of each for the demo's.
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & { _patched?: boolean };
  if (!proto._patched) {
    proto.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    proto.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
    proto._patched = true;
  }
  Element.prototype.scrollIntoView ??= () => {};
  if (!globalThis.CSS?.escape)
    Object.assign(globalThis, {
      CSS: { escape: (s: string) => s.replace(/["\\]/g, '\\$&') },
    });
  document.body.innerHTML = `<div class="kd-try"><button type="button" data-act="reset" hidden>Reset</button><div data-try-map></div></div>`;
  root = document.querySelector('.kd-try') as HTMLElement;
  const { mount } = await import('./demo');
  unmount = mount(root, { lang: 'en', installHref: INSTALL });
});

afterEach(() => {
  unmount();
  vi.useRealTimers();
});

const engine = () => engines.at(-1) as FakeEngine;
const list = () => root.querySelector('.kd-list') as HTMLElement;
const card = () => root.querySelector('.kmap-panel') as HTMLElement | null;
const click = (el: Element | null | undefined) => {
  if (!el) throw new Error('nothing to click');
  (el as HTMLElement).click();
};
const byText = (scope: ParentNode, sel: string, text: string | RegExp) =>
  [...scope.querySelectorAll<HTMLElement>(sel)].find((el) =>
    typeof text === 'string' ? el.textContent?.trim() === text : text.test(el.textContent ?? ''),
  );
const type = (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
const cards = () =>
  [...list().querySelectorAll('.kmap-rcard header')].map(
    (h) => h.querySelector('button, h3')?.textContent ?? '',
  );

describe("What's in, under the map", () => {
  it('sums up the home: things, rooms, floors and each flag', () => {
    expect(list().querySelector('h2')?.textContent).toBe('What’s in Sample home');
    const sum = list().querySelector('.kmap-sum')?.textContent ?? '';
    expect(sum).toMatch(/\d+ things·13 rooms·3 floors/);
    expect(sum).toMatch(/\d+ low/);
    expect(sum).toMatch(/\d+ lent/);
    expect(sum).toMatch(/\d+ due/);
    // A card per room, each with Show more past four rows.
    expect(cards()).toHaveLength(13);
    expect(byText(list(), '.kmap-more', /^Show \d+ more$/)).toBeTruthy();
  });

  it('finds a thing by name or short ID, filters a floor, and shows more and fewer', () => {
    // The list is drawn again as it is typed in: the field is found each time.
    const find = () => {
      const el = list().querySelector<HTMLInputElement>('input[type="search"]');
      if (!el) throw new Error('a search');
      return el;
    };
    expect(find().getAttribute('aria-label')).toBe('Find a thing');
    expect(find().placeholder).toBe('Find a thing or a short ID');
    type(find(), 'Bosch drill');
    expect(cards()).toEqual(['Garage']);
    // By the code on its label, written as it is printed.
    const tape = list().querySelector('.kd-id:not(.quiet)');
    const code = tape?.getAttribute('aria-label') ?? '';
    type(find(), printedCode(code));
    expect(list().textContent).toContain('Bosch drill');
    type(find(), '');

    click(byText(list(), '[data-act="list-floor"]', 'Roof'));
    expect(cards()).toEqual(['Roof terrace', 'Roof room']);
    click(byText(list(), '[data-act="list-floor"]', 'All floors'));
    expect(cards()).toHaveLength(13);

    const living = list().querySelector('.kmap-rcard') as HTMLElement;
    const rows = () => living.querySelectorAll(':scope > .kmap-orow, :scope > details').length;
    expect(rows()).toBe(4);
    click(byText(living, '.kmap-more', /^Show \d+ more$/));
    const all = list().querySelector('.kmap-rcard') as HTMLElement;
    expect(all.querySelectorAll(':scope > .kmap-orow, :scope > details').length).toBeGreaterThan(4);
    click(byText(all, '.kmap-more', 'Show fewer'));
    expect(
      (list().querySelector('.kmap-rcard') as HTMLElement).querySelectorAll(
        ':scope > .kmap-orow, :scope > details',
      ).length,
    ).toBe(4);
  });

  it('shows what needs attention, and picking a row shows it on the map with its card', () => {
    click(byText(list(), '[data-act="list-show"]', 'Needs attention'));
    expect(cards()).toEqual(['Low stock', 'Lent out', 'Due soon']);
    const lent = byText(list(), '[data-act="list-thing"]', /Bosch drill/);
    expect(lent?.textContent).toMatch(/Lent to Bruce/);
    click(lent);
    expect(engine().s.selected).toEqual({ type: 'item', id: expect.any(String) });
    expect(card()?.querySelector('h2')?.textContent).toBe('Bosch drill');

    // A thing inside a box opens on the box, with its own card.
    click(byText(list(), '[data-act="list-thing"]', /^Catan/));
    expect(card()?.querySelector('h2')?.textContent).toBe('Catan');
    expect(card()?.textContent).toContain('Games box');
  });
});

describe('names first', () => {
  it('lists the amber tape only on a printed label, and no code on the rest', () => {
    const tapes = [...list().querySelectorAll('.kd-id')];
    expect(tapes.length).toBeGreaterThan(0);
    for (const t of tapes) expect(t.classList.contains('quiet')).toBe(false);
    const sofa = byText(list(), '.kmap-orow', /^Sofa/);
    expect(sofa?.querySelector('.kd-id')).toBeNull();
    const shelf = byText(list(), '.kmap-orow', /^Shelf A/);
    expect(shelf?.querySelector('.kd-id')).not.toBeNull();
  });

  it('shows a card a quiet code without a printed label, and the tape with one', () => {
    click(byText(list(), '[data-act="list-thing"]', /^Sofa/));
    expect(card()?.querySelector('.kmap-meta .kd-id')?.className).toBe('kd-id quiet');
    click(byText(list(), '[data-act="list-thing"]', /^Shelf A/));
    expect(card()?.querySelector('.kmap-meta .kd-id')?.className).toBe('kd-id');
  });
});

describe('the card', () => {
  it('has the type, the tags, a photo and the label’s QR, and opens Kept by installing it', () => {
    click(byText(list(), '[data-act="list-show"]', 'Needs attention'));
    click(byText(list(), '[data-act="list-thing"]', /Bosch drill/));
    click(byText(card() as HTMLElement, '[data-act="detail"]', 'Details'));
    const c = card() as HTMLElement;
    const facts = [...c.querySelectorAll('.kmap-facts dt')].map((d) => [
      d.textContent,
      d.nextElementSibling?.textContent,
    ]);
    expect(facts).toContainEqual(['Type', builtinTypeName('power_tool', 'en')]);
    expect(facts).toContainEqual(['Tags', 'Tools']);
    const tag = c.querySelector<HTMLElement>('.kd-tag');
    expect(tag?.style.getPropertyValue('--tag')).toMatch(/^#[0-9A-F]{6}$/);
    expect(c.querySelector('.kmap-photo img')).not.toBeNull();
    const code = c.querySelector('.kmap-code')?.textContent ?? '';
    const qr = c.querySelector('.kmap-qr svg');
    expect(qr?.getAttribute('aria-label')).toBe(`QR label for ${code}`);
    expect(qr?.querySelector('path')?.getAttribute('d')).toMatch(/^M\d+ \d+h1v1h-1z/);
    expect(c.querySelector('.kd-url')?.textContent).toBe(`kept.example/l/${code.replace('‑', '')}`);
    const open = byText(c, 'a', 'Open the thing');
    expect(open?.getAttribute('href')).toBe(INSTALL);
  });

  it('gives a place its places, and a room its links into Kept', () => {
    click(byText(list(), '[data-act="list-thing"]', /^Shelf A/));
    click(byText(card() as HTMLElement, '[data-act="detail"]', 'Details'));
    expect(card()?.textContent).toContain('4 places in it');
    expect(card()?.querySelector('.kmap-facts')).toBeNull();

    click(byText(list(), '[data-act="list-room"]', 'Kitchen'));
    const links = [...(card() as HTMLElement).querySelectorAll('a')].map((a) => [
      a.textContent,
      a.getAttribute('href'),
    ]);
    expect(links).toEqual([
      ['Open the place', INSTALL],
      ['Photograph this room', INSTALL],
      ['Count this room', INSTALL],
    ]);
  });
});

describe('Arrange', () => {
  const button = (k: string) => root.querySelector<HTMLElement>(`[data-act="${k}"]`);
  const dialog = () => root.querySelector<HTMLDialogElement>('dialog.kd-confirm[open]');

  it('ends at once on Cancel when nothing changed', () => {
    click(button('arrange'));
    click(button('cancel'));
    expect(dialog()).toBeNull();
    expect(engine().s.arranging).toBe(false);
  });

  it('asks before Cancel throws changes away, and keeps arranging on Cancel', () => {
    click(button('arrange'));
    const first = engine().plan.rooms[0];
    if (!first) throw new Error('a room');
    const x = first.x;
    engine().moveRoom(first.id, 3);
    click(button('cancel'));
    const asked = dialog();
    expect(asked?.getAttribute('role')).toBe('alertdialog');
    expect(asked?.querySelector('h2')?.textContent).toBe('Throw away these changes?');
    expect(asked?.textContent).toContain('The map goes back to how it was.');
    click(byText(asked as HTMLElement, 'button', 'Cancel'));
    expect(dialog()).toBeNull();
    expect(engine().s.arranging).toBe(true);

    click(button('cancel'));
    click(byText(dialog() as HTMLElement, 'button', 'Throw away'));
    expect(engine().s.arranging).toBe(false);
    expect(engine().calls).toContain('setPlan');
    expect(engine().plan.rooms[0]?.x).toBe(x);
    expect(root.querySelector('.kd-toast')).toBeNull();
  });

  it('offers Undo on Done, which puts the map back as it was', () => {
    vi.useFakeTimers();
    click(button('arrange'));
    const first = engine().plan.rooms[0];
    if (!first) throw new Error('a room');
    const x = first.x;
    engine().moveRoom(first.id, 3);
    click(button('done'));
    expect(engine().s.arranging).toBe(false);
    const toast = root.querySelector('.kd-toast');
    expect(toast?.getAttribute('role')).toBe('status');
    expect(toast?.textContent).toContain('Map arranged');
    click(byText(toast as HTMLElement, 'button', 'Undo'));
    expect(engine().plan.rooms[0]?.x).toBe(x);
    expect(root.querySelector('.kd-toast')?.textContent).toContain('Undone');
    // It goes by itself, as the app's does.
    vi.advanceTimersByTime(10_000);
    expect(root.querySelector('.kd-toast')).toBeNull();
  });

  it('says nothing on Done when nothing changed', () => {
    click(button('arrange'));
    click(button('done'));
    expect(root.querySelector('.kd-toast')).toBeNull();
  });

  it('gives Put on… a search once more than eight things can carry it', () => {
    click(button('arrange'));
    // Nine more desks in the office, where the laptop stands on the desk.
    const plan = engine().plan as unknown as {
      items: (Record<string, unknown> & { id: string; name: string; roomId: string })[];
    };
    const desk = plan.items.find((i) => i.name === 'Desk');
    if (!desk) throw new Error('a desk');
    for (let n = 1; n <= 9; n++)
      plan.items.push({
        ...desk,
        id: `desk-${n}`,
        name: `Spare desk ${n}`,
        shortCode: null,
        z: 2 + n * 0.01,
      });
    engine().events.onChange();
    click(byText(list(), '[data-act="list-thing"]', /^MacBook Air/));
    click(root.querySelector('[data-act="puton"]'));
    const dlg = root.querySelector('dialog.kd-put[open]') as HTMLElement;
    const find = dlg.querySelector<HTMLInputElement>('input[type="search"]');
    expect(find?.getAttribute('aria-label')).toBe('Find a place to put it');
    expect(find?.placeholder).toBe('Find in Office');
    const shown = () =>
      [...dlg.querySelectorAll<HTMLElement>('[role="option"]')]
        .filter((o) => !o.hidden)
        .map((o) => o.querySelector('.kput-text span')?.textContent);
    expect(shown().length).toBeGreaterThan(8);
    type(find as HTMLInputElement, 'spare desk 7');
    expect(shown()).toEqual(['Spare desk 7']);
    type(find as HTMLInputElement, 'nothing like it');
    expect(shown()).toEqual([]);
    expect(byText(dlg, '.kmap-empty', 'Nothing matches.')?.hidden).toBe(false);
  });

  it('ends the shape picker with where to ask for a missing shape', () => {
    click(button('arrange'));
    click(byText(list(), '[data-act="list-thing"]', /^Sofa/));
    click(root.querySelector('[data-act="shapes"]'));
    const more = root.querySelector('dialog.kd-shapes[open] .kshape-more');
    expect(more?.textContent).toBe('Missing a shape? Request it, or browse the shape library.');
    expect([...(more?.querySelectorAll('a') ?? [])].map((a) => a.getAttribute('href'))).toEqual([
      SHAPE_REQUEST_URL,
      SHAPE_LIBRARY_URL,
    ]);
  });
});
