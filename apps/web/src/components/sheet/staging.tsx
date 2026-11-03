/**
 * Staged edits behind "Save N changes" (D128, D156), shared by the spreadsheet and a place's List
 * and Grid (#366): the staged rows, the ones the server refused, the thing form's checks, the
 * save (each row with the version it was read at, 200 a request, one Undo for the whole save,
 * D150), Discard, and the question before leaving with unsaved changes. `ChangesBar` is the bar
 * itself; `ProblemText` and `ProblemActions` say why a row wasn't saved and offer keep mine or
 * keep theirs after a 412.
 *
 * On demand, with the sheet and the list's bulk edit (vite.config.ts HOUSEHOLD_SHARED): it reads
 * and writes the server only.
 */
import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQueryClient } from '@tanstack/react-query';
import { useBlocker } from '@tanstack/react-router';
import { type ReactNode, useMemo, useState } from 'react';
import { inventoryApi, inventoryKeys } from '@/api/inventory/queries';
import type { BulkEditRowResult, SheetRow } from '@/api/inventory/types';
import { useOfferUndo } from '@/components/history/undo';
import { useErrorText } from '@/components/page';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm';
import { toast } from '@/components/ui/toast';
import { sep } from '@/lib/format';
import { useSheetMessages } from './labels';
import {
  countStaged,
  type DraftKey,
  rebase,
  type Staged,
  stage,
  toEdits,
  unstage,
  validateDraft,
} from './model';

export type Staging = ReturnType<typeof useStaging>;

/** Where a navigation starts and ends, as the blocker sees it. */
export type Place = { pathname: string; search: unknown };

/**
 * The staged edits of the rows in `byId`, saved in `order`. `leaves` says whether a navigation
 * takes the person away from them (they are asked first).
 */
export function useStaging({
  byId,
  order,
  leaves,
}: {
  byId: ReadonlyMap<string, SheetRow>;
  order: readonly string[];
  leaves: (current: Place, next: Place) => boolean;
}) {
  const { t } = useLingui();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const errorText = useErrorText();
  const offerUndo = useOfferUndo();
  const messages = useSheetMessages();
  const [staged, setStaged] = useState<Staged>(new Map());
  const [failed, setFailed] = useState<ReadonlyMap<string, BulkEditRowResult>>(new Map());
  const [saving, setSaving] = useState(false);

  const invalid = useMemo(() => {
    const out = new Map<string, Partial<Record<DraftKey, string>>>();
    for (const [id, s] of staged) {
      const row = byId.get(id);
      if (!row) continue;
      const e = validateDraft(row, s.draft, messages);
      if (Object.keys(e).length) out.set(id, e);
    }
    return out;
  }, [staged, byId, messages]);
  const counts = countStaged(staged);

  const clearFailed = (id: string) =>
    setFailed((m) => {
      if (!m.has(id)) return m;
      const next = new Map(m);
      next.delete(id);
      return next;
    });

  /** `field` on every row of `rows`, each its own value. */
  const stageAll = (
    rows: readonly SheetRow[],
    field: DraftKey,
    valueFor: (row: SheetRow) => unknown,
  ) =>
    setStaged((s) => {
      let next = s;
      for (const row of rows) next = stage(next, row, field, valueFor(row));
      return next;
    });

  const save = async () => {
    if (saving || counts.cells === 0) return;
    if (invalid.size > 0) {
      toast({
        title: plural(invalid.size, {
          one: 'Fix # row before saving',
          other: 'Fix # rows before saving',
        }),
        tone: 'danger',
      });
      return;
    }
    setSaving(true);
    const okIds: string[] = [];
    const fresh: SheetRow[] = [];
    const events: string[] = [];
    const problems = new Map<string, BulkEditRowResult>();
    let cells = 0;
    try {
      for (const edits of toEdits(staged, order)) {
        const r = await inventoryApi.bulkEdit({ edits });
        for (const res of r.results) {
          if (res.ok) {
            okIds.push(res.id);
            cells += Object.keys(staged.get(res.id)?.draft ?? {}).length;
          } else problems.set(res.id, res);
        }
        fresh.push(...r.rows);
        events.push(...r.events);
      }
    } catch (err) {
      toast({ title: errorText(err), tone: 'danger' });
    } finally {
      setSaving(false);
    }
    if (okIds.length === 0 && problems.size === 0) return;
    setStaged((s) => unstage(s, okIds));
    setFailed(problems);
    // The saved rows change in place: a sheet doesn't reorder under the person's eyes.
    const freshById = new Map(fresh.map((r) => [r.id, r]));
    qc.setQueriesData<{ pages: { items: SheetRow[]; next_cursor: string | null }[] }>(
      { queryKey: ['things', 'sheet'] },
      (old) =>
        old?.pages
          ? {
              ...old,
              pages: old.pages.map((pg) => ({
                ...pg,
                items: pg.items.map((r) => freshById.get(r.id) ?? r),
              })),
            }
          : old,
    );
    void qc.invalidateQueries({
      predicate: (q) => !(q.queryKey[0] === 'things' && q.queryKey[1] === 'sheet'),
    });
    if (okIds.length)
      offerUndo(
        {
          title: plural(cells, { one: 'Saved # change', other: 'Saved # changes' }),
          ...(problems.size
            ? {
                description: plural(problems.size, {
                  one: "# row wasn't saved",
                  other: "# rows weren't saved",
                }),
              }
            : {}),
        },
        events,
        { together: true },
      );
    else
      toast({
        title: plural(problems.size, { one: "# row wasn't saved", other: "# rows weren't saved" }),
        tone: 'danger',
      });
  };

  const discard = async () => {
    if (
      await confirm({
        title: plural(counts.cells, {
          one: 'Discard # change?',
          other: 'Discard # changes?',
        }),
        confirmLabel: t`Discard`,
        destructive: true,
      })
    ) {
      setStaged(new Map());
      setFailed(new Map());
    }
  };

  /** "Keep mine" after a 412: mine again, on the version the server has now. */
  const keepMine = (row: SheetRow, problem: BulkEditRowResult) => {
    setStaged((s) => rebase(s, row.id, problem.rowVersion ?? row.rowVersion));
    clearFailed(row.id);
    void qc.invalidateQueries({ queryKey: inventoryKeys.things.all });
  };
  /** "Keep theirs" (or "Discard my change"): the row's staged change goes. */
  const keepTheirs = (row: SheetRow) => {
    setStaged((s) => unstage(s, [row.id]));
    clearFailed(row.id);
    void qc.invalidateQueries({ queryKey: inventoryKeys.things.all });
  };

  // Leaving with unsaved changes asks first.
  useBlocker({
    shouldBlockFn: async ({ current, next }) => {
      if (staged.size === 0 || !leaves(current, next)) return false;
      return !(await confirm({
        title: t`Leave without saving?`,
        body: plural(counts.cells, {
          one: "# change isn't saved yet.",
          other: "# changes aren't saved yet.",
        }),
        confirmLabel: t`Leave`,
        cancelLabel: t`Stay`,
        destructive: true,
      }));
    },
    enableBeforeUnload: () => staged.size > 0,
  });

  return {
    staged,
    setStaged,
    failed,
    invalid,
    counts,
    saving,
    stageAll,
    save,
    discard,
    keepMine,
    keepTheirs,
    clearFailed,
  };
}

