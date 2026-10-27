/**
 * Places read A to Z with numbers in order, and boxes stay in the place tree, end to end against
 * the real server (the `homebox` instance, e2e/instances.ts, behind HTTPS on the `households`
 * seed): the committed homebox-0.27.0-boxes.zip (apps/server/test/fixtures/homebox), imported into
 * a new location of its own in each run, with every box-like location chosen as a box.
 *
 * - the Garage's tree lists Box 01 … Box 12 in order, as boxes with what is in them counted
 *   (Homebox created them out of order);
 * - Pantry, turned into a box from its page, is still in the tree, now as a box;
 * - Select → Move puts a thing into that box.
 *
 * Every page is checked with axe (nothing above "minor"). Runs twice per project
 * (`--repeat-each 2`, one worker: both projects sign the same person in).
 *
 *   KEPT_E2E_INSTANCES=homebox pnpm --filter @kept/web exec playwright test places-order.spec.ts \
 *     --repeat-each 2 --workers 1
 */
import { fileURLToPath } from 'node:url';
import { type Locator, type Page, test } from '@playwright/test';
import { HOMEBOX_INSTANCE } from './instances';
import { axe, expect, IBRAHIM, people } from './tls-people';

const { BASE, person, api, locationId } = people(HOMEBOX_INSTANCE);

test.use({ baseURL: BASE, ignoreHTTPSErrors: true });

const ZIP = fileURLToPath(
  new URL('../../server/test/fixtures/homebox/homebox-0.27.0-boxes.zip', import.meta.url),
);

type Node = { id: string; parentId: string | null; name: string };
type Box = { id: string; placeId: string; name: string | null; contentCount: number };

/** Imports the fixture into a new location called `name`, every box-like location as a box. */
async function importInto(page: Page, name: string) {
  await page.goto('/settings/import?source=homebox_zip');
  await expect(page.getByRole('heading', { name: 'The Homebox export' })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(ZIP);
  const next = page.getByRole('button', { name: 'Next', exact: true });
  await expect(next).toBeVisible({ timeout: 60_000 });
  await next.click();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
  await next.click();
  await expect(page.getByRole('heading', { name: 'What to track' })).toBeVisible();
  await next.click();
  await expect(
    page.getByRole('heading', { name: 'A few choices, before the check' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Choose all', exact: true }).click();
  await page.getByRole('button', { name: 'Check the import', exact: true }).click();
  const go = page.getByRole('button', { name: /^Import \d+ things$/ });
  await expect(go).toBeVisible({ timeout: 60_000 });
  await go.click();
  await expect(page.getByRole('heading', { name: `Imported into ${name}` })).toBeVisible({
    timeout: 180_000,
  });
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
  test.setTimeout(300_000);
  const name = `Elm Road ${test.info().project.name} ${test.info().repeatEachIndex + 1}`;
  const { context, page } = await person(browser, IBRAHIM);
  await importInto(page, name);
  const loc = await locationId(page, name);
  const tree = () =>
    api(page).get<{ places: Node[]; boxes: Box[] }>(`/api/v1/locations/${loc}/places`);

  // The Garage: Box 01 … Box 12 in order in the tree, as boxes, each saying what is in it.
  const before = await tree();
  const garage = before.places.find((p) => p.name === 'Garage' && p.parentId === null) as Node;
  const twelve = Array.from({ length: 12 }, (_, i) => `Box ${String(i + 1).padStart(2, '0')}`);
  expect(
    before.boxes
      .filter((b) => b.placeId === garage.id)
      .map((b) => b.name)
      .filter((n) => /^Box \d\d$/.test(n ?? '')),
  ).toEqual(twelve);
  await page.goto(`/p/${garage.id}`);
  await expect(page.getByRole('heading', { name: 'Garage', level: 1 })).toBeVisible();
  const shown = await placeTree(page, name);
  await expect(shown.getByRole('link', { name: /^Box 01\s*\d+ things?$/ })).toBeVisible();
  expect((await boxNames(shown)).filter((n) => /^Box \d\d$/.test(n))).toEqual(twelve);
  await axe(page, 'a place with its boxes in the tree');

  // Pantry, turned into a box, is still in the tree.
  const pantry = before.places.find((p) => p.name === 'Pantry') as Node;
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
  const label = (await pick.getAttribute('aria-label')) ?? '';
  const thing = label.replace(/^Select /, '');
  expect(thing).not.toBe('');
  await pick.check({ force: true });
  await page.getByRole('button', { name: 'Move', exact: true }).click();
  const move = page.getByRole('dialog', { name: 'Move to…' });
  await move.getByRole('searchbox', { name: 'Search places' }).fill('Pantry');
  // This run's Pantry, in its own location.
  await move.getByRole('radio', { name: new RegExp(`^Pantry ${name} ›`) }).check({ force: true });
  await axe(page, 'the move picker with a box');
  await move.getByRole('button', { name: 'Move here' }).click();
  await expect(page.getByText('Moved to Pantry')).toBeVisible();
  const inside = await api(page).get<{ items: { name: string }[] }>(
    `/api/v1/things?locationId=${loc}&containerId=${pantry.id}&limit=200`,
  );
  expect(inside.items.map((x) => x.name)).toContain(thing);
  await context.close();
});
