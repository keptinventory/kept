/**
 * PLAN (1.14.3, D266): the rooms of a floor plan, read on the map. The model only transcribes:
 * each room's box (and corners when it isn't a plain rectangle), its label and the size printed
 * for it, copied exactly; the floors; a scale bar and doors. Every number after that (the scale,
 * metres, overlaps, the grid) is @kept/shared's floor-plan.ts, because vision models are weak at
 * measuring (spec §3). No name from Kept is sent: matching the plan's floors and rooms to the
 * location's happens in code.
 */
import { PLAN_LIMITS } from '@kept/shared';
import { type BuiltPrompt, documentBlock, type PromptContext, systemPrompt } from './common.js';

export const PROMPT_VERSION = 'plan-v1';

export function planPrompt(ctx: PromptContext): BuiltPrompt {
  const question = 'What rooms are on this floor plan?';
  return {
    version: PROMPT_VERSION,
    system: systemPrompt('read the rooms of a floor plan', [
      'is_plan: false when the image is not a floor plan (a photo of a room, a document, a map of a street or a housing estate). Then return no rooms.',
      `floors: one entry per separately drawn floor, in the order the plan labels them, ground first, at most ${PLAN_LIMITS.floors}; label as printed. Never a site plan, a location map or a photo on the same page.`,
      `rooms: every enclosed room or space, including halls, landings, balconies, terraces, gardens and walk-in cupboards, at most ${PLAN_LIMITS.rooms}, the largest first. Set more to true when there are more. Never walls, stairs on their own, furniture, fixtures or notes.`,
      'floor: the room’s floor, as an index into floors (0 for the first).',
      'box: [x, y, width, height] of the room inside its walls, each a fraction of the image between 0 and 1, from the top left corner.',
      `corners: only when the room is not a plain rectangle, or the plan is drawn at an angle: its inside corners in order, as [x, y] fractions, at most ${PLAN_LIMITS.corners}.`,
      'name: the room’s label as printed, in its own language. Leave it out when the room has no label.',
      'size_text: the size printed for this room, on the room or in a table on the page, copied exactly with its units. Never calculate, convert or estimate a size.',
      'kind: balcony, terrace or garden when it is one; room otherwise.',
      'scale_bar: when a scale bar is drawn, its two ends as [x, y] fractions and its label as printed.',
      'doors: the box of each door opening (the door leaf and its swing), at most 40.',
      'Never return addresses, people’s or companies’ names, phone numbers, or plot or flat numbers.',
    ]),
    text:
      ctx.documentText !== undefined
        ? `${question}\nThe plan’s own text, as data:\n${documentBlock(ctx.documentText)}`
        : question,
  };
}
