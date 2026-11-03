/**
 * Where and when it was bought (task 12, from `kept.thing_purchase`). Money follows the gate:
 * the server leaves the price out for a viewer when the location hides money from viewers (D13),
 * and for everyone when the Money module is off, and says so with `moneyHidden` (the receipts go
 * with it: a receipt shows the price). Date and shop show either way.
 *
 * #348: those who may edit things add the purchase here when it has none, and change it with
 * Edit (./purchase-sheet.tsx); a receipt is added to the purchase itself. A line says how the
 * purchase's receipts differ from a receipt under Paperwork.
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import type { AttachmentView } from '@/api/inventory/types';
import { DocumentIcon, PencilIcon, PlusIcon, ShareIcon } from '@/components/icons';
import { Section } from '@/components/page';
import { Button } from '@/components/ui/button';
import { useFormat } from '@/lib/format';
import { useOnline } from '@/lib/online';
import { useThingCtx } from './context';
import { type OriginalHandle, useOriginalFile } from './original-file';
import { PurchaseSheet } from './purchase-sheet';
import { UploadButton } from './upload';
import { Bidi, KeyValues, KV, useMoney } from './values';

export function PurchaseSection() {
  const { thing, moduleOn, can, refresh } = useThingCtx();
  const { t } = useLingui();
  const fmt = useFormat();
  const money = useMoney();
  const online = useOnline();
  const [editing, setEditing] = useState(false);
  const p = thing.purchase;
  const canEdit = can('things.edit');
  // No purchase: offered to those who may edit, where the Money module is on (#348).
  if (!p && !(canEdit && moduleOn('money'))) return null;
  const sheet = <PurchaseSheet isOpen={editing} onClose={() => setEditing(false)} />;
  if (!p)
    return (
      <Section title={<Trans>Purchase</Trans>}>
        <div className="grid gap-2 rounded-[10px] border border-dashed border-line px-4 py-3">
          <p className="m-0 text-small text-ink-2">
            <Trans>No purchase recorded: when and where it was bought, and what it cost.</Trans>
          </p>
          <Button
            variant="secondary"
            size="small"
            className="justify-self-start"
            isDisabled={!online}
            onPress={() => setEditing(true)}
          >
            <PlusIcon className="size-4" />
            <Trans>Add the purchase</Trans>
          </Button>
        </div>
        {sheet}
      </Section>
    );
  const price = p.unitPrice && p.currency ? money(p.unitPrice, p.currency) : null;
  // A receipt shows the price: it goes on the purchase only where the reader sees money.
  const canAddReceipt =
    !!p.purchaseId &&
    can('attachments.add') &&
    moduleOn('money') &&
    !p.moneyHidden &&
    !thing.moneyHidden;
  // A purchase kept where the reader can't open it (D115) is read-only here.
  const editable = canEdit && !!p.purchaseId;
  return (
    <Section
      title={<Trans>Purchase</Trans>}
      action={
        editable ? (
          <Button
            variant="ghost"
            size="small"
            isDisabled={!online}
            aria-label={t`Edit the purchase`}
            onPress={() => setEditing(true)}
          >
            <PencilIcon className="size-4" />
            <Trans>Edit</Trans>
          </Button>
        ) : null
      }
    >
      <KeyValues label={t`Purchase`}>
        {p.purchasedOn ? <KV label={t`Bought`}>{fmt.date(p.purchasedOn)}</KV> : null}
        {p.vendor ? (
          <KV label={t`From`}>
            <Bidi>{p.vendor.name}</Bidi>
          </KV>
        ) : null}
        {p.lineDescription ? (
          <KV label={t`On the receipt`}>
            <Bidi>{p.lineDescription}</Bidi>
          </KV>
        ) : null}
        {moduleOn('money') ? (
          <KV label={t`Price`}>
            {price ? (
              p.quantity && p.quantity > 1 ? (
                <Trans>
                  {fmt.num(p.quantity)} × {price}
                </Trans>
              ) : (
                price
              )
            ) : p.moneyHidden || thing.moneyHidden ? (
              <span className="text-ink-3">
                <Trans>Not shown to viewers here</Trans>
              </span>
            ) : (
              <span className="text-ink-3">
                <Trans>Not recorded</Trans>
              </span>
            )}
          </KV>
        ) : null}
      </KeyValues>
      {p.receipts.length || canAddReceipt ? (
        <div className="flex flex-wrap items-center gap-2">
          {p.receipts.length ? <Receipts receipts={p.receipts} /> : null}
          {canAddReceipt && online ? (
            <UploadButton
              locationId={thing.locationId}
              subject={{ purchaseId: p.purchaseId as string }}
              attachAs="receipt"
              label={t`Add a receipt`}
              variant="ghost"
              nameFromFile
              onUploaded={() => void refresh()}
            />
          ) : null}
        </div>
      ) : null}
      {p.receipts.length || canAddReceipt ? (
        <p className="m-0 text-small text-ink-3">
          <Trans>
            These are the purchase’s receipts: every thing bought on it shows them. A receipt added
            under Paperwork is this thing’s own and shows only there.
          </Trans>
        </p>
      ) : null}
      {canEdit && !p.purchaseId ? (
        <p className="m-0 text-small text-ink-3">
          <Trans>This purchase is kept in another location; change it there.</Trans>
        </p>
      ) : null}
      {sheet}
    </Section>
  );
}

/**
 * Pressing an attachment (D157): a link opens; a file opens through a short-lived signed URL,
 * its original for someone who may add attachments, else its inline display or thumb; a receipt
 * after a move uses ?thingId. On the installed iPhone app an original is shared instead
 * (original-file.ts).
 */
export function useAttachmentFile(a: AttachmentView): OriginalHandle {
  const { thing, can } = useThingCtx();
  const variant = can('attachments.add') ? 'original' : a.file?.displayUrl ? 'display' : 'thumb';
  const handle = useOriginalFile(
    a.file && !a.url
      ? { fileId: a.file.id, mime: a.file.mime, role: a.role, thingId: thing.id, variant }
      : null,
  );
  if (a.url) {
    const url = a.url;
    return { mode: 'open', pending: false, press: () => window.open(url, '_blank', 'noopener') };
  }
  return handle;
}

function Receipts({ receipts }: { receipts: AttachmentView[] }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
      {receipts.map((r, i) => (
        <li key={r.id} className="flex flex-wrap items-center gap-1.5">
          <ReceiptButton receipt={r} n={receipts.length > 1 ? i + 1 : null} />
          {/* #348: the same file is the thing's own too, not a second receipt. */}
          {r.alsoInPaperwork ? (
            <span className="text-small text-ink-3">
              <Trans>Also in Paperwork</Trans>
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Its name (a receipt keeps its file's name, #183), else "Receipt", numbered when there are more. */
function ReceiptButton({ receipt, n }: { receipt: AttachmentView; n: number | null }) {
  const file = useAttachmentFile(receipt);
  const fmt = useFormat();
  return (
    <Button
      ref={file.ref}
      variant="secondary"
      size="small"
      isPending={file.pending}
      onPress={file.press}
    >
      {file.mode === 'share' ? (
        <ShareIcon className="size-4" />
      ) : (
        <DocumentIcon className="size-4" />
      )}
      {receipt.name?.trim() ? (
        <bdi>{receipt.name}</bdi>
      ) : n === null ? (
        <Trans>Receipt</Trans>
      ) : (
        <Trans>Receipt {fmt.num(n)}</Trans>
      )}
    </Button>
  );
}
