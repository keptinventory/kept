import { describe, expect, it } from 'vitest';
import { estimateImageTokens } from './ai.js';
import { ROOM_MERGE_MAX_OUTPUT } from './extraction.js';
import { ROOM_MERGE_INPUT_TOKENS, ROOM_PROMPT_TOKENS, roomEstimate } from './room.js';

describe('roomEstimate', () => {
  it('is nothing for no photos', () => {
    expect(roomEstimate({ kind: 'groq', photos: [] })).toEqual({ photos: 0, tokens: 0 });
  });

  it('adds each photo’s read and one merge, at most', () => {
    const photo = { width: 2048, height: 1536 };
    const one = estimateImageTokens('groq', 2048, 1536) + ROOM_PROMPT_TOKENS + 8000;
    expect(roomEstimate({ kind: 'groq', photos: [photo] })).toEqual({ photos: 1, tokens: one });
    const five = roomEstimate({ kind: 'groq', photos: Array(5).fill(photo) });
    expect(five).toEqual({
      photos: 5,
      tokens: 5 * one + ROOM_MERGE_INPUT_TOKENS + ROOM_MERGE_MAX_OUTPUT,
    });
  });

  it('counts a provider that bills by size by each photo’s size', () => {
    const small = roomEstimate({ kind: 'anthropic', photos: [{ width: 800, height: 600 }] });
    const big = roomEstimate({ kind: 'anthropic', photos: [{ width: 2048, height: 1536 }] });
    expect(big.tokens).toBeGreaterThan(small.tokens);
  });
});
