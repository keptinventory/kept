#!/usr/bin/env node
// What's new in Kept's pictures and clips for one release, from the web app's demo build (the
// in-memory mock API, `?demo=owner&showcase=1`: the showcase household, invented data only), so a
// slide shows the app as it is:
//
//   apps/web/public/whats-new/<version>/<name>.mp4    a short clip, looped muted in the card
//   apps/web/public/whats-new/<version>/<name>.webm   the same clip as VP9, offered first
//   apps/web/public/whats-new/<version>/<name>.webp   its still poster (reduced motion, and while
//                                                     it loads), or a picture on its own
//   apps/web/public/whats-new/<version>/media.json    each file's size and a clip's poster, which
//                                                     the build reads (apps/web/whats-new-plugin.ts)
//
// What to record is the release's recipe, scripts/whats-new/<version>.json: per highlight, its
// file (the name its `![icon](file)` line in .tmp/notes/highlights-<version>.md gives), the page
// it opens, the steps that set it up off camera and the steps it records, and the part of the
// 1280×800 screen it keeps (`crop`, CSS pixels, 16:10). A `.webp` file is a picture: the screen
// once its steps are done. The steps (`run` below): go, click, hover, wait, waitFor, press, type,
// fill, scroll, clickAll; a target is { role, name, exact?, in? } or { text } or { css } or
// { option } (a segmented control's label), a name between slashes is a regular expression.
//
// Dev only, set up as scripts/record-tour.mjs and scripts/capture-screens.mjs are: it builds the
// demo bundle as this version (`KEPT_VERSION=<version> pnpm --filter @kept/web build:demo`;
// `--skip-build` reuses apps/web/dist-demo), serves it on a free local port and opens it at
// https://kept.test in headless Chromium from apps/web's @playwright/test, the date and zone fixed
// (SHOT_TIME), at 2×. No camera or microphone is ever opened: getUserMedia always refuses.
//
// Encoding (ffmpeg on PATH, or FFMPEG=<path>; sharp for the stills), every file 960×600:
//   clip     H.264 (High, yuv420p), 24 fps, no audio, +faststart; CRF from 22 up until it is
//            within CLIP_BUDGET (Safari and every phone play it), and the same as VP9 WebM
//            (CRF from 32 up, same budget) for Chromium builds without H.264
//   poster   WebP from the clip's last frame (or `poster: "start"`), quality from 80 down until
//            within POSTER_BUDGET
//   picture  WebP of the cropped screen, quality from 85 down until within SHOT_BUDGET
//
//   node scripts/record-whats-new.mjs --version X.Y.Z [--skip-build] [--only <name>]
import { spawnSync } from 'node:child_process';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const web = createRequire(`${root}apps/web/package.json`);
const { chromium } = web('@playwright/test');

const args = process.argv.slice(2);
const arg = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const version = arg('--version');
const only = arg('--only');
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('usage: node scripts/record-whats-new.mjs --version X.Y.Z [--skip-build]');
  process.exit(1);
}
const recipePath = `${root}scripts/whats-new/${version}.json`;
if (!existsSync(recipePath)) {
  console.error(`no recipe for ${version}: write scripts/whats-new/${version}.json`);
  process.exit(1);
}
/** @type {{ media: Array<Record<string, any>> }} */
const recipe = JSON.parse(readFileSync(recipePath, 'utf8'));

const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const dist = `${root}apps/web/dist-demo/`;
const out = `${root}apps/web/public/whats-new/${version}/`;
/** Every file's size: the card's 16:10 frame, at twice the 480 px it is shown at on a phone. */
const OUT = { width: 960, height: 600 };
const SCALE = 2;
const VIEWPORT = { width: 1280, height: 800 };
const FPS = 24;
export const CLIP_BUDGET = 400 * 1024;
export const POSTER_BUDGET = 60 * 1024;
export const SHOT_BUDGET = 120 * 1024;
/** The same moment, zone and address as scripts/capture-screens.mjs and record-tour.mjs. */
const SHOT_TIME = new Date('2026-10-27T09:00:00Z');
const SHOT_ZONE = 'Africa/Cairo';
const SHOT_ORIGIN = 'https://kept.test';
const QUERY = 'demo=owner&showcase=1&lang=en&theme=light';

