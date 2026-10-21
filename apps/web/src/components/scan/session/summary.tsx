/**
 * A scan session's summary, and its state once saved (#168). Nothing is marked missing without a
 * tap: missing things and things found elsewhere default to Leave. A viewer's check has nothing
 * to choose and nothing to save. Each group is paged (50 at a time), and the search finds a row
 * in any of them.
 *
 * Once saved, it says where the save is: waiting for a connection, saved (its totals, and Undo
 * while it lasts), or refused (the person can no longer edit there; the summary stays on the
 * phone until dismissed).
 *
 * A count (#172): lent out and in repair are their own groups, never missing; an area nobody
 * counted lists its things under "Not counted: Back shelf" with "I checked it"; a thing counted
 * in number has − and + on its row and, short, "Mark the rest not here"; in a shared count, what
 * others found is listed as theirs, and finishing needs a connection.
 */
import type { Role } from '@kept/shared';
import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { captureApi } from '@/api/capture/queries';
import type { ScanSessionView } from '@/api/capture/types';
import { CountStepper } from '@/components/boxcheck/count-stepper';
import { undoEvents } from '@/components/history/undo';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { TextField } from '@/components/ui/text-field';
import { TickBox } from '@/components/ui/tick-box';
import { toast } from '@/components/ui/toast';
import { useFormat } from '@/lib/format';
import type { ScanStore } from '../resolve';
import {
  type Choices,
  checkArea,
  counter,
  type ExpectedThing,
  quantityOf,
  type Session,
  type SessionRead,
  type SessionTarget,
  setQuantity,
  summarise,
} from './model';

const PAGE = 50;

type Status =
  | { state: 'waiting' }
  | { state: 'saved'; view: ScanSessionView | null }
  | { state: 'refused'; reason: string };

