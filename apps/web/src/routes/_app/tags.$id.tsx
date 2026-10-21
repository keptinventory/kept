/**
 * /tags/<id>: a tag's page (#209), everything with the tag across your locations
 * (components/tags/tag-page.tsx). It reads the server, so its chunk loads on demand from
 * assets/household/ (vite.config.ts) and its error screen, precached, says "Needs a connection"
 * offline.
 */
import { SURFACE_FILTER_KEYS } from '@kept/shared';
import { createFileRoute } from '@tanstack/react-router';
import { TagRouteError } from '@/components/on-demand-route-error';
import { TagPage } from '@/components/tags/tag-page';
import { listSearch } from '@/lib/url-state';

export const Route = createFileRoute('/_app/tags/$id')({
  validateSearch: listSearch(SURFACE_FILTER_KEYS.things),
  component: TagRoute,
  errorComponent: TagRouteError,
});

function TagRoute() {
  const { id } = Route.useParams();
  return <TagPage key={id} id={id} />;
}