/** "N changes · on N things", what wasn't saved, Discard, and "Save N changes". */
export function ChangesBar({
  staging,
  children,
}: {
  staging: Staging;
  /** Under the counts: the list's rows that weren't saved, each with its choice. */
  children?: ReactNode;
}) {
  const { t } = useLingui();
  const { counts, failed, invalid, saving } = staging;
  if (counts.cells === 0 && failed.size === 0) return null;
  return (
    <section
      aria-label={t`Changes`}
      // Above a phone's tab bar (as the inbox's bulk bar), at the bottom on a desktop.
      className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 grid gap-2 md:bottom-4 rounded-[10px] border border-line bg-surface p-3 shadow-[0_10px_30px_rgba(0,0,0,.14)]"
    >
      <div className="flex flex-wrap items-center gap-3">
        <p className="m-0 flex-1 text-[14px]" aria-live="polite">
          {plural(counts.cells, {
            one: '# change',
            other: '# changes',
          })}
          {sep()}
          {plural(counts.rows, { one: 'on # thing', other: 'on # things' })}
          {failed.size ? (
            <span className="ms-2 text-danger">
              {plural(failed.size, { one: "# row wasn't saved", other: "# rows weren't saved" })}
            </span>
          ) : null}
          {invalid.size ? (
            <span className="ms-2 text-danger">
              {plural(invalid.size, { one: '# row needs a fix', other: '# rows need a fix' })}
            </span>
          ) : null}
        </p>
        <Button
          variant="ghost"
          isDisabled={saving || counts.cells === 0}
          onPress={() => void staging.discard()}
        >
          <Trans>Discard</Trans>
        </Button>
        <Button
          isPending={saving}
          isDisabled={counts.cells === 0}
          onPress={() => void staging.save()}
        >
          {plural(counts.cells, { one: 'Save # change', other: 'Save # changes' })}
        </Button>
      </div>
      {children}
    </section>
  );
}

/** Why a row wasn't saved: "Alfred changed this since you opened it.", and so on. */
export function ProblemText({ row, problem }: { row: SheetRow; problem: BulkEditRowResult }) {
  const { t } = useLingui();
  const who = problem.changedBy?.displayName;
  const why =
    problem.status === 412
      ? who
        ? t`${who} changed this since you opened it.`
        : t`Someone changed this since you opened it.`
      : problem.status === 403
        ? t`You can view this location but not change it.`
        : problem.status === 404
          ? t`It's no longer here.`
          : (problem.hint ?? t`Check the highlighted cells.`);
  return (
    <>
      <bdi className="font-semibold">{row.name ?? ''}</bdi>
      {sep()}
      {why}
    </>
  );
}

/** Keep mine or keep theirs after a 412 (D156); any other refusal, Discard my change. */
export function ProblemActions({
  row,
  problem,
  staging,
  onDone,
}: {
  row: SheetRow;
  problem: BulkEditRowResult;
  staging: Staging;
  onDone?: () => void;
}) {
  return problem.status === 412 ? (
    <>
      <Button
        size="small"
        variant="secondary"
        onPress={() => {
          staging.keepTheirs(row);
          onDone?.();
        }}
      >
        <Trans>Keep theirs</Trans>
      </Button>
      <Button
        size="small"
        onPress={() => {
          staging.keepMine(row, problem);
          onDone?.();
        }}
      >
        <Trans>Keep mine</Trans>
      </Button>
    </>
  ) : (
    <Button
      size="small"
      variant="secondary"
      onPress={() => {
        staging.keepTheirs(row);
        onDone?.();
      }}
    >
      <Trans>Discard my change</Trans>
    </Button>
  );
}
