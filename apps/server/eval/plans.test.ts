import { describe, expect, it } from 'vitest';
import { inventedCases, PASS, report, runPlans, scorePlan } from './plans.js';

// The floor plan harness (eval/plans.ts) on the mock: the invented set, answered from its own
// truth. This proves the harness and the pass bar's arithmetic; a model's accuracy is measured
// only by a real run (the maintainer's key, before the release).

describe('the floor plan evaluation', () => {
  it('passes the bar on the invented set with truth-made answers', async () => {
    const run = await runPlans(await inventedCases(), { kind: 'mock' }, { gapMs: 0, maxCalls: 20 });
    expect(run.scores).toHaveLength(8);
    expect(run.scores.every((s) => s.status === 'ok')).toBe(true);
    expect(run.everyFound).toBe(true);
    expect(run.median).toBeLessThanOrEqual(PASS.medianSizeErrorM);
    expect(run.pass).toBe(true);
    const lines = report(run, 'mock');
    expect(lines.at(-1)).toBe('PASS');
  });

  it('fails a plan with a missed room, whatever the sizes', () => {
    const s = scorePlan(
      {
        id: 'x',
        image: Buffer.alloc(0),
        sideways: false,
        rooms: [
          { name: 'Kitchen', x: 0, z: 0, w: 3, d: 3, floor: 0 },
          { name: 'Hall', x: 3, z: 0, w: 2, d: 3, floor: 0 },
        ],
      },
      [
        {
          key: 'plan:0',
          name: 'Kitchen',
          floor: 0,
          kind: 'room',
          x: 0,
          z: 0,
          w: 3,
          d: 3,
          printed: null,
          notes: [],
          skip: false,
        },
      ],
      'sizes',
    );
    expect(s).toMatchObject({ found: 1, of: 2, missed: ['Hall'], sizeErrors: [0] });
  });
});
