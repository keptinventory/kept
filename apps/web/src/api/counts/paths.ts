/**
 * Counts' paths (1.14, #172; `apps/server/src/sessions/routes.ts`): a location's counts, a
 * count's result and CSV, a box check's lines, and a shared count (open it, find the one in
 * progress, read what others read). A path the server names differently is fixed here only.
 */

const V1 = '/api/v1';
const seg = (value: string) => encodeURIComponent(value);

export const countsPaths = {
  locationCounts: (locationId: string) => `${V1}/locations/${seg(locationId)}/counts`,
  startCount: `${V1}/scan-sessions`,
  openCount: `${V1}/scan-sessions/open`,
  countLines: (id: string) => `${V1}/scan-sessions/${seg(id)}/lines`,
  countResult: (id: string) => `${V1}/scan-sessions/${seg(id)}/result`,
  countCsv: (id: string) => `${V1}/scan-sessions/${seg(id)}/result.csv`,
  boxCheck: (id: string) => `${V1}/box-checks/${seg(id)}`,
};

export const COUNTS_METHODS: Record<keyof typeof countsPaths, readonly string[]> = {
  locationCounts: ['GET'],
  startCount: ['POST'],
  openCount: ['GET'],
  countLines: ['GET'],
  countResult: ['GET'],
  countCsv: ['GET'],
  boxCheck: ['GET'],
};
