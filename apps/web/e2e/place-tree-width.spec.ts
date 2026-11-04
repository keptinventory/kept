/**
 * The place tree's width and fold (#427), end to end against the real server (the `homebox`
 * instance, e2e/instances.ts, behind HTTPS on the `households` seed), in a location of each
 * attempt's own: dragging its edge with the pointer, the same with the keys, folding it with the
 * main navigation's control, both remembered through a reload with no jump, the edge following
 * the tree in Arabic, the page's own state untouched (#336), and no edge below 1280 px, where the
 * tree is the "All places" outline.
 *
 *   KEPT_E2E_INSTANCES=homebox pnpm --filter @kept/web exec playwright test place-tree-width.spec.ts \
 *     --repeat-each 2 --workers 1
 */
import { type Browser, type Page, test } from '@playwright/test';
import { HOMEBOX_INSTANCE } from './instances';
import { attemptName, axe, expect, IBRAHIM, people } from './tls-people';

const { BASE, person, api, dropLocation } = people(HOMEBOX_INSTANCE);

test.use({ baseURL: BASE, ignoreHTTPSErrors: true });

type Node = { id: string; parentId: string | null; name: string };

const DEFAULT = 240;
const MIN = 208;

/** A location of its own, with a Bedroom and an Office holding one thing, and the Office's id. */
async function makeLocation(page: Page, name: string) {
  const call = api(page);
  const loc = await call.post<{ id: string }>('/api/v1/locations', {
    name,
    kind: 'home',
    preset: 'essentials',
    timezone: 'Africa/Cairo',
    currency: 'EGP',
    rooms: ['Bedroom', 'Office'],
  });
  const { places } = await call.get<{ places: Node[] }>(`/api/v1/locations/${loc.id}/places`);
  const office = places.find((p) => p.name === 'Office' && p.parentId === null) as Node;
  expect(office, JSON.stringify(places)).toBeTruthy();
  await call.post('/api/v1/things', { locationId: loc.id, placeId: office.id, name: 'Stapler' });
  return { loc: loc.id, office: office.id };
}

async function withOffice(
  browser: Browser,
  label: string,
  run: (page: Page, ids: { loc: string; office: string }, name: string) => Promise<void>,
  init?: () => void,
) {
  const name = attemptName(label);
  const { context, page } = await person(browser, IBRAHIM, init);
  let loc: string | undefined;
  try {
    const ids = await makeLocation(page, name);
    loc = ids.loc;
    await run(page, ids, name);
  } finally {
    await dropLocation(page, { id: loc, name });
    await context.close();
  }
}

const edge = (page: Page) => page.getByRole('separator');
const widthNow = async (page: Page) => Number(await edge(page).getAttribute('aria-valuenow'));
const treeOf = (page: Page, name: string) =>
  page.getByRole('navigation', { name: new RegExp(name) });
const box = async (page: Page, name: string) => {
  const b = await treeOf(page, name).boundingBox();
  expect(b).not.toBeNull();
  return b as NonNullable<typeof b>;
};
/** The column's width once its transition has ended: the first frame after a toggle is mid-way. */
const settled = (page: Page) =>
  page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));

/** Grabs the edge's middle and moves it by `dx`, then lets go. */
async function drag(page: Page, dx: number) {
  await edge(page).scrollIntoViewIfNeeded();
  const b = await edge(page).boundingBox();
  expect(b).not.toBeNull();
  const { x, y, width } = b as NonNullable<typeof b>;
  // On screen, whatever the page's height: the edge runs its whole length.
  const at = { x: x + width / 2, y: Math.max(y, 0) + 200 };
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  // In steps, as a hand does; one jump alone wouldn't show the live width.
  await page.mouse.move(at.x + dx / 2, at.y, { steps: 4 });
  await page.mouse.move(at.x + dx, at.y, { steps: 4 });
  await page.mouse.up();
}

const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);

