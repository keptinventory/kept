/**
 * Places read A to Z with numbers in order, and boxes stay in the place tree, end to end against
 * the real server (the `homebox` instance, e2e/instances.ts, behind HTTPS on the `households`
 * seed). Each attempt makes a location of its own through the API, named for the project, the
 * run and the retry, and deletes it at the end, so a retry starts from nothing and no other test's
 * places are touched (#336):
 *
 * - a Garage holding Box 1 … Box 12, made out of order and each with something in it, then turned
 *   into boxes in one step; its tree lists them as boxes in number order (Box 2 before Box 10),
 *   each saying what is in it;
 * - Pantry, turned into a box from its page, opens as the box at once and is still in the tree,
 *   now as a box;
 * - Select → Move puts a thing into that box.
 *
 * Every page is checked with axe (nothing above "minor"). Runs twice per project
 * (`--repeat-each 2`, one worker: both projects sign the same person in).
 *
 *   KEPT_E2E_INSTANCES=homebox pnpm --filter @kept/web exec playwright test places-order.spec.ts \
 *     --repeat-each 2 --workers 1
 */
import { type Locator, type Page, test } from '@playwright/test';
import { HOMEBOX_INSTANCE } from './instances';
import { axe, expect, IBRAHIM, people } from './tls-people';

const { BASE, person, api } = people(HOMEBOX_INSTANCE);

test.use({ baseURL: BASE, ignoreHTTPSErrors: true });

type Node = { id: string; parentId: string | null; name: string };
type Box = { id: string; placeId: string; name: string | null; contentCount: number };

const TWELVE = Array.from({ length: 12 }, (_, i) => `Box ${i + 1}`);
/** The order they are made in: neither by name nor by number. */
const MADE = [7, 12, 2, 10, 1, 5, 11, 3, 9, 4, 8, 6];
const IN_BOXES = [
  'Spanners',
  'Fuses',
  'Bike lights',
  'Tent pegs',
  'Paint brushes',
  'Extension cable',
  'Cable ties',
  'Sandpaper',
  'Wood glue',
  'Garden gloves',
  'Spare bulbs',
  'Picture hooks',
];
const isBox = (n: string | null | undefined) => /^Box \d+$/.test(n ?? '');

/**
 * A location of its own: Garage (Box 1 … Box 12 as boxes, a thing in each, a bike pump loose)
 * and Pantry (rice and olive oil), all made through the API.
 */
async function createLocation(page: Page, name: string): Promise<string> {
  const loc = await api(page).post<{ id: string }>('/api/v1/locations', {
    name,
    kind: 'home',
    preset: 'essentials',
    timezone: 'Africa/Cairo',
    currency: 'EGP',
    rooms: ['Garage', 'Pantry'],
  });
  return loc.id;
}

/** Fills a new location: the boxes in the Garage, the things, and the Pantry. */
async function fillLocation(page: Page, locId: string) {
  const call = api(page);
  const loc = { id: locId };
  const { places } = await call.get<{ places: Node[] }>(`/api/v1/locations/${loc.id}/places`);
  const room = (n: string) => places.find((p) => p.name === n && p.parentId === null) as Node;
  const garage = room('Garage');
  const pantry = room('Pantry');
  expect(garage && pantry, JSON.stringify(places)).toBeTruthy();
  const thing = (body: Record<string, string>) =>
    call.post('/api/v1/things', { locationId: loc.id, ...body });
  const made: string[] = [];
  for (const n of MADE) {
    const box = await call.post<{ id: string }>(`/api/v1/locations/${loc.id}/places`, {
      name: `Box ${n}`,
      kindKey: 'zone',
      parentId: garage.id,
    });
    await thing({ placeId: box.id, name: IN_BOXES[n - 1] as string });
    made.push(box.id);
  }
  const { results } = await call.post<{ results: { status: string }[] }>(
    `/api/v1/places/${garage.id}/convert-children-to-containers`,
    { placeIds: made },
  );
  expect(results.map((r) => r.status)).toEqual(made.map(() => 'converted'));
  await thing({ placeId: garage.id, name: 'Bike pump' });
  await thing({ placeId: pantry.id, name: 'Rice' });
  await thing({ placeId: pantry.id, name: 'Olive oil' });
  return { loc: loc.id, garage, pantry };
}

/** The place tree beside the page (desktop) or the "All places" outline, opened (phone). */
async function placeTree(page: Page, locationName: string): Promise<Locator> {
  if (test.info().project.name === 'desktop')
    return page.getByRole('navigation', { name: `Places in ${locationName}` });
  const outline = page.locator('details').filter({ hasText: 'All places' });
  await outline.locator('summary').click();
  return outline;
}

