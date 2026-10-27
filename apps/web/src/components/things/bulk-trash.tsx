/**
 * Several things to the Trash at once (D45, D150): the spreadsheet's "Send to Trash" and, from a
 * place's Select, "Move to Trash" (#294). `POST /things/bulk-trash` (at most 200) trashes them
 * all or none, each its own `thing.trash` event, and one Undo brings them all back (`POST
 * /audit/undo`). As one thing's trash does, it asks first what happens to what is inside a box,
 * and about anything that is with someone (1.14).
 *
 * An on-demand chunk (vite.config.ts ON_DEMAND_ENTRIES): it needs the server anyway, so it stays
 * out of the precache. Never window.confirm.
 */
import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { isApiError } from '@/api/client';
import { inventoryApi } from '@/api/inventory/queries';
import { useOfferUndo } from '@/components/history/undo';
import { useOnLoanConfirm } from '@/components/lending/on-loan';
import { useErrorText } from '@/components/page';
import { invalidateBrowse } from '@/components/places/api';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { ChoiceCards } from '@/components/ui/segmented';
import { toast } from '@/components/ui/toast';
import { useOnline } from '@/lib/online';
import { Sheet } from './sheet';

/** The server's limit on one bulk trash. */
export const BULK_TRASH_MAX = 200;

/** The bulk trash, asking first about anything with someone: null when they said no. */
export function useBulkTrash() {
  const { t } = useLingui();
  const withConfirm = useOnLoanConfirm();
  return (thingIds: string[], contents?: 'move' | 'trash') =>
    withConfirm(
      (onLoan) =>
        inventoryApi.bulkTrash({
          thingIds,
          ...(contents ? { contents } : {}),
          ...(onLoan ? { onLoan: 'confirm' as const } : {}),
        }),
      t`Move to Trash anyway`,
    );
}

/** Send to Trash: what happens to what is inside a box is asked first (D45). */
export function TrashDialog({
  count,
  holdsThings,
  isPending,
  onClose,
  onConfirm,
}: {
  count: number;
  holdsThings: boolean;
  isPending: boolean;
  onClose: () => void;
  onConfirm: (contents: 'move' | 'trash' | undefined) => void;
}) {
  const { t } = useLingui();
  const [contents, setContents] = useState<'move' | 'trash'>('move');
  return (
    <Sheet
      isOpen
      role="alertdialog"
      isDismissable={false}
      onOpenChange={(o) => !o && onClose()}
      title={plural(count, {
        one: 'Send # thing to the Trash?',
        other: 'Send # things to the Trash?',
      })}
    >
      <div className="grid gap-4">
        {holdsThings ? (
          <ChoiceCards<'move' | 'trash'>
            label={t`Some of them hold things`}
            value={contents}
            onChange={setContents}
            options={[
              { id: 'move', title: t`Move what's inside out, to where each one is` },
              { id: 'trash', title: t`Trash what's inside too` },
            ]}
          />
        ) : null}
        <p className="m-0 text-small text-ink-2">
          <Trans>They stay in the Trash for 30 days. Undo brings them all back.</Trans>
        </p>
        <DialogFooter>
          <Button variant="secondary" onPress={onClose}>
            <Trans>Cancel</Trans>
          </Button>
          <Button
            variant="danger"
            isPending={isPending}
            onPress={() => onConfirm(holdsThings ? contents : undefined)}
          >
            <Trans>Send to Trash</Trans>
          </Button>
        </DialogFooter>
      </div>
    </Sheet>
  );
}

/** "Move to Trash" for a place's selection (#294), then the toast with one Undo. */
export function BulkTrashButton({
  thingIds,
  holdsThings,
  onDone,
}: {
  thingIds: readonly string[];
  /** Some of them are boxes: ask what happens to what is inside. */
  holdsThings: boolean;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const online = useOnline();
  const errorText = useErrorText();
  const offerUndo = useOfferUndo();
  const bulkTrash = useBulkTrash();
  const [open, setOpen] = useState(false);
  // The server knows of contents the list didn't show (409): ask after all.
  const [boxes, setBoxes] = useState(false);
  const [busy, setBusy] = useState(false);
  const n = thingIds.length;
  const run = async (contents: 'move' | 'trash' | undefined) => {
    setBusy(true);
    try {
      const r = await bulkTrash([...thingIds], contents);
      if (!r) return;
      setOpen(false);
      offerUndo(
        {
          title: plural(r.trashed.length, {
            one: 'Sent # thing to the Trash',
            other: 'Sent # things to the Trash',
          }),
        },
        r.events,
        { together: true },
      );
      onDone();
      await invalidateBrowse(qc);
    } catch (e) {
      // Imported from ./trash, this would split the thing page's chunk in two in the precache.
      if (isApiError(e) && e.serverCode === 'contents_choice_required') setBoxes(true);
      else toast({ title: errorText(e), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        size="small"
        variant="secondary"
        isDisabled={n === 0 || n > BULK_TRASH_MAX || !online}
        onPress={() => setOpen(true)}
      >
        <Trans>Move to Trash</Trans>
      </Button>
      {n > BULK_TRASH_MAX ? (
        <p className="m-0 basis-full ps-1 text-small text-ink-2">
          <Trans>Send at most 200 to the Trash at a time.</Trans>
        </p>
      ) : null}
      {open ? (
        <TrashDialog
          count={n}
          holdsThings={holdsThings || boxes}
          isPending={busy}
          onClose={() => setOpen(false)}
          onConfirm={(contents) => void run(contents)}
        />
      ) : null}
    </>
  );
}
