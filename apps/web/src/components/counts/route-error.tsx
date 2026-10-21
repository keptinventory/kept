/**
 * The error screen of `/counts` and a count's page. Their chunks load on demand from
 * assets/household/ (vite.config.ts), out of the precache: they read the server. Offline before
 * their first load the reason says so: "Needs a connection". Any other error is the usual state.
 */
import { useLingui } from '@lingui/react/macro';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { needsConnection } from '@/components/notifications/route-error';
import { ErrorState, Notice, Page } from '@/components/page';

export function CountsRouteError({ error, reset }: ErrorComponentProps) {
  const { t } = useLingui();
  const offline = needsConnection(
    error,
    typeof navigator === 'undefined' || navigator.onLine !== false,
  );
  return (
    <Page title={t`Counts`}>
      {offline ? (
        <Notice tone="warn" title={t`Needs a connection`} />
      ) : (
        <ErrorState error={error} onRetry={reset} />
      )}
    </Page>
  );
}
