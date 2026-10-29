// The seed scenarios' names, apart from the seed itself: `kept`'s option list reads them without
// loading the seed, which builds a whole Kept app (seed/index.ts).
export const SCENARIOS = ['households', 'bench'] as const;
export type Scenario = (typeof SCENARIOS)[number];
