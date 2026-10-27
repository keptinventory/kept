#!/usr/bin/env node
// The README's desktop tour: a short recording of the web app from its demo build (the in-memory
// mock API, `?demo=owner`), so it follows the app when its look changes:
//
//   docs/assets/kept-tour.webp   an animated WebP the README plays straight from the repository
//   <out>/kept-tour.mp4          the same tour as H.264, to upload as a GitHub attachment instead
//   <out>/frames/<n>-<step>.png  one frame per step, to look at without playing the video
//
// `<out>` is `.tmp/tour/` (git-ignored); `--out <dir>` changes it.
//
// The story, at 1280×800: Home, Home's things as a list (the type line under each name, a box's
// count, the label tape only on printed labels), the 3D map on the ground floor and a room's card,
// the graph in 2D (pick a room, go in, back up) and in 3D (it turns; upstairs forward, then the
// ground floor and a room on it), a thing's card and its page, then a search for "cable". The
// showcase's Home is on two floors (apps/web/src/api/mock/showcase.ts). A drawn pointer moves
// between the steps and rings on each click; the map's start-up is cut (see the map step).
//
// Dev only, like scripts/capture-screens.mjs, and set up the same way: it builds the demo bundle
// (`pnpm --filter @kept/web build:demo`; `--skip-build` reuses apps/web/dist-demo), serves it on a
// free local port, and opens it at https://kept.test in headless Chromium from apps/web's
// @playwright/test, with the date fixed. Motion is left on (the 3D graph turns by itself), unlike
// the still screenshots. No camera or microphone is ever opened: getUserMedia is replaced with one
// that always refuses, and the tour never reaches the capture screen.
//
// Frames come from Playwright's screencast (a JPEG each time the page paints, with its time), so
// the video keeps the real pacing; ffmpeg (on PATH, or FFMPEG=<path>) joins them.
//
//   node scripts/record-tour.mjs [--skip-build] [--out <dir>]
import { spawnSync } from 'node:child_process';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const web = createRequire(`${root}apps/web/package.json`);
const { chromium } = web('@playwright/test');

const args = process.argv.slice(2);
const outArg = args.indexOf('--out');
const out = resolve(root, outArg >= 0 ? args[outArg + 1] : '.tmp/tour');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const dist = `${root}apps/web/dist-demo/`;
const WEBP = 'docs/assets/kept-tour.webp';
const SIZE = { width: 1280, height: 800 };
/** The animated WebP: narrower and fewer frames than the MP4, to stay a few MB. */
const WEBP_WIDTH = 1024;
const WEBP_FPS = 15;
const MP4_FPS = 30;
/** Ibrahim's Home in the mock fixtures (apps/web/src/api/mock/fixtures.ts). */
const HOME = '01926f00-0000-7000-8000-00000000b002';
/** The same moment, zone and address as scripts/capture-screens.mjs. */
const SHOT_TIME = new Date('2026-10-27T09:00:00Z');
const SHOT_ZONE = 'Africa/Cairo';
const SHOT_ORIGIN = 'https://kept.test';

if (spawnSync(FFMPEG, ['-version'], { stdio: 'ignore' }).status !== 0) {
  console.error(`ffmpeg not found: install it, or set FFMPEG to its path`);
  process.exit(1);
}
if (!args.includes('--skip-build')) {
  const r = spawnSync('pnpm', ['--filter', '@kept/web', 'build:demo'], {
    cwd: root,
    stdio: 'inherit',
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
if (!existsSync(`${dist}index.html`)) {
  console.error('apps/web/dist-demo is missing: run without --skip-build');
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

/** The demo build as a single-page app: a file if there is one, otherwise index.html. */
const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  let file = join(dist, decodeURIComponent(pathname));
  if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory())
    file = `${dist}index.html`;
  res.setHeader('content-type', TYPES[extname(file)] ?? 'application/octet-stream');
  createReadStream(file).pipe(res);
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;

/** Runs in every page before the app: no camera or microphone, real or fake. */
function noCamera() {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: async () => {
        throw new DOMException('No camera in the tour', 'NotAllowedError');
      },
      enumerateDevices: async () => [],
      addEventListener() {},
      removeEventListener() {},
    },
  });
}

/**
 * Runs in every page before the app: a drawn arrow that follows the mouse, and a grey ring that
 * spreads where it clicks (headless Chromium paints no cursor of its own).
 */
