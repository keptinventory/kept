/**
 * A blank label, claimed on its first scan (D43): "New box here"
 * (a name and a place), "Attach to an existing thing" (search) or "Attach to an existing place"
 * (#329: a room, shelf or spot, searchable, from the phone's places). Only for things and places in
 * the location the sheet was printed for. Opened from a place's "Add a label" (`forPlace`), it
 * leads with that place.
 *
 * Online, the claim is `POST /codes/:code/claim`; a 409 `label_claimed` means another phone won:
 * "This label was claimed on another phone for 'Camping box'" · Open that box · Use another label.
 * Offline (or when the call can't reach the server) the claim is a `claim_label` op in the queue,
 * pending until it syncs; the server decides who wins then (D112), and a loss comes back as a
 * notice.
 *
 * With `onClaimed` (a scan session's Unmatched list) nothing is opened: the caller is told what
 * happened, the race included, and stays where it is.
 */
import { newId } from '@kept/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Button as AriaButton, Form } from 'react-aria-components';
import { captureApi } from '@/api/capture/queries';
import type { ClaimBody, LabelClaimedDetails } from '@/api/capture/types';
import { isApiError } from '@/api/client';
import { inventoryApi, inventoryKeys } from '@/api/inventory/queries';
import {
  BoxIcon,
  ChevronEndIcon,
  HomeIcon,
  LinkIcon,
  SearchIcon,
  TagIcon,
} from '@/components/icons';
import { IdChip, LabelTape } from '@/components/id-chip';
import { markJustPrinted } from '@/components/labels/just-printed';
import { Notice, Pill, useErrorText } from '@/components/page';
import type { PickedPlace } from '@/components/places/move-picker';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { AnswerFrame, type AnswerProps } from './outcome-sheet';
import { queueItem } from './resolve';
import { defaultPlace, usePhoneWorld, WherePicker } from './where-picker';

type Step =
  | { step: 'choose' }
  | { step: 'new' }
  | { step: 'attach' }
  | { step: 'place' }
  | { step: 'race'; claimedFor: LabelClaimedDetails['claimedFor'] };

const optionClass =
  'flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-start outline-none data-focus-visible:outline-2 data-focus-visible:outline-info data-hovered:bg-sunken [&_svg]:size-5';

/** What a claim came to, for `onClaimed`. */
export type ClaimDone =
  | { label: string; queued: boolean }
  | { claimedFor: LabelClaimedDetails['claimedFor'] };

