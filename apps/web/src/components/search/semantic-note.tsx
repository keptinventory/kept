/**
 * Semantic search's notes (D200, D206): when the server searched by words
 * only, Search says why, quietly, above the results: "Semantic search paused · keyword results"
 * (a cap, until when), the provider's limit, the server's embeddings off, or "Searched by name
 * only" with the way to Settings → AI where the Search model is chosen (#368). Nothing when meaning
 * was searched too. Offline, search runs on the
 * phone, which never embeds, and this note isn't shown (results.tsx).
 */
import { Trans } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import type { SemanticState } from '@/api/inventory/types';
import { InfoIcon } from '@/components/icons';
import { useFormat } from '@/lib/format';

export function SemanticNote({ semantic }: { semantic: SemanticState | null | undefined }) {
  const f = useFormat();
  if (!semantic) return null;
  const until = semantic.until ? f.day(semantic.until) : null;
  return (
    <p
      data-semantic-note=""
      className="m-0 flex items-start gap-2 text-small text-ink-2 [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0"
    >
      <InfoIcon aria-hidden="true" />
      <span>
        {semantic.state === 'paused' ? (
          until ? (
            <Trans>Semantic search paused until {until} · keyword results</Trans>
          ) : (
            <Trans>Semantic search paused · keyword results</Trans>
          )
        ) : semantic.state === 'waiting' ? (
          <Trans>Semantic search is waiting for the AI provider · keyword results</Trans>
        ) : semantic.state === 'off' ? (
          <Trans>Semantic search is off on this server · keyword results</Trans>
        ) : (
          <Trans>
            Searched by name only: no embeddings model is set, so "laptop" won't find a MacBook Pro.{' '}
            <Link to="/settings/ai" className="font-semibold text-ink underline underline-offset-2">
              Settings → AI
            </Link>
          </Trans>
        )}
      </span>
    </p>
  );
}

/** "matched by meaning": a result found by what it is, not by its words. */
export function MatchedByMeaning() {
  return (
    <span className="text-small text-ink-2">
      <Trans>matched by meaning</Trans>
    </span>
  );
}
