/**
 * A barcode, serial number or asset tag nothing here carries (D104, D126, D137 case 4). The sheet
 * names the code's type ("Data Matrix", "Code 39"). For a product's GTIN, when the server's lookup
 * is on, one `GET /barcodes/:code` names the product (Open Food Facts and its sister databases,
 * with their ODbL attribution shown); nothing about it is stored on the server, and no product
 * image is ever fetched. Found or not, "Add as a new thing" queues a THING capture with the code
 * kept where it belongs and the name filled in, which the person can change; it works offline,
 * where the lookup can't run.
 *
 * Where the code goes (@kept/shared `parseScan`): a product barcode to the barcode, with a GS1
 * code's serial number as the serial; an asset tag (Code 39, Code 93) to the serial unless the
 * person picks Barcode; plain Data Matrix, PDF417 or Aztec text where the person says.
 */
import { isProductCode, newId } from '@kept/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState } from 'react';
import { Form } from 'react-aria-components';
import { useBarcode } from '@/api/capture/queries';
import { rememberTarget } from '@/components/capture/target';
import { Notice } from '@/components/page';
import type { PickedPlace } from '@/components/places/move-picker';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { AgainOrDone, AnswerFrame, type AnswerProps } from './outcome-sheet';
import { queueItem, type Resolution } from './resolve';
import { WherePicker } from './where-picker';

/** "Stabilo Textmarker": the brand first, unless the product's name already starts with it. */
export function productName(p: { name: string | null; brand: string | null }): string {
  const name = p.name?.trim() ?? '';
  const brand = p.brand?.trim() ?? '';
  if (!brand) return name;
  if (!name) return brand;
  return name.toLowerCase().startsWith(brand.toLowerCase()) ? name : `${brand} ${name}`;
}

/** A code's type as it is printed and known everywhere: never translated. */
const TYPE_NAMES: Record<string, string> = {
  qr_code: 'QR code',
  ean_13: 'EAN-13',
  ean_8: 'EAN-8',
  upc_a: 'UPC-A',
  upc_e: 'UPC-E',
  code_128: 'Code 128',
  code_39: 'Code 39',
  code_93: 'Code 93',
  itf: 'ITF',
  codabar: 'Codabar',
  data_matrix: 'Data Matrix',
  pdf417: 'PDF417',
  aztec: 'Aztec',
  gs1: 'GS1',
};

type Field = 'serial' | 'barcode';
type BarcodeRead = Extract<Resolution, { outcome: 'barcode' }>;

/** What a new thing keeps of the code: its barcode, its serial number, or both (a GS1 code). */
export function codeFields(
  read: BarcodeRead,
  picked: Field | null,
): {
  barcode?: string;
  serial?: string;
} {
  const field = read.field ?? 'barcode';
  const into = field === 'either' ? picked : field;
  if (into === 'barcode')
    return { barcode: read.code.slice(0, 64), ...(read.serial ? { serial: read.serial } : {}) };
  if (into === 'serial') return { serial: read.code.slice(0, 100) };
  return {};
}

