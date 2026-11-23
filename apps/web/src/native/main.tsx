import { I18nProvider } from '@lingui/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { capturePaths } from '@/api/capture/paths';
import type { CaptureBatch, InboxPage } from '@/api/capture/types';
import { ApiError } from '@/api/client';
import { inventoryPaths, qs } from '@/api/inventory/paths';
import type { Page, SearchResponse } from '@/api/inventory/types';
import { paths } from '@/api/paths';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { i18n, startLocale } from '@/i18n/i18n';
import { watchSystemTheme } from '@/lib/prefs';
import { type Connection, native, nativeRequest } from './bridge';
import { CaptureForm, NewBoxForm } from './capture-form';
import {
  type InventoryCache,
  inventoryPath,
  loadInventory,
  localInventorySearch,
  type RecordDetail,
  readInventory,
} from './inventory';
import { LabelPanel } from './label-panel';
import { resolveLabel, type Target } from './labels';
import { draftFields, type PendingCapture, readStored, storage, syncOutbox } from './outbox';
import { type OpenBox, RecordScreen } from './record';
import './native.css';

type Screen =
  | { kind: 'home' }
  | { kind: 'record'; target: Target }
  | { kind: 'new' }
  | { kind: 'capture'; box: OpenBox; location: string }
  | { kind: 'identify' }
  | { kind: 'find' | 'enroll'; box: OpenBox }
  | { kind: 'batches' };

function ThingList({
  items,
  onOpen,
}: {
  items: { id: string; name: string | null; locationId: string; path: string }[];
  onOpen: (target: Target) => void;
}) {
  const { t } = useLingui();
  return (
    <ul className="grid gap-2">
      {items.map((thing) => (
        <li key={thing.id}>
          <Button
            variant="secondary"
            className="kept-phone-row"
            onPress={() => onOpen({ id: thing.id, kind: 'thing', locationId: thing.locationId })}
          >
            <bdi className="text-body">{thing.name ?? t`Untitled`}</bdi>
            {thing.path && <bdi className="font-normal text-small text-ink-2">{thing.path}</bdi>}
          </Button>
        </li>
      ))}
    </ul>
  );
}

function Batches({
  connection,
  onClose,
  onOpen,
}: {
  connection: Connection;
  onClose: () => void;
  onOpen: (target: Target) => void;
}) {
  const { t } = useLingui();
  const [batches, setBatches] = useState<CaptureBatch[]>();
  const [reviews, setReviews] = useState<InboxPage>();
  const [batchId, setBatchId] = useState<string>();
  const [status, setStatus] = useState('');
  useEffect(() => {
    let live = true;
    void nativeRequest<Page<CaptureBatch>>(
      connection,
      `${capturePaths.captureBatches}${qs({ mine: '1', limit: 30 })}`,
    )
      .then(({ items }) => {
        if (live) setBatches(items);
      })
      .catch(() => {
        if (live) setStatus(t`Connect to Kept to review recent batches.`);
      });
    return () => {
      live = false;
    };
  }, [connection, t]);

  async function review(batch: CaptureBatch) {
    setBatchId(batch.batchId);
    setReviews(undefined);
    setStatus('');
    try {
      setReviews(
        await nativeRequest(connection, `${capturePaths.inbox}${qs({ batchId: batch.batchId })}`),
      );
    } catch {
      setStatus(t`Connect to Kept to review recent batches.`);
    }
  }

  return (
    <section className="grid gap-4">
      <Button variant="ghost" className="justify-self-start" onPress={onClose}>
        <Trans>Back</Trans>
      </Button>
      <h2 className="text-title font-semibold">
        <Trans>Recent capture batches</Trans>
      </h2>
      {batches?.length === 0 && (
        <p>
          <Trans>No capture batches yet.</Trans>
        </p>
      )}
      {batches?.map((batch) => {
        const path = batch.placePath.map((step) => step.name).join(' › ');
        return (
          <div key={batch.batchId} className="grid gap-2">
            <Button
              variant="secondary"
              className="kept-phone-row"
              onPress={() => void review(batch)}
            >
              <bdi>{path}</bdi>
              <span>{t`Saved: ${batch.count}`}</span>
              <span>{new Date(batch.capturedAt).toLocaleString()}</span>
            </Button>
            {batchId === batch.batchId &&
              reviews &&
              (reviews.items.length ? (
                <ThingList
                  onOpen={onOpen}
                  items={reviews.items.flatMap((review) =>
                    review.thing ? [{ ...review.thing, path }] : [],
                  )}
                />
              ) : (
                <p className="text-ink-2">
                  <Trans>Nothing in this batch needs review.</Trans>
                </p>
              ))}
          </div>
        );
      })}
      {status && <p role="status">{status}</p>}
    </section>
  );
}

