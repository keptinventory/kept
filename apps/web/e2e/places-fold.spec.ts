/**
 * Folding the place tree (#358), end to end against the real server (the `homebox` instance,
 * e2e/instances.ts, behind HTTPS on the `households` seed). Each attempt makes a location of its
 * own through the API, named for the project, the run and the retry, and deletes it at the end
 * (its folds go with its places), so a retry starts from nothing (#336):
 *
 * - Bedroom › Under bed holds Box 1 … Box 3. On the Office's page, "What's in Under bed" folds the
 *   boxes away; after a reload it is still folded, as the server keeps it for the person;
 * - on Box 2's own page Under bed is open again (the path to the page stays open), Box 2 marked;
 * - Fold all and Open all do every place, and the server agrees.
 *
 * Every state is checked with axe (nothing above "minor"). Runs twice per project
 * (`--repeat-each 2`, one worker: both projects sign the same person in).
 *
 *   KEPT_E2E_INSTANCES=homebox pnpm --filter @kept/web exec playwright test places-fold.spec.ts \
 *     --repeat-each 2 --workers 1
 */
import { type Locator, type Page, test } from '@playwright/test';
import { HOMEBOX_INSTANCE } from './instances';
import { attemptName, axe, expect, IBRAHIM, people } from './tls-people';

const { BASE, person, api, dropLocation } = people(HOMEBOX_INSTANCE);

test.use({ baseURL: BASE, ignoreHTTPSErrors: true });

type Node = { id: string; parentId: string | null; name: string };
type Box = { id: string; placeId: string; name: string | null };

/** A location of its own: Bedroom › Under bed › Box 1 … Box 3 (boxes), and an empty Office. */
async function makeLocation(page: Page, name: string): Promise<string> {
  const call = api(page);
  const loc = await call.post<{ id: string }>('/api/v1/locations', {
    name,
    kind: 'home',
    preset: 'essentials',
    timezone: 'Africa/Cairo',
    currency: 'EGP',
    rooms: ['Bedroom', 'Office'],
  });
  return loc.id;
}

async function fill(page: Page, locId: string) {
  const call = api(page);
  const { places } = await call.get<{ places: Node[] }>(`/api/v1/locations/${locId}/places`);
  const room = (n: string) => places.find((p) => p.name === n && p.parentId === null) as Node;
  const bedroom = room('Bedroom');
  const office = room('Office');
  expect(bedroom && office, JSON.stringify(places)).toBeTruthy();
  const underBed = await call.post<{ id: string }>(`/api/v1/locations/${locId}/places`, {
    name: 'Under bed',
    kindKey: 'zone',
    parentId: bedroom.id,
  });
  const made: string[] = [];
  for (const n of [1, 2, 3]) {
    const box = await call.post<{ id: string }>(`/api/v1/locations/${locId}/places`, {
      name: `Box ${n}`,
      kindKey: 'zone',
      parentId: underBed.id,
    });
    made.push(box.id);
  }
  await call.post(`/api/v1/places/${underBed.id}/convert-children-to-containers`, {
    placeIds: made,
  });
  return { bedroom, office, underBed: underBed.id };
}

/** The place tree beside the page (desktop) or the "All places" outline, opened (phone). */
async function placeTree(page: Page, locationName: string): Promise<Locator> {
  if (test.info().project.name === 'desktop')
    return page.getByRole('navigation', { name: `Places in ${locationName}` });
  const outline = page.locator('details').filter({ hasText: 'All places' });
  await outline.locator('summary').click();
  return outline;
}

test('a place folds its boxes away, stays folded after a reload, and opens on its own path', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const name = attemptName('Birch Close');
  const { context, page } = await person(browser, IBRAHIM);
  let loc: string | undefined;
  try {
    loc = await makeLocation(page, name);
    const { bedroom, office, underBed } = await fill(page, loc);
    const folds = async () =>
      (await api(page).get<{ placeIds: string[] }>(`/api/v1/locations/${loc}/place-folds`))
        .placeIds;
    const { boxes } = await api(page).get<{ boxes: Box[] }>(`/api/v1/locations/${loc}/places`);
    const box2 = boxes.find((b) => b.name === 'Box 2') as Box;
    expect(box2, JSON.stringify(boxes)).toBeTruthy();

    // On the Office's page: fold Under bed.
    await page.goto(`/p/${office.id}`);
    await expect(page.getByRole('heading', { name: 'Office', level: 1 })).toBeVisible();
    let tree = await placeTree(page, name);
    const fold = () => tree.getByRole('button', { name: "What's in Under bed" });
    await expect(tree.getByRole('link', { name: /^Box 2/ })).toBeVisible();
    await fold().click();
    await expect(fold()).toHaveAttribute('aria-expanded', 'false');
    await expect(tree.getByRole('link', { name: /^Box 2/ })).toHaveCount(0);
    await expect.poll(folds).toEqual([underBed]);
    await axe(page, 'the place tree with a place folded');

    // Remembered for the person, not the page: a reload opens it folded.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Office', level: 1 })).toBeVisible();
    tree = await placeTree(page, name);
    await expect(fold()).toHaveAttribute('aria-expanded', 'false');
    await expect(tree.getByRole('link', { name: /^Box 2/ })).toHaveCount(0);

    // A box's own page keeps the way to it open, and marks it.
    await page.goto(`/t/${box2.id}`);
    await expect(page.getByRole('heading', { name: 'Box 2', level: 1 })).toBeVisible();
    tree = await placeTree(page, name);
    await expect(fold()).toHaveAttribute('aria-expanded', 'true');
    await expect(tree.locator('a[aria-current="page"]')).toContainText('Box 2');

    // Fold all, then Open all, from the tree's header.
    await page.goto(`/p/${office.id}`);
    await expect(page.getByRole('heading', { name: 'Office', level: 1 })).toBeVisible();
    tree = await placeTree(page, name);
    await tree.getByRole('button', { name: 'Fold all' }).click();
    await expect.poll(async () => (await folds()).sort()).toEqual([bedroom.id, underBed].sort());
    await expect(tree.getByRole('link', { name: 'Under bed' })).toHaveCount(0);
    await tree.getByRole('button', { name: 'Open all' }).click();
    await expect.poll(folds).toEqual([]);
    await expect(tree.getByRole('link', { name: /^Box 2/ })).toBeVisible();
    await axe(page, 'the place tree opened again');
  } finally {
    await dropLocation(page, { id: loc, name });
    await context.close();
  }
});
