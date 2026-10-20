/**
 * Room photos: what a room capture is about to cost, shown before it is sent ("About 3 photos ·
 * up to ~31,000 tokens"). An upper bound, from the same estimators the server reserves with:
 * each photo is one read (its image, the room prompt, the whole JSON allowance), and more than
 * one photo adds one text-only merge. A model's reasoning is billed on top where it thinks.
 */
import { estimateImageTokens, type ProviderKind } from './ai.js';
import { MAX_OUTPUT_TOKENS, ROOM_MERGE_MAX_OUTPUT } from './extraction.js';

/** The room prompt's text, rounded up. */
export const ROOM_PROMPT_TOKENS = 700;
/** The merge call's input: the objects listed as short lines, at their most. */
export const ROOM_MERGE_INPUT_TOKENS = 2000;

export type RoomEstimate = { photos: number; tokens: number };

export function roomEstimate(input: {
  kind: ProviderKind;
  photos: readonly { width: number; height: number }[];
}): RoomEstimate {
  let tokens = 0;
  for (const p of input.photos) {
    tokens +=
      estimateImageTokens(input.kind, p.width, p.height) +
      ROOM_PROMPT_TOKENS +
      MAX_OUTPUT_TOKENS.room;
  }
  if (input.photos.length > 1) tokens += ROOM_MERGE_INPUT_TOKENS + ROOM_MERGE_MAX_OUTPUT;
  return { photos: input.photos.length, tokens };
}
