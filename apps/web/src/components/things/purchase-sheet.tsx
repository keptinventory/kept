/**
 * Add or change a thing's purchase from its page (#348): when it was bought, where, and the price
 * of one with its currency, the same fields as Add a thing's purchase and the assistant's
 * `add_thing` (date, shop, price, currency; #215). Through the purchase routes:
 *
 * - no purchase yet: `POST /purchases` with one line for this thing (its name, its quantity, the
 *   price of one), the total the line's, as Add a thing makes it;
 * - a purchase: `GET /purchases/:id` for its version and lines, then `PATCH` (If-Match) with the
 *   date and shop, and this thing's line's price. The other lines are sent back by id, unchanged
 *   (a PATCH drops the lines it leaves out). A one-line purchase's total follows its line; a
 *   receipt with several things keeps the total it has, and the sheet says the date and shop
 *   change for all of them.
 *
 * With money hidden (the Money module off, or a viewer where viewers don't see money) the price
 * isn't offered and never sent; the date and shop still change, as the server allows.
 */
import { AmountError, parseAmount } from '@kept/shared';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { thingApi } from '@/api/inventory/thing-api';
import type { PurchaseView, UpdatePurchaseBody } from '@/api/inventory/types';
import { Notice, useErrorText } from '@/components/page';
import { accessOf } from '@/components/schedules/access';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { DialogFooter } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { useThingCtx } from './context';
import { CurrencyPicker, RegistryPicker, useLocationAccountId } from './pickers';
import { Sheet } from './sheet';

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

type Errors = Partial<Record<'purchasedOn' | 'price' | 'currency' | 'form', string>>;

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
      title={p ? t`Purchase of ${thing.name ?? ''}` : t`Add the purchase of ${thing.name ?? ''}`}
    >
      {isOpen ? <PurchaseForm onClose={onClose} /> : null}
    </Sheet>
  );
}

function PurchaseForm({ onClose }: { onClose: () => void }) {
  const { t } = useLingui();
  const { thing, location, moduleOn, refresh } = useThingCtx();
  const errorText = useErrorText();
  const accountId = useLocationAccountId(location);
  const p = thing.purchase;
  const today = accessOf(location).today;
  // Prices only where the reader sees them, and the Money module is on.
  const showMoney = moduleOn('money') && !thing.moneyHidden && !p?.moneyHidden;
  // The purchase itself: its version, its lines (and so whether it holds other things).
  const existing = useQuery({
    queryKey: ['purchases', p?.purchaseId ?? ''],
    queryFn: () => thingApi.purchase(p?.purchaseId ?? ''),
    enabled: !!p?.purchaseId,
    retry: false,
  });
  const [boughtOn, setBoughtOn] = useState<string | null>(p?.purchasedOn ?? today);
  const [vendorId, setVendorId] = useState<string | null>(p?.vendor?.id ?? null);
  const [price, setPrice] = useState(p?.unitPrice ?? '');
  const [currency, setCurrency] = useState<string | null>(p?.currency ?? location.currency);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const view = existing.data;
  const lineOf = (v: PurchaseView) =>
    v.lines.find((l) => l.id === p?.lineId) ?? v.lines.find((l) => l.thing?.id === thing.id);
  const mineNow = view ? lineOf(view) : undefined;
  const others = view && mineNow ? view.lines.filter((l) => l.id !== mineNow.id).length : 0;

  const save = async () => {
    const e: Errors = {};
    if (!boughtOn) e.purchasedOn = t`Choose the day it was bought.`;
    let amount: string | null = null;
    if (showMoney && price.trim()) {
      try {
        amount = parseAmount(price);
      } catch (err) {
        if (!(err instanceof AmountError)) throw err;
        e.price = t`Enter an amount, like 1250 or 1250.50.`;
      }
      if (!currency) e.currency = t`A price needs a currency.`;
    }
    setErrors(e);
    if (Object.keys(e).length || !boughtOn) return;
    const quantity = thing.quantity > 0 ? thing.quantity : 1;
    setBusy(true);
    try {
      if (!p) {
        await thingApi.createPurchase({
          locationId: thing.locationId,
          purchasedOn: boughtOn,
          ...(vendorId ? { vendorId } : {}),
          ...(amount && currency ? { currency, total: lineTotal(amount, quantity) } : {}),
          lines: [
            {
              description: thing.name ?? t`Untitled`,
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
        if (showMoney && mine) {
          const before = mine.unitPrice ?? null;
          if (amount !== before || (amount && currency !== v.currency)) {
            if (amount && currency !== v.currency) body.currency = currency;
            // Every line goes back by id: a PATCH drops the lines it leaves out.
            body.lines = v.lines.map((l) =>
              l.id === mine.id ? { id: l.id, unitPrice: amount } : { id: l.id },
            );
            // A one-line purchase's total is its line's; a receipt of several keeps its own.
            if (v.lines.length === 1) body.total = amount ? lineTotal(amount, mine.quantity) : null;
          }
        }
        if (Object.keys(body).length) await thingApi.updatePurchase(v.id, body, v.rowVersion);
      }
      await refresh();
      onClose();
      toast({ title: t`Purchase saved`, tone: 'ok' });
    } catch (err) {
      setErrors({ form: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

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
      {showMoney ? (
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
      ) : null}
      {errors.form ? <Notice tone="danger" title={errors.form} /> : null}
      <DialogFooter>
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
