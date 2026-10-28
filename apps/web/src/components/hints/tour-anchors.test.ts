// @vitest-environment node
/**
 * Every chapter's anchors are on their screens. Each step names the route it opens and the
 * `data-tour` it points at; this reads the route's file (TanStack's file routes: `/loc/$id` is
 * routes/_app/loc.$id.tsx, `/settings` is settings.index.tsx, a stop that stays put is the app
 * shell's layout route) and the modules it imports, static and `import()`ed alike (the map and a
 * vehicle's tabs load on demand), several levels deep, and fails when the anchor isn't written
 * there. A moved or renamed element fails CI instead of the tour. The e2e spec
 * (e2e/tour.spec.ts) walks the real thing.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { stopFor, TOURS, type TourLayout } from './tours';

const SRC = fileURLToPath(new URL('../../', import.meta.url));
const ROUTES = path.join(SRC, 'routes');

/** The file behind a route path, by TanStack Router's file naming under the `_app` layout. */
function routeFile(to: string | null): string {
  if (to === null) return path.join(ROUTES, '_app.tsx');
  const name = to.split('/').filter(Boolean).join('.') || 'index';
  for (const file of [`${name}.tsx`, `${name}.index.tsx`]) {
    const full = path.join(ROUTES, '_app', file);
    if (existsSync(full)) return full;
  }
  throw new Error(`no route file for ${to}`);
}

/** A module specifier in the app, as a file: `@/x` is src/x; relative ones from `from`. */
function resolveImport(spec: string, from: string): string | null {
  const base = spec.startsWith('@/')
    ? path.join(SRC, spec.slice(2))
    : spec.startsWith('.')
      ? path.resolve(path.dirname(from), spec)
      : null;
  if (!base) return null;
  for (const file of [base, `${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx')]) {
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

const IMPORT = /(?:(?:import|export)\s[^;]*?from\s+|import\(\s*)['"]([^'"]+)['"]/g;

/** The route's file and what it imports from the app, `depth` levels deep. */
function screenSources(entry: string, depth = 6): Map<string, string> {
  const seen = new Map<string, string>();
  let frontier = [entry];
  for (let level = 0; level <= depth && frontier.length > 0; level++) {
    const next: string[] = [];
    for (const file of frontier) {
      if (seen.has(file)) continue;
      const text = readFileSync(file, 'utf8');
      seen.set(file, text);
      for (const m of text.matchAll(IMPORT)) {
        const target = m[1] ? resolveImport(m[1], file) : null;
        if (target && !seen.has(target)) next.push(target);
      }
    }
    frontier = next;
  }
  return seen;
}

const written = (anchor: string) => `data-tour="${anchor}"`;

/** Every stop a tour can make, on both layouts. */
const STOPS = (['phone', 'wide', 'sheet'] as TourLayout[]).flatMap((layout) =>
  TOURS.flatMap((tour) =>
    tour.steps.map((step) => ({
      layout,
      id: `${tour.id}.${step.id}`,
      stop: stopFor(step, layout),
    })),
  ),
);

describe('the tours’ anchors', () => {
  for (const { layout, id, stop } of STOPS) {
    it(`${id} (${layout}): ${stop.anchors.join(' or ')} on ${stop.to ?? 'the shell'}`, () => {
      const sources = screenSources(routeFile(stop.to));
      // The first anchor is the one meant; later ones are fallbacks, also on that screen.
      for (const anchor of stop.anchors) {
        const where = [...sources].filter(([, text]) => text.includes(written(anchor)));
        expect(where.length, `${written(anchor)} under ${stop.to ?? 'the shell'}`).toBeGreaterThan(
          0,
        );
      }
    });
  }

  it('never sends a step to Scan, where the camera starts', () => {
    // A scan session opens on its setup, with no camera: its tour may stand there.
    for (const { stop } of STOPS) expect(stop.to ?? '').not.toMatch(/^\/scan(?:$|[/?])/);
  });

  it('leaves no anchor in the app that no tour uses', () => {
    const used = new Set(STOPS.flatMap((s) => s.stop.anchors));
    const found = new Set<string>();
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
          for (const m of readFileSync(full, 'utf8').matchAll(/data-tour="([a-z0-9-]+)"/g))
            if (m[1]) found.add(m[1]);
        }
      }
    };
    walk(SRC);
    expect([...found].filter((a) => !used.has(a)).sort()).toEqual([]);
    expect([...used].filter((a) => !found.has(a)).sort()).toEqual([]);
  });
});
