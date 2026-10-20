/**
 * A scan session (#168): one camera session that stays open, reads every Kept label in view
 * (several per frame), counts each once, and applies it to a mode: **Count**, **Pack into**,
 * **Move to**. Built for 300–5,000 labels in one walk, online or offline.
 *
 * 1. **Setup:** the mode, and the target: from where it was opened (a place, a box, a move), else
 *    chosen here. A viewer counts as a check: same screen, nothing saved.
 * 2. **Live:** the big counter, the last reads, Undo last read, Pause, Finish; Pack and Move have
 *    Target (the next box or place scanned becomes where things go). Each read is answered by the
 *    phone first (../resolve.ts), the rest in batches from the server. A tone and a coloured box
 *    for each read, a buzz on Android; the counter is read aloud at most every 2 seconds. A USB or
 *    Bluetooth scanner's keys are reads too. No read for a minute pauses it. The screen stays on.
 * 3. **Summary:** found, missing (left alone unless chosen: "Mark not here"), no label (ticked by
 *    hand), found elsewhere ("Move here"), unmatched. **Save** queues the session's ops
 *    (model.ts `sessionOps`): online they go at once, offline when the phone is back.
 * 4. **Saved:** waiting, saved (with Undo while it lasts), or couldn't save, with the summary kept.
 *
 * Every read is written to the phone as it happens (./persist.ts), so a reload, a crash or
 * closing the app loses nothing: Scan offers "Resume session". Service-worker updates wait while
 * it is open.
 *
 * A count (#172) started online is opened on the server, so that someone else counting the same
 * target sees "Count in progress by Sam: Join"; the summary merges what others read (online),
 * and finishing a count others joined needs a connection. The count's setup says how many of the
 * things there have labels, with a link to print the rest.
 */
import {
  can,
  type Role,
  SCAN_SESSION_LIMITS,
  type ScanSessionMode,
  type SnapLocation,
  type SnapPlace,
  type SnapThing,
} from '@kept/shared';
import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { captureApi } from '@/api/capture/queries';
import { countsApi } from '@/api/counts/queries';
import { useMe } from '@/api/queries';
import type { Detect, Detected } from '@/camera/label-recogniser';
import { appDetect, type FrameDecoder } from '@/camera/scanner';
import type { CameraEnv } from '@/camera/session';
import { ShowMe } from '@/components/hints/show-me';
import { XIcon } from '@/components/icons';
import { usePlaceName } from '@/components/places/labels';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm';
import { ChoiceCards } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { useFormat } from '@/lib/format';
import { useLocationName } from '@/lib/labels';
import { useOnline } from '@/lib/online';
import { useHoldUpdates } from '@/pwa/register';
import { type BatchDeps, resolveBatch, type ScanStore } from '../resolve';
import { type Flash, SessionCamera } from './camera';
import { areasFor, expectedFor } from './expected';
import { announceEvery, feel, signalOf, useWakeLock } from './feedback';
import {
  addRead,
  type Choices,
  counter,
  type ExpectedThing,
  finishKey,
  finishNeedsConnection,
  linesOf,
  mergeOthers,
  newSession,
  type ReadInfo,
  readKey,
  resolveLater,
  type Session,
  type SessionRead,
  type SessionTarget,
  sessionOps,
  setTarget,
  summarise,
  undoLast,
} from './model';
import type { SessionPersist } from './persist';
import { SessionSummary } from './summary';
import { wedgeReader } from './wedge';

export type SessionStart = {
  mode?: ScanSessionMode;
  target?: { kind: SessionTarget['kind']; id: string };
};

export type SessionScreenProps = {
  store: ScanStore | null;
  persist: SessionPersist;
  start?: SessionStart;
  onExit: () => void;
  /** After ops were queued: the sync engine's kick. */
  onQueued?: () => void;
  /** A saved count's "See this count": its page. */
  onOpenCount?: (id: string) => void;
  /** The count's setup: print the labels the things there lack. */
  onPrintLabels?: (where: { locationId: string; placeId?: string }) => void;
  // ----- the device, injectable -----
  online?: boolean;
  camera?: CameraEnv;
  detect?: Detect | null;
  decoder?: FrameDecoder | null;
  batch?: BatchDeps['batch'];
  now?: () => string;
};

type Phase = 'loading' | 'resume' | 'setup' | 'live' | 'summary' | 'saved';

/** What the phone knows: every location with its role, and every place's name. */
type World = { locations: SnapLocation[]; places: Map<string, SnapPlace> };

const darkBtn =
  'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[10px] px-3.5 font-semibold text-[14px] outline-none data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-[#F2EFE9] data-disabled:opacity-50';

const KIND_TEXT: Record<string, string> = {
  found: 'text-[#4ADE80]',
  elsewhere: 'text-[#F5B83D]',
  other_location: 'text-[#F5B83D]',
};

