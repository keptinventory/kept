/**
 * "Printed OK?" after a move's contents sheets (#307), in their form (./contents-sheets.tsx, on
 * demand). Each sheet carries its box's QR code, a label like any other, so once the PDF is ready
 * whoever may print labels here is asked, as Labels asks after a print (components/labels/printed-ok.tsx): yes
 * records the print date on those boxes' codes (`POST /moves/:id/sheets/printed`, the server's
 * `labels.printed`), and the boxes show the amber tape from then on, printing like tape the first
 * time. Left unanswered, nothing changes; the sheets can be made again and confirmed then.
 */
import { can } from '@kept/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { captureKeys } from '@/api/capture/queries';
import { api } from '@/api/client';
import { inventoryKeys } from '@/api/inventory/queries';
import { useReportRun } from '@/api/inventory/reports';
import { mapKeys } from '@/api/map/queries';
import { movingPaths } from '@/api/moving/paths';
import { movingKeys } from '@/api/moving/queries';
import type { Move, SheetsPrintedBody } from '@/api/moving/types';
import { useLocations } from '@/api/queries';
import { markJustPrinted } from '@/components/labels/just-printed';
import { Notice, useErrorText } from '@/components/page';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

export type SheetsPrintedProps = {
  runId: string;
  move: Move;
  /** The boxes on the sheets; omitted: every box of the move. */
  containerIds?: string[] | undefined;
};

export function SheetsPrinted({ runId, move, containerIds }: SheetsPrintedProps) {
  const { t } = useLingui();
  const qc = useQueryClient();
  const errorText = useErrorText();
  const run = useReportRun(runId).data;
  const here = useLocations().data?.find((l) => l.id === move.locationId);
  // Ids only for a sheet of chosen boxes; a whole move's sheets send none, and the server marks
  // the boxes they printed (the same first MAX_SHEET_BOXES the report holds).
  const body: SheetsPrintedBody = containerIds?.length ? { containerIds } : {};
  const printed = useMutation({
    mutationFn: () => api.post<{ codes: string[] }>(movingPaths.sheetsPrinted(move.id), body),
    onSuccess: ({ codes }) => {
      // The same reads "Printed OK?" in Labels refreshes (useConfirmPrinted).
      markJustPrinted(codes);
      for (const queryKey of [
        movingKeys.all,
        captureKeys.labels.all,
        inventoryKeys.home,
        inventoryKeys.things.all,
        inventoryKeys.places.all,
        ['search'],
        mapKeys.all,
      ])
        void qc.invalidateQueries({ queryKey });
      toast({ title: t`Marked as printed`, tone: 'ok' });
    },
    onError: (e) => toast({ title: errorText(e), tone: 'danger' }),
  });

  if (run?.status !== 'done' || !here || !can(here.role, 'labels.use') || printed.isSuccess)
    return null;
  if (!(containerIds?.length ?? move.boxes.length)) return null;
  return (
    <section aria-label={t`Printed OK?`}>
      <Notice
        title={t`Printed OK?`}
        action={
          <Button size="small" onPress={() => printed.mutate()} isPending={printed.isPending}>
            <Trans>Yes, printed OK</Trans>
          </Button>
        }
      >
        <Trans>
          Check that a code on the sheets scans. Yes records today as their print date, so the boxes
          show their label.
        </Trans>
      </Notice>
    </section>
  );
}
