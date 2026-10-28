/**
 * After an archive import, the offer to add search words with AI (D41, D69,
 * D206): the estimate first ("About 40,000 tokens · ≈ USD 0.03 · paid by Home", or "cost unknown"
 * when the model has no price), and nothing runs until the person asks: off by default. The money
 * is left out where the server hid it. With no AI here there is no offer, and nothing is asked:
 * the estimate is read only where AI capture is on in the run's location for the caller (the
 * server's own rule, enrich/routes.ts; a refusal still shows nothing).
 */
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { portabilityApi, useEnrichEstimate } from '@/api/portability/queries';
import { useLocation } from '@/api/queries';
import { useApproxCost, useProviderName } from '@/components/ai/labels';
import { AssistantIcon } from '@/components/icons';
import { Notice, useErrorText } from '@/components/page';
import { accessOf } from '@/components/schedules/access';
import { Button } from '@/components/ui/button';
import { useFormat } from '@/lib/format';

export function EnrichOffer({ runId, locationId }: { runId: string; locationId: string }) {
  const { t } = useLingui();
  const f = useFormat();
  const errorText = useErrorText();
  const access = accessOf(useLocation(locationId).data);
  const aiOn = access.can('ai.capture') && access.moduleOn('ai_capture');
  const estimate = useEnrichEstimate(aiOn ? runId : null);
  const approx = useApproxCost();
  const providerName = useProviderName();
  const [started, setStarted] = useState(false);
  const start = useMutation({
    mutationFn: () => portabilityApi.enrich(runId),
    onSuccess: () => setStarted(true),
  });

  const e = estimate.data;
  if (!e || e.things === 0) return null;
  if (started)
    return (
      <Notice tone="ok" title={<Trans>Adding search words</Trans>}>
        <Trans>It runs in the background; the things gain their words over the next minutes.</Trans>
      </Notice>
    );

  const tokens = f.num(e.tokens.input + e.tokens.output);
  const cost = e.cost
    ? approx(e.cost.amount, e.cost.currency)
    : e.costSource === 'unknown'
      ? t`cost unknown`
      : null;
  const payer = e.payer.label;
  const provider = providerName(e.provider.kind);

  return (
    <section
      aria-labelledby="enrich-offer"
      className="grid gap-2.5 rounded-[10px] border border-line bg-surface p-3.5"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-sunken text-ink-2 [&_svg]:size-5">
          <AssistantIcon />
        </span>
        <div className="grid gap-1">
          <h3 id="enrich-offer" className="m-0 font-semibold text-[16px]">
            <Trans>Add search words with AI?</Trans>
          </h3>
          <p className="m-0 text-small text-ink-2">
            <Trans>
              Words in each of the location's languages for every imported thing, so "drill" finds
              "Bosch GSB 18V".
            </Trans>{' '}
            <Plural value={e.things} one="# thing" other="# things" />
            {f.sep}
            <span className="whitespace-nowrap">
              <Trans>about {tokens} tokens</Trans>
            </span>
            {cost ? (
              <>
                {f.sep}
                <span className="whitespace-nowrap">{cost}</span>
              </>
            ) : null}
            {f.sep}
            <span className="whitespace-nowrap">
              <Trans>
                paid by <bdi>{payer}</bdi>
              </Trans>
            </span>
            {f.sep}
            <bdi>{provider}</bdi>
          </p>
        </div>
      </div>
      {start.isError ? (
        <Notice tone="danger" title={<Trans>That didn't work</Trans>}>
          {errorText(start.error)}
        </Notice>
      ) : null}
      <Button
        variant="secondary"
        className="justify-self-start"
        isPending={start.isPending}
        onPress={() => start.mutate()}
      >
        <Trans>Add search words</Trans>
      </Button>
    </section>
  );
}