function Inventory({
  connection,
  onSignOut,
}: {
  connection: Connection;
  onSignOut: (reason?: 'expired' | 'restored') => void;
}) {
  const { t } = useLingui();
  const [screen, setScreen] = useState<Screen>({ kind: 'home' });
  const [cache, setCache] = useState<InventoryCache>();
  const cacheRef = useRef<InventoryCache | undefined>(undefined);
  const [pending, setPending] = useState<PendingCapture[]>([]);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<SearchResponse>();
  const [cachedSearch, setCachedSearch] = useState(false);
  const [working, setWorking] = useState(false);
  const [online, setOnline] = useState(false);
  const [status, setStatus] = useState('');
  const running = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);
  const goHome = () => setScreen({ kind: 'home' });
  const open = (target: Target) => setScreen({ kind: 'record', target });

  const display = useCallback((next: InventoryCache | undefined) => {
    cacheRef.current = next;
    if (mounted.current) setCache(next);
  }, []);

  const cacheDetail = useCallback(
    (detail: RecordDetail) => {
      const current = cacheRef.current;
      if (!current || !current.things.some((entry) => entry.id === detail.id)) return;
      const next = { ...current, details: { ...current.details, [detail.id]: detail } };
      display(next);
      void storage(connection, 'saveCache', { data: JSON.stringify(next) }).catch(() => {});
    },
    [connection, display],
  );

  const refresh = useCallback(() => {
    if (running.current) return running.current;
    const work = async () => {
      setWorking(true);
      try {
        setPending((await readStored<PendingCapture[]>(connection, 'list')) ?? []);
        await nativeRequest(connection, paths.me);
        setOnline(true);
        const count = await syncOutbox(connection);
        setPending((await readStored<PendingCapture[]>(connection, 'list')) ?? []);
        display(await loadInventory(connection));
        setStatus(count ? t`Synced entries: ${count}` : '');
      } catch (error) {
        if (!mounted.current) return;
        if (error instanceof ApiError && [401, 403, 409].includes(error.status)) {
          if (error.status !== 409 || error.hint?.includes('restored')) {
            onSignOut(error.status === 409 ? 'restored' : 'expired');
            return;
          }
        }
        setOnline(false);
        setStatus(
          error instanceof ApiError && error.status === 0
            ? t`Offline. Changes stay on this iPhone until Kept is reachable.`
            : t`Could not sync. Pending captures are still on this iPhone.`,
        );
      } finally {
        if (mounted.current) setWorking(false);
      }
    };
    running.current = work().finally(() => {
      running.current = null;
    });
    return running.current;
  }, [connection, display, onSignOut, t]);

  useEffect(() => {
    mounted.current = true;
    void readInventory(connection)
      .then((stored) => {
        if (stored && mounted.current) display(stored);
      })
      .catch(() => {});
    void refresh();
    const now = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('online', now);
    document.addEventListener('visibilitychange', now);
    const interval = setInterval(now, 45_000);
    return () => {
      mounted.current = false;
      window.removeEventListener('online', now);
      document.removeEventListener('visibilitychange', now);
      clearInterval(interval);
    };
  }, [connection, display, refresh]);

  useEffect(() => {
    let current = true;
    const readLink = async () => {
      const link = await native.takeLink({ context: connection.id });
      if (!link.url) return;
      const resolved = await resolveLabel(connection, cacheRef.current, link.url, 'nfc');
      if (!current) return;
      if (resolved.status === 'resolved') setScreen({ kind: 'record', target: resolved.target });
      else setStatus(t`This label is unavailable in your Kept.`);
    };
    const listen = native.addListener('keptLink', () => {
      void readLink().catch(() => {});
    });
    void readLink().catch(() => {});
    return () => {
      current = false;
      void listen.then((handle) => handle.remove()).catch(() => {});
    };
  }, [connection, t]);

  useEffect(() => {
    let current = true;
    setFound(undefined);
    setCachedSearch(false);
    if (!query.trim()) return;
    const timer = setTimeout(() => {
      void nativeRequest<SearchResponse>(
        connection,
        `${inventoryPaths.search}${qs({ q: query.trim(), limit: 50 })}`,
      )
        .then((result) => {
          if (current) setFound(result);
        })
        .catch((error: unknown) => {
          if (!current) return;
          if (error instanceof ApiError && error.status === 0) setCachedSearch(true);
          else setStatus(t`Could not search Kept. Try again.`);
        });
    }, 200);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [connection, query, t]);

  const savedLocally = () => {
    void readStored<PendingCapture[]>(connection, 'list')
      .then((items) => setPending(items ?? []))
      .catch(() => {});
    void refresh();
  };
  const backToBox = (box: OpenBox) =>
    open({ id: box.id, kind: 'thing', locationId: box.locationId });
  const currentBoxes = cache?.things.filter((thing) => thing.isContainer) ?? [];
  const localResults = cache && cachedSearch ? localInventorySearch(cache, query) : [];
  const things = query.trim()
    ? (found?.things.items.map((thing) => ({
        ...thing,
        path: [
          cache?.locations.find((entry) => entry.id === thing.locationId)?.name,
          ...thing.path.map((part) => part.name),
        ]
          .filter(Boolean)
          .join(' › '),
      })) ??
      localResults.map((thing) => ({
        ...thing,
        path: cache ? inventoryPath(cache, thing).join(' › ') : '',
      })))
    : currentBoxes.map((thing) => ({
        ...thing,
        path: cache ? inventoryPath(cache, thing).join(' › ') : '',
      }));

  return (
    <>
      <div className="mb-5 grid gap-2">
        {status && (
          <p className="rounded-lg bg-sunken p-3 text-ink-2" role="status">
            {status}
          </p>
        )}
        {pending.length > 0 && (
          <section
            className="grid gap-2 rounded-lg border border-line bg-surface p-3"
            aria-label={t`Pending captures`}
          >
            <p className="font-semibold">{t`Pending captures: ${pending.length}`}</p>
            {pending
              .filter((entry) => entry.failure)
              .map((entry) => (
                <p key={entry.capture.id} className="text-ink-2">
                  <bdi>{draftFields(entry.capture).name}</bdi> <Trans>Needs attention</Trans>
                </p>
              ))}
            <Button
              variant="secondary"
              className="justify-self-start"
              isPending={working}
              onPress={() => void refresh()}
            >
              <Trans>Retry sync</Trans>
            </Button>
          </section>
        )}
      </div>
      {screen.kind === 'home' && (
        <section className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Button
              isDisabled={
                !online || !cache?.locations.some((location) => location.role !== 'viewer')
              }
              onPress={() => setScreen({ kind: 'new' })}
            >
              <Trans>Create box</Trans>
            </Button>
            <Button variant="secondary" onPress={() => setScreen({ kind: 'identify' })}>
              <Trans>Identify a label</Trans>
            </Button>
            <Button
              variant="secondary"
              isDisabled={!online}
              onPress={() => setScreen({ kind: 'batches' })}
            >
              <Trans>Recent capture batches</Trans>
            </Button>
          </div>
          <TextField
            label={t`Search inventory`}
            value={query}
            onChange={setQuery}
            inputProps={{ type: 'search', maxLength: 200 }}
          />
          {cache && !online && (
            <p className="text-small text-ink-2">
              {t`Cached inventory from ${new Date(cache.asOf).toLocaleString()}`}
            </p>
          )}
          {cache?.truncated && (
            <p className="text-small text-ink-2">
              <Trans>Only part of your inventory is cached.</Trans>
            </p>
          )}
          <h2 className="text-title font-semibold">
            {query.trim() ? t`Search results` : t`Boxes`}
          </h2>
          <ThingList items={things} onOpen={open} />
          {found?.places.map((place) => (
            <Button
              key={place.id}
              variant="secondary"
              className="kept-phone-row"
              onPress={() => open({ id: place.id, locationId: place.locationId, kind: 'place' })}
            >
              <bdi>{place.name}</bdi>
            </Button>
          ))}
          {found?.documents.items
            .filter((entry) => entry.subject.kind === 'thing' || entry.subject.kind === 'place')
            .map((doc) => (
              <Button
                key={doc.attachmentId}
                variant="secondary"
                className="kept-phone-row"
                onPress={() =>
                  open({
                    id: doc.subject.id,
                    locationId: doc.locationId,
                    kind: doc.subject.kind === 'place' ? 'place' : 'thing',
                  })
                }
              >
                <bdi>{doc.subject.name ?? t`Document`}</bdi>
                {doc.snippet && (
                  <span className="text-small font-normal">
                    <bdi>{doc.snippet}</bdi>
                  </span>
                )}
              </Button>
            ))}
          {!query.trim() && cache && things.length === 0 && (
            <p>
              <Trans>No boxes yet.</Trans>
            </p>
          )}
          {query.trim() &&
            (cachedSearch || found) &&
            things.length === 0 &&
            !found?.places.length &&
            !found?.documents.items.length && (
              <p>
                <Trans>No matching inventory.</Trans>
              </p>
            )}
          <Button variant="ghost" className="justify-self-start" onPress={() => onSignOut()}>
            <Trans>Sign out</Trans>
          </Button>
        </section>
      )}
      {screen.kind === 'record' && (
        <RecordScreen
          key={screen.target.id}
          connection={connection}
          cache={cache}
          target={screen.target}
          onClose={goHome}
          onOpen={open}
          onCache={cacheDetail}
          onCapture={(box, location) => setScreen({ kind: 'capture', box, location })}
          onLabel={(kind, box) => setScreen({ kind, box })}
        />
      )}
      {screen.kind === 'new' && cache && (
        <NewBoxForm
          connection={connection}
          cache={cache}
          onClose={goHome}
          onCreated={(id, locationId) => {
            open({ id, locationId, kind: 'thing' });
            void refresh();
          }}
        />
      )}
      {screen.kind === 'capture' && (
        <CaptureForm
          connection={connection}
          box={screen.box}
          location={screen.location}
          onClose={() => backToBox(screen.box)}
          onSave={savedLocally}
        />
      )}
      {screen.kind === 'identify' && (
        <LabelPanel
          connection={connection}
          cache={cache}
          action="identify"
          onOpen={open}
          onClose={goHome}
        />
      )}
      {(screen.kind === 'find' || screen.kind === 'enroll') && (
        <LabelPanel
          connection={connection}
          cache={cache}
          action={screen.kind}
          box={screen.box}
          onOpen={open}
          canEnroll={
            cache?.locations.some(
              (location) => location.id === screen.box.locationId && location.role !== 'viewer',
            ) === true
          }
          onClose={() => backToBox(screen.box)}
        />
      )}
      {screen.kind === 'batches' && (
        <Batches connection={connection} onClose={goHome} onOpen={open} />
      )}
    </>
  );
}

