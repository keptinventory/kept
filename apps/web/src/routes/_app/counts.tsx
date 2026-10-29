/**
 * Counts (1.14, #172): a location's counts and box checks (components/counts/counts-list.tsx).
 * The parent of /counts/$id and /counts/box/$id: when a child matches, this renders only the
 * child. Its list state is in the URL (surface `counts`). It loads on demand from
 * assets/household/ (vite.config.ts): it reads the server.
 */
import { SURFACE_FILTER_KEYS } from '@kept/shared';
import { useLingui } from '@lingui/react/macro';
import { createFileRoute, Outlet, useChildMatches } from '@tanstack/react-router';
import { CountsList } from '@/components/counts/counts-list';
import { CountsRouteError } from '@/components/counts/route-error';
import { Page } from '@/components/page';
import { listSearch } from '@/lib/url-state';

export const Route = createFileRoute('/_app/counts')({
  validateSearch: listSearch(SURFACE_FILTER_KEYS.counts),
  component: CountsRoute,
  errorComponent: CountsRouteError,
});

function CountsRoute() {
  const { t } = useLingui();
  if (useChildMatches().length > 0) return <Outlet />;
  return (
    <Page title={t`Counts`} wide>
      <div data-tour="counts-list">
        <CountsList />
      </div>
    </Page>
  );
}
