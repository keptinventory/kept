import { readFileSync } from 'node:fs';
import path from 'node:path';
import { estimateTextTokens, type ProviderKind } from '@kept/shared';
import { describe, expect, it } from 'vitest';
import { packageRoot } from '../package-root.js';
import { estimateCall } from './estimate.js';
import { loadMockAnswers, mockKey } from './mock.js';

describe('estimateCall', () => {
  it('Groq: 2,048 per image, and the pace estimate uses the expected output, not the cap', () => {
    const e = estimateCall({
      kind: 'groq',
      images: [{ width: 640, height: 900 }],
      promptText: 'x'.repeat(240),
      maxOutputTokens: 4548,
      expectedOutputTokens: 2500,
    });
    expect(e.imageTokensEach).toBe(2048);
    expect(e.inputTokens).toBe(estimateTextTokens('x'.repeat(240), 'groq') + 32 + 2048);
    expect(e.reserveTokens).toBe(e.inputTokens + 4548);
    expect(e.paceTokens).toBe(e.inputTokens + 2500);
  });

  it('no images: no per-image figure; the expected output never exceeds the cap', () => {
    const e = estimateCall({
      kind: 'openai',
      images: [],
      promptText: 'hello',
      maxOutputTokens: 50,
      expectedOutputTokens: 500,
    });
    expect(e.imageTokensEach).toBeNull();
    expect(e.paceTokens).toBe(e.inputTokens + 50);
  });
});

type Reference = { cases: { id: string; o200k: number; text: string }[] };
const reference = JSON.parse(
  readFileSync(path.join(packageRoot(), 'test/fixtures/tokens/o200k.json'), 'utf8'),
) as Reference;

describe('the text estimate against a real tokenizer (o200k, gpt-oss and OpenAI)', () => {
  it.each(reference.cases.map((c) => [c.id, c] as const))(
    '%s: within 20% of the reference count, never more than 2% under',
    (_id, c) => {
      for (const kind of ['groq', 'openai'] as ProviderKind[]) {
        const ratio = estimateTextTokens(c.text, kind) / c.o200k;
        expect(ratio).toBeLessThanOrEqual(1.2);
        expect(ratio).toBeGreaterThanOrEqual(0.98);
      }
    },
  );

  it('the unmeasured kinds stay at or above the measured estimate', () => {
    for (const c of reference.cases) {
      const measured = estimateTextTokens(c.text, 'groq');
      for (const kind of ['anthropic', 'google', 'openrouter', 'openai_compatible'] as const) {
        expect(estimateTextTokens(c.text, kind)).toBeGreaterThanOrEqual(measured);
      }
    }
  });
});

describe('mock answers', () => {
  it('keys by the first 12 hex of SHA-256, and a missing file is an empty map', () => {
    expect(mockKey(new Uint8Array([1, 2, 3]))).toBe('039058c6f2c0');
    expect(loadMockAnswers('/nonexistent/mock-answers.json')).toEqual({});
  });
});