function KeptPhone() {
  const { t } = useLingui();
  const [connection, setConnection] = useState<Connection | null>(null);
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    void native
      .connection()
      .then((saved) => {
        if (saved.id) {
          setConnection(saved as Connection);
          setAddress(saved.origin);
        }
      })
      .catch(() => setStatus(t`Kept could not read the saved session.`))
      .finally(() => setBusy(false));
  }, [t]);

  async function signIn() {
    setBusy(true);
    setStatus('');
    try {
      const next = await native.connect({ address });
      setConnection(next);
      setAddress(next.origin);
    } catch {
      setStatus(t`Could not connect to Kept. Check the server address and try again.`);
    } finally {
      setBusy(false);
    }
  }

  const signOut = useCallback(
    (reason?: 'expired' | 'restored') => {
      setBusy(true);
      setStatus('');
      setConnection(null);
      void native
        .disconnect()
        .then(({ revoked }) => {
          if (reason === 'restored') {
            setStatus(
              t`This Kept was restored or replaced. Pending captures from the previous server state are held for review.`,
            );
          } else if (reason === 'expired') {
            setStatus(t`Your session ended. Sign in again to see your pending captures.`);
          } else if (!revoked) {
            setStatus(
              t`Signed out on this iPhone. Kept could not revoke the server session while offline.`,
            );
          }
        })
        .catch(() => setStatus(t`Could not sign out.`))
        .finally(() => setBusy(false));
    },
    [t],
  );

  return (
    <main className="kept-phone">
      <header className="mb-5 border-b border-line pb-4">
        <h1 className="text-title font-semibold">Kept NFC</h1>
        {connection && (
          <p className="break-all text-small text-ink-2">
            <bdi>{connection.origin}</bdi>
          </p>
        )}
      </header>
      {connection ? (
        <Inventory key={connection.id} connection={connection} onSignOut={signOut} />
      ) : (
        <>
          <h2 className="mb-4 text-title font-semibold">
            <Trans>Connect to your inventory</Trans>
          </h2>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (address.trim() && !busy) void signIn();
            }}
          >
            <TextField
              label={t`Kept server address`}
              placeholder="https://kept.example.com"
              value={address}
              onChange={setAddress}
              isDisabled={busy}
              inputProps={{
                dir: 'ltr',
                autoCapitalize: 'none',
                autoCorrect: 'off',
                inputMode: 'url',
              }}
            />
            <Button type="submit" isPending={busy} isDisabled={!address.trim()}>
              <Trans>Sign in</Trans>
            </Button>
          </form>
        </>
      )}
      {status && (
        <p className="mt-4 text-ink-2" role="status">
          {status}
        </p>
      )}
    </main>
  );
}

async function start() {
  await startLocale();
  watchSystemTheme();
  const root = document.getElementById('root');
  if (!root) throw new Error('Missing Kept app root');
  createRoot(root).render(
    <I18nProvider i18n={i18n}>
      <KeptPhone />
    </I18nProvider>,
  );
}

void start();
