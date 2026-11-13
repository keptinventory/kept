/**
 * The place tree's header (#462), in a real browser: jsdom has no layout. The `homebox` instance
 * (e2e/instances.ts, behind HTTPS on the `households` seed), in a location of each attempt's own
 * with a name of several words and a place that folds, so the header shows "Fold all".
 *
 * At 1280, the panel beside the Office's page:
 * - at its narrowest (208 px) in German, where "Alle einklappen" is about twice "Fold all", the
 *   location's name keeps whole words (it used to break into "Ho / me / St / re / et") and the
 *   button goes under it, at its start;
 * - as wide as it goes in English, the name and the button share one line, the button at its end;
 * - in Arabic, the same mirrored.
 * At 375, the "All places" outline, whose Fold all has a row of its own: it stays on one line and
 * inside the outline.
 *
 *   KEPT_E2E_INSTANCES=homebox pnpm --filter @kept/web exec playwright test place-tree-header.spec.ts \
 *     --workers 1
 */
import { type Locator, type Page, test } from '@playwright/test';
import { HOMEBOX_INSTANCE } from './instances';
import { attemptName, axe, expect, IBRAHIM, people } from './tls-people';

const { BASE, person, api, dropLocation } = people(HOMEBOX_INSTANCE);

test.use({ baseURL: BASE, ignoreHTTPSErrors: true });

type Node = { id: string; parentId: string | null; name: string };

/** A location with a Bedroom that folds (a shelf in it) and an Office; the Office's id. */
async function makeLocation(page: Page, name: string) {
  const call = api(page);
  const { id } = await call.post<{ id: string }>('/api/v1/locations', {
    name,
    kind: 'home',
    preset: 'essentials',
    timezone: 'Africa/Cairo',
    currency: 'EGP',
    rooms: ['Bedroom', 'Office'],
  });
  const { places } = await call.get<{ places: Node[] }>(`/api/v1/locations/${id}/places`);
  const room = (n: string) => places.find((p) => p.name === n && p.parentId === null) as Node;
  await call.post(`/api/v1/locations/${id}/places`, {
    name: 'Shelf A',
    kindKey: 'zone',
    parentId: room('Bedroom').id,
  });
  return { id, office: room('Office').id };
}

/** Where the header's name and button landed, and whether any word of the name broke. */
const measure = (nav: Locator) =>
  nav.evaluate((el) => {
    const header = el.firstElementChild as HTMLElement;
    const name = header.querySelector('bdi') as HTMLElement;
    const button = header.querySelector('button') as HTMLElement;
    const text = name.firstChild as Text;
    const content = text.data;
    // A word is whole when all of its characters sit on one line.
    const broken: string[] = [];
    let at = 0;
    for (const word of content.split(' ')) {
      const range = document.createRange();
      range.setStart(text, at);
      range.setEnd(text, at + word.length);
      const tops = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
      if (tops.size > 1) broken.push(word);
      at += word.length + 1;
    }
    const all = document.createRange();
    all.selectNodeContents(name);
    const box = (e: Element) => {
      const r = e.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    };
    const style = getComputedStyle(header);
    return {
      dir: style.direction,
      header: box(header),
      paddingStart: Number.parseFloat(style.paddingInlineStart),
      overflows: header.scrollWidth > header.clientWidth,
      nameText: content,
      name: box(name),
      lines: new Set([...all.getClientRects()].map((r) => Math.round(r.top))).size,
      broken,
      link: box(name.parentElement as HTMLElement),
      button: box(button),
      buttonText: button.textContent,
      buttonLines: (() => {
        const r = document.createRange();
        r.selectNodeContents(button);
        return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size;
      })(),
    };
  });

type Measured = Awaited<ReturnType<typeof measure>>;

/** Whole words, and nothing past the panel's edge. */
function expectReadable(m: Measured) {
  const at = JSON.stringify(m);
  expect(m.broken, at).toEqual([]);
  expect(m.buttonLines, at).toBe(1);
  expect(m.overflows, at).toBe(false);
  expect(m.button.left, at).toBeGreaterThanOrEqual(m.header.left - 0.5);
  expect(m.button.right, at).toBeLessThanOrEqual(m.header.right + 0.5);
}

/** The button is under the name's link, at the link's start. */
function expectBeneath(m: Measured) {
  const at = JSON.stringify(m);
  expect(m.button.top, at).toBeGreaterThanOrEqual(m.link.bottom - 1);
  const start = m.dir === 'rtl' ? 'right' : 'left';
  expect(Math.abs(m.button[start] - m.link[start]), at).toBeLessThanOrEqual(1);
}

