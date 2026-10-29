/**
 * The location map's fetchers, key and hook (1.x, D237) over ./types.ts and ./paths.ts.
 */
import { useQuery } from '@tanstack/react-query';
import { api, written } from '../client';
import { mapPaths as p } from './paths';
import type {
  ApplyPlanBody,
  ApplyPlanResult,
  FloorPlanView,
  LayoutBody,
  MapView,
  StartPlanBody,
} from './types';

export const mapKeys = {
  all: ['map'] as const,
  map: (locationId: string) => ['map', locationId] as const,
  plan: (id: string) => ['map', 'floor-plan', id] as const,
};

export const mapApi = {
  map: (locationId: string) => api.get<MapView>(p.map(locationId)),
  saveLayout: (locationId: string, body: LayoutBody) =>
    written.put<{ version: string | null }>(p.layout(locationId), body),
  // Floor plan to map (1.14.3, D266).
  startPlan: (locationId: string, body: StartPlanBody) =>
    api.post<FloorPlanView>(p.floorPlans(locationId), body),
  plan: (id: string) => api.get<FloorPlanView>(p.floorPlan(id)),
  retryPlan: (id: string) => api.post<FloorPlanView>(p.floorPlanRetry(id)),
  discardPlan: (id: string) => api.post<{ status: 'discarded' }>(p.floorPlanDiscard(id)),
  applyPlan: (id: string, body: ApplyPlanBody) =>
    written.post<ApplyPlanResult>(p.floorPlanApply(id), body),
};

export function useLocationMap(locationId: string) {
  return useQuery({
    queryKey: mapKeys.map(locationId),
    queryFn: () => mapApi.map(locationId),
  });
}

/** A floor plan, polled every 2 s while it is read and the page is visible (spec §5.2). */
export function useFloorPlan(id: string | null) {
  return useQuery({
    queryKey: mapKeys.plan(id ?? ''),
    queryFn: () => mapApi.plan(id as string),
    enabled: id !== null,
    refetchInterval: (q) => (q.state.data?.status === 'reading' ? 2000 : false),
    refetchIntervalInBackground: false,
  });
}
