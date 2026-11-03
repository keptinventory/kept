/**
 * "Search matches names only" (#368): AI settings' warning when a provider has a chat model but no
 * embeddings model, so search can't match by meaning ("laptop" won't find a MacBook Pro). Shown
 * unless the location's cascade finds an embeddings model anyway (GET /ai/status's
 * `searchByMeaning`, a key further up such as this server's), and never while the server's
 * embeddings are local or off. The one step: choose a Search model under Advanced, or, for a
 * provider that has none (Groq, Anthropic), another provider there.
 */
import type { EmbeddingsSource, ProviderKind } from '@kept/shared';
import { Trans } from '@lingui/react/macro';
import type { AiProvider, AiStatus } from '@/api/capture/types';
import { Notice } from '@/components/page';
import { Button } from '@/components/ui/button';
import { useProviderName } from './labels';

/** Providers with no embeddings model at all (users/ai-providers.md's table). */
export const NO_EMBEDDINGS_KINDS: ReadonlySet<ProviderKind> = new Set(['groq', 'anthropic']);

/** Whether the warning applies: chat but no Search model, and nothing further up gives one. */
export function searchByNameOnly(
  provider: AiProvider | null,
  statuses: readonly (AiStatus | undefined)[],
  source: EmbeddingsSource | undefined,
): boolean {
  if (!provider || provider.disabled || !provider.models.chat || provider.models.embeddings) {
    return false;
  }
  if (source === 'off' || source === 'local') return false;
  return !statuses.some((s) => s?.searchByMeaning === true);
}

export function SearchByNameNotice({
  provider,
  onChoose,
}: {
  provider: AiProvider;
  /** Opens Advanced, where the Search model and the provider are chosen. */
  onChoose: () => void;
}) {
  const providerName = useProviderName()(provider.kind);
  const none = NO_EMBEDDINGS_KINDS.has(provider.kind);
  return (
    <Notice
      tone="warn"
      title={<Trans>Search matches names only</Trans>}
      action={
        <Button size="small" variant="secondary" onPress={onChoose}>
          {none ? <Trans>Choose another provider</Trans> : <Trans>Choose a Search model</Trans>}
        </Button>
      }
    >
      {none ? (
        <Trans>
          {providerName} has no embeddings model, so search can't match by meaning: "laptop" won't
          find a MacBook Pro. Search by meaning needs a provider with one, such as OpenAI or Google,
          chosen under Advanced.
        </Trans>
      ) : (
        <Trans>
          No Search model is chosen, so search can't match by meaning: "laptop" won't find a MacBook
          Pro. Choose one under Advanced → Models.
        </Trans>
      )}
    </Notice>
  );
}