/** The button is on the name's line, at the header's end. */
function expectBeside(m: Measured) {
  const at = JSON.stringify(m);
  expect(m.lines, at).toBe(1);
  expect(m.button.top, at).toBeLessThan(m.name.bottom);
  const end = m.dir === 'rtl' ? m.button.left - m.header.left : m.header.right - m.button.right;
  expect(Math.abs(end), at).toBeLessThanOrEqual(1);
}

async function openIn(page: Page, office: string, locale: 'ar' | 'de' | 'en', width: number) {
  await page.evaluate(
    ({ l, w }) => {
      localStorage.setItem('kept.locale', l);
      localStorage.setItem('kept.placeTreeWidth', w);
    },
    { l: locale, w: String(width) },
  );
  await page.goto(`/p/${office}`);
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  await expect(page.getByRole('heading', { name: 'Office', level: 1 })).toBeVisible();
}

test("the location's name in the place tree's header keeps whole words beside Fold all", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const name = attemptName('Home Street 7');
  const docked = test.info().project.name === 'desktop';
  const { context, page } = await person(browser, IBRAHIM);
  let loc: string | undefined;
  try {
    await page.goto('/');
    const made = await makeLocation(page, name);
    loc = made.id;

    if (!docked) {
      // The outline: Fold all has its own row, in German too.
      await openIn(page, made.office, 'de', 208);
      const outline = page.locator('details').filter({ hasText: 'Alle Orte' });
      await outline.locator('summary').click();
      const fold = outline.getByRole('button', { name: 'Alle einklappen' });
      await expect(fold).toBeVisible();
      const m = await fold.evaluate((b) => {
        const r = document.createRange();
        r.selectNodeContents(b);
        const o = (b.closest('details') as HTMLElement).getBoundingClientRect();
        const x = b.getBoundingClientRect();
        return {
          lines: new Set([...r.getClientRects()].map((c) => Math.round(c.top))).size,
          inside: x.left >= o.left - 0.5 && x.right <= o.right + 0.5,
        };
      });
      expect(m).toEqual({ lines: 1, inside: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        375,
      );
      await axe(page, 'the place tree outline in German');
      return;
    }

    const nav = (words: string) =>
      page.getByRole('navigation', { name: words.replace('{name}', name) });

    // German at the narrowest, as it was reported.
    await openIn(page, made.office, 'de', 208);
    let tree = nav('Orte in {name}');
    await expect(tree.getByRole('button', { name: 'Alle einklappen' })).toBeVisible();
    expect((await tree.boundingBox())?.width).toBeCloseTo(208, 0);
    let m = await measure(tree);
    expect(m.nameText).toBe(name);
    expectReadable(m);
    expectBeneath(m);
    await axe(page, 'the place tree header in German');

    // Open all, the other label, the same way.
    await tree.getByRole('button', { name: 'Alle einklappen' }).click();
    await expect(tree.getByRole('button', { name: 'Alle ausklappen' })).toBeVisible();
    m = await measure(tree);
    expectReadable(m);
    expectBeneath(m);
    await tree.getByRole('button', { name: 'Alle ausklappen' }).click();
    await expect(tree.getByRole('button', { name: 'Alle einklappen' })).toBeVisible();

    // English, as wide as the tree goes: room for both on one line.
    await openIn(page, made.office, 'en', 99999);
    tree = nav('Places in {name}');
    await expect(tree.getByRole('button', { name: 'Fold all' })).toBeVisible();
    m = await measure(tree);
    expectReadable(m);
    expectBeside(m);

    // Arabic at the narrowest: mirrored.
    await openIn(page, made.office, 'ar', 208);
    tree = nav('الأماكن في {name}');
    await expect(tree.getByRole('button', { name: 'طيّ الكل' })).toBeVisible();
    m = await measure(tree);
    expect(m.dir).toBe('rtl');
    expectReadable(m);
    expectBeneath(m);
    await axe(page, 'the place tree header in Arabic');
  } finally {
    await page
      .evaluate(() => {
        localStorage.removeItem('kept.locale');
        localStorage.removeItem('kept.placeTreeWidth');
      })
      .catch(() => {});
    await dropLocation(page, { id: loc, name });
    await context.close();
  }
});
