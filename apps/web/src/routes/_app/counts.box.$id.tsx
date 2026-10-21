/**
 * A box check's page (1.14, #172; components/counts/box-check-page.tsx). On demand from
 * assets/household/ (vite.config.ts): it reads the server.
 */
import { createFileRoute } from '@tanstack/react-router';
import { BoxCheckPage } from '@/components/counts/box-check-page';
import { CountsRouteError } from '@/components/counts/route-error';

export const Route = createFileRoute('/_app/counts/box/$id')({
  component: BoxCheckRoute,
  errorComponent: CountsRouteError,
});

function BoxCheckRoute() {
  const { id } = Route.useParams();
  return <BoxCheckPage id={id} />;
}