if (spawnSync(FFMPEG, ['-version'], { stdio: 'ignore' }).status !== 0) {
  console.error('ffmpeg not found: install it, or set FFMPEG to its path');
  process.exit(1);
}
if (!args.includes('--skip-build')) {
  const r = spawnSync('pnpm', ['--filter', '@kept/web', 'build:demo'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, KEPT_VERSION: version },
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
  '.glb': 'model/gltf-binary',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
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
        throw new DOMException('No camera in a recording', 'NotAllowedError');
      },
      enumerateDevices: async () => [],
      addEventListener() {},
      removeEventListener() {},
    },
  });
}

/** Runs in every page: a drawn pointer and a ring where it clicks (as record-tour.mjs). */
function drawPointer() {
  const add = () => {
    if (document.getElementById('wn-pointer')) return;
    const style = document.createElement('style');
    style.textContent = `
#wn-pointer{position:fixed;inset:0 auto auto 0;z-index:2147483647;pointer-events:none;
  inline-size:26px;block-size:26px;transform:translate(-100px,-100px);
  filter:drop-shadow(0 1px 2px rgb(0 0 0 / 35%))}
.wn-ring{position:fixed;z-index:2147483646;pointer-events:none;inline-size:40px;block-size:40px;
  margin:-20px 0 0 -20px;border-radius:50%;background:rgb(120 120 120 / 45%);
  animation:wn-ring .5s ease-out forwards}
@keyframes wn-ring{from{transform:scale(.3);opacity:1}to{transform:scale(1.3);opacity:0}}`;
    document.head.append(style);
    const pointer = document.createElement('div');
    pointer.id = 'wn-pointer';
    pointer.innerHTML =
      '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M3 2l15 11.2-6.6.9 3.9 7.4-2.9 1.5-3.9-7.5L3 20z" fill="#1E1C19" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
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
        ring.className = 'wn-ring';
        ring.style.insetInlineStart = `${e.clientX}px`;
        ring.style.insetBlockStart = `${e.clientY}px`;
        document.body.append(ring);
        setTimeout(() => ring.remove(), 600);
      },
      true,
    );
  };
  if (document.body) add();
  else addEventListener('DOMContentLoaded', add);
}

