/**
 * A Homebox 0.27 upgrade, imported end to end against the real server (the `homebox` instance,
 * e2e/instances.ts, behind HTTPS on the `households` seed): the committed
 * homebox-0.27.0-boxes.zip (apps/server/test/fixtures/homebox), into a new location of its own in
 * each project.
 *
 * - Where it goes, then What to track: Essentials with what the backup uses ticked (prices,
 *   warranties, maintenance), and Personal switched with it;
 * - the choices: Homebox's catch-all reads as "Item" and comes in as No type; every location that
 *   looks like a box chosen; quantity 0 kept or archived;
 * - the check: every row says why, no internal Homebox name anywhere;
 * - the import: the location is made only now, with Essentials; the used-up things are archived
 *   with "Quantity in Homebox: 0" in their notes; Garage's Box 01–12 are boxes holding what was in
 *   them; and the import's page still shows what needed a look.
 *
 * Every page is checked with axe (nothing above "minor"). Runs twice per project
 * (`--repeat-each 2`, one worker: both projects sign the same person in): each run imports into
 * a location named for the run.
 *
 *   KEPT_E2E_INSTANCES=homebox pnpm --filter @kept/web exec playwright test homebox-boxes.spec.ts \
 *     --repeat-each 2 --workers 1
 */
import { fileURLToPath } from 'node:url';
import { test } from '@playwright/test';
import { HOMEBOX_INSTANCE } from './instances';
import { axe, expect, IBRAHIM, people } from './tls-people';

const { BASE, person, api, locationId } = people(HOMEBOX_INSTANCE);

test.use({ baseURL: BASE, ignoreHTTPSErrors: true });

const ZIP = fileURLToPath(
  new URL('../../server/test/fixtures/homebox/homebox-0.27.0-boxes.zip', import.meta.url),
);

type Thing = { id: string; name: string };

test('a Homebox 0.27 upgrade comes over as Homebox had it, into Essentials', async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const name = `Maple Street ${test.info().project.name} ${test.info().repeatEachIndex + 1}`;
  const { context, page } = await person(browser, IBRAHIM);

  await page.goto('/settings/import?source=homebox_zip');
  await expect(page.getByRole('heading', { name: 'The Homebox export' })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(ZIP);
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Where it goes, then what it tracks.
  const target = page.getByRole('textbox', { name: 'Name', exact: true });
  await expect(target).toBeVisible();
  await target.fill(name);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What to track' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /^Essentials/ })).toBeChecked();
  // On top of Essentials, ticked: what the backup uses.
  await expect(page.getByRole('checkbox', { name: /Prices on 12 things/ })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /5 warranties/ })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /2 maintenance entries/ })).toBeChecked();
  await axe(page, 'the import’s What to track');
  await page.getByRole('switch', { name: 'Also for Personal' }).check({ force: true });
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // The choices.
  await expect(
    page.getByRole('heading', { name: 'A few choices, before the check' }),
  ).toBeVisible();
  // Not made until Import.
  const before = await api(page).get<{ locations: { name: string }[] }>('/api/v1/locations');
  expect(before.locations.map((l) => l.name)).not.toContain(name);
  await expect(page.getByRole('combobox', { name: 'Kept type for Item' })).toHaveValue('No type');
  await expect(page.getByText('global.item')).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'Keep 0 or archive' })).toBeChecked();
  await page.getByRole('button', { name: 'Choose all', exact: true }).click();
  await expect(page.getByText('14 of 14 as boxes')).toBeVisible();
  await axe(page, 'the import’s choices');
  await page.getByRole('button', { name: 'Check the import', exact: true }).click();

  // The check: every row says why.
  const go = page.getByRole('button', { name: /^Import \d+ things$/ });
  await expect(go).toBeVisible({ timeout: 60_000 });
  const report = page.getByRole('list', { name: 'Needs a look' });
  await expect(report).toContainText('Quantity 0 in Homebox; it came in archived.');
  await expect(report).toContainText('A location that came in as a box, as chosen.');
  await expect(report).toContainText('It holds other items, so it came in as a box.');
  await expect(report).not.toContainText('An item or location');
  await expect(page.getByText(/global\./)).toHaveCount(0);
  await axe(page, 'the import’s check');
  await go.click();
  await expect(page.getByRole('heading', { name: `Imported into ${name}` })).toBeVisible({
    timeout: 180_000,
  });
  await expect(page.getByRole('heading', { name: /^What needed a look/ })).toBeVisible();
  await axe(page, 'the import’s done');

  // What came over.
  const loc = await locationId(page, name);
  const { locations } = await api(page).get<{
    locations: { id: string; kind: string; preset: string }[];
  }>('/api/v1/locations');
  expect(locations.find((l) => l.id === loc)?.preset).toBe('essentials');
  expect(locations.find((l) => l.kind === 'personal')?.preset).toBe('essentials');
  const made = await api(page).get<{ modules: string[] }>(`/api/v1/locations/${loc}`);
  expect(made.modules).toEqual(expect.arrayContaining(['money', 'warranties', 'schedules']));
  const archived = await api(page).get<{ items: Thing[] }>(
    `/api/v1/things?locationId=${loc}&lifecycle=archived&limit=200`,
  );
  const used = [
    'AA batteries',
    'Candles',
    'Gas canister',
    'Grout',
    'Lures',
    'Spare light bulbs',
    'Wrapping paper',
    'Zip ties',
  ];
  expect(archived.items.map((x) => x.name)).toEqual(expect.arrayContaining(used));
  const candles = archived.items.find((x) => x.name === 'Candles') as Thing;
  const detail = await api(page).get<{ notes: string | null; quantity: number | string }>(
    `/api/v1/things/${candles.id}`,
  );
  expect(detail.notes).toContain('Quantity in Homebox: 0');
  const live = await api(page).get<{ items: Thing[] }>(
    `/api/v1/things?locationId=${loc}&limit=200`,
  );
  const names = live.items.map((x) => x.name);
  for (const n of ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'])
    expect(names).toContain(`Box ${n}`);
  const box01 = live.items.find((x) => x.name === 'Box 01') as Thing;
  const inside = await api(page).get<{ items: Thing[] }>(
    `/api/v1/things?locationId=${loc}&containerId=${box01.id}&limit=50`,
  );
  expect(inside.items.map((x) => x.name).sort()).toEqual(['Christmas lights', 'Tree stand']);

  // The box opens as a thing that holds its contents.
  await page.goto(`/t/${box01.id}`);
  await expect(page.getByRole('heading', { name: 'Box 01', level: 1 })).toBeVisible();
  await axe(page, 'a location that came in as a box');
  await context.close();
});
