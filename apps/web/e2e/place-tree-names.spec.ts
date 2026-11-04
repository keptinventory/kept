/**
 * A box's name in the place tree (#426), in a real browser: jsdom has no layout. The `homebox`
 * instance (e2e/instances.ts, behind HTTPS on the `households` seed). Each attempt makes a location
 * of its own through the API and deletes it at the end (#336):
 *
 * Bedroom › Shelf A › Shelf B › Shelf C › Shelf D › Shelf E, with boxes at tree depths 1, 3, 4 and 6
 * and a plain place at depth 3, seen from the Office's page: the 15rem panel at 1280, the "All
 * places" outline at 375.
 *
 * - a short name stays on one line (it used to break into Cr / at / e0 / 42), in German too, where
 *   the count is longest, and in Arabic;
 * - the count sits at the row's end when both fit, and under the name, at its start, when not;
 * - a single word too long for the row breaks, and never overflows or gets an ellipsis.
 *
 *   KEPT_E2E_INSTANCES=homebox pnpm --filter @kept/web exec playwright test place-tree-names.spec.ts \
 *     --workers 1
 */
import { type Locator, type Page, test } from '@playwright/test';
import { HOMEBOX_INSTANCE } from './instances';
import { attemptName, axe, expect, IBRAHIM, people } from './tls-people';

const { BASE, person, api, dropLocation } = people(HOMEBOX_INSTANCE);

test.use({ baseURL: BASE, ignoreHTTPSErrors: true });

const LONG_WORD = 'Donaudampfschifffahrtsgesellschaftskapitaensmuetze';

type Node = { id: string; parentId: string | null; name: string };

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
  const place = async (placeName: string, parentId: string) =>
    (
      await call.post<{ id: string }>(`/api/v1/locations/${id}/places`, {
        name: placeName,
        kindKey: 'zone',
        parentId,
      })
    ).id;
  const boxes = async (parentId: string, names: string[]) => {
    const made: string[] = [];
    for (const n of names) made.push(await place(n, parentId));
    await call.post(`/api/v1/places/${parentId}/convert-children-to-containers`, {
      placeIds: made,
    });
  };

  const bedroom = room('Bedroom').id;
  const a = await place('Shelf A', bedroom);
  const b = await place('Shelf B', a);
  const c = await place('Shelf C', b);
  const d = await place('Shelf D', c);
  const e = await place('Shelf E', d);
  await place('Regal007', b);
  await boxes(bedroom, ['Crate001']);
  await boxes(b, ['Crate042', LONG_WORD]);
  await boxes(c, ['Crate044']);
  await boxes(e, ['Crate046']);
  return { id, office: room('Office').id };
}

/** The Office's page in `locale`, and its tree: the panel at 1280, the opened outline at 375. */
async function treeIn(
  page: Page,
  office: string,
  locale: 'en' | 'de' | 'ar',
  words: string,
  locationName: string,
): Promise<Locator> {
  await page.evaluate((l) => localStorage.setItem('kept.locale', l), locale);
  await page.goto(`/p/${office}`);
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  await expect(page.getByRole('heading', { name: 'Office', level: 1 })).toBeVisible();
  if (test.info().project.name === 'desktop')
    return page.getByRole('navigation', { name: words.replace('{name}', locationName) });
  const outline = page.locator('details').filter({ hasText: words });
  await outline.locator('summary').click();
  return outline;
}

/** Where a row's name and count landed: how many lines the name took, and each one's box. */
const measure = (row: Locator) =>
  row.evaluate((a) => {
    const name = a.querySelector('bdi') as HTMLElement;
    const count = name.nextElementSibling;
    const range = document.createRange();
    range.selectNodeContents(name);
    const box = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    };
    const style = getComputedStyle(a);
    return {
      lines: new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size,
      dir: style.direction,
      row: box(a),
      rowOverflows: a.scrollWidth > a.clientWidth,
      paddingEnd: Number.parseFloat(style.paddingInlineEnd),
      name: box(name),
      nameText: name.textContent,
      ellipsis: getComputedStyle(name).textOverflow === 'ellipsis',
      count: count ? box(count) : null,
    };
  });

type Measured = Awaited<ReturnType<typeof measure>>;

/** The count is under the name, at its start. */
function expectBeneath(m: Measured) {
  const count = m.count as NonNullable<Measured['count']>;
  expect(count.top, JSON.stringify(m)).toBeGreaterThanOrEqual(m.name.bottom - 1);
  const start = m.dir === 'rtl' ? 'right' : 'left';
  expect(Math.abs(count[start] - m.name[start]), JSON.stringify(m)).toBeLessThanOrEqual(1);
}

