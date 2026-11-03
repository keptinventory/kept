/**
 * Add or change a thing's purchase from its page (#348): what the purchase routes allow
 * (apps/server/src/purchases/routes.ts), so nobody needs the API for it. When it was bought, where,
 * its line on the receipt, the price of one with its currency, the receipt's total and tax, and
 * notes; the receipts themselves (add, rename, replace, remove); and removing the purchase. The
 * assistant's `update_thing` takes the same parts (#215).
 *
 * - No purchase yet: `POST /purchases` with one line for this thing (its name unless typed, its
 *   quantity, the price of one), the total the line's unless typed, as Add a thing makes it.
 * - A purchase: `GET /purchases/:id` for its version and lines, then `PATCH` (If-Match) with what
 *   changed. This thing's line (by `lineId`) carries its text and price; every other line is sent
 *   back by id, unchanged (a PATCH drops the lines it leaves out). A one-line purchase's total
 *   follows its line unless the total was typed; a receipt with several things says the date and
 *   shop change for all of them.
 * - Remove: a purchase that is this thing's alone is deleted (its receipts go with it); one with
 *   other things only lets go of this thing (`DELETE /purchase-lines/:id/link?thingId`).
 *
 * With money hidden (the Money module off, or a viewer where viewers don't see money) prices,
 * totals and receipts aren't offered and never sent; the rest still changes, as the server allows.
 */
import { AmountError, can as canDo, parseAmount } from '@kept/shared';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FileTrigger } from 'react-aria-components';
import { isApiError } from '@/api/client';
import { thingApi } from '@/api/inventory/thing-api';
import type { AttachmentView, PurchaseView, UpdatePurchaseBody } from '@/api/inventory/types';
import { DocumentIcon, PencilIcon, TrashIcon } from '@/components/icons';
import { Notice, useErrorText } from '@/components/page';
import { attachmentTitle, RenameFileSheet } from '@/components/paperwork/rename-sheet';
import { accessOf } from '@/components/schedules/access';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm';
import { DatePicker } from '@/components/ui/date-picker';
import { DialogFooter } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { isolate } from '@/lib/bidi';
import { useThingCtx } from './context';
import { useRoleLabels } from './labels';
import { CurrencyPicker, RegistryPicker, useLocationAccountId } from './pickers';
import { Sheet } from './sheet';
import { nameOfFile, UploadButton, uploadAndAttach } from './upload';

/**
 * `amount × quantity`, exactly: a one-line purchase's total. Amounts have at most 4 decimals and
 * quantities 3 (the server's numeric(16,4) and its line quantity); the product is rounded half up
 * to 4 decimals, as the server stores it.
 */
export function lineTotal(amount: string, quantity: number): string {
  const [int = '0', frac = ''] = amount.split('.');
  const cents = BigInt(int) * 10_000n + BigInt(frac.padEnd(4, '0').slice(0, 4) || '0');
  const milli = BigInt(Math.round((quantity > 0 ? quantity : 1) * 1000));
  const total = (cents * milli + 500n) / 1000n;
  const whole = total / 10_000n;
  const rest = (total % 10_000n).toString().padStart(4, '0').replace(/0+$/, '');
  return rest ? `${whole}.${rest}` : `${whole}`;
}

type Errors = Partial<
  Record<'purchasedOn' | 'line' | 'price' | 'total' | 'tax' | 'currency' | 'form', string>
>;

export function PurchaseSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useLingui();
  const { thing } = useThingCtx();
  const p = thing.purchase;
  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={
        p
          ? t`Purchase of ${isolate(thing.name ?? '')}`
          : t`Add the purchase of ${isolate(thing.name ?? '')}`
      }
    >
      {isOpen ? <PurchaseForm onClose={onClose} /> : null}
    </Sheet>
  );
}

/** An amount as typed, canonical; null when empty; `false` when it isn't one. */
function amountOf(raw: string): string | null | false {
  if (!raw.trim()) return null;
  try {
    return parseAmount(raw);
  } catch (err) {
    if (err instanceof AmountError) return false;
    throw err;
  }
}