function drawPointer() {
  const add = () => {
    if (document.getElementById('tour-pointer')) return;
    const style = document.createElement('style');
    style.textContent = `
#tour-pointer{position:fixed;inset:0 auto auto 0;z-index:2147483647;pointer-events:none;
  inline-size:24px;block-size:24px;transform:translate(-100px,-100px);
  filter:drop-shadow(0 1px 2px rgb(0 0 0 / 35%))}
.tour-ring{position:fixed;z-index:2147483646;pointer-events:none;inline-size:36px;block-size:36px;
  margin:-18px 0 0 -18px;border-radius:50%;background:rgb(120 120 120 / 45%);
  animation:tour-ring .5s ease-out forwards}
@keyframes tour-ring{from{transform:scale(.3);opacity:1}to{transform:scale(1.3);opacity:0}}`;
    document.head.append(style);
    const pointer = document.createElement('div');
    pointer.id = 'tour-pointer';
    pointer.innerHTML =
      '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M3 2l15 11.2-6.6.9 3.9 7.4-2.9 1.5-3.9-7.5L3 20z" fill="#1E1C19" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    document.body.append(pointer);
    addEventListener(
      'mousemove',
      (e) => {
        pointer.style.transform = `translate(${e.clientX - 3}px, ${e.clientY - 2}px)`;
      },
      true,
    );
    addEventListener(
      'mousedown',
      (e) => {
        const ring = document.createElement('div');
        ring.className = 'tour-ring';
        ring.style.left = `${e.clientX}px`;
        ring.style.top = `${e.clientY}px`;
        document.body.append(ring);
        setTimeout(() => ring.remove(), 600);
      },
      true,
    );
  };
  if (document.body) add();
  else addEventListener('DOMContentLoaded', add);
}