export function SessionScreen({
  store,
  persist,
  start,
  onExit,
  onQueued,
  onOpenCount,
  onPrintLabels,
  online: onlineProp,
  camera,
  detect = appDetect(),
  decoder,
  batch,
  now = () => new Date().toISOString(),
}: SessionScreenProps) {
  const { t } = useLingui();
  const fmt = useFormat();
  const placeName = usePlaceName();
  const locName = useLocationName();
  const confirm = useConfirm();
  const browserOnline = useOnline();
  const online = onlineProp ?? browserOnline;
  useHoldUpdates(true);

  const [phase, setPhase] = useState<Phase>('loading');
  const [world, setWorld] = useState<World | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const saving = useRef<Promise<void>>(Promise.resolve());
  const work = useRef<Promise<void>>(Promise.resolve());
  const [awaitingTarget, setAwaitingTarget] = useState(false);
  const awaitingRef = useRef(false);
  awaitingRef.current = awaitingTarget;
  const [flashes, setFlashes] = useState<Flash[]>([]);
  const flashId = useRef(0);
  const [names, setNames] = useState<Record<string, string>>({});
  const [spoken, setSpoken] = useState('');
  const announce = useMemo(() => announceEvery(2000, setSpoken), []);
  const meId = useMe().data?.user.id ?? null;

  // ----- the phone's world and any session already on it ----------------------------------------
  const readWorld = useCallback(async (): Promise<World> => {
    const locations = store ? await store.locations() : [];
    const places = new Map<string, SnapPlace>();
    for (const l of locations)
      for (const p of (await store?.placesOf(l.id)) ?? []) places.set(p.id, p);
    return { locations, places };
  }, [store]);

  useEffect(() => {
    let live = true;
    void (async () => {
      const { locations, places } = await readWorld();
      const held = await persist.load();
      if (!live) return;
      setWorld({ locations, places });
      if (held) {
        sessionRef.current = held;
        setSession(held);
        setPhase(held.saving ? 'saved' : 'resume');
      } else setPhase('setup');
    })();
    return () => {
      live = false;
    };
  }, [readWorld, persist]);

  // While choosing, the phone's copy may still be syncing (a place made a moment ago): read it again.
  useEffect(() => {
    if (phase !== 'setup') return;
    const timer = setInterval(() => void readWorld().then(setWorld), 3000);
    return () => clearInterval(timer);
  }, [phase, readWorld]);

  const roles = useCallback(
    (locationId: string): Role | null =>
      world?.locations.find((l) => l.id === locationId)?.role ?? null,
    [world],
  );

  const commit = useCallback(
    (next: Session) => {
      const prev = sessionRef.current;
      sessionRef.current = next;
      setSession(next);
      saving.current = saving.current
        .then(() => persist.save(prev, next))
        .catch(() => {
          toast({ title: t`This phone couldn't keep the session. Keep the screen open.` });
        });
    },
    [persist, t],
  );

  // ----- reads -------------------------------------------------------------------------------------
  const nameOfThing = useCallback(
    async (id: string): Promise<SnapThing | undefined> => store?.thing(id).catch(() => undefined),
    [store],
  );

  const flash = useCallback((box: Detected['box'], signal: ReturnType<typeof signalOf>) => {
    if (!box || !signal) return;
    const id = ++flashId.current;
    setFlashes((f) => [...f.slice(-11), { id, box, signal }]);
    setTimeout(() => setFlashes((f) => f.filter((x) => x.id !== id)), 700);
  }, []);

  /** A scanned label as a session's target: a box for a pack; a place or a box to count or
   * move to. Null, with a toast, for anything else. */
  const pickByScan = useCallback(
    async (found: Detected[], mode: ScanSessionMode): Promise<SessionTarget | null> => {
      const [first] = found;
      if (!first) return null;
      const [res] = await resolveBatch([{ text: first.rawValue, format: first.format }], {
        store,
        online,
        ...(batch ? { batch } : {}),
      });
      const tgt = res?.outcome === 'open' ? res.target : null;
      const thing = tgt?.kind === 'thing' ? await nameOfThing(tgt.id) : undefined;
      const role = tgt ? roles(tgt.locationId) : null;
      const allowed = !!role && (mode === 'count' || can(role, 'things.edit'));
      const kindOk = tgt?.kind === 'place' ? mode !== 'pack' : thing?.isContainer === true;
      if (!tgt || !allowed || !kindOk) {
        feel('grey');
        toast({ title: mode === 'pack' ? t`Scan a box's label` : t`Scan a place or a box` });
        return null;
      }
      feel('ok');
      if (tgt.kind === 'place') {
        const p = world?.places.get(tgt.id);
        return {
          kind: 'place',
          id: tgt.id,
          locationId: tgt.locationId,
          name: p ? placeName({ name: p.name, isUnplaced: p.isUnplaced }) : null,
          inside: true,
        };
      }
      return {
        kind: 'container',
        id: tgt.id,
        locationId: tgt.locationId,
        name: thing?.name ?? null,
      };
    },
    [store, online, batch, nameOfThing, roles, world, placeName, t],
  );

  const process = useCallback(
    async (found: Detected[]) => {
      let s = sessionRef.current;
      if (!s || s.paused || phase !== 'live') return;
      // A new target (pack, move): the first label that can be one.
      if (awaitingRef.current) {
        const [first] = found;
        if (!first) return;
        const [res] = await resolveBatch([{ text: first.rawValue, format: first.format }], {
          store,
          online,
          ...(batch ? { batch } : {}),
        });
        const tgt = res?.outcome === 'open' ? res.target : null;
        const thing = tgt?.kind === 'thing' ? await nameOfThing(tgt.id) : undefined;
        const ok =
          tgt &&
          can(roles(tgt.locationId) ?? 'viewer', 'things.edit') &&
          (tgt.kind === 'place' ? s.mode === 'move' : thing?.isContainer === true);
        if (!tgt || !ok) {
          feel('grey');
          flash(first.box, 'grey');
          toast({ title: s.mode === 'pack' ? t`Scan a box's label` : t`Scan a place or a box` });
          return;
        }
        const name =
          tgt.kind === 'place' ? (world?.places.get(tgt.id)?.name ?? null) : (thing?.name ?? null);
        commit(
          setTarget(s, {
            kind: tgt.kind === 'place' ? 'place' : 'container',
            id: tgt.id,
            locationId: tgt.locationId,
            name,
          }),
        );
        feel('ok');
        flash(first.box, 'ok');
        setAwaitingTarget(false);
        return;
      }
      // Each code once: the ones this session hasn't handled yet are looked up, together.
      const fresh: Detected[] = [];
      const seenNow = new Set<string>();
      for (const d of found) {
        const key = readKey(d.rawValue, d.format);
        if (seenNow.has(key)) continue;
        seenNow.add(key);
        if (s.keys.includes(key)) {
          if (!key.startsWith('b:') && s.reads.some((r) => r.key === key)) flash(d.box, 'soft');
          continue;
        }
        fresh.push(d);
      }
      if (fresh.length === 0) return;
      const answers = await resolveBatch(
        fresh.map((d) => ({ text: d.rawValue, format: d.format })),
        { store, online, ...(batch ? { batch } : {}) },
      );
      s = sessionRef.current;
      if (!s) return;
      const at = now();
      let loudest: ReturnType<typeof signalOf> = null;
      const known: Record<string, string> = {};
      for (const [i, d] of fresh.entries()) {
        const res = answers[i];
        if (!res) continue;
        const info: ReadInfo = { res };
        if (res.outcome === 'open' && res.target.kind === 'thing') {
          const th = await nameOfThing(res.target.id);
          if (th) {
            info.thing = th;
            if (th.containerId && !names[th.containerId]) {
              const box = await nameOfThing(th.containerId);
              if (box?.name) known[th.containerId] = box.name;
            }
          }
        }
        const out = addRead(s, { text: d.rawValue, format: d.format, at }, info, roles);
        s = out.session;
        const signal = signalOf(out.kind);
        flash(d.box, signal);
        if (out.kind === 'full') {
          toast({ title: t`This session is full: finish it, then start another.`, tone: 'danger' });
          break;
        }
        if (out.kind === 'place' && s.mode === 'count')
          toast({ title: t`That's a place's label. Count it from its own page.` });
        if (out.kind === 'place' && s.mode !== 'count')
          toast({ title: t`A room can't be moved; scan things or boxes` });
        if (signal === 'ok' || (signal === 'amber' && loudest !== 'ok') || !loudest)
          loudest = signal ?? loudest;
      }
      if (Object.keys(known).length > 0) setNames((n) => ({ ...n, ...known }));
      if (loudest) feel(loudest);
      commit(s);
    },
    [phase, store, online, batch, nameOfThing, roles, world, commit, flash, now, t, names],
  );

  const onReads = useCallback(
    (found: Detected[]) => {
      work.current = work.current.then(() => process(found)).catch(() => {});
    },
    [process],
  );

  // Codes read offline that the phone didn't know: answered once online, in their place.
  const laterCount = session?.reads.filter((r) => r.kind === 'check_later').length ?? 0;
  useEffect(() => {
    if (!online || laterCount === 0 || (phase !== 'live' && phase !== 'summary')) return;
    work.current = work.current
      .then(async () => {
        const s = sessionRef.current;
        if (!s) return;
        const later = s.reads.filter((r) => r.kind === 'check_later');
        if (later.length === 0) return;
        const answers = await resolveBatch(
          later.map((r) => ({ text: r.text, ...(r.format ? { format: r.format } : {}) })),
          { store, online, ...(batch ? { batch } : {}) },
        );
        let next = sessionRef.current;
        if (!next) return;
        for (const [i, r] of later.entries()) {
          const res = answers[i];
          if (!res || res.outcome === 'not_on_phone') continue;
          const info: ReadInfo = { res };
          if (res.outcome === 'open' && res.target.kind === 'thing') {
            const th = await nameOfThing(res.target.id);
            if (th) info.thing = th;
          }
          next = resolveLater(next, r.key, info, roles);
        }
        if (next !== sessionRef.current) commit(next);
      })
      .catch(() => {});
  }, [online, laterCount, phase, store, batch, nameOfThing, roles, commit]);

  // A USB or Bluetooth scanner, while the session is live.
  useEffect(() => {
    if (phase !== 'live') return;
    const handler = wedgeReader((text) => onReads([{ rawValue: text, format: '' }]));
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [phase, onReads]);

  // No read for a minute: paused, so the camera and the battery rest.
  const readsCount = session?.reads.length ?? 0;
  const paused = session?.paused ?? false;
  // biome-ignore lint/correctness/useExhaustiveDependencies: each new read starts the minute again
  useEffect(() => {
    if (phase !== 'live' || paused) return;
    const timer = setTimeout(() => {
      const s = sessionRef.current;
      if (s && !s.paused) commit({ ...s, paused: true });
    }, SCAN_SESSION_LIMITS.idlePauseMs);
    return () => clearTimeout(timer);
  }, [phase, paused, readsCount, commit]);

  useWakeLock(phase === 'live' && !paused);

  // ----- what to show --------------------------------------------------------------------------------
  const count = session ? counter(session) : null;
  const counterText =
    session && count
      ? session.mode === 'count'
        ? (() => {
            const found = fmt.num(count.found);
            const all = fmt.num(count.expected ?? 0);
            return t`${found} of ${all}`;
          })()
        : plural(count.found, { one: '# thing', other: '# things' })
      : '';
  useEffect(() => {
    if (phase === 'live' && counterText) announce(counterText);
  }, [phase, counterText, announce]);

  const targetName = (tg: SessionTarget) =>
    tg.kind === 'location'
      ? (() => {
          const l = world?.locations.find((x) => x.id === tg.id);
          return l ? locName(l) : (tg.name ?? '');
        })()
      : tg.kind === 'place'
        ? placeName({
            name: world?.places.get(tg.id)?.name ?? tg.name ?? '',
            isUnplaced: world?.places.get(tg.id)?.isUnplaced ?? false,
          })
        : (tg.name ?? t`Unnamed`);

  const whereOf = (r: SessionRead): string | null => {
    if (r.kind !== 'elsewhere' && r.kind !== 'other_location') return null;
    if (r.containerId) return names[r.containerId] ?? null;
    if (r.placeId) {
      const p = world?.places.get(r.placeId);
      if (p) return placeName({ name: p.name, isUnplaced: p.isUnplaced });
    }
    if (r.locationId && r.locationId !== session?.locationId) {
      const l = world?.locations.find((x) => x.id === r.locationId);
      return l ? locName(l) : null;
    }
    return null;
  };

  const exit = async () => {
    const s = sessionRef.current;
    if (s && phase === 'live' && !s.paused) commit({ ...s, paused: true });
    await saving.current;
    onExit();
  };

  const header = (title: string) => (
    <header className="flex items-center gap-2 px-2 py-2">
      <AriaButton
        aria-label={t`Close`}
        onPress={() => void exit()}
        className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-[10px] outline-none data-focus-visible:outline-2 data-focus-visible:outline-[#F2EFE9] [&_svg]:size-6"
      >
        <XIcon />
      </AriaButton>
      <h1 className="m-0 min-w-0 flex-1 font-semibold text-[18px] [overflow-wrap:anywhere]">
        {title}
      </h1>
    </header>
  );

  const frame = (children: React.ReactNode, dark = true) => (
    <div
      data-focused-task="scan-session"
      className={`fixed inset-0 z-40 flex flex-col overflow-y-auto pt-[env(safe-area-inset-top)] md:relative md:inset-auto md:z-auto md:mx-auto md:my-4 md:min-h-[calc(100dvh-2rem)] md:max-w-[480px] md:rounded-2xl ${
        dark ? 'bg-[#0F0E0D] text-[#F2EFE9]' : 'bg-paper text-ink'
      }`}
    >
      {children}
    </div>
  );

  // A shared count's summary: what the others read so far, merged in (online).
  const sharedId = session?.shared ? session.id : null;
  useEffect(() => {
    if (phase !== 'summary' || !online || !sharedId) return;
    let live = true;
    void countsApi
      .lines(sharedId)
      .then((r) => {
        const cur = sessionRef.current;
        if (!live || cur?.id !== sharedId) return;
        commit(
          mergeOthers(
            cur,
            r.lines.map((l) => ({
              thingId: l.thingId,
              action: l.action,
              readBy: l.readBy?.displayName ?? null,
              readById: l.readBy?.id ?? null,
              foundQty: l.foundQty,
            })),
            r.countedPlaceIds,
            meId,
          ),
        );
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [phase, online, sharedId, meId, commit]);

  if (phase === 'loading' || !world) {
    return (
      <div role="status" aria-busy="true" aria-label={t`Opening the session`}>
        {frame(null)}
      </div>
    );
  }

  if (phase === 'resume' && session) {
    const c = counter(session);
    return frame(
      <>
        {header(t`Scan session`)}
        <div className="grid gap-3 p-4">
          <p className="m-0 text-[15px]">
            {session.mode === 'count' ? (
              <Trans>
                A count of <bdi>{targetName(session.target)}</bdi> is open on this phone.
              </Trans>
            ) : (
              <Trans>A session is open on this phone.</Trans>
            )}{' '}
            {plural(c.reads, { one: '# label read so far.', other: '# labels read so far.' })}
          </p>
          <AriaButton
            onPress={() => {
              commit({ ...session, paused: false });
              setPhase('live');
            }}
            className={`${darkBtn} bg-amber text-amber-ink`}
          >
            <Trans>Resume session</Trans>
          </AriaButton>
          <AriaButton
            onPress={async () => {
              if (
                !(await confirm({
                  title: t`Discard this session?`,
                  body: t`What it read is not saved.`,
                  confirmLabel: t`Discard`,
                  destructive: true,
                }))
              )
                return;
              await persist.clear(session.id);
              sessionRef.current = null;
              setSession(null);
              setPhase('setup');
            }}
            className={`${darkBtn} border border-[#4A463F]`}
          >
            <Trans>Discard it and start another</Trans>
          </AriaButton>
        </div>
      </>,
    );
  }

  if (phase === 'setup' || !session) {
    return frame(
      <>
        {header(t`Scan session`)}
        <SessionSetup
          store={store}
          world={world}
          {...(start ? { start } : {})}
          now={now}
          pickByScan={pickByScan}
          camera={(onPick) => (
            <SessionCamera
              detect={detect}
              {...(decoder !== undefined ? { decoder } : {})}
              paused={false}
              onReads={onPick}
              {...(camera ? { camera } : {})}
              flashes={[]}
            />
          )}
          online={online}
          meId={meId}
          {...(onPrintLabels ? { onPrintLabels } : {})}
          onStart={(s) => {
            commit(s);
            setPhase('live');
            // A count started online is opened on the server, for others to join.
            if (s.mode !== 'count' || s.checkOnly || s.shared || !online) return;
            void countsApi
              .start({
                id: s.id,
                target: headerOf(s.target),
                startedAt: s.startedAt,
              })
              .then(() => {
                const cur = sessionRef.current;
                if (cur?.id === s.id && !cur.shared)
                  commit({ ...cur, shared: { joined: false, by: null, others: [], counted: [] } });
              })
              .catch(() => {});
          }}
        />
      </>,
      false,
    );
  }

  if (phase === 'summary' || phase === 'saved') {
    return frame(
      <>
        {header(phase === 'saved' ? t`Saved` : t`Summary`)}
        <SessionSummary
          session={session}
          phase={phase}
          online={online}
          store={store}
          targetName={targetName}
          whereOf={whereOf}
          roles={roles}
          onUpdate={commit}
          finishOffline={finishNeedsConnection(session) && !online}
          onBack={() => {
            commit({ ...session, paused: false });
            setPhase('live');
          }}
          onSave={async (choices: Choices, contentsSeen: boolean) => {
            if (!store) return;
            const sum = summarise(session, roles);
            const lines = linesOf(session, sum, choices, now());
            const ops = sessionOps(session, lines, { contentsSeen, counted: sum.counted });
            for (const op of ops) await store.enqueue(op, []);
            commit({ ...session, saving: { at: now(), finishKey: finishKey(session) } });
            onQueued?.();
            setPhase('saved');
          }}
          onDone={async () => {
            await persist.clear(session.id);
            sessionRef.current = null;
            onExit();
          }}
          {...(onOpenCount
            ? {
                onOpenCount: async () => {
                  await persist.clear(session.id);
                  sessionRef.current = null;
                  onOpenCount(session.id);
                },
              }
            : {})}
        />
      </>,
      false,
    );
  }

  // ----- live ----------------------------------------------------------------------------------------
  const recent = session.reads.slice(-5).reverse();
  const isCount = session.mode === 'count';
  const demoCodes = session.expected
    .map((x) => x.shortCode)
    .filter((c): c is string => !!c)
    .slice(0, Math.max(1, Math.ceil(session.expected.length * 0.9)));
  return frame(
    <>
      {header(
        isCount
          ? t`Count ${targetName(session.target)}`
          : session.mode === 'pack'
            ? t`Pack into boxes`
            : t`Move to ${targetName(session.target)}`,
      )}
      {session.checkOnly ? (
        <p
          role="status"
          className="mx-3 mb-2 rounded-xl border border-[#34302A] bg-[#1E1C19] px-3 py-2 text-[13.5px]"
        >
          <Trans>You're a viewer: nothing is saved</Trans>
        </p>
      ) : null}
      <div className="relative mx-3 min-h-[240px] flex-1 overflow-hidden rounded-[14px] bg-[#1C1A17]">
        {session.paused ? (
          <div className="grid h-full content-center justify-items-center gap-3 p-4 text-center">
            <p className="m-0 font-semibold text-[17px]">
              <Trans>Paused</Trans>
            </p>
          </div>
        ) : (
          <SessionCamera
            detect={detect}
            {...(decoder !== undefined ? { decoder } : {})}
            paused={session.paused}
            onReads={onReads}
            {...(camera ? { camera } : {})}
            flashes={flashes}
            demoCodes={demoCodes}
          />
        )}
        {awaitingTarget ? (
          <span
            role="status"
            className="absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-[#0F0E0D]/85 px-3 py-1.5 font-medium text-[13px]"
          >
            {session.mode === 'pack' ? (
              <Trans>Scan the next box</Trans>
            ) : (
              <Trans>Scan where things go next</Trans>
            )}
          </span>
        ) : null}
      </div>

      <div className="grid gap-2 px-3 pt-3">
        {isCount ? null : (
          <p className="m-0 text-[#BDB7AC] text-[14px]">
            {session.mode === 'pack' ? (
              <Trans>Going into {targetName(session.current)}</Trans>
            ) : (
              <Trans>Now moving to {targetName(session.current)}</Trans>
            )}
          </p>
        )}
        <p
          data-testid="session-counter"
          className="m-0 font-semibold text-[34px] tabular-nums leading-tight"
        >
          {counterText}
        </p>
        <p className="sr-only" role="status" aria-live="polite">
          {spoken}
        </p>
        {count?.nearlyFull ? (
          <p className="m-0 text-[#F5B83D] text-[13px]">
            <Trans>Nearly full: a session holds 5,000 labels.</Trans>
          </p>
        ) : null}
        <ul aria-label={t`Last reads`} className="m-0 grid list-none gap-1 p-0">
          {recent.map((r) => {
            const where = whereOf(r);
            return (
              <li key={r.key} className="flex flex-wrap items-baseline gap-x-2 text-[14px]">
                <bdi className={`font-medium ${KIND_TEXT[r.kind] ?? 'text-[#BDB7AC]'}`}>
                  {r.name ?? readLabel(r, t)}
                </bdi>
                {where ? (
                  <span className="text-[#BDB7AC] text-[13px]">
                    <Trans>
                      in <bdi>{where}</bdi>
                    </Trans>
                  </span>
                ) : r.kind === 'view_only' ? (
                  <span className="text-[#BDB7AC] text-[13px]">
                    <Trans>View only here</Trans>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-2 px-3 pt-2 pb-3">
        <AriaButton
          isDisabled={session.reads.length === 0}
          onPress={() => commit(undoLast(session))}
          className={`${darkBtn} border border-[#4A463F]`}
        >
          <Trans>Undo last read</Trans>
        </AriaButton>
        <AriaButton
          onPress={() => commit({ ...session, paused: !session.paused })}
          className={`${darkBtn} border border-[#4A463F]`}
        >
          {session.paused ? <Trans>Resume</Trans> : <Trans>Pause</Trans>}
        </AriaButton>
        {isCount ? null : (
          <AriaButton
            onPress={() => setAwaitingTarget((a) => !a)}
            aria-pressed={awaitingTarget}
            className={`${darkBtn} border border-[#4A463F]`}
          >
            <Trans>Target</Trans>
          </AriaButton>
        )}
        <AriaButton
          onPress={() => {
            commit({ ...session, paused: true });
            setAwaitingTarget(false);
            setPhase('summary');
          }}
          className={`${darkBtn} bg-amber text-amber-ink ${isCount ? 'col-span-2' : ''}`}
        >
          <Trans>Finish</Trans>
        </AriaButton>
      </div>
    </>,
  );
}

/** A read with no thing behind it, by what it is. */
export function readLabel(r: SessionRead, t: ReturnType<typeof useLingui>['t']): string {
  switch (r.kind) {
    case 'unmatched':
      return r.code ? t`Blank label ${r.code}` : t`Not matched: ${r.text}`;
    case 'not_in_your_kept':
      return t`Not in your Kept`;
    case 'check_later':
      return t`Check later: ${r.text}`;
    default:
      return r.text;
  }
}

// ----- setup -------------------------------------------------------------------------------------

type TargetOption = { key: string; target: SessionTarget; label: string; depth: number };

const openTarget = (t: SessionTarget) =>
  t.kind === 'place'
    ? { placeId: t.id }
    : t.kind === 'container'
      ? { containerId: t.id }
      : { locationId: t.id };

const headerOf = (t: SessionTarget) =>
  t.kind === 'place'
    ? { placeId: t.id, inside: t.inside ?? true }
    : t.kind === 'container'
      ? { containerId: t.id }
      : { locationId: t.id };

function SessionSetup({
  store,
  world,
  start,
  now,
  online,
  meId,
  onPrintLabels,
  onStart,
  pickByScan,
  camera,
}: {
  store: ScanStore | null;
  world: World;
  start?: SessionStart;
  now: () => string;
  online: boolean;
  meId: string | null;
  onPrintLabels?: SessionScreenProps['onPrintLabels'];
  onStart: (s: Session) => void;
  pickByScan: (found: Detected[], mode: ScanSessionMode) => Promise<SessionTarget | null>;
  camera: (onReads: (found: Detected[]) => void) => React.ReactNode;
}) {
  const { t } = useLingui();
  const fmt = useFormat();
  const placeName = usePlaceName();
  const locName = useLocationName();
  const [thing, setThing] = useState<SnapThing | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `world` is read again while the copy syncs, and so is the box
  useEffect(() => {
    if (start?.target?.kind !== 'container' || !store) return;
    void store.thing(start.target.id).then((x) => setThing(x ?? null));
  }, [start, store, world]);

  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState<SessionTarget | null>(null);
  const picking = useRef(false);
  const fromStart: SessionTarget | null = useMemo(() => {
    const st = start?.target;
    if (!st) return null;
    if (st.kind === 'location') {
      const l = world.locations.find((x) => x.id === st.id);
      return l
        ? {
            kind: 'location',
            id: l.id,
            locationId: l.id,
            name: locName(l),
            unplacedPlaceId: l.unplacedPlaceId,
          }
        : null;
    }
    if (st.kind === 'place') {
      const p = world.places.get(st.id);
      return p
        ? {
            kind: 'place',
            id: p.id,
            locationId: p.locationId,
            name: placeName({ name: p.name, isUnplaced: p.isUnplaced }),
            inside: true,
          }
        : null;
    }
    return thing
      ? { kind: 'container', id: thing.id, locationId: thing.locationId, name: thing.name }
      : null;
  }, [start, world, thing, placeName, locName]);
  const fixed = scanned ?? fromStart;

  const role = (id: string) => world.locations.find((l) => l.id === id)?.role ?? null;
  const canEdit = useCallback(
    (id: string) => {
      const r = world.locations.find((l) => l.id === id)?.role ?? null;
      return !!r && can(r, 'things.edit');
    },
    [world],
  );
  const anyEdit = world.locations.some((l) => canEdit(l.id));
  const [mode, setMode] = useState<ScanSessionMode>(start?.mode ?? 'count');
  const [inside, setInside] = useState(true);
  const [contents, setContents] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const options: TargetOption[] = useMemo(() => {
    const out: TargetOption[] = [];
    for (const l of world.locations) {
      if (mode !== 'count' && !canEdit(l.id)) continue;
      if (mode === 'count')
        out.push({
          key: `l:${l.id}`,
          target: {
            kind: 'location',
            id: l.id,
            locationId: l.id,
            name: locName(l),
            unplacedPlaceId: l.unplacedPlaceId,
          },
          label: t`All of ${locName(l)}`,
          depth: 0,
        });
      if (mode === 'pack') continue;
      const mine = [...world.places.values()].filter((p) => p.locationId === l.id && !p.deleted);
      const depth = new Map<string, number>();
      const ordered: SnapPlace[] = [];
      const walk = (parent: string | null, d: number) => {
        for (const p of mine
          .filter((x) => (x.parentId ?? null) === parent)
          .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))) {
          depth.set(p.id, d);
          ordered.push(p);
          walk(p.id, d + 1);
        }
      };
      walk(null, 1);
      for (const p of ordered)
        out.push({
          key: `p:${p.id}`,
          target: {
            kind: 'place',
            id: p.id,
            locationId: l.id,
            name: placeName({ name: p.name, isUnplaced: p.isUnplaced }),
          },
          label: `${locName(l)} › ${placeName({ name: p.name, isUnplaced: p.isUnplaced })}`,
          depth: depth.get(p.id) ?? 1,
        });
    }
    return out;
  }, [world, mode, t, placeName, canEdit, locName]);

  const chosen: SessionTarget | null =
    fixed &&
    (mode !== 'pack' || fixed.kind === 'container') &&
    (mode === 'count' || fixed.kind !== 'location')
      ? fixed
      : (options.find((o) => o.key === picked)?.target ?? null);
  const target = chosen?.kind === 'place' ? { ...chosen, inside } : chosen;
  const allowed =
    !!target && (mode === 'count' ? role(target.locationId) !== null : canEdit(target.locationId));
  const counting = mode === 'count' && !!target;
  const counts = !!target && can(role(target.locationId) ?? 'viewer', 'things.mark-seen');
  const openKey = target ? `${target.kind}:${target.id}` : '';
  // Someone else's count of the same place in progress: "Join".
  const open = useQuery({
    queryKey: ['counts', 'open', openKey],
    queryFn: () => countsApi.open(openTarget(target as SessionTarget)),
    enabled: counting && counts && online && target?.kind !== undefined,
    staleTime: 15_000,
  });
  const inProgress =
    open.data?.session && open.data.session.by.id !== meId ? open.data.session : null;
  // How many of the things there have labels (online; a box: not asked).
  const coverage = useQuery({
    queryKey: ['counts', 'labels', openKey],
    queryFn: () =>
      captureApi.labelSummary(
        (target as SessionTarget).locationId,
        target?.kind === 'place' ? target.id : undefined,
      ),
    enabled: counting && online && target?.kind !== 'container',
    staleTime: 60_000,
    retry: false,
  });
  const cov = coverage.data?.things ? coverage.data : null;

  const modes = [
    {
      id: 'count' as const,
      title: t`Count`,
      body: anyEdit
        ? t`Walk a place or a box: what you scan is seen; the summary shows what's missing.`
        : t`Check a place or a box: see what's there and what's missing. Viewers' counts aren't saved.`,
    },
    ...(anyEdit
      ? [
          {
            id: 'pack' as const,
            title: t`Pack into`,
            body: t`Everything you scan goes into a box. Tap Target, then scan the next box.`,
          },
          {
            id: 'move' as const,
            title: t`Move to`,
            body: t`Everything you scan moves to a place or a box.`,
          },
        ]
      : []),
  ];

  return (
    <div className="grid gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="m-0 flex-1 font-semibold text-[20px]">
          <Trans>Start a session</Trans>
        </h2>
        <ShowMe tour="scanning" />
      </div>
      <div data-tour="session-modes">
        <ChoiceCards label={t`What to do`} value={mode} onChange={setMode} options={modes} />
      </div>
      <div data-tour="session-target" className="grid gap-2">
        {fixed && chosen === fixed ? (
          <p className="m-0 text-[15px]">
            {mode === 'count' ? (
              <Trans>
                Counting <bdi className="font-semibold">{targetName(fixed)}</bdi>
              </Trans>
            ) : mode === 'pack' ? (
              <Trans>
                Packing into <bdi className="font-semibold">{targetName(fixed)}</bdi>
              </Trans>
            ) : (
              <Trans>
                Moving to <bdi className="font-semibold">{targetName(fixed)}</bdi>
              </Trans>
            )}
          </p>
        ) : mode === 'pack' ? null : (
          <ChoiceCards
            label={mode === 'count' ? t`What to count` : t`Where things go`}
            value={picked ?? ''}
            onChange={setPicked}
            options={options.map((o) => ({ id: o.key, title: o.label }))}
          />
        )}
        {scanning ? (
          <div className="relative h-[260px] overflow-hidden rounded-[14px] bg-[#1C1A17] text-[#F2EFE9]">
            {camera((found) => {
              if (picking.current) return;
              picking.current = true;
              void pickByScan(found, mode)
                .then((tg) => {
                  if (!tg) return;
                  setScanned(tg);
                  setScanning(false);
                })
                .finally(() => {
                  picking.current = false;
                });
            })}
          </div>
        ) : (
          <Button variant="secondary" onPress={() => setScanning(true)}>
            {mode === 'pack' ? <Trans>Scan the box's label</Trans> : <Trans>Scan its label</Trans>}
          </Button>
        )}
        {mode === 'count' && target?.kind === 'place' ? (
          <Switch isSelected={inside} onChange={setInside}>
            <Trans>Include the places inside it</Trans>
          </Switch>
        ) : null}
        {mode === 'count' ? (
          <Switch isSelected={contents} onChange={setContents}>
            <Trans>A box you scan counts what's inside it</Trans>
          </Switch>
        ) : null}
      </div>
      {counting && cov ? (
        <p className="m-0 text-[15px]">
          {(() => {
            const all = cov.things ?? 1;
            const pct = fmt.num(Math.round(((all - cov.unprinted) / all) * 100));
            return <Trans>{pct}% of things here have labels.</Trans>;
          })()} {cov.unprinted > 0 && target && onPrintLabels ? (
            <AriaButton
              className="cursor-pointer text-info underline outline-none data-focus-visible:outline-2 data-focus-visible:outline-info"
              onPress={() =>
                onPrintLabels({
                  locationId: target.locationId,
                  ...(target.kind === 'place' ? { placeId: target.id } : {}),
                })
              }
            >
              <Trans>Print labels for the rest</Trans>
            </AriaButton>
          ) : null}
        </p>
      ) : null}
      {counting && inProgress ? (
        <div
          role="status"
          className="grid gap-2 rounded-[12px] border border-line bg-sunken p-3 text-[15px]"
        >
          <p className="m-0">
            <Trans>
              Count in progress by <bdi className="font-semibold">{inProgress.by.displayName}</bdi>
            </Trans>
          </p>
          <Button
            variant="secondary"
            isDisabled={busy || !store}
            onPress={() => void begin(inProgress)}
          >
            <Trans>Join</Trans>
          </Button>
        </div>
      ) : null}
      <p className="m-0 text-ink-3 text-small" data-tour="session-finish">
        <Trans>
          Nothing changes until you finish: the summary shows what was found, what's missing and
          what's elsewhere, and you choose what to save.
        </Trans>
      </p>
      <Button
        isDisabled={!allowed || busy || !store}
        isPending={busy}
        onPress={() => void begin(null)}
      >
        <Trans>Start</Trans>
      </Button>
    </div>
  );

  /** Starts the session, or joins someone else's count of the same target. */
  async function begin(join: { id: string; by: { displayName: string } } | null) {
    if (!target || !store) return;
    setBusy(true);
    try {
      const isCount = mode === 'count';
      const expected: ExpectedThing[] = isCount ? await expectedFor(store, target) : [];
      const areas = isCount ? await areasFor(store as never, target) : [];
      const s = newSession({
        ...(join ? { id: join.id } : {}),
        mode,
        target,
        role: role(target.locationId) ?? 'viewer',
        expected,
        contents: isCount && contents,
        areas,
        now: now(),
      });
      onStart(
        join
          ? {
              ...s,
              shared: { joined: true, by: join.by.displayName, others: [], counted: [] },
            }
          : s,
      );
    } finally {
      setBusy(false);
    }
  }

  function targetName(tg: SessionTarget) {
    return tg.name ?? t`Unnamed`;
  }
}
