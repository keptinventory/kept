/**
 * The floor plan evaluation (D266, spec §14.4): how well a provider reads Kept's plans, on the
 * worker's own path without the database. Each plan is re-encoded as the worker sends it
 * (extraction/image.ts, 3,072 px, no metadata), read with the plan prompt in use
 * (extraction/prompts/plan.ts) through `extract()` and `callModel` on the in-memory ports, then
 * drafted by @kept/shared's draftRooms, and scored against the plan's true rooms:
 *
 * - **found**: every true room of at least 1 m a side has a proposal of the same name;
 * - **size error**: per room, the larger of its width and depth errors (either way round);
 * - **centre error**: per room, from its floor's corner (left out for a plan sent sideways);
 * - **invented**: proposals that match no true room.
 *
 * **Pass bar before a release** (spec §14.4, the maintainer's Q9): on the set, every room found
 * and the median size error at most 30 cm. Below that the feature ships behind its review only.
 *
 *   pnpm --filter @kept/server exec tsx eval/plans.ts                  # the mock, the invented set
 *   ( set -a; . ./.env; set +a; KEPT_EVAL_API_KEY="$KEPT_DEV_GROQ_API_KEY" \
 *       pnpm --filter @kept/server exec tsx eval/plans.ts --provider groq \
 *         --model qwen/qwen3.8-27b [--dir <folder of the maintainer's own plans>] )
 *
 * The key is read from KEPT_EVAL_API_KEY only, never an argument, and never printed. A real run
 * waits at least 5 s between requests and sends at most `--max-calls` (the number of plans by
 * default). The mock answers each invented plan from its ground truth (floor-plan.fixtures.ts):
 * that run proves the harness and the pipeline, never a model.
 *
 * `--dir` adds plans the maintainer drew or owns: `<id>.png` (or .jpg) beside `<id>.truth.json`,
 * `{ "floors": ["Ground floor"], "rooms": [{ "name", "floor", "x", "z", "w", "d" }] }` in metres
 * from the floor's corner. No third-party plan is committed.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import {
  draftRooms,
  normalize,
  type PlanDraft,
  type PlanExtraction,
  PROVIDER_KINDS,
  type ProviderKind,
} from '@kept/shared';
import {
  answerFor,
  drawPlan,
  INVENTED_PLANS,
  sentSize,
  type TruthRoom,
} from '@kept/shared/floor-plan.fixtures';
import sharp from 'sharp';
import type { AiRuntime } from '../src/ai/call.js';
import { extract } from '../src/ai/extract.js';
import {
  InMemoryBudgetGate,
  InMemoryKeyStore,
  InMemoryLedger,
  InMemoryPacer,
} from '../src/ai/memory.js';
import { type MockAnswers, mockKey } from '../src/ai/mock.js';
import type { Resolved } from '../src/ai/ports.js';
import type { Reasoning } from '../src/ai/providers.js';
import { EVIDENCE_MAX_PX, reencode } from '../src/extraction/image.js';
import { PROMPT_VERSIONS, promptFor } from '../src/extraction/prompts/index.js';

/** The pass bar (spec §14.4). */
export const PASS = Object.freeze({ medianSizeErrorM: 0.3, everyRoomFound: true });

export type PlanCase = {
  id: string;
  image: Buffer;
  rooms: TruthRoom[];
  /** Sent sideways: positions are turned, so no centre error. */
  sideways: boolean;
  /** The mock's answer (the invented set only). */
  answer?: PlanExtraction;
};

export type PlanScore = {
  id: string;
  status: 'ok' | 'failed';
  reason?: string;
  scale?: string;
  found: number;
  of: number;
  missed: string[];
  invented: string[];
  sizeErrors: number[];
  centreErrors: number[];
};

const median = (xs: readonly number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return Number.NaN;
  return n % 2 ? (s[(n - 1) / 2] as number) : ((s[n / 2 - 1] as number) + (s[n / 2] as number)) / 2;
};

/** The invented plans, rendered as the server's tests render them. */
export async function inventedCases(): Promise<PlanCase[]> {
  const out: PlanCase[] = [];
  for (const p of INVENTED_PLANS) {
    const flat = await sharp(Buffer.from(drawPlan(p)))
      .png()
      .toBuffer();
    const image = p.rotate
      ? await sharp(flat).rotate(p.rotate, { background: '#ffffff' }).png().toBuffer()
      : flat;
    const size = sentSize(p);
    out.push({
      id: p.id,
      image,
      rooms: p.rooms,
      sideways: Math.abs((p.rotate ?? 0) % 180) === 90,
      answer: answerFor(p, size.w, size.h, { noise: 0.01, corners: 'poly-only' }),
    });
  }
  return out;
}