const ff = (...a) => {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...a], {
    stdio: 'inherit',
  });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${a.join(' ')}`);
};
const size = (p) => statSync(p).size;
const kb = (n) => `${Math.round(n / 1024)} KB`;

/** A still as WebP within `budget`, lowering the quality as needed. */
async function webp(input, path, budget, from) {
  for (let q = from; q >= 40; q -= 5) {
    await sharp(input).resize(OUT.width, OUT.height).webp({ quality: q, effort: 6 }).toFile(path);
    if (size(path) <= budget) return q;
  }
  throw new Error(`${path} is over ${kb(budget)} even at quality 40`);
}

/** A name in a recipe: `/…/` is a regular expression. */
const nameOf = (n) =>
  typeof n === 'string' && /^\/.*\/$/.test(n) ? new RegExp(n.slice(1, -1)) : n;

const browser = await chromium.launch({ headless: true });
const index = existsSync(`${out}media.json`)
  ? JSON.parse(readFileSync(`${out}media.json`, 'utf8'))
  : {};
mkdirSync(out, { recursive: true });
const work = join(tmpdir(), `kept-whats-new-${process.pid}`);
/** media.json after each file, so a run that stops part-way keeps what it made. */
function saveIndex() {
  const sorted = Object.fromEntries(Object.entries(index).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(`${out}media.json`, `${JSON.stringify(sorted, null, 2)}\n`);
}
const report = [];

try {
  for (const item of recipe.media) {
    if (only && item.file !== only && !item.file.startsWith(`${only}.`)) continue;
    const clip = item.file.endsWith('.mp4');
    const crop = item.crop ?? [0, 0, VIEWPORT.width, VIEWPORT.height];
    if (Math.abs(crop[2] / crop[3] - OUT.width / OUT.height) > 0.01)
      throw new Error(`${item.file}: the crop must be 16:10, got ${crop[2]}×${crop[3]}`);
    console.log(`\n${item.file}`);

    const ctx = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: SCALE,
      colorScheme: 'light',
      serviceWorkers: 'block',
      locale: 'en-US',
      timezoneId: SHOT_ZONE,
      reducedMotion: clip ? 'no-preference' : 'reduce',
    });
    await ctx.clock.setFixedTime(SHOT_TIME);
    await ctx.route(`${SHOT_ORIGIN}/**`, async (route) => {
      const { pathname, search } = new URL(route.request().url());
      await route.fulfill({
        response: await route.fetch({ url: `${origin}${pathname}${search}` }),
      });
    });
    await ctx.addInitScript(noCamera);
    if (clip) await ctx.addInitScript(drawPointer);
    const page = await ctx.newPage();
    page.setDefaultTimeout(20_000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    const pos = { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 };
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
    async function glide(x, y, ms) {
      const from = { ...pos };
      const start = Date.now();
      for (;;) {
        const k = ease(Math.min(1, (Date.now() - start) / ms));
        await page.mouse.move(from.x + (x - from.x) * k, from.y + (y - from.y) * k);
        if (k >= 1) break;
        await new Promise((done) => setTimeout(done, 12));
      }
      Object.assign(pos, { x, y });
    }
    const target = (t) => {
      let scope = page;
      if (t.in) scope = target(t.in);
      if (t.text) return scope.getByText(nameOf(t.text), { exact: t.exact ?? true }).first();
      if (t.css) return scope.locator(t.css).first();
      if (t.option)
        return scope
          .locator('label', { has: page.getByRole('radio', { name: t.option, exact: true }) })
          .first();
      const all = scope.getByRole(t.role, { name: nameOf(t.name), exact: t.exact ?? true });
      return t.all ? all : all.nth(t.nth ?? 0);
    };
    /** One step; `live` glides the drawn pointer to what it clicks. */
    async function run(step, live) {
      if (step.go) {
        const path = step.go;
        await page.goto(`${SHOT_ORIGIN}${path}${path.includes('?') ? '&' : '?'}${QUERY}`);
        await page.waitForLoadState('networkidle');
        await page.evaluate(() => document.fonts.ready);
      } else if (step.click || step.hover) {
        const el = target(step.click ?? step.hover);
        await el.waitFor({ state: 'visible' });
        if (live) {
          await el.scrollIntoViewIfNeeded();
          const box = await el.boundingBox();
          await glide(box.x + box.width / 2, box.y + box.height / 2, step.ms ?? 600);
          await page.waitForTimeout(200);
          if (step.click) {
            await page.mouse.down();
            await page.mouse.up();
          }
        } else if (step.click) await el.click();
        else await el.hover();
      } else if (step.clickAll) {
        const all = target({ ...step.clickAll, all: true });
        for (let n = 0; n < 20 && (await all.count()) > 0; n++) await all.first().click();
      } else if (step.wait) await page.waitForTimeout(step.wait);
      else if (step.waitFor) await target(step.waitFor).waitFor({ state: 'visible' });
      else if (step.press) await page.keyboard.press(step.press);
      else if (step.type) await page.keyboard.type(step.type, { delay: live ? 110 : 0 });
      else if (step.fill) await target(step.fill).fill(step.text);
      else if (step.scroll !== undefined) {
        await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), step.scroll);
      } else if (step.glide) await glide(step.glide[0], step.glide[1], step.ms ?? 600);
      else throw new Error(`unknown step ${JSON.stringify(step)}`);
    }

    try {
      await run({ go: item.path }, false);
      if (await page.getByText(/0\.0\.0-dev/).count())
        throw new Error('the build says 0.0.0-dev: build it with KEPT_VERSION');
      for (const s of item.setup ?? []) await run(s, false);
      await page.mouse.move(pos.x, pos.y);
      await page.waitForTimeout(400);

      if (!clip) {
        for (const s of item.steps ?? []) await run(s, false);
        await page.waitForTimeout(400);
        const png = await page.screenshot({
          clip: { x: crop[0], y: crop[1], width: crop[2], height: crop[3] },
        });
        const q = await webp(png, `${out}${item.file}`, SHOT_BUDGET, 85);
        index[item.file] = OUT;
        report.push([item.file, size(`${out}${item.file}`), `WebP q${q}`]);
      } else {
        rmSync(work, { recursive: true, force: true });
        mkdirSync(work, { recursive: true });
        const shots = [];
        // Frames of the cropped part at the page's 2× pixels, as fast as Chromium paints them
        // (about 30 a second): its screencast, Playwright's or the protocol's, sends 1× frames.
        const cdp = await ctx.newCDPSession(page);
        let recording = true;
        // The protocol's clip is in page coordinates: the crop moves with the scroll.
        const scrolled = { x: 0, y: 0 };
        const track = async () =>
          Object.assign(scrolled, await page.evaluate(() => ({ x: scrollX, y: scrollY })));
        await track();
        const grab = (async () => {
          while (recording) {
            const { data } = await cdp.send('Page.captureScreenshot', {
              format: 'jpeg',
              quality: 92,
              optimizeForSpeed: true,
              clip: {
                x: crop[0] + scrolled.x,
                y: crop[1] + scrolled.y,
                width: crop[2],
                height: crop[3],
                scale: 1,
              },
            });
            const file = join(work, `${String(shots.length).padStart(5, '0')}.jpg`);
            writeFileSync(file, Buffer.from(data, 'base64'));
            shots.push({ file, at: Date.now() });
          }
        })();
        // A first frame, then the story.
        await page.mouse.move(pos.x + 1, pos.y);
        await page.waitForTimeout(item.lead ?? 600);
        for (const s of item.steps ?? []) {
          await run(s, true);
          await track();
        }
        await page.mouse.move(pos.x + 1, pos.y);
        await page.waitForTimeout(item.hold ?? 1200);
        recording = false;
        await grab;
        await cdp.detach();
        if (shots.length < 2) throw new Error('the screencast caught no frames');

        // Each frame shown until the next was taken (the real pacing), then scaled.
        const list = shots
          .map((s, i) => {
            const next = shots[i + 1]?.at ?? s.at + 300;
            return `file '${s.file}'\nduration ${Math.max(0.001, (next - s.at) / 1000)}`;
          })
          .join('\n');
        writeFileSync(join(work, 'list.txt'), `${list}\nfile '${shots.at(-1).file}'\n`);
        const mp4 = `${out}${item.file}`;
        let crf = 22;
        for (;;) {
          ff(
            ...['-f', 'concat', '-safe', '0', '-i', join(work, 'list.txt')],
            '-vf',
            `scale=${OUT.width}:${OUT.height}:flags=lanczos,fps=${FPS},format=yuv420p`,
            ...['-c:v', 'libx264', '-profile:v', 'high', '-preset', 'veryslow'],
            ...['-crf', String(crf), '-tune', 'animation', '-an', '-movflags', '+faststart'],
            mp4,
          );
          if (size(mp4) <= CLIP_BUDGET) break;
          crf += 2;
          if (crf > 40) throw new Error(`${mp4} is over ${kb(CLIP_BUDGET)} even at CRF 40`);
        }
        // The same clip as VP9 WebM, which the card offers first: Chromium builds without
        // H.264 (Playwright's, some Linux distributions') play it, and so does every current
        // browser; the MP4 stays for older iPhones.
        const webmName = item.file.replace(/\.mp4$/, '.webm');
        const webm = `${out}${webmName}`;
        let vp9 = 32;
        for (;;) {
          ff(
            ...['-i', mp4, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', String(vp9)],
            ...['-row-mt', '1', '-deadline', 'good', '-cpu-used', '1', '-an'],
            webm,
          );
          if (size(webm) <= CLIP_BUDGET) break;
          vp9 += 3;
          if (vp9 > 50) throw new Error(`${webm} is over ${kb(CLIP_BUDGET)} even at CRF 50`);
        }
        const posterName = item.file.replace(/\.mp4$/, '.webp');
        const frame = join(work, 'poster.png');
        ff(
          ...(item.poster === 'start' ? [] : ['-sseof', '-0.3']),
          '-i',
          mp4,
          '-frames:v',
          '1',
          frame,
        );
        const q = await webp(frame, `${out}${posterName}`, POSTER_BUDGET, 80);
        index[item.file] = { ...OUT, poster: posterName, webm: webmName };
        const seconds = (shots.at(-1).at - shots[0].at) / 1000;
        report.push([item.file, size(mp4), `H.264 CRF ${crf}, ${seconds.toFixed(1)} s`]);
        report.push([webmName, size(webm), `VP9 CRF ${vp9}`]);
        report.push([posterName, size(`${out}${posterName}`), `WebP q${q}`]);
      }
      if (errors.length) throw new Error(errors.join('; '));
      saveIndex();
    } finally {
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  server.close();
  rmSync(work, { recursive: true, force: true });
}

console.log(`\napps/web/public/whats-new/${version}/`);
for (const [file, bytes, how] of report)
  console.log(`  ${file.padEnd(22)} ${kb(bytes).padStart(7)}  ${how}`);