/** The count is on the name's line, at the row's end. */
function expectBeside(m: Measured) {
  const count = m.count as NonNullable<Measured['count']>;
  expect(count.top, JSON.stringify(m)).toBeLessThan(m.name.bottom);
  const end =
    m.dir === 'rtl'
      ? count.left - (m.row.left + m.paddingEnd)
      : m.row.right - m.paddingEnd - count.right;
  expect(Math.abs(end), JSON.stringify(m)).toBeLessThanOrEqual(1);
}

/** Beside the name or under it, and inside the row either way. */
function expectCountPlaced(m: Measured) {
  const count = m.count as NonNullable<Measured['count']>;
  if (count.top >= m.name.bottom - 1) expectBeneath(m);
  else expectBeside(m);
  expect(count.left, JSON.stringify(m)).toBeGreaterThanOrEqual(m.row.left);
  expect(count.right, JSON.stringify(m)).toBeLessThanOrEqual(m.row.right + 0.5);
}

test("a box's name stays readable in the place tree, with its count beside it or under it", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const name = attemptName('Birch Close');
  const docked = test.info().project.name === 'desktop';
  const { context, page } = await person(browser, IBRAHIM);
  let loc: string | undefined;
  try {
    await page.goto('/');
    const made = await makeLocation(page, name);
    loc = made.id;
    const row = (tree: Locator, box: string) =>
      tree.getByRole('link', { name: new RegExp(`^${box}`) });

    // German, as it was reported: the longest count.
    let tree = await treeIn(page, made.office, 'de', docked ? 'Orte in {name}' : 'Alle Orte', name);
    if (docked) {
      const width = await tree.evaluate((el) => el.getBoundingClientRect().width);
      expect(width).toBeLessThanOrEqual(240);
      expect(width).toBeGreaterThan(220);
    }
    // The deepest row's count must not stretch every row past the tree's edge.
    const wider = await tree.evaluate(
      (el) => el.querySelector('ul')?.getBoundingClientRect().width ?? 0,
    );
    expect(wider).toBeLessThanOrEqual((await tree.boundingBox())?.width ?? 0);
    await expect(row(tree, 'Crate042')).toContainText('0 Gegenstände');
    // Depth 6 has room for a name only at the outline's width: the panel has about 46 px there.
    for (const box of docked ? ['Crate042', 'Crate044'] : ['Crate042', 'Crate044', 'Crate046']) {
      const m = await measure(row(tree, box));
      expect(m.lines, `${box} on one line: ${JSON.stringify(m)}`).toBe(1);
      expect(m.nameText).toBe(box);
      expectCountPlaced(m);
    }
    if (docked) expectBeneath(await measure(row(tree, 'Crate042')));

    // A plain place at the same depth, which has no count.
    const place = await measure(row(tree, 'Regal007'));
    expect(place.lines, JSON.stringify(place)).toBe(1);

    // One word too long for any row: it breaks, whole and inside the row, with no ellipsis.
    const long = await measure(row(tree, LONG_WORD));
    expect(long.lines, JSON.stringify(long)).toBeGreaterThan(1);
    expect(long.nameText).toBe(LONG_WORD);
    expect(long.ellipsis).toBe(false);
    expect(long.rowOverflows, JSON.stringify(long)).toBe(false);
    expect(long.name.right, JSON.stringify(long)).toBeLessThanOrEqual(long.row.right + 0.5);
    expectBeneath(long);
    await axe(page, 'the place tree in German');

    // English, where a shallow box has room for both: the count stays at the row's end.
    tree = await treeIn(page, made.office, 'en', docked ? 'Places in {name}' : 'All places', name);
    await expect(row(tree, 'Crate001')).toContainText('0 things');
    const beside = await measure(row(tree, 'Crate001'));
    expect(beside.lines, JSON.stringify(beside)).toBe(1);
    expectBeside(beside);

    // Arabic: the same, mirrored.
    tree = await treeIn(page, made.office, 'ar', docked ? 'الأماكن في {name}' : 'كل الأماكن', name);
    for (const box of ['Crate001', 'Crate042', 'Crate044']) {
      const m = await measure(row(tree, box));
      expect(m.dir).toBe('rtl');
      expect(m.lines, `${box} on one line: ${JSON.stringify(m)}`).toBe(1);
      expectCountPlaced(m);
    }
    const longAr = await measure(row(tree, LONG_WORD));
    expect(longAr.rowOverflows, JSON.stringify(longAr)).toBe(false);
    expect(longAr.name.left, JSON.stringify(longAr)).toBeGreaterThanOrEqual(longAr.row.left - 0.5);
    expectBeneath(longAr);
    await axe(page, 'the place tree in Arabic');
  } finally {
    await page.evaluate(() => localStorage.removeItem('kept.locale')).catch(() => {});
    await dropLocation(page, { id: loc, name });
    await context.close();
  }
});
