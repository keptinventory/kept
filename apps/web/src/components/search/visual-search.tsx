import { VISUAL_IMAGE_MAX_BYTES, VISUAL_IMAGE_MIMES, type VisualSearchResult } from '@kept/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { FileTrigger } from 'react-aria-components';
import { isApiError } from '@/api/client';
import { inventoryApi } from '@/api/inventory/queries';
import { visualSearchApi } from '@/api/visual-search';
import { CameraIcon, ChevronEndIcon } from '@/components/icons';
import { List, Section, useErrorText } from '@/components/page';
import { Sheet } from '@/components/things/sheet';
import { Button } from '@/components/ui/button';
import { useFormat } from '@/lib/format';
import { useOnline } from '@/lib/online';

type Match = VisualSearchResult['matches'][number];
const IMAGE_TYPES = [...VISUAL_IMAGE_MIMES];

function Evidence({ match, onClose }: { match: Match; onClose: () => void }) {
  const { t } = useLingui();
  const [loadFailed, setLoadFailed] = useState(false);
  const errorText = useErrorText();
  const url = useQuery({
    queryKey: ['visual-search', 'evidence', match.attachmentId],
    queryFn: () => inventoryApi.fileUrl(match.fileId, 'display', match.thingId),
    gcTime: 0,
    retry: false,
  });
  return (
    <Sheet isOpen onOpenChange={(open) => !open && onClose()} title={t`Stored photo`}>
      {url.isError ? (
        <p role="status">{errorText(url.error)}</p>
      ) : loadFailed ? (
        <p role="status">
          <Trans>Photo unavailable</Trans>
        </p>
      ) : url.data ? (
        <img
          src={url.data.url}
          alt={match.name}
          className="max-h-[60vh] w-full rounded-lg bg-sunken object-contain"
          onError={() => setLoadFailed(true)}
        />
      ) : (
        <p role="status">
          <Trans>Loading photo…</Trans>
        </p>
      )}
    </Sheet>
  );
}

function MatchNotice({ result }: { result: VisualSearchResult }) {
  if (result.outcome === 'unavailable') return <Trans>Photo search is unavailable.</Trans>;
  if (result.outcome === 'partial_coverage') return <Trans>Photo indexing is incomplete.</Trans>;
  if (result.outcome === 'no_close_match')
    return <Trans>No close photo match. Try different words or a clearer photo.</Trans>;
  if (result.outcome === 'ambiguous') return <Trans>Several recorded locations may match.</Trans>;
  if (result.coverage.pending + result.coverage.failed + result.coverage.paused > 0)
    return <Trans>Photo indexing is incomplete.</Trans>;
  return null;
}

/** Visual results are scoped to the current search and discarded when the scope or user changes. */
export function VisualSearch({
  text,
  locationIds,
  userId,
}: {
  text: string;
  /** Undefined is all authorized locations. An empty array is an empty scope. */
  locationIds: string[] | undefined;
  userId: string | undefined;
}) {
  const online = useOnline();
  const status = useQuery({
    queryKey: ['visual-search', 'status', userId, locationIds],
    queryFn: ({ signal }) => visualSearchApi.status(locationIds, signal),
    enabled: !!userId && online && locationIds?.length !== 0,
    retry: false,
  });
  if (!online || !status.data?.generation || locationIds?.length === 0) return null;
  return (
    <VisualActions
      key={JSON.stringify([userId, status.data.generation, locationIds, text])}
      text={text}
      locationIds={locationIds}
    />
  );
}