/** The maintainer's own plans from `dir`, each with its truth (see the header). */
export function folderCases(dir: string): PlanCase[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.truth\.json$/.test(f))
    .flatMap((f) => {
      const id = f.replace(/\.truth\.json$/, '');
      const img = ['png', 'jpg', 'jpeg'].map((e) => path.join(dir, `${id}.${e}`)).find(existsSync);
      if (!img) return [];
      const truth = JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as { rooms: TruthRoom[] };
      return [{ id, image: readFileSync(img), rooms: truth.rooms, sideways: false }];
    });
}

/** One plan's drafts scored against its truth. */
export function scorePlan(c: PlanCase, drafts: PlanDraft[], scale: string): PlanScore {
  const want = c.rooms.filter((r) => r.w >= 1 && r.d >= 1);
  const live = drafts.filter((d) => !d.skip);
  const byName = new Map(live.map((d) => [normalize(d.name ?? ''), d]));
  const missed: string[] = [];
  const sizeErrors: number[] = [];
  const centreErrors: number[] = [];
  const origin = new Map<number, { x: number; z: number }>();
  for (const r of c.rooms) {
    const o = origin.get(r.floor);
    origin.set(r.floor, { x: Math.min(o?.x ?? r.x, r.x), z: Math.min(o?.z ?? r.z, r.z) });
  }
  const matched = new Set<PlanDraft>();
  for (const t of want) {
    const d = byName.get(normalize(t.name));
    if (!d) {
      missed.push(t.name);
      continue;
    }
    matched.add(d);
    if (t.poly) continue; // drawn as its largest part: no size to compare
    sizeErrors.push(
      Math.min(
        Math.max(Math.abs(d.w - t.w), Math.abs(d.d - t.d)),
        Math.max(Math.abs(d.w - t.d), Math.abs(d.d - t.w)),
      ),
    );
    if (!c.sideways) {
      const o = origin.get(t.floor) ?? { x: 0, z: 0 };
      const tx = t.x - o.x + t.w / 2;
      const tz = t.z - o.z + t.d / 2;
      centreErrors.push(Math.hypot(d.x + d.w / 2 - tx, d.z + d.d / 2 - tz));
    }
  }
  return {
    id: c.id,
    status: 'ok',
    scale,
    found: want.length - missed.length,
    of: want.length,
    missed,
    invented: live.filter((d) => !matched.has(d)).map((d) => d.name ?? '(unlabelled)'),
    sizeErrors,
    centreErrors,
  };
}

export type ProviderChoice =
  | { kind: 'mock' }
  | {
      kind: ProviderKind;
      model: string;
      baseUrl: string | null;
      reasoning: Reasoning;
      apiKey: string | null;
    };

