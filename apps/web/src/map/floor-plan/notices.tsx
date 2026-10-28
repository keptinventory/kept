/**
 * The floor plan's notices on the map (1.14.3, D266, spec §4, §5.2, §11): the map's empty state
 * ("No rooms on the map yet"), why a plan can't be read here (the room tray's three lines, word
 * for word), and an open plan's state where Arrange's hints go (reading, waiting, failed, not a
 * plan, no rooms, ready to check).
 */
import type { ProviderKind } from '@kept/shared';
import { Trans } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { captureApi, captureKeys } from '@/api/capture/queries';
import type { FloorPlanView } from '@/api/map/types';
import { useLocations } from '@/api/queries';
import { useFormat } from '@/lib/format';
import { TRY } from '@/try/flag';

/** Whether a plan can be read in this location (the ai_capture module and its provider). */
export type PlanAi =
  | { kind: 'on' }
  | { kind: 'off'; location: string }
  | { kind: 'no_provider' }
  | { kind: 'paused'; until: string | null };

export function usePlanAi(
  locationId: string,
  name: string,
): { ai: PlanAi; provider: ProviderKind | null } {
  // As the room tray decides it (capture-screen.tsx): AI capture effective here, else no provider
  // (the status says so) or off; then the budget.
  const locations = useLocations();
  const loc = locations.data?.find((l) => l.id === locationId);
  const aiOn = loc?.effectiveModules?.includes('ai_capture') ?? false;
  const status = useQuery({
    queryKey: captureKeys.ai.status(locationId),
    queryFn: () => captureApi.aiStatus(locationId),
    enabled: !TRY && !!loc,
  });
  if (TRY) return { ai: { kind: 'on' }, provider: null };
  if (!aiOn) {
    return status.data && !status.data.resolved
      ? { ai: { kind: 'no_provider' }, provider: null }
      : { ai: { kind: 'off', location: name }, provider: null };
  }
  const s = status.data;
  if (s?.pausedUntil && s.reason !== 'manual') {
    return {
      ai: {
        kind: 'paused',
        until: Number.isFinite(Date.parse(s.pausedUntil)) ? s.pausedUntil : null,
      },
      provider: s.providerKind,
    };
  }
  return { ai: { kind: 'on' }, provider: s?.providerKind ?? null };
}

/** Why a plan can't be read here: the same three lines as the room tray. Announced as a status
 * on the empty map; in Arrange's tools it is From a plan's description instead. */
export function BlockedLine({ ai, announce = true }: { ai: PlanAi; announce?: boolean }) {
  const fmt = useFormat();
  if (ai.kind === 'on') return null;
  return (
    <p className="kplan-note" {...(announce ? { role: 'status' } : {})}>
      {ai.kind === 'off' ? (
        <Trans>
          AI capture is off in <bdi>{ai.location}</bdi>. An owner or admin can turn it on.
        </Trans>
      ) : ai.kind === 'no_provider' ? (
        <Trans>No AI provider that reads photos is set up. Ask your instance admin.</Trans>
      ) : ai.until ? (
        <Trans>Paused: the AI budget is used up until {fmt.dateTime(ai.until)}.</Trans>
      ) : (
        <Trans>Paused: the AI budget is used up.</Trans>
      )}
    </p>
  );
}

/** The map with no rooms: a first step (spec §4). */
export function EmptyMap({
  ai,
  onStart,
  onArrange,
}: {
  ai: PlanAi;
  onStart: () => void;
  onArrange: () => void;
}) {
  return (
    <div className="kplan-empty" data-map-obstacle>
      <h2>
        <Trans>No rooms on the map yet</Trans>
      </h2>
      <p>
        <Trans>Start from a floor plan, or draw the rooms yourself.</Trans>
      </p>
      <BlockedLine ai={ai} />
      <div className="kmap-row">
        {ai.kind === 'on' ? (
          <button type="button" className="kmap-btn primary" onClick={onStart}>
            <Trans>Start from a floor plan</Trans>
          </button>
        ) : null}
        <button type="button" className="kmap-btn" onClick={onArrange}>
          <Trans>Arrange</Trans>
        </button>
      </div>
    </div>
  );
}

/** An open plan's state, where Arrange's hints go (spec §5.2). */
export function PlanState({
  plan,
  onCheck,
  onRetry,
  onDiscard,
  onChoose,
  onDraw,
}: {
  plan: FloorPlanView;
  onCheck: () => void;
  onRetry: () => void;
  onDiscard: () => void;
  onChoose: () => void;
  onDraw: () => void;
}) {
  const fmt = useFormat();
  const read = plan.read?.status;
  const pdf = plan.file?.mime === 'application/pdf';
  const discard = (
    <button type="button" className="kmap-btn" onClick={onDiscard}>
      <Trans>Discard</Trans>
    </button>
  );
  let body: React.ReactNode;
  if (plan.status === 'failed' || read === 'failed') {
    body = (
      <>
        <span>
          <Trans>Couldn’t read this plan.</Trans>
          {pdf ? (
            <>
              {' '}
              <Trans>For a PDF, try a screenshot of the plan.</Trans>
            </>
          ) : null}
        </span>
        <span className="kmap-row">
          <button type="button" className="kmap-btn" onClick={onRetry}>
            <Trans>Try again</Trans>
          </button>
          {discard}
        </span>
      </>
    );
  } else if (plan.status === 'ready' && plan.drafts && !plan.drafts.isPlan) {
    body = (
      <>
        <span>
          <Trans>This doesn’t look like a floor plan.</Trans>
        </span>
        <span className="kmap-row">
          <button type="button" className="kmap-btn" onClick={onChoose}>
            <Trans>Choose another file</Trans>
          </button>
          {discard}
        </span>
      </>
    );
  } else if (plan.status === 'ready' && plan.drafts && plan.drafts.rooms.length === 0) {
    body = (
      <>
        <span>
          <Trans>No rooms found on this plan.</Trans>
        </span>
        <span className="kmap-row">
          <button type="button" className="kmap-btn" onClick={onRetry}>
            <Trans>Try again</Trans>
          </button>
          <button type="button" className="kmap-btn" onClick={onDraw}>
            <Trans>Draw rooms yourself</Trans>
          </button>
          {discard}
        </span>
      </>
    );
  } else if (plan.status === 'ready') {
    body = (
      <>
        <span>
          <Trans>A floor plan is ready to check.</Trans>
        </span>
        <span className="kmap-row">
          <button type="button" className="kmap-btn primary" onClick={onCheck}>
            <Trans>Check it</Trans>
          </button>
          {discard}
        </span>
      </>
    );
  } else if (read === 'paused_budget') {
    body = plan.read?.pausedUntil ? (
      <Trans>Paused: the AI budget is used up until {fmt.dateTime(plan.read.pausedUntil)}.</Trans>
    ) : (
      <Trans>Paused: the AI budget is used up.</Trans>
    );
  } else if (read === 'waiting_provider' || read === 'no_provider') {
    body = <Trans>Waiting for an AI provider · ask an admin to connect one</Trans>;
  } else {
    body = (
      <>
        <span>
          <Trans>Reading the plan…</Trans>
        </span>
        <span className="text-ink-3">
          <Trans>You can leave; the plan waits on the map.</Trans>
        </span>
      </>
    );
  }
  return (
    <div className="kmap-hint kplan-state" role="status" data-map-obstacle>
      {body}
    </div>
  );
}
