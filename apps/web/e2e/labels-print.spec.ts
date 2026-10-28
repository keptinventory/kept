/**
 * Labels print what the preview shows, against the real server and Chromium's own PDF output, on
 * the `labels` instance (households seed), phone and desktop.
 *
 * 1. Sixteen things with long names on an A4 sheet of 24: the print view printed to PDF at its
 *    `@page` size is read back with pdf.js. Every name and place is there whole, each in its own
 *    70 × 37 mm cell, and each cell's QR sits where the label puts it, within 0.5 mm, on a 3 × 8
 *    grid of an A4 page. The builder's sheet preview and the print view, brought to the same
 *    scale, match cell by cell (a pixel difference with a small tolerance, far below the
 *    difference between two different labels).
 * 2. "Printed OK?" names the batch just printed and confirms that one, not an older sheet; and
 *    "Label everything unprinted" a second time offers the sheet already made instead of a
 *    duplicate.
 *
 *   KEPT_E2E_INSTANCES=labels pnpm --filter @kept/web exec playwright test labels-print.spec.ts
 *
 * Names are invented; the print dialog is the browser's, so `window.print` is recorded instead.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { type Browser, type BrowserContext, expect, type Page, test } from '@playwright/test';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import sharp from 'sharp';
import { INSTANCES, stateDirOf, urlOf } from './instances';

const INSTANCE = INSTANCES.labels;
const BASE = urlOf(INSTANCE);
const PASSWORD = 'kept-seed-password';

test.use({ baseURL: BASE });

const NAMES = [
  'Cordless stick vacuum with wall dock and spare filters',
  'Noise-cancelling over-ear headphones (travel case)',
  '27-inch 4K monitor, matte, height-adjustable stand',
  'Mechanical keyboard, brown switches, USB-C',
  'Wireless trackball mouse',
  'Portable SSD 2 TB',
  'Laptop stand, aluminium, foldable',
  'Desk lamp with wireless charging base and USB port',
  'USB-C docking station, dual HDMI, 100 W pass-through',
  'Webcam 1080p with privacy shutter',
  'Graphics tablet, medium, with pen and nib set',
  'Pneumonoultramicroscopicsilicovolcanoconiosisextraordinaires',
  'Power strip, 6 sockets, surge protected, 2 m cable',
  'Bluetooth speaker',
  'Document scanner, duplex, 30 pages per minute, sheet-fed',
  'Spare cables box (HDMI, USB-A to USB-C, Lightning, DisplayPort, audio)',
];

/** The A4 24 stock and the label's own geometry (components/labels/layout.ts cellMetrics). */
const CELL = { w: 70, h: 37, top: 0.5 };
const PAD = Math.max(1.5, 37 * 0.06);
const QR = Math.min(37 - 2 * PAD, 70 * 0.48);
const MM_PER_PT = 25.4 / 72;

// ---------------------------------------------------------------------------------------------
// Sessions: one sign-in per person per run (the sign-in limit), reused by every context.

const stateDir = path.join(stateDirOf(INSTANCE), 'sessions');

async function storageFor(browser: Browser, login: string): Promise<string> {
  const file = path.join(stateDir, `${login}.json`);
  if (existsSync(file)) return file;
  mkdirSync(stateDir, { recursive: true });
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage();
  await page.goto('/signin');
  await page.getByLabel('Email or username', { exact: true }).fill(login);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await ctx.storageState({ path: file });
  await ctx.close();
  return file;
}

/** A signed-in context shaped like the running project; `scale` for sharper screenshots. */
async function person(
  browser: Browser,
  scale = 1,
): Promise<{ context: BrowserContext; page: Page }> {
  const use = test.info().project.use;
  const context = await browser.newContext({
    baseURL: BASE,
    storageState: await storageFor(browser, 'ibrahim@kept.test'),
    viewport: use.viewport ?? { width: 1280, height: 800 },
    isMobile: use.isMobile ?? false,
    hasTouch: use.hasTouch ?? false,
    deviceScaleFactor: scale,
    timezoneId: 'Africa/Cairo',
    locale: 'en-GB',
  });
  // The print dialog is the browser's: record the call instead of opening it.
  await context.addInitScript(() => {
    const w = window as unknown as { __prints: number };
    w.__prints = 0;
    window.print = () => {
      w.__prints += 1;
    };
  });
  return { context, page: await context.newPage() };
}