function PurchaseForm({ onClose }: { onClose: () => void }) {
  const { t } = useLingui();
  const { thing, location, moduleOn, can, refresh } = useThingCtx();
  const errorText = useErrorText();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const accountId = useLocationAccountId(location);
  const p = thing.purchase;
  const today = accessOf(location).today;
  // Prices only where the reader sees them, and the Money module is on.
  const showMoney = moduleOn('money') && !thing.moneyHidden && !p?.moneyHidden;
  // The purchase itself: its version, its lines, total, tax, notes and receipts.
  const existing = useQuery({
    queryKey: ['purchases', p?.purchaseId ?? ''],
    queryFn: () => thingApi.purchase(p?.purchaseId ?? ''),
    enabled: !!p?.purchaseId,
    retry: false,
  });
  const view = existing.data;
  const lineOf = (v: PurchaseView) =>
    v.lines.find((l) => l.id === p?.lineId) ?? v.lines.find((l) => l.thing?.id === thing.id);
  const mineNow = view ? lineOf(view) : undefined;
  const others = view && mineNow ? view.lines.filter((l) => l.id !== mineNow.id).length : 0;

  const [boughtOn, setBoughtOn] = useState<string | null>(p?.purchasedOn ?? today);
  const [vendorId, setVendorId] = useState<string | null>(p?.vendor?.id ?? null);
  const [line, setLine] = useState(p?.lineDescription ?? thing.name ?? '');
  const [price, setPrice] = useState(p?.unitPrice ?? '');
  const [currency, setCurrency] = useState<string | null>(p?.currency ?? location.currency);
  // The receipt's total, tax and notes: the purchase's until they are typed (null: untouched).
  const [total, setTotal] = useState<string | null>(null);
  const [tax, setTax] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const totalText = total ?? view?.total ?? '';
  const taxText = tax ?? view?.tax ?? '';
  const notesText = notes ?? view?.notes ?? '';
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const e: Errors = {};
    if (!boughtOn) e.purchasedOn = t`Choose the day it was bought.`;
    if (line.trim().length > 300) e.line = t`At most 300 characters.`;
    const amount = showMoney ? amountOf(price) : null;
    const totalIn = showMoney && total !== null ? amountOf(total) : null;
    const taxIn = showMoney && tax !== null ? amountOf(tax) : null;
    const amountHint = t`Enter an amount, like 1250 or 1250.50.`;
    if (amount === false) e.price = amountHint;
    if (totalIn === false) e.total = amountHint;
    if (taxIn === false) e.tax = amountHint;
    if (showMoney && (amount || totalIn || taxIn) && !currency)
      e.currency = t`A price needs a currency.`;
    setErrors(e);
    if (
      Object.keys(e).length ||
      !boughtOn ||
      amount === false ||
      totalIn === false ||
      taxIn === false
    )
      return;
    const quantity = thing.quantity > 0 ? thing.quantity : 1;
    const description = line.trim() || thing.name || t`Untitled`;
    setBusy(true);
    try {
      if (!p) {
        const sum = totalIn ?? (amount ? lineTotal(amount, quantity) : null);
        await thingApi.createPurchase({
          locationId: thing.locationId,
          purchasedOn: boughtOn,
          ...(vendorId ? { vendorId } : {}),
          ...(showMoney && currency && (amount || sum || taxIn) ? { currency } : {}),
          ...(sum ? { total: sum } : {}),
          ...(taxIn ? { tax: taxIn } : {}),
          ...(notesText.trim() ? { notes: notesText.trim() } : {}),
          lines: [
            {
              description,
              quantity,
              ...(amount ? { unitPrice: amount } : {}),
              thingId: thing.id,
            },
          ],
        });
      } else {
        if (!p.purchaseId) return; // kept where the reader can't open it: no Edit is offered
        const v: PurchaseView = view ?? (await thingApi.purchase(p.purchaseId));
        const mine = lineOf(v);
        const body: UpdatePurchaseBody = {};
        if (boughtOn !== v.purchasedOn) body.purchasedOn = boughtOn;
        if (vendorId !== (v.vendor?.id ?? null)) body.vendorId = vendorId;
        if (notes !== null && (notes.trim() || null) !== v.notes) body.notes = notes.trim() || null;
        if (mine) {
          const changeLine: { description?: string; unitPrice?: string | null } = {};
          if (description !== mine.description) changeLine.description = description;
          // Compared canonically: "28999.00" is the 28999 it was.
          const was = mine.unitPrice ? amountOf(mine.unitPrice) || mine.unitPrice : null;
          if (showMoney && amount !== was) changeLine.unitPrice = amount;
          if (Object.keys(changeLine).length) {
            // Every line goes back by id: a PATCH drops the lines it leaves out.
            body.lines = v.lines.map((l) =>
              l.id === mine.id ? { id: l.id, ...changeLine } : { id: l.id },
            );
          }
          // A one-line purchase's total is its line's, unless the total was typed.
          if (total === null && v.lines.length === 1 && changeLine.unitPrice !== undefined)
            body.total = amount ? lineTotal(amount, mine.quantity) : null;
        }
        if (showMoney) {
          const canon = (x: string | undefined) => (x ? amountOf(x) || x : null);
          if (total !== null && totalIn !== canon(v.total)) body.total = totalIn;
          if (tax !== null && taxIn !== canon(v.tax)) body.tax = taxIn;
          const amounts =
            !!body.lines?.some((l) => l.unitPrice) || !!body.total || !!body.tax || !!amount;
          if (currency !== v.currency && amounts) body.currency = currency;
        }
        if (Object.keys(body).length) await thingApi.updatePurchase(v.id, body, v.rowVersion);
      }
      await refresh();
      await qc.invalidateQueries({ queryKey: ['purchases'] });
      onClose();
      toast({ title: t`Purchase saved`, tone: 'ok' });
    } catch (err) {
      setErrors({ form: errorText(err) });
      // Someone saved it first: read its new version, so the next Save isn't refused again.
      // What was typed stays; what wasn't now shows theirs.
      if (isApiError(err) && err.status === 412) void existing.refetch();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!p?.purchaseId) return;
    let v: PurchaseView;
    try {
      v = view ?? (await thingApi.purchase(p.purchaseId));
    } catch (err) {
      setErrors({ form: errorText(err) });
      return;
    }
    const mine = lineOf(v);
    const alone = !mine || v.lines.length === 1;
    const ok = await confirm(
      alone
        ? {
            title: t`Remove this purchase?`,
            body: t`Its date, shop, price and receipts go. The thing stays.`,
            confirmLabel: t`Remove`,
            destructive: true,
          }
        : {
            title: t`Take ${isolate(thing.name ?? '')} off this receipt?`,
            body: t`The receipt and its other things stay as they are.`,
            confirmLabel: t`Take it off`,
            destructive: true,
          },
    );
    if (!ok) return;
    setBusy(true);
    try {
      if (alone) await thingApi.deletePurchase(v.id);
      else if (mine) await thingApi.unlinkLine(mine.id, thing.id);
      await refresh();
      await qc.invalidateQueries({ queryKey: ['purchases'] });
      onClose();
      toast({ title: alone ? t`Purchase removed` : t`Taken off the receipt`, tone: 'ok' });
    } catch (err) {
      setErrors({ form: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  const mayReceipts = showMoney && !!p?.purchaseId && can('attachments.add') && !!view;

  return (
    <form
      noValidate
      className="grid gap-3.5"
      onSubmit={(ev) => {
        ev.preventDefault();
        void save();
      }}
    >
      {others > 0 ? (
        <p className="m-0 text-small text-ink-2">
          <Plural
            value={others}
            one="This receipt has # other thing on it: the date and shop change for it too."
            other="This receipt has # other things on it: the date and shop change for them too."
          />
        </p>
      ) : null}
      <DatePicker
        label={t`Bought on`}
        value={boughtOn}
        onChange={setBoughtOn}
        maxValue={today}
        {...(errors.purchasedOn ? { errorMessage: errors.purchasedOn } : {})}
      />
      <RegistryPicker
        kind="vendors"
        accountId={accountId}
        label={t`Shop`}
        value={vendorId}
        onChange={setVendorId}
        addIn={thing.locationId}
      />
      <TextField
        label={t`On the receipt`}
        description={t`How the receipt names it.`}
        value={line}
        onChange={setLine}
        {...(errors.line ? { errorMessage: errors.line, isInvalid: true } : {})}
      />
      {showMoney ? (
        <>
          <div className="grid gap-3 md:grid-cols-[1fr_10rem]">
            <TextField
              label={t`Price of one`}
              value={price}
              onChange={setPrice}
              inputProps={{ inputMode: 'decimal', dir: 'ltr' }}
              {...(errors.price ? { errorMessage: errors.price, isInvalid: true } : {})}
            />
            <div className="grid gap-1">
              <CurrencyPicker label={t`Currency`} value={currency} onChange={setCurrency} />
              {errors.currency ? (
                <span role="alert" className="text-small font-medium text-danger">
                  {errors.currency}
                </span>
              ) : null}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <TextField
              label={t`Receipt total`}
              {...(others > 0
                ? {}
                : { description: t`Left empty, it is the price times the quantity.` })}
              value={totalText}
              onChange={setTotal}
              inputProps={{ inputMode: 'decimal', dir: 'ltr' }}
              {...(errors.total ? { errorMessage: errors.total, isInvalid: true } : {})}
            />
            <TextField
              label={t`Tax`}
              value={taxText}
              onChange={setTax}
              inputProps={{ inputMode: 'decimal', dir: 'ltr' }}
              {...(errors.tax ? { errorMessage: errors.tax, isInvalid: true } : {})}
            />
          </div>
        </>
      ) : null}
      <TextField label={t`Purchase notes`} value={notesText} onChange={setNotes} />
      {mayReceipts && view ? (
        <ReceiptsEditor purchase={view} onChanged={() => void existing.refetch()} />
      ) : null}
      {errors.form ? <Notice tone="danger" title={errors.form} /> : null}
      <DialogFooter>
        {p?.purchaseId ? (
          <Button
            variant="danger"
            className="me-auto"
            isDisabled={busy}
            onPress={() => void remove()}
          >
            <TrashIcon className="size-4" />
            <Trans>Remove</Trans>
          </Button>
        ) : null}
        <Button variant="secondary" onPress={onClose}>
          <Trans>Cancel</Trans>
        </Button>
        <Button type="submit" isPending={busy}>
          <Trans>Save</Trans>
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * The purchase's receipts in the sheet: add one, rename, replace or remove each. A file keeps its
 * own name when it is added (#183). Who may change one: their own for members, anyone's for owners
 * and admins, as on Paperwork.
 */
function ReceiptsEditor({
  purchase,
  onChanged,
}: {
  purchase: PurchaseView;
  onChanged: () => void;
}) {
  const { t } = useLingui();
  const { thing, role, me, refresh } = useThingCtx();
  const roles = useRoleLabels();
  const changed = async () => {
    onChanged();
    await refresh();
  };
  return (
    <fieldset className="m-0 grid gap-2 rounded-[10px] border border-line p-3">
      <legend className="px-1 text-small font-semibold text-ink-3">
        <Trans>Receipts</Trans>
      </legend>
      {purchase.receipts.length ? (
        <ul className="m-0 grid list-none gap-1.5 p-0">
          {purchase.receipts.map((r, i) => (
            <ReceiptRow
              key={r.id}
              receipt={r}
              label={attachmentTitle(
                r,
                purchase.receipts.length > 1 ? t`Receipt ${i + 1}` : roles[r.role],
              )}
              mayChange={
                r.createdBy.displayName === me
                  ? canDo(role, 'attachments.delete-own')
                  : canDo(role, 'attachments.delete-any')
              }
              purchaseId={purchase.id}
              onChanged={changed}
            />
          ))}
        </ul>
      ) : (
        <p className="m-0 text-small text-ink-2">
          <Trans>No receipt yet.</Trans>
        </p>
      )}
      <UploadButton
        locationId={thing.locationId}
        subject={{ purchaseId: purchase.id }}
        attachAs="receipt"
        label={t`Add a receipt`}
        variant="ghost"
        nameFromFile
        onUploaded={changed}
      />
    </fieldset>
  );
}

function ReceiptRow({
  receipt: r,
  label,
  mayChange,
  purchaseId,
  onChanged,
}: {
  receipt: AttachmentView;
  label: string;
  mayChange: boolean;
  purchaseId: string;
  onChanged: () => Promise<void>;
}) {
  const { t } = useLingui();
  const { thing } = useThingCtx();
  const confirm = useConfirm();
  const errorText = useErrorText();
  const [renaming, setRenaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const title = label;
  const fail = (e: unknown) =>
    toast({ title: t`Couldn't change the receipt`, description: errorText(e), tone: 'danger' });
  const replace = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const name = nameOfFile(file);
      await uploadAndAttach({
        file,
        locationId: thing.locationId,
        subject: { purchaseId },
        role: r.role,
        ...(name ? { name } : {}),
      });
      await thingApi.deleteAttachment(r.id);
      await onChanged();
      toast({ title: t`Receipt replaced`, tone: 'ok' });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (
      !(await confirm({
        title: t`Remove ${isolate(label)}?`,
        body: t`It comes off the purchase. The file itself stays until it's purged.`,
        confirmLabel: t`Remove`,
        destructive: true,
      }))
    )
      return;
    try {
      await thingApi.deleteAttachment(r.id);
      await onChanged();
    } catch (e) {
      fail(e);
    }
  };
  return (
    <li className="flex flex-wrap items-center gap-2">
      <DocumentIcon className="size-4 shrink-0 text-ink-3" />
      <bdi className="min-w-0 flex-1 [overflow-wrap:anywhere]">{label}</bdi>
      {mayChange ? (
        <span className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t`Name ${title}`}
            onPress={() => setRenaming(true)}
          >
            <PencilIcon />
          </Button>
          <FileTrigger onSelect={(files) => void replace(files)}>
            <Button variant="ghost" size="small" isPending={busy}>
              <Trans>Replace</Trans>
            </Button>
          </FileTrigger>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t`Remove ${label}`}
            onPress={() => void remove()}
          >
            <TrashIcon />
          </Button>
        </span>
      ) : null}
      <RenameFileSheet
        attachment={renaming ? r : null}
        what={label}
        onClose={() => setRenaming(false)}
        onRenamed={onChanged}
      />
    </li>
  );
}
