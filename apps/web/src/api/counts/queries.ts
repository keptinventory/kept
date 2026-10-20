/**
 * Counts' fetchers, keys and hooks (1.14, #172) over ./types.ts and ./paths.ts. The list follows
 * the list standard: `useInfiniteQuery` over `next_cursor`.
 */
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { qs } from '../inventory/paths';
import { nextCursor } from '../inventory/queries';
import type { Page } from '../inventory/types';
import { countsPaths as p } from './paths';
import type {
  BoxCheckDetail,
  CountLines,
  CountResult,
  CountSummary,
  CountsParams,
  OpenCount,
  StartCountBody,
} from './types';

export const countsKeys = {
  all: ['counts'] as const,
  list: (locationId: string, params: CountsParams = {}) =>
    ['counts', 'list', locationId, params] as const,
  result: (id: string) => ['counts', 'result', id] as const,
  boxCheck: (id: string) => ['counts', 'box-check', id] as const,
  open: (target: string) => ['counts', 'open', target] as const,
};

type OpenTarget = { placeId: string } | { containerId: string } | { locationId: string };

export const countsApi = {
  list: (locationId: string, params: CountsParams = {}) =>
    api.get<Page<CountSummary>>(p.locationCounts(locationId) + qs(params)),
  result: (id: string) => api.get<CountResult>(p.countResult(id)),
  csvUrl: (id: string) => p.countCsv(id),
  boxCheck: (id: string) => api.get<BoxCheckDetail>(p.boxCheck(id)),
  start: (body: StartCountBody) => api.post<{ id: string }>(p.startCount, body),
  open: (target: OpenTarget) => api.get<OpenCount>(p.openCount + qs(target)),
  lines: (id: string) => api.get<CountLines>(p.countLines(id)),
};

export const useCounts = (locationId: string | null, params: CountsParams = {}) =>
  useInfiniteQuery({
    queryKey: countsKeys.list(locationId ?? '', params),
    queryFn: ({ pageParam }) =>
      countsApi.list(locationId as string, {
        ...params,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    enabled: !!locationId,
  });

export const useCountResult = (id: string) =>
  useQuery({ queryKey: countsKeys.result(id), queryFn: () => countsApi.result(id) });

export const useBoxCheckDetail = (id: string) =>
  useQuery({ queryKey: countsKeys.boxCheck(id), queryFn: () => countsApi.boxCheck(id) });