const send = async (page: Page, url: string, data: unknown) => {
  const res = await page.request.fetch(url, { method: 'POST', data, headers: { origin: BASE } });
  expect(res.ok(), `${url}: ${await res.text()}`).toBe(true);
  return (await res.json()) as Record<string, unknown>;
};

async function homeId(page: Page): Promise<string> {
  const body = (await (await page.request.get('/api/v1/locations')).json()) as
    | { locations?: { id: string; name: string }[] }
    | { id: string; name: string }[];
  const list = Array.isArray(body) ? body : (body.locations ?? []);
  const home = list.find((l) => l.name === 'Home');
  if (!home) throw new Error('no Home location');
  return home.id;
}

/** A shelf of its own in Home, with `names` on it: what "Label everything unprinted" there prints. */
async function shelfWith(page: Page, home: string, names: readonly string[]) {
  const tag = `${test.info().project.name} ${test.info().title.slice(0, 12)} ${Date.now()}`;
  const study = await send(page, `/api/v1/locations/${home}/places`, {
    name: `Study ${tag}`,
    kindKey: 'zone',
  });
  const shelf = await send(page, `/api/v1/locations/${home}/places`, {
    name: 'Tall bookshelf by the window, second shelf',
    kindKey: 'zone',
    parentId: study.id,
  });
  const things: { id: string; name: string }[] = [];
  for (const name of names) {
    const t = await send(page, '/api/v1/things', { locationId: home, placeId: shelf.id, name });
    things.push({ id: t.id as string, name });
  }
  return { shelf: shelf.id as string, path: `Study ${tag} › ${shelf.name as string}`, things };
}

async function openBuilder(page: Page, home: string, shelf: string, count: number) {
  await page.goto(`/labels?loc=${home}&unprinted=1&place=${shelf}`);
  await page
    .getByRole('radiogroup', { name: 'Label stock' })
    .getByRole('radio', { name: /^A4 sheet · 24 labels/ })
    .check({ force: true });
  await expect(page.getByRole('button', { name: `Print ${count} labels` })).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
}

// ---------------------------------------------------------------------------------------------
// Reading the PDF back.

type Box = { x0: number; y0: number; x1: number; y1: number };
type Text = { str: string; x: number; y: number };
type Matrix = [number, number, number, number, number, number];

const mul = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m: Matrix, x: number, y: number): [number, number] => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];

/**
 * The page's size, its text items and the boxes of its black filled paths, all in mm from the
 * page's top-left corner. The labels' text is real text (glyphs), so the black paths are the
 * QR codes.
 */