function VisualActions({ text, locationIds }: { text: string; locationIds: string[] | undefined }) {
  const { t } = useLingui();
  const fmt = useFormat();
  const errorText = useErrorText();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VisualSearchResult>();
  const [error, setError] = useState<string>();
  const [evidence, setEvidence] = useState<Match>();
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  async function run(query: { text: string } | { image: File }) {
    active.current?.abort();
    const work = new AbortController();
    active.current = work;
    setBusy(true);
    setResult(undefined);
    setEvidence(undefined);
    setError(undefined);
    const scope = locationIds ? { locationIds } : {};
    let inputId: string | undefined;
    try {
      const input =
        'text' in query
          ? query
          : {
              inputId: (await visualSearchApi.upload(query.image, locationIds, work.signal))
                .inputId,
            };
      if ('inputId' in input) inputId = input.inputId;
      if (work.signal.aborted) return;
      const answer = await visualSearchApi.search({ ...input, ...scope }, work.signal);
      if (!work.signal.aborted) setResult(answer);
    } catch (err) {
      if (!work.signal.aborted) {
        setError(
          isApiError(err) && err.status === 503 ? t`Photo search is unavailable.` : errorText(err),
        );
      }
    } finally {
      if (inputId) void visualSearchApi.cancel(inputId).catch(() => {});
      if (active.current === work && !work.signal.aborted) {
        active.current = null;
        setBusy(false);
      }
    }
  }

  return (
    <Section title={<Trans>Search photos</Trans>}>
      <div className="flex flex-wrap items-center gap-2">
        {text && (
          <Button variant="secondary" isDisabled={busy} onPress={() => void run({ text })}>
            <Trans>Find in photos</Trans>
          </Button>
        )}
        <FileTrigger
          acceptedFileTypes={IMAGE_TYPES}
          onSelect={(files) => {
            const image = files?.[0];
            if (!image) return;
            if (image.size > VISUAL_IMAGE_MAX_BYTES) {
              setError(t`Choose a photo up to ${fmt.num(VISUAL_IMAGE_MAX_BYTES / 1024 ** 2)} MB.`);
              return;
            }
            void run({ image });
          }}
        >
          <Button variant="secondary" isDisabled={busy}>
            <CameraIcon aria-hidden="true" className="size-4" />
            <Trans>Search with a photo</Trans>
          </Button>
        </FileTrigger>
        {busy && (
          <Button
            variant="ghost"
            onPress={() => {
              active.current?.abort();
              active.current = null;
              setBusy(false);
            }}
          >
            <Trans>Cancel</Trans>
          </Button>
        )}
      </div>
      <p role="status" className="m-0 text-small text-ink-2 empty:hidden">
        {busy ? (
          <Trans>Searching photos…</Trans>
        ) : (
          error || (result && <MatchNotice result={result} />)
        )}
      </p>
      {result && result.matches.length > 0 && (
        <List aria-label={t`Possible photo matches`}>
          {result.matches.map((match) => (
            <li key={match.attachmentId} className="grid gap-2 p-3 sm:grid-cols-[1fr_auto]">
              <div className="grid min-w-0 gap-1">
                <Link
                  to="/t/$id"
                  params={{ id: match.thingId }}
                  className="w-fit max-w-full break-words font-semibold underline underline-offset-2"
                >
                  <bdi>{match.name}</bdi>
                </Link>
                <p className="m-0 flex flex-wrap items-center gap-x-1 text-small text-ink-2">
                  <Trans>Recorded location</Trans>
                  {match.path.map((part, index) => (
                    <span key={part.id} className="inline-flex max-w-full items-center gap-1">
                      {index > 0 && <ChevronEndIcon className="size-3" aria-hidden="true" />}
                      <bdi className="break-words">{part.name}</bdi>
                    </span>
                  ))}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <time dateTime={match.capturedAt} className="text-small text-ink-3">
                  {fmt.date(match.capturedAt)}
                </time>
                <Button variant="secondary" size="small" onPress={() => setEvidence(match)}>
                  <Trans>View stored photo</Trans>
                </Button>
              </div>
            </li>
          ))}
        </List>
      )}
      {evidence && (
        <Evidence
          key={evidence.attachmentId}
          match={evidence}
          onClose={() => setEvidence(undefined)}
        />
      )}
    </Section>
  );
}
