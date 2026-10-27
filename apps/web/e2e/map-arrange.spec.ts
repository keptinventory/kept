/**
 * Moving a room in the map's Arrange (#301), against the real server, on its own seeded `map`
 * instance (e2e/instances.ts). Each project makes a location of its own with three rooms side by
 * side, opens its map (WebGL runs in Chromium here, not jsdom), and in the plan view:
 *
 * 1. moves the Hall by its floor away from the others: on the phone a quick drag on a room pans
 *    (nothing moves), and a finger held on the Hall picks it up (real touch events); on the
 *    desktop the Hall is selected, then dragged with the mouse. Done saves it a whole number of
 *    metres behind the others, over nothing;
 * 2. moves it a metre left with the arrow key, which says so; Done saves it, Undo puts it back;
 * 3. moves it again and Cancels: asked first, nothing saved.
 *
 * No real device is touched: getUserMedia and getDisplayMedia reject, SpeechRecognition is gone
 * and geolocation refuses, before any page script. No permission is granted.
 *
 *   KEPT_E2E_INSTANCES=map pnpm --filter @kept/web exec playwright test map-arrange.spec.ts
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { type BrowserContext, expect, type Locator, type Page, test } from '@playwright/test';
import { INSTANCES, stateDirOf, urlOf } from './instances';

const MAP = INSTANCES.map;
const BASE = urlOf(MAP);
const PASSWORD = 'kept-seed-password';
const SLOW = 60_000;

test.use({ baseURL: BASE });

function stubDevices() {
  const deny = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
  const media = {
    getUserMedia: deny,
    getDisplayMedia: deny,
    enumerateDevices: () => Promise.resolve([]),
    getSupportedConstraints: () => ({}),
    addEventListener() {},
    removeEventListener() {},
    ondevicechange: null,
  };
  Object.defineProperty(Navigator.prototype, 'mediaDevices', {
    configurable: true,
    get: () => media,
  });
  const w = window as unknown as Record<string, unknown>;
  for (const name of ['SpeechRecognition', 'webkitSpeechRecognition']) {
    delete w[name];
    Object.defineProperty(window, name, { configurable: true, writable: true, value: undefined });
  }
  const geo = {
    getCurrentPosition: (_ok: unknown, err?: (e: { code: number; message: string }) => void) =>
      err?.({ code: 1, message: 'denied' }),
    watchPosition: (_ok: unknown, err?: (e: { code: number; message: string }) => void) => {
      err?.({ code: 1, message: 'denied' });
      return 0;
    },
    clearWatch() {},
  };
  Object.defineProperty(Navigator.prototype, 'geolocation', { configurable: true, get: () => geo });
}

/** Signed in as the owner. Sign-in is limited to 5 a minute: the first one keeps its cookie. */
async function signIn(page: Page) {
  const context = page.context();
  await context.addInitScript(stubDevices);
  const file = path.join(stateDirOf(MAP), 'sessions', 'ibrahim.json');
  if (existsSync(file)) {
    const state = JSON.parse(readFileSync(file, 'utf8')) as {
      cookies: Parameters<BrowserContext['addCookies']>[0];
    };
    await context.addCookies(state.cookies);
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    return;
  }
  await page.goto('/signin');
  await page.getByLabel('Email or username', { exact: true }).fill('ibrahim@kept.test');
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  mkdirSync(path.dirname(file), { recursive: true });
  await context.storageState({ path: file });
}

type RoomLayout = { x: number; z: number; w: number; d: number };
type MapJson = {
  version: string | null;
  rooms: { id: string; name: string; layout: RoomLayout | null }[];
};

async function mapOf(page: Page, id: string): Promise<MapJson> {
  const res = await page.request.get(`/api/v1/locations/${id}/map`);
  expect(res.ok(), await res.text()).toBe(true);
  return (await res.json()) as MapJson;
}

function roomsOf(m: MapJson): Record<string, RoomLayout> {
  const out: Record<string, RoomLayout> = {};
  for (const r of m.rooms) {
    if (!r.layout) throw new Error(`${r.name} has no layout`);
    out[r.name] = r.layout;
  }
  return out;
}

const overlap = (a: RoomLayout, b: RoomLayout) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.z < b.z + b.d && a.z + a.d > b.z;

/**
 * A point on a room's floor, in the page: just in front of where the map writes its name (the
 * middle of its back edge in the plan view). The name itself may be hidden under the controls,
 * so it is read from where the label is put, not from the label's box.
 */
async function floorOf(stage: Locator, room: string): Promise<{ x: number; y: number }> {
  const label = stage.locator('.map-label').filter({ hasText: new RegExp(`^${room}$`) });
  await expect(label).toHaveCount(1);
  return label.evaluate((el) => {
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec((el as HTMLElement).style.transform);
    const box = el.parentElement?.getBoundingClientRect();
    if (!m || !box) throw new Error('a placed label');
    return { x: box.left + Number(m[1]), y: box.top + Number(m[2]) + 16 };
  });
}

type Point = { x: number; y: number };

/** One finger (real touch events, through the DevTools protocol): down, held `hold` ms, moved
 * by `by` in steps, up. */
async function touchDrag(page: Page, from: Point, by: Point, hold = 0) {
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
    });
  await touch('touchStart', from.x, from.y);
  if (hold) await page.waitForTimeout(hold);
  const steps = 12;
  for (let i = 1; i <= steps; i++)
    await touch('touchMove', from.x + (by.x * i) / steps, from.y + (by.y * i) / steps);
  await touch('touchEnd', from.x + by.x, from.y + by.y);
  await cdp.detach();
}