export async function runPlans(
  cases: readonly PlanCase[],
  provider: ProviderChoice,
  opts: { gapMs: number; maxCalls: number; log?: (line: string) => void } = {
    gapMs: 0,
    maxCalls: 100,
  },
): Promise<{ scores: PlanScore[]; pass: boolean; median: number; everyFound: boolean }> {
  const log = opts.log ?? (() => {});
  const mock: MockAnswers | null = provider.kind === 'mock' ? {} : null;
  const rt: AiRuntime = {
    keys: new InMemoryKeyStore([]),
    ledger: new InMemoryLedger(),
    gate: new InMemoryBudgetGate(),
    pacer: new InMemoryPacer(),
    prices: async () => null,
    fetch: globalThis.fetch,
    now: () => new Date(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    log: { warn: (_o, m) => log(`  ${m}`), info: () => {} },
    mock,
  };
  const resolved: Resolved = {
    provider:
      provider.kind === 'mock'
        ? {
            id: 'eval-mock',
            scope: 'account',
            kind: 'openai_compatible',
            baseUrl: 'https://mock.invalid/v1',
            model: 'kept-mock',
            reasoning: 'low',
            structured: true,
          }
        : {
            id: 'eval',
            scope: 'account',
            kind: provider.kind,
            baseUrl: provider.baseUrl,
            model: provider.model,
            reasoning: provider.reasoning,
          },
    apiKey: provider.kind === 'mock' ? null : provider.apiKey,
    payer: { scope: 'account', accountId: 'eval', userId: null, fellBack: false },
    ownerAccountId: 'eval',
  };
  const scores: PlanScore[] = [];
  let sent = 0;
  for (const c of cases) {
    const empty = {
      found: 0,
      of: c.rooms.length,
      missed: [],
      invented: [],
      sizeErrors: [],
      centreErrors: [],
    };
    const img = await reencode(c.image, EVIDENCE_MAX_PX);
    if (!img) {
      scores.push({ id: c.id, status: 'failed', reason: 'undecodable', ...empty });
      continue;
    }
    if (sent >= opts.maxCalls) {
      scores.push({ id: c.id, status: 'failed', reason: 'max_calls', ...empty });
      continue;
    }
    if (mock) {
      for (const k of Object.keys(mock)) delete mock[k];
      if (c.answer) mock[mockKey(img.bytes)] = { output: c.answer };
    }
    if (sent > 0 && opts.gapMs > 0) await new Promise((r) => setTimeout(r, opts.gapMs));
    sent += 1;
    const result = await extract(rt, {
      mode: 'plan',
      images: [img],
      prompt: promptFor('plan', { languages: ['en'] }),
      locationId: null,
      userId: null,
      links: {},
      requestId: `eval-plan:${c.id}`.slice(0, 64),
      attempt: 1,
      jobId: `eval-plan:${c.id}`,
      resolved,
    });
    if (result.status !== 'ok') {
      const reason = result.status === 'failed' ? result.outcome : result.status;
      scores.push({ id: c.id, status: 'failed', reason, ...empty });
      continue;
    }
    const drafts = draftRooms(result.value.value as PlanExtraction, {
      w: img.width,
      h: img.height,
    });
    scores.push(scorePlan(c, drafts.rooms, drafts.scale.from));
  }
  const all = scores.flatMap((s) => s.sizeErrors);
  const m = median(all);
  const everyFound = scores.every((s) => s.status === 'ok' && s.found === s.of);
  return { scores, median: m, everyFound, pass: everyFound && m <= PASS.medianSizeErrorM };
}

const cm = (m: number) => (Number.isFinite(m) ? `${Math.round(m * 100)} cm` : '–');

export function report(run: Awaited<ReturnType<typeof runPlans>>, label: string): string[] {
  const lines = [
    `Floor plans (${label}, prompt ${PROMPT_VERSIONS.plan})`,
    '| Plan | Scale from | Found | Median size error | Worst | Median centre error | Missed | Invented |',
    '|---|---|---|---|---|---|---|---|',
  ];
  for (const s of run.scores) {
    if (s.status !== 'ok') {
      lines.push(`| ${s.id} | – | failed: ${s.reason} | | | | | |`);
      continue;
    }
    lines.push(
      `| ${s.id} | ${s.scale} | ${s.found}/${s.of} | ${cm(median(s.sizeErrors))} | ${cm(Math.max(...s.sizeErrors, 0))} | ${cm(median(s.centreErrors))} | ${s.missed.join(', ') || '–'} | ${s.invented.join(', ') || '–'} |`,
    );
  }
  lines.push(
    '',
    `Every room found: ${run.everyFound ? 'yes' : 'no'} · median size error ${cm(run.median)} (bar: ${cm(PASS.medianSizeErrorM)})`,
    run.pass ? 'PASS' : 'FAIL: below the bar; ship behind the review only',
  );
  return lines;
}

export async function main(
  argv: string[],
  print: (l: string) => void = console.log,
): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      provider: { type: 'string', default: 'mock' },
      model: { type: 'string' },
      'base-url': { type: 'string' },
      reasoning: { type: 'string', default: 'low' },
      dir: { type: 'string' },
      'gap-ms': { type: 'string' },
      'max-calls': { type: 'string' },
    },
  });
  const name = values.provider === 'compatible' ? 'openai_compatible' : (values.provider as string);
  const real = name !== 'mock';
  if (real && !(PROVIDER_KINDS as readonly string[]).includes(name)) {
    throw new Error(`--provider must be mock or one of ${PROVIDER_KINDS.join(', ')}`);
  }
  // The invented set always; the maintainer's own plans with a real provider and --dir.
  const cases = [...(await inventedCases()), ...(values.dir ? folderCases(values.dir) : [])];
  let provider: ProviderChoice = { kind: 'mock' };
  if (real) {
    if (!values.model) throw new Error('--model is required with a real provider');
    const apiKey = process.env.KEPT_EVAL_API_KEY ?? null;
    if (!apiKey && name !== 'openai_compatible') {
      throw new Error('KEPT_EVAL_API_KEY is not set (the key is read from the environment only)');
    }
    provider = {
      kind: name as ProviderKind,
      model: values.model,
      baseUrl: values['base-url'] ?? null,
      reasoning: values.reasoning as Reasoning,
      apiKey,
    };
  }
  const scrub = (l: string) => {
    const key = provider.kind === 'mock' ? null : provider.apiKey;
    return key ? l.split(key).join('[KEY]') : l;
  };
  const run = await runPlans(cases, provider, {
    gapMs: real ? Math.max(5000, Number(values['gap-ms'] ?? 5000)) : 0,
    maxCalls: Number(values['max-calls'] ?? cases.length),
    log: (l) => print(scrub(l)),
  });
  for (const l of report(run, real ? `${name} ${values.model}` : 'mock: answers from the truth')) {
    print(scrub(l));
  }
  return run.pass ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}
