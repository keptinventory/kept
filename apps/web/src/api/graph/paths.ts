/** The graph view's path (#207; `apps/server/src/graph/routes.ts`). */

export const graphPaths = {
  graph: (locationId: string) => `/api/v1/locations/${encodeURIComponent(locationId)}/graph`,
};