async function readPdf(data: Buffer) {
  const doc = await getDocument({ data: new Uint8Array(data), useSystemFonts: false }).promise;
  expect(doc.numPages).toBe(1);
  const page = await doc.getPage(1);
  const [, , wPt, hPt] = page.view as [number, number, number, number];
  const top = (yPt: number) => (hPt - yPt) * MM_PER_PT;
  const content = await page.getTextContent();
  const texts: Text[] = [];
  for (const item of content.items) {
    if (!('str' in item) || !item.str.trim()) continue;
    const [, , , , e, f] = item.transform as Matrix;
    texts.push({ str: item.str, x: e * MM_PER_PT, y: top(f) });
  }
  const ops = await page.getOperatorList();
  const stack: Matrix[] = [];
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  let fill = '#000000';
  const black: Box[] = [];
  ops.fnArray.forEach((fn, i) => {
    const args = ops.argsArray[i] as unknown[];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = mul(ctm, args as Matrix);
    else if (fn === OPS.setFillRGBColor) {
      fill =
        typeof args[0] === 'string'
          ? (args[0] as string).toLowerCase()
          : `#${(args as number[])
              .slice(0, 3)
              .map((v) =>
                Math.round(v * (v <= 1 ? 255 : 1))
                  .toString(16)
                  .padStart(2, '0'),
              )
              .join('')}`;
    } else if (fn === OPS.constructPath) {
      const [paint, , minMax] = args as [number, unknown, number[] | null];
      if (!minMax || (paint !== OPS.fill && paint !== OPS.eoFill) || fill !== '#000000') return;
      const [ax, ay] = apply(ctm, minMax[0] as number, minMax[1] as number);
      const [bx, by] = apply(ctm, minMax[2] as number, minMax[3] as number);
      black.push({
        x0: Math.min(ax, bx) * MM_PER_PT,
        x1: Math.max(ax, bx) * MM_PER_PT,
        y0: top(Math.max(ay, by)),
        y1: top(Math.min(ay, by)),
      });
    }
  });
  return { w: wPt * MM_PER_PT, h: hPt * MM_PER_PT, texts, black };
}

/** The cell a point (mm from the top-left) falls in: 0-based, row by row. */
const cellAt = (x: number, y: number) =>
  Math.floor((y - CELL.top) / CELL.h) * 3 + Math.floor(x / CELL.w);

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------------------------
// Comparing the preview with the print.

const PX_PER_MM = 4;
/** How far the two screenshots may sit apart, in px at 4 px/mm (1 mm): the preview is a
 * scaled element whose screenshot box rounds to whole device pixels. */
const SLIDE = 4;

type Grey = { px: Buffer; w: number; h: number };

/** One cell of a sheet screenshot at 4 px/mm, grey, the cell's edge left
 * out (the preview draws its die cuts there), blurred by half a millimetre so a QR module
 * landing a pixel apart doesn't count as a difference; `grow` mm more on every side. */
async function cellPixels(
  png: Buffer,
  sheetWidthPx: number,
  index: number,
  grow = 0,
): Promise<Grey> {
  const k = sheetWidthPx / 210;
  const inset = 2.1 - grow;
  const col = index % 3;
  const row = Math.floor(index / 3);
  const w = Math.round((CELL.w - 2 * inset) * PX_PER_MM);
  const h = Math.round((CELL.h - 2 * inset) * PX_PER_MM);
  const px = await sharp(png)
    .extract({
      left: Math.round((col * CELL.w + inset) * k),
      top: Math.round((CELL.top + row * CELL.h + inset) * k),
      width: Math.round((CELL.w - 2 * inset) * k),
      height: Math.round((CELL.h - 2 * inset) * k),
    })
    .resize(w, h, { fit: 'fill' })
    .greyscale()
    .blur(2)
    .extractChannel(0)
    .raw()
    .toBuffer();
  return { px, w, h };
}

/** The mean absolute difference (0–1) of `a` laid over `b` (1 mm larger each way) where they
 * match best, within ±1 mm. */
function diff(a: Grey, b: Grey) {
  let best = 1;
  for (let dy = 0; dy <= 2 * SLIDE; dy++)
    for (let dx = 0; dx <= 2 * SLIDE; dx++) {
      let sum = 0;
      for (let y = 0; y < a.h; y++) {
        const ra = y * a.w;
        const rb = (y + dy) * b.w + dx;
        for (let x = 0; x < a.w; x++)
          sum += Math.abs((a.px[ra + x] as number) - (b.px[rb + x] as number));
      }
      best = Math.min(best, sum / (a.w * a.h) / 255);
    }
  return best;
}

// ---------------------------------------------------------------------------------------------

