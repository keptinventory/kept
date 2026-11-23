import type {
  VisualSearchCoverage,
  VisualSearchInputResponse,
  VisualSearchRequest,
  VisualSearchResult,
} from '@kept/shared';
import { api, request } from './client';
import { qs } from './inventory/paths';
import { visualSearchPaths } from './visual-search/paths';

function scopeQuery(locationIds: readonly string[] | undefined) {
  return locationIds ? qs({ locationIds: locationIds.join(',') }) : '';
}

export const visualSearchApi = {
  status: (locations: readonly string[] | undefined, signal: AbortSignal) =>
    api.get<VisualSearchCoverage>(visualSearchPaths.status + scopeQuery(locations), signal),
  upload: (image: File, locations: readonly string[] | undefined) =>
    request<VisualSearchInputResponse>(visualSearchPaths.input + scopeQuery(locations), {
      method: 'POST',
      rawBody: image,
    }),
  search: (body: VisualSearchRequest, signal: AbortSignal) =>
    request<VisualSearchResult>(visualSearchPaths.search, { method: 'POST', body, signal }),
  cancel: (inputId: string) => api.del(visualSearchPaths.inputById(inputId)),
};