test('the edge drags the width, stops at its bounds, and is remembered', async ({
  browser,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'the panel shows from 1280 px');
  test.setTimeout(180_000);
  await withOffice(browser, 'Oak Lane', async (page, { office }, name) => {
    await page.goto(`/p/${office}`);
    await expect(page.getByRole('heading', { name: 'Office', level: 1 })).toBeVisible();
    await expect(treeOf(page, name)).toBeVisible();
    expect(await widthNow(page)).toBe(DEFAULT);
    expect((await box(page, name)).width).toBeCloseTo(DEFAULT, 0);
    await axe(page, 'the place tree with its edge');

    await drag(page, 60);
    await expect.poll(() => widthNow(page)).toBe(DEFAULT + 60);
    await settled(page);
    expect((await box(page, name)).width).toBeCloseTo(DEFAULT + 60, 0);
    expect(await stored(page, 'kept.placeTreeWidth')).toBe(String(DEFAULT + 60));

    // Far to the left it stops at the minimum, far to the right it leaves the page its room: at
    // 1280 px beside the full sidebar the area is 992 px, and the tree takes 40% at most.
    await drag(page, -900);
    await expect.poll(() => widthNow(page)).toBe(MIN);
    await drag(page, 900);
    await settled(page);
    const area = await page.locator('[data-slot="page-body"]').evaluate((el) => {
      const s = getComputedStyle(el);
      return el.clientWidth - Number.parseFloat(s.paddingInlineStart) * 2;
    });
    const widest = await widthNow(page);
    expect(widest).toBeLessThanOrEqual(Math.ceil(area * 0.4));
    expect((await box(page, name)).width).toBeCloseTo(widest, 0);

    // A stored width past what fits is held to the limit when read, and a bad one is the default.
    await page.evaluate(() => localStorage.setItem('kept.placeTreeWidth', '99999'));
    await page.reload();
    await expect(treeOf(page, name)).toBeVisible();
    expect(await widthNow(page)).toBe(widest);
    await page.evaluate(() => localStorage.setItem('kept.placeTreeWidth', 'wide'));
    await page.reload();
    await expect(treeOf(page, name)).toBeVisible();
    expect(await widthNow(page)).toBe(DEFAULT);
  });
});

test('the keys resize it, and a reload opens at the remembered width with no jump', async ({
  browser,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'the panel shows from 1280 px');
  test.setTimeout(180_000);
  await withOffice(browser, 'Elm Row', async (page, { office }, name) => {
    await page.goto(`/p/${office}`);
    await expect(treeOf(page, name)).toBeVisible();
    // Focus lands on it without moving the page, tall as it is.
    await edge(page).focus();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => widthNow(page)).toBe(DEFAULT + 32);
    await page.keyboard.press('Shift+ArrowLeft');
    await expect.poll(() => widthNow(page)).toBe(DEFAULT + 32 - 48);
    await page.keyboard.press('Home');
    await expect.poll(() => widthNow(page)).toBe(MIN);
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
    const width = MIN + 6 * 16;
    await expect.poll(() => widthNow(page)).toBe(width);
    await settled(page);

    // Before the app's script runs, the root already has the width; the column never animates in.
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        (window as unknown as { __first: string }).__first =
          document.documentElement.style.getPropertyValue('--place-tree-width');
      });
    });
    await page.reload();
    await expect(treeOf(page, name)).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __first: string }).__first)).toBe(
      `${width}px`,
    );
    const moving = await page.evaluate(
      () =>
        document.getAnimations().filter((a) => {
          const prop = (a as CSSTransition).transitionProperty;
          return prop === 'grid-template-columns';
        }).length,
    );
    expect(moving).toBe(0);
    expect((await box(page, name)).width).toBeCloseTo(width, 0);
  });
});