const browser = await chromium.launch({
  headless: true,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const frames = join(out, 'frames');
const raw = join(out, 'raw');
rmSync(raw, { recursive: true, force: true });
rmSync(frames, { recursive: true, force: true });
mkdirSync(raw, { recursive: true });
mkdirSync(frames, { recursive: true });

/** Each screencast frame: its file and when it was painted (ms). */
const shots = [];
/** Each step of the story: its name and when it began (ms). */
const steps = [];
/** Stretches left out of the video (ms): from a click until what it opens has painted. */
const cuts = [];

const ctx = await browser.newContext({
  viewport: SIZE,
  deviceScaleFactor: 1,
  colorScheme: 'light',
  serviceWorkers: 'block',
  locale: 'en-US',
  timezoneId: SHOT_ZONE,
});
try {
  await ctx.clock.setFixedTime(SHOT_TIME);
  await ctx.route(`${SHOT_ORIGIN}/**`, async (route) => {
    const { pathname, search } = new URL(route.request().url());
    await route.fulfill({ response: await route.fetch({ url: `${origin}${pathname}${search}` }) });
  });
  await ctx.addInitScript(noCamera);
  await ctx.addInitScript(drawPointer);
  const page = await ctx.newPage();
  // A step that can't find its element fails the run instead of waiting for ever.
  page.setDefaultTimeout(20_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  const wait = (ms) => page.waitForTimeout(ms);
  const pos = { x: 640, y: 420 };
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  /** Glides the pointer to (x, y) over `ms`, as a hand would. */
  async function glide(x, y, ms = 650) {
    const from = { ...pos };
    // Paced by the clock, not by the moves: a busy machine sends fewer, not slower.
    const start = Date.now();
    for (;;) {
      const k = ease(Math.min(1, (Date.now() - start) / ms));
      await page.mouse.move(from.x + (x - from.x) * k, from.y + (y - from.y) * k);
      if (k >= 1) break;
      await new Promise((done) => setTimeout(done, 12));
    }
    pos.x = x;
    pos.y = y;
  }
  async function center(locator) {
    await locator.waitFor({ state: 'visible' });
    const box = await locator.boundingBox();
    if (!box) throw new Error(`no box for ${locator}`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }
  /** Glides to the element, rests, clicks. */
  async function click(locator, { ms = 650, rest = 250 } = {}) {
    const c = await center(locator);
    await glide(c.x, c.y, ms);
    // Something that moves by itself (the turning 3D graph): catch up with it before clicking.
    const now = await center(locator);
    if (Math.hypot(now.x - c.x, now.y - c.y) > 2) await glide(now.x, now.y, 120);
    await wait(rest);
    const at = Date.now();
    await page.mouse.down();
    await page.mouse.up();
    return at;
  }
  async function clickAt(x, y, { ms = 650, rest = 250 } = {}) {
    await glide(x, y, ms);
    await wait(rest);
    await page.mouse.down();
    await page.mouse.up();
  }
  /** Scrolls the page to `y` over `ms`, eased. */
  async function scrollTo(y, ms = 900) {
    await page.evaluate(
      ([to, dur]) =>
        new Promise((done) => {
          const from = scrollY;
          const start = performance.now();
          const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
          const tick = (now) => {
            const k = Math.min(1, (now - start) / dur);
            scrollTo(0, from + (to - from) * ease(k));
            if (k < 1) requestAnimationFrame(tick);
            else done();
          };
          requestAnimationFrame(tick);
        }),
      [y, ms],
    );
  }
  /** A segmented control's option: its visible label, not the hidden radio inside it. */
  const option = (name) =>
    page.locator('label', { has: page.getByRole('radio', { name, exact: true }) });
  const step = (name) => {
    steps.push({ name, at: Date.now() });
    console.log(`step ${name}`);
  };
  const settle = async () => {
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
  };

  const query = 'demo=owner&showcase=1&lang=en&theme=light';
  // A first pass over the map and the 3D graph, unrecorded: their chunks, models and shaders are
  // then warm, so the tour doesn't wait seconds on a blank canvas. Then forget the layouts it
  // remembered, so Home opens as a list.
  await page.goto(`${SHOT_ORIGIN}/loc/${HOME}?view=map&${query}`);
  await page.locator('.map-label', { hasText: /^Kitchen$/ }).waitFor();
  await wait(2500);
  await page.goto(`${SHOT_ORIGIN}/loc/${HOME}?view=graph&dim=3d&${query}`);
  await page.locator('.kgraph-main').waitFor();
  await wait(1500);
  await page.evaluate(() => localStorage.clear());

  // Home, loaded and settled before the first frame is kept.
  await page.goto(`${SHOT_ORIGIN}/?${query}`);
  await settle();
  await wait(1500);
  if (await page.getByText(/0\.0\.0-dev/).count())
    throw new Error('the build says 0.0.0-dev (no release tag in reach)');
  await page.mouse.move(pos.x, pos.y);
  await page.screencast.start({
    size: SIZE,
    quality: 90,
    onFrame: ({ data, timestamp }) => {
      const file = join(raw, `${String(shots.length).padStart(5, '0')}.jpg`);
      writeFileSync(file, data);
      shots.push({ file, at: timestamp });
    },
  });

  step('home');
  await wait(1200);
  await click(page.getByRole('link', { name: /^Home Apartment/ }));
  await settle();

  step('list');
  await wait(1200);
  // Home's things: the type line under each name, a box's count, the tape on printed labels.
  const things = page.getByRole('button', { name: /^Things ·/ });
  const top = await things.evaluate((el) => el.getBoundingClientRect().top + scrollY - 76);
  await scrollTo(top, 1100);
  await glide(860, 520, 700);
  await wait(800);
  await glide(860, 640, 500);
  await wait(900);
  await scrollTo(0, 700);

  step('map');
  // Off camera from the click until the map has painted: WebGL starts in software in headless
  // Chromium, which takes a second or two with the canvas still empty. Its labels are placed after
  // its first frame, so a label showing means a painted map.
  const cut = { from: await click(option('Map')) };
  await page.locator('.map-label', { hasText: /^Kitchen$/ }).waitFor();
  await wait(400);
  cut.to = Date.now();
  cuts.push(cut);
  // A frame now, so the video resumes on the painted map.
  await page.mouse.move(pos.x + 1, pos.y);
  await wait(1300);
  const kitchen = await page.locator('.map-label', { hasText: /^Kitchen$/ }).boundingBox();
  await clickAt(kitchen.x + kitchen.width / 2 - 30, kitchen.y + kitchen.height + 55, { ms: 800 });
  await wait(2000);

  step('graph-2d');
  await click(option('Graph'));
  await page.locator('.kgraph-main button[aria-label^="Office,"]').waitFor();
  // The whole graph in view, its bars just under the top bar.
  await scrollTo(80, 600);
  await wait(1000);
  const office = page.locator('.kgraph-main button[aria-label^="Office,"]');
  await click(office);
  await wait(1200);
  // Picked again, it goes in.
  await click(office, { ms: 300 });
  await wait(1600);
  await click(page.locator('.kgraph-crumbs button', { hasText: /^Home$/ }));
  await wait(1100);

  step('graph-3d');
  await click(option('3D'));
  await glide(470, 560, 700);
  // It turns slowly until it's touched.
  await wait(2200);
  // The floor stack: upstairs forward, then the ground floor, and a room on it.
  const floor = (name) => page.locator('.kgraph-floors').getByRole('button', { name, exact: true });
  await click(floor('Upstairs'));
  await wait(1300);
  await click(floor('Ground floor'), { ms: 400 });
  await wait(1000);
  await click(page.locator('.kgraph-main button[aria-label^="Kitchen,"]'), { ms: 700 });
  await wait(1700);

  step('thing');
  // The picked room's card lists what's inside; pick a thing for its card, then open it.
  await click(page.locator('.kgraph-main button:not(.kgraph-node)', { hasText: 'AA batteries' }));
  await wait(1500);
  await click(page.locator('.kgraph-main').getByText('Open', { exact: true }));
  await page.getByRole('heading', { name: 'AA batteries', level: 1 }).waitFor();
  await wait(1800);

  step('search');
  await click(page.getByRole('button', { name: /Search or jump to/ }));
  await wait(500);
  await page.keyboard.type('cable', { delay: 140 });
  await wait(1600);
  await click(page.getByRole('option', { name: /HDMI cable/ }));
  await page.getByRole('heading', { name: /HDMI cable/, level: 1 }).waitFor();
  await wait(2000);

  step('end');
  await page.screencast.stop();
  if (errors.length) throw new Error(errors.join('; '));
} finally {
  await ctx.close();
  await browser.close();
  server.close();
}

// The frames as a variable-rate video: each one shown until the next was painted, the cuts left
// out. `vt` is a moment's time in the video (ms).
const kept = shots.filter((s) => !cuts.some((c) => s.at >= c.from && s.at < c.to));
const vt = (ms) =>
  ms - kept[0].at - cuts.reduce((sum, c) => sum + Math.max(0, Math.min(ms, c.to) - c.from), 0);
const list = kept
  .map((s, i) => {
    const next = kept[i + 1] ? vt(kept[i + 1].at) : vt(s.at) + 300;
    return `file '${s.file}'\nduration ${(next - vt(s.at)) / 1000}`;
  })
  .join('\n');
writeFileSync(join(raw, 'list.txt'), `${list}\nfile '${kept.at(-1).file}'\n`);
const ff = (...a) => {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...a], {
    stdio: 'inherit',
  });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${a.join(' ')}`);
};
const input = ['-f', 'concat', '-safe', '0', '-i', join(raw, 'list.txt')];
const mp4 = join(out, 'kept-tour.mp4');
ff(
  ...input,
  '-vf',
  `fps=${MP4_FPS},format=yuv420p`,
  '-c:v',
  'libx264',
  '-preset',
  'slow',
  '-crf',
  '24',
  '-movflags',
  '+faststart',
  mp4,
);
const tmp = `${root}${WEBP}.tmp.webp`;
ff(
  '-i',
  mp4,
  '-vf',
  // No alpha: with it, libwebp_anim leaves grey blocks where frames are blended.
  `fps=${WEBP_FPS},scale=${WEBP_WIDTH}:-2:flags=lanczos,format=yuv420p`,
  '-c:v',
  'libwebp_anim',
  '-lossless',
  '0',
  '-quality',
  '80',
  '-compression_level',
  '6',
  '-loop',
  '0',
  tmp,
);
renameSync(tmp, `${root}${WEBP}`);

// One frame per step, a moment before the next step begins.
const offset = (ms) => Math.max(0, vt(ms) / 1000);
for (const [i, s] of steps.slice(0, -1).entries()) {
  // The last step ends after the last painted frame: take that frame instead.
  const at = Math.min(offset(steps[i + 1].at), offset(kept.at(-1).at)) - 0.4;
  ff('-ss', at.toFixed(2), '-i', mp4, '-frames:v', '1', join(frames, `${i + 1}-${s.name}.png`));
}
rmSync(raw, { recursive: true, force: true });

const kb = (p) => `${(statSync(p).size / 1024 / 1024).toFixed(2)} MB`;
console.log(`\nsteps:`);
for (const s of steps) console.log(`  ${offset(s.at).toFixed(1).padStart(5)} s  ${s.name}`);
console.log(`\nwrote ${WEBP} (${kb(`${root}${WEBP}`)})`);
console.log(`wrote ${mp4} (${kb(mp4)})`);
console.log(`wrote ${frames}/`);