async function mouseDrag(page: Page, from: Point, by: Point) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + by.x, from.y + by.y, { steps: 12 });
  await page.mouse.up();
}

test('moves a room in Arrange: by its floor and the arrow keys, saved, undone, cancelled', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const phone = test.info().project.name === 'phone';
  await signIn(page);
  const name = `Map rooms ${test.info().project.name}`;
  const made = await page.evaluate(async (n) => {
    const res = await fetch('/api/v1/locations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        name: n,
        kind: 'home',
        rooms: ['Hall', 'Kitchen', 'Study'],
        preset: 'essentials',
        timezone: 'Africa/Cairo',
        currency: 'EGP',
      }),
    });
    return { status: res.status, body: (await res.json()) as { id: string } };
  }, name);
  expect(made.status, JSON.stringify(made.body)).toBe(201);
  const id = made.body.id;
  try {
    // Nothing downloaded: the drawn shapes are enough here.
    await page.addInitScript(() => localStorage.setItem('kept.map.quality', 'simple'));
    await page.goto(`/loc/${id}?view=map`);
    const stage = page.getByRole('region', { name: `Map of ${name}` });
    await expect(stage.locator('.map-label', { hasText: 'Kitchen' })).toHaveCount(1, {
      timeout: SLOW,
    });
    await stage.getByRole('button', { name: 'Arrange', exact: true }).click();
    await stage.getByRole('button', { name: 'Plan', exact: true }).click();
    await expect(stage.getByText(/To move a room, hold its floor, then drag/)).toBeVisible();
    const places = page.getByRole('region', { name: 'Places on this level' });
    const pick = async (room: string) => {
      await places.getByRole('button', { name: room, exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(stage.getByRole('heading', { name: room })).toBeVisible();
      // Showing it scrolls the map into view, smoothly.
      await page.waitForTimeout(800);
    };
    await page.waitForTimeout(800);
    const stageBox = await stage.boundingBox();
    const up = Math.round(Math.min(160, (stageBox?.height ?? 600) / 4));

    // 1. The Hall, by its floor, up the screen: behind the others.
    if (phone) {
      // A quick drag on a room moves the view, not the room.
      await touchDrag(page, await floorOf(stage, 'Study'), { x: 0, y: 20 });
      await page.waitForTimeout(300);
      await touchDrag(page, await floorOf(stage, 'Hall'), { x: 0, y: -up }, 600);
    } else {
      await pick('Hall');
      await mouseDrag(page, await floorOf(stage, 'Hall'), { x: 0, y: -up });
    }
    await expect(stage.getByRole('heading', { name: 'Hall' })).toBeVisible();
    await stage.getByRole('button', { name: 'Done', exact: true }).click();
    const arranged = page.getByRole('alertdialog', { name: 'Map arranged' });
    await expect(arranged).toBeVisible();
    // Out of the way, so the next session's Undo is the only one.
    await arranged.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(arranged).toHaveCount(0);
    const first = roomsOf(await mapOf(page, id));
    const { Hall: hall, Kitchen: kitchen, Study: study } = first;
    if (!hall || !kitchen || !study) throw new Error('three rooms');
    // A whole number of metres behind the others, which stayed in their row, over nothing.
    expect(kitchen.z - hall.z).toBeGreaterThanOrEqual(100);
    expect((kitchen.z - hall.z) % 100).toBe(0);
    expect(study.z).toBe(kitchen.z);
    expect(overlap(hall, kitchen) || overlap(hall, study)).toBe(false);

    // 2. The arrow keys: a metre left, said for screen readers; Done saves it, Undo puts it back.
    const gap = (r: Record<string, RoomLayout>) => (r.Kitchen?.x ?? 0) - (r.Hall?.x ?? 0);
    await stage.getByRole('button', { name: 'Arrange', exact: true }).click();
    await pick('Hall');
    await places.getByRole('button', { name: 'Hall', exact: true }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(stage.getByRole('status')).toHaveText(/Moved\W+Hall\W+left\./);
    await stage.getByRole('button', { name: 'Done', exact: true }).click();
    await expect.poll(async () => gap(roomsOf(await mapOf(page, id)))).toBe(gap(first) + 100);
    await arranged.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(async () => gap(roomsOf(await mapOf(page, id)))).toBe(gap(first));

    // 3. Moved again, then Cancel: asked first, and nothing saved.
    const before = await mapOf(page, id);
    await stage.getByRole('button', { name: 'Arrange', exact: true }).click();
    await pick('Hall');
    await places.getByRole('button', { name: 'Hall', exact: true }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(stage.getByRole('status')).toHaveText(/Moved\W+Hall\W+left\./);
    // On a phone the room's card lies over the second row of Arrange's tools, Cancel among them.
    await stage.getByRole('button', { name: 'Close', exact: true }).click();
    await stage.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Throw away', exact: true }).click();
    await expect(stage.getByRole('button', { name: 'Arrange', exact: true })).toBeVisible();
    expect(await mapOf(page, id)).toEqual(before);
  } finally {
    await page.evaluate(
      (lid) =>
        fetch(`/api/v1/locations/${lid}`, {
          method: 'DELETE',
          headers: { accept: 'application/json' },
        }),
      id,
    );
  }
});
