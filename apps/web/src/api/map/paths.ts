/**
 * The location map's paths (1.x, D237; `apps/server/src/map/routes.ts`).
 */

const V1 = '/api/v1';
const seg = (value: string) => encodeURIComponent(value);

export const mapPaths = {
  map: (locationId: string) => `${V1}/locations/${seg(locationId)}/map`,
  layout: (locationId: string) => `${V1}/locations/${seg(locationId)}/layout`,
  // Floor plan to map (1.14.3, D266).
  floorPlans: (locationId: string) => `${V1}/locations/${seg(locationId)}/floor-plans`,
  floorPlan: (id: string) => `${V1}/floor-plans/${seg(id)}`,
  floorPlanRetry: (id: string) => `${V1}/floor-plans/${seg(id)}/retry`,
  floorPlanDiscard: (id: string) => `${V1}/floor-plans/${seg(id)}/discard`,
  floorPlanApply: (id: string) => `${V1}/floor-plans/${seg(id)}/apply`,
};