export function BarcodeSheet({
  read,
  store,
  online,
  onCamera,
  onAgain,
  onDone,
  onQueued,
}: AnswerProps & { read: BarcodeRead }) {
  const { t } = useLingui();
  const { code, lookupEnabled } = read;
  const field = read.field ?? 'barcode';
  const product = isProductCode({
    kind: 'barcode',
    code,
    symbology: read.symbology ?? '',
    field,
  });
  const typeName = read.symbology ? TYPE_NAMES[read.symbology] : undefined;
  const [picked, setPicked] = useState<Field | null>(
    field === 'either' ? (read.prefer ?? null) : null,
  );
  const lookup = useBarcode(online && lookupEnabled && product ? code : null);
  const found = lookup.data?.enabled && lookup.data.found ? lookup.data : null;
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [place, setPlace] = useState<PickedPlace | null>(null);
  const [busy, setBusy] = useState(false);
  const pick = useCallback((p: PickedPlace) => setPlace(p), []);

  // The product's name, once, as the starting point.
  const suggested = found?.product ? productName(found.product) : '';
  useEffect(() => {
    if (suggested) setName((n) => n || suggested);
  }, [suggested]);

  const add = async () => {
    if (!store || !place) return;
    setBusy(true);
    try {
      const id = newId();
      const typed = name.trim().slice(0, 200);
      await store.enqueue(
        queueItem(
          'create_thing',
          place.locationId,
          {
            id,
            target: { placeId: place.placeId },
            mode: 'thing',
            batchId: newId(),
            files: [],
            ...codeFields(read, picked),
            ...(typed ? { name: typed } : {}),
          },
          { key: `cap:${id}` },
        ),
        [],
      );
      rememberTarget({ locationId: place.locationId, placeId: place.placeId, containerId: null });
      onQueued?.();
      toast({
        title: typed ? t`Added ${typed}` : t`Added a new thing`,
        description: t`Its ID arrives when it syncs.`,
        tone: 'ok',
      });
      onAgain();
    } finally {
      setBusy(false);
    }
  };

  const status = !product ? null : lookupEnabled === null || !online ? (
    <Trans>Looking it up needs a connection.</Trans>
  ) : !lookupEnabled ? null : lookup.isPending ? (
    <Trans>Looking it up…</Trans>
  ) : lookup.data?.enabled && !lookup.data.found ? (
    <Trans>Not found in the product databases.</Trans>
  ) : lookup.isError ? (
    <Trans>The lookup didn't answer. You can still add it.</Trans>
  ) : null;

  return (
    <AnswerFrame label={t`Scan result`} onCamera={onCamera}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-small text-ink-3">
          {typeName ? <bdi dir="ltr">{typeName}</bdi> : <Trans>Product barcode</Trans>}
        </span>
        <bdi dir="ltr" className="font-mono text-small text-ink [overflow-wrap:anywhere]">
          {code}
        </bdi>
      </div>
      {read.serial ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-small text-ink-3">
            <Trans>Serial number</Trans>
          </span>
          <bdi dir="ltr" className="font-mono text-small text-ink [overflow-wrap:anywhere]">
            {read.serial}
          </bdi>
        </div>
      ) : null}
      {found?.product ? (
        <div className="grid gap-0.5">
          <h2 className="m-0 font-semibold text-[19px] [overflow-wrap:anywhere]">
            <bdi>{productName(found.product) || t`A product`}</bdi>
          </h2>
          {found.product.quantity ? (
            <bdi className="text-small text-ink-3">{found.product.quantity}</bdi>
          ) : null}
          <span className="text-[12.5px] text-ink-3">
            <Trans>From {found.attribution}</Trans>
          </span>
        </div>
      ) : (
        <h2 className="m-0 font-semibold text-[19px]">
          {field === 'serial' ? (
            <Trans>A serial number</Trans>
          ) : field === 'either' ? (
            <Trans>A serial number or a barcode</Trans>
          ) : (
            <Trans>A product barcode</Trans>
          )}
        </h2>
      )}
      {status ? <p className="m-0 text-small text-ink-3">{status}</p> : null}

      {adding ? (
        <Form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <TextField
            label={t`Name`}
            description={t`Optional: without one it waits in the Inbox to be named.`}
            value={name}
            onChange={setName}
            maxLength={200}
          />
          {field === 'either' ? (
            <Segmented<Field>
              label={t`Keep the code as`}
              value={picked}
              onChange={setPicked}
              isRequired
              options={[
                { id: 'serial', label: t`Serial number` },
                { id: 'barcode', label: t`Barcode` },
              ]}
            />
          ) : null}
          <WherePicker store={store} label={t`Where it is`} value={place} onChange={pick} />
          {!store ? (
            <Notice tone="info">
              <Trans>Opening this phone's copy of your Kept…</Trans>
            </Notice>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onPress={() => setAdding(false)}>
              <Trans>Back</Trans>
            </Button>
            <Button
              type="submit"
              isPending={busy}
              isDisabled={!store || !place || (field === 'either' && !picked)}
            >
              <Trans>Add</Trans>
            </Button>
          </div>
        </Form>
      ) : (
        <>
          <p className="m-0 text-ink-2">
            {field === 'serial' ? (
              <Trans>Kept stores it as the serial number.</Trans>
            ) : field === 'either' ? (
              <Trans>Kept stores it as the serial number or the barcode: you pick.</Trans>
            ) : read.serial ? (
              <Trans>Kept stores the barcode and serial number with it.</Trans>
            ) : (
              <Trans>Kept stores the barcode with it.</Trans>
            )}
          </p>
          <Button onPress={() => setAdding(true)}>
            <Trans>Add as a new thing</Trans>
          </Button>
          <AgainOrDone onAgain={onAgain} onDone={onDone} />
        </>
      )}
    </AnswerFrame>
  );
}
