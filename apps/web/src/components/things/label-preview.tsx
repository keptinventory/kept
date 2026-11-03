/**
 * A thing's label as it prints (#366): the print sheet's own cell (labels/label-cell.tsx) at the
 * stock last chosen on this device, with the QR, the code and the name, read from the builder's
 * dry run (POST /labels/batches with dryRun: nothing saved), so it is exactly what Print makes.
 * Print opens the batch builder for this one thing; Download saves the label as a PNG at 300 dpi
 * (labels/png.ts), through the share sheet where the browser shares files. The PNG is made
 * ahead, so a press shares in its own turn (iOS refuses a share that waited).
 *
 * The thing page's Label card (from md) and its Label sheet (phones) show it. On demand
 * (vite.config.ts ON_DEMAND_ENTRIES): it reads the server only.
 */
import { labelStock } from '@kept/shared';
import { Trans, useLingui } from '@lingui/react/macro';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { captureApi, captureKeys } from '@/api/capture/queries';
import type { CreateLabelBatchBody } from '@/api/capture/types';
import { PrinterIcon, ShareIcon } from '@/components/icons';
import { useLabelMeasure } from '@/components/labels/fit';
import { LabelCell } from '@/components/labels/label-cell';
import { labelPngs, shareOrDownload } from '@/components/labels/png';
import { useQrEncoder } from '@/components/labels/qr';
import { rememberedStock, useStockText } from '@/components/labels/stock-picker';
import { LinkButton, LoadingRows, Notice, useErrorText } from '@/components/page';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { canShareType } from '@/lib/files';
import { useThingCtx } from './context';

/** The preview's width on screen, in CSS pixels: the label is zoomed to it. */
const WIDTH = 260;

export default function LabelPreview() {
  const { thing } = useThingCtx();
  const { t } = useLingui();
  const errorText = useErrorText();
  const stockText = useStockText();
  const encode = useQrEncoder();
  const { measure } = useLabelMeasure();
  const [stockKey] = useState(rememberedStock);
  const stock = labelStock(stockKey);
  const body: CreateLabelBatchBody = {
    locationId: thing.locationId,
    kind: 'things',
    thingIds: [thing.id],
    stock: stockKey,
    startCell: 1,
  };
  const preview = useQuery({
    // The builder's key: the stock and start cell don't change what prints.
    queryKey: [...captureKeys.labels.all, 'preview', { ...body, stock: null, startCell: null }],
    queryFn: () => captureApi.previewLabelBatch(body),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const label = preview.data?.labels[0];

  // Where the share sheet takes PNGs, they're made ahead, so a press shares in its own turn.
  const [shareable] = useState(() => canShareType('kept-label.png', 'image/png'));
  const prepared = useQuery({
    queryKey: ['labels', 'pngs', 'thing', thing.id, stock.key, label?.code, label?.name],
    queryFn: () => labelPngs(stock, label ? [label] : []),
    enabled: shareable && !!label,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 0,
    retry: false,
  });
  const [saving, setSaving] = useState(false);
  const download = async () => {
    if (!label) return;
    setSaving(true);
    try {
      const files = prepared.data ?? (await labelPngs(stock, [label]));
      const how = await shareOrDownload(files, t`Kept label`);
      if (how === 'downloaded') toast({ title: t`Saved the label image`, tone: 'ok' });
      if (how === 'refused')
        toast({ title: t`Couldn't save the label image. Try again.`, tone: 'danger' });
    } catch (e) {
      toast({ title: errorText(e), tone: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  if (preview.isPending) return <LoadingRows rows={2} label={t`Loading the label`} />;
  if (preview.isError) return <Notice tone="danger">{errorText(preview.error)}</Notice>;
  if (!label)
    return (
      <p className="m-0 text-ink-2">
        <Trans>Its ID is still being made. Try again in a moment.</Trans>
      </p>
    );
  const zoom = WIDTH / ((stock.cell.w * 96) / 25.4);
  const { title } = stockText(stock);
  return (
    <div className="grid justify-items-start gap-3">
      <figure className="m-0 grid gap-1.5">
        <div
          // The label is paper: black on white in either theme, with the print sheet's cell.
          className="overflow-hidden rounded-md border border-line shadow-[0_8px_24px_rgba(0,0,0,.1)]"
          role="img"
          aria-label={t`The label as it prints: ${label.code}`}
        >
          <div style={{ zoom }}>
            <div style={{ inlineSize: `${stock.cell.w}mm`, blockSize: `${stock.cell.h}mm` }}>
              <LabelCell label={label} stock={stock} encode={encode} measure={measure} />
            </div>
          </div>
        </div>
        <figcaption className="text-small text-ink-2">{title}</figcaption>
      </figure>
      <div className="flex flex-wrap gap-2">
        <LinkButton
          to="/labels"
          search={{ loc: thing.locationId, things: thing.id }}
          variant="primary"
          size="small"
        >
          <PrinterIcon className="size-4" />
          <Trans>Print</Trans>
        </LinkButton>
        <Button
          size="small"
          variant="secondary"
          onPress={() => void download()}
          isPending={saving || prepared.isFetching}
        >
          <ShareIcon className="size-4" />
          <Trans>Download</Trans>
        </Button>
      </div>
    </div>
  );
}
