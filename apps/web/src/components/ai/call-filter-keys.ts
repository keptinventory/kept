// The URL filter keys a list owns, apart from the list: its route's `listSearch` reads them
// in the route's definition, which is in the entry chunk, while the list loads on demand.

/** The AI calls list's filters, on both usage routes (`listSearch(AI_CALL_FILTERS, …)`). */
export const AI_CALL_FILTERS = [
  'at',
  'person',
  'location',
  'task',
  'model',
  'provider',
  'outcome',
  'paidBy',
  'hasImage',
  'tokensMin',
  'tokensMax',
  'costMin',
  'costMax',
  'currency',
  'thing',
] as const;