test('it folds with the main navigation’s control, remembered, and the page keeps its state', async ({
  browser,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'the panel shows from 1280 px');
  test.setTimeout(180_000);
  await withOffice(browser, 'Ash Court', async (page, { office }, name) => {
    await page.goto(`/p/${office}`);
    const search = page.getByRole('searchbox', { name: 'Search Office' });
    await expect(search).toBeVisible();
    await search.fill('Stap');
    await expect(search).toHaveValue('Stap');
    // The search reaches the address after its debounce; settle first, so the mark below tests
    // the column and not the list answering the search.
    await expect(page).toHaveURL(/q=Stap/);
    await page.waitForLoadState('networkidle');
    // A mark on the DOM node itself: a remount would make a new one, without it.
    await search.evaluate((el) => {
      (el as unknown as { __kept: boolean }).__kept = true;
    });
    const kept = () =>
      search.evaluate((el) => (el as unknown as { __kept?: boolean }).__kept === true);
    const pageWidth = async () => (await search.boundingBox())?.x ?? 0;
    const startX = await pageWidth();

    await drag(page, 40);
    await expect.poll(() => widthNow(page)).toBe(DEFAULT + 40);
    expect(await kept()).toBe(true);

    const collapse = page.getByRole('button', { name: 'Collapse places' });
    await collapse.focus();
    await page.keyboard.press('Enter');
    const expand = page.getByRole('button', { name: 'Expand places' });
    await expect(expand).toBeFocused();
    await expect(expand).toHaveAttribute('aria-expanded', 'false');
    await settled(page);
    await expect(treeOf(page, name)).toBeHidden();
    await expect(edge(page)).toHaveCount(0);
    // The room came back to the page.
    expect(await pageWidth()).toBeLessThan(startX);
    expect(await kept()).toBe(true);
    await expect(search).toHaveValue('Stap');
    await axe(page, 'the place tree folded');

    // Reload: still folded, with no tree painted first; the width comes back with it.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Office', level: 1 })).toBeVisible();
    await expect(expand).toBeVisible();
    await expect(treeOf(page, name)).toBeHidden();
    await expand.click();
    await expect(treeOf(page, name)).toBeVisible();
    await settled(page);
    expect((await box(page, name)).width).toBeCloseTo(DEFAULT + 40, 0);
    expect(await stored(page, 'kept.placeTree')).toBeNull();
  });
});

test('in Arabic the edge is on the tree’s left, and dragging follows it', async ({
  browser,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'the panel shows from 1280 px');
  test.setTimeout(180_000);
  await withOffice(
    browser,
    'Pine Way',
    async (page, { office }, name) => {
      await page.goto(`/p/${office}`);
      await expect(treeOf(page, name)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
      const tree = await box(page, name);
      const line = await edge(page).boundingBox();
      expect(line).not.toBeNull();
      // Left of the tree, in the gap between it and the page.
      expect((line as NonNullable<typeof line>).x).toBeLessThan(tree.x);

      await drag(page, -60); // to the left: wider
      await expect.poll(() => widthNow(page)).toBe(DEFAULT + 60);
      await settled(page);
      expect((await box(page, name)).width).toBeCloseTo(DEFAULT + 60, 0);
      await drag(page, 30); // to the right: narrower
      await expect.poll(() => widthNow(page)).toBe(DEFAULT + 30);

      await edge(page).focus();
      await page.keyboard.press('ArrowLeft');
      await expect.poll(() => widthNow(page)).toBe(DEFAULT + 46);
      await axe(page, 'the place tree in Arabic');
    },
    () => localStorage.setItem('kept.locale', 'ar'),
  );
});

test('the column animates only where motion is welcome', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'the panel shows from 1280 px');
  test.setTimeout(180_000);
  await withOffice(browser, 'Fir Green', async (page, { office }, name) => {
    await page.goto(`/p/${office}`);
    await expect(treeOf(page, name)).toBeVisible();
    const grid = page.locator('[data-slot="page-body"] > div').first();
    const transition = () => grid.evaluate((el) => getComputedStyle(el).transitionProperty);
    expect(await transition()).toContain('grid-template-columns');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await transition()).toBe('none');
  });
});

test('below 1280 px there is no edge: the outline stays as it was', async ({ browser }) => {
  test.setTimeout(180_000);
  await withOffice(browser, 'Yew End', async (page, { office }) => {
    // The phone project is 375 px; a laptop-narrow window is the other side of the same line.
    if (test.info().project.name === 'desktop')
      await page.setViewportSize({ width: 1100, height: 800 });
    await page.goto(`/p/${office}`);
    await expect(page.getByRole('heading', { name: 'Office', level: 1 })).toBeVisible();
    await expect(page.locator('details').filter({ hasText: 'All places' })).toBeVisible();
    await expect(edge(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Collapse places' })).toHaveCount(0);
  });
});
