/**
 * A count's page (1.14, #172; components/counts/count-page.tsx). On demand from
 * assets/household/ (vite.config.ts): it reads the server.
 */
import { createFileRoute } from '@tanstack/react-router';
import { CountPage } from '@/components/counts/count-page';
import { CountsRouteError } from '@/components/counts/route-error';

export const Route = createFileRoute('/_app/counts/$id')({
  component: CountRoute,
  errorComponent: CountsRouteError,
});

function CountRoute() {
  const { id } = Route.useParams();
  return <CountPage id={id} />;
}