export function SessionSummary({
  session,
  phase,
  online,
  store,
  targetName,
  whereOf,
  roles,
  onBack,
  onSave,
  onDone,
  onUpdate,
  onOpenCount,
  finishOffline = false,
}: {
  session: Session;
  phase: 'summary' | 'saved';
  online: boolean;
  store: ScanStore | null;
  targetName: (t: SessionTarget) => string;
  whereOf: (r: SessionRead) => string | null;
  roles: (locationId: string) => Role | null;
  onBack: () => void;
  onSave: (choices: Choices, contentsSeen: boolean) => Promise<void>;
  onDone: () => Promise<void>;
  /** A change on the summary kept with the session: a found count, "I checked it". */
  onUpdate?: (s: Session) => void;
  /** Saved: opens the count's page (Counts), done with the session. */
  onOpenCount?: () => Promise<void>;
  /** A shared count, offline: finishing it needs a connection. */
  finishOffline?: boolean;
}) {
  const { t } = useLingui();
  const fmt = useFormat();
  const sum = useMemo(() => summarise(session, roles), [session, roles]);
  const [notHere, setNotHere] = useState<Set<string>>(new Set());
  const [moveHere, setMoveHere] = useState<Set<string>>(new Set());
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [rest, setRest] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const editable = !session.checkOnly;
  const isCount = session.mode === 'count';

  // Once saved: where the save is, checked again every few seconds while it waits.
  useEffect(() => {
    if (phase !== 'saved' || !session.saving || !store) return;
    const key = session.saving.finishKey;
    let live = true;
    const check = async () => {
      const waiting = (await store.pending()).some((e) => e.idempotencyKey === key);
      if (!live) return;
      if (waiting) {
        setStatus({ state: 'waiting' });
        return;
      }
      const dropped = (await store.notices()).find(
        (n) => n.kind === 'dropped' && n.idempotencyKey === key,
      );
      if (dropped) {
        setStatus({ state: 'refused', reason: String(dropped.result?.reason ?? '') });
        return;
      }
      const view = online ? await captureApi.scanSession(session.id).catch(() => null) : null;
      if (live) setStatus({ state: 'saved', view });
    };
    void check();
    const timer = setInterval(() => void check(), 3000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [phase, session, store, online]);

  const match = (name: string | null | undefined) =>
    !q.trim() || (name ?? '').toLocaleLowerCase().includes(q.trim().toLocaleLowerCase());
  const nameOf = (r: SessionRead) => r.name ?? r.text;
  const toggle = (set: Set<string>, id: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  };

  if (phase === 'saved') {
    const name = targetName(session.target);
    return (
      <div className="grid gap-3 p-4">
        {status === null ? null : status.state === 'waiting' ? (
          <p role="status" className="m-0 text-[15px]">
            {online ? (
              <Trans>Saving…</Trans>
            ) : (
              <Trans>Waiting to save. It will save when you're online.</Trans>
            )}
          </p>
        ) : status.state === 'refused' ? (
          <p role="alert" className="m-0 text-[15px] text-danger">
            {status.reason === 'not_permitted' || status.reason === 'location_revoked' ? (
              isCount ? (
                <Trans>
                  Couldn't save your count of <bdi>{name}</bdi>: you can no longer edit there.
                </Trans>
              ) : (
                <Trans>Couldn't save this session: you can no longer edit there.</Trans>
              )
            ) : (
              <Trans>Couldn't save this session. What it read is still on this phone.</Trans>
            )}
          </p>
        ) : (
          <SavedTotals view={status.view} />
        )}
        {status?.state === 'saved' && status.view?.undo ? (
          <Button
            variant="secondary"
            onPress={async () => {
              const id = status.view?.undo?.eventId;
              if (!id) return;
              try {
                await undoEvents([id]);
                toast({ title: t`Undone.` });
                setStatus({
                  state: 'saved',
                  view: { ...(status.view as ScanSessionView), undo: undefined } as ScanSessionView,
                });
              } catch {
                toast({
                  title: t`Couldn't undo: something it changed has changed since.`,
                  tone: 'danger',
                });
              }
            }}
          >
            <Trans>Undo the whole session</Trans>
          </Button>
        ) : null}
        {isCount && onOpenCount && status?.state === 'saved' && status.view ? (
          <Button variant="secondary" onPress={() => void onOpenCount()}>
            <Trans>See this count</Trans>
          </Button>
        ) : null}
        <Button onPress={() => void onDone()}>
          <Trans>Done</Trans>
        </Button>
      </div>
    );
  }

  const c = counter(session);
  const group = (title: string, count: number, children: ReactNode, action?: ReactNode) =>
    count === 0 ? null : (
      <section aria-label={title} className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="m-0 flex-1 font-semibold text-[16px]">{title}</h2>
          {action}
        </div>
        {children}
      </section>
    );
  const n = (x: number) => fmt.num(x);

  return (
    <div className="grid gap-5 p-4">
      <p className="m-0 font-semibold text-[28px] tabular-nums">
        {isCount
          ? (() => {
              const found = n(c.found);
              const all = n(c.expected ?? 0);
              return t`${found} of ${all}`;
            })()
          : plural(c.found, { one: '# thing', other: '# things' })}
      </p>
      {session.checkOnly ? (
        <p className="m-0 text-ink-2">
          <Trans>You're a viewer: nothing is saved</Trans>
        </p>
      ) : null}
      {session.reads.length > PAGE ? (
        <TextField label={t`Find in this summary`} value={q} onChange={setQ} type="search" />
      ) : null}

      {isCount ? (
        <>
          {group(
            t`Found (${n(sum.found.length)})`,
            sum.found.length,
            <Rows
              items={sum.found.filter((r) => match(nameOf(r)))}
              render={(r) => {
                const q = r.thingId ? quantityOf(session, r.thingId) : null;
                if (!q || !editable || !onUpdate) return <bdi>{nameOf(r)}</bdi>;
                return (
                  <div className="grid gap-1">
                    <bdi>{nameOf(r)}</bdi>
                    <CountStepper
                      value={Number(q.found)}
                      max={Number(q.of)}
                      name={nameOf(r)}
                      onChange={(v) => onUpdate(setQuantity(session, r.thingId as string, v))}
                    />
                  </div>
                );
              }}
            />,
          )}
          {group(
            t`Found short (${n(sum.short.length)})`,
            sum.short.length,
            <Rows
              items={sum.short.filter((x) => match(nameOf(x.read)))}
              render={(x) => {
                const found = n(Number(x.found));
                const of = n(Number(x.of));
                const id = x.read.thingId as string;
                return editable ? (
                  <ChoiceRow
                    name={`${nameOf(x.read)} (${t`${found} of ${of}`})`}
                    value={rest.has(id) ? 'act' : 'leave'}
                    act={t`Mark the rest not here`}
                    onChange={(v) => setRest((s) => toggle(s, id, v === 'act'))}
                  />
                ) : (
                  <bdi>{nameOf(x.read)}</bdi>
                );
              }}
            />,
          )}
          {group(
            t`Found by others (${n(sum.byOthers.length)})`,
            sum.byOthers.length,
            <Rows
              items={sum.byOthers.filter((x) => match(x.name))}
              render={(x) => (
                <span>
                  <bdi>{x.name ?? t`Unnamed`}</bdi>
                  {x.readBy ? (
                    <span className="text-ink-3 text-small">
                      {' '}
                      <Trans>
                        found by <bdi>{x.readBy}</bdi>
                      </Trans>
                    </span>
                  ) : null}
                </span>
              )}
            />,
          )}
          {group(
            t`Missing (${n(sum.missing.length)})`,
            sum.missing.length,
            <Rows
              items={sum.missing.filter((x) => match(x.name))}
              render={(x: ExpectedThing) =>
                editable ? (
                  <ChoiceRow
                    name={x.name ?? t`Unnamed`}
                    value={notHere.has(x.id) ? 'act' : 'leave'}
                    act={t`Mark not here`}
                    onChange={(v) => setNotHere((s) => toggle(s, x.id, v === 'act'))}
                  />
                ) : (
                  <bdi>{x.name ?? t`Unnamed`}</bdi>
                )
              }
            />,
            editable ? (
              <Button
                size="small"
                variant="secondary"
                onPress={() => setNotHere(new Set(sum.missing.map((x) => x.id)))}
              >
                <Trans>Mark all not here</Trans>
              </Button>
            ) : null,
          )}
          {sum.lent.map((g) =>
            group(
              g.person
                ? t`With ${g.person} (${n(g.things.length)})`
                : t`Lent out (${n(g.things.length)})`,
              g.things.length,
              <Rows
                items={g.things.filter((x) => match(x.name))}
                render={(x: ExpectedThing) => <bdi>{x.name ?? t`Unnamed`}</bdi>}
              />,
            ),
          )}
          {group(
            t`In repair (${n(sum.inRepair.length)})`,
            sum.inRepair.length,
            <Rows
              items={sum.inRepair.filter((x) => match(x.name))}
              render={(x: ExpectedThing) => <bdi>{x.name ?? t`Unnamed`}</bdi>}
            />,
          )}
          {sum.notCounted.map((g) => {
            const area = g.area.name ?? t`Unplaced`;
            return group(
              t`Not counted: ${area} (${n(g.things.length)})`,
              g.things.length,
              <Rows
                items={g.things.filter((x) => match(x.name))}
                render={(x: ExpectedThing) => <bdi>{x.name ?? t`Unnamed`}</bdi>}
              />,
              editable && onUpdate ? (
                <Button
                  size="small"
                  variant="secondary"
                  onPress={() => onUpdate(checkArea(session, g.area.id))}
                >
                  <Trans>I checked it</Trans>
                </Button>
              ) : null,
            );
          })}
          {group(
            t`No label (${n(sum.noLabel.length)})`,
            sum.noLabel.length,
            <Rows
              items={sum.noLabel.filter((x) => match(x.name))}
              render={(x: ExpectedThing) =>
                editable ? (
                  <TickBox
                    isSelected={ticked.has(x.id)}
                    onChange={(v) => setTicked((s) => toggle(s, x.id, v))}
                  >
                    <bdi>{x.name ?? t`Unnamed`}</bdi>
                  </TickBox>
                ) : (
                  <bdi>{x.name ?? t`Unnamed`}</bdi>
                )
              }
            />,
          )}
          {group(
            t`Found elsewhere (${n(sum.elsewhere.length)})`,
            sum.elsewhere.length,
            <Rows
              items={sum.elsewhere.filter((r) => match(nameOf(r)))}
              render={(r) =>
                editable && r.thingId ? (
                  <ChoiceRow
                    name={nameOf(r)}
                    where={whereOf(r)}
                    value={moveHere.has(r.thingId) ? 'act' : 'leave'}
                    act={t`Move here`}
                    onChange={(v) =>
                      setMoveHere((s) => toggle(s, r.thingId as string, v === 'act'))
                    }
                  />
                ) : (
                  <bdi>{nameOf(r)}</bdi>
                )
              }
            />,
            editable ? (
              <Button
                size="small"
                variant="secondary"
                onPress={() =>
                  setMoveHere(
                    (s) =>
                      new Set([
                        ...s,
                        ...sum.elsewhere.flatMap((r) => (r.thingId ? [r.thingId] : [])),
                      ]),
                  )
                }
              >
                <Trans>Move all here</Trans>
              </Button>
            ) : null,
          )}
          {group(
            t`In another location (${n(sum.otherLocation.length)})`,
            sum.otherLocation.length,
            <Rows
              items={sum.otherLocation.filter((r) => match(nameOf(r)))}
              render={(r) =>
                editable && r.canMove && r.thingId ? (
                  <ChoiceRow
                    name={nameOf(r)}
                    where={whereOf(r)}
                    value={moveHere.has(r.thingId) ? 'act' : 'leave'}
                    act={t`Move here`}
                    onChange={(v) =>
                      setMoveHere((s) => toggle(s, r.thingId as string, v === 'act'))
                    }
                  />
                ) : (
                  <span>
                    <bdi>{nameOf(r)}</bdi>{' '}
                    {whereOf(r) ? <bdi className="text-ink-3">{whereOf(r)}</bdi> : null}
                  </span>
                )
              }
            />,
          )}
        </>
      ) : (
        sum.byTarget.map((g) =>
          group(
            `${targetName(g.target)} (${n(g.reads.length)})`,
            g.reads.length,
            <Rows
              items={g.reads.filter((r) => match(nameOf(r)))}
              render={(r) => <bdi>{nameOf(r)}</bdi>}
            />,
          ),
        )
      )}
      {group(
        t`View only (${n(sum.viewOnly.length)})`,
        sum.viewOnly.length,
        <Rows items={sum.viewOnly} render={(r) => <bdi>{nameOf(r)}</bdi>} />,
      )}
      {group(
        t`Unmatched (${n(sum.unmatched.length)})`,
        sum.unmatched.length,
        <>
          <Rows items={sum.unmatched} render={(r) => <bdi dir="ltr">{r.code ?? r.text}</bdi>} />
          {sum.unmatched.some((r) => r.code) ? (
            <p className="m-0 text-ink-3 text-small">
              <Trans>Blank labels can be claimed from Scan, one at a time.</Trans>
            </p>
          ) : null}
        </>,
      )}
      {group(
        t`Not in your Kept (${n(sum.notInYourKept.length)})`,
        sum.notInYourKept.length,
        <Rows items={sum.notInYourKept} render={(r) => <bdi dir="ltr">{r.code ?? r.text}</bdi>} />,
      )}
      {group(
        t`Check later (${n(sum.checkLater.length)})`,
        sum.checkLater.length,
        <Rows items={sum.checkLater} render={(r) => <bdi dir="ltr">{r.text}</bdi>} />,
      )}

      <div className="grid gap-2">
        {editable && finishOffline ? (
          <p role="status" className="m-0 text-ink-2 text-small">
            <Trans>Others are counting here too: finishing needs a connection.</Trans>
          </p>
        ) : null}
        {editable ? (
          <Button
            isPending={busy}
            isDisabled={finishOffline}
            onPress={async () => {
              setBusy(true);
              try {
                await onSave(
                  {
                    notHere: [...notHere],
                    moveHere: [...moveHere],
                    ticked: [...ticked],
                    restNotHere: [...rest],
                  },
                  session.contents,
                );
              } catch {
                toast({ title: t`Couldn't save on this phone. Try again.`, tone: 'danger' });
              } finally {
                setBusy(false);
              }
            }}
          >
            <Trans>Save</Trans>
          </Button>
        ) : (
          <Button onPress={() => void onDone()}>
            <Trans>Done</Trans>
          </Button>
        )}
        <Button variant="secondary" onPress={onBack}>
          <Trans>Back to scanning</Trans>
        </Button>
      </div>
    </div>
  );
}

/** A group's rows, 50 at a time. */
function Rows<T>({ items, render }: { items: readonly T[]; render: (item: T) => ReactNode }) {
  const [shown, setShown] = useState(PAGE);
  return (
    <>
      <ul className="m-0 grid list-none gap-1.5 p-0">
        {items.slice(0, shown).map((x, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: rows have no id of their own (a code read)
          <li key={i} className="text-[15px] [overflow-wrap:anywhere]">
            {render(x)}
          </li>
        ))}
      </ul>
      {items.length > shown ? (
        <Button size="small" variant="ghost" onPress={() => setShown((s) => s + PAGE)}>
          <Trans>Show more</Trans>
        </Button>
      ) : null}
    </>
  );
}

/** One row's choice: Leave (the default) or the act ("Mark not here", "Move here"). */
function ChoiceRow({
  name,
  where,
  value,
  act,
  onChange,
}: {
  name: string;
  where?: string | null;
  value: 'leave' | 'act';
  act: string;
  onChange: (v: 'leave' | 'act') => void;
}) {
  const { t } = useLingui();
  return (
    <div className="grid gap-1.5">
      <span>
        <bdi className="font-medium">{name}</bdi>
        {where ? (
          <span className="text-ink-3 text-small">
            {' '}
            <Trans>
              in <bdi>{where}</bdi>
            </Trans>
          </span>
        ) : null}
      </span>
      <Segmented
        aria-label={name}
        value={value}
        onChange={onChange}
        options={[
          { id: 'leave', label: t`Leave` },
          { id: 'act', label: act },
        ]}
      />
    </div>
  );
}

function SavedTotals({ view }: { view: ScanSessionView | null }) {
  const fmt = useFormat();
  if (!view) {
    return (
      <p role="status" className="m-0 text-[15px]">
        <Trans>Saved.</Trans>
      </p>
    );
  }
  const seen = fmt.num(view.seen);
  const notHere = fmt.num(view.notHere);
  const moved = fmt.num(view.moved);
  const skipped = fmt.num(view.skipped);
  return (
    <div role="status" className="grid gap-1 text-[15px]">
      <p className="m-0 font-semibold">
        <Trans>Saved.</Trans>
      </p>
      {view.mode === 'count' ? (
        <p className="m-0">
          <Trans>
            Seen: {seen}. Not here: {notHere}. Moved here: {moved}.
          </Trans>
        </p>
      ) : (
        <p className="m-0">
          <Trans>Moved: {moved}.</Trans>
        </p>
      )}
      {view.skipped > 0 ? (
        <p className="m-0 text-ink-2">
          <Trans>Left out: {skipped} (trashed or no longer yours to change since).</Trans>
        </p>
      ) : null}
    </div>
  );
}
