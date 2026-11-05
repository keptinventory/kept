// @vitest-environment jsdom
/**
 * The language menu's script (#450) on the menu's markup. Layout, phones and the no-JavaScript page
 * need a real browser and a real build; those aren't covered here.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const LANGUAGES = [
  ['en', 'English'],
  ['ar', 'العربية'],
  ['fr', 'Français'],
  ['de', 'Deutsch'],
  ['it', 'Italiano'],
];

function markup(current: string): string {
  return `<kd-lang-menu>
    <details class="kd-lang">
      <summary tabindex="0">Language</summary>
      <div class="kd-lang-panel">
        <template>
          <input class="kd-lang-filter" type="search" aria-label="Find a language" />
          <p class="kd-lang-none" role="status" data-text="No matches"></p>
        </template>
        <div class="kd-lang-results">
          <ul class="kd-lang-list">
            ${LANGUAGES.map(
              ([tag, name]) =>
                `<li><a href="#${tag}" hreflang="${tag}" ${
                  tag === current ? 'aria-current="true"' : ''
                }><span class="kd-lang-name">${name}</span></a></li>`,
            ).join('')}
          </ul>
        </div>
      </div>
    </details>
  </kd-lang-menu>`;
}

const $ = <T extends Element>(selector: string) => document.querySelector(selector) as T;
const details = () => $<HTMLDetailsElement>('details');
const summary = () => $<HTMLElement>('summary');
const filter = () => $<HTMLInputElement>('.kd-lang-filter');
const status = () => $<HTMLElement>('.kd-lang-none');
const shown = () =>
  [...document.querySelectorAll('.kd-lang-list li:not([hidden]) a')].map((a) => a.textContent);
const active = () => document.activeElement;
const link = (name: string) =>
  [...document.querySelectorAll<HTMLAnchorElement>('.kd-lang-list a')].find(
    (a) => a.textContent === name,
  );

function press(key: string, on: Element | null = active()) {
  on?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}
function type(text: string) {
  filter().value = text;
  filter().dispatchEvent(new Event('input', { bubbles: true }));
}
const toggled = () =>
  new Promise<void>((resolve) =>
    details().addEventListener('toggle', () => resolve(), { once: true }),
  );

async function open() {
  const done = toggled();
  details().open = true;
  await done;
}

function setup({ lang = 'en', current = 'en', fine = true } = {}) {
  document.documentElement.lang = lang;
  vi.stubGlobal('matchMedia', () => ({ matches: fine }));
  document.body.innerHTML = markup(current);
}

beforeAll(async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  await import('./menu');
});
beforeEach(() => setup());
afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('the language menu', () => {
  it('adds the box above the links, and the status beside them', () => {
    expect(filter()).toHaveProperty('type', 'search');
    expect(filter().getAttribute('aria-label')).toBe('Find a language');
    expect($('.kd-lang-panel').firstElementChild).toBe(filter());
    expect(status().getAttribute('role')).toBe('status');
    expect(status().textContent).toBe('');
    expect(shown()).toHaveLength(LANGUAGES.length);
  });

  it.each([
    ['Deutsch', ['Deutsch']],
    ['german', ['Deutsch']],
    ['francais', ['Français']],
    ['العربية', ['العربية']],
    ['arabic', ['العربية']],
    ['italain', ['Italiano']],
    ['', LANGUAGES.map(([, name]) => name)],
  ])('finds "%s"', (query, names) => {
    type(query);
    expect(shown()).toEqual(names);
    expect(status().textContent).toBe('');
  });

  it("finds a language by its name in the page's language", () => {
    setup({ lang: 'de', current: 'de' });
    type('Französisch');
    expect(shown()).toEqual(['Français']);
    setup({ lang: 'ar', current: 'ar' });
    type('الألمانية');
    expect(shown()).toEqual(['Deutsch']);
  });

  it('says so when nothing matches, and takes it back', () => {
    type('zzz');
    expect(shown()).toEqual([]);
    expect(status().textContent).toBe('No matches');
    type('ger');
    expect(status().textContent).toBe('');
  });

  it('goes to the box when opened with a mouse or the keyboard', async () => {
    await open();
    expect(active()).toBe(filter());
  });

  it('stays on the button when opened by a tap, so no keyboard comes up', async () => {
    setup({ fine: false });
    await open();
    expect(active()).toBe(document.body);
  });

  it('keeps the panel its opening height while languages drop out', async () => {
    await open();
    expect($<HTMLElement>('.kd-lang-list').style.minBlockSize).toMatch(/px$/);
  });

  it('moves from the box to the links with the arrows, through the found ones only', async () => {
    await open();
    type('i');
    press('ArrowDown');
    expect(active()).toBe(link('Italiano'));
    press('ArrowDown');
    expect(active()).toBe(filter());
    press('ArrowUp');
    expect(active()).toBe(link('Italiano'));
    press('ArrowUp');
    expect(active()).toBe(filter());
  });

  it('walks the whole list, Home and End included, wrapping through the box', async () => {
    await open();
    type('');
    press('ArrowDown');
    expect(active()).toBe(link('English'));
    press('ArrowDown');
    expect(active()).toBe(link('العربية'));
    press('End');
    expect(active()).toBe(link('Italiano'));
    press('Home');
    expect(active()).toBe(link('English'));
    press('End');
    press('ArrowDown');
    expect(active()).toBe(filter());
  });

  it('leaves Home and End to the box while typing', async () => {
    await open();
    press('End');
    expect(active()).toBe(filter());
  });

  it('opens on the current language with ArrowDown, on the last with ArrowUp', () => {
    setup({ current: 'fr' });
    summary().focus();
    press('ArrowDown');
    expect(details().open).toBe(true);
    expect(active()).toBe(link('Français'));
    details().open = false;
    summary().focus();
    press('ArrowUp');
    expect(active()).toBe(link('Italiano'));
  });

  it('closes with Escape from the box, returns to the button, and clears the filter', async () => {
    await open();
    type('ger');
    const closed = toggled();
    press('Escape');
    expect(details().open).toBe(false);
    expect(active()).toBe(summary());
    await closed;
    expect(filter().value).toBe('');
    expect(shown()).toHaveLength(LANGUAGES.length);
  });

  it('closes with Escape from a link', async () => {
    await open();
    press('ArrowDown');
    press('Escape');
    expect(details().open).toBe(false);
    expect(active()).toBe(summary());
  });

  it('follows the first found language with Enter, and does nothing when none is', async () => {
    await open();
    type('ger');
    const click = vi.fn((e: Event) => e.preventDefault());
    document.addEventListener('click', click, { once: false });
    press('Enter');
    expect((click.mock.calls[0]?.[0] as Event | undefined)?.target).toBe(link('Deutsch'));
    click.mockClear();
    type('zzz');
    press('Enter');
    expect(click).not.toHaveBeenCalled();
    document.removeEventListener('click', click);
  });
});