test('sixteen long names on A4 24: the PDF holds each whole in its 70 × 37 mm cell, QR in place, and the preview matches the print', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const { context, page } = await person(browser, 3);
  const home = await homeId(page);
  const { shelf, path: place } = await shelfWith(page, home, NAMES);
  await openBuilder(page, home, shelf, NAMES.length);
  // Nothing too long for this label.
  await expect(page.getByRole('region', { name: /too long for this label/ })).toHaveCount(0);

  // The builder's preview: the real labels.
  const preview = page.locator('[data-slot="sheet-preview"]');
  await preview.scrollIntoViewIfNeeded();
  await expect(preview.locator('[data-slot="label"]')).toHaveCount(NAMES.length);
  await page.waitForTimeout(300);
  const previewPng = await page.locator('[data-slot="preview-paper"]').screenshot();
  const previewLines = await preview
    .locator('[data-slot="label"]')
    .evaluateAll((els) => els.map((e) => e.textContent));

  const posts: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/v1/labels/batches')
      posts.push(r.postDataJSON()?.dryRun ? 'dry run' : 'create');
  });
  await page.getByRole('button', { name: `Print ${NAMES.length} labels` }).click();
  const sheet = page.getByRole('region', { name: 'Sheet 1 of 1' });
  await expect(sheet).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __prints: number }).__prints))
    .toBeGreaterThan(0);
  // One create, and no second dry run behind it.
  await page.waitForTimeout(1000);
  expect(posts).toEqual(['create']);
  // The print is the preview: the same text, label by label.
  expect(
    await sheet.locator('[data-slot="label"]').evaluateAll((els) => els.map((e) => e.textContent)),
  ).toEqual(previewLines);
  // The page rule: the paper by name, no margin, so the dialog's defaults are right.
  expect(
    await page.evaluate(() =>
      document.adoptedStyleSheets.flatMap((s) => Array.from(s.cssRules, (r) => r.cssText)),
    ),
  ).toContainEqual(expect.stringMatching(/@page\s*\{\s*size: A4;\s*margin: 0(px)?;\s*\}/i));

  // Close "Printed OK?" without answering, so the sheet prints as it was when the dialog opened.
  const ask = page.getByRole('dialog', { name: 'Printed OK?' });
  await ask.getByRole('button', { name: 'No, print again' }).click();
  await expect(ask).toBeHidden();
  await page.evaluate(() => document.fonts.ready);
  const pdf = await page.pdf({ preferCSSPageSize: true });
  test.info().attachments.push({ name: 'labels.pdf', contentType: 'application/pdf', body: pdf });

  const read = await readPdf(pdf);
  // The batch's labels in print order (the server orders "unprinted" by place, then name).
  const id = new URL(page.url()).pathname.split('/').pop() as string;
  const printed = (
    (await (await page.request.get(`/api/v1/labels/batches/${id}`)).json()) as {
      labels: { name: string }[];
    }
  ).labels;
  expect(printed.map((l) => l.name).sort()).toEqual([...NAMES].sort());
  // A4, one page.
  expect(Math.abs(read.w - 210)).toBeLessThan(0.5);
  expect(Math.abs(read.h - 297)).toBeLessThan(0.5);

  // Each QR where its label puts it: cell i, QR `PAD` in from the cell's left, centred in height.
  const qrs = read.black.filter((b) => b.x1 - b.x0 > 15 && b.y1 - b.y0 > 15);
  expect(qrs).toHaveLength(NAMES.length);
  qrs.sort((a, b) => cellAt(a.x0, a.y0) - cellAt(b.x0, b.y0));
  qrs.forEach((q, i) => {
    const cx = (i % 3) * CELL.w;
    const cy = CELL.top + Math.floor(i / 3) * CELL.h;
    expect(cellAt((q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2), `QR ${i + 1}'s cell`).toBe(i);
    // Inside the cell, and inside the QR's own square (its modules sit within the quiet zone).
    expect(q.x0).toBeGreaterThanOrEqual(cx + PAD - 0.5);
    expect(q.x1).toBeLessThanOrEqual(cx + PAD + QR + 0.5);
    expect(q.y0).toBeGreaterThanOrEqual(cy + (CELL.h - QR) / 2 - 0.5);
    expect(q.y1).toBeLessThanOrEqual(cy + (CELL.h + QR) / 2 + 0.5);
    expect(q.x1).toBeLessThanOrEqual(cx + CELL.w);
    expect(q.y1).toBeLessThanOrEqual(cy + CELL.h);
  });

  // Every name and place whole, in its own cell, beside its QR.
  const byCell = new Map<number, Text[]>();
  for (const t of read.texts) {
    const c = cellAt(t.x, t.y - 0.5);
    byCell.set(c, [...(byCell.get(c) ?? []), t]);
  }
  printed.forEach((thing, i) => {
    const items = byCell.get(i) ?? [];
    const cx = (i % 3) * CELL.w;
    const cy = CELL.top + Math.floor(i / 3) * CELL.h;
    for (const t of items) {
      expect(t.x, `${t.str}: right of the QR`).toBeGreaterThanOrEqual(cx + PAD + QR - 0.5);
      expect(t.x).toBeLessThan(cx + CELL.w);
      expect(t.y).toBeGreaterThan(cy);
      expect(t.y).toBeLessThanOrEqual(cy + CELL.h + 0.5);
    }
    const text = squash(items.map((t) => t.str).join(' '));
    // A word broken across lines comes back with a space in it: compare without spaces too.
    const flat = text.replace(/\s/g, '');
    expect(flat, `cell ${i + 1}`).toContain(thing.name.replace(/\s/g, ''));
    expect(flat, `cell ${i + 1}'s place`).toContain(place.replace(/\s/g, ''));
    expect(text).not.toMatch(/…/);
  });

  // The preview and the print at the same scale, cell by cell.
  // The sheet as it prints: print media (no bar, no app chrome, zoom 1).
  await page.emulateMedia({ media: 'print' });
  const printPng = await sheet.screenshot();
  await page.emulateMedia({ media: null });
  for (const [name, body] of [
    ['preview.png', previewPng],
    ['print.png', printPng],
  ] as const)
    writeFileSync(test.info().outputPath(name), body);
  const pw = (await sharp(previewPng).metadata()).width as number;
  const sw = (await sharp(printPng).metadata()).width as number;
  const same: number[] = [];
  const other: number[] = [];
  for (let i = 0; i < NAMES.length; i++) {
    const a = await cellPixels(previewPng, pw, i);
    same.push(diff(a, await cellPixels(printPng, sw, i, SLIDE / PX_PER_MM)));
    other.push(diff(a, await cellPixels(printPng, sw, (i + 1) % NAMES.length, SLIDE / PX_PER_MM)));
  }
  const worst = Math.max(...same);
  const closestOther = Math.min(...other);
  test.info().annotations.push({
    type: 'visual diff',
    description: `same label: worst ${worst.toFixed(4)}; a different label: least ${closestOther.toFixed(4)}`,
  });
  // Measured: the same label 0.02–0.025, a different label 0.05 and up.
  expect(worst).toBeLessThan(0.035);
  expect(worst).toBeLessThan(closestOther * 0.6);
  await context.close();
});

