/**
 * The places inside a place, end to end against the real server (the `homebox` instance,
 * e2e/instances.ts, behind HTTPS on the `households` seed): the committed homebox-0.27.0-boxes.zip
 * (apps/server/test/fixtures/homebox), imported into a new location of its own in each run with
 * every location as a place (no box chosen at the import).
 *
 * - On the Garage, Manage → "Turn places into boxes…" → Select all turns Box 01 … Box 12 into
 *   boxes in one step; the tree shows them as boxes; the toast's Undo makes them places again.
 * - With the keyboard only, "Order of the places here" → Custom order → Move down on the first
 *   place swaps the first two; A to Z reads A to Z again, and Custom order brings the swap back.
 *
 * Every sheet is checked with axe (nothing above "minor"). Runs twice per project
 * (`--repeat-each 2`, one worker: both projects sign the same person in).
 *
 *   KEPT_E2E_INSTANCES=homebox pnpm --filter @kept/web exec playwright test sub-places.spec.ts \
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
type Box = { id: string; placeId: string; name: string | null };

/** Imports the fixture into a new location called `name`, every location as a place. */
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

const TWELVE = Array.from({ length: 12 }, (_, i) => `Box ${String(i + 1).padStart(2, '0')}`);
const isBox = (n: string | null | undefined) => /^Box \d\d$/.test(n ?? '');
/** "Move Box 01 down", the name isolated as user text. */
const moveName = (name: string, direction: 'up' | 'down') =>
  new RegExp(`^Move \\W?${literal(name)}\\W? ${direction}$`);
const literal = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('many places become boxes with one Undo, and a place keeps its own order', async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const name = `Oak Lane ${test.info().project.name} ${test.info().repeatEachIndex + 1}`;
  const { context, page } = await person(browser, IBRAHIM);
  await importInto(page, name);
  const loc = await locationId(page, name);
  const tree = () =>
    api(page).get<{ places: Node[]; boxes: Box[] }>(`/api/v1/locations/${loc}/places`);

  const before = await tree();
  const garage = before.places.find((p) => p.name === 'Garage' && p.parentId === null) as Node;
  expect(
    before.places.filter((p) => p.parentId === garage.id && isBox(p.name)).map((p) => p.name),
  ).toEqual(TWELVE);

  // Manage → Turn places into boxes… → Select all → one step.
  await page.goto(`/p/${garage.id}`);
  await expect(page.getByRole('heading', { name: 'Garage', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: /^Turn places into boxes…/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Turn places into boxes' });
  await expect(dialog.getByRole('checkbox', { name: /^Box 01/ })).toBeVisible();
  await dialog.getByText('Select all', { exact: true }).click();
  const convert = dialog.getByRole('button', { name: /^Turn \d+ places into boxes$/ });
  await expect(convert).toBeEnabled();
  await axe(page, 'turn places into boxes');
  await convert.click();
  const toast = page.getByRole('region', { name: 'Notifications' });
  await expect(toast.getByText(/^Turned \d+ places into boxes$/)).toBeVisible();
  await expect(dialog).toBeHidden();

  const after = await tree();
  expect(after.places.some((p) => p.parentId === garage.id && isBox(p.name))).toBe(false);
  expect(
    after.boxes.filter((b) => b.placeId === garage.id && isBox(b.name)).map((b) => b.name),
  ).toEqual(TWELVE);
  const shown = await placeTree(page, name);
  await expect(shown.locator('a[href^="/t/"]').filter({ hasText: 'Box 01' })).toBeVisible();

  // The one Undo: all twelve are places again.
  await toast.getByRole('button', { name: 'Undo' }).click();
  await expect(toast.getByText('Undone')).toBeVisible();
  const undone = await tree();
  expect(
    undone.places.filter((p) => p.parentId === garage.id && isBox(p.name)).map((p) => p.name),
  ).toEqual(TWELVE);
  expect(undone.boxes.some((b) => b.placeId === garage.id && isBox(b.name))).toBe(false);

  // Custom order, with the keyboard only. A to Z first; Custom shows the order the places
  // had (the import's), and Move down swaps the first two.
  const children = async () =>
    (
      await api(page).get<{ places: { name: string }[] }>(`/api/v1/places/${garage.id}/contents`)
    ).places.map((p) => p.name);
  const az = await children();
  expect(az.filter(isBox)).toEqual(TWELVE);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Garage', level: 1 })).toBeVisible();
  const row = page.getByRole('button', { name: /^Order of the places here/ });
  await row.focus();
  await page.keyboard.press('Enter');
  const order = page.getByRole('dialog', { name: /^Order of the places in \W?Garage\W?$/ });
  const aToZ = order.getByRole('radio', { name: 'A to Z' });
  const custom = order.getByRole('radio', { name: 'Custom order' });
  await expect(aToZ).toBeChecked();
  await aToZ.focus();
  await page.keyboard.press('ArrowRight');
  await expect(custom).toBeChecked();
  await expect(order.getByRole('button', { name: /^Move .* down$/ }).first()).toBeVisible();
  const start = await children();
  const [first, second] = start as [string, string];
  const down = order.getByRole('button', { name: moveName(first, 'down') });
  await axe(page, 'the order of the places, in Custom order');
  await down.focus();
  await page.keyboard.press('Enter');
  const moved = [second, first, ...start.slice(2)];
  await expect.poll(children).toEqual(moved);
  await expect(order.getByRole('status')).toHaveText(
    new RegExp(`${literal(first)}\\W? moved to 2 of ${start.length}`),
  );
  await expect(down).toBeFocused();

  // Back to A to Z: A to Z again; Custom order: the order comes back.
  await custom.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(aToZ).toBeChecked();
  await expect.poll(children).toEqual(az);
  await page.keyboard.press('ArrowRight');
  await expect(custom).toBeChecked();
  await expect.poll(children).toEqual(moved);
  await page.keyboard.press('Escape');
  await expect(order).toBeHidden();
  await context.close();
});
