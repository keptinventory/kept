/**
 * "Printed OK?" after the print dialog, about the batch just sent to the printer (it says which:
 * "16 labels: 4K webcam, … and 13 more", made when): yes records the print date on the batch's
 * codes (`POST …/printed`, which keeps the first date), so "Label everything unprinted" and
 * Home's "Print your first label" stop counting them, and their things and places show the amber
 * tape from then on (printing like tape the first time); no leaves everything as it was, to print
 * again. The first confirmed print shows the `labels.first_print` hint once (D138; T31's hint
 * system, components/hints/use-hint.ts): stick it on, then scan it. It opens by itself on
 * `hintAnchor` (the page's title), since the dialog just closed. Codes printed from "Print
 * pending labels" leave this phone's pending list. Answered "No" or closed, the print view keeps
 * asking in a bar (`NotConfirmedBar`) for as long as the batch isn't confirmed.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type RefObject, useState } from 'react';
import { captureApi, captureKeys } from '@/api/capture/queries';
import type { LabelBatch } from '@/api/capture/types';
import { inventoryKeys } from '@/api/inventory/queries';
import { mapKeys } from '@/api/map/queries';
import { movingKeys } from '@/api/moving/queries';
import { useLocations } from '@/api/queries';
import { hintDone, useHint, useHints } from '@/components/hints/use-hint';
import { Notice, useErrorText } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Dialog, DialogFooter, Modal } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { useFormat } from '@/lib/format';
import { useOffline } from '@/offline/provider';
import { useBatchSummary } from './batch-summary';
import { markJustPrinted } from './just-printed';
import { forgetPrintPending } from './pending-prompt';

const FIRST_PRINT = 'labels.first_print';

/** "Yes, printed OK" for `batch`: records it, takes its things off this phone's pending list. */
export function useConfirmPrinted(batch: LabelBatch, onDone?: () => void) {
  const qc = useQueryClient();
  const errorText = useErrorText();
  const offline = useOffline();
  return useMutation({
    mutationFn: () => captureApi.labelBatchPrinted(batch.id),
    onSuccess: async (next) => {
      qc.setQueryData(captureKeys.labels.batch(batch.id), next);
      // Their codes are labels now: the next time each shows, it prints like tape, and every
      // list, page, search and map reads them again to show the tape.
      markJustPrinted(batch.labels.map((l) => l.code));
      await forgetPrintPending(
        offline,
        batch.labels.flatMap((l) => (l.targetId ? [l.targetId] : [])),
      );
      void qc.invalidateQueries({ queryKey: captureKeys.labels.all });
      void qc.invalidateQueries({ queryKey: inventoryKeys.home });
      for (const queryKey of [
        inventoryKeys.things.all,
        inventoryKeys.places.all,
        ['search'],
        mapKeys.all,
        movingKeys.all,
      ])
        void qc.invalidateQueries({ queryKey });
      onDone?.();
    },
    onError: (e) => toast({ title: errorText(e), tone: 'danger' }),
  });
}

export function PrintedOkDialog({
  batch,
  isOpen,
  onClose,
  hintAnchor,
}: {
  batch: LabelBatch;
  isOpen: boolean;
  onClose: () => void;
  /** Where the first-print hint points. */
  hintAnchor: RefObject<Element | null>;
}) {
  const { t } = useLingui();
  const fmt = useFormat();
  const summary = useBatchSummary();
  const [tip, setTip] = useState(false);
  // The print view has no app shell to read these at start: read them here.
  const hints = useHints(isOpen || tip);
  useLocations();
  const firstPrint = hints.isSuccess && !hintDone(hints.data?.hints, FIRST_PRINT);
  useHint('labels.first_print', hintAnchor, { when: tip, autoOpen: true });

  const printed = useConfirmPrinted(batch, () => {
    if (firstPrint) setTip(true);
    else toast({ title: t`Marked as printed`, tone: 'ok' });
    onClose();
  });
  const made = fmt.dateTime(batch.createdAt);

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(o) => !o && onClose()}
      className="print:hidden"
      overlayClassName="print:hidden"
    >
      <Dialog title={t`Printed OK?`} showClose={false}>
        <p className="m-0 font-semibold text-ink [overflow-wrap:anywhere]">{summary(batch)}</p>
        <p className="m-0 text-small text-ink-2">
          <Trans>Made {made}</Trans>
        </p>
        <p className="m-0 text-ink-2">
          <Trans>
            Check that the labels sit inside their cells and that one scans. Yes records today as
            their print date.
          </Trans>
        </p>
        <DialogFooter>
          <Button variant="secondary" onPress={onClose}>
            <Trans>No, print again</Trans>
          </Button>
          <Button onPress={() => printed.mutate()} isPending={printed.isPending}>
            <Trans>Yes, printed OK</Trans>
          </Button>
        </DialogFooter>
      </Dialog>
    </Modal>
  );
}

/**
 * The print view's standing question for a batch not confirmed yet: "Yes, printed OK" right
 * there, for this batch, however the dialog was answered.
 */
export function NotConfirmedBar({ batch }: { batch: LabelBatch }) {
  const { t } = useLingui();
  const printed = useConfirmPrinted(batch, () =>
    toast({ title: t`Marked as printed`, tone: 'ok' }),
  );
  return (
    <section aria-label={t`Not confirmed as printed`}>
      <Notice
        title={t`Not confirmed as printed`}
        action={
          <Button size="small" onPress={() => printed.mutate()} isPending={printed.isPending}>
            <Trans>Yes, printed OK</Trans>
          </Button>
        }
      >
        <Trans>
          Once these labels have printed, confirm it here, so Kept stops counting them as unprinted.
        </Trans>
      </Notice>
    </section>
  );
}