test('"Printed OK?" confirms the batch just printed, and printing the same unprinted things again offers that sheet', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const { context, page } = await person(browser);
  const home = await homeId(page);
  const names = ['Ring light with phone clamp', 'Folding tripod, aluminium', 'Lens cloth'];
  const { shelf } = await shelfWith(page, home, names);
  // An older sheet nobody confirmed: a blank one.
  const older = (await send(page, '/api/v1/labels/batches', {
    locationId: home,
    kind: 'blank',
    blankCount: 3,
    stock: 'a4_24_70x37',
  })) as { batch: { id: string } };

  await openBuilder(page, home, shelf, names.length);
  await expect(page.getByRole('region', { name: /already on a sheet/ })).toHaveCount(0);
  await page.getByRole('button', { name: `Print ${names.length} labels` }).click();
  await expect(page.getByRole('region', { name: 'Sheet 1 of 1' })).toBeVisible();
  const id = new URL(page.url()).pathname.split('/').pop() as string;
  const ask = page.getByRole('dialog', { name: 'Printed OK?' });
  await expect(ask).toContainText('3 labels:');
  await expect(ask).toContainText('Ring light with phone clamp');
  await ask.getByRole('button', { name: 'No, print again' }).click();
  await expect(ask).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/labels/${id}$`));

  // Not confirmed: "Label everything unprinted" there again offers the sheet already made.
  await openBuilder(page, home, shelf, names.length);
  const offer = page.getByRole('region', {
    name: 'These labels are already on a sheet that isn’t confirmed printed',
  });
  await expect(offer).toBeVisible();
  await offer.getByRole('link', { name: 'Open that sheet' }).click();
  await expect(page).toHaveURL(new RegExp(`/labels/${id}$`));

  // Printed from there: the question is about this batch, and yes confirms this one only.
  await page.getByRole('button', { name: 'Print', exact: true }).click();
  await expect(ask).toBeVisible();
  await expect(ask).toContainText('3 labels:');
  await ask.getByRole('button', { name: 'Yes, printed OK' }).click();
  await expect(ask).toBeHidden();
  const batch = async (b: string) =>
    (await (await page.request.get(`/api/v1/labels/batches/${b}`)).json()) as {
      printedConfirmedAt: string | null;
    };
  await expect.poll(async () => (await batch(id)).printedConfirmedAt).not.toBeNull();
  expect((await batch(older.batch.id)).printedConfirmedAt).toBeNull();
  await context.close();
});

test('"Label everything here" in a room, as places: the sheet lists the room and its never-labelled shelves, each with its own code', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const { context, page } = await person(browser);
  const home = await homeId(page);
  const tag = `${test.info().project.name} ${Date.now()}`;
  const room = await send(page, `/api/v1/locations/${home}/places`, {
    name: `Study ${tag}`,
    kindKey: 'zone',
  });
  const shelves = ['Top shelf', 'Bottom shelf'];
  for (const name of shelves) {
    await send(page, `/api/v1/locations/${home}/places`, {
      name,
      kindKey: 'zone',
      parentId: room.id,
    });
  }
  // Nothing here was ever labelled: no codes yet.
  const before = (await (await page.request.get(`/api/v1/places/${room.id}`)).json()) as {
    shortCode: string | null;
  };
  expect(before.shortCode).toBeNull();

  await page.goto(`/p/${room.id as string}`);
  await page.getByRole('button', { name: /^Label everything here/ }).click();
  await expect(page).toHaveURL(/\/labels\?/);
  const what = page.getByRole('radiogroup', { name: 'What to label' });
  await expect(what.getByRole('radio', { name: 'Things' })).toBeChecked();
  await what.getByRole('radio', { name: 'Places' }).check({ force: true });
  await expect(page).toHaveURL(/kind=places/);
  await page
    .getByRole('radiogroup', { name: 'Label stock' })
    .getByRole('radio', { name: /^A4 sheet · 24 labels/ })
    .check({ force: true });
  const list = page.getByRole('heading', { name: 'Printing 3' }).locator('xpath=..');
  for (const name of ['Bottom shelf', `Study ${tag}`, 'Top shelf']) {
    await expect(list.getByText(name, { exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Print 3 labels' }).click();
  await expect(page.getByRole('region', { name: 'Sheet 1 of 1' })).toBeVisible();
  const id = new URL(page.url()).pathname.split('/').pop() as string;
  const batch = (await (await page.request.get(`/api/v1/labels/batches/${id}`)).json()) as {
    kind: string;
    labels: { code: string; kind: string; name?: string }[];
  };
  expect(batch.kind).toBe('places');
  expect(batch.labels.map((l) => l.name).sort()).toEqual(
    ['Bottom shelf', `Study ${tag}`, 'Top shelf'].sort(),
  );
  expect(new Set(batch.labels.map((l) => l.code)).size).toBe(3);
  // The room's page now shows its code: the one on the sheet.
  const after = (await (await page.request.get(`/api/v1/places/${room.id}`)).json()) as {
    shortCode: string | null;
  };
  expect(batch.labels.find((l) => l.name === `Study ${tag}`)?.code).toBe(after.shortCode);
  await context.close();
});

test('12 mm tape (#303): one 50 × 12 mm page a label, the code and the name, no QR, and the preview is the print', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const { context, page } = await person(browser, 3);
  const home = await homeId(page);
  const names = ['Spare keys', 'Bike lock key'];
  const { shelf } = await shelfWith(page, home, names);
  await page.goto(`/labels?loc=${home}&unprinted=1&place=${shelf}`);
  const stocks = page.getByRole('radiogroup', { name: 'Label stock' });
  // The card itself, as a finger taps it (the radio inside is visually hidden).
  await stocks.getByText('12 mm tape', { exact: true }).click();
  await expect(stocks.getByRole('radio', { name: /^12 mm tape/ })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Print 2 labels' })).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
  // The builder's preview: the first label, at its printed proportions, no QR.
  const preview = page.locator('div[data-slot="label"]');
  await expect(preview).toHaveCount(1);
  await expect(preview.locator('[data-slot="label-qr"]')).toHaveCount(0);
  const previewText = await preview.textContent();

  await page.getByRole('button', { name: 'Print 2 labels' }).click();
  await expect(page.getByRole('region', { name: 'Sheet 1 of 2' })).toBeVisible();
  const ask = page.getByRole('dialog', { name: 'Printed OK?' });
  await ask.getByRole('button', { name: 'No, print again' }).click();
  await expect(ask).toBeHidden();
  const printed = page.locator('section[data-slot="sheet"] div[data-slot="label"]');
  await expect(printed).toHaveCount(2);
  // The print's first label is the preview's.
  expect(await printed.first().textContent()).toBe(previewText);
  expect(
    await page.evaluate(() =>
      document.adoptedStyleSheets.flatMap((s) => Array.from(s.cssRules, (r) => r.cssText)),
    ),
  ).toContainEqual(expect.stringMatching(/@page\s*\{\s*size: 50mm 12mm;\s*margin: 0(px)?;\s*\}/i));

  // Each label prints on a page of its own at the label's size, its code as text, no QR.
  await page.evaluate(() => document.fonts.ready);
  const pdf = await page.pdf({ preferCSSPageSize: true });
  test.info().attachments.push({ name: 'tape.pdf', contentType: 'application/pdf', body: pdf });
  const doc = await getDocument({ data: new Uint8Array(pdf), useSystemFonts: false }).promise;
  expect(doc.numPages).toBe(2);
  const id = new URL(page.url()).pathname.split('/').pop() as string;
  const batch = (await (await page.request.get(`/api/v1/labels/batches/${id}`)).json()) as {
    stock: string;
    labels: { code: string; name: string }[];
  };
  expect(batch.stock).toBe('tape_12');
  for (let p = 1; p <= 2; p++) {
    const one = await doc.getPage(p);
    const [, , wPt, hPt] = one.view as [number, number, number, number];
    expect(Math.abs(wPt * MM_PER_PT - 50)).toBeLessThan(0.5);
    expect(Math.abs(hPt * MM_PER_PT - 12)).toBeLessThan(0.5);
    const text = squash(
      (await one.getTextContent()).items.map((i) => ('str' in i ? i.str : '')).join(' '),
    );
    const label = batch.labels[p - 1] as { code: string; name: string };
    expect(text.replace(/\s/g, '')).toContain(label.code.slice(0, 3));
    expect(text.replace(/\s/g, '')).toContain(label.code.slice(3));
    expect(text).toContain(label.name);
  }
  await context.close();
});
