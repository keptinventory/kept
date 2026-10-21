/**
 * A scan session (#168): count, pack into or move to, many labels in one walk. The screen is
 * components/scan/session/session-screen.tsx; this route gives it the person's offline store and
 * where the session keeps itself on the phone, and goes back when it is closed.
 *
 * `?mode=count|pack|move` and the target: `?place=<id>` (`&inside=0` for the place alone),
 * `?box=<id>` or `?location=<id>`. Without them the screen asks. `validateSearch` stays in the
 * entry chunk, so it is written out by hand. The screen loads on demand from assets/household/
 * (vite.config.ts) and is cached once used, so a session works offline after the first one
 * opened online; its error screen stays precached and says "Needs a connection".
 */
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { useCallback } from 'react';
import { ScanSessionRouteError } from '@/components/on-demand-route-error';
import { SessionScreen, type SessionStart } from '@/components/scan/session/session-screen';
import { useSessionPersist } from '@/components/scan/session/use-persist';
import { useKick, useScanStore } from '@/components/scan/use-scan-store';

type Search = {
  mode?: 'count' | 'pack' | 'move';
  place?: string;
  box?: string;
  location?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute('/_app/scan-session')({
  validateSearch: (s: Record<string, unknown>): Search => {
    const out: Search = {};
    if (s.mode === 'count' || s.mode === 'pack' || s.mode === 'move') out.mode = s.mode;
    for (const k of ['place', 'box', 'location'] as const) {
      const v = s[k];
      if (typeof v === 'string' && UUID.test(v)) {
        out[k] = v;
        break;
      }
    }
    return out;
  },
  component: ScanSessionPage,
  errorComponent: ScanSessionRouteError,
});

function ScanSessionPage() {
  const search = Route.useSearch();
  const store = useScanStore();
  const persist = useSessionPersist(store);
  const kick = useKick();
  const navigate = useNavigate();
  const router = useRouter();
  const exit = useCallback(() => {
    if (router.history.canGoBack()) router.history.back();
    else void navigate({ to: '/scan' });
  }, [router, navigate]);
  const start: SessionStart = {
    ...(search.mode ? { mode: search.mode } : {}),
    ...(search.place
      ? { target: { kind: 'place', id: search.place } }
      : search.box
        ? { target: { kind: 'container', id: search.box } }
        : search.location
          ? { target: { kind: 'location', id: search.location } }
          : {}),
  };
  if (!store)
    return (
      <div
        role="status"
        aria-busy="true"
        className="fixed inset-0 z-40 bg-[#0F0E0D] md:relative md:inset-auto md:z-auto md:mx-auto md:my-4 md:min-h-[calc(100dvh-2rem)] md:max-w-[480px] md:rounded-2xl"
      />
    );
  return (
    <SessionScreen
      store={store}
      persist={persist}
      start={start}
      onExit={exit}
      onQueued={kick}
      onOpenCount={(id) => void navigate({ to: '/counts/$id', params: { id }, replace: true })}
      onPrintLabels={({ locationId, placeId }) =>
        void navigate({
          to: '/labels',
          search: { loc: locationId, unprinted: 1, ...(placeId ? { place: placeId } : {}) },
        })
      }
    />
  );
}
