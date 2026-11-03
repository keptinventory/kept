/**
 * "Set a field…" for a place's List and Grid (#366), with the spreadsheet's staging: the value
 * waits on every selected thing behind "Save N changes", checked as the thing form checks it, and
 * saved with the version each was read at (D156), one Undo for the whole save (D150). A row
 * someone else changed stays staged, with keep mine or keep theirs under the bar.
 *
 * The selection's rows are read as sheet rows (GET /things/sheet?ids, 50 a request) when the
 * dialog opens. On demand (vite.config.ts ON_DEMAND_ENTRIES): it reads and writes the server only.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { inventoryApi, inventoryKeys } from '@/api/inventory/queries';
import type { SheetRow } from '@/api/inventory/types';
import { useLocations } from '@/api/queries';
import { useErrorText } from '@/components/page';
import { useLocationAccess } from '@/components/schedules/access';
import { useLocationAccountId } from '@/components/things/pickers';
import { toast } from '@/components/ui/toast';
import { SetFieldDialog } from './bulk';
import { COLUMNS, visibleColumns } from './model';
import { ChangesBar, type Place, ProblemActions, ProblemText, useStaging } from './staging';

/** Ids a request reads: well inside any proxy's limit on a URL. */
const READ = 50;

export type ListBulkProps = {
  locationId: string;
  /** The selected things, in the list's order. */
  selected: readonly string[];
  /** Every thing the list shows, in its order: the save goes in it. */
  order: readonly string[];
  /** "Set a field…" was pressed. */
  open: boolean;
  onClose: () => void;
  /** The things with staged changes, for the rows' marker. */
  onStaged: (ids: ReadonlySet<string>) => void;
  leaves: (current: Place, next: Place) => boolean;
};

export default function ListBulk({
  locationId,
  selected,
  order,
  open,
  onClose,
  onStaged,
  leaves,
}: ListBulkProps) {
  const qc = useQueryClient();
  const errorText = useErrorText();
  const here = useLocations().data?.find((l) => l.id === locationId);
  const accountId = useLocationAccountId(here);
  const access = useLocationAccess()(locationId);
  const offered = visibleColumns(
    COLUMNS.map((c) => c.id),
    { money: access.money, warranties: access.moduleOn('warranties') },
  );
  // The rows read for the selection; the staged ones are kept, the rest read again next time.
  const [byId, setById] = useState<ReadonlyMap<string, SheetRow>>(new Map());
  const staging = useStaging({ byId, order, leaves });
  const { staged } = staging;

  const read = useCallback(
    async (ids: readonly string[]): Promise<Map<string, SheetRow>> => {
      const out = new Map<string, SheetRow>();
      const missing = ids.filter((id) => !byId.has(id) || !staged.has(id));
      for (let i = 0; i < missing.length; i += READ) {
        const chunk = missing.slice(i, i + READ);
        const params = { ids: chunk, limit: chunk.length };
        const page = await qc.fetchQuery({
          queryKey: inventoryKeys.things.sheet(params),
          queryFn: () => inventoryApi.sheet(params),
          staleTime: 0,
        });
        for (const row of page.items) out.set(row.id, row);
      }
      for (const id of ids) {
        const known = byId.get(id);
        if (known && staged.has(id) && !out.has(id)) out.set(id, known);
      }
      return out;
    },
    [byId, staged, qc],
  );

  // Read the selection as the dialog opens, so Set has the rows at hand.
  const pending = useRef<Promise<Map<string, SheetRow>> | null>(null);
  useEffect(() => {
    if (!open) return;
    const p = read(selected);
    pending.current = p;
    p.catch(() => undefined);
  }, [open, read, selected]);

  // Only what is staged stays read: a saved row is read again, at its new version.
  useEffect(() => {
    setById((m) => {
      if ([...m.keys()].every((id) => staged.has(id))) return m;
      return new Map([...m].filter(([id]) => staged.has(id)));
    });
  }, [staged]);
  const stagedIds = useMemo(() => new Set(staged.keys()), [staged]);
  const onStagedRef = useRef(onStaged);
  onStagedRef.current = onStaged;
  useEffect(() => onStagedRef.current(stagedIds), [stagedIds]);
  useEffect(() => () => onStagedRef.current(new Set()), []);

  const failedRows = [...staging.failed]
    .map(([id, problem]) => ({ row: byId.get(id), problem }))
    .filter((x): x is { row: SheetRow; problem: (typeof x)['problem'] } => !!x.row);

  return (
    <>
      <ChangesBar staging={staging}>
        {failedRows.length ? (
          <ul className="m-0 grid list-none gap-2 p-0">
            {failedRows.map(({ row, problem }) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2">
                <p className="m-0 flex-1 text-[14px]">
                  <ProblemText row={row} problem={problem} />
                </p>
                <ProblemActions row={row} problem={problem} staging={staging} />
              </li>
            ))}
          </ul>
        ) : null}
      </ChangesBar>
      {open ? (
        <SetFieldDialog
          accountId={accountId}
          count={selected.length}
          shown={offered}
          onClose={onClose}
          onApply={(column, value) => {
            const field = column.field;
            if (!field) return;
            void (async () => {
              try {
                const rows = await (pending.current ?? read(selected));
                setById((m) => new Map([...m, ...rows]));
                staging.stageAll(
                  selected.flatMap((id) => rows.get(id) ?? []),
                  field,
                  () => value,
                );
                onClose();
              } catch (err) {
                toast({ title: errorText(err), tone: 'danger' });
              }
            })();
          }}
        />
      ) : null}
    </>
  );
}