/** The names of the box links in a tree, in the order shown. */
const boxNames = (tree: Locator) => tree.locator('a[href^="/t/"] bdi').allTextContents();

test('places read A to Z, boxes stay in the tree, and Move puts a thing into a box', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const info = test.info();
  const name = `Elm Road ${info.project.name} ${info.repeatEachIndex + 1} try ${info.retry + 1}`;
  const { context, page } = await person(browser, IBRAHIM);
  // Made inside the try, so a failure partway through setup still deletes it.
  let loc: string | undefined;
  try {
    loc = await createLocation(page, name);
    const { garage, pantry } = await fillLocation(page, loc);
    const tree = () =>
      api(page).get<{ places: Node[]; boxes: Box[] }>(`/api/v1/locations/${loc}/places`);

    // The Garage: Box 1 … Box 12 in number order in the tree, as boxes, each saying what is in it.
    const before = await tree();
    expect(
      before.boxes
        .filter((b) => b.placeId === garage.id)
        .map((b) => b.name)
        .filter(isBox),
    ).toEqual(TWELVE);
    await page.goto(`/p/${garage.id}`);
    await expect(page.getByRole('heading', { name: 'Garage', level: 1 })).toBeVisible();
    const shown = await placeTree(page, name);
    await expect(shown.getByRole('link', { name: /^Box 1\s*1 thing$/ })).toBeVisible();
    expect((await boxNames(shown)).filter(isBox)).toEqual(TWELVE);
    await axe(page, 'a place with its boxes in the tree');

    // Pantry, turned into a box, opens as the box and is still in the tree.
    await page.goto(`/p/${pantry.id}`);
    await expect(page.getByRole('heading', { name: 'Pantry', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: /^Turn into a box/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Turn Pantry into a box?' });
    await dialog.getByRole('button', { name: 'Turn into a box' }).click();
    await expect(page).toHaveURL(/\/t\//);
    await expect(page.getByRole('heading', { name: 'Pantry', level: 1 })).toBeVisible();
    const after = await tree();
    expect(after.places.some((p) => p.id === pantry.id)).toBe(false);
    expect(after.boxes.find((b) => b.id === pantry.id)).toBeTruthy();
    const onBoxPage = await placeTree(page, name);
    await expect(onBoxPage.locator(`a[href^="/t/"]`).filter({ hasText: 'Pantry' })).toBeVisible();
    await axe(page, 'a box in the tree');

    // Select → Move: a thing from the location's list into that box.
    await page.goto(`/loc/${loc}`);
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    // Any thing but the box itself (a box can't go into itself; the picker leaves it out).
    const pick = page.getByRole('checkbox', { name: /^Select (?!Pantry$)/ }).first();
    await expect(pick).toBeAttached();
    const label = (await pick.getAttribute('aria-label')) ?? '';
    const thing = label.replace(/^Select /, '');
    expect(thing).not.toBe('');
    await pick.check({ force: true });
    await page.getByRole('button', { name: 'Move', exact: true }).click();
    const move = page.getByRole('dialog', { name: 'Move to…' });
    await move.getByRole('searchbox', { name: 'Search places' }).fill('Pantry');
    // This attempt's Pantry, in its own location.
    await move.getByRole('radio', { name: new RegExp(`^Pantry ${name} ›`) }).check({ force: true });
    await axe(page, 'the move picker with a box');
    await move.getByRole('button', { name: 'Move here' }).click();
    await expect(page.getByText('Moved to Pantry')).toBeVisible();
    const inside = await api(page).get<{ items: { name: string }[] }>(
      `/api/v1/things?locationId=${loc}&containerId=${pantry.id}&limit=200`,
    );
    expect(inside.items.map((x) => x.name)).toContain(thing);
  } finally {
    // Gone with everything in it (the Trash keeps it for its grace period), retry or not.
    // Best effort: a failed delete is noted, never put in place of the test's own error.
    if (loc) {
      const res = await page.request
        .delete(`/api/v1/locations/${loc}`, {
          headers: { origin: BASE, 'idempotency-key': crypto.randomUUID() },
        })
        .catch((e: unknown) => e as Error);
      if (res instanceof Error || !res.ok())
        info.annotations.push({
          type: 'cleanup',
          description: `delete ${name}: ${res instanceof Error ? res.message : `${res.status()} ${await res.text()}`}`,
        });
    }
    await context.close();
  }
});