export function ClaimSheet({
  code,
  locationId,
  store,
  online,
  onCamera,
  onOpen,
  onAgain,
  onQueued,
  forPlace,
  onClaimed,
}: Pick<AnswerProps, 'store' | 'online' | 'onCamera' | 'onOpen' | 'onAgain' | 'onQueued'> & {
  code: string;
  locationId: string;
  /** The place whose page asked for a label (#329): offered first. */
  forPlace?: string | undefined;
  onClaimed?: (done: ClaimDone) => void;
}) {
  const { t } = useLingui();
  const errorText = useErrorText();
  const qc = useQueryClient();
  const [s, setS] = useState<Step>({ step: 'choose' });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const world = usePhoneWorld(store, [locationId]);
  const here = defaultPlace(world);
  const asked = forPlace ? world?.places[locationId]?.find((p) => p.id === forPlace) : undefined;

  /** Claims the label for `body`; `primary` is the target's own code, when it has one. */
  const claim = async (body: ClaimBody, label: string, primary: string | null = null) => {
    setBusy(true);
    setProblem(null);
    try {
      if (online) {
        try {
          const r = await captureApi.claim(code, body);
          // A claimed blank is a printed label: what it went to shows the tape, printing once.
          markJustPrinted([code, primary]);
          void qc.invalidateQueries({ queryKey: inventoryKeys.things.all });
          void qc.invalidateQueries({ queryKey: inventoryKeys.places.all });
          toast({ title: t`Label claimed for ${label}`, tone: 'ok' });
          if (onClaimed) onClaimed({ label, queued: false });
          else onOpen({ kind: r.target.kind, id: r.target.id, locationId });
          return;
        } catch (e) {
          if (isApiError(e) && e.code === 'label_claimed') {
            const d = e.details as Partial<LabelClaimedDetails>;
            if (d.claimedFor) {
              if (onClaimed) onClaimed({ claimedFor: d.claimedFor });
              else setS({ step: 'race', claimedFor: d.claimedFor });
              return;
            }
          }
          if (!(isApiError(e) && e.code === 'offline')) {
            setProblem(errorText(e));
            return;
          }
        }
      }
      if (!store) {
        setProblem(t`Needs a connection. Try again when you're back online.`);
        return;
      }
      // The op's target is the claim route's body: a thing, a place, or a new box in either.
      await store.enqueue(
        queueItem('claim_label', locationId, { code, target: body }, { key: `claim:${code}` }),
        [],
      );
      onQueued?.();
      toast({
        title: t`Label claimed for ${label} on this phone`,
        description: t`It's pending until it syncs. If another phone claimed it first, you'll be told.`,
        tone: 'ok',
      });
      if (onClaimed) onClaimed({ label, queued: true });
      else onAgain();
    } catch (e) {
      setProblem(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const head = (
    <div className="flex flex-wrap items-center gap-2">
      <IdChip code={code} />
      <Pill icon={<TagIcon />}>
        <Trans>Blank label</Trans>
      </Pill>
    </div>
  );

  if (s.step === 'race') {
    const other = s.claimedFor;
    return (
      <AnswerFrame label={t`Scan result`} onCamera={onCamera}>
        {head}
        <h2 className="m-0 font-semibold text-[19px]">
          <Trans>Already claimed</Trans>
        </h2>
        <p className="m-0 text-ink-2">
          <Trans>
            This label was claimed on another phone for “<bdi>{other.name}</bdi>”.
          </Trans>
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onPress={onAgain}>
            <Trans>Use another label</Trans>
          </Button>
          <Button onPress={() => onOpen({ kind: other.kind, id: other.id, locationId })}>
            {other.kind === 'thing' ? t`Open that box` : t`Open that place`}
          </Button>
        </div>
      </AnswerFrame>
    );
  }

  if (s.step === 'new' || s.step === 'place') {
    const existing = s.step === 'place';
    return (
      <AnswerFrame
        label={existing ? t`Attach to an existing place` : t`New box here`}
        onCamera={onCamera}
      >
        {head}
        <NewBoxForm
          store={store}
          locationId={locationId}
          busy={busy}
          problem={problem}
          existing={existing}
          onCancel={() => setS({ step: 'choose' })}
          onSubmit={(name, place) => {
            if (existing) void claim({ placeId: place.placeId }, place.name);
            else void claim({ newContainer: { id: newId(), name, placeId: place.placeId } }, name);
          }}
        />
      </AnswerFrame>
    );
  }

  if (s.step === 'attach') {
    return (
      <AnswerFrame label={t`Attach to an existing thing`} onCamera={onCamera}>
        {head}
        <AttachSearch
          store={store}
          online={online}
          locationId={locationId}
          busy={busy}
          problem={problem}
          onCancel={() => setS({ step: 'choose' })}
          onPick={(thing) => void claim({ thingId: thing.id }, thing.name ?? '', thing.shortCode)}
        />
      </AnswerFrame>
    );
  }

  return (
    <AnswerFrame label={t`Scan result`} onCamera={onCamera}>
      {head}
      <h2 className="m-0 font-semibold text-[19px]">
        <Trans>Claim this label</Trans>
      </h2>
      <p className="m-0 text-ink-2">
        <Trans>This label isn't on anything yet. Use it for:</Trans>
      </p>
      {asked ? (
        <Choice
          icon={<HomeIcon />}
          isDisabled={busy}
          onPress={() => void claim({ placeId: asked.id }, asked.name)}
          title={
            <Trans>
              Attach to <bdi>{asked.name}</bdi>
            </Trans>
          }
        />
      ) : null}
      <Choice
        icon={<BoxIcon />}
        amber
        onPress={() => setS({ step: 'new' })}
        title={<Trans>New box here</Trans>}
        sub={here?.name ? <bdi>{here.name}</bdi> : null}
      />
      <Choice
        icon={<LinkIcon />}
        onPress={() => setS({ step: 'attach' })}
        title={<Trans>Attach to an existing thing</Trans>}
        sub={<Trans>Search for it by name</Trans>}
      />
      <Choice
        icon={<HomeIcon />}
        onPress={() => setS({ step: 'place' })}
        title={<Trans>Attach to an existing place</Trans>}
        sub={<Trans>A room, shelf or spot</Trans>}
      />
      {problem ? <Notice tone="danger">{problem}</Notice> : null}
      <p className="m-0 text-small text-ink-3">
        <Trans>
          Works offline. The claim stays pending until it syncs; if another phone claimed this label
          first, you'll be told.
        </Trans>
      </p>
      <Button variant="secondary" onPress={onAgain}>
        {onClaimed ? <Trans>Back</Trans> : <Trans>Scan again</Trans>}
      </Button>
    </AnswerFrame>
  );
}

/** One of the claim's choices. */
function Choice({
  icon,
  title,
  sub,
  amber = false,
  isDisabled,
  onPress,
}: {
  icon: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  amber?: boolean;
  isDisabled?: boolean;
  onPress: () => void;
}) {
  return (
    <AriaButton onPress={onPress} isDisabled={isDisabled ?? false} className={optionClass}>
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-lg ${amber ? 'bg-amber text-amber-ink' : 'bg-sunken text-ink-2'}`}
      >
        {icon}
      </span>
      <span className="grid min-w-0 flex-1">
        <span className="font-semibold [overflow-wrap:anywhere]">{title}</span>
        {sub ? <span className="text-small text-ink-3 [overflow-wrap:anywhere]">{sub}</span> : null}
      </span>
      <ChevronEndIcon className="shrink-0 text-ink-3" />
    </AriaButton>
  );
}

/** "New box here" (a name and a place), or with `existing` the place a label goes on. */
function NewBoxForm({
  store,
  locationId,
  busy,
  problem,
  existing,
  onCancel,
  onSubmit,
}: {
  store: AnswerProps['store'];
  locationId: string;
  busy: boolean;
  problem: string | null;
  existing: boolean;
  onCancel: () => void;
  onSubmit: (name: string, place: PickedPlace) => void;
}) {
  const { t } = useLingui();
  const [name, setName] = useState('');
  const [place, setPlace] = useState<PickedPlace | null>(null);
  const [tried, setTried] = useState(false);
  const pick = useCallback((p: PickedPlace) => setPlace(p), []);
  const trimmed = name.trim();
  const nameError = tried && !trimmed ? t`Give the box a name.` : undefined;
  return (
    <Form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if ((trimmed || existing) && place) onSubmit(trimmed.slice(0, 200), place);
      }}
    >
      <h2 className="m-0 font-semibold text-[19px]">
        {existing ? <Trans>Attach to an existing place</Trans> : <Trans>New box here</Trans>}
      </h2>
      {existing ? null : (
        <TextField
          label={t`Name`}
          value={name}
          onChange={setName}
          isInvalid={!!nameError}
          errorMessage={nameError}
          maxLength={200}
          autoFocus
          placeholder={t`Camping box`}
        />
      )}
      <WherePicker
        store={store}
        label={existing ? t`Place` : t`Where it is`}
        locationIds={[locationId]}
        value={place}
        onChange={pick}
        existing={existing}
      />
      {problem ? <Notice tone="danger">{problem}</Notice> : null}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onPress={onCancel}>
          <Trans>Back</Trans>
        </Button>
        <Button type="submit" isPending={busy} isDisabled={!place}>
          <Trans>Claim</Trans>
        </Button>
      </div>
    </Form>
  );
}

type Hit = {
  id: string;
  name: string | null;
  shortCode: string | null;
  labelPrinted?: boolean | undefined;
};

function AttachSearch({
  store,
  online,
  locationId,
  busy,
  problem,
  onCancel,
  onPick,
}: {
  store: AnswerProps['store'];
  online: boolean;
  locationId: string;
  busy: boolean;
  problem: string | null;
  onCancel: () => void;
  onPick: (thing: Hit) => void;
}) {
  const { t } = useLingui();
  const [q, setQ] = useState('');
  const [local, setLocal] = useState<Hit[]>([]);
  const query = q.trim();
  const server = useQuery({
    queryKey: ['scan', 'attach', locationId, query],
    queryFn: () => inventoryApi.things({ locationId, q: query, limit: 20 }),
    enabled: online && query.length > 0,
  });
  useEffect(() => {
    if (online || !store || !query) {
      setLocal([]);
      return;
    }
    let live = true;
    void store.search(query, 40).then((rows) => {
      if (live) setLocal(rows.filter((r) => r.locationId === locationId).slice(0, 20));
    });
    return () => {
      live = false;
    };
  }, [online, store, query, locationId]);
  const hits: Hit[] = online ? (server.data?.items ?? []) : local;
  return (
    <div className="grid gap-3">
      <h2 className="m-0 font-semibold text-[19px]">
        <Trans>Attach to an existing thing</Trans>
      </h2>
      <TextField
        label={t`Search`}
        type="search"
        value={q}
        onChange={setQ}
        autoFocus
        placeholder={t`Name, or its code`}
      />
      {query ? (
        hits.length ? (
          <ul
            aria-label={t`Results`}
            className="m-0 grid max-h-64 list-none gap-1.5 overflow-y-auto p-0"
          >
            {hits.map((h) => (
              <li key={h.id}>
                <AriaButton isDisabled={busy} onPress={() => onPick(h)} className={optionClass}>
                  <bdi className="min-w-0 flex-1 font-semibold [overflow-wrap:anywhere]">
                    {h.name ?? t`Unnamed`}
                  </bdi>
                  <LabelTape
                    code={h.shortCode}
                    printed={h.labelPrinted}
                    pending={h.shortCode === null}
                  />
                </AriaButton>
              </li>
            ))}
          </ul>
        ) : server.isFetching ? null : (
          <p className="m-0 flex items-center gap-2 text-small text-ink-3 [&_svg]:size-4">
            <SearchIcon />
            <Trans>Nothing here matches.</Trans>
          </p>
        )
      ) : null}
      {problem ? <Notice tone="danger">{problem}</Notice> : null}
      <Button variant="secondary" onPress={onCancel}>
        <Trans>Back</Trans>
      </Button>
    </div>
  );
}
